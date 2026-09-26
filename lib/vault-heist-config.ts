export const VAULT_HEIST_OUTCOMES = [
  'cash_bundle',
  'gold_cache',
  'diamond_briefcase',
  'security_alert',
  'guard_patrol',
  'inside_informant',
  'master_key',
  'golden_vault',
  'caught',
] as const

export type VaultHeistOutcome = (typeof VAULT_HEIST_OUTCOMES)[number]
export type VaultHeistDifficulty = 'beginner' | 'standard' | 'expert' | 'insane'

export type VaultHeistProfile = {
  id: string
  name: string
  difficulty: VaultHeistDifficulty | 'custom'
  rtpBps: number
  securityMax: number
  maxMultiplier: number
  weights: Record<VaultHeistOutcome, number>
  enabled: Record<VaultHeistOutcome, boolean>
  custom: boolean
}

export type VaultHeistConfig = {
  profiles: VaultHeistProfile[]
  activeProfileId: string
  theme: 'cyber-vault' | 'classic-vault'
  provablyFairEnabled: boolean
}

const allEnabled = Object.fromEntries(VAULT_HEIST_OUTCOMES.map((outcome) => [outcome, true])) as Record<VaultHeistOutcome, boolean>

function profile(
  id: string,
  difficulty: VaultHeistDifficulty,
  rtpBps: number,
  securityMax: number,
  maxMultiplier: number,
  weights: Record<VaultHeistOutcome, number>,
): VaultHeistProfile {
  return { id, name: difficulty[0].toUpperCase() + difficulty.slice(1), difficulty, rtpBps, securityMax, maxMultiplier, weights, enabled: { ...allEnabled }, custom: false }
}

export const DEFAULT_VAULT_HEIST_CONFIG: VaultHeistConfig = {
  activeProfileId: 'standard',
  theme: 'cyber-vault',
  provablyFairEnabled: true,
  profiles: [
    profile('beginner', 'beginner', 9700, 7, 25, { cash_bundle: 380, gold_cache: 180, diamond_briefcase: 70, security_alert: 145, guard_patrol: 55, inside_informant: 65, master_key: 55, golden_vault: 10, caught: 40 }),
    profile('standard', 'standard', 9600, 5, 100, { cash_bundle: 300, gold_cache: 160, diamond_briefcase: 75, security_alert: 150, guard_patrol: 85, inside_informant: 60, master_key: 55, golden_vault: 10, caught: 105 }),
    profile('expert', 'expert', 9500, 4, 250, { cash_bundle: 250, gold_cache: 145, diamond_briefcase: 90, security_alert: 145, guard_patrol: 105, inside_informant: 55, master_key: 55, golden_vault: 15, caught: 140 }),
    profile('insane', 'insane', 9300, 3, 1000, { cash_bundle: 200, gold_cache: 120, diamond_briefcase: 105, security_alert: 120, guard_patrol: 125, inside_informant: 45, master_key: 45, golden_vault: 20, caught: 220 }),
  ],
}

export const VAULT_HEIST_REWARD_INCREASES: Partial<Record<VaultHeistOutcome, number>> = {
  cash_bundle: 0.12,
  gold_cache: 0.35,
  diamond_briefcase: 0.85,
  golden_vault: 4,
}

export const VAULT_HEIST_OUTCOME_LABELS: Record<VaultHeistOutcome, string> = {
  cash_bundle: 'Cash bundle',
  gold_cache: 'Gold cache',
  diamond_briefcase: 'Diamond briefcase',
  security_alert: 'Security alert',
  guard_patrol: 'Guard patrol',
  inside_informant: 'Inside informant',
  master_key: 'Master key',
  golden_vault: 'Golden vault',
  caught: 'Caught',
}

export function isVaultHeistOutcome(value: string): value is VaultHeistOutcome {
  return (VAULT_HEIST_OUTCOMES as readonly string[]).includes(value)
}

export function isVaultHeistDifficulty(value: string): value is VaultHeistDifficulty {
  return value === 'beginner' || value === 'standard' || value === 'expert' || value === 'insane'
}

export function payoutMultiplierForVaultPick(current: number, outcome: VaultHeistOutcome, maximum: number) {
  return Math.min(maximum, Math.round((current + (VAULT_HEIST_REWARD_INCREASES[outcome] ?? 0)) * 100) / 100)
}

