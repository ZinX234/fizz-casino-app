import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import { z } from 'zod'
import { databasePool, withTransaction } from '@/lib/db'

export const runtime = 'nodejs'

const eventSchema = z.object({
  event: z.string().min(1).max(100),
  link_id: z.string().min(1).max(200),
}).passthrough()

const completedEventSchema = eventSchema.extend({
  event: z.literal('payment.completed'),
  status: z.literal('completed'),
  amount: z.union([z.string(), z.number().finite()]).transform(String).pipe(z.string().max(16).regex(/^\d+(?:\.\d{1,2})?$/)),
  currency: z.string().regex(/^[A-Z]{3}$/),
})

const MAX_WEBHOOK_BYTES = 65_536

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
  const secret = process.env.RAMPEX_WEBHOOK_SECRET?.trim()
  if (!secret) {
    return Response.json({ error: 'Rampex webhook signing verification is not configured.' }, { status: 503 })
  }

  const signature = (
    request.headers.get('x-rampex-signature') ??
    request.headers.get('x-webhook-signature') ??
    ''
  ).trim().toLowerCase()
  if (!/^[a-f0-9]{64}$/.test(signature)) {
    return Response.json({ error: 'Invalid Rampex signature header.' }, { status: 401 })
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

  const expectedSignature = createHmac('sha256', secret).update(rawBody).digest()
  const suppliedSignature = Buffer.from(signature, 'hex')
  if (!timingSafeEqual(expectedSignature, suppliedSignature)) {
    return Response.json({ error: 'Rampex signature verification failed.' }, { status: 401 })
  }

  let payload: unknown
  try {
    payload = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(rawBody))
  } catch {
    return Response.json({ error: 'Invalid Rampex webhook JSON.' }, { status: 400 })
  }

  const parsedEvent = eventSchema.safeParse(payload)
  const eventTypeHeader = request.headers.get('x-rampex-event')
  if (!parsedEvent.success || !eventTypeHeader || parsedEvent.data.event !== eventTypeHeader) {
    return Response.json({ error: 'Rampex event header does not match the payload.' }, { status: 400 })
  }

  const completedEvent = parsedEvent.data.event === 'payment.completed'
    ? completedEventSchema.safeParse(parsedEvent.data)
    : null
  if (completedEvent && !completedEvent.success) {
    return Response.json({ error: 'Invalid Rampex completed-payment event.' }, { status: 400 })
  }

  const payloadHash = createHash('sha256').update(rawBody).digest('hex')
  const providerEventId = `${parsedEvent.data.event}:${parsedEvent.data.link_id}`

  try {
    await withTransaction(async (client) => {
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO public.webhook_events (
           provider, provider_event_id, event_type, payload_hash, signature_valid,
           processed_at
         ) VALUES ('rampex', $1, $2, $3, true, CASE WHEN $2 = 'payment.completed' THEN NULL ELSE now() END)
         ON CONFLICT (provider, provider_event_id) DO NOTHING
         RETURNING id::text`,
        [providerEventId, parsedEvent.data.event, payloadHash],
      )
      const webhookEventId = inserted.rows[0]?.id
      if (!webhookEventId) return

      if (parsedEvent.data.event === 'payment.expired') {
        await client.query(
          `UPDATE public.deposits
           SET status = 'expired', updated_at = now()
           WHERE provider = 'rampex' AND provider_order_id = $1 AND status = 'pending'`,
          [parsedEvent.data.link_id],
        )
        return
      }

      if (!completedEvent?.success) return

      const event = completedEvent.data
      const depositResult = await client.query<{
        id: string
        user_id: string
        wallet_id: string
        amount: string
        currency: string
        status: string
      }>(
        `SELECT id::text, user_id::text, wallet_id::text, amount::text, currency, status
         FROM public.deposits
         WHERE provider = 'rampex' AND provider_order_id = $1
         FOR UPDATE`,
        [event.link_id],
      )
      const deposit = depositResult.rows[0]
      const webhookAmount = parseCents(event.amount)
      const depositAmount = deposit ? parseCents(deposit.amount) : null
      if (
        !deposit ||
        webhookAmount === null ||
        webhookAmount !== depositAmount ||
        event.currency !== deposit.currency ||
        deposit.status !== 'pending'
      ) {
        await markEventProcessed(client, webhookEventId)
        console.warn('[v0] Rampex completed payment did not match an eligible pending deposit.')
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

      const transactionIdempotencyKey = `rampex:deposit:${deposit.id}`
      const ledgerWrite = await client.query(
        `INSERT INTO public.wallet_transactions (
           wallet_id, user_id, type, amount, balance_before, balance_after,
           reference_type, reference_id, idempotency_key, description
         ) VALUES (
           $1::uuid, $2::uuid, 'deposit', $3::numeric, $4::numeric, $5::numeric,
           'deposit', $6::uuid, $7, 'Verified Rampex deposit'
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
         WHERE id = $1::uuid AND provider = 'rampex'`,
        [deposit.id],
      )
      await markEventProcessed(client, webhookEventId)
    })
  } catch (error) {
    console.error('[v0] Rampex webhook transaction failed:', error instanceof Error ? error.message : 'unknown error')
    return Response.json({ error: 'Payment event could not be processed.' }, { status: 500 })
  }

  return Response.json({ received: true }, { status: 200 })
}
