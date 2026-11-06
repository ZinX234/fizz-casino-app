import { GAME_CONFIG } from '../config';
import { makeRng, shuffle } from './three-utils';
import { HAZARD_TYPES } from './hazard-types';

/**
 * Fizz Rush — pattern director
 * ---------------------------------------------------------------------------
 * Chooses obstacle patterns and proves each one is completable before it is
 * placed. A group is only emitted when every row has a lane the player can
 * actually use AND every consecutive pair of rows is reachable at the speed the
 * player will be travelling. Otherwise a safer pattern is drawn instead.
 *
 * Difficulty changes density, complexity, speed and — critically — how much
 * free space the validator insists on. That is what makes Easy genuinely
 * forgiving and Extreme genuinely punishing without ever being unfair.
 */

const LANES = [0, 1, 2, 3, 4];
const CLASS_RANK = { full: 3, timed: 2.5, dyn: 2, gap: 1.5, low: 1, high: 1, safe: 0 };

/** How much free space a difficulty demands in every row. */
const TOLERANCE = {
  easy: 0, // needs a completely free lane
  hard: 1, // a jumpable or slidable lane is fine
  extreme: 1.5, // a moving/timed opening is acceptable
};

const REACTION = { easy: 0.98, hard: 0.62, extreme: 0.44 };

const H = (dz, type, lane, extra) => ({ dz, type, lane, ...extra });

function occupancy(rng, used) {
  const order = shuffle(rng, LANES);
  return { used: order.slice(0, used), open: order.slice(used) };
}

function coinLine(lane, dz, count, shape = 'line') {
  return { lane, dz, count, shape };
}

/* ------------------------------------------------------------- patterns */

