import { auth } from '@/lib/auth/server'
import { getVaultHeistLeaderboard } from '@/lib/casino-games'
import { consumeUserRateLimit } from '@/lib/db'

export async function GET() {
  const { data: session } = await auth.getSession()
  if (!session?.user) return Response.json({ error: 'Sign in to view Vault Heist live results.' }, { status: 401 })
  if (!(await consumeUserRateLimit(session.user.id, 'vault-heist:leaderboard', 30, 60))) {
    return Response.json({ error: 'Please slow down and try again.' }, { status: 429 })
  }

  try {
    return Response.json(await getVaultHeistLeaderboard(), { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    console.error('[v0] Vault Heist leaderboard unavailable:', error instanceof Error ? error.message : 'unknown error')
    return Response.json({ error: 'The live leaderboard is unavailable.' }, { status: 500 })
  }
}
