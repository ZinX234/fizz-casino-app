import { B, CY, CO, SP, OC, PL, part, mergeParts } from './three-utils';

/**
 * Fizz Rush — tropical prop library
 * ---------------------------------------------------------------------------
 * Every prop in the world is authored here from primitives and merged into a
 * single vertex-coloured geometry, so a whole palm grove is one draw call.
 * Props that glow return a second geometry rendered with an unlit material.
 *
 * place:  'side'  — flanking the causeway
 *         'over'  — spanning the road overhead
 *         'far'   — distant silhouette scenery
 *         'sky'   — high above the island
 */

const PALM_TRUNK = '#8d6134';
const PALM_LEAF = '#2f7c43';
const PALM_LEAF_DARK = '#256336';
const SAND = '#e6d5a8';
const ROCK = '#8c8a86';
const STONE = '#a8a396';
const STONE_DARK = '#7d786c';
const WOOD = '#a9743f';
const WOOD_DARK = '#7d5227';
const HUT_ROOF = '#c9743a';
const NEON = '#ff4fd8';
const GOLD = '#f5c14b';
const FLAME = '#ff9a3c';
const LAVA = '#ff6a2b';
const ICE = '#8fe8ff';
const LEAF = '#3f9c52';

function palmTreeParts(scale = 1, lean = 0.16) {
  const body = [
    part(CY(0.16 * scale, 0.28 * scale, 5.4 * scale, 7), PALM_TRUNK, [0, 2.7 * scale, 0], [0, 0, lean]),
    part(CY(0.14 * scale, 0.17 * scale, 4.4 * scale, 6), PALM_TRUNK, [lean * 3.2 * scale, 7.1 * scale, 0], [0, 0, lean * 1.6]),
    part(SP(0.5 * scale, 8), PALM_LEAF_DARK, [lean * 5.4 * scale, 9.1 * scale, 0], [0, 0, 0], [1, 0.6, 1]),
  ];
  for (let i = 0; i < 7; i += 1) {
    const angle = (i / 7) * Math.PI * 2;
    body.push(
      part(
        CO(0.5 * scale, 2.7 * scale, 5),
        i % 2 ? PALM_LEAF : PALM_LEAF_DARK,
        [lean * 5.4 * scale + Math.cos(angle) * 1.15 * scale, 9.15 * scale, Math.sin(angle) * 1.15 * scale],
        [Math.sin(angle) * 1.15, 0, -Math.cos(angle) * 1.15],
        [1, 1, 0.42]
      )
    );
  }
  body.push(
    part(SP(0.17 * scale, 6), '#5c3f22', [lean * 5.4 * scale + 0.3, 8.6 * scale, 0.2]),
    part(SP(0.17 * scale, 6), '#5c3f22', [lean * 5.4 * scale - 0.28, 8.58 * scale, -0.25])
  );
  return body;
}

function palmTree(scale = 1, lean = 0.16, lit = false) {
  const body = palmTreeParts(scale, lean);
  const glow = lit
    ? [part(SP(0.16, 6), GOLD, [lean * 5.4 * scale, 8.1 * scale, 0.5]), part(SP(0.14, 6), GOLD, [lean * 5.4 * scale - 0.5, 8.0 * scale, -0.4])]
    : null;
  return { body: mergeParts(body), glow: glow ? mergeParts(glow) : null };
}

function hut(scale = 1) {
  const body = [
    part(B(4.6 * scale, 0.35 * scale, 4.6 * scale), STONE_DARK, [0, 0.18 * scale, 0]),
    part(CY(2.3 * scale, 2.4 * scale, 3 * scale, 8), WOOD, [0, 1.85 * scale, 0]),
    part(CO(3.4 * scale, 2.5 * scale, 8), HUT_ROOF, [0, 4.5 * scale, 0]),
    part(B(1.2 * scale, 2 * scale, 0.25 * scale), WOOD_DARK, [0, 1.3 * scale, 2.3 * scale]),
    part(B(1.5 * scale, 0.2 * scale, 1.5 * scale), WOOD_DARK, [0, 0.4 * scale, 2.9 * scale]),
  ];
  return { body: mergeParts(body), glow: null };
}

