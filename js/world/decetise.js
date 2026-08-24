import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Decetise Hall — residency five (room id `decetise`). Maria Decetise.
//
// One whole floor plate of a high rise. Glazed on three sides over the city —
// north (−Z), east (+X), and west (−X) over an infinity pool that fills the
// terrace edge to edge and spills off a weir at the lip of the slab. The
// terrace is looked at, not walked on: the west wall is sealed glass, and the
// collision plan has nothing out there at all. The south wall is the art wall.
//
// The lift core stands in the MIDDLE of the plate,
// which is where a visitor arrives, and the core sits in a courtyard — gravel
// parterre, balustraded stone kerb, clipped hedges and topiary, a stone basin
// with green park chairs, lamp posts — with five plane trees running up through
// oculi cut in the ceiling. Two freestanding partitions and the core's own three
// solid faces carry the rest of the hang. A French park met a top-floor suite.
//
// Same shape as the other residencies (js/world/brutalism/brutalist.js,
// js/world/chadrea/chadrea.js): this file owns the room and its lighting rig,
// main.js owns the skyline, the way back down and the room registration.
//
//   const room = buildDecetiseRoom(scene, { tier, art: DECETISE_HANG, ...artOpts });
//   const lights = setupDecetiseLighting(scene, renderer, tier);
//   room.update(t);   // the pool's swell, the canopies' sway, the jet
//
// Nothing adds itself outside `scene` — main.js builds the room inside
// rooms.captureLayer() so every mesh and every light hides with it. The lift
// that serves it is the reception cabin (data/residencies.js, floor 5); the
// core's own back wall is how you ride back down (see ROOM_FACTORIES).
//
// --- the plan (metres) ------------------------------------------------------
export const DX = {
  x0: -17, x1: 17, z0: -13, z1: 13,        // interior
  ceil: 4.8,
  tx0: -24,                                 // terrace runs west of x0
  core: 1.8,                                // lift core half-width
  yard: 8,                                  // courtyard half-width (the parterre)
  yardEdge: 9.6,                            // where the solid ceiling slabs start
  holeR: 2.6,                               // ceiling panels dropped inside this radius
  // The pool is the terrace: it runs from the plate's own edge (the weir hangs
  // a hair past tx0, so the sheet falls off the building) east to within half a
  // metre of the glass. There is no deck left to stand on beside it, which is
  // the point — the west wall is sealed and the water is something you look at
  // through it, not something you walk around.
  pool: { x0: -23.8, x1: -17.5, z0: -8.4, z1: 8.4 },
};

// You arrive in the cabin, facing out of it up the courtyard's north walk.
export const SPAWN = { x: 0, z: 0.4, yaw: 0 };

// Late afternoon, low and off the pool — the terrace is west.
export const SUN_POS = new THREE.Vector3(-96, 42, 34);

const TREES = [[-6, -6], [6, -6], [-6, 6], [6, 6], [0, -7.2]];
const LAMPS = [[-7.4, -7.4], [7.4, -7.4], [-7.4, 7.4], [7.4, 7.4]];

// The freestanding partitions. `face` is the side the picture hangs on: +1
// looks back toward the courtyard. Only the north half carries them — a
// partition standing off the art wall crowded the six pictures on it, so that
// pair came out and the lift core took their work instead.
const PARTITIONS = [
  { x: -10.5, z: -9.2, w: 6.4, face: 1 },
  { x: 11, z: -9.2, w: 6.4, face: 1 },
];

// The three solid faces of the lift core hang too — the first pictures you see,
// standing in the cabin doorway with your back to it.
const CORE_FACES = [
  { id: 'DX-C1', x: 0, z: 1.97, rotY: 0, w: 2.2, h: 1.9 },              // south face
  { id: 'DX-C2', x: -1.97, z: 0, rotY: -Math.PI / 2, w: 2.2, h: 1.9 },  // west face
  { id: 'DX-C3', x: 1.97, z: 0, rotY: Math.PI / 2, w: 2.2, h: 1.9 },    // east face
];

// Slot geometry, the way layout.js keeps the gallery's: ten places a picture can
// go. Six on the art wall, one on each partition. `w`/`h` is the largest picture
// that slot takes; a manifest entry's own aspect is fitted inside it.
export const SLOTS = [
  { id: 'DX-A1', x: -13.2, y: 1.95, z: DX.z1 - 0.12, rotY: Math.PI, w: 1.5, h: 2.05 },
  { id: 'DX-A2', x: -8.1, y: 1.95, z: DX.z1 - 0.12, rotY: Math.PI, w: 2.2, h: 1.5 },
  { id: 'DX-A3', x: -3.0, y: 1.95, z: DX.z1 - 0.12, rotY: Math.PI, w: 1.4, h: 1.9 },
  { id: 'DX-A4', x: 3.0, y: 1.95, z: DX.z1 - 0.12, rotY: Math.PI, w: 1.8, h: 1.8 },
  { id: 'DX-A5', x: 8.1, y: 1.95, z: DX.z1 - 0.12, rotY: Math.PI, w: 2.0, h: 1.4 },
  { id: 'DX-A6', x: 13.2, y: 1.95, z: DX.z1 - 0.12, rotY: Math.PI, w: 1.35, h: 1.9 },
  ...PARTITIONS.map((p, i) => ({
    id: `DX-P${i + 1}`,
    x: p.x, y: 1.85, z: p.z + p.face * 0.16,
    rotY: p.face > 0 ? 0 : Math.PI,
    w: Math.min(p.w - 1.6, 2.0), h: 1.85,
  })),
  ...CORE_FACES.map((c) => ({ id: c.id, x: c.x, y: 1.8, z: c.z, rotY: c.rotY, w: c.w, h: c.h })),
];

// The house manifest for this hall, in slot order. Every entry is a placeholder
// until the real files land: give one an `image` and a `px` and it hangs instead.
// Same convention as data/brutalist-artworks.js.
export const DECETISE_HANG = [
  // art wall (DX-A1…A6)
  { title: 'Parterre, Late Light', image: null },
  { title: 'Twelve Storeys of Weather', image: null },
  { title: 'Allée', image: null },
  { title: 'The Basin at Six', image: null },
  { title: 'Hedge, Clipped Twice', image: null },
  { title: 'Cornice and Cloud', image: null },
  // partitions (DX-P1…P2)
  { title: 'Study for a Green Chair', image: null },
  { title: 'Water Held at the Edge', image: null },
  // the lift core (DX-C1…C3)
  { title: 'Plane Tree Through the Ceiling', image: null },
  { title: 'Gravel, Rain Coming', image: null },
  { title: 'The Doors Open Inward', image: null },
];

const ARTIST = 'Maria Decetise';

