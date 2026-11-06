import React from 'react';
import { FolderOpen, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getBonusChoice } from '@/game/bonus';
import { formatCoins } from '@/game/format';
import { CONFIG } from '@/config/gameConfig';

// Detective Pick Bonus: reveal clue cards from the investigation board.
export default function PickBonusBoard({ pickBonus, onPick, bet }) {
  if (!pickBonus) return null;
  const { picks, total } = pickBonus;
  const required = getBonusChoice('pick').picks;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-black/85 p-3 backdrop-blur-sm">
      <header className="text-center">
        <h2 className="font-display text-xl text-[#7BD34A] md:text-3xl" style={{ WebkitTextStroke: '5px #151515' }}>
          DETECTIVE PICK BONUS
        </h2>
        <p className="font-body text-xs font-bold uppercase tracking-wide text-white/80">
          Tap a case file to reveal a prize · {picks} / {required} opened
        </p>
      </header>

      <div className="grid w-full max-w-2xl grid-cols-3 gap-2 md:grid-cols-4 md:gap-3">
        {pickBonus.cards.map((card, index) => (
          <button
            key={card.id}
            type="button"
            onClick={() => onPick(card.id)}
            disabled={card.revealed || picks >= required}
            style={{ animationDelay: `${index * 0.04}s` }}
            className={cn(
              'dd-rise flex aspect-[4/3] flex-col items-center justify-center gap-1 rounded-xl border-[4px] border-[#151515] px-1 text-center transition',
              card.revealed
                ? 'bg-[#FFD44D]'
                : 'bg-[#F6E4BE] hover:-translate-y-1 hover:bg-white disabled:opacity-70',
            )}
          >
            {card.revealed ? (
              <>
                <span className="font-display text-lg leading-none text-[#151515] md:text-2xl">{card.value}x</span>
                <span className="font-body text-[9px] font-extrabold uppercase text-[#151515]/70">
                  {formatCoins(card.value * bet)} {CONFIG.currencyShort}
                </span>
              </>
            ) : (
              <>
                <FolderOpen className="h-5 w-5 text-[#151515]" />
                <span className="font-display text-[9px] tracking-[0.1em] text-[#151515]/70">CASE {index + 1}</span>
              </>
            )}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 rounded-xl border-[4px] border-[#151515] bg-[#2A2A2A] px-4 py-1.5">
        <Search className="h-4 w-4 text-[#7BD34A]" />
        <span className="font-display text-sm text-white md:text-base">
          {formatCoins(total)} {CONFIG.currencyShort}
        </span>
      </div>
    </div>
  );
}