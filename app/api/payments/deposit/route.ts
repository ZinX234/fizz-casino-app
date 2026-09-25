import { z } from 'zod'
import { auth } from '@/lib/auth/server'
import { consumeUserRateLimit } from '@/lib/db'

const depositSchema = z.object({ amount: z.number().finite().positive().max(10000) })

export async function POST(request: Request) {
  const { data: session } = await auth.getSession()
  if (!session?.user) return Response.json({ error: 'Authentication required.' }, { status: 401 })
  if (!(await consumeUserRateLimit(session.user.id, 'deposit-create', 5, 3600))) {
    return Response.json({ error: 'Please wait before starting another deposit.' }, { status: 429 })
  }
  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return Response.json({ error: 'Invalid request body.' }, { status: 400 })
  }
  const parsed = depositSchema.safeParse(payload)
  if (!parsed.success || Math.round(parsed.data?.amount * 100) !== parsed.data?.amount * 100) {
    return Response.json({ error: 'Enter a valid deposit amount.' }, { status: 400 })
  }

  return Response.json(
    { error: 'Deposits are unavailable until the PayMeGate checkout API and signed-webhook verification are implemented and configured.', code: 'PAYMENT_PROVIDER_UNAVAILABLE' },
    { status: 503 },
  )
}
