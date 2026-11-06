import { GAME_CONFIG } from './config';
import { wallet } from './wallet';

/**
 * Fizz Rush — cosmetics
 * ---------------------------------------------------------------------------
 * Characters, trails and the marketplace framework. Unlocks come from level
 * milestones, prestige, hidden secrets or a direct purchase in Fizz Coins.
 * Every equipped item is validated: an item the player does not own can never
 * end up equipped, even if the stored profile was edited by hand.
 */

export const RARITIES = GAME_CONFIG.cosmetics.rarities;
export const CHARACTERS = GAME_CONFIG.cosmetics.characters;
export const TRAILS = GAME_CONFIG.cosmetics.trails;

export function findCharacter(id) {
  return CHARACTERS.find((c) => c.id === id) || CHARACTERS[0];
}

export function findTrail(id) {
  return TRAILS.find((t) => t.id === id) || TRAILS[0];
}

export function allItems() {
  return [
    ...CHARACTERS.map((c) => ({ ...c, slot: 'character' })),
    ...TRAILS.map((t) => ({ ...t, slot: 'trail' })),
  ];
}

export function defaultUnlockedIds() {
  return allItems()
    .filter((item) => item.unlock?.type === 'default')
    .map((item) => item.id);
}

export function isUnlocked(profile, id) {
  if (!id) return false;
  const item = allItems().find((i) => i.id === id);
  if (!item) return false;
  if (item.unlock?.type === 'default') return true;
  return (profile?.unlocked || []).includes(id);
}

export function unlockReason(item) {
  const u = item.unlock || {};
  if (u.type === 'level') return `Reach level ${u.value}`;
  if (u.type === 'prestige') return `Prestige tier ${u.value}`;
  if (u.type === 'secret') return 'Hidden island secret';
  if (u.type === 'cost') return `${u.value} FC`;
  return 'Available';
}

/**
 * Recompute level / prestige / secret unlocks. Idempotent, so it is safe to
 * run on every load — the stored list can never fall out of sync.
 */
export function evaluateUnlocks(profile) {
  const owned = new Set([...defaultUnlockedIds(), ...(profile?.unlocked || [])]);
  const newly = [];
  const level = profile?.level || 1;
  const prestige = profile?.prestige || 0;
  const secrets = profile?.secrets || [];

  for (const item of allItems()) {
    if (owned.has(item.id)) continue;
    const u = item.unlock || {};
    const earned =
      (u.type === 'level' && level >= u.value) ||
      (u.type === 'prestige' && prestige >= u.value) ||
      (u.type === 'secret' && secrets.includes(u.value));
    if (earned) {
      owned.add(item.id);
      newly.push(item.id);
    }
  }
  return { unlocked: Array.from(owned), newly };
}

export function equip(profile, slot, id) {
  const equipped = { ...(profile?.equipped || {}) };
  if (!isUnlocked(profile, id)) return profile;
  equipped[slot === 'character' ? 'character' : 'trail'] = id;
  return { ...profile, equipped };
}

/** Validate a stored loadout, repairing anything the player no longer owns. */
export function normalizeLoadout(profile) {
  const equipped = { ...(profile?.equipped || {}) };
  if (!isUnlocked(profile, equipped.character)) equipped.character = CHARACTERS[0].id;
  if (!isUnlocked(profile, equipped.trail)) equipped.trail = TRAILS[0].id;
  return { ...profile, equipped };
}

/** Marketplace purchase. Coins are debited only after every check passes. */
export function purchase(profile, itemId) {
  if (!GAME_CONFIG.cosmetics.purchase.enabled) return { ok: false, profile, reason: 'Market closed' };
  const item = allItems().find((i) => i.id === itemId);
  if (!item) return { ok: false, profile, reason: 'Unknown item' };
  if (isUnlocked(profile, itemId)) return { ok: false, profile, reason: 'Already owned' };
  if (item.unlock?.type !== 'cost') return { ok: false, profile, reason: unlockReason(item) };

  const price = Number(item.unlock.value) || 0;
  if (!wallet.canAfford(price)) return { ok: false, profile, reason: 'Not enough Fizz Coins' };
  if (!wallet.debit(price)) return { ok: false, profile, reason: 'Not enough Fizz Coins' };

  const unlocked = Array.from(new Set([...(profile.unlocked || []), itemId]));
  return { ok: true, profile: { ...profile, unlocked }, reason: 'Purchased', price };
}