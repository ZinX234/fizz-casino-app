import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { auth } from '@/lib/auth/server'
import { consumeUserRateLimit, databasePool, withTransaction } from '@/lib/db'
import { isAllowedRequestOrigin } from '@/lib/request-security'

const depositSchema = z.object({
  amount: z.string().trim().max(8).regex(/^\d{1,5}(?:\.\d{1,2})?$/, 'Enter an amount with up to two decimal places.'),
})

const payMeGateOrderSchema = z.object({
  data: z.object({
    orderUUID: z.string().uuid(),
    externalId: z.string().nullable(),
    amount: z.string(),
    currency: z.string(),
    status: z.enum(['UNPAID', 'PAID', 'FAILED', 'EXPIRED', 'CANCELLED']),
    checkoutUrl: z.string().url(),
    expiresAt: z.string().datetime().optional(),
  }),
})

const MAX_DEPOSIT_CENTS = 1_000_000
const CHECKOUT_EXPIRY_MINUTES = 30
const APP_ORIGIN_FALLBACK = 'https://build-fizz-casino-app.vercel.app'

class DepositPolicyError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
  }
}

function parseCents(value: string) {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value)
  if (!match) return null
  return BigInt(match[1]) * BigInt(100) + BigInt((match[2] ?? '').padEnd(2, '0'))
}

function formatCents(cents: bigint) {
  return `${cents / BigInt(100)}.${String(cents % BigInt(100)).padStart(2, '0')}`
}

function getBackUrl() {
  const configuredOrigin = process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : APP_ORIGIN_FALLBACK
  const origin = new URL(configuredOrigin).origin
  return `${origin}/account?deposit=returned`
}

function isTrustedCheckoutUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && ['paymegate.com', 'www.paymegate.com'].includes(url.hostname)
  } catch {
    return false
  }
}

