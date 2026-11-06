const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

/**
 * Fizz Rush — CENTRAL GAME CONFIGURATION
 * ---------------------------------------------------------------------------
 * Every tunable value in the game lives here: difficulty curves, payout maths,
 * economy rules, progression, cosmetics, biomes, graphics presets and audio.
 *
 * IMPORTANT (as requested):
 *   - RTP and house edge are NOT hardcoded anywhere in this project.
 *   - Final production payout values are NOT hardcoded. Tune the multipliers
 *     below (one file) and every screen, leaderboard and calculation follows.
 *   - The wallet is a placeholder module (src/game/wallet.js) behind a small
 *     adapter interface, so a real balance service can be dropped in later
 *     without touching gameplay code.
 */

export const GAME_CONFIG = {
  meta: {
    title: 'Fizz Rush',
    tagline: 'Endless tropical casino runner',
    version: '1.0.0',
    saveVersion: 3,
  },

  // ----------------------------------------------------------------- ASSETS --
  assets: {
    hero: 'https://media.db.com/images/public/6ad147f03ae762f9894c9e46/d24ddb629_generated_image.png',
    cards: {
      jungle_temple: 'https://media.db.com/images/public/6ad147f03ae762f9894c9e46/63db4e4f2_generated_image.png',
      marina: 'https://media.db.com/images/public/6ad147f03ae762f9894c9e46/aa65402cb_generated_image.png',
      casino_district: 'https://media.db.com/images/public/6ad147f03ae762f9894c9e46/1c9f6a655_generated_image.png',
      volcano: 'https://media.db.com/images/public/6ad147f03ae762f9894c9e46/a9bcdcf88_generated_image.png',
    },
  },

  // ----------------------------------------------------------------- TRACK ---
  lanes: {
    count: 5,
    width: 2.3,
    snapLerp: 15, // lane change responsiveness (higher = snappier)
    maxLaneJump: 2, // fairness: lanes a player may cross between two hazard rows
  },

  world: {
    segmentLength: 28,
    segments: 12, // pooled road/terrain segments
    rowsPerSegment: 2,
    recycleBuffer: 48, // metres behind the player before a segment is reused
    biomeDistance: 620, // metres per environment before the island changes
    coinSpacing: 3.2,
    horizonFade: 340,
  },

  // ------------------------------------------------------------- DIFFICULTY --
  // Density = obstacle rows per 100m. Fairness gaps are enforced by the pattern
  // director using `minGap`, so a run is always completable.
  difficulty: {
    easy: {
      id: 'easy',
      name: 'Easy',
      blurb: 'Wide reaction windows, gentle density. Learn the island.',
      speedStart: 15,
      speedMax: 27,
      acceleration: 0.16,
      density: 0.58,
      complexity: 1,
      minGap: 27,
      maxGap: 42,
      graceHits: 2,
      coinRate: 1.0,
      payoutMultiplier: 0.6,
      xpMultiplier: 0.85,
      accent: '#5ce2c0',
      badge: 'Relaxed',
    },
    hard: {
      id: 'hard',
      name: 'Hard',
      blurb: 'The island at full pace. Layered hazards, real pressure.',
      speedStart: 21,
      speedMax: 42,
      acceleration: 0.32,
      density: 0.9,
      complexity: 2,
      minGap: 19,
      maxGap: 31,
      graceHits: 1,
      coinRate: 1.15,
      payoutMultiplier: 1.35,
      xpMultiplier: 1.1,
      accent: '#ffc94b',
      badge: 'Standard',
    },
    extreme: {
      id: 'extreme',
      name: 'Extreme',
      blurb: 'Maximum density, minimal windows. High-roller territory.',
      speedStart: 27,
      speedMax: 58,
      acceleration: 0.52,
      density: 1.32,
      complexity: 3,
      minGap: 13,
      maxGap: 22,
      graceHits: 0,
      coinRate: 1.35,
      payoutMultiplier: 2.6,
      xpMultiplier: 1.4,
      accent: '#ff6b5e',
      badge: 'High roller',
    },
  },
  difficultyOrder: ['easy', 'hard', 'extreme'],

  // ---------------------------------------------------------------- SCORING --
  scoring: {
    pointsPerMeter: 10,
    pointsPerCoin: 25,
    pointsPerGem: 250,
    pointsPerNearMiss: 45,
    pointsPerAirManoeuvre: 110,
    pointsPerGrindSecond: 40,
    pointsPerBonusEvent: 500,
    pointsPerObstacle: 15,
    combo: {
      step: 0.08, // multiplier gained per clean obstacle
      max: 5, // multiplier ceiling
      decayPerSecond: 0.22, // slow decay when idle
      resetOnHit: true,
      graceAfterHit: 0.6,
    },
    nearMissDistance: 0.78, // metres of clearance that counts as a skilful miss
  },

  // --------------------------------------------------------- INTEGRITY -------
  // Exploit resistance: scoring pauses whenever motion stops looking legitimate.
  integrity: {
    maxAirtimeSeconds: 2.3,
    maxSlideSeconds: 3.4,
    penetrationTolerance: 0.22,
    suspiciousGraceSeconds: 0.7,
    maxSpeed: 90,
    minSpeedForScoring: 4,
    maxLaneOffset: 9.5, // player may never drift outside the lane grid
    maxRunSeconds: 60 * 25,
    scoreSmoothing: 0.86,
  },

  // ----------------------------------------------------------------- PAYOUT --
  // Gross return = bet * difficultyMultiplier * distanceFactor
  //                * performanceMultiplier * bonusFactor * prestigeFactor
  // Clamped to [minPayoutMultiplier, maxPayoutMultiplier].
  payout: {
    enabled: true,
    rtpTarget: null, // deliberately unset — operator decision, not hardcoded
    houseEdge: null, // deliberately unset — operator decision, not hardcoded
    distanceScale: 400,
    distanceExponent: 0.72,
    distanceFloor: 0.05,
    distanceCap: 14,
    minPayoutMultiplier: 0,
    maxPayoutMultiplier: 60,
    returnRounding: 2,
    difficultyMultiplier: { easy: 0.6, hard: 1.35, extreme: 2.6 },
    performance: {
      comboPeakWeight: 0.12,
      nearMissWeight: 0.02,
      grindWeight: 0.05,
      airManoeuvreWeight: 0.03,
      obstacleWeight: 0.004,
      bonusWeight: 0.35,
      max: 8,
    },
    coinValue: 0.25, // Fizz Coins credited per coin collected (Real Mode)
    gemValue: 2.5,
    betPresets: [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
    minBet: 1,
    maxBet: 5000,
    payoutToBalanceOnly: true, // winnings are credited, never auto-rebet
  },

  // ---------------------------------------------------------------- ECONOMY --
  economy: {
    currencyName: 'Fizz Coins',
    currencySymbol: 'FC',
    startingBalance: 0, // spec: new players start with 0 Fizz Coins
    // The wallet is a placeholder adapter. `local` keeps the balance in this
    // browser; switch to your own adapter in src/game/wallet.js when the real
    // balance service is ready. No free-coin, daily or purchase systems exist.
    wallet: {
      adapter: 'local',
      key: 'fizzrush.wallet',
      maxBalance: 100000000,
    },
  },

  // ------------------------------------------------------------- PROGRESSION --
  progression: {
    xp: {
      perMeter: 0.32,
      perCoin: 1.1,
      perObstacle: 1.4,
      perNearMiss: 3,
      perGrindSecond: 0.7,
      perBonusEvent: 25,
      demoMultiplier: 0.35, // Demo Mode grants progress, but never currency
    },
    level: { base: 130, exponent: 1.42, max: 60 },
    prestige: { requiredLevel: 60, max: 10, payoutBonusPerLevel: 0.03, xpBonusPerLevel: 0.05, name: 'High Roller' },
    milestoneEvery: 5, // celebratory milestone each N levels
  },

  // -------------------------------------------------------------- COSMETICS --
  cosmetics: {
    rarities: {
      starter: { name: 'Starter', color: '#8fa8a4' },
      rare: { name: 'Rare', color: '#4ec8ff' },
      epic: { name: 'Epic', color: '#b98cff' },
      legendary: { name: 'Legendary', color: '#ffc94b' },
    },
    characters: [
      { id: 'fizz', name: 'Fizz', rarity: 'starter', blurb: 'The original soda-pop sprinter.', palette: { body: '#f5c14b', accent: '#1fb6a6', visor: '#08282c' }, unlock: { type: 'default' } },
      { id: 'sunny', name: 'Sunny Koa', rarity: 'starter', blurb: 'Beach-club regular with sand between the toes.', palette: { body: '#ff9d4d', accent: '#2ea3d6', visor: '#0b2430' }, unlock: { type: 'level', value: 3 } },
      { id: 'tiki', name: 'Tiki Totem', rarity: 'rare', blurb: 'Carved from temple stone, runs on jungle rhythm.', palette: { body: '#8a5a2b', accent: '#7fe36a', visor: '#16210f' }, unlock: { type: 'level', value: 8 } },
      { id: 'pearl', name: 'Pearl Diver', rarity: 'rare', blurb: 'Lagoon-born, never out of breath.', palette: { body: '#e8f6ff', accent: '#1fb6a6', visor: '#0d3b45' }, unlock: { type: 'level', value: 15 } },
      { id: 'pitboss', name: 'Pit Boss', rarity: 'epic', blurb: 'Runs the floor. Runs the island.', palette: { body: '#241a3a', accent: '#f5c14b', visor: '#ffd76a' }, unlock: { type: 'level', value: 24 } },
      { id: 'obsidian', name: 'Obsidian Oracle', rarity: 'epic', blurb: 'Forged in the caldera, cool under fire.', palette: { body: '#171b24', accent: '#ff6b5e', visor: '#ffb15e' }, unlock: { type: 'level', value: 35 } },
      { id: 'golden', name: 'Golden High Roller', rarity: 'legendary', blurb: 'Solid gold. Obviously.', palette: { body: '#ffdf9e', accent: '#b8801d', visor: '#3a2604' }, unlock: { type: 'prestige', value: 1 } },
      { id: 'phantom', name: 'Lagoon Phantom', rarity: 'legendary', blurb: 'Only visible in the spray of a waterfall.', palette: { body: '#2b6ef2', accent: '#6ef0ff', visor: '#04121f' }, unlock: { type: 'secret', value: 'lagoon_phantom' } },
    ],
    trails: [
      { id: 'none', name: 'No Trail', rarity: 'starter', blurb: 'Pure focus.', color: '#000000', unlock: { type: 'default' } },
      { id: 'spark', name: 'Fizz Spark', rarity: 'starter', blurb: 'Golden carbonation.', color: '#f5c14b', unlock: { type: 'default' } },
      { id: 'bubble', name: 'Bubble Wake', rarity: 'rare', blurb: 'Effervescent afterglow.', color: '#7be0ff', unlock: { type: 'level', value: 6 } },
      { id: 'ember', name: 'Caldera Ember', rarity: 'rare', blurb: 'Leaves a warm trail of ash.', color: '#ff7a4d', unlock: { type: 'level', value: 13 } },
      { id: 'neon', name: 'Neon Marker', rarity: 'epic', blurb: 'Casino strip lighting, following you.', color: '#c56bff', unlock: { type: 'level', value: 22 } },
      { id: 'aurora', name: 'Island Aurora', rarity: 'legendary', blurb: 'A ribbon of tropical light.', color: '#5cffc8', unlock: { type: 'level', value: 40 } },
    ],
    // Marketplace framework — priced in the app's single currency.
    purchase: { enabled: true, resale: false, maxOwned: 60 },
  },

  // ------------------------------------------------------------- SECRETS -----
  // Hidden island secrets: found by reaching specific places or performing
  // specific manoeuvres. No timed/daily challenge systems exist.
  secrets: [
    { id: 'lagoon_phantom', name: 'Lagoon Phantom', hint: 'Grind a marina rail for 4 seconds without touching the ground.', reward: { character: 'phantom' } },
    { id: 'temple_run', name: 'Temple Delver', hint: 'Reach the jungle temple in Extreme Mode.', reward: { xp: 500 } },
    { id: 'caldera_dash', name: 'Caldera Dash', hint: 'Reach the volcano having taken no hits.', reward: { xp: 750 } },
    { id: 'sky_crossing', name: 'Sky Crossing', hint: 'Air-jump above the floating islands.', reward: { trail: 'aurora' } },
  ],

  // ---------------------------------------------------------------- BIOMES ---
  // Eight tropical environments cycle as you run. Each one re-skins sky, fog,
  // water, terrain, props, ambience particles and hazard bias.
  biomes: [
    {
      id: 'beach', name: 'Sunset Beach', blurb: 'White sand, shallow lagoon, the resort skyline behind you.',
      sky: { top: '#0a4a7a', horizon: '#ffb56b', ground: '#3a2b1f', sun: '#fff0c9' },
      fog: { color: '#ffc98f', density: 0.0062 },
      hemi: { sky: '#bfe6ff', ground: '#c9a06a', intensity: 0.85 },
      sunLight: { color: '#fff3d6', intensity: 2.5, elevation: 0.35 },
      road: { surface: '#e3cfa5', curb: '#c7a877', line: '#fff6e0', rail: '#8d6b3f' },
      terrain: { color: '#e8d8ac', roughness: 0.95 },
      water: { shallow: '#4fd6d0', deep: '#0a6f86', foam: '#ffffff' },
      props: ['palm', 'palmCluster', 'parasol', 'bed', 'buoy', 'boat', 'rock', 'fern'],
      ambience: 'spray',
      hazardBias: { roller: 1.2, crosser: 1.1, static: 1 },
    },
    {
      id: 'jungle_temple', name: 'Jungle Temple', blurb: 'Ancient stone steps swallowed by rainforest.',
      sky: { top: '#062b2a', horizon: '#3f9c68', ground: '#0b2318', sun: '#e6ffbe' },
      fog: { color: '#54b584', density: 0.007 },
      hemi: { sky: '#9fe8c2', ground: '#26401f', intensity: 0.8 },
      sunLight: { color: '#d8ffc2', intensity: 2.1, elevation: 0.62 },
      road: { surface: '#6f7d64', curb: '#4d5a45', line: '#cfe3b8', rail: '#3c4736' },
      terrain: { color: '#2f5c34', roughness: 1 },
      water: { shallow: '#3fb9a8', deep: '#0b4a49', foam: '#dffaf2' },
      props: ['temple', 'tiki', 'statue', 'fern', 'vineArch', 'rock', 'lantern', 'waterfall'],
      ambience: 'leaves',
      hazardBias: { pendulum: 1.5, cycler: 1.4, rotator: 1.2 },
    },
    {
      id: 'marina', name: 'Marina & Dockyard', blurb: 'Boardwalk piers, yachts, and crates that will not stay put.',
      sky: { top: '#0b3f6b', horizon: '#8fd8f2', ground: '#0d2a33', sun: '#ffffff' },
      fog: { color: '#a9dff0', density: 0.0072 },
      hemi: { sky: '#cdefff', ground: '#7a9aa3', intensity: 0.9 },
      sunLight: { color: '#ffffff', intensity: 2.3, elevation: 0.5 },
      road: { surface: '#b98f63', curb: '#8a6740', line: '#f7ead4', rail: '#c9d3d8' },
      terrain: { color: '#2a6a73', roughness: 0.8 },
      water: { shallow: '#59d8e8', deep: '#075266', foam: '#f2ffff' },
      props: ['dockPier', 'boat', 'yacht', 'crateStack', 'buoy', 'crane', 'palm', 'lantern'],
      ambience: 'bubbles',
      hazardBias: { crosser: 1.6, faller: 1.4, static: 1.1 },
    },
    {
      id: 'waterfall', name: 'Twin Falls Cliffs', blurb: 'Coastal cliffs with waterfalls and ziplines overhead.',
      sky: { top: '#08344f', horizon: '#bff0e6', ground: '#123239', sun: '#ffffff' },
      fog: { color: '#cdf3ea', density: 0.009 },
      hemi: { sky: '#d6fbff', ground: '#4f6f63', intensity: 0.85 },
      sunLight: { color: '#f2fff8', intensity: 2.2, elevation: 0.45 },
      road: { surface: '#7f8d8a', curb: '#5d6a68', line: '#e9fffa', rail: '#9fb3b0' },
      terrain: { color: '#3f6b57', roughness: 0.9 },
      water: { shallow: '#6ee7dd', deep: '#0a5b6b', foam: '#ffffff' },
      props: ['cliff', 'waterfall', 'zipLine', 'palm', 'rock', 'vineArch', 'lantern', 'crystal'],
      ambience: 'spray',
      hazardBias: { faller: 1.5, roller: 1.2, rail: 1.3 },
    },
    {
      id: 'village', name: 'Island Village', blurb: 'Thatched huts, tiki torches, and a lot of traffic.',
      sky: { top: '#12406b', horizon: '#ffd9a3', ground: '#2d2016', sun: '#fff2d0' },
      fog: { color: '#f0cfa5', density: 0.0068 },
      hemi: { sky: '#ffe6c4', ground: '#6b5335', intensity: 0.85 },
      sunLight: { color: '#ffe9c2', intensity: 2.4, elevation: 0.4 },
      road: { surface: '#c9a97a', curb: '#9c7c52', line: '#fff4dd', rail: '#7a5c37' },
      terrain: { color: '#6f7d43', roughness: 1 },
      water: { shallow: '#54cfc4', deep: '#12606b', foam: '#ffffff' },
      props: ['hut', 'tiki', 'lantern', 'cart', 'palm', 'marketStall', 'statue', 'fern'],
      ambience: 'confetti',
      hazardBias: { crosser: 1.3, rotator: 1.3, exploder: 1.2 },
    },
    {
      id: 'casino_district', name: 'High-Roller District', blurb: 'Neon towers, gold trim, and hazards with better odds than you.',
      sky: { top: '#140a33', horizon: '#ff5fae', ground: '#1b1030', sun: '#ffd76a' },
      fog: { color: '#8a5ec4', density: 0.006 },
      hemi: { sky: '#ffd0f2', ground: '#3a1f5c', intensity: 0.85 },
      sunLight: { color: '#ffd9f0', intensity: 2.0, elevation: 0.72 },
      road: { surface: '#2a2140', curb: '#4a2f74', line: '#ffd76a', rail: '#8f6bd6' },
      terrain: { color: '#241a3c', roughness: 0.55, metalness: 0.25 },
      water: { shallow: '#8f6bff', deep: '#241055', foam: '#ffe9ff' },
      props: ['casinoTower', 'neonArch', 'fountain', 'palmLit', 'crateStack', 'statue', 'blimp', 'lantern'],
      ambience: 'confetti',
      hazardBias: { rotator: 1.7, rollingBig: 1.5, exploder: 1.3 },
    },
    {
      id: 'volcano', name: 'Volcanic Caldera', blurb: 'Black sand, lava channels, and a mountain that objects.',
      sky: { top: '#2a0d1c', horizon: '#ff8a3d', ground: '#160c10', sun: '#ffd08a' },
      fog: { color: '#9c5230', density: 0.0068 },
      hemi: { sky: '#ffb27a', ground: '#2a1414', intensity: 0.8 },
      sunLight: { color: '#ffbb85', intensity: 2.2, elevation: 0.5 },
      road: { surface: '#3a3138', curb: '#241f26', line: '#ff9155', rail: '#553b3b' },
      terrain: { color: '#241d22', roughness: 1 },
      water: { shallow: '#ff7a3d', deep: '#5c1608', foam: '#ffd0a3' },
      props: ['lavaRock', 'volcano', 'crystal', 'cliff', 'geyser', 'rock', 'emberBrazier', 'wreck'],
      ambience: 'embers',
      hazardBias: { geyser: 1.8, exploder: 1.6, faller: 1.2 },
    },
    {
      id: 'floating_isles', name: 'Floating Isles', blurb: 'Islands adrift in the sky, held up by waterfalls.',
      sky: { top: '#1b2c6b', horizon: '#a9e8ff', ground: '#1d3550', sun: '#ffffff' },
      fog: { color: '#c8ecff', density: 0.008 },
      hemi: { sky: '#e6f7ff', ground: '#6f8fb3', intensity: 0.9 },
      sunLight: { color: '#ffffff', intensity: 2.3, elevation: 0.4 },
      road: { surface: '#dce9f2', curb: '#a7c0d1', line: '#ffffff', rail: '#7ea6c4' },
      terrain: { color: '#5f8f74', roughness: 0.9 },
      water: { shallow: '#8fe8ff', deep: '#1d5f8f', foam: '#ffffff' },
      props: ['floatingIsle', 'crystal', 'zipLine', 'vineArch', 'blimp', 'waterfall', 'palm', 'statue'],
      ambience: 'bubbles',
      hazardBias: { rail: 1.6, faller: 1.5, crosser: 1.2 },
    },
  ],

  // ------------------------------------------------------- WORLD EVENTS -----
  // Dynamic, untimed-at-heart encounters that can appear during a run.
  worldEvents: {
    firstEventDistance: 520,
    minGapDistance: 420,
    maxGapDistance: 900,
    ambienceChance: 0.45,
    ambience: [
      { id: 'storm', name: 'Tropical Squall', duration: 22, fogBoost: 0.0025, tint: '#7c9aab', lightning: true },
      { id: 'golden_hour', name: 'Golden Hour', duration: 26, tint: '#ffd08a', lightBoost: 0.5 },
      { id: 'meteor_shower', name: 'Meteor Shower', duration: 20, particles: 'embers', tint: '#ff9a6b' },
      { id: 'kraken_breach', name: 'Lagoon Breach', duration: 18, particles: 'spray', tint: '#6fd6ff' },
      { id: 'festival', name: 'Island Festival', duration: 24, particles: 'confetti', tint: '#ffd76a', confetti: true },
    ],
    encounters: [
      { id: 'lucky_gate', name: 'Lucky Gate', weight: 3, reward: 'coins' },
      { id: 'gem_vault', name: 'Gem Vault', weight: 2, reward: 'gems' },
      { id: 'elite_gauntlet', name: 'Elite Gauntlet', weight: 2, reward: 'bonus' },
      { id: 'high_roller_wager', name: 'High Roller Wager', weight: 1, reward: 'multiplier' },
    ],
  },

  // -------------------------------------------------------------- GRAPHICS --
  graphics: {
    default: 'high',
    autoDegrade: true,
    targetFps: 60,
    degradeBelowFps: 46,
    upgradeAboveFps: 58,
    presets: {
      low: { id: 'low', name: 'Island Lite', dpr: 1, shadows: false, shadowMapSize: 512, particles: 150, props: 0.45, waterDetail: 0, speedLines: 0.5, bloom: false, renderScale: 0.85 },
      medium: { id: 'medium', name: 'Balanced', dpr: 1.25, shadows: true, shadowMapSize: 1024, particles: 340, props: 0.72, waterDetail: 1, speedLines: 0.8, bloom: false, renderScale: 0.95 },
      high: { id: 'high', name: 'High', dpr: 1.6, shadows: true, shadowMapSize: 2048, particles: 620, props: 1, waterDetail: 2, speedLines: 1, bloom: true, renderScale: 1 },
      ultra: { id: 'ultra', name: 'Ultra', dpr: 2, shadows: true, shadowMapSize: 4096, particles: 900, props: 1.25, waterDetail: 3, speedLines: 1, bloom: true, renderScale: 1.1 },
    },
    presetOrder: ['low', 'medium', 'high', 'ultra'],
    camera: {
      distance: 7.6,
      height: 3.6,
      lookAhead: 10,
      lookHeight: 1.4,
      fovBase: 62,
      fovMax: 86,
      fovSpeedFactor: 0.55,
      followLerp: 8.5,
      rollAmount: 0.035,
      shakeIntensity: 1,
    },
    motionBlur: { strength: 0.55, speedLines: 0.7 },
  },

  // ----------------------------------------------------------------- AUDIO --
  // All audio is synthesised at runtime (no asset downloads), so the game loads
  // instantly and the soundtrack can react to what the player is doing.
  audio: {
    master: 0.7,
    music: 0.5,
    sfx: 0.8,
    ambience: 0.45,
    tempo: 128,
    dynamicIntensity: true,
    muted: false,
  },

  // ---------------------------------------------------------- ACCESSIBILITY --
  accessibility: {
    reducedMotion: false,
    screenShake: true,
    damageFlash: true,
    largeHud: false,
    highContrast: false,
    hazardMarkers: true,
    colorblindSafe: false,
    captions: true,
    slowMode: false,
  },

  // ----------------------------------------------------------------- INPUT --
  input: {
    keyboard: true,
    touch: true,
    onScreenButtons: true,
    swipeThreshold: 26,
    jumpBufferMs: 140,
    coyoteTimeMs: 110,
    airJumps: 1,
    autoGrind: true,
  },

  // -------------------------------------------------------------- DEFAULTS --
  defaults: {
    difficulty: 'hard',
    mode: 'demo',
    quality: 'high',
  },
};

export const DIFFICULTIES = GAME_CONFIG.difficultyOrder.map((id) => GAME_CONFIG.difficulty[id]);
export const BIOMES = GAME_CONFIG.biomes;

export function getDifficulty(id) {
  return GAME_CONFIG.difficulty[id] || GAME_CONFIG.difficulty[GAME_CONFIG.defaults.difficulty];
}

export function getBiome(id) {
  return GAME_CONFIG.biomes.find((b) => b.id === id) || GAME_CONFIG.biomes[0];
}

export default GAME_CONFIG;