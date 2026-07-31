import * as THREE from 'three';
import { fitToSlot } from '../../art/fit.js';
import { loadArtTexture } from '../../art/load.js';
import { generatePainting } from '../../art/placeholder.js';
import { mulberry32 } from '../../utils/proctex.js';

// ---------------------------------------------------------------------------
// BRUTALISM HALL — residency four (room id `brutalist`).
//
// One volume, four storeys, board-formed concrete. The floor plates are rings
// around a single void, so from anywhere on the ground you can see all the way
// up; and the climb is deliberately awkward — each flight is against a
// DIFFERENT wall, so getting to the top walks you round the void three times
// and past every picture in the hall.
//
//   ground → level 1   west wall
//   level 1 → level 2  north wall
//   level 2 → level 3  east wall
//
// Level 3 is not a ring. It is a glass floor over the whole void: you stand on
// it, under the skylight slot, and look 13 m straight down.
//
// The level-1 east wall is missing over its northern half — the hall walks out
// there onto a terrace with an infinity pool and the city under it.
//
// Local coordinates, centred: x −13…13, z −17…17, y up. Metres.
//
//   const room = buildBrutalistRoom(scene, { tier, art: BRUTALIST_HANG });
//   const lights = setupBrutalistLighting(scene, renderer, tier);
//   room.update(dt);   // the water; everything else is static
//
// Nothing adds itself outside `scene` — main.js builds the room inside
// rooms.captureLayer() so every mesh and every light hides with it.
// ---------------------------------------------------------------------------

export const BX = {
  x0: -13, x1: 13,
  z0: -17, z1: 17,
  wallT: 0.5,
  storey: 4.4,               // FLOOR_HEIGHT, same as the lift's
  roofY: 17.6,               // underside of the waffle slab: four storeys
  slab: 0.45,
  ring: 4.5,                 // depth of the gallery walkway on levels 1 and 2
  slot: { x0: -3.0, x1: 3.0, z0: -11, z1: 11 },   // skylight cut, over the void
};

export const LEVELS = [0, 4.4, 8.8, 13.2];
// The void the rings run round — and, at level 3, what the glass spans.
export const VOID = { x0: -8.5, x1: 8.5, z0: -12.5, z1: 12.5 };

// The three flights. Each is a run of cantilevered treads against one wall,
// with a cast upstand on the open side and nothing else. `axis` is the one it
// travels along; it climbs from `from` to `to`.
export const STAIRS = [
  { id: 'S1', axis: 'z', wall: 'w', x0: -13, x1: -10.6, a: 9.0, b: -2.6, y0: 0, y1: 4.4, steps: 24 },
  { id: 'S2', axis: 'x', wall: 'n', z0: -17, z1: -14.6, a: -9.0, b: 2.6, y0: 4.4, y1: 8.8, steps: 24 },
  { id: 'S3', axis: 'z', wall: 'e', x0: 10.6, x1: 13, a: -9.0, b: 2.6, y0: 8.8, y1: 13.2, steps: 24 },
];

// The terrace: level 1 walks straight out of the missing east wall.
export const COURT = { x0: 13, x1: 25.4, z0: -17, z1: -9.0, y: 4.4, slab: 0.5, parapet: 1.05 };
// The pool starts INSIDE. It is cut into the level-1 plate at x 9.6, runs out
// through the missing wall, and finishes at the building edge — so you swim (or
// at least stand) under the concrete before the water goes over the city. Its
// tank hangs below the plate into the ground-floor storey, where the soffit of
// it is visible from underneath.
export const POOL = { x0: 9.6, xWall: 13, x1: COURT.x1, z0: -16.2, z1: -10.2, depth: 1.2, drop: 0.07 };

// Freestanding fin on the ground floor, the only object in the room.
export const FIN = { x0: -3.4, x1: 3.4, z: 6.5, t: 0.55, h: 5.4 };

// Hanging slots. `n` faces out of the wall; (maxW, maxH) is the largest picture
// that face takes, contain-fitted per artwork by fitToSlot. Nothing is framed.
export const SLOTS = [
  /* 0 */ { id: 'BX-G1', pos: [-4.5, 2.15, BX.z0 + 0.26], n: [0, 0, 1], maxW: 5.0, maxH: 2.9 },
  /* 1 */ { id: 'BX-G2', pos: [4.5, 2.10, BX.z0 + 0.26], n: [0, 0, 1], maxW: 4.0, maxH: 2.8 },
  /* 2 */ { id: 'BX-G3', pos: [-1.5, 2.60, FIN.z + FIN.t / 2 + 0.02], n: [0, 0, 1], maxW: 2.4, maxH: 3.2 },
  /* 3 */ { id: 'BX-G4', pos: [1.5, 2.60, FIN.z - FIN.t / 2 - 0.02], n: [0, 0, -1], maxW: 2.4, maxH: 3.2 },
  /* 4 */ { id: 'BX-L1A', pos: [BX.x0 + 0.26, 6.50, -6.0], n: [1, 0, 0], maxW: 3.0, maxH: 3.2 },
  /* 5 */ { id: 'BX-L1B', pos: [-4.0, 6.50, BX.z1 - 0.26], n: [0, 0, -1], maxW: 3.4, maxH: 3.2 },
  /* 6 */ { id: 'BX-L2A', pos: [BX.x0 + 0.26, 10.90, 6.0], n: [1, 0, 0], maxW: 3.0, maxH: 3.2 },
  /* 7 */ { id: 'BX-L2B', pos: [4.0, 10.90, BX.z1 - 0.26], n: [0, 0, -1], maxW: 3.4, maxH: 3.2 },
  /* 8 */ { id: 'BX-L3A', pos: [-4.5, 15.30, BX.z0 + 0.26], n: [0, 0, 1], maxW: 4.0, maxH: 3.0 },
  /* 9 */ { id: 'BX-L3B', pos: [BX.x1 - 0.26, 15.30, 6.0], n: [-1, 0, 0], maxW: 3.4, maxH: 3.0 },
];

