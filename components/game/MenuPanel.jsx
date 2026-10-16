import React from 'react';
import { X } from 'lucide-react';
import Paytable from '@/components/game/Paytable';
import { CONFIG } from '@/config/gameConfig';

// Case file menu: how the game pays and how the features work.
export default function MenuPanel({ onClose, onExit, rtp }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/80 p-3 py-8 backdrop-blur-sm">
      <div className="dd-rise w-full max-w-3xl rounded-3xl border-[5px] border-[#151515] bg-[#F5F2E6] p-4 md:p-6">
        <header className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-xl leading-tight text-[#151515] md:text-2xl">CASE FILE</h2>
            <p className="font-body text-[11px] font-bold uppercase tracking-wide text-[#151515]/70">
              {CONFIG.reels}x{CONFIG.rows} reels · {CONFIG.lineCount} lines
              {` · RTP ${rtp.toFixed(1)}%`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-[3px] border-[#151515] bg-white"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <section className="mb-4 rounded-2xl border-[4px] border-[#151515] bg-white/80 p-3">
          <h3 className="mb-1 font-display text-sm tracking-[0.14em] text-[#151515]">HOW TO PLAY</h3>
          <ul className="list-disc space-y-1 pl-4 font-body text-[11px] font-semibold leading-snug text-[#151515]/85 md:text-xs">
            <li>Match 3 or more identical symbols from either end of any of the {CONFIG.lineCount} lines.</li>
            <li>Wilds never substitute for other symbols; all 5 wilds on a line pay the wild prize.</li>
            <li>Land {CONFIG.features.bonus.minScatters}+ case file scatters anywhere to choose a bonus investigation.</li>
            <li>Gooey is Good can strike on any spin and spray extra wilds across the reels.</li>
            <li>Demo Play never touches a balance — wins there are for show only.</li>
          </ul>
        </section>

        <section className="mb-4">
          <h3 className="mb-2 font-display text-sm tracking-[0.14em] text-[#151515]">PAYTABLE</h3>
          <Paytable />
        </section>

        <footer className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={onExit}
            className="rounded-xl border-[4px] border-[#151515] bg-[#FFD44D] px-4 py-2 font-display text-[11px] tracking-[0.12em] text-[#151515] shadow-[0_5px_0_#151515] active:translate-y-[2px] active:shadow-[0_3px_0_#151515]"
          >
            BACK TO START SCREEN
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border-[4px] border-[#151515] bg-white px-4 py-2 font-display text-[11px] tracking-[0.12em] text-[#151515] shadow-[0_5px_0_#151515] active:translate-y-[2px] active:shadow-[0_3px_0_#151515]"
          >
            CLOSE
          </button>
        </footer>
      </div>
    </div>
  );
}