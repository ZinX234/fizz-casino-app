import 'server-only'

import { createHash, createHmac, randomBytes } from 'node:crypto'
import type { PoolClient } from 'pg'
import { databasePool, withTransaction } from '@/lib/db'
import type { CasinoGameSlug, GameRoundView, GameRtpSetting } from '@/lib/casino-game-types'
import { xpForFizzcoinWager } from '@/lib/progression'
import { assertVaultHeistConfig, cloneDefaultVaultHeistConfig, payoutMultiplierForRtp, payoutMultiplierForVaultPick, sanitizeVaultHeistConfig, type VaultHeistConfig, type VaultHeistOutcome, type VaultHeistProfile } from '@/lib/vault-heist-config'

export const CASINO_OWNER_EMAIL = 'benarch80@gmail.com'
const MIN_EDGE_BPS = 100
const MAX_EDGE_BPS = 1000
const MAX_WAGER_CENTS = 10_000
const MAX_SAFE_PICKS = 8
const CRASH_MAX_MULTIPLIER = 1000

const gameCatalog: Array<{ slug: CasinoGameSlug; name: string; description: string }> = [
  { slug: 'crash', name: 'Crash', description: 'Cash out before the multiplier crashes. The displayed RTP applies to new rounds.' },
  { slug: 'towers', name: 'Towers', description: 'Climb eight rows, choosing a safe column on each step.' },
  { slug: 'mines', name: 'Mines', description: 'Choose the mine count, reveal safe tiles, and cash out whenever you want.' },
  { slug: 'vault-heist', name: 'Vault Heist', description: 'Crack a high-security vault, manage the alarm, and decide when to make your escape.' },
]

export class CasinoGameError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message)
    this.name = 'CasinoGameError'
  }
}

function isGameSlug(value: string): value is CasinoGameSlug {
  return value === 'crash' || value === 'towers' || value === 'mines' || value === 'vault-heist'
}

function readHouseEdge(configuration: unknown) {
  const value = configuration && typeof configuration === 'object' && 'houseEdgeBps' in configuration
    ? Number((configuration as { houseEdgeBps: unknown }).houseEdgeBps)
    : 200
  return Number.isInteger(value) && value >= MIN_EDGE_BPS && value <= MAX_EDGE_BPS ? value : 200
}

export async function ensureBuiltInGames() {
  await databasePool.query(
    `INSERT INTO public.games (slug, name, provider, category, description, status, featured, configuration)
     VALUES
       ('crash', 'Crash', 'Fizz Originals', 'other', $1, 'available', true, '{"houseEdgeBps":200}'::jsonb),
       ('towers', 'Towers', 'Fizz Originals', 'other', $2, 'available', true, '{"houseEdgeBps":200}'::jsonb),
       ('mines', 'Mines', 'Fizz Originals', 'other', $3, 'available', true, '{"houseEdgeBps":200}'::jsonb)
     ON CONFLICT (slug) DO UPDATE SET configuration = public.games.configuration || EXCLUDED.configuration
       WHERE NOT (public.games.configuration ? 'houseEdgeBps')`,
    [gameCatalog[0].description, gameCatalog[1].description, gameCatalog[2].description],
  )
  await databasePool.query(
    `INSERT INTO public.games (slug, name, provider, category, description, status, featured, configuration)
     VALUES ('vault-heist', 'Vault Heist', 'Fizz Originals', 'other', $1, 'available', true, $2::jsonb)
     ON CONFLICT (slug) DO UPDATE SET configuration = public.games.configuration || jsonb_build_object('vaultHeist', EXCLUDED.configuration->'vaultHeist')
       WHERE NOT (public.games.configuration ? 'vaultHeist')`,
    [gameCatalog[3].description, JSON.stringify({ houseEdgeBps: 400, vaultHeist: cloneDefaultVaultHeistConfig() })],
  )
}

export async function getBuiltInRtpSettings(): Promise<GameRtpSetting[]> {
  await ensureBuiltInGames()
  const { rows } = await databasePool.query<{ slug: CasinoGameSlug; name: string; configuration: unknown }>(
    `SELECT slug, name, configuration FROM public.games WHERE slug = ANY($1::text[])
     ORDER BY CASE slug WHEN 'crash' THEN 1 WHEN 'towers' THEN 2 WHEN 'mines' THEN 3 ELSE 4 END`,
    [gameCatalog.map((game) => game.slug)],
  )
  return rows.filter((row) => isGameSlug(row.slug)).map((row) => {
    const configuration = parseOutcome(row.configuration)
    const vaultConfiguration = row.slug === 'vault-heist' ? sanitizeVaultHeistConfig(configuration.vaultHeist) : null
    const activeProfile = vaultConfiguration?.profiles.find((profile) => profile.id === vaultConfiguration.activeProfileId)
    const rtpBps = activeProfile?.rtpBps ?? (10_000 - readHouseEdge(row.configuration))
    return { slug: row.slug, name: row.name, houseEdgeBps: 10_000 - rtpBps, rtpBps }
  })
}

export async function getBuiltInRtpSetting(slug: CasinoGameSlug): Promise<GameRtpSetting | null> {
  const settings = await getBuiltInRtpSettings()
  return settings.find((setting) => setting.slug === slug) ?? null
}

export async function getVaultHeistConfiguration(): Promise<VaultHeistConfig> {
  await ensureBuiltInGames()
  const { rows } = await databasePool.query<{ configuration: unknown }>(
    `SELECT configuration FROM public.games WHERE slug = 'vault-heist' AND status = 'available' LIMIT 1`,
  )
  return sanitizeVaultHeistConfig(parseOutcome(rows[0]?.configuration).vaultHeist)
}