export const SPAWN = { x: 0, z: 14.6, yaw: 0 };     // ground floor, facing up the hall
export const SUN_POS = new THREE.Vector3(34, 30, 16);

// ---------------------------------------------------------------------------
// CONCRETE
//
// Every large surface gets its OWN texture, drawn at its true size and used at
// repeat (1, 1). Nothing tiles: a 34 m wall is one 34 m image, so the boards
// run the length of it, the tie holes fall on the real 900 mm grid, and the
// stains do not recur every two metres. Small parts still share a tiled sheet.
const PX_PER_M = 34;
const MAX_PX = 1600;

function boardCanvas(wM, hM, seed, tone = 176) {
  const rand = mulberry32(seed);
  const W = Math.max(64, Math.min(MAX_PX, Math.round(wM * PX_PER_M)));
  const H = Math.max(64, Math.min(MAX_PX, Math.round(hM * PX_PER_M)));
  const sx = W / wM, sy = H / hM;                 // px per metre, per axis
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');

  ctx.fillStyle = `rgb(${tone},${tone - 4},${tone - 12})`;
  ctx.fillRect(0, 0, W, H);

  // --- shutter boards, 220 mm, laid from the bottom up ---------------------
  const BOARD = 0.22;
  const rows = Math.ceil(hM / BOARD) + 1;
  for (let i = 0; i < rows; i++) {
    const y = H - (i + 1) * BOARD * sy;
    const bh = BOARD * sy;
    const shade = (rand() - 0.5) * 13;
    ctx.fillStyle = `rgb(${tone + shade},${tone - 4 + shade},${tone - 12 + shade})`;
    ctx.fillRect(0, y, W, bh);

    // grain: long drags that run the whole board, not per-tile squiggles
    const drags = Math.max(5, Math.round(wM * 1.1));
    for (let g = 0; g < drags; g++) {
      const gy = y + rand() * bh;
      ctx.strokeStyle = `rgba(${tone - 34},${tone - 38},${tone - 46},${0.04 + rand() * 0.07})`;
      ctx.lineWidth = 0.5 + rand() * 1.8;
      ctx.beginPath();
      ctx.moveTo(-10, gy);
      for (let x = 0; x <= W; x += W / 6) ctx.lineTo(x, gy + (rand() - 0.5) * 2.4);
      ctx.stroke();
    }
    // the joint under each board, and the light lip above it
    ctx.fillStyle = `rgba(58,54,48,${0.22 + rand() * 0.18})`;
    ctx.fillRect(0, y + bh - Math.max(1, sy * 0.006), W, Math.max(1, sy * 0.006));
    ctx.fillStyle = 'rgba(255,252,245,0.09)';
    ctx.fillRect(0, y + bh, W, Math.max(1, sy * 0.004));
    // an occasional board that ends mid-wall — a butt joint, drawn vertical
    if (rand() > 0.55 && wM > 4) {
      const jx = rand() * W;
      ctx.fillStyle = 'rgba(56,52,46,0.3)';
      ctx.fillRect(jx, y, Math.max(1, sx * 0.006), bh);
    }
  }

  // --- form-tie holes on a 900 × 660 grid ----------------------------------
  for (let gx = 0.6; gx < wM; gx += 0.9) {
    for (let gy = 0.44; gy < hM; gy += 0.66) {
      const cx = gx * sx, cy = H - gy * sy;
      const r = Math.max(2.5, 0.021 * Math.min(sx, sy));
      const grd = ctx.createRadialGradient(cx, cy - r * 0.35, r * 0.15, cx, cy, r * 2.1);
      grd.addColorStop(0, 'rgba(48,44,40,0.9)');
      grd.addColorStop(0.55, 'rgba(94,90,83,0.42)');
      grd.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = grd;
      ctx.beginPath(); ctx.arc(cx, cy, r * 2.1, 0, Math.PI * 2); ctx.fill();
      // the pale plug ring
      ctx.strokeStyle = 'rgba(226,220,208,0.28)';
      ctx.lineWidth = Math.max(0.6, r * 0.28);
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
    }
  }

  // --- weathering: pour blotches, then rain streaks off the top ------------
  for (let b = 0; b < Math.round(wM * hM * 0.5) + 14; b++) {
    ctx.fillStyle = `rgba(${tone - 30},${tone - 32},${tone - 34},${0.02 + rand() * 0.05})`;
    ctx.beginPath();
    ctx.ellipse(rand() * W, rand() * H, sx * (0.3 + rand() * 1.6), sy * (0.25 + rand() * 1.2), rand() * 3.14, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let s = 0; s < Math.round(wM * 0.8); s++) {
    const x = rand() * W;
    const len = H * (0.15 + rand() * 0.6);
    const grd = ctx.createLinearGradient(0, 0, 0, len);
    grd.addColorStop(0, `rgba(${tone - 46},${tone - 46},${tone - 44},0.16)`);
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grd;
    ctx.fillRect(x, 0, sx * (0.05 + rand() * 0.22), len);
  }
  // a wash of very large, very soft light/dark to break any remaining evenness
  for (let i = 0; i < 8; i++) {
    const g2 = ctx.createRadialGradient(rand() * W, rand() * H, 0, rand() * W, rand() * H, Math.max(W, H) * (0.3 + rand() * 0.5));
    const dark = rand() > 0.5;
    g2.addColorStop(0, dark ? 'rgba(70,66,60,0.10)' : 'rgba(255,250,240,0.09)');
    g2.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g2;
    ctx.fillRect(0, 0, W, H);
  }

  return c;
}

// A one-off, non-repeating surface texture at the surface's own size.
function surfaceTex(wM, hM, seed, tone) {
  const t = new THREE.CanvasTexture(boardCanvas(wM, hM, seed, tone));
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function surfaceMat(wM, hM, seed, { tone = 176, color = 0xffffff, roughness = 0.93 } = {}) {
  return new THREE.MeshStandardMaterial({
    map: surfaceTex(wM, hM, seed, tone), color, roughness, metalness: 0,
  });
}

const box = (w, h, d, mat, x, y, z, name) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  if (name) m.name = name;
  return m;
};

// ---------------------------------------------------------------------------
// WATER
// A tileable ripple normal map: a few crossed swells summed into a height
// field, differentiated into normals. Two copies of it scroll across each other
// in update(), which is what stops still water reading as a sheet of plastic.
function rippleNormal(size = 256, seed = 5) {
  const rand = mulberry32(seed);
  const waves = [];
  for (let i = 0; i < 5; i++) {
    const a = rand() * Math.PI * 2;
    const k = (1 + Math.floor(rand() * 4)) * Math.PI * 2 / size;
    waves.push({ kx: Math.cos(a) * k * (1 + Math.floor(rand() * 3)), kz: Math.sin(a) * k * (1 + Math.floor(rand() * 3)), amp: 0.6 / (i + 1), ph: rand() * 6.28 });
  }
  const h = (x, y) => waves.reduce((s, w) => s + w.amp * Math.sin(w.kx * x + w.kz * y + w.ph), 0);
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = h(x + 1, y) - h(x - 1, y);
      const dy = h(x, y + 1) - h(x, y - 1);
      const nx = -dx * 0.9, ny = -dy * 0.9, nz = 1;
      const len = Math.hypot(nx, ny, nz);
      const i = (y * size + x) * 4;
      img.data[i] = ((nx / len) * 0.5 + 0.5) * 255;
      img.data[i + 1] = ((ny / len) * 0.5 + 0.5) * 255;
      img.data[i + 2] = ((nz / len) * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// ---------------------------------------------------------------------------
export function buildBrutalistRoom(scene, opts = {}) {
  const art = opts.art || [];
  const tier = opts.tier || {};
  const aniso = opts.anisotropy ?? 8;
  const maxEdge = opts.artMaxEdge ?? 0;

  const g = new THREE.Group();
  g.name = 'brutalist-hall';
  scene.add(g);

  const W = BX.x1 - BX.x0, D = BX.z1 - BX.z0, H = BX.roofY, T = BX.wallT;

  // --- ground slab ---------------------------------------------------------
  const floor = box(W, 0.6, D, surfaceMat(W, D, 3101, { tone: 168, roughness: 0.95 }), 0, -0.3, 0, 'bx-floor');
  floor.castShadow = false;
  g.add(floor);

  // --- perimeter walls -----------------------------------------------------
  // Each is its own image, so no two walls in the room share a stain.
  g.add(box(T, H, D + T * 2, surfaceMat(D, H, 4201), BX.x0 - T / 2, H / 2 - 0.6, 0, 'bx-wall-w'));
  g.add(box(W + T * 2, H, T, surfaceMat(W, H, 4202), 0, H / 2 - 0.6, BX.z1 + T / 2, 'bx-wall-s'));
  g.add(box(W + T * 2, H, T, surfaceMat(W, H, 4203), 0, H / 2 - 0.6, BX.z0 - T / 2, 'bx-wall-n'));
  // East: full height south of the terrace; north of it the level-1 storey is
  // simply not there, so the wall is built in two pieces around the opening.
  const eFull = BX.z1 + T - COURT.z1;
  g.add(box(T, H, eFull, surfaceMat(eFull, H, 4204), BX.x1 + T / 2, H / 2 - 0.6, (COURT.z1 + BX.z1 + T) / 2, 'bx-wall-e'));
  const openD = COURT.z1 - (BX.z0 - T);
  const lowH = LEVELS[1] + 0.6;                 // ground storey, under the terrace
  // …and where the pool crosses the wall line the low wall is cut too, so the
  // water runs through in one piece.
  const lowPieces = [[BX.z0 - T, POOL.z0], [POOL.z1, COURT.z1]];
  for (const [z0, z1] of lowPieces) {
    const d = z1 - z0;
    if (d <= 0.01) continue;
    g.add(box(T, lowH, d, surfaceMat(d, lowH, 4205 + Math.round(z0)), BX.x1 + T / 2, lowH / 2 - 0.6, (z0 + z1) / 2, 'bx-wall-e-low'));
  }
  // under the pool crossing, only the strip below the tank survives
  const underH = LEVELS[1] - POOL.depth + 0.6 - 0.2;
  g.add(box(T, underH, POOL.z1 - POOL.z0, surfaceMat(POOL.z1 - POOL.z0, underH, 4207),
    BX.x1 + T / 2, underH / 2 - 0.6, (POOL.z0 + POOL.z1) / 2, 'bx-wall-e-under-pool'));
  const upY = LEVELS[2], upH = H - 0.6 - upY;   // levels 2 and 3, over the opening
  g.add(box(T, upH, openD, surfaceMat(openD, upH, 4206), BX.x1 + T / 2, upY + upH / 2, (BX.z0 - T + COURT.z1) / 2, 'bx-wall-e-up'));

  // --- floor plates --------------------------------------------------------
  // Levels 1 and 2 are rings: four strips round the void, with a hole left in
  // each for the flight that arrives through it.
  const plateMat = (w, d, seed) => surfaceMat(w, d, seed, { tone: 172, roughness: 0.94 });
  const strip = (x0, z0, x1, z1, y, seed, name) => {
    if (x1 - x0 <= 0.01 || z1 - z0 <= 0.01) return;
    const m = box(x1 - x0, BX.slab, z1 - z0, plateMat(x1 - x0, z1 - z0, seed),
      (x0 + x1) / 2, y - BX.slab / 2, (z0 + z1) / 2, name);
    m.castShadow = true;
    g.add(m);
  };
  const S1 = STAIRS[0], S2 = STAIRS[1], S3 = STAIRS[2];

  // level 1 — the west strip is interrupted by the flight coming up through it.
  // The plates run right up to each flight's TOP coordinate, so the last tread
  // and the walkway share an edge — cut them back and you step into the void.
  strip(BX.x0, VOID.z0, S1.x1, S1.b, LEVELS[1], 5101, 'bx-l1-w');             // the landing side
  strip(BX.x0, S1.a + 0.4, S1.x1, VOID.z1, LEVELS[1], 5102, 'bx-l1-w2');      // past the foot of it
  strip(S1.x1, VOID.z0, VOID.x0, VOID.z1, LEVELS[1], 5103, 'bx-l1-w3');        // the rest of the west walk
  strip(VOID.x1, VOID.z0, POOL.x0, VOID.z1, LEVELS[1], 5104, 'bx-l1-e');
  strip(POOL.x0, POOL.z1, BX.x1, VOID.z1, LEVELS[1], 5107, 'bx-l1-e2');   // south of the tank
  strip(BX.x0, BX.z0, POOL.x0, VOID.z0, LEVELS[1], 5105, 'bx-l1-n');
  strip(POOL.x0, BX.z0, BX.x1, POOL.z0, LEVELS[1], 5108, 'bx-l1-n2');     // north of the tank
  strip(BX.x0, VOID.z1, BX.x1, BX.z1, LEVELS[1], 5106, 'bx-l1-s');

  // level 2 — the hole is in the north strip this time
  strip(BX.x0, BX.z0, S2.a - 0.4, VOID.z0, LEVELS[2], 5201, 'bx-l2-n');
  strip(S2.b, BX.z0, BX.x1, VOID.z0, LEVELS[2], 5202, 'bx-l2-n2');
  strip(S2.a - 0.4, S2.z1, S2.b, VOID.z0, LEVELS[2], 5203, 'bx-l2-n3');
  strip(BX.x0, VOID.z1, BX.x1, BX.z1, LEVELS[2], 5204, 'bx-l2-s');
  strip(BX.x0, VOID.z0, VOID.x0, VOID.z1, LEVELS[2], 5205, 'bx-l2-w');
  strip(VOID.x1, VOID.z0, BX.x1, VOID.z1, LEVELS[2], 5206, 'bx-l2-e');

  // level 3 — the concrete ring, with the east flight's hole in it…
  strip(BX.x0, BX.z0, BX.x1, VOID.z0, LEVELS[3], 5301, 'bx-l3-n');
  strip(BX.x0, VOID.z1, BX.x1, BX.z1, LEVELS[3], 5302, 'bx-l3-s');
  strip(BX.x0, VOID.z0, VOID.x0, VOID.z1, LEVELS[3], 5303, 'bx-l3-w');
  strip(VOID.x1, VOID.z0, S3.x0, VOID.z1, LEVELS[3], 5304, 'bx-l3-e');
  strip(S3.x0, VOID.z0, BX.x1, S3.a - 0.4, LEVELS[3], 5305, 'bx-l3-e2');
  strip(S3.x0, S3.b, BX.x1, VOID.z1, LEVELS[3], 5306, 'bx-l3-e3');

  // …and the glass floor over the void. You walk on it, and the hall drops
  // 13 m under your feet.
  const glassMat = tier.glassTransmission === false
    ? new THREE.MeshStandardMaterial({
        color: 0xcfe0e2, transparent: true, opacity: 0.26,
        roughness: 0.1, metalness: 0.2, side: THREE.DoubleSide, depthWrite: false,
      })
    : new THREE.MeshPhysicalMaterial({
        color: 0xdcebe9, transmission: 0.94, roughness: 0.06, metalness: 0,
        ior: 1.52, thickness: 0.05, transparent: true, side: THREE.DoubleSide,
      });
  const glass = new THREE.Mesh(new THREE.BoxGeometry(VOID.x1 - VOID.x0, 0.06, VOID.z1 - VOID.z0), glassMat);
  glass.position.set(0, LEVELS[3] - 0.03, 0);
  glass.name = 'bx-glass-floor';
  glass.receiveShadow = false;
  g.add(glass);

  // Steel bearers under the glass on a 2.5 m grid — the thing that makes it
  // read as a floor you can stand on rather than a hole with a tint.
  const steel = new THREE.MeshStandardMaterial({ color: 0x35363a, roughness: 0.42, metalness: 0.8 });
  for (let x = VOID.x0 + 2.5; x < VOID.x1 - 0.1; x += 2.5) {
    g.add(box(0.09, 0.22, VOID.z1 - VOID.z0, steel, x, LEVELS[3] - 0.17, 0, 'bx-bearer'));
  }
  for (let z = VOID.z0 + 2.5; z < VOID.z1 - 0.1; z += 2.5) {
    g.add(box(VOID.x1 - VOID.x0, 0.22, 0.09, steel, 0, LEVELS[3] - 0.17, z, 'bx-bearer'));
  }

  // --- void balustrades ----------------------------------------------------
  // A cast upstand, knee-to-waist, on every open edge of levels 1 and 2. Solid,
  // because a brutalist hall does not do slender rails.
  const upstandMat = surfaceMat(24, 1.1, 6001, { tone: 182 });
  const upstand = (x0, z0, x1, z1, y, name) => {
    const w = Math.max(0.3, x1 - x0), d = Math.max(0.3, z1 - z0);
    const m = box(w, 1.05, d, upstandMat, (x0 + x1) / 2, y + 0.525, (z0 + z1) / 2, name);
    g.add(m);
  };
  for (const y of [LEVELS[1], LEVELS[2]]) {
    upstand(VOID.x0 - 0.3, VOID.z0 - 0.3, VOID.x0, VOID.z1 + 0.3, y, 'bx-upstand');
    upstand(VOID.x1, VOID.z0 - 0.3, VOID.x1 + 0.3, VOID.z1 + 0.3, y, 'bx-upstand');
    upstand(VOID.x0 - 0.3, VOID.z0 - 0.3, VOID.x1 + 0.3, VOID.z0, y, 'bx-upstand');
    upstand(VOID.x0 - 0.3, VOID.z1, VOID.x1 + 0.3, VOID.z1 + 0.3, y, 'bx-upstand');
  }

  // --- the three flights ---------------------------------------------------
  const treadMat = surfaceMat(3, 6, 6101, { tone: 186, roughness: 0.9 });
  for (const s of STAIRS) {
    const dy = (s.y1 - s.y0) / s.steps;
    const span = s.b - s.a;                 // signed: the direction of travel
    const run = span / s.steps;
    for (let i = 1; i <= s.steps; i++) {
      const y = s.y0 + i * dy;
      const mid = s.a + (i - 0.5) * run;
      if (s.axis === 'z') {
        g.add(box(s.x1 - s.x0, 0.16, Math.abs(run) + 0.02, treadMat, (s.x0 + s.x1) / 2, y - 0.08, mid, 'bx-tread'));
      } else {
        g.add(box(Math.abs(run) + 0.02, 0.16, s.z1 - s.z0, treadMat, mid, y - 0.08, (s.z0 + s.z1) / 2, 'bx-tread'));
      }
    }
    // the raking upstand on the open side — one wedge per flight, stepped
    for (let i = 1; i <= s.steps; i++) {
      const y = s.y0 + i * dy;
      const mid = s.a + (i - 0.5) * run;
      if (s.axis === 'z') {
        const edge = s.wall === 'w' ? s.x1 - 0.14 : s.x0 + 0.14;
        g.add(box(0.28, 1.0, Math.abs(run) + 0.02, treadMat, edge, y + 0.5, mid, 'bx-stair-upstand'));
      } else {
        const edge = s.z1 - 0.14;
        g.add(box(Math.abs(run) + 0.02, 1.0, 0.28, treadMat, mid, y + 0.5, edge, 'bx-stair-upstand'));
      }
    }
  }

  // --- the slab overhead ---------------------------------------------------
  const soffitY = BX.roofY;
  const S = BX.slot;
  const soffitMat = surfaceMat(W, D, 7001, { tone: 170, roughness: 0.94 });
  const plate = (x0, x1, z0, z1) => {
    if (x1 - x0 <= 0.01 || z1 - z0 <= 0.01) return;
    const m = box(x1 - x0, 0.55, z1 - z0, soffitMat, (x0 + x1) / 2, soffitY + 0.275, (z0 + z1) / 2, 'bx-soffit');
    m.receiveShadow = false;
    g.add(m);
  };
  plate(BX.x0, S.x0, BX.z0, BX.z1);
  plate(S.x1, BX.x1, BX.z0, BX.z1);
  plate(S.x0, S.x1, BX.z0, S.z0);
  plate(S.x0, S.x1, S.z1, BX.z1);
  const revealMat = surfaceMat(S.z1 - S.z0, 1.6, 7002, { tone: 196, roughness: 0.9 });
  g.add(box(0.4, 1.6, S.z1 - S.z0, revealMat, S.x0 - 0.2, soffitY + 1.35, (S.z0 + S.z1) / 2, 'bx-reveal-w'));
  g.add(box(0.4, 1.6, S.z1 - S.z0, revealMat, S.x1 + 0.2, soffitY + 1.35, (S.z0 + S.z1) / 2, 'bx-reveal-e'));

  // waffle ribs on a 1.6 m grid, instanced, broken round the slot
  const ribMat = new THREE.MeshStandardMaterial({ color: 0xa6a196, roughness: 0.95 });
  const RIB = { pitch: 1.6, w: 0.22, h: 0.55 };
  const addRibs = (geo, list, place) => {
    const inst = new THREE.InstancedMesh(geo, ribMat, list.length * 2);
    const dummy = new THREE.Object3D();
    let i = 0;
    for (const v of list) {
      for (const [px, pz, sx, sz] of place(v)) {
        dummy.position.set(px, soffitY - RIB.h / 2, pz);
        dummy.scale.set(sx, 1, sz);
        dummy.updateMatrix();
        inst.setMatrixAt(i++, dummy.matrix);
      }
    }
    inst.count = i;
    inst.instanceMatrix.needsUpdate = true;
    inst.castShadow = true;
    g.add(inst);
  };
  const ribsZ = [], ribsX = [];
  for (let z = BX.z0 + RIB.pitch; z < BX.z1; z += RIB.pitch) ribsZ.push(z);
  for (let x = BX.x0 + RIB.pitch; x < BX.x1; x += RIB.pitch) ribsX.push(x);
  addRibs(new THREE.BoxGeometry(1, RIB.h, RIB.w), ribsZ, (z) => (z > S.z0 && z < S.z1
    ? [[(BX.x0 + S.x0) / 2, z, S.x0 - BX.x0, 1], [(S.x1 + BX.x1) / 2, z, BX.x1 - S.x1, 1]]
    : [[0, z, W, 1]]));
  addRibs(new THREE.BoxGeometry(RIB.w, RIB.h, 1), ribsX, (x) => (x > S.x0 && x < S.x1
    ? [[x, (BX.z0 + S.z0) / 2, 1, S.z0 - BX.z0], [x, (S.z1 + BX.z1) / 2, 1, BX.z1 - S.z1]]
    : [[x, 0, 1, D]]));

  // --- the terrace, the pool, the edge -------------------------------------
  const courtW = COURT.x1 - COURT.x0, courtD = COURT.z1 - COURT.z0;
  const podium = box(courtW, COURT.y + 0.6, courtD, surfaceMat(courtW, COURT.y + 0.6, 8001, { tone: 164, roughness: 0.95 }),
    (COURT.x0 + COURT.x1) / 2, (COURT.y + 0.6) / 2 - 0.6, (COURT.z0 + COURT.z1) / 2, 'bx-podium');
  podium.castShadow = false;
  g.add(podium);

  const paveMat = surfaceMat(courtW, courtD, 8002, { tone: 190, roughness: 0.9 });
  const pave = (x0, z0, x1, z1) => {
    if (x1 - x0 <= 0.01 || z1 - z0 <= 0.01) return;
    const m = box(x1 - x0, COURT.slab, z1 - z0, paveMat, (x0 + x1) / 2, COURT.y - COURT.slab / 2, (z0 + z1) / 2, 'bx-terrace');
    m.castShadow = false;
    g.add(m);
  };
  pave(COURT.x0, COURT.z0, COURT.x1, POOL.z0);
  pave(COURT.x0, POOL.z1, COURT.x1, COURT.z1);

  // basin — open on the city side, its rim 70 mm under the surface. Pale blue
  // tile, which is most of why pool water looks like pool water.
  const tankMat = new THREE.MeshStandardMaterial({ color: 0x3f9ec6, roughness: 0.22 });
  const basinY = COURT.y - POOL.depth;
  g.add(box(POOL.x1 - POOL.x0, 0.2, POOL.z1 - POOL.z0, tankMat, (POOL.x0 + POOL.x1) / 2, basinY - 0.1, (POOL.z0 + POOL.z1) / 2, 'bx-pool-floor'));
  const wallHt = COURT.y - POOL.drop - basinY;
  const wallY = basinY + wallHt / 2;
  g.add(box(0.18, wallHt, POOL.z1 - POOL.z0, tankMat, POOL.x0 + 0.09, wallY, (POOL.z0 + POOL.z1) / 2, 'bx-pool-w'));
  g.add(box(POOL.x1 - POOL.x0, wallHt, 0.18, tankMat, (POOL.x0 + POOL.x1) / 2, wallY, POOL.z0 + 0.09, 'bx-pool-n'));
  g.add(box(POOL.x1 - POOL.x0, wallHt, 0.18, tankMat, (POOL.x0 + POOL.x1) / 2, wallY, POOL.z1 - 0.09, 'bx-pool-s'));

  // The water itself. Physical, refracting, with two ripple normals crossing
  // each other; the surface is subdivided so the environment does not smear
  // across one enormous quad.
  const rippleA = rippleNormal(256, 5);
  const rippleB = rippleNormal(256, 19);
  const poolW = POOL.x1 - POOL.x0 + 0.06, poolD = POOL.z1 - POOL.z0;
  rippleA.repeat.set(poolW / 2.2, poolD / 2.2);
  rippleB.repeat.set(poolW / 3.7, poolD / 3.7);
  const waterMat = new THREE.MeshPhysicalMaterial({
    color: 0x1f7fa3,
    roughness: 0.035,
    metalness: 0,
    transmission: tier.glassTransmission === false ? 0 : 0.78,
    thickness: POOL.depth,
    ior: 1.333,
    attenuationColor: new THREE.Color(0x0d6a94),
    attenuationDistance: 3.4,
    clearcoat: 1,
    clearcoatRoughness: 0.04,
    clearcoatNormalMap: rippleB,
    clearcoatNormalScale: new THREE.Vector2(0.35, 0.35),
    normalMap: rippleA,
    normalScale: new THREE.Vector2(0.22, 0.22),
    transparent: tier.glassTransmission === false,
    opacity: tier.glassTransmission === false ? 0.86 : 1,
    envMapIntensity: 1.5,
    side: THREE.DoubleSide,
  });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(poolW, poolD, 48, 32), waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.set((POOL.x0 + POOL.x1) / 2 + 0.03, COURT.y - POOL.drop + 0.012, (POOL.z0 + POOL.z1) / 2);
  water.name = 'bx-water';
  g.add(water);

  // parapets: a blade to the north, a low upstand south, nothing to the east
  const parMat = surfaceMat(courtW, 3.2, 8003, { tone: 186 });
  g.add(box(courtW, 3.2, 0.4, parMat, (COURT.x0 + COURT.x1) / 2, COURT.y + 1.6, COURT.z0 + 0.2, 'bx-court-blade-n'));
  g.add(box(courtW, COURT.parapet, 0.34, parMat, (COURT.x0 + COURT.x1) / 2, COURT.y + COURT.parapet / 2, COURT.z1 - 0.17, 'bx-court-parapet-s'));

  const timber = new THREE.MeshStandardMaterial({ color: 0x8a5f37, roughness: 0.55 });
  g.add(box(0.55, 0.42, 3.4, timber, COURT.x0 + 0.6, COURT.y + 0.21, -12.4, 'bx-court-bench'));

  // --- the fin, monoliths, pods -------------------------------------------
  g.add(box(FIN.x1 - FIN.x0, FIN.h, FIN.t, surfaceMat(FIN.x1 - FIN.x0, FIN.h, 9001, { tone: 190 }),
    (FIN.x0 + FIN.x1) / 2, FIN.h / 2, FIN.z, 'bx-fin'));

  const stoneMat = new THREE.MeshStandardMaterial({ color: 0xd6cebd, roughness: 0.78 });
  g.add(box(0.8, 1.4, 0.8, stoneMat, -7.4, 0.7, -8.0, 'bx-monolith'));
  g.add(box(0.6, 1.0, 0.6, stoneMat, -6.0, 0.5, -9.6, 'bx-monolith'));

  const pod = (x, z, r, colour) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.96, 0.42, 40),
      new THREE.MeshStandardMaterial({ color: colour, roughness: 1 }));
    m.position.set(x, 0.21, z);
    m.castShadow = true; m.receiveShadow = true;
    g.add(m);
  };
  pod(-3.2, 11.4, 0.82, 0xb4623a);
  pod(2.8, 12.8, 0.64, 0x5c6b48);

  // --- the hang ------------------------------------------------------------
  const interactables = [];
  const edgeMat = () => new THREE.MeshStandardMaterial({ color: 0xe6e1d6, roughness: 0.9 });
  SLOTS.forEach((slot, i) => {
    const piece = art[i] || null;
    const px = piece?.px || [1600, 2048];
    const [w, h] = fitToSlot(px[0] / px[1], slot.maxW, slot.maxH);
    const face = new THREE.MeshStandardMaterial({
      color: piece?.image ? 0x3a3129 : 0xffffff, roughness: 0.62, metalness: 0,
    });
    const canvas = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.04), [
      edgeMat(), edgeMat(), edgeMat(), edgeMat(), face, edgeMat(),
    ]);
    const [nx, , nz] = slot.n;
    canvas.position.set(slot.pos[0] + nx * 0.038, slot.pos[1], slot.pos[2] + nz * 0.038);
    canvas.rotation.y = Math.atan2(nx, nz);
    canvas.castShadow = true;
    canvas.name = `art-${slot.id}`;
    if (piece) {
      canvas.userData.artwork = piece;
      interactables.push(canvas);
    }
    g.add(canvas);

    if (piece?.image) {
      loadArtTexture(piece.image, { anisotropy: aniso, px: piece.px, maxEdge }, (tx) => {
        face.map = tx;
        face.color.setHex(0xffffff);
        face.needsUpdate = true;
      });
    } else if (piece) {
      face.map = generatePainting(1700 + i * 37, piece.palette || 'mixed', px[0] / px[1]);
      face.needsUpdate = true;
    }
  });

  return {
    group: g, interactables, spawn: SPAWN, slots: SLOTS, water,
    update(dt) {
      rippleA.offset.x += dt * 0.014;
      rippleA.offset.y += dt * 0.009;
      rippleB.offset.x -= dt * 0.008;
      rippleB.offset.y += dt * 0.012;
    },
  };
}

