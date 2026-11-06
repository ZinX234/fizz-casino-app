import * as THREE from 'three';
import { GAME_CONFIG } from '../config';
import { propMaterial, glowMaterial } from './three-utils';
import { HAZARD_TYPES, getHazardGeometry } from './hazard-types';

/**
 * Fizz Rush — hazard system
 * ---------------------------------------------------------------------------
 * Pools, drives and resolves every obstacle in the run.
 *
 * Stability & integrity rules enforced here:
 *  - every hazard comes from a fixed pool, so nothing is allocated per frame
 *    and nothing can leak;
 *  - the moment a hazard is behind the player it is retired, so an obstacle
 *    can never follow, attach to, or be re-triggered by the player;
 *  - collisions are resolved against axis-aligned bounds only, so there is no
 *    physics jitter, no clipping and no spinning-into-an-obstacle exploit;
 *  - projectiles are hazards like any other, with a hard lifetime.
 */

const MAX_PER_TYPE = 20;
const RELEASE_BEHIND = 15;

const PLAYER_BOX = { x: 0, y: 0, z: 0, hw: 0, hy: 0, hd: 0 };

export class HazardSystem {
  constructor(scene, preset, hooks = {}) {
    this.scene = scene;
    this.preset = preset;
    this.hooks = hooks;
    this.pools = new Map();
    this.live = [];
    this.time = 0;
    this.bodyMat = propMaterial();
    this.glowMat = glowMaterial();
    this.rails = [];
    this._tmp = new THREE.Vector3();
  }

  /* ------------------------------------------------------------- pooling */

  acquire(typeId) {
    let pool = this.pools.get(typeId);
    if (!pool) {
      pool = { all: [], free: [] };
      this.pools.set(typeId, pool);
    }
    if (pool.free.length) return pool.free.pop();
    if (pool.all.length >= MAX_PER_TYPE) return null;
    const def = HAZARD_TYPES[typeId];
    const geo = getHazardGeometry(typeId);
    if (!def || !geo.body) return null;
    const group = new THREE.Group();
    const body = new THREE.Mesh(geo.body, this.bodyMat);
    // Obstacles throw real shadows onto the road unless a type opts out.
    body.castShadow = !!this.preset?.shadows && def.shadow !== false;
    group.add(body);
    let glow = null;
    if (geo.glow) {
      glow = new THREE.Mesh(geo.glow, this.glowMat);
      glow.renderOrder = 2;
      group.add(glow);
    }
    group.visible = false;
    this.scene.add(group);
    const entry = {
      type: typeId,
      def,
      group,
      body,
      glow,
      x: 0,
      y: 0,
      z: 0,
      baseY: def.y || 0,
      lane: 2,
      phase: 0,
      state: 'idle',
      lethal: def.lethal !== false,
      passed: false,
      cool: 0,
      drop: false,
      landed: false,
      vy: 0,
      rotY: 0,
      rotZ: 0,
      spin: 0,
      scale: 1,
      life: 0,
      vz: 0,
      vx: 0,
      rail: null,
      exploded: false,
      kind: def.params?.kind || null,
    };
    pool.all.push(entry);
    return entry;
  }

  release(entry) {
    entry.group.visible = false;
    if (entry.rail) {
      entry.rail.released = true;
      const i = this.rails.indexOf(entry.rail);
      if (i >= 0) this.rails.splice(i, 1);
      entry.rail = null;
    }
    const pool = this.pools.get(entry.type);
    if (pool) pool.free.push(entry);
    const index = this.live.indexOf(entry);
    if (index >= 0) {
      this.live[index] = this.live[this.live.length - 1];
      this.live.pop();
    }
  }

  /* ------------------------------------------------------------ spawning */

  /**
   * Place a hazard. Returns the entry, or null when the pool is exhausted
   * (which simply means the pattern was skipped — never a crash).
   */
  spawn(typeId, spec = {}) {
    const entry = this.acquire(typeId);
    if (!entry) return null;
    const def = entry.def;
    const lane = Math.max(0, Math.min(GAME_CONFIG.lanes.count - 1, spec.lane ?? 2));
    entry.lane = lane;
    entry.x = spec.x ?? (lane - (GAME_CONFIG.lanes.count - 1) / 2) * GAME_CONFIG.lanes.width;
    entry.z = spec.z ?? 0;
    entry.baseY = spec.y ?? def.y ?? 0;
    entry.y = entry.baseY;
    entry.phase = spec.phase ?? 0;
    entry.state = 'live';
    entry.lethal = def.lethal !== false && spec.lethal !== false;
    entry.passed = false;
    entry.dropped = false;
    entry.landed = false;
    entry.exploded = false;
    entry.cool = def.behavior === 'projectile' ? (spec.phase ?? 0.6) : 0;
    entry.vy = 0;
    entry.vz = spec.vz ?? 0;
    entry.vx = spec.vx ?? 0;
    entry.rotY = spec.rotY ?? 0;
    entry.rotZ = 0;
    entry.spin = 0;
    entry.scale = spec.scale ?? 1;
    entry.life = spec.life ?? 0;
    entry.params = { ...(def.params || {}), ...(spec.params || {}) };
    // Freeze the anchor a drifting hazard swings around, so it can never walk
    // across the road over time.
    entry.originX = entry.x;
    entry.params.originX = entry.x;
    entry.kind = spec.kind ?? def.params?.kind ?? null;

    if (def.behavior === 'rail') {
      const length = def.size[2];
      entry.rail = {
        lane,
        x: entry.x,
        y: entry.baseY,
        zStart: entry.z - length / 2,
        zEnd: entry.z + length / 2,
        released: false,
      };
      this.rails.push(entry.rail);
    }

    entry.group.position.set(entry.x, entry.baseY, entry.z);
    entry.group.rotation.set(0, entry.rotY, 0);
    entry.group.scale.setScalar(entry.scale);
    entry.group.visible = true;
    this.live.push(entry);
    return entry;
  }

