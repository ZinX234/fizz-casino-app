import { createHmac } from 'node:crypto'

export const DONUT_BONUS_CHOICES = ['sticky', 'pick', 'surveillance'] as const
export type DonutBonusChoice = (typeof DONUT_BONUS_CHOICES)[number]
export type DonutSymbol =
  | 'SPRINKLE'
  | 'PINK'
  | 'CHOC'
  | 'CONE'
  | 'REDLIGHT'
  | 'COFFEE'
  | 'DET_D'
  | 'DET_C'
  | 'DET_B'
  | 'DET_A'
  | 'WILD'
  | 'SCATTER'
export type DonutGrid = DonutSymbol[][]

const REELS = 5
const ROWS = 5
const LINE_COUNT = 25
const STICKY_SPINS = 10
const SURVEILLANCE_SPINS = 5
const BONUS_MIN_SCATTERS = 3
const PICK_PRIZES = [1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25]
const GOOEY_CHANCE = 0.005
const MAX_WIN_CHANCE = 0.0000012
const MAX_WIN_MULTIPLIER = 12_500
const REGULAR_SYMBOLS: DonutSymbol[] = [
  'SPRINKLE', 'PINK', 'CHOC', 'CONE', 'REDLIGHT', 'COFFEE',
  'DET_D', 'DET_C', 'DET_B', 'DET_A', 'WILD',
]
export const DONUT_SYMBOLS: DonutSymbol[] = [...REGULAR_SYMBOLS, 'SCATTER']
const BASE_WEIGHTS: Record<DonutSymbol, number> = {
  SPRINKLE: 34,
  PINK: 30,
  CHOC: 26,
  CONE: 18,
  REDLIGHT: 14,
  COFFEE: 10,
  DET_D: 8,
  DET_C: 6,
  DET_B: 4,
  DET_A: 3,
  WILD: 3,
  SCATTER: 1.5,
}
const REEL_MODIFIERS: Array<Partial<Record<DonutSymbol, number>>> = [
  { WILD: 0.8 },
  { WILD: 1 },
  { WILD: 1.2, SCATTER: 1.4 },
  { WILD: 1 },
  { WILD: 0.8, SCATTER: 1.2 },
]
const PAYTABLE: Partial<Record<DonutSymbol, Partial<Record<number, number>>>> = {
  SPRINKLE: { 3: 10, 4: 30, 5: 100 },
  PINK: { 3: 12, 4: 40, 5: 150 },
  CHOC: { 3: 15, 4: 50, 5: 200 },
  CONE: { 3: 20, 4: 80, 5: 400 },
  REDLIGHT: { 3: 25, 4: 120, 5: 600 },
  COFFEE: { 3: 30, 4: 200, 5: 1_000 },
  DET_D: { 3: 40, 4: 300, 5: 1_200 },
  DET_C: { 3: 50, 4: 400, 5: 1_600 },
  DET_B: { 3: 75, 4: 600, 5: 2_500 },
  DET_A: { 3: 100, 4: 1_000, 5: 5_000 },
  WILD: { 3: 150, 4: 2_000, 5: 12_500 },
}
const SCATTER_PAYS: Record<number, number> = { 3: 2, 4: 10, 5: 50 }
const PAYLINES: number[][] = [
  [2, 2, 2, 2, 2], [0, 0, 0, 0, 0], [4, 4, 4, 4, 4], [1, 1, 1, 1, 1], [3, 3, 3, 3, 3],
  [0, 1, 2, 1, 0], [4, 3, 2, 3, 4], [1, 2, 3, 2, 1], [3, 2, 1, 2, 3], [0, 1, 2, 3, 4],
  [4, 3, 2, 1, 0], [1, 1, 2, 1, 1], [3, 3, 2, 3, 3], [0, 0, 1, 0, 0], [4, 4, 3, 4, 4],
  [2, 1, 1, 1, 2], [2, 3, 3, 3, 2], [1, 0, 0, 0, 1], [3, 4, 4, 4, 3], [0, 1, 1, 1, 0],
  [4, 3, 3, 3, 4], [2, 2, 1, 2, 2], [0, 1, 0, 1, 0], [4, 3, 4, 3, 4], [2, 1, 2, 1, 2],
]

