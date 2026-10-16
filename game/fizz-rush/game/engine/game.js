import * as THREE from 'three';
import { GAME_CONFIG, getDifficulty } from '../config';
import { Environment } from './environment';
import { Track, biomeAtZ } from './track';
import { Runner } from './player';
import { HazardSystem } from './hazards';
import { PickupSystem } from './pickups';
import { ParticleSystem } from './particles';
import { InputController } from './input';
import { PatternDirector } from './patterns';
import { EventDirector } from './events';
import { AudioEngine } from '../audio';
import { computePayout } from '../payout';
import { findTrail } from '../cosmetics';
import { clamp } from './three-utils';

/**
 * Fizz Rush — run orchestrator
 * ---------------------------------------------------------------------------
 * Owns the renderer, the world, the run rules and the score.
 *
 * Scoring integrity (the exploit-resistant core):
 *   score = distance travelled + legitimate collectibles + clean passes,
 *   multiplied by a combo that only rises when obstacles are genuinely passed.
 *   Nothing else can award a single point — not spinning, not flipping, not
 *   hovering, not clipping, not vibrating against geometry. If the runner's
 *   motion stops looking legitimate (excess airtime, out-of-bounds drift,
 *   stalled speed), scoring pauses until normal movement resumes.
 *
 * Stability: fixed pools everywhere, no per-frame allocation, clamped timestep,
 * NaN guards, a hard run-length ceiling and a full dispose() that returns the
 * GPU to a clean state.
 */

const MAX_DT = 1 / 30;

export class Game {
  constructor(mount, options = {}) {
    // `mount` is the element the island is rendered into. The engine creates
    // and owns its own <canvas> inside it — see init().
    this.mount = mount;
    this.canvas = null;
    this.mode = options.mode === 'real' ? 'real' : 'demo';
    this.difficultyId = GAME_CONFIG.difficulty[options.difficulty] ? options.difficulty : GAME_CONFIG.defaults.difficulty;
    this.difficulty = getDifficulty(this.difficultyId);
    this.settings = options.settings || { quality: GAME_CONFIG.graphics.default, accessibility: {}, input: {}, audio: {} };
    this.preset = GAME_CONFIG.graphics.presets[this.settings.quality] || GAME_CONFIG.graphics.presets.high;
    this.bet = this.mode === 'real' ? Math.max(0, Math.floor(options.bet || 0)) : 0;
    this.prestige = options.prestige || 0;
    this.characterId = options.characterId || 'fizz';
    this.trail = findTrail(options.trailId);

    this.onHud = options.onHud;
    this.onGameOver = options.onGameOver;
    this.onNotice = options.onNotice;
    this.onStateChange = options.onStateChange;

    this.status = 'idle';
    this.frame = 0;
    this.rafId = null;
    this.lastTime = 0;
    this.hudTimer = 0;
    this.fpsSamples = [];
    this.qualityStep = 0;
    this.disposed = false;
    this.noticeId = 0;
  }

  /* ------------------------------------------------------------ lifecycle */

