import * as THREE from 'three';
import { fitToSlot } from '../../art/fit.js';
import { loadArtTexture } from '../../art/load.js';
import { generatePainting } from '../../art/placeholder.js';
import { mulberry32 } from '../../utils/proctex.js';

// ---------------------------------------------------------------------------
// CHADREA HALL — residency four (room id `chadrea`).
//
// A concrete house rather than a gallery: one long board-formed hall under an
// 8.6 m soffit, a mezzanine hung off its west end, and a rounded plaster arch
// through the pier wall into a daylit wing. Where Brutalism Hall upstairs is
// four storeys of one material round a void, this is two rooms of different
// temperature — grey and top-lit on one side of the arch, white and side-lit on
// the other — and the arch is the whole move.
//
// The climb is a single cantilevered flight against the north wall, treads
// running out of the concrete with nothing under them, west up to the
// mezzanine deck at 4.2. The deck's rail opens where the flight lands.
//
// Local coordinates: x −8…13, z −11…11, y up. Metres.
//
//   const room = buildChadreaRoom(scene, { tier, art: CHADREA_HANG, ...artOpts });
//   const lights = setupChadreaLighting(scene, renderer, tier);
//   room.update(dt);   // the haze motes; everything else is static
//
// Nothing adds itself outside `scene` — main.js builds the room inside
// rooms.captureLayer() so every mesh and every light hides with it.
//
// This was a standalone sketch with its own renderer, camera, overlay, audio
// and rAF loop. All of that is gone: the app owns the frame, the player and
// the collision, and this file owns geometry, materials and light only. The
// sketch's own `scene.fog` and PMREM environment are gone too — both are
// global here and already set (js/utils/assets.js, js/world/CityView.js).
// ---------------------------------------------------------------------------

export const HALL = { x0: -8, x1: 4, z0: -11, z1: 11, h: 8.6 };
export const MEZZ = { x0: -8, x1: -3.2, z0: -11, z1: -1, top: 4.2, t: 0.42 };
// `open` is where the flight's upstand begins. East of it the bottom treads are
// open to the hall, which is the only way onto the stair: the sketch ran the
// upstand the whole length at every height, and the sole way round its east end
// was a 0.15 m slot against the pier — narrower than the player, so the flight
// could not be reached at all. Everything east of `open` is under 0.35 m up, so
// stepping on is a stride rather than a hop.
export const STAIR = { xb: 3.5, xt: -3.2, z0: -10.9, z1: -9.3, top: 4.2, open: 2.6 };
// h 6.0, not the sketch's 5.2: the arch crowns at 5.6, so a 5.2 ceiling let the
// top of the opening look straight over the wing's roof into open sky.
export const WING = { x0: 4.9, x1: 13, z0: 0, z1: 11, h: 6.0 };
export const PIER = { x: 4, t: 0.9, az0: 2.4, az1: 8 };
// The ceiling slot. Its blade of light lands on the floor by the stair.
export const SKY = { x0: -1.4, x1: -0.6, z0: HALL.z0, z1: -5.4 };
// The cove over the pier. It runs the pier's length — in the sketch it stopped
// at z −0.1, which was fine for a camera that spawned facing south, but the
// whole southern half of the pier then arrives as an unlit black wall.
export const COVE = { z0: -7.1, z1: 9.0, y: 7.3 };

// The curtail steps — the flight's bottom three, cast much broader than the
// treads above and with their outer corners rounded, cascading south into the
// hall. Each one is a landing at the height the flight has reached at its west
// edge (so top(i) is exactly the ramp at x0(i)) and runs the full way back to
// the north wall, east to the pier. Derived from STAIR so the two cannot drift.
export const CURTAIL = (() => {
  const run = (STAIR.xb - STAIR.xt) / 22, rise = STAIR.top / 22;
  //          how far south of the flight it throws, how far past the tread line
  //          it reaches west, and its corner radius. A curtail step is the
  //          biggest in every direction, so the bottom one leads on all three —
  //          the westward reach is what carries the stone under the volute's
  //          curl, instead of leaving its balusters standing on the floor.
  const proj = [2.60, 1.85, 1.10];
  const rad = [0.70, 0.52, 0.34];
  // All three share a west edge rather than stepping back with the treads, so
  // the cascade reads as one broad throw into the room instead of a staircase
  // narrowing away. It stops at 2.33 — the plinth by the flight stands at
  // x 1.84…2.26, and the stone must not swallow it.
  const WEST = 2.33;
  return proj.map((p, i) => ({
    top: (i + 1) * rise,
    x0: Math.min(STAIR.xb - (i + 1) * run, WEST),
    x1: PIER.x - 0.06,
    z0: STAIR.z0,
    z1: STAIR.z1 + p,
    r: rad[i],
  }));
})();

// The walnut plinth and its vessel, standing off the cascade's west edge. The
// volute wraps it and chadreaSegments fences it, so it lives here rather than
// being written out in three places that could drift apart.
export const PLINTH = { x: 2.05, z: -8.0, w: 0.42, h: 1.32, r: 0.56 };

// The lift back to reception, set into the wing's south wall — the one large
// surface in the room that carries nothing. The car itself is never built: you
// press the plate, the veil comes down and you step out of the reception cabin
// downstairs, so this is a portal, two leaves and a call plate, and no shaft.
// main.js hangs the interaction hitbox off these numbers.
export const LIFT = { x: 9.0, z: WING.z1, w: 1.72, h: 2.35, jamb: 0.17 };

// The courtyard. The wing's south wall used to be the room's one blank
// surface; it is two openings now, either side of the lift, onto a walled
// terrace with a reflecting pool. Open to the sky, and the city stands over
// its far wall — the only place in this residency you see out.
export const COURT = { x0: WING.x0, x1: WING.x1, z0: WING.z1, z1: 21.5, wall: 4.6, t: 0.35 };
export const POOL = { x0: 6.50, x1: 11.40, z0: 13.90, z1: 19.30, depth: 0.85, coping: 0.22 };
// The head of the wing's openings; everything above it is spandrel and parapet.
export const OPENING = { head: 2.85, parapet: 6.70 };
// The lift shaft, expressed on the courtyard side and running straight up past
// the parapet. Its north face is the wall the lift doors sit in.
// w 2.60, not 2.10: the architrave alone is 2.06 across, and at 2.10 the
// call plate had nowhere to sit once the wall either side became opening.
export const SHAFT = { w: 2.60, d: 1.30, top: 9.20 };

// The volute's path, [x, z, y] — GENERATED from the stone rather than authored
// by hand, so the rail follows the steps instead of merely resembling them. It
// leaves the rake, turns down the cascade's west edge, swings the long way
// round the plinth so the statue sits inside the curve, comes back to the edge
// and finishes on the bottom step's own rounded corner, tracing its radius.
// One array drives the tube, the balusters and the colliders, so the rail you
// see and the rail you bump into are the same curve.
export const VOLUTE = (() => {
  const OFF = 0.07;                          // stands this far clear of the stone
  const c0 = CURTAIL[0], c2 = CURTAIL[2];
  const X = c0.x0 - OFF;                     // the west line it runs down
  // One smooth rake over the whole cascade. A handrail ramps; it does not step
  // once per tread, and sampling the step tops directly puts a 0.19 m jolt in it.
  const zTop = STAIR.z1 + 0.05, zBot = c0.z1 - 0.20;
  const yTop = c2.top + 1.02, yBot = c0.top + 1.02;
  const yAt = (z) => {
    const t = Math.min(1, Math.max(0, (z - zTop) / (zBot - zTop)));
    return yTop + (yBot - yTop) * t;
  };
  const pts = [];

  // off the rake, turning south onto the west line
  const yRake = STAIR.top * (STAIR.xb - STAIR.open) / (STAIR.xb - STAIR.xt) + 1.02;
  pts.push([STAIR.open, STAIR.z1 - 0.05, yRake]);
  pts.push([STAIR.open - 0.20, STAIR.z1 + 0.02, yAt(STAIR.z1 + 0.02)]);
  pts.push([X + 0.03, STAIR.z1 + 0.20, yAt(STAIR.z1 + 0.20)]);

  // where the plinth's circle cuts the west line, in and out
  const dz = Math.sqrt(Math.max(0.01, PLINTH.r ** 2 - (X - PLINTH.x) ** 2));
  const zIn = PLINTH.z - dz, zOut = PLINTH.z + dz;
  pts.push([X, zIn - 0.34, yAt(zIn - 0.34)]);

  // …round the statue, the long way west, so it stands inside the curve
  const aIn = Math.atan2(zIn - PLINTH.z, X - PLINTH.x);
  const aOut = Math.atan2(zOut - PLINTH.z, X - PLINTH.x);
  const LOOP = 20;
  for (let i = 0; i <= LOOP; i++) {
    const t = i / LOOP;
    const a = aIn + t * ((aOut - Math.PI * 2) - aIn);
    pts.push([
      PLINTH.x + Math.cos(a) * PLINTH.r,
      PLINTH.z + Math.sin(a) * PLINTH.r,
      yAt(zIn) + (yAt(zOut) - yAt(zIn)) * t,
    ]);
  }

  // …back onto the west line, then round the bottom step's own corner radius,
  // stopping a third of the way so its south face stays open to walk up
  const cx = c0.x0 + c0.r, cz = c0.z1 - c0.r, R = c0.r + OFF;
  pts.push([X, zOut + 0.05, yAt(zOut + 0.05)]);
  const ARC = 10;
  for (let i = 0; i <= ARC; i++) {
    const a = Math.PI - (i / ARC) * (Math.PI / 3);
    const z = cz + Math.sin(a) * R;
    pts.push([cx + Math.cos(a) * R, z, yAt(z)]);
  }
  return pts;
})();

