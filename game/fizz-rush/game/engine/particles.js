import * as THREE from 'three';

/**
 * Fizz Rush — pooled particle system
 * ---------------------------------------------------------------------------
 * One draw call per system. Particles are stored in flat typed arrays and
 * compacted with swap-remove, so the pool never grows, never leaks and never
 * allocates during a run. Used for spray, embers, sparks, confetti, dust,
 * explosions and the player's cosmetic trail.
 */

const VERTEX = `
  attribute float size;
  attribute float alpha;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vColor = color;
    vAlpha = alpha;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = size * (420.0 / max(1.0, -mv.z));
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAGMENT = `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec2 d = gl_PointCoord - vec2(0.5);
    float falloff = smoothstep(0.5, 0.05, length(d));
    gl_FragColor = vec4(vColor, falloff * vAlpha);
    if (gl_FragColor.a < 0.01) discard;
  }
`;

export class ParticleSystem {
  constructor(max = 400, { blending = THREE.AdditiveBlending } = {}) {
    this.max = max;