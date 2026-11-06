import { ExternalLink } from 'lucide-react'

export function AffiliateCard() {
  return (
    <aside aria-label="Loot.gg affiliate offer" className="flex flex-col gap-4 rounded-xl border border-white/[0.08] bg-[#15161b] p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <div className="flex items-center gap-4">
        <img src="/loot-logo.png" alt="Loot.gg" className="size-12 shrink-0 object-contain" />
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">Fizz community pick</p>
          <h2 className="mt-1 text-sm font-bold text-white">Loot.gg · use code ZINX</h2>
          <p className="mt-1 text-[10px] leading-4 text-white/45">Affiliate link — I may earn a commission from qualifying sign-ups.</p>
        </div>
      </div>
      <a href="https://loot.gg/r/zinx" target="_blank" rel="sponsored noopener noreferrer" className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-white/10 px-4 text-xs font-semibold text-white/80 transition hover:border-[#a66aff]/60 hover:text-white">
        Visit Loot.gg <ExternalLink aria-hidden="true" className="size-3.5" />
      </a>
    </aside>
  )
}
