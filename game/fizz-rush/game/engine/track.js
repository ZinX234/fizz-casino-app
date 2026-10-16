import * as THREE from 'three';
import { GAME_CONFIG } from '../config';
import { B, PL, part, mergeParts, propMaterial, glowMaterial, setInstance, zeroInstance, makeRng, range } from './three-utils';
import { PROP_TYPES, getPropGeometry } from './props';

/**
 * Fizz Rush — the island causeway
 * ---------------------------------------------------------------------------
 * The track is a narrow island path over crystal water: a pooled set of road
 * segments, each wrapped in sloping sand banks, with an instanced prop field
 * that re-skins itself for whichever biome lies at that distance.
 *
 * Segments are recycled behind the player, so memory stays flat forever and
 * the island can continue for as long as the run does.
 */

export const ROAD_HALF = (GAME_CONFIG.lanes.count * GAME_CONFIG.lanes.width) / 2;
const EDGE = ROAD_HALF + 0.6;
const BANK_SLOPE = 0.072;
const SEG = GAME_CONFIG.world.segmentLength;
const COUNT = GAME_CONFIG.world.segments;

/** Which biome covers a given distance along the run. */
export function biomeAtZ(z) {
  const list = GAME_CONFIG.biomes;
  const index = Math.floor(Math.max(0, z) / GAME_CONFIG.world.biomeDistance) % list.length;
  return list[index];
}

/** Height of the sand bank at a lateral offset (used to seat props correctly). */
export function bankHeight(x) {
  const over = Math.max(0, Math.abs(x) - EDGE);
  return -Math.min(1.45, over * BANK_SLOPE);
}