function tiki(scale = 1) {
  const body = [
    part(CY(0.9 * scale, 1.1 * scale, 4.2 * scale, 7), WOOD_DARK, [0, 2.1 * scale, 0]),
    part(B(1.7 * scale, 1.9 * scale, 1.7 * scale), '#8f6a33', [0, 5 * scale, 0]),
    part(CO(0.55 * scale, 0.9 * scale, 5), HUT_ROOF, [0, 6.4 * scale, 0]),
    part(B(1.9 * scale, 0.4 * scale, 1.9 * scale), WOOD_DARK, [0, 3.3 * scale, 0]),
    part(B(2.1 * scale, 0.5 * scale, 0.5 * scale), HUT_ROOF, [0, 6.1 * scale, 0]),
  ];
  const glow = [part(B(0.3 * scale, 0.24 * scale, 0.12 * scale), FLAME, [-0.35 * scale, 5.3 * scale, 0.86 * scale]),
    part(B(0.3 * scale, 0.24 * scale, 0.12 * scale), FLAME, [0.35 * scale, 5.3 * scale, 0.86 * scale])];
  return { body: mergeParts(body), glow: mergeParts(glow) };
}

function temple(scale = 1) {
  const body = [];
  for (let i = 0; i < 5; i += 1) {
    const w = (9 - i * 1.3) * scale;
    body.push(part(B(w, 0.9 * scale, w * 0.7), i % 2 ? STONE : STONE_DARK, [0, (0.45 + i * 0.9) * scale, 0]));
  }
  body.push(
    part(B(5.4 * scale, 3.6 * scale, 4 * scale), STONE, [0, 6.9 * scale, 0]),
    part(CO(4 * scale, 3 * scale, 4), STONE_DARK, [0, 10 * scale, 0], [0, Math.PI / 4, 0]),
    part(CY(0.6 * scale, 0.6 * scale, 10 * scale, 6), STONE_DARK, [-3.4 * scale, 5 * scale, 2.6 * scale]),
    part(CY(0.6 * scale, 0.6 * scale, 10 * scale, 6), STONE_DARK, [3.4 * scale, 5 * scale, 2.6 * scale])
  );
  return { body: mergeParts(body), glow: null };
}

function statue(scale = 1) {
  const body = [
    part(B(2.2 * scale, 0.8 * scale, 2.2 * scale), STONE_DARK, [0, 0.4 * scale, 0]),
    part(CY(0.85 * scale, 1.05 * scale, 4.6 * scale, 7), STONE, [0, 3.1 * scale, 0]),
    part(SP(1 * scale, 8), STONE, [0, 6 * scale, 0]),
    part(B(2.6 * scale, 0.45 * scale, 0.5 * scale), STONE, [0, 4.4 * scale, 0]),
    part(CO(0.9 * scale, 1.1 * scale, 5), STONE_DARK, [0, 7.4 * scale, 0]),
  ];
  const glow = [part(B(0.34 * scale, 0.2 * scale, 0.1 * scale), '#ffd76a', [-0.32 * scale, 6.2 * scale, 0.9 * scale]),
    part(B(0.34 * scale, 0.2 * scale, 0.1 * scale), '#ffd76a', [0.32 * scale, 6.2 * scale, 0.9 * scale])];
  return { body: mergeParts(body), glow: mergeParts(glow) };
}

function rock(scale = 1) {
  const body = [
    part(OC(1.7 * scale), ROCK, [0, 1.1 * scale, 0], [0.3, 0.6, 0.2], [1.2, 0.85, 1.1]),
    part(OC(1.1 * scale), '#6e6c68', [1.2 * scale, 0.6 * scale, 0.6 * scale], [0.6, 1.1, 0], [1, 0.8, 1]),
  ];
  return { body: mergeParts(body), glow: null };
}

function cliff(scale = 1) {
  const body = [
    part(CO(7 * scale, 16 * scale, 6), STONE_DARK, [0, 8 * scale, 0], [0, 0, 0.05], [1, 1, 0.9]),
    part(CO(4.6 * scale, 12 * scale, 6), ROCK, [2.6 * scale, 6 * scale, 1.4 * scale], [0, 0.5, -0.08]),
    part(CO(3 * scale, 9 * scale, 5), LEAF, [-2.2 * scale, 12 * scale, -1 * scale], [0, 0.9, 0.12]),
  ];
  return { body: mergeParts(body), glow: null };
}

