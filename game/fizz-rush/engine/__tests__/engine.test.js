import { describe, it, expect } from 'vitest';
import { GAME_CONFIG } from '../../config';
import { PatternDirector, PATTERNS } from '../patterns';
import { HAZARD_TYPES, getHazardGeometry } from '../hazard-types';
import { PROP_TYPES, getPropGeometry } from '../props';
import { computePayout, distanceFactor } from '../../payout';
import { levelFromTotalXp, xpFromRun, xpForLevel } from '../../progress';

/**
 * Fizz Rush — engine guarantees
 * ---------------------------------------------------------------------------
 * These tests cover the promises the game makes to the player: every prop and
 * hazard builds, every generated pattern leaves a lane that can actually be
 * used, payouts are always finite and never negative, and progression can never
 * run backwards or overflow.
 */

const RANK = { full: 3, timed: 2.5, dyn: 2, gap: 1.5, low: 1, high: 1, safe: 0 };
const TOLERANCE = { easy: 0, hard: 1, extreme: 1.5 };

describe('geometry library', () => {
  it('builds every prop', () => {
    Object.keys(PROP_TYPES).forEach((key) => {
      const geo = getPropGeometry(key);
      expect(geo.body, key).toBeTruthy();
      expect(geo.body.attributes.position.count).toBeGreaterThan(0);
      expect(geo.body.attributes.color.count).toBe(geo.body.attributes.position.count);
    });
  });

  it('builds every hazard', () => {
    Object.keys(HAZARD_TYPES).forEach((key) => {
      const geo = getHazardGeometry(key);
      expect(geo.body, key).toBeTruthy();
      expect(geo.body.attributes.position.count).toBeGreaterThan(0);
    });
  });

  it('only references hazards that exist', () => {
    PATTERNS.forEach((pattern) => {
      const built = pattern.build(() => 0.42);
      built.hazards.forEach((h) => {
        expect(HAZARD_TYPES[h.type], `${pattern.id} → ${h.type}`).toBeTruthy();
        expect(h.lane).toBeGreaterThanOrEqual(0);
        expect(h.lane).toBeLessThan(GAME_CONFIG.lanes.count);
      });
    });
  });
});

describe('pattern director fairness', () => {
  ['easy', 'hard', 'extreme'].forEach((difficulty) => {
    it(`always leaves a usable lane on ${difficulty}`, () => {
      const director = new PatternDirector(difficulty, 20261);
      let groups = 0;

      for (let i = 0; i < 240; i += 1) {
        // 40 m per tick is a realistic fast-run stride.
        const playerZ = i * 40;
        director.fill(playerZ, playerZ + 360, 'marina', (group) => {
          groups += 1;
          expect(group.hazards.length).toBeGreaterThan(0);

          const rows = new Map();
          group.hazards.forEach((h) => {
            const key = Math.round((h.dz || 0) * 2) / 2;
            if (!rows.has(key)) rows.set(key, new Array(GAME_CONFIG.lanes.count).fill(0));
            rows.get(key)[h.lane] = Math.max(rows.get(key)[h.lane], RANK[HAZARD_TYPES[h.type].block] ?? 0);
          });

          const ordered = [...rows.entries()].sort((a, b) => a[0] - b[0]);
          let previous = null;
          ordered.forEach(([, lanes]) => {
            const safe = lanes.map((rank, lane) => (rank <= TOLERANCE[difficulty] + 0.001 ? lane : -1)).filter((lane) => lane >= 0);
            // Every row must offer somewhere to stand.
            expect(safe.length, `${difficulty} row with no safe lane in ${group.patternId}`).toBeGreaterThan(0);
            if (previous) {
              const reachable = safe.some((lane) => previous.some((prev) => Math.abs(prev - lane) <= 2));
              expect(reachable, `${difficulty} row unreachable in ${group.patternId}`).toBe(true);
            }
            previous = safe;
          });
        });
      }

    });
  });
});

describe('payout engine', () => {
  it('never returns a negative, infinite or absurd payout', () => {
    for (let i = 0; i < 3000; i += 1) {
      const result = {
        distance: Math.random() * 8000,
        coins: Math.floor(Math.random() * 400),
        gems: Math.floor(Math.random() * 8),
        comboPeak: 1 + Math.random() * 4,
        nearMisses: Math.floor(Math.random() * 250),
        grindSeconds: Math.random() * 40,
        airManoeuvres: Math.floor(Math.random() * 40),
        obstaclesAvoided: Math.floor(Math.random() * 400),
        bonusEvents: Math.floor(Math.random() * 6),
        wagerEvents: Math.floor(Math.random() * 3),
      };
      const difficulty = ['easy', 'hard', 'extreme'][i % 3];
      const bet = [0, 1, 25, 500, 5000][i % 5];
      const payout = computePayout(result, { difficulty, bet, prestige: i % 4 });

      expect(Number.isFinite(payout.credited)).toBe(true);
      expect(payout.credited).toBeGreaterThanOrEqual(0);
      expect(payout.multiplier).toBeLessThanOrEqual(GAME_CONFIG.payout.maxPayoutMultiplier);
      const ceiling = bet * GAME_CONFIG.payout.maxPayoutMultiplier + (result.coins * GAME_CONFIG.payout.coinValue + result.gems * GAME_CONFIG.payout.gemValue);
      expect(payout.credited).toBeLessThanOrEqual(Math.ceil(ceiling) + 1);
      expect(payout.coinsCredited).toBeGreaterThanOrEqual(0);
    }
  });

  it('scales with distance and difficulty', () => {
    expect(distanceFactor(400)).toBeCloseTo(1, 5);
    expect(distanceFactor(3200)).toBeGreaterThan(distanceFactor(800));
    const easy = computePayout({ distance: 1200, comboPeak: 2 }, { difficulty: 'easy', bet: 100 });
    const extreme = computePayout({ distance: 1200, comboPeak: 2 }, { difficulty: 'extreme', bet: 100 });
    expect(extreme.multiplier).toBeGreaterThan(easy.multiplier);
    // RTP and house edge are deliberately not hardcoded.
    expect(GAME_CONFIG.payout.rtpTarget).toBeNull();
    expect(GAME_CONFIG.payout.houseEdge).toBeNull();
  });
});

describe('progression', () => {
  it('derives a monotonic level curve that caps safely', () => {
    let previous = 0;
    for (let level = 1; level < GAME_CONFIG.progression.level.max; level += 1) {
      const cost = xpForLevel(level);
      expect(cost).toBeGreaterThan(0);
      previous += cost;
    }
    expect(levelFromTotalXp(0).level).toBe(1);
    expect(levelFromTotalXp(previous).level).toBe(GAME_CONFIG.progression.level.max);
    expect(levelFromTotalXp(Number.MAX_SAFE_INTEGER).level).toBe(GAME_CONFIG.progression.level.max);
    // Corrupt values can never produce a broken level.
    expect(levelFromTotalXp(-500).level).toBe(1);
    expect(levelFromTotalXp(NaN).level).toBe(1);
  });

  it('awards demo progress at a reduced rate', () => {
    const result = { distance: 1000, coins: 40, obstaclesAvoided: 50, nearMisses: 12, grindSeconds: 6, bonusEvents: 2 };
    const real = xpFromRun(result, 'hard', 'real');
    const demo = xpFromRun(result, 'hard', 'demo');
    expect(real).toBeGreaterThan(demo);
    expect(demo).toBeGreaterThan(0);
  });
});