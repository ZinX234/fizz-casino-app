import type { CasinoGameError } from './casino-games'

export type SweetBonanzaSymbol = 'a' | 'b' | 'c' | 'g' | 'h' | 'm' | 'p' | 's' | 'z' | 'scatter'

export interface SymbolConfig {
  id: SweetBonanzaSymbol
  name: string
  payoutMultiplier: number // Base payout for 8+ matching symbols
  weight: number // Appearance weight (higher = more frequent)
  minMatch: number // Minimum symbols required for payout
}

export interface SweetBonanzaProfile {
  id: string
  name: string
  rtpBps: number // RTP in basis points (9500 = 95%)
  symbols: Record<SweetBonanzaSymbol, SymbolConfig>
  tumbleEnabled: boolean
  multiplierEnabled: boolean
  buyBonusCost: number // In Fizzcoins
  bonusFreeSpins: number // Number of free spins when buying bonus
  bonusMultiplierMin: number // Minimum multiplier during bonus
  bonusMultiplierMax: number // Maximum multiplier during bonus
  guaranteedMultiplierInBonus: boolean // Whether bonus guarantees multipliers
}

export interface SweetBonanzaConfig {
  activeProfileId: string
  profiles: SweetBonanzaProfile[]
}

export const DEFAULT_SYMBOLS: Record<SweetBonanzaSymbol, SymbolConfig> = {
  a: { id: 'a', name: 'Apple', payoutMultiplier: 2, weight: 50, minMatch: 8 },
  b: { id: 'b', name: 'Banana', payoutMultiplier: 3, weight: 45, minMatch: 8 },
  c: { id: 'c', name: 'Coconut', payoutMultiplier: 5, weight: 40, minMatch: 8 },
  g: { id: 'g', name: 'Grape', payoutMultiplier: 8, weight: 35, minMatch: 8 },
  h: { id: 'h', name: 'Heart', payoutMultiplier: 10, weight: 30, minMatch: 8 },
  m: { id: 'm', name: 'Melon', payoutMultiplier: 15, weight: 25, minMatch: 8 },
  p: { id: 'p', name: 'Peach', payoutMultiplier: 20, weight: 20, minMatch: 8 },
  s: { id: 's', name: 'Plum', payoutMultiplier: 25, weight: 15, minMatch: 8 },
  z: { id: 'z', name: 'Watermelon', payoutMultiplier: 50, weight: 10, minMatch: 8 },
  scatter: { id: 'scatter', name: 'Scatter', payoutMultiplier: 0, weight: 5, minMatch: 4 },
}

export function cloneDefaultSweetBonanzaConfig(): SweetBonanzaConfig {
  return {
    activeProfileId: 'standard',
    profiles: [
      {
        id: 'standard',
        name: 'Standard',
        rtpBps: 9600, // 96% RTP
        symbols: { ...DEFAULT_SYMBOLS },
        tumbleEnabled: true,
        multiplierEnabled: true,
        buyBonusCost: 10000,
        bonusFreeSpins: 10,
        bonusMultiplierMin: 1,
        bonusMultiplierMax: 100,
        guaranteedMultiplierInBonus: true,
      },
    ],
  }
}

export function sanitizeSweetBonanzaConfig(config: unknown): SweetBonanzaConfig {
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    return cloneDefaultSweetBonanzaConfig()
  }

  const cfg = config as Record<string, unknown>

  const profiles = Array.isArray(cfg.profiles)
    ? cfg.profiles
        .filter((p): p is Record<string, unknown> => p && typeof p === 'object' && !Array.isArray(p))
        .map((p) => sanitizeProfile(p))
        .filter((p): p is SweetBonanzaProfile => p !== null)
    : []

  if (profiles.length === 0) {
    return cloneDefaultSweetBonanzaConfig()
  }

  const activeProfileId =
    typeof cfg.activeProfileId === 'string' && profiles.some((p) => p.id === cfg.activeProfileId)
      ? cfg.activeProfileId
      : profiles[0].id

  return {
    activeProfileId,
    profiles,
  }
}

function sanitizeProfile(profile: Record<string, unknown>): SweetBonanzaProfile | null {
  if (typeof profile.id !== 'string' || !/^[a-z0-9][a-z0-9-]{1,39}$/.test(profile.id)) {
    return null
  }

  const symbols = typeof profile.symbols === 'object' && profile.symbols !== null
    ? sanitizeSymbols(profile.symbols as Record<string, unknown>)
    : { ...DEFAULT_SYMBOLS }

  return {
    id: profile.id,
    name: typeof profile.name === 'string' ? profile.name : 'Profile',
    rtpBps: typeof profile.rtpBps === 'number' && profile.rtpBps >= 5500 && profile.rtpBps <= 9900
      ? Math.round(profile.rtpBps)
      : 9600,
    symbols,
    tumbleEnabled: profile.tumbleEnabled === true,
    multiplierEnabled: profile.multiplierEnabled === true,
    buyBonusCost: typeof profile.buyBonusCost === 'number' && profile.buyBonusCost >= 1000
      ? Math.round(profile.buyBonusCost)
      : 10000,
    bonusFreeSpins: typeof profile.bonusFreeSpins === 'number' && profile.bonusFreeSpins >= 1
      ? Math.round(profile.bonusFreeSpins)
      : 10,
    bonusMultiplierMin: typeof profile.bonusMultiplierMin === 'number' && profile.bonusMultiplierMin >= 1
      ? Math.round(profile.bonusMultiplierMin)
      : 1,
    bonusMultiplierMax: typeof profile.bonusMultiplierMax === 'number' && profile.bonusMultiplierMax >= 2
      ? Math.round(profile.bonusMultiplierMax)
      : 100,
    guaranteedMultiplierInBonus: profile.guaranteedMultiplierInBonus === true,
  }
}

