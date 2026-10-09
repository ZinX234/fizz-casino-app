import { z } from 'zod'
import { auth } from '@/lib/auth/server'
import { getCasinoAdminAccess } from '@/lib/casino-games'
import { databasePool, withTransaction } from '@/lib/db'
import { isAllowedRequestOrigin } from '@/lib/request-security'

export const dynamic = 'force-dynamic'
import { decryptPayoutDestination } from '@/lib/payout-details'

const reviewSchema = z.object({
  withdrawalId: z.string().uuid(),
  action: z.enum(['approve', 'reject', 'mark_paid']),
  note: z.string().trim().max(500).optional(),
}).strict()

export async function GET(request: Request) {
  if (!isAllowedRequestOrigin(request)) return Response.json({ error: 'Request origin is not allowed.' }, { status: 403 })
  const { data: session } = await auth.getSession()
  if (!session?.user) return Response.json({ error: 'Authentication required.' }, { status: 401 })
  const access = await getCasinoAdminAccess(session.user.id, session.user.email)
  if (!access.authorized) return Response.json({ error: 'Administrator access is restricted.' }, { status: 403 })

  const { rows } = await databasePool.query(
    `SELECT w.id::text, w.user_id::text AS "userId", u.name AS "playerName",
            w.amount::text, w.currency, w.method, w.destination_token AS "destination",
            w.status, w.review_note AS "reviewNote", w.created_at AS "createdAt"
     FROM public.withdrawals w
     JOIN neon_auth."user" u ON u.id = w.user_id
     WHERE w.status IN ('pending', 'approved', 'processing')
     ORDER BY w.created_at ASC LIMIT 100`,
  )
  return Response.json({ withdrawals: rows.map((row) => ({ ...row, destination: decryptPayoutDestination(row.destination) })) })
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
    const updated = await withTransaction(async (client) => {
      const { rows } = await client.query<{
        id: string; user_id: string; wallet_id: string; amount: string; currency: string; status: string
      }>(
        `SELECT id::text, user_id::text, wallet_id::text, amount::text, currency, status
         FROM public.withdrawals WHERE id = $1::uuid FOR UPDATE`,
        [parsed.data.withdrawalId],
      )
      const withdrawal = rows[0]
      if (!withdrawal) return null

      if (parsed.data.action === 'approve') {
        if (withdrawal.status !== 'pending') throw new WithdrawalReviewError('Only pending requests can be approved.', 409)
        await client.query(
          `UPDATE public.withdrawals SET status = 'approved', reviewed_by = $2::uuid,
             review_note = $3, updated_at = now() WHERE id = $1::uuid`,
          [withdrawal.id, session.user.id, parsed.data.note ?? null],
        )
        await writeAudit(client, session.user.id, withdrawal.id, 'withdrawal.approved', parsed.data.note)
        return { id: withdrawal.id, status: 'approved' }
      }

      if (parsed.data.action === 'mark_paid') {
        if (!['approved', 'processing'].includes(withdrawal.status)) {
          throw new WithdrawalReviewError('Only approved withdrawals can be marked paid.', 409)
        }
        await client.query(
          `UPDATE public.withdrawals SET status = 'paid', reviewed_by = $2::uuid,
             review_note = coalesce($3, review_note), completed_at = now(), updated_at = now()
           WHERE id = $1::uuid`,
          [withdrawal.id, session.user.id, parsed.data.note ?? null],
        )
        await writeAudit(client, session.user.id, withdrawal.id, 'withdrawal.marked_paid', parsed.data.note)
        return { id: withdrawal.id, status: 'paid' }
      }

      if (!['pending', 'approved', 'processing'].includes(withdrawal.status)) {
        throw new WithdrawalReviewError('This withdrawal can no longer be rejected.', 409)
      }
      const { rows: wallets } = await client.query<{ id: string; balance: string }>(
        `SELECT id::text, balance::text FROM public.wallets
         WHERE id = $1::uuid AND user_id = $2::uuid FOR UPDATE`,
        [withdrawal.wallet_id, withdrawal.user_id],
      )
      const wallet = wallets[0]
      if (!wallet) throw new Error('Withdrawal wallet could not be loaded')
      const reversalKey = `withdrawal-reversal:${withdrawal.id}`
      const existingReversal = await client.query(
        `SELECT 1 FROM public.wallet_transactions WHERE idempotency_key = $1`, [reversalKey],
      )
      if (existingReversal.rowCount === 0) {
        const balance = Number(wallet.balance)
        const amount = Number(withdrawal.amount)
        await client.query(
          `INSERT INTO public.wallet_transactions (
             wallet_id, user_id, type, amount, balance_before, balance_after,
             reference_type, reference_id, idempotency_key, description
           ) VALUES ($1::uuid, $2::uuid, 'withdrawal_reversal', $3::numeric, $4::numeric, $5::numeric,
                     'withdrawal', $6::uuid, $7, 'Rejected PayPal withdrawal balance release')`,
          [wallet.id, withdrawal.user_id, withdrawal.amount, wallet.balance, (balance + amount).toFixed(2), withdrawal.id, reversalKey],
        )
      }
      await client.query(
        `UPDATE public.withdrawals SET status = 'rejected', reviewed_by = $2::uuid,
           review_note = $3, updated_at = now() WHERE id = $1::uuid`,
        [withdrawal.id, session.user.id, parsed.data.note],
      )
      await writeAudit(client, session.user.id, withdrawal.id, 'withdrawal.rejected', parsed.data.note)
      return { id: withdrawal.id, status: 'rejected' }
    })

    if (!updated) return Response.json({ error: 'Withdrawal request not found.' }, { status: 404 })
    return Response.json({ withdrawal: updated })
  } catch (error) {
    if (error instanceof WithdrawalReviewError) return Response.json({ error: error.message }, { status: error.status })
    console.error('[v0] Withdrawal review failed:', error instanceof Error ? error.message : 'unknown error')
    return Response.json({ error: 'The withdrawal review could not be saved.' }, { status: 500 })
  }
}

async function writeAudit(client: import('pg').PoolClient, actorId: string, withdrawalId: string, action: string, note?: string) {
  await client.query(
    `INSERT INTO public.audit_logs (actor_user_id, action, entity_type, entity_id, details)
     VALUES ($1::uuid, $2, 'withdrawal', $3, jsonb_build_object('note', $4::text))`,
    [actorId, action, withdrawalId, note ?? null],
  )
}

class WithdrawalReviewError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
  }
}