// ---------------------------------------------------------------------------
// Light. One sun over the city, low enough to come in through the missing
// level-1 wall and rake the full height of the west wall; the slot drops a
// second blade through the glass floor and all the way to the ground. Shadows
// bake once per entry (Lighting.js turns shadowMap.autoUpdate off).
export function setupBrutalistLighting(scene, renderer, tier = {}) {
  const hemi = new THREE.HemisphereLight(0xd7dee4, 0x6d6357, 0.45);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xfff1d9, 3.5);
  sun.position.copy(SUN_POS);
  sun.target.position.set(-8, 3, -2);
  sun.castShadow = true;
  sun.shadow.mapSize.setScalar(tier.shadowSize || 2048);
  sun.shadow.camera.left = -34;
  sun.shadow.camera.right = 38;
  sun.shadow.camera.top = 34;
  sun.shadow.camera.bottom = -34;
  sun.shadow.camera.near = 2;
  sun.shadow.camera.far = 150;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.035;
  scene.add(sun, sun.target);

  // Sky spilling down the slot and through the glass — the void's own light.
  const shaft = new THREE.PointLight(0xdfe8f2, 90, 40, 2);
  shaft.position.set(0, BX.roofY - 2.0, 0);
  scene.add(shaft);
  const under = new THREE.PointLight(0xcfdde6, 40, 26, 2);
  under.position.set(0, LEVELS[3] - 1.6, 0);
  scene.add(under);

  const spots = [];
  const wash = (x, y, z, tx, ty, tz, intensity = 34, angle = 0.7) => {
    const s = new THREE.SpotLight(0xfff3e4, intensity, 0, angle, 0.85, 1.6);
    s.position.set(x, y, z);
    s.target.position.set(tx, ty, tz);
    scene.add(s, s.target);
    spots.push(s);
  };
  // one grazing wash per hung wall face, aimed above each work
  wash(-4.5, 6.0, -13.0, -4.5, 3.6, BX.z0 + 0.4, 40, 0.6);
  wash(4.5, 6.0, -13.0, 4.5, 3.5, BX.z0 + 0.4, 36, 0.6);
  wash(-1.5, 6.2, 9.4, -1.5, 4.0, FIN.z + 0.4, 26, 0.66);
  wash(1.5, 6.2, 3.6, 1.5, 4.0, FIN.z - 0.4, 26, 0.66);
  wash(-10.0, 9.6, -6.0, BX.x0 + 0.3, 7.9, -6.0, 30, 0.62);
  wash(-4.0, 9.6, 13.6, -4.0, 7.9, BX.z1 - 0.4, 30, 0.62);
  wash(-10.0, 14.0, 6.0, BX.x0 + 0.3, 12.3, 6.0, 30, 0.62);
  wash(4.0, 14.0, 13.6, 4.0, 12.3, BX.z1 - 0.4, 30, 0.62);
  wash(-4.5, 18.2, -13.0, -4.5, 16.7, BX.z0 + 0.4, 30, 0.6);
  wash(10.0, 18.2, 6.0, BX.x1 - 0.3, 16.7, 6.0, 30, 0.6);

  // bounce off the water and the pale terrace, back in through the opening
  const courtBounce = new THREE.PointLight(0xbfd8dd, 45, 34, 2);
  courtBounce.position.set(COURT.x0 + 3.0, COURT.y + 2.2, -13.0);
  scene.add(courtBounce);

  return {
    hemi, sun, spots, shaft, under, courtBounce,
    bake: () => { renderer.shadowMap.needsUpdate = true; },
  };
}

