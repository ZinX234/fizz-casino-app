import { notFound, redirect } from 'next/navigation'
import { CasinoGameBoard } from '@/components/casino-game-board'
import { auth } from '@/lib/auth/server'
import { getActiveCasinoRound, getBuiltInRtpSetting, supportedGameSlug } from '@/lib/casino-games'
import { getWalletSnapshot } from '@/lib/casino-data'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Play | Fizz Casino', description: 'Play Fizz original casino games with published return-to-player settings.' }

export default async function GamePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug: rawSlug } = await params
  if (!supportedGameSlug(rawSlug)) notFound()

  const { data: session } = await auth.getSession()
  if (!session?.user) redirect(`/auth/sign-in?returnTo=/games/${rawSlug}`)

  const [settings, initialRound, wallet] = await Promise.all([
    getBuiltInRtpSetting(rawSlug),
    getActiveCasinoRound(session.user.id, rawSlug),
    getWalletSnapshot(session.user.id),
  ])
  if (!settings) notFound()

  return <CasinoGameBoard
    setting={settings}
    initialRound={initialRound}
    initialBalance={wallet.balance}
    currency={wallet.currency}
    playerName={session.user.name || 'Player'}
  />
}