export const PATTERNS = [
  {
    id: 'breather',
    complexity: 1,
    length: 16,
    weight: 1.2,
    tags: ['*'],
    build: (rng) => {
      const { used, open } = occupancy(rng, 1);
      return {
        hazards: [H(0, rng() < 0.5 ? 'sandbag' : 'crate', used[0])],
        coins: [coinLine(open[0], 0, 6)],
      };
    },
  },
  {
    id: 'twin_jumpables',
    complexity: 1,
    length: 18,
    weight: 2,
    tags: ['beach', 'dockyard', 'village'],
    build: (rng) => {
      const { used, open } = occupancy(rng, 2);
      return {
        hazards: [H(0, 'crate', used[0]), H(0, 'sandbag', used[1])],
        coins: [coinLine(open[0], -2, 5, 'arc')],
      };
    },
  },
  {
    id: 'slide_gate',
    complexity: 1,
    length: 20,
    weight: 2.2,
    tags: ['beach', 'village'],
    build: (rng) => {
      const { used, open } = occupancy(rng, 2);
      return {
        hazards: [H(0, 'gateArch', used[0]), H(0, 'gateArch', used[1])],
        coins: [coinLine(open[0], 0, 3), coinLine(used[0], 6, 4)],
      };
    },
  },
  {
    id: 'wall_choice',
    complexity: 1,
    length: 18,
    weight: 2.4,
    tags: ['temple', 'jungle', 'casino'],
    build: (rng) => {
      const { used, open } = occupancy(rng, 2);
      return {
        hazards: [H(0, rng() < 0.5 ? 'stoneWall' : 'tikiWall', used[0]), H(0, 'totem', used[1])],
        coins: [coinLine(open[0], -2, 5)],
      };
    },
  },
  {
    id: 'staircase',
    complexity: 2,
    length: 30,
    weight: 2.6,
    tags: ['*'],
    build: (rng) => {
      const { used, open } = occupancy(rng, 3);
      const type = rng() < 0.5 ? 'crate' : 'chipStack';
      return {
        hazards: [H(0, type, used[0]), H(9, type, used[1]), H(18, type, used[2])],
        coins: [coinLine(open[0], 0, 7)],
      };
    },
  },
  {
    id: 'weave',
    complexity: 2,
    length: 34,
    weight: 2.4,
    tags: ['*'],
    build: (rng) => {
      const { used, open } = occupancy(rng, 3);
      return {
        hazards: [
          H(0, 'gateArch', used[0]),
          H(11, 'crate', used[1]),
          H(20, 'stoneWall', used[2]),
        ],
        coins: [coinLine(open[0], 2, 8, 'arc')],
      };
    },
  },
  {
    id: 'rotator_pair',
    complexity: 2,
    length: 28,
    weight: 1.8,
    tags: ['jungle', 'temple', 'village'],
    build: (rng) => {
      const { used, open } = occupancy(rng, 2);
      return {
        hazards: [H(0, 'tikiRotator', used[0], { phase: 0 }), H(12, 'tikiRotator', used[1], { phase: 1.6 })],
        coins: [coinLine(open[0], 0, 6)],
      };
    },
  },
  {
    id: 'pendulum_run',
    complexity: 2,
    length: 32,
    weight: 2,
    tags: ['jungle', 'temple'],
    build: (rng) => {
      const { used, open } = occupancy(rng, 2);
      return {
        hazards: [
          H(0, 'vineLog', used[0], { phase: 0 }),
          H(11, 'vineLog', used[1], { phase: 2.1 }),
          H(22, 'monkeyVine', used[0], { phase: 1.1 }),
        ],
        coins: [coinLine(open[0], 1, 7)],
      };
    },
  },
  {
    id: 'crab_crossing',
    complexity: 2,
    length: 26,
    weight: 1.6,
    tags: ['beach', 'jungle', 'village'],
    build: (rng) => {
      const { used, open } = occupancy(rng, 2);
      return {
        hazards: [
          H(0, 'crab', used[0], { phase: 0 }),
          H(10, 'crab', used[1], { phase: 3.1 }),
          H(18, 'crate', open[0]),
        ],
        coins: [coinLine(open[1], 0, 6)],
      };
    },
  },
  {
    id: 'traffic_dodge',
    complexity: 2,
    length: 30,
    weight: 1.7,
    tags: ['marina', 'village', 'dockyard'],
    build: (rng) => {
      const { used, open } = occupancy(rng, 2);
      return {
        hazards: [
          H(0, 'cart', used[0], { phase: 0.2 }),
          H(10, 'jetSki', used[1], { phase: 0.5 }),
          H(19, 'crate', open[0]),
        ],
        coins: [coinLine(open[1], 0, 6)],
      };
    },
  },
  {
    id: 'container_alley',
    complexity: 2,
    length: 32,
    weight: 1.8,
    tags: ['marina', 'dockyard'],
    build: (rng) => {
      const { used, open } = occupancy(rng, 2);
      return {
        hazards: [H(0, 'container', used[0]), H(13, 'fallingCrate', used[1]), H(22, 'barrel', open[0])],
        coins: [coinLine(open[1], 0, 6)],
      };
    },
  },
  {
    id: 'spike_rhythm',
    complexity: 3,
    length: 34,
    weight: 1.9,
    tags: ['temple'],
    build: (rng) => {
      const { used, open } = occupancy(rng, 2);
      return {
        hazards: [
          H(0, 'spikeTrap', used[0], { phase: 0 }),
          H(11, 'spikeTrap', used[1], { phase: 1.3 }),
          H(22, 'dartTrap', used[0], { phase: 0.4 }),
        ],
        coins: [coinLine(open[0], 0, 7)],
      };
    },
  },
  {
    id: 'geyser_field',
    complexity: 3,
    length: 36,
    weight: 1.8,
    tags: ['volcano'],
    build: (rng) => {
      const { used, open } = occupancy(rng, 3);
      return {
        hazards: [
          H(0, 'lavaGeyser', used[0], { phase: 0 }),
          H(11, 'lavaGeyser', used[1], { phase: 1.6 }),
          H(21, 'lavaGeyser', used[2], { phase: 2.4 }),
        ],
        coins: [coinLine(open[0], 0, 8)],
      };
    },
  },
  {
    id: 'casino_floor',
    complexity: 2,
    length: 34,
    weight: 2.1,
    tags: ['casino'],
    build: (rng) => {
      const { used, open } = occupancy(rng, 3);
      return {
        hazards: [
          H(0, 'slotMachine', used[0]),
          H(0, 'chipStack', used[1]),
          H(12, 'dice', used[2], { phase: 0 }),
          H(24, 'gateArch', open[0]),
        ],
        coins: [coinLine(open[1], 0, 9)],
      };
    },
  },
  {
    id: 'roulette_roll',
    complexity: 3,
    length: 30,
    weight: 1.6,
    tags: ['casino'],
    build: (rng) => {
      const { used, open } = occupancy(rng, 2);
      return {
        hazards: [H(0, 'roulette', used[0]), H(16, 'chipStack', used[1]), H(24, 'tikiRotator', open[0], { phase: 0.8 })],
        coins: [coinLine(open[1], 0, 7)],
      };
    },
  },
  {
    id: 'explosive_row',
    complexity: 3,
    length: 30,
    weight: 1.7,
    tags: ['casino', 'volcano', 'village'],
    build: (rng) => {
      const { used, open } = occupancy(rng, 3);
      return {
        hazards: [
          H(0, 'explosiveBarrel', used[0]),
          H(0, 'explosiveCrate', used[1]),
          H(12, 'stoneWall', used[2]),
        ],
        coins: [coinLine(open[0], 0, 6)],
      };
    },
  },
  {
    id: 'plank_gap',
    complexity: 2,
    length: 26,
    weight: 1.8,
    tags: ['marina', 'dockyard', 'beach'],
    build: (rng) => {
      const { used, open } = occupancy(rng, 2);
      return {
        hazards: [H(0, 'plankGap', used[0]), H(0, 'plankGap', used[1]), H(12, 'barrel', open[0])],
        coins: [coinLine(open[1], 0, 4, 'arc')],
      };
    },
  },
  {
    id: 'rail_run',
    complexity: 1,
    length: 34,
    weight: 1.6,
    tags: ['dockyard', 'marina', 'aerial'],
    build: (rng) => {
      const { used, open } = occupancy(rng, 3);
      const railLane = open[0];
      return {
        hazards: [
          H(0, 'grindRail', railLane),
          H(0, 'crate', used[0]),
          H(10, 'sandbag', used[1]),
          H(20, 'gateArch', used[2]),
        ],
        coins: [{ lane: railLane, dz: 0, count: 7, shape: 'ring', length: 20, y: 2.5 }],
      };
    },
  },
  {
    id: 'zip_line',
    complexity: 2,
    length: 38,
    weight: 1.3,
    tags: ['aerial', 'waterfall'],
    build: (rng) => {
      const { used, open } = occupancy(rng, 3);
      return {
        hazards: [H(0, 'zipRail', open[0]), H(0, 'fallingCrate', used[0]), H(14, 'spikeTrap', used[1], { phase: 0.6 }), H(26, 'crate', used[2])],
        coins: [{ lane: open[0], dz: 0, count: 8, shape: 'ring', length: 24, y: 3.7 }],
      };
    },
  },
  {
    id: 'wave_surge',
    complexity: 3,
    length: 32,
    weight: 1.5,
    tags: ['beach', 'waterfall', 'marina'],
    build: (rng) => {
      const { used, open } = occupancy(rng, 3);
      return {
        hazards: [
          H(0, 'waterSurge', used[0]),
          H(0, 'waterSurge', used[1]),
          H(13, 'jetSki', open[0], { phase: 0.7 }),
        ],
        coins: [coinLine(open[1], 0, 7)],
      };
    },
  },
  {
    id: 'marina_traffic',
    complexity: 3,
    length: 36,
    weight: 1.5,
    tags: ['marina'],
    build: (rng) => {
      const { used, open } = occupancy(rng, 3);
      return {
        hazards: [
          H(0, 'boat', used[0], { phase: 0 }),
          H(12, 'container', used[1]),
          H(24, 'jetSki', used[2], { phase: 1.2 }),
        ],
        coins: [coinLine(open[0], 0, 9)],
      };
    },
  },
  {
    id: 'colossus',
    complexity: 3,
    elite: true,
    length: 44,
    weight: 0.9,
    tags: ['*'],
    build: (rng) => {
      const { used, open } = occupancy(rng, 4);
      return {
        hazards: [
          H(0, 'totem', used[0]),
          H(0, 'spikeSpinner', used[1], { phase: 0.4 }),
          H(14, 'tikiRotator', used[0], { phase: 1.9 }),
          H(14, 'stoneWall', used[2]),
          H(28, 'boulder', used[3], { phase: 0 }),
          H(36, 'gateArch', open[0]),
        ],
        coins: [coinLine(open[0], -4, 10), coinLine(open[1], 12, 6)],
        elite: true,
      };
    },
  },
  {
    id: 'kraken',
    complexity: 3,
    elite: true,
    length: 40,
    weight: 0.8,
    tags: ['*'],
    build: (rng) => {
      const { used, open } = occupancy(rng, 4);
      return {
        hazards: [
          H(0, 'boat', used[0], { phase: 0.1 }),
          H(12, 'explosiveBarrel', used[1]),
          H(12, 'explosiveCrate', used[2]),
          H(24, 'container', used[3]),
          H(32, 'crate', open[0]),
        ],
        coins: [coinLine(open[0], -2, 12), coinLine(open[1], 14, 6)],
        elite: true,
      };
    },
  },
  {
    id: 'volcano_god',
    complexity: 3,
    elite: true,
    length: 42,
    weight: 0.8,
    tags: ['*'],
    build: (rng) => {
      const { used, open } = occupancy(rng, 4);
      return {
        hazards: [
          H(0, 'lavaGeyser', used[0], { phase: 0 }),
          H(0, 'lavaGeyser', used[1], { phase: 1.7 }),
          H(14, 'boulder', used[2], { phase: 0 }),
          H(26, 'explosiveBarrel', used[3]),
          H(34, 'crate', open[0]),
        ],
        coins: [coinLine(open[0], -4, 12), coinLine(open[1], 16, 6)],
        elite: true,
      };
    },
  },
];

