import { z } from 'zod'
import { auth } from '@/lib/auth/server'
import { consumeUserRateLimit, withTransaction } from '@/lib/db'

const limitSchema = z.object({
  limitType: z.enum(['deposit', 'loss', 'session_time']),
  period: z.enum(['day', 'week', 'month', 'per_session']),
  amount: z.string().regex(/^\d{1,6}(?:\.\d{1,2})?$/),
})

export async function POST(request: Request) {
  const { data: session } = await auth.getSession()
  if (!session?.user) return Response.json({ error: 'Authentication required.' }, { status: 401 })
  if (!(await consumeUserRateLimit(session.user.id, 'responsible-limit-update', 10, 3600))) {
    return Response.json({ error: 'Please wait before updating your limits again.' }, { status: 429 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid request body.' }, { status: 400 })
  }
  const parsed = limitSchema.safeParse(body)
  if (!parsed.success) return Response.json({ error: 'Enter a valid limit and period.' }, { status: 400 })
  const amount = Number(parsed.data.amount)
  if (!Number.isFinite(amount) || amount <= 0 || amount > 100000 ||
      (parsed.data.limitType === 'session_time' && !Number.isInteger(amount))) {
    return Response.json({ error: 'Enter a valid limit no greater than 100,000; session time must be whole minutes.' }, { status: 400 })
  }

  try {
    const startsAt = await withTransaction(async (client) => {
      const { rows: prior } = await client.query<{ id: string; limit_amount: string; created_at: Date }>(
        `SELECT id::text, limit_amount::text, created_at
         FROM public.responsible_gaming_limits
         WHERE user_id = $1 AND limit_type = $2 AND period = $3
           AND (ends_at IS NULL OR ends_at > now())
         ORDER BY created_at DESC LIMIT 1 FOR UPDATE`,
        [session.user.id, parsed.data.limitType, parsed.data.period],
      )
      const previous = prior[0]
      const isIncrease = previous !== undefined && amount > Number(previous.limit_amount)
      const mayIncrease = !previous || Date.now() - new Date(previous.created_at).getTime() >= 7 * 24 * 60 * 60 * 1000
      if (isIncrease && !mayIncrease) throw new Error('LIMIT_INCREASE_COOLDOWN')

      const effectiveAt = isIncrease ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) : new Date()
      if (previous) {
        await client.query(`UPDATE public.responsible_gaming_limits SET ends_at = $1 WHERE id = $2`, [effectiveAt, previous.id])
      }
      await client.query(
        `INSERT INTO public.responsible_gaming_limits (user_id, limit_type, limit_amount, period, starts_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [session.user.id, parsed.data.limitType, amount, parsed.data.period, effectiveAt],
      )
      await client.query(
        `INSERT INTO public.audit_logs (actor_user_id, action, entity_type, details)
         VALUES ($1, 'responsible_limit_set', 'responsible_gaming_limit', $2::jsonb)`,
        [session.user.id, JSON.stringify({ limitType: parsed.data.limitType, period: parsed.data.period, amount })],
      )
      return effectiveAt
    })
    return Response.json({ startsAt: startsAt.toISOString() }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === 'LIMIT_INCREASE_COOLDOWN') {
      return Response.json({ error: 'A higher limit cannot take effect until the safety delay has passed.' }, { status: 409 })
    }
    console.error('[v0] Responsible gaming limit save failed:', error instanceof Error ? error.message : 'unknown error')
    return Response.json({ error: 'We could not save this limit. Please try again.' }, { status: 500 })
  }
}
