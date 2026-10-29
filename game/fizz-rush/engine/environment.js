import * as THREE from 'three';
import { GAME_CONFIG } from '../config';

/**
 * Fizz Rush — environment
 * ---------------------------------------------------------------------------
 * Gradient sky dome, animated lagoon water, sun/hemisphere lighting with
 * dynamic shadows, and smooth cross-fades between the eight island biomes.
 * Everything is procedural, so there are no textures to load and no pop-in.
 */

const TRANSITION = 2.5;

const SKY_VERTEX = `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SKY_FRAGMENT = `
  uniform vec3 uTop;
  uniform vec3 uHorizon;
  uniform vec3 uGround;
  uniform vec3 uSun;
  uniform vec3 uSunDir;
  varying vec3 vDir;
  void main() {
    vec3 dir = normalize(vDir);
    float h = dir.y;
    vec3 col = mix(uHorizon, uTop, smoothstep(0.0, 0.6, h));
    col = mix(uGround, col, smoothstep(-0.4, 0.02, h));
    float glow = pow(max(0.0, dot(dir, normalize(uSunDir))), 22.0);
    col += uSun * glow * 1.6;
    col += uSun * pow(max(0.0, dot(dir, normalize(uSunDir))), 3.0) * 0.18;
    gl_FragColor = vec4(col, 1.0);
  }
