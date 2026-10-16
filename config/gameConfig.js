// Central configuration object for Donut Division.
// All tunable game data lives here: RTP target, volatility, bet values,
// reel weights, symbol definitions, feature odds and animation speeds.

export const CONFIG = {
  name: 'Donut Division',
  currency: 'Fizz Coins',
  currencyShort: 'FC',

  reels: 5,
  rows: 5,
  lineCount: 25,

  // House figures (RTP, volatility) are supplied by the casino — see
  // config/casinoSettings. Nothing is set here on purpose.

  bets: {
    options: [400, 800, 2000, 4000, 8000, 20000, 40000],
    default: 800,
  },

  // Payouts are multiples of the line bet (total bet / 25 lines).
  symbols: {
    SPRINKLE: { id: 'SPRINKLE', label: 'Sprinkle Donut', tier: 'low', pay: { 3: 10, 4: 30, 5: 100 } },
    PINK: { id: 'PINK', label: 'Pink Frosted Donut', tier: 'low', pay: { 3: 12, 4: 40, 5: 150 } },
    CHOC: { id: 'CHOC', label: 'Pink Sprinkle Donut', tier: 'low', pay: { 3: 15, 4: 50, 5: 200 } },
    CONE: { id: 'CONE', label: 'Traffic Cone', tier: 'medium', pay: { 3: 20, 4: 80, 5: 400 } },
    REDLIGHT: { id: 'REDLIGHT', label: 'Red Light', tier: 'medium', pay: { 3: 25, 4: 120, 5: 600 } },
    COFFEE: { id: 'COFFEE', label: 'Coffee Cup', tier: 'medium', pay: { 3: 30, 4: 200, 5: 1000 } },
    DET_D: { id: 'DET_D', label: 'Rookie Reyes', tier: 'high', pay: { 3: 40, 4: 300, 5: 1200 } },
    DET_C: { id: 'DET_C', label: 'Sergeant Bloom', tier: 'high', pay: { 3: 50, 4: 400, 5: 1600 } },
    DET_B: { id: 'DET_B', label: 'Captain Nova', tier: 'high', pay: { 3: 75, 4: 600, 5: 2500 } },
    DET_A: { id: 'DET_A', label: 'Officer', tier: 'high', pay: { 3: 100, 4: 1000, 5: 5000 } },
    WILD: { id: 'WILD', label: 'Gooey Wild', tier: 'special', pay: { 5: 12500 } },
    SCATTER: {
      id: 'SCATTER',
      label: 'Case File Scatter',
      tier: 'special',
      payAnywhere: { 3: 2, 4: 10, 5: 50 }, // multiples of the TOTAL bet
      triggersBonus: true,
    },
  },

  // Reel weights: base weights, adjusted per reel.
  weights: {
    base: {
      SPRINKLE: 34, PINK: 30, CHOC: 26, CONE: 18, REDLIGHT: 14, COFFEE: 10,
      DET_D: 8, DET_C: 6, DET_B: 4, DET_A: 3, WILD: 3, SCATTER: 1.5,
    },
    perReel: [
      { WILD: 0.8 },
      { WILD: 1 },
      { WILD: 1.2, SCATTER: 1.4 },
      { WILD: 1 },
      { WILD: 0.8, SCATTER: 1.2 },
    ],
  },

  features: {
    gooey: { chance: 0.005, wildsMin: 3, wildsMax: 6 },
    bonus: {
      minScatters: 3,
      choices: [
        {
          id: 'sticky',
          title: 'STICKY WILD FREE SPINS',
          tagline: '10 Free Spins',
          description: 'Every wild that lands locks in place for the rest of the feature.',
          spins: 10,
          multiplier: 1,
          stickyCap: 3,
        },
        {
          id: 'pick',
          title: 'DETECTIVE PICK BONUS',
          tagline: 'Open the case files',
          description: 'Reveal clue cards and collect the prizes hidden inside.',
          picks: 3,
          prizes: [1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25],
        },
        {
          id: 'surveillance',
          title: 'MYSTERY SURVEILLANCE BONUS',
          tagline: '5 Free Spins',
          description: 'Random multipliers and random wild drops on every spin.',
          spins: 5,
          multipliers: [2, 3, 4, 5],
          wildsMin: 1,
          wildsMax: 2,
        },
      ],
    },
    maxWin: { chance: 0.0000012, multiplier: 12500 },
  },

  animation: {
    reelStopDelay: 520,
    reelStagger: 150,
    postStop: 280,
    spinSpeed: 240,
    quickFactor: 0.45,
    winCountMs: 900,
    featurePause: 700,
  },

  // Hooks for future sound integration.
  sound: { enabledByDefault: true },
};

export default CONFIG;