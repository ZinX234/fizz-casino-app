import { auth } from '@/lib/auth/server'
import { consumeUserRateLimit } from '@/lib/db'

export async function POST(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const { data: session } = await auth.getSession()
  if (!session?.user) return Response.json({ error: 'Authentication required.' }, { status: 401 })
  if (!(await consumeUserRateLimit(session.user.id, 'game-play', 30, 60))) {
    return Response.json({ error: 'Please slow down and try again.' }, { status: 429 })
  }
  const { slug } = await context.params
  return Response.json(
    { error: 'Game execution is unavailable until a server-side provider and wager engine are configured.', game: slug },
    { status: 503 },
  )
}
