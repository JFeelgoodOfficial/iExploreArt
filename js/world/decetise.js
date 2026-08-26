import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Decetise Hall — residency five (room id `decetise`). Maria Decetise.
//
// One whole floor plate of a high rise. Glazed east (+X) over the city; the
// south and north walls are both art walls; and the west side has no wall at
// all — the room opens straight onto an infinity pool that fills the terrace
// edge to edge and spills off a weir at the lip of the slab, five storeys up.
// No glass stands between the room and the water. What keeps you out of it is
// the water: the collision plan stops you at the coping and has nothing at all
// beyond it.
//
// The lift core stands in the NORTH-EAST corner, where the east glass meets
// the north art wall — which is where a visitor arrives, looking south down
// the plate. The middle of the plate is a courtyard — gravel parterre round a
// stone fountain, balustraded stone kerb, clipped hedges and topiary, green
// park chairs, lamp posts — with five plane trees running up through oculi cut
// in the ceiling, and four more out on the terrace at the ends of the water.
// The core's one room-facing face carries a picture of its own — twelve in
// all. A French park met a top-floor suite.
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
  // The pool IS the terrace. It runs from the plate's own edge — the weir hangs
  // a hair past tx0, so the sheet falls off the building, five storeys up — to
  // the room's floor edge at x0, where the coping is the room's own threshold.
  // Nothing stands between the two: no glass, no walkway. You stop at the
  // coping because the next step is water, which is also why the terrace needs
  // no fence (decetiseSegments).
  pool: { x0: -24, x1: -17, z0: -8.4, z1: 8.4 },
  poolFloor: -1.15,                         // tiled bottom; you can see it
  waterY: -0.14,                            // surface, a hand under the coping
  weirY: -0.19,                             // west crest, under the surface
};

// The lift core stands in the room's north-east corner, where the east glass
// meets the north art wall. Its doorway opens south, into the room.
export const CORE_POS = { x: 15.0, z: -11.0 };

// You arrive in the cabin, facing out of it across the plate.
export const SPAWN = { x: CORE_POS.x, z: CORE_POS.z - 0.4, yaw: Math.PI };

// Afternoon, west and high enough to stay out of your eyes. It used to sit at
// 22° — genuinely late afternoon — which was fine while a glass wall stood in
// front of it. With the west side open, a 22° sun is a disc in the room: from
// anywhere in the western half you looked straight into it and the whole view
// blew to white. At 40° the soffit over the opening holds it out of frame from
// everywhere but the coping itself, and what reaches the room is the glare off
// the water rather than the sun itself.
export const SUN_POS = new THREE.Vector3(-96, 88, 34);

const TREES = [[-6, -6], [6, -6], [-6, 6], [6, 6], [0, -7.2]];
// Out on the terrace, one at each end of the water. There were four — a pair at
// each end — and all four grew into the building: the roof's soffit overhangs
// the terrace as far as x = -19.4, and a crown of this kind is five metres
// across, so the inner pair pushed three to five metres INTO the room and even
// the outer pair grazed the overhang by about a metre. The inner pair is gone.
// The two left stand as far west as the deck allows and carry a capped crown
// (`crownR` below), which is what actually keeps them out of the roof — no tree
// this size can stand on a seven-metre terrace and clear a 2.4 m overhang by
// position alone. Measured after the change: the crowns reach x = -19.70 and
// -19.88, and the soffit begins at -19.4 — 30 to 48 cm of daylight between the
// foliage and the building, and nothing of either tree inside the room.
const ALLEE = [[-22.8, -9.8], [-22.8, 9.8]];
const LAMPS = [[-7.4, -7.4], [7.4, -7.4], [-7.4, 7.4], [7.4, 7.4]];

// There are no freestanding partitions. The plate had two standing off the
// north half; they came out, and their two pictures with them. What is left is
// one clear floor from art wall to art wall, and out to the open west edge —
// the whole point of a floor plate with its core pushed to the corner.

// With the core tucked into the north-east corner, only its west face still
// looks into walkable room — the north and east faces press against the wall
// and the glass. That one face hangs; the pictures the other two carried have
// rehomed to the north art wall (DX-B row).
const CORE_FACES = [
  { id: 'DX-C1', x: 13.03, z: -11.0, rotY: -Math.PI / 2, w: 2.2, h: 1.9 },  // west face
];

