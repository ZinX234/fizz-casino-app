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

export function getWinningCells(grid, lineWins) {
  const winningCells = new Set();
  lineWins.forEach(({ lineIndex, count }) => {
    const line = PAYLINES[lineIndex];
    if (!line || !Number.isInteger(count)) return;
    for (let reel = 0; reel < Math.min(count, line.length); reel += 1) {
      winningCells.add(`${reel}-${line[reel]}`);
    }
  });
  grid.forEach((column, reel) => column.forEach((symbol, row) => {
    if (symbol === 'SCATTER') winningCells.add(`${reel}-${row}`);
  }));
  return [...winningCells];
}

export function getWinningPaylinePoints(lineWins) {
  return lineWins.flatMap(({ lineIndex, count }) => {
    const line = PAYLINES[lineIndex];
    if (!line || !Number.isInteger(count) || count < 3) return [];
    return [{
      lineIndex,
      points: line.slice(0, Math.min(count, line.length)).map((row, reel) => [
        reel * 100 + 50,
        row * 100 + 50,
      ]),
    }];
  });
}

export default PAYLINES;