/** Always-valid fallback, used if every drawn pattern fails validation. */
const SAFE_PATTERN = {
  id: 'safe_row',
  complexity: 1,
  length: 18,
  build: (rng) => {
    const { used, open } = occupancy(rng, 1);
    return { hazards: [H(0, 'crate', used[0])], coins: [coinLine(open[0], 0, 5)] };
  },
};

export class PatternDirector {
  constructor(difficultyId, seed = 1234) {
    this.setDifficulty(difficultyId);
    this.seed = seed;
    this.rng = makeRng(seed);
    this.nextZ = 120;
    this.prevSafe = [2];
    this.groups = 0;
  }

  setDifficulty(difficultyId) {
    this.difficultyId = GAME_CONFIG.difficulty[difficultyId] ? difficultyId : 'hard';
    this.difficulty = GAME_CONFIG.difficulty[this.difficultyId];
  }

  reset(difficultyId, seed) {
    if (difficultyId) this.setDifficulty(difficultyId);
    this.rng = makeRng(seed ?? this.seed);
    this.nextZ = 120;
    this.prevSafe = [2];
    this.groups = 0;
  }

  estimateSpeed(z) {
    const d = this.difficulty;
    const t = Math.max(0, z) / 24;
    return Math.min(d.speedMax, d.speedStart + d.acceleration * t);
  }