// Hanging slots. `pos` is the picture's CENTRE and `n` the face it comes out
// of, the same shape Brutalism Hall uses; (maxW, maxH) is a guard rather than a
// target — this hall hangs at the works' true size (data/chadrea-artworks.js)
// and only shrinks a piece if its wall genuinely cannot take it. Nothing is
// framed: the canvases stand off the concrete on their own edges.
//
// Every `pos[1]` is a centre line, and they are set per surface rather than
// globally: 1.55 m for anything met on foot (the museum's own 57-inch line),
// MEZZ.top + 1.55 for the two on the mezzanine, and higher only where the
// viewer is higher — over the console, and over the stair.
//
// Three obstructions decide the west wall's z positions and are worth knowing
// before moving one: the walnut doorway reveals at z −1.9 and z +6.6 (1.42 m
// of wall each), the console at z 0.4…5.0, and the mezzanine deck, which puts
// everything from z −11 to −1 under a 3.78 m soffit.
export const SLOTS = [
  // The long west wall — the lit one, grazed by the cove its whole length.
  /* 0 */ { id: 'CH-W1', pos: [HALL.x0 + 0.09, 2.00, 3.0], n: [1, 0, 0], maxW: 2.6, maxH: 2.4 },
  /* 1 */ { id: 'CH-W2', pos: [HALL.x0 + 0.09, 1.55, 8.6], n: [1, 0, 0], maxW: 2.2, maxH: 2.6 },
  // …and its two bays under the mezzanine, where the room drops to 3.78. These
  // two sit 1.5 m apart, closer than any other pair in the hall, because the
  // works that hang here are the smallest in the series — at the spacing the
  // rest of the wall uses they read as two stamps on 22 m of concrete instead
  // of as a pair.
  /* 2 */ { id: 'CH-W3', pos: [HALL.x0 + 0.09, 1.50, -5.40], n: [1, 0, 0], maxW: 1.8, maxH: 2.2 },
  /* 3 */ { id: 'CH-W4', pos: [HALL.x0 + 0.09, 1.50, -6.90], n: [1, 0, 0], maxW: 1.8, maxH: 2.2 },
  // North wall, over the flight. Read the length of the hall on arrival, and
  // again at arm's length from the treads, so it hangs to the climb rather than
  // to the floor: at x 1.8 the stair is already 1.07 m up.
  /* 4 */ { id: 'CH-N1', pos: [1.80, 3.10, HALL.z0 + 0.09], n: [0, 0, 1], maxW: 2.4, maxH: 2.4 },
  // The pier's east face — the wing's west side, south of the arch. Not the
  // hall's south wall, which is the obvious eleventh surface and the wrong one:
  // nothing in setupChadreaLighting points at it, so a picture hung there is a
  // dark rectangle on a dark wall. This face takes wingSun square on, and it is
  // the wall at your shoulder walking down the wing to the lift.
  //
  // PIER.x + PIER.t, not PIER.x + PIER.t / 2: the slab is extruded off PIER.x
  // rather than centred on it, so it occupies x 4.0…4.9 and its east face is
  // the far one. Half the thickness leaves the picture inside the concrete —
  // still raycastable, so the E prompt appears on a wall with nothing on it.
  /* 5 */ { id: 'CH-P1', pos: [PIER.x + PIER.t + 0.09, 1.55, 9.50], n: [1, 0, 0], maxW: 2.4, maxH: 2.6 },
  // The mezzanine deck's own two walls, at its corner.
  /* 6 */ { id: 'CH-M1', pos: [MEZZ.x0 + 0.09, MEZZ.top + 1.55, -6.4], n: [1, 0, 0], maxW: 2.2, maxH: 2.2 },
  /* 7 */ { id: 'CH-M2', pos: [-5.60, MEZZ.top + 1.55, HALL.z0 + 0.09], n: [0, 0, 1], maxW: 2.0, maxH: 2.0 },
  // Through the arch, in the daylit wing: its long east wall and its north end.
  /* 8 */ { id: 'CH-A1', pos: [WING.x1 - 0.09, 1.60, 6.2], n: [-1, 0, 0], maxW: 3.0, maxH: 2.6 },
  /* 9 */ { id: 'CH-A2', pos: [9.50, 1.55, WING.z0 + 0.09], n: [0, 0, 1], maxW: 2.2, maxH: 2.4 },
];

// Ground floor at the south end, facing north up the hall: the arch is on your
// right, the flight and the skylight ahead. Yaw 0 looks along −z.
export const SPAWN = { x: 0.6, z: 7.4, yaw: 0 };
export const SUN_POS = new THREE.Vector3(-7.5, 26, -21);

// ---------------------------------------------------------------------------
// TEXTURE KIT
//
// Every surface is drawn to a canvas — there are no image files in this room.
// All of it is lazy: the module is imported at page load but the room is only
// built on first visit, and concreteTile() alone is three 768² canvases.

const cv = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const rnd = (a, b) => a + Math.random() * (b - a);

