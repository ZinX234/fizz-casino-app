import { z } from 'zod'
import { auth } from '@/lib/auth/server'
import { getCasinoAdminAccess } from '@/lib/casino-games'
import { consumeUserRateLimit, withTransaction } from '@/lib/db'
import { isAllowedRequestOrigin } from '@/lib/request-security'

const grantSchema = z.object({
  recipientEmail: z.string().trim().email().max(254),
  amount: z.string().trim().regex(/^(?:0|[1-9]\d{0,3})(?:\.\d{1,2})?$/).refine((value) => {
    const [whole, fraction = ''] = value.split('.')
    return Number(whole) * 100 + Number(fraction.padEnd(2, '0')) <= 100_000 && Number(whole) * 100 + Number(fraction.padEnd(2, '0')) > 0
  }),
  reason: z.string().trim().min(5).max(200),
  requestId: z.string().uuid(),
}).strict()

class CreditGrantError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message)
    this.name = 'CreditGrantError'
  }
}

function amountToCents(value: string) {
  const [whole, fraction = ''] = value.split('.')
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
}

function centsToAmount(cents: number) {
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`
}

export async function POST(request: Request) {
  if (!isAllowedRequestOrigin(request)) return Response.json({ error: 'Request origin is not allowed.' }, { status: 403 })

  const { data: session } = await auth.getSession()
  if (!session?.user?.id || !session.user.email) return Response.json({ error: 'Authentication required.' }, { status: 401 })
  const access = await getCasinoAdminAccess(session.user.id, session.user.email)
  if (!access.authorized) return Response.json({ error: 'Administrator access is restricted.' }, { status: 403 })

  const contentLength = Number(request.headers.get('content-length') ?? 0)
  if (contentLength > 4096) return Response.json({ error: 'Credit request is too large.' }, { status: 413 })

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return Response.json({ error: 'Invalid credit request.' }, { status: 400 })
  }
  const parsed = grantSchema.safeParse(payload)
  if (!parsed.success) {
    return Response.json({ error: 'Enter a valid player email, an amount from $0.01 to $1,000.00, and a reason of 5–200 characters.' }, { status: 400 })
  }
  if (!(await consumeUserRateLimit(session.user.id, 'admin-credit-grants', 5, 60))) {
    return Response.json({ error: 'Please wait before granting more wallet credits.' }, { status: 429 })
  }

  const amountCents = amountToCents(parsed.data.amount)
  const amount = centsToAmount(amountCents)
  const reason = parsed.data.reason
  const idempotencyKey = `credit-grant:${session.user.id}:${parsed.data.requestId}`

  try {
    const result = await withTransaction(async (client) => {
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [idempotencyKey])

      const { rows: players } = await client.query<{ id: string; email: string; name: string | null }>(
        `SELECT id::text, email, name FROM neon_auth."user"
         WHERE lower(email) = lower($1) AND banned IS NOT TRUE
         FOR UPDATE`,
        [parsed.data.recipientEmail],
      )
      const player = players[0]
      if (!player) return null

      const description = `Admin credit: ${reason}`
      const { rows: existingRows } = await client.query<{
        id: string
        userId: string
        amount: string
        balance: string
        currency: string
        playerName: string
        description: string
      }>(
        `SELECT wt.id::text AS id, wt.user_id::text AS "userId", wt.amount::text AS amount,
                wt.balance_after::text AS balance, w.currency,
                coalesce(nullif(p.username, ''), nullif(u.name, ''), 'Player') AS "playerName",
                wt.description
         FROM public.wallet_transactions wt
         JOIN public.wallets w ON w.id = wt.wallet_id
         JOIN neon_auth."user" u ON u.id = wt.user_id
         LEFT JOIN public.user_profiles p ON p.user_id = u.id
         WHERE wt.idempotency_key = $1`,
        [idempotencyKey],
      )
      if (existingRows[0]) {
        const existing = existingRows[0]
        if (existing.userId !== player.id || amountToCents(existing.amount) !== amountCents || existing.description !== description) {
          throw new CreditGrantError('This request ID was already used for a different credit grant.', 409)
        }
        return { ...existing, reused: true }
      }

      await client.query(
        `INSERT INTO public.wallets (user_id) VALUES ($1::uuid)
         ON CONFLICT (user_id) DO NOTHING`,
        [player.id],
      )
      const { rows: wallets } = await client.query<{ id: string; balance: string; currency: string }>(
        `SELECT id::text, balance::text, currency FROM public.wallets
         WHERE user_id = $1::uuid FOR UPDATE`,
        [player.id],
      )
      const wallet = wallets[0]
      if (!wallet) throw new Error('Recipient wallet could not be loaded')

      const { rows: ledgerRows } = await client.query<{ id: string; balance: string }>(
        `INSERT INTO public.wallet_transactions (
           wallet_id, user_id, type, amount, balance_before, balance_after,
           reference_type, idempotency_key, description
         ) VALUES (
           $1::uuid, $2::uuid, 'bonus', $3::numeric, $4::numeric, $4::numeric + $3::numeric,
           'admin_credit_grant', $5, $6
         )
         RETURNING id::text AS id, balance_after::text AS balance`,
        [wallet.id, player.id, amount, wallet.balance, idempotencyKey, description],
      )
      const ledger = ledgerRows[0]
      if (!ledger) throw new Error('Wallet credit could not be written to the ledger')

      await client.query(
        `INSERT INTO public.audit_logs (actor_user_id, action, entity_type, entity_id, details)
         VALUES ($1::uuid, 'wallet.admin_credit_granted', 'wallet_transaction', $2,
                 jsonb_build_object('recipientUserId', $3::text, 'recipientEmail', $4::text,
                   'amount', $5::text, 'reason', $6::text, 'idempotencyKey', $7::text))`,
        [session.user.id, ledger.id, player.id, player.email, amount, reason, idempotencyKey],
      )

      return {
        id: ledger.id,
        userId: player.id,
        amount,
        balance: ledger.balance,
        currency: wallet.currency,
        playerName: player.name || 'Player',
        reused: false,
      }
    })

    if (!result) return Response.json({ error: 'No active player account was found for that email.' }, { status: 404 })
    return Response.json({ grant: result }, { status: result.reused ? 200 : 201 })
  } catch (error) {
    if (error instanceof CreditGrantError) return Response.json({ error: error.message }, { status: error.status })
    console.error('[v0] Admin credit grant failed:', error instanceof Error ? error.message : 'unknown error')
    return Response.json({ error: 'The wallet credit could not be granted. Please try again.' }, { status: 503 })
  }
}
