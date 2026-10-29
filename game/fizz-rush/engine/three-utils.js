import * as THREE from 'three';

/**
 * Fizz Rush — shared rendering helpers
 * ---------------------------------------------------------------------------
 * Geometry and material caches plus the low-poly merge kit used to author every
 * prop, hazard and character in the game out of primitives. Nothing is loaded
 * from disk, so the whole world builds in a few milliseconds.
 */

/** Deterministic RNG so a given pattern always lays out the same way. */
export function makeRng(seed = 1) {
  let a = (seed >>> 0) || 1;
  return function rng() {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length) % arr.length];
}

export function range(rng, min, max) {
  return min + rng() * (max - min);
}

export function shuffle(rng, arr) {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export const clamp = (v, min, max) => (v < min ? min : v > max ? max : v);

/* ------------------------------------------------------------- primitives */

export const B = (w, h, d, seg) => new THREE.BoxGeometry(w, h, d, seg, seg, seg);
export const CY = (rt, rb, h, s = 8) => new THREE.CylinderGeometry(rt, rb, h, s);
export const CO = (r, h, s = 6) => new THREE.ConeGeometry(r, h, s);
export const SP = (r, s = 10) => new THREE.SphereGeometry(r, s, Math.max(4, Math.floor(s / 2)));
export const OC = (r) => new THREE.OctahedronGeometry(r, 0);
export const TO = (r, t, s = 8) => new THREE.TorusGeometry(r, t, s, 12);
export const PL = (w, h) => new THREE.PlaneGeometry(w, h);

const _color = new THREE.Color();
const _matrix = new THREE.Matrix4();
const _quat = new THREE.Quaternion();
const _euler = new THREE.Euler();
const _vec = new THREE.Vector3();
const _scale = new THREE.Vector3();

/** Paint every vertex of a geometry with a flat colour. */
export function paint(geometry, hex, factor = 1) {
  _color.set(hex);
  if (factor !== 1) _color.multiplyScalar(factor);
  const count = geometry.attributes.position.count;
  const arr = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    arr[i * 3] = _color.r;
    arr[i * 3 + 1] = _color.g;
    arr[i * 3 + 2] = _color.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geometry;
}

/** Paint, transform and return a primitive ready to be merged. */
export function part(geometry, hex, pos = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1], factor = 1) {
  paint(geometry, hex, factor);
  _quat.setFromEuler(_euler.set(rot[0], rot[1], rot[2]));
  _matrix.compose(_vec.set(pos[0], pos[1], pos[2]), _quat, _scale.set(scale[0], scale[1], scale[2]));
  geometry.applyMatrix4(_matrix);
  return geometry;
}

/**
 * Merge painted primitives into a single indexed-free geometry.
 * Written locally (rather than pulled from three/examples) so the game has no
 * fragile import paths and stays fully self-contained.
 */
export function mergeParts(parts) {
  if (!parts || !parts.length) return null;
  const flat = [];
  let total = 0;
  for (const p of parts) {
    const g = p.index ? p.toNonIndexed() : p;
    if (g !== p) p.dispose();
    flat.push(g);
    total += g.attributes.position.count;
  }
  const pos = new Float32Array(total * 3);
  const nor = new Float32Array(total * 3);
  const uv = new Float32Array(total * 2);
  const col = new Float32Array(total * 3);
  let offset = 0;
  for (const g of flat) {
    const count = g.attributes.position.count;
    pos.set(g.attributes.position.array, offset * 3);
    if (g.attributes.normal) nor.set(g.attributes.normal.array, offset * 3);
    else nor.fill(1, offset * 3, offset * 3 + 3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array, offset * 2);
    if (g.attributes.color) col.set(g.attributes.color.array, offset * 3);
    else col.fill(1, offset * 3, offset * 3 + 3);
    offset += count;
    g.dispose();
  }
  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  merged.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  merged.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  merged.setAttribute('color', new THREE.BufferAttribute(col, 3));
  merged.computeBoundingSphere();
  return merged;
}

/* --------------------------------------------------------------- caches */

const matCache = new Map();

export function sharedMat(key, params, kind = 'standard') {
  if (!matCache.has(key)) {
    const Material = kind === 'basic' ? THREE.MeshBasicMaterial : THREE.MeshStandardMaterial;
    matCache.set(key, new Material(params));
  }
  return matCache.get(key);
}

/** The one material every vertex-coloured prop, hazard and character uses. */
export function propMaterial(opts = {}) {
  return sharedMat(
    `prop:${opts.roughness ?? 0.82}:${opts.metalness ?? 0.06}`,
    { vertexColors: true, roughness: opts.roughness ?? 0.82, metalness: opts.metalness ?? 0.06 }
  );
}

/** Unlit, un-tonemapped material for anything that should read as emissive. */
export function glowMaterial(opacity = 1) {
  return sharedMat(
    `glow:${opacity}`,
    { vertexColors: true, toneMapped: false, transparent: opacity < 1, opacity, depthWrite: opacity >= 1 }
  );
}

export function disposeShared() {
  matCache.forEach((m) => m.dispose());
  matCache.clear();
}

/** Recursively free GPU memory for a subtree. */
export function disposeTree(root) {
  if (!root) return;
  root.traverse?.((obj) => {
    if (obj.geometry) obj.geometry.dispose();
    const mats = Array.isArray(obj.material) ? obj.material : obj.material ? [obj.material] : [];
    mats.forEach((m) => {
      if (m.userData?.shared) return;
      m.dispose();
    });
  });
}

/** Compose a transform into an instance matrix. */
export function setInstance(mesh, index, pos, rotY = 0, scale = 1, rotX = 0, rotZ = 0) {
  _quat.setFromEuler(_euler.set(rotX, rotY, rotZ));
  _matrix.compose(_vec.set(pos[0], pos[1], pos[2]), _quat, _scale.set(scale, scale, scale));
  mesh.setMatrixAt(index, _matrix);
}

export function zeroInstance(mesh, index) {
  _matrix.makeScale(0.0001, 0.0001, 0.0001);
  mesh.setMatrixAt(index, _matrix);
}

export const GRAVITY = 27;