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

// ---- corner elevator (NW), the only connector between the three storeys -----
// Footprint nested into the North+West perimeter corner. `liftY` is the single
// source of truth for the player's floor: since the lift is the only way to
// change storeys, the player's walking height always equals liftY, so the shaft
// footprint is always flush with their level — no fall-through, even with the
// hole cut through the ring slabs for the cabin to travel.
export const LIFT = { x0: -8.7, z0: -8.7, x1: -6.5, z1: -6.5 };
const LIFT_SPEED = 2.4;      // m/s cabin travel
let liftY = 0;               // current cabin height (= player floor height)
let liftTargetY = 0;         // requested floor height
let liftMoving = false;

function inLift(x, z) { return x > LIFT.x0 && x < LIFT.x1 && z > LIFT.z0 && z < LIFT.z1; }
function inRing(x, z) { const m = Math.max(Math.abs(x), Math.abs(z)); return m > CR.R - 0.05 && m < CR.wallIn + 0.05; }

// Analytic ground height, prevY-driven (layout.js trick): the storey a player
// is on is inferred from height, so the same XZ carries all three levels. The
// elevator (returning liftY) is now the one connector between them.
export function courtyardGround(x, z, prevY = 0) {
  if (inLift(x, z)) return liftY;
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
  // Complete hallway rings on each upper floor, with a rectangular hole cut at
  // the NW corner for the elevator shaft (the North strip is split around it).
  for (let fl = 1; fl <= 2; fl++) stoneGeos.push(...ringSlab(CR.floors[fl]));

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
      if (side === 'W') continue;   // the West wall carries the elevator — no doors
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

  // --- corner elevator cabin + butterflies ----------------------------------
  const cabin = buildLiftCabin(M);
  cabin.position.y = liftY;
  group.add(cabin);
  const butterflies = buildButterflies(group, tier, rand);

  scene.add(group);

  // Ride animation: ease liftY toward the requested floor; the cabin mesh and
  // (via courtyardGround) the player both follow it.
  let lastT = 0;
  function update(t) {
    const dt = Math.min(0.05, Math.max(0, t - lastT));
    lastT = t;
    tickWind(t);
    if (liftMoving) {
      const dir = Math.sign(liftTargetY - liftY);
      liftY += dir * LIFT_SPEED * dt;
      if (dir === 0 || (dir > 0 && liftY >= liftTargetY) || (dir < 0 && liftY <= liftTargetY)) {
        liftY = liftTargetY;
        liftMoving = false;
      }
      cabin.position.y = liftY;
    }
    butterflies.update(t);
  }

  function selectFloor(i) {
    liftTargetY = CR.floors[i];
    liftMoving = liftTargetY !== liftY;
  }

  return {
    group,
    spawn: { x: 1.5, z: 7.1, yaw: 0 },  // south walkway, down a bay axis into the garden
    colliders: buildColliders(),
    groundHeight: courtyardGround,       // analytic 3-level walk (elevator connector)
    update,
    flora,
    butterflies,
    lift: {
      panel: cabin.userData.panel,
      floors: CR.floors,
      labels: ['Ground floor', 'Second floor', 'Third floor'],
      selectFloor,
      currentIndex: () => CR.floors.reduce((best, f, i) => Math.abs(f - liftY) < Math.abs(CR.floors[best] - liftY) ? i : best, 0),
    },
    get liftMoving() { return liftMoving; },
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
// A complete hallway floor ring at height y (outer square `o`, inner `iN`),
// with a rectangular hole cut at the NW corner for the elevator shaft. The
// North strip is split into four pieces around the hole.
function ringSlab(y) {
  const o = CR.wallIn, iN = CR.R - 0.1, t = CR.slabT, yc = y - t / 2;
  const boxes = [];
  const strip = (x0, z0, x1, z1) => {
    if (x1 - x0 <= 0 || z1 - z0 <= 0) return;
    boxes.push(new THREE.BoxGeometry(x1 - x0, t, z1 - z0).translate((x0 + x1) / 2, yc, (z0 + z1) / 2));
  };
  strip(-o, iN, o, o);            // south strip
  strip(iN, -iN, o, iN);         // east strip
  strip(-o, -iN, -iN, iN);       // west strip (now whole — no stairwell void)
  // north strip, split around the lift-shaft hole
  strip(-o, -o, LIFT.x0, -iN);            // west of hole
  strip(LIFT.x1, -o, o, -iN);             // east of hole
  strip(LIFT.x0, -o, LIFT.x1, LIFT.z0);   // north of hole
  strip(LIFT.x0, LIFT.z1, LIFT.x1, -iN);  // south of hole
  return boxes.map(worldUV);
}

// ---------------------------------------------------------------------------
// Elevator cabin: a small wood-panelled car in the NW corner. It rides in Y
// (set each frame to liftY). The back two sides sit against the perimeter walls
// (already solid via the keep-in box); the East side is a solid wall carrying
// the button panel, and the South side is a partial wall leaving a doorway.
function buildLiftCabin(M) {
  const g = new THREE.Group();
  g.name = 'liftCabin';
  const cx = (LIFT.x0 + LIFT.x1) / 2, cz = (LIFT.z0 + LIFT.z1) / 2;
  const w = LIFT.x1 - LIFT.x0, d = LIFT.z1 - LIFT.z0, H = 2.6;
  const wall = M.woodDark, floorMat = M.stone;

  const floor = new THREE.Mesh(new THREE.BoxGeometry(w, 0.12, d), floorMat);
  floor.position.set(cx, -0.06, cz); floor.receiveShadow = true; g.add(floor);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(w, 0.08, d), wall);
  roof.position.set(cx, H, cz); g.add(roof);
  const north = new THREE.Mesh(new THREE.BoxGeometry(w, H, 0.08), wall);
  north.position.set(cx, H / 2, LIFT.z0 + 0.04); g.add(north);
  const west = new THREE.Mesh(new THREE.BoxGeometry(0.08, H, d), wall);
  west.position.set(LIFT.x0 + 0.04, H / 2, cz); g.add(west);
  const east = new THREE.Mesh(new THREE.BoxGeometry(0.08, H, d), wall);
  east.position.set(LIFT.x1 - 0.04, H / 2, cz); g.add(east);
  const southW = new THREE.Mesh(new THREE.BoxGeometry(1.0, H, 0.08), wall);  // partial → doorway
  southW.position.set(LIFT.x0 + 0.5, H / 2, LIFT.z1 - 0.04); g.add(southW);

  // button panel on the East wall, facing into the cabin (-X)
  const panel = new THREE.Mesh(
    new THREE.PlaneGeometry(0.5, 0.92),
    new THREE.MeshStandardMaterial({ map: liftPanelTex(), roughness: 0.5, metalness: 0.1 })
  );
  panel.position.set(LIFT.x1 - 0.09, 1.35, cz);
  panel.rotation.y = -Math.PI / 2;
  panel.name = 'liftPanel';
  g.add(panel);
  g.userData.panel = panel;
  return g;
}

function liftPanelTex() {
  const [c, ctx] = cv(256);
  ctx.fillStyle = '#2a2622'; ctx.fillRect(0, 0, 256, 256);
  ctx.fillStyle = '#c9b48a'; ctx.strokeStyle = '#c9b48a'; ctx.lineWidth = 4;
  ctx.strokeRect(8, 8, 240, 240);
  ctx.textAlign = 'center'; ctx.font = 'bold 30px Georgia';
  ctx.fillText('LIFT', 128, 44);
  const rows = [['3', 'Third'], ['2', 'Second'], ['1', 'Ground']];
  for (let i = 0; i < 3; i++) {
    const cy = 96 + i * 54;
    ctx.fillStyle = '#e7dcc5'; ctx.beginPath(); ctx.arc(58, cy, 22, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2a2622'; ctx.font = 'bold 30px Georgia'; ctx.textAlign = 'center';
    ctx.fillText(rows[i][0], 58, cy + 10);
    ctx.fillStyle = '#e7dcc5'; ctx.font = '22px Georgia'; ctx.textAlign = 'left';
    ctx.fillText(rows[i][1] + ' floor', 92, cy + 8);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

// ---------------------------------------------------------------------------
// Butterflies: a handful of two-winged sprites that wander smooth looping
// paths over the (now open) garden, yaw toward their heading, and flap.
function buildButterflies(group, tier, rand) {
  const n = (tier && tier.name === 'low') ? 6 : 11;
  const mat = new THREE.MeshStandardMaterial({
    map: butterflyTex(), alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.85,
  });
  const flyers = [];
  for (let i = 0; i < n; i++) {
    const b = new THREE.Group();
    // body
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.02, 0.16, 6),
      new THREE.MeshStandardMaterial({ color: 0x201810, roughness: 1 }));
    body.rotation.x = Math.PI / 2; b.add(body);
    // wings — each plane's inner edge sits on the body centreline, laid flat,
    // hinged so the outer tip flaps up/down about the body (Z) axis.
    const hingeL = new THREE.Group(), hingeR = new THREE.Group();
    const wingR = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.3).translate(0.12, 0, 0), mat);
    wingR.rotation.x = -Math.PI / 2;
    const wingL = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.3).translate(-0.12, 0, 0), mat);
    wingL.rotation.x = -Math.PI / 2;
    hingeR.add(wingR); hingeL.add(wingL); b.add(hingeL, hingeR);
    group.add(b);
    flyers.push({
      b, hingeL, hingeR,
      cx: (rand() - 0.5) * 5, cz: (rand() - 0.5) * 5,
      r1: 1.6 + rand() * 1.8, r2: 0.6 + rand() * 0.8,
      s1: 0.3 + rand() * 0.3, s2: 0.7 + rand() * 0.6,
      p1: rand() * 6.28, p2: rand() * 6.28, p3: rand() * 6.28,
      yBase: 0.7 + rand() * 1.1, yAmp: 0.25 + rand() * 0.5,
      flap: 7 + rand() * 5, flapPh: rand() * 6.28,
      px: 0, pz: 0,
    });
  }
  function update(t) {
    for (const f of flyers) {
      const x = f.cx + Math.sin(t * f.s1 + f.p1) * f.r1 + Math.sin(t * f.s2 + f.p2) * f.r2;
      const z = f.cz + Math.cos(t * f.s1 * 0.9 + f.p3) * f.r1 + Math.cos(t * f.s2 + f.p1) * f.r2;
      const y = f.yBase + Math.sin(t * f.s2 * 0.8 + f.p2) * f.yAmp;
      f.b.position.set(x, y, z);
      const dx = x - f.px, dz = z - f.pz;
      if (dx * dx + dz * dz > 1e-6) f.b.rotation.y = Math.atan2(dx, dz);
      f.px = x; f.pz = z;
      const flap = 0.15 + 0.85 * (0.5 + 0.5 * Math.sin(t * f.flap + f.flapPh));
      f.hingeR.rotation.z = -flap;
      f.hingeL.rotation.z = flap;
    }
  }
  return { flyers, update };
}

