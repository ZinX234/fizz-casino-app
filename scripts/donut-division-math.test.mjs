import assert from 'node:assert/strict'
import test from 'node:test'
import CONFIG from '../config/gameConfig.js'
import {
  calculateDonutPayoutCents,
  calculateDonutRtpModel,
  donutGlobalScale,
  evaluateDonutGrid,
  generateDonutGrid,
  getDonutRtpModel,
} from '../lib/donut-division-math.ts'
import { wagerCentsFromFizzcoins } from '../lib/fizzcoin-wager.ts'
import { getWinningCells } from '../game/paylines.js'

test('the RTP model normalizes each bonus path to the same expected return', () => {
  const model = getDonutRtpModel()
  assert.deepEqual(model, calculateDonutRtpModel())
  for (const choice of ['sticky', 'pick', 'surveillance']) {
    const normalized = model.bonusReturnByChoice[choice] * model.branchScale[choice]
    assert.ok(Math.abs(normalized - model.bonusReturn) < 1e-10)
  }
  for (const rtpBps of [100, 5000, 9600, 9900]) {
    assert.ok(Math.abs(model.rawRtp * donutGlobalScale(rtpBps) - rtpBps / 10_000) < 1e-12)
  }
})

test('the uploaded 25-line paytable evaluates a five-of-a-kind board', () => {
  const grid = Array.from({ length: 5 }, () => Array(5).fill('SPRINKLE'))
  const result = evaluateDonutGrid(grid)
  assert.equal(result.lineWins.length, 25)
  assert.equal(result.scatterCount, 0)
  assert.equal(result.rawMultiplier, 100)
})

test('casino win highlights follow the server paylines and include scatters', () => {
  const grid = Array.from({ length: 5 }, () => Array(5).fill('SPRINKLE'))
  grid[0][2] = 'PINK'
  grid[1][2] = 'PINK'
  grid[2][2] = 'PINK'
  grid[4][4] = 'SCATTER'
  assert.deepEqual(
    getWinningCells(grid, [{ lineIndex: 0, count: 3 }]).sort(),
    ['0-2', '1-2', '2-2', '4-4'],
  )
})

test('server-seed inputs deterministically reproduce the same grid', () => {
  const first = generateDonutGrid('server-seed', 'client-seed', 'session-id', 'base')
  const second = generateDonutGrid('server-seed', 'client-seed', 'session-id', 'base')
  const otherClientSeed = generateDonutGrid('server-seed', 'different-client-seed', 'session-id', 'base')
  assert.deepEqual(first, second)
  assert.notDeepEqual(first, otherClientSeed)
})

test('fractional payouts round to a supported integer cent amount', () => {
  const payout = calculateDonutPayoutCents(101, 9600, 1.2345, 'test', 'server-seed', 'client-seed', 'session-id')
  assert.ok(Number.isSafeInteger(payout))
  assert.ok(payout >= 0)
})

test('every original Fizzcoin wager maps to a valid casino wager in cents', () => {
  assert.equal(wagerCentsFromFizzcoins(800), 200)
  for (const wager of CONFIG.bets.options) {
    const cents = wagerCentsFromFizzcoins(wager)
    assert.ok(Number.isInteger(cents))
    assert.ok(cents >= 100 && cents <= 10_000)
  }
  assert.throws(() => wagerCentsFromFizzcoins(399), RangeError)
  assert.throws(() => wagerCentsFromFizzcoins(401), RangeError)
  assert.throws(() => wagerCentsFromFizzcoins(40_004), RangeError)
})
