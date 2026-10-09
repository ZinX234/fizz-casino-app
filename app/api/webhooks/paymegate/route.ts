import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import { z } from 'zod'
import { databasePool, withTransaction } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const eventSchema = z.object({
  id: z.string().uuid(),
  type: z.string().min(1).max(100),
}).passthrough()

const paidOrderSchema = eventSchema.extend({
  type: z.literal('order.paid'),
  createdAt: z.string().datetime(),
  orderUUID: z.string().uuid(),
  transactionUUID: z.string().uuid().optional(),
  transactionRef: z.string().nullable().optional(),
  status: z.literal('PAID'),
  amount: z.string().max(16).regex(/^\d+(?:\.\d{1,2})?$/),
  currency: z.string().regex(/^[A-Z]{3}$/),
  customerEmail: z.string().email(),
  externalId: z.string().uuid().nullable(),
  paidAt: z.string().datetime(),
})

const MAX_WEBHOOK_BYTES = 65_536
const MAX_TIMESTAMP_AGE_MS = 5 * 60_000

function parseCents(value: string) {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value)
  if (!match) return null
  return BigInt(match[1]) * BigInt(100) + BigInt((match[2] ?? '').padEnd(2, '0'))
}

function formatCents(cents: bigint) {
  return `${cents / BigInt(100)}.${String(cents % BigInt(100)).padStart(2, '0')}`
}

function markEventProcessed(client: import('pg').PoolClient, eventId: string) {
  return client.query(
    `UPDATE public.webhook_events SET processed_at = now() WHERE id = $1::uuid`,
    [eventId],
  )
}