function sanitizeSymbols(symbols: Record<string, unknown>): Record<SweetBonanzaSymbol, SymbolConfig> {
  const result: Partial<Record<SweetBonanzaSymbol, SymbolConfig>> = {}

  for (const [key, value] of Object.entries(symbols)) {
    if (!['a', 'b', 'c', 'g', 'h', 'm', 'p', 's', 'z', 'scatter'].includes(key)) continue
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue

    const sym = value as Record<string, unknown>
    const id = key as SweetBonanzaSymbol

    result[id] = {
      id,
      name: typeof sym.name === 'string' ? sym.name : DEFAULT_SYMBOLS[id].name,
      payoutMultiplier: typeof sym.payoutMultiplier === 'number' && sym.payoutMultiplier > 0
        ? sym.payoutMultiplier
        : DEFAULT_SYMBOLS[id].payoutMultiplier,
      weight: typeof sym.weight === 'number' && sym.weight > 0
        ? Math.round(sym.weight)
        : DEFAULT_SYMBOLS[id].weight,
      minMatch: typeof sym.minMatch === 'number' && sym.minMatch >= 4 && sym.minMatch <= 8
        ? Math.round(sym.minMatch)
        : DEFAULT_SYMBOLS[id].minMatch,
    }
  }

  // Fill in any missing symbols with defaults
  for (const key of ['a', 'b', 'c', 'g', 'h', 'm', 'p', 's', 'z', 'scatter'] as SweetBonanzaSymbol[]) {
    if (!result[key]) {
      result[key] = { ...DEFAULT_SYMBOLS[key] }
    }
  }

  return result as Record<SweetBonanzaSymbol, SymbolConfig>
}

export function assertSweetBonanzaConfig(config: SweetBonanzaConfig): void {
  if (!config || typeof config !== 'object') {
    throw new Error('Sweet Bonanza configuration must be an object')
  }

  if (!Array.isArray(config.profiles) || config.profiles.length === 0) {
    throw new Error('Sweet Bonanza must have at least one profile')
  }

  if (typeof config.activeProfileId !== 'string') {
    throw new Error('Sweet Bonanza must have an active profile ID')
  }

  if (!config.profiles.some((p) => p.id === config.activeProfileId)) {
    throw new Error('Active profile ID must reference an existing profile')
  }

  for (const profile of config.profiles) {
    if (typeof profile.id !== 'string' || !/^[a-z0-9][a-z0-9-]{1,39}$/.test(profile.id)) {
      throw new Error('Profile ID must be a valid identifier')
    }

    if (typeof profile.name !== 'string' || profile.name.length === 0) {
      throw new Error('Profile must have a name')
    }

    if (typeof profile.rtpBps !== 'number' || profile.rtpBps < 5500 || profile.rtpBps > 9900) {
      throw new Error('Profile RTP must be between 55% and 99%')
    }

    if (typeof profile.buyBonusCost !== 'number' || profile.buyBonusCost < 1000) {
      throw new Error('Buy bonus cost must be at least 1000 Fizzcoins')
    }

    if (typeof profile.bonusFreeSpins !== 'number' || profile.bonusFreeSpins < 1) {
      throw new Error('Bonus free spins must be at least 1')
    }

    if (typeof profile.bonusMultiplierMin !== 'number' || profile.bonusMultiplierMin < 1) {
      throw new Error('Bonus multiplier minimum must be at least 1')
    }

    if (typeof profile.bonusMultiplierMax !== 'number' || profile.bonusMultiplierMax < 1) {
      throw new Error('Bonus multiplier maximum must be at least 1')
    }

    if (profile.bonusMultiplierMin > profile.bonusMultiplierMax) {
      throw new Error('Bonus multiplier minimum cannot exceed maximum')
    }

    if (!profile.symbols || typeof profile.symbols !== 'object') {
      throw new Error('Profile must have symbol configurations')
    }

    for (const [key, symbol] of Object.entries(profile.symbols)) {
      if (!['a', 'b', 'c', 'g', 'h', 'm', 'p', 's', 'z', 'scatter'].includes(key)) {
        throw new Error(`Invalid symbol ID: ${key}`)
      }

      if (typeof symbol.payoutMultiplier !== 'number' || symbol.payoutMultiplier <= 0) {
        throw new Error(`Symbol ${key} must have a positive payout multiplier`)
      }

      if (typeof symbol.weight !== 'number' || symbol.weight <= 0) {
        throw new Error(`Symbol ${key} must have a positive weight`)
      }

      if (typeof symbol.minMatch !== 'number' || symbol.minMatch < 4 || symbol.minMatch > 8) {
        throw new Error(`Symbol ${key} minMatch must be between 4 and 8`)
      }
    }
  }
}

export function calculateTotalWeight(profile: SweetBonanzaProfile): number {
  return Object.values(profile.symbols).reduce((total, symbol) => total + symbol.weight, 0)
}

export function payoutMultiplierForSymbolCount(symbol: SweetBonanzaSymbol, count: number, profile: SweetBonanzaProfile): number {
  const config = profile.symbols[symbol]
  if (count < config.minMatch) return 0

  // Progressive multipliers based on symbol count
  const baseMultiplier = config.payoutMultiplier
  const matchLevels = [8, 10, 12]

  if (count >= matchLevels[2]) return baseMultiplier * 2.5
  if (count >= matchLevels[1]) return baseMultiplier * 1.5
  if (count >= matchLevels[0]) return baseMultiplier

  return 0
}
