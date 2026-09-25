'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  CircleHelp,
  Clock3,
  Gamepad2,
  Menu,
  Search,
  ShieldCheck,
  Sparkles,
  Wallet,
  X,
} from 'lucide-react'
import { authClient } from '@/lib/auth/client'
import type { GameRecord } from '@/lib/casino-data'

type Promotion = { id: string; title: string; description: string; endsAt: string | null }
type CasinoHomeProps = {
  games: GameRecord[]
  promotions: Promotion[]
  currentPlayer: { id: string; name: string; email: string; balance: string | null; currency: string | null } | null
  vipLevel: string | null
  dataError: boolean
}

const fizzLogo = 'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-Y8AO1sXutEFbjR1ynbyHq9DhYR3zbV.png'
const currencySymbols: Record<string, string> = { USD: '$', EUR: '€', GBP: '£' }

function money(amount: string | null, currency: string | null) {
  if (amount === null || currency === null) return 'Balance unavailable'
  const number = Number(amount)
  if (!Number.isFinite(number)) return 'Balance unavailable'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(number)
}

function SiteHeader({ currentPlayer }: Pick<CasinoHomeProps, 'currentPlayer'>) {
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  async function handleSignOut() {
    setSigningOut(true)
    try {
      await authClient.signOut()
      router.push('/')
      router.refresh()
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <header className="sticky top-0 z-30 border-b border-white/[0.07] bg-[#0b0c10]/90 backdrop-blur-xl">
      <div className="mx-auto flex h-[72px] max-w-[1440px] items-center justify-between px-4 sm:px-8">
        <Link href="/" className="flex shrink-0 items-center gap-2.5" aria-label="Fizz Casino home">
          <img src={fizzLogo} alt="Fizz Casino" className="h-10 w-12 object-contain" />
          <span className="text-[13px] font-black tracking-[0.2em] text-white">FIZZ</span>
        </Link>

        <nav aria-label="Main navigation" className="hidden items-center gap-7 lg:flex">
          <Link className="nav-link" href="/">Home</Link>
          <Link className="nav-link" href="/casino">Casino</Link>
          <Link className="nav-link" href="/#games">Games</Link>
          <Link className="nav-link" href="/#promotions">Promotions</Link>
          <Link className="nav-link" href="/#vip">VIP</Link>
          <Link className="nav-link" href="/support">Support</Link>
        </nav>

        <div className="hidden items-center gap-3 sm:flex">
          {currentPlayer ? (
            <>
              <Link href="/account" className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.035] px-4 py-2.5 text-sm font-semibold text-white transition hover:border-amber-200/30">
                <Wallet aria-hidden="true" className="size-4 text-amber-200" />
                <span>{money(currentPlayer.balance, currentPlayer.currency)}</span>
              </Link>
              <details className="relative">
                <summary className="flex size-10 cursor-pointer list-none items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-sm font-bold text-white transition hover:bg-white/10" aria-label="Open account menu">
                  {currentPlayer.name.trim().charAt(0).toUpperCase() || 'A'}
                </summary>
                <div className="absolute right-0 top-12 z-40 flex min-w-48 flex-col gap-1 rounded-2xl border border-white/10 bg-[#15171c] p-2 shadow-xl">
                  <span className="truncate px-3 py-2 text-xs text-white/45">{currentPlayer.email}</span>
                  <Link href="/account" className="rounded-xl px-3 py-2 text-sm text-white/80 hover:bg-white/[0.06]">My account</Link>
                  <button type="button" disabled={signingOut} onClick={handleSignOut} className="rounded-xl px-3 py-2 text-left text-sm text-white/80 hover:bg-white/[0.06] disabled:opacity-50">{signingOut ? 'Signing out…' : 'Sign out'}</button>
                </div>
              </details>
            </>
          ) : (
            <>
              <Link href="/auth/sign-in" className="rounded-full px-4 py-2.5 text-sm font-semibold text-white/70 transition hover:text-white">Log in</Link>
              <Link href="/auth/sign-up" className="rounded-full bg-[#f4bc63] px-5 py-2.5 text-sm font-bold text-[#1a140b] transition hover:bg-[#ffd48d]">Join Fizz</Link>
            </>
          )}
        </div>

        <button type="button" aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)} className="flex size-10 items-center justify-center rounded-full border border-white/10 text-white sm:hidden">
          {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>
      {menuOpen && (
        <nav aria-label="Mobile navigation" className="flex flex-col gap-1 border-t border-white/[0.07] bg-[#0b0c10] px-4 py-4 sm:hidden">
          <Link onClick={() => setMenuOpen(false)} className="mobile-nav-link" href="/">Home</Link>
          <Link onClick={() => setMenuOpen(false)} className="mobile-nav-link" href="/casino">Casino</Link>
          <Link onClick={() => setMenuOpen(false)} className="mobile-nav-link" href="/#games">Games</Link>
          <Link onClick={() => setMenuOpen(false)} className="mobile-nav-link" href="/#promotions">Promotions</Link>
          <Link onClick={() => setMenuOpen(false)} className="mobile-nav-link" href="/#vip">VIP</Link>
          <Link onClick={() => setMenuOpen(false)} className="mobile-nav-link" href="/support">Support</Link>
          {currentPlayer ? (
            <Link onClick={() => setMenuOpen(false)} href="/account" className="mobile-nav-link">My account · {money(currentPlayer.balance, currentPlayer.currency)}</Link>
          ) : (
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Link onClick={() => setMenuOpen(false)} href="/auth/sign-in" className="mobile-action">Log in</Link>
              <Link onClick={() => setMenuOpen(false)} href="/auth/sign-up" className="mobile-action mobile-action-primary">Join Fizz</Link>
            </div>
          )}
        </nav>
      )}
    </header>
  )
}