  /* --------------------------------------------------------------- rails */

  /** Rails the player is currently over — the only surfaces you can grind. */
  railsNear(z, ahead = 6) {
    if (!this.rails.length) return null;
    for (const rail of this.rails) {
      if (rail.released) continue;
      if (z >= rail.zStart - 0.6 && z <= rail.zEnd + ahead * 0.1) return rail;
    }
    return null;
  }

  /* -------------------------------------------------------------- update */

  update(dt, ctx) {
    this.time += dt;
    const player = ctx.player;
    const box = toBox(PLAYER_BOX, player.bounds());
    const onHit = ctx.onHit;

    for (let i = this.live.length - 1; i >= 0; i -= 1) {
      const h = this.live[i];
      if (!h) continue;
      this.behave(h, dt, ctx);
      h.group.position.set(h.x, h.y, h.z);
      if (h.rotY !== 0 || h.def.behavior === 'rotator') h.group.rotation.y = h.rotY;
      if (h.rotZ !== 0 || h.def.behavior === 'roller') h.group.rotation.z = h.rotZ;

      const collider = this.collider(h);

      if (h.lethal && !h.passed) {
        if (overlaps(collider, box)) {
          if (h.def.behavior === 'exploder') this.detonate(h, ctx);
          onHit?.(h);
          h.passed = true;
        }
      }

      // Passing a non-lethal object triggers its reward (gates, boost pads).
      if (!h.passed && h.z < player.z && Math.abs(h.x - player.x) < 1.25) {
        if (h.def.behavior === 'gate') this.hooks.onGate?.(h.kind, h);
      }

      if (h.z < player.z - 1 && !h.passed) {
        h.passed = true;
        // A genuine clean pass always counts; a tight one is a near miss.
        if (h.lethal) this.hooks.onAvoid?.(h);
        if (h.lethal && isNearMiss(collider, box)) this.hooks.onNearMiss?.(h);
      }

      if (h.z < player.z - RELEASE_BEHIND) this.release(h);
      else if (h.life > 0 && this.time > h.life) this.release(h);
    }
  }

