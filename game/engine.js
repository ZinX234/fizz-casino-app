// Game engine: weighted symbol generation, grid helpers and win evaluation.
// Pure functions only — no React, no DOM.

import { CONFIG } from '@/config/gameConfig';
import { PAYLINES } from '@/game/paylines';

const SYMBOL_IDS = Object.keys(CONFIG.symbols);
const REGULAR_IDS = SYMBOL_IDS.filter((id) => id !== 'SCATTER');

function weightOf(reel, symbolId) {
  const base = CONFIG.weights.base[symbolId] || 0;
  const modifier = (CONFIG.weights.perReel[reel] || {})[symbolId] ?? 1;
  return base * modifier;
}

export function randomSymbol(reel) {
  const total = SYMBOL_IDS.reduce((sum, id) => sum + weightOf(reel, id), 0);
  let roll = Math.random() * total;
  for (const id of SYMBOL_IDS) {
    roll -= weightOf(reel, id);
    if (roll <= 0) return id;
  }
  return SYMBOL_IDS[0];
}

export function emptyGrid() {
  return Array.from({ length: CONFIG.reels }, (_, reel) =>
    Array.from({ length: CONFIG.rows }, () => randomSymbol(reel)),
  );
}

/** Build a grid; sticky wild positions (from the free spins feature) are forced. */
export function generateGrid(sticky = []) {
  const grid = emptyGrid();
  sticky.forEach(({ reel, row }) => {
    if (grid[reel] && grid[reel][row] !== undefined) grid[reel][row] = 'WILD';
  });
  return grid;
}

/** Drop random wilds onto the grid (Mystery Surveillance / Gooey feature). */
export function dropWilds(grid, count) {
  const next = grid.map((column) => [...column]);
  const spots = [];
  next.forEach((column, reel) => column.forEach((symbol, row) => {
    if (symbol !== 'WILD' && symbol !== 'SCATTER') spots.push([reel, row]);
  }));
  for (let i = 0; i < count && spots.length; i += 1) {
    const pick = Math.floor(Math.random() * spots.length);
    const [reel, row] = spots.splice(pick, 1)[0];
    next[reel][row] = 'WILD';
  }
  return next;
}

export function scatterInfo(grid) {
  const positions = [];
  grid.forEach((column, reel) => column.forEach((symbol, row) => {
    if (symbol === 'SCATTER') positions.push([reel, row]);
  }));
  return { count: positions.length, positions };
}

/** Evaluate all 25 paylines plus scatter pays. */
export function evaluateGrid(grid, bet) {
  const lineBet = bet / PAYLINES.length;
  const wins = [];

  PAYLINES.forEach((line, lineIndex) => {
    let best = null;
    REGULAR_IDS.forEach((symbolId) => {
      let count = 0;
      for (let reel = 0; reel < CONFIG.reels; reel += 1) {
        const cell = grid[reel][line[reel]];
        const matches = cell === symbolId || (cell === 'WILD' && symbolId !== 'WILD');
        if (!matches) break;
        count += 1;
      }
      if (count < 3) return;
      const multiplier = CONFIG.symbols[symbolId].pay[count];
      if (!multiplier) return;
      const amount = multiplier * lineBet;
      if (!best || amount > best.amount) {
        best = {
          lineIndex,
          symbol: symbolId,
          count,
          amount,
          positions: Array.from({ length: count }, (_, reel) => [reel, line[reel]]),
        };
      }
    });
    if (best) wins.push(best);
  });

  const { count: scatterCount, positions: scatterPositions } = scatterInfo(grid);
  let scatterAmount = 0;
  if (scatterCount >= CONFIG.features.bonus.minScatters) {
    const multiplier = CONFIG.symbols.SCATTER.payAnywhere[Math.min(scatterCount, 5)];
    if (multiplier) scatterAmount = multiplier * bet;
  }

  const winCells = new Set();
  wins.forEach((win) => win.positions.forEach(([reel, row]) => winCells.add(`${reel}-${row}`)));
  scatterPositions.forEach(([reel, row]) => winCells.add(`${reel}-${row}`));

  return {
    wins,
    total: wins.reduce((sum, win) => sum + win.amount, 0) + scatterAmount,
    lineTotal: wins.reduce((sum, win) => sum + win.amount, 0),
    lineIndexes: wins.map((win) => win.lineIndex),
    scatterCount,
    scatterPositions,
    scatterAmount,
    winCells: [...winCells],
  };
}

/** Random feature roll that happens after a normal spin. */
export function rollRandomFeature() {
  const roll = Math.random();
  const { maxWin, gooey } = CONFIG.features;
  if (roll < maxWin.chance) return 'maxWin';
  if (roll < maxWin.chance + gooey.chance) return 'gooey';
  return null;
}

export function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function pickOne(list) {
  return list[Math.floor(Math.random() * list.length)];
}