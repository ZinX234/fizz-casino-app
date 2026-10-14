import React from 'react';
import SymbolArt from '@/components/art/SymbolArt';
import { CONFIG } from '@/config/gameConfig';

const ORDER = [
  'DET_A', 'DET_B', 'DET_C', 'DET_D',
  'COFFEE', 'REDLIGHT', 'CONE',
  'CHOC', 'PINK', 'SPRINKLE',
  'WILD', 'SCATTER',
];

// Symbol paytable. Regular pays are multiples of the line bet.
export default function Paytable() {
  return (
    <ul className="grid gap-1.5 sm:grid-cols-2">
      {ORDER.map((id) => {
        const symbol = CONFIG.symbols[id];
        const pays = symbol.pay;
        return (
          <li key={id} className="flex items-center gap-2 rounded-lg border-2 border-[#151515] bg-white/90 px-2 py-1.5">
            <SymbolArt id={id} className="h-9 w-9 shrink-0" />
            <div className="min-w-0">
              <p className="truncate font-body text-[11px] font-extrabold uppercase leading-tight text-[#151515]">
                {symbol.label}
              </p>
              <p className="font-body text-[10px] font-bold leading-tight text-[#151515]/70">
                {pays
                  ? `5 of a kind ${pays[5]}x · 4 ${pays[4]}x · 3 ${pays[3]}x line bet`
                  : '3 or more anywhere: 2x / 10x / 50x total bet'}
                {id === 'WILD' ? ' — substitutes for every symbol' : ''}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}