export class Track {
  constructor(scene, preset) {
    this.scene = scene;
    this.preset = preset;
    this.active = true;

    this.roadMat = new THREE.MeshStandardMaterial({ color: '#e3cfa5', roughness: 0.92, metalness: 0.0 });
    this.lineMat = new THREE.MeshStandardMaterial({ color: '#fff6e0', roughness: 0.7, metalness: 0.0, emissive: '#3a3020', emissiveIntensity: 0.15 });
    this.curbMat = new THREE.MeshStandardMaterial({ color: '#c7a877', roughness: 0.8, metalness: 0.05 });
    this.vergeMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0.0 });

    // ------------------------------------------------------------ geometry
    this.roadGeo = B(ROAD_HALF * 2 + 1.2, 1.2, SEG);
    const lineParts = [];
    for (let lane = 1; lane < GAME_CONFIG.lanes.count; lane += 1) {
      const x = -ROAD_HALF + lane * GAME_CONFIG.lanes.width;
      lineParts.push(part(B(0.12, 0.06, SEG * 0.92), '#ffffff', [x, 0.03, 0]));
    }
    this.lineGeo = mergeParts(lineParts);
    this.curbGeo = mergeParts([
      part(B(0.55, 0.6, SEG), '#ffffff', [-(ROAD_HALF + 0.28), 0.24, 0]),
      part(B(0.55, 0.6, SEG), '#ffffff', [(ROAD_HALF + 0.28), 0.24, 0]),
    ]);
    this.bankGeo = { 1: buildBank(1), '-1': buildBank(-1) };

    this.segments = [];
    for (let i = 0; i < COUNT; i += 1) {
      const group = new THREE.Group();
      const road = new THREE.Mesh(this.roadGeo, this.roadMat);
      road.position.y = -0.6;
      road.receiveShadow = !!preset.shadows;
      const lines = new THREE.Mesh(this.lineGeo, this.lineMat);
      const curbs = new THREE.Mesh(this.curbGeo, this.curbMat);
      curbs.castShadow = false;
      const bankL = new THREE.Mesh(this.bankGeo['1'], this.vergeMat);
      const bankR = new THREE.Mesh(this.bankGeo['-1'], this.vergeMat);
      bankL.receiveShadow = !!preset.shadows;
      bankR.receiveShadow = !!preset.shadows;
      group.add(road, lines, curbs, bankL, bankR);
      this.scene.add(group);
      this.segments.push({ index: i, z: i * SEG, group });
    }

    this.props = new PropField(scene, preset);
    this.queue = this.segments.map((s) => s.index);
    this.nextZ = COUNT * SEG;
    this.rng = makeRng(0x51ced);
    this.cursor = 0;
    this.applyBiome(GAME_CONFIG.biomes[0], true);
  }

  /** Repaint road furniture for the active biome. */
  applyBiome(biome, immediate = false) {
    this.biome = biome;
    this.roadMat.color.set(biome.road.surface);
    this.lineMat.color.set(biome.road.line);
    this.curbMat.color.set(biome.road.curb);
    this.paintBank(biome);
    if (immediate) this.roadMat.color.lerp(new THREE.Color(biome.road.surface), 1);
  }

  /** Vertex-colour the sand banks: terrain tone with a bright foam edge. */
  paintBank(biome) {
    const terrain = new THREE.Color(biome.terrain.color);
    const foam = new THREE.Color(biome.water.foam);
    [this.bankGeo['1'], this.bankGeo['-1']].forEach((geo) => {
      const colors = geo.attributes.color;
      const pos = geo.attributes.position;
      for (let i = 0; i < colors.count; i += 1) {
        const x = Math.abs(pos.getX(i));
        const isFoam = x > 23.4;
        const c = isFoam ? foam : terrain;
        colors.setXYZ(i, c.r, c.g, c.b);
      }
      colors.needsUpdate = true;
    });
  }

  reset(playerZ = 0) {
    this.rng = makeRng(0x51ced);
    this.segments.forEach((s, i) => {
      s.z = playerZ + i * SEG;
      s.group.position.z = s.z;
      this.props.fillSegment(i, s.z, biomeAtZ(s.z));
    });
    this.nextZ = playerZ + COUNT * SEG;
    this.cursor = 0;
  }

  /** Advance the causeway so there is always road ahead of the player. */
  update(playerZ) {
    const horizon = playerZ + COUNT * SEG;
    let guard = 0;
    while (this.nextZ < horizon && guard < COUNT * 2) {
      guard += 1;
      const index = this.queue[this.cursor % this.queue.length];
      this.cursor += 1;
      const seg = this.segments[index];
      seg.z = this.nextZ;
      seg.group.position.z = seg.z;
      this.props.fillSegment(index, seg.z, biomeAtZ(seg.z));
      this.nextZ += SEG;
    }
  }

  dispose() {
    this.segments.forEach((s) => this.scene.remove(s.group));
    this.roadGeo.dispose();
    this.lineGeo.dispose();
    this.curbGeo.dispose();
    this.bankGeo['1'].dispose();
    this.bankGeo['-1'].dispose();
    [this.roadMat, this.lineMat, this.curbMat, this.vergeMat].forEach((m) => m.dispose());
    this.props.dispose();
  }
}

/** One sloping sand bank, built for the left (+1) or right (-1) side. */
function buildBank(sign) {
  const parts = [
    part(B(20, 0.6, SEG), '#ffffff', [(EDGE + 10) * sign, 0, 0]),
    part(B(1.9, 0.62, SEG), '#ffffff', [(EDGE + 19.1) * sign, 0, 0]),
  ];
  const merged = mergeParts(parts);
  // Tilt outward so the bank slides down into the lagoon and the outer foam
  // edge sits just under the water line.
  merged.applyMatrix4(new THREE.Matrix4().makeRotationZ(sign * BANK_SLOPE));
  merged.translate(0, -0.02, 0);
  merged.computeBoundingSphere();
  return merged;
}

/* ------------------------------------------------------------------ props */