export function assertVaultHeistConfig(value: unknown): asserts value is VaultHeistConfig {
  if (!value || typeof value !== 'object') throw new Error('Vault Heist settings are invalid.')
  const config = value as Partial<VaultHeistConfig>
  if (!Array.isArray(config.profiles) || !config.profiles.length) throw new Error('Add at least one Vault Heist profile.')
  const ids = new Set<string>()
  for (const item of config.profiles) {
    if (!item || !/^[a-z0-9][a-z0-9-]{1,39}$/.test(item.id) || ids.has(item.id)) throw new Error('Profile IDs must be unique and use lowercase letters, numbers, and hyphens.')
    ids.add(item.id)
    if (typeof item.name !== 'string' || item.name.trim().length < 2 || item.name.trim().length > 40) throw new Error('Profile names must be 2–40 characters.')
    if (!Number.isInteger(item.rtpBps) || item.rtpBps < 9000 || item.rtpBps > 9900) throw new Error('RTP must be between 90% and 99%.')
    if (!Number.isInteger(item.securityMax) || item.securityMax < 2 || item.securityMax > 10) throw new Error('Security maximum must be between 2 and 10.')
    if (!Number.isFinite(item.maxMultiplier) || item.maxMultiplier < 1.12 || item.maxMultiplier > 1000) throw new Error('Maximum multiplier must be between 1.12× and 1,000×.')
    let weightTotal = 0
    for (const outcome of VAULT_HEIST_OUTCOMES) {
      const weight = item.weights?.[outcome]
      if (!Number.isInteger(weight) || weight < 0 || weight > 10000 || typeof item.enabled?.[outcome] !== 'boolean') throw new Error('Outcome weights must be whole numbers from 0 to 10,000.')
      if (item.enabled[outcome]) weightTotal += weight
    }
    if (!weightTotal) throw new Error(`Profile “${item.name}” needs an enabled outcome with a positive weight.`)
  }
  if (!ids.has(String(config.activeProfileId))) throw new Error('Choose an existing active profile.')
  if (config.theme !== 'cyber-vault' && config.theme !== 'classic-vault') throw new Error('Choose a valid visual theme.')
  if (typeof config.provablyFairEnabled !== 'boolean') throw new Error('Provably fair settings must be enabled or disabled.')
}

export function cloneDefaultVaultHeistConfig(): VaultHeistConfig {
  return JSON.parse(JSON.stringify(DEFAULT_VAULT_HEIST_CONFIG)) as VaultHeistConfig
}

export function sanitizeVaultHeistConfig(value: unknown): VaultHeistConfig {
  const defaults = cloneDefaultVaultHeistConfig()
  if (!value || typeof value !== 'object') return defaults
  const candidate = value as Partial<VaultHeistConfig>
  try {
    assertVaultHeistConfig(candidate)
    return candidate
  } catch {
    return defaults
  }
}

export function profileHouseEdge(profile: VaultHeistProfile) {
  return 10_000 - profile.rtpBps
}

export function simulateVaultHeistCashoutAfterEverySafeDoor(profile: VaultHeistProfile, samples = 25_000) {
  const outcomes = VAULT_HEIST_OUTCOMES.filter((outcome) => profile.enabled[outcome] && profile.weights[outcome] > 0)
  const totalWeight = outcomes.reduce((sum, outcome) => sum + profile.weights[outcome], 0)
  let totalReturn = 0
  let caught = 0
  const bytes = new Uint32Array(1)
  for (let sample = 0; sample < samples; sample++) {
    crypto.getRandomValues(bytes)
    let ticket = (bytes[0] / 0x1_0000_0000) * totalWeight
    let outcome = outcomes[outcomes.length - 1]
    for (const candidate of outcomes) {
      ticket -= profile.weights[candidate]
      if (ticket < 0) { outcome = candidate; break }
    }
    if (outcome === 'caught' || (outcome === 'guard_patrol' && profile.securityMax <= 2) || (outcome === 'security_alert' && profile.securityMax <= 1)) {
      caught++
    } else {
      totalReturn += payoutMultiplierForVaultPick(1, outcome, profile.maxMultiplier)
    }
  }
  return { samples, estimatedRtpBps: Math.round((totalReturn / samples) * 10_000), caughtRateBps: Math.round((caught / samples) * 10_000), policy: 'cash out after the first surviving reveal' }
}

export function getVaultHeistOutcomeLabel(outcome: VaultHeistOutcome) {
  return VAULT_HEIST_OUTCOME_LABELS[outcome]
}