// Slot geometry, the way layout.js keeps the gallery's: twelve places a
// picture can go — six on the south art wall, five on the north art wall, one
// on the room-facing side of the lift core. `w`/`h` is the largest picture
// that slot takes; a manifest entry's own aspect is fitted inside it.
export const SLOTS = [
  { id: 'DX-A1', x: -13.2, y: 1.95, z: DX.z1 - 0.12, rotY: Math.PI, w: 1.5, h: 2.05 },
  { id: 'DX-A2', x: -8.1, y: 1.95, z: DX.z1 - 0.12, rotY: Math.PI, w: 2.2, h: 1.5 },
  { id: 'DX-A3', x: -3.0, y: 1.95, z: DX.z1 - 0.12, rotY: Math.PI, w: 1.4, h: 1.9 },
  { id: 'DX-A4', x: 3.0, y: 1.95, z: DX.z1 - 0.12, rotY: Math.PI, w: 1.8, h: 1.8 },
  { id: 'DX-A5', x: 8.1, y: 1.95, z: DX.z1 - 0.12, rotY: Math.PI, w: 2.0, h: 1.4 },
  { id: 'DX-A6', x: 13.2, y: 1.95, z: DX.z1 - 0.12, rotY: Math.PI, w: 1.35, h: 1.9 },
  // north wall: the run stops short of x ≈ 12 — the lift core stands against
  // the wall's eastern end.
  { id: 'DX-B1', x: -13.2, y: 1.95, z: DX.z0 + 0.12, rotY: 0, w: 1.5, h: 2.05 },
  { id: 'DX-B2', x: -8.1, y: 1.95, z: DX.z0 + 0.12, rotY: 0, w: 2.2, h: 1.5 },
  { id: 'DX-B3', x: -3.0, y: 1.95, z: DX.z0 + 0.12, rotY: 0, w: 1.4, h: 1.9 },
  { id: 'DX-B4', x: 3.0, y: 1.95, z: DX.z0 + 0.12, rotY: 0, w: 1.8, h: 1.8 },
  { id: 'DX-B5', x: 8.1, y: 1.95, z: DX.z0 + 0.12, rotY: 0, w: 2.0, h: 1.4 },
  ...CORE_FACES.map((c) => ({ id: c.id, x: c.x, y: 1.8, z: c.z, rotY: c.rotY, w: c.w, h: c.h })),
];