  /** Reaction-distance gap between groups for the current difficulty. */
  gapFor(z) {
    const d = this.difficulty;
    const speed = this.estimateSpeed(z);
    const base = speed * REACTION[this.difficultyId];
    const jitter = 0.85 + this.rng() * 0.4;
    return Math.max(d.minGap, Math.min(d.maxGap, base * jitter));
  }

  pickPattern(biomeId) {
    const d = this.difficulty;
    const pool = [];
    PATTERNS.forEach((pattern) => {
      if (pattern.complexity > d.complexity) return;
      let weight = pattern.weight;
      if (biomeId && pattern.tags && !pattern.tags.includes('*') && pattern.tags.includes(biomeId)) weight *= 1.9;
      if (pattern.elite) {
        weight *= d.complexity >= 3 ? 1 : 0.25;
      }
      pool.push({ pattern, weight });
    });
    const total = pool.reduce((sum, entry) => sum + entry.weight, 0);
    let roll = this.rng() * total;
    for (const entry of pool) {
      roll -= entry.weight;
      if (roll <= 0) return entry.pattern;
    }
    return pool[0].pattern;
  }

  /**
   * Fill the world up to `horizon`, emitting validated groups through `emit`.
   * @param emit {(group:{z:number, hazards:Array, coins:Array, elite:boolean})=>void}
   */
  fill(playerZ, horizon, biomeId, emit) {
    let guard = 0;
    while (this.nextZ < horizon && guard < 12) {
      guard += 1;
      const speed = this.estimateSpeed(this.nextZ);
      let built = null;
      for (let attempt = 0; attempt < 6 && !built; attempt += 1) {
        const pattern = this.pickPattern(biomeId);
        const candidate = pattern.build(this.rng);
        const result = this.validate(candidate.hazards, speed);
        if (result.ok) {
          built = { ...candidate, id: pattern.id, length: pattern.length, elite: !!pattern.elite };
          this.prevSafe = result.safe;
        }
      }
      if (!built) {
        const candidate = SAFE_PATTERN.build(this.rng);
        const result = this.validate(candidate.hazards, speed);
        built = { ...candidate, id: SAFE_PATTERN.id, length: SAFE_PATTERN.length, elite: false };
        this.prevSafe = result.safe.length ? result.safe : this.prevSafe;
      }

      emit({
        z: this.nextZ,
        hazards: built.hazards,
        coins: built.coins || [],
        elite: built.elite,
        patternId: built.id,
      });

      this.groups += 1;
      this.nextZ += built.length + this.gapFor(this.nextZ);
    }
    // Keep a healthy runway ahead even on very slow frames.
    if (horizon - this.nextZ > 60) this.nextZ = horizon - 40;
  }