function blotch(ctx, w, h, n, rMin, rMax, cols, aMax) {
  for (let i = 0; i < n; i++) {
    const x = Math.random() * w, y = Math.random() * h, r = rnd(rMin, rMax);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const c = cols[(Math.random() * cols.length) | 0];
    g.addColorStop(0, `rgba(${c},${rnd(aMax * 0.3, aMax).toFixed(3)})`);
    g.addColorStop(1, `rgba(${c},0)`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
  }
}

function grain(ctx, w, h, amt) {
  const d = ctx.getImageData(0, 0, w, h), p = d.data;
  for (let i = 0; i < p.length; i += 4) {
    const n = (Math.random() - 0.5) * amt; p[i] += n; p[i + 1] += n; p[i + 2] += n;
  }
  ctx.putImageData(d, 0, 0);
}

// One GPU upload per canvas — every user gets a clone that shares the source.
const _texCache = new Map();
const tex = (c, repX = 1, repY = 1, srgb = false) => {
  const key = (c.__id ??= Math.random()) + (srgb ? 's' : 'l');
  let base = _texCache.get(key);
  if (!base) {
    base = new THREE.CanvasTexture(c);
    base.wrapS = base.wrapT = THREE.RepeatWrapping;
    base.anisotropy = 4;
    if (srgb) base.colorSpace = THREE.SRGBColorSpace;
    _texCache.set(key, base);
  }
  const t = base.clone();
  t.repeat.set(repX, repY);
  t.needsUpdate = false;
  return t;
};

// Board-formed concrete — one 4 m × 4 m tile: 6 boards of 667 mm, tie holes on
// a 1.33 m grid. Colour, roughness and bump drawn together so they agree.
function concreteTile(px = 1024) {
  const col = cv(px), rgh = cv(px), bmp = cv(px);
  const a = col.getContext('2d'), r = rgh.getContext('2d'), b = bmp.getContext('2d');
  a.fillStyle = '#8e8880'; a.fillRect(0, 0, px, px);
  r.fillStyle = '#b4b4b4'; r.fillRect(0, 0, px, px);
  b.fillStyle = '#808080'; b.fillRect(0, 0, px, px);
  blotch(a, px, px, 150, px * 0.05, px * 0.30, ['120,116,108', '160,156,148', '98,94,88'], 0.16);
  blotch(a, px, px, 60, px * 0.02, px * 0.09, ['76,72,66', '172,168,160'], 0.13);
  blotch(r, px, px, 110, px * 0.04, px * 0.26, ['210,210,210', '140,140,140'], 0.30);
  blotch(b, px, px, 90, px * 0.03, px * 0.22, ['150,150,150', '105,105,105'], 0.35);
  const boards = 6, bh = px / boards;
  for (let i = 0; i <= boards; i++) {
    const y = Math.round(i * bh);
    a.fillStyle = 'rgba(58,54,49,0.55)'; a.fillRect(0, y - 1, px, 3);
    a.fillStyle = 'rgba(196,192,184,0.20)'; a.fillRect(0, y + 2, px, 2);
    b.fillStyle = 'rgba(40,40,40,0.85)'; b.fillRect(0, y - 1, px, 3);
    b.fillStyle = 'rgba(205,205,205,0.5)'; b.fillRect(0, y + 2, px, 2);
    r.fillStyle = 'rgba(235,235,235,0.35)'; r.fillRect(0, y - 1, px, 4);
    // faint vertical panel joints, offset per board
    const jx = Math.round(((i * 0.37) % 1) * px);
    a.fillStyle = 'rgba(70,66,60,0.16)'; a.fillRect(jx, y, 2, bh);
  }
  const grid = px / 3;
  for (let gx = 0; gx < 3; gx++) for (let gy = 0; gy < 3; gy++) {
    const x = (gx + 0.5) * grid + rnd(-6, 6), y = (gy + 0.5) * grid + rnd(-6, 6), rad = px * 0.0075;
    const g = a.createRadialGradient(x, y, 0, x, y, rad * 2.6);
    g.addColorStop(0, 'rgba(48,44,40,0.85)');
    g.addColorStop(0.42, 'rgba(70,66,60,0.5)');
    g.addColorStop(1, 'rgba(120,116,108,0)');
    a.fillStyle = g; a.beginPath(); a.arc(x, y, rad * 2.6, 0, 7); a.fill();
    b.fillStyle = 'rgba(26,26,26,0.9)'; b.beginPath(); b.arc(x, y, rad, 0, 7); b.fill();
    r.fillStyle = 'rgba(245,245,245,0.5)'; r.beginPath(); r.arc(x, y, rad * 1.6, 0, 7); r.fill();
  }
  grain(a, px, px, 16); grain(b, px, px, 22);
  return { col, rgh, bmp };
}

let _CT = null;
const CT = () => (_CT ??= concreteTile(768));

function concrete(w, h, { tint = 0xffffff, rough = 0.94, bump = 0.055 } = {}) {
  const t = CT();
  const m = new THREE.MeshStandardMaterial({
    color: tint, roughness: rough, metalness: 0,
    map: tex(t.col, w / 4, h / 4, true),
    roughnessMap: tex(t.rgh, w / 4, h / 4),
    bumpMap: tex(t.bmp, w / 4, h / 4), bumpScale: bump,
  });
  // Each surface starts somewhere else in the tile, so two walls of the same
  // size don't read as the same pour.
  const o = Math.random() * 4, o2 = Math.random() * 4;
  for (const k of ['map', 'roughnessMap', 'bumpMap']) m[k].offset.set(o / 4, o2 / 4);
  return m;
}

// Polished poured floor: same family, far smoother, envMap does the work.
function floorMat(w, h) {
  const t = CT();
  return new THREE.MeshPhysicalMaterial({
    color: 0x9a938a, roughness: 0.24, metalness: 0,
    map: tex(t.col, w / 9, h / 9, true),
    roughnessMap: tex(t.rgh, w / 9, h / 9),
    bumpMap: tex(t.bmp, w / 9, h / 9), bumpScale: 0.012,
    clearcoat: 0.55, clearcoatRoughness: 0.32, envMapIntensity: 0.85,
  });
}

let _plasterCv;
function plasterMat(tint = 0xece6dc, rough = 0.95) {
  if (!_plasterCv) {
    const c = cv(512), x = c.getContext('2d');
    x.fillStyle = '#fff'; x.fillRect(0, 0, 512, 512);
    blotch(x, 512, 512, 90, 20, 150, ['225,220,212', '248,246,242'], 0.35);
    grain(x, 512, 512, 7);
    _plasterCv = c;
  }
  const c = _plasterCv;
  return new THREE.MeshStandardMaterial({
    color: tint, roughness: rough, metalness: 0,
    map: tex(c, 3, 3, true), bumpMap: tex(c, 3, 3), bumpScale: 0.012,
  });
}

let _travCv;
function travertineMat() {
  if (!_travCv) {
    const c = cv(768), x = c.getContext('2d');
    x.fillStyle = '#c3ae90'; x.fillRect(0, 0, 768, 768);
    for (let i = 0; i < 70; i++) {
      x.strokeStyle = `rgba(${Math.random() < 0.5 ? '150,132,106' : '214,200,176'},${rnd(0.1, 0.4)})`;
      x.lineWidth = rnd(1, 7); x.beginPath();
      const y = Math.random() * 768; x.moveTo(0, y);
      for (let s = 0; s < 768; s += 48) x.lineTo(s, y + rnd(-9, 9));
      x.stroke();
    }
    for (let i = 0; i < 340; i++) {
      x.fillStyle = `rgba(112,96,74,${rnd(0.15, 0.5)})`;
      x.beginPath();
      x.ellipse(Math.random() * 768, Math.random() * 768, rnd(1.5, 7), rnd(1, 3.5), Math.random() * 3, 0, 7);
      x.fill();
    }
    grain(x, 768, 768, 12);
    _travCv = c;
  }
  const c = _travCv;
  return new THREE.MeshPhysicalMaterial({
    color: 0xffffff, roughness: 0.52, metalness: 0,
    map: tex(c, 1, 1, true), bumpMap: tex(c, 1, 1), bumpScale: 0.02,
    clearcoat: 0.25, envMapIntensity: 0.7,
  });
}

const _woodCv = {};
function woodMat(dark = false) {
  const k = dark ? 1 : 0;
  if (!_woodCv[k]) {
    const c = cv(1024, 256), x = c.getContext('2d');
    x.fillStyle = dark ? '#3b2419' : '#5a3a26'; x.fillRect(0, 0, 1024, 256);
    for (let i = 0; i < 130; i++) {
      x.strokeStyle = `rgba(${dark ? '26,15,10' : '40,24,15'},${rnd(0.1, 0.5)})`;
      x.lineWidth = rnd(0.6, 3.4);
      x.beginPath();
      const y = Math.random() * 256; x.moveTo(0, y);
      for (let s = 0; s < 1024; s += 32) x.lineTo(s, y + Math.sin(s * 0.02 + y) * rnd(0.5, 4));
      x.stroke();
    }
    blotch(x, 1024, 256, 40, 20, 90, ['110,74,46', '30,18,12'], 0.22);
    grain(x, 1024, 256, 9);
    _woodCv[k] = c;
  }
  const c = _woodCv[k];
  return new THREE.MeshPhysicalMaterial({
    color: 0xffffff, roughness: 0.46, metalness: 0,
    map: tex(c, 1, 1, true), bumpMap: tex(c, 1, 1), bumpScale: 0.008,
    clearcoat: 0.35, clearcoatRoughness: 0.5,
  });
}

// Brushed metal for the lift leaves. They face north, away from the wing's sun,
// so a dark near-mirror like steelMat has nothing to reflect there and reads as
// a black hole in the wall — this is paler and rougher, and carries its own
// vertical grain so it catches the downlight over the door.
let _brushCv;
function brushedMat() {
  if (!_brushCv) {
    const c = cv(256, 512), x = c.getContext('2d');
    x.fillStyle = '#7b756c'; x.fillRect(0, 0, 256, 512);
    for (let i = 0; i < 900; i++) {
      x.fillStyle = `rgba(${Math.random() < 0.5 ? '150,145,136' : '64,60,55'},${rnd(0.05, 0.22)})`;
      x.fillRect(Math.random() * 256, 0, rnd(0.6, 2.2), 512);
    }
    grain(x, 256, 512, 8);
    _brushCv = c;
  }
  return new THREE.MeshStandardMaterial({
    color: 0xffffff, roughness: 0.38, metalness: 0.55,
    map: tex(_brushCv, 1, 1, true), envMapIntensity: 1.0,
  });
}

// A tileable ripple normal map: a few crossed swells summed into a height
// field, differentiated into normals. Two copies scroll across each other in
// update(), which is what stops still water reading as a sheet of plastic.
function rippleNormal(size = 256, seed = 11) {
  const rand = mulberry32(seed);
  const waves = [];
  for (let i = 0; i < 5; i++) {
    const a = rand() * Math.PI * 2;
    const k = (1 + Math.floor(rand() * 4)) * Math.PI * 2 / size;
    waves.push({
      kx: Math.cos(a) * k * (1 + Math.floor(rand() * 3)),
      kz: Math.sin(a) * k * (1 + Math.floor(rand() * 3)),
      amp: 0.6 / (i + 1), ph: rand() * 6.28,
    });
  }
  const h = (x, y) => waves.reduce((s, w) => s + w.amp * Math.sin(w.kx * x + w.kz * y + w.ph), 0);
  const c = cv(size);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = -(h(x + 1, y) - h(x - 1, y)) * 0.9;
      const ny = -(h(x, y + 1) - h(x, y - 1)) * 0.9;
      const len = Math.hypot(nx, ny, 1);
      const i = (y * size + x) * 4;
      img.data[i] = ((nx / len) * 0.5 + 0.5) * 255;
      img.data[i + 1] = ((ny / len) * 0.5 + 0.5) * 255;
      img.data[i + 2] = ((1 / len) * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

const steelMat = () => new THREE.MeshPhysicalMaterial({
  color: 0x171615, roughness: 0.44, metalness: 0.85, envMapIntensity: 0.7,
});

let _blackCv;
function blackenedMat() {
  if (!_blackCv) {
    const c = cv(512), x = c.getContext('2d');
    x.fillStyle = '#2a2724'; x.fillRect(0, 0, 512, 512);
    blotch(x, 512, 512, 120, 10, 110, ['74,64,54', '18,17,16', '96,80,60'], 0.4);
    grain(x, 512, 512, 14);
    _blackCv = c;
  }
  return new THREE.MeshPhysicalMaterial({
    color: 0xffffff, roughness: 0.55, metalness: 0.72,
    map: tex(_blackCv, 2, 2, true), bumpMap: tex(_blackCv, 2, 2), bumpScale: 0.01,
    envMapIntensity: 0.8,
  });
}

const ceramicMat = (t = 0x6d5442) => new THREE.MeshPhysicalMaterial({
  color: t, roughness: 0.62, metalness: 0.05, clearcoat: 0.3, envMapIntensity: 0.6,
});

// ---------------------------------------------------------------------------
// THE ROOM

// How big a picture hangs. Every other residency hall contain-fits the file's
// aspect into the slot's envelope; here the manifest knows the work's real
// size in metres, so that is what goes on the wall — a 48-inch canvas is
// 1.22 m of concrete. The envelope survives as a guard: a work bigger than its
// wall is scaled DOWN uniformly, never up, and a piece with no `size` (a later
// hang, a placeholder) falls back to the house behaviour.
function sizeFor(piece, slot) {
  const px = piece?.px || [1600, 2048];
  if (!piece?.size) return fitToSlot(px[0] / px[1], slot.maxW, slot.maxH);
  const [w, h] = piece.size;
  const k = Math.min(1, slot.maxW / w, slot.maxH / h);
  return [w * k, h * k];
}

export function buildChadreaRoom(scene, opts = {}) {
  const tier = opts.tier || {};
  const art = opts.art || [];
  const aniso = opts.anisotropy ?? 8;
  const maxEdge = opts.artMaxEdge ?? 0;

  const g = new THREE.Group();
  g.name = 'chadrea-hall';

  const steel = steelMat();

  const box = (w, h, d, mat, x, y, z, { shadow = true, recv = true, rotY = 0, name } = {}) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.rotation.y = rotY;
    m.castShadow = shadow; m.receiveShadow = recv;
    if (name) m.name = name;
    g.add(m);
    return m;
  };
  const wallPanel = (mat, w, h, x, y, z, rotY) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    m.position.set(x, y, z);
    m.rotation.y = rotY;
    m.receiveShadow = true; m.castShadow = false;
    g.add(m);
    return m;
  };

  // --- floors --------------------------------------------------------------
  const hallFloor = new THREE.Mesh(
    new THREE.PlaneGeometry(HALL.x1 - HALL.x0 + 1.8, HALL.z1 - HALL.z0 + 0.4),
    floorMat(HALL.x1 - HALL.x0, HALL.z1 - HALL.z0)
  );
  hallFloor.rotation.x = -Math.PI / 2;
  hallFloor.position.set((HALL.x0 + HALL.x1) / 2 + 0.9, 0, (HALL.z0 + HALL.z1) / 2);
  hallFloor.receiveShadow = true;
  g.add(hallFloor);

  const wingFloor = new THREE.Mesh(
    new THREE.PlaneGeometry(WING.x1 - WING.x0 + 1, WING.z1 - WING.z0),
    floorMat(WING.x1 - WING.x0, WING.z1 - WING.z0)
  );
  wingFloor.rotation.x = -Math.PI / 2;
  wingFloor.position.set((WING.x0 + WING.x1) / 2 - 0.5, 0.001, (WING.z0 + WING.z1) / 2);
  wingFloor.receiveShadow = true;
  g.add(wingFloor);

  // --- hall walls ----------------------------------------------------------
  // west (the long art wall) — split into a lower field and an upper band, so
  // the cove reads as a cut in the concrete rather than a stripe painted on it
  wallPanel(concrete(HALL.z1 - HALL.z0, 6.6, { bump: 0.07 }),
    HALL.z1 - HALL.z0, 6.6, HALL.x0, 3.3, (HALL.z0 + HALL.z1) / 2, Math.PI / 2);
  wallPanel(concrete(22, 2, { tint: 0xbfb8ae }),
    HALL.z1 - HALL.z0, 1.55, HALL.x0, 7.82, (HALL.z0 + HALL.z1) / 2, Math.PI / 2);
  // …and the back of the cove between them. The two panels leave a 0.45 m slot
  // for the recess, which in the sketch went clean through the wall to the sky.
  wallPanel(concrete(22, 1, { tint: 0x7a746c }),
    HALL.z1 - HALL.z0, 0.75, HALL.x0, 6.85, (HALL.z0 + HALL.z1) / 2, Math.PI / 2);
  // north (the stair wall)
  wallPanel(concrete(HALL.x1 - HALL.x0, HALL.h, { bump: 0.07 }),
    HALL.x1 - HALL.x0 + 1, HALL.h, (HALL.x0 + HALL.x1) / 2, HALL.h / 2, HALL.z0, 0);
  // south (behind you at arrival)
  wallPanel(concrete(14, 9, { tint: 0xa9a29a }),
    HALL.x1 - HALL.x0 + 1, HALL.h, (HALL.x0 + HALL.x1) / 2, HALL.h / 2, HALL.z1, Math.PI);
  // dark walnut doorway reveals set into the west wall
  for (const dz of [-1.9, 6.6]) {
    box(0.34, 2.62, 1.06, woodMat(true), HALL.x0 + 0.17, 1.31, dz);
    box(0.12, 2.9, 1.42, concrete(1.5, 3, { tint: 0x8f8880 }), HALL.x0 + 0.30, 1.45, dz);
  }

  // --- pier wall with its rounded plaster archway --------------------------
  {
    const plaster = plasterMat(0xd8d0c4, 0.93);
    const H = HALL.h, z0 = HALL.z0, z1 = HALL.z1;
    const aw = PIER.az1 - PIER.az0, ah = 5.6, r = aw / 2;
    const s = new THREE.Shape();
    s.moveTo(z0, 0); s.lineTo(z1, 0); s.lineTo(z1, H); s.lineTo(z0, H); s.lineTo(z0, 0);
    const hole = new THREE.Path();
    hole.moveTo(PIER.az0, 0);
    hole.lineTo(PIER.az0, ah - r);
    hole.absarc(PIER.az0 + r, ah - r, r, Math.PI, 0, true);
    hole.lineTo(PIER.az1, 0);
    hole.lineTo(PIER.az0, 0);
    s.holes.push(hole);
    const geo = new THREE.ExtrudeGeometry(s, { depth: PIER.t, bevelEnabled: false, curveSegments: 48 });
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, [concrete(20, 9, { tint: 0xa39c93 }), plaster]);
    // The shape is drawn in a z–y plane and extruded along +Z; rotating −90°
    // about Y maps that depth onto −x, so the slab grows WEST off wherever it
    // is placed. Placed at PIER.x it therefore landed on x 3.10…4.00 — a whole
    // thickness west of the x 4.0…4.9 that PIER.x + PIER.t promises, and that
    // the colliders, the cove and the jambs all assume. Offsetting by the
    // thickness puts the concrete where the constants say it is; without this
    // the cove's lamps sit buried inside the slab and the face reads black.
    m.rotation.y = -Math.PI / 2;
    m.position.set(PIER.x + PIER.t, 0, 0);
    m.castShadow = true; m.receiveShadow = true;
    g.add(m);
    // rounded soffit lining inside the arch, so the reveal has real thickness
    // DoubleSide: it is a half-cylinder shell, so a single-sided one vanishes
    // when the arch is read from the wing rather than from the hall.
    const linMat = plaster.clone();
    linMat.side = THREE.DoubleSide;
    const lin = new THREE.Mesh(
      new THREE.CylinderGeometry(r, r, PIER.t, 48, 1, true, 0, Math.PI), linMat
    );
    // rotation.z alone lays the cylinder's axis along +x — through the wall's
    // thickness — with its open half sweeping the y–z plane, which is the
    // reveal. The sketch also set rotation.y, which swung the whole 5.6 m
    // shell round to lie across the hall instead of inside the opening.
    lin.rotation.z = Math.PI / 2;
    lin.position.set(PIER.x + PIER.t / 2, ah - r, PIER.az0 + r);
    lin.receiveShadow = true;
    g.add(lin);
    for (const zz of [PIER.az0, PIER.az1]) {
      box(PIER.t, ah - r, 0.02, plaster, PIER.x + PIER.t / 2, (ah - r) / 2, zz);
    }
  }

  // --- the wing: white plaster, diffuse daylight ---------------------------
  {
    const pl = plasterMat(0xf1ece2, 0.94);
    wallPanel(pl, WING.z1 - WING.z0, WING.h, WING.x1, WING.h / 2, (WING.z0 + WING.z1) / 2, -Math.PI / 2);
    wallPanel(pl, WING.x1 - WING.x0 + 1, WING.h, (WING.x0 + WING.x1) / 2, WING.h / 2, WING.z0, 0);
    // South: no longer a wall. Two openings onto the courtyard, either side of
    // the lift shaft, with a spandrel over them carried up to a parapet — from
    // the terrace the wing has to read as a building, not an open edge.
    const sx0 = LIFT.x - SHAFT.w / 2, sx1 = LIFT.x + SHAFT.w / 2;
    box(WING.x1 - WING.x0, OPENING.parapet - OPENING.head, COURT.t, pl,
      (WING.x0 + WING.x1) / 2, (OPENING.parapet + OPENING.head) / 2, WING.z1);
    // the reveals down each side of the two openings
    for (const [ox, w] of [[WING.x0, 0.3], [sx0, 0.3], [sx1, 0.3], [WING.x1, 0.3]]) {
      box(w, OPENING.head, COURT.t, pl, ox + (ox === WING.x0 || ox === sx1 ? w / 2 : -w / 2),
        OPENING.head / 2, WING.z1);
    }
    const cl = new THREE.Mesh(new THREE.PlaneGeometry(WING.x1 - WING.x0 + 1, WING.z1 - WING.z0), pl);
    cl.rotation.x = Math.PI / 2;
    cl.position.set((WING.x0 + WING.x1) / 2 - 0.5, WING.h, (WING.z0 + WING.z1) / 2);
    g.add(cl);
    // slim vertical light panel + a walnut bench under it
    box(0.05, 2.0, 0.5, new THREE.MeshStandardMaterial({ color: 0xf7f4ee, roughness: 0.6 }),
      WING.x1 - 0.05, 2.5, 3.1);
    box(0.5, 0.08, 2.6, woodMat(), WING.x1 - 0.42, 0.44, 9.1);
    for (const bz of [8.1, 10.1]) box(0.06, 0.44, 0.06, steel, WING.x1 - 0.42, 0.22, bz);

    // --- the lift back to reception ---------------------------------------
    // A blackened architrave standing proud of the plaster, with the leaves set
    // back inside it. Built as four members round the opening rather than one
    // slab, so the reveal has real depth and the doors sit in shadow.
    {
      const brass = new THREE.MeshStandardMaterial({
        color: 0xc9b48a, roughness: 0.34, metalness: 0.6, envMapIntensity: 0.9,
      });
      const dark = blackenedMat();
      const J = LIFT.jamb;
      const face = LIFT.z - 0.05;         // architrave centre: it stands 0.1 proud
      const hx = LIFT.w / 2 + J / 2;      // jamb centreline off the opening
      for (const s of [-1, 1]) box(J, LIFT.h + J, 0.10, dark, LIFT.x + s * hx, (LIFT.h + J) / 2, face);
      box(LIFT.w + 2 * J, J, 0.10, dark, LIFT.x, LIFT.h + J / 2, face);
      // the leaves, meeting on a 20 mm shadow gap and set back behind the frame
      const leaf = brushedMat();
      for (const s of [-1, 1]) {
        box(LIFT.w / 2 - 0.01, LIFT.h, 0.05, leaf,
          LIFT.x + s * (LIFT.w / 4 + 0.005), LIFT.h / 2, LIFT.z - 0.025);
      }
      // brass sill, and the indicator over the head — 0.07, so it sits inside
      // the 0.17 architrave rather than spilling over both its edges
      box(LIFT.w, 0.015, 0.07, brass, LIFT.x, 0.008, LIFT.z - 0.035);
      const dial = new THREE.Mesh(new THREE.CircleGeometry(0.07, 32), brass);
      dial.position.set(LIFT.x, LIFT.h + J / 2, face - 0.056);
      dial.rotation.y = Math.PI;          // faces −z, back into the wing
      g.add(dial);
      // the call plate, at the hand height the rest of the building uses
      const px = LIFT.x + LIFT.w / 2 + J + 0.135;   // on the shaft's own face
      box(0.18, 0.30, 0.04, dark, px, 1.15, LIFT.z - 0.02);
      const btn = new THREE.Mesh(new THREE.CircleGeometry(0.045, 24), brass);
      btn.position.set(px, 1.15, LIFT.z - 0.045);
      btn.rotation.y = Math.PI;
      g.add(btn);
    }
  }

  // --- the courtyard -------------------------------------------------------
  // Walled on three sides, open to the sky, with a reflecting pool set into
  // the paving. The shaft runs up the wing's face beside the openings, past the
  // parapet, and stops — no headhouse, nothing on top. The walls are low enough
  // that the city stands over them from anywhere on the terrace.
  const ripples = [];
  {
    const cw = COURT.x1 - COURT.x0, cd = COURT.z1 - COURT.z0;
    // Everything out here is tinted a good deal darker than the same concrete
    // indoors. The room's sun is 4.6 — tuned for a hall lit through a 0.8 m
    // slot — and at these tints in FULL sun the courtyard's surfaces clipped
    // flat white. Same material, same building, different exposure.
    // Paving comes as four strips round the pool rather than one plane: a
    // single sheet paved straight over the water.
    const cop = new THREE.MeshStandardMaterial({ color: 0x968d80, roughness: 0.7 });
    const K = POOL.coping;
    const pave = (x0, z0, x1, z1) => {
      if (x1 - x0 < 0.01 || z1 - z0 < 0.01) return;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0),
        concrete(x1 - x0, z1 - z0, { tint: 0x7d776e, rough: 0.86 }));
      m.rotation.x = -Math.PI / 2;
      m.position.set((x0 + x1) / 2, 0.002, (z0 + z1) / 2);
      m.receiveShadow = true;
      g.add(m);
    };
    pave(COURT.x0, COURT.z0, COURT.x1, POOL.z0 - K);              // terrace, by the wing
    pave(COURT.x0, POOL.z1 + K, COURT.x1, COURT.z1);              // far end
    pave(COURT.x0, POOL.z0 - K, POOL.x0 - K, POOL.z1 + K);        // west margin
    pave(POOL.x1 + K, POOL.z0 - K, COURT.x1, POOL.z1 + K);        // east margin

    // three walls. Board-formed like the hall, so the courtyard reads as the
    // same building turned inside out rather than a garden bolted on.
    const wm = () => concrete(12, COURT.wall, { tint: 0x6e6862, bump: 0.06 });
    box(COURT.t, COURT.wall, cd + COURT.t, wm(), COURT.x0 - COURT.t / 2, COURT.wall / 2, (COURT.z0 + COURT.z1) / 2);
    box(COURT.t, COURT.wall, cd + COURT.t, wm(), COURT.x1 + COURT.t / 2, COURT.wall / 2, (COURT.z0 + COURT.z1) / 2);
    box(cw + COURT.t * 2, COURT.wall, COURT.t, wm(), (COURT.x0 + COURT.x1) / 2, COURT.wall / 2, COURT.z1 + COURT.t / 2);
    // a paler coping so the wall heads read against the skyline
    box(COURT.t + 0.08, 0.09, cd + COURT.t, cop, COURT.x0 - COURT.t / 2, COURT.wall + 0.045, (COURT.z0 + COURT.z1) / 2);
    box(COURT.t + 0.08, 0.09, cd + COURT.t, cop, COURT.x1 + COURT.t / 2, COURT.wall + 0.045, (COURT.z0 + COURT.z1) / 2);
    box(cw + COURT.t * 2 + 0.08, 0.09, COURT.t + 0.08, cop, (COURT.x0 + COURT.x1) / 2, COURT.wall + 0.045, COURT.z1 + COURT.t / 2);

    // --- the pool ---------------------------------------------------------
    const pw = POOL.x1 - POOL.x0, pd = POOL.z1 - POOL.z0;
    const tank = new THREE.MeshStandardMaterial({ color: 0x2c4a55, roughness: 0.32, metalness: 0 });
    // bed, then the four tank walls, so you read a real depth over the coping
    box(pw, 0.08, pd, tank, (POOL.x0 + POOL.x1) / 2, -POOL.depth, (POOL.z0 + POOL.z1) / 2);
    box(0.10, POOL.depth, pd, tank, POOL.x0 + 0.05, -POOL.depth / 2, (POOL.z0 + POOL.z1) / 2);
    box(0.10, POOL.depth, pd, tank, POOL.x1 - 0.05, -POOL.depth / 2, (POOL.z0 + POOL.z1) / 2);
    box(pw, POOL.depth, 0.10, tank, (POOL.x0 + POOL.x1) / 2, -POOL.depth / 2, POOL.z0 + 0.05);
    box(pw, POOL.depth, 0.10, tank, (POOL.x0 + POOL.x1) / 2, -POOL.depth / 2, POOL.z1 - 0.05);
    // coping band round the lip
    const cbw = K;
    box(pw + cbw * 2, 0.06, cbw, cop, (POOL.x0 + POOL.x1) / 2, 0.03, POOL.z0 - cbw / 2);
    box(pw + cbw * 2, 0.06, cbw, cop, (POOL.x0 + POOL.x1) / 2, 0.03, POOL.z1 + cbw / 2);
    box(cbw, 0.06, pd, cop, POOL.x0 - cbw / 2, 0.03, (POOL.z0 + POOL.z1) / 2);
    box(cbw, 0.06, pd, cop, POOL.x1 + cbw / 2, 0.03, (POOL.z0 + POOL.z1) / 2);

    // The water. Two ripple normals crossing each other, scrolled by update() —
    // the same trick the sky pool upstairs uses; still water reads as plastic.
    const rA = rippleNormal(256, 11), rB = rippleNormal(256, 29);
    rA.repeat.set(pw / 2.2, pd / 2.2);
    rB.repeat.set(pw / 3.7, pd / 3.7);
    ripples.push(rA, rB);
    const water = new THREE.Mesh(new THREE.PlaneGeometry(pw - 0.1, pd - 0.1, 40, 40),
      new THREE.MeshPhysicalMaterial({
        color: 0x3f7f96, roughness: 0.04, metalness: 0,
        transmission: tier.glassTransmission === false ? 0 : 0.86,
        thickness: POOL.depth, ior: 1.333,
        attenuationColor: new THREE.Color(0x27718d), attenuationDistance: 6,
        clearcoat: 1, clearcoatRoughness: 0.04,
        clearcoatNormalMap: rB, clearcoatNormalScale: new THREE.Vector2(0.32, 0.32),
        normalMap: rA, normalScale: new THREE.Vector2(0.2, 0.2),
        transparent: true, opacity: tier.glassTransmission === false ? 0.72 : 1,
        envMapIntensity: 1.5, side: THREE.DoubleSide,
      }));
    water.rotation.x = -Math.PI / 2;
    water.position.set((POOL.x0 + POOL.x1) / 2, -0.06, (POOL.z0 + POOL.z1) / 2);
    water.name = 'ch-pool';
    g.add(water);

    // --- the lift shaft, straight up the wing's face ----------------------
    const sm = concrete(SHAFT.w, SHAFT.top, { tint: 0x8f8880, bump: 0.06 });
    const scx = LIFT.x, scz = COURT.z0 + SHAFT.d / 2;
    box(SHAFT.w, SHAFT.top, SHAFT.d, sm, scx, SHAFT.top / 2, scz);
    box(SHAFT.w + 0.14, 0.10, SHAFT.d + 0.14, cop, scx, SHAFT.top + 0.05, scz);

    // a bench along the west wall, and two planted vessels on the terrace
    box(0.5, 0.08, 2.4, woodMat(), COURT.x0 + 0.42, 0.44, 15.4);
    for (const bz of [14.4, 16.4]) box(0.06, 0.44, 0.06, steel, COURT.x0 + 0.42, 0.22, bz);
    for (const [vx, vz, vr] of [[12.15, 12.6, 0.34], [12.15, 20.3, 0.28]]) {
      const pts = [];
      for (let i = 0; i <= 14; i++) {
        const u = i / 14;
        pts.push(new THREE.Vector2(vr * (0.5 + 0.62 * Math.sin(Math.PI * (0.16 + u * 0.76))), u * vr * 2.1));
      }
      const v = new THREE.Mesh(new THREE.LatheGeometry(pts, 36), ceramicMat(0x6b5340));
      v.position.set(vx, 0, vz);
      v.castShadow = true;
      g.add(v);
    }
  }

  // --- ceiling: flat soffit, downstand beams, skylight slot ----------------
  {
    const cm = concrete(14, 22, { tint: 0x8b847c, bump: 0.05 });
    const y = HALL.h;
    const parts = [
      [HALL.x0, SKY.x0, HALL.z0, HALL.z1],
      [SKY.x1, PIER.x + PIER.t, HALL.z0, HALL.z1],
      [SKY.x0, SKY.x1, SKY.z1, HALL.z1],
    ];
    for (const [x0, x1, z0, z1] of parts) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 0.5, z1 - z0), cm);
      p.position.set((x0 + x1) / 2, y + 0.25, (z0 + z1) / 2);
      p.castShadow = true; p.receiveShadow = true;
      g.add(p);
    }
    // skylight reveal: deep concrete jambs, then a bright glazing plane
    const jamb = concrete(6, 1.2, { tint: 0x9d968d });
    box(0.06, 1.1, SKY.z1 - SKY.z0, jamb, SKY.x0, y + 0.6, (SKY.z0 + SKY.z1) / 2);
    box(0.06, 1.1, SKY.z1 - SKY.z0, jamb, SKY.x1, y + 0.6, (SKY.z0 + SKY.z1) / 2);
    // …and cap its ends. The reveal stands above the wall head, so without
    // these the slot is open to the sky at both ends of the run.
    box(SKY.x1 - SKY.x0, 1.1, 0.06, jamb, (SKY.x0 + SKY.x1) / 2, y + 0.6, SKY.z0);
    box(SKY.x1 - SKY.x0, 1.1, 0.06, jamb, (SKY.x0 + SKY.x1) / 2, y + 0.6, SKY.z1);
    const glaze = new THREE.Mesh(
      new THREE.PlaneGeometry(SKY.x1 - SKY.x0, SKY.z1 - SKY.z0),
      new THREE.MeshBasicMaterial({ color: 0xfff6e4, toneMapped: false })
    );
    glaze.rotation.x = Math.PI / 2;
    glaze.position.set((SKY.x0 + SKY.x1) / 2, y + 1.05, (SKY.z0 + SKY.z1) / 2);
    g.add(glaze);

    // instanced downstand beams across the hall soffit, skipping the slot
    const bg = new THREE.BoxGeometry(HALL.x1 - HALL.x0 + 0.9, 0.46, 0.34);
    const beams = new THREE.InstancedMesh(bg, cm, 14);
    beams.castShadow = true; beams.receiveShadow = true;
    const M = new THREE.Matrix4();
    let n = 0;
    for (let i = 0; i < 14; i++) {
      const z = HALL.z0 + 1.4 + i * 1.52;
      if (z > SKY.z0 - 0.4 && z < SKY.z1 + 0.4) continue;
      M.makeTranslation((HALL.x0 + PIER.x) / 2 + 0.45, y - 0.23, z);
      beams.setMatrixAt(n++, M);
    }
    beams.count = n;
    g.add(beams);
  }

  // --- the recessed LED cove down the west wall ----------------------------
  // Only the fixture and its glow live here; the lamps that actually light the
  // wall are in setupChadreaLighting, so they hide and bake with the rig.
  {
    const zc = (HALL.z0 + HALL.z1) / 2, L = HALL.z1 - HALL.z0 - 1.2, yc = 6.95;
    box(0.62, 0.30, L, concrete(22, 1, { tint: 0x9b948b }), HALL.x0 + 0.31, yc + 0.34, zc);
    box(0.62, 0.16, L, concrete(22, 1, { tint: 0x7e786f }), HALL.x0 + 0.31, yc - 0.30, zc);
    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 0.06, L),
      new THREE.MeshBasicMaterial({ color: 0xffd9a0, toneMapped: false })
    );
    strip.position.set(HALL.x0 + 0.56, yc + 0.12, zc);
    g.add(strip);
    const glow = new THREE.Mesh(
      new THREE.PlaneGeometry(0.55, L),
      new THREE.MeshBasicMaterial({
        color: 0xffc784, transparent: true, opacity: 0.30,
        blending: THREE.AdditiveBlending, depthWrite: false,
      })
    );
    glow.rotation.x = Math.PI / 2;
    glow.position.set(HALL.x0 + 0.34, yc + 0.18, zc);
    g.add(glow);
    // the matching cove over the arch pier, running its full length
    const cl = COVE.z1 - COVE.z0, cz2 = (COVE.z0 + COVE.z1) / 2;
    box(0.5, 0.26, cl, concrete(16, 1, { tint: 0x968f86 }), PIER.x - 0.25, COVE.y, cz2);
    const s2 = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 0.05, cl - 0.4),
      new THREE.MeshBasicMaterial({ color: 0xffd9a0, toneMapped: false })
    );
    s2.position.set(PIER.x - 0.48, COVE.y - 0.1, cz2);
    g.add(s2);
  }

  // --- mezzanine -----------------------------------------------------------
  {
    const mm = concrete(12, 6, { tint: 0x8f8880 });
    const w = MEZZ.x1 - MEZZ.x0, d = MEZZ.z1 - MEZZ.z0;
    const cx = (MEZZ.x0 + MEZZ.x1) / 2, cz = (MEZZ.z0 + MEZZ.z1) / 2;
    box(w, MEZZ.t, d, mm, cx, MEZZ.top - MEZZ.t / 2, cz);
    // the deep upstand fascia on the two open edges
    box(0.32, 0.86, d, mm, MEZZ.x1 - 0.16, MEZZ.top - 0.62, cz);
    box(w, 0.86, 0.32, mm, cx, MEZZ.top - 0.62, MEZZ.z1 - 0.16);

    // Slim black steel balustrade. The east run breaks where the flight lands —
    // in the sketch the rail ran the full length and sealed the visitor out of
    // the deck they had just climbed to.
    const bal = new THREE.InstancedMesh(new THREE.BoxGeometry(0.022, 1.03, 0.022), steel, 220);
    bal.castShadow = true;
    const M = new THREE.Matrix4();
    let n = 0;
    for (let z = MEZZ.z0 + 0.2; z <= MEZZ.z1 - 0.05; z += 0.115) {
      if (z > STAIR.z0 - 0.15 && z < STAIR.z1 + 0.15) continue;   // the stair mouth
      M.makeTranslation(MEZZ.x1 - 0.06, MEZZ.top + 0.52, z);
      bal.setMatrixAt(n++, M);
    }
    for (let x = MEZZ.x0 + 0.2; x <= MEZZ.x1 - 0.12; x += 0.115) {
      M.makeTranslation(x, MEZZ.top + 0.52, MEZZ.z1 - 0.06);
      bal.setMatrixAt(n++, M);
    }
    bal.count = n;
    g.add(bal);
    // handrails: the east one starts where the mouth ends
    const eastLen = MEZZ.z1 - 0.1 - STAIR.z1;
    box(0.05, 0.035, eastLen, steel, MEZZ.x1 - 0.06, MEZZ.top + 1.05, (STAIR.z1 + MEZZ.z1 - 0.1) / 2);
    box(w - 0.2, 0.035, 0.05, steel, cx, MEZZ.top + 1.05, MEZZ.z1 - 0.06);
  }

  // --- the cantilevered flight --------------------------------------------
  const stairLen = STAIR.xb - STAIR.xt;
  const ANG = Math.atan2(STAIR.top, stairLen);   // the flight's rake
  {
    const risers = 22, rise = STAIR.top / risers, run = stairLen / risers;
    const sm = concrete(8, 3, { tint: 0x968f86, bump: 0.04 });
    const tg = new THREE.BoxGeometry(run + 0.04, rise * 0.42, STAIR.z1 - STAIR.z0);
    const treads = new THREE.InstancedMesh(tg, sm, risers);
    treads.castShadow = true; treads.receiveShadow = true;
    const M = new THREE.Matrix4();
    // The bottom CURTAIL.length treads are cast as the broad steps below, so
    // the instanced run starts above them — an instance there would z-fight the
    // curtail step's own top face, which sits at exactly the same height.
    let t = 0;
    for (let i = CURTAIL.length; i < risers; i++) {
      M.makeTranslation(STAIR.xb - (i + 0.5) * run, (i + 1) * rise - rise * 0.21, (STAIR.z0 + STAIR.z1) / 2);
      treads.setMatrixAt(t++, M);
    }
    treads.count = t;
    g.add(treads);
    // raking soffit beam under the flight
    const soff = new THREE.Mesh(
      new THREE.BoxGeometry(Math.hypot(stairLen, STAIR.top) + 0.4, 0.34, STAIR.z1 - STAIR.z0 - 0.06), sm
    );
    soff.position.set((STAIR.xb + STAIR.xt) / 2, STAIR.top / 2 - 0.30, (STAIR.z0 + STAIR.z1) / 2);
    // NEGATIVE: the flight climbs toward −x, and a positive rotation about Z
    // lifts the +x end. The sketch had this the other way round, so the soffit
    // and the handrail both raked against their own treads.
    soff.rotation.z = -ANG;
    soff.castShadow = true; soff.receiveShadow = true;
    g.add(soff);
    // The curtail steps. Each is an extruded plan with its two outer corners
    // rounded, so the cascade finishes on a curve rather than a corner — the
    // bottom one throws 1.7 m into the hall and is the widest radius. Solid
    // from the floor up, so they read as cast masonry rather than plates.
    for (const c of CURTAIL) {
      const s = new THREE.Shape();
      s.moveTo(c.x0, c.z0);
      s.lineTo(c.x1, c.z0);
      s.lineTo(c.x1, c.z1 - c.r);
      s.quadraticCurveTo(c.x1, c.z1, c.x1 - c.r, c.z1);
      s.lineTo(c.x0 + c.r, c.z1);
      s.quadraticCurveTo(c.x0, c.z1, c.x0, c.z1 - c.r);
      s.lineTo(c.x0, c.z0);
      const geo = new THREE.ExtrudeGeometry(s, { depth: c.top, bevelEnabled: false, curveSegments: 20 });
      const m = new THREE.Mesh(geo, sm);
      // the shape is drawn in plan; stand it up so its depth becomes height
      m.rotation.x = Math.PI / 2;
      m.position.y = c.top;
      m.castShadow = true; m.receiveShadow = true;
      g.add(m);
    }
    // Slim steel balustrade on the open (south) side — starting at STAIR.open,
    // so the bottom of the flight is walked onto rather than fenced off.
    const bal = new THREE.InstancedMesh(new THREE.BoxGeometry(0.02, 1.0, 0.02), steel, 70);
    bal.castShadow = true;
    let n = 0;
    for (let i = 0; i <= Math.floor(stairLen / 0.115); i++) {
      const x = STAIR.xb - i * 0.115;
      if (x > STAIR.open) continue;
      const y = STAIR.top * (STAIR.xb - x) / stairLen;
      M.makeTranslation(x, y + 0.52, STAIR.z1 - 0.05);
      bal.setMatrixAt(n++, M);
    }
    bal.count = n;
    g.add(bal);
    // the handrail spans only the guarded run, and its centre is read off the
    // flight so it stays on top of the balusters wherever `open` is moved to
    const railRun = STAIR.open - STAIR.xt;
    const railCx = (STAIR.xt + STAIR.open) / 2;
    const rail = box(Math.hypot(railRun, STAIR.top * railRun / stairLen), 0.032, 0.05, steel,
      railCx, STAIR.top * (STAIR.xb - railCx) / stairLen + 1.02, STAIR.z1 - 0.05);
    rail.rotation.z = -ANG;   // rakes with the treads, same reason as the soffit

    // The volute. Where the rake ends the rail keeps going, turning off the
    // flight and down across the curtail steps, following their rounded west
    // ends and curling back on itself at the bottom. VOLUTE is the same path
    // chadreaSegments() fences, so you cannot walk through what you can see —
    // and it curls WEST, away from the mouth, leaving the bottom step's south
    // face clear to walk up.
    const vp = VOLUTE.map(([x, z, y]) => new THREE.Vector3(x, y, z));
    const curve = new THREE.CatmullRomCurve3(vp, false, 'catmullrom', 0.4);
    const volute = new THREE.Mesh(new THREE.TubeGeometry(curve, 72, 0.024, 8, false), steel);
    volute.castShadow = true;
    g.add(volute);
    // balusters fanning down the curl, each stopping on whatever step it lands on
    const vb = new THREE.InstancedMesh(new THREE.BoxGeometry(0.02, 1, 0.02), steel, 40);
    vb.castShadow = true;
    let vn = 0;
    // spaced along the curve's ARC length, not its parameter — the curl is far
    // tighter than the run above it, and even parameter spacing bunches them
    // into a cage there
    const SAMPLES = Math.max(3, Math.round(curve.getLength() / 0.34));
    for (let i = 1; i <= SAMPLES; i++) {
      const p = curve.getPointAt(i / SAMPLES);
      const foot = curtailTop(p.x, p.z) ?? 0;
      const h = p.y - foot;
      if (h < 0.25) continue;
      M.makeScale(1, h, 1);
      M.setPosition(p.x, foot + h / 2, p.z);
      vb.setMatrixAt(vn++, M);
    }
    vb.count = vn;
    g.add(vb);
  }

  // --- the hang: ten works, flat on the concrete ---------------------------
  // Unframed, standing off the wall on their own painted edges, the way
  // Brutalism Hall does it. Each canvas carries its manifest entry on
  // `userData.artwork` and goes into `interactables`, so E in front of one
  // opens its wall label; a slot with no entry keeps a generated canvas and
  // answers nothing.
  const interactables = [];
  {
    // The picture's edge, seen side-on. Board-marked concrete is a busy ground
    // and a bright white edge cuts the work off it — this is the concrete's own
    // shadow tone, so the canvas reads as sitting ON the wall.
    const edgeMat = () => new THREE.MeshStandardMaterial({ color: 0x6f685f, roughness: 0.92 });
    SLOTS.forEach((slot, i) => {
      const piece = art[i] || null;
      const [w, h] = sizeFor(piece, slot);
      const face = new THREE.MeshStandardMaterial({
        // dark until the photograph lands, so an unloaded slot reads as a
        // shadow on the concrete rather than a lightbox
        color: piece?.image ? 0x2e2823 : 0xffffff, roughness: 0.66, metalness: 0,
      });
      const canvas = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.045), [
        edgeMat(), edgeMat(), edgeMat(), edgeMat(), face, edgeMat(),
      ]);
      const [nx, , nz] = slot.n;
      canvas.position.set(slot.pos[0] + nx * 0.024, slot.pos[1], slot.pos[2] + nz * 0.024);
      canvas.rotation.y = Math.atan2(nx, nz);
      canvas.castShadow = true; canvas.receiveShadow = true;
      canvas.name = `art-${slot.id}`;
      g.add(canvas);
      if (!piece) return;

      canvas.userData.artwork = piece;
      interactables.push(canvas);
      if (piece.image) {
        loadArtTexture(piece.image, { anisotropy: aniso, px: piece.px, maxEdge }, (tx) => {
          face.map = tx;
          face.color.setHex(0xffffff);
          face.needsUpdate = true;
        });
      } else {
        face.map = generatePainting(4100 + i * 53, piece.palette || 'mixed', w / h);
        face.needsUpdate = true;
      }
    });
  }

  // --- console: blackened steel carcass, reclaimed-wood top ----------------
  {
    const cx = HALL.x0 + 0.44, cz = 2.7, L = 4.6;
    box(0.78, 0.66, L, blackenedMat(), cx, 0.52, cz);
    box(0.84, 0.055, L + 0.1, woodMat(), cx, 0.875, cz);
    for (let i = 0; i < 3; i++) box(0.005, 0.5, 0.02, steel, cx - 0.39, 0.52, cz - L / 2 + 0.6 + i * 1.5);
    for (const lz of [cz - L / 2 + 0.25, cz + L / 2 - 0.25]) {
      for (const lx of [cx - 0.28, cx + 0.28]) box(0.04, 0.18, 0.04, steel, lx, 0.09, lz);
    }
    const vase = (x, z, r, hh, t) => {
      const pts = [];
      for (let i = 0; i <= 14; i++) {
        const u = i / 14;
        pts.push(new THREE.Vector2(r * (0.42 + 0.72 * Math.sin(Math.PI * (0.14 + u * 0.78))), u * hh));
      }
      const m = new THREE.Mesh(new THREE.LatheGeometry(pts, 40), ceramicMat(t));
      m.position.set(x, 0.9, z);
      m.castShadow = true;
      g.add(m);
    };
    vase(cx, cz - 1.9, 0.30, 0.62, 0x6b5340);
    vase(cx, cz + 1.55, 0.22, 0.30, 0x7a5c3f);
    // dried branches out of the taller vessel
    const br = new THREE.Group();
    br.position.set(cx, 1.5, cz - 1.9);
    g.add(br);
    const twig = new THREE.MeshStandardMaterial({ color: 0x3a2f24, roughness: 0.9 });
    for (let i = 0; i < 26; i++) {
      const len = rnd(0.5, 1.25);
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.011, len, 4), twig);
      m.position.set(rnd(-0.1, 0.1), len / 2, rnd(-0.1, 0.1));
      m.rotation.set(rnd(-0.5, 0.5), Math.random() * 6, rnd(-0.5, 0.5));
      br.add(m);
      for (let j = 0; j < 5; j++) {
        const l = new THREE.Mesh(new THREE.SphereGeometry(0.022, 5, 4), twig);
        l.scale.set(1, 0.4, 2.4);
        l.position.set(rnd(-0.16, 0.16), len * rnd(0.4, 1), rnd(-0.16, 0.16));
        m.add(l);
      }
    }
    box(0.3, 0.05, 0.42, new THREE.MeshStandardMaterial({ color: 0x24201d, roughness: 0.7 }), cx, 0.93, cz + 0.1);
  }

  // dark plinth + vessel by the foot of the flight — the volute's newel
  {
    box(PLINTH.w, PLINTH.h, PLINTH.w, woodMat(true), PLINTH.x, PLINTH.h / 2, PLINTH.z);
    const pts = [];
    for (let i = 0; i <= 16; i++) {
      const u = i / 16;
      pts.push(new THREE.Vector2(0.30 * Math.sin(Math.PI * (0.18 + u * 0.74)), u * 0.52));
    }
    const v = new THREE.Mesh(new THREE.LatheGeometry(pts, 40), ceramicMat(0x4a3c30));
    v.position.set(PLINTH.x, PLINTH.h, PLINTH.z);
    v.castShadow = true;
    g.add(v);
  }

  // --- furniture: the rug and the one table standing on it -----------------
  // Nothing else. The sketch's L sofa became an ottoman and the ottoman is now
  // gone too — the room reads better with the concrete uninterrupted.
  {
    const RUG = { x: -1.4, z: 2.0, w: 6.6, d: 5.2 };
    const rug = new THREE.Mesh(new THREE.PlaneGeometry(RUG.w, RUG.d), (() => {
      const c = cv(512), x = c.getContext('2d');
      x.fillStyle = '#8e877c'; x.fillRect(0, 0, 512, 512);
      blotch(x, 512, 512, 120, 20, 180, ['122,116,106', '168,162,150'], 0.35);
      grain(x, 512, 512, 14);
      return new THREE.MeshStandardMaterial({ color: 0xa9a297, roughness: 0.95, map: tex(c, 1, 1, true) });
    })());
    rug.rotation.x = -Math.PI / 2;
    rug.position.set(RUG.x, 0.012, RUG.z);
    rug.receiveShadow = true;
    g.add(rug);

    // The round travertine pedestal, standing a little off the rug's centre —
    // dead centre would read as a showroom set-piece, and the offset is toward
    // the arch so the table sits in the light coming through it. Everything
    // that was ever set out on a table in this room is on this one now. TOP is
    // the stone's upper face; every object is placed off that rather than off
    // a literal, so the whole setting moves with the table.
    const tv = travertineMat();
    const TB = { x: RUG.x + 0.55, z: RUG.z + 0.35, r: 1.32 };
    const TOP = 0.795;
    const top = new THREE.Mesh(new THREE.CylinderGeometry(TB.r, TB.r, 0.11, 64), tv);
    top.position.set(TB.x, TOP - 0.055, TB.z);
    top.castShadow = true; top.receiveShadow = true;
    g.add(top);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.52, 0.69, 48), tv);
    base.position.set(TB.x, 0.345, TB.z);
    base.castShadow = true; base.receiveShadow = true;
    g.add(base);
    const bowlPts = [];
    for (let i = 0; i <= 12; i++) { const u = i / 12; bowlPts.push(new THREE.Vector2(0.05 + 0.20 * u, u * u * 0.16)); }
    const bowl = new THREE.Mesh(new THREE.LatheGeometry(bowlPts, 36), ceramicMat(0x1d1917));
    bowl.position.set(TB.x + 0.50, TOP, TB.z + 0.15);
    bowl.castShadow = true;
    g.add(bowl);
    box(0.42, 0.055, 0.3, new THREE.MeshStandardMaterial({ color: 0x1e1a18, roughness: 0.55 }),
      TB.x - 0.20, TOP + 0.03, TB.z + 0.52);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.29, 28, 20), ceramicMat(0x2a2320));
    bulb.scale.set(1, 0.86, 1);
    bulb.position.set(TB.x - 0.50, TOP + 0.25, TB.z - 0.40);
    bulb.castShadow = true;
    g.add(bulb);
    const platPts = [];
    for (let i = 0; i <= 10; i++) { const u = i / 10; platPts.push(new THREE.Vector2(0.08 + 0.32 * u, u * u * 0.10)); }
    const platter = new THREE.Mesh(new THREE.LatheGeometry(platPts, 40), ceramicMat(0x7a6349));
    platter.position.set(TB.x + 0.55, TOP, TB.z + 0.35);
    platter.castShadow = true;
    g.add(platter);
    // dried stems out of the vessel
    const g2 = new THREE.Group();
    g2.position.set(TB.x - 0.50, TOP + 0.40, TB.z - 0.40);
    g.add(g2);
    const twig = new THREE.MeshStandardMaterial({ color: 0x40342a, roughness: 0.9 });
    for (let i = 0; i < 20; i++) {
      const len = rnd(0.6, 1.5);
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.009, len, 4), twig);
      m.position.set(rnd(-0.08, 0.08), len / 2, rnd(-0.08, 0.08));
      m.rotation.set(rnd(-0.45, 0.45), Math.random() * 6, rnd(-0.45, 0.45));
      g2.add(m);
    }
  }

  // --- the blade of light out of the slot, and haze to carry it ------------
  {
    const c = cv(64, 256), x = c.getContext('2d');
    const grad = x.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, 'rgba(255,244,224,0.85)');
    grad.addColorStop(0.55, 'rgba(255,238,214,0.30)');
    grad.addColorStop(1, 'rgba(255,232,206,0)');
    x.fillStyle = grad; x.fillRect(0, 0, 64, 256);
    const e = x.createLinearGradient(0, 0, 64, 0);
    e.addColorStop(0, 'rgba(0,0,0,1)');
    e.addColorStop(0.14, 'rgba(0,0,0,0)');
    e.addColorStop(0.86, 'rgba(0,0,0,0)');
    e.addColorStop(1, 'rgba(0,0,0,1)');
    x.globalCompositeOperation = 'destination-out';
    x.fillStyle = e; x.fillRect(0, 0, 64, 256);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshBasicMaterial({
      map: t, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
      // 0.25, not the sketch's 0.6: these sheets are additive and metres wide,
      // and the sketch's camera never went near them. The walk up the hall goes
      // straight through this one, and at 0.6 it whites out the whole frame.
      side: THREE.DoubleSide, opacity: 0.25, toneMapped: false,
    });
    const dir = new THREE.Vector3(2.4, 0.4, -6.5).sub(SUN_POS).normalize();
    const drop = HALL.h / Math.abs(dir.y);
    const off = new THREE.Vector3(dir.x * drop, 0, dir.z * drop);
    const shaft = new THREE.Group();
    g.add(shaft);
    const sheet = (w, cx, cz) => {
      const geo = new THREE.BufferGeometry();
      const hw = w / 2;
      const p = new Float32Array([
        cx - hw, HALL.h, cz,
        cx + hw, HALL.h, cz,
        cx + hw + off.x, HALL.h - drop * Math.abs(dir.y), cz + off.z,
        cx - hw + off.x, HALL.h - drop * Math.abs(dir.y), cz + off.z,
      ]);
      geo.setAttribute('position', new THREE.BufferAttribute(p, 3));
      geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]), 2));
      geo.setIndex([0, 1, 2, 0, 2, 3]);
      geo.computeVertexNormals();
      return new THREE.Mesh(geo, mat);
    };
    const zc = (SKY.z0 + SKY.z1) / 2;
    for (const dz of [-2.0, 0, 2.0]) shaft.add(sheet(SKY.x1 - SKY.x0, (SKY.x0 + SKY.x1) / 2, zc + dz));
    // the pool of light where it lands
    const pool = new THREE.Mesh(new THREE.CircleGeometry(2.0, 40),
      new THREE.MeshBasicMaterial({
        color: 0xfff0d4, transparent: true, opacity: 0.14,
        blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
      }));
    pool.rotation.x = -Math.PI / 2;
    pool.position.set((SKY.x0 + SKY.x1) / 2 + off.x, 0.02, zc + off.z);
    g.add(pool);
  }

  const N = tier.motes ?? 300;
  const pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    pos[i * 3] = rnd(HALL.x0, PIER.x);
    pos[i * 3 + 1] = rnd(0.3, HALL.h - 0.4);
    pos[i * 3 + 2] = rnd(HALL.z0, HALL.z1);
  }
  const mg = new THREE.BufferGeometry();
  mg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const motes = new THREE.Points(mg, new THREE.PointsMaterial({
    color: 0xffe7c6, size: 0.022, transparent: true, opacity: 0.35,
    depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true,
  }));
  g.add(motes);

  scene.add(g);

  let t = 0;
  return {
    group: g,
    interactables,
    spawn: SPAWN,
    slots: SLOTS,
    motes,
    update(dt) {
      t += dt;
      motes.rotation.y = t * 0.004;
      // the pool's two normal maps drift against each other
      ripples[0].offset.x += dt * 0.013;
      ripples[0].offset.y += dt * 0.009;
      ripples[1].offset.x -= dt * 0.008;
      ripples[1].offset.y += dt * 0.011;
    },
  };
}

