const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };


import { GAME_CONFIG } from './config';
import { store } from './store';
import { getIdentity } from './identity';
import { levelFromTotalXp, xpFromRun } from './progress';
import { defaultUnlockedIds, evaluateUnlocks, normalizeLoadout } from './cosmetics';

/**
 * Fizz Rush — player profile service
 * ---------------------------------------------------------------------------
 * One profile per identity, where identity is supplied by the casino site
 * (see identity.js) or falls back to a local guest id. Reads are repaired,
 * writes are validated, and cloud failures fall back to a local cache so a run
 * is never lost or corrupted.
 */

const EMPTY_STATS = () => ({
  runs: 0,
  bestScore: 0,
  bestDistance: 0,
  totalDistance: 0,
  coins: 0,
  bestMultiplier: 1,
  bestCombo: 1,
  bonusEvents: 0,
  hits: 0,
  nearMisses: 0,
  grindSeconds: 0,
  lastPlayed: null,
});

export function emptyProfile(playerId, displayName) {
  return {
    player_id: playerId,
    display_name: displayName || 'Guest Runner',
    xp: 0,
    level: 1,
    prestige: 0,
    unlocked: defaultUnlockedIds(),
    secrets: [],
    equipped: { character: 'fizz', trail: 'spark' },
    stats: {},
    totals: { runs: 0, distance: 0, coins: 0, nearMisses: 0, grindSeconds: 0, bonusEvents: 0, hits: 0 },
    best_score: 0,
    total_runs: 0,
    total_distance: 0,
    last_seen: new Date().toISOString(),
  };
}

/** Repair a stored profile so gameplay can trust every field. */
export function normalizeProfile(raw, playerId, displayName) {
  const base = emptyProfile(playerId, displayName);
  if (!raw || typeof raw !== 'object') return base;
  const xp = Math.max(0, Number(raw.xp) || 0);
  const { level } = levelFromTotalXp(xp);
  return {
    ...base,
    ...raw,
    player_id: playerId,
    display_name: String(raw.display_name || displayName || base.display_name).slice(0, 24),
    xp,
    level,
    prestige: Math.max(0, Math.min(GAME_CONFIG.progression.prestige.max, Math.floor(Number(raw.prestige) || 0))),
    unlocked: Array.from(new Set([...defaultUnlockedIds(), ...(Array.isArray(raw.unlocked) ? raw.unlocked : [])])),
    secrets: Array.isArray(raw.secrets) ? raw.secrets.filter((s) => typeof s === 'string') : [],
    equipped: typeof raw.equipped === 'object' && raw.equipped ? raw.equipped : base.equipped,
    stats: typeof raw.stats === 'object' && raw.stats ? raw.stats : {},
    totals: { ...base.totals, ...(typeof raw.totals === 'object' && raw.totals ? raw.totals : {}) },
    best_score: Math.max(0, Number(raw.best_score) || 0),
    total_runs: Math.max(0, Math.floor(Number(raw.total_runs) || 0)),
    total_distance: Math.max(0, Number(raw.total_distance) || 0),
  };
}

export async function loadProfile(identity) {
  const id = identity || getIdentity();
  try {
    const page = await db.entities.PlayerProfile.filter({ player_id: id.player_id }, { limit: 1 });
    const existing = page?.items?.[0];
    if (existing) {
      const profile = normalizeLoadout(normalizeProfile(existing, id.player_id, id.display_name));
      const { unlocked } = evaluateUnlocks(profile);
      return { ...profile, unlocked, identity: id, cloud: true };
    }
    const created = await db.entities.PlayerProfile.create(emptyProfile(id.player_id, id.display_name));
    return { ...normalizeLoadout(normalizeProfile(created, id.player_id, id.display_name)), identity: id, cloud: true };
  } catch {
    // Offline / no write permission: keep playing with a local profile.
    const cached = normalizeProfile(store.get('cachedProfile'), id.player_id, id.display_name);
    return { ...normalizeLoadout(cached), identity: id, cloud: false };
  }
}

