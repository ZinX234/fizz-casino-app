import { GAME_CONFIG } from '../config';
import { makeRng } from './three-utils';
import { PATTERNS } from './patterns';

/**
 * Fizz Rush — world events
 * ---------------------------------------------------------------------------
 * Two kinds of surprise, both untimed (there are no daily or weekly systems):
 *
 *  - Ambience events change the mood of the island: squalls, golden hour,
 *    meteor showers, a lagoon breach, an island festival.
 *  - Encounters are placed ahead of the player and reserved so the pattern
 *    director can never stack them on top of another obstacle group: lucky
 *    gates, gem vaults, elite gauntlets and high-roller wagers.
 */

const ELITES = PATTERNS.filter((p) => p.elite);

export class EventDirector {
  constructor({ difficultyId, seed = 99 }) {
    this.seed = seed;
    this.rng = makeRng(seed);
    this.reset();
    this.difficultyId = difficultyId;
  }

  reset(seed) {
    this.rng = makeRng(seed ?? this.seed);
    this.nextEncounterZ = GAME_CONFIG.worldEvents.firstEventDistance + this.rng() * 260;
    this.ambience = null;
    this.ambienceEnds = 0;
    this.pendingTint = null;
    this.time = 0;
  }

  get activeAmbience() {
    return this.ambience;
  }

  update(dt, playerZ, api) {
    this.time += dt;
    let notice = null;

    if (this.ambience && this.time > this.ambienceEnds) {
      this.ambience = null;
      api.onNotice?.({ id: 'ambience_end', text: null });
    }

    // Reserve and build the next encounter before the player can see it.
    if (playerZ > this.nextEncounterZ - 320) {
      const z = this.nextEncounterZ + 180;
      const built = this.build(z, api);
      this.nextEncounterZ = z + this.rng() * (GAME_CONFIG.worldEvents.maxGapDistance - GAME_CONFIG.worldEvents.minGapDistance) + GAME_CONFIG.worldEvents.minGapDistance;

      if (this.rng() < GAME_CONFIG.worldEvents.ambienceChance) {
        const list = GAME_CONFIG.worldEvents.ambience;
        const event = list[Math.floor(this.rng() * list.length)];
        this.ambience = { ...event, startedAt: this.time };
        this.ambienceEnds = this.time + event.duration;
        this.pendingTint = {
          tintColor: event.tint,
          fogBoost: event.fogBoost || 0,
          lightBoost: event.lightBoost || 0,
          particles: event.particles || null,
          confetti: !!event.confetti,
        };
      }
      if (built) notice = built;
    }

    return notice;
  }

  /** Clear a tint once its event has finished. */
  consumeTint() {
    const tint = this.pendingTint;
    this.pendingTint = null;
    return tint;
  }

  build(z, api) {
    const list = GAME_CONFIG.worldEvents.encounters;
    const total = list.reduce((sum, e) => sum + e.weight, 0);
    let roll = this.rng() * total;
    let chosen = list[0];
    for (const entry of list) {
      roll -= entry.weight;
      if (roll <= 0) {
        chosen = entry;
        break;
      }
    }
    if (!api.isClear(z, 16)) return null;

    switch (chosen.id) {
      case 'lucky_gate': {
        const lane = Math.floor(this.rng() * GAME_CONFIG.lanes.count);
        api.spawnHazard('luckyGate', { lane, z });
        api.spawnCoinLine(lane, z - 26, 9);
        return { id: 'lucky_gate', title: 'Lucky Gate ahead', detail: 'Take the golden arch for a coin shower.', tone: 'gold' };
      }
      case 'gem_vault': {
        const lane = 2;
        [0, 1, 2].forEach((i) => api.spawnGem(lane, 1.5, z + i * 4));
        api.spawnChest(lane, 0, z + 14);
        return { id: 'gem_vault', title: 'Gem Vault', detail: 'A cluster of gems and a treasure chest.', tone: 'cyan' };
      }
      case 'high_roller_wager': {
        const lane = Math.floor(this.rng() * GAME_CONFIG.lanes.count);
        api.spawnHazard('wagerGate', { lane, z });
        api.spawnCoinLine(lane, z - 20, 6);
        return { id: 'wager_gate', title: 'High Roller wager', detail: 'Through the neon gate doubles your multiplier.', tone: 'violet' };
      }
      case 'elite_gauntlet':
      default: {
        const pattern = ELITES[Math.floor(this.rng() * ELITES.length)] || ELITES[0];
        if (!pattern) return null;
        const built = pattern.build(this.rng);
        const check = api.validate(built.hazards, api.speed);
        if (!check.ok) return null;
        built.hazards.forEach((h) => {
          api.spawnHazard(h.type, { lane: h.lane, z: z + (h.dz || 0), phase: h.phase });
        });
        (built.coins || []).forEach((c) => api.spawnCoinLine(c.lane, z + (c.dz || 0), c.count));
        return { id: 'elite_gauntlet', title: `${pattern.id === 'colossus' ? 'Tiki Colossus' : pattern.id === 'kraken' ? 'Kraken Rising' : 'Caldera Wrath'}`, detail: 'Elite gauntlet — thread the gap.', tone: 'danger' };
      }
    }
  }
}

export default EventDirector;