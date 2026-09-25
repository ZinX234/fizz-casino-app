import { z } from 'zod'
import { auth } from '@/lib/auth/server'
import { consumeUserRateLimit } from '@/lib/db'

const withdrawalSchema = z.object({ amount: z.number().finite().positive().max(10000), method: z.string().trim().min(1).max(80) })

export async function POST(request: Request) {
  const { data: session } = await auth.getSession()
  if (!session?.user) return Response.json({ error: 'Authentication required.' }, { status: 401 })
  if (!(await consumeUserRateLimit(session.user.id, 'withdrawal-create', 5, 3600))) {
    return Response.json({ error: 'Please wait before submitting another withdrawal.' }, { status: 429 })
  }
  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return Response.json({ error: 'Invalid request body.' }, { status: 400 })
  }
  const parsed = withdrawalSchema.safeParse(payload)
  if (!parsed.success || Math.round(parsed.data?.amount * 100) !== parsed.data?.amount * 100) {
    return Response.json({ error: 'Enter a valid withdrawal request.' }, { status: 400 })
  }
  return Response.json(
    { error: 'Withdrawals are unavailable until a verified payout provider and authorized review process are configured.' },
    { status: 503 },
  )
}
