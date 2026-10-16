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
    this.count = 0;
    this.maxVisible = max;

    // Flat typed arrays — one slot per particle
    this._px  = new Float32Array(max);
    this._py  = new Float32Array(max);
    this._pz  = new Float32Array(max);
    this._vx  = new Float32Array(max);
    this._vy  = new Float32Array(max);
    this._vz  = new Float32Array(max);
    this._life    = new Float32Array(max); // remaining life (seconds)
    this._maxLife = new Float32Array(max); // initial life (for alpha fade)
    this._size    = new Float32Array(max);
    this._gravity = new Float32Array(max);
    this._drag    = new Float32Array(max);
    this._r = new Float32Array(max);
    this._g = new Float32Array(max);
    this._b = new Float32Array(max);

    // BufferGeometry attributes
    const geo = new THREE.BufferGeometry();
    this._posAttr   = new THREE.BufferAttribute(new Float32Array(max * 3), 3);
    this._colorAttr = new THREE.BufferAttribute(new Float32Array(max * 3), 3);
    this._sizeAttr  = new THREE.BufferAttribute(new Float32Array(max), 1);
    this._alphaAttr = new THREE.BufferAttribute(new Float32Array(max), 1);
    this._posAttr.setUsage(THREE.DynamicDrawUsage);
    this._colorAttr.setUsage(THREE.DynamicDrawUsage);
    this._sizeAttr.setUsage(THREE.DynamicDrawUsage);
    this._alphaAttr.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', this._posAttr);
    geo.setAttribute('color', this._colorAttr);
    geo.setAttribute('size', this._sizeAttr);
    geo.setAttribute('alpha', this._alphaAttr);
    geo.setDrawRange(0, 0);

    const mat = new THREE.ShaderMaterial({
      uniforms: {},
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      blending,
      depthWrite: false,
      transparent: true,
      vertexColors: true,
    });

    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this._geo = geo;
  }

  /** Cap how many particles the system renders (used to scale with quality preset). */
  setMaxVisible(n) {
    this.maxVisible = Math.min(n, this.max);
  }

  /**
   * Spawn a single particle.
   * @param {object} opts
   * @param {number} opts.x
   * @param {number} opts.y
   * @param {number} opts.z
   * @param {number} [opts.vx=0]
   * @param {number} [opts.vy=0]
   * @param {number} [opts.vz=0]
   * @param {number} [opts.life=1]      seconds
   * @param {number} [opts.size=0.4]    world-space diameter
   * @param {string|number} [opts.color='#ffffff']
   * @param {number} [opts.gravity=2]   downward acceleration (positive = down)
   * @param {number} [opts.drag=0.5]    velocity multiplier per second (0=instant stop, 1=no drag)
   */
  spawn({ x = 0, y = 0, z = 0, vx = 0, vy = 0, vz = 0,
          life = 1, size = 0.4, color = '#ffffff',
          gravity = 2, drag = 0.5 } = {}) {
    if (this.count >= this.maxVisible) return;
    const i = this.count++;
    this._px[i] = x;  this._py[i] = y;  this._pz[i] = z;
    this._vx[i] = vx; this._vy[i] = vy; this._vz[i] = vz;
    this._life[i] = life;
    this._maxLife[i] = life;
    this._size[i] = size;
    this._gravity[i] = gravity;
    this._drag[i] = drag;
    const c = new THREE.Color(color);
    this._r[i] = c.r; this._g[i] = c.g; this._b[i] = c.b;
  }

  /**
   * Burst N particles from a point with random spread.
   * @param {number} n
   * @param {object} opts  same as spawn() plus:
   * @param {number} [opts.spread=3]  radial speed scatter
   */
  burst(n, { spread = 3, ...rest } = {}) {
    for (let i = 0; i < n; i++) {
      const angle = Math.random() * Math.PI * 2;
      const pitch = (Math.random() - 0.5) * Math.PI;
      const spd   = (0.4 + Math.random() * 0.6) * spread;
      this.spawn({
        ...rest,
        vx: (rest.vx ?? 0) + Math.cos(angle) * Math.cos(pitch) * spd,
        vy: (rest.vy ?? 0) + Math.sin(pitch) * spd,
        vz: (rest.vz ?? 0) + Math.sin(angle) * Math.cos(pitch) * spd,
      });
    }
  }

  /** Tick all live particles forward by dt seconds, upload to GPU. */
  update(dt) {
    let alive = 0;
    for (let i = 0; i < this.count; i++) {
      this._life[i] -= dt;
      if (this._life[i] <= 0) continue; // dead — skip (swap-remove below)

      // Integrate velocity
      const d = Math.pow(this._drag[i], dt);
      this._vx[i] *= d;
      this._vy[i] *= d;
      this._vz[i] *= d;
      this._vy[i] -= this._gravity[i] * dt;

      this._px[i] += this._vx[i] * dt;
      this._py[i] += this._vy[i] * dt;
      this._pz[i] += this._vz[i] * dt;

      // Compact: move alive data to front
      if (alive !== i) {
        this._px[alive] = this._px[i];  this._py[alive] = this._py[i];  this._pz[alive] = this._pz[i];
        this._vx[alive] = this._vx[i];  this._vy[alive] = this._vy[i];  this._vz[alive] = this._vz[i];
        this._life[alive] = this._life[i];  this._maxLife[alive] = this._maxLife[i];
        this._size[alive] = this._size[i];
        this._gravity[alive] = this._gravity[i];  this._drag[alive] = this._drag[i];
        this._r[alive] = this._r[i];  this._g[alive] = this._g[i];  this._b[alive] = this._b[i];
      }
      alive++;
    }
    this.count = alive;

    // Write to GPU buffers
    const pos   = this._posAttr.array;
    const col   = this._colorAttr.array;
    const sizes = this._sizeAttr.array;
    const alpha = this._alphaAttr.array;
    for (let i = 0; i < alive; i++) {
      pos[i * 3]     = this._px[i];
      pos[i * 3 + 1] = this._py[i];
      pos[i * 3 + 2] = this._pz[i];
      col[i * 3]     = this._r[i];
      col[i * 3 + 1] = this._g[i];
      col[i * 3 + 2] = this._b[i];
      sizes[i] = this._size[i];
      alpha[i] = Math.min(1, this._life[i] / (this._maxLife[i] * 0.25)); // fade out last 25%
    }
    this._posAttr.needsUpdate   = true;
    this._colorAttr.needsUpdate = true;
    this._sizeAttr.needsUpdate  = true;
    this._alphaAttr.needsUpdate = true;
    this._geo.setDrawRange(0, alive);
  }

  /** Remove all live particles without deallocating buffers. */
  clear() {
    this.count = 0;
    this._geo.setDrawRange(0, 0);
  }

  /**
   * Cull particles whose Z position is behind (greater than) a cutoff.
   * Called by game.js after each frame to drop particles far behind the player.
   */
  cullBehind(zCutoff) {
    for (let i = this.count - 1; i >= 0; i--) {
      if (this._pz[i] > zCutoff) {
        // swap-remove
        const last = --this.count;
        if (i !== last) {
          this._px[i] = this._px[last]; this._py[i] = this._py[last]; this._pz[i] = this._pz[last];
          this._vx[i] = this._vx[last]; this._vy[i] = this._vy[last]; this._vz[i] = this._vz[last];
          this._life[i] = this._life[last]; this._maxLife[i] = this._maxLife[last];
          this._size[i] = this._size[last];
          this._gravity[i] = this._gravity[last]; this._drag[i] = this._drag[last];
          this._r[i] = this._r[last]; this._g[i] = this._g[last]; this._b[i] = this._b[last];
        }
      }
    }
  }

  /** Free GPU resources. */
  dispose() {
    this._geo.dispose();
    this.points.material.dispose();
  }
}
