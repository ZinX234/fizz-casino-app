'use client'

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
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
  MessageCircle,
  Pin,
  PinOff,
  Search,
  Send,
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
import { LobbyEconomy } from '@/components/lobby-economy'

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
}

type LobbyMessage = {
  id: string
  senderId: string
  senderName: string
  body: string
  createdAt: string
}

const supportedGames = new Set(['crash', 'mines', 'towers', 'vault-heist'])
const gameArtwork: Record<string, string> = {
  crash: '/games/fizz-crash-airplane.png',
  mines: '/games/fizz-mines.png',
  towers: '/games/fizz-towers.png',
  'vault-heist': '/games/vault-heist-bg.png',
}
const spotlights: Record<string, { eyebrow: string; title: string; detail: string }> = {
  crash: { eyebrow: 'Fizz originals', title: 'Ride the multiplier', detail: 'Cash out before the round ends.' },
  mines: { eyebrow: 'Fizz originals', title: 'Find the safe tiles', detail: 'Reveal gems and choose when to cash out.' },
  towers: { eyebrow: 'Fizz originals', title: 'Climb one row at a time', detail: 'Pick a safe column and keep climbing.' },
  'vault-heist': { eyebrow: 'Fizz original · flagship', title: 'Vault Heist', detail: 'Crack the doors. Beat the alarm. Choose your escape.' },
}

const chatFetcher = async (url: string): Promise<LobbyMessage[]> => {
  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) throw new Error('Lobby chat is unavailable right now.')
  const payload = await response.json()
  return payload.messages
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
    { href: '/casino', label: 'Lobby', icon: Home },
    { href: '/casino#games', label: 'Games', icon: Gamepad2 },
    { href: '/casino#progression', label: 'Levels and XP', icon: Trophy },
    { href: '/account', label: 'Wallet and account', icon: Coins },
    { href: '/account/responsible-gaming', label: 'Responsible gaming', icon: ShieldCheck },
  ]

  return (
    <aside aria-label="Casino navigation" className="fixed inset-y-0 left-0 z-40 hidden w-[60px] flex-col items-center border-r border-white/[0.08] bg-[#101116] py-3 md:flex">
      <Link href="/casino" aria-label="Fizz Casino lobby" className="mb-4 flex size-12 items-center justify-center overflow-hidden rounded-xl bg-[#101116]"><img src="/fizz-casino-logo.png" alt="Fizz Casino" className="size-full object-contain" /></Link>
      <nav className="flex w-full flex-col items-center gap-2 border-y border-white/[0.06] py-3">
        {links.map(({ href, label, icon: Icon }, index) => (
          <Link key={href} href={href} aria-label={label} title={label} className={`flex size-10 items-center justify-center rounded-xl transition ${index === 0 ? 'bg-[#6c20f4] text-white shadow-[0_8px_24px_-12px_rgba(124,58,237,.9)]' : 'text-white/55 hover:bg-white/[0.06] hover:text-white'}`}>
            <Icon aria-hidden="true" className="size-[18px]" />
          </Link>
        ))}
      </nav>
      <Link href="/support" aria-label="Help and support" title="Help and support" className="mt-auto flex size-10 items-center justify-center rounded-xl text-white/45 hover:bg-white/[0.06] hover:text-white">
        <CircleHelp aria-hidden="true" className="size-[18px]" />
      </Link>
    </aside>
  )
}

