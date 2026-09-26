import { CasinoLobby } from '@/components/casino-lobby'
import { auth } from '@/lib/auth/server'
import { getAvailableGames, getProgressionSnapshot, getWalletSnapshot, type GameRecord } from '@/lib/casino-data'
import { getPlayerUsername } from '@/lib/player-profile'
import { getKickLiveStatus } from '@/lib/kick-status'
import type { PlayerProgression } from '@/lib/progression'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Casino lobby | Fizz Casino' }

export default async function CasinoPage() {
  const { data: session } = await auth.getSession()
  let games: GameRecord[] = []
  let dataError = false
  let kickIsLive = false
  try {
    games = await getAvailableGames()
  } catch (error) {
    dataError = true
    console.error('[v0] Casino catalog unavailable:', error instanceof Error ? error.message : 'unknown error')
  }

  try {
    kickIsLive = await getKickLiveStatus()
  } catch (error) {
    console.error('[v0] Kick status unavailable:', error instanceof Error ? error.message : 'unknown error')
  }

  let currentPlayer: { id: string; name: string; email: string; balance: string | null; currency: string | null; progression: PlayerProgression } | null = null
  if (session?.user) {
    try {
      const [wallet, progression, username] = await Promise.all([
        getWalletSnapshot(session.user.id),
        getProgressionSnapshot(session.user.id),
        getPlayerUsername(session.user.id),
      ])
      currentPlayer = {
        id: session.user.id,
        name: username || session.user.name || '',
        email: session.user.email || '',
        balance: wallet.balance,
        currency: wallet.currency,
        progression,
      }
    } catch (error) {
      console.error('[v0] Lobby account data unavailable:', error instanceof Error ? error.message : 'unknown error')
      currentPlayer = {
        id: session.user.id,
        name: session.user.name || '',
        email: session.user.email || '',
        balance: null,
        currency: 'USD',
        progression: { totalXp: 0, level: 1, xpIntoLevel: 0, xpForNextLevel: 100, progressPercent: 0 },
      }
    }
  }

  return <CasinoLobby games={games} dataError={dataError} currentPlayer={currentPlayer} kickIsLive={kickIsLive} />
}
