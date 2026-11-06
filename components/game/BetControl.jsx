import React from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { CONFIG } from '@/config/gameConfig';
import { formatCoins } from '@/game/format';
import { cn } from '@/lib/utils';

// Bet display with a vertical stepper, mirroring the reference controls.
export default function BetControl({ bet, onChange, label = 'BET' }) {
  const options = CONFIG.bets.options;
  const atMin = bet <= options[0];
  const atMax = bet >= options[options.length - 1];

  const stepButton = 'flex h-5 w-7 items-center justify-center rounded-md border-2 border-[#151515] bg-[#E9E9E9] text-[#151515] disabled:opacity-35';

  return (
    <div className="flex items-center gap-1.5">
      <div className="flex min-w-[96px] flex-col items-center rounded-xl border-[3px] border-[#151515] bg-[#2A2A2A] px-3 py-1">
        <span className="font-display text-[9px] leading-none tracking-[0.16em] text-white/60">{label}</span>
        <span className="font-display text-base leading-tight text-white md:text-lg">{formatCoins(bet)}</span>
      </div>
      <div className="flex flex-col gap-1">
        <button type="button" aria-label="Increase bet" disabled={atMax} onClick={() => onChange(1)} className={cn(stepButton)}>
          <ChevronUp className="h-3.5 w-3.5" />
        </button>
        <button type="button" aria-label="Decrease bet" disabled={atMin} onClick={() => onChange(-1)} className={cn(stepButton)}>
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}