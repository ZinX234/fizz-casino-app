import { createHmac, createHash } from 'node:crypto'
import type { SweetBonanzaProfile, SweetBonanzaSymbol } from './sweet-bonanza-config'

export interface SlotPosition {
  row: number
  col: number
}

export interface SlotGrid {
  rows: 6
  cols: 5
  symbols: SweetBonanzaSymbol[][]
}

export interface SlotResult {
  grid: SlotGrid
  winningPositions: SlotPosition[]
  winningSymbol: SweetBonanzaSymbol | null
  symbolCount: number
  baseMultiplier: number
  finalMultiplier: number
  payout: number
  isBonusTriggered: boolean
  bonusSpinsRemaining?: number
  bonusMultiplier?: number
}

export function generateWeightedSlotGrid(
  serverSeed: string,
  clientSeed: string,
  sessionId: string,
  profile: SweetBonanzaProfile,
  isBonus: boolean = false,
): SlotGrid {
  const totalWeight = Object.values(profile.symbols).reduce((sum, sym) => sum + sym.weight, 0)
  const symbols: SweetBonanzaSymbol[] = ['a', 'b', 'c', 'g', 'h', 'm', 'p', 's', 'z', 'scatter']

  const grid: SweetBonanzaSymbol[][] = []

  for (let row = 0; row < 6; row++) {
    const gridRow: SweetBonanzaSymbol[] = []
    for (let col = 0; col < 5; col++) {
      const symbol = pickWeightedSymbol(serverSeed, clientSeed, sessionId, row, col, profile, totalWeight, symbols)
      gridRow.push(symbol)
    }
    grid.push(gridRow)
  }

  return { rows: 6, cols: 5, symbols: grid }
}

function pickWeightedSymbol(
  serverSeed: string,
  clientSeed: string,
  sessionId: string,
  row: number,
  col: number,
  profile: SweetBonanzaProfile,
  totalWeight: number,
  symbols: SweetBonanzaSymbol[],
): SweetBonanzaSymbol {
  const input = `sweet-bonanza:${clientSeed}:${sessionId}:${row}:${col}`
  const digest = createHmac('sha256', serverSeed).update(input).digest()
  const ticket = digest.readUInt32BE(0) % totalWeight

  let cumulative = 0
  for (const symbol of symbols) {
    cumulative += profile.symbols[symbol].weight
    if (ticket < cumulative) return symbol
  }

  return symbols[symbols.length - 1]
}

export function calculateSlotWin(grid: SlotGrid, profile: SweetBonanzaProfile, isBonus: boolean = false): SlotResult {
  const symbolCounts: Record<SweetBonanzaSymbol, number> = {
    a: 0, b: 0, c: 0, g: 0, h: 0, m: 0, p: 0, s: 0, z: 0, scatter: 0,
  }

  // Count all symbols on the grid
  for (let row = 0; row < grid.rows; row++) {
    for (let col = 0; col < grid.cols; col++) {
      const symbol = grid.symbols[row][col]
      symbolCounts[symbol]++
    }
  }

  // Check for scatter (bonus trigger)
  const scatterCount = symbolCounts.scatter
  const isBonusTriggered = scatterCount >= 4

  // Find the highest-paying winning symbol
  let bestSymbol: SweetBonanzaSymbol | null = null
  let bestCount = 0
  let bestMultiplier = 0

  const symbolOrder: SweetBonanzaSymbol[] = ['z', 's', 'p', 'm', 'h', 'g', 'c', 'b', 'a']

  for (const symbol of symbolOrder) {
    const count = symbolCounts[symbol]
    const minMatch = profile.symbols[symbol].minMatch

    if (count >= minMatch) {
      const multiplier = calculateSymbolMultiplier(symbol, count, profile)
      if (multiplier > bestMultiplier) {
        bestSymbol = symbol
        bestCount = count
        bestMultiplier = multiplier
      }
    }
  }

  if (!bestSymbol) {
    return {
      grid,
      winningPositions: [],
      winningSymbol: null,
      symbolCount: 0,
      baseMultiplier: 0,
      finalMultiplier: 0,
      payout: 0,
      isBonusTriggered,
      bonusSpinsRemaining: isBonusTriggered ? profile.bonusFreeSpins : undefined,
      bonusMultiplier: isBonus ? 0 : undefined,
    } as SlotResult
  }

  // Find all positions of the winning symbol
  const winningPositions: SlotPosition[] = []
  for (let row = 0; row < grid.rows; row++) {
    for (let col = 0; col < grid.cols; col++) {
      if (grid.symbols[row][col] === bestSymbol) {
        winningPositions.push({ row, col })
      }
    }
  }

  // Apply multiplier if enabled
  let finalMultiplier = bestMultiplier
  if (profile.multiplierEnabled) {
    if (isBonus && profile.guaranteedMultiplierInBonus) {
      // Bonus mode: guaranteed multiplier between min and max
      const range = profile.bonusMultiplierMax - profile.bonusMultiplierMin
      const digest = createHash('sha256').update(serverSeedForMultiplier(grid, profile) + ':bonus').digest()
      const value = digest.readUInt32BE(0) % (range + 1)
      finalMultiplier = profile.bonusMultiplierMin + value
    } else {
      finalMultiplier = applyRandomMultiplier(bestMultiplier, serverSeedForMultiplier(grid, profile))
    }
  }

  return {
    grid,
    winningPositions,
    winningSymbol: bestSymbol,
    symbolCount: bestCount,
    baseMultiplier: bestMultiplier,
    finalMultiplier,
    payout: finalMultiplier,
    isBonusTriggered,
    bonusSpinsRemaining: isBonusTriggered ? profile.bonusFreeSpins : undefined,
    bonusMultiplier: isBonus ? finalMultiplier : undefined,
  }
}

function calculateSymbolMultiplier(symbol: SweetBonanzaSymbol, count: number, profile: SweetBonanzaProfile): number {
  const config = profile.symbols[symbol]
  const baseMultiplier = config.payoutMultiplier

  if (count < config.minMatch) return 0

  // Progressive multipliers based on symbol count
  if (count >= 12) return baseMultiplier * 2.5
  if (count >= 10) return baseMultiplier * 1.5
  if (count >= 8) return baseMultiplier

  return 0
}

function applyRandomMultiplier(baseMultiplier: number, seed: string): number {
  if (baseMultiplier === 0) return 0

  const digest = createHash('sha256').update(seed).digest()
  const value = digest.readUInt32BE(0) % 100

  // Multiplier probabilities: 2x (40%), 3x (25%), 5x (20%), 10x (10%), 25x (5%)
  if (value < 40) return baseMultiplier * 2
  if (value < 65) return baseMultiplier * 3
  if (value < 85) return baseMultiplier * 5
  if (value < 95) return baseMultiplier * 10
  return baseMultiplier * 25
}

function serverSeedForMultiplier(grid: SlotGrid, profile: SweetBonanzaProfile): string {
  const gridString = grid.symbols.map(row => row.join('')).join('')
  return createHash('sha256').update(gridString + profile.id).digest('hex')
}

export function calculatePayoutForRtp(basePayout: number, rtpBps: number): number {
  const rtp = rtpBps / 10000
  return Math.floor(basePayout * rtp * 100) / 100
}
