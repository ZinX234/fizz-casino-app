'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import {
  BadgeCheck,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Clock3,
  Coins,
  Crown,
  Gamepad2,
  Home,
  Menu,
  Radio,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Trophy,
  UserRound,
  X,
} from 'lucide-react'
import { AffiliateCard } from '@/components/affiliate-card'
import type { GameRecord } from '@/lib/casino-data'
import type { PlayerProgression } from '@/lib/progression'
import { formatFizzcoins } from '@/lib/format-money'
import { GlobalLobbyChatButton } from '@/components/pinned-lobby-chat'

type LobbyPlayer = {
  id: string
  name: string
  email: string
  balance: string | null
  currency: string | null
  progression: PlayerProgression
}

type Props = {
  games: GameRecord[]
  dataError: boolean
  currentPlayer: LobbyPlayer | null
  kickIsLive: boolean
}

const supportedGames = new Set(['crash', 'mines', 'towers', 'blackjack', 'vault-heist', 'donut-division', 'fizz-rush', 'slot-arena', 'shatterpoint'])
const gameArtwork: Record<string, string> = {
  crash: '/games/fizz-crash-airplane.png',
  mines: '/games/fizz-mines.png',
  towers: '/games/fizz-towers.png',
  blackjack: '/games/fizzblackjack.png',
  'vault-heist': '/games/vault-heist-bg.png',
  'donut-division': '/games/donut-division-cover.png',
  'fizz-rush': '/games/fizz-rush-cover.png',
  'slot-arena': 'https://lh3.googleusercontent.com/d/1jogj7-OyeU0LxmsB2QfP_oV1COQ-IilC',
  shatterpoint: '/games/shatterpoint-cover.png',
}
const spotlights: Record<string, { eyebrow: string; title: string; detail: string }> = {
  crash: { eyebrow: 'Fizz originals', title: 'Ride the multiplier', detail: 'Cash out before the round ends.' },
  mines: { eyebrow: 'Fizz originals', title: 'Find the safe tiles', detail: 'Reveal gems and choose when to cash out.' },
  towers: { eyebrow: 'Fizz originals', title: 'Climb one row at a time', detail: 'Pick a safe column and keep climbing.' },
  blackjack: { eyebrow: 'Fizz originals · table games', title: 'A seat at the table', detail: 'Take on the dealer. Play your hand to 21.' },
  'vault-heist': { eyebrow: 'Fizz original · flagship', title: 'Vault Heist', detail: 'Crack the doors. Beat the alarm. Choose your escape.' },
  'donut-division': { eyebrow: 'Fizz originals · slots', title: 'Donut Division', detail: 'Match symbols across 25 paylines and investigate the bonus.' },
  'fizz-rush': { eyebrow: 'Fizz originals · runner', title: 'Fizz Rush', detail: 'Run as far as you can before the island claims you.' },
  shatterpoint: { eyebrow: 'Fizz originals', title: 'FIZZ: Shatterpoint', detail: 'Cross the glass bridge. Pick safe panes. Clear every stage to win.' },
  'slot-arena': { eyebrow: 'Fizz originals · slots', title: 'Slot Arena', detail: 'Spin the reels in the neon-lit arena.' },
}

function FizzcoinBalance({ balance, currency }: { balance: string | null; currency: string | null }) {
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap">
      <Coins aria-hidden="true" className="size-4 text-[#86baff]" />
      <span className="font-semibold tabular-nums">{balance === null ? '—' : formatFizzcoins(balance, currency ?? 'USD')}</span>
    </span>
  )
}

