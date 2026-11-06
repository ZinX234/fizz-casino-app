import React from 'react';
import { Coins, Gamepad2 } from 'lucide-react';
import DonutLogo from '@/components/art/DonutLogo';
import { CONFIG } from '@/config/gameConfig';

// Mode selection: Fizz Coin play (real wallet) or Demo Play.
export default function ModeSelect({ onReal, onDemo, onBack }) {
  const cardClass =
    'dd-rise flex flex-col items-start gap-2 rounded-3xl border-[5px] border-[#151515] px-5 py-6 text-left shadow-[0_9px_0_#151515] transition hover:-translate-y-1';

  return (
    <div className="relative flex min-h-screen w-full flex-col items-center justify-center gap-6 bg-[#F5F2E6] px-4 py-10">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.18]"
        style={{ backgroundImage: 'radial-gradient(#151515 1px, transparent 1px)', backgroundSize: '22px 22px' }}
      />
      <div className="relative z-10 flex w-full max-w-3xl flex-col items-center gap-5">
        <DonutLogo size="lg" />
        <h2 className="font-display text-base tracking-[0.2em] text-[#151515] md:text-xl">CHOOSE YOUR CASE</h2>

        <div className="grid w-full gap-4 md:grid-cols-2">
          <button type="button" onClick={onReal} className={`${cardClass} bg-[#7BD34A]`}>
            <span className="flex h-12 w-12 items-center justify-center rounded-full border-[4px] border-[#151515] bg-white">
              <Coins className="h-6 w-6 text-[#151515]" />
            </span>
            <span className="font-display text-lg leading-tight text-[#151515] md:text-xl">PLAY WITH FIZZ COINS</span>
            <span className="font-body text-xs font-bold leading-snug text-[#151515]/85">
              Uses your live Fizz Casino wallet. Wagers and payouts are settled by the casino.
            </span>
          </button>

          <button type="button" onClick={onDemo} className={`${cardClass} bg-[#E8639B]`}>
            <span className="flex h-12 w-12 items-center justify-center rounded-full border-[4px] border-[#151515] bg-white">
              <Gamepad2 className="h-6 w-6 text-[#151515]" />
            </span>
            <span className="font-display text-lg leading-tight text-[#151515] md:text-xl">PLAY DEMO</span>
            <span className="font-body text-xs font-bold leading-snug text-[#151515]/85">
              Unlimited free gameplay. No balance displayed, no currency tracked.
            </span>
          </button>
        </div>

        <button
          type="button"
          onClick={onBack}
          className="font-body text-xs font-extrabold uppercase tracking-[0.18em] text-[#151515]/60 underline"
        >
          Back to briefing
        </button>
      </div>
    </div>
  );
}