import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// ===========================================================================
// CourtyardRoom.js
// A three-storey Venetian-Gothic courtyard room, in the spirit of the
// Isabella Stewart Gardner palazzo courtyard: an open central garden under a
// glazed roof, ringed on every floor by pointed-arch arcades that front a
// hallway. Each hallway's back wall carries closed wooden doors to other
// rooms (placeholders for now).
//
// Built to match this repo's world/ conventions:
//   - one builder function (scene, mats, tier) -> { group, ... }, like
//     buildCourtyard() in Courtyard.js
//   - merged static geometry per material
//   - seeded procedural canvas textures (utils/proctex.js style)
//   - vertex-shader wind on foliage (world/wind.js style)
//
// Self-contained on purpose so it runs in the preview harness untouched.
// When integrating: delete the local proctex/wind blocks below and instead
//   import { mulberry32, barkTexture, leafClusterTexture, flowerCardTexture } from '../utils/proctex.js';
//   import { applyWind, tickWind } from './wind.js';
// then extend layout.js with COURTYARD_ROOM bounds + these colliders/slots.
// ===========================================================================

// ---- room dimensions (metres). Centred on the origin. ---------------------
export const CR = {
  R: 6.0,          // colonnade radius: arcade columns stand at |x| or |z| = 6
  wallIn: 9.0,     // inner face of the perimeter hallway wall
  wallMid: 9.25,   // wall centreline
  wallT: 0.5,      // wall thickness
  clamp: 8.55,     // player keep-in half-extent
  FH: 4.4,         // storey height
  slabT: 0.3,      // ring-slab thickness
  eaveY: 13.2,     // roof eave height (= 3 * FH)
  ridgeY: 15.0,    // glass-roof ridge
  half: 9.5,       // outer half-extent (roof / footprint)
  floors: [0, 4.4, 8.8],
};

// ---- switchback stair, in the West hallway (x -9..-6), stacked per storey --
// Two lanes running in Z, joined by a landing at the north end. Outer lane
// (against the perimeter wall) climbs to the mid landing; inner lane climbs
// from the landing up to the next floor. Identical shaft repeats each storey.
export const ST = {
  x0: -9, x1: -6,
  laneDiv: -7.5,               // wall between the two flights
  outer: [-8.85, -7.55],       // outer lane x-range (climbs first)
  inner: [-7.45, -6.15],       // inner lane x-range (climbs second)
  fz0: -4, fz1: 4,             // flight run in Z
  landN0: -5, landN1: -4,      // north (mid) landing
  landS0: 4, landS1: 5,        // south landing (floor level, lane crossover)
  steps: 11,                   // visible steps per flight
};

// Height of the stair surface within storey `i` (base = i*FH). The climb lane
// alternates each storey (outer, inner, outer…) so arrival lands exactly on
// the next storey's entry lane — the ascent is one unbroken switchback.
function stairHeightAt(x, z, i) {
  const base = i * CR.FH, mid = base + CR.FH / 2, top = base + CR.FH;
  const climbOuter = i % 2 === 0;
  const inClimb = climbOuter ? (x <= ST.laneDiv) : (x > ST.laneDiv);
  if (z >= ST.landN0 && z <= ST.landN1) return mid;          // north mid-landing
  if (z >= ST.landS0) return inClimb ? base : top;           // south: entry lane low, other high
  const t = THREE.MathUtils.clamp((ST.fz1 - z) / (ST.fz1 - ST.fz0), 0, 1); // 0 at south, 1 at north
  return inClimb ? base + t * (CR.FH / 2)                    // entry lane climbs S->N to mid
                 : top - t * (CR.FH / 2);                    // other lane descends N->S from top
}

function inStair(x, z) { return x > ST.x0 && x < ST.x1 && z > ST.landN0 - 0.01 && z < ST.landS1 + 0.01; }
function inRing(x, z) { const m = Math.max(Math.abs(x), Math.abs(z)); return m > CR.R - 0.05 && m < CR.wallIn + 0.05; }

// Analytic ground height, prevY-driven (layout.js trick): the storey a player
// is on is inferred from height, so the same XZ carries all three levels and
// the stair is the one continuous connector.
export function courtyardGround(x, z, prevY = 0) {
  if (inStair(x, z)) return stairHeightAt(x, z, prevY > CR.floors[1] - 0.6 ? 1 : 0);
  if (inRing(x, z)) return CR.floors[prevY > 6.6 ? 2 : prevY > 2.2 ? 1 : 0];
  return 0;  // garden / ground
}

// Per-storey arcade tuning: bay count, pier width, arch spring/apex, and the
// balustrade height across the opening (0 = open, walkable, ground floor).
const STOREYS = [
  { base: 0.0, bays: 4, pier: 0.55, spring: 2.6, apex: 4.02, rail: 0.0, door: 2.4 },
  { base: 4.4, bays: 4, pier: 0.55, spring: 2.5, apex: 3.9, rail: 0.98, door: 2.2 },
  { base: 8.8, bays: 8, pier: 0.34, spring: 1.75, apex: 3.0, rail: 0.9, door: 2.1 },
];
const SCREEN_T = 0.5;   // arcade screen thickness