type SymbolProbability = { symbol: DonutSymbol; probability: number; weight: number }
type RtpModel = {
  baseReturn: number
  bonusTriggerProbability: number
  bonusReturnByChoice: Record<DonutBonusChoice, number>
  bonusReturn: number
  branchScale: Record<DonutBonusChoice, number>
  maxWinReturn: number
  gooeyReturn: number
  rawRtp: number
}

export type DonutGridEvaluation = {
  lineWins: Array<{ lineIndex: number; symbol: DonutSymbol; count: number; multiplier: number }>
  scatterCount: number
  scatterMultiplier: number
  rawMultiplier: number
}

export type DonutInitialSpin = {
  grid: DonutGrid
  lineWins: DonutGridEvaluation['lineWins']
  scatterCount: number
  bonusStage: 'choose' | null
  feature: 'gooey' | 'maxWin' | null
  bonusGrids: DonutGrid[]
  bonusMultipliers: number[]
  rawMultiplier: number
  branchScale: number
  globalScale: number
  payoutCents: number | null
  result: 'win' | 'loss' | null
}

export type DonutBonusResolution = {
  choice: DonutBonusChoice
  grids: DonutGrid[]
  multipliers: number[]
  cards: number[]
  rawMultiplier: number
}

const reelSymbols: SymbolProbability[][] = Array.from({ length: REELS }, (_, reel) => {
  const weighted = DONUT_SYMBOLS.map((symbol) => {
    const weight = Math.round(BASE_WEIGHTS[symbol] * (REEL_MODIFIERS[reel][symbol] ?? 1) * 10)
    return { symbol, weight }
  })
  const total = weighted.reduce((sum, item) => sum + item.weight, 0)
  return weighted.map(({ symbol, weight }) => ({ symbol, weight, probability: weight / total }))
})
const wildProbability = reelSymbols.map((reel) => reel.find((item) => item.symbol === 'WILD')!.probability)
const scatterProbability = reelSymbols.map((reel) => reel.find((item) => item.symbol === 'SCATTER')!.probability)
const eligibleProbability = reelSymbols.map((reel) => 1 - reel.find((item) => item.symbol === 'WILD')!.probability - reel.find((item) => item.symbol === 'SCATTER')!.probability)

function lineMultiplier(sequence: DonutSymbol[]) {
  let best = 0
  for (const symbol of REGULAR_SYMBOLS) {
    let count = 0
    for (let reel = 0; reel < REELS; reel += 1) {
      const cell = sequence[reel]
      if (cell !== symbol && !(cell === 'WILD' && symbol !== 'WILD')) break
      count += 1
    }
    if (count >= 3) best = Math.max(best, PAYTABLE[symbol]?.[count] ?? 0)
  }
  return best
}

function choose(n: number, k: number): number {
  if (k < 0 || k > n) return 0
  let result = 1
  for (let index = 1; index <= Math.min(k, n - k); index += 1) {
    result = (result * (n - index + 1)) / index
  }
  return result
}

const expectedLineCache = new Map<number, number>()

function expectedLineReturn(forcedWildMask: number) {
  const cached = expectedLineCache.get(forcedWildMask)
  if (cached !== undefined) return cached

  const sequence = Array<DonutSymbol>(REELS)
  let total = 0
  const visit = (reel: number, probability: number) => {
    if (reel === REELS) {
      total += probability * lineMultiplier(sequence)
      return
    }
    if ((forcedWildMask & (1 << reel)) !== 0) {
      sequence[reel] = 'WILD'
      visit(reel + 1, probability)
      return
    }
    for (const item of reelSymbols[reel]) {
      sequence[reel] = item.symbol
      visit(reel + 1, probability * item.probability)
    }
  }
  visit(0, 1)
  expectedLineCache.set(forcedWildMask, total)
  return total
}