// ---------------------------------------------------------------------------
// Ground. Three flights and four plates. Each plate is only handed to someone
// already near its height — the flights are the one continuous connector, and
// each one comes up through a hole in the plate above it.
export function brutalistGround(x, z, prevY = 0) {
  for (const s of STAIRS) {
    const y = stairY(s, x, z);
    if (y !== null) return y;
  }
  if (prevY > LEVELS[3] - 1.6 && onLevel(3, x, z)) return LEVELS[3];
  if (prevY > LEVELS[2] - 1.6 && onLevel(2, x, z)) return LEVELS[2];
  if (prevY > LEVELS[1] - 1.6 && onLevel(1, x, z)) return LEVELS[1];
  if (prevY > LEVELS[1] - 1.6 && inCourt(x, z)) return COURT.y;
  return 0;
}

export function inCourt(x, z) {
  return x >= COURT.x0 && x <= COURT.x1 && z >= COURT.z0 && z <= COURT.z1;
}

function stairY(s, x, z) {
  const lo = Math.min(s.a, s.b), hi = Math.max(s.a, s.b);
  if (s.axis === 'z') {
    if (x < s.x0 || x > s.x1 || z < lo || z > hi) return null;
    return s.y0 + (s.y1 - s.y0) * clamp01((z - s.a) / (s.b - s.a));
  }
  if (z < s.z0 || z > s.z1 || x < lo || x > hi) return null;
  return s.y0 + (s.y1 - s.y0) * clamp01((x - s.a) / (s.b - s.a));
}