// ===========================================================================
// Wind (world/wind.js clone — swap for the shared one on integration)
// ===========================================================================
export const windUniform = { value: 0 };
export function tickWind(t) { windUniform.value = t; }
export function applyWind(material, { strength = 0.06, y0 = 0.5, y1 = 6.0, local = false } = {}) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uWindTime = windUniform;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n uniform float uWindTime;`)
      .replace('#include <project_vertex>', `
        {
          vec4 _wp = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
            _wp = instanceMatrix * _wp;
          #endif
          vec3 _wpos = (modelMatrix * _wp).xyz;
          float _h = smoothstep(${f(y0)}, ${f(y1)}, ${local ? 'position.y + 0.5' : '_wpos.y'});
          float _sway = sin(uWindTime * 1.3 + _wpos.x * 0.5 + _wpos.z * 0.7)
                      + 0.5 * sin(uWindTime * 2.9 + _wpos.z * 1.3 + _wpos.x * 0.4);
          transformed.x += _sway * _h * ${f(strength)};
          transformed.z += _sway * _h * ${f(strength * 0.6)};
        }
        #include <project_vertex>`);
  };
  material.needsUpdate = true;
}
function f(n) { return Number(n).toFixed(4); }

// ===========================================================================
// Procedural textures (utils/proctex.js style, seeded & deterministic)
// ===========================================================================
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function fbmField(size, seed, octaves = 4, baseFreq = 4) {
  const rand = mulberry32(seed);
  const out = new Float32Array(size * size);
  let amp = 1, freq = baseFreq, total = 0;
  for (let o = 0; o < octaves; o++) {
    const g = Math.max(2, Math.round(freq));
    const grid = new Float32Array((g + 1) * (g + 1));
    for (let i = 0; i < grid.length; i++) grid[i] = rand();
    for (let i = 0; i <= g; i++) { grid[i * (g + 1) + g] = grid[i * (g + 1)]; grid[g * (g + 1) + i] = grid[i]; }
    for (let y = 0; y < size; y++) {
      const gy = (y / size) * g, y0 = Math.floor(gy), fy = sm(gy - y0);
      for (let x = 0; x < size; x++) {
        const gx = (x / size) * g, x0 = Math.floor(gx), fx = sm(gx - x0);
        const i00 = grid[y0 * (g + 1) + x0], i10 = grid[y0 * (g + 1) + x0 + 1];
        const i01 = grid[(y0 + 1) * (g + 1) + x0], i11 = grid[(y0 + 1) * (g + 1) + x0 + 1];
        out[y * size + x] += lp(lp(i00, i10, fx), lp(i01, i11, fx), fy) * amp;
      }
    }
    total += amp; amp *= 0.5; freq *= 2;
  }
  for (let i = 0; i < out.length; i++) out[i] /= total;
  return out;
}
const sm = (t) => t * t * (3 - 2 * t);
const lp = (a, b, t) => a + (b - a) * t;
function cv(size) { const c = document.createElement('canvas'); c.width = c.height = size; return [c, c.getContext('2d')]; }
function tex(canvas, { srgb = true, repeat = 1 } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 8;
  return t;
}

