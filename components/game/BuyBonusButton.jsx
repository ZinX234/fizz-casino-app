import React from 'react';
import { Gift } from 'lucide-react';

// Buy Bonus is staged for the casino wallet integration and stays disabled.
export default function BuyBonusButton() {
  return (
    <div className="group fixed bottom-[150px] left-3 z-40 md:bottom-[112px] md:left-6">
      <button
        type="button"
        disabled
        aria-disabled="true"
        className="flex h-20 w-20 cursor-not-allowed flex-col items-center justify-center rounded-full border-[5px] border-[#151515] bg-[#E8639B] text-[#151515] opacity-90 shadow-[0_6px_0_#151515] md:h-24 md:w-24"
      >
        <Gift className="h-5 w-5 md:h-6 md:w-6" />
        <span className="mt-0.5 font-display text-[9px] leading-none tracking-[0.08em] md:text-[10px]">BUY</span>
        <span className="font-display text-[10px] leading-tight tracking-[0.08em] md:text-xs">BONUS</span>
      </button>
      <span className="pointer-events-none absolute bottom-full left-1/2 mb-2 hidden w-40 -translate-x-1/2 rounded-lg border-2 border-[#151515] bg-[#FFF6E2] px-2 py-1 text-center font-body text-[10px] font-bold text-[#151515] group-hover:block">
        Available after wallet integration.
      </span>
    </div>
  );
}