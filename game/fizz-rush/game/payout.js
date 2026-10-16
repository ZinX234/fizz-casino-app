import { GAME_CONFIG } from './config';
import { prestigePayoutFactor } from './progress';

/**
 * Fizz Rush — payout engine
 * ---------------------------------------------------------------------------
 * Real Mode returns are calculated entirely from the central config:
 *
 *   gross = bet × difficultyMultiplier × distanceFactor
 *              × performanceMultiplier × bonusFactor × prestigeFactor
 *
 * RTP and house edge are deliberately NOT present here. They are the
 * operator's decision (GAME_CONFIG.payout.rtpTarget / houseEdge are left null)
 * and the multipliers below are the single place to tune them.
 *
 * Every value is clamped and sanity-checked, so a payout can never be
 * negative, NaN, or larger than the configured ceiling.
 */

const PAY = GAME_CONFIG.payout;

export function distanceFactor(distance) {
  const metres = Math.max(0, Number(distance) || 0);
  const raw = Math.pow(metres / PAY.distanceScale, PAY.distanceExponent);
  const withFloor = Math.max(PAY.distanceFloor, raw);
  return Math.min(PAY.distanceCap, withFloor);
}

export function performanceMultiplier(result) {
  const perf = PAY.performance;
  const value =
    1 +
    Math.max(0, (result.comboPeak || 1) - 1) * perf.comboPeakWeight +
    (result.nearMisses || 0) * perf.nearMissWeight +
    (result.grindSeconds || 0) * perf.grindWeight +
    (result.airManoeuvres || 0) * perf.airManoeuvreWeight +
    (result.obstaclesAvoided || 0) * perf.obstacleWeight +
    (result.bonusEvents || 0) * perf.bonusWeight;
  return Math.min(perf.max, Math.max(1, value));
}

export function bonusFactor(result) {
  const events = Math.max(0, result.bonusEvents || 0);
  const wagers = Math.max(0, result.wagerEvents || 0);
  return 1 + events * 0.12 + wagers * 0.25;
}

function round(value, places = PAY.returnRounding) {
  const p = Math.pow(10, places);
  return Math.round(value * p) / p;
}

/**
 * Full payout breakdown.
 * @returns {{
 *   gross:number, bet:number, profit:number, multiplier:number, coinsCredited:number,
 *   credited:number, breakdown:Array<{label:string, value:string}>,
 *   distanceFactor:number, performance:number, bonus:number, difficulty:number, prestige:number
 * }}
 */
export function computePayout(result, { difficulty, bet = 0, prestige = 0 } = {}) {
  const safeBet = Math.max(0, Math.floor(Number(bet) || 0));
  const diffId = GAME_CONFIG.difficulty[difficulty] ? difficulty : GAME_CONFIG.defaults.difficulty;
  const diffMult = PAY.difficultyMultiplier[diffId] ?? 1;

  const dFactor = distanceFactor(result.distance);
  const pFactor = performanceMultiplier(result);
  const bFactor = bonusFactor(result);
  const prestigeFactor = prestigePayoutFactor(prestige);

  const rawMultiplier = diffMult * dFactor * pFactor * bFactor * prestigeFactor;
  const multiplier = Math.max(PAY.minPayoutMultiplier, Math.min(PAY.maxPayoutMultiplier, rawMultiplier));

  const gross = round(safeBet * multiplier);
  const coinCredits = Math.floor(
    (result.coins || 0) * PAY.coinValue + (result.gems || 0) * PAY.gemValue
  );
  const credited = Math.max(0, Math.floor(gross) + coinCredits);
  const profit = credited - safeBet;

  return {
    bet: safeBet,
    gross,
    credited,
    profit,
    multiplier: round(multiplier, 3),
    distanceFactor: round(dFactor, 3),
    performance: round(pFactor, 3),
    bonus: round(bFactor, 3),
    difficulty: diffMult,
    prestige: round(prestigeFactor, 3),
    coinsCredited: coinCredits,
    breakdown: [
      { label: 'Wager', value: `${safeBet.toLocaleString()} FC` },
      { label: `${GAME_CONFIG.difficulty[diffId].name} difficulty`, value: `${diffMult.toFixed(2)}×` },
      { label: `Distance (${Math.round(result.distance || 0)} m)`, value: `${dFactor.toFixed(2)}×` },
      { label: 'Performance', value: `${pFactor.toFixed(2)}×` },
      { label: 'Bonus events', value: `${bFactor.toFixed(2)}×` },
      { label: 'Prestige', value: `${prestigeFactor.toFixed(2)}×` },
      { label: 'Collectible payout', value: `${coinCredits.toLocaleString()} FC` },
      { label: 'Total return', value: `${credited.toLocaleString()} FC` },
    ],
  };
}

/** Worst / best plausible multiplier band for a given distance (UI estimates). */
export function multiplierBand(difficulty, distance) {
  const diffMult = PAY.difficultyMultiplier[difficulty] ?? 1;
  const d = distanceFactor(distance);
  return {
    low: round(diffMult * d, 2),
    high: round(Math.min(PAY.maxPayoutMultiplier, diffMult * d * PAY.performance.max * 1.37), 2),
  };
}