function fern(scale = 1) {
  const body = [];
  for (let i = 0; i < 6; i += 1) {
    const a = (i / 6) * Math.PI * 2;
    body.push(part(CO(0.34 * scale, 1.7 * scale, 4), i % 2 ? LEAF : '#2f7c43', [Math.cos(a) * 0.35 * scale, 0.8 * scale, Math.sin(a) * 0.35 * scale], [Math.sin(a) * 0.7, 0, -Math.cos(a) * 0.7], [1, 1, 0.4]));
  }
  return { body: mergeParts(body), glow: null };
}

function parasol(scale = 1) {
  const body = [
    part(CY(0.12 * scale, 0.12 * scale, 3 * scale, 6), WOOD_DARK, [0, 1.5 * scale, 0]),
    part(CO(2.4 * scale, 0.9 * scale, 10), '#ff6f61', [0, 3.3 * scale, 0]),
    part(B(2 * scale, 0.4 * scale, 0.9 * scale), SAND, [1.4 * scale, 0.4 * scale, 2.6 * scale]),
    part(B(0.5 * scale, 0.7 * scale, 0.9 * scale), SAND, [2.1 * scale, 0.7 * scale, 2.6 * scale], [0.5, 0, 0]),
  ];
  return { body: mergeParts(body), glow: null };
}

function dockPier(scale = 1) {
  const body = [
    part(B(6 * scale, 0.3 * scale, 14 * scale), WOOD, [0, 0.5 * scale, 0]),
    part(B(0.4 * scale, 2.2 * scale, 0.4 * scale), WOOD_DARK, [-2.4 * scale, 0, -6 * scale]),
    part(B(0.4 * scale, 2.2 * scale, 0.4 * scale), WOOD_DARK, [2.4 * scale, 0, -6 * scale]),
    part(B(0.4 * scale, 2.2 * scale, 0.4 * scale), WOOD_DARK, [-2.4 * scale, 0, 6 * scale]),
    part(B(0.4 * scale, 2.2 * scale, 0.4 * scale), WOOD_DARK, [2.4 * scale, 0, 6 * scale]),
  ];
  for (let i = -3; i <= 3; i += 1) {
    body.push(part(B(6 * scale, 0.08 * scale, 0.2 * scale), WOOD_DARK, [0, 0.68 * scale, i * 2 * scale]));
  }
  return { body: mergeParts(body), glow: null };
}

function boat(scale = 1) {
  const body = [
    part(B(3 * scale, 1.1 * scale, 8 * scale), '#e8e2d4', [0, 0.6 * scale, 0]),
    part(B(2.1 * scale, 0.7 * scale, 3 * scale), '#c96a4a', [0, 1.4 * scale, 1.4 * scale]),
    part(CY(0.1 * scale, 0.1 * scale, 5 * scale, 6), WOOD_DARK, [0, 3.4 * scale, -1 * scale]),
    part(PL(2 * scale, 1.6 * scale), '#ffffff', [0, 3.9 * scale, -1.02 * scale]),
  ];
  return { body: mergeParts(body), glow: null };
}

function yacht(scale = 1) {
  const body = [
    part(B(4.4 * scale, 1.6 * scale, 13 * scale), '#f3f5f7', [0, 0.9 * scale, 0]),
    part(B(3.8 * scale, 1.5 * scale, 6 * scale), '#e2e8ec', [0, 2.4 * scale, 1 * scale]),
    part(B(2.6 * scale, 1.4 * scale, 3.4 * scale), '#d5dde2', [0, 3.8 * scale, -1.6 * scale]),
    part(CY(0.1 * scale, 0.1 * scale, 3 * scale, 6), '#ffffff', [0, 5.5 * scale, -1.6 * scale]),
  ];
  const glow = [part(B(3.9 * scale, 0.22 * scale, 6.2 * scale), ICE, [0, 3.25 * scale, 1 * scale])];
  return { body: mergeParts(body), glow: mergeParts(glow) };
}

