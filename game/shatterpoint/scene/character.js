import * as THREE from "three";

export class Character {
  constructor({ scene, theme }) {
    this.scene = scene;
    this.theme = theme;
    this.group = new THREE.Group();
    this.group.position.set(0, 0.6, 0);

    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.22, 0.72, 5, 8),
      new THREE.MeshStandardMaterial({ color: theme?.primary || "#b6ff3c", metalness: 0.35, roughness: 0.25 }),
    );
    body.position.y = 0.55;
    this.group.add(body);

    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 16, 12),
      new THREE.MeshStandardMaterial({ color: "#d9e2ff", metalness: 0.15, roughness: 0.35 }),
    );
    head.position.y = 1.38;
    this.group.add(head);

    this.scene.add(this.group);
  }

  setTheme(theme) {
    this.theme = theme;
    const body = this.group.children[0];
    if (body?.material) body.material.color.set(theme?.primary || "#b6ff3c");
  }

  reset(x, z) {
    this.group.position.set(x, 0.6, z);
  }

  update() {}

  async walkTo(x, z, duration, onStep) {
    const start = this.group.position.clone();
    const end = new THREE.Vector3(x, 0.6, z);
    const startedAt = performance.now();
    await new Promise((resolve) => {
      const tick = (now) => {
        const t = Math.min(1, (now - startedAt) / duration);
        this.group.position.lerpVectors(start, end, 1 - Math.pow(1 - t, 3));
        if (t < 1) requestAnimationFrame(tick);
        else resolve();
      };
      requestAnimationFrame(tick);
    });
    onStep?.();
  }

  async fall(duration) {
    const startedAt = performance.now();
    await new Promise((resolve) => {
      const tick = (now) => {
        const t = Math.min(1, (now - startedAt) / duration);
        this.group.position.y = 0.6 - t * 5;
        this.group.rotation.z = t * 1.4;
        if (t < 1) requestAnimationFrame(tick);
        else resolve();
      };
      requestAnimationFrame(tick);
    });
  }

  celebrate() {
    this.group.rotation.z = 0;
  }

  dispose() {
    this.scene.remove(this.group);
    this.group.traverse((child) => {
      child.geometry?.dispose();
      child.material?.dispose();
    });
  }
}
