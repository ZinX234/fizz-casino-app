import * as THREE from "three";

const C = (hex) => new THREE.Color(hex);

function radialTexture(stops = [[0, "rgba(255,255,255,1)"], [1, "rgba(255,255,255,0)"]], size = 256) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  stops.forEach(([offset, color]) => grad.addColorStop(offset, color));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function verticalTexture(color) {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, "rgba(255,255,255,0)");
  grad.addColorStop(0.45, color);
  grad.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 256);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildEnvironment({ scene, theme, quality, motion, envMap }) {
  const group = new THREE.Group();
  scene.add(group);

  const high = quality === "high";
  const low = quality === "low";
  const animated = motion !== "minimal";

  const hazeTex = radialTexture([
    [0, "rgba(255,255,255,0.9)"],
    [0.45, "rgba(255,255,255,0.22)"],
    [1, "rgba(255,255,255,0)"],
  ]);

  scene.fog = new THREE.FogExp2(C(theme.fog), 0.026);

  // ── atmosphere floor glow ────────────────────────────────────────────────
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(220, 220),
    new THREE.MeshBasicMaterial({
      map: hazeTex,
      color: C(theme.primary),
      transparent: true,
      opacity: 0.14,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
    }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -46;
  group.add(floor);

  const floorPink = new THREE.Mesh(
    new THREE.PlaneGeometry(160, 160),
    new THREE.MeshBasicMaterial({
      map: hazeTex,
      color: C(theme.secondary),
      transparent: true,
      opacity: 0.1,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
    }),
  );
  floorPink.rotation.x = -Math.PI / 2;
  floorPink.position.set(-30, -52, -60);
  group.add(floorPink);

  // ── distant architecture ─────────────────────────────────────────────────
  const towerCount = high ? 46 : quality === "medium" ? 26 : 14;
  const towerGeo = new THREE.BoxGeometry(1, 1, 1);
  const towerMat = new THREE.MeshStandardMaterial({
    color: "#0a0d13",
    emissive: "#101a26",
    emissiveIntensity: 0.55,
    roughness: 0.8,
    metalness: 0.35,
  });
  const towers = new THREE.InstancedMesh(towerGeo, towerMat, towerCount);
  towers.frustumCulled = false;
  const dummy = new THREE.Object3D();
  for (let i = 0; i < towerCount; i += 1) {
    const side = i % 2 === 0 ? 1 : -1;
    const x = side * (10 + Math.random() * 40);
    const z = 16 - Math.random() * 150;
    const h = 8 + Math.random() * 46;
    const w = 2 + Math.random() * 7;
    dummy.position.set(x, -44 + h / 2, z);
    dummy.scale.set(w, h, w * (0.6 + Math.random() * 0.8));
    dummy.rotation.set(0, Math.random() * 0.7, 0);
    dummy.updateMatrix();
    towers.setMatrixAt(i, dummy.matrix);
  }
  towers.instanceMatrix.needsUpdate = true;
  group.add(towers);

  // neon strips on some towers
  const stripColors = [theme.primary, theme.secondary, theme.accent];
  const strips = new THREE.Group();
  const stripCount = high ? 22 : low ? 6 : 12;
  for (let i = 0; i < stripCount; i += 1) {
    const side = i % 2 === 0 ? 1 : -1;
    const color = stripColors[i % stripColors.length];
    const mat = new THREE.MeshBasicMaterial({ color: C(color), transparent: true, opacity: 0.55, fog: false });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.12, 5 + Math.random() * 16, 0.12), mat);
    mesh.position.set(side * (9 + Math.random() * 30), -22 + Math.random() * 16, 8 - Math.random() * 130);
    strips.add(mesh);
  }
  group.add(strips);

  // ── floating dust ────────────────────────────────────────────────────────
  const particleCount = high ? 1100 : quality === "medium" ? 520 : 200;
  const positions = new Float32Array(particleCount * 3);
  for (let i = 0; i < particleCount; i += 1) {
    positions[i * 3] = (Math.random() - 0.5) * 90;
    positions[i * 3 + 1] = -34 + Math.random() * 48;
    positions[i * 3 + 2] = 22 - Math.random() * 165;
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const dust = new THREE.Points(
    dustGeo,
    new THREE.PointsMaterial({
      size: 0.085,
      color: C("#dfffe0"),
      transparent: true,
      opacity: 0.62,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    }),
  );
  dust.frustumCulled = false;
  group.add(dust);

  const motes = new THREE.Group();
  const moteCount = high ? 16 : low ? 5 : 9;
  for (let i = 0; i < moteCount; i += 1) {
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: hazeTex,
        color: C(i % 3 === 0 ? theme.secondary : theme.primary),
        transparent: true,
        opacity: 0.16 + Math.random() * 0.12,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false,
      }),
    );
    const s = 2.4 + Math.random() * 4;
    sprite.scale.set(s, s, 1);
    sprite.position.set((Math.random() - 0.5) * 42, -8 + Math.random() * 16, 5 - Math.random() * 70);
    motes.add(sprite);
  }
  group.add(motes);

  // ── volumetric shafts ────────────────────────────────────────────────────
  const shaftTex = verticalTexture("rgba(255,255,255,0.55)");
  const shafts = new THREE.Group();
  const shaftCount = low ? 3 : 6;
  for (let i = 0; i < shaftCount; i += 1) {
    const mat = new THREE.MeshBasicMaterial({
      map: shaftTex,
      color: C(i % 2 === 0 ? theme.primary : theme.secondary),
      transparent: true,
      opacity: 0.07,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: false,
    });
    const w = 4 + Math.random() * 5;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, 30), mat);
    mesh.position.set((i % 2 === 0 ? 1 : -1) * (5 + Math.random() * 12), 4, 6 - Math.random() * 60);
    mesh.rotation.y = (i % 2 === 0 ? -1 : 1) * (0.35 + Math.random() * 0.4);
    mesh.rotation.z = 0.12 * (i % 2 === 0 ? 1 : -1);
    shafts.add(mesh);
  }
  group.add(shafts);

  // ── destination gate ─────────────────────────────────────────────────────
  const gate = new THREE.Group();
  const frameMat = new THREE.MeshStandardMaterial({
    color: "#0b0e14",
    emissive: C(theme.primary),
    emissiveIntensity: 0.9,
    metalness: 0.7,
    roughness: 0.28,
  });
  const pillarGeo = new THREE.BoxGeometry(0.55, 8.2, 0.55);
  const leftPillar = new THREE.Mesh(pillarGeo, frameMat);
  leftPillar.position.set(-3.7, 4.1, 0);
  const rightPillar = new THREE.Mesh(pillarGeo, frameMat);
  rightPillar.position.set(3.7, 4.1, 0);
  const beam = new THREE.Mesh(new THREE.BoxGeometry(8, 0.42, 0.55), frameMat);
  beam.position.set(0, 8.2, 0);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(3.5, 0.07, 8, 72),
    new THREE.MeshBasicMaterial({ color: C(theme.primary), transparent: true, opacity: 0.85, fog: false }),
  );
  ring.position.set(0, 4.2, 0.1);
  const ringInner = new THREE.Mesh(
    new THREE.TorusGeometry(2.6, 0.03, 6, 64),
    new THREE.MeshBasicMaterial({ color: C(theme.secondary), transparent: true, opacity: 0.6, fog: false }),
  );
  ringInner.position.set(0, 4.2, 0.1);
  const portal = new THREE.Mesh(
    new THREE.PlaneGeometry(7, 7.6),
    new THREE.MeshBasicMaterial({
      map: hazeTex,
      color: C(theme.primary),
      transparent: true,
      opacity: 0.22,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
    }),
  );
  portal.position.set(0, 4.2, 0.2);
  gate.add(leftPillar, rightPillar, beam, ring, ringInner, portal);
  gate.position.set(0, 0, -30);
  group.add(gate);

  // ── start gate (behind player) ───────────────────────────────────────────
  const startGate = new THREE.Group();
  const startMat = new THREE.MeshStandardMaterial({
    color: "#0b0e14",
    emissive: C(theme.secondary),
    emissiveIntensity: 0.7,
    metalness: 0.7,
    roughness: 0.3,
  });
  const sp1 = new THREE.Mesh(new THREE.BoxGeometry(0.4, 5.4, 0.4), startMat);
  sp1.position.set(-2.6, 2.7, 0);
  const sp2 = sp1.clone();
  sp2.position.x = 2.6;
  const sBeam = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.3, 0.4), startMat);
  sBeam.position.set(0, 5.4, 0);
  startGate.add(sp1, sp2, sBeam);
  startGate.position.set(0, 0, 4.6);
  group.add(startGate);

  // ── lights ───────────────────────────────────────────────────────────────
  const ambient = new THREE.AmbientLight(C("#33415c"), 1.1);
  const hemi = new THREE.HemisphereLight(C(theme.primary), C("#0a0a14"), 0.5);
  const key = new THREE.DirectionalLight(C("#ffffff"), 1.35);
  key.position.set(6, 18, 10);
  const moodLight = new THREE.PointLight(C(theme.primary), 42, 46, 1.7);
  moodLight.position.set(0, 6, -6);
  const pinkLight = new THREE.PointLight(C(theme.secondary), 26, 36, 1.7);
  pinkLight.position.set(6.5, 4, -14);
  const orangeLight = new THREE.PointLight(C(theme.accent), 18, 32, 1.7);
  orangeLight.position.set(-7, 3.5, -24);
  const underGlow = new THREE.PointLight(C(theme.primary), 16, 22, 2);
  underGlow.position.set(0, -3, -2);
  group.add(ambient, hemi, key, moodLight, pinkLight, orangeLight, underGlow);

  // ── environment map for glass reflections ────────────────────────────────
  let envTexture = envMap || null;
  if (!envTexture) {
    const envScene = new THREE.Scene();
    envScene.background = C("#06070c");
    const panels = [
      { c: theme.primary, p: [-10, 5, -6], r: [0, Math.PI / 2, 0] },
      { c: theme.secondary, p: [10, 4, -4], r: [0, -Math.PI / 2, 0] },
      { c: theme.accent, p: [0, 12, -12], r: [Math.PI / 2, 0, 0] },
      { c: "#ffffff", p: [0, 2, 12], r: [0, Math.PI, 0] },
    ];
    panels.forEach(({ c, p, r }) => {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(26, 26),
        new THREE.MeshBasicMaterial({ color: C(c), side: THREE.DoubleSide }),
      );
      m.position.set(p[0], p[1], p[2]);
      m.rotation.set(r[0], r[1], r[2]);
      envScene.add(m);
    });
    envTexture = envScene;
  }

  let t = 0;
  let progress = 0;

  function setTheme(next) {
    scene.fog.color.set(next.fog);
    floor.material.color.set(next.primary);
    floorPink.material.color.set(next.secondary);
    ring.material.color.set(next.primary);
    ringInner.material.color.set(next.secondary);
    portal.material.color.set(next.primary);
    frameMat.emissive.set(next.primary);
    startMat.emissive.set(next.secondary);
    hemi.color.set(next.primary);
    moodLight.color.set(next.primary);
    pinkLight.color.set(next.secondary);
    orangeLight.color.set(next.accent);
    underGlow.color.set(next.primary);
    strips.children.forEach((strip, i) => {
      strip.material.color.set([next.primary, next.secondary, next.accent][i % 3]);
    });
    motes.children.forEach((sprite, i) => {
      sprite.material.color.set(i % 3 === 0 ? next.secondary : next.primary);
    });
    shafts.children.forEach((shaft, i) => {
      shaft.material.color.set(i % 2 === 0 ? next.primary : next.secondary);
    });
    dust.material.color.set("#dfffe0");
  }

  function setDestination(z) {
    gate.position.z = z;
  }

  function setProgress(p) {
    progress = Math.max(0, Math.min(1, p));
  }

  function update(dt) {
    t += dt;
    if (animated) {
      dust.rotation.y = Math.sin(t * 0.04) * 0.05;
      dust.position.y = Math.sin(t * 0.22) * 0.7;
      motes.position.y = Math.sin(t * 0.3) * 0.5;
      motes.rotation.y = t * 0.02;
      shafts.rotation.y = Math.sin(t * 0.08) * 0.05;
      ring.rotation.z = t * 0.12;
      ringInner.rotation.z = -t * 0.18;
      strips.children.forEach((strip, i) => {
        strip.material.opacity = 0.32 + Math.sin(t * 1.2 + i) * 0.16;
      });
      portal.material.opacity = 0.18 + Math.sin(t * 0.9) * 0.06;
    }
    // lighting shifts as the player climbs
    const mix = progress;
    moodLight.position.z = -6 - mix * 16;
    moodLight.intensity = 42 + Math.sin(t * 0.8) * 3;
    pinkLight.intensity = 22 + mix * 14;
    orangeLight.intensity = 12 + mix * 22;
    moodLight.color.lerpColors(C(theme.primary), C(theme.accent), mix * 0.55);
  }

  function dispose() {
    group.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach((m) => {
          if (m.map && m.map !== hazeTex && m.map !== shaftTex) m.map.dispose();
          m.dispose();
        });
      }
    });
    scene.remove(group);
    hazeTex.dispose();
    shaftTex.dispose();
  }

  return { group, update, setTheme, setDestination, setProgress, dispose, envScene: envTexture };
}