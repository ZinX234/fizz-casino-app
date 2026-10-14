import React from 'react';
import { RotateCw } from 'lucide-react';
import { cn } from '@/lib/utils';

// Large circular spin button.
export default function SpinButton({ onSpin, disabled, spinning, dimmed = false }) {
  return (
    <button
      type="button"
      onClick={onSpin}
      disabled={disabled}
      aria-label="Spin"
      className={cn(
        'group relative flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-full border-[5px] border-[#151515] bg-[linear-gradient(180deg,#FFFFFF_0%,#D7D7D7_100%)] shadow-[0_6px_0_#151515] transition-transform active:translate-y-[4px] active:shadow-[0_2px_0_#151515] md:h-20 md:w-20',
        disabled && 'cursor-not-allowed opacity-50 shadow-[0_6px_0_#151515]',
        !disabled && dimmed && 'opacity-60 saturate-50',
      )}
    >
      <RotateCw className={cn('h-6 w-6 text-[#151515] md:h-8 md:w-8', spinning && 'animate-spin')} />
      <span className="mt-0.5 font-display text-[9px] leading-none tracking-[0.12em] text-[#151515] md:text-[10px]">
        SPIN
      </span>
    </button>
  );
}