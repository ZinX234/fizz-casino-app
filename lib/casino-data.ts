import 'server-only'

import { ensureBuiltInGames } from '@/lib/casino-games'
import { getPlayerProgression } from '@/lib/progression'
import { databasePool, withTransaction } from '@/lib/db'
import { decryptPayoutDestination } from '@/lib/payout-details'

export interface GameRecord {
  id: string
  slug: string
  name: string
  provider: string
  category: string
  description: string
  coverImageUrl: string | null
  featured: boolean
}

export async function getAvailableGames(): Promise<GameRecord[]> {
  await ensureBuiltInGames()
  const { rows } = await databasePool.query<GameRecord>(
    `SELECT id::text, slug, name, provider, category, description,
            cover_image_url AS "coverImageUrl", featured
     FROM public.games
     WHERE status = 'available'
     ORDER BY featured DESC, name ASC`,
  )
  return rows
}

export async function getLivePromotions() {
  const { rows } = await databasePool.query<{ id: string; title: string; description: string; endsAt: string | null }>(
    `SELECT id::text, title, description, ends_at::text AS "endsAt"
     FROM public.promotions
     WHERE active = true AND (starts_at IS NULL OR starts_at <= now())
       AND (ends_at IS NULL OR ends_at > now()) AND vip_level_id IS NULL
     ORDER BY starts_at NULLS LAST, created_at DESC`,
  )
  return rows
}

export async function getProgressionSnapshot(userId: string) {
  const { rows } = await databasePool.query<{ totalXp: string }>(
    `SELECT total_xp::text AS "totalXp" FROM public.player_progression WHERE user_id = $1::uuid`,
    [userId],
  )
  return getPlayerProgression(Number(rows[0]?.totalXp ?? 0))
}

export async function getWalletSnapshot(userId: string) {
  return withTransaction(async (client) => {
    await client.query(
      `INSERT INTO public.wallets (user_id)
       VALUES ($1)
       ON CONFLICT (user_id) DO NOTHING`,
      [userId],
    )
    const { rows } = await client.query<{ id: string; balance: string; currency: string }>(
      `SELECT id::text, balance::text, currency FROM public.wallets WHERE user_id = $1`,
      [userId],
    )
    if (!rows[0]) throw new Error('Wallet record could not be loaded')
    return rows[0]
  })
}

export async function getAccountSnapshot(userId: string) {
  const wallet = await getWalletSnapshot(userId)
  const [transactions, bets, bonuses, vip, limits, progression, withdrawals] = await Promise.all([
    databasePool.query(
      `SELECT wt.id::text, wt.type, wt.amount::text, wt.description, wt.created_at,
              w.currency
       FROM public.wallet_transactions wt
       JOIN public.wallets w ON w.id = wt.wallet_id
       WHERE wt.user_id = $1 ORDER BY wt.created_at DESC LIMIT 20`, [userId],
    ),
    databasePool.query(
      `SELECT b.id::text, g.name AS game_name, b.wager_amount::text,
              b.payout_amount::text, b.status, b.created_at
       FROM public.bets b JOIN public.games g ON g.id = b.game_id
       WHERE b.user_id = $1 ORDER BY b.created_at DESC LIMIT 20`, [userId],
    ),
    databasePool.query(
      `SELECT bc.id::text, b.name, bc.bonus_balance::text,
              bc.wagering_required::text, bc.wagering_completed::text,
              bc.status, bc.expires_at
       FROM public.bonus_claims bc JOIN public.bonuses b ON b.id = bc.bonus_id
       WHERE bc.user_id = $1 AND bc.status = 'active' ORDER BY bc.claimed_at DESC`, [userId],
    ),
    databasePool.query(
      `SELECT vl.name, vm.lifetime_wagered::text
       FROM public.vip_memberships vm LEFT JOIN public.vip_levels vl ON vl.id = vm.vip_level_id
       WHERE vm.user_id = $1`, [userId],
    ),
    databasePool.query(
      `SELECT limit_type, limit_amount::text, period, starts_at, ends_at
       FROM public.responsible_gaming_limits
       WHERE user_id = $1 AND starts_at <= now() AND (ends_at IS NULL OR ends_at > now())
       ORDER BY created_at DESC`, [userId],
    ),
    getProgressionSnapshot(userId),
    databasePool.query(
      `SELECT id::text, amount::text, currency, status, created_at, method
       FROM public.withdrawals WHERE user_id = $1::uuid
       ORDER BY created_at DESC LIMIT 10`, [userId],
    ),
  ])
  return { wallet, transactions: transactions.rows, bets: bets.rows, bonuses: bonuses.rows, vip: vip.rows[0] ?? null, limits: limits.rows, progression, withdrawals: withdrawals.rows }
}

