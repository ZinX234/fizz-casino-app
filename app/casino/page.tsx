import { LobbyPage } from '@/components/casino-home'
import { auth } from '@/lib/auth/server'
import { getAvailableGames, getWalletSnapshot, type GameRecord } from '@/lib/casino-data'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Casino lobby | Fizz Casino' }

export default async function CasinoPage() {
  const { data: session } = await auth.getSession()
  let games: GameRecord[] = []
  let dataError = false
  try {
    games = await getAvailableGames()
  } catch (error) {
    dataError = true
    console.error('[v0] Casino catalog unavailable:', error instanceof Error ? error.message : 'unknown error')
  }

  let currentPlayer: { id: string; name: string; email: string; balance: string | null; currency: string | null } | null = null
  if (session?.user) {
    currentPlayer = { id: session.user.id, name: session.user.name || '', email: session.user.email || '', balance: null, currency: null }
    try {
      const wallet = await getWalletSnapshot(session.user.id)
      currentPlayer.balance = wallet.balance
      currentPlayer.currency = wallet.currency
    } catch (error) {
      console.error('[v0] Lobby wallet unavailable:', error instanceof Error ? error.message : 'unknown error')
    }
  }

  return <LobbyPage games={games} dataError={dataError} currentPlayer={currentPlayer} />
}
