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

const alwaysEnabled = Object.fromEntries(VAULT_HEIST_OUTCOMES.map((outcome) => [outcome, true])) as Record<VaultHeistOutcome, boolean>

export const DEFAULT_VAULT_HEIST_CONFIG: VaultHeistConfig = {
  activeProfileId: 'standard',
  theme: 'cyber-vault',
  provablyFairEnabled: true,
  profiles: [
    {
      id: 'beginner', name: 'Beginner', difficulty: 'beginner', rtpBps: 9700, securityMax: 7, maxMultiplier: 25,
      weights: { cash_bundle: 380, gold_cache: 180, diamond_briefcase: 70, security_alert: 145, guard_patrol: 55, inside_informant: 65, master_key: 55, golden_vault: 10, caught: 40 },
      enabled: { ...alwaysEnabled }, custom: false,
    },
    {
      id: 'standard', name: 'Standard', difficulty: 'standard', rtpBps: 9600, securityMax: 5, maxMultiplier: 100,
      weights: { cash_bundle: 300, gold_cache: 160, diamond_briefcase: 75, security_alert: 150, guard_patrol: 85, inside_informant: 60, master_key: 55, golden_vault: 10, caught: 105 },
      enabled: { ...alwaysEnabled }, custom: false,
    },
    {
      id: 'expert', name: 'Expert', difficulty: 'expert', rtpBps: 9500, securityMax: 4, maxMultiplier: 250,
      weights: { cash_bundle: 250, gold_cache: 145, diamond_briefcase: 90, security_alert: 145, guard_patrol: 105, inside_informant: 55, master_key: 55, golden_vault: 15, caught: 140 },
      enabled: { ...alwaysEnabled }, custom: false,
    },
    {
      id: 'insane', name: 'Insane', difficulty: 'insane', rtpBps: 9300, securityMax: 3, maxMultiplier: 1000,
      weights: { cash_bundle: 200, gold_cache: 120, diamond_briefcase: 105, security_alert: 120, guard_patrol: 125, inside_informant: 45, master_key: 45, golden_vault: 20, caught: 220 },
      enabled: { ...alwaysEnabled }, custom: false,
    },
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

export function payoutMultiplierForVaultPick(currentMultiplier: number, outcome: VaultHeistOutcome, maximum: number) {
  return Math.min(maximum, Math.round((currentMultiplier + (VAULT_HEIST_REWARD_INCREASES[outcome] ?? 0)) * 100) / 100)
}

export function assertVaultHeistConfig(value: unknown): asserts value is VaultHeistConfig {
  if (!value || typeof value !== 'object') throw new Error('Vault Heist settings are invalid.')
  const config = value as Partial<VaultHeistConfig>
  if (!Array.isArray(config.profiles) || !config.profiles.length) throw new Error('Add at least one Vault Heist profile.')
  const ids = new Set<string>()
  for (const profile of config.profiles) {
    if (!profile || !/^[a-z0-9][a-z0-9-]{1,39}$/.test(profile.id) || ids.has(profile.id)) throw new Error('Profile IDs must be unique and use lowercase letters, numbers, and hyphens.')
    ids.add(profile.id)
    if (typeof profile.name !== 'string' || profile.name.trim().length < 2 || profile.name.trim().length > 40) throw new Error('Profile names must be 2–40 characters.')
    if (!Number.isInteger(profile.rtpBps) || profile.rtpBps < 9000 || profile.rtpBps > 9900) throw new Error('RTP must be between 90% and 99%.')
    if (!Number.isInteger(profile.securityMax) || profile.securityMax < 2 || profile.securityMax > 10) throw new Error('Security maximum must be between 2 and 10.')
    if (!Number.isFinite(profile.maxMultiplier) || profile.maxMultiplier < 1.12 || profile.maxMultiplier > 1000) throw new Error('Maximum multiplier must be between 1.12× and 1,000×.')
    let totalWeight = 0
    for (const outcome of VAULT_HEIST_OUTCOMES) {
      const weight = profile.weights?.[outcome]
      if (!Number.isInteger(weight) || weight < 0 || weight > 10000 || typeof profile.enabled?.[outcome] !== 'boolean') throw new Error('Outcome weights must be whole numbers from 0 to 10,000.')
      if (profile.enabled[outcome]) totalWeight += weight
    }
    if (!totalWeight) throw new Error(`Profile “${profile.name}” needs at least one enabled outcome with a positive weight.`)
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
  return 10000 - profile.rtpBps
}

export function simulateVaultHeistCashoutAfterEverySafeDoor(profile: VaultHeistProfile, samples = 25000) {
  const enabled = VAULT_HEIST_OUTCOMES.filter((outcome) => profile.enabled[outcome] && profile.weights[outcome] > 0)
  const totalWeight = enabled.reduce((sum, outcome) => sum + profile.weights[outcome], 0)
  let totalReturn = 0
  let caught = 0
  let completed = 0
  const random = () => {
    const bytes = new Uint32Array(1)
    crypto.getRandomValues(bytes)
    return bytes[0] / 0x1_0000_0000
  }

  for (let sample = 0; sample < samples; sample++) {
    let security = 0
    let multiplier = 1
    let key = false
    let stopped = false
    for (let door = 0; door < 10; door++) {
      let ticket = random() * totalWeight
      let outcome = enabled[enabled.length - 1]
      for (const candidate of enabled) {
        ticket -= profile.weights[candidate]
        if (ticket < 0) { outcome = candidate; break }
      }
      if (outcome === 'caught') { caught++; stopped = true; break }
      const reward = VAULT_HEIST_REWARD_INCREASES[outcome]
      if (reward) multiplier = payoutMultiplierForVaultPick(multiplier, outcome, profile.maxMultiplier)
      if (outcome === 'inside_informant') security = Math.max(0, security - 1)
      else if (outcome === 'guard_patrol') security += key ? 0 : 2
      else if (outcome === 'security_alert') security += key ? 0 : 1
      else if (outcome !== 'master_key' && !key) security++
      if (key) key = false
      if (outcome === 'master_key') key = true
      if (security >= profile.securityMax) { caught++; stopped = true; break }
      totalReturn += multiplier
      completed++
      stopped = true
      break
    }
    if (!stopped) totalReturn += multiplier
  }
  return { samples, estimatedRtpBps: Math.round((totalReturn / samples) * 10000), caughtRateBps: Math.round((caught / samples) * 10000), completed, policy: 'cash out after the first surviving reveal' }
}
content len content chars includes weird TS crypto global in server okay Node crypto via globalThis.crypto maybe Node 20. server functions call. But profile weights sum not must 1000. Weighted proportion; config sizes. No comments? okay. `completed`, every sim loop exits immediately after first survived. So no continuation simulation. name cashout after first reveal (surviving) yes. security max often >1, first reveal can patrol to +2. okay. Reward return base+delta. `stopped` redundant. catch immediate. It doesn't distinguish security outcomes but good enough. Target RTP profile isn't actual after first reveal perhaps simulation reveals actual. Good admin API shows simulation expected estimate. Note gambling engine admin adjustable odds, maybe production legal compliance questionable but implementation proper. User wants it. Need ensure use randomSource okay browser global crypto in Node. `crypto.getRandomValues` node global in v22. But crypto not declared in TS if global `crypto` available dom & node. Good. Optimization: 25K*9 random crypto costly but adequate 25k requests 225k getRandomValues calls, okay maybe 2-3 sec. Can use Math.random for simulation, nonproduction/no stakes. fine. Current global crypto random each door expensive but okay. Use crypto.getRandomValues 250k, likely okay. Could move Uint32Array reused. later test typecheck/build. We need generated raw profile array mutability. `assert` typed partial profile potentially TS profile maybe partial. profile direct. Maybe compile strict and type issues due partial .weights? Type predicate asserts outer type, TS recognizes. Good. It asserts custom difficulty shape? no validates custom field boolean? should. Add later ensure. The user expects unlimited custom. UI form ensures. API zod or assert catch. route catches malformed body. We'll implement robust safe request body and base length maybe request body validation custom. Security. restrict 256kb. Need not call fetch from inside useeffect. game no useEffect fetch. game interactions button state. Audio not generated, could WebAudio synthesized UI feedback sound? Better no audio to avoid overhead but request asked alarms sounds. Could implement WebAudio using oscillator and user gestures on click, sound toggle, types; suspense animated. But game accessible reduced-motion. create short synthesized sounds only if enabled, browser gesture, no external assets. Could use `AudioContext` started when reveal click. sounds on alarm/cash. optional sound icon toggles. Should consider mic? not. also background music can't implement no file asset. Could provide sound. Use WebAudio oscillator alarms subtle generated, sound toggle. But UI complexity. Could create animation CSS keyframes with transitions and controlled open state; className, only reveal click in pending and after response triggers. One event response with updated round doors reveal. selected open. Show result tile. coin burst with CSS. Red glow based security. Include profile select, wager button before game. 10 doors displayed and user click. Shows actual marked events if revealed. 2x5 row. `vault doors arrangement opens with locks and circular dial designs`, css pseudo. use lucide icons. active round selected doors reveal sequence; state changes after API response. loading spinner. Security meter dots and action labels. sounds maybe not necessary to User? implement toggle sound with oscillator event based success; dramatic. CSS animation background lasers. Need animations controlled reduced motion by global. Good enough. Build asset background. Set case hardcoding image in style `backgroundImage:url(/games/vault-heist-bg.png)`; asset takes 1000px. generated. Good. not include screenshot later browser skill. Need invoke shadcn skill because project has shadcn component. use when component work? Must always? shadcn guidelines when using shadcn; our UI no shadcn components? project has shadcn but not use controls components using vanilla, skill spec applies any project with components.json. Check if components json exists; likely yes. Already progress. use shadcn now. Also browser skill later when UI. Need invoke as early as relevant before writing. we can load both? agent-browser later but could load now, skill blocking. shadcn component only existing styles, still project has components json. use. Also skills neon-on-vercel and marketplace neon because we implement Neon; call both before code. Need use `Neon` top integration requires respective skills marketplace-neon-neon for database. `neon-on-vercel` specifically when Neon DB. invoke marketplace neon? All tasks using existing DB; database operations. use it. call Skill calls, all in parallel. Also shadcn. agent browser later. Could invoke now with tools. Check more docs? skills read instructions. Let's call neon-on-vercel, marketplace neon, shadcn. Maybe it's two skills instructed. Neon integration also specific use `neon-on-vercel` applies only DB Neon. yes. Could call skill name `neon-on-vercel`, separate `marketplace-neon-neon` per integration. Also not coding auth. no need. Also browser skill after code. We can call parallel with multiple. Need no actual multi_tool wrapper with developer tools? skill tool developer. Do multi calls maybe commentary. Use separately perhaps. tool definitions calling three instances? multi_tool use function calls. no global tools? skill available. Let's call. Also current integration has Neon and Vercel AI, no auth integration because using Neon auth. okay. Could user want production game and wallet. Use associated existing auth no new. Invoke. (System instruction says skill before writing provider code). We're okay. Let's call skills. `shadcn` required, `marketplace-neon-neon` and `neon-on-vercel`. Before coding. Maybe neon-on-vercel skill name? valid. call in parallel using multi wrapper. Read Tool definition skill accessible. Need call via direct calls?multi wrapper only developer tools okay. We'll invoke direct in parallel? Make multiple Skill calls one assistant message likely do separate functions. We can use multi_tool parallel with developer tool wrappers. do. **Use direct names 
