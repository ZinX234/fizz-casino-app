import assert from 'node:assert/strict'
import test from 'node:test'
import {
  calculateDonutPayoutCents,
  donutGlobalScale,
  evaluateDonutGrid,
  generateDonutGrid,
  getDonutRtpModel,
} from '../lib/donut-division-math.ts'

test('the RTP model normalizes each bonus path to the same expected return', () => {
  const model = getDonutRtpModel()
  for (const choice of ['sticky', 'pick', 'surveillance']) {
    const normalized = model.bonusReturnByChoice[choice] * model.branchScale[choice]
    assert.ok(Math.abs(normalized - model.bonusReturn) < 1e-10)
  }
  assert.ok(Math.abs(model.rawRtp * donutGlobalScale(9600) - 0.96) < 1e-12)
})

test('the uploaded 25-line paytable evaluates a five-of-a-kind board', () => {
  const grid = Array.from({ length: 5 }, () => Array(5).fill('SPRINKLE'))
  const result = evaluateDonutGrid(grid)
  assert.equal(result.lineWins.length, 25)
  assert.equal(result.scatterCount, 0)
  assert.equal(result.rawMultiplier, 100)
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