function butterflyTex() {
  const [c, ctx] = cv(128);
  ctx.clearRect(0, 0, 128, 128);
  // one wing filling the canvas (the quad is a single wing); warm orange, dark rim + spots
  ctx.fillStyle = '#e08a2c';
  ctx.beginPath(); ctx.ellipse(64, 64, 52, 40, 0, 0, Math.PI * 2); ctx.fill();
  ctx.lineWidth = 7; ctx.strokeStyle = '#2a1c10';
  ctx.beginPath(); ctx.ellipse(64, 64, 52, 40, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#2a1c10';
  ctx.beginPath(); ctx.arc(86, 48, 8, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(86, 82, 8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f6d17a';
  ctx.beginPath(); ctx.arc(50, 64, 6, 0, Math.PI * 2); ctx.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
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
  // rafters lying ALONG each slope, spaced across X. Each beam runs from the
  // eave up to the ridge; the two sides' top ends meet at the ridge line (z≈0),
  // completing the pitch. `ang` is the shallow slope tilt from horizontal.
  const n = 13;
  for (let i = 0; i <= n; i++) {
    const x = -half + (2 * half / n) * i;
    for (const dir of [-1, 1]) {
      const g = new THREE.BoxGeometry(0.12, 0.2, slopeLen);
      worldUV(g);
      g.rotateX(dir * ang);                              // tilt onto the slope
      g.translate(x, (eave + ridge) / 2 + 0.12, dir * half / 2);
      darkGeos.push(g);
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
    [-5.7, -5.7, -3.2, -3.2], [3.2, -5.7, 5.7, -3.2],   // NW, NE corner beds
    [-5.7, 3.2, -3.2, 5.7], [3.2, 3.2, 5.7, 5.7],       // SW, SE corner beds
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
    [-5.7, -5.7, -3.2, -3.2], [3.2, -5.7, 5.7, -3.2],   // NW, NE corner beds
    [-5.7, 3.2, -3.2, 5.7], [3.2, 3.2, 5.7, 5.7],       // SW, SE corner beds
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

  // elevator cabin: solid East wall + a partial South wall leaving a doorway on
  // the +X end. The North & West sides are covered by the perimeter keep-in box.
  // 'all' levels — the cabin is always at the player's floor (liftY invariant).
  add(LIFT.x1 - 0.06, LIFT.z0, LIFT.x1 + 0.06, LIFT.z1, 'all');          // east wall
  add(LIFT.x0, LIFT.z1 - 0.06, LIFT.x0 + 1.0, LIFT.z1 + 0.06, 'all');    // south wall (doorway past x0+1.0)
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