export async function POST(request: Request) {
  if (!isAllowedRequestOrigin(request)) {
    return Response.json({ error: 'Request origin is not allowed.' }, { status: 403 })
  }

  const { data: session } = await auth.getSession()
  if (!session?.user) return Response.json({ error: 'Authentication required.' }, { status: 401 })

  const apiKey = process.env.PAYMEGATE_API_KEY?.trim()
  const webhookSecret = process.env.PAYMEGATE_WEBHOOK_SECRET?.trim()
  if (!apiKey || !webhookSecret) {
    return Response.json(
      { error: 'Secure PayMeGate deposits are not configured yet.', code: 'PAYMENT_PROVIDER_UNAVAILABLE' },
      { status: 503 },
    )
  }

  const emailResult = await databasePool.query<{ email_verified: boolean }>(
    `SELECT "emailVerified" AS email_verified FROM neon_auth."user" WHERE id = $1::uuid`,
    [session.user.id],
  )
  if (!emailResult.rows[0]?.email_verified || !session.user.email) {
    return Response.json({ error: 'Verify your account email before depositing.' }, { status: 403 })
  }

  let rawBody: ArrayBuffer
  try {
    rawBody = await request.arrayBuffer()
  } catch {
    return Response.json({ error: 'Invalid request body.' }, { status: 400 })
  }
  if (rawBody.byteLength === 0 || rawBody.byteLength > 2_048) {
    return Response.json({ error: 'Request body is too large or empty.' }, { status: 413 })
  }

  let payload: unknown
  try {
    payload = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(rawBody))
  } catch {
    return Response.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const parsed = depositSchema.safeParse(payload)
  const amountCents = parsed.success ? parseCents(parsed.data.amount) : null
  if (!parsed.success || amountCents === null || amountCents <= BigInt(0) || amountCents > BigInt(MAX_DEPOSIT_CENTS)) {
    return Response.json({ error: 'Enter a valid deposit amount between $0.01 and $10,000.00.' }, { status: 400 })
  }

  if (!(await consumeUserRateLimit(session.user.id, 'deposit-create', 5, 3600))) {
    return Response.json({ error: 'Please wait before starting another deposit.' }, { status: 429 })
  }

  const depositId = randomUUID()
  const amount = formatCents(amountCents)
  const expiresAt = new Date(Date.now() + CHECKOUT_EXPIRY_MINUTES * 60_000)

  let wallet: { id: string; currency: string }
  try {
    wallet = await withTransaction(async (client) => {
      await client.query(
        `INSERT INTO public.wallets (user_id)
         VALUES ($1::uuid)
         ON CONFLICT (user_id) DO NOTHING`,
        [session.user.id],
      )
      const walletResult = await client.query<{ id: string; currency: string }>(
        `SELECT id::text, currency FROM public.wallets WHERE user_id = $1::uuid FOR UPDATE`,
        [session.user.id],
      )
      const accountWallet = walletResult.rows[0]
      if (!accountWallet) throw new Error('Wallet could not be loaded')

      const restrictions = await client.query<{ limit_type: string; limit_amount: string | null; period: string | null }>(
        `SELECT limit_type, limit_amount::text, period
         FROM public.responsible_gaming_limits
         WHERE user_id = $1::uuid
           AND starts_at <= now()
           AND (ends_at IS NULL OR ends_at > now())
           AND limit_type IN ('self_exclusion', 'suspension', 'cooling_off', 'deposit')`,
        [session.user.id],
      )

      if (restrictions.rows.some((limit) => ['self_exclusion', 'suspension', 'cooling_off'].includes(limit.limit_type))) {
        throw new DepositPolicyError('Deposits are blocked by your active responsible gaming settings.', 403)
      }

      for (const limit of restrictions.rows) {
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
          [session.user.id, limit.period],
        )
        const spentCents = parseCents(spentResult.rows[0]?.total ?? '0') ?? BigInt(0)
        if (spentCents + amountCents > limitCents) {
          throw new DepositPolicyError(`This deposit would exceed your ${limit.period} deposit limit.`, 400)
        }
      }

      await client.query(
        `INSERT INTO public.deposits (
           id, user_id, wallet_id, provider, external_transaction_id,
           amount, currency, status, expires_at
         ) VALUES ($1::uuid, $2::uuid, $3::uuid, 'paymegate', $1, $4::numeric, $5, 'pending', $6)`,
        [depositId, session.user.id, accountWallet.id, amount, accountWallet.currency, expiresAt],
      )
      return accountWallet
    })
  } catch (error) {
    if (error instanceof DepositPolicyError) {
      return Response.json({ error: error.message }, { status: error.status })
    }
    console.error('[v0] PayMeGate deposit reservation failed:', error instanceof Error ? error.message : 'unknown error')
    return Response.json({ error: 'Could not start a deposit. Please try again later.' }, { status: 500 })
  }

  let providerResponse: Response
  try {
    providerResponse = await fetch('https://www.paymegate.com/api/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
      },
      body: JSON.stringify({
        amount,
        currency: wallet.currency,
        paymentMethodsKeys: ['*'],
        customer: { email: session.user.email, fullName: session.user.name || undefined },
        externalId: depositId,
        description: `Fizz Casino wallet deposit ${depositId}`,
        backUrl: getBackUrl(),
        expiresAt: expiresAt.toISOString(),
        metadata: { depositId },
      }),
      signal: AbortSignal.timeout(15_000),
    })
  } catch (error) {
    try {
      await databasePool.query(
        `UPDATE public.deposits SET status = 'failed', updated_at = now()
         WHERE id = $1::uuid AND status = 'pending'`,
        [depositId],
      )
    } catch {
      console.error('[v0] PayMeGate deposit reservation could not be marked failed after a request error.')
    }
    console.error('[v0] PayMeGate checkout request failed:', error instanceof Error ? error.name : 'unknown error')
    return Response.json({ error: 'PayMeGate could not start checkout. Please try again later.' }, { status: 502 })
  }

  let providerPayload: unknown
  try {
    providerPayload = await providerResponse.json()
  } catch {
    providerPayload = null
  }

  const order = payMeGateOrderSchema.safeParse(providerPayload)
  const returnedCents = order.success ? parseCents(order.data.data.amount) : null
  if (
    !providerResponse.ok ||
    !order.success ||
    !isTrustedCheckoutUrl(order.data.data.checkoutUrl) ||
    order.data.data.externalId !== depositId ||
    returnedCents !== amountCents ||
    order.data.data.currency !== wallet.currency ||
    order.data.data.status !== 'UNPAID'
  ) {
    await databasePool.query(
      `UPDATE public.deposits SET status = 'failed', updated_at = now()
       WHERE id = $1::uuid AND status = 'pending'`,
      [depositId],
    )
    console.error('[v0] PayMeGate returned an invalid or unsuccessful checkout response:', providerResponse.status)
    return Response.json({ error: 'PayMeGate could not start a verified checkout. Please try again later.' }, { status: 502 })
  }

  await databasePool.query(
    `UPDATE public.deposits
     SET provider_order_id = $2, checkout_url = $3, updated_at = now()
     WHERE id = $1::uuid AND status = 'pending'`,
    [depositId, order.data.data.orderUUID, order.data.data.checkoutUrl],
  )

  return Response.json({ checkoutUrl: order.data.data.checkoutUrl })
}
