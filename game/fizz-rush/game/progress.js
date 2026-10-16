import { GAME_CONFIG } from './config';

/**
 * Fizz Rush — pure progression maths
 * ---------------------------------------------------------------------------
 * Kept free of side effects so level, experience and prestige rules can be
 * validated independently. Level is always derived from total XP, which makes
 * progression corruption impossible: a bad value is simply recomputed.
 */

const P = GAME_CONFIG.progression;

/** XP required to advance from `level` to the next level. */
export function xpForLevel(level) {
  const l = Math.max(1, Math.floor(level));
  return Math.round(P.level.base * Math.pow(l, P.level.exponent));
}

/** Total XP required to reach `level` from zero. */
export function totalXpForLevel(level) {
  const target = Math.min(P.level.max, Math.max(1, Math.floor(level)));
  let sum = 0;
  for (let l = 1; l < target; l += 1) sum += xpForLevel(l);
  return sum;
}

/** Derive level from a total XP value (never trusts a stored level). */
export function levelFromTotalXp(totalXp) {
  const xp = Math.max(0, Number(totalXp) || 0);
  let level = 1;
  let remaining = xp;
  while (level < P.level.max && remaining >= xpForLevel(level)) {
    remaining -= xpForLevel(level);
    level += 1;
  }
  return { level, intoLevel: remaining, needed: level >= P.level.max ? 0 : xpForLevel(level) };
}

export function progressPercent(totalXp) {
  const { level, intoLevel, needed } = levelFromTotalXp(totalXp);
  if (level >= P.level.max) return 100;
  return Math.min(100, Math.round((intoLevel / Math.max(1, needed)) * 100));
}

/** Experience earned by a finished run. Demo Mode grants partial progress. */
export function xpFromRun(result, difficultyId, mode) {
  const diff = GAME_CONFIG.difficulty[difficultyId] || GAME_CONFIG.difficulty.hard;
  const base =
    (result.distance || 0) * P.xp.perMeter +
    (result.coins || 0) * P.xp.perCoin +
    (result.obstaclesAvoided || 0) * P.xp.perObstacle +
    (result.nearMisses || 0) * P.xp.perNearMiss +
    (result.grindSeconds || 0) * P.xp.perGrindSecond +
    (result.bonusEvents || 0) * P.xp.perBonusEvent;

  const modeMult = mode === 'demo' ? P.xp.demoMultiplier : 1;
  const prestigeMult = 1 + (result.prestige || 0) * P.prestige.xpBonusPerLevel;
  return Math.max(0, Math.round(base * diff.xpMultiplier * modeMult * prestigeMult));
}

export function canPrestige(profile) {
  const { level } = levelFromTotalXp(profile?.xp || 0);
  return level >= P.level.max && (profile?.prestige || 0) < P.prestige.max;
}

/** Reset to level 1 in exchange for a permanent High Roller tier. */
export function applyPrestige(profile) {
  if (!canPrestige(profile)) return null;
  return {
    ...profile,
    xp: 0,
    level: 1,
    prestige: Math.min(P.prestige.max, (profile.prestige || 0) + 1),
  };
}

/** Payout bonus contributed by prestige tier (read by the payout engine). */
export function prestigePayoutFactor(prestige) {
  return 1 + Math.max(0, Math.min(P.prestige.max, prestige || 0)) * P.prestige.payoutBonusPerLevel;
}