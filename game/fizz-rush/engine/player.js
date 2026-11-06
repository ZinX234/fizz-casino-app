import * as THREE from 'three';
import { GAME_CONFIG } from '../config';
import { B, CY, SP, part, mergeParts, GRAVITY } from './three-utils';
import { findCharacter } from '../cosmetics';
import { ROAD_HALF } from './track';

/**
 * Fizz Rush — the runner
 * ---------------------------------------------------------------------------
 * Lane-based movement with a real physics feel: smooth lane transitions,
 * parabolic jumps, a single air manoeuvre, slides, dives and rail grinds.
 *
 * Integrity by construction: the character can never gain height or speed
 * except through an allowed action, all movement is bounded, and every visual
 * trick (flips, spins, tumbles) is display-only — none of it feeds scoring.
 */

const GRAVITY_V = GRAVITY;
const JUMP_V = 9.4;
const AIR_JUMP_V = 8.5;
const DIVE_V = -19;
const SLIDE_TIME = 0.74;
const RAIL_Y = 1.35;
const MAX_AIRTIME = GAME_CONFIG.integrity.maxAirtimeSeconds;

const characterCache = new Map();

function buildCharacter(palette) {
  const key = `${palette.body}|${palette.accent}|${palette.visor}`;
  if (characterCache.has(key)) return characterCache.get(key);

  const torso = mergeParts([
    part(B(0.66, 0.62, 0.44), palette.body, [0, 1.16, 0]),
    part(B(0.7, 0.12, 0.48), palette.accent, [0, 0.9, 0]),
    part(B(0.26, 0.3, 0.2), palette.accent, [0, 1.15, -0.3]),
    part(CY(0.16, 0.18, 0.3, 6), palette.accent, [0, 1.52, 0]),
    part(B(0.1, 0.42, 0.1), palette.body, [-0.42, 1.2, 0]),
    part(B(0.1, 0.42, 0.1), palette.body, [0.42, 1.2, 0]),
  ]);
  const head = mergeParts([
    part(SP(0.28, 10), palette.body, [0, 1.74, 0]),
    part(B(0.42, 0.16, 0.1), palette.visor, [0, 1.76, 0.24]),
    part(SP(0.1, 6), palette.accent, [0, 1.94, 0]),
  ]);
  const arm = mergeParts([
    part(B(0.15, 0.56, 0.16), palette.accent, [0, -0.28, 0]),
    part(SP(0.12, 7), palette.body, [0, -0.58, 0]),
  ]);
  const leg = mergeParts([
    part(B(0.22, 0.5, 0.24), palette.body, [0, -0.25, 0]),
    part(B(0.24, 0.44, 0.26), palette.accent, [0, -0.72, 0]),
    part(B(0.26, 0.12, 0.34), palette.visor, [0, -0.92, 0.03]),
  ]);
  const built = { torso, head, arm, leg };
  characterCache.set(key, built);
  return built;
}