// ---------------------------------------------------------------------------
// LIGHT
//
// One low sun through the slot and down the west wall, a second standing in the
// wing so the far side of the arch stays the brighter room, and the cove's own
// lamps. Only the sun casts; shadows bake once per entry (Lighting.js turns
// shadowMap.autoUpdate off).

export function setupChadreaLighting(scene, renderer, tier = {}) {
  const hemi = new THREE.HemisphereLight(0xa8b4bd, 0x2b2520, 0.55);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xffe9c9, 4.6);
  sun.position.copy(SUN_POS);
  sun.target.position.set(2.4, 0.4, -6.5);
  sun.castShadow = true;
  sun.shadow.mapSize.setScalar(tier.shadowSize || 2048);
  sun.shadow.camera.left = -24;
  sun.shadow.camera.right = 24;
  sun.shadow.camera.top = 26;
  sun.shadow.camera.bottom = -22;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 95;
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);

  // A downlight over the lift. Its leaves face north, away from wingSun, so
  // without this the one thing in the wing you are meant to walk to is the
  // darkest surface in it.
  const liftLamp = new THREE.SpotLight(0xfff0dc, 16, 8, 0.75, 0.9, 1.7);
  liftLamp.position.set(LIFT.x, LIFT.h + 1.55, LIFT.z - 1.15);
  liftLamp.target.position.set(LIFT.x, LIFT.h * 0.45, LIFT.z - 0.1);
  scene.add(liftLamp, liftLamp.target);

  // daylight in the wing, from past its east wall
  const wingSun = new THREE.DirectionalLight(0xfff1dc, 2.2);
  wingSun.position.set(19, 14, 16);
  wingSun.target.position.set(7, 1, 7);
  scene.add(wingSun, wingSun.target);

  // warm rim grazing the west wall's board texture
  const rim = new THREE.SpotLight(0xffca8e, 26, 24, 0.72, 0.85, 1.6);
  rim.position.set(-2.2, 6.4, 8.6);
  rim.target.position.set(HALL.x0 + 0.2, 3.2, 2.2);
  scene.add(rim, rim.target);

  const fill = new THREE.PointLight(0xd9c3a4, 8, 16, 2.0);
  fill.position.set(-1.0, 2.4, 4.2);
  scene.add(fill);

  // The pier's west face takes no sun — it looks away from it — and the cove
  // only grazes its head, so below about 6 m it renders as flat black. Two wide,
  // weak washes off the hall give the boards and tie holes something to catch
  // without lifting the wall out of shadow; it should still read as the dark
  // mass the lit west wall is measured against.
  const pierWash = [];
  for (const z of [-7.0, -1.0]) {
    const s = new THREE.SpotLight(0xffe0b8, 13, 22, 0.95, 1.0, 1.7);
    s.position.set(-1.6, 6.2, z + 1.6);
    s.target.position.set(PIER.x - 0.05, 2.4, z);
    scene.add(s, s.target);
    pierWash.push(s);
  }

  // The cove's lamps. Count follows the tier — ten point lights in one room is
  // the expensive part of this hall, and the low tier runs it on six.
  const low = tier.name === 'low';
  const coveN = low ? 4 : 7;
  const archN = low ? 3 : 5;
  const L = HALL.z1 - HALL.z0 - 1.2, yc = 6.95;
  const cove = [];
  for (let i = 0; i < coveN; i++) {
    // total flux held roughly constant as the count drops
    const p = new THREE.PointLight(0xffbe79, 10 * (7 / coveN), 9, 2.1);
    p.position.set(HALL.x0 + 0.7, yc + 0.05, HALL.z0 + 1.6 + i * (L / (coveN - 0.8)));
    scene.add(p);
    cove.push(p);
  }
  // …and the pier's, spread over the full run of COVE so the wall you arrive
  // facing is lit along its whole length.
  for (let i = 0; i < archN; i++) {
    const p = new THREE.PointLight(0xffb872, 7 * (5 / archN), 10, 2.2);
    p.position.set(PIER.x - 0.7, COVE.y - 0.2, COVE.z0 + 0.8 + i * ((COVE.z1 - COVE.z0 - 1.6) / (archN - 1)));
    scene.add(p);
    cove.push(p);
  }

  return {
    hemi, sun, wingSun, rim, fill, cove, pierWash, liftLamp,
    bake: () => { renderer.shadowMap.needsUpdate = true; },
  };
}

