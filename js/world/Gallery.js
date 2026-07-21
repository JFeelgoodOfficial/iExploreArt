import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  ROOM, WINDOW_N, GLASS_S, S_DOOR, SKYLIGHT, STAIR, STAIR_VOID,
  MEZZ_RECTS, FREE_WALL, DOOR, stairRamp,
} from './layout.js';

// Builds the entire building shell as a handful of merged meshes
// (one per material) so the whole architecture costs ~8 draw calls.

export function buildGallery(scene, mats) {
  const bags = { plaster: [], wood: [], woodDark: [], concrete: [], steel: [], railGlass: [] };

  // box with UVs scaled to world size so textures tile at a constant density
  function box(bag, w, h, d, x, y, z) {
    const g = new THREE.BoxGeometry(w, h, d);
    worldUV(g, w, h, d);
    g.translate(x, y, z);
    bags[bag].push(g);
  }

  const { w: W, d: D, mezzY: M, roofY: R, wallT: T, slab: S } = ROOM;
  const half = T / 2;

  // ---- perimeter walls -----------------------------------------------------
  // North (z=0): piers + band below sill + band above head; window is the gap.
  box('plaster', WINDOW_N.x0, R, T, WINDOW_N.x0 / 2, R / 2, -half);
  box('plaster', W - WINDOW_N.x1, R, T, (W + WINDOW_N.x1) / 2, R / 2, -half);
  box('plaster', WINDOW_N.x1 - WINDOW_N.x0, WINDOW_N.sill, T, (WINDOW_N.x0 + WINDOW_N.x1) / 2, WINDOW_N.sill / 2, -half);
  box('plaster', WINDOW_N.x1 - WINDOW_N.x0, R - WINDOW_N.head, T, (WINDOW_N.x0 + WINDOW_N.x1) / 2, (R + WINDOW_N.head) / 2, -half);
  // deep window sill / seat
  box('wood', WINDOW_N.x1 - WINDOW_N.x0, 0.06, 0.45, (WINDOW_N.x0 + WINDOW_N.x1) / 2, WINDOW_N.sill + 0.03, 0.22);

  // South (z=14): side walls + band above the courtyard glazing.
  box('plaster', GLASS_S.x0, R, T, GLASS_S.x0 / 2, R / 2, D + half);
  box('plaster', W - GLASS_S.x1, R, T, (W + GLASS_S.x1) / 2, R / 2, D + half);
  box('plaster', GLASS_S.x1 - GLASS_S.x0, R - GLASS_S.y1, T, (GLASS_S.x0 + GLASS_S.x1) / 2, (R + GLASS_S.y1) / 2, D + half);

  // West / East walls.
  box('plaster', T, R, D, -half, R / 2, D / 2);
  box('plaster', T, R, D, W + half, R / 2, D / 2);

  // Entry door on the west wall (visual recess + dark panel + frame).
  const doorW = DOOR.z1 - DOOR.z0;
  box('woodDark', 0.08, DOOR.h, doorW - 0.16, 0.06, DOOR.h / 2, (DOOR.z0 + DOOR.z1) / 2);
  box('steel', 0.1, 0.08, doorW, 0.06, DOOR.h + 0.04, (DOOR.z0 + DOOR.z1) / 2);
  box('steel', 0.1, DOOR.h + 0.08, 0.08, 0.06, (DOOR.h + 0.08) / 2, DOOR.z0);
  box('steel', 0.1, DOOR.h + 0.08, 0.08, 0.06, (DOOR.h + 0.08) / 2, DOOR.z1);

  // ---- floors --------------------------------------------------------------
  // Ground slab (structure) + wood wear layer on top.
  box('concrete', W, 0.3, D, W / 2, -0.16, D / 2);
  box('wood', W, 0.04, D, W / 2, -0.005, D / 2);

  // Mezzanine slabs: plaster soffit body + wood floor overlay.
  for (const r of MEZZ_RECTS) {
    const rw = r.x1 - r.x0, rd = r.z1 - r.z0;
    box('plaster', rw, S, rd, (r.x0 + r.x1) / 2, M - S / 2 - 0.03, (r.z0 + r.z1) / 2);
    box('wood', rw, 0.03, rd, (r.x0 + r.x1) / 2, M - 0.015, (r.z0 + r.z1) / 2);
    // slim steel fascia along the slab edge reads as structure
  }
  // fascia strips on the atrium-facing edges — nudged ~1cm proud of the slab
  // edge so the steel face wins the depth test (no z-fighting with the plaster).
  box('steel', 0.06, S + 0.1, 11.2, 7 - 0.02, M - S / 2 - 0.03, 5.6);
  box('steel', 0.06, S + 0.1, 11.2, 17 + 0.02, M - S / 2 - 0.03, 5.6);
  box('steel', 10.06, S + 0.1, 0.06, 12, M - S / 2 - 0.03, 11.2 + 0.02);

  // ---- roof with skylight --------------------------------------------------
  const sk = SKYLIGHT;
  box('plaster', sk.x0, 0.3, D, sk.x0 / 2, R + 0.15, D / 2);
  box('plaster', W - sk.x1, 0.3, D, (W + sk.x1) / 2, R + 0.15, D / 2);
  box('plaster', sk.x1 - sk.x0, 0.3, sk.z0, (sk.x0 + sk.x1) / 2, R + 0.15, sk.z0 / 2);
  box('plaster', sk.x1 - sk.x0, 0.3, D - sk.z1, (sk.x0 + sk.x1) / 2, R + 0.15, (D + sk.z1) / 2);
  // skylight frame
  frameRect(bags.steel, sk.x0, sk.z0, sk.x1, sk.z1, R + 0.1, 0.12, 0.25);

  // ---- freestanding gallery wall ------------------------------------------
  const fw = FREE_WALL;
  box('plaster', fw.x1 - fw.x0, fw.h, fw.z1 - fw.z0, (fw.x0 + fw.x1) / 2, fw.h / 2, (fw.z0 + fw.z1) / 2);
  box('woodDark', fw.x1 - fw.x0 + 0.1, 0.06, fw.z1 - fw.z0 + 0.1, (fw.x0 + fw.x1) / 2, fw.h + 0.03, (fw.z0 + fw.z1) / 2);
  box('woodDark', fw.x1 - fw.x0 + 0.06, 0.1, fw.z1 - fw.z0 + 0.06, (fw.x0 + fw.x1) / 2, 0.05, (fw.z0 + fw.z1) / 2);

  // ---- stairs --------------------------------------------------------------
  buildStairs(bags);

  // ---- railings ------------------------------------------------------------
  const rails = [
    [7, 0, 7, 11.2], [17, 0, 17, 11.2], [7, 11.2, 17, 11.2],
    [22, STAIR_VOID.z0, 22, STAIR_VOID.z1], [22, STAIR_VOID.z0, 24, STAIR_VOID.z0],
  ];
  for (const [ax, az, bx, bz] of rails) railing(bags, ax, az, bx, bz, M);

  // ---- merge & emit --------------------------------------------------------
  const group = new THREE.Group();
  group.name = 'gallery-architecture';
  const raycastable = [];
  for (const [name, list] of Object.entries(bags)) {
    if (!list.length) continue;
    const merged = mergeGeometries(list);
    const mesh = new THREE.Mesh(merged, mats[name === 'railGlass' ? 'railGlass' : name]);
    mesh.castShadow = name !== 'railGlass';
    mesh.receiveShadow = name !== 'railGlass';
    mesh.name = `arch-${name}`;
    group.add(mesh);
    if (name !== 'railGlass') raycastable.push(mesh);
  }

  // ---- glazing (kept separate: transparent, no shadow casting) -------------
  const glazing = new THREE.Group();
  glazing.name = 'glazing';

  const winGlass = pane(mats.glass, WINDOW_N.x1 - WINDOW_N.x0, WINDOW_N.head - WINDOW_N.sill);
  winGlass.position.set((WINDOW_N.x0 + WINDOW_N.x1) / 2, (WINDOW_N.sill + WINDOW_N.head) / 2, -0.02);
  glazing.add(winGlass);

  // south glazing in three panes around the courtyard door opening
  const southSpans = [
    { x0: GLASS_S.x0, x1: S_DOOR.x0, y0: 0, y1: GLASS_S.y1 },
    { x0: S_DOOR.x1, x1: GLASS_S.x1, y0: 0, y1: GLASS_S.y1 },
    { x0: S_DOOR.x0, x1: S_DOOR.x1, y0: S_DOOR.h, y1: GLASS_S.y1 }, // header above the door
  ];
  for (const s of southSpans) {
    const p = pane(mats.glass, s.x1 - s.x0, s.y1 - s.y0);
    p.position.set((s.x0 + s.x1) / 2, (s.y0 + s.y1) / 2, D + 0.02);
    p.rotation.y = Math.PI;
    glazing.add(p);
  }

  const skyGlass = pane(mats.glass, sk.x1 - sk.x0, sk.z1 - sk.z0);
  skyGlass.position.set((sk.x0 + sk.x1) / 2, R + 0.12, (sk.z0 + sk.z1) / 2);
  skyGlass.rotation.x = -Math.PI / 2;
  glazing.add(skyGlass);

  // mullions
  const mull = [];
  mullionsNorth(mull);
  mullionsSouth(mull);
  const mullMesh = new THREE.Mesh(mergeGeometries(mull), mats.steel);
  mullMesh.castShadow = true;
  mullMesh.name = 'mullions';
  group.add(mullMesh);
  raycastable.push(mullMesh);

  scene.add(group);
  scene.add(glazing);
  return { group, glazing, raycastable };
}