export async function updateVaultHeistConfiguration(actorUserId: string, configuration: VaultHeistConfig) {
  try {
    assertVaultHeistConfig(configuration)
  } catch (error) {
    throw new CasinoGameError(error instanceof Error ? error.message : 'Vault Heist settings are invalid.')
  }
  return withTransaction(async (client) => {
    const { rows } = await client.query<{ id: string; configuration: unknown }>(
      `SELECT id::text, configuration FROM public.games WHERE slug = 'vault-heist' FOR UPDATE`,
    )
    const game = rows[0]
    if (!game) throw new CasinoGameError('Vault Heist settings were not found.', 404)
    const previous = sanitizeVaultHeistConfig(parseOutcome(game.configuration).vaultHeist)
    await client.query(
      `UPDATE public.games SET configuration = configuration || jsonb_build_object('vaultHeist', $2::jsonb), updated_at = now() WHERE id = $1::uuid`,
      [game.id, JSON.stringify(configuration)],
    )
    await client.query(
      `INSERT INTO public.audit_logs (actor_user_id, action, entity_type, entity_id, details)
       VALUES ($1, 'game.vault-heist.updated', 'game', $2, $3::jsonb)`,
      [actorUserId, game.id, JSON.stringify({ previousProfileCount: previous.profiles.length, profileCount: configuration.profiles.length, activeProfileId: configuration.activeProfileId, theme: configuration.theme })],
    )
    return configuration
  })
}

export async function getVaultHeistLeaderboard() {
  const { rows } = await databasePool.query<{
    today: { name: string; payout: string; multiplier: number } | null
    all_time: { name: string; payout: string; multiplier: number } | null
    highest_multiplier: { name: string; payout: string; multiplier: number } | null
    longest_streak: { name: string; streak: number } | null
    recent: Array<{ name: string; payout: string; multiplier: number; createdAt: string }>
  }>(
    `WITH escapes AS (
       SELECT b.user_id, coalesce(nullif(u.name, ''), 'Player') AS name,
              b.wager_amount::numeric AS wager, b.payout_amount::numeric AS payout,
              coalesce((gr.outcome->>'cashoutMultiplier')::numeric, 1) AS multiplier,
              b.created_at, gr.outcome->>'result' AS result
       FROM public.bets b
       JOIN public.game_sessions gs ON gs.id = b.game_session_id
       JOIN public.games g ON g.id = b.game_id
       JOIN public.game_results gr ON gr.bet_id = b.id
       JOIN neon_auth."user" u ON u.id = b.user_id
       WHERE g.slug = 'vault-heist' AND b.status = 'settled' AND b.payout_amount > 0
     ), streak_rows AS (
       SELECT name, result, row_number() OVER (PARTITION BY user_id ORDER BY created_at)
         - row_number() OVER (PARTITION BY user_id, result ORDER BY created_at) AS streak_group
       FROM escapes
     ), streaks AS (
       SELECT name, count(*)::int AS streak FROM streak_rows WHERE result = 'win'
       GROUP BY name, streak_group ORDER BY streak DESC LIMIT 1
     )
     SELECT
       (SELECT jsonb_build_object('name', name, 'payout', payout::text, 'multiplier', multiplier)
        FROM escapes WHERE created_at >= date_trunc('day', now()) ORDER BY payout DESC LIMIT 1) AS today,
       (SELECT jsonb_build_object('name', name, 'payout', payout::text, 'multiplier', multiplier)
        FROM escapes ORDER BY payout DESC LIMIT 1) AS all_time,
       (SELECT jsonb_build_object('name', name, 'payout', payout::text, 'multiplier', multiplier)
        FROM escapes ORDER BY multiplier DESC, payout DESC LIMIT 1) AS highest_multiplier,
       (SELECT jsonb_build_object('name', name, 'streak', streak) FROM streaks) AS longest_streak,
       coalesce((SELECT jsonb_agg(jsonb_build_object('name', name, 'payout', payout::text, 'multiplier', multiplier, 'createdAt', created_at)
         ORDER BY created_at DESC) FROM (SELECT * FROM escapes ORDER BY created_at DESC LIMIT 8) recent_escapes), '[]'::jsonb) AS recent`,
  )
  return rows[0] ?? { today: null, all_time: null, highest_multiplier: null, longest_streak: null, recent: [] }
}