// ---------------------------------------------------------------------------
// GROUND
//
// Two plates and one flight. The hall and the wing are both at zero, so the
// only heights that matter are the ramp and the mezzanine deck — and the deck
// is handed only to someone already up near it, or you would be lifted onto it
// while walking underneath.

export function chadreaGround(x, z, prevY = 0) {
  // The curtail steps and the ramp overlap where the broad steps have replaced
  // the flight's bottom treads, so take whichever is higher — the steps are
  // solid masonry and the ramp underneath them is notional.
  let y = 0;
  const c = curtailTop(x, z);
  if (c !== null) y = c;
  const s = stairY(x, z);
  if (s !== null && s > y) y = s;
  // The flight is cantilevered over open floor, so its height is only offered
  // to someone already near it; otherwise you walk beneath it.
  if (y > 0 && y <= prevY + 0.75) return y;
  if (prevY > MEZZ.top - 1.6 && onMezz(x, z)) return MEZZ.top;
  return 0;
}

function stairY(x, z) {
  if (x < STAIR.xt || x > STAIR.xb || z < STAIR.z0 || z > STAIR.z1) return null;
  return STAIR.top * (STAIR.xb - x) / (STAIR.xb - STAIR.xt);
}

// The curtail steps, highest first — they overlap, and the one on top is the
// one you stand on. Their rounded outer corners are honoured, so you don't walk
// out onto air where the plan curves away.
function curtailTop(x, z) {
  for (let i = CURTAIL.length - 1; i >= 0; i--) {
    const c = CURTAIL[i];
    if (x < c.x0 || x > c.x1 || z < c.z0 || z > c.z1) continue;
    if (z > c.z1 - c.r) {
      if (x < c.x0 + c.r && Math.hypot(x - (c.x0 + c.r), z - (c.z1 - c.r)) > c.r) continue;
      if (x > c.x1 - c.r && Math.hypot(x - (c.x1 - c.r), z - (c.z1 - c.r)) > c.r) continue;
    }
    return c.top;
  }
  return null;
}

