import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';
import SymbolArt from '@/components/art/SymbolArt';
import * as engine from '@/game/engine';
import { CONFIG } from '@/config/gameConfig';

// One reel column. While spinning it rolls a doubled strip of random symbols,
// then snaps to the final column with a bounce.
export default function Reel({ reel, column, spinning, winKeys, spinId }) {
  const strip = useMemo(
    () => Array.from({ length: CONFIG.rows }, () => engine.randomSymbol(reel)),
    [reel, spinId],
  );
  const cells = spinning ? [...strip, ...strip] : column;

  return (
    <div className={cn('relative h-full w-full overflow-hidden bg-white', spinning ? 'dd-spinning' : 'dd-stopped')}>
      <div className="dd-reel-strip" key={spinning ? 'spin' : 'stop'}>
        {cells.map((symbol, index) => (
          <div
            key={`${index}-${symbol}`}
            className={cn(
              'dd-reel-cell',
              !spinning && winKeys.includes(`${reel}-${index % CONFIG.rows}`) && 'dd-win-cell',
            )}
          >
            <SymbolArt id={symbol} className="h-full w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}