function scatterDistribution(sticky: ReadonlySet<number>) {
  let distribution = [1]
  for (let reel = 0; reel < REELS; reel += 1) {
    for (let row = 0; row < ROWS; row += 1) {
      const probability = sticky.has(reel * ROWS + row) ? 0 : scatterProbability[reel]
      const next = Array(distribution.length + 1).fill(0) as number[]
      distribution.forEach((chance, count) => {
        next[count] += chance * (1 - probability)
        next[count + 1] += chance * probability
      })
      distribution = next
    }
  }
  return distribution
}

function scatterMultiplier(count: number) {
  return count >= BONUS_MIN_SCATTERS ? (SCATTER_PAYS[Math.min(count, 5)] ?? 0) : 0
}

function expectedScatterReturn(sticky: ReadonlySet<number>) {
  return scatterDistribution(sticky).reduce((sum, probability, count) => sum + probability * scatterMultiplier(count), 0)
}

function scatterTriggerProbability() {
  const distribution = scatterDistribution(new Set())
  return distribution.slice(BONUS_MIN_SCATTERS).reduce((sum, probability) => sum + probability, 0)
}

function expectedGridReturn(sticky: ReadonlySet<number>) {
  const masks = PAYLINES.map((line) => line.reduce((mask, row, reel) =>
    sticky.has(reel * ROWS + row) ? mask | (1 << reel) : mask, 0))
  const lineReturn = masks.reduce((sum, mask) => sum + expectedLineReturn(mask), 0) / LINE_COUNT
  return lineReturn + expectedScatterReturn(sticky)
}

function subsets(values: number[], count: number, visit: (chosen: number[]) => void) {
  const chosen: number[] = []
  const walk = (start: number) => {
    if (chosen.length === count) {
      visit(chosen)
      return
    }
    for (let index = start; index <= values.length - (count - chosen.length); index += 1) {
      chosen.push(values[index])
      walk(index + 1)
      chosen.pop()
    }
  }
  walk(0)
}

function stickyTransitions(state: number[]) {
  const stateSet = new Set(state)
  const available = Array.from({ length: REELS * ROWS }, (_, index) => index).filter((index) => !stateSet.has(index))
  const need = 3 - state.length
  if (need <= 0) return [{ state, probability: 1 }]

  const transitions: Array<{ state: number[]; probability: number }> = []
  for (let addedCount = 0; addedCount <= Math.min(need, available.length); addedCount += 1) {
    subsets(available, addedCount, (added) => {
      const selected = new Set(added)
      let probability = 1
      if (addedCount < need) {
        for (const position of available) {
          const reel = Math.floor(position / ROWS)
          probability *= selected.has(position) ? wildProbability[reel] : 1 - wildProbability[reel]
        }
      } else {
        const lastSelected = added[added.length - 1]
        for (const position of added) {
          probability *= wildProbability[Math.floor(position / ROWS)]
        }
        for (const position of available) {
          if (position >= lastSelected) break
          if (!selected.has(position)) probability *= 1 - wildProbability[Math.floor(position / ROWS)]
        }
      }
      if (probability > 0) transitions.push({ state: [...state, ...added].sort((a, b) => a - b), probability })
    })
  }
  return transitions
}

function expectedStickyReturn() {
  const states: number[][] = [[]]
  for (let size = 1; size <= 3; size += 1) {
    subsets(Array.from({ length: REELS * ROWS }, (_, index) => index), size, (state) => states.push(state))
  }
  const transitions = new Map<string, Array<{ state: number[]; probability: number }>>()
  const immediate = new Map<string, number>()
  for (const state of states) {
    const key = state.join(',')
    transitions.set(key, stickyTransitions(state))
    immediate.set(key, expectedGridReturn(new Set(state)))
  }

  let values = new Map<string, number>(states.map((state) => [state.join(','), 0]))
  for (let spin = 0; spin < STICKY_SPINS; spin += 1) {
    const nextValues = new Map<string, number>()
    for (const state of states) {
      const key = state.join(',')
      const expectedFuture = transitions.get(key)!.reduce((sum, transition) =>
        sum + transition.probability * (values.get(transition.state.join(',')) ?? 0), 0)
      nextValues.set(key, immediate.get(key)! + expectedFuture)
    }
    values = nextValues
  }
  return values.get('') ?? 0
}

type DropAggregate = number[][][]

