export const SETTINGS_KEY = "fizz.shatterpoint.settings.v1";
export const DEV_KEY = "fizz.shatterpoint.dev.v1";
export const STATS_KEY = "fizz.shatterpoint.stats.v1";
export const INTRO_KEY = "fizz.shatterpoint.intro.v1";

export const DEFAULT_SETTINGS = {
  master: 0.8,
  sfx: 0.85,
  music: 0.5,
  muted: false,
  graphics: "high", // high | medium | low
  animation: "full", // full | subtle | minimal
  cameraShake: true,
  reducedMotion: false,
  skipIntro: false,
};

export const DEFAULT_DEV = {
  stages: 12,
  theme: "neon", // neon | ember | frost
  animationQuality: "high", // high | medium | low
  cameraSpeed: "cinematic", // cinematic | brisk
  demoEnabled: true,
};

export const DEFAULT_STATS = { best: 0, runs: 0, wins: 0, totalStages: 0 };

export const THEMES = {
  neon: {
    label: "Neon Lime",
    primary: "#b6ff3c",
    secondary: "#ff2e9a",
    accent: "#ff7a18",
    fog: "#06070c",
  },
  ember: {
    label: "Ember Surge",
    primary: "#ff7a18",
    secondary: "#ff2e9a",
    accent: "#b6ff3c",
    fog: "#0b0605",
  },
  frost: {
    label: "Cryo Frost",
    primary: "#5ce1ff",
    secondary: "#b06bff",
    accent: "#b6ff3c",
    fog: "#04070d",
  },
};

export function readJSON(key, fallback) {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return fallback;
    return { ...fallback, ...parsed };
  } catch {
    return fallback;
  }
}

export function writeJSON(key, value) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable — preferences simply won't persist */
  }
}

export const loadSettings = () => readJSON(SETTINGS_KEY, DEFAULT_SETTINGS);
export const saveSettings = (s) => writeJSON(SETTINGS_KEY, s);
export const loadDev = () => readJSON(DEV_KEY, DEFAULT_DEV);
export const loadStats = () => readJSON(STATS_KEY, DEFAULT_STATS);
export const saveStats = (s) => writeJSON(STATS_KEY, s);

export const clampStages = (n) =>
  Math.max(3, Math.min(24, Number.isFinite(Number(n)) ? Math.round(Number(n)) : 12));