import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  CircleHelp,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'

const fizzLogo =
  'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-Y8AO1sXutEFbjR1ynbyHq9DhYR3zbV.png'
const lootLogo =
  'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-aMGjsINjRaJbGtQfnKP2qHCs1a7ZXf.png'
const lootReferral = 'https://loot.gg/r/zinx'

function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-white/[0.07] bg-[#09090d]/85 backdrop-blur-xl">
      <div className="mx-auto flex h-[76px] max-w-7xl items-center justify-between px-5 sm:px-8">
        <a href="#top" className="flex items-center gap-3" aria-label="Fizz Casino home">
          <img
            src={fizzLogo}
            alt="Fizz Casino"
            className="h-12 w-[58px] object-contain"
          />
          <span className="text-[15px] font-extrabold tracking-[0.19em] text-white">FIZZ</span>
        </a>

        <nav aria-label="Main navigation" className="hidden items-center gap-8 md:flex">
          <a className="text-sm text-white/65 transition hover:text-white" href="#games">Casino</a>
          <a className="text-sm text-white/65 transition hover:text-white" href="#affiliate">Loot.gg offer</a>
          <a className="text-sm text-white/65 transition hover:text-white" href="#play-safe">Play responsibly</a>
        </nav>

        <a
          href={lootReferral}
          target="_blank"
          rel="sponsored noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-4 py-2.5 text-sm font-semibold text-white transition hover:border-violet-300/50 hover:bg-white/10"
        >
          Visit Loot.gg <ArrowUpRight aria-hidden="true" className="size-4" />
        </a>
      </div>
    </header>
  )
}

function LootAffiliateCard() {
  return (
    <section
      id="affiliate"
      aria-labelledby="affiliate-heading"
      className="relative overflow-hidden rounded-[28px] border border-violet-300/15 bg-[linear-gradient(115deg,#17121f_0%,#100e17_58%,#171022_100%)] p-6 shadow-[0_30px_100px_-55px_rgba(147,51,234,0.45)] sm:p-9"
    >
      <div className="pointer-events-none absolute -right-20 -top-24 size-64 rounded-full bg-violet-500/10 blur-3xl" />
      <div className="relative flex flex-col gap-7 md:flex-row md:items-center md:justify-between">
        <div className="max-w-xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-violet-300/15 bg-violet-300/[0.07] px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.17em] text-violet-200">
            <Sparkles aria-hidden="true" className="size-3.5" /> Partner link
          </div>
          <h2 id="affiliate-heading" className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Check out Loot.gg
          </h2>
          <p className="mt-2 max-w-lg text-sm leading-6 text-white/60 sm:text-base">
            Use my referral link to visit Loot.gg. My affiliate code is <strong className="font-semibold text-white">zinx</strong>.
          </p>
          <p className="mt-3 text-xs leading-5 text-white/40">
            Affiliate disclosure: I may earn a commission if you use this link. Loot.gg is a third-party site; please review its terms and play responsibly.
          </p>
        </div>

        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center md:shrink-0">
          <div className="flex h-[86px] w-[142px] items-center justify-center rounded-2xl border border-white/10 bg-black/35 px-3 py-2">
            <img src={lootLogo} alt="Loot.gg" className="max-h-full max-w-full object-contain" />
          </div>
          <a
            href={lootReferral}
            target="_blank"
            rel="sponsored noopener noreferrer"
            className="group inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#c084fc] px-5 text-sm font-bold text-[#190b23] transition hover:bg-[#d8a9ff] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-200"
          >
            Visit with code zinx
            <ArrowUpRight aria-hidden="true" className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </a>
        </div>
      </div>
    </section>
  )
}

function GameLobbyEmptyState() {
  return (
    <section id="games" aria-labelledby="games-heading" className="scroll-mt-28 py-20 sm:py-28">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-200/75">The lobby</p>
          <h2 id="games-heading" className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">Games, when they&apos;re ready.</h2>
        </div>
        <p className="max-w-md text-sm leading-6 text-white/50">
          The game catalog isn&apos;t connected yet. We won&apos;t show made-up games or pretend anything is playable.
        </p>
      </div>
      <div className="mt-8 flex min-h-48 flex-col items-center justify-center rounded-3xl border border-dashed border-white/10 bg-white/[0.025] px-6 text-center">
        <div className="mb-4 flex size-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-cyan-100/80">
          <CircleHelp aria-hidden="true" className="size-5" />
        </div>
        <p className="text-base font-semibold text-white">No games available.</p>
        <p className="mt-1 text-sm text-white/45">There&apos;s no live game catalog to show right now.</p>
      </div>
    </section>
  )
}