function LobbyRail() {
  const links = [
    { href: '/casino', label: 'Casino lobby', icon: Home },
    { href: '/casino#games', label: 'All games', icon: Gamepad2 },
    { href: '/casino#progression', label: 'Level progress', icon: Trophy },
    { href: '/account', label: 'Wallet', icon: Coins },
    { href: '/account/responsible-gaming', label: 'Responsible play', icon: ShieldCheck },
  ]

  return (
    <aside aria-label="Casino navigation" className="fixed inset-y-[68px] left-0 z-20 hidden w-[196px] flex-col border-r border-fuchsia-300/[0.09] bg-[#100817]/90 px-3 py-5 backdrop-blur-xl md:flex">
      <p className="px-3 pb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-white/35">Play</p>
      <nav className="flex w-full flex-col gap-1">
        {links.map(({ href, label, icon: Icon }, index) => (
          <Link key={href} href={href} aria-label={label} className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-xs font-semibold transition ${index === 0 ? 'bg-fuchsia-500/15 text-fuchsia-100 shadow-[inset_0_0_0_1px_rgba(244,114,182,.18)]' : 'text-white/55 hover:bg-white/[0.06] hover:text-white'}`}>
            <Icon aria-hidden="true" className="size-[17px]" />
            {label}
          </Link>
        ))}
      </nav>
      <div className="mt-auto rounded-2xl border border-white/[0.08] bg-white/[0.035] p-3">
        <p className="text-xs font-bold text-white/80">Need a hand?</p>
        <p className="mt-1 text-[10px] leading-4 text-white/40">Our support team is here to help.</p>
        <Link href="/support" className="mt-3 inline-flex items-center gap-1.5 text-[10px] font-bold text-fuchsia-200 hover:text-white">
          <CircleHelp aria-hidden="true" className="size-3.5" /> Live support
        </Link>
      </div>
      <p className="mt-4 px-2 text-[9px] leading-4 text-white/30">18+ · Play responsibly</p>
    </aside>
  )
}

function LobbyHeader({ currentPlayer, initialIsLive }: { currentPlayer: LobbyPlayer | null; initialIsLive: boolean }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const { data } = useSWR('/api/kick-status', kickStatusFetcher, {
    fallbackData: { isLive: initialIsLive },
    refreshInterval: 15_000,
    revalidateOnFocus: true,
  })
  const isLive = data?.isLive ?? initialIsLive
  const links = [
    { href: '/casino', label: 'Casino' },
    { href: '/casino#games', label: 'Games' },
    { href: '/casino#progression', label: 'Level progress' },
  ]

  return (
    <header className="sticky top-0 z-30 border-b border-fuchsia-300/[0.1] bg-[#0b0611]/90 backdrop-blur-xl">
      <div className="mx-auto flex h-[68px] max-w-[1600px] items-center gap-3 px-3 sm:px-5 md:pl-[216px]">
        <Link href="/casino" className="flex shrink-0 items-center" aria-label="Fizz Casino lobby home">
          <img src="/fizzlogo.png" alt="Fizz Casino" className="h-11 w-28 object-contain drop-shadow-[0_0_18px_rgba(217,70,239,.28)]" />
        </Link>
        <nav aria-label="Main navigation" className="ml-5 hidden items-center gap-1 lg:flex">
          {links.map(({ href, label }, index) => (
            <Link key={href} href={href} className={`rounded-lg px-3 py-2 text-xs font-bold transition ${index === 0 ? 'bg-fuchsia-500/15 text-fuchsia-100' : 'text-white/55 hover:bg-white/[0.05] hover:text-white'}`}>
              {label}
            </Link>
          ))}
        </nav>
        <a
          href="https://kick.com/zinx14"
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Kick stream status: ${isLive ? 'live now' : 'offline'}. Visit kick.com/zinx14`}
          className={`absolute left-[calc(50%+98px)] top-1/2 hidden -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.12em] transition md:flex ${isLive ? 'animate-pulse border-red-400/45 bg-red-500/15 text-red-100 shadow-[0_0_22px_-5px_rgba(248,60,60,.75)] motion-reduce:animate-none' : 'border-white/10 bg-white/[0.04] text-white/55 hover:border-white/20'}`}
        >
          <Radio aria-hidden="true" className={`size-3.5 ${isLive ? 'text-red-300' : 'text-white/45'}`} />
          <span aria-hidden="true" className={`size-1.5 rounded-full ${isLive ? 'bg-red-400' : 'bg-white/35'}`} />
          <span>{isLive ? 'Live now' : 'Kick offline'}</span>
        </a>
        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          {currentPlayer ? (
            <>
              <Link href="/account" aria-label={`Wallet balance: ${formatFizzcoins(currentPlayer.balance ?? '0', currentPlayer.currency ?? 'USD')}`} className="hidden min-h-10 items-center rounded-lg border border-fuchsia-200/15 bg-white/[0.04] px-3 text-xs text-white/90 transition hover:border-fuchsia-200/35 sm:flex">
                <FizzcoinBalance balance={currentPlayer.balance} currency={currentPlayer.currency} />
              </Link>
              <Link href="/account" className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-gradient-to-r from-fuchsia-600 to-purple-600 px-3.5 text-xs font-bold text-white shadow-[0_5px_22px_-10px_rgba(217,70,239,.9)] transition hover:brightness-110 sm:px-4">
                <Coins aria-hidden="true" className="size-4" /><span>Wallet</span>
              </Link>
            </>
          ) : (
            <Link href="/auth/sign-in" className="inline-flex min-h-10 items-center rounded-lg bg-gradient-to-r from-fuchsia-600 to-purple-600 px-4 text-xs font-bold text-white transition hover:brightness-110">Sign in to play</Link>
          )}
          <GlobalLobbyChatButton />
          <Link href={currentPlayer ? '/account' : '/auth/sign-in'} aria-label={currentPlayer ? 'Your account' : 'Sign in'} className="hidden size-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/75 transition hover:bg-white/[0.1] hover:text-white sm:flex">
            <UserRound aria-hidden="true" className="size-4" />
          </Link>
          <button type="button" aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)} className="flex size-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-white lg:hidden">
            {menuOpen ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>
        </div>
      </div>
      {menuOpen && (
        <nav aria-label="Mobile navigation" className="flex flex-col gap-1 border-t border-white/[0.08] bg-[#100817] px-4 py-3 lg:hidden">
          {[...links, { href: '/account', label: 'Wallet and account' }, { href: '/account/responsible-gaming', label: 'Responsible play' }].map(({ href, label }) => (
            <Link key={href} onClick={() => setMenuOpen(false)} href={href} className="rounded-lg px-3 py-2.5 text-sm font-semibold text-white/75 hover:bg-white/[0.06] hover:text-white">{label}</Link>
          ))}
        </nav>
      )}
      {currentPlayer && (
        <Link href="/account" className="flex min-h-9 items-center justify-center border-t border-white/[0.06] px-3 text-xs text-white/80 sm:hidden">
          <FizzcoinBalance balance={currentPlayer.balance} currency={currentPlayer.currency} />
        </Link>
      )}
    </header>
  )
}

const kickStatusFetcher = async (url: string): Promise<{ isLive: boolean }> => {
  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) throw new Error('Kick status could not be refreshed.')
  return response.json()
}

