import { z } from 'zod'
import { auth } from '@/lib/auth/server'
import { getCasinoAdminAccess } from '@/lib/casino-games'
import { withTransaction } from '@/lib/db'
import { isAllowedRequestOrigin } from '@/lib/request-security'

export const dynamic = 'force-dynamic'

const updateSchema = z.object({ isLive: z.boolean() }).strict()

export async function POST(request: Request) {
  if (!isAllowedRequestOrigin(request)) {
    return Response.json({ error: 'Request origin is not allowed.' }, { status: 403 })
  }

  const { data: session } = await auth.getSession()
  if (!session?.user) return Response.json({ error: 'Sign in required.' }, { status: 401 })

  const access = await getCasinoAdminAccess(session.user.id, session.user.email)
  if (!access.authorized) {
    return Response.json({ error: 'Administrator access is restricted.' }, { status: 403 })
  }

  const parsed = updateSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return Response.json({ error: 'Choose whether the Kick channel is live.' }, { status: 400 })
  }

  try {
    const isLive = await withTransaction(async (client) => {
      const { rows } = await client.query<{ is_live: boolean }>(
        `INSERT INTO public.site_settings (setting_key, setting_value, updated_by)
         VALUES ('kick_live', jsonb_build_object('isLive', $1::boolean), $2::uuid)
         ON CONFLICT (setting_key) DO UPDATE SET
           setting_value = EXCLUDED.setting_value,
           updated_by = EXCLUDED.updated_by,
           updated_at = now()
         RETURNING (setting_value ->> 'isLive')::boolean AS is_live`,
        [parsed.data.isLive, session.user.id],
      )

      await client.query(
        `INSERT INTO public.audit_logs (actor_user_id, action, entity_type, entity_id, details)
         VALUES ($1::uuid, 'kick.status.updated', 'site_setting', 'kick_live', jsonb_build_object('isLive', $2::boolean))`,
        [session.user.id, rows[0].is_live],
      )

      return rows[0].is_live
    })

    return Response.json({ isLive }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('[v0] Kick live status update failed:', error instanceof Error ? error.message : 'unknown error')
    return Response.json({ error: 'Kick status could not be saved.' }, { status: 500 })
  }
}
