import { useSyncExternalStore } from 'react';
import { GAME_CONFIG } from './config';
import { store } from './store';

/**
 * Fizz Rush — preferences (graphics, audio, accessibility, input)
 * ---------------------------------------------------------------------------
 * Held in a tiny observable store so the React UI and the render loop read the
 * exact same values. Every value is clamped to the range the engine supports.
 */

function defaults() {
  return {
    quality: GAME_CONFIG.graphics.default,
    autoQuality: GAME_CONFIG.graphics.autoDegrade,
    resolutionScale: 1,
    audio: { ...GAME_CONFIG.audio },
    accessibility: { ...GAME_CONFIG.accessibility },
    input: { ...GAME_CONFIG.input },
    lastConfig: { ...store.get('lastConfig') },
  };
}

function clamp(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function clamp01(value, fallback = 0.5) {
  return clamp(value, 0, 1, fallback);
}

function bool(value, fallback) {
  return typeof value === 'boolean' ? value : fallback;
}

/** Repair any stored preferences into a valid shape. */
export function normalize(candidate) {
  const base = defaults();
  const c = candidate && typeof candidate === 'object' ? candidate : {};
  const order = GAME_CONFIG.graphics.presetOrder;
  return {
    quality: order.includes(c.quality) ? c.quality : base.quality,
    autoQuality: bool(c.autoQuality, base.autoQuality),
    resolutionScale: clamp(c.resolutionScale, 0.6, 1.4, 1),
    audio: {
      master: clamp01(c.audio?.master, base.audio.master),
      music: clamp01(c.audio?.music, base.audio.music),
      sfx: clamp01(c.audio?.sfx, base.audio.sfx),
      ambience: clamp01(c.audio?.ambience, base.audio.ambience),
      muted: bool(c.audio?.muted, base.audio.muted),
    },
    accessibility: {
      reducedMotion: bool(c.accessibility?.reducedMotion, base.accessibility.reducedMotion),
      screenShake: bool(c.accessibility?.screenShake, base.accessibility.screenShake),
      damageFlash: bool(c.accessibility?.damageFlash, base.accessibility.damageFlash),
      largeHud: bool(c.accessibility?.largeHud, base.accessibility.largeHud),
      highContrast: bool(c.accessibility?.highContrast, base.accessibility.highContrast),
      hazardMarkers: bool(c.accessibility?.hazardMarkers, base.accessibility.hazardMarkers),
      colorblindSafe: bool(c.accessibility?.colorblindSafe, base.accessibility.colorblindSafe),
      captions: bool(c.accessibility?.captions, base.accessibility.captions),
      slowMode: bool(c.accessibility?.slowMode, base.accessibility.slowMode),
    },
    input: {
      ...base.input,
      swipeThreshold: clamp(c.input?.swipeThreshold, 12, 60, base.input.swipeThreshold),
      jumpBufferMs: clamp(c.input?.jumpBufferMs, 0, 300, base.input.jumpBufferMs),
      onScreenButtons: bool(c.input?.onScreenButtons, base.input.onScreenButtons),
    },
    lastConfig: {
      mode: ['demo', 'real'].includes(c.lastConfig?.mode) ? c.lastConfig.mode : base.lastConfig.mode,
      difficulty: GAME_CONFIG.difficultyOrder.includes(c.lastConfig?.difficulty)
        ? c.lastConfig.difficulty
        : base.lastConfig.difficulty,
      bet: clamp(c.lastConfig?.bet, 0, GAME_CONFIG.payout.maxBet, base.lastConfig.bet),
    },
  };
}

const listeners = new Set();
let current = normalize(store.get('settings'));

function emit() {
  listeners.forEach((fn) => fn());
}

function commit(next) {
  current = normalize(next);
  store.set('settings', current);
  emit();
  return current;
}

export const settingsStore = {
  get() {
    return current;
  },
  /** Shallow patch for top-level keys, deep patch for the nested groups. */
  patch(partial) {
    return commit({ ...current, ...partial });
  },
  patchAudio(partial) {
    return commit({ ...current, audio: { ...current.audio, ...partial } });
  },
  patchAccessibility(partial) {
    return commit({ ...current, accessibility: { ...current.accessibility, ...partial } });
  },
  patchInput(partial) {
    return commit({ ...current, input: { ...current.input, ...partial } });
  },
  setQuality(id) {
    if (!GAME_CONFIG.graphics.presetOrder.includes(id)) return current;
    return commit({ ...current, quality: id });
  },
  reset() {
    return commit(defaults());
  },
  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};

export function useSettings() {
  return useSyncExternalStore(settingsStore.subscribe, settingsStore.get, settingsStore.get);
}

/** Active graphics preset object for the engine. */
export function graphicsPreset(settings = current) {
  return GAME_CONFIG.graphics.presets[settings.quality] || GAME_CONFIG.graphics.presets.high;
}

export default settingsStore;