function buildDropAggregate(): DropAggregate {
  const aggregate = Array.from({ length: ROWS + 1 }, () =>
    Array.from({ length: ROWS + 1 }, () => Array(ROWS + 1).fill(0) as number[]))
  const sequence = Array<DonutSymbol>(REELS)
  const eligiblePositions: number[] = []

  const visit = (reel: number, probability: number, scatters: number) => {
    if (reel === REELS) {
      const eligibleCount = eligiblePositions.length
      const payoutByMask = new Float64Array(1 << eligibleCount)
      for (let mask = 0; mask < payoutByMask.length; mask += 1) {
        const modified = [...sequence]
        for (let index = 0; index < eligibleCount; index += 1) {
          if ((mask & (1 << index)) !== 0) modified[eligiblePositions[index]] = 'WILD'
        }
        payoutByMask[mask] = lineMultiplier(modified)
      }
      for (let count = 0; count <= eligibleCount; count += 1) {
        let sum = 0
        for (let mask = 0; mask < payoutByMask.length; mask += 1) {
          if (countBits(mask) === count) sum += payoutByMask[mask]
        }
        aggregate[eligibleCount][scatters][count] += probability * sum / choose(eligibleCount, count)
      }
      return
    }
    for (const item of reelSymbols[reel]) {
      sequence[reel] = item.symbol
      const wasEligible = item.symbol !== 'WILD' && item.symbol !== 'SCATTER'
      if (wasEligible) eligiblePositions.push(reel)
      visit(reel + 1, probability * item.probability, scatters + (item.symbol === 'SCATTER' ? 1 : 0))
      if (wasEligible) eligiblePositions.pop()
    }
  }
  visit(0, 1, 0)
  return aggregate
}

function countBits(value: number) {
  let count = 0
  for (let remaining = value; remaining; remaining &= remaining - 1) count += 1
  return count
}

function otherCellDistribution() {
  let distribution = Array.from({ length: 21 }, () => Array(21).fill(0) as number[])
  distribution[0][0] = 1
  let processed = 0
  for (let reel = 0; reel < REELS; reel += 1) {
    for (let cell = 0; cell < ROWS - 1; cell += 1) {
      const next = Array.from({ length: 21 }, () => Array(21).fill(0) as number[])
      for (let eligible = 0; eligible <= processed; eligible += 1) {
        for (let scatters = 0; scatters <= processed - eligible; scatters += 1) {
          const chance = distribution[eligible][scatters]
          if (!chance) continue
          next[eligible + 1][scatters] += chance * eligibleProbability[reel]
          next[eligible][scatters + 1] += chance * scatterProbability[reel]
          next[eligible][scatters] += chance * wildProbability[reel]
        }
      }
      distribution = next
      processed += 1
    }
  }
  return distribution
}

function expectedLineAfterDrops(minDrops: number, maxDrops: number, onlyWithoutBonus: boolean, aggregate: DropAggregate, others: number[][]) {
  let expected = 0
  const dropRange = maxDrops - minDrops + 1
  for (let lineEligible = 0; lineEligible <= ROWS; lineEligible += 1) {
    for (let lineScatters = 0; lineScatters <= ROWS; lineScatters += 1) {
      const values = aggregate[lineEligible][lineScatters]
      if (!values.some((value) => value !== 0)) continue
      for (let otherEligible = 0; otherEligible <= 20; otherEligible += 1) {
        for (let otherScatters = 0; otherScatters <= 20 - otherEligible; otherScatters += 1) {
          const otherProbability = others[otherEligible][otherScatters]
          if (!otherProbability || (onlyWithoutBonus && lineScatters + otherScatters >= BONUS_MIN_SCATTERS)) continue
          const totalEligible = lineEligible + otherEligible
          for (let requestedDrops = minDrops; requestedDrops <= maxDrops; requestedDrops += 1) {
            const actualDrops = Math.min(requestedDrops, totalEligible)
            const totalSubsets = choose(totalEligible, actualDrops)
            if (totalSubsets === 0) continue
            let lineExpectation = 0
            for (let selectedLineCells = 0; selectedLineCells <= Math.min(lineEligible, actualDrops); selectedLineCells += 1) {
              const selectionsOutsideLine = actualDrops - selectedLineCells
              const selectedSubsets = choose(lineEligible, selectedLineCells)
                * choose(totalEligible - lineEligible, selectionsOutsideLine)
              if (selectedSubsets) lineExpectation += values[selectedLineCells] * selectedSubsets / totalSubsets
            }
            expected += otherProbability * lineExpectation / dropRange
          }
        }
      }
    }
  }
  return expected
}