// warm travertine / limestone for columns, arches, floors
function stoneTex(size = 512, tint = [232, 223, 202]) {
  const [c, ctx] = cv(size);
  const base = fbmField(size, 71, 5, 5);
  const vein = fbmField(size, 72, 4, 9);
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    const n = base[i], v = Math.pow(1 - Math.abs(vein[i] - 0.5) * 2, 6) * 22;
    img.data[i * 4] = tint[0] + (n - 0.5) * 26 - v;
    img.data[i * 4 + 1] = tint[1] + (n - 0.5) * 26 - v;
    img.data[i * 4 + 2] = tint[2] + (n - 0.5) * 26 - v * 1.4;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return tex(c);
}
// pink Verona-style veined marble for the walkway floors
function marbleTex(size = 512) {
  const [c, ctx] = cv(size);
  const base = fbmField(size, 81, 5, 4);
  const warp = fbmField(size, 82, 4, 3);
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = y * size + x;
    const streak = Math.pow(1 - Math.abs(Math.sin((x / size + warp[i] * 1.8) * Math.PI * 4 + base[i] * 5)), 10);
    img.data[i * 4] = 196 + base[i] * 34 + streak * 30;
    img.data[i * 4 + 1] = 150 + base[i] * 30 + streak * 12;
    img.data[i * 4 + 2] = 138 + base[i] * 26;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return tex(c);
}
// small-tesserae mosaic field for the garden floor
function mosaicFieldTex(size = 256) {
  const [c, ctx] = cv(size);
  const rand = mulberry32(1234);
  ctx.fillStyle = '#3a2f28'; ctx.fillRect(0, 0, size, size); // grout
  const n = 22, cell = size / n;
  const pal = [[196, 176, 142], [212, 198, 168], [150, 96, 66], [92, 108, 104], [176, 150, 110], [222, 214, 192]];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const col = pal[Math.floor(rand() * pal.length)];
    const j = () => (rand() - 0.5) * 22;
    ctx.fillStyle = `rgb(${col[0] + j()},${col[1] + j()},${col[2] + j()})`;
    const pad = 1 + rand();
    ctx.fillRect(x * cell + pad, y * cell + pad, cell - pad * 2, cell - pad * 2);
  }
  return tex(c, { repeat: 5 });
}
// central mosaic medallion (Roman rosette)
function medallionTex(size = 512) {
  const [c, ctx] = cv(size);
  const cx = size / 2, rand = mulberry32(55);
  ctx.fillStyle = '#2c241e'; ctx.fillRect(0, 0, size, size);
  const rings = 9;
  const pal = ['#b06a3c', '#d9c7a0', '#5c6c68', '#8f5236', '#c9b485', '#e6ddc6', '#7a8f88'];
  for (let r = rings; r >= 1; r--) {
    const rad = (r / rings) * cx * 0.96;
    const seg = 8 + r * 6;
    for (let s = 0; s < seg; s++) {
      const a0 = (s / seg) * Math.PI * 2, a1 = ((s + 1) / seg) * Math.PI * 2;
      ctx.beginPath(); ctx.moveTo(cx, cx);
      ctx.arc(cx, cx, rad, a0 + 0.02, a1 - 0.02);
      ctx.closePath();
      ctx.fillStyle = pal[(s + r) % pal.length];
      ctx.fill();
    }
  }
  // centre motif
  ctx.beginPath(); ctx.arc(cx, cx, cx * 0.16, 0, Math.PI * 2);
  ctx.fillStyle = '#2c241e'; ctx.fill();
  ctx.beginPath(); ctx.arc(cx, cx, cx * 0.1, 0, Math.PI * 2);
  ctx.fillStyle = '#c99a4a'; ctx.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
function barkTex(size = 256) {
  const [c, ctx] = cv(size);
  const base = fbmField(size, 41, 5, 6), ridge = fbmField(size, 42, 3, 14);
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = y * size + x;
    const v = 66 + base[i] * 40 + Math.sin(x * 0.5 + ridge[(y >> 2) * size + x] * 9) * 12;
    img.data[i * 4] = v + 14; img.data[i * 4 + 1] = v; img.data[i * 4 + 2] = v - 20; img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const t = tex(c); t.repeat.set(1, 2); return t;
}
function woodTex(size = 256, dark = false) {
  const [c, ctx] = cv(size);
  const grain = fbmField(size, dark ? 61 : 62, 4, 3);
  const img = ctx.createImageData(size, size);
  const b = dark ? [74, 54, 40] : [150, 112, 74];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = y * size + x;
    const ring = Math.sin((x / size * 5 + grain[i] * 3) * Math.PI * 2) * 10;
    img.data[i * 4] = b[0] + ring + (grain[i] - 0.5) * 24;
    img.data[i * 4 + 1] = b[1] + ring + (grain[i] - 0.5) * 20;
    img.data[i * 4 + 2] = b[2] + ring + (grain[i] - 0.5) * 16;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return tex(c);
}
function leafClusterTex(size = 256, seed = 7, hueShift = 0) {
  const [c, ctx] = cv(size);
  const rand = mulberry32(seed);
  for (let i = 0; i < 260; i++) {
    const a = rand() * Math.PI * 2, r = Math.pow(rand(), 0.6) * size * 0.44;
    const x = size / 2 + Math.cos(a) * r, y = size / 2 + Math.sin(a) * r * 0.92;
    const s = 5 + rand() * 12;
    ctx.fillStyle = `hsla(${96 + hueShift + (rand() - 0.5) * 30}, ${40 + rand() * 26}%, ${22 + rand() * 26}%, 0.9)`;
    ctx.save(); ctx.translate(x, y); ctx.rotate(rand() * Math.PI * 2);
    ctx.beginPath(); ctx.ellipse(0, 0, s, s * 0.42, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
// a single palm frond card (feathered)
function frondTex(size = 256, seed = 3) {
  const [c, ctx] = cv(size);
  const rand = mulberry32(seed);
  ctx.strokeStyle = '#3f5a2e'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(size * 0.5, size); ctx.quadraticCurveTo(size * 0.5, size * 0.4, size * 0.5, 8); ctx.stroke();
  for (let i = 0; i < 26; i++) {
    const t = i / 26, y = size - t * (size - 12);
    const len = Math.sin(t * Math.PI) * size * 0.4 + 8;
    for (const dir of [-1, 1]) {
      ctx.strokeStyle = `hsl(${92 + rand() * 20}, ${44 + rand() * 20}%, ${26 + t * 16}%)`;
      ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.moveTo(size * 0.5, y);
      ctx.quadraticCurveTo(size * 0.5 + dir * len * 0.6, y - 6, size * 0.5 + dir * len, y - len * 0.5);
      ctx.stroke();
    }
  }
  const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; return tx;
}
function flowerCardTex(size = 256, seed = 21, hue = 18) {
  const [c, ctx] = cv(size);
  const rand = mulberry32(seed);
  for (let s = 0; s < 7; s++) {
    const bx = size * (0.3 + rand() * 0.4);
    const tx = bx + (rand() - 0.5) * size * 0.3, ty = size * (0.12 + rand() * 0.3);
    ctx.strokeStyle = `hsl(${95 + rand() * 25}, 38%, ${26 + rand() * 12}%)`;
    ctx.lineWidth = 2 + rand() * 1.5;
    ctx.beginPath(); ctx.moveTo(bx, size); ctx.quadraticCurveTo(bx + (rand() - 0.5) * 30, size * 0.6, tx, ty); ctx.stroke();
    const petals = 5 + Math.floor(rand() * 3), pr = 10 + rand() * 8, h = hue + (rand() - 0.5) * 22;
    for (let p = 0; p < petals; p++) {
      const pa = (p / petals) * Math.PI * 2 + rand() * 0.3;
      ctx.fillStyle = `hsla(${h}, ${60 + rand() * 20}%, ${58 + rand() * 16}%, 0.96)`;
      ctx.save(); ctx.translate(tx + Math.cos(pa) * pr * 0.6, ty + Math.sin(pa) * pr * 0.6); ctx.rotate(pa);
      ctx.beginPath(); ctx.ellipse(0, 0, pr * 0.6, pr * 0.33, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
    ctx.fillStyle = `hsl(${46 + rand() * 12}, 82%, 56%)`;
    ctx.beginPath(); ctx.arc(tx, ty, pr * 0.28, 0, Math.PI * 2); ctx.fill();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// ===========================================================================
// Geometry helpers
// ===========================================================================
function prep(g) { const n = g.index ? g.toNonIndexed() : g; n.clearGroups(); return n; }
function mergeM(geos) { return mergeGeometries(geos.map(prep)); }

// world-scale UVs so tiled textures don't stretch on big boxes
function worldUV(g) {
  g.computeBoundingBox();
  const s = new THREE.Vector3(); g.boundingBox.getSize(s);
  const uv = g.attributes.uv;
  const su = Math.max(s.x, s.z), sv = Math.max(s.y, Math.min(s.x, s.z));
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
  return g;
}

// one arcade bay: a wall slab with a pointed (ogee) arch cut through it.
// Authored in local XY (x across the bay, y up), extruded along Z.
function bayPanel(bw, fh, t, pier, spring, apex) {
  const hw = bw / 2, iw = hw - pier;
  const s = new THREE.Shape();
  s.moveTo(-hw, 0); s.lineTo(hw, 0); s.lineTo(hw, fh); s.lineTo(-hw, fh); s.closePath();
  const hole = new THREE.Path();               // clockwise
  hole.moveTo(-iw, 0);
  hole.lineTo(iw, 0);
  hole.lineTo(iw, spring);
  hole.quadraticCurveTo(iw, apex, 0, apex);
  hole.quadraticCurveTo(-iw, apex, -iw, spring);
  hole.lineTo(-iw, 0);
  s.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: false, curveSegments: 22 });
  g.translate(0, 0, -t / 2);
  // planar UVs in world scale
  const uv = g.attributes.uv, pos = g.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i), pos.getY(i));
  return g;
}

// place a local geometry (authored facing +Z, along local +X) onto a side of
// the square ring at radius r. side: 'N'|'S'|'E'|'W'. u = offset along side.
function toSide(g, side, r, u = 0) {
  g.translate(u, 0, 0);
  if (side === 'N') g.translate(0, 0, -r);
  else if (side === 'S') { g.rotateY(Math.PI); g.translate(0, 0, r); }
  else if (side === 'E') { g.rotateY(-Math.PI / 2); g.translate(r, 0, 0); }
  else if (side === 'W') { g.rotateY(Math.PI / 2); g.translate(-r, 0, 0); }
  return g;
}
const SIDES = ['N', 'S', 'E', 'W'];

// a square "ring" band (4 boxes) at radius r, from y0..y1, radial depth d.
function ringBand(r, y0, y1, d, span) {
  const h = y1 - y0, ym = (y0 + y1) / 2, L = span;
  const geos = [];
  for (const side of SIDES) {
    const g = new THREE.BoxGeometry(L, h, d);
    worldUV(g); g.translate(0, ym, 0);
    toSide(g, side, r);
    geos.push(g);
  }
  return geos;
}

// ===========================================================================
// Builder
// ===========================================================================
export function buildCourtyardRoom(scene, mats, tier) {
  const group = new THREE.Group();
  group.name = 'courtyardRoom';
  const rand = mulberry32(2026);
  const hi = !tier || tier.name !== 'low';

  // --- materials (reuse the shared set; add stone/marble/mosaic/foliage) ----
  const M = {
    plaster: mats.plasterWarm || mats.plaster || new THREE.MeshStandardMaterial({ color: 0xeee4d4, roughness: 0.94 }),
    stone: mats.stone || new THREE.MeshStandardMaterial({ map: stoneTex(), roughness: 0.82 }),
    marble: mats.floorMarble || new THREE.MeshStandardMaterial({ map: marbleTex(), roughness: 0.5, metalness: 0.05 }),
    mosaic: new THREE.MeshStandardMaterial({ map: mosaicFieldTex(), roughness: 0.7 }),
    medallion: new THREE.MeshStandardMaterial({ map: medallionTex(), roughness: 0.6 }),
    wood: mats.wood || new THREE.MeshStandardMaterial({ map: woodTex(), roughness: 0.6 }),
    woodDark: mats.woodDark || new THREE.MeshStandardMaterial({ map: woodTex(256, true), roughness: 0.55 }),
    brass: mats.brass || new THREE.MeshStandardMaterial({ color: 0xa88b52, roughness: 0.35, metalness: 0.9 }),
    soil: new THREE.MeshStandardMaterial({ color: 0x3a2f26, roughness: 1 }),
    glass: mats.glass || new THREE.MeshPhysicalMaterial({ color: 0xffffff, transmission: 1, roughness: 0.05, ior: 1.5, thickness: 0.02, transparent: true }),
    steel: mats.steel || new THREE.MeshStandardMaterial({ color: 0x3a3a40, roughness: 0.5, metalness: 0.7 }),
  };

  const stoneGeos = [], plasterGeos = [], woodGeos = [], darkGeos = [], brassGeos = [];

  // --- base slab + garden floor + walkway ring ------------------------------
  const baseSlab = new THREE.Mesh(new THREE.BoxGeometry(CR.half * 2, 0.3, CR.half * 2), M.stone);
  baseSlab.position.y = -0.16; baseSlab.receiveShadow = true;
  group.add(baseSlab);

  // walkway marble ring (radius R..wall) — 4 boxes incl. corners
  const wk = CR.wallIn, ins = CR.R;
  const walkGeos = [
    new THREE.BoxGeometry(CR.half * 2, 0.1, wk - ins).translate(0, -0.02, -(wk + ins) / 2),
    new THREE.BoxGeometry(CR.half * 2, 0.1, wk - ins).translate(0, -0.02, (wk + ins) / 2),
    new THREE.BoxGeometry(wk - ins, 0.1, ins * 2).translate((wk + ins) / 2, -0.02, 0),
    new THREE.BoxGeometry(wk - ins, 0.1, ins * 2).translate(-(wk + ins) / 2, -0.02, 0),
  ].map(worldUV);
  const walk = new THREE.Mesh(mergeM(walkGeos), M.marble);
  walk.receiveShadow = true; group.add(walk);

  // garden mosaic field
  const field = new THREE.Mesh(new THREE.PlaneGeometry(ins * 2, ins * 2), M.mosaic);
  field.rotation.x = -Math.PI / 2; field.position.y = 0.005; field.receiveShadow = true;
  group.add(field);
  const medallion = new THREE.Mesh(new THREE.CircleGeometry(2.3, 64), M.medallion);
  medallion.rotation.x = -Math.PI / 2; medallion.position.y = 0.02; medallion.receiveShadow = true;
  group.add(medallion);

  // --- arcades, storey by storey -------------------------------------------
  const balusterGeos = [];
  for (const st of STOREYS) {
    const bw = 12 / st.bays;
    for (const side of SIDES) {
      for (let i = 0; i < st.bays; i++) {
        const u = -6 + bw * (i + 0.5);
        const g = bayPanel(bw, CR.FH, SCREEN_T, st.pier, st.spring, st.apex);
        g.translate(0, st.base, 0);
        toSide(g, side, CR.R, u);
        stoneGeos.push(g);
      }
    }
    // plinth, impost band (at spring), cornice (at storey top)
    stoneGeos.push(...ringBand(CR.R, st.base, st.base + 0.35, SCREEN_T + 0.18, 12.9));
    stoneGeos.push(...ringBand(CR.R, st.base + st.spring - 0.16, st.base + st.spring + 0.14, SCREEN_T + 0.22, 12.9));
    stoneGeos.push(...ringBand(CR.R, st.base + CR.FH - 0.36, st.base + CR.FH, SCREEN_T + 0.28, 13.1));

    // balustrade across the openings on upper storeys
    if (st.rail > 0) {
      const rY = st.base;
      stoneGeos.push(...ringBand(CR.R, rY + st.rail - 0.12, rY + st.rail, 0.22, 12.6));  // top rail
      stoneGeos.push(...ringBand(CR.R, rY + 0.02, rY + 0.16, 0.28, 12.6));               // bottom rail
      for (const side of SIDES) {
        for (let b = 0; b < 30; b++) {
          const u = -5.85 + (11.7 / 29) * b;
          const bg = new THREE.CylinderGeometry(0.05, 0.06, st.rail - 0.16, 6);
          bg.translate(0, rY + 0.08 + (st.rail - 0.16) / 2, 0);
          toSide(bg, side, CR.R, u);
          balusterGeos.push(bg);
        }
      }
    }
  }
  // corner columns, full height
  for (const sx of [-CR.R, CR.R]) for (const sz of [-CR.R, CR.R]) {
    const g = new THREE.BoxGeometry(0.8, CR.eaveY, 0.8); worldUV(g);
    g.translate(sx, CR.eaveY / 2, sz);
    stoneGeos.push(g);
  }

  // --- ring slabs (floor of storeys 2 & 3 / ceiling below) ------------------
  // The West strip is split to leave a stairwell void (z -5..5) for the stair.
  for (let fl = 1; fl <= 2; fl++) {
    const y = CR.floors[fl];
    const o = CR.wallIn, iN = CR.R - 0.1;
    const slab = [
      new THREE.BoxGeometry(o * 2, CR.slabT, o - iN).translate(0, y - CR.slabT / 2, -(o + iN) / 2),
      new THREE.BoxGeometry(o * 2, CR.slabT, o - iN).translate(0, y - CR.slabT / 2, (o + iN) / 2),
      new THREE.BoxGeometry(o - iN, CR.slabT, iN * 2).translate((o + iN) / 2, y - CR.slabT / 2, 0),
      // west end pieces flanking the stairwell void
      new THREE.BoxGeometry(o - iN, CR.slabT, iN - 5).translate(-(o + iN) / 2, y - CR.slabT / 2, -(iN + 5) / 2),
      new THREE.BoxGeometry(o - iN, CR.slabT, iN - 5).translate(-(o + iN) / 2, y - CR.slabT / 2, (iN + 5) / 2),
    ].map(worldUV);
    stoneGeos.push(...slab);
  }

  // --- switchback stair in the West hallway --------------------------------
  buildStairs(stoneGeos);

  // --- perimeter hallway walls ---------------------------------------------
  for (const side of SIDES) {
    const g = new THREE.BoxGeometry(CR.half * 2 + CR.wallT, CR.eaveY, CR.wallT);
    worldUV(g); g.translate(0, CR.eaveY / 2, 0);
    toSide(g, side, CR.wallMid);
    plasterGeos.push(g);
  }

  // --- wooden doors on every hallway back wall, every storey ----------------
  const doorRadius = CR.wallIn - 0.02;
  for (const st of STOREYS) {
    for (const side of SIDES) {
      for (const u of [-4.5, 0, 4.5]) {
        buildDoor(u, st.base, st.door, side, doorRadius, woodGeos, darkGeos, brassGeos);
      }
    }
  }

  // --- glass gable roof + rafters ------------------------------------------
  buildRoof(group, M, stoneGeos, darkGeos, hi);

  // --- commit merged meshes -------------------------------------------------
  addMesh(group, mergeM(stoneGeos), M.stone, true, true);
  addMesh(group, mergeM(plasterGeos), M.plaster, true, true);
  if (balusterGeos.length) addMesh(group, mergeM(balusterGeos), M.stone, true, false);
  addMesh(group, mergeM(woodGeos), M.wood, true, false);
  addMesh(group, mergeM(darkGeos), M.woodDark, true, false);
  addMesh(group, mergeM(brassGeos), M.brass, false, false);

  // --- garden planting ------------------------------------------------------
  const flora = buildGarden(group, M, tier, rand);

  scene.add(group);

  return {
    group,
    spawn: { x: 1.5, z: 7.1, yaw: 0 },  // south walkway, down a bay axis into the garden
    colliders: buildColliders(),
    groundHeight: courtyardGround,       // analytic 3-level walk (stair connector)
    update: (t) => { tickWind(t); },
    flora,
  };
}

function addMesh(group, geo, mat, cast, receive) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = cast; m.receiveShadow = receive;
  group.add(m);
  return m;
}

// ---------------------------------------------------------------------------
function buildDoor(u, baseY, h, side, r, wood, dark, brass) {
  const w = 1.6;
  // frame surround
  const fr = [
    new THREE.BoxGeometry(w + 0.4, 0.28, 0.34).translate(0, h + 0.14, 0),   // lintel
    new THREE.BoxGeometry(0.24, h + 0.28, 0.34).translate(-(w / 2 + 0.14), (h + 0.28) / 2, 0),
    new THREE.BoxGeometry(0.24, h + 0.28, 0.34).translate((w / 2 + 0.14), (h + 0.28) / 2, 0),
  ];
  // two leaves, slightly proud of the wall
  const leaves = [
    new THREE.BoxGeometry(w / 2 - 0.03, h - 0.06, 0.09).translate(-(w / 4), (h - 0.06) / 2 + 0.03, 0.14),
    new THREE.BoxGeometry(w / 2 - 0.03, h - 0.06, 0.09).translate((w / 4), (h - 0.06) / 2 + 0.03, 0.14),
  ];
  // recessed rail panels (darker) on each leaf
  const panels = [];
  for (const sx of [-1, 1]) for (const py of [0.32, 0.68]) {
    panels.push(new THREE.BoxGeometry(w / 2 - 0.22, h * 0.26, 0.04).translate(sx * w / 4, h * py, 0.19));
  }
  // handles
  const handles = [
    new THREE.CylinderGeometry(0.045, 0.045, 0.1, 8).rotateX(Math.PI / 2).translate(-0.12, h * 0.45, 0.22),
    new THREE.CylinderGeometry(0.045, 0.045, 0.1, 8).rotateX(Math.PI / 2).translate(0.12, h * 0.45, 0.22),
  ];
  for (const g of fr) dark.push(toSide(g.translate(0, baseY, 0), side, r, u));
  for (const g of leaves) wood.push(toSide(g.translate(0, baseY, 0), side, r, u));
  for (const g of panels) dark.push(toSide(g.translate(0, baseY, 0), side, r, u));
  for (const g of handles) brass.push(toSide(g.translate(0, baseY, 0), side, r, u));
}

// ---------------------------------------------------------------------------
// Switchback stair geometry: two storeys of steps (ground->2, 2->3), each a
// climb-lane flight to a mid landing, then a return flight in the other lane
// up to the next floor. Climb-lane alternates so it matches courtyardGround().
function buildStairs(stoneGeos) {
  const td = (ST.fz1 - ST.fz0) / ST.steps;         // tread depth
  const riser = (CR.FH / 2) / ST.steps;            // step rise
  const sh = riser + 0.32;                         // step block height
  const step = (xr, z0, z1, yTop) => {
    const g = new THREE.BoxGeometry(xr[1] - xr[0], sh, z1 - z0);
    worldUV(g); g.translate((xr[0] + xr[1]) / 2, yTop - sh / 2, (z0 + z1) / 2);
    return g;
  };
  const plat = (x0, z0, x1, z1, yTop, h = 0.3) => {
    const g = new THREE.BoxGeometry(x1 - x0, h, z1 - z0);
    worldUV(g); g.translate((x0 + x1) / 2, yTop - h / 2, (z0 + z1) / 2);
    return g;
  };
  for (let i = 0; i < 2; i++) {
    const base = i * CR.FH, mid = base + CR.FH / 2, top = base + CR.FH;
    const climbOuter = i % 2 === 0;
    const entry = climbOuter ? ST.outer : ST.inner;
    const other = climbOuter ? ST.inner : ST.outer;
    for (let k = 0; k < ST.steps; k++) {                 // flight A (entry lane, S->N)
      const zHi = ST.fz1 - k * td;
      stoneGeos.push(step(entry, zHi - td, zHi, base + (k + 1) * riser));
    }
    stoneGeos.push(plat(ST.x0 + 0.12, ST.landN0, ST.x1 - 0.12, ST.landN1, mid));  // mid landing
    for (let k = 0; k < ST.steps; k++) {                 // flight B (other lane, N->S)
      const zLo = ST.fz0 + k * td;
      stoneGeos.push(step(other, zLo, zLo + td, mid + (k + 1) * riser));
    }
    stoneGeos.push(plat(entry[0], ST.landS0 - 0.5, entry[1], ST.landS1, base + 0.02, 0.34)); // entry platform
    stoneGeos.push(plat(other[0], ST.landS0 - 0.5, other[1], ST.landS1, top, 0.34));         // arrival platform
    const dv = new THREE.BoxGeometry(0.12, CR.FH + 0.3, ST.landS1 - ST.fz0);                 // lane divider
    worldUV(dv); dv.translate(ST.laneDiv, base + (CR.FH + 0.3) / 2 - 0.15, (ST.landS1 + ST.fz0) / 2);
    stoneGeos.push(dv);
  }
}

// ---------------------------------------------------------------------------
function buildRoof(group, M, stoneGeos, darkGeos, hi) {
  const half = CR.half, eave = CR.eaveY, ridge = CR.ridgeY;
  const rise = ridge - eave, slopeLen = Math.hypot(half, rise);
  const ang = Math.atan2(rise, half);
  // two glass slopes (as planes) sloping down toward ±Z
  for (const dir of [-1, 1]) {
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(half * 2, slopeLen), M.glass);
    plane.rotation.order = 'YXZ';
    plane.rotation.x = -dir * (Math.PI / 2 - ang);
    plane.position.set(0, (eave + ridge) / 2, dir * half / 2);
    plane.renderOrder = 2;
    group.add(plane);
  }
  // ridge beam
  const rb = new THREE.BoxGeometry(half * 2 + 0.4, 0.3, 0.3); worldUV(rb);
  rb.translate(0, ridge, 0); darkGeos.push(rb);
  // rafters running up each slope, spaced along X -> parallel shadow bars
  const n = 13;
  for (let i = 0; i <= n; i++) {
    const x = -half + (2 * half / n) * i;
    for (const dir of [-1, 1]) {
      const raf = new THREE.BoxGeometry(0.12, 0.2, slopeLen);
      raf.rotateX(dir * (Math.PI / 2 - ang) - dir * Math.PI / 2 + dir * Math.PI / 2); // = slope tilt
      // simpler: recompute cleanly
      raf.rotation && null;
      const g = new THREE.BoxGeometry(0.12, 0.2, slopeLen);
      g.rotateX(-dir * (Math.PI / 2 - ang));
      g.translate(x, (eave + ridge) / 2 + 0.16, dir * half / 2);
      worldUV(g); darkGeos.push(g);
    }
  }
  // gable in-fill triangles at X = ±half (plaster-toned stone)
  for (const sx of [-1, 1]) {
    const s = new THREE.Shape();
    s.moveTo(-half, 0); s.lineTo(half, 0); s.lineTo(0, rise); s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.25, bevelEnabled: false });
    g.rotateY(Math.PI / 2); g.translate(sx * half, eave, 0);
    worldUV(g); stoneGeos.push(g);
  }
}

