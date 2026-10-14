import React from 'react';
import { cn } from '@/lib/utils';
import Confetti from '@/components/game/Confetti';
import { formatCoins } from '@/game/format';
import { CONFIG } from '@/config/gameConfig';

const STAGES = ['board', 'files', 'clues', 'links', 'solved'];
const CLUES = [
  'EVIDENCE: GOO TRACES',
  'WITNESS: ROOKIE REYES',
  'PRINT MATCH: CONFIRMED',
  'SUSPECT: THE MAYOR',
  'MOTIVE: LAST COFFEE',
  'CASE NO: DD-12500',
];
const LINKS = ['M18 30 L52 62', 'M52 62 L84 34', 'M18 72 L52 62', 'M84 70 L52 62'];

// Max Win: the investigation board comes together and the case is solved.
export default function MaxWinSequence({ maxWin }) {
  if (!maxWin) return null;
  const stageIndex = STAGES.indexOf(maxWin.stage);
  const visible = stageIndex === 4 ? 6 : Math.min(stageIndex * 2, 6);

  return (
    <div
      className={cn(
        'fixed inset-0 z-[60] flex items-center justify-center bg-black/92 p-3',
        maxWin.stage === 'solved' && 'dd-shake',
      )}
    >
      {maxWin.stage === 'solved' ? <Confetti count={46} /> : null}

      <div className="relative w-full max-w-3xl">
        <div className="relative rounded-[26px] border-[7px] border-[#151515] bg-[linear-gradient(180deg,#4A392A,#2E2318)] p-3 md:p-5">
          <p className="mb-2 text-center font-display text-[10px] tracking-[0.24em] text-[#FFD44D] md:text-xs">
            DIVISION EVIDENCE BOARD
          </p>

          <div className="relative rounded-2xl border-[5px] border-[#151515] bg-[#6B523A] p-3">
            <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              {LINKS.map((path, index) => (
                <path
                  key={path}
                  d={path}
                  className={cn('dd-string', stageIndex >= 3 ? 'opacity-100' : 'opacity-0')}
                  fill="none"
                  stroke="#D8412F"
                  strokeWidth="0.8"
                  style={{ animationDelay: `${index * 0.15}s` }}
                />
              ))}
            </svg>

            <div className="grid grid-cols-2 gap-2 md:grid-cols-3 md:gap-3">
              {CLUES.map((clue, index) => (
                <div
                  key={clue}
                  className={cn(
                    'dd-rise rounded-lg border-[3px] border-[#151515] bg-[#FFF6E2] px-2 py-2 text-center',
                    index >= visible && 'opacity-20',
                  )}
                >
                  <p className="font-body text-[9px] font-extrabold uppercase leading-tight tracking-wide text-[#151515]/80 md:text-[10px]">
                    {clue}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {maxWin.stage === 'solved' ? (
            <div className="mt-3 flex flex-col items-center gap-2">
              <p className="dd-stamp rounded-lg border-[5px] border-[#D8412F] px-4 py-1 font-display text-xl text-[#D8412F] md:text-3xl">
                CASE SOLVED!
              </p>
              <p className="font-display text-2xl text-[#FFD44D] md:text-4xl" style={{ WebkitTextStroke: '5px #151515' }}>
                {formatCoins(maxWin.amount)} {CONFIG.currencyShort}
              </p>
              <p className="font-body text-[10px] font-extrabold uppercase tracking-[0.2em] text-white/80">
                {CONFIG.features.maxWin.multiplier.toLocaleString('en-US')}x maximum win
              </p>
            </div>
          ) : (
            <p className="mt-3 text-center font-body text-[10px] font-extrabold uppercase tracking-[0.2em] text-white/70">
              {maxWin.stage === 'board' && 'Opening the case files…'}
              {maxWin.stage === 'files' && 'Evidence logged…'}
              {maxWin.stage === 'clues' && 'Clues revealed…'}
              {maxWin.stage === 'links' && 'Connecting the dots…'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}