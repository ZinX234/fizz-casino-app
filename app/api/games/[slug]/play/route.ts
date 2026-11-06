import { z } from 'zod'
import { auth } from '@/lib/auth/server'
import { CasinoGameError, getActiveCasinoRound, playCasinoAction, startCasinoRound, supportedGameSlug } from '@/lib/casino-games'
import { databasePool, consumeUserRateLimit } from '@/lib/db'
import { isAllowedRequestOrigin } from '@/lib/request-security'

const requestSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('start'), requestId: z.string().uuid(), wagerCents: z.number().int(), mineCount: z.number().int().optional(), expectedRtpBps: z.number().int().min(100).max(9900), profileId: z.string().regex(/^[a-z0-9][a-z0-9-]{1,39}$/).optional(), buyBonus: z.boolean().optional() }).strict(),
  z.object({ action: z.literal('pick'), sessionId: z.string().uuid(), position: z.number().int(), requestId: z.string().uuid().optional() }).strict(),
  z.object({ action: z.literal('bonus'), sessionId: z.string().uuid(), requestId: z.string().uuid(), choiceId: z.enum(['sticky', 'pick', 'surveillance']) }).strict(),
  z.object({ action: z.literal('cashout'), sessionId: z.string().uuid(), position: z.number().finite().optional() }).strict(),
  z.object({ action: z.literal('sync'), sessionId: z.string().uuid() }).strict(),
  z.object({ action: z.literal('resume') }).strict(),
])

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  if (!isAllowedRequestOrigin(request)) {
    return Response.json({ error: 'Request origin is not allowed.' }, { status: 403 })
  }
  const { data: session } = await auth.getSession()
  if (!session?.user) return Response.json({ error: 'Sign in to play.' }, { status: 401 })

  const { slug: rawSlug } = await context.params
  if (!supportedGameSlug(rawSlug)) return Response.json({ error: 'Game not found.' }, { status: 404 })
  try {
    let payload: unknown
    try {
      payload = await request.json()
    } catch {
      return Response.json({ error: 'Invalid game request.' }, { status: 400 })
    }
    const body = requestSchema.safeParse(payload)
    if (!body.success) return Response.json({ error: 'Invalid game request.' }, { status: 400 })
    if (body.data.action === 'sync' && rawSlug !== 'crash') {
      return Response.json({ error: 'Round sync is only available for Crash.' }, { status: 400 })
    }
    if (body.data.action === 'bonus' && rawSlug !== 'donut-division') {
      return Response.json({ error: 'Bonus choices are only available for Donut Division.' }, { status: 400 })
    }
    if (body.data.action === 'start' && body.data.buyBonus && rawSlug !== 'donut-division') {
      return Response.json({ error: 'Bonus purchases are only available for Donut Division.' }, { status: 400 })
    }
    const rateLimit = body.data.action === 'sync'
      ? await consumeUserRateLimit(session.user.id, `game:${rawSlug}:sync`, 75, 60)
      : await consumeUserRateLimit(session.user.id, `game:${rawSlug}`, 40, 60)
    if (!rateLimit) return Response.json({ error: 'Please slow down and try again.' }, { status: 429 })

    let round
    if (body.data.action === 'start') {
      round = await startCasinoRound({
        userId: session.user.id,
        slug: rawSlug,
        wagerCents: body.data.wagerCents,
        mineCount: body.data.mineCount ?? 3,
        requestId: body.data.requestId,
        expectedRtpBps: body.data.expectedRtpBps,
        profileId: body.data.profileId,
        buyBonus: body.data.buyBonus,
      })
    } else if (body.data.action === 'resume') {
      round = await getActiveCasinoRound(session.user.id, rawSlug)
    } else {
      round = await playCasinoAction({
        userId: session.user.id,
        slug: rawSlug,
        sessionId: body.data.sessionId,
        action: body.data.action,
        position: body.data.action === 'pick' ? body.data.position : body.data.action === 'cashout' ? body.data.position : undefined,
        choiceId: body.data.action === 'bonus' ? body.data.choiceId : undefined,
        requestId: 'requestId' in body.data ? body.data.requestId : undefined,
      })
    }

    const { rows: wallets } = await databasePool.query<{ balance: string; currency: string }>(
      `SELECT balance::text, currency FROM public.wallets WHERE user_id = $1::uuid`, [session.user.id],
    )
    return Response.json({ round, wallet: wallets[0] ?? null })
  } catch (error) {
    if (error instanceof CasinoGameError) return Response.json({ error: error.message }, { status: error.status })
    console.error('[v0] Casino game request failed:', error instanceof Error ? error.message : 'unknown error')
    return Response.json({ error: 'The game could not complete that action. Your wallet has not been changed.' }, { status: 500 })
  }
}