// ---------------------------------------------------------------------------
function buildGarden(group, M, tier, rand) {
  const meshes = [];
  // planting beds (soil) — split at cross-axis paths, blocked by colliders
  const bedSpecs = [];
  const edges = [
    ['x', [-4.5, -1.0], -4.75], ['x', [1.0, 4.5], -4.75],   // near N
    ['x', [-4.5, -1.0], 4.75], ['x', [1.0, 4.5], 4.75],     // near S
  ];
  const soilGeos = [];
  const beds = [
    [-4.5, -5.5, -1.0, -4.0], [1.0, -5.5, 4.5, -4.0],
    [-4.5, 4.0, -1.0, 5.5], [1.0, 4.0, 4.5, 5.5],
    [-5.5, -4.5, -4.0, -1.0], [-5.5, 1.0, -4.0, 4.5],
    [4.0, -4.5, 5.5, -1.0], [4.0, 1.0, 5.5, 4.5],
  ];
  for (const [x0, z0, x1, z1] of beds) {
    const g = new THREE.BoxGeometry(x1 - x0, 0.24, z1 - z0);
    g.translate((x0 + x1) / 2, 0.1, (z0 + z1) / 2);
    soilGeos.push(worldUV(g));
  }
  const soil = new THREE.Mesh(mergeM(soilGeos), M.soil);
  soil.receiveShadow = true; group.add(soil);

  // palms in the four garden corners
  const bark = barkTex();
  const barkMat = new THREE.MeshStandardMaterial({ map: bark, roughness: 0.95 });
  const frondMat = new THREE.MeshStandardMaterial({ map: frondTex(), alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.9 });
  applyWind(frondMat, { strength: 0.1, y0: 2.0, y1: 5.0 });
  for (const [px, pz] of [[-4.8, -4.8], [4.8, -4.8], [-4.8, 4.8], [4.8, 4.8]]) {
    const h = 3.4 + rand() * 0.8;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, h, 8), barkMat);
    trunk.position.set(px, h / 2, pz); trunk.castShadow = true; group.add(trunk);
    const fronds = 9;
    for (let i = 0; i < fronds; i++) {
      const fr = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 2.4), frondMat);
      const a = (i / fronds) * Math.PI * 2;
      fr.position.set(px, h + 0.2, pz);
      fr.rotation.order = 'YXZ';
      fr.rotation.y = a;
      fr.rotation.x = -0.5 - rand() * 0.3;
      fr.castShadow = true;
      group.add(fr); meshes.push(fr);
    }
  }

  // low ferns/shrubs + flowers scattered in the beds (instanced crossed cards)
  const cross = mergeM([new THREE.PlaneGeometry(0.7, 0.8), new THREE.PlaneGeometry(0.7, 0.8).rotateY(Math.PI / 2)]);
  const fernTex = leafClusterTex(256, 9, -8);
  const shrubMat = new THREE.MeshStandardMaterial({ map: fernTex, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.95 });
  applyWind(shrubMat, { strength: 0.05, y0: 0.0, y1: 0.9, local: true });
  const nShrub = (tier && tier.flowers ? tier.flowers : 240);
  const shrubs = new THREE.InstancedMesh(cross, shrubMat, nShrub);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  for (let i = 0; i < nShrub; i++) {
    const b = beds[Math.floor(rand() * beds.length)];
    const x = b[0] + rand() * (b[2] - b[0]), z = b[1] + rand() * (b[3] - b[1]);
    e.set(0, rand() * Math.PI, 0); q.setFromEuler(e);
    const s = 0.8 + rand() * 0.9;
    m4.compose(new THREE.Vector3(x, 0.2 + 0.35 * s, z), q, new THREE.Vector3(s, s, s));
    shrubs.setMatrixAt(i, m4);
  }
  shrubs.instanceMatrix.needsUpdate = true; shrubs.castShadow = true; group.add(shrubs);

  // flowers in three colourways
  const hues = [14, 335, 48];
  for (let h = 0; h < hues.length; h++) {
    const fMat = new THREE.MeshStandardMaterial({ map: flowerCardTex(256, 100 + h * 13, hues[h]), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.95 });
    applyWind(fMat, { strength: 0.05, y0: 0.0, y1: 0.6, local: true });
    const per = Math.ceil((tier && tier.flowers ? tier.flowers : 240) / 3);
    const inst = new THREE.InstancedMesh(cross, fMat, per);
    for (let i = 0; i < per; i++) {
      const b = beds[Math.floor(rand() * beds.length)];
      const x = b[0] + rand() * (b[2] - b[0]), z = b[1] + rand() * (b[3] - b[1]);
      e.set(0, rand() * Math.PI, 0); q.setFromEuler(e);
      const s = 0.6 + rand() * 0.6;
      m4.compose(new THREE.Vector3(x, 0.2 + 0.3 * s, z), q, new THREE.Vector3(s, s, s));
      inst.setMatrixAt(i, m4);
    }
    inst.instanceMatrix.needsUpdate = true; group.add(inst);
  }
  return { meshes };
}

