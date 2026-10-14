import React from 'react';
import Reel from '@/components/game/Reel';
import { CONFIG } from '@/config/gameConfig';
import { getWinningPaylinePoints } from '@/game/paylines';

// The 5x5 play area: white reels separated by thin grey lines.
export default function ReelGrid({ grid, spinning, stoppedReels, winCells, winLines, spinId }) {
  const winningPaths = getWinningPaylinePoints(winLines);

  return (
    <div className="relative h-full w-full">
      <div
        className="grid h-full w-full grid-cols-5 grid-rows-1 gap-[2px] bg-[#C9C9C9]"
        style={{
          gridTemplateColumns: `repeat(${CONFIG.reels}, minmax(0, 1fr))`,
          gridTemplateRows: 'minmax(0, 1fr)',
          '--dd-rows': CONFIG.rows,
        }}
      >
        {grid.map((column, reel) => (
          <Reel
            key={reel}
            reel={reel}
            column={column}
            spinning={spinning && stoppedReels <= reel}
            winKeys={winCells}
            spinId={spinId}
          />
        ))}
      </div>
      {winningPaths.length > 0 ? (
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-10 h-full w-full"
          viewBox="0 0 500 500"
          preserveAspectRatio="none"
        >
          {winningPaths.map(({ lineIndex, points }) => {
            const coordinates = points.map(([x, y]) => `${x},${y}`).join(' ');
            return (
              <g key={lineIndex} fill="none" strokeLinecap="round" strokeLinejoin="round">
                <polyline points={coordinates} stroke="#151515" strokeWidth="10" />
                <polyline points={coordinates} stroke="#FFD44D" strokeWidth="5" />
              </g>
            );
          })}
        </svg>
      ) : null}
    </div>
  );
}