function GameCard({ game }: { game: GameRecord }) {
  return (
    <article className="group overflow-hidden rounded-[22px] border border-white/[0.08] bg-[#12141a] transition duration-300 hover:-translate-y-1 hover:border-amber-200/25 hover:shadow-[0_20px_55px_-35px_rgba(244,188,99,.22)]">
      <div className="relative aspect-[1.35/1] overflow-hidden bg-[radial-gradient(ellipse_at_60%_40%,rgba(93,77,112,.44),rgba(25,26,32,.2)_52%,rgba(15,16,21,.95)_100%)]">
        {game.coverImageUrl ? <img src={game.coverImageUrl} alt="" loading="lazy" className="size-full object-cover transition duration-500 group-hover:scale-[1.04]" /> : <div className="flex size-full items-center justify-center"><Gamepad2 aria-hidden="true" className="size-10 text-white/20" /></div>}
        <span className="absolute left-3 top-3 rounded-full border border-white/10 bg-black/40 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/70 backdrop-blur">{game.category}</span>
      </div>
      <div className="flex items-center justify-between gap-3 px-4 py-3.5">
        <div className="min-w-0"><h3 className="truncate text-sm font-bold text-white">{game.name}</h3><p className="mt-1 truncate text-xs text-white/40">{game.provider}</p></div>
        <span className="shrink-0 rounded-lg border border-white/[0.08] px-2 py-1 text-[10px] font-medium text-white/40">Launch unavailable</span>
      </div>
    </article>
  )
}

