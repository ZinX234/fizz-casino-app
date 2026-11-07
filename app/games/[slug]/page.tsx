import { notFound, redirect } from 'next/navigation'
import { CasinoGameBoard } from '@/components/casino-game-board'
import { DonutDivisionGame } from '@/components/donut-division-game'
import { FizzRushGame } from '@/components/fizz-rush-game'
import { VaultHeistGame } from '@/components/vault-heist-game'
import { auth } from '@/lib/auth/server'
import { getActiveCasinoRound, getBuiltInRtpSetting, getVaultHeistConfiguration, getVaultHeistLeaderboard, supportedGameSlug } from '@/lib/casino-games'
import { getWalletSnapshot } from '@/lib/casino-data'
import { getPlayerUsername } from '@/lib/player-profile'
import ShatterpointGame from '@/components/shatterpoint/ShatterpointGame'
import Link from 'next/link'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Play | Fizz Casino', description: 'Play Fizz original casino games with published return-to-player settings.' }

export default async function GamePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ mode?: string }>
}) {
  const { slug: rawSlug } = await params
  const query = await searchParams
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

  if (rawSlug === 'donut-division') {
    const [settings, initialRound, wallet, username] = await Promise.all([
      getBuiltInRtpSetting(rawSlug),
      getActiveCasinoRound(session.user.id, rawSlug),
      getWalletSnapshot(session.user.id),
      getPlayerUsername(session.user.id),
    ])
    if (!settings) notFound()
    return <DonutDivisionGame
      setting={settings}
      initialRound={initialRound}
      initialBalance={wallet.balance}
      currency={wallet.currency}
      playerName={username || session.user.name || 'Player'}
    />
  }

  if (rawSlug === 'shatterpoint') {
    const [settings, wallet, initialRound] = await Promise.all([
      getBuiltInRtpSetting(rawSlug),
      getWalletSnapshot(session.user.id),
      getActiveCasinoRound(session.user.id, rawSlug),
    ])
    if (!settings) notFound()
    const initialMode = query.mode === 'demo' ? 'demo' : 'real'
    return (
      <main className="h-svh overflow-hidden bg-[#090a0d] text-white">
        <header className="flex h-[72px] items-center justify-between border-b border-white/[0.08] bg-[#090a0d] px-4 sm:px-6">
          <Link href="/casino" className="flex items-center gap-3 text-sm font-bold text-white">
            <img src="/fizz-casino-logo.png" alt="Fizz Casino" className="h-12 w-12 object-contain" />
            <span className="hidden sm:inline">Lobby</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/account" aria-label={`Wallet balance: ${Number(wallet.balance ?? 0).toFixed(2)} FC`} className="rounded-lg border border-white/[0.12] bg-[#111217] px-3 py-2 text-xs font-semibold text-white/90">
              {Number(wallet.balance ?? 0).toFixed(2)} FC
            </Link>
            <Link href="/account" className="rounded-lg bg-[#6b19f5] px-3.5 py-2 text-xs font-bold text-white">
              Wallet
            </Link>
          </div>
        </header>
        <div className="h-[calc(100svh-72px)] w-full">
          <ShatterpointGame
            embedded
            initialMode={initialMode}
            initialBalance={Number(wallet.balance ?? 0)}
            setting={settings}
            initialRound={initialRound}
          />
        </div>
      </main>
    )
  }

  if (rawSlug === 'fizz-rush') {
    const [settings, initialRound, wallet, username] = await Promise.all([
      getBuiltInRtpSetting(rawSlug),
      getActiveCasinoRound(session.user.id, rawSlug),
      getWalletSnapshot(session.user.id),
      getPlayerUsername(session.user.id),
    ])
    if (!settings) notFound()
    return <FizzRushGame
      setting={settings}
      initialRound={initialRound}
      initialBalance={wallet.balance}
      currency={wallet.currency}
      playerName={username || session.user.name || 'Player'}
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
