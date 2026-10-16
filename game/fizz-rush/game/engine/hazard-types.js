import * as THREE from 'three';
import { B, CY, CO, SP, OC, TO, part, mergeParts } from './three-utils';

/**
 * Fizz Rush — hazard library
 * ---------------------------------------------------------------------------
 * Every obstacle in the game, authored from primitives and grouped by the way
 * it threatens the player. `block` tells the pattern director how a hazard
 * constrains a lane, which is what keeps generated runs fair:
 *
 *   low   — clear by jumping        high — clear by sliding
 *   full  — must change lane        gap  — a hole: jump it
 *   timed — cycles open and shut    dyn  — moves; time your pass
 *   safe  — never harms you (rails, gates, boost pads)
 */

const WOOD = '#a9743f';
const WOOD_DARK = '#7d5227';
const STONE = '#a8a396';
const STONE_DARK = '#7d786c';
const GOLD = '#f5c14b';
const NEON = '#ff4fd8';
const LAVA = '#ff6a2b';
const ICE = '#8fe8ff';
const LEAF = '#2f7c43';
const CRATE = '#c08a4a';
const HULL = '#f3f5f7';

const geoCache = new Map();
const buildCache = new Map();

function box(w, h, d, hex, pos, rot, scale) {
  return part(B(w, h, d), hex, pos, rot, scale);
}

/** Barrels, crates and stacked casino chips. */
function crate(side, height, color = CRATE) {
  return mergeParts([
    box(side, height, side, color, [0, height / 2, 0]),
    box(side * 1.03, height * 0.12, side * 1.03, WOOD_DARK, [0, height * 0.28, 0]),
    box(side * 1.03, height * 0.12, side * 1.03, WOOD_DARK, [0, height * 0.76, 0]),
  ]);
}

function barrel(color = '#3f7d5a') {
  return mergeParts([
    part(CY(0.55, 0.55, 1.3, 10), color, [0, 0.65, 0]),
    part(CY(0.6, 0.6, 0.12, 10), '#2c2c2c', [0, 0.4, 0]),
    part(CY(0.6, 0.6, 0.12, 10), '#2c2c2c', [0, 0.92, 0]),
    part(CY(0.5, 0.5, 0.08, 10), GOLD, [0, 1.32, 0]),
  ]);
}

function gateArch() {
  return mergeParts([
    box(0.3, 2.2, 0.3, WOOD_DARK, [-1.55, 1.35, 0]),
    box(0.3, 2.2, 0.3, WOOD_DARK, [1.55, 1.35, 0]),
    box(3.4, 0.7, 0.35, WOOD, [0, 2.8, 0]),
    box(3.4, 0.18, 0.4, GOLD, [0, 1.42, 0]),
  ]);
}

function tikiWall() {
  const parts = [];
  for (let i = 0; i < 3; i += 1) {
    parts.push(part(CY(0.42, 0.48, 2.6, 7), '#8f6a33', [(i - 1) * 0.8, 1.3, 0]));
    parts.push(box(0.9, 0.5, 0.7, '#6b4a2a', [(i - 1) * 0.8, 2.5, 0]));
  }
  return mergeParts(parts);
}

function stoneWall() {
  const parts = [];
  for (let r = 0; r < 4; r += 1) {
    for (let c = 0; c < 3; c += 1) {
      const offset = r % 2 ? 0.34 : 0;
      parts.push(box(0.82, 0.68, 0.6, r % 2 ? STONE : STONE_DARK, [(c - 1) * 0.86 + offset * 0.5, 0.36 + r * 0.7, 0]));
    }
  }
  return mergeParts(parts);
}

function chipTower() {
  const parts = [];
  for (let i = 0; i < 9; i += 1) {
    parts.push(part(CY(0.62 - i * 0.02, 0.62 - i * 0.02, 0.26, 12), i % 3 === 0 ? GOLD : i % 3 === 1 ? '#e04a4a' : '#2e6ef2', [0, 0.15 + i * 0.28, 0]));
  }
  return mergeParts(parts);
}

function slotMachine() {
  return mergeParts([
    box(2, 1.1, 1.2, '#8e2d4c', [0, 0.55, 0]),
    box(1.8, 1.4, 0.9, '#b0335c', [0, 1.8, 0]),
    box(1.5, 0.5, 0.1, '#20161c', [0, 1.9, 0.5]),
    box(2.2, 0.3, 1.4, GOLD, [0, 2.6, 0]),
  ]);
}