// The house manifest for this hall, in slot order. Every entry is a placeholder
// until the real files land: give one an `image` and a `px` and it hangs instead.
// Same convention as data/brutalist-artworks.js.
export const DECETISE_HANG = [
  // south art wall (DX-A1…A6)
  { title: 'Parterre, Late Light', image: null },
  { title: 'Twelve Storeys of Weather', image: null },
  { title: 'Allée', image: null },
  { title: 'The Basin at Six', image: null },
  { title: 'Hedge, Clipped Twice', image: null },
  { title: 'Cornice and Cloud', image: null },
  // north art wall (DX-B1…B5)
  { title: 'Gravel, Rain Coming', image: null },
  { title: 'The Doors Open Inward', image: null },
  { title: 'North Light, No Weather', image: null },
  { title: 'The Kerb at Dusk', image: null },
  { title: 'Two Benches, Facing', image: null },
  // the lift core (DX-C1)
  { title: 'Plane Tree Through the Ceiling', image: null },
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
// Lighting. Afternoon: one warm sun in off the terrace, a cool bounce
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
  cabin.position.set(CORE_POS.x, 2.45, CORE_POS.z);

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
    // Water reads as water because you see the tile through it. At 0.86 the old
    // surface was effectively paint: a flat teal rectangle with nothing under
    // it. Low roughness keeps the sky and the sun on it, and `depthWrite` off
    // stops the sheet at the weir sorting against it.
    water: new THREE.MeshStandardMaterial({
      color: 0x1a5f6e, roughness: 0.05, metalness: 0.1,
      transparent: true, opacity: 0.62, depthWrite: false, side: THREE.DoubleSide,
      envMapIntensity: 1.2,
    }),
    sheet: new THREE.MeshBasicMaterial({ color: 0xbfe6e4, transparent: true, opacity: 0.34, side: THREE.DoubleSide, depthWrite: false }),
    glow: new THREE.MeshStandardMaterial({ color: 0xfff0cf, emissive: 0xffd9a0, emissiveIntensity: 2.2, roughness: 0.5 }),
  };

  // --- procedural surfaces (canvas, the way js/utils/proctex.js does) ------
  // Pool tile: 100 mm squares in three blue-greens with pale grout between, then
  // a wash of larger mottling so the tank bottom doesn't read as graph paper
  // once there is half a metre of water over it. The grout is what sells it —
  // a plain blue box under water still looks like a plain blue box.
  function poolTileTexture() {
    const S = 512;
    const cv = document.createElement('canvas'); cv.width = cv.height = S;
    const g = cv.getContext('2d');
    const grout = '#9dbcbc';
    g.fillStyle = grout; g.fillRect(0, 0, S, S);
    const tiles = [[46, 112, 124], [58, 132, 140], [34, 92, 108], [70, 148, 150]];
    const N = 16, cell = S / N, gap = 2.2;
    for (let ix = 0; ix < N; ix++) {
      for (let iz = 0; iz < N; iz++) {
        const c = tiles[Math.floor(rand() * tiles.length)];
        const j = 0.88 + rand() * 0.24;
        g.fillStyle = `rgb(${Math.min(255, c[0] * j) | 0},${Math.min(255, c[1] * j) | 0},${Math.min(255, c[2] * j) | 0})`;
        g.fillRect(ix * cell + gap / 2, iz * cell + gap / 2, cell - gap, cell - gap);
      }
    }
    // a soft mottle over the top, the way a wet tiled floor pools its own light
    for (let i = 0; i < 90; i++) {
      const r = 12 + rand() * 70;
      const a = 0.03 + rand() * 0.07;
      g.fillStyle = rand() > 0.5 ? `rgba(255,255,255,${a})` : `rgba(20,60,70,${a})`;
      g.beginPath(); g.arc(rand() * S, rand() * S, r, 0, 6.28); g.fill();
    }
    const t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(7, 17);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = anisotropy;
    return t;
  }

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
  // The floor is laid in slabs AROUND the pool, not straight across it. One
  // plane spanning the whole plate would run under the water at exactly the
  // height of the basin's rim, and the two would fight over the depth buffer —
  // which is what the bands of stripes across the old pool were.
  function floorSlab(x0, z0, x1, z1) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), floorMat);
    m.rotation.x = -Math.PI / 2;
    m.position.set((x0 + x1) / 2, 0, (z0 + z1) / 2);
    m.receiveShadow = true;
    add(m);
  }
  floorSlab(DX.x0, DX.z0, DX.x1, DX.z1);                      // the room itself
  floorSlab(DX.tx0, DX.z0, DX.x0, DX.pool.z0);                // deck, north of the water
  floorSlab(DX.tx0, DX.pool.z1, DX.x0, DX.z1);                // deck, south of it
  // …and nothing west of the water: the pool runs to the plate's own edge.
  // The plate's own thickness, laid round the tank rather than straight across
  // it — a solid slab here filled the pool in, and its top face was the flat
  // teal rectangle the old water never showed through.
  function baseSlab(x0, z0, x1, z1) {
    box((x0 + x1) / 2, -0.56, (z0 + z1) / 2, x1 - x0, 1.1, z1 - z0, M.limestone, false);
  }
  baseSlab(DX.x0, DX.z0 - 0.6, DX.x1 + 0.6, DX.z1 + 0.6);            // under the room
  baseSlab(DX.tx0 - 0.6, DX.z0 - 0.6, DX.x0, DX.pool.z0);            // under the north deck
  baseSlab(DX.tx0 - 0.6, DX.pool.z1, DX.x0, DX.z1 + 0.6);            // under the south deck

  // Ceiling: four solid slabs round the courtyard, then an instanced grid of
  // panels over the courtyard itself with the oculi left out. One
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

  // the two art walls — south, and its twin across the plate on the north,
  // where a wall of glass used to stand
  box((DX.x0 + DX.x1) / 2, DX.ceil / 2, DX.z1 + 0.15, DX.x1 - DX.x0 + 0.6, DX.ceil, 0.3);
  box((DX.x0 + DX.x1) / 2, DX.ceil / 2, DX.z0 - 0.15, DX.x1 - DX.x0 + 0.6, DX.ceil, 0.3);

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
  glazing('z', DX.x1 + 0.05, DX.z0, DX.z1, 2.6);         // east wall of glass
  // West: one unbroken run, not two flanking a doorway. The terrace used to
  // slide open in the middle; it doesn't any more. The pool now reaches the
  // glass and there is nowhere out there to stand, so the wall is a window onto
  // the water and the city under it — sealed, and closed in decetiseSegments()
  // to match. Restore the two split runs plus the posts and lintel if the
  // terrace is ever meant to be walked on again.
  //
  // WEST: nothing. No pane, no mullions, no sill. The room opens straight onto
  // the water — the plate's whole west side is one opening under the soffit,
  // and the pool's coping is the threshold you stand at. A glass wall here put
  // a reflection between the room and the only thing worth looking at. What
  // stops you walking out is the water, not a pane (decetiseSegments).
  box(DX.x0 + 0.08, DX.ceil - 0.34, 0, 0.36, 0.68, DX.z1 - DX.z0);   // head beam over the opening
  box(DX.x0 - 1.2, DX.ceil - 0.14, 0, 2.4, 0.28, DX.z1 - DX.z0);     // soffit out over the water

  // --- the terrace: an infinity pool, edge to edge -------------------------
  // A real basin, not a coloured rectangle. What used to be here was a box
  // whose top face sat at y = 0, exactly coplanar with the floor plane running
  // the whole width of the plate — so the "pool" you saw was that lid, and the
  // bands of stripes across it were the two surfaces fighting over the depth
  // buffer. The water plane underneath was never visible at all.
  //
  // Now the floor and the plate's base are cut around the tank (above), and the
  // tank is built the way one is: a tiled bottom a metre down, four inner faces
  // standing on the pool's own boundary, and the water a separate transparent
  // surface floating a hand below the coping. Seeing INTO it is the whole
  // difference between water and paint.
  const P = DX.pool;
  const PB = DX.poolFloor;

  const tileMat = new THREE.MeshStandardMaterial({
    map: poolTileTexture(), roughness: 0.3, metalness: 0.02, side: THREE.DoubleSide,
  });

  // The tank, as planes on the boundary. Planes, not boxes: a box has a top
  // face at the waterline for the floor to fight with, and that is the bug
  // above. Nothing here has a horizontal face except the bottom.
  const basinFloor = new THREE.Mesh(new THREE.PlaneGeometry(P.x1 - P.x0, P.z1 - P.z0), tileMat);
  basinFloor.rotation.x = -Math.PI / 2;
  basinFloor.position.set((P.x0 + P.x1) / 2, PB, (P.z0 + P.z1) / 2);
  basinFloor.receiveShadow = true;
  add(basinFloor);
  const wallPlane = (w, h, x, y, z, rotY) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), tileMat);
    m.position.set(x, y, z);
    m.rotation.y = rotY;
    m.receiveShadow = true;
    add(m);
  };
  const deep = -PB;                                    // full wall, floor to rim
  wallPlane(P.x1 - P.x0, deep, (P.x0 + P.x1) / 2, PB + deep / 2, P.z0, 0);            // north
  wallPlane(P.x1 - P.x0, deep, (P.x0 + P.x1) / 2, PB + deep / 2, P.z1, Math.PI);      // south
  wallPlane(P.z1 - P.z0, deep, P.x1, PB + deep / 2, 0, -Math.PI / 2);                 // east
  // The west face stops short: its top edge IS the weir, set under the surface
  // so the water runs over it and off the building.
  const weirH = DX.weirY - PB;
  wallPlane(P.z1 - P.z0, weirH, P.x0, PB + weirH / 2, 0, Math.PI / 2);                // west

  // The water: one transparent sheet over the tile, with a waterline you can
  // read against the coping. `waterBase` is the flat rest state the swell in
  // update() is written back against.
  const water = new THREE.Mesh(new THREE.PlaneGeometry(P.x1 - P.x0, P.z1 - P.z0, 28, 28), M.water);
  water.rotation.x = -Math.PI / 2;
  water.position.set((P.x0 + P.x1) / 2, DX.waterY, (P.z0 + P.z1) / 2);
  water.renderOrder = 1;
  add(water);
  const waterBase = water.geometry.attributes.position.array.slice();

  // Coping on the three closed sides, overhanging the water by 30 mm the way
  // real coping does — which also keeps its face off the tank's, so there is
  // nothing coplanar left to flicker. The east run is the room's own threshold:
  // the last stone under your feet, and then water. No glass in between.
  const OVER = 0.03, CW = 0.42, CH = 0.16;
  const cope = (x, z, w, d) => box(x, CH / 2 - 0.06, z, w, CH, d, M.stonePale);
  cope((P.x0 + P.x1) / 2, P.z0 - CW / 2 + OVER, P.x1 - P.x0 + CW * 2, CW);
  cope((P.x0 + P.x1) / 2, P.z1 + CW / 2 - OVER, P.x1 - P.x0 + CW * 2, CW);
  cope(P.x1 + CW / 2 - OVER, 0, CW, P.z1 - P.z0 + CW * 2);

  // The sheet going over the weir, and the fall down the face of the building.
  const sheet = new THREE.Mesh(new THREE.PlaneGeometry(P.z1 - P.z0, 2.4), M.sheet);
  sheet.rotation.y = Math.PI / 2;
  sheet.position.set(P.x0 - 0.02, DX.weirY - 1.2, 0);
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

  // The four terrace trees (ALLEE) are planted further down, by the same builder
  // as the five that come up through the oculi — they need the bark, leaf and
  // limb machinery, which is declared with the crowns.

  // No loungers. They stood on the deck the pool has since taken, which left
  // them standing in the water; and furniture on a terrace nobody can reach is
  // set for guests who will never arrive. The water runs out clean to the weir.

  // --- the lift core, in the plate's north-east corner --------------------
  // Built in the core's own local frame — the doorway on local -z, the back
  // wall on local +z — then the whole group is turned π and parked in the
  // corner, so the back wall sits against the north art wall and the doorway
  // opens south into the room.
  const C = DX.core;
  const liftCore = new THREE.Group();
  add(liftCore);
  liftCore.position.set(CORE_POS.x, 0, CORE_POS.z);
  liftCore.rotation.y = Math.PI;
  function cbox(x, y, z, w, h, d, mat = M.plaster, shadows = true) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    if (shadows) { m.castShadow = true; m.receiveShadow = true; }
    liftCore.add(m);
    return m;
  }
  cbox(0, DX.ceil / 2 + 0.9, C, C * 2 + 0.3, DX.ceil + 1.8, 0.3, M.limestone);
  cbox(-C, DX.ceil / 2 + 0.9, 0, 0.3, DX.ceil + 1.8, C * 2, M.limestone);
  cbox(C, DX.ceil / 2 + 0.9, 0, 0.3, DX.ceil + 1.8, C * 2, M.limestone);
  cbox(0, 0.03, 0, C * 2, 0.06, C * 2, M.marble, false);            // cabin floor
  cbox(0, 1.3, C - 0.18, C * 2 - 0.1, 2.6, 0.05, M.brass, false);   // cabin back
  cbox(0, 2.62, 0, C * 2, 0.08, C * 2, M.brass, false);             // cabin ceiling
  for (const dx of [-C + 0.12, C - 0.12]) cbox(dx, 1.35, -C, 0.24, 2.7, 0.3, M.brass, false);
  const plate = cbox(C - 0.4, 1.25, C - 0.24, 0.34, 0.9, 0.04, M.steel, false);
  plate.name = 'decetise-lift-plate';
  for (let i = 0; i < 3; i++) {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.02, 14), M.brass);
    b.rotation.x = Math.PI / 2;
    b.position.set(C - 0.4, 1.5 - i * 0.22, C - 0.27);
    liftCore.add(b);
  }

  // --- the courtyard: a parterre round the basin --------------------------
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

  // the stone basin, at the centre of the parterre — where the lift core
  // stood before it moved to the corner
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
  fountain.position.set(0, 0, 0);
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
  parkChair(-2.5, -0.5, 0.6);
  parkChair(2.6, 0.3, -1.0);
  parkChair(-1.4, 2.0, 2.5);

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

  // One builder, two plantings: the five that come up through the oculi and the
  // four out on the terrace. The terrace pair used to be a bare stem with a
  // green box on top — a pleached hedge-on-a-stick, which reads at fifty metres
  // and not at five. They are the same tree as the ones inside now, grown a
  // size smaller and with no ceiling to keep clear of.
  const trees = [];
  function plantTree(tx, tz, o = {}) {
    const {
      trunkH = 3.3, rTop = 0.24, rBot = 0.4, limbLen = 1.9, limbRad = 0.2,
      scale = 1, grate = true, clearY = null, crownR = null,
    } = o;
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, trunkH, 16, 3), barkMat);
    trunk.position.y = trunkH / 2;
    trunk.castShadow = true; trunk.receiveShadow = true;
    const flare = new THREE.Mesh(new THREE.CylinderGeometry(rBot, rBot * 1.65, 0.5, 16), barkMat);
    flare.position.y = 0.24; flare.castShadow = true;
    g.add(trunk, flare);
    if (grate) {
      const gr = new THREE.Mesh(new THREE.CylinderGeometry(rBot * 2.4, rBot * 2.6, 0.2, 24), M.stonePale);
      gr.position.y = 0.1; gr.receiveShadow = true;
      g.add(gr);
    }

    // the crown: one merged limb mesh + one instanced leaf field, both pivoted
    // at the top of the trunk so the wind can move them together
    const crown = new THREE.Group();
    crown.position.y = trunkH;
    const geos = [];
    const anchors = [];
    // One more leader and one more level of forking than the crown used to
    // carry. It was built thin because nothing was showing anyway; with the
    // foliage back, a three-limb crown reads as a diagram of a tree.
    const leaders = lean ? 3 : 4;
    for (let i = 0; i < leaders; i++) {
      const a = (i / leaders) * Math.PI * 2 + rand();
      const d = new THREE.Vector3(Math.cos(a) * 0.42, 1, Math.sin(a) * 0.42).normalize();
      limb(geos, anchors, new THREE.Vector3(0, 0, 0), d, limbLen + rand() * 0.5, limbRad, lean ? 3 : 4);
    }
    const limbs = new THREE.Mesh(mergeGeometries(geos), barkMat);
    limbs.castShadow = true;
    crown.add(limbs);

    // The low tier gets fewer anchors (a shallower fork), so it carries bigger
    // cards on each — a canopy of the same mass, drawn coarser, rather than a
    // visibly balder tree on a phone.
    const perAnchor = lean ? 3 : 4;
    const SCALE = (lean ? 1.5 : 1.15) * scale;
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
        // Keep the whole card clear of the ceiling, where there is one. Anchors
        // sit well above it already, but the cards are big and jittered, and one
        // dipping through the slab shows up as a sprig of foliage lying on the
        // plaster. Out on the terrace there is open sky and no guard is wanted.
        let y = a.y + (rand() - 0.5) * 0.7 - out * 0.25;
        if (clearY !== null) y = Math.max((clearY - trunkH) + sc * 0.6, y);
        pv.set(a.x + (rand() - 0.5) * 1.0, y, a.z + (rand() - 0.5) * 1.0);
        // A hard horizontal limit on the crown, for a tree standing under
        // something. Cards past it are pulled back in rather than dropped, so
        // the canopy stays full and simply stops where the building begins.
        if (crownR) {
          const r = Math.hypot(pv.x, pv.z);
          if (r > crownR) { pv.x *= crownR / r; pv.z *= crownR / r; }
        }
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

  // The five up through the ceiling, and the two left on the terrace. The
  // terrace pair is smaller and its crown is capped: it stands under the roof's
  // overhang, so past `crownR` it would be growing into the soffit.
  for (const [tx, tz] of TREES) plantTree(tx, tz, { clearY: DX.ceil });
  for (const [tx, tz] of ALLEE) {
    plantTree(tx, tz, {
      trunkH: 2.2, rTop: 0.15, rBot: 0.25, limbLen: 0.8, limbRad: 0.12,
      scale: 0.5, crownR: 1.5,
    });
  }

  // two stone benches facing the pictures on the north art wall
  for (const bx of [-8, 8]) box(bx, 0.21, DX.z0 + 1.5, 3.2, 0.42, 0.62, M.stonePale);

  // --- the hang ----------------------------------------------------------
  const interactables = [];
  SLOTS.forEach((slot, i) => {
    const entry = art[i] || { title: `Slot ${slot.id}`, image: null };
    const tex = placeholderArt(1000 + i * 977 + entry.title.length, slot.w, slot.h);
    // A dark backing panel behind each picture, so a canvas on a pale wall has
    // an edge. The one on the lift core doesn't get one: the core is a stone
    // pier, and a panel standing proud of it read as a slab bolted to the
    // shaft rather than as a picture hung on it.
    if (!slot.id.startsWith('DX-C')) {
      box(slot.x, slot.y, slot.z, slot.w, slot.h, 0.05,
        new THREE.MeshStandardMaterial({ color: 0x2a2521, roughness: 0.8 }));
    }
    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(slot.w, slot.h),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.72 })
    );
    // Off the panel where there is one, off the wall itself where there isn't.
    const stand = slot.id.startsWith('DX-C') ? 0.012 : 0.031;
    face.position.set(slot.x + Math.sin(slot.rotY) * stand, slot.y, slot.z + Math.cos(slot.rotY) * stand);
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
// shell, the corner core, the hedges and the basin. Nothing for the terrace
// or the pool — the keep-in line along the open west edge is the only thing
// between a visitor and the water.
// Same format as js/world/Collision.js expects.
export function decetiseGround() { return 0; }

