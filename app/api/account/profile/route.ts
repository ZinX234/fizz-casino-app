import { z } from 'zod'
import { auth } from '@/lib/auth/server'
import { databasePool } from '@/lib/db'
import { isAllowedRequestOrigin } from '@/lib/request-security'

export const dynamic = 'force-dynamic'

const profileSchema = z.object({
  username: z.string().trim().min(3).max(20).regex(/^[A-Za-z0-9_]+$/),
  paypalFirstName: z.string().trim().min(1).max(80),
  paypalLastName: z.string().trim().min(1).max(80),
  paypalEmail: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
}).strict()

export async function PUT(request: Request) {
  if (!isAllowedRequestOrigin(request)) {
    return Response.json({ error: 'Request origin is not allowed.' }, { status: 403 })
  }

  const { data: session } = await auth.getSession()
  if (!session?.user?.id || !session.user.email) {
    return Response.json({ error: 'Authentication required.' }, { status: 401 })
  }

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return Response.json({ error: 'Invalid profile details.' }, { status: 400 })
  }

  const parsed = profileSchema.safeParse(payload)
  if (!parsed.success) {
    return Response.json({ error: 'Enter a 3–20 character username using letters, numbers, or underscores, and complete all PayPal details.' }, { status: 400 })
  }

  try {
    const { rows } = await databasePool.query<{
      username: string
      fizz_email: string
      paypal_first_name: string
      paypal_last_name: string
      paypal_email: string
    }>(
      `INSERT INTO public.user_profiles (
         user_id, username, fizz_email, paypal_first_name, paypal_last_name, paypal_email, updated_at
       ) VALUES ($1::uuid, $2, $3, $4, $5, $6, now())
       ON CONFLICT (user_id) DO UPDATE SET
         username = EXCLUDED.username,
         fizz_email = EXCLUDED.fizz_email,
         paypal_first_name = EXCLUDED.paypal_first_name,
         paypal_last_name = EXCLUDED.paypal_last_name,
         paypal_email = EXCLUDED.paypal_email,
         updated_at = now()
       RETURNING username, fizz_email, paypal_first_name, paypal_last_name, paypal_email`,
      [session.user.id, parsed.data.username, session.user.email.trim().toLowerCase(), parsed.data.paypalFirstName, parsed.data.paypalLastName, parsed.data.paypalEmail],
    )
    const profile = rows[0]
    return Response.json({ profile: {
      username: profile.username,
      fizzEmail: profile.fizz_email,
      paypalFirstName: profile.paypal_first_name,
      paypalLastName: profile.paypal_last_name,
      paypalEmail: profile.paypal_email,
    } })
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === '23505') {
      return Response.json({ error: 'That username is already taken. Try another one.' }, { status: 409 })
    }
    console.error('[v0] Account profile update failed:', error instanceof Error ? error.message : 'unknown error')
    return Response.json({ error: 'Your profile could not be saved. Please try again.' }, { status: 503 })
  }
}