function column() {
  return mergeParts([
    box(1.2, 0.5, 1.2, STONE_DARK, [0, 0.25, 0]),
    part(CY(0.44, 0.5, 2.1, 10), STONE, [0, 1.55, 0]),
    box(1.4, 0.4, 1.4, STONE, [0, 2.8, 0]),
  ]);
}

function totem() {
  const parts = [box(1.5, 0.4, 1.5, STONE_DARK, [0, 0.2, 0])];
  for (let i = 0; i < 3; i += 1) {
    parts.push(box(1.1 - i * 0.12, 0.85, 1.1 - i * 0.12, i % 2 ? '#8f6a33' : '#7a5a2c', [0, 0.82 + i * 0.9, 0]));
  }
  return mergeParts(parts);
}

function coconuts() {
  const parts = [];
  for (let i = 0; i < 5; i += 1) {
    const a = (i / 5) * Math.PI * 2;
    parts.push(part(SP(0.42, 8), '#5c3f22', [Math.cos(a) * 0.34, 0.42 + (i % 2) * 0.5, Math.sin(a) * 0.2]));
  }
  return mergeParts(parts);
}

function log() {
  return mergeParts([
    part(CY(0.7, 0.7, 2.6, 10), WOOD, [0, 0.7, 0], [0, 0, Math.PI / 2]),
    part(CY(0.62, 0.62, 0.2, 10), WOOD_DARK, [-1.34, 0.7, 0], [0, 0, Math.PI / 2]),
    part(CY(0.62, 0.62, 0.2, 10), WOOD_DARK, [1.34, 0.7, 0], [0, 0, Math.PI / 2]),
  ]);
}

function boulder() {
  return mergeParts([
    part(OC(1.35), '#8c8a86', [0, 1.3, 0], [0.3, 0.5, 0.4], [1.05, 1, 1]),
    part(OC(0.75), '#6e6c68', [0.9, 2.1, 0.4], [0.7, 0.3, 0.2]),
  ]);
}

function dice() {
  const parts = [box(2.1, 2.1, 2.1, '#f2f4f7', [0, 1.05, 0])];
  [[-0.6, 0.5, 1.06], [0.6, 0.5, 1.06], [0, 1.6, 1.06]].forEach(([x, y, z]) => parts.push(box(0.3, 0.3, 0.08, '#1c1c22', [x, y, z])));
  return mergeParts(parts);
}

function roulette() {
  const parts = [
    part(CY(1.7, 1.7, 0.35, 16), '#3a1620', [0, 1.7, 0], [0, 0, Math.PI / 2]),
    part(CY(1.78, 1.78, 0.12, 16), GOLD, [0, 1.7, 0], [0, 0, Math.PI / 2]),
    part(CY(0.28, 0.28, 0.5, 8), GOLD, [0, 1.7, 0], [0, 0, Math.PI / 2]),
  ];
  return mergeParts(parts);
}

function vineLog() {
  return mergeParts([
    part(CY(0.55, 0.55, 4.6, 10), WOOD, [0, 0, 0], [0, 0, Math.PI / 2]),
    part(CY(0.1, 0.1, 5.6, 6), '#4a6b2f', [0, 4.2, 0]),
  ]);
}

function monkey() {
  return mergeParts([
    part(SP(0.38, 8), '#6b4a2a', [0, 0, 0]),
    part(SP(0.26, 8), '#8a6234', [0, 0.42, 0]),
    part(CO(0.16, 1.9, 6), '#4a6b2f', [0, 2.4, 0]),
    part(B(0.8, 0.14, 0.16), '#6b4a2a', [0, 0.1, 0]),
  ]);
}

function rotatorBar() {
  return mergeParts([
    part(CY(0.24, 0.24, 0.9, 8), WOOD_DARK, [0, 0.45, 0]),
    part(CY(0.3, 0.3, 5.6, 10), WOOD, [0, 0.8, 0], [0, 0, Math.PI / 2]),
    part(SP(0.4, 8), GOLD, [2.7, 0.8, 0]),
    part(SP(0.4, 8), GOLD, [-2.7, 0.8, 0]),
  ]);
}

