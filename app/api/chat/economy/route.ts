import { z } from 'zod'
import { auth } from '@/lib/auth/server'
import { consumeUserRateLimit, databasePool, withTransaction } from '@/lib/db'
import { isAllowedRequestOrigin } from '@/lib/request-security'

const requestSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('create_rain'), amount: z.string().trim().max(8).regex(/^\d{1,5}(?:\.\d{1,2})?$/), durationSeconds: z.number().int().min(60).max(120), requestId: z.string().uuid() }).strict(),
  z.object({ action: z.literal('join_rain'), rainId: z.string().uuid() }).strict(),
  z.object({ action: z.literal('settle_rains') }).strict(),
  z.object({ action: z.literal('send_tip'), recipientName: z.string().trim().min(1).max(80), amount: z.string().trim().max(7).regex(/^\d{1,4}(?:\.\d{1,2})?$/), requestId: z.string().uuid() }).strict(),
])

function parseCents(value: string) {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value)
  if (!match) return null
  return BigInt(match[1]) * BigInt(100) + BigInt((match[2] ?? '').padEnd(2, '0'))
}

function formatCents(cents: bigint) {
  return `${cents / BigInt(100)}.${String(cents % BigInt(100)).padStart(2, '0')}`
}

function apiError(message: string, status = 400) {
  return new EconomyActionError(message, status)
}

async function settleExpiredRains() {
  return withTransaction(async (client) => {
    const { rows: rains } = await client.query<{ id: string; amount: string }>(
      `SELECT id::text, amount::text FROM public.lobby_rains
       WHERE status = 'active' AND closes_at <= now()
       ORDER BY closes_at ASC LIMIT 10 FOR UPDATE SKIP LOCKED`,
    )
    let settled = 0
    for (const rain of rains) {
      const { rows: entries } = await client.query<{ user_id: string; wallet_id: string; balance: string }>(
        `SELECT e.user_id::text, w.id::text AS wallet_id, w.balance::text
         FROM public.lobby_rain_entries e
         JOIN public.wallets w ON w.user_id = e.user_id
         WHERE e.rain_id = $1::uuid
         ORDER BY e.user_id::text
         FOR UPDATE OF w`,
        [rain.id],
      )
      const poolCents = parseCents(rain.amount)
      if (poolCents === null || !entries.length) throw new Error('Rain pool has no valid payout entries')
      const baseShare = poolCents / BigInt(entries.length)
      const remainder = poolCents % BigInt(entries.length)
      for (const [index, entry] of entries.entries()) {
        const share = baseShare + (BigInt(index) < remainder ? BigInt(1) : BigInt(0))
        if (share === BigInt(0)) continue
        const before = parseCents(entry.balance)
        if (before === null) throw new Error('Rain participant wallet has an invalid balance')
        await client.query(
          `INSERT INTO public.wallet_transactions (
             wallet_id, user_id, type, amount, balance_before, balance_after,
             reference_type, reference_id, idempotency_key, description
           ) VALUES ($1::uuid, $2::uuid, 'rain', $3::numeric, $4::numeric, $5::numeric,
                     'rain', $6::uuid, $7, 'Lobby rain pool share')
           ON CONFLICT (idempotency_key) DO NOTHING`,
          [entry.wallet_id, entry.user_id, formatCents(share), entry.balance, formatCents(before + share), rain.id, `rain:${rain.id}:${entry.user_id}`],
        )
      }
      await client.query(
        `UPDATE public.lobby_rains SET status = 'settled', settled_at = now() WHERE id = $1::uuid AND status = 'active'`,
        [rain.id],
      )
      settled += 1
    }
    return settled
  })
}