  /**
   * Fairness proof. Returns whether the player can weave through the group.
   * @returns {{ok:boolean, safe:number[]}}
   */
  validate(hazards, speed) {
    const rows = new Map();
    hazards.forEach((h) => {
      const def = HAZARD_TYPES[h.type];
      if (!def) return;
      const key = Math.round((h.dz || 0) * 2) / 2;
      if (!rows.has(key)) rows.set(key, new Array(GAME_CONFIG.lanes.count).fill(null));
      const lane = h.lane ?? 2;
      const current = rows.get(key)[lane];
      const rank = CLASS_RANK[def.block] ?? 0;
      if (!current || rank > current.rank) rows.get(key)[lane] = { rank, block: def.block };
    });

    const ordered = Array.from(rows.entries()).sort((a, b) => a[0] - b[0]);
    if (!ordered.length) return { ok: true, safe: LANES };

    const tolerance = TOLERANCE[this.difficultyId];
    const maxShift = Math.max(1, Math.min(2, Math.floor(1 / (0.24 * Math.max(1, speed / 30)))) + 1);
    let previous = this.prevSafe;
    let currentSafe = [];

    for (let r = 0; r < ordered.length; r += 1) {
      const [dz, lanes] = ordered[r];
      const safe = [];
      lanes.forEach((cell, lane) => {
        const rank = cell ? cell.rank : 0;
        if (rank <= tolerance + 0.001) safe.push(lane);
      });
      if (!safe.length) return { ok: false, safe: previous };

      const reachable = safe.filter((lane) => previous.some((prev) => Math.abs(prev - lane) <= maxShift));
      if (!reachable.length) return { ok: false, safe: previous };

      // Rows that sit close together must share room to manoeuvre.
      const nextRow = ordered[r + 1];
      if (nextRow && previous.length + safe.length > 0) {
        const gapZ = Math.abs(nextRow[0] - dz);
        if (gapZ < 4 && reachable.length < GAME_CONFIG.lanes.count - 2) {
          return { ok: false, safe: previous };
        }
      }
      previous = safe;
      currentSafe = safe;
    }

    return { ok: true, safe: currentSafe.length ? currentSafe : LANES };
  }
}

export default PatternDirector;