function crab() {
  return mergeParts([
    part(SP(0.42, 8), '#e0563c', [0, 0.42, 0], [0, 0, 0], [1.3, 0.7, 1]),
    part(B(0.9, 0.12, 0.5), '#b83c26', [0, 0.2, 0]),
    box(0.16, 0.34, 0.16, '#e0563c', [-0.5, 0.55, 0.2]),
    box(0.16, 0.34, 0.16, '#e0563c', [0.5, 0.55, 0.2]),
  ]);
}

function jetSki() {
  return mergeParts([
    box(1.1, 0.5, 2.4, '#e8ecf0', [0, 0.42, 0]),
    box(0.9, 0.4, 0.9, '#2e6ef2', [0, 0.85, -0.2]),
    box(0.24, 0.5, 0.24, '#3a3a3a', [0, 0.95, 0.95]),
    box(1.3, 0.2, 0.6, '#1c1c22', [0, 0.28, -1.1]),
  ]);
}

function boatHull() {
  return mergeParts([
    box(2.6, 1.2, 6, HULL, [0, 0.7, 0]),
    box(1.6, 0.9, 2, '#c96a4a', [0, 1.6, 1]),
    part(CY(0.12, 0.12, 3.4, 6), WOOD_DARK, [0, 2.6, -1.4]),
  ]);
}

function cart() {
  return mergeParts([
    box(2.2, 0.9, 1.3, WOOD, [0, 1, 0]),
    part(CY(0.42, 0.42, 0.2, 8), WOOD_DARK, [-0.8, 0.42, 0], [Math.PI / 2, 0, 0]),
    part(CY(0.42, 0.42, 0.2, 8), WOOD_DARK, [0.8, 0.42, 0], [Math.PI / 2, 0, 0]),
    part(SP(0.5, 7), '#e0a52c', [-0.5, 1.7, 0]),
    part(SP(0.4, 7), LAVA, [0.6, 1.65, 0]),
  ]);
}

function container() {
  return mergeParts([
    box(2.4, 2.4, 2.4, '#2e7d64', [0, 1.2, 0]),
    box(2.44, 0.2, 2.44, '#1c5c48', [0, 0.5, 0]),
    box(2.44, 0.2, 2.44, '#1c5c48', [0, 1.9, 0]),
  ]);
}

function spikeTrap() {
  const parts = [box(2.2, 0.26, 2.2, '#3a3a3a', [0, 0.13, 0])];
  for (let i = -1; i <= 1; i += 1) {
    for (let j = -1; j <= 1; j += 1) {
      parts.push(part(CO(0.22, 1.5, 4), '#d8dde2', [i * 0.68, 1, j * 0.68]));
    }
  }
  return mergeParts(parts);
}

function waterSurge() {
  return mergeParts([
    part(SP(1.4, 10), '#8fe8ff', [0, 0.8, 0], [0, 0, 0], [0.9, 0.7, 2.1]),
    part(SP(1, 8), '#ffffff', [0, 1.5, 0], [0, 0, 0], [0.7, 0.5, 1.6]),
  ]);
}

function geyser() {
  return mergeParts([
    part(CY(0.7, 0.9, 3.2, 8), '#ffb15e', [0, 1.6, 0]),
    part(SP(0.9, 8), '#fff0c0', [0, 3.3, 0]),
  ]);
}

function dartTrap() {
  return mergeParts([
    box(1.5, 2.6, 1.5, STONE_DARK, [0, 1.3, 0]),
    box(1.7, 0.5, 1.7, STONE, [0, 2.6, 0]),
    part(CY(0.16, 0.16, 0.6, 6), '#201a16', [0, 1.7, 0.8], [Math.PI / 2, 0, 0]),
  ]);
}

function dart() {
  return mergeParts([
    part(CO(0.13, 0.7, 5), '#d8dde2', [0, 0, 0], [-Math.PI / 2, 0, 0]),
    part(CY(0.05, 0.05, 0.5, 5), '#8a5a2b', [0, 0, 0.35], [Math.PI / 2, 0, 0]),
  ]);
}

function cannonTower() {
  return mergeParts([
    part(CY(0.9, 1.05, 2.4, 8), '#4a4038', [0, 1.2, 0]),
    part(CY(0.34, 0.4, 1.6, 8), '#2c2c2c', [0, 2.6, 0.3], [Math.PI / 2.6, 0, 0]),
  ]);
}