function ProgressCard({ player }: { player: LobbyPlayer | null }) {
  if (!player) {
    return (
      <section id="progression" className="flex flex-col gap-3 rounded-2xl border border-fuchsia-200/[0.12] bg-[#1a1021]/90 p-4 shadow-[0_12px_42px_-30px_rgba(217,70,239,.5)] sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-sm font-bold text-white"><Trophy aria-hidden="true" className="size-4 text-[#b184ff]" /> Levels and XP</p>
          <p className="mt-1 text-xs text-white/45">Sign in to track XP and level progress. Earn 1 XP per 100 Fizzcoins wagered.</p>
        </div>
        <Link href="/auth/sign-in" className="inline-flex min-h-9 items-center justify-center rounded-lg border border-white/10 px-3 text-xs font-semibold text-white/75 transition hover:border-white/20 hover:text-white">Sign in</Link>
      </section>
    )
  }

  const { level, totalXp, xpIntoLevel, xpForNextLevel, progressPercent } = player.progression
  return (
    <section id="progression" aria-label="Your level and XP progress" className="rounded-2xl border border-fuchsia-200/[0.12] bg-[#1a1021]/90 px-4 py-3.5 shadow-[0_12px_42px_-30px_rgba(217,70,239,.5)]">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <div className="flex min-w-[125px] items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-[#9764ef]/20 bg-[#6e3db8]/15 text-[#c7a2ff]"><Crown aria-hidden="true" className="size-[18px]" /></div>
          <div><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">Your level</p><p className="text-sm font-bold text-white">Level {level}</p></div>
        </div>
        <div className="min-w-[180px] flex-1">
          <div className="mb-2 flex items-center justify-between gap-3 text-[11px]">
            <span className="font-semibold text-[#c3a2ff]">{totalXp.toLocaleString()} XP</span>
            <span className="text-white/40">{xpIntoLevel} / {xpForNextLevel} to next level</span>
          </div>
          <div role="progressbar" aria-label="Progress to next level" aria-valuemin={0} aria-valuemax={xpForNextLevel} aria-valuenow={xpIntoLevel} className="h-1.5 overflow-hidden rounded-full bg-white/[0.09]">
            <div className="h-full rounded-full bg-gradient-to-r from-[#7a29f3] to-[#b177ff] transition-[width]" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>
        <p className="text-[10px] text-white/40">1 XP per 100 Fizzcoins wagered</p>
      </div>
    </section>
  )
}

