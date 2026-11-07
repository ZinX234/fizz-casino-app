import * as THREE from "three";
import { buildEnvironment } from "@/game/shatterpoint/scene/environment";
import { Bridge, START_Z, endZ } from "@/game/shatterpoint/scene/bridge";
import { Character } from "@/game/shatterpoint/scene/character";
import { THEMES } from "@/game/shatterpoint/settings";

function sheenTexture() {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const g = ctx.createRadialGradient(size * 0.5, size * 0.42, 4, size * 0.5, size * 0.5, size * 0.6);
  g.addColorStop(0, "rgba(255,255,255,0.55)");
  g.addColorStop(0.45, "rgba(255,255,255,0.16)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  // specular streak
  const streak = ctx.createLinearGradient(0, size * 0.58, size, size * 0.72);
  streak.addColorStop(0, "rgba(255,255,255,0)");
  streak.addColorStop(0.5, "rgba(255,255,255,0.22)");
  streak.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = streak;
  ctx.fillRect(0, size * 0.52, size, size * 0.14);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class ShatterScene {
  constructor(container, options = {}) {
    this.container = container;
    this.settings = options.settings || {};
    this.themeName = options.theme || "neon";
    this.theme = THEMES[this.themeName] || THEMES.neon;
    this.onPick = options.onPick || (() => {});
    this.onHover = options.onHover || (() => {});
    this.onStep = options.onStep || (() => {});
    this.mode = "menu";
    this.elapsed = 0;
    this.stages = options.stages || 12;
    this.interactive = false;
    this.hovered = null;
    this.shake = 0;
    this.progress = 0;
    this.timers = new Set();
    this.pointer = new THREE.Vector2(-10, -10);
    this.pointerInside = false;
    this.raycaster = new THREE.Raycaster();
    this.camPos = new THREE.Vector3(0, 3.4, 9);
    this.camLook = new THREE.Vector3(0, 0.5, -8);
    this.frame = 0;
    this.disposed = false;
  }

  init() {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    const quality = this.settings.graphics || "high";

    this.renderer = new THREE.WebGLRenderer({
      antialias: quality === "high",
      powerPreference: "high-performance",
      alpha: false,
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(
      Math.min(window.devicePixelRatio || 1, quality === "high" ? 2 : quality === "medium" ? 1.5 : 1),
    );
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.domElement.style.display = "block";
    this.renderer.domElement.style.width = "100%";
    this.renderer.domElement.style.height = "100%";
    this.renderer.domElement.style.touchAction = "manipulation";
    this.container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color("#05060a");
    this.aspect = width / height;
    this.camera = new THREE.PerspectiveCamera(this.aspect < 0.85 ? 62 : 52, this.aspect, 0.1, 420);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);

    this.sheenTexture = sheenTexture();
    this.env = buildEnvironment({
      scene: this.scene,
      theme: this.theme,
      quality,
      motion: this.animationLevel(),
    });
    this.env.setDestination(-30);

    // reflections for the glass surfaces
    try {
      const pmrem = new THREE.PMREMGenerator(this.renderer);
      this.envRT = pmrem.fromScene(this.env.envScene, 0.35);
      this.scene.environment = this.envRT.texture;
      pmrem.dispose();
    } catch {
      /* reflections are a nice-to-have */
    }

    this.character = new Character({ scene: this.scene, theme: this.theme });
    this.bridge = new Bridge({
      scene: this.scene,
      theme: this.theme,
      quality,
      sheenTexture: this.sheenTexture,
    });
    this.bridge.build(this.stages);
    this.character.reset(0, START_Z);

    this._onPointerMove = (e) => {
      const rect = this.renderer.domElement.getBoundingClientRect();
      this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      this.pointerInside = true;
    };
    this._onPointerDown = (e) => {
      if (this.mode !== "play" || !this.interactive) return;
      const rect = this.renderer.domElement.getBoundingClientRect();
      this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      const hit = this._raycast();
      if (hit) this.onPick(hit.stage, hit.side);
    };
    this._onPointerLeave = () => {
      this.pointerInside = false;
      this.bridge.clearHover();
      this.hovered = null;
    };

    const el = this.renderer.domElement;
    el.addEventListener("pointermove", this._onPointerMove, { passive: true });
    el.addEventListener("pointerdown", this._onPointerDown);
    el.addEventListener("pointerleave", this._onPointerLeave);
    el.addEventListener("pointercancel", this._onPointerLeave);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.container);

    this.clock = new THREE.Clock();
    this._loop = () => {
      if (this.disposed) return;
      const dt = Math.min(this.clock.getDelta(), 0.05);
      this.elapsed += dt;
      this.frame += 1;
      this.bridge.update(dt);
      this.character.update(dt);
      this.env.update(dt);
      this._updateHover();
      this._updateCamera(dt);
      this.renderer.render(this.scene, this.camera);
      this.raf = requestAnimationFrame(this._loop);
    };
    this.raf = requestAnimationFrame(this._loop);
  }

  animationLevel() {
    if (this.settings.reducedMotion) return "minimal";
    return this.settings.animation || "full";
  }

  dur(ms) {
    const factor = this.settings.reducedMotion ? 0.55 : this.settings.animation === "subtle" ? 0.85 : 1;
    const cam = this.settings.cameraSpeed === "brisk" ? 0.85 : 1;
    return Math.round(ms * factor * cam);
  }

  wait(ms) {
    return new Promise((resolve) => {
      const id = window.setTimeout(() => {
        this.timers.delete(id);
        resolve();
      }, ms);
      this.timers.add(id);
    });
  }

  resize() {
    if (!this.renderer) return;
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    if (!width || !height) return;
    this.renderer.setSize(width, height, false);
    this.aspect = width / height;
    this.camera.aspect = this.aspect;
    this.camera.fov = this.aspect < 0.85 ? 64 : 52;
    this.camera.updateProjectionMatrix();
  }

  _raycast() {
    if (!this.bridge?.pickables?.length) return null;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.bridge.pickables, false);
    if (!hits.length) return null;
    const { stage, side } = hits[0].object.userData;
    return { stage, side };
  }

  _updateHover() {
    if (this.mode !== "play" || !this.interactive || !this.pointerInside) {
      if (this.hovered) {
        this.bridge.clearHover();
        this.hovered = null;
        this.onHover(null);
      }
      return;
    }
    if (this.frame % 2 !== 0) return;
    const hit = this._raycast();
    const key = hit ? `${hit.stage}-${hit.side}` : null;
    const prevKey = this.hovered ? `${this.hovered.stage}-${this.hovered.side}` : null;
    if (key !== prevKey) {
      this.bridge.clearHover();
      if (hit) this.bridge.hover(hit.stage, hit.side);
      this.hovered = hit;
      this.onHover(hit);
    }
  }

  _updateCamera(dt) {
    const portrait = this.aspect < 0.85;
    const targetPos = new THREE.Vector3();
    const targetLook = new THREE.Vector3();
    const p = this.character.group.position;
    let damping = 3.4;

    switch (this.mode) {
      case "menu": {
        const t = this.elapsed * 0.16;
        targetPos.set(Math.sin(t) * 5.6, 3.5 + Math.sin(t * 0.8) * 0.4, 9.2 - Math.cos(t) * 1.9);
        targetLook.set(0, 0.35, -11 + Math.cos(t * 0.6) * 2.4);
        damping = 1.6;
        break;
      }
      case "fall": {
        targetPos.set(p.x * 0.42, Math.max(p.y + 2.4, -9), p.z + 6.6);
        targetLook.set(p.x * 0.5, p.y - 1.1, p.z - 3.2);
        damping = 2.6;
        break;
      }
      case "victory": {
        targetPos.set(portrait ? 4 : 0, 9.4, p.z + (portrait ? 14 : 12));
        targetLook.set(0, 0.4, p.z - 5.5);
        damping = 1.9;
        break;
      }
      default: {
        const dist = portrait ? 8.4 : 6.3;
        const height = portrait ? 3.7 : 2.6;
        const ahead = portrait ? 7.8 : 5.6;
        const breathe = this.settings.reducedMotion ? 0 : Math.sin(this.elapsed * 1.3) * 0.035;
        targetPos.set(p.x * 0.38, height + breathe, p.z + dist);
        targetLook.set(p.x * 0.52, 0.62, p.z - ahead);
        damping = this.settings.cameraSpeed === "brisk" ? 4.4 : 3.2;
      }
    }

    const k = 1 - Math.exp(-dt * damping);
    this.camPos.lerp(targetPos, k);
    this.camLook.lerp(targetLook, k);

    let ox = 0;
    let oy = 0;
    if (this.shake > 0.001 && this.settings.cameraShake && !this.settings.reducedMotion) {
      this.shake = Math.max(0, this.shake - dt * 1.5);
      const s = this.shake * this.shake;
      ox = (Math.random() - 0.5) * s * 1.6;
      oy = (Math.random() - 0.5) * s * 1.2;
    }
    this.camera.position.set(this.camPos.x + ox, this.camPos.y + oy, this.camPos.z);
    this.camera.lookAt(this.camLook);
  }

  // ── public control ───────────────────────────────────────────────────────

  setSettings(next) {
    const prevQuality = this.settings.graphics;
    this.settings = { ...this.settings, ...next };
    if (this.renderer && prevQuality !== this.settings.graphics) {
      const q = this.settings.graphics;
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q === "high" ? 2 : q === "medium" ? 1.5 : 1));
      this.renderer.setSize(this.container.clientWidth, this.container.clientHeight, false);
    }
  }

  setTheme(name) {
    this.themeName = name;
    this.theme = THEMES[name] || THEMES.neon;
    this.env?.setTheme(this.theme);
    this.bridge?.setTheme(this.theme);
    this.character?.setTheme(this.theme);
  }

  setInteractive(value) {
    this.interactive = value;
    if (!value) {
      this.bridge?.clearHover();
      this.hovered = null;
    }
  }

  enableStage(stage) {
    if (!this.bridge) return;
    if (stage >= this.stages) {
      this.bridge.clearPickables();
      return;
    }
    this.bridge.setActiveStage(stage);
    this.interactive = true;
  }

  /** Reset to the attract/menu camera. */
  enterMenu(stages = this.stages) {
    this.mode = "menu";
    this.interactive = false;
    this.progress = 0;
    this.stages = stages;
    this.bridge?.clear();
    this.bridge?.build(stages);
    this.env?.setDestination(endZ(stages) - 1.6);
    this.env?.setProgress(0);
    this.character?.reset(0, START_Z);
    this.shake = 0;
  }

  async startRun({ stages }) {
    this.stages = stages;
    this.mode = "play";
    this.interactive = false;
    this.progress = 0;
    this.bridge.clear();
    this.bridge.build(stages);
    this.env.setDestination(endZ(stages) - 1.6);
    this.env.setProgress(0);
    this.character.reset(0, START_Z);
    this.bridge.setActiveStage(0);
    this.camPos.set(0, 7.6, START_Z + 10.5);
    this.camLook.set(0, 0.5, -10);
    await this.wait(this.dur(1250));
    this.enableStage(0);
    this.interactive = true;
  }

  async resolveSafe(stage, side) {
    this.interactive = false;
    this.bridge.clearPickables();
    this.bridge.clearHover();
    this.hovered = null;
    const c = this.bridge.getPanelCenter(stage, side);
    this.bridge.setPanelState(stage, side, "selected");
    await this.character.walkTo(c.x, c.z, this.dur(540), () => this.onStep());
    this.bridge.setPanelState(stage, side, "safe");
    this.shake = 0.08;
    this.progress = (stage + 1) / this.stages;
    this.env.setProgress(this.progress);
    await this.wait(this.dur(320));
    this.bridge.setPanelState(stage, side, "completed");
  }

  async breakPanel(stage, side, { onCrack, onShatter } = {}) {
    this.interactive = false;
    this.bridge.clearPickables();
    this.bridge.clearHover();
    this.hovered = null;
    const c = this.bridge.getPanelCenter(stage, side);
    this.bridge.setPanelState(stage, side, "selected");
    await this.character.walkTo(c.x, c.z, this.dur(420), () => this.onStep());
    this.bridge.setPanelState(stage, side, "unstable");
    this.bridge.showCracks(stage, side);
    onCrack?.();
    this.shake = 0.14;
    await this.wait(this.dur(460));
    this.bridge.shatter(stage, side);
    onShatter?.();
    this.shake = 0.62;
    await this.wait(this.dur(190));
    this.mode = "fall";
    await this.character.fall(this.dur(1500));
    await this.wait(this.dur(220));
  }

  async playVictory() {
    this.interactive = false;
    const z = endZ(this.stages);
    await this.character.walkTo(0, z, this.dur(1150), () => this.onStep());
    this.character.celebrate();
    this.mode = "victory";
    this.bridge.burstVictory(0, z + 1.2);
    await this.wait(this.dur(1900));
  }

  dispose() {
    this.disposed = true;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.timers.forEach((id) => window.clearTimeout(id));
    this.timers.clear();
    if (this.resizeObserver) this.resizeObserver.disconnect();
    const el = this.renderer?.domElement;
    if (el) {
      el.removeEventListener("pointermove", this._onPointerMove);
      el.removeEventListener("pointerdown", this._onPointerDown);
      el.removeEventListener("pointerleave", this._onPointerLeave);
      el.removeEventListener("pointercancel", this._onPointerLeave);
    }
    this.bridge?.dispose();
    this.character?.dispose();
    this.env?.dispose();
    this.sheenTexture?.dispose();
    if (this.renderer) {
      this.renderer.dispose();
      if (el?.parentNode) el.parentNode.removeChild(el);
    }
  }
}