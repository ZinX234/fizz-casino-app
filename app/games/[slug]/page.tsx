import { notFound, redirect } from 'next/navigation'
import { CasinoGameBoard } from '@/components/casino-game-board'
import { VaultHeistGame } from '@/components/vault-heist-game'
import { auth } from '@/lib/auth/server'
import { getActiveCasinoRound, getBuiltInRtpSetting, getVaultHeistConfiguration, getVaultHeistLeaderboard, supportedGameSlug } from '@/lib/casino-games'
import { getWalletSnapshot } from '@/lib/casino-data'
import { getPlayerUsername } from '@/lib/player-profile'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Play | Fizz Casino', description: 'Play Fizz original casino games with published return-to-player settings.' }

export default async function GamePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug: rawSlug } = await params
  if (!supportedGameSlug(rawSlug)) notFound()

  const { data: session } = await auth.getSession()
  if (!session?.user) redirect(`/auth/sign-in?returnTo=/games/${rawSlug}`)

  if (rawSlug === 'vault-heist') {
    const [configuration, initialRound, wallet, leaderboard, username] = await Promise.all([
      getVaultHeistConfiguration(),
      getActiveCasinoRound(session.user.id, rawSlug),
      getWalletSnapshot(session.user.id),
      getVaultHeistLeaderboard(),
      getPlayerUsername(session.user.id),
    ])
    return <VaultHeistGame
      profiles={configuration.profiles}
      initialProfileId={configuration.activeProfileId}
      initialRound={initialRound}
      initialBalance={wallet.balance}
      currency={wallet.currency}
      playerName={username || session.user.name || 'Player'}
      leaderboard={leaderboard}
    />
  }

  const [settings, initialRound, wallet, username] = await Promise.all([
    getBuiltInRtpSetting(rawSlug),
    getActiveCasinoRound(session.user.id, rawSlug),
    getWalletSnapshot(session.user.id),
    getPlayerUsername(session.user.id),
  ])
  if (!settings) notFound()

  return <CasinoGameBoard
    setting={settings}
    initialRound={initialRound}
    initialBalance={wallet.balance}
    currency={wallet.currency}
    playerName={username || session.user.name || 'Player'}
  />
}