function SpotlightRow({ games, currentPlayer, onSlotArena }: { games: GameRecord[]; currentPlayer: LobbyPlayer | null; onSlotArena: () => void }) {
  const spotlitGames = games.filter((game) => supportedGames.has(game.slug)).slice(0, 2)
  if (!spotlitGames.length) return null

  return (
    <section aria-label="Featured Fizz games" className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {spotlitGames.map((game) => {
        const spotlight = spotlights[game.slug] ?? { eyebrow: game.provider, title: game.name, detail: game.description }
        const artwork = game.coverImageUrl || gameArtwork[game.slug]
        const content = (
          <>
            {artwork ? <img src={artwork} alt="" className="absolute inset-0 -z-20 size-full object-cover transition duration-700 group-hover:scale-[1.045]" /> : <div className="absolute inset-0 -z-20 bg-[radial-gradient(ellipse_at_50%_30%,rgba(217,70,239,.4),rgba(25,11,34,.95)_72%)]" />}
            <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[#12051a]/95 via-[#190822]/65 to-transparent" />
            <div className="absolute inset-0 -z-10 bg-[linear-gradient(0deg,rgba(8,4,12,.65),transparent_55%)]" />
            <span className="absolute right-0 top-0 rounded-bl-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 px-4 py-1.5 text-[9px] font-extrabold uppercase tracking-[0.18em] text-white">Fizz originals</span>
            <div className="flex min-h-[210px] flex-col items-start justify-center px-5 py-7 sm:min-h-[236px] sm:px-8">
              <span className="text-[10px] font-bold uppercase tracking-[0.17em] text-fuchsia-200/80">{spotlight.eyebrow}</span>
              <h2 className="mt-2 max-w-[75%] text-2xl font-black uppercase leading-[0.98] tracking-[-0.045em] text-white [text-shadow:0_3px_18px_rgba(0,0,0,.7)] sm:text-3xl">{spotlight.title}</h2>
              <p className="mt-2 max-w-[68%] text-xs leading-5 text-white/70 sm:text-sm">{spotlight.detail}</p>
              <span className="mt-4 inline-flex min-h-9 items-center gap-2 rounded-lg bg-white px-3.5 text-xs font-extrabold text-[#23102b] transition group-hover:bg-fuchsia-100">
                Play now <ChevronRight aria-hidden="true" className="size-4" />
              </span>
            </div>
          </>
        )
        const cardClass = 'group relative isolate block min-h-[210px] overflow-hidden rounded-2xl border border-fuchsia-200/15 bg-[#1b1020] shadow-[0_16px_50px_-35px_rgba(217,70,239,.55)] transition hover:-translate-y-0.5 hover:border-fuchsia-200/35 sm:min-h-[236px]'
        if (game.slug === 'slot-arena') {
          return <button key={game.id} type="button" onClick={onSlotArena} aria-label={`Open ${game.name} game`} className={`${cardClass} w-full text-left`}>{content}</button>
        }
        return <Link key={game.id} href={currentPlayer ? `/games/${game.slug}` : `/auth/sign-in?returnTo=/games/${game.slug}`} aria-label={`${currentPlayer ? 'Open' : 'Sign in to play'} ${game.name}`} className={cardClass}>{content}</Link>
      })}
    </section>
  )
}

function gameMatchesFilter(game: GameRecord, filter: string) {
  const category = game.category.toLowerCase()
  if (filter === 'all') return true
  if (filter === 'originals') return game.provider.toLowerCase().includes('fizz originals')
  if (filter === 'slots') return category === 'slots'
  if (filter === 'live') return category === 'live casino' || category === 'live_casino'
  if (filter === 'tables') return category === 'blackjack' || category === 'roulette' || category === 'table games'
  return false
}

function GameCard({ game, currentPlayer, canPlay, onSlotArena }: { game: GameRecord; currentPlayer: LobbyPlayer | null; canPlay: boolean; onSlotArena?: () => void }) {
  const isSupported = supportedGames.has(game.slug)
  const card = (
    <article className={`group relative flex-none snap-start overflow-hidden rounded-xl border bg-[#170e1d] transition duration-300 ${canPlay ? 'border-fuchsia-200/15 hover:-translate-y-1 hover:border-fuchsia-200/50 hover:shadow-[0_16px_34px_-18px_rgba(217,70,239,.5)]' : 'border-white/[0.08] hover:border-white/[0.16]'}`}>
      <div className="relative aspect-[0.76/1] overflow-hidden bg-[#21152a]">
        {game.coverImageUrl || gameArtwork[game.slug] ? (
          <img src={game.slug === 'crash' ? gameArtwork.crash : game.coverImageUrl || gameArtwork[game.slug]} alt="" loading="lazy" className="size-full object-cover transition duration-500 group-hover:scale-[1.045]" />
        ) : (
          <div className="flex size-full items-center justify-center bg-[radial-gradient(ellipse_at_50%_35%,#50305e,#17101c_75%)]"><Gamepad2 aria-hidden="true" className="size-9 text-white/25" /></div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-black/10" />
        <span className="absolute left-0 right-0 top-0 flex h-5 items-center justify-center bg-gradient-to-r from-fuchsia-700 to-violet-600 px-1 text-[8px] font-extrabold uppercase tracking-[0.16em] text-white">{game.provider}</span>
        <div className="absolute inset-x-2 bottom-3">
          <h3 className="truncate text-lg font-black uppercase leading-none tracking-[-0.045em] text-white [text-shadow:0_2px_8px_rgba(0,0,0,.7)]">{game.name}</h3>
          <p className="mt-1 truncate text-[9px] font-semibold text-white/65">{game.category}</p>
        </div>
        {canPlay && <span className="absolute right-2 top-7 rounded-full border border-emerald-200/25 bg-black/45 px-2 py-1 text-[8px] font-bold text-emerald-100">READY</span>}
      </div>
      <div className="flex min-h-[40px] items-center justify-between gap-2 px-2.5">
        <span className={`truncate text-[10px] font-semibold ${canPlay ? 'text-emerald-200' : currentPlayer && isSupported ? 'text-fuchsia-100/70' : 'text-white/50'}`}>
          {canPlay ? 'Ready to play' : currentPlayer && isSupported ? 'Check balance' : isSupported ? 'Sign in to play' : 'Unavailable'}
        </span>
        <ChevronRight aria-hidden="true" className="size-3.5 shrink-0 text-white/35 transition group-hover:translate-x-0.5 group-hover:text-fuchsia-100" />
      </div>
    </article>
  )

  if (game.slug === 'slot-arena') {
    return (
      <div className="relative">
        <button
          onClick={(e) => {
            e.preventDefault()
            onSlotArena?.()
          }}
          aria-label={`Open ${game.name} game`}
          className="block"
        >
          {card}
        </button>
      </div>
    )
  }
  if (currentPlayer && isSupported) return <Link href={`/games/${game.slug}`} aria-label={`Open ${game.name} game`}>{card}</Link>
  if (!currentPlayer && isSupported) return <Link href={`/auth/sign-in?returnTo=/games/${game.slug}`} aria-label={`Sign in to play ${game.name}`}>{card}</Link>
  return card
}

function GameShelf({ games, dataError, currentPlayer, onSlotArena }: { games: GameRecord[]; dataError: boolean; currentPlayer: LobbyPlayer | null; onSlotArena: () => void }) {
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const rail = useRef<HTMLDivElement>(null)
  const searchInput = useRef<HTMLInputElement>(null)
  const canPlay = (game: GameRecord) => Boolean(currentPlayer && supportedGames.has(game.slug) && Number(currentPlayer.balance ?? 0) >= 1)
  const supportedCatalogGames = useMemo(() => games.filter((game) => supportedGames.has(game.slug)), [games])
  const visibleGames = useMemo(() => supportedCatalogGames.filter((game) => {
    const matches = gameMatchesFilter(game, filter)
    const query = search.trim().toLowerCase()
    return matches && (!query || `${game.name} ${game.provider} ${game.category}`.toLowerCase().includes(query))
  }), [filter, search, supportedCatalogGames])
  const tabs = [
    { id: 'all', label: 'Lobby', icon: Home },
    ...(supportedCatalogGames.some((game) => game.provider.toLowerCase().includes('fizz originals')) ? [{ id: 'originals', label: 'Originals', icon: Sparkles }] : []),
    ...(supportedCatalogGames.some((game) => game.category.toLowerCase() === 'slots') ? [{ id: 'slots', label: 'Slots', icon: Coins }] : []),
    ...(supportedCatalogGames.some((game) => ['live casino', 'live_casino'].includes(game.category.toLowerCase())) ? [{ id: 'live', label: 'Live Casino', icon: Clock3 }] : []),
    ...(supportedCatalogGames.some((game) => ['blackjack', 'roulette', 'table games'].includes(game.category.toLowerCase()) || game.slug === 'blackjack') ? [{ id: 'tables', label: 'Table Games', icon: Star }] : []),
  ]

  useEffect(() => {
    function handleSearchShortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        searchInput.current?.focus()
      }
    }
    window.addEventListener('keydown', handleSearchShortcut)
    return () => window.removeEventListener('keydown', handleSearchShortcut)
  }, [])

  function scrollShelf(direction: -1 | 1) {
    rail.current?.scrollBy({ left: direction * 480, behavior: 'smooth' })
  }

  function resetShelf() {
    setFilter('all')
    setSearch('')
    rail.current?.scrollTo({ left: 0, behavior: 'smooth' })
  }

  return (
    <section id="games" aria-labelledby="game-shelf-title" className="scroll-mt-24">
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(250px,0.55fr)]">
        <nav aria-label="Game categories" className="flex min-h-[46px] items-center gap-1 overflow-x-auto rounded-xl border border-white/[0.07] bg-white/[0.035] p-1.5">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" onClick={() => setFilter(id)} aria-pressed={filter === id} className={`inline-flex min-h-[34px] shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-semibold transition sm:px-3 ${filter === id ? 'bg-gradient-to-r from-fuchsia-600/90 to-violet-600/90 text-white shadow-[0_6px_18px_-10px_rgba(217,70,239,.8)]' : 'text-white/55 hover:bg-white/[0.05] hover:text-white/85'}`}>
              <Icon aria-hidden="true" className="size-3.5" />{label}
            </button>
          ))}
        </nav>
        <label className="flex min-h-[46px] items-center gap-2.5 rounded-xl border border-fuchsia-200/[0.13] bg-[#180e20]/90 px-3.5 text-white/55 transition focus-within:border-fuchsia-200/40 focus-within:ring-1 focus-within:ring-fuchsia-300/30">
          <Search aria-hidden="true" className="size-4 shrink-0" />
          <span className="sr-only">Search games</span>
          <input ref={searchInput} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search Fizz games..." className="min-w-0 flex-1 bg-transparent text-xs text-white outline-none placeholder:text-white/40" />
          <kbd className="hidden rounded-md border border-white/[0.08] bg-black/20 px-2 py-1 text-[9px] font-semibold text-white/50 sm:inline">Ctrl K</kbd>
        </label>
      </div>
      <div className="my-4">
        <ProgressCard player={currentPlayer} />
      </div>
      <div className="mb-4 mt-7 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="game-shelf-title" className="flex items-center gap-2.5 text-xl font-extrabold tracking-[-0.035em] text-white sm:text-2xl"><Gamepad2 aria-hidden="true" className="size-[22px] text-fuchsia-300" /> Play Fizz originals</h2>
          <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.12em] text-white/40">Configured games · {supportedCatalogGames.length} available</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={resetShelf} className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2.5 text-[10px] font-semibold text-white/75 transition hover:border-fuchsia-200/30 hover:bg-white/[0.08]">View all</button>
          <button type="button" onClick={() => scrollShelf(-1)} aria-label="Previous games" className="flex size-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/55 transition hover:border-fuchsia-200/30 hover:bg-white/[0.08] hover:text-white"><ChevronLeft aria-hidden="true" className="size-4" /></button>
          <button type="button" onClick={() => scrollShelf(1)} aria-label="Next games" className="flex size-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/80 transition hover:border-fuchsia-200/30 hover:bg-white/[0.08] hover:text-white"><ChevronRight aria-hidden="true" className="size-4" /></button>
        </div>
      </div>
      {dataError ? (
        <div role="alert" className="mt-5 flex min-h-32 flex-col items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.02] p-5 text-center">
          <CircleHelp aria-hidden="true" className="size-5 text-white/40" /><p className="mt-3 text-sm font-semibold text-white/80">The live game catalog is unavailable.</p><p className="mt-1 text-xs text-white/40">Try again later. No games have been substituted.</p>
        </div>
      ) : visibleGames.length ? (
        <div className="relative">
          <div ref={rail} className="flex snap-x gap-3 overflow-x-auto pb-4 [scrollbar-width:thin] [scrollbar-color:rgba(244,114,182,.35)_transparent]">
            {visibleGames.map((game) => <div key={game.id} className="w-[132px] shrink-0 snap-start sm:w-[148px] xl:w-[160px]"><GameCard game={game} currentPlayer={currentPlayer} canPlay={canPlay(game)} onSlotArena={onSlotArena} /></div>)}
          </div>
          <p className="mt-1 text-[10px] text-white/35">{visibleGames.length} {visibleGames.length === 1 ? 'game' : 'games'} shown from the configured catalog</p>
        </div>
      ) : (
        <div className="mt-5 rounded-xl border border-dashed border-white/[0.12] bg-white/[0.02] px-5 py-8 text-center">
          <Gamepad2 aria-hidden="true" className="mx-auto size-5 text-white/35" />
          <p className="mt-3 text-sm font-semibold text-white/75">{search ? 'No games match that search.' : 'No games in this category yet.'}</p>
          <p className="mt-1 text-xs text-white/40">Only games enabled in the live catalog appear here.</p>
        </div>
      )}
    </section>
  )
}