// --- little helpers ---------------------------------------------------------
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Lighting. Late afternoon: one low warm sun off the terrace, a cool bounce
// through the east glazing so that half of the plate isn't a silhouette, and a
// hemisphere for the sky. Shadows are baked on entry like every other room
// (shadowMap.autoUpdate is off — js/world/Lighting.js).
export function setupDecetiseLighting(scene, renderer, tier = {}) {
  const shadowSize = tier.shadowSize ?? 1024;

  const sun = new THREE.DirectionalLight(0xffd9a0, 3.1);
  sun.position.copy(SUN_POS);
  sun.castShadow = true;
  sun.shadow.mapSize.set(shadowSize, shadowSize);
  const c = sun.shadow.camera;
  c.near = 1; c.far = 190; c.left = -34; c.right = 34; c.top = 30; c.bottom = -30;
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.03;

  const hemi = new THREE.HemisphereLight(0xbcd7ea, 0x9c8f79, 0.55);
  const ambient = new THREE.AmbientLight(0xffe9cf, 0.28);
  const bounce = new THREE.DirectionalLight(0xcfe0ef, 0.5);
  bounce.position.set(38, 16, -30);

  // the lamp posts and the cabin: two point lights, no more — the rest of the
  // fixtures are emissive geometry, which costs nothing
  const lamp = new THREE.PointLight(0xffd9a0, 4, 9, 2);
  lamp.position.set(-7.4, 3.1, 7.4);
  const cabin = new THREE.PointLight(0xffe2b4, 6, 7, 2);
  cabin.position.set(0, 2.45, 0);

  scene.add(sun, sun.target, hemi, ambient, bounce, lamp, cabin);

  return {
    sun,
    bake() { renderer.shadowMap.needsUpdate = true; },
  };
}

