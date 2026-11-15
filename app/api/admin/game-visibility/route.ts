import { z } from 'zod'
import { auth } from '@/lib/auth/server'
import { getCasinoAdminAccess } from '@/lib/casino-games'
import { databasePool, withTransaction } from '@/lib/db'
import { isAllowedRequestOrigin } from '@/lib/request-security'

const updateSchema = z.object({
  gameId: z.string().uuid(),
  lobbyEnabled: z.boolean(),
}).strict()

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

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return Response.json({ error: 'Invalid game visibility request.' }, { status: 400 })
  }
  const parsed = updateSchema.safeParse(payload)
  if (!parsed.success) return Response.json({ error: 'Choose a valid game and visibility setting.' }, { status: 400 })

  try {
    const game = await withTransaction(async (client) => {
      const { rows } = await client.query<{
        id: string
        slug: string
        name: string
        status: string
        lobbyEnabled: boolean
      }>(
        `UPDATE public.games
         SET configuration = jsonb_set(configuration, '{lobbyEnabled}', to_jsonb($2::boolean), true),
             updated_at = now()
         WHERE id = $1::uuid
         RETURNING id::text, slug, name, status,
                   coalesce(configuration->>'lobbyEnabled', 'true') <> 'false' AS "lobbyEnabled"`,
        [parsed.data.gameId, parsed.data.lobbyEnabled],
      )
      const updated = rows[0]
      if (!updated) return null

      await client.query(
        `INSERT INTO public.audit_logs (actor_user_id, action, entity_type, entity_id, details)
         VALUES ($1::uuid, 'game.lobby_visibility.updated', 'game', $2,
                 jsonb_build_object('slug', $3::text, 'lobbyEnabled', $4::boolean))`,
        [session.user.id, updated.id, updated.slug, updated.lobbyEnabled],
      )
      return updated
    })

    if (!game) return Response.json({ error: 'Game not found.' }, { status: 404 })
    return Response.json({ game })
  } catch (error) {
    console.error('[v0] Game lobby visibility update failed:', error instanceof Error ? error.message : 'unknown error')
    return Response.json({ error: 'Game visibility could not be saved.' }, { status: 500 })
  }
}
