import React from 'react';
import { CONFIG } from '@/config/gameConfig';
import { formatCoins } from '@/game/format';

// Free spins status panel (Sticky Wild and Mystery Surveillance bonuses).
export default function FreeSpinsHud({ freeSpins }) {
  if (!freeSpins) return null;
  const spinNumber = freeSpins.total - freeSpins.remaining + 1;
  return (
    <div className="pointer-events-none fixed left-1/2 top-3 z-40 w-[92%] max-w-sm -translate-x-1/2">
      <div className="rounded-2xl border-[4px] border-[#151515] bg-[#1D2733]/95 px-3 py-2 text-center shadow-[0_6px_0_rgba(0,0,0,0.5)]">
        <p className="font-display text-[10px] tracking-[0.16em] text-[#FFD44D]">{freeSpins.title}</p>
        <p className="font-display text-lg leading-tight text-white">
          FREE SPIN {spinNumber} / {freeSpins.total}
        </p>
        <p className="font-body text-[10px] font-extrabold uppercase tracking-wide text-white/75">
          Feature win {formatCoins(freeSpins.totalWin)} {CONFIG.currencyShort}
          {freeSpins.multiplier > 1 ? ` · ${freeSpins.multiplier}x` : ''}
          {freeSpins.sticky.length > 0 ? ` · ${freeSpins.sticky.length} sticky wilds` : ''}
        </p>
      </div>
    </div>
  );
}