export async function GET() {
  try {
    const { data: session } = await auth.getSession()
    const { rows } = await databasePool.query<{
      id: string; amount: string; currency: string; hostName: string; closesAt: string; durationSeconds: number; participantCount: string; isJoined: boolean
    }>(
      `SELECT r.id::text, r.amount::text, r.currency,
              coalesce(nullif(u.name, ''), 'Player') AS "hostName",
              r.closes_at::text AS "closesAt", r.duration_seconds AS "durationSeconds",
              (SELECT count(*)::text FROM public.lobby_rain_entries e WHERE e.rain_id = r.id) AS "participantCount",
              coalesce($1::uuid IS NOT NULL AND EXISTS (
                SELECT 1 FROM public.lobby_rain_entries e WHERE e.rain_id = r.id AND e.user_id = $1::uuid
              ), false) AS "isJoined"
       FROM public.lobby_rains r JOIN neon_auth."user" u ON u.id = r.host_user_id
       WHERE r.status = 'active' ORDER BY r.created_at DESC LIMIT 1`,
      [session?.user?.id ?? null],
    )
    return Response.json({ activeRain: rows[0] ?? null }, { headers: { 'Cache-Control': 'private, no-store, max-age=0' } })
  } catch (error) {
    console.error('[v0] Lobby economy read failed:', error instanceof Error ? error.message : 'unknown error')
    return Response.json({ error: 'Lobby wallet features are unavailable.' }, { status: 503 })
  }
}