function explosiveBarrel() {
  return mergeParts([
    barrel('#c0392b'),
    part(B(0.1, 0.5, 0.1), '#ffd76a', [0.4, 1.6, 0.2], [0, 0, 0.4]),
  ]);
}

function plankGap() {
  return mergeParts([
    box(2.3, 0.16, 1.2, WOOD, [0, 0.06, -1.8]),
    box(2.3, 0.16, 0.4, WOOD_DARK, [0, 0.06, 1.4]),
  ]);
}

function boostGate() {
  return mergeParts([
    box(0.32, 3, 0.32, '#2e6ef2', [-1.2, 1.5, 0]),
    box(0.32, 3, 0.32, '#2e6ef2', [1.2, 1.5, 0]),
    box(2.9, 0.5, 0.4, ICE, [0, 3.2, 0]),
  ]);
}

function grindRail() {
  const parts = [
    part(CY(0.09, 0.09, 20, 8), '#d8dde2', [0, 0, 0], [Math.PI / 2, 0, 0]),
  ];
  for (let i = -2; i <= 2; i += 1) {
    parts.push(part(CY(0.09, 0.09, 1.3, 6), '#8a8f96', [0, -0.7, i * 4.4]));
  }
  return mergeParts(parts);
}

function luckyGate() {
  return mergeParts([
    part(CY(0.22, 0.22, 4, 8), GOLD, [-1.3, 2, 0]),
    part(CY(0.22, 0.22, 4, 8), GOLD, [1.3, 2, 0]),
    part(TO(1.35, 0.2, 8), GOLD, [0, 3.3, 0], [Math.PI / 2, 0, 0]),
    part(SP(0.34, 8), '#fff0a8', [0, 4.4, 0]),
  ]);
}

function wagerGate() {
  return mergeParts([
    box(0.35, 3.8, 0.35, '#241a3a', [-1.3, 1.9, 0]),
    box(0.35, 3.8, 0.35, '#241a3a', [1.3, 1.9, 0]),
    box(3.1, 0.5, 0.5, '#241a3a', [0, 4, 0]),
    part(TO(0.8, 0.14, 8), NEON, [0, 2.6, 0]),
  ]);
}

function parrotFlock() {
  const parts = [];
  [-1.1, 0, 1.1].forEach((x, i) => {
    parts.push(part(SP(0.3, 7), i === 1 ? '#e0563c' : '#2e9e5b', [x, 0, 0], [0, 0, 0], [1.3, 0.9, 0.9]));
    parts.push(box(0.5, 0.12, 0.18, '#ffd76a', [x + 0.34, 0.05, 0]));
  });
  return mergeParts(parts);
}

function fallingMarker() {
  return mergeParts([part(TO(1.5, 0.08, 10), '#ff6b5e', [0, 0, 0], [Math.PI / 2, 0, 0])]);
}

function railSupport() {
  return mergeParts([part(TO(0.9, 0.06, 8), ICE, [0, 0, 0], [Math.PI / 2, 0, 0])]);
}