function LobbyHeader({ currentPlayer, onOpenChat, chatPinned }: { currentPlayer: LobbyPlayer | null; onOpenChat: () => void; chatPinned: boolean }) {
  return (
  <header className={`sticky top-0 z-30 border-b border-white/[0.08] bg-[#090a0d]/95 backdrop-blur-xl md:ml-[60px] ${chatPinned ? 'md:mr-[320px]' : ''}`}>
  <div className="mx-auto flex h-[72px] max-w-[1280px] items-center justify-between gap-3 px-3 sm:px-5">
  <Link href="/casino" className="flex shrink-0 items-center gap-2.5" aria-label="Fizz Casino lobby home">
  <img src="/fizz-casino-logo.png" alt="Fizz Casino" className="size-16 object-contain" />
        </Link>
        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          {currentPlayer ? (
            <>
              <Link href="/account" aria-label={`Wallet balance: ${formatFizzcoins(currentPlayer.balance ?? '0', currentPlayer.currency ?? 'USD')}`} className="hidden min-h-10 items-center rounded-lg border border-white/[0.12] bg-[#111217] px-3 text-xs text-white/90 transition hover:border-white/20 sm:flex">
                <FizzcoinBalance balance={currentPlayer.balance} currency={currentPlayer.currency} />
              </Link>
              <Link href="/account" className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#6b19f5] px-3.5 text-xs font-bold text-white transition hover:bg-[#792fff] sm:px-4">
                <Coins aria-hidden="true" className="size-4" /><span>Wallet</span>
              </Link>
            </>
          ) : (
            <Link href="/auth/sign-in" className="inline-flex min-h-10 items-center rounded-lg bg-[#6b19f5] px-4 text-xs font-bold text-white transition hover:bg-[#792fff]">Sign in to play</Link>
          )}
          <Link href="#progression" aria-label="View levels and XP" className="hidden size-9 items-center justify-center rounded-full bg-[#22232a] text-white/75 transition hover:text-white sm:flex">
            <Trophy aria-hidden="true" className="size-4" />
          </Link>
          <button type="button" onClick={onOpenChat} aria-label="Open lobby chat" className="flex size-9 items-center justify-center rounded-full bg-[#22232a] text-white/75 transition hover:bg-[#30313a] hover:text-white">
            <MessageCircle aria-hidden="true" className="size-4" />
          </button>
          <Link href={currentPlayer ? '/account' : '/auth/sign-in'} aria-label={currentPlayer ? 'Your account' : 'Sign in'} className="flex size-9 items-center justify-center rounded-full bg-[#22232a] text-white/75 transition hover:bg-[#30313a] hover:text-white">
            <UserRound aria-hidden="true" className="size-4" />
          </Link>
        </div>
      </div>
      {currentPlayer && (
        <Link href="/account" className="flex min-h-10 items-center justify-center border-t border-white/[0.06] px-3 text-xs text-white/80 sm:hidden">
          <FizzcoinBalance balance={currentPlayer.balance} currency={currentPlayer.currency} />
        </Link>
      )}
    </header>
  )
}