// ---------------------------------------------------------------------------
// The room. opts: { tier, art, anisotropy, artMaxEdge, materials }
// Returns { interactables, update(t), dispose() }.
export function buildDecetiseRoom(scene, opts = {}) {
  const { tier = {}, art = DECETISE_HANG, anisotropy = 8 } = opts;
  const rand = mulberry32(12_071);
  const flowers = tier.flowers ?? 320;      // read for parity; used to thin foliage
  const lean = flowers < 200;               // low tier: fewer canopy blobs

  const owned = [];                          // everything this room added
  const add = (o) => { scene.add(o); owned.push(o); return o; };

  // --- materials (the house set, warmed for the hour) ----------------------
  const M = {
    plaster: new THREE.MeshStandardMaterial({ color: 0xf1ece2, roughness: 0.94, side: THREE.DoubleSide }),
    limestone: new THREE.MeshStandardMaterial({ color: 0xd9d0be, roughness: 0.88 }),
    stonePale: new THREE.MeshStandardMaterial({ color: 0xe8e1d4, roughness: 0.78 }),
    steel: new THREE.MeshStandardMaterial({ color: 0x33343a, roughness: 0.4, metalness: 0.85 }),
    brass: new THREE.MeshStandardMaterial({ color: 0xa88b52, roughness: 0.35, metalness: 0.9 }),
    marble: new THREE.MeshStandardMaterial({ color: 0x23252b, roughness: 0.25, metalness: 0.05 }),
    parkGreen: new THREE.MeshStandardMaterial({ color: 0x2f5140, roughness: 0.55, metalness: 0.15 }),
    hedge: new THREE.MeshStandardMaterial({ color: 0x33512f, roughness: 1, flatShading: true }),
    leaf: new THREE.MeshStandardMaterial({ color: 0x496f36, roughness: 1, flatShading: true }),
    leafLit: new THREE.MeshStandardMaterial({ color: 0x6f8a3c, roughness: 1, flatShading: true }),
    bark: new THREE.MeshStandardMaterial({ color: 0x8d8271, roughness: 0.85 }),
    // Transmission glass is a second scene pass per frame; a whole floor of it
    // is unaffordable, so the glazing takes the cheap pane from
    // js/world/materials.js's low tier on every tier.
    glass: new THREE.MeshStandardMaterial({
      color: 0xdfe9ea, transparent: true, opacity: 0.14,
      roughness: 0.05, metalness: 0.4, envMapIntensity: 1.4, depthWrite: false,
    }),
    railGlass: new THREE.MeshStandardMaterial({
      color: 0xe8f0ef, transparent: true, opacity: 0.16, roughness: 0.08,
      metalness: 0.2, depthWrite: false, side: THREE.DoubleSide,
    }),
    water: new THREE.MeshStandardMaterial({
      color: 0x2f6f73, roughness: 0.08, metalness: 0.25, transparent: true, opacity: 0.86,
    }),
    sheet: new THREE.MeshBasicMaterial({ color: 0x9fd6d4, transparent: true, opacity: 0.4, side: THREE.DoubleSide }),
    glow: new THREE.MeshStandardMaterial({ color: 0xfff0cf, emissive: 0xffd9a0, emissiveIntensity: 2.2, roughness: 0.5 }),
  };

  // --- procedural surfaces (canvas, the way js/utils/proctex.js does) ------
  function gravelTexture() {
    const cv = document.createElement('canvas'); cv.width = cv.height = 256;
    const g = cv.getContext('2d');
    g.fillStyle = '#cfc4ad'; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 5200; i++) {
      const v = 150 + Math.floor(rand() * 90);
      g.fillStyle = `rgba(${v},${v - 8},${v - 26},${0.35 + rand() * 0.5})`;
      g.fillRect(rand() * 256, rand() * 256, 1 + rand() * 2.2, 1 + rand() * 2.2);
    }
    const t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(8, 8);
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = anisotropy;
    return t;
  }
  function stoneTexture() {
    const cv = document.createElement('canvas'); cv.width = cv.height = 512;
    const g = cv.getContext('2d');
    g.fillStyle = '#e4ddcf'; g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 1800; i++) {
      g.fillStyle = `rgba(120,110,95,${0.03 + rand() * 0.06})`;
      g.beginPath();
      g.ellipse(rand() * 512, rand() * 512, 4 + rand() * 26, 3 + rand() * 14, rand() * 3.14, 0, 6.28);
      g.fill();
    }
    g.strokeStyle = 'rgba(120,110,95,0.20)'; g.lineWidth = 2;
    for (let i = 0; i <= 512; i += 128) {
      g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 512); g.moveTo(0, i); g.lineTo(512, i); g.stroke();
    }
    const t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(9, 7);
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = anisotropy;
    return t;
  }
  // A generated stand-in for an unhung slot — js/art/placeholder.js's job, kept
  // local so this file drops in without one.
  function placeholderArt(seed, w, h) {
    const px = 620;
    const cv = document.createElement('canvas');
    cv.width = Math.round(px * Math.min(1, w / h));
    cv.height = Math.round(px * Math.min(1, h / w));
    const g = cv.getContext('2d');
    const r2 = mulberry32(seed);
    const warm = ['#e9d9be', '#d8c3a2', '#c2a87f', '#8d9c7a', '#5c7566', '#2f6f73', '#b46f3d', '#efe7d7'];
    g.fillStyle = '#f4ece0'; g.fillRect(0, 0, cv.width, cv.height);
    for (let i = 0; i < 7; i++) {
      g.globalAlpha = 0.42 + r2() * 0.4;
      g.fillStyle = warm[Math.floor(r2() * warm.length)];
      if (r2() > 0.45) {
        g.fillRect(r2() * cv.width * 0.8, r2() * cv.height * 0.8,
          cv.width * (0.12 + r2() * 0.4), cv.height * (0.06 + r2() * 0.5));
      } else {
        g.beginPath(); g.arc(r2() * cv.width, r2() * cv.height, cv.width * (0.08 + r2() * 0.3), 0, 6.28); g.fill();
      }
    }
    g.globalAlpha = 1;
    const vg = g.createRadialGradient(cv.width / 2, cv.height / 2, 0, cv.width / 2, cv.height / 2, cv.width * 0.8);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(30,26,23,0.20)');
    g.fillStyle = vg; g.fillRect(0, 0, cv.width, cv.height);
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = anisotropy;
    return t;
  }
  function placardTexture(title) {
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 168;
    const g = cv.getContext('2d');
    g.fillStyle = '#fbf8f3'; g.fillRect(0, 0, 512, 168);
    g.fillStyle = '#6f675f'; g.font = '600 22px Inter, sans-serif';
    g.fillText(ARTIST.toUpperCase(), 26, 46);
    g.fillStyle = '#1e1a17'; g.font = 'italic 600 34px "Cormorant Garamond", Georgia, serif';
    g.fillText(title.length > 26 ? `${title.slice(0, 25)}…` : title, 26, 96);
    g.fillStyle = '#b46f3d'; g.font = '500 20px Inter, sans-serif';
    g.fillText('placeholder · 2026', 26, 134);
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = anisotropy;
    return t;
  }

  const floorMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.75, map: stoneTexture() });
  const gravelMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, map: gravelTexture() });

  function box(x, y, z, w, h, d, mat = M.plaster, shadows = true) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    if (shadows) { m.castShadow = true; m.receiveShadow = true; }
    return add(m);
  }

  // --- the plate ----------------------------------------------------------
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(DX.x1 - DX.tx0, DX.z1 - DX.z0), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set((DX.tx0 + DX.x1) / 2, 0, 0);
  floor.receiveShadow = true;
  add(floor);
  box((DX.tx0 + DX.x1) / 2, -0.56, 0, DX.x1 - DX.tx0 + 1.2, 1.1, DX.z1 - DX.z0 + 1.2, M.limestone, false);

  // Ceiling: four solid slabs round the courtyard, then an instanced grid of
  // panels over the courtyard itself with the oculi and the shaft left out. One
  // ShapeGeometry with six holes is the obvious way and the wrong one — that
  // triangulation is unbounded on this plan.
  function ceilSlab(x0, z0, x1, z1) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), M.plaster);
    m.rotation.x = Math.PI / 2;
    m.position.set((x0 + x1) / 2, DX.ceil, (z0 + z1) / 2);
    add(m);
  }
  const YE = DX.yardEdge;
  ceilSlab(DX.x0, DX.z0, -YE, DX.z1);
  ceilSlab(YE, DX.z0, DX.x1, DX.z1);
  ceilSlab(-YE, DX.z0, YE, -YE);
  ceilSlab(-YE, YE, YE, DX.z1);
  {
    const cell = 1.2;
    const panels = [];
    for (let x = -YE + cell / 2; x < YE; x += cell) {
      for (let z = -YE + cell / 2; z < YE; z += cell) {
        if (Math.abs(x) < DX.core + 0.4 && Math.abs(z) < DX.core + 0.4) continue;
        if (TREES.some(([tx, tz]) => Math.hypot(x - tx, z - tz) < DX.holeR)) continue;
        panels.push([x, z]);
      }
    }
    const grid = new THREE.InstancedMesh(new THREE.PlaneGeometry(cell, cell), M.plaster, panels.length);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0));
    const one = new THREE.Vector3(1, 1, 1);
    panels.forEach(([x, z], i) => { m4.compose(new THREE.Vector3(x, DX.ceil, z), q, one); grid.setMatrixAt(i, m4); });
    grid.instanceMatrix.needsUpdate = true;
    add(grid);
  }
  for (const [tx, tz] of TREES) {
    const annulus = new THREE.Mesh(new THREE.RingGeometry(1.75, DX.holeR + 1.0, 32), M.plaster);
    annulus.rotation.x = Math.PI / 2;
    annulus.position.set(tx, DX.ceil, tz);
    add(annulus);
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(1.75, 1.75, 0.5, 24, 1, true), M.plaster);
    collar.position.set(tx, DX.ceil + 0.25, tz);
    add(collar);
  }

  // south art wall — the only solid face of the plate
  box((DX.x0 + DX.x1) / 2, DX.ceil / 2, DX.z1 + 0.15, DX.x1 - DX.x0 + 0.6, DX.ceil, 0.3);

  // glazing: a pane, mullions at a bay's spacing, head and sill rails
  function glazing(axis, fixed, from, to, step) {
    const span = to - from;
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(span, DX.ceil - 0.2), M.glass);
    if (axis === 'x') pane.position.set((from + to) / 2, (DX.ceil - 0.2) / 2 + 0.1, fixed);
    else { pane.position.set(fixed, (DX.ceil - 0.2) / 2 + 0.1, (from + to) / 2); pane.rotation.y = -Math.PI / 2; }
    add(pane);
    for (let p = from; p <= to + 0.01; p += step) {
      const mull = new THREE.Mesh(new THREE.BoxGeometry(0.09, DX.ceil, 0.14), M.steel);
      if (axis === 'x') mull.position.set(p, DX.ceil / 2, fixed);
      else { mull.position.set(fixed, DX.ceil / 2, p); mull.rotation.y = -Math.PI / 2; }
      add(mull);
    }
    for (const y of [0.06, DX.ceil - 0.06]) {
      const rail = new THREE.Mesh(
        axis === 'x' ? new THREE.BoxGeometry(span, 0.12, 0.16) : new THREE.BoxGeometry(0.16, 0.12, span),
        M.steel
      );
      rail.position.set(axis === 'x' ? (from + to) / 2 : fixed, y, axis === 'x' ? fixed : (from + to) / 2);
      add(rail);
    }
  }
  glazing('x', DX.z0 - 0.05, DX.x0, DX.x1, 2.83);        // north wall of glass
  glazing('z', DX.x1 + 0.05, DX.z0, DX.z1, 2.6);         // east wall of glass
  // West: one unbroken run, not two flanking a doorway. The terrace used to
  // slide open in the middle; it doesn't any more. The pool now reaches the
  // glass and there is nowhere out there to stand, so the wall is a window onto
  // the water and the city under it — sealed, and closed in decetiseSegments()
  // to match. Restore the two split runs plus the posts and lintel if the
  // terrace is ever meant to be walked on again.
  glazing('z', DX.x0 - 0.02, DX.z0, DX.z1, 2.5);         // west wall of glass
  box(DX.x0 - 1.2, DX.ceil - 0.14, 0, 2.4, 0.28, DX.z1 - DX.z0);   // soffit out over the water

  // --- the terrace: an infinity pool, edge to edge -------------------------
  // Seen, never stood on. The water runs from the plate's west edge — where it
  // spills over a weir that hangs past the slab, five storeys up — back to
  // within half a metre of the glass, the whole length between the two ends of
  // the pleached allée. What used to be deck round three sides is water now.
  const P = DX.pool;
  box((P.x0 + P.x1) / 2, -0.7, (P.z0 + P.z1) / 2, P.x1 - P.x0, 1.4, P.z1 - P.z0,
    new THREE.MeshStandardMaterial({ color: 0x1d4a4e, roughness: 0.35 }), false);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(P.x1 - P.x0, P.z1 - P.z0, 28, 28), M.water);
  water.rotation.x = -Math.PI / 2;
  water.position.set((P.x0 + P.x1) / 2, -0.06, (P.z0 + P.z1) / 2);
  add(water);
  const waterBase = water.geometry.attributes.position.array.slice();
  // Coping on three sides; the west side is the infinity edge and stays open.
  // The east strip is all that separates water from glass — half a metre, so the
  // pane reads as standing in the pool rather than across a walkway from it.
  const COPE = DX.x0 - P.x1;                       // glass line back to the water
  const endW = DX.x0 - P.x0, endX = (P.x0 + DX.x0) / 2;   // weir across to the glass
  box(endX, 0.02, P.z0 - 0.28, endW, 0.12, 0.56, M.stonePale);
  box(endX, 0.02, P.z1 + 0.28, endW, 0.12, 0.56, M.stonePale);
  box(P.x1 + COPE / 2, 0.02, 0, COPE, 0.12, P.z1 - P.z0 + 1.1, M.stonePale);
  box(P.x0 - 0.25, -0.11, 0, 0.5, 0.1, P.z1 - P.z0, M.stonePale, false);      // the weir lip
  const sheet = new THREE.Mesh(new THREE.PlaneGeometry(P.z1 - P.z0, 0.7), M.sheet);
  sheet.rotation.y = Math.PI / 2;
  sheet.position.set(P.x0 - 0.5, -0.42, 0);
  add(sheet);

  function balustrade(x0, z0, x1, z1) {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(len, 1.1), M.railGlass);
    panel.position.set((x0 + x1) / 2, 0.62, (z0 + z1) / 2);
    panel.rotation.y = Math.atan2(x1 - x0, z1 - z0) + Math.PI / 2;
    add(panel);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(len, 0.07, 0.1), M.steel);
    cap.position.set((x0 + x1) / 2, 1.17, (z0 + z1) / 2);
    cap.rotation.y = -Math.atan2(z1 - z0, x1 - x0);
    add(cap);
  }
  balustrade(DX.tx0, DX.z0, DX.x0, DX.z0);
  balustrade(DX.tx0, DX.z1, DX.x0, DX.z1);
  balustrade(DX.tx0, DX.z0, DX.tx0, P.z0 - 0.6);
  balustrade(DX.tx0, P.z1 + 0.6, DX.tx0, DX.z1);

  // pleached allée: clipped canopies on bare stems, flanking the pool
  const swayers = [];
  for (const z of [-9.6, 9.6]) {
    for (const x of [-22.4, -19.9]) {
      const g = new THREE.Group();
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, 2.6, 8), M.bark);
      stem.position.y = 1.3; stem.castShadow = true;
      const canopy = new THREE.Mesh(new THREE.BoxGeometry(2.3, 1.5, 1.1), M.hedge);
      canopy.position.y = 3.35; canopy.castShadow = true;
      const planter = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.45, 1.2), M.stonePale);
      planter.position.y = 0.22;
      g.add(stem, canopy, planter);
      g.position.set(x, 0, z);
      add(g);
      swayers.push(g);
    }
  }

  // No loungers. They stood on the deck the pool has since taken, which left
  // them standing in the water; and furniture on a terrace nobody can reach is
  // set for guests who will never arrive. The water runs out clean to the weir.

  // --- the lift core, in the middle of the plate --------------------------
  const C = DX.core;
  box(0, DX.ceil / 2 + 0.9, C, C * 2 + 0.3, DX.ceil + 1.8, 0.3, M.limestone);
  box(-C, DX.ceil / 2 + 0.9, 0, 0.3, DX.ceil + 1.8, C * 2, M.limestone);
  box(C, DX.ceil / 2 + 0.9, 0, 0.3, DX.ceil + 1.8, C * 2, M.limestone);
  box(0, 0.03, 0, C * 2, 0.06, C * 2, M.marble, false);            // cabin floor
  box(0, 1.3, C - 0.18, C * 2 - 0.1, 2.6, 0.05, M.brass, false);   // cabin back
  box(0, 2.62, 0, C * 2, 0.08, C * 2, M.brass, false);             // cabin ceiling
  for (const dx of [-C + 0.12, C - 0.12]) box(dx, 1.35, -C, 0.24, 2.7, 0.3, M.brass, false);
  const plate = box(C - 0.4, 1.25, C - 0.24, 0.34, 0.9, 0.04, M.steel, false);
  plate.name = 'decetise-lift-plate';
  for (let i = 0; i < 3; i++) {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.02, 14), M.brass);
    b.rotation.x = Math.PI / 2;
    b.position.set(C - 0.4, 1.5 - i * 0.22, C - 0.27);
    add(b);
  }

  // --- the courtyard: a parterre round the core ---------------------------
  const gravel = new THREE.Mesh(new THREE.PlaneGeometry(DX.yard * 2, DX.yard * 2), gravelMat);
  gravel.rotation.x = -Math.PI / 2;
  gravel.position.y = 0.015;
  gravel.receiveShadow = true;
  add(gravel);

  // balustraded stone kerb, broken on all four axes so you can walk in
  function kerbRun(x, z, w, d) {
    box(x, 0.17, z, w, 0.34, d, M.stonePale);
    const along = w > d ? 'x' : 'z';
    const len = Math.max(w, d);
    const n = Math.max(2, Math.round(len / 0.75));
    for (let i = 0; i <= n; i++) {
      const t = -len / 2 + (len * i) / n;
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.075, 0.34, 8), M.stonePale);
      b.position.set(along === 'x' ? x + t : x, 0.5, along === 'x' ? z : z + t);
      add(b);
      if (i < n) {
        const cap = new THREE.Mesh(new THREE.BoxGeometry(
          along === 'x' ? len / n : 0.12, 0.08, along === 'x' ? 0.12 : len / n), M.stonePale);
        cap.position.set(
          along === 'x' ? x + t + len / n / 2 : x, 0.71,
          along === 'x' ? z : z + t + len / n / 2);
        add(cap);
      }
    }
  }
  const Y = DX.yard;
  for (const s of [-1, 1]) {
    kerbRun(s * (Y - 2.6), -Y, 5.2, 0.36);
    kerbRun(s * (Y - 2.6), Y, 5.2, 0.36);
    kerbRun(-Y, s * (Y - 2.6), 0.36, 5.2);
    kerbRun(Y, s * (Y - 2.6), 0.36, 5.2);
  }

  // clipped hedges and topiary, one set per quadrant
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      box(sx * 4.4, 0.39, sz * 3.1, 3.4, 0.78, 0.55, M.hedge);
      box(sx * 3.0, 0.39, sz * 4.5, 0.55, 0.78, 3.4, M.hedge);
      const top = new THREE.Mesh(new THREE.SphereGeometry(0.52, 14, 12), M.leaf);
      top.position.set(sx * 4.4, 1.0, sz * 4.5); top.castShadow = true;
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.6, 8), M.bark);
      stem.position.set(sx * 4.4, 0.3, sz * 4.5);
      add(top); add(stem);
    }
  }

  // the stone basin, on the courtyard's south walk
  const fountain = new THREE.Group();
  const basin = new THREE.Mesh(new THREE.CylinderGeometry(1.95, 2.1, 0.52, 40), M.stonePale);
  basin.position.y = 0.26; basin.castShadow = true; basin.receiveShadow = true;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.98, 0.09, 10, 44), M.stonePale);
  rim.rotation.x = Math.PI / 2; rim.position.y = 0.52;
  const dish = new THREE.Mesh(new THREE.CircleGeometry(1.86, 40), M.water);
  dish.rotation.x = -Math.PI / 2; dish.position.y = 0.44;
  const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.34, 1.0, 16), M.stonePale);
  pedestal.position.y = 0.94;
  const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.5, 0.18, 24), M.stonePale);
  upper.position.y = 1.5;
  const jet = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.12, 1.1, 10, 1, true), M.sheet);
  jet.position.y = 2.05;
  fountain.add(basin, rim, dish, pedestal, upper, jet);
  fountain.position.set(0, 0, 6.6);
  add(fountain);

  // green metal park chairs, drawn up round the basin
  function parkChair(x, z, rot) {
    const g = new THREE.Group();
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.05, 0.5), M.parkGreen);
    seat.position.y = 0.44; seat.castShadow = true;
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.62, 0.05), M.parkGreen);
    back.position.set(0, 0.74, -0.24); back.rotation.x = -0.16;
    g.add(seat, back);
    for (const [dx, dz] of [[-0.22, -0.2], [0.22, -0.2], [-0.22, 0.2], [0.22, 0.2]]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.44, 6), M.parkGreen);
      leg.position.set(dx, 0.22, dz);
      g.add(leg);
    }
    for (let i = 0; i < 3; i++) {
      const slat = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.05, 0.04), M.parkGreen);
      slat.position.set(0, 0.6 + i * 0.16, -0.26 + i * 0.02);
      g.add(slat);
    }
    g.position.set(x, 0, z); g.rotation.y = rot;
    add(g);
  }
  parkChair(-2.5, 6.1, 0.6);
  parkChair(2.6, 6.9, -1.0);
  parkChair(-1.4, 8.6, 2.5);

  // park lamps at the corners of the parterre
  for (const [lx, lz] of LAMPS) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 3.1, 10), M.parkGreen);
    post.position.set(lx, 1.55, lz); post.castShadow = true;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.24, 0.28, 12), M.parkGreen);
    base.position.set(lx, 0.14, lz);
    const globe = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 12), M.glow);
    globe.position.set(lx, 3.24, lz);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.22, 12), M.parkGreen);
    cap.position.set(lx, 3.48, lz);
    add(post); add(base); add(globe); add(cap);
  }

  // --- the five plane trees, up through the oculi -------------------------
  // Real trees, not blobs: a bark-mapped tapered trunk with a root flare, a
  // recursive limb structure merged into one mesh per tree, and instanced
  // crossed-plane leaf clusters cut out with an alpha map. Five trees in a
  // courtyard get walked right up to, so the canopy has to survive being looked
  // at from a metre away — which blobs of icosahedron do not.
  function barkTexture() {
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 512;
    const g = cv.getContext('2d');
    g.fillStyle = '#8e8578'; g.fillRect(0, 0, 512, 512);
    // plane bark: broad pale plates over a darker ground, then vertical fibre
    for (let i = 0; i < 90; i++) {
      const x = rand() * 512, y = rand() * 512;
      const w = 26 + rand() * 90, h = 40 + rand() * 150;
      g.fillStyle = `rgba(${196 + rand() * 40 | 0},${188 + rand() * 40 | 0},${168 + rand() * 36 | 0},${0.28 + rand() * 0.4})`;
      g.beginPath();
      g.ellipse(x, y, w / 2, h / 2, (rand() - 0.5) * 0.4, 0, 6.28);
      g.fill();
    }
    for (let i = 0; i < 1400; i++) {
      const x = rand() * 512, y = rand() * 512;
      const h = 18 + rand() * 120;
      g.strokeStyle = `rgba(${60 + rand() * 60 | 0},${54 + rand() * 52 | 0},${44 + rand() * 44 | 0},${0.08 + rand() * 0.26})`;
      g.lineWidth = 0.6 + rand() * 2.2;
      g.beginPath();
      g.moveTo(x, y);
      g.bezierCurveTo(x + (rand() - 0.5) * 8, y + h * 0.4, x + (rand() - 0.5) * 10, y + h * 0.7, x + (rand() - 0.5) * 6, y + h);
      g.stroke();
    }
    // a few deep fissures, so raking light finds something
    for (let i = 0; i < 40; i++) {
      const x = rand() * 512;
      g.strokeStyle = `rgba(38,34,28,${0.25 + rand() * 0.35})`;
      g.lineWidth = 1.5 + rand() * 3;
      g.beginPath();
      g.moveTo(x, 0);
      for (let y = 0; y < 512; y += 48) g.lineTo(x + (rand() - 0.5) * 14, y);
      g.stroke();
    }
    const t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = anisotropy;
    return t;
  }
  // One leaf cluster: a spray of plane-tree leaves on a twig, over transparent
  // ground. Three of these quads crossed at 60° read as a bough of foliage from
  // any angle, and each leaf is shaded base-to-tip so a flat card still turns in
  // the light instead of reading as a sticker.
  //
  // The alpha lives in the canvas's own alpha channel, and the material cuts on
  // it with `alphaTest`. It must NOT also be handed back as an `alphaMap`:
  // three.js samples the GREEN channel of an alphaMap, and this texture is
  // flagged sRGB, so a leaf's green linearised to about 0.2, every cluster in
  // every canopy failed the test, and all five trees stood bare.
  function leafTexture() {
    const S = 512;
    const cv = document.createElement('canvas'); cv.width = cv.height = S;
    const g = cv.getContext('2d');
    g.clearRect(0, 0, S, S);
    // sunlit tips through to shaded interior, and a couple already turning
    const greens = [
      [96, 132, 56], [78, 112, 46], [110, 146, 62], [62, 94, 40],
      [128, 154, 66], [52, 80, 36], [146, 150, 62],
    ];
    const clamp = (v) => Math.max(0, Math.min(255, v | 0));

    // the five-lobed outline, drawn from the stalk
    function blade(len, wid) {
      g.beginPath();
      g.moveTo(0, 0);
      g.quadraticCurveTo(wid * 0.55, -len * 0.18, wid * 0.34, -len * 0.46);
      g.quadraticCurveTo(wid * 0.62, -len * 0.5, wid * 0.42, -len * 0.78);
      g.quadraticCurveTo(wid * 0.18, -len * 0.72, 0, -len);
      g.quadraticCurveTo(-wid * 0.18, -len * 0.72, -wid * 0.42, -len * 0.78);
      g.quadraticCurveTo(-wid * 0.62, -len * 0.5, -wid * 0.34, -len * 0.46);
      g.quadraticCurveTo(-wid * 0.55, -len * 0.18, 0, 0);
      g.closePath();
    }

    function leaf(cx, cy, len, wid, ang, col) {
      g.save();
      g.translate(cx, cy); g.rotate(ang);
      // stalk
      g.strokeStyle = `rgba(${clamp(col[0] * 0.66)},${clamp(col[1] * 0.7)},${clamp(col[2] * 0.56)},1)`;
      g.lineWidth = Math.max(1.2, len * 0.03);
      g.beginPath(); g.moveTo(0, len * 0.17); g.lineTo(0, 0); g.stroke();
      // blade, shaded from a dark base to a light tip
      const grd = g.createLinearGradient(0, 0, 0, -len);
      grd.addColorStop(0, `rgba(${clamp(col[0] * 0.6)},${clamp(col[1] * 0.64)},${clamp(col[2] * 0.56)},1)`);
      grd.addColorStop(0.45, `rgba(${clamp(col[0])},${clamp(col[1])},${clamp(col[2])},1)`);
      grd.addColorStop(1, `rgba(${clamp(col[0] * 1.3)},${clamp(col[1] * 1.2)},${clamp(col[2] * 1.08)},1)`);
      blade(len, wid);
      g.fillStyle = grd; g.fill();
      // a darker rim, so leaves stay separate where they overlap
      g.strokeStyle = `rgba(${clamp(col[0] * 0.48)},${clamp(col[1] * 0.52)},${clamp(col[2] * 0.42)},0.6)`;
      g.lineWidth = 1; g.stroke();
      // midrib and the three pairs of veins a plane leaf carries
      g.strokeStyle = `rgba(${clamp(col[0] + 44)},${clamp(col[1] + 48)},${clamp(col[2] + 28)},0.7)`;
      g.lineWidth = Math.max(0.8, len * 0.014);
      g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -len * 0.9); g.stroke();
      for (let i = 1; i <= 3; i++) {
        const y = -len * (0.2 * i + 0.1);
        for (const sx of [1, -1]) {
          g.beginPath(); g.moveTo(0, y);
          g.quadraticCurveTo(sx * wid * 0.2, y - len * 0.06, sx * wid * 0.36, y - len * 0.16);
          g.stroke();
        }
      }
      g.restore();
    }

    // the twig the spray hangs off, and its side shoots
    g.strokeStyle = 'rgba(84,72,54,0.95)';
    g.lineCap = 'round';
    g.lineWidth = S * 0.011;
    g.beginPath();
    g.moveTo(S * 0.5, S * 0.99);
    g.bezierCurveTo(S * 0.44, S * 0.72, S * 0.56, S * 0.44, S * 0.5, S * 0.15);
    g.stroke();
    g.lineWidth = S * 0.005;
    for (let i = 0; i < 5; i++) {
      const y = S * (0.86 - i * 0.15), sx = i % 2 ? 1 : -1;
      g.beginPath(); g.moveTo(S * 0.5, y);
      g.quadraticCurveTo(S * (0.5 + sx * 0.12), y - S * 0.05, S * (0.5 + sx * 0.25), y - S * 0.13);
      g.stroke();
    }

    // Leaves back to front, thrown wider toward the top of the card: the tip of
    // a bough carries more foliage than its base, and a card that fades out at
    // the top reads as depth rather than as a rectangle.
    const N = 34;
    for (let i = 0; i < N; i++) {
      const t = i / N;
      const len = S * (0.17 + rand() * 0.12);
      const cx = S * 0.5 + (rand() - 0.5) * S * (0.42 + t * 0.24);
      const cy = S * (0.9 - t * 0.72) + (rand() - 0.5) * S * 0.1;
      leaf(cx, cy, len, len * (0.8 + rand() * 0.32), (rand() - 0.5) * 2.7,
        greens[Math.floor(rand() * greens.length)]);
    }

    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = anisotropy;
    return t;
  }

  const barkMap = barkTexture();
  const barkMat = new THREE.MeshStandardMaterial({
    map: barkMap, bumpMap: barkMap, bumpScale: 0.06, color: 0xc9c1b2, roughness: 0.95,
  });
  const leafTex = leafTexture();
  // No `alphaMap` (see leafTexture) and no `transparent`: an alpha-tested cutout
  // belongs in the opaque pass, where it writes depth and sorts against itself
  // correctly. A transparent canopy sorts per-instance and shows its own cards
  // through each other from the wrong side.
  const leafMat = new THREE.MeshStandardMaterial({
    map: leafTex, alphaTest: 0.45,
    side: THREE.DoubleSide, roughness: 0.72, color: 0xffffff,
  });
  // A cluster billboard: three quads crossed at 60°. Two at right angles go
  // edge-on twice per turn and the bough visibly thins as you walk round it.
  const clusterGeo = (() => {
    const parts = [];
    for (let i = 0; i < 3; i++) {
      const q = new THREE.PlaneGeometry(1, 1);
      q.rotateY((i / 3) * Math.PI);
      parts.push(q);
    }
    return mergeGeometries(parts);
  })();

  const UP = new THREE.Vector3(0, 1, 0);
  function limb(geos, anchors, origin, dir, len, rad, depth) {
    const g = new THREE.CylinderGeometry(rad * 0.66, rad, len, 7, 1, true);
    g.translate(0, len / 2, 0);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, dir.clone().normalize()));
    g.translate(origin.x, origin.y, origin.z);
    geos.push(g);
    const tip = origin.clone().add(dir.clone().normalize().multiplyScalar(len));
    if (depth === 0) { anchors.push(tip); return; }
    if (depth <= 1) anchors.push(tip);
    const forks = depth > 2 ? 3 : 2;
    for (let i = 0; i < forks; i++) {
      const d = dir.clone().normalize();
      const axis = new THREE.Vector3(rand() - 0.5, (rand() - 0.5) * 0.3, rand() - 0.5).normalize();
      d.applyAxisAngle(axis, 0.34 + rand() * 0.46);
      d.y = Math.max(0.14, d.y);                      // limbs rise, they don't droop
      limb(geos, anchors, tip, d.normalize(), len * (0.6 + rand() * 0.18), rad * 0.62, depth - 1);
    }
  }

  const trees = [];
  for (const [tx, tz] of TREES) {
    const g = new THREE.Group();
    const TRUNK_H = 3.3;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.4, TRUNK_H, 16, 3), barkMat);
    trunk.position.y = TRUNK_H / 2;
    trunk.castShadow = true; trunk.receiveShadow = true;
    const flare = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.66, 0.5, 16), barkMat);
    flare.position.y = 0.24; flare.castShadow = true;
    const grate = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.05, 0.2, 24), M.stonePale);
    grate.position.y = 0.1; grate.receiveShadow = true;
    g.add(trunk, flare, grate);

    // the crown: one merged limb mesh + one instanced leaf field, both pivoted
    // at the top of the trunk so the wind can move them together
    const crown = new THREE.Group();
    crown.position.y = TRUNK_H;
    const geos = [];
    const anchors = [];
    // One more leader and one more level of forking than the crown used to
    // carry. It was built thin because nothing was showing anyway; with the
    // foliage back, a three-limb crown reads as a diagram of a tree.
    const leaders = lean ? 3 : 4;
    for (let i = 0; i < leaders; i++) {
      const a = (i / leaders) * Math.PI * 2 + rand();
      const d = new THREE.Vector3(Math.cos(a) * 0.42, 1, Math.sin(a) * 0.42).normalize();
      limb(geos, anchors, new THREE.Vector3(0, 0, 0), d, 1.9 + rand() * 0.5, 0.2, lean ? 3 : 4);
    }
    const limbs = new THREE.Mesh(mergeGeometries(geos), barkMat);
    limbs.castShadow = true;
    crown.add(limbs);

    // The low tier gets fewer anchors (a shallower fork), so it carries bigger
    // cards on each — a canopy of the same mass, drawn coarser, rather than a
    // visibly balder tree on a phone.
    const perAnchor = lean ? 3 : 4;
    const SCALE = lean ? 1.5 : 1.15;
    const leaves = new THREE.InstancedMesh(clusterGeo, leafMat, anchors.length * perAnchor);
    leaves.castShadow = true;
    leaves.receiveShadow = true;
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const sv = new THREE.Vector3();
    const pv = new THREE.Vector3();
    let n = 0;
    for (const a of anchors) {
      // How far out this anchor sits, so the canopy can be built the way a real
      // one grows: the mass rides on the outside of the crown, and the cards
      // out there hang bigger and tip over further under their own weight.
      const out = Math.min(1, Math.hypot(a.x, a.z) / 3.4);
      for (let k = 0; k < perAnchor; k++) {
        const sc = SCALE * (0.85 + rand() * 0.8 + out * 0.35);
        sv.set(sc, sc * (0.85 + rand() * 0.3), sc);
        // Keep the whole card clear of the ceiling. Anchors sit well above it
        // already, but the cards are big and jittered, and one dipping through
        // the slab shows up as a sprig of foliage lying on the plaster — the
        // canopy is meant to be seen through the oculi, not in the room.
        const floorY = (DX.ceil - TRUNK_H) + sc * 0.6;   // crown-local
        pv.set(
          a.x + (rand() - 0.5) * 1.0,
          Math.max(floorY, a.y + (rand() - 0.5) * 0.7 - out * 0.25),
          a.z + (rand() - 0.5) * 1.0
        );
        // Cards lean outward and droop; a canopy of upright rectangles is the
        // tell that gives a billboard tree away from underneath.
        e.set((rand() - 0.5) * 0.5 - out * 0.3, rand() * Math.PI * 2, (rand() - 0.5) * 0.6);
        q.setFromEuler(e);
        m4.compose(pv, q, sv);
        leaves.setMatrixAt(n, m4);
        // Tonal spread across the canopy: sunlit at the tips, deep in the shade
        // of the interior, with the warm cast of a late afternoon on the lit side.
        const lit = 0.6 + rand() * 0.34 + out * 0.28;
        leaves.setColorAt(n, new THREE.Color(lit * 1.05, lit, lit * 0.82));
        n++;
      }
    }
    leaves.instanceMatrix.needsUpdate = true;
    if (leaves.instanceColor) leaves.instanceColor.needsUpdate = true;
    crown.add(leaves);

    g.add(crown);
    g.position.set(tx, 0, tz);
    g.rotation.y = rand() * Math.PI * 2;
    add(g);
    trees.push({ crown, phase: rand() * 6.28 });
  }

  // two stone benches facing the city on the north glass
  for (const bx of [-8, 8]) box(bx, 0.21, DX.z0 + 1.5, 3.2, 0.42, 0.62, M.stonePale);

  // --- the hang ----------------------------------------------------------
  const interactables = [];
  SLOTS.forEach((slot, i) => {
    const entry = art[i] || { title: `Slot ${slot.id}`, image: null };
    // The partitions themselves, before anything hangs on them.
    if (slot.id.startsWith('DX-P')) {
      const p = PARTITIONS[Number(slot.id.slice(4)) - 1];
      box(p.x, 1.7, p.z, p.w, 3.4, 0.3);
      box(p.x, 0.06, p.z, p.w + 0.3, 0.12, 0.5, M.stonePale, false);
    }
    const tex = placeholderArt(1000 + i * 977 + entry.title.length, slot.w, slot.h);
    box(slot.x, slot.y, slot.z, slot.w, slot.h, 0.05,
      new THREE.MeshStandardMaterial({ color: 0x2a2521, roughness: 0.8 }));
    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(slot.w, slot.h),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.72 })
    );
    face.position.set(slot.x + Math.sin(slot.rotY) * 0.031, slot.y, slot.z + Math.cos(slot.rotY) * 0.031);
    face.rotation.y = slot.rotY;
    face.name = slot.id;
    // What the info panel reads (js/ui/UI.js prints title + artist).
    face.userData.artwork = {
      id: slot.id, title: entry.title, artist: entry.artist ?? ARTIST,
      description: entry.description
        ?? 'A placeholder stands here until the work arrives — the slot keeps its wall, its light and its label.',
    };
    add(face);
    interactables.push(face);

    const placard = new THREE.Mesh(
      new THREE.PlaneGeometry(0.42, 0.14),
      new THREE.MeshBasicMaterial({ map: placardTexture(entry.title) })
    );
    placard.position.set(
      slot.x + Math.sin(slot.rotY) * 0.035 + Math.cos(slot.rotY) * (slot.w / 2 + 0.34),
      slot.y - slot.h / 2 + 0.14,
      slot.z + Math.cos(slot.rotY) * 0.035 - Math.sin(slot.rotY) * (slot.w / 2 + 0.34)
    );
    placard.rotation.y = slot.rotY;
    add(placard);

    // the wash over each piece: emissive geometry, not another real light
    const strip = new THREE.Mesh(new THREE.BoxGeometry(slot.w * 0.8, 0.05, 0.09), M.glow);
    strip.position.set(
      slot.x + Math.sin(slot.rotY) * 0.28,
      Math.min(DX.ceil - 0.35, slot.y + slot.h / 2 + 0.75),
      slot.z + Math.cos(slot.rotY) * 0.28
    );
    strip.rotation.y = slot.rotY;
    add(strip);
  });

  // --- per-frame -----------------------------------------------------------
  // Cheap and skippable: the pool's swell, the canopies' sway, the jet. The
  // water is 800-odd vertices, so it moves every third frame and its normals
  // are left alone — the swell is far too shallow to notice.
  let tick = 0;
  function update(t) {
    tick++;
    if (tick % 3 === 0) {
      const pa = water.geometry.attributes.position;
      for (let i = 0; i < pa.count; i++) {
        const x = waterBase[i * 3], y = waterBase[i * 3 + 1];
        pa.array[i * 3 + 2] = Math.sin(x * 1.3 + t * 1.1) * 0.018 + Math.sin(y * 1.7 - t * 0.8) * 0.014;
      }
      pa.needsUpdate = true;
    }
    for (const tr of trees) {
      tr.crown.rotation.z = Math.sin(t * 0.6 + tr.phase) * 0.014;
      tr.crown.rotation.x = Math.cos(t * 0.47 + tr.phase) * 0.011;
    }
    for (const s of swayers) s.rotation.z = Math.sin(t * 0.7 + s.position.z) * 0.008;
    jet.scale.y = 1 + Math.sin(t * 3.1) * 0.04;
  }

  function dispose() {
    for (const o of owned) {
      o.traverse?.((c) => {
        c.geometry?.dispose();
        const mats = Array.isArray(c.material) ? c.material : c.material ? [c.material] : [];
        for (const m of mats) {
          for (const k in m) { const v = m[k]; if (v && v.isTexture) v.dispose(); }
          m.dispose();
        }
      });
      o.parent?.remove(o);
    }
    owned.length = 0;
  }

  return { interactables, liftPlate: plate, update, dispose, spawn: SPAWN };
}