// --------------------------------------------------------------------------
function pane(mat, w, h) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  m.name = 'glass-pane';
  return m;
}

function buildStairs(bags) {
  const s = STAIR;
  const wSpan = s.x1 - s.x0;
  const cx = (s.x0 + s.x1) / 2;

  for (const run of [s.run1, s.run2]) {
    const rise = run.y1 - run.y0;
    const n = Math.max(1, Math.round(rise / 0.167));
    const td = (run.z1 - run.z0) / n;
    for (let i = 0; i < n; i++) {
      const top = run.y0 + ((i + 1) / n) * rise;
      const z = run.z0 + (i + 0.5) * td;
      boxInto(bags.concrete, wSpan, top, td, cx, top / 2, z);
    }
  }
  boxInto(bags.concrete, wSpan, s.landing.y, s.landing.z1 - s.landing.z0, cx, s.landing.y / 2, (s.landing.z0 + s.landing.z1) / 2);

  // solid balustrade wall following the ramp, floor to ramp + 1.0
  const step = 0.25;
  for (let z = s.entryZ; z < STAIR_VOID.z1; z += step) {
    const zc = z + step / 2;
    const h = stairRamp(zc) + 1.0;
    boxInto(bags.plaster, 0.14, h, step + 0.01, s.x0 - 0.07, h / 2, zc);
  }
  // wood handrail cap on the balustrade
  for (let z = s.entryZ; z < STAIR_VOID.z1; z += step) {
    const zc = z + step / 2;
    boxInto(bags.woodDark, 0.2, 0.05, step + 0.01, s.x0 - 0.07, stairRamp(zc) + 1.02, zc);
  }
}