function onMezz(x, z) {
  return x >= MEZZ.x0 && x <= MEZZ.x1 && z >= MEZZ.z0 && z <= MEZZ.z1;
}

// ---------------------------------------------------------------------------
// COLLIDERS
//
// The sketch collided against axis-aligned boxes; this room collides against
// lines, level-gated the way Collision.js wants them — a numeric `level` only
// holds within ±0.6 of the walking height, so the mezzanine's rails switch off
// for anyone on the floor below, while the shell stays 'all'.

const seg = (ax, az, bx, bz, level = 'all') => ({ a: [ax, az], b: [bx, bz], level });
const rect = (x0, z0, x1, z1, level = 'all') => [
  seg(x0, z0, x1, z0, level), seg(x1, z0, x1, z1, level),
  seg(x1, z1, x0, z1, level), seg(x0, z1, x0, z0, level),
];
// A closed fence of chords round a round object. Same idea as main.js's
// ringSegments; kept local so the room's colliders are all in one file.
function ringSegments(cx, cz, r, sides = 12, level = 'all') {
  const out = [];
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * Math.PI * 2, b = ((i + 1) / sides) * Math.PI * 2;
    out.push(seg(cx + Math.cos(a) * r, cz + Math.sin(a) * r,
      cx + Math.cos(b) * r, cz + Math.sin(b) * r, level));
  }
  return out;
}