`;

const WATER_VERTEX = `
  uniform float uTime;
  uniform float uWave;
  varying vec3 vWorld;
  varying float vWave;
  void main() {
    vec3 p = position;
    float w = sin(p.x * 0.14 + uTime * 0.9) * 0.26;
    w += sin(p.y * 0.19 - uTime * 0.72) * 0.2;
    w += sin((p.x + p.y) * 0.06 + uTime * 0.42) * 0.34;
    p.z += w * uWave;
    vWave = w;
    vec4 world = modelMatrix * vec4(p, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const WATER_FRAGMENT = `
  uniform vec3 uShallow;
  uniform vec3 uDeep;
  uniform vec3 uFoam;
  uniform vec3 uSunDir;
  uniform vec3 uFogColor;
  uniform float uFogDensity;
  uniform float uTime;
  varying vec3 vWorld;
  varying float vWave;
  void main() {
    vec3 viewDir = normalize(cameraPosition - vWorld);
    float fres = pow(1.0 - max(0.0, dot(viewDir, vec3(0.0, 1.0, 0.0))), 2.4);
    float crest = clamp(vWave * 1.5 + 0.5, 0.0, 1.0);
    vec3 col = mix(uDeep, uShallow, crest);
    col = mix(col, uShallow * 1.2, fres * 0.6);
    vec3 n = normalize(vec3(sin(vWorld.x * 0.35 + uTime) * 0.09, 1.0, cos(vWorld.z * 0.3 - uTime * 0.8) * 0.09));
    float spec = pow(max(0.0, dot(reflect(-viewDir, n), normalize(uSunDir))), 48.0);
    col += vec3(1.0, 0.96, 0.86) * spec * 1.1;
    float foam = smoothstep(0.3, 0.62, vWave);
    col = mix(col, uFoam, foam * 0.55);
    float dist = length(cameraPosition - vWorld);
    float f = clamp(1.0 - exp(-pow(uFogDensity * dist, 2.0)), 0.0, 1.0);
    col = mix(col, uFogColor, f);
    gl_FragColor = vec4(col, 1.0);
  }
`;

function paletteFrom(biome) {
  return {
    skyTop: new THREE.Color(biome.sky.top),
    skyHorizon: new THREE.Color(biome.sky.horizon),
    skyGround: new THREE.Color(biome.sky.ground),
    sun: new THREE.Color(biome.sky.sun),
    fog: new THREE.Color(biome.fog.color),
    hemiSky: new THREE.Color(biome.hemi.sky),
    hemiGround: new THREE.Color(biome.hemi.ground),
    sunLight: new THREE.Color(biome.sunLight.color),
    road: new THREE.Color(biome.road.surface),
    curb: new THREE.Color(biome.road.curb),
    line: new THREE.Color(biome.road.line),
    terrain: new THREE.Color(biome.terrain.color),
    shallow: new THREE.Color(biome.water.shallow),
    deep: new THREE.Color(biome.water.deep),
    foam: new THREE.Color(biome.water.foam),
  };
}

export class Environment {
  constructor(scene, preset) {
    this.scene = scene;
    this.preset = preset;
    this.focusZ = 0;
    this.time = 0;
    this.mix = 1;
    this.tint = new THREE.Color(1, 1, 1);
    this.eventTint = null;
    this.biome = GAME_CONFIG.biomes[0];
    this.from = paletteFrom(this.biome);
    this.to = this.from;
    this.current = paletteFrom(this.biome);

    // -------------------------------------------------------------- sky
    this.skyUniforms = {
      uTop: { value: this.current.skyTop.clone() },
      uHorizon: { value: this.current.skyHorizon.clone() },
      uGround: { value: this.current.skyGround.clone() },
      uSun: { value: this.current.sun.clone() },
      uSunDir: { value: new THREE.Vector3(0, 0.5, -1) },
    };
    const skyMat = new THREE.ShaderMaterial({
      uniforms: this.skyUniforms,
      vertexShader: SKY_VERTEX,
      fragmentShader: SKY_FRAGMENT,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      toneMapped: false,
    });
    skyMat.userData.shared = true;
    this.skyMaterial = skyMat;
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(860, 32, 18), skyMat);
    this.sky.frustumCulled = false;
    scene.add(this.sky);

    // ------------------------------------------------------------ water
    const detail = Math.max(1, [1, 20, 36, 52][Math.min(3, preset.waterDetail ?? 2)]);
    this.waterUniforms = {
      uTime: { value: 0 },
      uWave: { value: preset.waterDetail ? 1 : 0.25 },
      uShallow: { value: this.current.shallow.clone() },
      uDeep: { value: this.current.deep.clone() },
      uFoam: { value: this.current.foam.clone() },
      uSunDir: { value: new THREE.Vector3(0, 0.5, -1) },
      uFogColor: { value: this.current.fog.clone() },
      uFogDensity: { value: GAME_CONFIG.biomes[0].fog.density },
    };
    const waterMat = new THREE.ShaderMaterial({
      uniforms: this.waterUniforms,
      vertexShader: WATER_VERTEX,
      fragmentShader: WATER_FRAGMENT,
      fog: false,
      toneMapped: true,
    });
    waterMat.userData.shared = true;
    this.waterMaterial = waterMat;
    this.seaLevel = -1.55;
    this.water = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400, detail, detail), waterMat);
    this.water.rotation.x = -Math.PI / 2;
    this.water.position.y = this.seaLevel;
    this.water.frustumCulled = false;
    scene.add(this.water);

    // ----------------------------------------------------------- lights
    this.hemi = new THREE.HemisphereLight(this.current.hemiSky, this.current.hemiGround, this.biome.hemi.intensity);
    scene.add(this.hemi);

    this.ambient = new THREE.AmbientLight('#ffffff', 0.3);
    scene.add(this.ambient);

    this.sun = new THREE.DirectionalLight(this.current.sunLight, this.biome.sunLight.intensity);
    this.sun.castShadow = !!preset.shadows;
    const shadowSize = preset.shadowMapSize || 1024;
    this.sun.shadow.mapSize.set(shadowSize, shadowSize);
    this.sun.shadow.camera.left = -20;
    this.sun.shadow.camera.right = 20;
    this.sun.shadow.camera.top = 22;
    this.sun.shadow.camera.bottom = -18;
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 90;
    this.sun.shadow.bias = -0.0009;
    this.sun.shadow.normalBias = 0.03;
    this.sunTarget = new THREE.Object3D();
    scene.add(this.sunTarget);
    this.sun.target = this.sunTarget;
    scene.add(this.sun);

    this.sunDir = new THREE.Vector3(0, 0.6, -0.8).normalize();
    scene.fog = new THREE.FogExp2(this.current.fog.getHex(), this.biome.fog.density);
    scene.background = null;
  }

  /** Begin a cross-fade to another biome. */
  setBiome(id) {
    const next = GAME_CONFIG.biomes.find((b) => b.id === id);
    if (!next || next.id === this.biome.id) return false;
    // Snapshot the current interpolated palette so fades never jump.
    this.from = this.snapshot();
    this.to = paletteFrom(next);
    this.biome = next;
    this.mix = 0;
    return true;
  }

  snapshot() {
    const out = {};
    Object.keys(this.to).forEach((key) => {
      out[key] = this.to[key].clone();
    });
    return out;
  }

  /** Temporary tint/fog override used by world events (storms, festivals...). */
  applyEvent(event) {
    this.eventTint = event || null;
  }

  update(dt, camera, focusZ) {
    this.time += dt;
    this.focusZ = focusZ;

    if (this.mix < 1) this.mix = Math.min(1, this.mix + dt / TRANSITION);
    const t = this.mix < 1 ? tween(this.mix) : 1;
    const target = this.to;
    if (t < 1 || this.needsRefresh) {
      Object.keys(target).forEach((key) => {
        this.current[key].copy(this.from[key]).lerp(target[key], t);
      });
      this.needsRefresh = t < 1;
    }

    // Sky + sun direction
    const elevation = this.biome.sunLight.elevation;
    const azimuth = -2.2 + Math.sin(this.time * 0.02) * 0.2;
    const dir = this.sunDir.set(
      Math.cos(azimuth) * Math.cos(elevation * 1.2),
      Math.max(0.18, elevation),
      Math.sin(azimuth) * Math.cos(elevation * 1.2)
    ).normalize();
    this.skyUniforms.uTop.value.copy(this.current.skyTop);
    this.skyUniforms.uHorizon.value.copy(this.current.skyHorizon);
    this.skyUniforms.uGround.value.copy(this.current.skyGround);
    this.skyUniforms.uSun.value.copy(this.current.sun);
    this.skyUniforms.uSunDir.value.copy(dir);
    this.sky.position.set(camera.position.x, camera.position.y - 6, camera.position.z);

    this.waterUniforms.uTime.value = this.time;
    this.waterUniforms.uShallow.value.copy(this.current.shallow);
    this.waterUniforms.uDeep.value.copy(this.current.deep);
    this.waterUniforms.uFoam.value.copy(this.current.foam);
    this.waterUniforms.uSunDir.value.copy(dir);
    this.water.position.z = focusZ;

    // Lighting
    this.hemi.color.copy(this.current.hemiSky);
    this.hemi.groundColor.copy(this.current.hemiGround);
    this.hemi.intensity = this.biome.hemi.intensity + (this.eventTint?.lightBoost || 0);
    this.sun.color.copy(this.current.sunLight);
    this.sun.intensity = this.biome.sunLight.intensity + (this.eventTint?.lightBoost || 0);
    this.ambient.intensity = 0.3 + (this.eventTint?.lightBoost || 0) * 0.2;

    // Fog (biome blend + world events + accessibility brightness)
    const density = this.biome.fog.density + (this.eventTint?.fogBoost || 0);
    const fogColor = this.eventTint?.tintColor
      ? this.current.fog.clone().lerp(this.eventTint.tintColor, 0.6)
      : this.current.fog;
    this.scene.fog.color.copy(fogColor);
    this.scene.fog.density = density;
    this.waterUniforms.uFogColor.value.copy(fogColor);
    this.waterUniforms.uFogDensity.value = density;

    // Prop tint keeps scenery integrated with the current atmosphere
    this.tint.copy(fogColor).lerp(new THREE.Color(1, 1, 1), 0.86);

    // Shadows follow the action
    const px = camera.position.x;
    const pz = focusZ;
    this.sunTarget.position.set(px * 0.4, 0, pz + 14);
    this.sun.position.set(px * 0.4 + dir.x * 42, dir.y * 42, pz + 14 + dir.z * 42);
    this.sunTarget.updateMatrixWorld();
  }

  dispose() {
    this.sky.geometry.dispose();
    this.skyMaterial.dispose();
    this.water.geometry.dispose();
    this.waterMaterial.dispose();
    this.scene.remove(this.sky, this.water, this.sun, this.sunTarget, this.hemi, this.ambient);
  }
}

function tween(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

export default Environment;