export function calculateDonutRtpModel(): Readonly<RtpModel> {
  const emptyState = new Set<number>()
  const baseReturn = expectedGridReturn(emptyState)
  const bonusTriggerProbability = scatterTriggerProbability()
  const dropAggregate = buildDropAggregate()
  const otherDistribution = otherCellDistribution()
  const bonusReturnByChoice: Record<DonutBonusChoice, number> = {
    sticky: expectedStickyReturn(),
    pick: PICK_PRIZES.reduce((sum, value) => sum + value, 0) * 3 / PICK_PRIZES.length,
    surveillance: SURVEILLANCE_SPINS * 3.5 * (
      expectedLineAfterDrops(1, 2, false, dropAggregate, otherDistribution)
      + expectedScatterReturn(emptyState)
    ),
  }
  const bonusReturn = Object.values(bonusReturnByChoice).reduce((sum, value) => sum + value, 0) / DONUT_BONUS_CHOICES.length
  const branchScale = Object.fromEntries(DONUT_BONUS_CHOICES.map((choice) => [choice, bonusReturn / bonusReturnByChoice[choice]])) as Record<DonutBonusChoice, number>
  const noBonusProbability = 1 - bonusTriggerProbability
  const gooeyReturn = expectedLineAfterDrops(3, 6, true, dropAggregate, otherDistribution)
  const maxWinReturn = noBonusProbability * MAX_WIN_CHANCE * MAX_WIN_MULTIPLIER
  const rawRtp = baseReturn
    + bonusTriggerProbability * bonusReturn
    + maxWinReturn
    + GOOEY_CHANCE * gooeyReturn

  if (!Number.isFinite(rawRtp) || rawRtp <= 0) throw new Error('Donut Division RTP model could not be calculated.')
  return { baseReturn, bonusTriggerProbability, bonusReturnByChoice, bonusReturn, branchScale, maxWinReturn, gooeyReturn, rawRtp }
}

const RTP_MODEL: Readonly<RtpModel> = {
  baseReturn: 0.8231174334674803,
  bonusTriggerProbability: 0.0023316126325945144,
  bonusReturnByChoice: {
    sticky: 2.2062569267935115,
    pick: 27.75,
    surveillance: 35.59097866947299,
  },
  bonusReturn: 21.849078532088836,
  branchScale: {
    sticky: 9.9032339646151,
    pick: 0.7873541813365346,
    surveillance: 0.6138937266939831,
  },
  maxWinReturn: 0.014965025810511082,
  gooeyReturn: 12.97333073536794,
  rawRtp: 0.9538927004707991,
}

export function getDonutRtpModel(): Readonly<RtpModel> {
  return RTP_MODEL
}

export function donutGlobalScale(rtpBps: number) {
  if (!Number.isInteger(rtpBps) || rtpBps < 100 || rtpBps > 9900) throw new RangeError('RTP must be between 1% and 99%.')
  return (rtpBps / 10_000) / getDonutRtpModel().rawRtp
}

function digest(serverSeed: string, clientSeed: string, sessionId: string, label: string, attempt = 0) {
  return createHmac('sha256', serverSeed)
    .update(`donut-division:${clientSeed}:${sessionId}:${label}:${attempt}`)
    .digest()
}

function deterministicInteger(serverSeed: string, clientSeed: string, sessionId: string, label: string, maxExclusive: number) {
  if (!Number.isSafeInteger(maxExclusive) || maxExclusive <= 0) throw new RangeError('Random range must be a positive safe integer.')
  const bound = BigInt(maxExclusive)
  const range = BigInt(1) << BigInt(256)
  const limit = range - range % bound
  for (let attempt = 0; ; attempt += 1) {
    const value = BigInt(`0x${digest(serverSeed, clientSeed, sessionId, label, attempt).toString('hex')}`)
    if (value < limit) return Number(value % bound)
  }
}