/** Definition table — sizes are full extents, `y` is the base height. */
export const HAZARD_TYPES = {
  /* ---------------------------------------------------------- jumpables */
  crate: { label: 'Cargo crate', category: 'dockyard', size: [1.4, 1.2, 1.4], y: 0, block: 'low', behavior: 'static', build: () => crate(1.4, 1.2) },
  crateTall: { label: 'Stacked crates', category: 'dockyard', size: [1.5, 1.35, 1.5], y: 0, block: 'low', behavior: 'static', build: () => crate(1.5, 1.35, '#a9743f') },
  sandbag: { label: 'Sandbags', category: 'beach', size: [1.8, 0.8, 1.2], y: 0, block: 'low', behavior: 'static', build: () => mergeParts([box(1.8, 0.4, 1.2, '#c9b184', [0, 0.2, 0]), box(1.5, 0.4, 1, '#b8a074', [0.12, 0.6, 0])]) },
  bambooLog: { label: 'Bamboo barrier', category: 'jungle', size: [2, 0.9, 0.5], y: 0, block: 'low', behavior: 'static', build: () => mergeParts([part(CY(0.22, 0.22, 2, 8), '#d0b464', [0, 0.5, 0], [0, 0, Math.PI / 2]), part(CY(0.22, 0.22, 2, 8), '#c2a558', [0, 0.85, 0], [0, 0, Math.PI / 2])]) },
  chipStack: { label: 'Chip stack', category: 'casino', size: [1.3, 1.15, 1.3], y: 0, block: 'low', behavior: 'static', build: () => chipTower() },
  barrel: { label: 'Barrel', category: 'dockyard', size: [1.2, 1.35, 1.2], y: 0, block: 'low', behavior: 'static', build: () => barrel() },

  /* ------------------------------------------------------------ slideables */
  gateArch: { label: 'Limbo gate', category: 'beach', size: [3.4, 2.2, 0.5], y: 1.35, block: 'high', behavior: 'static', build: () => gateArch() },
  parrotFlock: { label: 'Parrot flock', category: 'nature', size: [3.4, 1.7, 0.6], y: 1.5, block: 'high', behavior: 'lateral', params: { speed: 1.1, amplitude: 2.4, bobSpeed: 2.2 }, build: () => parrotFlock(), glow: () => mergeParts([part(B(3.4, 0.06, 0.06), '#ffd76a', [0, 0.2, 0])]) },

  /* ---------------------------------------------------------------- walls */
  tikiWall: { label: 'Tiki wall', category: 'jungle', size: [2.6, 2.6, 0.7], y: 0, block: 'full', behavior: 'static', build: () => tikiWall() },
  stoneWall: { label: 'Temple wall', category: 'temple', size: [2.7, 2.9, 0.7], y: 0, block: 'full', behavior: 'static', build: () => stoneWall() },
  slotMachine: { label: 'Slot machine', category: 'casino', size: [2.3, 2.85, 1.4], y: 0, block: 'full', behavior: 'static', build: () => slotMachine(), glow: () => mergeParts([box(1.4, 0.36, 0.08, GOLD, [0, 1.95, 0.52])]) },
  column: { label: 'Marble column', category: 'temple', size: [1.5, 3, 1.5], y: 0, block: 'full', behavior: 'static', build: () => column() },
  totem: { label: 'Totem statue', category: 'temple', size: [1.5, 3.2, 1.5], y: 0, block: 'full', behavior: 'static', build: () => totem(), glow: () => mergeParts([box(0.24, 0.16, 0.1, LAVA, [-0.28, 2.2, 0.6]), box(0.24, 0.16, 0.1, LAVA, [0.28, 2.2, 0.6])]) },

  /* --------------------------------------------------------------- rollers */
  coconuts: { label: 'Rolling coconuts', category: 'nature', size: [1.5, 1.1, 1.5], y: 0, block: 'low', behavior: 'roller', params: { speed: 4.5, spin: 7 }, build: () => coconuts() },
  logRoller: { label: 'Rolling log', category: 'jungle', size: [2.6, 1.4, 1.5], y: 0, block: 'low', behavior: 'roller', params: { speed: 6, spin: 6 }, build: () => log() },
  boulder: { label: 'Rolling boulder', category: 'nature', size: [2.7, 2.7, 2.7], y: 0, block: 'full', behavior: 'roller', params: { speed: 3.2, spin: 2.4 }, build: () => boulder() },
  dice: { label: 'Giant dice', category: 'casino', size: [2.1, 2.1, 2.1], y: 0, block: 'full', behavior: 'roller', params: { speed: 4, spin: 3, tumble: true }, build: () => dice() },
  roulette: { label: 'Roulette wheel', category: 'casino', size: [1.1, 3.5, 3.5], y: 0, block: 'full', behavior: 'roller', params: { speed: 3.4, spin: 1.4, axis: 'z' }, build: () => roulette() },

  /* ------------------------------------------------------------- swinging */
  vineLog: { label: 'Swinging log', category: 'jungle', size: [2.2, 2.2, 1.1], y: 0.4, block: 'dyn', behavior: 'pendulum', params: { speed: 1.5, amplitude: 3.6, drop: 0.5 }, build: () => vineLog() },
  monkeyVine: { label: 'Swinging monkey', category: 'nature', size: [1.3, 1.3, 1.3], y: 1.9, block: 'high', behavior: 'pendulum', params: { speed: 1.9, amplitude: 3.2, drop: 0.3 }, build: () => monkey() },

  /* ------------------------------------------------------------ rotating */
  tikiRotator: { label: 'Rotating tiki bar', category: 'jungle', size: [5.6, 1.15, 0.7], y: 0, block: 'low', behavior: 'rotator', params: { speed: 1.35 }, build: () => rotatorBar() },
  spikeSpinner: { label: 'Spike spinner', category: 'temple', size: [4.4, 1.6, 0.6], y: 0.4, block: 'full', behavior: 'rotator', params: { speed: 1.9 }, build: () => mergeParts([part(CY(0.24, 0.24, 4.4, 8), STONE_DARK, [0, 0, 0], [0, 0, Math.PI / 2]), ...[-2, 0, 2].map((x) => box(0.36, 0.9, 0.3, '#d8dde2', [x, 0.4, 0]))]) },

  /* ----------------------------------------------------------------- drift */
  crab: { label: 'Skittering crab', category: 'nature', size: [1.3, 0.9, 1.4], y: 0, block: 'low', behavior: 'lateral', params: { speed: 2.6, amplitude: 2.3 }, build: () => crab() },
  gliderBlock: { label: 'Gliding temple block', category: 'temple', size: [2.2, 2.6, 2.2], y: 0, block: 'full', behavior: 'lateral', params: { speed: 0.95, amplitude: 4.6 }, build: () => mergeParts([box(2.2, 2.6, 2.2, STONE_DARK, [0, 1.3, 0]), box(2.4, 0.3, 2.4, STONE, [0, 2.7, 0])]), glow: () => mergeParts([box(2.26, 0.1, 2.26, '#c7b98f', [0, 1.3, 0])]) },

  /* -------------------------------------------------------------- crossing */
  jetSki: { label: 'Jet ski', category: 'vehicle', size: [1.4, 1.3, 2.6], y: 0, block: 'low', behavior: 'crosser', params: { speed: 0.75, span: 8 }, build: () => jetSki() },
  boat: { label: 'Crossing boat', category: 'vehicle', size: [2.9, 1.9, 6], y: 0, block: 'full', behavior: 'crosser', params: { speed: 0.32, span: 11 }, build: () => boatHull() },
  cart: { label: 'Market cart', category: 'village', size: [2.4, 1.6, 1.5], y: 0, block: 'full', behavior: 'crosser', params: { speed: 0.55, span: 9 }, build: () => cart(), glow: () => mergeParts([part(SP(0.4, 7), '#ffd76a', [0.6, 1.65, 0])]) },

  /* -------------------------------------------------------------- falling */
  container: { label: 'Falling container', category: 'dockyard', size: [2.5, 2.5, 2.5], y: 0, block: 'full', behavior: 'faller', params: { trigger: 34, height: 15, rest: 0, marker: true }, build: () => container(), glow: () => fallingMarker() },
  fallingCrate: { label: 'Falling crate', category: 'dockyard', size: [1.5, 1.5, 1.5], y: 0, block: 'low', behavior: 'faller', params: { trigger: 26, height: 12, rest: 0, marker: true }, build: () => crate(1.5, 1.5, '#a9743f'), glow: () => fallingMarker() },

  /* -------------------------------------------------------------- cycling */
  spikeTrap: { label: 'Spike trap', category: 'temple', size: [2.2, 1.6, 2.2], y: -1.5, block: 'timed', behavior: 'cycler', params: { period: 2.6, duty: 0.42, up: 0, down: -1.5 }, build: () => spikeTrap() },
  lavaGeyser: { label: 'Lava geyser', category: 'volcano', size: [1.7, 3.2, 1.7], y: -3.2, block: 'timed', behavior: 'cycler', params: { period: 3.4, duty: 0.35, up: 0, down: -3.2 }, build: () => geyser(), glow: () => mergeParts([part(CY(0.9, 1.1, 3.2, 8), LAVA, [0, 1.6, 0])]) },
  waterSurge: { label: 'Wave surge', category: 'water', size: [2.6, 2.2, 5], y: -2.2, block: 'timed', behavior: 'cycler', params: { period: 3, duty: 0.3, up: 0, down: -2.2 }, build: () => waterSurge(), glow: () => mergeParts([part(SP(1.2, 9), ICE, [0, 0.8, 0], [0, 0, 0], [0.9, 0.6, 2])]) },

  /* ---------------------------------------------------------- projectiles */
  dartTrap: { label: 'Dart trap', category: 'temple', size: [1.6, 2.9, 1.6], y: 0, block: 'full', behavior: 'projectile', params: { interval: 1.7, speed: 26, kind: 'dart' }, build: () => dartTrap(), glow: () => mergeParts([part(CY(0.2, 0.2, 0.14, 8), '#ff6b5e', [0, 1.7, 0.86], [Math.PI / 2, 0, 0])]) },
  cannon: { label: 'Coconut cannon', category: 'village', size: [1.9, 3, 1.9], y: 0, block: 'full', behavior: 'projectile', params: { interval: 2.2, speed: 21, kind: 'coconut' }, build: () => cannonTower(), glow: () => mergeParts([part(SP(0.3, 7), LAVA, [0, 2.9, 0.5])]) },
  dart: { label: 'Dart', category: 'projectile', size: [0.4, 0.4, 0.9], y: 0.9, block: 'low', behavior: 'projectileFly', build: () => dart() },
  coconut: { label: 'Coconut', category: 'projectile', size: [0.7, 0.7, 0.7], y: 0.9, block: 'low', behavior: 'projectileFly', build: () => coconuts() },

  /* ------------------------------------------------------------ exploding */
  explosiveBarrel: { label: 'Explosive barrel', category: 'casino', size: [1.2, 1.5, 1.2], y: 0, block: 'low', behavior: 'exploder', params: { radius: 4.4, damageRadius: 3.2 }, build: () => explosiveBarrel(), glow: () => mergeParts([part(SP(0.2, 6), '#ffd76a', [0, 1.55, 0])]) },
  explosiveCrate: { label: 'Explosive crate', category: 'dockyard', size: [1.4, 1.4, 1.4], y: 0, block: 'low', behavior: 'exploder', params: { radius: 4, damageRadius: 3 }, build: () => crate(1.4, 1.4, '#c0392b'), glow: () => mergeParts([part(B(0.5, 0.16, 0.5), '#ffb15e', [0, 1.45, 0])]) },

  /* ------------------------------------------------------------------ gap */
  plankGap: { label: 'Collapsing planks', category: 'dockyard', size: [2.4, 0.4, 4.4], y: -0.3, block: 'gap', behavior: 'gap', params: { collapseDelay: 0.06 }, build: () => plankGap() },

  /* -------------------------------------------------------------- special */
  boostGate: { label: 'Boost gate', category: 'casino', size: [2.6, 3.3, 0.4], y: 0, block: 'safe', behavior: 'gate', params: { kind: 'boost' }, lethal: false, build: () => boostGate(), glow: () => mergeParts([box(2.9, 0.4, 0.3, ICE, [0, 3.2, 0])]) },
  luckyGate: { label: 'Lucky gate', category: 'casino', size: [2.6, 4.6, 0.5], y: 0, block: 'safe', behavior: 'gate', params: { kind: 'lucky' }, lethal: false, build: () => luckyGate(), glow: () => mergeParts([part(TO(1.35, 0.2, 10), GOLD, [0, 3.3, 0], [Math.PI / 2, 0, 0]), part(SP(0.34, 8), '#fff0a8', [0, 4.4, 0])]) },
  wagerGate: { label: 'High roller gate', category: 'casino', size: [2.6, 4.4, 0.5], y: 0, block: 'safe', behavior: 'gate', params: { kind: 'wager' }, lethal: false, build: () => wagerGate(), glow: () => mergeParts([part(TO(0.8, 0.14, 10), NEON, [0, 2.6, 0])]) },
  grindRail: { label: 'Grind rail', category: 'dockyard', size: [0.6, 0.4, 20], y: 1.35, block: 'safe', behavior: 'rail', lethal: false, build: () => grindRail(), glow: () => mergeParts([part(CY(0.1, 0.1, 20, 8), ICE, [0, 0.02, 0], [Math.PI / 2, 0, 0])]) },
  zipRail: { label: 'Zipline', category: 'aerial', size: [0.6, 0.4, 24], y: 2.6, block: 'safe', behavior: 'rail', lethal: false, build: () => grindRail(), glow: () => railSupport() },
};

export function getHazardGeometry(typeId) {
  if (!buildCache.has(typeId)) {
    const def = HAZARD_TYPES[typeId];
    if (!def) return { body: null, glow: null };
    buildCache.set(typeId, { body: def.build(), glow: def.glow ? def.glow() : null });
  }
  return buildCache.get(typeId);
}

export function disposeHazardGeometry() {
  buildCache.forEach((entry) => {
    entry.body?.dispose();
    entry.glow?.dispose();
  });
  buildCache.clear();
  geoCache.clear();
}

export default HAZARD_TYPES;