import * as THREE from 'three';
import { CY, OC, B, part, mergeParts } from './three-utils';

/**
 * Fizz Rush — collectibles
 * ---------------------------------------------------------------------------
 * Coins, gems and treasure chests live in fixed-size pools drawn as instanced
 * meshes. Collection is a proximity test against the player's collider: an item
 * is removed from the world the instant it is taken, so nothing can ever become
 * attached to the player or be collected twice (no duplication, no farming).
 */

const COIN_CAP = 340;
const GEM_CAP = 40;
const CHEST_CAP = 6;

function coinGeometry() {
  const g = new THREE.CylinderGeometry(0.44, 0.44, 0.11, 12);
  g.rotateX(Math.PI / 2);
  return g;
}

export class PickupSystem {
  constructor(scene, preset = {}) {
    this.scene = scene;
    const detail = preset.waterDetail ?? 2;

    this.coinMaterial = new THREE.MeshStandardMaterial({
      color: '#f5c14b',
      emissive: '#7a4f00',
      emissiveIntensity: 0.55,
      metalness: 0.95,
      roughness: 0.22,
    });
    this.gemMaterial = new THREE.MeshStandardMaterial({
      color: '#7be8ff',
      emissive: '#1f7fae',
      emissiveIntensity: 0.9,
      metalness: 0.6,
      roughness: 0.15,
    });

    this.coins = new THREE.InstancedMesh(coinGeometry(), this.coinMaterial, COIN_CAP);
    this.coins.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.gems = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.55, 0), this.gemMaterial, GEM_CAP);
    this.gems.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.coins.frustumCulled = false;
    this.gems.frustumCulled = false;
    scene.add(this.coins, this.gems);

    this.coinData = Array.from({ length: COIN_CAP }, () => ({ active: false, x: 0, y: 0, z: 0, phase: 0, drift: 0 }));
    this.gemData = Array.from({ length: GEM_CAP }, () => ({ active: false, x: 0, y: 0, z: 0, phase: 0, drift: 0 }));
    this.coinCursor = 0;
    this.gemCursor = 0;

    // Treasure chests are rare, so a tiny mesh pool is plenty.
    const chestGeo = mergeParts([
      part(B(1.5, 1.05, 1.1), '#8a5a2b', [0, 0.52, 0]),
      part(B(1.6, 0.35, 1.2), '#c9a227', [0, 1.1, 0]),
      part(B(1.66, 0.26, 0.3), '#f5c14b', [0, 0.62, 0.56]),
    ]);
    const chestMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.35 });
    this.chestMesh = new THREE.InstancedMesh(chestGeo, chestMat, CHEST_CAP);
    this.chestMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(this.chestMesh);
    this.chestData = Array.from({ length: CHEST_CAP }, () => ({ active: false, x: 0, y: 0, z: 0, phase: 0 }));

    this.time = 0;
    this.magnetRadius = 0;
    this.capacityScale = Math.max(0.4, Math.min(1.6, preset.props ?? 1));
    this.maxCoins = Math.floor(COIN_CAP * this.capacityScale);
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._e = new THREE.Euler();
    this._v = new THREE.Vector3();
    this._s = new THREE.Vector3();
    this.sync();
  }

  /* ----------------------------------------------------------- spawning */

  spawnCoin(x, y, z) {
    for (let n = 0; n < COIN_CAP; n += 1) {
      const i = (this.coinCursor + n) % COIN_CAP;
      if (!this.coinData[i].active) {
        const c = this.coinData[i];
        c.active = true;
        c.x = x;
        c.y = y;
        c.z = z;
        c.phase = Math.random() * Math.PI * 2;
        c.drift = 0;
        this.coinCursor = (i + 1) % COIN_CAP;
        return true;
      }
    }
    return false;
  }

  spawnGem(x, y, z) {
    for (let n = 0; n < GEM_CAP; n += 1) {
      const i = (this.gemCursor + n) % GEM_CAP;
      if (!this.gemData[i].active) {
        const g = this.gemData[i];
        g.active = true;
        g.x = x;
        g.y = y;
        g.z = z;
        g.phase = Math.random() * Math.PI * 2;
        g.drift = 0;
        this.gemCursor = (i + 1) % GEM_CAP;
        return true;
      }
    }
    return false;
  }

  spawnChest(x, y, z) {
    const empty = this.chestData.find((c) => !c.active);
    if (!empty) return false;
    empty.active = true;
    empty.x = x;
    empty.y = y;
    empty.z = z;
    empty.phase = Math.random() * Math.PI * 2;
    return true;
  }

  /** Straight run of coins down one lane. */
  spawnLine(laneX, zStart, count, { spacing = 3.2, y = 1.05 } = {}) {
    for (let i = 0; i < count; i += 1) this.spawnCoin(laneX, y, zStart + i * spacing);
  }

  /** Coin arc shaped like the jump the player will make to collect it. */
  spawnArc(laneX, zStart, count, { spacing = 3, height = 2.2 } = {}) {
    for (let i = 0; i < count; i += 1) {
      const t = count === 1 ? 0.5 : i / (count - 1);
      const lift = Math.sin(t * Math.PI) * height;
      this.spawnCoin(laneX, 1.0 + lift, zStart + i * spacing);
    }
  }

  /** Ring of coins hovering over a grind rail. */
  spawnRing(laneX, zStart, count, length, y = 2.1) {
    for (let i = 0; i < count; i += 1) {
      const t = count === 1 ? 0.5 : i / (count - 1);
      this.spawnCoin(laneX, y + Math.sin(t * Math.PI) * 0.35, zStart + t * length);
    }
  }

  /* ------------------------------------------------------------ runtime */

  clear() {
    this.coinData.forEach((c) => {
      c.active = false;
    });
    this.gemData.forEach((g) => {
      g.active = false;
    });
    this.chestData.forEach((c) => {
      c.active = false;
    });
    this.magnetRadius = 0;
    this.sync();
  }

  setMagnet(radius) {
    this.magnetRadius = Math.max(0, radius);
  }

  /**
   * @param player {{x:number,y:number,z:number,hw:number,hh:number,hd:number}}
   * @param onCollect {(type:string, x:number,y:number,z:number)=>void}
   */
  update(dt, player, onCollect) {
    this.time += dt;
    const magnet = this.magnetRadius;
    const takeCoin = (c, i) => {
      c.active = false;
      onCollect?.('coin', c.x, c.y, c.z);
    };
    const takeGem = (g) => {
      g.active = false;
      onCollect?.('gem', g.x, g.y, g.z);
    };

    for (let i = 0; i < COIN_CAP; i += 1) {
      const c = this.coinData[i];
      if (!c.active) continue;
      // Retire anything the player has left behind so the pool always recycles.
      if (c.z < player.z - 45) {
        c.active = false;
        continue;
      }
      if (magnet > 0) {
        const dx = player.x - c.x;
        const dz = player.z - c.z;
        const dy = player.y + 1 - c.y;
        const dist = Math.hypot(dx, dy, dz);
        if (dist < magnet) {
          const pull = (1 - dist / magnet) * 14 * dt;
          c.x += (dx / Math.max(0.001, dist)) * pull;
          c.y += (dy / Math.max(0.001, dist)) * pull;
          c.z += (dz / Math.max(0.001, dist)) * pull;
        }
      }
      if (this.hits(c, player)) takeCoin(c, i);
    }

    for (let i = 0; i < GEM_CAP; i += 1) {
      const g = this.gemData[i];
      if (!g.active) continue;
      if (g.z < player.z - 45) {
        g.active = false;
        continue;
      }
      if (this.hits(g, player)) takeGem(g);
    }

    for (let i = 0; i < this.chestData.length; i += 1) {
      const c = this.chestData[i];
      if (!c.active) continue;
      if (c.z < player.z - 45) {
        c.active = false;
        continue;
      }
      if (this.hits(c, player, 0.4)) c.active = false;
    }

    this.sync();
  }

  hits(item, player, expand = 0) {
    const hw = (player.hw || 0.5) + 0.55 + expand;
    const hh = (player.hh || 1) / 2 + 0.6 + expand;
    const hd = (player.hd || 0.5) + 0.6 + expand;
    const cy = player.y + (player.hh || 1) / 2;
    if (Math.abs(item.z - player.z) > hd) return false;
    if (Math.abs(item.x - player.x) > hw) return false;
    return Math.abs(item.y - cy) <= hh + 0.35;
  }

  /** Push the pools into their instanced matrices. */
  sync() {
    let activeCoins = 0;
    let activeGems = 0;
    let activeChests = 0;

    for (let i = 0; i < COIN_CAP; i += 1) {
      const c = this.coinData[i];
      if (c.active && activeCoins < this.maxCoins) {
        const bob = Math.sin(this.time * 3 + c.phase) * 0.14;
        this._q.setFromEuler(this._e.set(0, this.time * 2.6 + c.phase, 0));
        this._m.compose(this._v.set(c.x, c.y + bob, c.z), this._q, this._s.set(1, 1, 1));
        activeCoins += 1;
      } else {
        this._m.makeScale(0.0001, 0.0001, 0.0001);
      }
      this.coins.setMatrixAt(i, this._m);
    }

    for (let i = 0; i < GEM_CAP; i += 1) {
      const g = this.gemData[i];
      if (g.active) {
        const bob = Math.sin(this.time * 2.2 + g.phase) * 0.22;
        this._q.setFromEuler(this._e.set(0, this.time * 1.6 + g.phase, this.time * 0.7));
        this._m.compose(this._v.set(g.x, g.y + bob, g.z), this._q, this._s.set(1, 1, 1));
        activeGems += 1;
      } else {
        this._m.makeScale(0.0001, 0.0001, 0.0001);
      }
      this.gems.setMatrixAt(i, this._m);
    }

    for (let i = 0; i < this.chestData.length; i += 1) {
      const c = this.chestData[i];
      if (c.active) {
        const bob = Math.sin(this.time * 1.8 + c.phase) * 0.1;
        this._q.setFromEuler(this._e.set(0, Math.sin(this.time * 0.5 + c.phase) * 0.2, 0));
        this._m.compose(this._v.set(c.x, c.y + bob, c.z), this._q, this._s.set(1, 1, 1));
        activeChests += 1;
      } else {
        this._m.makeScale(0.0001, 0.0001, 0.0001);
      }
      this.chestMesh.setMatrixAt(i, this._m);
    }

    this.coins.instanceMatrix.needsUpdate = true;
    this.gems.instanceMatrix.needsUpdate = true;
    this.chestMesh.instanceMatrix.needsUpdate = true;
    this.coins.count = COIN_CAP;
    this.gems.count = GEM_CAP;
    this.chestMesh.count = this.chestData.length;
    this.activeCoins = activeCoins;
    this.activeGems = activeGems;
    this.activeChests = activeChests;
  }

  dispose() {
    [this.coins, this.gems, this.chestMesh].forEach((mesh) => {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
    });
    this.coinMaterial.dispose();
    this.gemMaterial.dispose();
  }
}

export default PickupSystem;