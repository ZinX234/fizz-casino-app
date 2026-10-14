import React from 'react';
import { cn } from '@/lib/utils';

// Floating announcement banner over the reels.
export default function WinBanner({ banner, className }) {
  if (!banner) return null;
  return (
    <div className={cn('pointer-events-none absolute left-1/2 top-2 z-40 w-[92%] max-w-md -translate-x-1/2', className)}>
      <div className="dd-rise rounded-2xl border-[5px] border-[#151515] bg-[#FFD44D] px-3 py-2 text-center shadow-[0_8px_0_#151515]">
        <p className="font-display text-[10px] tracking-[0.2em] text-[#151515]/70">{banner.tier}</p>
        <p className="font-display text-lg leading-tight text-[#151515] md:text-2xl">{banner.title}</p>
        {banner.subtitle ? (
          <p className="font-body text-[10px] font-extrabold uppercase tracking-wide text-[#151515]/75 md:text-xs">
            {banner.subtitle}
          </p>
        ) : null}
      </div>
    </div>
  );
}