export async function saveProfile(profile) {
  const snapshot = { ...profile };
  store.set('cachedProfile', snapshot);
  delete snapshot.identity;
  delete snapshot.cloud;
  try {
    const saved = await db.entities.PlayerProfile.update(profile.id, {
      display_name: snapshot.display_name,
      xp: snapshot.xp,
      level: snapshot.level,
      prestige: snapshot.prestige,
      unlocked: snapshot.unlocked,
      secrets: snapshot.secrets,
      equipped: snapshot.equipped,
      stats: snapshot.stats,
      totals: snapshot.totals,
      best_score: snapshot.best_score,
      total_runs: snapshot.total_runs,
      total_distance: snapshot.total_distance,
      last_seen: new Date().toISOString(),
    });
    return { profile: normalizeProfile(saved, profile.player_id, profile.display_name), cloud: true };
  } catch {
    return { profile: snapshot, cloud: false };
  }
}

export function emptyDifficultyStats() {
  return { demo: EMPTY_STATS(), real: EMPTY_STATS() };
}

/** Fold one finished run into the profile (stats, totals, XP, unlocks, secrets). */
export function applyRun(profile, { result, difficulty, mode }) {
  const stats = { ...(profile.stats || {}) };
  const bucket = { ...(stats[difficulty] || {}) };
  const prev = { ...EMPTY_STATS(), ...(bucket[mode] || {}) };

  const next = {
    runs: prev.runs + 1,
    bestScore: Math.max(prev.bestScore, result.score || 0),
    bestDistance: Math.max(prev.bestDistance, result.distance || 0),
    totalDistance: prev.totalDistance + (result.distance || 0),
    coins: prev.coins + (result.coins || 0),
    bestMultiplier: Math.max(prev.bestMultiplier, result.multiplier || 1),
    bestCombo: Math.max(prev.bestCombo, result.comboPeak || 1),
    bonusEvents: prev.bonusEvents + (result.bonusEvents || 0),
    hits: prev.hits + (result.hits || 0),
    nearMisses: prev.nearMisses + (result.nearMisses || 0),
    grindSeconds: prev.grindSeconds + (result.grindSeconds || 0),
    lastPlayed: new Date().toISOString(),
  };
  bucket[mode] = next;
  stats[difficulty] = bucket;

  const gained = xpFromRun(result, difficulty, mode);
  const xp = (profile.xp || 0) + gained;
  const levelInfo = levelFromTotalXp(xp);

  const totals = {
    runs: (profile.totals?.runs || 0) + 1,
    distance: (profile.totals?.distance || 0) + (result.distance || 0),
    coins: (profile.totals?.coins || 0) + (result.coins || 0),
    nearMisses: (profile.totals?.nearMisses || 0) + (result.nearMisses || 0),
    grindSeconds: (profile.totals?.grindSeconds || 0) + (result.grindSeconds || 0),
    bonusEvents: (profile.totals?.bonusEvents || 0) + (result.bonusEvents || 0),
    hits: (profile.totals?.hits || 0) + (result.hits || 0),
  };

  let updated = {
    ...profile,
    stats,
    totals,
    xp,
    level: levelInfo.level,
    best_score: Math.max(profile.best_score || 0, result.score || 0),
    total_runs: (profile.total_runs || 0) + 1,
    total_distance: (profile.total_distance || 0) + (result.distance || 0),
    last_seen: new Date().toISOString(),
  };

  const secrets = evaluateSecrets(updated, result, difficulty, mode);
  if (secrets.length) updated = { ...updated, secrets: [...(updated.secrets || []), ...secrets.map((s) => s.id)] };

  const { unlocked, newly } = evaluateUnlocks(updated);
  updated = normalizeLoadout({ ...updated, unlocked });

  return {
    profile: updated,
    xpGained: gained,
    levelInfo,
    leveledUp: levelInfo.level > (profile.level || 1),
    newUnlocks: newly,
    newSecrets: secrets,
  };
}

/** Hidden secrets — discovered by what the player actually did, never by time. */
function evaluateSecrets(profile, result, difficulty, mode) {
  const found = new Set(profile.secrets || []);
  const out = [];
  const check = (id, condition) => {
    if (condition && !found.has(id)) {
      found.add(id);
      out.push(GAME_CONFIG.secrets.find((s) => s.id === id) || { id, name: id });
    }
  };
  check('lagoon_phantom', (result.maxGrindSeconds || 0) >= 4);
  check('temple_run', result.biomeReached === 'jungle_temple' && difficulty === 'extreme');
  check('caldera_dash', result.biomeReached === 'volcano' && (result.hits || 0) === 0 && (result.distance || 0) > 2000);
  check('sky_crossing', result.biomeReached === 'floating_isles' && (result.airManoeuvres || 0) > 0);
  return out;
}