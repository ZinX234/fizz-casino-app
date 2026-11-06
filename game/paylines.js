// 25 paylines over a 5x5 grid. Each pattern lists the row index (0 = top)
// used on every reel, from reel 1 to reel 5.

export const PAYLINES = [
  [2, 2, 2, 2, 2],
  [0, 0, 0, 0, 0],
  [4, 4, 4, 4, 4],
  [1, 1, 1, 1, 1],
  [3, 3, 3, 3, 3],
  [0, 1, 2, 1, 0],
  [4, 3, 2, 3, 4],
  [1, 2, 3, 2, 1],
  [3, 2, 1, 2, 3],
  [0, 1, 2, 3, 4],
  [4, 3, 2, 1, 0],
  [1, 1, 2, 1, 1],
  [3, 3, 2, 3, 3],
  [0, 0, 1, 0, 0],
  [4, 4, 3, 4, 4],
  [2, 1, 1, 1, 2],
  [2, 3, 3, 3, 2],
  [1, 0, 0, 0, 1],
  [3, 4, 4, 4, 3],
  [0, 1, 1, 1, 0],
  [4, 3, 3, 3, 4],
  [2, 2, 1, 2, 2],
  [0, 1, 0, 1, 0],
  [4, 3, 4, 3, 4],
  [2, 1, 2, 1, 2],
];

export function getWinningLineWins(grid, lineWins) {
  return lineWins.flatMap(({ lineIndex, symbol, count, direction, multiplier }) => {
    const line = PAYLINES[lineIndex];
    if (!line || !Number.isInteger(count) || count < 3 || count > line.length) return [];
    if (!symbol || symbol === 'SCATTER' || (symbol === 'WILD' && count !== line.length)) return [];
    const matchesDirection = (matchDirection) => {
      const matched = Array.from({ length: count }, (_, offset) => {
        const reel = matchDirection === 'left' ? offset : line.length - 1 - offset;
        return grid[reel]?.[line[reel]] === symbol;
      }).every(Boolean);
      if (!matched) return false;
      const nextOffset = count;
      if (nextOffset === line.length) return true;
      const nextReel = matchDirection === 'left' ? nextOffset : line.length - 1 - nextOffset;
      return grid[nextReel]?.[line[nextReel]] !== symbol;
    };
    const resolvedDirection = direction === 'left' || direction === 'right'
      ? (matchesDirection(direction) ? direction : null)
      : matchesDirection('left') ? 'left' : matchesDirection('right') ? 'right' : null;
    if (!resolvedDirection) return [];
    const nextMultiplier = Number.isFinite(multiplier) ? multiplier : undefined;
    return [{ lineIndex, symbol, count, direction: resolvedDirection, ...(nextMultiplier ? { multiplier: nextMultiplier } : {}) }];
  });
}

export function getWinningCells(grid, lineWins, minimumScatters = 3) {
  const winningCells = new Set();
  getWinningLineWins(grid, lineWins).forEach(({ lineIndex, count, direction }) => {
    const line = PAYLINES[lineIndex];
    for (let offset = 0; offset < Math.min(count, line.length); offset += 1) {
      const reel = direction === 'left' ? offset : line.length - 1 - offset;
      winningCells.add(`${reel}-${line[reel]}`);
    }
  });
  const scatterCount = grid.reduce(
    (total, column) => total + column.filter((symbol) => symbol === 'SCATTER').length,
    0,
  );
  if (scatterCount >= minimumScatters) {
    grid.forEach((column, reel) => column.forEach((symbol, row) => {
      if (symbol === 'SCATTER') winningCells.add(`${reel}-${row}`);
    }));
  }
  return [...winningCells];
}

export default PAYLINES;