export async function getAdminCounts() {
  const { rows } = await databasePool.query<{
    players: string
    availableGames: string
    deposits: string
    pendingWithdrawals: string
    transactions: string
    supportTickets: string
  }>(`SELECT
    (SELECT count(*) FROM neon_auth."user")::text AS players,
    (SELECT count(*) FROM public.games WHERE status = 'available')::text AS "availableGames",
    (SELECT count(*) FROM public.deposits)::text AS deposits,
    (SELECT count(*) FROM public.withdrawals WHERE status = 'pending')::text AS "pendingWithdrawals",
    (SELECT count(*) FROM public.wallet_transactions)::text AS transactions,
    (SELECT count(*) FROM public.support_tickets WHERE status IN ('open','pending'))::text AS "supportTickets"`)
  return rows[0]
}

export async function getAdminPlayers() {
  const { rows } = await databasePool.query(
    `SELECT u.id::text, u.name, u.email, u.banned AS suspended,
            u."createdAt" AS created_at, w.balance::text AS balance,
            w.currency AS currency
     FROM neon_auth."user" u LEFT JOIN public.wallets w ON w.user_id = u.id
     ORDER BY u."createdAt" DESC LIMIT 100`,
  )
  return rows
}

export async function getAdminManualDepositRequests() {
  const { rows } = await databasePool.query<{
    id: string
    depositId: string
    userId: string
    playerName: string
    amount: string
    currency: string
    paymentReference: string
    firstName: string
    lastName: string
    paymentEmail: string
    fizzUsername: string
    fizzEmail: string
    createdAt: string
  }>(
    `SELECT r.id::text, r.deposit_id::text AS "depositId", d.user_id::text AS "userId",
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
  return rows
}

export async function getAdminWithdrawalRequests() {
  const { rows } = await databasePool.query<{
    id: string
    userId: string
    playerName: string | null
    amount: string
    currency: string
    method: string
    destination: string | null
    status: string
    reviewNote: string | null
    createdAt: string
  }>(
    `SELECT w.id::text, w.user_id::text AS "userId", u.name AS "playerName",
            w.amount::text, w.currency, w.method, w.destination_token AS "destination",
            w.status, w.review_note AS "reviewNote", w.created_at::text AS "createdAt"
     FROM public.withdrawals w
     JOIN neon_auth."user" u ON u.id = w.user_id
     WHERE w.status IN ('pending', 'approved', 'processing')
     ORDER BY w.created_at ASC LIMIT 100`,
  )
  return rows.map((row) => ({ ...row, destination: decryptPayoutDestination(row.destination) }))
}

export async function getSupportSnapshot(userId: string) {
  const { rows } = await databasePool.query(
    `SELECT t.id::text, t.subject, t.status, t.created_at, t.updated_at,
            coalesce(json_agg(json_build_object('id', m.id::text, 'body', m.body,
              'createdAt', m.created_at, 'fromSupport', m.sender_user_id IS DISTINCT FROM t.user_id)
              ORDER BY m.created_at) FILTER (WHERE m.id IS NOT NULL), '[]'::json) AS messages
     FROM public.support_tickets t
     LEFT JOIN public.support_messages m ON m.ticket_id = t.id AND m.internal_note = false
     WHERE t.user_id = $1
     GROUP BY t.id ORDER BY t.updated_at DESC LIMIT 50`, [userId],
  )
  return rows
}