function buoy(scale = 1) {
  const body = [
    part(SP(0.9 * scale, 8), '#ff5b4a', [0, 0.9 * scale, 0], [0, 0, 0], [1, 1.15, 1]),
    part(CY(0.1 * scale, 0.1 * scale, 1.6 * scale, 6), '#e8e2d4', [0, 2 * scale, 0]),
    part(B(0.6 * scale, 0.6 * scale, 0.6 * scale), '#ffd76a', [0, 2.9 * scale, 0]),
  ];
  const glow = [part(SP(0.32 * scale, 6), '#fff0a8', [0, 2.9 * scale, 0])];
  return { body: mergeParts(body), glow: mergeParts(glow) };
}

function crateStack(scale = 1) {
  const body = [];
  const sizes = [1.5, 1.25, 1.05];
  let y = 0;
  sizes.forEach((s, i) => {
    body.push(
      part(B(s * scale, s * scale, s * scale), i % 2 ? '#c08a4a' : '#a9743f', [i === 1 ? 0.2 : 0, y + (s * scale) / 2, i === 2 ? -0.2 : 0], [0, i * 0.4, 0]),
      part(B(s * scale * 1.02, 0.1 * scale, s * scale * 1.02), WOOD_DARK, [i === 1 ? 0.2 : 0, y + (s * scale) / 2, i === 2 ? -0.2 : 0], [0, i * 0.4, 0])
    );
    y += s * scale;
  });
  return { body: mergeParts(body), glow: null };
}

function crane(scale = 1) {
  const body = [
    part(B(1.4 * scale, 14 * scale, 1.4 * scale), '#c9a227', [0, 7 * scale, 0]),
    part(B(0.5 * scale, 0.5 * scale, 11 * scale), '#c9a227', [0, 13.6 * scale, 3.4 * scale]),
    part(B(0.5 * scale, 2.4 * scale, 0.5 * scale), '#8a8f96', [0, 12.2 * scale, 8 * scale]),
    part(B(1.8 * scale, 1.4 * scale, 1.8 * scale), '#6a7076', [0, 0.7 * scale, 0]),
  ];
  const glow = [part(B(1.5 * scale, 0.2 * scale, 1.5 * scale), FLAME, [0, 14.3 * scale, 0])];
  return { body: mergeParts(body), glow: mergeParts(glow) };
}

function lantern(scale = 1) {
  const body = [
    part(CY(0.1 * scale, 0.14 * scale, 3.4 * scale, 6), WOOD_DARK, [0, 1.7 * scale, 0]),
    part(SP(0.05, 5), WOOD_DARK, [0, 3.4 * scale, 0]),
    part(CY(0.42 * scale, 0.38 * scale, 0.55 * scale, 6), '#3a2a1a', [0, 3.6 * scale, 0]),
  ];
  const glow = [part(SP(0.34 * scale, 7), '#ffd07a', [0, 3.6 * scale, 0], [0, 0, 0], [1, 1.3, 1])];
  return { body: mergeParts(body), glow: mergeParts(glow) };
}

function brazier(scale = 1) {
  const body = [
    part(CY(0.5 * scale, 0.85 * scale, 1.6 * scale, 7), '#4a4038', [0, 0.8 * scale, 0]),
    part(SP(0.75 * scale, 8), '#3a332c', [0, 1.7 * scale, 0], [0, 0, 0], [1, 0.5, 1]),
  ];
  const glow = [
    part(SP(0.55 * scale, 6), LAVA, [0, 1.9 * scale, 0], [0, 0, 0], [1, 1.5, 1]),
    part(SP(0.3 * scale, 6), '#ffe08a', [0, 2.5 * scale, 0], [0, 0, 0], [1, 1.6, 1]),
  ];
  return { body: mergeParts(body), glow: mergeParts(glow) };
}

function lavaRock(scale = 1) {
  const body = [part(OC(1.9 * scale), '#2b2320', [0, 1.1 * scale, 0], [0.4, 0.4, 0.2], [1.15, 0.8, 1.05])];
  const glow = [part(B(1.9 * scale, 0.12 * scale, 0.22 * scale), LAVA, [0, 1.5 * scale, 0.6 * scale], [0, 0.3, 0]),
    part(B(1.4 * scale, 0.12 * scale, 0.2 * scale), LAVA, [0.3 * scale, 0.7 * scale, -0.9 * scale], [0.2, 1.1, 0])];
  return { body: mergeParts(body), glow: mergeParts(glow) };
}