function deterministicUnit(serverSeed: string, clientSeed: string, sessionId: string, label: string) {
  const value = digest(serverSeed, clientSeed, sessionId, label).readBigUInt64BE(0) >> BigInt(11)
  return Number(value) / 9_007_199_254_740_992
}

function drawWeightedSymbol(serverSeed: string, clientSeed: string, sessionId: string, label: string, reel: number) {
  const total = reelSymbols[reel].reduce((sum, item) => sum + item.weight, 0)
  let roll = deterministicInteger(serverSeed, clientSeed, sessionId, label, total)
  for (const item of reelSymbols[reel]) {
    roll -= item.weight
    if (roll < 0) return item.symbol
  }
  throw new Error('Donut Division symbol weights are invalid.')
}

export function generateDonutGrid(
  serverSeed: string,
  clientSeed: string,
  sessionId: string,
  label: string,
  sticky: number[] = [],
): DonutGrid {
  const stickyPositions = new Set(sticky)
  return Array.from({ length: REELS }, (_, reel) =>
    Array.from({ length: ROWS }, (_, row) => {
      const position = reel * ROWS + row
      return stickyPositions.has(position)
        ? 'WILD'
        : drawWeightedSymbol(serverSeed, clientSeed, sessionId, `${label}:cell:${position}`, reel)
    }),
  )
}

export function dropDonutWilds(
  grid: DonutGrid,
  count: number,
  serverSeed: string,
  clientSeed: string,
  sessionId: string,
  label: string,
): DonutGrid {
  const next = grid.map((column) => [...column])
  const spots = next.flatMap((column, reel) => column.flatMap((symbol, row) =>
    symbol !== 'WILD' && symbol !== 'SCATTER' ? [{ reel, row }] : []))
  for (let index = 0; index < count && spots.length > 0; index += 1) {
    const pick = deterministicInteger(serverSeed, clientSeed, sessionId, `${label}:drop:${index}`, spots.length)
    const [{ reel, row }] = spots.splice(pick, 1)
    next[reel][row] = 'WILD'
  }
  return next
}

export function evaluateDonutGrid(grid: DonutGrid): DonutGridEvaluation {
  const lineWins: DonutGridEvaluation['lineWins'] = []
  PAYLINES.forEach((line, lineIndex) => {
    let best: DonutGridEvaluation['lineWins'][number] | null = null
    for (const symbol of REGULAR_SYMBOLS) {
      let count = 0
      for (let reel = 0; reel < REELS; reel += 1) {
        const cell = grid[reel][line[reel]]
        if (cell !== symbol && !(cell === 'WILD' && symbol !== 'WILD')) break
        count += 1
      }
      const multiplier = PAYTABLE[symbol]?.[count] ?? 0
      if (count >= 3 && multiplier > (best?.multiplier ?? 0)) best = { lineIndex, symbol, count, multiplier }
    }
    if (best) lineWins.push(best)
  })
  const scatterCount = grid.reduce((count, column) => count + column.filter((symbol) => symbol === 'SCATTER').length, 0)
  const scatterPrize = scatterMultiplier(scatterCount)
  const lineMultiplierTotal = lineWins.reduce((sum, win) => sum + win.multiplier, 0) / LINE_COUNT
  return {
    lineWins,
    scatterCount,
    scatterMultiplier: scatterPrize,
    rawMultiplier: lineMultiplierTotal + scatterPrize,
  }
}

function shuffledPickPrizes(serverSeed: string, clientSeed: string, sessionId: string) {
  const cards = [...PICK_PRIZES]
  for (let index = cards.length - 1; index > 0; index -= 1) {
    const swap = deterministicInteger(serverSeed, clientSeed, sessionId, `bonus:pick:shuffle:${index}`, index + 1)
    ;[cards[index], cards[swap]] = [cards[swap], cards[index]]
  }
  return cards
}

