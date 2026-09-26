import { z } from 'zod'
import { auth } from '@/lib/auth/server'
import { CasinoGameError, getCasinoAdminAccess, supportedGameSlug, updateBuiltInHouseEdge } from '@/lib/casino-games'
import { isAllowedRequestOrigin } from '@/lib/request-security'

const updateSchema = z.object({
  slug: z.enum(['crash', 'towers', 'mines', 'vault-heist']),
  houseEdgeBps: z.number().int().min(100).max(1000).multipleOf(10),
}).strict()

export async function POST(request: Request) {
  if (!isAllowedRequestOrigin(request)) {
    return Response.json({ error: 'Request origin is not allowed.' }, { status: 403 })
  }

  const { data: session } = await auth.getSession()
  if (!session?.user) return Response.json({ error: 'Sign in required.' }, { status: 401 })

  try {
    const access = await getCasinoAdminAccess(session.user.id, session.user.email)
    if (!access.authorized) {
      return Response.json({ error: 'Administrator access is restricted.' }, { status: 403 })
    }
    const body = updateSchema.safeParse(await request.json())
    if (!body.success || !supportedGameSlug(body.data?.slug ?? '')) {
      return Response.json({ error: 'Choose a valid game and a house edge from 1% to 10%.' }, { status: 400 })
    }
    const settings = await updateBuiltInHouseEdge(session.user.id, body.data.slug, body.data.houseEdgeBps)
    return Response.json({ settings })
  } catch (error) {
    if (error instanceof CasinoGameError) return Response.json({ error: error.message }, { status: error.status })
    console.error('[v0] Casino settings update failed:', error instanceof Error ? error.message : 'unknown error')
    return Response.json({ error: 'Game settings could not be saved.' }, { status: 500 })
  }
}
