import { z } from 'zod'
import { auth } from '@/lib/auth/server'
import { getCasinoAdminAccess } from '@/lib/casino-games'
import { databasePool, withTransaction } from '@/lib/db'
import { isAllowedRequestOrigin } from '@/lib/request-security'

const reviewSchema = z.object({
  requestId: z.string().uuid(),
  action: z.enum(['approve', 'reject']),
  note: z.string().trim().max(500).optional(),
}).strict()

function parseCents(value: string) {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value)
  if (!match) return null
  return BigInt(match[1]) * BigInt(100) + BigInt((match[2] ?? '').padEnd(2, '0'))
}

function formatCents(cents: bigint) {
  return `${cents / BigInt(100)}.${String(cents % BigInt(100)).padStart(2, '0')}`
}

export async function GET(request: Request) {
  if (!isAllowedRequestOrigin(request)) return Response.json({ error: 'Request origin is not allowed.' }, { status: 403 })
  const { data: session } = await auth.getSession()
  if (!session?.user) return Response.json({ error: 'Authentication required.' }, { status: 401 })
  const access = await getCasinoAdminAccess(session.user.id, session.user.email)
  if (!access.authorized) return Response.json({ error: 'Administrator access is restricted.' }, { status: 403 })

  const { rows } = await databasePool.query(
    `SELECT r.id::text AS id, r.deposit_id::text AS "depositId", d.user_id::text AS "userId",
            coalesce(nullif(u.name, ''), 'Player') AS "playerName",
            d.amount::text, d.currency, d.external_transaction_id AS "paymentReference",
            r.first_name AS "firstName", r.last_name AS "lastName",
            r.payment_email AS "paymentEmail", r.fizz_username AS "fizzUsername",
            r.fizz_email AS "fizzEmail", r.created_at::text AS "createdAt"
     FROM public.manual_deposit_requests r
     JOIN public.deposits d ON d.id = r.deposit_id
     JOIN neon_auth."user" u ON u.id = d.user_id
     WHERE r.status = 'pending' AND d.status = 'pending' AND d.provider = 'manual-paypal'
     ORDER BY r.created_at ASC LIMIT 100`,
  )
  return Response.json({ requests: rows }, { headers: { 'Cache-Control': 'private, no-store, max-age=0' } })
}

export async function POST(request: Request) {
  if (!isAllowedRequestOrigin(request)) return Response.json({ error: 'Request origin is not allowed.' }, { status: 403 })
  const { data: session } = await auth.getSession()
  if (!session?.user) return Response.json({ error: 'Authentication required.' }, { status: 401 })
  const access = await getCasinoAdminAccess(session.user.id, session.user.email)
  if (!access.authorized) return Response.json({ error: 'Administrator access is restricted.' }, { status: 403 })

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return Response.json({ error: 'Invalid review request.' }, { status: 400 })
  }
  const parsed = reviewSchema.safeParse(payload)
  if (!parsed.success || (parsed.data.action === 'reject' && !parsed.data.note)) {
    return Response.json({ error: 'Provide a valid action and a rejection note.' }, { status: 400 })
  }

  try {
    const result = await withTransaction(async (client) => {
      const { rows } = await client.query<{
        id: string; deposit_id: string; user_id: string; wallet_id: string; amount: string; currency: string; status: string
      }>(
        `SELECT r.id::text, r.deposit_id::text, d.user_id::text, d.wallet_id::text,
                d.amount::text, d.currency, r.status
         FROM public.manual_deposit_requests r
         JOIN public.deposits d ON d.id = r.deposit_id
         WHERE r.id = $1::uuid AND d.provider = 'manual-paypal'
         FOR UPDATE OF r, d`,
        [parsed.data.requestId],
      )
      const depositRequest = rows[0]
      if (!depositRequest) return null
      if (depositRequest.status !== 'pending') throw new DepositReviewError('This deposit request has already been reviewed.', 409)

      if (parsed.data.action === 'approve') {
        const { rows: wallets } = await client.query<{ id: string; balance: string }>(
          `SELECT id::text, balance::text FROM public.wallets
           WHERE id = $1::uuid AND user_id = $2::uuid FOR UPDATE`,
          [depositRequest.wallet_id, depositRequest.user_id],
        )
        const wallet = wallets[0]
        const amountCents = parseCents(depositRequest.amount)
        const balanceCents = wallet ? parseCents(wallet.balance) : null
        if (!wallet || amountCents === null || balanceCents === null) throw new Error('Deposit wallet or amount is invalid')

        await client.query(
          `INSERT INTO public.wallet_transactions (
             wallet_id, user_id, type, amount, balance_before, balance_after,
             reference_type, reference_id, idempotency_key, description
           ) VALUES ($1::uuid, $2::uuid, 'deposit', $3::numeric, $4::numeric, $5::numeric,
                     'deposit', $6::uuid, $7, 'Manually verified PayPal deposit')
           ON CONFLICT (idempotency_key) DO NOTHING`,
          [wallet.id, depositRequest.user_id, depositRequest.amount, wallet.balance, formatCents(balanceCents + amountCents), depositRequest.deposit_id, `manual-paypal:deposit:${depositRequest.deposit_id}`],
        )
        const { rows: ledger } = await client.query<{ id: string }>(
          `SELECT id::text FROM public.wallet_transactions WHERE idempotency_key = $1`,
          [`manual-paypal:deposit:${depositRequest.deposit_id}`],
        )
        if (!ledger[0]) throw new Error('Deposit credit could not be confirmed')
        await client.query(
          `UPDATE public.deposits SET status = 'paid', paid_at = coalesce(paid_at, now()), updated_at = now()
           WHERE id = $1::uuid`, [depositRequest.deposit_id],
        )
        await client.query(
          `UPDATE public.manual_deposit_requests SET status = 'approved', reviewed_by = $2::uuid,
             review_note = $3, reviewed_at = now(), updated_at = now() WHERE id = $1::uuid`,
          [depositRequest.id, session.user.id, parsed.data.note ?? null],
        )
      } else {
        await client.query(
          `UPDATE public.deposits SET status = 'failed', updated_at = now() WHERE id = $1::uuid AND status = 'pending'`,
          [depositRequest.deposit_id],
        )
        await client.query(
          `UPDATE public.manual_deposit_requests SET status = 'rejected', reviewed_by = $2::uuid,
             review_note = $3, reviewed_at = now(), updated_at = now() WHERE id = $1::uuid`,
          [depositRequest.id, session.user.id, parsed.data.note],
        )
      }
      await client.query(
        `INSERT INTO public.audit_logs (actor_user_id, action, entity_type, entity_id, details)
         VALUES ($1::uuid, $2, 'manual_deposit', $3, jsonb_build_object('note', $4::text, 'amount', $5::text))`,
        [session.user.id, parsed.data.action === 'approve' ? 'deposit.manual.approved' : 'deposit.manual.rejected', depositRequest.id, parsed.data.note ?? null, depositRequest.amount],
      )
      return { id: depositRequest.id, status: parsed.data.action === 'approve' ? 'approved' : 'rejected' }
    })

    if (!result) return Response.json({ error: 'Manual deposit request not found.' }, { status: 404 })
    return Response.json({ request: result })
  } catch (error) {
    if (error instanceof DepositReviewError) return Response.json({ error: error.message }, { status: error.status })
    console.error('[v0] Manual deposit review failed:', error instanceof Error ? error.message : 'unknown error')
    return Response.json({ error: 'The manual deposit review could not be completed.' }, { status: 500 })
  }
}

class DepositReviewError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
  }
}