export function CasinoLobby({ games, dataError, currentPlayer, kickIsLive }: Props) {
  const [slotArenaOpen, setSlotArenaOpen] = useState(false)
  const [slotArenaError, setSlotArenaError] = useState(false)
  return (
    <div className="min-h-screen bg-[#0b0611] text-white">
      <LobbyRail />
      <LobbyHeader currentPlayer={currentPlayer} initialIsLive={kickIsLive} />
      <main
        className="min-h-[calc(100vh-68px)] md:ml-[196px]"
        style={{
          backgroundImage:
            'radial-gradient(ellipse at 18% 0%, rgba(147, 51, 234, 0.16), transparent 38%), radial-gradient(ellipse at 92% 18%, rgba(219, 39, 119, 0.12), transparent 36%), linear-gradient(180deg, #100817 0%, #0b0611 54%, #09060d 100%)',
        }}
      >
        <div className="mx-auto flex max-w-[1600px] flex-col gap-5 px-3 pb-20 pt-5 sm:gap-6 sm:px-5 sm:pt-6">
          <SpotlightRow games={games} currentPlayer={currentPlayer} onSlotArena={() => setSlotArenaOpen(true)} />
          <GameShelf games={games} dataError={dataError} currentPlayer={currentPlayer} onSlotArena={() => setSlotArenaOpen(true)} />
          <AffiliateCard />
          <section className="flex flex-col gap-3 border-t border-fuchsia-200/[0.1] pt-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-center gap-2 text-[10px] leading-5 text-white/45"><BadgeCheck aria-hidden="true" className="size-3.5 shrink-0 text-emerald-200/65" /> Game balances are checked server-side. 1 USD = 400 Fizzcoins.</p>
            <Link href="/account/responsible-gaming" className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-white/50 transition hover:text-white/85"><ShieldCheck aria-hidden="true" className="size-3.5" /> Responsible play</Link>
          </section>
          <p className="flex items-start gap-2 text-[10px] leading-5 text-white/35"><Clock3 aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" /> 18+ · Only play where permitted. Fizzcoins are displayed at 400 coins per USD; game rounds remain subject to the wallet&apos;s available balance and published rules.</p>
        </div>
      </main>

      {slotArenaOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Slot Arena">
          <div className="relative mx-4 w-full max-w-[1100px] h-[90vh] overflow-hidden rounded-xl border border-white/10 shadow-2xl z-20">
            <button
              type="button"
              onClick={() => {
                setSlotArenaOpen(false)
                setSlotArenaError(false)
              }}
              aria-label="Close Slot Arena"
              className="absolute top-2 left-2 z-10 size-8 rounded-full bg-white/10 p-1.5 text-white hover:bg-white/20 transition"
            >
              <X aria-hidden="true" className="size-5" />
            </button>
            {slotArenaError ? (
              <div className="size-full flex flex-col items-center justify-center p-8 text-center bg-[#14151a]">
                <p className="mb-2 text-red-400 font-semibold">Unable to load Slot Arena</p>
                <p className="text-xs text-white/45 max-w-xs">The game could not be embedded. This usually means the Slot Arena site blocks iframe embedding.</p>
              </div>
            ) : (
              <iframe
                src="https://fizzslotarena.lovable.app/"
                title="Slot Arena"
                className="size-full block"
                allowFullScreen
                loading="lazy"
                onError={() => setSlotArenaError(true)}
              />
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              setSlotArenaOpen(false)
              setSlotArenaError(false)
            }}
            aria-label="Close backdrop"
            className="absolute inset-0 z-10"
          />
        </div>
      )}
    </div>
  )
}
