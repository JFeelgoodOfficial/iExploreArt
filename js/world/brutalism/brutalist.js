import * as THREE from 'three';
import { fitToSlot } from '../../art/fit.js';
import { loadArtTexture } from '../../art/load.js';
import { generatePainting } from '../../art/placeholder.js';
import { mulberry32 } from '../../utils/proctex.js';

// ---------------------------------------------------------------------------
// BRUTALISM HALL — residency five (room id `brutalist`).
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
// Level 3 is not a ring like the others. The glass over the void carries a foot
// of water — you walk the concrete round it and look down through the pool,
// under the skylight slot, 13 m to the floor. The water runs out through the
// east wall and off a cantilevered infinity edge over the city.
//
// The same bay is glazed two storeys lower, at level 1: the city is a window
// there, not a door. Nothing on the east face is walk-through at any level.
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

// The one bay the east face gives up to the city. Everything that opens
// eastward opens here: a glazed slot at level 1, and an open one at level 3
// with the pool running out through it. Two storeys apart in the same bay, so
// the elevation reads as one move rather than two.
export const BAY = { z0: -16.2, z1: -10.2 };
// Level-1 window: a punched slot with 0.75 m of upstand under it, so you see
// the city and not your own feet.
export const WIN = { sill: 5.15, head: 7.9, mullion: 0.28 };
// The sky pool. A foot of water lying on the level-3 glass — you look down
// through it, thirteen metres to the ground floor — that runs out through the
// bay and off a cantilevered infinity edge above the city. The level-3 slab is
// 0.45 deep with its top at 13.2, so its own edge face IS the pool wall; the
// glass just drops far enough to leave the water somewhere to sit.
export const SKY = {
  depth: 0.30,                   // one foot
  drop: 0.05,                    // surface below the level-3 deck
  bedY: 12.85,                   // top of the pool bottom: 13.2 − drop − depth
  outX: 21.0,                    // the infinity edge
  slotTop: 15.4,                 // head of the level-3 wall opening
  coping: 0.16,                  // curb round the inboard edge, so the fence is visible
};

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
  // East: solid, except in the one bay, where two horizontal slots are cut
  // through it — the level-1 window and the level-3 pool opening, stacked.
  const eWall = (z0, z1, y0, y1, seed, name) => {
    const d = z1 - z0, h = y1 - y0;
    if (d <= 0.01 || h <= 0.01) return;
    g.add(box(T, h, d, surfaceMat(d, h, seed), BX.x1 + T / 2, y0 + h / 2, (z0 + z1) / 2, name));
  };
  const eBot = -0.6, eTop = H - 0.6;
  eWall(BAY.z1, BX.z1 + T, eBot, eTop, 4204, 'bx-wall-e-s');
  eWall(BX.z0 - T, BAY.z0, eBot, eTop, 4205, 'bx-wall-e-n');
  eWall(BAY.z0, BAY.z1, eBot, WIN.sill, 4206, 'bx-wall-e-bay-low');
  eWall(BAY.z0, BAY.z1, WIN.head, SKY.bedY - 0.2, 4207, 'bx-wall-e-bay-mid');
  eWall(BAY.z0, BAY.z1, SKY.slotTop, eTop, 4208, 'bx-wall-e-bay-top');

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
  strip(VOID.x1, VOID.z0, BX.x1, VOID.z1, LEVELS[1], 5104, 'bx-l1-e');
  strip(BX.x0, BX.z0, BX.x1, VOID.z0, LEVELS[1], 5105, 'bx-l1-n');
  strip(BX.x0, VOID.z1, BX.x1, BX.z1, LEVELS[1], 5106, 'bx-l1-s');

  // level 2 — the hole is in the north strip this time
  strip(BX.x0, BX.z0, S2.a - 0.4, VOID.z0, LEVELS[2], 5201, 'bx-l2-n');
  strip(S2.b, BX.z0, BX.x1, VOID.z0, LEVELS[2], 5202, 'bx-l2-n2');
  strip(S2.a - 0.4, S2.z1, S2.b, VOID.z0, LEVELS[2], 5203, 'bx-l2-n3');
  strip(BX.x0, VOID.z1, BX.x1, BX.z1, LEVELS[2], 5204, 'bx-l2-s');
  strip(BX.x0, VOID.z0, VOID.x0, VOID.z1, LEVELS[2], 5205, 'bx-l2-w');
  strip(VOID.x1, VOID.z0, BX.x1, VOID.z1, LEVELS[2], 5206, 'bx-l2-e');

  // level 3 — a ring like the others now: the east flight's hole in it, and the
  // bay channel cut clean through to the wall so the water can leave. The bay
  // clears the flight's arrival by 0.8 m, which is why it sits at this end.
  strip(BX.x0, BX.z0, VOID.x1, VOID.z0, LEVELS[3], 5301, 'bx-l3-n');
  strip(VOID.x1, BX.z0, BX.x1, BAY.z0, LEVELS[3], 5307, 'bx-l3-n2');     // north of the channel
  strip(BX.x0, VOID.z1, BX.x1, BX.z1, LEVELS[3], 5302, 'bx-l3-s');
  strip(BX.x0, VOID.z0, VOID.x0, VOID.z1, LEVELS[3], 5303, 'bx-l3-w');
  strip(VOID.x1, BAY.z1, S3.x0, VOID.z1, LEVELS[3], 5304, 'bx-l3-e');    // south of the channel
  strip(S3.x0, BAY.z1, BX.x1, S3.a - 0.4, LEVELS[3], 5305, 'bx-l3-e2');
  strip(S3.x0, S3.b, BX.x1, VOID.z1, LEVELS[3], 5306, 'bx-l3-e3');

  // …and the glass over the void, dropped far enough below the deck to hold a
  // foot of water. It is the bed of the pool now, and the hall drops 13 m under
  // it: you read the whole height of the room through the water.
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
  glass.position.set(0, SKY.bedY - 0.03, 0);
  glass.name = 'bx-glass-floor';
  glass.receiveShadow = false;
  g.add(glass);

  // Steel bearers under the glass on a 2.5 m grid — the thing that makes it
  // read as a held pane rather than a hole with a tint.
  const steel = new THREE.MeshStandardMaterial({ color: 0x35363a, roughness: 0.42, metalness: 0.8 });
  const bearerY = SKY.bedY - 0.17;
  for (let x = VOID.x0 + 2.5; x < VOID.x1 - 0.1; x += 2.5) {
    g.add(box(0.09, 0.22, VOID.z1 - VOID.z0, steel, x, bearerY, 0, 'bx-bearer'));
  }
  for (let z = VOID.z0 + 2.5; z < VOID.z1 - 0.1; z += 2.5) {
    g.add(box(VOID.x1 - VOID.x0, 0.22, 0.09, steel, 0, bearerY, z, 'bx-bearer'));
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

  // --- the level-1 window --------------------------------------------------
  // Glazed in three lights between two concrete mullions, with the wall's own
  // 0.5 m of thickness showing as reveals all round. Unlike the opening it
  // replaces, you cannot walk through it.
  const bayD = BAY.z1 - BAY.z0, winH = WIN.head - WIN.sill;
  const revealMat1 = surfaceMat(bayD, 0.7, 8101, { tone: 196, roughness: 0.9 });
  g.add(box(T, 0.06, bayD, revealMat1, BX.x1 + T / 2, WIN.sill + 0.03, (BAY.z0 + BAY.z1) / 2, 'bx-win-reveal-b'));
  g.add(box(T, 0.06, bayD, revealMat1, BX.x1 + T / 2, WIN.head - 0.03, (BAY.z0 + BAY.z1) / 2, 'bx-win-reveal-t'));

  const glassFor = (name) => (tier.glassTransmission === false
    ? new THREE.MeshStandardMaterial({
        color: 0xcfe0e2, transparent: true, opacity: 0.2,
        roughness: 0.08, metalness: 0.2, side: THREE.DoubleSide, depthWrite: false, name,
      })
    : new THREE.MeshPhysicalMaterial({
        color: 0xe2eeee, transmission: 0.96, roughness: 0.05, metalness: 0,
        ior: 1.52, thickness: 0.02, transparent: true, side: THREE.DoubleSide, name,
      }));

  const winGlass = glassFor('bx-win-glass');
  const lights = 3;
  for (let i = 0; i < lights; i++) {
    const z0 = BAY.z0 + (bayD * i) / lights, z1 = BAY.z0 + (bayD * (i + 1)) / lights;
    const inset = i === 0 ? 0 : WIN.mullion / 2, inset1 = i === lights - 1 ? 0 : WIN.mullion / 2;
    const pane = new THREE.Mesh(
      new THREE.PlaneGeometry(z1 - z0 - inset - inset1, winH), winGlass
    );
    pane.rotation.y = Math.PI / 2;
    pane.position.set(BX.x1 + 0.06, WIN.sill + winH / 2, (z0 + inset + z1 - inset1) / 2);
    pane.castShadow = false;
    pane.name = 'bx-win-glass';
    g.add(pane);
    if (i < lights - 1) {
      g.add(box(T, winH, WIN.mullion, revealMat1, BX.x1 + T / 2, WIN.sill + winH / 2, z1, 'bx-win-mullion'));
    }
  }
  // a timber sill inside — the one warm thing in the hall, kept from the bench
  // that used to sit on the terrace
  const timber = new THREE.MeshStandardMaterial({ color: 0x8a5f37, roughness: 0.55 });
  g.add(box(0.5, 0.14, bayD, timber, BX.x1 - 0.25, WIN.sill + 0.07, (BAY.z0 + BAY.z1) / 2, 'bx-win-sill'));

  // --- the sky pool --------------------------------------------------------
  // The void's glass is the bed; from VOID.x1 out it is cast concrete, running
  // through the bay, through the wall, and out over the city on a cantilever
  // with nothing under it.
  const bedMat = new THREE.MeshStandardMaterial({ color: 0x3f9ec6, roughness: 0.22 });
  const chanX0 = VOID.x1, chanX1 = SKY.outX;
  g.add(box(chanX1 - chanX0, 0.2, bayD, bedMat, (chanX0 + chanX1) / 2, SKY.bedY - 0.1, (BAY.z0 + BAY.z1) / 2, 'bx-sky-bed'));
  // the structure that carries it, and the soffit you read from below. Nothing
  // holds the far end up: eight metres of cantilever, thirteen metres up.
  const outW = chanX1 - BX.x1;
  const shelfMat = surfaceMat(outW, bayD, 8201, { tone: 168, roughness: 0.95 });
  const shelf = box(outW, 0.62, bayD + 0.5, shelfMat,
    (BX.x1 + chanX1) / 2, SKY.bedY - 0.51, (BAY.z0 + BAY.z1) / 2, 'bx-sky-shelf');
  shelf.castShadow = true;
  g.add(shelf);
  // Side upstands, flush with the deck, outside the wall only — indoors the cut
  // face of the level-3 slab is already the channel's side. Nothing to the
  // east: that is the edge.
  const upMat = surfaceMat(outW, 0.55, 8202, { tone: 184 });
  for (const z of [BAY.z0 - 0.125, BAY.z1 + 0.125]) {
    g.add(box(outW, LEVELS[3] - SKY.bedY + 0.2, 0.25, upMat,
      (BX.x1 + chanX1) / 2, (SKY.bedY - 0.2 + LEVELS[3]) / 2, z, 'bx-sky-upstand'));
  }
  // A low curb round the inboard edge of the pool. Without it the player walks
  // into an invisible line at a water surface flush with the deck.
  const copeMat = surfaceMat(24, SKY.coping, 8203, { tone: 188 });
  const cope = (x0, z0, x1, z1, name) => g.add(box(
    Math.max(0.18, x1 - x0), SKY.coping, Math.max(0.18, z1 - z0), copeMat,
    (x0 + x1) / 2, LEVELS[3] + SKY.coping / 2, (z0 + z1) / 2, name));
  cope(VOID.x0 - 0.18, VOID.z0 - 0.18, VOID.x0, VOID.z1 + 0.18, 'bx-cope-w');
  cope(VOID.x0 - 0.18, VOID.z0 - 0.18, VOID.x1 + 0.18, VOID.z0, 'bx-cope-n');
  cope(VOID.x0 - 0.18, VOID.z1, VOID.x1 + 0.18, VOID.z1 + 0.18, 'bx-cope-s');
  // the east side is broken by the channel, so it comes in two pieces
  cope(VOID.x1, VOID.z0 - 0.18, VOID.x1 + 0.18, BAY.z0, 'bx-cope-e');
  cope(VOID.x1, BAY.z1, VOID.x1 + 0.18, VOID.z1 + 0.18, 'bx-cope-e2');
  // …and along the channel itself, out to the wall
  cope(VOID.x1, BAY.z0 - 0.18, BX.x1, BAY.z0, 'bx-cope-chan-n');
  cope(VOID.x1, BAY.z1, BX.x1, BAY.z1 + 0.18, 'bx-cope-chan-s');

  // The water. Physical, refracting, with two ripple normals crossing each
  // other; the surface is subdivided so the environment does not smear across
  // one enormous quad. Shallow, so it stays clear enough to read the 13 m drop
  // through — which is the whole reason the glass is there.
  // It comes in two sheets — the one over the void and the one running out
  // through the bay — which meet in the open with no edge between them. So each
  // gets its own copy of the ripple maps, repeated at the same metres-per-tile:
  // one shared texture would tile per-sheet and the join would read as a seam.
  const rippleA = rippleNormal(256, 5);
  const rippleB = rippleNormal(256, 19);
  const ripples = [];
  const waterY = LEVELS[3] - SKY.drop;
  const sheet = (x0, z0, x1, z1, dy, name) => {
    const w = x1 - x0, d = z1 - z0;
    const a = rippleA.clone(), b = rippleB.clone();
    a.repeat.set(w / 2.2, d / 2.2);
    b.repeat.set(w / 3.7, d / 3.7);
    ripples.push(a, b);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d, 48, 32), new THREE.MeshPhysicalMaterial({
      color: 0x53a8c4,
      roughness: 0.035,
      metalness: 0,
      transmission: tier.glassTransmission === false ? 0 : 0.92,
      thickness: SKY.depth,
      ior: 1.333,
      attenuationColor: new THREE.Color(0x2f8fb4),
      attenuationDistance: 9,
      clearcoat: 1,
      clearcoatRoughness: 0.04,
      clearcoatNormalMap: b,
      clearcoatNormalScale: new THREE.Vector2(0.35, 0.35),
      normalMap: a,
      normalScale: new THREE.Vector2(0.22, 0.22),
      transparent: true,
      opacity: tier.glassTransmission === false ? 0.6 : 1,
      envMapIntensity: 1.5,
      side: THREE.DoubleSide,
    }));
    m.rotation.x = -Math.PI / 2;
    m.position.set((x0 + x1) / 2, waterY + dy, (z0 + z1) / 2);
    m.name = name;
    g.add(m);
    return m;
  };
  const water = sheet(VOID.x0, VOID.z0, VOID.x1, VOID.z1, 0, 'bx-water');
  // dropped 2 mm and overlapped a little, so the join never z-fights
  sheet(VOID.x1 - 0.06, BAY.z0, chanX1, BAY.z1, -0.002, 'bx-water-out');

  // the catch trough just under and beyond the lip — where the water is going
  g.add(box(0.55, 0.5, bayD + 0.5, shelfMat, chanX1 + 0.275, SKY.bedY - 0.45, (BAY.z0 + BAY.z1) / 2, 'bx-sky-trough'));

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
      // every sheet's pair drifts identically, so the two read as one body
      for (let i = 0; i < ripples.length; i += 2) {
        ripples[i].offset.x += dt * 0.014;
        ripples[i].offset.y += dt * 0.009;
        ripples[i + 1].offset.x -= dt * 0.008;
        ripples[i + 1].offset.y += dt * 0.012;
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Light. One sun over the city, low enough to come in through the level-1
// window and rake the full height of the west wall; the slot drops a second
// blade through the pool and its glass, all the way to the ground. Shadows
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

  // bounce off the sky pool, back in through the level-3 opening
  const poolBounce = new THREE.PointLight(0xbfd8dd, 45, 34, 2);
  poolBounce.position.set(BX.x1 + 3.0, LEVELS[3] + 1.6, (BAY.z0 + BAY.z1) / 2);
  scene.add(poolBounce);
  // …and daylight standing in the level-1 window, so the glazed bay still reads
  // as the room's other source now that it isn't a hole
  const winBounce = new THREE.PointLight(0xcfe0e6, 22, 20, 2);
  winBounce.position.set(BX.x1 - 1.4, (WIN.sill + WIN.head) / 2, (BAY.z0 + BAY.z1) / 2);
  scene.add(winBounce);

  return {
    hemi, sun, spots, shaft, under, poolBounce, winBounce,
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
  return 0;
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

// A plate is the footprint minus the void, minus the hole the flight above
// arrives through. Level 3 is a ring like the other two now: the water over the
// void is not standable, and neither is the channel that carries it out.
function onLevel(n, x, z) {
  if (x < BX.x0 || x > BX.x1 || z < BX.z0 || z > BX.z1) return false;
  const inVoid = x > VOID.x0 && x < VOID.x1 && z > VOID.z0 && z < VOID.z1;
  if (n === 1) {
    if (inVoid) return false;
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
  if (inVoid) return false;                                     // the pool
  if (x >= VOID.x1 && z > BAY.z0 && z < BAY.z1) return false;    // the channel out
  const S3 = STAIRS[2];
  if (x >= S3.x0 && z > S3.a - 0.4 && z < S3.b) return false;    // the last hole
  return true;
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

  // perimeter. The east line is solid at every level: the window is glazed and
  // the pool's opening above it is water, not a way out.
  c.push(seg(BX.x0, BX.z0, BX.x1, BX.z0));
  c.push(seg(BX.x1, BX.z1, BX.x0, BX.z1));
  c.push(seg(BX.x0, BX.z1, BX.x0, BX.z0));
  c.push(seg(BX.x1, BX.z0, BX.x1, BX.z1));

  // void edges on every ring — you cannot step off a plate into the drop, and
  // on level 3 the same line keeps you out of the water
  for (const y of [LEVELS[1], LEVELS[2], LEVELS[3]]) {
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

  // the channel the pool leaves through: both long sides, and its mouth north
  // of where the void fence above already reaches
  c.push(seg(VOID.x1, BAY.z0, BX.x1, BAY.z0, LEVELS[3]));
  c.push(seg(VOID.x1, BAY.z1, BX.x1, BAY.z1, LEVELS[3]));
  c.push(seg(VOID.x1, BAY.z0, VOID.x1, VOID.z0, LEVELS[3]));

  // ground-floor objects
  c.push(...rect(FIN.x0, FIN.z - FIN.t / 2, FIN.x1, FIN.z + FIN.t / 2, LEVELS[0]));
  c.push(...rect(-7.8, -8.4, -7.0, -7.6, LEVELS[0]));
  c.push(...rect(-6.3, -9.9, -5.7, -9.3, LEVELS[0]));
  c.push(...rect(-4.02, 10.58, -2.38, 12.22, LEVELS[0]));
  c.push(...rect(2.16, 12.16, 3.44, 13.44, LEVELS[0]));
  return c;
}