export function generateDonutBonus(
  choice: DonutBonusChoice,
  serverSeed: string,
  clientSeed: string,
  sessionId: string,
): DonutBonusResolution {
  if (choice === 'pick') {
    return { choice, grids: [], multipliers: [], cards: shuffledPickPrizes(serverSeed, clientSeed, sessionId), rawMultiplier: 0 }
  }
  if (choice === 'sticky') {
    let sticky: number[] = []
    const grids: DonutGrid[] = []
    let rawMultiplier = 0
    for (let spin = 0; spin < STICKY_SPINS; spin += 1) {
      const grid = generateDonutGrid(serverSeed, clientSeed, sessionId, `bonus:sticky:${spin}`, sticky)
      rawMultiplier += evaluateDonutGrid(grid).rawMultiplier
      grids.push(grid)
      for (let reel = 0; reel < REELS; reel += 1) {
        for (let row = 0; row < ROWS; row += 1) {
          if (grid[reel][row] === 'WILD') {
            const position = reel * ROWS + row
            if (!sticky.includes(position) && sticky.length < 3) sticky.push(position)
          }
        }
      }
    }
    return { choice, grids, multipliers: Array(STICKY_SPINS).fill(1), cards: [], rawMultiplier }
  }

  const grids: DonutGrid[] = []
  const multipliers: number[] = []
  let rawMultiplier = 0
  for (let spin = 0; spin < SURVEILLANCE_SPINS; spin += 1) {
    const grid = generateDonutGrid(serverSeed, clientSeed, sessionId, `bonus:surveillance:${spin}`)
    const drops = 1 + deterministicInteger(serverSeed, clientSeed, sessionId, `bonus:surveillance:${spin}:drop-count`, 2)
    const multiplier = [2, 3, 4, 5][deterministicInteger(serverSeed, clientSeed, sessionId, `bonus:surveillance:${spin}:multiplier`, 4)]
    const enhanced = dropDonutWilds(grid, drops, serverSeed, clientSeed, sessionId, `bonus:surveillance:${spin}`)
    grids.push(enhanced)
    multipliers.push(multiplier)
    rawMultiplier += evaluateDonutGrid(enhanced).rawMultiplier * multiplier
  }
  return { choice, grids, multipliers, cards: [], rawMultiplier }
}

export function revealDonutCards(cards: number[], positions: number[]) {
  return positions.map((position) => {
    const value = cards[position]
    if (!Number.isInteger(value)) throw new RangeError('Choose an unrevealed bonus card.')
    return { position, value }
  })
}

export function calculateDonutPayoutCents(
  wagerCents: number,
  rtpBps: number,
  rawMultiplier: number,
  label: string,
  serverSeed: string,
  clientSeed: string,
  sessionId: string,
): number {
  if (!Number.isSafeInteger(wagerCents) || wagerCents <= 0 || !Number.isFinite(rawMultiplier) || rawMultiplier < 0) {
    throw new RangeError('Donut Division payout inputs are invalid.')
  }
  const scaledCents = wagerCents * rawMultiplier * donutGlobalScale(rtpBps)
  if (!Number.isFinite(scaledCents) || scaledCents > Number.MAX_SAFE_INTEGER) {
    throw new RangeError('Donut Division payout exceeds the supported amount.')
  }
  const wholeCents = Math.floor(scaledCents)
  const remainder = scaledCents - wholeCents
  const roundedCents = wholeCents + Number(deterministicUnit(serverSeed, clientSeed, sessionId, `${label}:cent-round`) < remainder)
  if (!Number.isSafeInteger(roundedCents)) throw new RangeError('Donut Division payout exceeds the supported amount.')
  return roundedCents
}

