import React from 'react';
import { cn } from '@/lib/utils';
import { CONFIG } from '@/config/gameConfig';
import { formatCoins } from '@/game/format';

// Win readout that sits under the reels.
export default function WinDisplay({ displayWin, winAmount, lines, demo, rtp, className }) {
  const active = winAmount > 0;
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 rounded-2xl border-[4px] border-[#151515] px-3 py-1.5',
        active ? 'bg-[#FFD44D]' : 'bg-[#221F1B]',
        className,
      )}
    >
      <div className="flex items-baseline gap-2">
        <span className={cn('font-display text-[10px] tracking-[0.16em]', active ? 'text-[#151515]' : 'text-white/60')}>
          WIN
        </span>
        <span className={cn('font-display text-lg leading-none md:text-2xl', active ? 'text-[#151515]' : 'text-white/80')}>
          {formatCoins(displayWin)}
        </span>
        {!demo ? (
          <span className={cn('font-body text-[10px] font-extrabold uppercase', active ? 'text-[#151515]/70' : 'text-white/40')}>
            {CONFIG.currencyShort}
          </span>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        {demo && (
          <span className="rounded-full border-2 border-dashed border-[#FFD44D] px-2 py-0.5 font-display text-[9px] tracking-[0.12em] text-[#FFD44D]">
            DEMO
          </span>
        )}
        <span className={cn('font-body text-[10px] font-bold uppercase', active ? 'text-[#151515]/70' : 'text-white/40')}>
          {lines > 0 ? `${lines} line${lines > 1 ? 's' : ''}` : `RTP ${rtp.toFixed(1)}%`}
        </span>
      </div>
    </div>
  );
}