export function chadreaSegments() {
  const c = [];
  const F = 0;                 // ground level, for anything standing on the floor

  // --- the shell, at every height -----------------------------------------
  c.push(seg(HALL.x0, HALL.z0, HALL.x0, HALL.z1));        // west art wall
  c.push(seg(HALL.x0, HALL.z0, PIER.x, HALL.z0));         // north wall
  // South wall — the HALL's only. The wing's share of this line is two
  // openings onto the courtyard now, with only the lift shaft solid between
  // them, so it stops at the wing rather than running the full width.
  c.push(seg(HALL.x0, HALL.z1, WING.x0, HALL.z1));
  // the pier: two solid blocks either side of the arch opening
  c.push(...rect(PIER.x, HALL.z0, PIER.x + PIER.t, PIER.az0));
  c.push(...rect(PIER.x, PIER.az1, PIER.x + PIER.t, HALL.z1));
  // the wing
  c.push(seg(PIER.x, WING.z0, WING.x1, WING.z0));         // north wall
  c.push(seg(WING.x1, WING.z0, WING.x1, COURT.z1));       // east wall, on into the court

  // the courtyard: west and south walls, and the lift shaft standing in the
  // middle of the wing's face between its two openings
  c.push(seg(COURT.x0, COURT.z0, COURT.x0, COURT.z1));
  c.push(seg(COURT.x0, COURT.z1, COURT.x1, COURT.z1));
  c.push(...rect(LIFT.x - SHAFT.w / 2, COURT.z0, LIFT.x + SHAFT.w / 2, COURT.z0 + SHAFT.d));
  // …and the pool, fenced on its coping. Nothing here is standable water.
  c.push(...rect(POOL.x0 - POOL.coping, POOL.z0 - POOL.coping,
                 POOL.x1 + POOL.coping, POOL.z1 + POOL.coping, F));
  c.push(...rect(COURT.x0 + 0.17, 14.2, COURT.x0 + 0.67, 16.6, F));   // the terrace bench

  // --- the flight's open side ---------------------------------------------
  // 'all' on purpose: it is a cast upstand off the floor, not a rail, so it
  // also closes the pocket north of the flight at ground level. It stops at
  // STAIR.open — that gap is the way onto the stair.
  c.push(seg(STAIR.xt, STAIR.z1, STAIR.open, STAIR.z1));
  // …then the volute picks it up and carries it down across the curtail steps,
  // fenced on the same path the tube is drawn on. It curls west, away from the
  // bottom step's south face, which is the way up.
  for (let i = 0; i < VOLUTE.length - 1; i++) {
    c.push(seg(VOLUTE[i][0], VOLUTE[i][1], VOLUTE[i + 1][0], VOLUTE[i + 1][1]));
  }

  // --- the mezzanine's rails, only while you're on the deck ---------------
  // The east run starts where the flight lands, so the mouth stays open.
  c.push(seg(MEZZ.x1, STAIR.z1, MEZZ.x1, MEZZ.z1, MEZZ.top));
  c.push(seg(MEZZ.x0, MEZZ.z1, MEZZ.x1, MEZZ.z1, MEZZ.top));

  // --- what stands on the ground floor ------------------------------------
  c.push(...rect(-7.95, 0.40, -7.17, 5.00, F));    // console, its vessels inside it
  c.push(...rect(PLINTH.x - PLINTH.w / 2, PLINTH.z - PLINTH.w / 2,
                 PLINTH.x + PLINTH.w / 2, PLINTH.z + PLINTH.w / 2, F));   // the plinth
  // The travertine table, the only thing standing on the rug. A ring, not the
  // square the other pieces get: it is 2.6 m across and stands in the walking
  // route, so square corners would push you off it a stride early on the
  // diagonal. Centre must track TB in buildChadreaRoom.
  c.push(...ringSegments(-0.85, 2.35, 1.40, 14, F));
  c.push(...rect(12.33, 7.80, 12.83, 10.40, F));   // the wing's bench
  return c;
}
