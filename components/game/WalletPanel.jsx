import React from 'react';
import { Coins, X } from 'lucide-react';
import { CONFIG } from '@/config/gameConfig';
import { formatCoins } from '@/game/format';

// Wallet readout. Real Mode shows the Fizz Coin balance; Demo Play hides the
// balance entirely and shows a DEMO indicator instead.
export default function WalletPanel({ demo, balance, onExitDemo }) {
  if (demo) {
    return (
      <div className="flex items-center gap-1 rounded-xl border-[3px] border-[#FFD44D] bg-[#2A2A2A] px-2 py-1">
        <span className="font-display text-[10px] leading-none tracking-[0.14em] text-[#FFD44D]">DEMO PLAY</span>
        <button
          type="button"
          onClick={onExitDemo}
          aria-label="Exit demo play"
          title="Exit demo play"
          className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-[#FFD44D] text-[#FFD44D] transition hover:bg-[#FFD44D] hover:text-[#151515]"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-xl border-[3px] border-[#151515] bg-[#2A2A2A] px-2.5 py-1">
      <Coins className="h-4 w-4 text-[#FFD44D]" />
      <div className="flex flex-col">
        <span className="font-display text-[9px] leading-none tracking-[0.14em] text-white/60">
          {CONFIG.currency.toUpperCase()}
        </span>
        <span className="font-display text-base leading-tight text-white">{formatCoins(balance)}</span>
      </div>
    </div>
  );
}