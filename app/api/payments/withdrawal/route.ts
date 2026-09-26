import { z } from 'zod'
import { auth } from '@/lib/auth/server'
import { consumeUserRateLimit, databasePool, withTransaction } from '@/lib/db'
import { isAllowedRequestOrigin } from '@/lib/request-security'
import { encryptPayoutDestination } from '@/lib/payout-details'

const withdrawalSchema = z.object({
  amount: z.string().trim().max(8).regex(/^\d{1,5}(?:\.\d{1,2})?$/),
  requestId: z.string().uuid(),
}).strict()

const MIN_WITHDRAWAL_CENTS = 1_000
const MAX_WITHDRAWAL_CENTS = 1_000_000

function parseCents(value: string) {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value)
  if (!match) return null
  return BigInt(match[1]) * BigInt(100) + BigInt((match[2] ?? '').padEnd(2, '0'))
}

function formatCents(cents: bigint) {
  return `${cents / BigInt(100)}.${String(cents % BigInt(100)).padStart(2, '0')}`
}

export async function POST(request: Request) {
  if (!isAllowedRequestOrigin(request)) {
    return Response.json({ error: 'Request origin is not allowed.' }, { status: 403 })
  }

  const { data: session } = await auth.getSession()
  if (!session?.user) return Response.json({ error: 'Authentication required.' }, { status: 401 })

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return Response.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const parsed = withdrawalSchema.safeParse(payload)
  const amountCents = parsed.success ? parseCents(parsed.data.amount) : null
  if (!parsed.success || amountCents === null || amountCents < BigInt(MIN_WITHDRAWAL_CENTS) || amountCents > BigInt(MAX_WITHDRAWAL_CENTS)) {
    return Response.json({ error: 'Enter a PayPal withdrawal amount between $10.00 and $10,000.00.' }, { status: 400 })
  }

  let paypalEmail: string | null = null
  try {
    const { rows: profiles } = await databasePool.query<{ paypal_email: string }>(
      `SELECT paypal_email FROM public.user_profiles WHERE user_id = $1::uuid LIMIT 1`,
      [session.user.id],
    )
    paypalEmail = profiles[0]?.paypal_email ?? null
  } catch (error) {
    console.error('[v0] Withdrawal profile lookup failed:', error instanceof Error ? error.message : 'unknown error')
    return Response.json({ error: 'Your profile could not be loaded. Please try again.' }, { status: 503 })
  }
  if (!paypalEmail) return Response.json({ error: 'Complete your PayPal details in Profile settings before requesting a withdrawal.' }, { status: 409 })

  if (!(await consumeUserRateLimit(session.user.id, 'withdrawal-create', 5, 3600))) {
    return Response.json({ error: 'Please wait before submitting another withdrawal.' }, { status: 429 })
  }

  let encryptedDestination: string
  try {
    encryptedDestination = encryptPayoutDestination(paypalEmail)
  } catch {
    return Response.json({ error: 'Secure payout storage is not configured.' }, { status: 503 })
  }

  try {
    const withdrawal = await withTransaction(async (client) => {
      await client.query(
        `INSERT INTO public.wallets (user_id) VALUES ($1::uuid) ON CONFLICT (user_id) DO NOTHING`,
        [session.user.id],
      )
      const { rows: wallets } = await client.query<{ id: string; balance: string; currency: string }>(
        `SELECT id::text, balance::text, currency FROM public.wallets WHERE user_id = $1::uuid FOR UPDATE`,
        [session.user.id],
      )
      const wallet = wallets[0]
      if (!wallet) throw new Error('Wallet could not be loaded')

      const { rows: existing } = await client.query<{
        id: string; amount: string; currency: string; method: string; status: string; created_at: Date
      }>(
        `SELECT id::text, amount::text, currency, method, status, created_at
         FROM public.withdrawals WHERE user_id = $1::uuid AND idempotency_key = $2 LIMIT 1`,
        [session.user.id, parsed.data.requestId],
      )
      if (existing[0]) return { ...existing[0], reused: true }

      const balanceCents = parseCents(wallet.balance)
      if (balanceCents === null || balanceCents < amountCents) {
        throw new WithdrawalRequestError('Your available wallet balance is too low.', 409)
      }

      const { rows } = await client.query<{
        id: string; amount: string; currency: string; method: string; status: string; created_at: Date
      }>(
        `INSERT INTO public.withdrawals (
           user_id, wallet_id, amount, currency, method, destination_token, status, idempotency_key
         ) VALUES ($1::uuid, $2::uuid, $3::numeric, $4, 'paypal', $5, 'pending', $6)
         RETURNING id::text, amount::text, currency, method, status, created_at`,
        [session.user.id, wallet.id, formatCents(amountCents), wallet.currency, encryptedDestination, parsed.data.requestId],
      )
      const created = rows[0]
      if (!created) throw new Error('Withdrawal request could not be created')

      await client.query(
        `INSERT INTO public.wallet_transactions (
           wallet_id, user_id, type, amount, balance_before, balance_after,
           reference_type, reference_id, idempotency_key, description
         ) VALUES ($1::uuid, $2::uuid, 'withdrawal', $3::numeric, $4::numeric, $5::numeric,
                   'withdrawal', $6::uuid, $7, 'PayPal withdrawal reserved for manual review')`,
        [wallet.id, session.user.id, `-${formatCents(amountCents)}`, wallet.balance, formatCents(balanceCents - amountCents), created.id, `withdrawal:${created.id}`],
      )
      return { ...created, reused: false }
    })

    return Response.json({ withdrawal: { id: withdrawal.id, amount: withdrawal.amount, currency: withdrawal.currency, method: withdrawal.method, status: withdrawal.status, createdAt: withdrawal.created_at } })
  } catch (error) {
    if (error instanceof WithdrawalRequestError) return Response.json({ error: error.message }, { status: error.status })
    console.error('[v0] Withdrawal request failed:', error instanceof Error ? error.message : 'unknown error')
    return Response.json({ error: 'Your withdrawal request could not be created. Please try again later.' }, { status: 500 })
  }
}

class WithdrawalRequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
  }
}