function volcano(scale = 1) {
  const body = [
    part(CO(16 * scale, 34 * scale, 8), '#3a2c2a', [0, 17 * scale, 0], [0, 0, 0.02], [1, 1, 0.85]),
    part(CO(9 * scale, 22 * scale, 7), '#4a3733', [4 * scale, 11 * scale, 3 * scale], [0, 0.6, 0.06]),
  ];
  const glow = [part(CY(3.4 * scale, 4.6 * scale, 1.2 * scale, 8), LAVA, [0, 34 * scale, 0]),
    part(SP(2.4 * scale, 6), '#ffbf6a', [0, 35.6 * scale, 0])];
  return { body: mergeParts(body), glow: mergeParts(glow) };
}

function crystal(scale = 1) {
  const body = [part(OC(1.3 * scale), '#5fd8e8', [0, 1.6 * scale, 0], [0, 0.4, 0.1], [0.7, 2.1, 0.7]),
    part(OC(0.9 * scale), '#8ef0ff', [0.8 * scale, 0.9 * scale, 0.4 * scale], [0.2, 0.9, 0.3], [0.6, 1.5, 0.6])];
  const glow = [part(SP(0.7 * scale, 7), '#bfF8ff', [0, 2.2 * scale, 0])];
  return { body: mergeParts(body), glow: mergeParts(glow) };
}

function floatingIsle(scale = 1) {
  const body = [
    part(CO(9 * scale, 12 * scale, 9), '#4a3a2c', [0, -4 * scale, 0], [Math.PI, 0, 0]),
    part(CY(9 * scale, 8.4 * scale, 1.6 * scale, 10), '#5f8f4f', [0, 2 * scale, 0]),
    part(CO(3 * scale, 6 * scale, 6), '#2f7c43', [2 * scale, 5 * scale, 0]),
    part(CO(2.4 * scale, 3.4 * scale, 6), LEAF, [-1 * scale, 5 * scale, 3 * scale]),
  ];
  const glow = [part(B(9 * scale, 0.4 * scale, 9 * scale), ICE, [0, 2.9 * scale, 0]),
    part(B(4 * scale, 0.3 * scale, 4 * scale), ICE, [0, -9 * scale, 0])];
  return { body: mergeParts(body), glow: mergeParts(glow) };
}

function casinoTower(scale = 1) {
  const body = [
    part(B(9 * scale, 30 * scale, 9 * scale), '#241b3f', [0, 15 * scale, 0]),
    part(B(10 * scale, 1.6 * scale, 10 * scale), '#3a2a63', [0, 30.6 * scale, 0]),
    part(CO(4.6 * scale, 6 * scale, 4), GOLD, [0, 34 * scale, 0], [0, Math.PI / 4, 0]),
    part(CY(0.6 * scale, 0.6 * scale, 12 * scale, 6), GOLD, [0, 42 * scale, 0]),
  ];
  const glow = [];
  for (let i = 0; i < 7; i += 1) {
    glow.push(part(B(9.4 * scale, 0.5 * scale, 9.4 * scale), i % 2 ? GOLD : NEON, [0, (3 + i * 4) * scale, 0]));
  }
  glow.push(part(SP(1.5 * scale, 8), '#ffe9a8', [0, 48 * scale, 0]));
  return { body: mergeParts(body), glow: mergeParts(glow) };
}

function neonArch(scale = 1) {
  const body = [
    part(B(1.2 * scale, 7 * scale, 1.2 * scale), '#2a2140', [-7 * scale, 3.5 * scale, 0]),
    part(B(1.2 * scale, 7 * scale, 1.2 * scale), '#2a2140', [7 * scale, 3.5 * scale, 0]),
    part(B(16 * scale, 1.4 * scale, 1.4 * scale), '#2a2140', [0, 7.6 * scale, 0]),
  ];
  const glow = [
    part(B(14.4 * scale, 0.5 * scale, 0.5 * scale), NEON, [0, 6.7 * scale, 0]),
    part(B(0.5 * scale, 5.4 * scale, 0.5 * scale), NEON, [-7 * scale, 4 * scale, 0]),
    part(B(0.5 * scale, 5.4 * scale, 0.5 * scale), NEON, [7 * scale, 4 * scale, 0]),
    part(B(4 * scale, 1.2 * scale, 0.4 * scale), GOLD, [0, 9 * scale, 0]),
  ];
  return { body: mergeParts(body), glow: mergeParts(glow) };
}