// ===========================================================================
// Colliders. AABBs in world XZ, each tagged with a `level` ('all' | 0 | 1 | 2)
// so the harness only tests those active on the player's current storey.
// ===========================================================================
export function buildColliders() {
  const c = [];
  const add = (x0, z0, x1, z1, level = 'all') => c.push({ x0, z0, x1, z1, level });
  const pier = 0.45;
  const boundaries = [-6, -3, 0, 3, 6];
  for (const side of SIDES) for (const u of boundaries) {
    let x, z;
    if (side === 'N') { x = u; z = -CR.R; } else if (side === 'S') { x = u; z = CR.R; }
    else if (side === 'E') { x = CR.R; z = u; } else { x = -CR.R; z = u; }
    add(x - pier, z - pier, x + pier, z + pier);            // colonnade piers (all levels)
  }
  for (const sx of [-CR.R, CR.R]) for (const sz of [-CR.R, CR.R]) add(sx - 0.45, sz - 0.45, sx + 0.45, sz + 0.45);

  // garden beds + palms — ground only
  const beds = [
    [-4.5, -5.5, -1.0, -4.0], [1.0, -5.5, 4.5, -4.0],
    [-4.5, 4.0, -1.0, 5.5], [1.0, 4.0, 4.5, 5.5],
    [-5.5, -4.5, -4.0, -1.0], [-5.5, 1.0, -4.0, 4.5],
    [4.0, -4.5, 5.5, -1.0], [4.0, 1.0, 5.5, 4.5],
  ];
  for (const [x0, z0, x1, z1] of beds) add(x0, z0, x1, z1, 0);
  for (const [px, pz] of [[-4.8, -4.8], [4.8, -4.8], [-4.8, 4.8], [4.8, 4.8]]) add(px - 0.3, pz - 0.3, px + 0.3, pz + 0.3, 0);

  // balustrades along the atrium edge — stop upper-floor walkers falling in
  const b = 0.16;
  for (const lvl of [1, 2]) {
    add(-6 - b, -6 - b, 6 + b, -6 + b, lvl);   // N edge
    add(-6 - b, 6 - b, 6 + b, 6 + b, lvl);     // S edge
    add(6 - b, -6, 6 + b, 6, lvl);             // E edge
    add(-6 - b, -6, -6 + b, 6, lvl);           // W edge
  }

  // stair: lane divider (all levels) forces the switchback path;
  // per-floor blockers keep you off the non-entry lane's high south platform.
  add(ST.laneDiv - 0.1, ST.fz0, ST.laneDiv + 0.1, ST.landS1, 'all');
  add(ST.laneDiv, ST.fz1 - 0.6, ST.inner[1], ST.landS1, 0);   // ground: inner south solid
  add(ST.outer[0], ST.fz1 - 0.6, ST.laneDiv, ST.landS1, 1);   // floor 2: outer south solid
  return c;
}

