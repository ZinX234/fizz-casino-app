import React from 'react';
import { cn } from '@/lib/utils';

const WIDTHS = {
  lg: 'w-[min(56vw,340px)]',
  md: 'w-[min(50vw,260px)]',
  sm: 'w-[min(30vw,120px)]',
};

const TEXT_SIZES = {
  lg: ['text-3xl md:text-5xl', 'text-2xl md:text-4xl'],
  md: ['text-2xl md:text-4xl', 'text-xl md:text-3xl'],
  sm: ['text-sm', 'text-xs'],
};

export default function DonutLogo({ size = 'md', className = '' }) {
  const [topTextSize, bottomTextSize] = TEXT_SIZES[size] || TEXT_SIZES.md;
  return (
    <div
      role="img"
      aria-label="Donut Division"
      className={cn('flex items-center justify-center gap-2', WIDTHS[size] || WIDTHS.md, className)}
    >
      <svg viewBox="0 0 72 72" className="h-auto w-[28%] shrink-0 drop-shadow-[0_3px_0_#151515]" aria-hidden="true">
        <circle cx="36" cy="36" r="29" fill="#FF7FBE" stroke="#151515" strokeWidth="6" />
        <circle cx="36" cy="36" r="10" fill="#FFF6E2" stroke="#151515" strokeWidth="5" />
        <path d="M14 26l7 2m22-9 1 7m13 9 6-3M23 48l-5 4m30 3 2 6" stroke="#FFD44D" strokeWidth="4" strokeLinecap="round" />
        <path d="M29 10l2 6m24 13 6-2M14 39l6 1m22 18 1-5" stroke="#80D9F4" strokeWidth="4" strokeLinecap="round" />
      </svg>
      <span className="flex min-w-0 flex-col font-display leading-[0.82] drop-shadow-[0_2px_0_#151515]">
        <span className={`${topTextSize} tracking-wide text-[#FF7FBE]`}>DONUT</span>
        <span className={`${bottomTextSize} mt-1 tracking-[0.08em] text-[#FFD44D]`}>DIVISION</span>
      </span>
    </div>
  );
}