function vineArch(scale = 1) {
  const body = [
    part(CY(0.5 * scale, 0.7 * scale, 8 * scale, 6), '#6b4a2a', [-6 * scale, 4 * scale, 0]),
    part(CY(0.5 * scale, 0.7 * scale, 8 * scale, 6), '#6b4a2a', [6 * scale, 4 * scale, 0]),
    part(CY(0.45 * scale, 0.5 * scale, 12 * scale, 6), '#6b4a2a', [0, 8 * scale, 0], [0, 0, Math.PI / 2]),
  ];
  for (let i = -4; i <= 4; i += 1) {
    body.push(part(CO(1.4 * scale, 3.2 * scale, 5), i % 2 ? LEAF : PALM_LEAF_DARK, [i * 1.4 * scale, 8 * scale + Math.abs(i) * -0.25, 0], [0, 0, Math.PI], [1, 1, 0.5]));
  }
  return { body: mergeParts(body), glow: null };
}

function zipLine(scale = 1) {
  const body = [
    part(CY(0.35 * scale, 0.5 * scale, 11 * scale, 6), '#5a4632', [-8 * scale, 5.5 * scale, 0]),
    part(CY(0.35 * scale, 0.5 * scale, 11 * scale, 6), '#5a4632', [8 * scale, 5.5 * scale, 0]),
    part(B(19 * scale, 0.12 * scale, 0.12 * scale), '#3a3a3a', [0, 9.6 * scale, 0], [0, 0, 0.06]),
  ];
  return { body: mergeParts(body), glow: null };
}

function waterfall(scale = 1) {
  const body = [
    part(B(5 * scale, 16 * scale, 2 * scale), '#6d8a86', [0, 8 * scale, 0]),
    part(B(3.4 * scale, 15 * scale, 0.6 * scale), '#bfeeff', [0, 8 * scale, 1.1 * scale]),
    part(OC(1.4 * scale), ROCK, [2.6 * scale, 1 * scale, 1.4 * scale]),
  ];
  const glow = [part(B(3.4 * scale, 4 * scale, 0.4 * scale), '#ffffff', [0, 13 * scale, 1.3 * scale], [0, 0, 0], [1, 1, 1], 1)];
  return { body: mergeParts(body), glow: mergeParts(glow) };
}

function blimp(scale = 1) {
  const body = [
    part(SP(4.4 * scale, 12), '#e8eef2', [0, 0, 0], [0, 0, 0], [1.7, 0.75, 0.75]),
    part(B(1.2 * scale, 2.6 * scale, 0.2 * scale), GOLD, [-6 * scale, 0, 0]),
    part(B(1.2 * scale, 2.6 * scale, 0.2 * scale), GOLD, [6 * scale, 0, 0]),
    part(B(3 * scale, 1 * scale, 1.6 * scale), '#3a4450', [0, -3.2 * scale, 0]),
  ];
  const glow = [part(B(6 * scale, 2.4 * scale, 0.4 * scale), NEON, [0, 0, 3.2 * scale])];
  return { body: mergeParts(body), glow: mergeParts(glow) };
}

function fountain(scale = 1) {
  const body = [
    part(CY(2.2 * scale, 2.6 * scale, 0.8 * scale, 10), STONE, [0, 0.4 * scale, 0]),
    part(CY(0.7 * scale, 0.9 * scale, 2 * scale, 8), STONE_DARK, [0, 1.4 * scale, 0]),
    part(SP(1.4 * scale, 8), '#8fe8ff', [0, 2.6 * scale, 0], [0, 0, 0], [1.6, 0.4, 1.6]),
    part(SP(0.7 * scale, 8), '#c9f6ff', [0, 3.4 * scale, 0], [0, 0, 0], [0.8, 1, 0.8]),
  ];
  const glow = [part(SP(0.9 * scale, 7), ICE, [0, 2.2 * scale, 0])];
  return { body: mergeParts(body), glow: mergeParts(glow) };
}

