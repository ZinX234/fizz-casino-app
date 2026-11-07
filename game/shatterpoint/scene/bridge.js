import * as THREE from "three";

const C = (hex) => new THREE.Color(hex);

export const STAGE_DEPTH = 2.5;
export const PANEL_W = 1.95;
export const PANEL_D = 2.2;
export const PANEL_T = 0.16;
export const PANEL_GAP = 0.26;
export const PANEL_X = (PANEL_W + PANEL_GAP) / 2;
export const START_Z = 2.4;
export const START_LEDGE_Z = 2.95;
export const endZ = (stages) => -(stages - 1) * STAGE_DEPTH - 2.6;

function disposeTree(root) {
  root.traverse((obj) => {
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) {
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      mats.forEach((m) => m.dispose());
    }
  });
}

function crackGeometry() {
  const verts = [];
  const arms = 8 + Math.floor(Math.random() * 4);
  const ox = (Math.random() - 0.5) * PANEL_W * 0.35;
  const oz = (Math.random() - 0.5) * PANEL_D * 0.35;
  for (let a = 0; a < arms; a += 1) {
    const angle = (a / arms) * Math.PI * 2 + Math.random() * 0.5;
    let x = ox;
    let z = oz;
    const steps = 3 + Math.floor(Math.random() * 3);
    const reach = (PANEL_W / 2) * (0.45 + Math.random() * 0.6);
    let dir = angle;
    for (let s = 0; s < steps; s += 1) {
      dir += (Math.random() - 0.5) * 0.85;
      const nx = x + Math.cos(dir) * (reach / steps) * (0.8 + Math.random() * 0.6);
      const nz = z + Math.sin(dir) * (reach / steps) * (0.8 + Math.random() * 0.6);
      verts.push(x, 0, z, nx, 0, nz);
      // small branch
      if (Math.random() > 0.55) {
        const ba = dir + (Math.random() - 0.5) * 1.6;
        verts.push(nx, 0, nz, nx + Math.cos(ba) * reach * 0.28, 0, nz + Math.sin(ba) * reach * 0.28);
      }
      x = nx;
      z = nz;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
  return geo;
}

export class Bridge {
  constructor({ scene, theme, quality, envMap, sheenTexture }) {
    this.scene = scene;
    this.theme = theme;
    this.quality = quality;
    this.envMap = envMap;
    this.sheenTexture = sheenTexture;
    this.root = new THREE.Group();
    scene.add(this.root);
    this.panels = [];
    this.pickables = [];
    this.shards = [];
    this.rings = [];
    this.stages = 0;
    this.activeStage = -1;

    this.panelGeo = new THREE.BoxGeometry(PANEL_W, PANEL_T, PANEL_D);
    this.edgeGeo = new THREE.EdgesGeometry(this.panelGeo);
    this.sheenGeo = new THREE.PlaneGeometry(PANEL_W * 0.94, PANEL_D * 0.94);
    this.metalMat = new THREE.MeshStandardMaterial({
      color: "#0a0d12",
      roughness: 0.45,
      metalness: 0.75,
      envMap: envMap || null,
      envMapIntensity: 0.7,
    });
    this.railMat = new THREE.MeshStandardMaterial({
      color: "#0b0e13",
      emissive: C(theme.primary),
      emissiveIntensity: 0.75,
      metalness: 0.8,
      roughness: 0.3,
    });
    this.glassRimMat = new THREE.MeshStandardMaterial({
      color: "#0b0e13",
      emissive: C(theme.secondary),
      emissiveIntensity: 0.9,
      metalness: 0.8,
      roughness: 0.3,
    });
  }

  _glassMaterial() {
    return new THREE.MeshPhysicalMaterial({
      color: C("#cfeee0"),
      roughness: 0.07,
      metalness: 0.05,
      clearcoat: 1,
      clearcoatRoughness: 0.04,
      transparent: true,
      opacity: 0.24,
      depthWrite: false,
      side: THREE.DoubleSide,
      envMap: this.envMap || null,
      envMapIntensity: 1.7,
      emissive: C("#0d1a12"),
      emissiveIntensity: 0.3,
    });
  }

  build(stages) {
    this.clear();
    this.stages = stages;
    const theme = this.theme;

    for (let i = 0; i < stages; i += 1) {
      const row = {};
      ["left", "right"].forEach((side, idx) => {
        const group = new THREE.Group();
        group.position.set(idx === 0 ? -PANEL_X : PANEL_X, -PANEL_T / 2, -i * STAGE_DEPTH);

        const glass = new THREE.Mesh(this.panelGeo, this._glassMaterial());
        glass.userData = { stage: i, side };
        group.add(glass);

        const edges = new THREE.LineSegments(
          this.edgeGeo,
          new THREE.LineBasicMaterial({
            color: C(theme.primary),
            transparent: true,
            opacity: 0.4,
          }),
        );
        group.add(edges);

        const sheen = new THREE.Mesh(
          this.sheenGeo,
          new THREE.MeshBasicMaterial({
            map: this.sheenTexture,
            color: C(theme.primary),
            transparent: true,
            opacity: 0.16,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          }),
        );
        sheen.rotation.x = -Math.PI / 2;
        sheen.position.y = PANEL_T / 2 + 0.005;
        group.add(sheen);

        this.root.add(group);
        row[side] = {
          stage: i,
          side,
          group,
          glass,
          edges,
          sheen,
          state: "untouched",
          crack: null,
          crackProgress: 0,
          flash: 0,
          baseY: -PANEL_T / 2,
        };
      });
      this.panels.push(row);
    }

    this._buildLedges(stages);
    this._buildRails(stages);
  }

  _buildLedges(stages) {
    const theme = this.theme;
    const startLedge = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.5, 3.1), this.metalMat);
    startLedge.position.set(0, -0.25, START_LEDGE_Z);
    this.root.add(startLedge);

    const startRim = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(5.6, 0.5, 3.1)),
      new THREE.LineBasicMaterial({ color: C(theme.primary), transparent: true, opacity: 0.8 }),
    );
    startRim.position.copy(startLedge.position);
    this.root.add(startRim);

    const far = endZ(stages) - 0.3;
    const endLedge = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.5, 3.6), this.metalMat);
    endLedge.position.set(0, -0.25, far);
    this.root.add(endLedge);

    const endRim = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(5.6, 0.5, 3.6)),
      new THREE.LineBasicMaterial({ color: C(theme.primary), transparent: true, opacity: 0.9 }),
    );
    endRim.position.copy(endLedge.position);
    this.root.add(endRim);

    // floor glow strip on each ledge
    [startLedge, endLedge].forEach((ledge) => {
      const glow = new THREE.Mesh(
        new THREE.PlaneGeometry(5.2, 2.6),
        new THREE.MeshBasicMaterial({
          map: this.sheenTexture,
          color: C(theme.primary),
          transparent: true,
          opacity: 0.22,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      glow.rotation.x = -Math.PI / 2;
      glow.position.set(0, 0.02, ledge.position.z);
      this.root.add(glow);
    });
  }

  _buildRails(stages) {
    const farZ = endZ(stages) - 2.1;
    const fromZ = START_LEDGE_Z + 1.4;
    const length = fromZ - farZ;
    const midZ = (fromZ + farZ) / 2;

    [-1, 1].forEach((s) => {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, length), this.railMat);
      rail.position.set(s * 2.55, 0.02, midZ);
      this.root.add(rail);

      const handrail = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.035, length), this.railMat);
      handrail.position.set(s * 2.55, 0.95, midZ);
      this.root.add(handrail);
    });

    const postCount = Math.min(stages + 2, 16);
    for (let i = 0; i < postCount; i += 1) {
      const z = fromZ - (length * i) / (postCount - 1);
      [-1, 1].forEach((s) => {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.95, 0.045), this.glassRimMat);
        post.position.set(s * 2.55, 0.47, z);
        this.root.add(post);
      });
    }
  }

  setTheme(theme) {
    this.theme = theme;
    this.railMat.emissive.set(theme.primary);
    this.glassRimMat.emissive.set(theme.secondary);
    this.panels.forEach((row) => {
      Object.values(row).forEach((p) => {
        if (p.state === "untouched" || p.state === "hover") {
          this.setPanelState(p.stage, p.side, p.state);
        }
      });
    });
  }

  setActiveStage(stage) {
    this.activeStage = stage;
    this.pickables = [];
    const row = this.panels[stage];
    if (!row) return;
    Object.values(row).forEach((p) => {
      if (p.state === "untouched" || p.state === "hover") this.pickables.push(p.glass);
    });
  }

  clearPickables() {
    this.activeStage = -1;
    this.pickables = [];
  }

  hover(stage, side) {
    const p = this.panels[stage]?.[side];
    if (!p || p.state !== "untouched") return;
    this.setPanelState(stage, side, "hover");
  }

  clearHover() {
    this.panels.forEach((row) =>
      Object.values(row).forEach((p) => {
        if (p.state === "hover") this.setPanelState(p.stage, p.side, "untouched");
      }),
    );
  }

  setPanelState(stage, side, state) {
    const p = this.panels[stage]?.[side];
    if (!p) return;
    const theme = this.theme;
    p.state = state;
    const edge = p.edges.material;
    const glass = p.glass.material;
    const sheen = p.sheen.material;

    switch (state) {
      case "hover":
        edge.color.set("#ffffff");
        edge.opacity = 0.95;
        glass.emissive.set(theme.primary);
        glass.emissiveIntensity = 0.55;
        glass.opacity = 0.34;
        sheen.color.set(theme.primary);
        sheen.opacity = 0.42;
        p.group.position.y = p.baseY + 0.012;
        break;
      case "selected":
        edge.color.set("#ffffff");
        edge.opacity = 1;
        glass.emissive.set(theme.primary);
        glass.emissiveIntensity = 0.85;
        glass.opacity = 0.42;
        sheen.color.set(theme.primary);
        sheen.opacity = 0.6;
        p.flash = 1;
        p.group.position.y = p.baseY;
        break;
      case "safe":
      case "completed":
        edge.color.set(theme.primary);
        edge.opacity = state === "safe" ? 1 : 0.72;
        glass.emissive.set(theme.primary);
        glass.emissiveIntensity = state === "safe" ? 1.15 : 0.6;
        glass.opacity = state === "safe" ? 0.44 : 0.3;
        sheen.color.set(theme.primary);
        sheen.opacity = state === "safe" ? 0.85 : 0.42;
        if (state === "safe") p.flash = 1;
        p.group.position.y = p.baseY;
        break;
      case "unstable":
        edge.color.set(theme.secondary);
        edge.opacity = 1;
        glass.emissive.set(theme.secondary);
        glass.emissiveIntensity = 1.3;
        glass.opacity = 0.4;
        sheen.color.set(theme.secondary);
        sheen.opacity = 0.7;
        p.flash = 1;
        break;
      case "shattered":
        p.group.visible = false;
        break;
      default:
        edge.color.set(theme.primary);
        edge.opacity = 0.4;
        glass.emissive.set("#0d1a12");
        glass.emissiveIntensity = 0.3;
        glass.opacity = 0.24;
        sheen.color.set(theme.primary);
        sheen.opacity = 0.16;
        p.group.position.y = p.baseY;
    }
  }

  showCracks(stage, side) {
    const p = this.panels[stage]?.[side];
    if (!p || p.crack) return;
    const geo = crackGeometry();
    const total = geo.getAttribute("position").count;
    geo.setDrawRange(0, 0);
    const mesh = new THREE.LineSegments(
      geo,
      new THREE.LineBasicMaterial({
        color: C("#ffffff"),
        transparent: true,
        opacity: 0.95,
      }),
    );
    mesh.position.y = PANEL_T / 2 + 0.012;
    p.group.add(mesh);
    p.crack = mesh;
    p.crackTotal = total;
    p.crackProgress = 0;
  }

  shatter(stage, side) {
    const p = this.panels[stage]?.[side];
    if (!p) return;
    p.group.visible = false;
    p.state = "shattered";

    const count = this.quality === "high" ? 28 : this.quality === "medium" ? 16 : 9;
    const cx = p.group.position.x;
    const cz = p.group.position.z;

    for (let i = 0; i < count; i += 1) {
      const w = PANEL_W * (0.1 + Math.random() * 0.26);
      const d = PANEL_D * (0.1 + Math.random() * 0.26);
      const mat = p.glass.material.clone();
      mat.opacity = 0.55;
      mat.depthWrite = false;
      const shard = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
      shard.rotation.x = -Math.PI / 2;
      shard.rotation.z = Math.random() * Math.PI;
      shard.position.set(
        cx + (Math.random() - 0.5) * PANEL_W * 0.85,
        0.01 + Math.random() * 0.05,
        cz + (Math.random() - 0.5) * PANEL_D * 0.85,
      );
      shard.userData.v = new THREE.Vector3(
        (Math.random() - 0.5) * 2.2,
        -0.6 - Math.random() * 1.4,
        (Math.random() - 0.5) * 2.2,
      );
      shard.userData.rv = new THREE.Vector3(
        (Math.random() - 0.5) * 7,
        (Math.random() - 0.5) * 7,
        (Math.random() - 0.5) * 7,
      );
      shard.userData.life = 1;
      this.shards.push(shard);
      this.root.add(shard);
    }

    const ringMat = new THREE.MeshBasicMaterial({
      color: C(this.theme.secondary),
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.44, 40), ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(cx, 0.03, cz);
    ring.userData.life = 1;
    this.rings.push(ring);
    this.root.add(ring);
  }

  burstVictory(x, z) {
    const count = this.quality === "high" ? 60 : this.quality === "medium" ? 34 : 18;
    for (let i = 0; i < count; i += 1) {
      const size = 0.1 + Math.random() * 0.3;
      const mat = new THREE.MeshBasicMaterial({
        color: C(i % 3 === 0 ? this.theme.secondary : this.theme.primary),
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const shard = new THREE.Mesh(new THREE.PlaneGeometry(size, size * 1.6), mat);
      shard.position.set(x + (Math.random() - 0.5) * 3.4, 0.3 + Math.random() * 1.6, z + (Math.random() - 0.5) * 3);
      shard.userData.v = new THREE.Vector3(
        (Math.random() - 0.5) * 2.4,
        2.4 + Math.random() * 4.2,
        (Math.random() - 0.5) * 2.4,
      );
      shard.userData.rv = new THREE.Vector3(Math.random() * 4, Math.random() * 4, Math.random() * 4);
      shard.userData.life = 1;
      shard.userData.gravity = 2.2;
      this.shards.push(shard);
      this.root.add(shard);
    }
  }

  celebrateAll() {
    for (let i = 0; i < this.stages; i += 1) {
      const safeSide = this.panels[i]?.left?.state === "safe" || this.panels[i]?.left?.state === "completed" ? "left" : "right";
      this.setPanelState(i, safeSide, "completed");
    }
  }

  update(dt) {
    // panel flashes & crack growth
    for (let i = 0; i < this.panels.length; i += 1) {
      const row = this.panels[i];
      ["left", "right"].forEach((side) => {
        const p = row[side];
        if (!p) return;
        if (p.flash > 0) {
          p.flash = Math.max(0, p.flash - dt * 2.4);
          const mat = p.glass.material;
          const base = p.state === "safe" || p.state === "completed" ? 0.6 : 0.85;
          mat.emissiveIntensity = base + p.flash * 1.8;
          const scale = 1 + p.flash * 0.014;
          p.group.scale.set(scale, 1, scale);
        } else if (p.state === "safe") {
          const pulse = Math.sin(performance.now() * 0.0022 + i) * 0.14;
          p.glass.material.emissiveIntensity = 1.05 + pulse;
          p.sheen.material.opacity = 0.8 + pulse * 0.4;
        }
        if (p.crack && p.crackTotal) {
          p.crackProgress = Math.min(1, p.crackProgress + dt / 0.42);
          const drawn = Math.floor(p.crackProgress * p.crackTotal);
          p.crack.geometry.setDrawRange(0, drawn - (drawn % 2));
          p.crack.material.opacity = 0.55 + p.crackProgress * 0.45;
        }
      });
    }

    // shards
    for (let i = this.shards.length - 1; i >= 0; i -= 1) {
      const s = this.shards[i];
      const g = s.userData.gravity ?? 9.2;
      s.userData.v.y -= g * dt;
      s.position.addScaledVector(s.userData.v, dt);
      s.rotation.x += s.userData.rv.x * dt;
      s.rotation.y += s.userData.rv.y * dt;
      s.rotation.z += s.userData.rv.z * dt;
      s.userData.life -= dt / 1.9;
      if (s.material) s.material.opacity = Math.max(0, s.userData.life * 0.7);
      if (s.userData.life <= 0 || s.position.y < -60) {
        this.root.remove(s);
        disposeTree(s);
        this.shards.splice(i, 1);
      }
    }

    // shockwave rings
    for (let i = this.rings.length - 1; i >= 0; i -= 1) {
      const r = this.rings[i];
      r.userData.life -= dt / 0.75;
      const k = 1 + (1 - r.userData.life) * 5;
      r.scale.set(k, k, 1);
      r.material.opacity = Math.max(0, r.userData.life) * 0.8;
      if (r.userData.life <= 0) {
        this.root.remove(r);
        disposeTree(r);
        this.rings.splice(i, 1);
      }
    }
  }

  resetPanels() {
    this.clearShards();
    this.panels.forEach((row) =>
      Object.values(row).forEach((p) => {
        if (p.crack) {
          p.group.remove(p.crack);
          disposeTree(p.crack);
          p.crack = null;
          p.crackProgress = 0;
        }
        p.group.visible = true;
        p.group.scale.set(1, 1, 1);
        this.setPanelState(p.stage, p.side, "untouched");
      }),
    );
    this.clearPickables();
  }

  clearShards() {
    this.shards.forEach((s) => {
      this.root.remove(s);
      disposeTree(s);
    });
    this.shards = [];
    this.rings.forEach((r) => {
      this.root.remove(r);
      disposeTree(r);
    });
    this.rings = [];
  }

  getPanelCenter(stage, side) {
    return { x: side === "left" ? -PANEL_X : PANEL_X, z: -stage * STAGE_DEPTH };
  }

  clear() {
    this.clearShards();
    // release the per-panel resources but keep the shared geometry pooled
    this.panels.forEach((row) => {
      Object.values(row).forEach((p) => {
        if (p.crack) {
          p.group.remove(p.crack);
          p.crack.geometry.dispose();
          p.crack.material.dispose();
        }
        p.glass.material.dispose();
        p.edges.material.dispose();
        p.sheen.material.dispose();
      });
    });
    this.panels = [];
    this.pickables = [];
    this.activeStage = -1;

    const shared = [this.metalMat, this.railMat, this.glassRimMat];
    for (let i = this.root.children.length - 1; i >= 0; i -= 1) {
      const child = this.root.children[i];
      this.root.remove(child);
      if (child.isGroup) continue;
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        mats.forEach((m) => {
          if (!shared.includes(m)) m.dispose();
        });
      }
    }
  }

  dispose() {
    this.clear();
    this.scene.remove(this.root);
    this.panelGeo.dispose();
    this.edgeGeo.dispose();
    this.sheenGeo.dispose();
    this.metalMat.dispose();
    this.railMat.dispose();
    this.glassRimMat.dispose();
  }
}