// ---------------------------------------------------------------------------
// Collision. One flat floor, so `ground` is constant; the segments are the
// shell, the core, the hedges, the basin and the partitions. Nothing for the
// terrace or the pool — the west wall is glass now and neither is reachable.
// Same format as js/world/Collision.js expects.
export function decetiseGround() { return 0; }

export function decetiseSegments() {
  const seg = (ax, az, bx, bz) => ({ a: [ax, az], b: [bx, bz], level: 'all' });
  const rect = (x0, z0, x1, z1) => [
    seg(x0, z0, x1, z0), seg(x1, z0, x1, z1), seg(x1, z1, x0, z1), seg(x0, z1, x0, z0),
  ];
  return [
    // Interior shell, closed on all four sides. The west wall used to open in
    // the middle onto the terrace; it is glass the whole way now, so the room
    // is a sealed box and the terrace is scenery. That also retires what used
    // to follow here — a keep-in fence along the plate's edge and a ring round
    // the pool, both of which existed to stop someone walking off the building
    // or into the water. Nobody can get out there to do either.
    seg(DX.x0, DX.z0 + 0.25, DX.x1 - 0.25, DX.z0 + 0.25),
    seg(DX.x1 - 0.25, DX.z0 + 0.25, DX.x1 - 0.25, DX.z1 - 0.25),
    seg(DX.x1 - 0.25, DX.z1 - 0.25, DX.x0, DX.z1 - 0.25),
    seg(DX.x0 + 0.1, DX.z0 + 0.25, DX.x0 + 0.1, DX.z1 - 0.25),
    // the lift core, open to the north where the cabin doors are
    seg(-DX.core - 0.2, DX.core + 0.2, DX.core + 0.2, DX.core + 0.2),
    seg(-DX.core - 0.2, -DX.core - 0.2, -DX.core - 0.2, DX.core + 0.2),
    seg(DX.core + 0.2, -DX.core - 0.2, DX.core + 0.2, DX.core + 0.2),
    // …plus the cabin's own back wall, a panel's thickness inside the core's
    // south line. That line stands off the OUTSIDE face of the core, far enough
    // out that nobody walking round it can push into the picture hung there
    // (DX-C1) — which from inside the cabin left the visitor half a body
    // through the brass. This one is only ever met from within: nothing outside
    // the core gets past the south line to reach it.
    seg(-DX.core, DX.core - 0.205, DX.core, DX.core - 0.205),
    // the basin and the partitions
    ...rect(-2.1, 4.5, 2.1, 8.7),
    ...PARTITIONS.flatMap((p) => rect(p.x - p.w / 2 - 0.1, p.z - 0.3, p.x + p.w / 2 + 0.1, p.z + 0.3)),
    // the hedges, quadrant by quadrant
    ...[-1, 1].flatMap((sx) => [-1, 1].flatMap((sz) => [
      ...rect(sx * 4.4 - 1.8, sz * 3.1 - 0.4, sx * 4.4 + 1.8, sz * 3.1 + 0.4),
      ...rect(sx * 3.0 - 0.4, sz * 4.5 - 1.8, sx * 3.0 + 0.4, sz * 4.5 + 1.8),
    ])),
  ];
}