function railing(bags, ax, az, bx, bz, level) {
  const dx = bx - ax, dz = bz - az;
  const len = Math.hypot(dx, dz);
  const nx = dx / len, nz = dz / len;
  const posts = Math.max(2, Math.round(len / 1.4) + 1);
  for (let i = 0; i < posts; i++) {
    const t = i / (posts - 1);
    const x = ax + dx * t, z = az + dz * t;
    boxInto(bags.steel, 0.045, 1.05, 0.045, x, level + 0.525, z);
  }
  // glass infill + wood cap (single long boxes, rotated)
  const gx = (ax + bx) / 2, gz = (az + bz) / 2;
  const angle = Math.atan2(dz, dx);
  boxRot(bags.railGlass, len - 0.08, 0.86, 0.016, gx, level + 0.5, gz, angle);
  boxRot(bags.woodDark, len, 0.05, 0.09, gx, level + 1.06, gz, angle);
}

function mullionsNorth(list) {
  const { x0, x1, sill, head } = WINDOW_N;
  const h = head - sill, cy = (sill + head) / 2;
  const nV = 5;
  for (let i = 0; i < nV; i++) {
    const x = x0 + (i / (nV - 1)) * (x1 - x0);
    boxInto(list, 0.09, h + 0.1, 0.16, x, cy, -0.02);
  }
  for (const y of [sill, (sill + head) / 2, head]) {
    boxInto(list, x1 - x0 + 0.09, 0.09, 0.16, (x0 + x1) / 2, y, -0.02);
  }
}

