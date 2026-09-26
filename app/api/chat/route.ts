import { z } from 'zod'
import { auth } from '@/lib/auth/server'
import { consumeUserRateLimit, databasePool } from '@/lib/db'
import { isAllowedRequestOrigin } from '@/lib/request-security'

const messageSchema = z.object({ message: z.string().trim().min(1).max(240) }).strict()
const MAX_MESSAGES = 60

export async function GET() {
  try {
    const { rows } = await databasePool.query<{
      id: string
      senderName: string
      body: string
      createdAt: Date
    }>(
      `SELECT id::text,
              'Player ' || upper(substr(replace(sender_user_id::text, '-', ''), 1, 4)) AS "senderName",
              body,
              created_at AS "createdAt"
       FROM public.lobby_chat_messages
       WHERE created_at > now() - interval '30 days'
       ORDER BY created_at DESC, id DESC
       LIMIT $1`,
      [MAX_MESSAGES],
    )
    return Response.json(
      { messages: rows.reverse() },
      { headers: { 'Cache-Control': 'private, no-store, max-age=0' } },
    )
  } catch (error) {
    console.error('[v0] Lobby chat read failed:', error instanceof Error ? error.message : 'unknown error')
    return Response.json({ error: 'Lobby chat is unavailable.' }, { status: 503 })
  }
}

export async function POST(request: Request) {
  if (!isAllowedRequestOrigin(request)) {
    return Response.json({ error: 'Request origin is not allowed.' }, { status: 403 })
  }

  const { data: session } = await auth.getSession()
  if (!session?.user) return Response.json({ error: 'Sign in to send a message.' }, { status: 401 })
  if (!(await consumeUserRateLimit(session.user.id, 'lobby-chat', 6, 60))) {
    return Response.json({ error: 'Please wait before sending another message.' }, { status: 429 })
  }

  const contentLength = Number(request.headers.get('content-length') ?? 0)
  if (contentLength > 2048) return Response.json({ error: 'Message is too long.' }, { status: 413 })

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return Response.json({ error: 'Invalid message.' }, { status: 400 })
  }
  const parsed = messageSchema.safeParse(payload)
  if (!parsed.success) return Response.json({ error: 'Messages must be between 1 and 240 characters.' }, { status: 400 })

  try {
    const { rows } = await databasePool.query<{
      id: string
      senderName: string
      body: string
      createdAt: Date
    }>(
      `INSERT INTO public.lobby_chat_messages (sender_user_id, body)
       VALUES ($1::uuid, $2)
       RETURNING id::text,
                 sender_user_id::text AS "senderId",
                 'Player ' || upper(substr(replace(sender_user_id::text, '-', ''), 1, 4)) AS "senderName",
                 body,
                 created_at AS "createdAt"`,
      [session.user.id, parsed.data.message],
    )
    return Response.json({ message: rows[0] }, { status: 201, headers: { 'Cache-Control': 'private, no-store, max-age=0' } })
  } catch (error) {
    console.error('[v0] Lobby chat send failed:', error instanceof Error ? error.message : 'unknown error')
    return Response.json({ error: 'Your message could not be sent.' }, { status: 503 })
  }
}