function ProgressCard({ player }: { player: LobbyPlayer | null }) {
  if (!player) {
    return (
      <section id="progression" className="flex flex-col gap-3 rounded-xl border border-white/[0.08] bg-[#15161b] p-4 sm:flex-row sm:items-center sm:justify-between">
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
    <section id="progression" aria-label="Your level and XP progress" className="rounded-xl border border-white/[0.08] bg-[#15161b] px-4 py-3.5">
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

function SpotlightRow({ games, currentPlayer }: { games: GameRecord[]; currentPlayer: LobbyPlayer | null }) {
  const spotlitGames = games.filter((game) => supportedGames.has(game.slug)).slice(0, 3)
  if (!spotlitGames.length) return null

  return (
    <section aria-label="Fizz originals spotlight" className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
      {spotlitGames.map((game) => {
        const spotlight = spotlights[game.slug] ?? { eyebrow: game.provider, title: game.name, detail: game.description }
        return (
          <Link key={game.id} href={currentPlayer ? `/games/${game.slug}` : `/auth/sign-in?returnTo=/games/${game.slug}`} aria-label={`${currentPlayer ? 'Open' : 'Sign in to play'} ${game.name}`} className="group relative isolate flex min-h-[184px] overflow-hidden rounded-lg bg-[#16171c] sm:min-h-[218px]">
            <img src={gameArtwork[game.slug]} alt="" className="absolute inset-0 -z-20 size-full object-cover transition duration-500 group-hover:scale-[1.04]" />
            <div className="absolute inset-0 -z-10 bg-gradient-to-r from-black/85 via-black/40 to-black/5" />
            {game.slug === 'crash' && <span className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full border border-red-300/20 bg-[#120c11]/85 px-2.5 py-1.5 text-[8px] font-extrabold uppercase tracking-[0.12em] text-white"><span aria-hidden="true" className="size-1.5 rounded-full bg-red-400 shadow-[0_0_8px_rgba(248,113,113,.85)]" />Live on Kick</span>}
            <div className="flex max-w-[76%] flex-col justify-center px-4 py-4 sm:px-5">
              <span className="mb-2 w-fit rounded-sm bg-white/90 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.08em] text-[#25232b]">{spotlight.eyebrow}</span>
              <h2 className="text-[18px] font-black uppercase leading-[1.04] tracking-[-0.03em] text-white sm:text-[20px]">{spotlight.title}</h2>
              <p className="mt-2 max-w-[220px] text-[11px] leading-4 text-white/75">{spotlight.detail}</p>
            </div>
            <span className="absolute bottom-3 right-3 inline-flex size-8 items-center justify-center rounded-full bg-black/35 text-white/90 transition group-hover:bg-[#6e24f4]"><ChevronRight aria-hidden="true" className="size-4" /></span>
          </Link>
        )
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

function GameCard({ game, currentPlayer, canPlay }: { game: GameRecord; currentPlayer: LobbyPlayer | null; canPlay: boolean }) {
  const isSupported = supportedGames.has(game.slug)
  const card = (
    <article className={`group relative flex-none snap-start overflow-hidden rounded-[9px] border bg-[#14151a] transition duration-200 ${canPlay ? 'border-white/[0.11] hover:-translate-y-0.5 hover:border-[#ae77ff]/70 hover:shadow-[0_12px_30px_-18px_rgba(143,75,255,.6)]' : 'border-white/[0.08]'}`}>
      <div className="relative aspect-[0.76/1] overflow-hidden bg-[#1d1e24]">
        {game.coverImageUrl || gameArtwork[game.slug] ? (
          <img src={game.slug === 'crash' ? gameArtwork.crash : game.coverImageUrl || gameArtwork[game.slug]} alt="" loading="lazy" className="size-full object-cover transition duration-500 group-hover:scale-[1.045]" />
        ) : (
          <div className="flex size-full items-center justify-center bg-[radial-gradient(ellipse_at_50%_35%,#383343,#17171c_75%)]"><Gamepad2 aria-hidden="true" className="size-9 text-white/25" /></div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/10" />
        <span className="absolute left-0 right-0 top-0 flex h-[19px] items-center justify-center bg-[#7217e9]/95 px-1 text-[8px] font-bold uppercase tracking-[0.16em] text-white">{game.provider}</span>
        <div className="absolute inset-x-2 bottom-2.5">
          <h3 className="truncate text-[20px] font-black uppercase leading-none tracking-[-0.05em] text-white [text-shadow:0_2px_8px_rgba(0,0,0,.7)]">{game.name}</h3>
          <p className="mt-1 truncate text-[9px] font-medium text-white/65">{game.category}</p>
        </div>
        {game.slug === 'crash' && <span className="absolute right-2 top-6 inline-flex items-center gap-1 rounded-full border border-red-300/20 bg-[#120c11]/85 px-2 py-1 text-[7px] font-extrabold uppercase tracking-[0.08em] text-white"><span aria-hidden="true" className="size-1 rounded-full bg-red-400" />Live on Kick</span>}
        {canPlay && <span className="absolute right-2 top-12 rounded-full border border-white/20 bg-black/35 px-2 py-1 text-[8px] font-bold text-white/85">PLAY</span>}
      </div>
      <div className="flex min-h-[43px] items-center justify-between gap-2 px-2.5">
        <span className="truncate text-[10px] font-semibold text-white/70">{game.name}</span>
        <span className={`shrink-0 text-[9px] font-semibold ${canPlay ? 'text-emerald-300' : currentPlayer && isSupported ? 'text-amber-200/80' : 'text-white/35'}`}>
          {canPlay ? '400+ coins' : currentPlayer && isSupported ? 'Need 400' : isSupported ? 'Sign in' : 'Unavailable'}
        </span>
      </div>
    </article>
  )

  if (currentPlayer && isSupported) return <Link href={`/games/${game.slug}`} aria-label={`Open ${game.name} game`}>{card}</Link>
  if (!currentPlayer && isSupported) return <Link href={`/auth/sign-in?returnTo=/games/${game.slug}`} aria-label={`Sign in to play ${game.name}`}>{card}</Link>
  return card
}

function GameShelf({ games, dataError, currentPlayer }: { games: GameRecord[]; dataError: boolean; currentPlayer: LobbyPlayer | null }) {
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const rail = useRef<HTMLDivElement>(null)
  const searchInput = useRef<HTMLInputElement>(null)
  const canPlay = (game: GameRecord) => Boolean(currentPlayer && supportedGames.has(game.slug) && Number(currentPlayer.balance ?? 0) >= 1)
  const visibleGames = useMemo(() => games.filter((game) => {
    const matches = gameMatchesFilter(game, filter)
    const query = search.trim().toLowerCase()
    return matches && (!query || `${game.name} ${game.provider} ${game.category}`.toLowerCase().includes(query))
  }), [filter, games, search])
  const tabs = [
    { id: 'all', label: 'Lobby', icon: Home },
    { id: 'originals', label: 'Originals', icon: Sparkles },
    { id: 'slots', label: 'Slots', icon: Coins },
    { id: 'live', label: 'Live Casino', icon: Clock3 },
    { id: 'tables', label: 'Table Games', icon: Star },
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
    <section id="games" aria-labelledby="game-shelf-title" className="scroll-mt-20">
      <div className="grid gap-2.5 lg:grid-cols-[minmax(0,1.2fr)_minmax(230px,0.95fr)]">
        <nav aria-label="Game categories" className="flex min-h-[46px] items-center gap-1 overflow-x-auto rounded-md bg-[#1f2026] p-1.5">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" onClick={() => setFilter(id)} aria-pressed={filter === id} className={`inline-flex min-h-[34px] shrink-0 items-center gap-1.5 rounded px-2.5 text-[11px] font-semibold transition sm:px-3 ${filter === id ? 'bg-[#34353d] text-white' : 'text-white/55 hover:bg-white/[0.04] hover:text-white/85'}`}>
              <Icon aria-hidden="true" className="size-3.5" />{label}
            </button>
          ))}
        </nav>
        <label className="flex min-h-[46px] items-center gap-2.5 rounded-md bg-[#1f2026] px-3.5 text-white/50 focus-within:ring-1 focus-within:ring-[#a66aff]/60">
          <Search aria-hidden="true" className="size-4 shrink-0" />
          <span className="sr-only">Search games</span>
          <input ref={searchInput} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search games" className="min-w-0 flex-1 bg-transparent text-xs text-white outline-none placeholder:text-white/40" />
          <kbd className="hidden rounded bg-[#2b2c33] px-2 py-1 text-[9px] font-semibold text-white/55 sm:inline">Ctrl K</kbd>
        </label>
      </div>
      <div className="mb-4 mt-7 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="game-shelf-title" className="flex items-center gap-2.5 text-[20px] font-extrabold tracking-[-0.035em] text-white sm:text-[22px]"><Gamepad2 aria-hidden="true" className="size-[22px] text-[#a66aff]" /> Fizz Originals</h2>
          <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.12em] text-white/35">Live game catalog · {games.length} available</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={resetShelf} className="rounded-full bg-[#22232a] px-4 py-2.5 text-[10px] font-semibold text-white/85 transition hover:bg-[#30313a]">View all</button>
          <button type="button" onClick={() => scrollShelf(-1)} aria-label="Previous games" className="flex size-9 items-center justify-center rounded-full bg-[#22232a] text-white/55 transition hover:bg-[#30313a] hover:text-white"><ChevronLeft aria-hidden="true" className="size-4" /></button>
          <button type="button" onClick={() => scrollShelf(1)} aria-label="Next games" className="flex size-9 items-center justify-center rounded-full bg-[#22232a] text-white/80 transition hover:bg-[#30313a] hover:text-white"><ChevronRight aria-hidden="true" className="size-4" /></button>
        </div>
      </div>
      {dataError ? (
        <div role="alert" className="mt-5 flex min-h-32 flex-col items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.02] p-5 text-center">
          <CircleHelp aria-hidden="true" className="size-5 text-white/40" /><p className="mt-3 text-sm font-semibold text-white/80">The live game catalog is unavailable.</p><p className="mt-1 text-xs text-white/40">Try again later. No games have been substituted.</p>
        </div>
      ) : visibleGames.length ? (
        <div className="relative">
          <div ref={rail} className="flex snap-x gap-3 overflow-x-auto pb-3 [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,.18)_transparent]">
            {visibleGames.map((game) => <div key={game.id} className="w-[145px] shrink-0 snap-start sm:w-[155px] xl:w-[168px]"><GameCard game={game} currentPlayer={currentPlayer} canPlay={canPlay(game)} /></div>)}
          </div>
          <p className="mt-1 text-[10px] text-white/35">{visibleGames.length} {visibleGames.length === 1 ? 'game' : 'games'}</p>
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

function LobbyChat({ currentPlayer, open, pinned, onClose, onTogglePin }: { currentPlayer: LobbyPlayer | null; open: boolean; pinned: boolean; onClose: () => void; onTogglePin: () => void }) {
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState('')
  const { data: messages, error, isLoading, mutate } = useSWR(open ? '/api/chat' : null, chatFetcher, { refreshInterval: 5000, revalidateOnFocus: true })

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const message = draft.trim()
    if (!message || !currentPlayer || sending) return
    setSending(true)
    setSendError('')
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Your message could not be sent.')
      setDraft('')
      await mutate((previous = []) => [...previous, payload.message].slice(-60), { revalidate: false })
    } catch (issue) {
      setSendError(issue instanceof Error ? issue.message : 'Your message could not be sent.')
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      {open && !pinned && <button type="button" aria-label="Close lobby chat" onClick={onClose} className="fixed inset-0 z-40 cursor-default bg-black/35 md:bg-transparent" />}
      <section aria-label="Fizz lobby chat" aria-hidden={!open} inert={!open} className={`fixed bottom-20 right-3 z-50 flex h-[min(620px,calc(100dvh-7rem))] w-[min(350px,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-2xl border border-white/[0.12] bg-[#121318] shadow-[0_24px_80px_-28px_rgba(0,0,0,.9)] transition duration-200 md:bottom-5 md:right-5 ${pinned ? 'md:inset-y-[72px] md:right-0 md:bottom-0 md:h-auto md:w-[320px] md:rounded-none md:border-y-0 md:border-r-0' : ''} ${open ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-3 opacity-0'}`}>
        <header className="flex items-center justify-between border-b border-white/[0.08] px-4 py-3.5">
          <div><h2 className="text-sm font-bold text-white">Lobby chat</h2><p className="mt-1 text-[10px] text-white/40">Messages refresh automatically · be respectful</p></div>
          <div className="flex items-center gap-1">
            <button type="button" onClick={onTogglePin} aria-label={pinned ? 'Unpin lobby chat' : 'Pin lobby chat to side'} aria-pressed={pinned} title={pinned ? 'Unpin chat' : 'Pin chat to side'} className="flex size-8 items-center justify-center rounded-full text-white/55 transition hover:bg-white/[0.06] hover:text-white">{pinned ? <PinOff aria-hidden="true" className="size-4" /> : <Pin aria-hidden="true" className="size-4" />}</button>
            <button type="button" onClick={onClose} aria-label="Close lobby chat" className="flex size-8 items-center justify-center rounded-full text-white/55 transition hover:bg-white/[0.06] hover:text-white"><X aria-hidden="true" className="size-4" /></button>
          </div>
        </header>
        <LobbyEconomy signedIn={Boolean(currentPlayer)} />
        <div role="log" aria-label="Lobby chat messages" aria-live="polite" className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
          {isLoading && <p role="status" className="py-4 text-center text-xs text-white/45">Loading lobby chat…</p>}
          {error && <p role="alert" className="rounded-lg border border-rose-200/10 bg-rose-100/[0.04] p-3 text-xs text-rose-100/75">Lobby chat could not be loaded. Try again in a moment.</p>}
          {!isLoading && !error && messages?.length === 0 && <p className="m-auto max-w-[230px] text-center text-xs leading-5 text-white/40">No messages yet. Start the conversation.</p>}
          {messages?.map((message) => (
            <article key={message.id} className="rounded-xl border border-white/[0.055] bg-white/[0.025] px-3 py-2.5">
              <div className="flex items-center justify-between gap-3"><span className="truncate text-[10px] font-bold text-[#c49dff]">{message.senderName}</span><time dateTime={message.createdAt} className="shrink-0 text-[9px] text-white/35">{new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit' }).format(new Date(message.createdAt))}</time></div>
              <p className="mt-1.5 break-words whitespace-pre-wrap text-xs leading-5 text-white/80">{message.body}</p>
            </article>
          ))}
        </div>
        <div className="border-t border-white/[0.08] p-3.5">
          {currentPlayer ? (
            <form onSubmit={sendMessage} className="flex items-center gap-2">
              <label className="sr-only" htmlFor="lobby-chat-message">Write a message</label>
              <input id="lobby-chat-message" value={draft} maxLength={240} onChange={(event) => setDraft(event.target.value)} placeholder="Write a message…" className="h-10 min-w-0 flex-1 rounded-lg border border-white/[0.09] bg-[#0b0c10] px-3 text-xs text-white outline-none placeholder:text-white/35 focus:border-[#8a52dd]/70" />
              <button type="submit" aria-label="Send message" disabled={!draft.trim() || sending} className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[#6b19f5] text-white transition hover:bg-[#792fff] disabled:cursor-not-allowed disabled:opacity-40"><Send aria-hidden="true" className="size-4" /></button>
            </form>
          ) : (
            <Link href="/auth/sign-in" className="flex min-h-10 items-center justify-center rounded-lg bg-[#6b19f5] text-xs font-bold text-white transition hover:bg-[#792fff]">Sign in to join the chat</Link>
          )}
          {sendError && <p role="alert" className="mt-2 text-[10px] text-rose-200/80">{sendError}</p>}
          {currentPlayer && <p className="mt-2 text-[9px] text-white/30">240 characters max. Your email is never shown.</p>}
        </div>
      </section>
    </>
  )
}

export function CasinoLobby({ games, dataError, currentPlayer }: Props) {
  const [chatOpen, setChatOpen] = useState(false)
  const [chatPinned, setChatPinned] = useState(false)
  const chatDocked = chatOpen && chatPinned

  return (
    <div className="min-h-screen bg-[#090a0d] text-white">
      <LobbyRail />
      <LobbyHeader currentPlayer={currentPlayer} onOpenChat={() => setChatOpen(true)} chatPinned={chatDocked} />
      <main
        className={`md:ml-[60px] ${chatDocked ? 'md:mr-[320px]' : ''}`}
        style={{
          backgroundImage:
            'linear-gradient(rgba(9, 10, 13, 0.16), rgba(9, 10, 13, 0.24)), url("https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-fXGlmWR4xl0HrAiCfi882vMVrnx8Qx.png")',
          backgroundPosition: 'center top',
          backgroundSize: 'cover',
          backgroundAttachment: 'fixed',
        }}
      >
        <div className="mx-auto flex max-w-[1280px] flex-col gap-4 px-3 pb-24 pt-5 sm:gap-5 sm:px-5 sm:pt-6">
          <SpotlightRow games={games} currentPlayer={currentPlayer} />
          <GameShelf games={games} dataError={dataError} currentPlayer={currentPlayer} />
          <ProgressCard player={currentPlayer} />
          <AffiliateCard />
          <section className="flex flex-col gap-3 border-t border-white/[0.07] pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-center gap-2 text-[10px] leading-5 text-white/45"><BadgeCheck aria-hidden="true" className="size-3.5 shrink-0 text-emerald-200/65" /> Game balances are checked server-side. 1 USD = 400 Fizzcoins.</p>
            <Link href="/account/responsible-gaming" className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-white/50 transition hover:text-white/85"><ShieldCheck aria-hidden="true" className="size-3.5" /> Responsible play</Link>
          </section>
          <p className="flex items-start gap-2 text-[10px] leading-5 text-white/35"><Clock3 aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" /> 18+ · Only play where permitted. Fizzcoins are displayed at 400 coins per USD; game rounds remain subject to the wallet&apos;s available balance and published rules.</p>
        </div>
      </main>
      <button type="button" onClick={() => setChatOpen((open) => !open)} aria-expanded={chatOpen} aria-label={chatOpen ? 'Close lobby chat' : 'Open lobby chat'} className="fixed bottom-4 right-4 z-40 flex size-12 items-center justify-center rounded-full bg-[#6b19f5] text-white shadow-[0_10px_30px_-12px_rgba(107,25,245,.9)] transition hover:bg-[#792fff] md:bottom-5 md:right-5">
        {chatOpen ? <X aria-hidden="true" className="size-5" /> : <MessageCircle aria-hidden="true" className="size-5" />}
      </button>
      <LobbyChat currentPlayer={currentPlayer} open={chatOpen} pinned={chatPinned} onClose={() => setChatOpen(false)} onTogglePin={() => setChatPinned((pinned) => !pinned)} />
    </div>
  )
}
