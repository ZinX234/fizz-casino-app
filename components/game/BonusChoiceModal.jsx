import React from 'react';
import { Eye, Search, Star } from 'lucide-react';
import { bonusChoices } from '@/game/bonus';
import { CONFIG } from '@/config/gameConfig';

const ICONS = { sticky: Star, pick: Search, surveillance: Eye };
const TONE = { sticky: 'bg-[#E8639B]', pick: 'bg-[#7BD34A]', surveillance: 'bg-[#5AA9E6]' };

// 3+ scatters open the bonus choice screen.
export default function BonusChoiceModal({ onSelect }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-black/85 p-4 backdrop-blur-sm">
      <header className="text-center">
        <h2 className="font-display text-2xl text-[#FFD44D] md:text-4xl" style={{ WebkitTextStroke: '6px #151515' }}>
          BONUS CHOICE
        </h2>
        <p className="mt-1 font-body text-xs font-bold uppercase tracking-wide text-white/80 md:text-sm">
          Case files unlocked — pick your investigation
        </p>
      </header>

      <div className="grid w-full max-w-5xl gap-3 md:grid-cols-3">
        {bonusChoices().map((choice, index) => {
          const Icon = ICONS[choice.id] || Star;
          return (
            <button
              key={choice.id}
              type="button"
              onClick={() => onSelect(choice.id)}
              style={{ animationDelay: `${index * 0.08}s` }}
              className="dd-rise dd-paper flex flex-col items-center gap-2 border-[5px] border-[#151515] bg-[#FFF6E2] px-4 py-5 text-center transition hover:-translate-y-1 hover:bg-white"
            >
              <span className={`flex h-12 w-12 items-center justify-center rounded-full border-[4px] border-[#151515] ${TONE[choice.id] || 'bg-[#FFD44D]'}`}>
                <Icon className="h-6 w-6 text-[#151515]" />
              </span>
              <span className="font-display text-[10px] tracking-[0.18em] text-[#151515]/60">BONUS {String.fromCharCode(65 + index)}</span>
              <span className="font-display text-base leading-tight text-[#151515] md:text-lg">{choice.title}</span>
              <span className="rounded-full border-2 border-[#151515] bg-[#FFD44D] px-2 py-0.5 font-body text-[10px] font-extrabold uppercase text-[#151515]">
                {choice.tagline}
              </span>
              <span className="font-body text-xs font-semibold leading-snug text-[#151515]/80">{choice.description}</span>
            </button>
          );
        })}
      </div>

      <p className="font-body text-[10px] font-bold uppercase tracking-wide text-white/50">
        Bonus features pay in {CONFIG.currency}
      </p>
    </div>
  );
}