class PropField {
  constructor(scene, preset) {
    this.scene = scene;
    this.preset = preset;
    this.fields = {};
    this.bodyMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0.06 });
    this.glowMat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
    const capacity = COUNT;

    Object.keys(PROP_TYPES).forEach((type) => {
      const def = PROP_TYPES[type];
      const geo = getPropGeometry(type);
      if (!geo.body) return;
      const body = new THREE.InstancedMesh(geo.body, this.bodyMat, capacity * def.cap);
      body.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      body.castShadow = !!def.shadow && !!preset.shadows;
      body.receiveShadow = false;
      body.frustumCulled = false;
      body.visible = false;
      scene.add(body);
      let glow = null;
      if (geo.glow) {
        glow = new THREE.InstancedMesh(geo.glow, this.glowMat, capacity * def.cap);
        glow.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        glow.frustumCulled = false;
        glow.visible = false;
        scene.add(glow);
      }
      this.fields[type] = { def, body, glow, cap: def.cap, used: 0 };
      for (let i = 0; i < capacity * def.cap; i += 1) zeroInstance(body, i);
      body.instanceMatrix.needsUpdate = true;
      if (glow) {
        for (let i = 0; i < capacity * def.cap; i += 1) zeroInstance(glow, i);
        glow.instanceMatrix.needsUpdate = true;
      }
    });
  }

  /** Populate (or re-populate) every prop slot owned by one segment. */
  fillSegment(index, z, biome) {
    const rng = makeRng(0x9e37 + index * 7919 + Math.floor(z));
    const density = this.preset.props ?? 1;
    const list = biome.props || [];

    Object.keys(this.fields).forEach((type) => {
      const field = this.fields[type];
      const wanted = list.includes(type);
      const base = index * field.cap;
      let used = 0;
      if (wanted && density > 0) {
        const count = Math.max(0, Math.round(field.cap * clamp01(density * (0.75 + rng() * 0.5))));
        for (let i = 0; i < count; i += 1) {
          const slot = base + i;
          const placement = placeProp(field.def, rng, z);
          setInstance(field.body, slot, placement.pos, placement.rotY, placement.scale, 0, 0);
          if (field.glow) setInstance(field.glow, slot, placement.pos, placement.rotY, placement.scale, 0, 0);
          used += 1;
        }
      }
      for (let i = used; i < field.cap; i += 1) {
        zeroInstance(field.body, base + i);
        if (field.glow) zeroInstance(field.glow, base + i);
      }
      field.body.instanceMatrix.needsUpdate = true;
      if (field.glow) field.glow.instanceMatrix.needsUpdate = true;
      field.body.visible = used > 0;
      if (field.glow) field.glow.visible = used > 0;
    });
  }

  setTint(color) {
    this.bodyMat.color.copy(color);
    this.glowMat.color.setRGB(
      Math.min(1.4, color.r + 0.25),
      Math.min(1.4, color.g + 0.25),
      Math.min(1.4, color.b + 0.25)
    );
  }

  setShadows(enabled) {
    Object.values(this.fields).forEach((field) => {
      field.body.castShadow = !!enabled && !!field.def.shadow;
    });
  }

  dispose() {
    Object.values(this.fields).forEach((field) => {
      this.scene.remove(field.body);
      field.body.dispose();
      if (field.glow) {
        this.scene.remove(field.glow);
        field.glow.dispose();
      }
    });
    this.bodyMat.dispose();
    this.glowMat.dispose();
    this.fields = {};
  }
}

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** Position one prop according to its placement class. */
function placeProp(def, rng, z) {
  const scale = 0.85 + rng() * 0.35;
  const rotY = rng() * Math.PI * 2;
  let x;
  let y;
  switch (def.place) {
    case 'far':
      x = (range(rng, 26, 78)) * (rng() < 0.5 ? -1 : 1);
      y = bankHeight(x);
      break;
    case 'sky':
      x = range(rng, 12, 55) * (rng() < 0.5 ? -1 : 1);
      y = range(rng, 20, 44);
      break;
    case 'over':
      x = 0;
      y = 0;
      break;
    default:
      x = (EDGE + range(rng, 1.5, 15)) * (rng() < 0.5 ? -1 : 1);
      y = bankHeight(x);
      break;
  }
  const zPos = def.place === 'over' ? z + SEG * 0.5 : z + range(rng, 0, SEG);
  return { pos: [x, y, zPos], rotY, scale };
}

export default Track;