export async function POST(request: Request) {
  const secret = process.env.PAYMEGATE_WEBHOOK_SECRET?.trim()
  if (!secret) {
    return Response.json({ error: 'Webhook signing verification is not configured.' }, { status: 503 })
  }

  const eventTypeHeader = request.headers.get('x-paymegate-event') ?? ''
  const eventIdHeader = request.headers.get('x-paymegate-event-id') ?? ''
  const timestamp = request.headers.get('x-paymegate-timestamp') ?? ''
  const signature = request.headers.get('x-paymegate-signature') ?? ''
  if (
    !eventTypeHeader ||
    !z.string().uuid().safeParse(eventIdHeader).success ||
    !/^\d{10,13}$/.test(timestamp) ||
    !/^[A-Za-z0-9_-]{43}$/.test(signature)
  ) {
    return Response.json({ error: 'Invalid PayMeGate signature headers.' }, { status: 401 })
  }

  const timestampNumber = Number(timestamp)
  const timestampMs = timestamp.length === 13 ? timestampNumber : timestampNumber * 1000
  if (!Number.isSafeInteger(timestampMs) || Math.abs(Date.now() - timestampMs) > MAX_TIMESTAMP_AGE_MS) {
    return Response.json({ error: 'PayMeGate webhook timestamp is stale.' }, { status: 401 })
  }

  const contentLength = Number(request.headers.get('content-length') ?? 0)
  if (contentLength > MAX_WEBHOOK_BYTES) {
    return Response.json({ error: 'Webhook payload is too large.' }, { status: 413 })
  }

  let rawBody: Buffer
  try {
    rawBody = Buffer.from(await request.arrayBuffer())
  } catch {
    return Response.json({ error: 'Could not read webhook payload.' }, { status: 400 })
  }
  if (rawBody.byteLength === 0 || rawBody.byteLength > MAX_WEBHOOK_BYTES) {
    return Response.json({ error: 'Invalid webhook payload size.' }, { status: 413 })
  }

  const expectedSignature = createHmac('sha256', secret)
    .update(timestamp, 'utf8')
    .update('.', 'utf8')
    .update(rawBody)
    .digest()
  const suppliedSignature = Buffer.from(signature, 'base64url')
  if (suppliedSignature.byteLength !== expectedSignature.byteLength || !timingSafeEqual(expectedSignature, suppliedSignature)) {
    return Response.json({ error: 'PayMeGate signature verification failed.' }, { status: 401 })
  }

  let payload: unknown
  try {
    payload = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(rawBody))
  } catch {
    return Response.json({ error: 'Invalid webhook JSON.' }, { status: 400 })
  }

  const parsedEvent = eventSchema.safeParse(payload)
  if (
    !parsedEvent.success ||
    parsedEvent.data.id !== eventIdHeader ||
    parsedEvent.data.type !== eventTypeHeader
  ) {
    return Response.json({ error: 'PayMeGate event headers do not match the signed payload.' }, { status: 400 })
  }

  const paidEvent = parsedEvent.data.type === 'order.paid'
    ? paidOrderSchema.safeParse(parsedEvent.data)
    : null
  if (paidEvent && !paidEvent.success) {
    return Response.json({ error: 'Invalid paid-order event.' }, { status: 400 })
  }

  const payloadHash = createHash('sha256').update(rawBody).digest('hex')

  try {
    await withTransaction(async (client) => {
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO public.webhook_events (
           provider, provider_event_id, event_type, payload_hash, signature_valid,
           processed_at
         ) VALUES ('paymegate', $1, $2, $3, true, CASE WHEN $2 = 'order.paid' THEN NULL ELSE now() END)
         ON CONFLICT (provider, provider_event_id) DO NOTHING
         RETURNING id::text`,
        [eventIdHeader, parsedEvent.data.type, payloadHash],
      )
      const webhookEventId = inserted.rows[0]?.id
      if (!webhookEventId) return
      if (!paidEvent?.success) return

      const event = paidEvent.data
      if (!event.externalId || !event.transactionUUID) {
        await markEventProcessed(client, webhookEventId)
        console.warn('[v0] PayMeGate event lacked a verified transaction or deposit reference.')
        return
      }

      const depositResult = await client.query<{
        id: string
        user_id: string
        wallet_id: string
        amount: string
        currency: string
        status: string
        provider_order_id: string | null
      }>(
        `SELECT id::text, user_id::text, wallet_id::text, amount::text, currency,
                status, provider_order_id
         FROM public.deposits
         WHERE provider = 'paymegate' AND external_transaction_id = $1
         FOR UPDATE`,
        [event.externalId],
      )
      const deposit = depositResult.rows[0]
      const webhookAmount = parseCents(event.amount)
      const depositAmount = deposit ? parseCents(deposit.amount) : null
      if (
        !deposit ||
        !webhookAmount ||
        webhookAmount !== depositAmount ||
        event.currency !== deposit.currency ||
        event.orderUUID !== deposit.provider_order_id ||
        !['pending', 'processing'].includes(deposit.status)
      ) {
        await markEventProcessed(client, webhookEventId)
        console.warn('[v0] PayMeGate paid event did not match an eligible pending deposit.')
        return
      }

      const walletResult = await client.query<{ balance: string }>(
        `SELECT balance::text FROM public.wallets
         WHERE id = $1::uuid AND user_id = $2::uuid
         FOR UPDATE`,
        [deposit.wallet_id, deposit.user_id],
      )
      const wallet = walletResult.rows[0]
      const balanceCents = wallet ? parseCents(wallet.balance) : null
      if (balanceCents === null) throw new Error('Deposit wallet is missing or has an invalid balance')

      const transactionIdempotencyKey = `paymegate:deposit:${deposit.id}`
      const ledgerWrite = await client.query(
        `INSERT INTO public.wallet_transactions (
           wallet_id, user_id, type, amount, balance_before, balance_after,
           reference_type, reference_id, idempotency_key, description
         ) VALUES (
           $1::uuid, $2::uuid, 'deposit', $3::numeric, $4::numeric, $5::numeric,
           'deposit', $6::uuid, $7, 'Verified PayMeGate deposit'
         )
         ON CONFLICT (idempotency_key) DO NOTHING`,
        [
          deposit.wallet_id,
          deposit.user_id,
          formatCents(webhookAmount),
          formatCents(balanceCents),
          formatCents(balanceCents + webhookAmount),
          deposit.id,
          transactionIdempotencyKey,
        ],
      )

      if (ledgerWrite.rowCount !== 1) {
        const existing = await client.query(
          `SELECT 1 FROM public.wallet_transactions WHERE idempotency_key = $1`,
          [transactionIdempotencyKey],
        )
        if (existing.rowCount !== 1) throw new Error('Deposit ledger idempotency could not be confirmed')
      }

      await client.query(
        `UPDATE public.deposits
         SET status = 'paid', paid_at = coalesce(paid_at, now()), updated_at = now()
         WHERE id = $1::uuid`,
        [deposit.id],
      )
      await markEventProcessed(client, webhookEventId)
    })
  } catch (error) {
    console.error('[v0] PayMeGate webhook transaction failed:', error instanceof Error ? error.message : 'unknown error')
    return Response.json({ error: 'Payment event could not be processed.' }, { status: 500 })
  }

  return Response.json({ received: true }, { status: 200 })
}
