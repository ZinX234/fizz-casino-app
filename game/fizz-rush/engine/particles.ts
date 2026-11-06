// @ts-nocheck
import * as THREE from 'three';

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
  max: number;
  count: number;
  positions: Float32Array;
  colors: Float32Array;
  sizes: Float32Array;
  alphas: Float32Array;
  velocities: Float32Array;
  lifetimes: Float32Array;
  ages: Float32Array;
  active: Float32Array;
  geometry: THREE.BufferGeometry;
  material: THREE.PointsMaterial;
  mesh: THREE.Points;

  constructor(max = 400, options = {}) {
    const blending = options.blending ?? THREE.AdditiveBlending;
    this.max = max;
    this.count = 0;
    this.positions = new Float32Array(max * 3);
    this.colors = new Float32Array(max * 3);
    this.sizes = new Float32Array(max);
    this.alphas = new Float32Array(max);
    this.velocities = new Float32Array(max * 3);
    this.lifetimes = new Float32Array(max);
    this.ages = new Float32Array(max);
    this.active = new Float32Array(max);

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    this.geometry.setAttribute('size', new THREE.BufferAttribute(this.sizes, 1));
    this.geometry.setAttribute('alpha', new THREE.BufferAttribute(this.alphas, 1));

    this.material = new THREE.PointsMaterial({
      size: 1,
      vertexColors: true,
      transparent: true,
      blending,
      depthWrite: false,
    });

    this.mesh = new THREE.Points(this.geometry, this.material);
    this.mesh.frustumCulled = false;
  }

  emit(x, y, z, vx, vy, vz, r, g, b, size, life) {
    if (this.count >= this.max) return;
    const i = this.count;
    this.positions[i * 3] = x;
    this.positions[i * 3 + 1] = y;
    this.positions[i * 3 + 2] = z;
    this.velocities[i * 3] = vx;
    this.velocities[i * 3 + 1] = vy;
    this.velocities[i * 3 + 2] = vz;
    this.colors[i * 3] = r;
    this.colors[i * 3 + 1] = g;
    this.colors[i * 3 + 2] = b;
    this.sizes[i] = size;
    this.alphas[i] = 1;
    this.lifetimes[i] = life;
    this.ages[i] = 0;
    this.active[i] = 1;
    this.count++;
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.color.needsUpdate = true;
    this.geometry.attributes.size.needsUpdate = true;
    this.geometry.attributes.alpha.needsUpdate = true;
  }

  update(dt) {
    let write = 0;
    for (let i = 0; i < this.count; i++) {
      if (this.active[i]) {
        this.ages[i] += dt;
        if (this.ages[i] >= this.lifetimes[i]) {
          this.active[i] = 0;
          continue;
        }
        this.positions[write * 3] = this.positions[i * 3] + this.velocities[i * 3] * dt;
        this.positions[write * 3 + 1] = this.positions[i * 3 + 1] + this.velocities[i * 3 + 1] * dt;
        this.positions[write * 3 + 2] = this.positions[i * 3 + 2] + this.velocities[i * 3 + 2] * dt;
        this.colors[write * 3] = this.colors[i * 3];
        this.colors[write * 3 + 1] = this.colors[i * 3 + 1];
        this.colors[write * 3 + 2] = this.colors[i * 3 + 2];
        this.sizes[write] = this.sizes[i];
        this.alphas[write] = 1 - this.ages[i] / this.lifetimes[i];
        this.lifetimes[write] = this.lifetimes[i];
        this.ages[write] = this.ages[i];
        this.velocities[write * 3] = this.velocities[i * 3];
        this.velocities[write * 3 + 1] = this.velocities[i * 3 + 1];
        this.velocities[write * 3 + 2] = this.velocities[i * 3 + 2];
        write++;
      }
    }
    this.count = write;
    if (this.count > 0) {
      this.geometry.attributes.position.needsUpdate = true;
      this.geometry.attributes.color.needsUpdate = true;
      this.geometry.attributes.size.needsUpdate = true;
      this.geometry.attributes.alpha.needsUpdate = true;
    }
  }

  draw(camera) {
    if (this.count === 0) return;
    this.mesh.visible = true;
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
  }
}