export async function getCasinoAdminAccess(userId: string, sessionEmail: string | null | undefined) {
  if (!sessionEmail || sessionEmail.trim().toLowerCase() !== CASINO_OWNER_EMAIL) {
    return { authorized: false }
  }

  return withTransaction(async (client) => {
    const { rows: inserted } = await client.query<{ user_id: string }>(
      `INSERT INTO public.user_roles (user_id, role_id, granted_by)
       SELECT u.id, 'admin', u.id FROM neon_auth."user" u
       WHERE u.id = $1 AND lower(u.email) = lower($2)
         AND EXISTS (SELECT 1 FROM public.roles WHERE id = 'admin')
       ON CONFLICT (user_id, role_id) DO NOTHING
       RETURNING user_id::text`,
      [userId, CASINO_OWNER_EMAIL],
    )

    if (inserted[0]) {
      await client.query(
        `INSERT INTO public.audit_logs (actor_user_id, action, entity_type, entity_id, details)
         VALUES ($1::uuid, 'admin.role.bootstrapped', 'user', $3::text, jsonb_build_object('email', $2::text))`,
        [userId, CASINO_OWNER_EMAIL, userId],
      )
    }

    const { rows } = await client.query<{ authorized: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM public.user_roles ur
         JOIN public.roles r ON r.id = ur.role_id
         JOIN neon_auth."user" u ON u.id = ur.user_id
         WHERE ur.user_id = $1 AND ur.role_id = 'admin' AND lower(u.email) = lower($2)
       ) AS authorized`,
      [userId, CASINO_OWNER_EMAIL],
    )
    return { authorized: rows[0]?.authorized === true }
  })
}

export async function updateBuiltInHouseEdge(actorUserId: string, slug: CasinoGameSlug, houseEdgeBps: number) {
  if (!Number.isInteger(houseEdgeBps) || houseEdgeBps < MIN_EDGE_BPS || houseEdgeBps > MAX_EDGE_BPS || houseEdgeBps % 10 !== 0) {
    throw new CasinoGameError('House edge must be between 1% and 10%, in 0.1% increments.')
  }

  if (slug === 'vault-heist') {
    return withTransaction(async (client) => {
      const { rows } = await client.query<{ id: string; name: string; configuration: unknown }>(
        `SELECT id::text, name, configuration FROM public.games WHERE slug = $1 FOR UPDATE`, [slug],
      )
      const game = rows[0]
      if (!game) throw new CasinoGameError('Game settings were not found.', 404)
      const previousConfiguration = sanitizeVaultHeistConfig(parseOutcome(game.configuration).vaultHeist)
      const previousProfile = previousConfiguration.profiles.find((profile) => profile.id === previousConfiguration.activeProfileId)
      const nextConfiguration = {
        ...previousConfiguration,
        profiles: previousConfiguration.profiles.map((profile) => ({ ...profile, rtpBps: 10_000 - houseEdgeBps })),
      }
      assertVaultHeistConfig(nextConfiguration)
      await client.query(
        `UPDATE public.games SET configuration = configuration || jsonb_build_object('vaultHeist', $2::jsonb), updated_at = now() WHERE id = $1::uuid`,
        [game.id, JSON.stringify(nextConfiguration)],
      )
      await client.query(
        `INSERT INTO public.audit_logs (actor_user_id, action, entity_type, entity_id, details)
         VALUES ($1, 'game.rtp.updated', 'game', $2, jsonb_build_object(
           'game', $3, 'previousHouseEdgeBps', $4, 'houseEdgeBps', $5,
           'previousRtpBps', $6, 'rtpBps', $7, 'scope', 'all-vault-profiles'
         ))`,
        [actorUserId, game.id, slug, 10_000 - (previousProfile?.rtpBps ?? 9_600), houseEdgeBps, previousProfile?.rtpBps ?? 9_600, 10_000 - houseEdgeBps],
      )
      return { slug, name: game.name, houseEdgeBps, rtpBps: 10_000 - houseEdgeBps }
    })
  }

  return withTransaction(async (client) => {
    const { rows } = await client.query<{ id: string; name: string; configuration: unknown }>(
      `SELECT id::text, name, configuration FROM public.games WHERE slug = $1 FOR UPDATE`, [slug],
    )
    const game = rows[0]
    if (!game) throw new CasinoGameError('Game settings were not found.', 404)

    const previousHouseEdgeBps = readHouseEdge(game.configuration)
    await client.query(
      `UPDATE public.games
       SET configuration = configuration || jsonb_build_object('houseEdgeBps', $2::int), updated_at = now()
       WHERE id = $1::uuid`,
      [game.id, houseEdgeBps],
    )
    await client.query(
      `INSERT INTO public.audit_logs (actor_user_id, action, entity_type, entity_id, details)
       VALUES ($1, 'game.rtp.updated', 'game', $2, jsonb_build_object(
         'game', $3, 'previousHouseEdgeBps', $4, 'houseEdgeBps', $5,
         'previousRtpBps', $6, 'rtpBps', $7
       ))`,
      [actorUserId, game.id, slug, previousHouseEdgeBps, houseEdgeBps, 10_000 - previousHouseEdgeBps, 10_000 - houseEdgeBps],
    )
    return {
      slug,
      name: game.name,
      houseEdgeBps,
      rtpBps: 10_000 - houseEdgeBps,
    }
  })
}

export async function getRecentGameSettingChanges() {
  const { rows } = await databasePool.query(
    `SELECT id::text, action, details, created_at::text AS created_at
     FROM public.audit_logs
     WHERE action = 'game.rtp.updated' AND entity_type = 'game'
     ORDER BY created_at DESC LIMIT 12`,
  )
  return rows
}

function deterministicInteger(serverSeed: string, input: string, max: number) {
  const range = 0x1_0000_0000
  const ceiling = range - (range % max)
  let counter = 0
  while (true) {
    const digest = createHmac('sha256', serverSeed).update(`${input}:${counter++}`).digest()
    const candidate = digest.readUInt32BE(0)
    if (candidate < ceiling) return candidate % max
  }
}

function makeMinePositions(serverSeed: string, clientSeed: string, sessionId: string, mineCount: number) {
  const positions = Array.from({ length: 25 }, (_, index) => index)
  for (let index = positions.length - 1; index > 0; index--) {
    const swapIndex = deterministicInteger(serverSeed, `mines:${clientSeed}:${sessionId}:${index}`, index + 1)
    ;[positions[index], positions[swapIndex]] = [positions[swapIndex], positions[index]]
  }
  return positions.slice(0, mineCount).sort((a, b) => a - b)
}

function makeTowerColumns(serverSeed: string, clientSeed: string, sessionId: string) {
  return Array.from({ length: MAX_SAFE_PICKS }, (_, row) =>
    deterministicInteger(serverSeed, `towers:${clientSeed}:${sessionId}:${row}`, 3),
  )
}

function makeCrashPoint(serverSeed: string, clientSeed: string, sessionId: string, rtpBps: number) {
  const digest = createHmac('sha256', serverSeed).update(`crash:${clientSeed}:${sessionId}`).digest()
  const unit = digest.readUInt32BE(0) / 0x1_0000_0000
  const rtp = rtpBps / 10_000
  return Math.min(CRASH_MAX_MULTIPLIER, Math.max(1, Math.floor((rtp / (1 - unit)) * 100) / 100))
}

function makeVaultHeistDoorOutcomes(serverSeed: string, clientSeed: string, sessionId: string, profile: VaultHeistProfile) {
  const outcomes = (Object.keys(profile.weights) as VaultHeistOutcome[])
    .filter((outcome) => profile.enabled[outcome] && profile.weights[outcome] > 0)
  const totalWeight = outcomes.reduce((total, outcome) => total + profile.weights[outcome], 0)
  if (!totalWeight) throw new CasinoGameError('This Vault Heist profile has no weighted outcomes.', 409)
  return Array.from({ length: 10 }, (_, position) => {
    const ticket = deterministicInteger(serverSeed, `vault-heist:${clientSeed}:${sessionId}:${position}`, totalWeight)
    let cumulative = 0
    for (const outcome of outcomes) {
      cumulative += profile.weights[outcome]
      if (ticket < cumulative) return outcome
    }
    return outcomes[outcomes.length - 1]
  })
}

function isHeistOutcome(value: unknown): value is VaultHeistOutcome {
  return typeof value === 'string' && ['cash_bundle', 'gold_cache', 'diamond_briefcase', 'security_alert', 'guard_patrol', 'inside_informant', 'master_key', 'golden_vault', 'caught'].includes(value)
}

function parseOutcome(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new CasinoGameError('Round data is unavailable.', 500)
  return value as Record<string, unknown>
}

function numberArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is number => Number.isInteger(item)) : []
}

function roundView(row: Record<string, any>): GameRoundView {
  const outcome = parseOutcome(row.outcome)
  const settled = row.bet_status === 'settled'
  const slug = row.slug as CasinoGameSlug
  const picks = numberArray(outcome.picks)
  const view: GameRoundView = {
    sessionId: row.session_id,
    slug,
    status: settled ? 'settled' : 'active',
    result: settled ? (outcome.result === 'win' ? 'win' : 'loss') : null,
    wager: row.wager_amount,
    payout: row.payout_amount,
    startedAt: new Date(row.started_at).toISOString(),
    commitment: row.server_seed_hash,
    clientSeed: String(outcome.clientSeed),
    houseEdgeBps: Number(outcome.houseEdgeBps),
    rtpBps: Number(outcome.rtpBps),
    picks: numberArray(outcome.picks),
  }

  if (slug === 'mines') {
    view.mineCount = Number(outcome.mineCount)
    if (settled) view.revealedMines = numberArray(outcome.minePositions)
  }
  if (slug === 'towers' && settled) view.revealedSafeColumns = numberArray(outcome.safeColumns)
  if (slug === 'crash' && settled) {
    view.crashPoint = Number(outcome.crashPoint)
    if (outcome.cashoutMultiplier !== undefined) view.cashoutMultiplier = Number(outcome.cashoutMultiplier)
  }
  if (slug === 'vault-heist') {
    const snapshot = parseOutcome(outcome.vaultHeistSnapshot)
    const revealedDoors = Array.isArray(outcome.revealedDoors)
      ? outcome.revealedDoors.filter((door): door is { position: number; outcome: VaultHeistOutcome; security: number; multiplier: number } =>
          Boolean(door && typeof door === 'object' && Number.isInteger(door.position) && isHeistOutcome(door.outcome) && Number.isInteger(door.security) && Number.isFinite(door.multiplier)))
      : []
    const rtpBps = Number(outcome.rtpBps)
    view.vaultHeist = {
      profileId: String(snapshot.id),
      profileName: String(snapshot.name),
      security: Number(outcome.security ?? 0),
      securityMax: Number(snapshot.securityMax),
      currentMultiplier: picks.length ? payoutMultiplierForRtp(Number(outcome.currentMultiplier ?? 1), rtpBps) : 1,
      maxMultiplier: payoutMultiplierForRtp(Number(snapshot.maxMultiplier), rtpBps),
      masterKeyPending: outcome.masterKeyPending === true,
      revealedDoors: revealedDoors.map((door) => ({ ...door, multiplier: payoutMultiplierForRtp(door.multiplier, rtpBps) })),
      ...(settled && Array.isArray(outcome.doorOutcomes) ? { allDoorOutcomes: outcome.doorOutcomes.filter(isHeistOutcome) } : {}),
    }
  }
  if (settled) {
    view.fairness = {
      serverSeed: String(outcome.serverSeed),
      clientSeed: String(outcome.clientSeed),
      commitment: row.server_seed_hash,
    }
  }
  return view
}

async function loadRound(client: PoolClient, userId: string, slug: CasinoGameSlug, sessionId: string, lock = true) {
  const { rows } = await client.query(
    `SELECT gs.id::text AS session_id, gs.started_at, gs.status AS session_status,
            b.id::text AS bet_id, b.wager_amount::text, b.payout_amount::text, b.status AS bet_status,
            gr.outcome, gr.server_seed_hash, g.slug
     FROM public.game_sessions gs
     JOIN public.bets b ON b.game_session_id = gs.id AND b.user_id = gs.user_id
     JOIN public.game_results gr ON gr.bet_id = b.id
     JOIN public.games g ON g.id = gs.game_id
     WHERE gs.id = $1::uuid AND gs.user_id = $2::uuid AND g.slug = $3
     ${lock ? 'FOR UPDATE OF gs, b, gr' : ''}`,
    [sessionId, userId, slug],
  )
  if (!rows[0]) throw new CasinoGameError('Round not found.', 404)
  return rows[0]
}

async function enforceResponsibleGaming(client: PoolClient, userId: string, wagerAmount: number) {
  const { rows: limits } = await client.query<{ limit_type: string; limit_amount: string | null; period: string | null; starts_at: Date }>(
    `SELECT limit_type, limit_amount::text, period, starts_at
     FROM public.responsible_gaming_limits
     WHERE user_id = $1::uuid AND starts_at <= now() AND (ends_at IS NULL OR ends_at > now())`, [userId],
  )
  if (limits.some((limit) => ['cooling_off', 'self_exclusion', 'suspension'].includes(limit.limit_type))) {
    throw new CasinoGameError('Play is unavailable while an account restriction is active.', 403)
  }

  for (const limit of limits) {
    if (limit.limit_type === 'session_time' && limit.limit_amount !== null) {
      const { rows } = await client.query<{ exceeded: boolean }>(
        `SELECT EXISTS (
           SELECT 1 FROM public.game_sessions
           WHERE user_id = $1::uuid AND status = 'active'
             AND started_at <= now() - ($2::numeric * interval '1 minute')
         ) AS exceeded`, [userId, limit.limit_amount],
      )
      if (rows[0]?.exceeded) throw new CasinoGameError('Your session time limit has been reached.', 403)
    }

    if (limit.limit_type === 'loss' && limit.limit_amount !== null) {
      const intervalDays = limit.period === 'day' ? 1 : limit.period === 'week' ? 7 : limit.period === 'month' ? 30 : null
      const cutoff = intervalDays === null
        ? limit.starts_at
        : new Date(Date.now() - intervalDays * 24 * 60 * 60 * 1000)
      const { rows } = await client.query<{ net_loss: string }>(
        `SELECT greatest(COALESCE(sum(wager_amount - payout_amount), 0), 0)::text AS net_loss
         FROM public.bets WHERE user_id = $1::uuid AND status = 'settled' AND created_at >= $2`,
        [userId, cutoff],
      )
      const currentLoss = Number(rows[0]?.net_loss ?? 0)
      if (currentLoss + wagerAmount > Number(limit.limit_amount)) {
        throw new CasinoGameError('This wager would exceed your active loss limit.', 403)
      }
    }
  }
}

async function getLockedWallet(client: PoolClient, userId: string) {
  const { rows } = await client.query<{ id: string; balance: string }>(
    `SELECT id::text, balance::text FROM public.wallets WHERE user_id = $1::uuid FOR UPDATE`, [userId],
  )
  if (!rows[0]) throw new CasinoGameError('Set up your wallet before playing.', 409)
  return rows[0]
}

async function insertWalletLedger(
  client: PoolClient,
  input: { userId: string; walletId: string; amount: string; type: 'bet' | 'payout'; betId: string; idempotencyKey: string; description: string },
) {
  const { rows } = await client.query(
    `INSERT INTO public.wallet_transactions
       (wallet_id, user_id, type, amount, balance_before, balance_after, reference_type, reference_id, idempotency_key, description)
     SELECT w.id, $1::uuid, $3, $4::numeric, w.balance, w.balance + $4::numeric,
            'bet', $5::uuid, $6, $7
     FROM public.wallets w WHERE w.id = $2::uuid
     RETURNING id::text`,
    [input.userId, input.walletId, input.type, input.amount, input.betId, input.idempotencyKey, input.description],
  )
  if (!rows[0]) throw new CasinoGameError('The wallet ledger could not be updated.', 500)
}

function requestLedgerKey(userId: string, requestId: string) {
  return `game:${userId}:${requestId}`
}

export async function startCasinoRound(input: {
  userId: string
  slug: CasinoGameSlug
  wagerCents: number
  mineCount: number
  requestId: string
  expectedRtpBps: number
  profileId?: string
}): Promise<GameRoundView> {
  if (!isGameSlug(input.slug)) throw new CasinoGameError('Unknown game.', 404)
  if (!Number.isInteger(input.wagerCents) || input.wagerCents < 100 || input.wagerCents > MAX_WAGER_CENTS) {
    throw new CasinoGameError('Wager must be between $1.00 and $100.00.')
  }
  if (input.slug === 'mines' && (!Number.isInteger(input.mineCount) || input.mineCount < 1 || input.mineCount > 24)) {
    throw new CasinoGameError('Choose between 1 and 24 mines.')
  }

  await ensureBuiltInGames()
  return withTransaction(async (client) => {
    const wallet = await getLockedWallet(client, input.userId)
    const idempotencyKey = requestLedgerKey(input.userId, input.requestId)
    const { rows: existing } = await client.query<{ session_id: string }>(
      `SELECT gs.id::text AS session_id FROM public.wallet_transactions wt
       JOIN public.bets b ON b.id = wt.reference_id
       JOIN public.game_sessions gs ON gs.id = b.game_session_id
       JOIN public.games g ON g.id = gs.game_id
       WHERE wt.user_id = $1::uuid AND wt.idempotency_key = $2 AND g.slug = $3 LIMIT 1`,
      [input.userId, idempotencyKey, input.slug],
    )
    if (existing[0]) return roundView(await loadRound(client, input.userId, input.slug, existing[0].session_id))

    const { rows: active } = await client.query(
      `SELECT gs.id FROM public.game_sessions gs
       JOIN public.games g ON g.id = gs.game_id
       JOIN public.bets b ON b.game_session_id = gs.id
       WHERE gs.user_id = $1::uuid AND gs.status = 'active' AND g.slug = $2 AND b.status = 'pending'
       LIMIT 1`, [input.userId, input.slug],
    )
    if (active[0]) throw new CasinoGameError('Finish your current round before starting another.', 409)

    const { rows: games } = await client.query<{ id: string; configuration: unknown }>(
      `SELECT id::text, configuration FROM public.games WHERE slug = $1 AND status = 'available' FOR SHARE`, [input.slug],
    )
    if (!games[0]) throw new CasinoGameError('This game is temporarily unavailable.', 404)

    const wagerAmount = (input.wagerCents / 100).toFixed(2)
    if (Number(wallet.balance) < Number(wagerAmount)) throw new CasinoGameError('Your wallet balance is too low.', 409)
    await enforceResponsibleGaming(client, input.userId, Number(wagerAmount))

    const vaultHeistConfig = input.slug === 'vault-heist'
      ? sanitizeVaultHeistConfig(parseOutcome(games[0].configuration).vaultHeist)
      : null
    const vaultHeistProfile = vaultHeistConfig
      ? vaultHeistConfig.profiles.find((profile) => profile.id === (input.profileId ?? vaultHeistConfig.activeProfileId))
      : null
    if (input.slug === 'vault-heist' && !vaultHeistProfile) throw new CasinoGameError('Choose an available Vault Heist profile.', 409)
    const houseEdgeBps = vaultHeistProfile ? 10_000 - vaultHeistProfile.rtpBps : readHouseEdge(games[0].configuration)
    const rtpBps = 10_000 - houseEdgeBps
    if (input.expectedRtpBps !== rtpBps) {
      throw new CasinoGameError(`Published RTP changed to ${(rtpBps / 100).toFixed(1)}% (house edge ${(houseEdgeBps / 100).toFixed(1)}%). Refresh this page to review the new settings before starting.`, 409)
    }
    const serverSeed = randomBytes(32).toString('hex')
    const commitment = createHash('sha256').update(serverSeed).digest('hex')
    const clientSeed = input.requestId
    const { rows: sessions } = await client.query<{ id: string; started_at: Date }>(
      `INSERT INTO public.game_sessions (user_id, game_id, status) VALUES ($1::uuid, $2::uuid, 'active')
       RETURNING id::text, started_at`, [input.userId, games[0].id],
    )
    const session = sessions[0]
    const { rows: bets } = await client.query<{ id: string }>(
      `INSERT INTO public.bets (user_id, wallet_id, game_session_id, game_id, wager_amount, status)
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::numeric, 'pending') RETURNING id::text`,
      [input.userId, wallet.id, session.id, games[0].id, wagerAmount],
    )
    const betId = bets[0].id
    const outcome: Record<string, unknown> = {
      game: input.slug,
      result: null,
      requestId: input.requestId,
      serverSeed,
      clientSeed,
      houseEdgeBps,
      rtpBps,
      picks: [],
      wagerCents: input.wagerCents,
    }
    if (input.slug === 'mines') {
      outcome.mineCount = input.mineCount
      outcome.minePositions = makeMinePositions(serverSeed, clientSeed, session.id, input.mineCount)
    }
    if (input.slug === 'towers') outcome.safeColumns = makeTowerColumns(serverSeed, clientSeed, session.id)
    if (input.slug === 'crash') outcome.crashPoint = makeCrashPoint(serverSeed, clientSeed, session.id, rtpBps)
    if (input.slug === 'vault-heist' && vaultHeistProfile) {
      outcome.vaultHeistSnapshot = vaultHeistProfile
      outcome.security = 0
      outcome.currentMultiplier = 1
      outcome.masterKeyPending = false
      outcome.revealedDoors = []
      outcome.doorOutcomes = makeVaultHeistDoorOutcomes(serverSeed, clientSeed, session.id, vaultHeistProfile)
    }

    await client.query(
      `INSERT INTO public.game_results (bet_id, outcome, payout_amount, server_seed_hash)
       VALUES ($1::uuid, $2::jsonb, 0, $3)`, [betId, JSON.stringify(outcome), commitment],
    )
    await insertWalletLedger(client, {
      userId: input.userId,
      walletId: wallet.id,
      amount: `-${wagerAmount}`,
      type: 'bet',
      betId,
      idempotencyKey,
      description: `${input.slug[0].toUpperCase()}${input.slug.slice(1)} wager`,
    })
    await client.query(
      `INSERT INTO public.player_progression (user_id, total_xp)
       VALUES ($1::uuid, $2::bigint)
       ON CONFLICT (user_id) DO UPDATE SET
         total_xp = public.player_progression.total_xp + EXCLUDED.total_xp,
         updated_at = now()`,
      [input.userId, xpForFizzcoinWager(input.wagerCents)],
    )

    return roundView({
      session_id: session.id,
      slug: input.slug,
      started_at: session.started_at,
      wager_amount: wagerAmount,
      payout_amount: '0.00',
      bet_status: 'pending',
      outcome,
      server_seed_hash: commitment,
    })
  })
}

async function settleRound(
  client: PoolClient,
  row: Record<string, any>,
  userId: string,
  outcome: Record<string, unknown>,
  payoutAmount: string,
  result: 'win' | 'loss',
) {
  const { rows: wallets } = await client.query<{ id: string }>(
    `SELECT id::text FROM public.wallets WHERE user_id = $1::uuid FOR UPDATE`, [userId],
  )
  const wallet = wallets[0]
  if (!wallet) throw new CasinoGameError('Wallet record could not be loaded.', 500)
  outcome.result = result
  outcome.payoutAmount = payoutAmount
  await client.query(
    `UPDATE public.bets SET status = 'settled', payout_amount = $2::numeric, settled_at = now() WHERE id = $1::uuid`,
    [row.bet_id, payoutAmount],
  )
  await client.query(
    `UPDATE public.game_results SET outcome = $2::jsonb, payout_amount = $3::numeric WHERE bet_id = $1::uuid`,
    [row.bet_id, JSON.stringify(outcome), payoutAmount],
  )
  await client.query(`UPDATE public.game_sessions SET status = 'completed', ended_at = now() WHERE id = $1::uuid`, [row.session_id])
  if (Number(payoutAmount) > 0) {
    await insertWalletLedger(client, {
      userId,
      walletId: wallet.id,
      amount: payoutAmount,
      type: 'payout',
      betId: row.bet_id,
      idempotencyKey: `game:payout:${row.bet_id}`,
      description: `${row.slug[0].toUpperCase()}${row.slug.slice(1)} payout`,
    })
  }
}

function multiplierForSafePicks(slug: CasinoGameSlug, picks: number, mineCount: number, rtpBps: number) {
  let survivalProbability = 1
  if (slug === 'towers') survivalProbability = (2 / 3) ** picks
  else {
    for (let index = 0; index < picks; index++) survivalProbability *= (25 - mineCount - index) / (25 - index)
  }
  const raw = (rtpBps / 10_000) / survivalProbability
  return Math.floor(raw * 100) / 100
}

export async function playCasinoAction(input: {
  userId: string
  slug: CasinoGameSlug
  sessionId: string
  action: 'pick' | 'cashout'
  position?: number
}): Promise<GameRoundView> {
  return withTransaction(async (client) => {
    const row = await loadRound(client, input.userId, input.slug, input.sessionId)
    if (row.bet_status !== 'pending' || row.session_status !== 'active') throw new CasinoGameError('This round is already finished.', 409)
    const outcome = parseOutcome(row.outcome)
    const picks = numberArray(outcome.picks)

    if (input.action === 'pick') {
      if (input.slug === 'crash') throw new CasinoGameError('Crash rounds use the cash-out action.')
      if (!Number.isInteger(input.position)) throw new CasinoGameError('Choose a valid game position.')
      if (input.slug === 'vault-heist') {
        const position = input.position!
        if (position < 0 || position > 9) throw new CasinoGameError('Choose one of the ten vault doors.')
        if (picks.includes(position)) throw new CasinoGameError('That vault door has already been opened.')
        if (picks.length >= 10) throw new CasinoGameError('There are no more doors in this round.', 409)
        const doorOutcomes = Array.isArray(outcome.doorOutcomes) ? outcome.doorOutcomes.filter(isHeistOutcome) : []
        const vaultSnapshot = parseOutcome(outcome.vaultHeistSnapshot)
        if (doorOutcomes.length !== 10) throw new CasinoGameError('The committed door sequence is unavailable.', 500)
        const vaultOutcome = doorOutcomes[position]
        const previousSecurity = Number(outcome.security ?? 0)
        const maximumSecurity = Number(vaultSnapshot.securityMax)
        const previousMultiplier = Number(outcome.currentMultiplier ?? 1)
        const keyWasPending = outcome.masterKeyPending === true
        let security = previousSecurity
        let multiplier = previousMultiplier

        picks.push(position)
        outcome.picks = picks
        if (vaultOutcome === 'caught') {
          security = maximumSecurity
        } else {
          multiplier = payoutMultiplierForVaultPick(previousMultiplier, vaultOutcome, Number(vaultSnapshot.maxMultiplier))
          if (vaultOutcome === 'inside_informant') security = Math.max(0, previousSecurity - 1)
          else if (!keyWasPending) {
            if (vaultOutcome === 'guard_patrol') security = previousSecurity + 2
            else security = previousSecurity + 1
          }
          outcome.masterKeyPending = vaultOutcome === 'master_key'
          if (keyWasPending && vaultOutcome === 'master_key') outcome.masterKeyPending = true
        }

        outcome.security = security
        outcome.currentMultiplier = multiplier
        const revealedDoors = Array.isArray(outcome.revealedDoors) ? outcome.revealedDoors : []
        revealedDoors.push({ position, outcome: vaultOutcome, security, multiplier })
        outcome.revealedDoors = revealedDoors
        const captured = vaultOutcome === 'caught' || security >= maximumSecurity
        if (captured) {
          outcome.captureReason = vaultOutcome === 'caught' ? 'caught' : 'security'
          await settleRound(client, row, input.userId, outcome, '0.00', 'loss')
        } else if (picks.length === 10) {
          const payoutMultiplier = payoutMultiplierForRtp(multiplier, Number(outcome.rtpBps))
          const payoutCents = Math.floor(Number(row.wager_amount) * payoutMultiplier * 100 + 1e-8)
          const payoutAmount = (payoutCents / 100).toFixed(2)
          outcome.cashoutMultiplier = payoutMultiplier
          await settleRound(client, row, input.userId, outcome, payoutAmount, 'win')
        } else {
          await client.query(`UPDATE public.game_results SET outcome = $2::jsonb WHERE bet_id = $1::uuid`, [row.bet_id, JSON.stringify(outcome)])
        }

        return roundView({
          ...row,
          bet_status: outcome.result ? 'settled' : 'pending',
          session_status: outcome.result ? 'completed' : 'active',
          payout_amount: String(outcome.payoutAmount ?? '0.00'),
          outcome,
        })
      }
      if (input.slug === 'towers' && (input.position! < 0 || input.position! > 2)) throw new CasinoGameError('Choose one of the three columns.')
      if (input.slug === 'mines' && (input.position! < 0 || input.position! > 24)) throw new CasinoGameError('Choose a tile on the board.')
      if (input.slug === 'mines' && picks.includes(input.position!)) throw new CasinoGameError('You already chose that tile.')
      const maxPicks = input.slug === 'towers' ? MAX_SAFE_PICKS : Math.min(MAX_SAFE_PICKS, 25 - Number(outcome.mineCount))
      if (picks.length >= maxPicks) throw new CasinoGameError('There are no more picks in this round.', 409)
      const isSafe = input.slug === 'towers'
        ? input.position === numberArray(outcome.safeColumns)[picks.length]
        : !numberArray(outcome.minePositions).includes(input.position!)
      picks.push(input.position!)
      outcome.picks = picks

      if (!isSafe) {
        if (input.slug === 'mines') outcome.revealedMine = input.position
        await settleRound(client, row, input.userId, outcome, '0.00', 'loss')
      } else {
        const multiplier = multiplierForSafePicks(input.slug, picks.length, Number(outcome.mineCount ?? 0), Number(outcome.rtpBps))
        const rawPayoutCents = Math.floor((input.slug === 'mines' ? Number(row.wager_amount) : Number(row.wager_amount)) * multiplier * 100 + 1e-8)
        const payoutAmount = (rawPayoutCents / 100).toFixed(2)
        outcome.currentMultiplier = multiplier
        outcome.currentPayout = payoutAmount
        if (picks.length >= maxPicks) {
          outcome.cashoutMultiplier = multiplier
          await settleRound(client, row, input.userId, outcome, payoutAmount, 'win')
        } else {
          await client.query(`UPDATE public.game_results SET outcome = $2::jsonb WHERE bet_id = $1::uuid`, [row.bet_id, JSON.stringify(outcome)])
        }
      }
    } else {
      if (input.slug === 'crash') {
        const { rows } = await client.query<{ elapsed: number }>(
          `SELECT greatest(extract(epoch FROM now() - $1::timestamptz), 0)::float8 AS elapsed`, [row.started_at],
        )
        const currentMultiplier = Math.floor((1 + Number(rows[0].elapsed) * 0.2) * 100) / 100
        const crashPoint = Number(outcome.crashPoint)
        if (currentMultiplier >= crashPoint) {
          outcome.crashedAt = crashPoint
          await settleRound(client, row, input.userId, outcome, '0.00', 'loss')
        } else {
          outcome.cashoutMultiplier = currentMultiplier
          const payoutCents = Math.floor(Number(row.wager_amount) * currentMultiplier * 100 + 1e-8)
          await settleRound(client, row, input.userId, outcome, (payoutCents / 100).toFixed(2), 'win')
        }
      } else if (input.slug === 'vault-heist') {
        if (!picks.length) throw new CasinoGameError('Open at least one vault door before making your escape.')
        const baseMultiplier = Number(outcome.currentMultiplier ?? 1)
        const payoutMultiplier = payoutMultiplierForRtp(baseMultiplier, Number(outcome.rtpBps))
        const payoutCents = Math.floor(Number(row.wager_amount) * payoutMultiplier * 100 + 1e-8)
        const payoutAmount = (payoutCents / 100).toFixed(2)
        outcome.cashoutMultiplier = payoutMultiplier
        await settleRound(client, row, input.userId, outcome, payoutAmount, 'win')
      } else {
        if (!picks.length) throw new CasinoGameError('Reveal at least one safe tile before cashing out.')
        const multiplier = multiplierForSafePicks(input.slug, picks.length, Number(outcome.mineCount ?? 0), Number(outcome.rtpBps))
        outcome.cashoutMultiplier = multiplier
        const payoutCents = Math.floor(Number(row.wager_amount) * multiplier * 100 + 1e-8)
        await settleRound(client, row, input.userId, outcome, (payoutCents / 100).toFixed(2), 'win')
      }
    }

    const updated = {
      ...row,
      bet_status: outcome.result ? 'settled' : 'pending',
      payout_amount: String(outcome.payoutAmount ?? '0.00'),
      outcome,
      session_status: outcome.result ? 'completed' : 'active',
    }
    return roundView(updated)
  })
}

export async function getActiveCasinoRound(userId: string, slug: CasinoGameSlug): Promise<GameRoundView | null> {
  const { rows } = await databasePool.query(
    `SELECT gs.id::text AS session_id, gs.started_at, gs.status AS session_status,
            b.id::text AS bet_id, b.wager_amount::text, b.payout_amount::text, b.status AS bet_status,
            gr.outcome, gr.server_seed_hash, g.slug
     FROM public.game_sessions gs
     JOIN public.bets b ON b.game_session_id = gs.id AND b.user_id = gs.user_id
     JOIN public.game_results gr ON gr.bet_id = b.id
     JOIN public.games g ON g.id = gs.game_id
     WHERE gs.user_id = $1::uuid AND g.slug = $2 AND gs.status = 'active' AND b.status = 'pending'
     ORDER BY gs.started_at DESC LIMIT 1`,
    [userId, slug],
  )
  return rows[0] ? roundView(rows[0]) : null
}

export function supportedGameSlug(value: string): value is CasinoGameSlug {
  return isGameSlug(value)
}

export const gameCatalogMetadata = gameCatalog
export const gameRtpBounds = { minHouseEdgeBps: MIN_EDGE_BPS, maxHouseEdgeBps: MAX_EDGE_BPS }
export const maxCasinoWager = MAX_WAGER_CENTS / 100
export const crashMultiplierCap = CRASH_MAX_MULTIPLIER
