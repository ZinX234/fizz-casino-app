import { useEffect, useState } from 'react';
import { loadProfile, saveProfile, applyRun, emptyProfile } from '@/game/fizz-rush/game/profile';
import { getIdentity } from '@/game/fizz-rush/game/identity';

/**
 * Shared profile state.
 * ---------------------------------------------------------------------------
 * One fetch per session, cached in memory and broadcast to every screen, so the
 * header badge, the hub, the market and the run screen always agree. Every value
 * has already been repaired by the profile service before it lands here, which
 * is what makes progression corruption impossible.
 */

let cache = null;
let inflight = null;
const listeners = new Set();

function emit() {
  listeners.forEach((fn) => fn(cache));
}

export async function ensureProfile() {
  if (cache) return cache;
  if (!inflight) {
    inflight = (async () => {
      // A profile always resolves: offline or unreachable, the player still
      // gets a valid local profile instead of an endless loading screen.
      const identity = getIdentity();
      const loaded = await loadProfile(identity).catch(() => null);
      cache = loaded || { ...emptyProfile(identity.player_id, identity.display_name), identity, cloud: false };
      emit();
      return cache;
    })()
      .catch(() => null)
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

export function getCachedProfile() {
  return cache;
}

export function useProfile() {
  const [state, setState] = useState(cache);
  useEffect(() => {
    let alive = true;
    const fn = (value) => {
      if (alive) setState(value ? { ...value } : value);
    };
    listeners.add(fn);
    if (cache) fn(cache);
    else ensureProfile().catch(() => {});
    return () => {
      alive = false;
      listeners.delete(fn);
    };
  }, []);
  return { profile: state, loading: !state };
}

function adopt(saved) {
  cache = {
    ...saved.profile,
    id: saved.profile.id ?? cache?.id,
    identity: cache?.identity,
    cloud: saved.cloud,
  };
  emit();
  return cache;
}

/** Fold a finished run into the profile and persist it. Returns the rewards. */
export async function commitRun({ result, difficulty, mode, displayName }) {
  const current = await ensureProfile();
  const applied = applyRun(current, { result, difficulty, mode });
  const target = displayName ? { ...applied.profile, display_name: displayName } : applied.profile;
  const saved = await saveProfile(target);
  adopt(saved);
  return {
    profile: cache,
    xpGained: applied.xpGained,
    levelInfo: applied.levelInfo,
    leveledUp: applied.leveledUp,
    newUnlocks: applied.newUnlocks,
    newSecrets: applied.newSecrets,
    cloud: saved.cloud,
  };
}

/** Persist an arbitrary profile change (equipping, renaming, prestige...). */
export async function updateProfile(next) {
  const saved = await saveProfile(next);
  adopt(saved);
  return cache;
}

export default useProfile;