export class Runner {
  constructor(scene, { characterId = 'fizz' } = {}) {
    this.scene = scene;
    this.laneCount = GAME_CONFIG.lanes.count;
    this.laneWidth = GAME_CONFIG.lanes.width;
    this.snap = GAME_CONFIG.lanes.snapLerp;
    this.maxAirJumps = GAME_CONFIG.input.airJumps;
    this.coyoteTime = GAME_CONFIG.input.coyoteTimeMs / 1000;

    this.material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.16 });
    this.root = new THREE.Group();
    this.pivot = new THREE.Group();
    this.root.add(this.pivot);
    scene.add(this.root);

    this.meshes = {};
    this.limbs = {};
    this.buildMeshes(characterId);

    this.trailColor = '#f5c14b';
    this.reset();
  }

  buildMeshes(characterId) {
    const { palette } = findCharacter(characterId);
    const geo = buildCharacter(palette);
    Object.entries(this.meshes).forEach(([, mesh]) => {
      this.pivot.remove(mesh);
      mesh.parent?.remove(mesh);
    });
    Object.entries(this.limbs).forEach(([, group]) => {
      this.pivot.remove(group);
      group.parent?.remove(group);
    });

    const torso = new THREE.Mesh(geo.torso, this.material);
    const head = new THREE.Mesh(geo.head, this.material);
    torso.castShadow = true;
    head.castShadow = true;
    this.pivot.add(torso, head);

    const make = (position) => {
      const group = new THREE.Group();
      group.position.set(...position);
      const mesh = new THREE.Mesh(geo.arm, this.material);
      mesh.castShadow = true;
      group.add(mesh);
      this.pivot.add(group);
      return group;
    };
    const makeLeg = (position) => {
      const group = new THREE.Group();
      group.position.set(...position);
      const mesh = new THREE.Mesh(geo.leg, this.material);
      mesh.castShadow = true;
      group.add(mesh);
      this.pivot.add(group);
      return group;
    };

    this.meshes = { torso, head };
    this.limbs = {
      armL: make([-0.42, 1.42, 0]),
      armR: make([0.42, 1.42, 0]),
      legL: makeLeg([-0.19, 0.88, 0]),
      legR: makeLeg([0.19, 0.88, 0]),
    };
  }

  setCharacter(characterId) {
    this.characterId = characterId;
    this.buildMeshes(characterId);
  }

  reset() {
    this.lane = Math.floor(this.laneCount / 2);
    this.x = 0;
    this.y = 0;
    this.z = 0;
    this.vy = 0;
    this.speed = 0;
    this.state = 'run';
    this.onGround = true;
    this.coyote = 0;
    this.airJumps = this.maxAirJumps;
    this.slideTimer = 0;
    this.phase = 0;
    this.airTime = 0;
    this.spin = 0;
    this.tumble = 0;
    this.invuln = 0;
    this.grind = null;
    this.grindSeconds = 0;
    this.maxGrindSeconds = 0;
    this.airManoeuvres = 0;
    this.railLaunches = 0;
    this.events = { jump: false, airJump: false, land: false, slide: false, grindStart: false, grindEnd: false, crash: false };
    this.lastGroundedZ = 0;
    this.root.position.set(this.x, this.y, this.z);
    this.pivot.rotation.set(0, 0, 0);
  }

  laneX(lane) {
    return (lane - (this.laneCount - 1) / 2) * this.laneWidth;
  }

  get grounded() {
    return this.onGround && this.state !== 'grind';
  }

  handle(action) {
    if (action === 'left') this.setLane(this.lane - 1);
    else if (action === 'right') this.setLane(this.lane + 1);
    else if (action === 'jump') this.tryJump();
    else if (action === 'slide') this.trySlide();
  }

  setLane(next) {
    const clamped = Math.max(0, Math.min(this.laneCount - 1, next));
    if (clamped === this.lane) return false;
    this.lane = clamped;
    return true;
  }

  tryJump() {
    if (this.state === 'grind') {
      this.endGrind();
      this.vy = JUMP_V * 0.92;
      this.state = 'air';
      this.onGround = false;
      this.railLaunches += 1;
      this.events.jump = true;
      return true;
    }
    if (this.grounded || this.coyote > 0) {
      this.vy = JUMP_V;
      this.state = 'air';
      this.onGround = false;
      this.coyote = 0;
      this.slideTimer = 0;
      this.events.jump = true;
      return true;
    }
    if (this.state === 'air' && this.airJumps > 0) {
      this.airJumps -= 1;
      this.vy = AIR_JUMP_V;
      this.airManoeuvres += 1;
      this.spin = 1;
      this.events.airJump = true;
      return true;
    }
    return false;
  }

  trySlide() {
    if (this.state === 'grind') {
      this.endGrind();
      this.vy = -2;
      this.state = 'air';
      this.onGround = false;
      return true;
    }
    if (this.state === 'air') {
      // Dive: convert the jump into a fast drop, which also cuts airtime.
      this.vy = DIVE_V;
      this.slideTimer = 0;
      return true;
    }
    this.state = 'slide';
    this.slideTimer = SLIDE_TIME;
    this.events.slide = true;
    return true;
  }

  startGrind(rail) {
    this.grind = rail;
    this.state = 'grind';
    this.onGround = false;
    this.vy = 0;
    this.lane = rail.lane;
    this.grindSeconds = 0;
    this.events.grindStart = true;
  }

  endGrind() {
    if (!this.grind) return;
    this.grind = null;
    this.state = 'air';
    this.events.grindEnd = true;
  }

  /** Called by the game when a hazard connects. */
  applyHit(severe = true) {
    this.invuln = 1.6;
    this.speed = Math.max(GAME_CONFIG.difficulty.easy.speedStart * 0.7, this.speed * 0.78);
    this.tumble = severe ? 1 : 0.4;
    if (this.state === 'grind') this.endGrind();
    this.events.crash = severe;
  }

  get airborne() {
    return this.state === 'air';
  }

  /**
   * Advance the runner.
   * @param ctx {{rails:Array, autoGrind:boolean, slowMode:boolean}}
   */
  update(dt, ctx = {}) {
    const events = this.events;
    events.jump = false;
    events.airJump = false;
    events.land = false;
    events.grindStart = false;
    events.grindEnd = false;
    events.crash = false;

    const scale = ctx.slowMode ? 0.82 : 1;
    this.z += this.speed * dt;

    // Lateral lane transition — a quick exponential approach keeps it snappy
    // but never teleports, so lanes can not be skipped through obstacles.
    const targetX = this.laneX(this.lane);
    const t = Math.min(1, this.snap * dt);
    const prevX = this.x;
    this.x += (targetX - this.x) * t;
    const maxStep = 7.5 * dt;
    if (Math.abs(this.x - prevX) > maxStep) this.x = prevX + Math.sign(this.x - prevX) * maxStep;
    this.x = Math.max(-GAME_CONFIG.integrity.maxLaneOffset, Math.min(GAME_CONFIG.integrity.maxLaneOffset, this.x));

    if (this.invuln > 0) this.invuln = Math.max(0, this.invuln - dt);
    if (this.tumble > 0) this.tumble = Math.max(0, this.tumble - dt * 2.2);

    // Vertical motion
    if (this.state === 'air') {
      this.vy -= GRAVITY_V * dt * scale;
      this.y += this.vy * dt;
      this.airTime += dt;
      if (this.y <= 0) {
        this.y = 0;
        this.vy = 0;
        this.onGround = true;
        this.state = 'run';
        this.airJumps = this.maxAirJumps;
        this.airTime = 0;
        this.lastGroundedZ = this.z;
        events.land = true;
      }
    } else if (this.state === 'slide') {
      this.slideTimer -= dt;
      if (this.slideTimer <= 0) this.state = 'run';
    } else if (this.state === 'grind' && this.grind) {
      const rail = this.grind;
      // Snap onto the rail and ride it.
      this.x += (rail.x - this.x) * Math.min(1, 16 * dt);
      this.y += (RAIL_Y - this.y) * Math.min(1, 18 * dt);
      this.grindSeconds += dt;
      this.maxGrindSeconds = Math.max(this.maxGrindSeconds, this.grindSeconds);
      if (this.z > rail.zEnd || rail.released) {
        this.endGrind();
        this.y = RAIL_Y;
        this.vy = 1.5;
        this.state = 'air';
        this.onGround = false;
      }
    } else {
      this.onGround = true;
      this.airTime = 0;
      this.lastGroundedZ = this.z;
    }

    if (this.state !== 'air' && this.state !== 'grind') this.coyote = this.coyoteTime;
    else this.coyote = Math.max(0, this.coyote - dt);

    this.phase += dt * (5.5 + this.speed * 0.26);
    this.animate(dt);
    this.root.position.set(this.x, this.y, this.z);
  }

  animate(dt) {
    const { armL, armR, legL, legR } = this.limbs;
    const swing = Math.sin(this.phase);
    const lean = this.tumble > 0 ? -0.5 * this.tumble : 0;
    let bodyRotX = 0;
    let bob = Math.abs(Math.sin(this.phase * 2)) * 0.045;

    if (this.state === 'grind') {
      bodyRotX = -0.16;
      legL.rotation.x = 0.5;
      legR.rotation.x = -0.5;
      armL.rotation.x = -1.1;
      armR.rotation.x = -1.1;
      legL.rotation.z = 0.28;
      legR.rotation.z = -0.28;
      armL.rotation.z = 0.7;
      armR.rotation.z = -0.7;
      bob = 0.02;
    } else if (this.state === 'slide') {
      bodyRotX = -1.05;
      legL.rotation.x = 0.9;
      legR.rotation.x = 0.3;
      armL.rotation.x = -0.6;
      armR.rotation.x = -0.6;
      legL.rotation.z = 0;
      legR.rotation.z = 0;
      armL.rotation.z = 0.2;
      armR.rotation.z = -0.2;
      bob = 0.2;
    } else if (this.state === 'air') {
      const rising = this.vy > 0;
      bodyRotX = rising ? -0.2 : 0.16;
      legL.rotation.x = rising ? -0.7 : 0.5;
      legR.rotation.x = rising ? 0.5 : -0.3;
      armL.rotation.x = rising ? -1.5 : -0.9;
      armR.rotation.x = rising ? -1.5 : -0.9;
      legL.rotation.z = 0;
      legR.rotation.z = 0;
      armL.rotation.z = 0.25;
      armR.rotation.z = -0.25;
      bob = 0;
    } else {
      legL.rotation.x = swing * 0.95;
      legR.rotation.x = -swing * 0.95;
      armL.rotation.x = -swing * 0.85;
      armR.rotation.x = swing * 0.85;
      legL.rotation.z = 0;
      legR.rotation.z = 0;
      armL.rotation.z = 0.18;
      armR.rotation.z = -0.18;
    }

    this.pivot.rotation.x = bodyRotX + lean;
    this.pivot.position.y = bob;

    // Air manoeuvres are purely cosmetic rotation: they cannot generate score.
    if (this.spin > 0) {
      this.spin = Math.max(0, this.spin - dt * 2.1);
      this.pivot.rotation.z = (1 - this.spin) * Math.PI * 2;
      if (this.spin === 0) this.pivot.rotation.z = 0;
    } else if (this.tumble > 0) {
      this.pivot.rotation.z = this.tumble * 0.4;
    } else if (this.pivot.rotation.z !== 0) {
      this.pivot.rotation.z *= Math.max(0, 1 - dt * 8);
      if (Math.abs(this.pivot.rotation.z) < 0.01) this.pivot.rotation.z = 0;
    }

    // Hit feedback: a brief emissive flash, never a visual-only "hit".
    if (this.invuln > 0) {
      const flash = Math.sin(this.invuln * 34) > 0 ? 0.6 : 0.1;
      this.material.emissive.setRGB(flash, flash * 0.12, flash * 0.1);
    } else if (this.material.emissive.r !== 0) {
      this.material.emissive.setRGB(0, 0, 0);
    }
  }

  /** Axis-aligned bounds used for every collision test in the game. */
  bounds() {
    const sliding = this.state === 'slide';
    const hh = sliding ? 0.85 : 1.8;
    return {
      x: this.x,
      y: this.y,
      z: this.z,
      hw: 0.42,
      hh,
      hd: 0.42,
      state: this.state,
      grounded: this.state === 'run' || this.state === 'slide',
      grinding: this.state === 'grind',
    };
  }

  /** Airtime over budget is treated as abnormal — the game pauses scoring. */
  get airtimeExceeded() {
    return this.airTime > MAX_AIRTIME;
  }

  dispose() {
    this.scene.remove(this.root);
    Object.values(this.meshes).forEach((m) => m.geometry.dispose());
    this.material.dispose();
  }
}

export { RAIL_Y, ROAD_HALF };
export default Runner;