function GameLobby({ games, dataError }: Pick<CasinoHomeProps, 'games' | 'dataError'>) {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const categories = useMemo(() => Array.from(new Set(games.map((game) => game.category))), [games])
  const visibleGames = useMemo(() => games.filter((game) => {
    const matchesCategory = category === 'all' || game.category === category
    const query = search.trim().toLowerCase()
    return matchesCategory && (!query || `${game.name} ${game.provider} ${game.category}`.toLowerCase().includes(query))
  }), [category, games, search])

  return (
    <section id="games" aria-labelledby="games-heading" className="scroll-mt-28 py-20 sm:py-28">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="eyebrow">The lobby</p><h2 id="games-heading" className="section-heading">Find your next favorite.</h2><p className="mt-3 max-w-lg text-sm leading-6 text-white/50">Every game shown here comes from the live catalog. No previews or made-up listings.</p></div>
        <div className="flex min-h-11 w-full items-center gap-2 rounded-xl border border-white/10 bg-white/[0.035] px-3 sm:max-w-[280px]">
          <Search aria-hidden="true" className="size-4 shrink-0 text-white/35" />
          <label className="sr-only" htmlFor="game-search">Search games</label>
          <input id="game-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search games" className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/35" />
        </div>
      </div>
      {!dataError && games.length > 0 && (
        <div className="mt-6 flex gap-2 overflow-x-auto pb-1" aria-label="Game categories">
          {['all', ...categories].map((item) => <button key={item} type="button" onClick={() => setCategory(item)} aria-pressed={category === item} className={`shrink-0 rounded-full border px-4 py-2 text-xs font-semibold capitalize transition ${category === item ? 'border-amber-200/40 bg-amber-200/10 text-amber-100' : 'border-white/10 bg-white/[0.025] text-white/55 hover:text-white'}`}>{item === 'all' ? 'All games' : item}</button>)}
        </div>
      )}
      {dataError ? (
        <div className="empty-panel mt-8"><CircleHelp aria-hidden="true" className="size-6 text-amber-100/60" /><p className="mt-4 text-base font-semibold text-white">The game catalog is unavailable.</p><p className="mt-2 text-sm text-white/45">We could not load the live catalog. Please try again later.</p></div>
      ) : visibleGames.length ? (
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{visibleGames.map((game) => <GameCard key={game.id} game={game} />)}</div>
      ) : (
        <div className="empty-panel mt-8"><Gamepad2 aria-hidden="true" className="size-6 text-amber-100/65" /><p className="mt-4 text-base font-semibold text-white">{search || category !== 'all' ? 'No games match your search.' : 'No games available.'}</p><p className="mt-2 text-sm text-white/45">The live game catalog is empty right now. We will only show games that are actually configured.</p></div>
      )}
    </section>
  )
}