  /** Per-behaviour motion. Everything here is deterministic and bounded. */
  behave(h, dt, ctx) {
    const p = h.params || {};
    const speed = ctx.speed || 0;
    switch (h.def.behavior) {
      case 'lateral': {
        h.x = (p.originX ?? h.x) + Math.sin(this.time * (p.speed || 1) + h.phase) * (p.amplitude || 2);
        h.baseY = h.def.y + (p.bobSpeed ? Math.sin(this.time * p.bobSpeed + h.phase) * 0.14 : 0);
        h.y = h.baseY;
        break;
      }
      case 'roller': {
        const roll = h.vz || -(p.speed || 4);
        h.z += roll * dt;
        h.spin += dt * (p.spin || 4);
        if (p.axis === 'z') h.rotZ = -h.spin;
        else h.rotY = h.spin * 0.4;
        if (p.tumble) h.rotZ = Math.sin(this.time * 2) * 0.12;
        break;
      }
      case 'pendulum': {
        const t = this.time * (p.speed || 1.4) + h.phase;
        h.x = (p.originX ?? h.x) + Math.sin(t) * (p.amplitude || 3);
        h.rotY = Math.sin(t) * 0.6;
        h.baseY = h.def.y - Math.max(0, Math.cos(t)) * (p.drop || 0.4);
        h.y = h.baseY;
        break;
      }
      case 'rotator': {
        h.rotY += dt * (p.speed || 1.5);
        break;
      }
      case 'crosser': {
        const period = 1 / Math.max(0.05, p.speed || 0.5);
        const t = ((this.time + h.phase) % period) / period;
        h.x = -(p.span || 9) + t * 2 * (p.span || 9);
        h.rotY = Math.PI / 2 * (t < 0.5 ? 1 : -1);
        break;
      }
      case 'faller': {
        const marker = p.marker;
        if (!h.dropped) {
          h.y = (p.height || 14) + (h.def.y || 0);
          if (h.z - ctx.player.z < (p.trigger || 32)) h.dropped = true;
        } else if (!h.landed) {
          h.vy -= 46 * dt;
          h.y += h.vy * dt;
          if (h.y <= h.def.y) {
            h.y = h.def.y;
            h.vy = 0;
            h.landed = true;
            this.hooks.onImpact?.(h);
          }
        }
        if (marker && h.glow) h.glow.visible = !h.landed;
        break;
      }
      case 'cycler': {
        const period = p.period || 3;
        const t = ((this.time + h.phase) % period) / period;
        const up = t < (p.duty || 0.35);
        h.baseY = up ? p.up ?? 0 : p.down ?? -2;
        h.y = h.baseY;
        h.lethal = up && h.def.lethal !== false;
        break;
      }
      case 'projectile': {
        h.cool -= dt;
        if (h.cool <= 0 && h.z - ctx.player.z < 46 && h.z > ctx.player.z - 4) {
          h.cool = p.interval || 2;
          const child = this.spawn(p.kind === 'coconut' ? 'coconut' : 'dart', {
            lane: h.lane,
            x: h.x,
            z: h.z - 1.4,
            y: (p.kind === 'coconut' ? 1.4 : 1.05),
            vz: -(p.speed || 22),
            life: this.time + 3.4,
          });
          if (child) child.lethal = true;
        }
        break;
      }
      case 'projectileFly': {
        h.z += h.vz * dt;
        h.rotY += dt * 6;
        break;
      }
      case 'gap': {
        // The planks fall away as the player arrives, leaving open water.
        if (h.z - ctx.player.z < 6 && !h.dropped) {
          h.dropped = true;
          this.hooks.onImpact?.(h);
        }
        if (h.dropped) h.y = h.baseY - 3.4 * Math.min(1, (6 - (h.z - ctx.player.z)) / 6);
        break;
      }
      case 'rail': {
        h.released = h.z < ctx.player.z - RELEASE_BEHIND - 10;
        if (h.rail) h.rail.released = h.released;
        break;
      }
      case 'exploder': {
        if (h.dropped) {
          h.vy -= 40 * dt;
          h.y += h.vy * dt;
          h.rotZ += dt * 6;
        }
        break;
      }
      case 'gate':
      case 'static':
      default:
        break;
    }
    return speed;
  }

  /** Chain explosions: nearby explosives blow up shortly after one is struck. */
  detonate(h, ctx) {
    if (h.exploded) return;
    h.exploded = true;
    this.hooks.onExplode?.(h);
    const radius = h.params?.radius || 4;
    for (const other of this.live) {
      if (other === h || other.exploded) continue;
      if (other.def.behavior !== 'exploder') continue;
      const dist = Math.hypot(other.x - h.x, other.z - h.z);
      if (dist <= radius) {
        other.dropped = true;
        other.vy = 5 + Math.random() * 3;
        other.exploded = true;
      }
    }
    this.release(h);
  }

  /** Axis-aligned collider for a hazard, accounting for its current pose. */
  collider(h) {
    const [w, hgt, d] = h.def.size;
    let hw = w / 2;
    let hd = d / 2;
    if (h.def.behavior === 'rotator') {
      const c = Math.abs(Math.cos(h.rotY));
      const s = Math.abs(Math.sin(h.rotY));
      hw = (w / 2) * c + (d / 2) * s;
      hd = (w / 2) * s + (d / 2) * c;
    }
    return { x: h.x, y: h.baseY + hgt / 2, z: h.z, hw, hy: hgt / 2, hd };
  }

  clear() {
    for (let i = this.live.length - 1; i >= 0; i -= 1) this.release(this.live[i]);
    this.live.length = 0;
    this.rails.length = 0;
  }

  get count() {
    return this.live.length;
  }

  dispose() {
    this.clear();
    this.pools.forEach((pool) => {
      pool.all.forEach((entry) => {
        this.scene.remove(entry.group);
        if (entry.glow) entry.glow.removeFromParent();
      });
      pool.all.length = 0;
    });
    this.pools.clear();
  }
}

function toBox(out, bounds) {
  out.x = bounds.x;
  out.y = bounds.y + bounds.hh / 2;
  out.z = bounds.z;
  out.hw = bounds.hw;
  out.hy = bounds.hh / 2;
  out.hd = bounds.hd;
  return out;
}

export function overlaps(a, b) {
  if (Math.abs(a.z - b.z) > a.hd + b.hd) return false;
  if (Math.abs(a.x - b.x) > a.hw + b.hw) return false;
  return Math.abs(a.y - b.y) <= a.hy + b.hy;
}

/** A clean pass that came within `nearMissDistance` of the obstacle. */
function isNearMiss(a, b) {
  const near = GAME_CONFIG.scoring.nearMissDistance;
  const gapX = Math.abs(a.x - b.x) - (a.hw + b.hw);
  const gapY = Math.abs(a.y - b.y) - (a.hy + b.hy);
  if (gapX > near * 1.6 || gapY > near * 1.6) return false;
  return gapX < near || gapY < near;
}

export default HazardSystem;