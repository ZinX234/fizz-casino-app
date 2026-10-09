import { z } from 'zod'
import { auth } from '@/lib/auth/server'
import { consumeUserRateLimit, withTransaction } from '@/lib/db'

export const dynamic = 'force-dynamic'

const ticketSchema = z.object({
  subject: z.string().trim().min(3).max(160),
  message: z.string().trim().min(5).max(8000),
})

export async function POST(request: Request) {
  const { data: session } = await auth.getSession()
  if (!session?.user) return Response.json({ error: 'Authentication required.' }, { status: 401 })
  if (!(await consumeUserRateLimit(session.user.id, 'support-ticket-create', 5, 3600))) {
    return Response.json({ error: 'Please wait before creating another support ticket.' }, { status: 429 })
  }
  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return Response.json({ error: 'Invalid request body.' }, { status: 400 })
  }
  const parsed = ticketSchema.safeParse(payload)
  if (!parsed.success) return Response.json({ error: 'Enter a subject and a message.' }, { status: 400 })

  try {
    const ticketId = await withTransaction(async (client) => {
      const { rows: open } = await client.query<{ total: string }>(
        `SELECT count(*)::text AS total FROM public.support_tickets
         WHERE user_id = $1 AND status IN ('open','pending')`, [session.user.id],
      )
      if (Number(open[0]?.total) >= 10) throw new Error('OPEN_TICKET_LIMIT')
      const { rows } = await client.query<{ id: string }>(
        `INSERT INTO public.support_tickets (user_id, subject)
         VALUES ($1, $2) RETURNING id::text`, [session.user.id, parsed.data.subject],
      )
      await client.query(
        `INSERT INTO public.support_messages (ticket_id, sender_user_id, body)
         VALUES ($1, $2, $3)`, [rows[0].id, session.user.id, parsed.data.message],
      )
      await client.query(
        `INSERT INTO public.audit_logs (actor_user_id, action, entity_type, entity_id)
         VALUES ($1, 'support_ticket_created', 'support_ticket', $2)`, [session.user.id, rows[0].id],
      )
      return rows[0].id
    })
    return Response.json({ ticketId }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === 'OPEN_TICKET_LIMIT') {
      return Response.json({ error: 'Please wait for an existing ticket to be resolved before opening another.' }, { status: 429 })
    }
    console.error('[v0] Support ticket creation failed:', error instanceof Error ? error.message : 'unknown error')
    return Response.json({ error: 'We could not create your ticket. Please try again.' }, { status: 500 })
  }
}
