import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { auth } from '@/lib/auth/server'
import { consumeUserRateLimit, databasePool, withTransaction } from '@/lib/db'
import { isAllowedRequestOrigin } from '@/lib/request-security'

const requestSchema = z.object({
  amount: z.string().trim().max(8).regex(/^\d{1,5}(?:\.\d{1,2})?$/),
  paymentReference: z.string().trim().min(4).max(128).regex(/^[A-Za-z0-9._:-]+$/),
}).strict()

function parseCents(value: string) {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value)
  if (!match) return null
  return BigInt(match[1]) * BigInt(100) + BigInt((match[2] ?? '').padEnd(2, '0'))
}

function formatCents(cents: bigint) {
  return `${cents / BigInt(100)}.${String(cents % BigInt(100)).padStart(2, '0')}`
}

export async function POST(request: Request) {
  if (!isAllowedRequestOrigin(request)) return Response.json({ error: 'Request origin is not allowed.' }, { status: 403 })
  const { data: session } = await auth.getSession()
  if (!session?.user) return Response.json({ error: 'Authentication required.' }, { status: 401 })

  const recipientEmail = process.env.PAYPAL_DEPOSIT_EMAIL?.trim()
  if (!recipientEmail || !z.string().email().safeParse(recipientEmail).success) {
    return Response.json({ error: 'Manual PayPal deposits are not configured yet.' }, { status: 503 })
  }

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return Response.json({ error: 'Invalid request body.' }, { status: 400 })
  }
  const parsed = requestSchema.safeParse(payload)
  const amountCents = parsed.success ? parseCents(parsed.data.amount) : null
  if (!parsed.success || amountCents === null || amountCents < BigInt(200) || amountCents > BigInt(1_000_000)) {
    return Response.json({ error: 'Enter a deposit amount between $2.00 and $10,000.00.' }, { status: 400 })
  }
  if (!session.user.email || session.user.email.length > 254) {
    return Response.json({ error: 'Your account needs a contact email before requesting a deposit.' }, { status: 400 })
  }

  let profile: { username: string; paypal_first_name: string; paypal_last_name: string; paypal_email: string } | undefined
  try {
    const result = await databasePool.query<NonNullable<typeof profile>>(
      `SELECT username, paypal_first_name, paypal_last_name, paypal_email
       FROM public.user_profiles WHERE user_id = $1::uuid LIMIT 1`,
      [session.user.id],
    )
    profile = result.rows[0]
  } catch (error) {
    console.error('[v0] Manual deposit profile lookup failed:', error instanceof Error ? error.message : 'unknown error')
    return Response.json({ error: 'Your profile could not be loaded. Please try again.' }, { status: 503 })
  }
  if (!profile) return Response.json({ error: 'Complete your Fizz username and PayPal details in Profile settings before requesting a deposit.' }, { status: 409 })

  if (!(await consumeUserRateLimit(session.user.id, 'manual-paypal-deposit', 5, 3600))) {
    return Response.json({ error: 'Please wait before submitting another manual deposit request.' }, { status: 429 })
  }

  const depositId = randomUUID()
  const externalReference = `manual-paypal:${parsed.data.paymentReference}`
  const amount = formatCents(amountCents)
  try {
    const result = await withTransaction(async (client) => {
      await client.query(`INSERT INTO public.wallets (user_id) VALUES ($1::uuid) ON CONFLICT (user_id) DO NOTHING`, [session.user.id])
      const { rows: wallets } = await client.query<{ id: string; currency: string }>(
        `SELECT id::text, currency FROM public.wallets WHERE user_id = $1::uuid FOR UPDATE`, [session.user.id],
      )
      const wallet = wallets[0]
      if (!wallet) throw new Error('Deposit wallet could not be loaded')

      const { rows: deposits } = await client.query<{ id: string }>(
        `INSERT INTO public.deposits (
           id, user_id, wallet_id, provider, external_transaction_id,
           amount, currency, status
         ) VALUES ($1::uuid, $2::uuid, $3::uuid, 'manual-paypal', $4, $5::numeric, $6, 'pending')
         ON CONFLICT (external_transaction_id) DO NOTHING
         RETURNING id::text`,
        [depositId, session.user.id, wallet.id, externalReference, amount, wallet.currency],
      )
      if (!deposits[0]) return null

      await client.query(
        `INSERT INTO public.manual_deposit_requests (
           deposit_id, first_name, last_name, payment_email, fizz_username, fizz_email, status
         ) VALUES ($1::uuid, $2, $3, $4, $5, $6, 'pending')`,
        [deposits[0].id, profile!.paypal_first_name, profile!.paypal_last_name, profile!.paypal_email, profile!.username, session.user.email],
      )
      return { id: deposits[0].id, amount, currency: wallet.currency }
    })

    if (!result) return Response.json({ error: 'That PayPal transaction reference has already been submitted.' }, { status: 409 })
    return Response.json({ request: result, status: 'pending' }, { status: 201 })
  } catch (error) {
    console.error('[v0] Manual PayPal deposit request failed:', error instanceof Error ? error.message : 'unknown error')
    return Response.json({ error: 'Your manual deposit request could not be saved.' }, { status: 500 })
  }
}
