import React from 'react';
import { cn } from '@/lib/utils';

// Round control-bar button with an optional badge.
export default function IconButton({ label, active = false, disabled = false, onClick, children, badge }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        'relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-[3px] border-[#151515] transition-transform active:translate-y-[1px] md:h-11 md:w-11',
        active ? 'bg-[#FFD44D] text-[#151515]' : 'bg-[#333333] text-white/85 hover:bg-[#414141]',
        disabled && 'cursor-not-allowed opacity-40',
      )}
    >
      {children}
      {badge ? (
        <span className="absolute -right-1.5 -top-1.5 min-w-[20px] rounded-full border-2 border-[#151515] bg-[#E14B3B] px-1 text-center font-display text-[9px] leading-[14px] text-white">
          {badge}
        </span>
      ) : null}
    </button>
  );
}