// A plate is the footprint minus the void (levels 1 and 2), minus the hole the
// flight above arrives through.
function onLevel(n, x, z) {
  if (x < BX.x0 || x > BX.x1 || z < BX.z0 || z > BX.z1) return false;
  const inVoid = x > VOID.x0 && x < VOID.x1 && z > VOID.z0 && z < VOID.z1;
  if (n === 1) {
    if (inVoid) return false;
    if (x > POOL.x0 && x < BX.x1 && z > POOL.z0 && z < POOL.z1) return false;   // the tank
    const S1 = STAIRS[0];
    if (x <= S1.x1 && z > S1.b && z < S1.a + 0.4) return false;
    return true;
  }
  if (n === 2) {
    if (inVoid) return false;
    const S2 = STAIRS[1];
    if (z <= S2.z1 && x > S2.a - 0.4 && x < S2.b) return false;
    return true;
  }
  const S3 = STAIRS[2];
  if (x >= S3.x0 && z > S3.a - 0.4 && z < S3.b) return false;   // the last hole
  return true;                                                        // glass over the void
}

function clamp01(v) { return Math.min(1, Math.max(0, v)); }

// ---------------------------------------------------------------------------
// Colliders. Level-gated: Collision.js compares the walking height against
// `level` with a ±0.6 tolerance, so a line meant for one plate has to be
// repeated at every height it should also hold — which is what rampGuard does
// along a flight.
const seg = (ax, az, bx, bz, level = 'all') => ({ a: [ax, az], b: [bx, bz], level });
const rect = (x0, z0, x1, z1, level = 'all') => [
  seg(x0, z0, x1, z0, level), seg(x1, z0, x1, z1, level),
  seg(x1, z1, x0, z1, level), seg(x0, z1, x0, z0, level),
];
// one copy of the same line at every metre of a flight's climb
function rampGuard(ax, az, bx, bz, y0, y1) {
  const out = [];
  for (let y = Math.min(y0, y1); y <= Math.max(y0, y1) + 0.001; y += 1.0) out.push(seg(ax, az, bx, bz, y));
  out.push(seg(ax, az, bx, bz, Math.max(y0, y1)));
  return out;
}