function hutVillageCart(scale = 1) {
  const body = [
    part(B(2.6 * scale, 1 * scale, 1.4 * scale), WOOD, [0, 1.1 * scale, 0]),
    part(CY(0.45 * scale, 0.45 * scale, 0.2 * scale, 8), WOOD_DARK, [-0.9 * scale, 0.45 * scale, 0], [Math.PI / 2, 0, 0]),
    part(CY(0.45 * scale, 0.45 * scale, 0.2 * scale, 8), WOOD_DARK, [0.9 * scale, 0.45 * scale, 0], [Math.PI / 2, 0, 0]),
    part(SP(0.7 * scale, 7), HUT_ROOF, [-0.6 * scale, 1.9 * scale, 0]),
    part(SP(0.6 * scale, 7), GOLD, [0.7 * scale, 1.85 * scale, 0]),
  ];
  return { body: mergeParts(body), glow: null };
}

function marketStall(scale = 1) {
  const body = [
    part(B(4.4 * scale, 0.3 * scale, 2.4 * scale), WOOD, [0, 1 * scale, 0]),
    part(CY(0.14 * scale, 0.14 * scale, 2.2 * scale, 6), WOOD_DARK, [-2 * scale, 1.1 * scale, -1 * scale]),
    part(CY(0.14 * scale, 0.14 * scale, 2.2 * scale, 6), WOOD_DARK, [2 * scale, 1.1 * scale, -1 * scale]),
    part(B(4.8 * scale, 0.2 * scale, 2.8 * scale), '#e05a4a', [0, 3.3 * scale, 0]),
    part(B(4.8 * scale, 0.16 * scale, 2.8 * scale), '#f0d8a0', [0, 3.1 * scale, 0]),
  ];
  const glow = [part(SP(0.28 * scale, 6), GOLD, [0, 2.6 * scale, -0.9 * scale])];
  return { body: mergeParts(body), glow: mergeParts(glow) };
}

function wreck(scale = 1) {
  const body = [
    part(B(5 * scale, 2 * scale, 12 * scale), '#5a4a3c', [0, 1 * scale, 0], [0.06, 0.3, 0.05]),
    part(CY(0.3 * scale, 0.4 * scale, 9 * scale, 6), '#4a3c30', [1 * scale, 5 * scale, 1 * scale], [0.2, 0, 0.4]),
    part(PL(4 * scale, 3 * scale), '#7d6a58', [-1 * scale, 5 * scale, 1.2 * scale]),
  ];
  return { body: mergeParts(body), glow: null };
}

function geyserRock(scale = 1) {
  const body = [
    part(CY(2 * scale, 2.6 * scale, 1.2 * scale, 8), '#3a332c', [0, 0.6 * scale, 0]),
    part(OC(1.2 * scale), ROCK, [1.6 * scale, 0.7 * scale, 0.6 * scale]),
    part(OC(0.9 * scale), ROCK, [-1.4 * scale, 0.6 * scale, -0.8 * scale]),
  ];
  const glow = [part(CY(0.9 * scale, 1.1 * scale, 0.6 * scale, 8), '#ffb15e', [0, 1.2 * scale, 0])];
  return { body: mergeParts(body), glow: mergeParts(glow) };
}

function emberBrazierProxy(scale = 1) {
  return brazier(scale);
}