// ===========================================================================
// Lighting rig (Lighting.js style) — bright glazed-roof daylight, warm, with
// angled sun for the diagonal rafter shadows. Call once after building.
// ===========================================================================
export function setupCourtyardLighting(scene, renderer, tier) {
  if (renderer) {
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  }
  const hemi = new THREE.HemisphereLight(0xf4f7fa, 0xa89a80, 1.2);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xfff2df, 3.3);
  sun.position.set(13, 34, 15);
  sun.target.position.set(-1, 0, -2);
  sun.castShadow = true;
  const ss = (tier && tier.shadowSize) || 2048;
  sun.shadow.mapSize.setScalar(ss);
  const S = 14;
  sun.shadow.camera.left = -S; sun.shadow.camera.right = S;
  sun.shadow.camera.top = S; sun.shadow.camera.bottom = -S;
  sun.shadow.camera.near = 4; sun.shadow.camera.far = 90;
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);

  // soft sky bounce fill from straight above (no shadow) to open the arcades
  const fill = new THREE.DirectionalLight(0xe6eef4, 0.8);
  fill.position.set(-6, 20, -8);
  scene.add(fill);
  // gentle warm ambient so shadowed plaster reads cream, not grey
  scene.add(new THREE.AmbientLight(0xfff3e4, 0.35));

  return { hemi, sun, fill, bake: () => { if (renderer) renderer.shadowMap.needsUpdate = true; } };
}