export function brutalistSegments() {
  const c = [];
  const [S1, S2, S3] = STAIRS;

  // perimeter. The east line is solid at every level except the terrace's.
  c.push(seg(BX.x0, BX.z0, BX.x1, BX.z0));
  c.push(seg(BX.x1, BX.z1, BX.x0, BX.z1));
  c.push(seg(BX.x0, BX.z1, BX.x0, BX.z0));
  c.push(seg(BX.x1, COURT.z1, BX.x1, BX.z1));
  for (const lv of [LEVELS[0], LEVELS[2], LEVELS[3]]) c.push(seg(BX.x1, BX.z0, BX.x1, COURT.z1, lv));

  // void edges on levels 1 and 2 — you cannot step off a plate into the drop
  for (const y of [LEVELS[1], LEVELS[2]]) {
    c.push(seg(VOID.x0, VOID.z0, VOID.x0, VOID.z1, y));
    c.push(seg(VOID.x1, VOID.z0, VOID.x1, VOID.z1, y));
    c.push(seg(VOID.x0, VOID.z0, VOID.x1, VOID.z0, y));
    c.push(seg(VOID.x0, VOID.z1, VOID.x1, VOID.z1, y));
  }
  // The holes each flight comes up through, fenced on the plate they pierce —
  // every side except the mouth the flight lands in.
  c.push(seg(BX.x0, S1.a + 0.4, S1.x1, S1.a + 0.4, LEVELS[1]));
  c.push(seg(S1.x1, S1.b, S1.x1, S1.a + 0.4, LEVELS[1]));
  c.push(seg(S2.a - 0.4, BX.z0, S2.a - 0.4, S2.z1, LEVELS[2]));
  c.push(seg(S2.a - 0.4, S2.z1, S2.b, S2.z1, LEVELS[2]));
  c.push(seg(S3.x0, S3.a - 0.4, BX.x1, S3.a - 0.4, LEVELS[3]));
  c.push(seg(S3.x0, S3.a - 0.4, S3.x0, S3.b, LEVELS[3]));

  // each flight's open side, all the way up
  c.push(...rampGuard(S1.x1, S1.a, S1.x1, S1.b, S1.y0, S1.y1));
  c.push(...rampGuard(S2.a, S2.z1, S2.b, S2.z1, S2.y0, S2.y1));
  c.push(...rampGuard(S3.x0, S3.a, S3.x0, S3.b, S3.y0, S3.y1));

  // the terrace and its pool
  c.push(seg(COURT.x0, COURT.z0, COURT.x1, COURT.z0, COURT.y));
  c.push(seg(COURT.x0, COURT.z1, COURT.x1, COURT.z1, COURT.y));
  c.push(seg(COURT.x1, COURT.z0, COURT.x1, COURT.z1, COURT.y));
  c.push(...rect(POOL.x0, POOL.z0, POOL.x1, POOL.z1, COURT.y));
  c.push(...rect(COURT.x0 + 0.3, -14.1, COURT.x0 + 0.9, -10.7, COURT.y));   // bench

  // ground-floor objects
  c.push(...rect(FIN.x0, FIN.z - FIN.t / 2, FIN.x1, FIN.z + FIN.t / 2, LEVELS[0]));
  c.push(...rect(-7.8, -8.4, -7.0, -7.6, LEVELS[0]));
  c.push(...rect(-6.3, -9.9, -5.7, -9.3, LEVELS[0]));
  c.push(...rect(-4.02, 10.58, -2.38, 12.22, LEVELS[0]));
  c.push(...rect(2.16, 12.16, 3.44, 13.44, LEVELS[0]));
  return c;
}
