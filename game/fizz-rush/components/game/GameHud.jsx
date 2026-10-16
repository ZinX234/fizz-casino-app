import { Pause, Coins, Gem, Shield, Gauge, Zap, TrendingUp, Footprints } from 'lucide-react';
import { GAME_CONFIG } from '@/game/fizz-rush/game/config';
import { cn } from '@/lib/utils';

const TONE = {
  gold: 'border-primary/45 bg-primary/15 text-primary',
  cyan: 'border-accent/45 bg-accent/15 text-accent',
  violet: 'border-[#c56bff]/45 bg-[#c56bff]/15 text-[#d9a4ff]',
  danger: 'border-destructive/50 bg-destructive/15 text-destructive',
};

/** In-run interface: score, combo, collectibles, shields and live notices. */
export default function GameHud({ hud, notices, onPause, showTouch, onAction, large }) {
  if (!hud) return null;
  const difficulty = GAME_CONFIG.difficulty[hud.difficulty] || GAME_CONFIG.difficulty.hard;
  const isReal = hud.mode === 'real';

  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex flex-col">
      {/* ---------------------------------------------------------- top bar */}
      <div className="flex items-start justify-between gap-3 p-3 sm:p-5">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onPause}
              className="pointer-events-auto grid h-10 w-10 place-items-center rounded-xl border border-white/15 bg-black/40 backdrop-blur-md transition-colors hover:bg-black/60"
              aria-label="Pause"
            >
              <Pause className="h-4 w-4" />
            </button>
            <span
              className={cn(
                'rounded-full border px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] backdrop-blur-md',
                isReal ? 'border-primary/45 bg-primary/20 text-primary' : 'border-accent/45 bg-accent/20 text-accent'
              )}
            >
              {isReal ? `Real Mode · ${hud.bet ? `${hud.bet.toLocaleString()} FC` : ''}` : 'Demo Mode · no rewards'}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded-full border border-white/12 bg-black/35 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] backdrop-blur-md" style={{ color: difficulty.accent }}>
              {difficulty.name}
            </span>
            <span className="rounded-full border border-white/12 bg-black/35 px-2.5 py-1 text-[10px] font-medium text-foreground/80 backdrop-blur-md">
              {hud.biome?.name}
            </span>
            {hud.event && (
              <span className="rounded-full border border-white/12 bg-black/35 px-2.5 py-1 text-[10px] font-medium text-foreground/80 backdrop-blur-md">
                {hud.event.name}
              </span>
            )}
          </div>
        </div>

        {/* score */}
        <div className="flex flex-col items-center">
          <span className={cn('font-heading font-extrabold tabular-nums text-shadow-soft', large ? 'text-5xl' : 'text-4xl sm:text-5xl')}>
            {hud.score.toLocaleString()}
          </span>
          <span className="mt-0.5 text-[11px] font-medium tabular-nums text-foreground/70">{hud.distance.toLocaleString()} m</span>

          <div className="mt-2 flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/15 px-2.5 py-1 text-[11px] font-bold tabular-nums text-primary backdrop-blur-md">
              <TrendingUp className="h-3 w-3" />
              {hud.multiplier.toFixed(2)}×
            </span>
            {!hud.integrityOK && (
              <span className="animate-pulse-glow rounded-full border border-destructive/50 bg-destructive/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-destructive backdrop-blur-md">
                Scoring paused
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-1.5">
            <Readout icon={Coins} value={hud.coins} tone="text-primary" />
            {hud.gems > 0 && <Readout icon={Gem} value={hud.gems} tone="text-accent" />}
          </div>
          <div className="flex items-center gap-1.5">
            <Readout icon={Shield} value={hud.shields} tone={hud.shields > 0 ? 'text-accent' : 'text-muted-foreground'} />
            <Readout icon={Gauge} value={`${hud.speed} km/h`} tone="text-foreground/80" />
          </div>
          {(hud.wager || hud.boost) && (
            <span className="inline-flex items-center gap-1 rounded-full border border-[#c56bff]/45 bg-[#c56bff]/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#d9a4ff] backdrop-blur-md">
              <Zap className="h-3 w-3" /> {hud.boost ? 'Boosting' : 'Wager ×2'}
            </span>
          )}
        </div>
      </div>

      {/* ---------------------------------------------------------- notices */}
      <div className="mx-auto flex w-full max-w-md flex-col items-center gap-1.5 px-4">
        {notices.map((notice) => (
          <div
            key={notice.id}
            className={cn(
              'animate-rise-in w-full rounded-2xl border px-3.5 py-2 text-center backdrop-blur-md',
              TONE[notice.tone] || 'border-white/15 bg-black/40 text-foreground'
            )}
          >
            <span className="text-xs font-bold">{notice.text}</span>
            {notice.detail && <span className="ml-1.5 text-[11px] opacity-80">{notice.detail}</span>}
          </div>
        ))}
      </div>

      {/* ----------------------------------------------------- touch input */}
      {showTouch && (
        <div className="mt-auto flex items-end justify-between gap-3 p-4 sm:p-6">
          <button
            type="button"
            onPointerDown={() => onAction('slide')}
            className="pointer-events-auto grid h-20 w-20 place-items-center rounded-3xl border border-white/20 bg-black/40 backdrop-blur-md active:scale-95 sm:h-24 sm:w-24"
            aria-label="Slide"
          >
            <Footprints className="h-6 w-6" />
          </button>
          <button
            type="button"
            onPointerDown={() => onAction('jump')}
            className="pointer-events-auto grid h-20 w-20 place-items-center rounded-3xl border border-white/20 bg-black/40 text-lg font-bold backdrop-blur-md active:scale-95 sm:h-24 sm:w-24"
            aria-label="Jump"
          >
            ▲
          </button>
        </div>
      )}
    </div>
  );
}

function Readout({ icon: Icon, value, tone }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-black/35 px-2.5 py-1 text-[11px] font-semibold tabular-nums backdrop-blur-md">
      <Icon className={cn('h-3.5 w-3.5', tone)} />
      <span className={tone}>{value}</span>
    </span>
  );
}