export function generateInitialDonutSpin(input: {
  wagerCents: number
  rtpBps: number
  serverSeed: string
  clientSeed: string
  sessionId: string
}): DonutInitialSpin {
  const globalScale = donutGlobalScale(input.rtpBps)
  const grid = generateDonutGrid(input.serverSeed, input.clientSeed, input.sessionId, 'base')
  const evaluation = evaluateDonutGrid(grid)
  const output: DonutInitialSpin = {
    grid,
    lineWins: evaluation.lineWins,
    scatterCount: evaluation.scatterCount,
    bonusStage: null,
    feature: null,
    bonusGrids: [],
    bonusMultipliers: [],
    rawMultiplier: evaluation.rawMultiplier,
    branchScale: 1,
    globalScale,
    payoutCents: null,
    result: null,
  }

  if (evaluation.scatterCount >= BONUS_MIN_SCATTERS) {
    output.bonusStage = 'choose'
    return output
  }

  const featureRoll = deterministicUnit(input.serverSeed, input.clientSeed, input.sessionId, 'feature:roll')
  if (featureRoll < MAX_WIN_CHANCE) {
    output.feature = 'maxWin'
    output.rawMultiplier += MAX_WIN_MULTIPLIER
  } else if (featureRoll < MAX_WIN_CHANCE + GOOEY_CHANCE) {
    output.feature = 'gooey'
    const count = 3 + deterministicInteger(input.serverSeed, input.clientSeed, input.sessionId, 'feature:gooey:drop-count', 4)
    const enhanced = dropDonutWilds(grid, count, input.serverSeed, input.clientSeed, input.sessionId, 'feature:gooey')
    output.bonusGrids = [enhanced]
    output.rawMultiplier += evaluateDonutGrid(enhanced).rawMultiplier
  }
  output.payoutCents = calculateDonutPayoutCents(
    input.wagerCents, input.rtpBps, output.rawMultiplier, 'base', input.serverSeed, input.clientSeed, input.sessionId,
  )
  output.result = output.payoutCents > 0 ? 'win' : 'loss'
  return output
}

export function generateDonutBonusPurchaseSpin(input: {
  serverSeed: string
  clientSeed: string
  sessionId: string
  rtpBps: number
}): DonutInitialSpin {
  const grid = generateDonutGrid(input.serverSeed, input.clientSeed, input.sessionId, 'bonus-buy:base')
  const availablePositions = Array.from({ length: REELS * ROWS }, (_, position) => position)
  const scatterPositions = new Set<number>()
  for (let scatter = 0; scatter < BONUS_MIN_SCATTERS; scatter += 1) {
    const pick = deterministicInteger(
      input.serverSeed,
      input.clientSeed,
      input.sessionId,
      `bonus-buy:scatter:${scatter}`,
      availablePositions.length,
    )
    const [position] = availablePositions.splice(pick, 1)
    scatterPositions.add(position)
  }
  for (let reel = 0; reel < REELS; reel += 1) {
    for (let row = 0; row < ROWS; row += 1) {
      const position = reel * ROWS + row
      if (scatterPositions.has(position)) grid[reel][row] = 'SCATTER'
      else if (grid[reel][row] === 'SCATTER') grid[reel][row] = 'SPRINKLE'
      if (reel < 3 && !scatterPositions.has(position)) {
        grid[reel][row] = reel === 2 ? 'CHOC' : 'PINK'
      }
    }
  }
  const evaluation = evaluateDonutGrid(grid)
  return {
    grid,
    lineWins: evaluation.lineWins,
    scatterCount: evaluation.scatterCount,
    bonusStage: 'choose',
    feature: null,
    bonusGrids: [],
    bonusMultipliers: [],
    rawMultiplier: evaluation.rawMultiplier,
    branchScale: 1,
    globalScale: donutGlobalScale(input.rtpBps),
    payoutCents: null,
    result: null,
  }
}

export function finalizeDonutBonusPayout(input: {
  wagerCents: number
  rtpBps: number
  baseMultiplier: number
  bonusMultiplier: number
  choice: DonutBonusChoice
  bonusPurchase?: boolean
  serverSeed: string
  clientSeed: string
  sessionId: string
}) {
  const model = getDonutRtpModel()
  const purchaseReturn = input.bonusPurchase ? 2 + model.bonusReturn : 1
  const scaledBonus = input.bonusMultiplier * model.branchScale[input.choice] / purchaseReturn
  const baseMultiplier = input.baseMultiplier / purchaseReturn
  return calculateDonutPayoutCents(
    input.wagerCents,
    input.rtpBps,
    baseMultiplier + scaledBonus,
    'bonus',
    input.serverSeed,
    input.clientSeed,
    input.sessionId,
  )
}
