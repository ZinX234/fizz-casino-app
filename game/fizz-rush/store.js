import { GAME_CONFIG } from './config';

/**
 * Fizz Rush — local persistence
 * ---------------------------------------------------------------------------
 * Everything written to the browser goes through here, so save data can never
 * end up corrupt: every read is validated, repaired, or discarded in favour of
 * safe defaults. Nothing in this module throws.
 */

const KEY = 'fizzrush.store.v3';
const LEGACY_KEYS = ['fizzrush.store.v2', 'fizzrush.store.v1', 'fizzrush.store'];

function defaults() {
  return {
    version: GAME_CONFIG.meta.saveVersion,
    guestId: null,
    displayName: '',
    settings: null,
    lastConfig: { mode: GAME_CONFIG.defaults.mode, difficulty: GAME_CONFIG.defaults.difficulty, bet: GAME_CONFIG.payout.betPresets[1] },
    seenIntro: false,
    lastRun: null,
    updated: 0,
  };
}

function safeParse(raw) {
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? parsed : null;
  } catch {
    return null;
  }
}

/** Coerce any candidate save into a shape the rest of the app can trust. */
export function repair(candidate) {
  const base = defaults();
  if (!candidate || typeof candidate !== 'object') return base;
  const out = { ...base };
  out.version = GAME_CONFIG.meta.saveVersion;
  if (typeof candidate.guestId === 'string' && candidate.guestId.length < 64) out.guestId = candidate.guestId;
  if (typeof candidate.displayName === 'string') out.displayName = candidate.displayName.slice(0, 24);
  if (candidate.settings && typeof candidate.settings === 'object') out.settings = candidate.settings;
  if (candidate.lastRun && typeof candidate.lastRun === 'object') out.lastRun = candidate.lastRun;
  if (candidate.lastConfig && typeof candidate.lastConfig === 'object') {
    out.lastConfig = {
      mode: ['demo', 'real'].includes(candidate.lastConfig.mode) ? candidate.lastConfig.mode : base.lastConfig.mode,
      difficulty: GAME_CONFIG.difficultyOrder.includes(candidate.lastConfig.difficulty)
        ? candidate.lastConfig.difficulty
        : base.lastConfig.difficulty,
      bet: Number.isFinite(Number(candidate.lastConfig.bet)) ? Math.max(0, Number(candidate.lastConfig.bet)) : base.lastConfig.bet,
    };
  }
  out.seenIntro = candidate.seenIntro === true;
  out.updated = Date.now();
  return out;
}

let cache = null;

function readAll() {
  if (cache) return cache;
  try {
    for (const key of [KEY, ...LEGACY_KEYS]) {
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      const parsed = safeParse(raw);
      cache = repair(parsed);
      if (key !== KEY) writeAll(cache); // migrate forward
      return cache;
    }
  } catch {
    /* storage unavailable (private mode / quota) — fall back to memory */
  }
  cache = defaults();
  return cache;
}

function writeAll(next) {
  cache = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
    return true;
  } catch {
    return false;
  }
}

export const store = {
  all() {
    return { ...readAll() };
  },
  get(key) {
    return readAll()[key];
  },
  set(key, value) {
    const next = { ...readAll(), [key]: value };
    return writeAll(repair(next));
  },
  patch(partial) {
    const next = { ...readAll(), ...partial };
    return writeAll(repair(next));
  },
  reset() {
    return writeAll(defaults());
  },
};

export default store;