function ResponsiblePlay() {
  return (
    <section id="play-safe" className="scroll-mt-28 border-t border-white/[0.07] py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-emerald-200/10 bg-emerald-200/[0.06] text-emerald-100/80">
          <ShieldCheck aria-hidden="true" className="size-5" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-white">Keep play in balance</h2>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-white/45">
            Only participate where it&apos;s legal and if you meet the legal age in your location. Set limits, take breaks, and never play with money you can&apos;t afford to lose. No games or account services are currently available on this site.
          </p>
        </div>
        <a href="https://www.begambleaware.org/" target="_blank" rel="noopener noreferrer" className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-white/60 transition hover:text-white sm:ml-auto">
          Get support <ArrowUpRight aria-hidden="true" className="size-3.5" />
        </a>
      </div>
    </section>
  )
}

export function CasinoHome() {
  return (
    <div id="top" className="min-h-screen overflow-hidden bg-[#09090d] text-white">
      <SiteHeader />
      <main>
        <section className="relative isolate mx-auto grid min-h-[620px] max-w-7xl items-center gap-10 px-5 pb-16 pt-14 sm:px-8 md:grid-cols-[1.02fr_0.98fr] md:py-20 lg:min-h-[700px]">
          <div className="pointer-events-none absolute -left-44 top-10 -z-10 size-[440px] rounded-full bg-cyan-500/[0.07] blur-[110px]" />
          <div className="pointer-events-none absolute right-0 top-24 -z-10 size-[390px] rounded-full bg-orange-500/[0.06] blur-[115px]" />
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.035] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/60">
              <span className="size-1.5 rounded-full bg-cyan-300 shadow-[0_0_12px_rgba(103,232,249,.8)]" />
              Welcome to Fizz
            </div>
            <h1 className="mt-7 max-w-xl text-5xl font-black leading-[0.98] tracking-[-0.055em] text-white sm:text-6xl lg:text-[76px]">
              A little more <span className="bg-gradient-to-r from-amber-200 via-orange-400 to-cyan-300 bg-clip-text text-transparent">spark.</span>
            </h1>
            <p className="mt-6 max-w-md text-base leading-7 text-white/55 sm:text-lg">
              Welcome to Fizz Casino. We&apos;re getting the lobby ready — in the meantime, find my Loot.gg referral below.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <a href="#affiliate" className="group inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-white px-6 text-sm font-bold text-[#111116] transition hover:bg-cyan-100 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
                See my Loot.gg link <ArrowRight aria-hidden="true" className="size-4 transition-transform group-hover:translate-x-1" />
              </a>
              <a href="#games" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-white/12 px-6 text-sm font-semibold text-white/75 transition hover:border-white/25 hover:text-white">
                Explore the lobby <ArrowDown aria-hidden="true" className="size-4" />
              </a>
            </div>
            <div className="mt-8 flex items-center gap-3 text-xs text-white/40">
              <ShieldCheck aria-hidden="true" className="size-4 text-emerald-200/70" />
              Responsible play comes first
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-[530px]">
            <div className="absolute inset-8 rounded-full bg-cyan-400/[0.09] blur-[80px]" />
            <div className="relative overflow-hidden rounded-[34px] border border-white/[0.08] bg-[radial-gradient(ellipse_at_52%_42%,rgba(15,24,49,.9),rgba(13,13,19,.6)_68%)] p-3 shadow-[0_30px_100px_-50px_rgba(34,211,238,.28)] sm:p-5">
              <img
                src={fizzLogo}
                alt="Fizz Casino logo in vivid blue and orange lettering"
                fetchPriority="high"
                className="relative z-10 mx-auto aspect-[1.1/1] w-full object-contain drop-shadow-[0_20px_45px_rgba(0,0,0,.6)]"
              />
              <div className="absolute bottom-5 left-5 right-5 flex items-center justify-between rounded-2xl border border-white/[0.08] bg-[#09090d]/75 px-4 py-3 backdrop-blur-lg sm:bottom-7 sm:left-7 sm:right-7">
                <span className="text-xs font-medium text-white/55">The Fizz experience</span>
                <span className="rounded-full border border-cyan-200/15 bg-cyan-200/[0.07] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.13em] text-cyan-100/80">Coming soon</span>
              </div>
            </div>
          </div>
        </section>

        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <LootAffiliateCard />
          <GameLobbyEmptyState />
          <ResponsiblePlay />
        </div>
      </main>
      <footer className="border-t border-white/[0.07]">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-6 text-xs text-white/35 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <span>© {new Date().getFullYear()} Fizz Casino</span>
          <span>Loot.gg is a third-party service. Affiliate link: loot.gg/r/zinx</span>
        </div>
      </footer>
    </div>
  )
}

export { lootReferral }