function PromotionSection({ promotions }: Pick<CasinoHomeProps, 'promotions'>) {
  return (
    <section id="promotions" className="scroll-mt-28 grid gap-6 border-y border-white/[0.07] py-12 md:grid-cols-[0.8fr_1.2fr] md:items-center md:py-16">
      <div><p className="eyebrow">Offers, honestly</p><h2 className="mt-3 text-2xl font-bold tracking-tight text-white sm:text-3xl">Promotions with no fine-print surprises.</h2><p className="mt-3 max-w-md text-sm leading-6 text-white/45">Only published offers from the live promotions catalog appear here.</p></div>
      {promotions.length ? <div className="grid gap-3 sm:grid-cols-2">{promotions.map((promotion) => <article key={promotion.id} className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5"><div className="flex items-center gap-2 text-xs font-semibold text-amber-100/70"><Sparkles aria-hidden="true" className="size-3.5" /> Live promotion</div><h3 className="mt-3 font-semibold text-white">{promotion.title}</h3><p className="mt-2 text-sm leading-6 text-white/45">{promotion.description}</p>{promotion.endsAt && <p className="mt-4 text-xs text-white/35">Ends {new Date(promotion.endsAt).toLocaleDateString()}</p>}</article>)}</div> : <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-8 text-center"><p className="text-sm font-semibold text-white/75">No promotions available.</p><p className="mt-2 text-xs text-white/40">There are no active offers in the database.</p></div>}
    </section>
  )
}

function VipSection({ currentPlayer, vipLevel }: Pick<CasinoHomeProps, 'currentPlayer' | 'vipLevel'>) {
  return (
    <section id="vip" className="scroll-mt-28 py-16 sm:py-20">
      <div className="relative overflow-hidden rounded-[28px] border border-amber-100/10 bg-[linear-gradient(112deg,#181715,#121316_55%,#191714)] p-6 sm:p-10">
        <div className="pointer-events-none absolute -right-24 -top-28 size-72 rounded-full bg-amber-200/[0.06] blur-[90px]" />
        <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="max-w-xl"><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-amber-100/70"><BadgeCheck aria-hidden="true" className="size-4" /> Fizz VIP</div><h2 className="mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl">A little extra, earned.</h2><p className="mt-3 text-sm leading-6 text-white/50">VIP tiers and benefits are configured by the casino team. Progress is based on recorded play, never estimates.</p></div>
          <div className="min-w-52 rounded-2xl border border-white/[0.08] bg-black/20 px-5 py-4"><p className="text-xs text-white/40">{currentPlayer ? 'Your current status' : 'Member access'}</p><p className="mt-2 text-sm font-semibold text-white">{currentPlayer ? vipLevel ?? 'No VIP activity yet.' : 'Sign in to view your status.'}</p></div>
        </div>
      </div>
    </section>
  )
}

export function CasinoHome({ games, promotions, currentPlayer, vipLevel, dataError }: CasinoHomeProps) {
  const balance = currentPlayer ? money(currentPlayer.balance, currentPlayer.currency) : null
  return (
    <div className="min-h-screen overflow-hidden bg-[#0b0c10] text-white">
      <SiteHeader currentPlayer={currentPlayer} />
      <main>
        <section className="relative isolate mx-auto grid min-h-[620px] max-w-[1440px] items-center gap-10 px-5 pb-16 pt-14 sm:px-8 md:grid-cols-[1.04fr_0.96fr] md:py-20 lg:min-h-[700px]">
          <div className="pointer-events-none absolute -left-44 top-8 -z-10 size-[440px] rounded-full bg-sky-400/[0.06] blur-[110px]" />
          <div className="pointer-events-none absolute right-0 top-16 -z-10 size-[390px] rounded-full bg-amber-300/[0.055] blur-[115px]" />
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.035] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/55"><span className="size-1.5 rounded-full bg-emerald-300" /> Welcome to Fizz</div>
            <h1 className="mt-7 max-w-xl text-[clamp(3.4rem,8vw,6.25rem)] font-black leading-[0.94] tracking-[-0.065em] text-white">A little more <span className="bg-gradient-to-r from-amber-100 via-[#f4bc63] to-[#d7a165] bg-clip-text text-transparent">spark.</span></h1>
            <p className="mt-6 max-w-lg text-base leading-7 text-white/55 sm:text-lg">A fresh take on your favorite games. Explore the Fizz lobby, keep your play in balance, and see your account exactly as it is.</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href={currentPlayer ? '#games' : '/auth/sign-up'} className="group inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#f4bc63] px-6 text-sm font-bold text-[#1a140b] transition hover:bg-[#ffd48d]">{currentPlayer ? 'Explore the lobby' : 'Create your account'} <ArrowRight aria-hidden="true" className="size-4 transition-transform group-hover:translate-x-1" /></Link>
              <Link href={currentPlayer ? '/account' : '/auth/sign-in'} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-white/12 px-6 text-sm font-semibold text-white/75 transition hover:border-white/25 hover:text-white">{currentPlayer ? <><Wallet aria-hidden="true" className="size-4" /> Wallet · {balance}</> : <>Log in <ArrowUpRight aria-hidden="true" className="size-4" /></>}</Link>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-white/40"><span className="inline-flex items-center gap-2"><ShieldCheck aria-hidden="true" className="size-4 text-emerald-200/70" /> Responsible play first</span><span className="inline-flex items-center gap-2"><Clock3 aria-hidden="true" className="size-4 text-white/35" /> 18+ · Play within your limits</span></div>
          </div>
          <div className="relative mx-auto w-full max-w-[550px]">
            <div className="absolute inset-8 rounded-full bg-sky-300/[0.07] blur-[85px]" />
            <div className="relative overflow-hidden rounded-[34px] border border-white/[0.08] bg-[radial-gradient(ellipse_at_54%_38%,rgba(39,53,69,.58),rgba(20,21,27,.82)_58%,rgba(15,16,21,.95)_100%)] p-4 shadow-[0_32px_100px_-52px_rgba(132,169,190,.26)] sm:p-6">
              <div className="absolute inset-0 bg-[linear-gradient(140deg,transparent_24%,rgba(255,255,255,.025)_24.2%,transparent_24.5%,transparent_75%,rgba(255,255,255,.02)_75.2%,transparent_75.6%)]" />
              <img src={fizzLogo} alt="Official Fizz Casino logo" fetchPriority="high" className="relative z-10 mx-auto aspect-[1.1/1] w-full object-contain drop-shadow-[0_20px_45px_rgba(0,0,0,.58)]" />
              <div className="absolute bottom-5 left-5 right-5 flex items-center justify-between rounded-2xl border border-white/[0.08] bg-[#0b0c10]/75 px-4 py-3 backdrop-blur-lg sm:bottom-7 sm:left-7 sm:right-7"><span className="text-xs font-medium text-white/55">The Fizz experience</span><span className="rounded-full border border-amber-100/15 bg-amber-100/[0.06] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.13em] text-amber-100/75">Live catalog</span></div>
            </div>
          </div>
        </section>

        <div className="mx-auto max-w-[1440px] px-5 sm:px-8">
          <GameLobby games={games} dataError={dataError} />
          <PromotionSection promotions={promotions} />
          <VipSection currentPlayer={currentPlayer} vipLevel={vipLevel} />
          <section id="responsible-play" className="scroll-mt-28 border-t border-white/[0.07] py-9">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center"><div className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-emerald-200/10 bg-emerald-200/[0.055] text-emerald-100/75"><ShieldCheck aria-hidden="true" className="size-5" /></div><div><h2 className="text-sm font-semibold text-white">Keep play in balance</h2><p className="mt-1 max-w-3xl text-xs leading-5 text-white/45">Only play where it is legal and if you meet the legal age in your location. Set limits, take breaks, and never play with money you cannot afford to lose. Responsible gaming settings are available in your account.</p></div><Link href="/account/responsible-gaming" className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-white/60 transition hover:text-white sm:ml-auto">Review your limits <ArrowDownRight aria-hidden="true" className="size-3.5" /></Link></div>
          </section>
          <section id="support" className="flex flex-col gap-3 border-t border-white/[0.07] py-8 sm:flex-row sm:items-center"><div><h2 className="text-sm font-semibold text-white">Here when you need us.</h2><p className="mt-1 text-xs text-white/45">Open a support ticket or follow up on a conversation.</p></div><Link href="/support" className="inline-flex items-center gap-1 text-xs font-semibold text-white/60 hover:text-white sm:ml-auto">Visit support <ArrowRight aria-hidden="true" className="size-3.5" /></Link></section>
        </div>
      </main>
      <footer className="border-t border-white/[0.07]"><div className="mx-auto flex max-w-[1440px] flex-col gap-3 px-5 py-6 text-xs text-white/35 sm:flex-row sm:items-center sm:justify-between sm:px-8"><span>© {new Date().getFullYear()} Fizz Casino</span><div className="flex gap-4"><Link href="/account/responsible-gaming" className="transition hover:text-white/70">Responsible gaming</Link><Link href="/support" className="transition hover:text-white/70">Support</Link></div></div></footer>
    </div>
  )
}

export function LobbyPage({ games, dataError, currentPlayer }: Pick<CasinoHomeProps, 'games' | 'dataError' | 'currentPlayer'>) {
  return <div className="min-h-screen bg-[#0b0c10] text-white"><SiteHeader currentPlayer={currentPlayer} /><main className="mx-auto max-w-[1440px] px-5 sm:px-8"><div className="pt-14 sm:pt-20"><p className="eyebrow">Fizz Casino</p><h1 className="section-heading">The lobby.</h1></div><GameLobby games={games} dataError={dataError} /></main></div>
}

export function formatMoney(amount: string, currency = 'USD') {
  const symbol = currencySymbols[currency]
  return symbol ? `${symbol}${Number(amount).toFixed(2)}` : money(amount, currency)
}

export function EmptyDataState({ title, detail }: { title: string; detail: string }) {
  return <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-5 py-8 text-center"><CircleHelp aria-hidden="true" className="mx-auto size-5 text-white/35" /><p className="mt-3 text-sm font-semibold text-white/75">{title}</p><p className="mt-1 text-xs leading-5 text-white/40">{detail}</p></div>
}

export function CasinoPageHeader({ title, eyebrow, detail }: { title: string; eyebrow: string; detail?: string }) {
  return <div className="mb-8"><p className="eyebrow">{eyebrow}</p><h1 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">{title}</h1>{detail && <p className="mt-3 max-w-2xl text-sm leading-6 text-white/50">{detail}</p>}</div>
}

export function CasinoHeaderForAccount() {
  return <div className="border-b border-white/[0.07] bg-[#0b0c10]"><div className="mx-auto flex h-[68px] max-w-7xl items-center justify-between px-5 sm:px-8"><Link href="/" className="flex items-center gap-2" aria-label="Fizz Casino home"><img src={fizzLogo} alt="Fizz Casino" className="h-9 w-11 object-contain" /><span className="text-xs font-black tracking-[0.2em]">FIZZ</span></Link><Link href="/" className="text-sm text-white/55 hover:text-white">Back to lobby <ArrowUpRight aria-hidden="true" className="ml-1 inline size-3.5" /></Link></div></div>
}

export function AccountNavigation({ active }: { active: 'overview' | 'responsible' | 'support' }) {
  const items = [{ id: 'overview', href: '/account', label: 'Overview' }, { id: 'responsible', href: '/account/responsible-gaming', label: 'Responsible gaming' }, { id: 'support', href: '/support', label: 'Support' }] as const
  return <nav aria-label="Account navigation" className="mb-7 flex gap-2 overflow-x-auto border-b border-white/[0.08] pb-3">{items.map((item) => <Link key={item.id} href={item.href} aria-current={active === item.id ? 'page' : undefined} className={`shrink-0 rounded-full px-4 py-2 text-xs font-semibold transition ${active === item.id ? 'bg-white/10 text-white' : 'text-white/45 hover:text-white'}`}>{item.label}</Link>)}</nav>
}

export function DataTableEmptyRow({ title, detail }: { title: string; detail: string }) {
  return <EmptyDataState title={title} detail={detail} />
}

export function AccountIcon({ type }: { type: 'wallet' | 'vip' | 'clock' }) {
  const Icon = type === 'wallet' ? Wallet : type === 'vip' ? BadgeCheck : Clock3
  return <Icon aria-hidden="true" className="size-4" />
}

export function SearchIcon() { return <Search aria-hidden="true" className="size-4" /> }
export function HeaderMenuIcon() { return <Menu aria-hidden="true" className="size-4" /> }
export function UpRightIcon() { return <ArrowUpRight aria-hidden="true" className="size-4" /> }
export function HelpIcon() { return <CircleHelp aria-hidden="true" className="size-5" /> }
export function GameIcon() { return <Gamepad2 aria-hidden="true" className="size-5" /> }
export function ShieldIcon() { return <ShieldCheck aria-hidden="true" className="size-5" /> }