export function decetiseSegments() {
  const seg = (ax, az, bx, bz) => ({ a: [ax, az], b: [bx, bz], level: 'all' });
  const rect = (x0, z0, x1, z1) => [
    seg(x0, z0, x1, z0), seg(x1, z0, x1, z1), seg(x1, z1, x0, z1), seg(x0, z1, x0, z0),
  ];
  return [
    // Interior shell. Three sides are wall or glass; the west is an open
    // edge with the pool immediately beyond it, so the line below is the only
    // thing between a visitor and the water. It sits a player-radius back from
    // the coping, which is where you would stop anyway — the next step is a
    // metre of water and then the side of the building.
    //
    // Nothing out on the terrace needs colliders any more. The keep-in fence
    // along the plate's edge and the ring round the pool both existed for
    // someone standing out there, and nobody can get out there.
    seg(DX.x0, DX.z0 + 0.25, DX.x1 - 0.25, DX.z0 + 0.25),
    seg(DX.x1 - 0.25, DX.z0 + 0.25, DX.x1 - 0.25, DX.z1 - 0.25),
    seg(DX.x1 - 0.25, DX.z1 - 0.25, DX.x0, DX.z1 - 0.25),
    seg(DX.x0 + 0.1, DX.z0 + 0.25, DX.x0 + 0.1, DX.z1 - 0.25),
    // The lift core, in the north-east corner. Its north and east faces stand
    // behind the shell's own lines, so the only face a visitor can reach is
    // the west one — held 0.2 off the stone so nobody pushes into the picture
    // hung there (DX-C1). The doorway side, south, stays open.
    seg(13.0, -13.0, 13.0, -9.0),
    // …plus the cabin's own back wall, a panel's thickness inside the core's
    // north line. Only ever met from within the cabin — it stops the visitor
    // a hand short of the brass, which keeps the lift door hitbox in front of
    // the eye rather than behind it.
    seg(13.2, -12.595, 16.8, -12.595),
    // the stone basin at the centre of the parterre
    ...rect(-2.1, -2.1, 2.1, 2.1),
    // the hedges, quadrant by quadrant
    ...[-1, 1].flatMap((sx) => [-1, 1].flatMap((sz) => [
      ...rect(sx * 4.4 - 1.8, sz * 3.1 - 0.4, sx * 4.4 + 1.8, sz * 3.1 + 0.4),
      ...rect(sx * 3.0 - 0.4, sz * 4.5 - 1.8, sx * 3.0 + 0.4, sz * 4.5 + 1.8),
    ])),
  ];
}
