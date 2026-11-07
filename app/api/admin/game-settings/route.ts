import { z } from 'zod'
import { auth } from '@/lib/auth/server'
import { CasinoGameError, getCasinoAdminAccess, supportedGameSlug, updateBuiltInHouseEdge } from '@/lib/casino-games'
import { isAllowedRequestOrigin } from '@/lib/request-security'

const updateSchema = z.object({
  slug: z.enum(['crash', 'towers', 'mines', 'vault-heist', 'donut-division', 'fizz-rush', 'shatterpoint']),
  houseEdgeBps: z.number().int().min(100).max(9900).multipleOf(10),
  bonusBuyMultiplier: z.number().int().min(1).max(100).optional(),
  minBetCents: z.number().int().min(100).max(10000).optional(),
  maxBetCents: z.number().int().min(100).max(10000).optional(),
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
      return Response.json({ error: 'Choose a valid game and a house edge from 1% to 99%.' }, { status: 400 })
    }
    if (body.data.slug !== 'donut-division' && body.data.bonusBuyMultiplier !== undefined) {
      return Response.json({ error: 'Bonus buy settings are only available for Donut Division.' }, { status: 400 })
    }
    if (body.data.slug === 'shatterpoint' && (body.data.minBetCents === undefined || body.data.maxBetCents === undefined)) {
      return Response.json({ error: 'Shatterpoint requires both minimum and maximum bets.' }, { status: 400 })
    }
    if (body.data.slug !== 'shatterpoint' && (body.data.minBetCents !== undefined || body.data.maxBetCents !== undefined)) {
      return Response.json({ error: 'Minimum and maximum bets are only available for Shatterpoint.' }, { status: 400 })
    }
    if (body.data.minBetCents !== undefined && body.data.maxBetCents !== undefined && body.data.minBetCents > body.data.maxBetCents) {
      return Response.json({ error: 'The minimum bet cannot exceed the maximum bet.' }, { status: 400 })
    }
    const settings = await updateBuiltInHouseEdge(
      session.user.id,
      body.data.slug,
      body.data.houseEdgeBps,
      body.data.bonusBuyMultiplier,
      body.data.minBetCents,
      body.data.maxBetCents,
    )
    return Response.json({ settings })
  } catch (error) {
    if (error instanceof CasinoGameError) return Response.json({ error: error.message }, { status: error.status })
    console.error('[v0] Casino settings update failed:', error instanceof Error ? error.message : 'unknown error')
    return Response.json({ error: 'Game settings could not be saved.' }, { status: 500 })
  }
}