/** Prop registry: geometry is built lazily, once per session. */
export const PROP_TYPES = {
  palm: { build: () => palmTree(1, 0.16), place: 'side', size: [3, 10, 3], cap: 6, shadow: true },
  palmLit: { build: () => palmTree(1, 0.2, true), place: 'side', size: [3, 10, 3], cap: 5, shadow: true },
  palmCluster: {
    build: () => ({
      body: mergeParts([
        ...palmTreeParts(0.9, 0.18),
        ...palmTreeParts(0.72, -0.3).map((g) => g.translate(1.9, 0, 1.3)),
        ...palmTreeParts(0.62, 0.34).map((g) => g.translate(-2.2, 0, -1.5)),
      ]),
      glow: null,
    }),
    place: 'side',
    size: [6, 10, 6],
    cap: 3,
    shadow: true,
  },
  rock: { build: () => rock(1), place: 'side', size: [4, 3, 4], cap: 4, shadow: true },
  cliff: { build: () => cliff(1), place: 'far', size: [14, 16, 14], cap: 3, shadow: false },
  fern: { build: () => fern(1), place: 'side', size: [2, 2, 2], cap: 5, shadow: false },
  tiki: { build: () => tiki(1), place: 'side', size: [2, 7, 2], cap: 4, shadow: true },
  temple: { build: () => temple(1), place: 'far', size: [10, 12, 8], cap: 2, shadow: true },
  statue: { build: () => statue(1), place: 'side', size: [3, 8, 3], cap: 3, shadow: true },
  hut: { build: () => hut(1), place: 'side', size: [5, 6, 5], cap: 3, shadow: true },
  parasol: { build: () => parasol(1), place: 'side', size: [5, 4, 5], cap: 4, shadow: true },
  bed: { build: () => parasol(0.9), place: 'side', size: [4, 3, 4], cap: 3, shadow: false },
  dockPier: { build: () => dockPier(1), place: 'side', size: [7, 2, 14], cap: 2, shadow: true },
  boat: { build: () => boat(1), place: 'far', size: [4, 5, 9], cap: 3, shadow: true },
  yacht: { build: () => yacht(1), place: 'far', size: [5, 7, 14], cap: 2, shadow: true },
  buoy: { build: () => buoy(1), place: 'far', size: [2, 3, 2], cap: 4, shadow: false },
  crateStack: { build: () => crateStack(1), place: 'side', size: [2, 4, 2], cap: 4, shadow: true },
  crane: { build: () => crane(1), place: 'far', size: [2, 15, 2], cap: 2, shadow: true },
  lantern: { build: () => lantern(1), place: 'side', size: [1, 4, 1], cap: 5, shadow: false },
  emberBrazier: { build: () => emberBrazierProxy(1), place: 'side', size: [2, 3, 2], cap: 4, shadow: false },
  lavaRock: { build: () => lavaRock(1), place: 'side', size: [4, 3, 4], cap: 4, shadow: true },
  volcano: { build: () => volcano(1), place: 'far', size: [32, 36, 32], cap: 1, shadow: false },
  crystal: { build: () => crystal(1), place: 'side', size: [2, 4, 2], cap: 4, shadow: false },
  floatingIsle: { build: () => floatingIsle(1), place: 'sky', size: [18, 18, 18], cap: 2, shadow: false },
  casinoTower: { build: () => casinoTower(1), place: 'far', size: [11, 48, 11], cap: 3, shadow: false },
  neonArch: { build: () => neonArch(1), place: 'over', size: [16, 9, 2], cap: 1, shadow: false },
  vineArch: { build: () => vineArch(1), place: 'over', size: [13, 9, 2], cap: 1, shadow: false },
  zipLine: { build: () => zipLine(1), place: 'over', size: [17, 11, 1], cap: 1, shadow: false },
  waterfall: { build: () => waterfall(1), place: 'side', size: [5, 16, 3], cap: 2, shadow: false },
  blimp: { build: () => blimp(1), place: 'sky', size: [15, 6, 6], cap: 2, shadow: false },
  fountain: { build: () => fountain(1), place: 'side', size: [5, 4, 5], cap: 3, shadow: true },
  cart: { build: () => hutVillageCart(1), place: 'side', size: [3, 3, 2], cap: 4, shadow: true },
  marketStall: { build: () => marketStall(1), place: 'side', size: [5, 4, 3], cap: 3, shadow: true },
  wreck: { build: () => wreck(1), place: 'far', size: [5, 10, 13], cap: 2, shadow: true },
  geyser: { build: () => geyserRock(1), place: 'side', size: [4, 2, 4], cap: 3, shadow: false },
};

const buildCache = new Map();

/** Fetch (and memoise) the merged geometry pair for a prop type. */
export function getPropGeometry(type) {
  if (!buildCache.has(type)) {
    const def = PROP_TYPES[type];
    buildCache.set(type, def ? def.build() : { body: null, glow: null });
  }
  return buildCache.get(type);
}

export function disposePropGeometry() {
  buildCache.forEach((entry) => {
    entry.body?.dispose();
    entry.glow?.dispose();
  });
  buildCache.clear();
}

export default PROP_TYPES;