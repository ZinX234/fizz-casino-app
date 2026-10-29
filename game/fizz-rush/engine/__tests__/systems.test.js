import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { GAME_CONFIG } from '../../config';
import { Environment } from '../environment';
import { Track, biomeAtZ } from '../track';
import { Runner } from '../player';
import { HazardSystem } from '../hazards';
import { PickupSystem } from '../pickups';
import { ParticleSystem } from '../particles';
import { HAZARD_TYPES } from '../hazard-types';

/**
 * Fizz Rush — world assembly
 * ---------------------------------------------------------------------------
 * Boots the whole 3D world headlessly (no WebGL context needed) and runs it for
 * a few hundred frames: every hazard type is spawned, driven, collided and
 * released, the track recycles, biomes transition and the pools are disposed.
 * This catches undefined identifiers and broken update paths at build time.
 */

const preset = GAME_CONFIG.graphics.presets.high;
const camera = new THREE.PerspectiveCamera(64, 16 / 9, 0.4, 1000);

function buildWorld() {
  const scene = new THREE.Scene();
  const hooks = {
    onHit: () => {},
    onNearMiss: () => {},
    onAvoid: () => {},
    onImpact: () => {},
    onExplode: () => {},
    onGate: () => {},
  };
  const environment = new Environment(scene, preset);
  const track = new Track(scene, preset);
  const runner = new Runner(scene, { characterId: 'fizz' });
  const hazards = new HazardSystem(scene, preset, hooks);
  const pickups = new PickupSystem(scene, preset);
  const sparks = new ParticleSystem(120, { blending: THREE.AdditiveBlending });
  const debris = new ParticleSystem(80, { blending: THREE.NormalBlending });
  scene.add(sparks.points, debris.points);
  return { scene, environment, track, runner, hazards, pickups, sparks, debris };
}

describe('world assembly', () => {
  it('spawns, drives and releases every hazard type', () => {
    const { scene, environment, track, runner, hazards, pickups, sparks, debris } = buildWorld();
    track.reset(0);

    Object.keys(HAZARD_TYPES).forEach((type, index) => {
      const spawned = hazards.spawn(type, { lane: index % GAME_CONFIG.lanes.count, z: 30 + index * 4, phase: index * 0.3 });
      expect(spawned, `spawn ${type}`).toBeTruthy();
      expect(spawned.group.visible).toBe(true);
    });
    expect(hazards.count).toBeGreaterThan(20);

    // Coins, gems and a treasure chest.
    pickups.spawnLine(0, 20, 8);
    pickups.spawnArc(2.3, 40, 6);
    pickups.spawnRing(-2.3, 60, 6, 16);
    pickups.spawnGem(0, 1.4, 80);
    pickups.spawnChest(0, 0, 90);

    sparks.burst(20, { x: 0, y: 1, z: 10, life: 0.5, size: 0.4, color: '#fff', spread: 3 });
    debris.burst(10, { x: 0, y: 1, z: 10, life: 0.5, size: 0.4, color: '#fff', spread: 3 });

    let hits = 0;
    for (let step = 0; step < 420; step += 1) {
      runner.speed = 26;
      runner.handle(step % 90 === 0 ? 'jump' : step % 37 === 0 ? 'slide' : step % 53 === 0 ? 'left' : step % 71 === 0 ? 'right' : 'none');
      runner.update(1 / 60, { autoGrind: true });
      hazards.update(1 / 60, { player: runner, speed: runner.speed, onHit: () => { hits += 1; } });
      pickups.update(1 / 60, runner.bounds(), () => {});
      track.update(runner.z);
      sparks.update(1 / 60);
      debris.update(1 / 60);
      environment.update(1 / 60, camera, runner.z);
    }

    // The player physically collided with hazards placed on the road, and
    // everything that was spawned has been recycled behind them.
    expect(hits).toBeGreaterThan(0);
    expect(hazards.count).toBeLessThan(20);

    // Biome transition path.
    environment.setBiome('volcano');
    track.applyBiome(GAME_CONFIG.biomes[5]);
    for (let step = 0; step < 200; step += 1) environment.update(1 / 60, camera, runner.z);
    expect(environment.biome.id).toBe('volcano');

    // Rail lookup must be safe with nothing live.
    hazards.clear();
    expect(hazards.railsNear(0)).toBeNull();
    expect(hazards.count).toBe(0);

    // Dispose every system without throwing.
    [sparks, debris, pickups, hazards, track, environment, runner].forEach((system) => system.dispose());
    expect(scene.children.length).toBe(0);
  });

  it('keeps the runner inside legal movement bounds', () => {
    const { runner, hazards, pickups, environment } = buildWorld();
    const seen = [];
    runner.speed = 58;
    for (let step = 0; step < 600; step += 1) {
      runner.handle(step % 2 === 0 ? 'right' : 'left');
      runner.update(1 / 60, {});
      runner.update(1 / 60, {});
      hazards.update(1 / 60, { player: runner, speed: runner.speed, onHit: () => {} });
      pickups.update(1 / 60, runner.bounds(), () => {});
      environment.update(1 / 60, camera, runner.z);
      seen.push(runner.x);
    }
    const maxOffset = GAME_CONFIG.integrity.maxLaneOffset + 0.001;
    seen.forEach((x) => {
      expect(Number.isFinite(x)).toBe(true);
      expect(Math.abs(x)).toBeLessThanOrEqual(maxOffset);
    });
    // Jumping repeatedly must never keep the runner airborne indefinitely.
    for (let step = 0; step < 120; step += 1) {
      runner.handle('jump');
      runner.update(1 / 60, {});
    }
    expect(runner.airtimeExceeded).toBe(false);
    runner.dispose();
    hazards.dispose();
    pickups.dispose();
    environment.dispose();
  });

  it('maps distance to the island biomes', () => {
    expect(biomeAtZ(0).id).toBe(GAME_CONFIG.biomes[0].id);
    expect(biomeAtZ(GAME_CONFIG.world.biomeDistance).id).toBe(GAME_CONFIG.biomes[1].id);
    expect(biomeAtZ(GAME_CONFIG.world.biomeDistance * 99).id).toBeTruthy();
  });
});