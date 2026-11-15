import { z } from 'zod'
import { auth } from '@/lib/auth/server'
import { getCasinoAdminAccess } from '@/lib/casino-games'
import { consumeUserRateLimit, databasePool } from '@/lib/db'
import { isAllowedRequestOrigin } from '@/lib/request-security'

const requestSchema = z.object({
  username: z.string().trim().min(3).max(20).regex(/^[A-Za-z0-9_]+$/),
}).strict()

export async function POST(request: Request) {
  if (!isAllowedRequestOrigin(request)) {
    return Response.json({ error: 'Request origin is not allowed.' }, { status: 403 })
  }

  const { data: session } = await auth.getSession()
  if (!session?.user?.id || !session.user.email) {
    return Response.json({ error: 'Authentication required.' }, { status: 401 })
  }
  const access = await getCasinoAdminAccess(session.user.id, session.user.email)
  if (!access.authorized) {
    return Response.json({ error: 'Administrator access is restricted.' }, { status: 403 })
  }
  if (!(await consumeUserRateLimit(session.user.id, 'admin-password-reset', 5, 60))) {
    return Response.json({ error: 'Please wait before requesting another password reset.' }, { status: 429 })
  }

  const contentLength = Number(request.headers.get('content-length') ?? 0)
  if (contentLength > 2048) return Response.json({ error: 'Password reset request is too large.' }, { status: 413 })

  const parsed = requestSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return Response.json({ error: 'Enter a valid Fizz username.' }, { status: 400 })
  }

  try {
    const { rows } = await databasePool.query<{ id: string; email: string; username: string }>(
      `SELECT u.id::text, u.email, p.username
       FROM public.user_profiles p
       JOIN neon_auth."user" u ON u.id = p.user_id
       WHERE lower(p.username) = lower($1)
       LIMIT 1`,
      [parsed.data.username],
    )
    const player = rows[0]
    if (!player) return Response.json({ error: 'No player was found with that username.' }, { status: 404 })

    const redirectTo = new URL('/auth/reset-password', request.url).toString()
    const resetResult = await auth.requestPasswordReset({ email: player.email, redirectTo })
    if (resetResult.error) {
      console.error('[v0] Player password reset email failed:', resetResult.error.message)
      return Response.json({ error: 'The reset link could not be sent. Check the Neon Auth email reset configuration.' }, { status: 503 })
    }

    await databasePool.query(
      `INSERT INTO public.audit_logs (actor_user_id, action, entity_type, entity_id, details)
       VALUES ($1::uuid, 'auth.password_reset.requested', 'user', $2,
               jsonb_build_object('username', $3::text))`,
      [session.user.id, player.id, player.username],
    )
    return Response.json({ sent: true })
  } catch (error) {
    console.error('[v0] Player password reset request failed:', error instanceof Error ? error.message : 'unknown error')
    return Response.json({ error: 'The password reset link could not be sent.' }, { status: 503 })
  }
}
