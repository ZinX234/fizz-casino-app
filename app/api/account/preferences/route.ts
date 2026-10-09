import { z } from 'zod'
import { auth } from '@/lib/auth/server'
import { databasePool } from '@/lib/db'
import { isAllowedRequestOrigin } from '@/lib/request-security'

const preferenceSchema = z.object({ pinned: z.boolean() }).strict()

export async function GET() {
  try {
    const { data: session } = await auth.getSession()
    if (!session?.user?.id) return Response.json({ pinned: true, canPersist: false })

    const { rows } = await databasePool.query<{ chat_pinned: boolean }>(
      'SELECT chat_pinned FROM public.user_preferences WHERE user_id = $1::uuid LIMIT 1',
      [session.user.id],
    )
    return Response.json({ pinned: rows[0]?.chat_pinned ?? true, canPersist: true })
  } catch (error) {
    console.error('[v0] Chat preference lookup failed:', error instanceof Error ? error.message : 'unknown error')
    return Response.json({ error: 'Chat preferences could not be loaded.' }, { status: 503 })
  }
}

export async function PUT(request: Request) {
  if (!isAllowedRequestOrigin(request)) {
    return Response.json({ error: 'Request origin is not allowed.' }, { status: 403 })
  }

  try {
    const { data: session } = await auth.getSession()
    if (!session?.user?.id) return Response.json({ error: 'Authentication required.' }, { status: 401 })

    let payload: unknown
    try {
      payload = await request.json()
    } catch {
      return Response.json({ error: 'Invalid chat preference.' }, { status: 400 })
    }

    const parsed = preferenceSchema.safeParse(payload)
    if (!parsed.success) return Response.json({ error: 'Invalid chat preference.' }, { status: 400 })

    await databasePool.query(
      `INSERT INTO public.user_preferences (user_id, chat_pinned, updated_at)
       VALUES ($1::uuid, $2, now())
       ON CONFLICT (user_id) DO UPDATE SET chat_pinned = EXCLUDED.chat_pinned, updated_at = now()`,
      [session.user.id, parsed.data.pinned],
    )
    return Response.json({ pinned: parsed.data.pinned, canPersist: true })
  } catch (error) {
    console.error('[v0] Chat preference update failed:', error instanceof Error ? error.message : 'unknown error')
    return Response.json({ error: 'Chat preference could not be saved.' }, { status: 503 })
  }
}