export async function POST(request: Request) {
  if (!isAllowedRequestOrigin(request)) return Response.json({ error: 'Request origin is not allowed.' }, { status: 403 })
  const { data: session } = await auth.getSession()
  if (!session?.user) return Response.json({ error: 'Sign in to use chat wallet features.' }, { status: 401 })

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return Response.json({ error: 'Invalid request.' }, { status: 400 })
  }
  const parsed = requestSchema.safeParse(payload)
  if (!parsed.success) return Response.json({ error: 'Invalid wallet action.' }, { status: 400 })

  const body = parsed.data
  const action = body.action
  const rateKey = action === 'send_tip' ? 'chat-tip' : action.includes('rain') ? 'chat-rain' : 'chat-rain-settle'
  if (!(await consumeUserRateLimit(session.user.id, rateKey, action === 'send_tip' ? 10 : 20, 60))) {
    return Response.json({ error: 'Please wait before trying that again.' }, { status: 429 })
  }

  try {
    if (body.action === 'settle_rains') {
      const settledCount = await settleExpiredRains()
      return Response.json({ settledCount })
    }

    if (body.action === 'create_rain') {
      const amountCents = parseCents(body.amount)
      if (amountCents === null || amountCents < BigInt(500) || amountCents > BigInt(100_000)) {
        return Response.json({ error: 'Rain pools must be between $5.00 and $1,000.00.' }, { status: 400 })
      }
      const rain = await withTransaction(async (client) => {
        await client.query(`SELECT pg_advisory_xact_lock(hashtext('fizz-lobby-rain-active'))`)
        const { rows: existing } = await client.query<{ id: string; amount: string; closes_at: Date; duration_seconds: number }>(
          `SELECT id::text, amount::text, closes_at, duration_seconds FROM public.lobby_rains
           WHERE host_user_id = $1::uuid AND idempotency_key = $2 LIMIT 1`,
          [session.user.id, body.requestId],
        )
        if (existing[0]) return existing[0]
        await client.query(`INSERT INTO public.wallets (user_id) VALUES ($1::uuid) ON CONFLICT (user_id) DO NOTHING`, [session.user.id])
        const { rows: wallets } = await client.query<{ id: string; balance: string; currency: string }>(
          `SELECT id::text, balance::text, currency FROM public.wallets WHERE user_id = $1::uuid FOR UPDATE`,
          [session.user.id],
        )
        const wallet = wallets[0]
        if (!wallet) throw apiError('Set up your wallet before starting a rain pool.', 409)
        const { rows: activeRains } = await client.query<{ id: string }>(
          `SELECT id::text FROM public.lobby_rains WHERE status = 'active' AND closes_at > now() LIMIT 1`,
        )
        if (activeRains[0]) throw apiError('A rain pool is already active in the lobby.', 409)
        const balance = parseCents(wallet.balance)
        if (balance === null || balance < amountCents) throw apiError('Your wallet balance is too low for that rain pool.', 409)
        const { rows } = await client.query<{ id: string; amount: string; closes_at: Date; duration_seconds: number }>(
          `INSERT INTO public.lobby_rains (host_user_id, amount, currency, duration_seconds, closes_at, idempotency_key)
           VALUES ($1::uuid, $2::numeric, $3, $4, now() + ($4::int * interval '1 second'), $5)
           RETURNING id::text, amount::text, closes_at, duration_seconds`,
          [session.user.id, formatCents(amountCents), wallet.currency, body.durationSeconds, body.requestId],
        )
        const created = rows[0]
        await client.query(
          `INSERT INTO public.lobby_rain_entries (rain_id, user_id) VALUES ($1::uuid, $2::uuid) ON CONFLICT DO NOTHING`,
          [created.id, session.user.id],
        )
        await client.query(
          `INSERT INTO public.wallet_transactions (
             wallet_id, user_id, type, amount, balance_before, balance_after,
             reference_type, reference_id, idempotency_key, description
           ) VALUES ($1::uuid, $2::uuid, 'rain', $3::numeric, $4::numeric, $5::numeric,
                     'rain', $6::uuid, $7, 'Lobby rain pool contribution')`,
          [wallet.id, session.user.id, `-${formatCents(amountCents)}`, wallet.balance, formatCents(balance - amountCents), created.id, `rain-host:${created.id}`],
        )
        return created
      })
      return Response.json({ rain: { id: rain.id, amount: rain.amount, closesAt: rain.closes_at, durationSeconds: rain.duration_seconds } }, { status: 201 })
    }

    if (body.action === 'join_rain') {
      await settleExpiredRains()
      const joined = await withTransaction(async (client) => {
        const { rows: rains } = await client.query<{ id: string; host_user_id: string; status: string; closes_at: Date }>(
          `SELECT id::text, host_user_id::text, status, closes_at FROM public.lobby_rains WHERE id = $1::uuid FOR UPDATE`,
          [body.rainId],
        )
        const rain = rains[0]
        if (!rain || rain.status !== 'active' || rain.closes_at.getTime() <= Date.now()) throw apiError('This rain pool has closed.', 409)
        const { rows: countRows } = await client.query<{ count: number }>(
          `SELECT count(*)::int AS count FROM public.lobby_rain_entries WHERE rain_id = $1::uuid`, [rain.id],
        )
        if (countRows[0]?.count >= 1000) throw apiError('This rain pool has reached its participant limit.', 409)
        await client.query(`INSERT INTO public.wallets (user_id) VALUES ($1::uuid) ON CONFLICT (user_id) DO NOTHING`, [session.user.id])
        const { rows } = await client.query<{ id: string }>(
          `INSERT INTO public.lobby_rain_entries (rain_id, user_id)
           VALUES ($1::uuid, $2::uuid) ON CONFLICT (rain_id, user_id) DO NOTHING RETURNING id::text`,
          [rain.id, session.user.id],
        )
        return { joined: rows.length > 0 }
      })
      return Response.json({ joined: joined.joined })
    }

    const amountCents = parseCents(body.amount)
    if (amountCents === null || amountCents < BigInt(100) || amountCents > BigInt(10_000)) {
      return Response.json({ error: 'Tips must be between $1.00 and $100.00.' }, { status: 400 })
    }
    const { rows: senderProfiles } = await databasePool.query<{ username: string }>(
      `SELECT username FROM public.user_profiles WHERE user_id = $1::uuid LIMIT 1`,
      [session.user.id],
    )
    const senderName = senderProfiles[0]?.username ?? session.user.name ?? 'Player'
    const tip = await withTransaction(async (client) => {
      const { rows: previous } = await client.query<{ id: string; amount: string }>(
        `SELECT id::text, amount::text FROM public.player_tips
         WHERE sender_user_id = $1::uuid AND idempotency_key = $2 LIMIT 1`,
        [session.user.id, body.requestId],
      )
      if (previous[0]) return { id: previous[0].id, amount: previous[0].amount, reused: true }

      const { rows: recipients } = await client.query<{ id: string; name: string }>(
        `SELECT u.id::text, coalesce(p.username, u.name) AS name
         FROM neon_auth."user" u
         LEFT JOIN public.user_profiles p ON p.user_id = u.id
         WHERE lower(btrim(coalesce(p.username, u.name))) = lower($1)
           AND u.id <> $2::uuid AND u.banned IS NOT TRUE
         ORDER BY u.id LIMIT 2`,
        [body.recipientName, session.user.id],
      )
      if (recipients.length !== 1) throw apiError(recipients.length ? 'That display name is ambiguous; ask the player to choose a unique name.' : 'No player has that display name.', 404)
      const recipient = recipients[0]
      await client.query(
        `INSERT INTO public.wallets (user_id)
         SELECT requested.user_id FROM unnest($1::uuid[]) AS requested(user_id)
         ORDER BY requested.user_id ON CONFLICT (user_id) DO NOTHING`,
        [[session.user.id, recipient.id]],
      )
      const { rows: wallets } = await client.query<{ id: string; user_id: string; balance: string; currency: string }>(
        `SELECT id::text, user_id::text, balance::text, currency FROM public.wallets
         WHERE user_id = ANY($1::uuid[]) ORDER BY user_id::text FOR UPDATE`,
        [[session.user.id, recipient.id]],
      )
      const senderWallet = wallets.find((wallet) => wallet.user_id === session.user.id)
      const recipientWallet = wallets.find((wallet) => wallet.user_id === recipient.id)
      const { rows: committedTip } = await client.query<{ id: string; amount: string }>(
        `SELECT id::text, amount::text FROM public.player_tips
         WHERE sender_user_id = $1::uuid AND idempotency_key = $2 LIMIT 1`,
        [session.user.id, body.requestId],
      )
      if (committedTip[0]) return { id: committedTip[0].id, amount: committedTip[0].amount, reused: true }
      if (!senderWallet || !recipientWallet || senderWallet.currency !== recipientWallet.currency) {
        throw apiError('The players need compatible wallets before a tip can be sent.', 409)
      }
      const senderBalance = parseCents(senderWallet.balance)
      const recipientBalance = parseCents(recipientWallet.balance)
      if (senderBalance === null || senderBalance < amountCents || recipientBalance === null) {
        throw apiError('Your wallet balance is too low for that tip.', 409)
      }
      const { rows } = await client.query<{ id: string }>(
        `INSERT INTO public.player_tips (sender_user_id, recipient_user_id, amount, currency, idempotency_key)
         VALUES ($1::uuid, $2::uuid, $3::numeric, $4, $5) RETURNING id::text`,
        [session.user.id, recipient.id, formatCents(amountCents), senderWallet.currency, body.requestId],
      )
      const tipId = rows[0].id
      await client.query(
        `INSERT INTO public.wallet_transactions (
           wallet_id, user_id, type, amount, balance_before, balance_after, reference_type, reference_id, idempotency_key, description
         ) VALUES ($1::uuid, $2::uuid, 'tip', $3::numeric, $4::numeric, $5::numeric, 'tip', $6::uuid, $7, $8)`,
        [senderWallet.id, session.user.id, `-${formatCents(amountCents)}`, senderWallet.balance, formatCents(senderBalance - amountCents), tipId, `tip:${tipId}:sender`, `Tip to ${recipient.name}`],
      )
      await client.query(
        `INSERT INTO public.wallet_transactions (
           wallet_id, user_id, type, amount, balance_before, balance_after, reference_type, reference_id, idempotency_key, description
         ) VALUES ($1::uuid, $2::uuid, 'tip', $3::numeric, $4::numeric, $5::numeric, 'tip', $6::uuid, $7, $8)`,
        [recipientWallet.id, recipient.id, formatCents(amountCents), recipientWallet.balance, formatCents(recipientBalance + amountCents), tipId, `tip:${tipId}:recipient`, `Tip from ${senderName}`],
      )
      return { id: tipId, amount: formatCents(amountCents), reused: false }
    })
    return Response.json({ tip }, { status: tip.reused ? 200 : 201 })
  } catch (error) {
    if (error instanceof EconomyActionError) return Response.json({ error: error.message }, { status: error.status })
    console.error('[v0] Lobby wallet action failed:', error instanceof Error ? error.message : 'unknown error')
    return Response.json({ error: 'The wallet action could not be completed.' }, { status: 500 })
  }
}

class EconomyActionError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
  }
}