  init() {
    // The engine owns its canvas. A <canvas> holds exactly one WebGL context
    // for its whole life, so a canvas left over from a previous engine can
    // never hand out a working one — that is the "WebGL unavailable" trap when
    // the world is rebuilt. A fresh canvas per engine makes rebuilding safe.
    const canvas = document.createElement('canvas');
    canvas.className = 'absolute inset-0 h-full w-full';
    this.mount.appendChild(canvas);
    this.canvas = canvas;

    // Browsers may reclaim the GPU context at any time (tab suspended, GPU
    // reset). Handle it honestly instead of rendering into a dead context.
    this.onContextLost = (event) => {
      event.preventDefault();
      if (this.rafId) cancelAnimationFrame(this.rafId);
      this.rafId = null;
      if (this.status === 'running') this.pause();
      this.notice({
        id: 'context_lost',
        text: 'The browser released the 3D renderer',
        detail: 'Head back to the hub for a fresh island.',
        tone: 'danger',
      });
    };
    canvas.addEventListener('webglcontextlost', this.onContextLost, false);

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: (this.preset.dpr || 1) <= 1.25,
        powerPreference: 'high-performance',
        stencil: false,
        alpha: false,
      });
    } catch (error) {
      // No usable WebGL on this device: leave nothing behind and let the
      // caller show its own message.
      canvas.removeEventListener('webglcontextlost', this.onContextLost, false);
      canvas.remove();
      this.canvas = null;
      throw error;
    }
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.06;
    renderer.shadowMap.enabled = !!this.preset.shadows;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(new THREE.Color('#08161c'), 1);
    this.renderer = renderer;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      GAME_CONFIG.graphics.camera.fovBase,
      16 / 9,
      0.4,
      1000
    );
    this.camera.position.set(0, 3.6, -7.6);

    this.environment = new Environment(this.scene, this.preset);
    this.track = new Track(this.scene, this.preset);
    this.runner = new Runner(this.scene, { characterId: this.characterId });
    this.hazards = new HazardSystem(this.scene, this.preset, {
      onHit: (h) => this.handleHit(h),
      onNearMiss: () => this.handleNearMiss(),
      onAvoid: () => this.handleAvoid(),
      onImpact: (h) => this.handleImpact(h),
      onExplode: (h) => this.handleExplode(h),
      onGate: (kind, h) => this.handleGate(kind, h),
    });
    this.pickups = new PickupSystem(this.scene, this.preset);
    this.sparks = new ParticleSystem(Math.round(this.preset.particles * 0.6), { blending: THREE.AdditiveBlending });
    this.debris = new ParticleSystem(Math.round(this.preset.particles * 0.4), { blending: THREE.NormalBlending });
    this.sparks.setMaxVisible(this.preset.particles);
    this.debris.setMaxVisible(this.preset.particles);
    this.scene.add(this.sparks.points, this.debris.points);

    this.director = new PatternDirector(this.difficultyId, 1337 + this.difficultyId.length * 31);
    this.events = new EventDirector({ difficultyId: this.difficultyId, seed: 4242 });

    this.audio = new AudioEngine(this.settings.audio);
    this.input = new InputController({
      target: this.canvas,
      settings: this.settings.input || {},
      onAction: (action) => this.handleAction(action),
    });
    this.input.attach();
    this.onResize = this.resize;
    window.addEventListener('resize', this.onResize);

    this.resize();
    this.reset();
    this.status = 'ready';
    return this;
  }

  reset() {
    this.runner.reset();
    this.runner.speed = this.difficulty.speedStart * (this.settings.accessibility?.slowMode ? 0.85 : 1);
    this.runner.setCharacter(this.characterId);
    this.track.reset(0);
    this.hazards.clear();
    this.pickups.clear();
    this.sparks.clear();
    this.debris.clear();
    this.director.reset(this.difficultyId, 1337 + Math.floor(Math.random() * 1000));
    this.events.reset(Math.floor(Math.random() * 10000));

    this.distance = 0;
    this.score = 0;
    this.coins = 0;
    this.gems = 0;
    this.combo = 0;
    this.multiplier = 1;
    this.comboPeak = 1;
    this.nearMisses = 0;
    this.obstaclesAvoided = 0;
    this.bonusEvents = 0;
    this.wagerEvents = 0;
    this.hits = 0;
    this.shields = this.difficulty.graceHits;
    this.grindSeconds = 0;
    this.maxGrindSeconds = 0;
    this.airManoeuvres = 0;
    this.integrityFlags = 0;
    this.suspicion = 0;
    this.integrityOK = true;
    this.runTime = 0;
    this.boostTimer = 0;
    this.wagerTimer = 0;
    this.crashTimer = 0;
    this.shake = 0;
    this.biomesVisited = new Set([biomeAtZ(0).id]);
    this.biomeId = biomeAtZ(0).id;
    this.eventNotice = null;
    this.finished = false;
    this.lastZ = 0;
    this.lastHudAt = 0;
    this.cameraRoll = 0;
    this.trailAccumulator = 0;
    this.ambientAccumulator = 0;
    this.environment.setBiome(this.biomeId);
    this.track.applyBiome(this.biome());
    this.environment.applyEvent(null);
    this.audio.setAmbience(this.biome().ambience);
    this.pushHud(true);
  }

  play() {
    if (this.status === 'running') return;
    this.status = 'running';
    this.lastTime = performance.now();
    this.audio.ensure();
    this.audio.startMusic();
    this.audio.setIntensity(1);
    this.onStateChange?.('running');
    if (!this.rafId) this.loop(this.lastTime);
  }

  pause() {
    if (this.status !== 'running') return;
    this.status = 'paused';
    this.audio.stopMusic();
    this.onStateChange?.('paused');
    this.pushHud(true);
  }

  resume() {
    if (this.status !== 'paused') return;
    this.status = 'running';
    this.lastTime = performance.now();
    this.audio.startMusic();
    this.onStateChange?.('running');
  }

  togglePause() {
    if (this.status === 'running') this.pause();
    else if (this.status === 'paused') this.resume();
  }

  dispose() {
    this.disposed = true;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    this.input?.detach();
    this.audio?.dispose();
    this.hazards?.dispose();
    this.pickups?.dispose();
    this.track?.dispose();
    this.environment?.dispose();
    this.runner?.dispose();
    this.sparks?.dispose();
    this.debris?.dispose();
    this.renderer?.dispose();
    this.renderer?.forceContextLoss?.();
    if (this.canvas) {
      if (this.onContextLost) this.canvas.removeEventListener('webglcontextlost', this.onContextLost, false);
      this.canvas.remove();
      this.canvas = null;
    }
    window.removeEventListener('resize', this.onResize);
  }

  /* --------------------------------------------------------------- viewport */

  resize = () => {
    if (!this.renderer) return;
    const parent = this.mount || this.canvas.parentElement;
    const width = Math.max(320, parent?.clientWidth || window.innerWidth);
    const height = Math.max(240, parent?.clientHeight || window.innerHeight);
    const scale = this.settings.resolutionScale || 1;
    const dpr = Math.min(window.devicePixelRatio || 1, this.preset.dpr || 1) * scale;
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  };

  /* ------------------------------------------------------------------ loop */

  loop = (now) => {
    if (this.disposed) return;
    this.rafId = requestAnimationFrame(this.loop);
    const dt = Math.min(MAX_DT, Math.max(0, (now - this.lastTime) / 1000));
    this.lastTime = now;
    if (this.status === 'running' || this.status === 'crashed') this.step(dt);
    else this.stepIdle(dt);
    this.renderer.render(this.scene, this.camera);
    this.trackFps(now);
  };

  stepIdle(dt) {
    this.runner.update(dt, { rails: null });
    this.updateCamera(dt, true);
    this.sparks.update(dt);
    this.debris.update(dt);
    this.environment.update(dt, this.camera, this.runner.z);
  }

  step(dt) {
    const runner = this.runner;
    this.runTime += dt;
    this.frame += 1;

    if (this.status === 'crashed') {
      this.crashTimer -= dt;
      runner.speed = Math.max(0, runner.speed - 26 * dt);
      runner.update(dt, { rails: null });
      this.updateCamera(dt, false);
      this.updateParticles(dt);
      this.environment.update(dt, this.camera, runner.z);
      if (this.crashTimer <= 0) this.finish('crash');
      return;
    }

    // -------------------------------------------------------------- speed
    const base = Math.min(
      this.difficulty.speedMax,
      this.difficulty.speedStart + this.difficulty.acceleration * this.runTime
    );
    const slowFactor = this.settings.accessibility?.slowMode ? 0.88 : 1;
    const boost = this.boostTimer > 0 ? 1.16 : 1;
    runner.speed = Math.min(GAME_CONFIG.integrity.maxSpeed, base * slowFactor * boost);
    if (this.boostTimer > 0) this.boostTimer -= dt;
    if (this.wagerTimer > 0) this.wagerTimer -= dt;

    // ------------------------------------------------------------- input
    const actions = this.input.drain();
    actions.forEach((action) => {
      if (action === 'pause') this.togglePause();
      else runner.handle(action);
    });
    this.input.update(dt);

    // -------------------------------------------------------- world growth
    const horizon = runner.z + GAME_CONFIG.world.segments * GAME_CONFIG.world.segmentLength;
    this.director.fill(runner.z, horizon, this.biome().id, (group) => this.emitGroup(group));
    this.track.update(runner.z);

    // ----------------------------------------------------------- movement
    const rail = this.hazards.railsNear(runner.z, 4);
    runner.update(dt, {
      rails: rail,
      autoGrind: GAME_CONFIG.input.autoGrind,
      slowMode: this.settings.accessibility?.slowMode,
    });
    this.guardMovement(dt);

    // Automatic rail pickup: falling onto a rail starts a grind.
    if (GAME_CONFIG.input.autoGrind && runner.state === 'air' && runner.vy <= 0 && rail && !runner.grind) {
      if (Math.abs(runner.x - rail.x) < 0.75 && runner.y >= rail.y - 0.35 && runner.y <= rail.y + 1.2) {
        runner.startGrind(rail);
        this.audio.sfx('grind');
        this.notice({ id: 'grind', text: 'Grinding', tone: 'cyan' });
      }
    }

    if (runner.state === 'grind') {
      this.grindSeconds += dt;
      this.maxGrindSeconds = Math.max(this.maxGrindSeconds, runner.grindSeconds);
      this.sparks.burst(2, {
        x: runner.x,
        y: runner.y - 0.1,
        z: runner.z - 0.4,
        life: 0.32,
        size: 0.22,
        color: '#ffd76a',
        spread: 2.4,
        gravity: 6,
        drag: 1.4,
      });
    }

    // -------------------------------------------------------- hazards etc
    this.hazards.update(dt, {
      player: runner,
      speed: runner.speed,
      onHit: (hazard) => this.handleHit(hazard),
    });
    this.pickups.setMagnet(this.wagerTimer > 0 ? 3.2 : 0);
    this.pickups.update(dt, runner.bounds(), (type, x, y, z) => this.collect(type, x, y, z));

    // -------------------------------------------------------------- events
    const notice = this.events.update(dt, runner.z, {
      rng: this.events.rng,
      speed: runner.speed,
      spawnHazard: (type, spec) => this.hazards.spawn(type, spec),
      spawnCoinLine: (lane, z, count) => this.pickups.spawnLine(this.laneX(lane), z, count),
      spawnGem: (lane, y, z) => this.pickups.spawnGem(this.laneX(lane), y, z),
      spawnChest: (lane, y, z) => this.pickups.spawnChest(this.laneX(lane), y, z),
      validate: (hazards, speed) => this.director.validate(hazards, speed),
      isClear: (z, radius) => this.isClear(z, radius),
      onNotice: () => {},
    });
    if (notice) {
      this.notice({ id: notice.id, text: notice.title, tone: notice.tone, detail: notice.detail });
      this.audio.sfx('bonus');
    }
    const tint = this.events.consumeTint();
    if (tint) this.environment.applyEvent(tint);
    else if (!this.events.activeAmbience) this.environment.applyEvent(null);

    // ------------------------------------------------------------- scoring
    this.advanceScore(dt);

    // -------------------------------------------------------------- biomes
    const leadBiome = biomeAtZ(runner.z + 150);
    if (leadBiome.id !== this.biomeId) {
      this.biomeId = leadBiome.id;
      this.environment.setBiome(leadBiome.id);
      this.track.applyBiome(leadBiome);
      this.biomesVisited.add(leadBiome.id);
      this.audio.setAmbience(leadBiome.ambience);
      this.notice({ id: `biome_${leadBiome.id}`, text: leadBiome.name, detail: leadBiome.blurb, tone: 'cyan' });
    }

    // -------------------------------------------------------------- visuals
    this.updateCamera(dt, false);
    this.emitTrail(dt);
    this.emitAmbience(dt);
    this.updateParticles(dt);
    this.environment.update(dt, this.camera, runner.z);
    this.hazards.bodyMat.color.copy(this.environment.tint);
    this.track.props.setTint(this.environment.tint);
    this.audio.setIntensity(clamp(Math.round((runner.speed / this.difficulty.speedMax) * 2 + this.multiplier - 1), 0, 3));

    if (this.runTime > GAME_CONFIG.integrity.maxRunSeconds) this.finish('timeout');

    this.hudTimer += dt;
    if (this.hudTimer > 0.1) {
      this.hudTimer = 0;
      this.pushHud();
    }
  }

  /* ------------------------------------------------------- world spawning */

  laneX(lane) {
    return (lane - (GAME_CONFIG.lanes.count - 1) / 2) * GAME_CONFIG.lanes.width;
  }

  /** Turn a validated director group into live obstacles and collectibles. */
  emitGroup(group) {
    const biome = biomeAtZ(group.z);
    group.hazards.forEach((h) => {
      const spawned = this.hazards.spawn(h.type, {
        lane: h.lane,
        z: group.z + (h.dz || 0),
        phase: h.phase,
        params: h.params,
        biome: biome.id,
      });
      if (spawned && h.lane === undefined && group.elite) spawned.scale = 1.05;
    });
    group.coins.forEach((c) => {
      const x = this.laneX(c.lane);
      const z = group.z + (c.dz || 0);
      if (c.shape === 'arc') this.pickups.spawnArc(x, z, c.count, { height: 2.1 });
      else if (c.shape === 'ring') this.pickups.spawnRing(x, z, c.count, c.length || 18, c.y || 2.5);
      else this.pickups.spawnLine(x, z, c.count);
    });
    if (group.elite) {
      this.wagerEvents += 1;
      this.bonusEvents += 1;
    }
  }

  isClear(z, radius) {
    for (const h of this.hazards.live) {
      if (Math.abs(h.z - z) < radius) return false;
    }
    return true;
  }

  /* ------------------------------------------------------------ integrity */

  /** Exploit guard: score only accrues while the motion looks legitimate. */
  guardMovement(dt) {
    const runner = this.runner;
    const integrity = GAME_CONFIG.integrity;
    let suspicious = false;

    if (!Number.isFinite(runner.x) || !Number.isFinite(runner.y) || !Number.isFinite(runner.z)) {
      // Never allow a corrupt transform to hard-lock the run.
      runner.x = clamp(Number(runner.x) || 0, -integrity.maxLaneOffset, integrity.maxLaneOffset);
      runner.y = 0;
      runner.vy = 0;
      this.integrityFlags += 1;
      suspicious = true;
    }
    if (runner.airtimeExceeded) suspicious = true;
    if (Math.abs(runner.x) > integrity.maxLaneOffset - 0.02) suspicious = true;
    if (runner.speed < integrity.minSpeedForScoring && runner.z > 30) suspicious = true;
    if (runner.y < -0.05) suspicious = true;

    if (suspicious) this.suspicion += dt;
    else this.suspicion = Math.max(0, this.suspicion - dt * 2);

    const wasOK = this.integrityOK;
    this.integrityOK = this.suspicion < integrity.suspiciousGraceSeconds;
    if (wasOK && !this.integrityOK) {
      this.integrityFlags += 1;
      this.notice({ id: 'integrity', text: 'Scoring paused', detail: 'Abnormal movement — score resumes when you are running clean.', tone: 'danger' });
    }
  }

  advanceScore(dt) {
    const runner = this.runner;
    const dz = Math.max(0, runner.z - this.lastZ);
    this.lastZ = runner.z;
    this.distance = runner.z;

    if (!this.integrityOK) return;

    const scoring = GAME_CONFIG.scoring;
    const wagerBoost = this.wagerTimer > 0 ? 2 : 1;
    const gain = dz * scoring.pointsPerMeter * this.multiplier * wagerBoost;
    this.score += gain;

    // Combo decays slowly when nothing is being cleared, and never inflates
    // from anything except a genuine pass.
    this.combo = Math.max(0, this.combo - scoring.combo.decayPerSecond * dt);
    this.multiplier = Math.min(scoring.combo.max, 1 + this.combo * scoring.combo.step);
  }

  bumpCombo(amount = 1) {
    const scoring = GAME_CONFIG.scoring;
    this.combo = Math.max(0, this.combo + amount);
    this.multiplier = Math.min(scoring.combo.max, 1 + this.combo * scoring.combo.step);
    this.comboPeak = Math.max(this.comboPeak, this.multiplier);
  }

  /* ---------------------------------------------------------------- events */

  handleAction(action) {
    if (action === 'jump') this.audio.sfx('jump');
    if (action === 'slide') this.audio.sfx('slide');
  }

  handleHit(hazard) {
    const runner = this.runner;
    if (runner.invuln > 0) return;
    this.hits += 1;
    runner.applyHit(true);
    this.shake = 1;
    this.audio.sfx('hit');
    this.debris.burst(16, {
      x: runner.x,
      y: runner.y + 0.9,
      z: runner.z,
      life: 0.7,
      size: 0.4,
      color: '#d8dde2',
      spread: 5,
      gravity: 12,
      drag: 1.2,
    });
    if (GAME_CONFIG.scoring.combo.resetOnHit) {
      this.combo = 0;
      this.multiplier = 1;
    }
    if (this.shields > 0) {
      this.shields -= 1;
      this.notice({ id: 'shield', text: 'Shield absorbed the hit', tone: 'danger' });
    } else {
      this.status = 'crashed';
      this.crashTimer = 1.15;
      this.audio.setIntensity(0);
      this.notice({ id: 'crash', text: 'Run over', tone: 'danger' });
    }
    this.pushHud(true);
  }

  handleImpact(hazard) {
    this.shake = Math.max(this.shake, 0.5);
    this.debris.burst(10, {
      x: hazard.x,
      y: hazard.def.y + 0.4,
      z: hazard.z,
      life: 0.6,
      size: 0.42,
      color: '#e8d8ac',
      spread: 4,
      gravity: 14,
      drag: 1.1,
    });
    this.audio.sfx('land');
  }

  handleExplode(hazard) {
    this.shake = 1;
    this.audio.sfx('explode');
    this.sparks.burst(26, {
      x: hazard.x,
      y: hazard.baseY + 0.8,
      z: hazard.z,
      life: 0.7,
      size: 0.75,
      color: '#ffb15e',
      spread: 9,
      gravity: 5,
      drag: 1.4,
    });
    this.debris.burst(18, {
      x: hazard.x,
      y: hazard.baseY + 0.8,
      z: hazard.z,
      life: 1.1,
      size: 0.5,
      color: '#5a4a3c',
      spread: 8,
      gravity: 16,
      drag: 0.9,
    });
  }

  handleGate(kind, hazard) {
    if (kind === 'lucky') {
      this.bonusEvents += 1;
      this.score += GAME_CONFIG.scoring.pointsPerBonusEvent;
      this.pickups.spawnLine(hazard.x, hazard.z + 6, 10);
      this.sparks.burst(22, { x: hazard.x, y: 2, z: hazard.z, life: 1, size: 0.6, color: '#ffd76a', spread: 5, gravity: 3, drag: 1.1 });
      this.audio.sfx('bonus');
      this.notice({ id: 'lucky', text: 'Lucky Gate — coin shower', tone: 'gold' });
    } else if (kind === 'wager') {
      this.wagerEvents += 1;
      this.wagerTimer = 9;
      this.audio.sfx('boost');
      this.notice({ id: 'wager', text: 'High Roller wager — double score for 9s', tone: 'violet' });
    } else if (kind === 'boost') {
      this.boostTimer = 4.5;
      this.audio.sfx('boost');
      this.notice({ id: 'boost', text: 'Speed gate — hold on', tone: 'cyan' });
    }
  }

  /** Every hazard that passes behind the player was genuinely cleared. */
  handleAvoid() {
    this.obstaclesAvoided += 1;
    this.bumpCombo(0.45);
  }

  handleNearMiss() {
    const scoring = GAME_CONFIG.scoring;
    this.nearMisses += 1;
    this.bumpCombo(1.15);
    if (this.integrityOK) this.score += scoring.pointsPerNearMiss * this.multiplier;
    this.sparks.burst(5, {
      x: this.runner.x,
      y: this.runner.y + 1,
      z: this.runner.z + 1,
      life: 0.4,
      size: 0.3,
      color: '#8fe8ff',
      spread: 2.4,
      drag: 1.6,
    });
    if (this.nearMisses % 5 === 0) this.audio.sfx('combo');
  }

  collect(type, x, y, z) {
    const scoring = GAME_CONFIG.scoring;
    if (type === 'gem') {
      this.gems += 1;
      if (this.integrityOK) this.score += scoring.pointsPerGem * this.multiplier;
      this.sparks.burst(14, { x, y, z, life: 0.7, size: 0.55, color: '#8fe8ff', spread: 3.4, drag: 1.3 });
      this.audio.sfx('gem');
      return;
    }
    this.coins += 1;
    if (this.integrityOK) this.score += scoring.pointsPerCoin * this.multiplier;
    this.sparks.burst(5, { x, y, z, life: 0.45, size: 0.36, color: '#ffd76a', spread: 2.6, drag: 1.5 });
    if (this.coins % 3 === 0) this.audio.sfx('coin');
  }

  notice(entry) {
    this.noticeId += 1;
    this.onNotice?.({ id: `${entry.id}_${this.noticeId}`, ...entry });
  }

  /* ------------------------------------------------------------- camera */

  updateCamera(dt, idle) {
    const cfg = GAME_CONFIG.graphics.camera;
    const runner = this.runner;
    const targetX = runner.x * 0.55;
    const speedRatio = clamp((runner.speed - this.difficulty.speedStart) / Math.max(1, this.difficulty.speedMax - this.difficulty.speedStart), 0, 1);
    const reduced = this.settings.accessibility?.reducedMotion;
    const follow = reduced ? cfg.followLerp * 1.4 : cfg.followLerp;
    const k = Math.min(1, follow * dt);

    const desired = new THREE.Vector3(
      targetX,
      cfg.height + (idle ? 0.6 : 0),
      runner.z - cfg.distance
    );
    this.camera.position.x += (desired.x - this.camera.position.x) * k;
    this.camera.position.y += (desired.y - this.camera.position.y) * Math.min(1, k * 0.8);
    this.camera.position.z = desired.z;

    const lookTarget = new THREE.Vector3(runner.x * 0.4, cfg.lookHeight, runner.z + cfg.lookAhead);
    this.camera.lookAt(lookTarget);

    const rollTarget = -(runner.laneX(runner.lane) - runner.x) * (reduced ? 0 : cfg.rollAmount * 6);
    this.cameraRoll += (rollTarget - this.cameraRoll) * Math.min(1, 8 * dt);
    this.camera.rotateZ(this.cameraRoll);

    if (this.shake > 0 && !reduced && this.settings.accessibility?.screenShake !== false) {
      this.shake = Math.max(0, this.shake - dt * 3.4);
      const amp = this.shake * 0.16 * (cfg.shakeIntensity || 1);
      this.camera.position.x += (Math.random() - 0.5) * amp;
      this.camera.position.y += (Math.random() - 0.5) * amp;
    } else {
      this.shake = 0;
    }

    const targetFov = cfg.fovBase + speedRatio * (cfg.fovMax - cfg.fovBase) * (reduced ? 0.4 : 1);
    this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, 3 * dt);
    this.camera.updateProjectionMatrix();
  }

  /* ----------------------------------------------------------- particles */

  emitTrail(dt) {
    if (!this.trail || this.trail.color === '#000000') return;
    const runner = this.runner;
    this.trailAccumulator += dt * (18 + runner.speed * 0.35);
    const count = Math.floor(this.trailAccumulator);
    this.trailAccumulator -= count;
    for (let i = 0; i < count && i < 4; i += 1) {
      this.sparks.spawn({
        x: runner.x + (Math.random() - 0.5) * 0.4,
        y: runner.y + 0.5 + Math.random() * 1.4,
        z: runner.z - 0.6,
        vx: (Math.random() - 0.5) * 1.4,
        vy: 0.6 + Math.random() * 1.4,
        vz: -1.5 - Math.random() * 2,
        life: 0.55,
        size: 0.34,
        color: this.trail.color,
        gravity: -0.6,
        drag: 1.1,
      });
    }
  }

  /** Weather and wildlife ambience tied to the biome and any world event. */
  emitAmbience(dt) {
    const biome = this.biome();
    const event = this.events.activeAmbience;
    const kind = event?.particles || biome.ambience;
    const runner = this.runner;
    this.ambientAccumulator += dt * (kind === 'confetti' ? 26 : 12);
    const count = Math.floor(this.ambientAccumulator);
    this.ambientAccumulator -= count;

    for (let i = 0; i < count && i < 4; i += 1) {
      const side = Math.random() < 0.5 ? -1 : 1;
      const x = side * (7 + Math.random() * 12);
      const z = runner.z + 40 + Math.random() * 120;
      switch (kind) {
        case 'embers':
          this.sparks.spawn({ x, y: 0.4 + Math.random() * 3, z, vy: 2.4 + Math.random() * 2, vx: (Math.random() - 0.5) * 1.2, life: 1.6, size: 0.34, color: '#ff9a5e', gravity: -1.4, drag: 0.4 });
          break;
        case 'confetti':
          this.debris.spawn({ x, y: 1 + Math.random() * 4, z, vy: 0.6, vx: (Math.random() - 0.5) * 2.4, life: 2.4, size: 0.42, color: ['#f5c14b', '#ff6f61', '#5ce2c0', '#c56bff'][i % 4], gravity: 1.2, drag: 0.3 });
          break;
        case 'leaves':
          this.debris.spawn({ x, y: 3 + Math.random() * 5, z, vy: -1.2, vx: (Math.random() - 0.5) * 1.6, life: 2.6, size: 0.4, color: '#5fae62', gravity: 0.4, drag: 0.5 });
          break;
        case 'bubbles':
          this.sparks.spawn({ x, y: -0.4, z: runner.z + 20 + Math.random() * 90, vy: 1.6 + Math.random(), life: 1.8, size: 0.4, color: '#9ff0ff', gravity: -0.4, drag: 0.5 });
          break;
        default:
          this.debris.spawn({ x: side * (8 + Math.random() * 6), y: -0.4, z: runner.z + 10 + Math.random() * 80, vy: 3.4 + Math.random() * 2.4, vx: (Math.random() - 0.5) * 1.4, life: 1.4, size: 0.34, color: '#ffffff', gravity: 7, drag: 0.5 });
          break;
      }
    }
  }

  updateParticles(dt) {
    this.sparks.update(dt);
    this.debris.update(dt);
    // Particles live in world space, so clean up anything far behind the player.
    const cutoff = this.runner.z - 60;
    [this.sparks, this.debris].forEach((system) => {
      if (system.count === 0) return;
      for (let i = 0; i < system.count; i += 1) {
        if (system.pos[i * 3 + 2] < cutoff) system.life[i] = 0;
      }
    });
  }

  /* --------------------------------------------------------------- helpers */

  biome() {
    return biomeAtZ(this.distance);
  }

  trackFps(now) {
    if (!this.lastFpsAt) this.lastFpsAt = now;
    this.fpsSamples.push(now);
    if (this.fpsSamples.length > 90) this.fpsSamples.shift();
    if (this.fpsSamples.length > 45 && now - this.lastFpsAt > 1800) {
      this.lastFpsAt = now;
      const span = this.fpsSamples[this.fpsSamples.length - 1] - this.fpsSamples[0];
      const fps = (this.fpsSamples.length - 1) / (span / 1000);
      this.reportedFps = Math.round(fps);
      if (GAME_CONFIG.graphics.autoDegrade && this.settings.autoQuality && fps < GAME_CONFIG.graphics.degradeBelowFps) {
        this.degrade();
      }
    }
  }

  /** Drop one graphics step when the hardware cannot hold the frame rate. */
  degrade() {
    const order = GAME_CONFIG.graphics.presetOrder;
    const index = order.indexOf(this.preset.id);
    if (index <= 0) {
      this.settings.resolutionScale = Math.max(0.7, (this.settings.resolutionScale || 1) - 0.05);
      this.resize();
      return;
    }
    this.qualityStep += 1;
    this.preset = GAME_CONFIG.graphics.presets[order[index - 1]];
    this.settings.quality = this.preset.id;
    this.renderer.shadowMap.enabled = !!this.preset.shadows;
    this.track.props.setShadows(!!this.preset.shadows);
    this.environment.preset = this.preset;
    this.resize();
    this.notice({ id: 'quality', text: `Graphics set to ${this.preset.name} for a smoother run`, tone: 'cyan' });
    this.onStateChange?.('quality', this.preset.id);
  }

  pushHud(force = false) {
    if (!this.onHud) return;
    const now = performance.now();
    if (!force && now - this.lastHudAt < 90) return;
    this.lastHudAt = now;
    this.onHud({
      status: this.status,
      score: Math.floor(this.score),
      distance: Math.floor(this.distance),
      multiplier: Number(this.multiplier.toFixed(2)),
      comboPeak: Number(this.comboPeak.toFixed(2)),
      coins: this.coins,
      gems: this.gems,
      speed: Math.round(this.runner.speed * 3.6),
      shields: this.shields,
      integrityOK: this.integrityOK,
      biome: this.biome(),
      event: this.events.activeAmbience,
      wager: this.wagerTimer > 0,
      boost: this.boostTimer > 0,
      fps: this.reportedFps || 60,
      mode: this.mode,
      difficulty: this.difficultyId,
      bet: this.bet,
      elapsed: this.runTime,
    });
  }

  /* --------------------------------------------------------------- finish */

  result(status) {
    const payout = this.mode === 'real' ? computePayout(
      {
        distance: this.distance,
        coins: this.coins,
        gems: this.gems,
        comboPeak: this.comboPeak,
        nearMisses: this.nearMisses,
        grindSeconds: this.grindSeconds,
        airManoeuvres: this.airManoeuvres,
        obstaclesAvoided: this.obstaclesAvoided,
        bonusEvents: this.bonusEvents,
        wagerEvents: this.wagerEvents,
      },
      { difficulty: this.difficultyId, bet: this.bet, prestige: this.prestige }
    ) : null;

    return {
      status,
      mode: this.mode,
      difficulty: this.difficultyId,
      distance: Math.round(this.distance),
      score: Math.floor(this.score),
      coins: this.coins,
      gems: this.gems,
      comboPeak: Number(this.comboPeak.toFixed(2)),
      nearMisses: this.nearMisses,
      obstaclesAvoided: this.obstaclesAvoided,
      bonusEvents: this.bonusEvents,
      wagerEvents: this.wagerEvents,
      grinds: this.grindSeconds > 0.4 ? 1 : 0,
      grindSeconds: Number(this.grindSeconds.toFixed(2)),
      maxGrindSeconds: Number(this.maxGrindSeconds.toFixed(2)),
      airManoeuvres: this.airManoeuvres,
      hits: this.hits,
      duration: Number(this.runTime.toFixed(2)),
      biomeReached: this.biomeId,
      biomesVisited: Array.from(this.biomesVisited),
      integrityFlags: this.integrityFlags,
      bet: this.bet,
      payout,
    };
  }

  finish(status) {
    if (this.finished) return;
    this.finished = true;
    this.status = 'over';
    this.audio.setIntensity(0);
    if (status === 'crash') this.audio.sfx('hit');
    const result = this.result(status);
    this.pushHud(true);
    this.onStateChange?.('over');
    this.onGameOver?.(result);
  }
}

export default Game;