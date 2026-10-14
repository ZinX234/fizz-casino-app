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
  return lineWins.filter(({ lineIndex, symbol, count }) => {
    const line = PAYLINES[lineIndex];
    if (!line || !Number.isInteger(count) || count < 3 || count > line.length) return false;
    if (!symbol || symbol === 'SCATTER') return false;
    return line.slice(0, count).every((row, reel) =>
      grid[reel]?.[row] === symbol || (symbol !== 'WILD' && grid[reel]?.[row] === 'WILD'));
  });
}

export function getWinningCells(grid, lineWins, minimumScatters = 3) {
  const winningCells = new Set();
  getWinningLineWins(grid, lineWins).forEach(({ lineIndex, count }) => {
    const line = PAYLINES[lineIndex];
    for (let reel = 0; reel < Math.min(count, line.length); reel += 1) {
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