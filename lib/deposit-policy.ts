import type { PoolClient } from 'pg'

export class DepositPolicyError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
    this.name = 'DepositPolicyError'
  }
}

function parseCents(value: string) {
  const match = /(\d+)(?:\.(\d{1,2}))?$/.exec(value)
  if (!match) return null
  return BigInt(match[1]) * 100n + BigInt((match[2] ?? '').padEnd(2, '0'))
}

export async function enforceDepositPolicy(client: PoolClient, userId: string, amountCents: bigint) {
  const { rows } = await client.query<{
    limit_type: string
    limit_amount: string | null
    period: string | null
  }>(
    `SELECT limit_type, limit_amount::text, period
     FROM public.responsible_gaming_limits
     WHERE user_id = $1::uuid
       AND starts_at <= now()
       AND (ends_at IS NULL OR ends_at > now())
       AND limit_type IN ('self_exclusion', 'suspension', 'cooling_off', 'deposit')`,
    [userId],
  )

  if (rows.some((limit) => ['self_exclusion', 'suspension', 'cooling_off'].includes(limit.limit_type))) {
    throw new DepositPolicyError('Deposits are blocked by your active responsible gaming settings.', 403)
  }

  for (const limit of rows) {
    if (limit.limit_type !== 'deposit' || !limit.limit_amount || !limit.period) continue
    const limitCents = parseCents(limit.limit_amount)
    if (limitCents === null) continue
    if (limit.period === 'per_session') {
      if (amountCents > limitCents) {
        throw new DepositPolicyError('This deposit would exceed your per-session deposit limit.', 400)
      }
      continue
    }

    const spentResult = await client.query<{ total: string }>(
      `SELECT coalesce(sum(amount), 0)::text AS total
       FROM public.deposits
       WHERE user_id = $1::uuid
         AND status IN ('paid', 'pending', 'processing')
         AND (status = 'paid' OR expires_at IS NULL OR expires_at > now())
         AND created_at >= now() - CASE $2::text
           WHEN 'day' THEN interval '1 day'
           WHEN 'week' THEN interval '1 week'
           WHEN 'month' THEN interval '1 month'
           ELSE interval '0 seconds'
         END`,
      [userId, limit.period],
    )
    const spentCents = parseCents(spentResult.rows[0]?.total ?? '0') ?? 0n

    if (spentCents + amountCents > limitCents) {
      throw new DepositPolicyError(`This deposit would exceed your ${limit.period} deposit limit.`, 400)
    }
  }
}

export function formatCents(cents: bigint) {
  return `${cents / 100n}.${String(cents % 100n).padStart(2, '0')}`
}
