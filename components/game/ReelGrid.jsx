import React from 'react';
import Reel from '@/components/game/Reel';
import { CONFIG } from '@/config/gameConfig';

// The 5x5 play area: white reels separated by thin grey lines.
export default function ReelGrid({ grid, spinning, stoppedReels, winCells, spinId }) {
  return (
    <div
      className="grid h-full w-full gap-[2px] bg-[#C9C9C9]"
      style={{
        gridTemplateColumns: `repeat(${CONFIG.reels}, minmax(0, 1fr))`,
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
  );
}