function mullionsSouth(list) {
  const { x0, x1, y0, y1 } = GLASS_S;
  const h = y1 - y0, cy = (y0 + y1) / 2;
  const verts = [2, 4.3, 6.6, 8.9, S_DOOR.x0, S_DOOR.x1, 15.2, 17.5, 19.8, 22];
  for (const x of verts) boxInto(list, 0.09, h + 0.05, 0.16, x, cy, 14.02);
  // full-width head rail
  boxInto(list, x1 - x0 + 0.09, 0.09, 0.16, (x0 + x1) / 2, y1, 14.02);
  // bottom shoes either side of the door
  boxInto(list, S_DOOR.x0 - x0, 0.06, 0.16, (x0 + S_DOOR.x0) / 2, y0 + 0.03, 14.02);
  boxInto(list, x1 - S_DOOR.x1, 0.06, 0.16, (S_DOOR.x1 + x1) / 2, y0 + 0.03, 14.02);
  // door header rail
  boxInto(list, S_DOOR.x1 - S_DOOR.x0 + 0.09, 0.09, 0.16, (S_DOOR.x0 + S_DOOR.x1) / 2, S_DOOR.h, 14.02);
}

function frameRect(list, x0, z0, x1, z1, y, h, w) {
  boxInto(list, x1 - x0 + w, h, w, (x0 + x1) / 2, y, z0);
  boxInto(list, x1 - x0 + w, h, w, (x0 + x1) / 2, y, z1);
  boxInto(list, w, h, z1 - z0 + w, x0, y, (z0 + z1) / 2);
  boxInto(list, w, h, z1 - z0 + w, x1, y, (z0 + z1) / 2);
}

function boxInto(list, w, h, d, x, y, z) {
  const g = new THREE.BoxGeometry(w, h, d);
  worldUV(g, w, h, d);
  g.translate(x, y, z);
  list.push(g);
}

function boxRot(list, w, h, d, x, y, z, ry) {
  const g = new THREE.BoxGeometry(w, h, d);
  worldUV(g, w, h, d);
  g.rotateY(ry);
  g.translate(x, y, z);
  list.push(g);
}

// Scale each box face's UVs by its world dimensions so a texture with
// repeat (1,1) tiles once per meter everywhere in the merged mesh.
function worldUV(g, w, h, d) {
  const uv = g.attributes.uv;
  // BoxGeometry face order: +X -X +Y -Y +Z -Z, 4 verts each
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) {
    const [su, sv] = dims[f];
    for (let v = 0; v < 4; v++) {
      const i = f * 4 + v;
      uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
    }
  }
}
