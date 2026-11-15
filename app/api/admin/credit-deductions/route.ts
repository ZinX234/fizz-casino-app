import { z } from 'zod'
import { auth } from '@/lib/auth/server'
import { getCasinoAdminAccess } from '@/lib/casino-games'
import { consumeUserRateLimit, withTransaction } from '@/lib/db'
import { isAllowedRequestOrigin } from '@/lib/request-security'

const amountPattern = /^(?:0|[1-9]\d{0,3})(?:\.\d{1,2})?$/

const deductionSchema = z.object({
  recipientEmail: z.string().trim().email().max(254),
  amount: z.string().trim().regex(amountPattern).refine((value) => {
    if (!amountPattern.test(value)) return false
    const [whole, fraction = ''] = value.split('.')
    const cents = BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2, '0'))
    return cents > BigInt(0) && cents <= BigInt(100_000)
  }),
  reason: z.string().trim().min(5).max(200),
  requestId: z.string().uuid(),
}).strict()

class CreditDeductionError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message)
    this.name = 'CreditDeductionError'
  }
}

function amountToCents(value: string) {
  const negative = value.startsWith('-')
  const [whole, fraction = ''] = (negative ? value.slice(1) : value).split('.')
  const cents = BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2, '0'))
  return negative ? -cents : cents
}

function centsToAmount(cents: bigint) {
  const whole = cents / BigInt(100)
  const fraction = String(cents % BigInt(100)).padStart(2, '0')
  return `${whole}.${fraction}`
}

export async function POST(request: Request) {
  if (!isAllowedRequestOrigin(request)) return Response.json({ error: 'Request origin is not allowed.' }, { status: 403 })

  const { data: session } = await auth.getSession()
  if (!session?.user?.id || !session.user.email) return Response.json({ error: 'Authentication required.' }, { status: 401 })
  const access = await getCasinoAdminAccess(session.user.id, session.user.email)
  if (!access.authorized) return Response.json({ error: 'Administrator access is restricted.' }, { status: 403 })

  const contentLength = Number(request.headers.get('content-length') ?? 0)
  if (contentLength > 4096) return Response.json({ error: 'Deduction request is too large.' }, { status: 413 })

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return Response.json({ error: 'Invalid deduction request.' }, { status: 400 })
  }
  const parsed = deductionSchema.safeParse(payload)
  if (!parsed.success) {
    return Response.json({ error: 'Enter a valid player email, an amount from $0.01 to $1,000.00, and a reason of 5–200 characters.' }, { status: 400 })
  }
  if (!(await consumeUserRateLimit(session.user.id, 'admin-credit-deductions', 5, 60))) {
    return Response.json({ error: 'Please wait before deducting more wallet credits.' }, { status: 429 })
  }

  const amountCents = amountToCents(parsed.data.amount)
  const amount = centsToAmount(amountCents)
  const ledgerAmount = `-${amount}`
  const reason = parsed.data.reason
  const description = `Admin credit deduction: ${reason}`
  const idempotencyKey = `credit-deduction:${session.user.id}:${parsed.data.requestId}`

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
        if (existing.userId !== player.id || amountToCents(existing.amount) !== -amountCents || existing.description !== description) {
          throw new CreditDeductionError('This request ID was already used for a different wallet deduction.', 409)
        }
        return {
          id: existing.id,
          userId: player.id,
          email: player.email,
          playerName: existing.playerName,
          amount,
          balance: existing.balance,
          currency: existing.currency,
          reused: true,
        }
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
      if (amountToCents(wallet.balance) < amountCents) {
        throw new CreditDeductionError('The player does not have enough wallet balance for this deduction.', 409)
      }

      const { rows: ledgerRows } = await client.query<{ id: string; balance: string }>(
        `INSERT INTO public.wallet_transactions (
           wallet_id, user_id, type, amount, balance_before, balance_after,
           reference_type, idempotency_key, description
         ) VALUES (
           $1::uuid, $2::uuid, 'adjustment', $3::numeric, $4::numeric, $4::numeric + $3::numeric,
           'admin_credit_deduction', $5, $6
         )
         RETURNING id::text AS id, balance_after::text AS balance`,
        [wallet.id, player.id, ledgerAmount, wallet.balance, idempotencyKey, description],
      )
      const ledger = ledgerRows[0]
      if (!ledger) throw new Error('Wallet deduction could not be written to the ledger')

      await client.query(
        `INSERT INTO public.audit_logs (actor_user_id, action, entity_type, entity_id, details)
         VALUES ($1::uuid, 'wallet.admin_credit_deducted', 'wallet_transaction', $2,
                 jsonb_build_object('recipientUserId', $3::text, 'recipientEmail', $4::text,
                   'amount', $5::text, 'reason', $6::text, 'idempotencyKey', $7::text))`,
        [session.user.id, ledger.id, player.id, player.email, amount, reason, idempotencyKey],
      )

      return {
        id: ledger.id,
        userId: player.id,
        email: player.email,
        playerName: player.name || 'Player',
        amount,
        balance: ledger.balance,
        currency: wallet.currency,
        reused: false,
      }
    })

    if (!result) return Response.json({ error: 'No active player account was found for that email.' }, { status: 404 })
    return Response.json({ deduction: result }, { status: result.reused ? 200 : 201 })
  } catch (error) {
    if (error instanceof CreditDeductionError) return Response.json({ error: error.message }, { status: error.status })
    console.error('[v0] Admin credit deduction failed:', error instanceof Error ? error.message : 'unknown error')
    return Response.json({ error: 'The wallet deduction could not be completed. Please try again.' }, { status: 503 })
  }
}
