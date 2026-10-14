import React from 'react';
import { X } from 'lucide-react';
import { CONFIG } from '@/config/gameConfig';
import { formatCoins } from '@/game/format';

// Settings: game feel plus the integration status of the Fizz Coin wallet.
export default function SettingsPanel({ game, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/80 p-3 py-8 backdrop-blur-sm">
      <div className="dd-rise w-full max-w-lg rounded-3xl border-[5px] border-[#151515] bg-[#F5F2E6] p-4 md:p-6">
        <header className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-display text-xl text-[#151515]">SETTINGS</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className="flex h-9 w-9 items-center justify-center rounded-full border-[3px] border-[#151515] bg-white"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="space-y-3">
          <label className="flex items-center justify-between gap-3 rounded-2xl border-[4px] border-[#151515] bg-white/85 px-3 py-2">
            <span className="font-body text-xs font-extrabold uppercase tracking-wide text-[#151515]">Sound effects</span>
            <button type="button" role="switch" aria-checked={game.soundOn} onClick={game.toggleSound} className={`h-6 w-11 rounded-full border-2 border-[#151515] p-0.5 transition ${game.soundOn ? 'bg-[#7BD34A]' : 'bg-[#d5d5d5]'}`}>
              <span className={`block h-4 w-4 rounded-full border border-[#151515] bg-white transition-transform ${game.soundOn ? 'translate-x-5' : ''}`} />
            </button>
          </label>
          <label className="flex items-center justify-between gap-3 rounded-2xl border-[4px] border-[#151515] bg-white/85 px-3 py-2">
            <span className="font-body text-xs font-extrabold uppercase tracking-wide text-[#151515]">Quick spin</span>
            <button type="button" role="switch" aria-checked={game.quickSpin} onClick={game.toggleQuickSpin} className={`h-6 w-11 rounded-full border-2 border-[#151515] p-0.5 transition ${game.quickSpin ? 'bg-[#7BD34A]' : 'bg-[#d5d5d5]'}`}>
              <span className={`block h-4 w-4 rounded-full border border-[#151515] bg-white transition-transform ${game.quickSpin ? 'translate-x-5' : ''}`} />
            </button>
          </label>

          <div className="rounded-2xl border-[4px] border-[#151515] bg-white/85 px-3 py-3">
            <h3 className="mb-1 font-display text-xs tracking-[0.14em] text-[#151515]">GAME INFO</h3>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1 font-body text-[11px] font-bold text-[#151515]/85">
              <dt>Lines</dt>
              <dd className="text-right">{CONFIG.lineCount}</dd>
              <dt>RTP</dt>
              <dd className="text-right">{game.rtp.toFixed(1)}%</dd>
              <dt>House edge</dt>
              <dd className="text-right">{(100 - game.rtp).toFixed(1)}%</dd>
              <dt>Bet options</dt>
              <dd className="text-right">{CONFIG.bets.options.join(' / ')}</dd>
              <dt>Max win</dt>
              <dd className="text-right">{CONFIG.features.maxWin.multiplier.toLocaleString('en-US')}x bet</dd>
            </dl>
          </div>

          <div className="rounded-2xl border-[4px] border-dashed border-[#151515] bg-[#FFF6E2] px-3 py-3">
            <h3 className="mb-1 font-display text-xs tracking-[0.14em] text-[#151515]">WALLET</h3>
            <p className="font-body text-[11px] font-bold leading-snug text-[#151515]/85">
              {game.demo
                ? 'Demo Play is active — no balance is tracked and wins are visual only.'
                : `Live Fizzcoin balance: ${formatCoins(game.balance)}. Wagers and payouts are settled by Fizz Casino.`}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}