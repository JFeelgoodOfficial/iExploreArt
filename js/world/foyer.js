import * as THREE from 'three';
import { FEATURED, featuredResidency, featuredArtwork } from '../../data/featured.js';
import { buildReceptionDesk, signTexture } from './Details.js';
import { loadArtTexture } from '../art/load.js';

// The reception foyer — where every visit begins. A small lobby high in a
// tower, not a gallery: the reception desk with Mira behind it, the house sign
// above, a single door in the north wall that opens onto the currently
// featured show (data/featured.js), and one work from that show beside the
// door. Its other two sides give onto a pool terrace over the city
// (buildPoolCorner, below), behind glass the visitor cannot pass.
//
// The foyer shares the one world scene the way every room does — as a layer
// the RoomManager toggles — and sits on its own coordinate patch, east of the
// gallery's footprint, so the hidden reception hall's positional audio (the
// wall fountain) stays out of earshot.
//
// The doorway is a dressed reveal, solid to collision: the walk-through is an
// invisible hitbox in front of it (userData.door), the same trick every
// residency exit uses, so the visitor presses E at the door and rides the veil.

const X0 = 40;                                   // west edge of the patch
export const FY = { x0: X0, x1: X0 + 7, z0: 0, z1: 6, h: 3.4 };
export const FY_DESK = { x0: X0 + 1.0, x1: X0 + 1.8, z0: 1.6, z1: 4.0, h: 1.08 };
export const FY_CURATOR = { x: X0 + 0.62, z: 2.8, facing: Math.PI / 2 };
const DOOR = { x0: X0 + 3.0, x1: X0 + 4.6, h: 2.4 };   // in the north wall
const DOOR_CX = (DOOR.x0 + DOOR.x1) / 2;

// Facing west: the desk, the sign, and Mira are the first thing a visitor
// sees — she has the instructions.
export const SPAWN = { x: X0 + 4.9, z: 2.8, yaw: Math.PI / 2 };

export const foyerGround = () => 0;

const seg = (ax, az, bx, bz, level = 'all') => ({ a: [ax, az], b: [bx, bz], level });
function rect(x0, z0, x1, z1, level = 'all') {
  return [seg(x0, z0, x1, z0, level), seg(x1, z0, x1, z1, level),
          seg(x1, z1, x0, z1, level), seg(x0, z1, x0, z0, level)];
}

export function buildFoyerColliders() {
  // The perimeter stays solid across the doorway — the door hitbox teleports
  // the visitor before the wall could matter.
  return [...rect(FY.x0, FY.z0, FY.x1, FY.z1),
          ...rect(FY_DESK.x0, FY_DESK.z0, FY_DESK.x1, FY_DESK.z1, 0)];
}

// opts: { anisotropy, artMaxEdge, onDoor } — onDoor is called when the visitor
// takes the featured door; main.js points it at travelTo(featured hall).
export function buildFoyerRoom(scene, mats, opts = {}) {
  const { anisotropy = 8, artMaxEdge = 0, onDoor } = opts;
  const g = new THREE.Group();
  g.name = 'foyer';

  const f = featuredResidency();

  const box = (w, h, d, mat, x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
    return m;
  };

  const W = FY.x1 - FY.x0;                        // 7
  const D = FY.z1 - FY.z0;                        // 6
  const CX = FY.x0 + W / 2, CZ = FY.z0 + D / 2;

  // --- shell ----------------------------------------------------------------
  // Two solid walls (west carries the desk and sign, north the door and the
  // featured work). The other two — east and south — are open above a glass
  // parapet: the room sits at the corner of an infinity pool, sunset over the
  // water to the east, night over it to the south, a city all round. The
  // perimeter colliders stay on the wall lines, so the water is only looked at.
  const floor = box(W + 0.6, 0.1, D + 1.2, mats.wood, CX, -0.05, CZ - 0.3);
  floor.castShadow = false;
  const ceil = box(W + 0.6, 0.2, D + 0.6, mats.plasterWarm, CX, FY.h + 0.1, CZ);
  ceil.castShadow = false;
  box(0.3, FY.h, D + 0.6, mats.plaster, FY.x0 - 0.15, FY.h / 2, CZ);          // west
  // north wall, opened around the doorway
  const wN = DOOR.x0 - (FY.x0 - 0.3);
  box(wN, FY.h, 0.3, mats.plaster, FY.x0 - 0.3 + wN / 2, FY.h / 2, FY.z0 - 0.15);
  const eN = (FY.x1 + 0.3) - DOOR.x1;
  box(eN, FY.h, 0.3, mats.plaster, DOOR.x1 + eN / 2, FY.h / 2, FY.z0 - 0.15);
  box(DOOR.x1 - DOOR.x0, FY.h - DOOR.h, 0.3, mats.plaster,
      DOOR_CX, DOOR.h + (FY.h - DOOR.h) / 2, FY.z0 - 0.15);                   // lintel

  // --- the open corner: parapet, posts, water, sky, city --------------------
  const update = buildPoolCorner(g, mats);

  // --- the doorway reveal ---------------------------------------------------
  // Walnut jambs and head, a shallow dark throat, and a closed pair of doors
  // at the back of it — the hall beyond is reached on the veil, so the reveal
  // only has to promise a somewhere.
  const RD = 0.5;                                 // reveal depth
  box(0.09, DOOR.h, RD, mats.woodDark, DOOR.x0 + 0.045, DOOR.h / 2, FY.z0 - RD / 2);
  box(0.09, DOOR.h, RD, mats.woodDark, DOOR.x1 - 0.045, DOOR.h / 2, FY.z0 - RD / 2);
  box(DOOR.x1 - DOOR.x0, 0.09, RD, mats.woodDark, DOOR_CX, DOOR.h - 0.045, FY.z0 - RD / 2);
  const revealFloor = box(DOOR.x1 - DOOR.x0, 0.02, RD, mats.woodDark, DOOR_CX, 0.01, FY.z0 - RD / 2);
  revealFloor.castShadow = false;
  // the door leaves, dark with brass pulls
  const leafW = (DOOR.x1 - DOOR.x0 - 0.18) / 2;
  for (const s of [-1, 1]) {
    box(leafW, DOOR.h - 0.13, 0.06, mats.woodDark,
        DOOR_CX + s * (leafW / 2 + 0.01), (DOOR.h - 0.13) / 2, FY.z0 - RD + 0.08);
    const pull = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.3, 8), mats.brass);
    pull.position.set(DOOR_CX + s * 0.12, 1.05, FY.z0 - RD + 0.13);
    g.add(pull);
  }

  // --- reception desk (the one that used to stand in the hall) --------------
  buildReceptionDesk(g, mats, FY_DESK);

  // --- signage --------------------------------------------------------------
  // Above the desk: the house name over the current show — the first thing the
  // visitor reads, facing them as they arrive.
  const deskSign = new THREE.Mesh(
    new THREE.PlaneGeometry(2.2, 0.62),
    new THREE.MeshBasicMaterial({ map: signTexture('iExploreArt', `Now Showing · ${f.artist}`), transparent: true })
  );
  deskSign.position.set(FY.x0 + 0.02, 2.35, 2.8);
  deskSign.rotation.y = Math.PI / 2;
  g.add(deskSign);

  // Over the door: where that door goes.
  const lintelSign = new THREE.Mesh(
    new THREE.PlaneGeometry(1.7, 0.48),
    new THREE.MeshBasicMaterial({ map: signTexture(FEATURED.series, `${f.artist} — ${f.name}`), transparent: true })
  );
  lintelSign.position.set(DOOR_CX, DOOR.h + 0.48, FY.z0 + 0.02);
  g.add(lintelSign);

  // --- the featured work, beside the door -----------------------------------
  // Hung the way its own hall hangs it (js/world/chadrea/chadrea.js): an
  // unframed box canvas at true size, interactable, photograph loaded in.
  const interactables = [];
  const piece = featuredArtwork();
  if (piece) {
    const [w, h] = piece.size || [1.2, 1.2];
    const edge = () => new THREE.MeshStandardMaterial({ color: 0x8a8177, roughness: 0.92 });
    const face = new THREE.MeshStandardMaterial({ color: 0x2e2823, roughness: 0.66, metalness: 0 });
    const canvas = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.045), [
      edge(), edge(), edge(), edge(), face, edge(),
    ]);
    canvas.position.set(FY.x0 + 5.85, 1.55, FY.z0 + 0.047);
    canvas.castShadow = true;
    canvas.receiveShadow = true;
    canvas.name = 'art-foyer-featured';
    canvas.userData.artwork = piece;
    g.add(canvas);
    interactables.push(canvas);
    if (piece.image) {
      loadArtTexture(piece.image, { anisotropy, px: piece.px, maxEdge: artMaxEdge }, (tx) => {
        face.map = tx;
        face.color.setHex(0xffffff);
        face.needsUpdate = true;
      });
    }
  }

  // --- the way in -----------------------------------------------------------
  // Invisible but raycastable, standing just proud of the reveal so the prompt
  // reads while the visitor walks up. Pressing E rides the veil to the hall.
  const door = new THREE.Mesh(
    new THREE.PlaneGeometry(1.8, DOOR.h),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
  );
  door.position.set(DOOR_CX, DOOR.h / 2, FY.z0 + 0.4);
  door.name = 'foyer-door-to-featured';
  door.userData.door = {
    label: `into ${f.name}`,
    onEnter: () => onDoor?.(),
  };
  g.add(door);

  // --- light ----------------------------------------------------------------
  const hemi = new THREE.HemisphereLight(0xf2e9db, 0x3d332a, 0.5);
  g.add(hemi);
  const spot = (x, y, z, tx, ty, tz, intensity, dist, angle, pen) => {
    const s = new THREE.SpotLight(0xffe7c8, intensity, dist, angle, pen, 1.8);
    s.position.set(x, y, z);
    s.target.position.set(tx, ty, tz);
    g.add(s, s.target);
    return s;
  };
  // the desk and Mira, warm and centred; this one carries the room's shadows
  const deskSpot = spot(FY.x0 + 2.7, FY.h - 0.1, 2.8, FY.x0 + 1.2, 1.0, 2.8, 14, 9, 0.62, 0.7);
  deskSpot.castShadow = true;
  deskSpot.shadow.mapSize.set(1024, 1024);
  deskSpot.shadow.bias = -0.0004;
  // the sign above the desk
  spot(FY.x0 + 2.2, FY.h - 0.1, 2.8, FY.x0, 2.35, 2.8, 7, 6, 0.5, 0.8);
  // the featured work
  spot(FY.x0 + 5.85, FY.h - 0.1, 1.7, FY.x0 + 5.85, 1.55, FY.z0, 9, 6, 0.5, 0.7);
  // the doorway and its lintel sign
  spot(DOOR_CX, FY.h - 0.1, 1.7, DOOR_CX, 1.6, FY.z0, 7, 6, 0.55, 0.8);

  scene.add(g);

  return {
    group: g,
    interactables,
    door,
    colliders: buildFoyerColliders(),
    spawn: SPAWN,
    update,               // the night side's stars twinkle
  };
}

// ---------------------------------------------------------------------------
// The terrace. The foyer stands high in a tower, and its east and south sides
// give onto an open pool deck behind a waist-high glass screen: patio, then an
// infinity pool whose far lip is the building's own edge, then the drop and
// the city far below. The sky over it disagrees with itself on purpose — a
// vibrant sunset low over the east water, a star-strewn night to the south,
// blending through twilight at the corner.
//
// The sky is a whole sphere rather than a wall of it: from inside the foyer
// you can look anywhere, including straight up, and never find where it stops.
//
// Everything out there is scenery, not world: the foyer's own perimeter
// colliders hold the visitor at the glass, and the backdrop, towers and water
// are all unlit and unfogged (the global haze would grey the night out). The
// only moving part is the twinkle — one time uniform driving star point sizes.

// The deck slab, and the pool set into it as an L round the building's
// corner. The pool's outer edges ARE the deck's outer edges: that is the
// infinity edge, and past it there is only air.
const DECK = { x0: FY.x0 - 0.4, x1: FY.x1 + 7.2, z0: FY.z0 - 1.4, z1: FY.z1 + 6.6, t: 2.4 };
const POOL_E = { x0: FY.x1 + 2.6, x1: DECK.x1, z0: DECK.z0, z1: DECK.z1 };
const POOL_S = { x0: FY.x0 + 1.2, x1: FY.x1 + 2.6, z0: FY.z1 + 2.4, z1: DECK.z1 };
const WATER_Y = -0.12;              // the pool sits a hand below the paving

// Azimuth convention out here: A = 0 looks south (+Z), A = π/2 looks east
// (+X) — the two directions the foyer is open to. Everything below (the sky
// texture, the towers, the stars) is placed by it.
const A_SOUTH = 0, A_EAST = Math.PI / 2;
const dirOf = (A) => [Math.sin(A), Math.cos(A)];

function buildPoolCorner(g, mats) {
  const CXX = (FY.x0 + FY.x1) / 2, CZZ = (FY.z0 + FY.z1) / 2;
  const W = FY.x1 - FY.x0, D = FY.z1 - FY.z0;

  const add = (mesh) => { g.add(mesh); return mesh; };
  const slab = (x0, z0, x1, z1, mat, top = 0, thick = DECK.t) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, thick, z1 - z0), mat);
    m.position.set((x0 + x1) / 2, top - thick / 2, (z0 + z1) / 2);
    m.receiveShadow = true;
    return add(m);
  };

  // --- the glass screen: waist high, no posts ------------------------------
  // A quieter clone of the shared rail glass — at full envMapIntensity the
  // sheets catch the bright interior HDR and flare into white panels against
  // the night side. The cap rail is the only solid line in it.
  const glass = mats.railGlass.clone();
  glass.envMapIntensity = 0;      // the interior HDR turned it into a grey fog bank
  glass.opacity = 0.05;
  glass.roughness = 0.02;
  const pane = (w, h, d, mat, x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    return add(m);
  };
  pane(0.04, 1.02, D + 0.6, glass, FY.x1 + 0.02, 0.51, CZZ);
  pane(0.09, 0.04, D + 0.62, mats.woodDark, FY.x1 + 0.02, 1.04, CZZ);
  pane(W + 0.62, 1.02, 0.04, glass, CXX, 0.51, FY.z1 + 0.02);
  pane(W + 0.62, 0.04, 0.09, mats.woodDark, CXX, 1.04, FY.z1 + 0.02);

  // --- the paving, and the basin the pool sits in --------------------------
  const paving = new THREE.MeshStandardMaterial({
    color: 0x494440, roughness: 0.9, metalness: 0, envMapIntensity: 0.12,
  });
  const basinMat = new THREE.MeshStandardMaterial({
    color: 0x1d2a35, roughness: 0.75, metalness: 0, envMapIntensity: 0.15,
  });
  slab(FY.x1 + 0.3, DECK.z0, POOL_E.x0, POOL_S.z0, paving);        // east patio
  slab(DECK.x0, FY.z1 + 0.3, POOL_E.x0, POOL_S.z0, paving);        // south patio
  slab(DECK.x0, POOL_S.z0, POOL_S.x0, DECK.z1, paving);            // west margin
  slab(POOL_E.x0, POOL_E.z0, POOL_E.x1, POOL_E.z1, basinMat, WATER_Y - 0.03);
  slab(POOL_S.x0, POOL_S.z0, POOL_S.x1, POOL_S.z1, basinMat, WATER_Y - 0.03);

  // --- the water -----------------------------------------------------------
  // Unlit on purpose: a lit material catches the foyer's hemisphere light and
  // reads as a fog bank, and the shared environment map is a bright interior
  // HDR. Flat dark dusk-water, with the reflections painted on as lanes.
  const water = new THREE.MeshBasicMaterial({ color: 0x14293c, fog: false });
  for (const p of [POOL_E, POOL_S]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(p.x1 - p.x0, p.z1 - p.z0), water);
    m.rotation.x = -Math.PI / 2;
    m.position.set((p.x0 + p.x1) / 2, WATER_Y, (p.z0 + p.z1) / 2);
    add(m);
  }

  // The reflections. `yaw` turns the lane in the water plane; the glint runs
  // bright toward the light it answers, so yaw points it at the sun or moon.
  const lane = (len, wide, x, z, color, opacity, yaw) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(len, wide),
      new THREE.MeshBasicMaterial({
        map: glintTexture(), transparent: true, blending: THREE.AdditiveBlending,
        depthWrite: false, fog: false, color, opacity,
      })
    );
    m.rotation.set(-Math.PI / 2, yaw, 0, 'YXZ');
    m.position.set(x, WATER_Y + 0.004, z);
    return add(m);
  };
  const poolEcx = (POOL_E.x0 + POOL_E.x1) / 2;
  lane(POOL_E.x1 - POOL_E.x0, 9.0, poolEcx, CZZ + 1.0, 0x8f3550, 0.4, 0);      // sunset wash
  lane(POOL_E.x1 - POOL_E.x0, 1.5, poolEcx, CZZ, 0xffb877, 0.62, 0);           // the sun's own
  lane(POOL_S.z1 - POOL_S.z0, 1.1, CXX - 0.6, (POOL_S.z0 + POOL_S.z1) / 2,
       0x93a8dc, 0.2, -Math.PI / 2);                                           // the moon's

  const coping = new THREE.MeshStandardMaterial({
    color: 0x6f675e, roughness: 0.82, metalness: 0, envMapIntensity: 0.14,
  });
  pane(0.26, 0.06, POOL_E.z1 - POOL_E.z0, coping,
       POOL_E.x0 + 0.13, -0.03, (POOL_E.z0 + POOL_E.z1) / 2);
  pane(POOL_S.x1 - POOL_S.x0, 0.06, 0.26, coping,
       (POOL_S.x0 + POOL_S.x1) / 2, -0.03, POOL_S.z0 + 0.13);

  // the weir: a thin bright line right at each infinity edge, where the sheet
  // goes over and the water reads as running out into nothing
  const weir = new THREE.MeshBasicMaterial({ color: 0x9fc0d8, fog: false, transparent: true, opacity: 0.5 });
  pane(0.05, 0.05, POOL_E.z1 - POOL_E.z0, weir, POOL_E.x1 - 0.03, WATER_Y + 0.01, (POOL_E.z0 + POOL_E.z1) / 2);
  pane(POOL_S.x1 - POOL_S.x0, 0.05, 0.05, weir, (POOL_S.x0 + POOL_S.x1) / 2, WATER_Y + 0.01, POOL_S.z1 - 0.03);

  // --- the sky: a whole sphere, so it never runs out -----------------------
  const SKY_R = 420;
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(SKY_R, 64, 40),
    new THREE.MeshBasicMaterial({
      map: skyTexture(), side: THREE.BackSide, fog: false, depthWrite: false,
    })
  );
  sky.position.set(CXX, 0, CZZ);
  sky.renderOrder = -2;
  sky.name = 'foyer-sky';
  add(sky);

  // --- the city, far below -------------------------------------------------
  // We are high up: the towers' tops sit below the terrace, so the city is
  // something you look down on and the horizon stays clear above it. One
  // instanced mesh; the night side's windows are a separate point cloud. A gap
  // is left due east so the low sun is seen over open water, not through a
  // tower.
  const N = 150;
  const towers = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshBasicMaterial({ color: 0x0f0c18, fog: false }),
    N
  );
  const M = new THREE.Matrix4();
  const windows = [];
  let seed = 9271;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  let n = 0;
  for (let i = 0; i < N; i++) {
    const A = -1.05 + rnd() * 3.6;                     // south round through east
    if (Math.abs(A - A_EAST) < 0.15) continue;         // the sun's gap
    const r = 90 + Math.pow(rnd(), 0.65) * 250;
    const w = 8 + rnd() * 18, dep = 8 + rnd() * 18;
    // We are high up, so the skyline is mostly BELOW us — roofs, not facades —
    // with a few peers rising near the terrace. Nearer towers reach higher, so
    // the city recedes downward into the haze.
    const near = 1 - (r - 90) / 250;
    const top = -34 + near * 30 + rnd() * 16 * (0.4 + near);
    const h = 70 + rnd() * 130;
    const [sx, sz] = dirOf(A);
    const x = CXX + sx * r, z = CZZ + sz * r;
    M.makeScale(w, h, dep);
    M.setPosition(x, top - h / 2, z);
    towers.setMatrixAt(n++, M);
    // lit windows on the faces that look back at us — night side, and only
    // on the nearer towers, or the far ones turn into a wall of sparks
    if (A < 0.8 && r < 250) {
      const count = 12 + Math.floor(rnd() * 30);
      for (let k = 0; k < count; k++) {
        const fr = r - dep / 2 - 0.6;
        windows.push(
          CXX + sx * fr + (rnd() - 0.5) * w * 0.85,
          top - 1.5 - rnd() * Math.min(h - 3, 48),
          CZZ + sz * fr + (rnd() - 0.5) * dep * 0.3
        );
      }
    }
  }
  towers.count = n;
  towers.instanceMatrix.needsUpdate = true;
  add(towers);

  const winGeo = new THREE.BufferGeometry();
  winGeo.setAttribute('position', new THREE.Float32BufferAttribute(windows, 3));
  add(new THREE.Points(winGeo, new THREE.PointsMaterial({
    map: starSprite(), color: 0xffd6a0, size: 1.5, transparent: true, opacity: 0.9,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false, sizeAttenuation: true,
  })));

  // --- the stars, and their twinkle ----------------------------------------
  // Over the night half of the dome, from just above the horizon up to the
  // zenith — looking straight up from the terrace you are under them. The
  // twinkle is one uTime uniform scaling each star's point size on its own
  // seed.
  const S = 520;
  const sPos = new Float32Array(S * 3);
  const sSeed = new Float32Array(S);
  const R = SKY_R - 12;
  for (let i = 0; i < S; i++) {
    const A = -1.0 + rnd() * 1.85;                      // south, fading toward east
    const e = 0.04 + Math.pow(rnd(), 0.75) * 1.42;      // horizon → zenith
    const [sx, sz] = dirOf(A);
    const ce = Math.cos(e);
    sPos[i * 3] = CXX + sx * ce * R;
    sPos[i * 3 + 1] = Math.sin(e) * R;
    sPos[i * 3 + 2] = CZZ + sz * ce * R;
    sSeed[i] = rnd() * Math.PI * 2;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
  starGeo.setAttribute('aSeed', new THREE.BufferAttribute(sSeed, 1));
  const starUniforms = { uTime: { value: 0 } };
  const starMat = new THREE.PointsMaterial({
    map: starSprite(), color: 0xeaf2ff, size: 3.4, transparent: true, opacity: 0.95,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false, sizeAttenuation: true,
  });
  starMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = starUniforms.uTime;
    shader.vertexShader = 'attribute float aSeed;\nuniform float uTime;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      'gl_PointSize = size;',
      'gl_PointSize = size * (0.5 + 0.5 * sin(uTime * (1.2 + fract(aSeed) * 1.6) + aSeed * 13.0));'
    );
  };
  add(new THREE.Points(starGeo, starMat));

  // --- the light the two skies throw into the room -------------------------
  const [ex, ez] = dirOf(A_EAST);
  const sunLow = new THREE.DirectionalLight(0xff9256, 0.8);
  sunLow.position.set(CXX + ex * 60, 5, CZZ + ez * 60);
  sunLow.target.position.set(CXX, 1, CZZ);
  g.add(sunLow, sunLow.target);
  const [nx, nz] = dirOf(A_SOUTH);
  const moonCool = new THREE.DirectionalLight(0x6f83c9, 0.26);
  moonCool.position.set(CXX + nx * 40, 26, CZZ + nz * 40);
  moonCool.target.position.set(CXX, 1, CZZ);
  g.add(moonCool, moonCool.target);

  return function update(t) {
    starUniforms.uTime.value = t;
  };
}

// The dome's texture, equirectangular: u wraps the compass, v runs zenith
// (top) to nadir (bottom) with the horizon across the middle. Three's
// SphereGeometry puts u = 0 at −X, so u = 0.25 is south (+Z) and u = 0.5 is
// east (+X) — the mapping `uOfA` below encodes, and the whole scene is placed
// against.
//
// Night sits at the south, the sunset is centred due east, and the mix runs on
// angular distance from it, so the corner between the two openings is real
// twilight rather than a seam. The gradient itself is painted small and
// scaled up — smooth colour needs no resolution, and the sun, moon and clouds
// go on afterwards at full size.
const uOfA = (A) => (((0.25 + A / (Math.PI * 2)) % 1) + 1) % 1;

function skyTexture() {
  const W = 2048, H = 1024;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');

  // ── the gradient, painted at 1/8 scale ──────────────────────────────────
  const gw = 256, gh = 128;
  const gc = document.createElement('canvas');
  gc.width = gw; gc.height = gh;
  const gx = gc.getContext('2d');
  const img = gx.createImageData(gw, gh);

  // stops run zenith (0) → horizon (1) → nadir (2), sampled on that scale
  const night = [[0, '#01020a'], [0.55, '#050d1c'], [0.95, '#08182a'], [1, '#0d2438'],
                 [1.08, '#071019'], [1.5, '#04080e'], [2, '#020409']];
  const sunset = [[0, '#2a1a52'], [0.42, '#7c2a68'], [0.72, '#c33d52'], [0.92, '#f2793a'],
                  [1, '#ffd68a'], [1.1, '#7a3a3a'], [1.5, '#2a1520'], [2, '#0d070c']];
  const hex = (s) => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
  const lerp = (a, b, k) => a + (b - a) * k;
  const sample = (stops, v) => {
    for (let i = 1; i < stops.length; i++) {
      if (v <= stops[i][0]) {
        const k = (v - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0]);
        const a = hex(stops[i - 1][1]), b = hex(stops[i][1]);
        return [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
      }
    }
    return hex(stops[stops.length - 1][1]);
  };
  const wrapPi = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  const smooth = (t) => t * t * (3 - 2 * t);

  for (let px = 0; px < gw; px++) {
    // canvas u → azimuth, then how far that is from due east
    const A = ((px / (gw - 1)) - 0.25) * Math.PI * 2;
    const d = Math.abs(wrapPi(A - A_EAST));
    const m = 1 - smooth(Math.min(1, d / 1.2));       // 1 at the sunset, 0 by the south
    for (let py = 0; py < gh; py++) {
      const v = (py / (gh - 1)) * 2;                  // 0 zenith, 1 horizon, 2 nadir
      const a = sample(night, v), b = sample(sunset, v);
      const i = (py * gw + px) * 4;
      img.data[i] = lerp(a[0], b[0], m);
      img.data[i + 1] = lerp(a[1], b[1], m);
      img.data[i + 2] = lerp(a[2], b[2], m);
      img.data[i + 3] = 255;
    }
  }
  gx.putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(gc, 0, 0, W, H);

  // ── the sun, low over the east water ────────────────────────────────────
  const PPD = W / 360;                                // pixels per degree, both axes
  const sunX = uOfA(A_EAST) * W, sunY = H / 2 - 3.1 * PPD;
  let grad = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, 46 * PPD);
  grad.addColorStop(0, 'rgba(255,206,132,0.75)');
  grad.addColorStop(0.3, 'rgba(255,140,70,0.3)');
  grad.addColorStop(1, 'rgba(255,110,60,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(sunX - 46 * PPD, sunY - 46 * PPD, 92 * PPD, 92 * PPD);
  grad = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, 3.4 * PPD);
  grad.addColorStop(0, 'rgba(255,250,232,1)');
  grad.addColorStop(0.7, 'rgba(255,219,150,0.98)');
  grad.addColorStop(1, 'rgba(255,190,110,0)');
  ctx.fillStyle = grad;
  ctx.beginPath(); ctx.arc(sunX, sunY, 3.4 * PPD, 0, Math.PI * 2); ctx.fill();
  // flat cloud bars catching it from underneath
  ctx.fillStyle = 'rgba(255,168,110,0.26)';
  for (const [dx, dy, w, h] of [[-34, -13, 46, 1.5], [-9, -20, 34, 1.2], [16, -9, 40, 1.7]]) {
    ctx.fillRect(sunX + dx * PPD, sunY + dy * PPD, w * PPD, h * PPD);
  }

  // ── the moon, high over the night side ──────────────────────────────────
  const moonX = uOfA(-0.5) * W, moonY = H / 2 - 34 * PPD;
  grad = ctx.createRadialGradient(moonX, moonY, 0, moonX, moonY, 9 * PPD);
  grad.addColorStop(0, 'rgba(214,226,255,0.42)');
  grad.addColorStop(1, 'rgba(214,226,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(moonX - 9 * PPD, moonY - 9 * PPD, 18 * PPD, 18 * PPD);
  ctx.fillStyle = 'rgba(236,241,253,0.96)';
  ctx.beginPath(); ctx.arc(moonX, moonY, 1.5 * PPD, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(158,174,210,0.45)';
  ctx.beginPath(); ctx.arc(moonX - 0.45 * PPD, moonY - 0.35 * PPD, 0.4 * PPD, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(moonX + 0.55 * PPD, moonY + 0.45 * PPD, 0.28 * PPD, 0, Math.PI * 2); ctx.fill();

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// A soft radial dot shared by the stars and the city windows.
let _starSprite = null;
function starSprite() {
  if (_starSprite) return _starSprite;
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const ctx = c.getContext('2d');
  const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.4, 'rgba(255,255,255,0.5)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 32, 32);
  _starSprite = new THREE.CanvasTexture(c);
  return _starSprite;
}

// A reflection lane: bright at the far end, gone at the near, and feathered
// along its length so it lies on the water rather than sitting on it.
function glintTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 32;
  const ctx = c.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 256, 0);
  grad.addColorStop(0, 'rgba(255,255,255,0)');
  grad.addColorStop(0.72, 'rgba(255,235,200,0.42)');
  grad.addColorStop(1, 'rgba(255,244,220,0.95)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 32);
  const edge = ctx.createLinearGradient(0, 0, 0, 32);
  edge.addColorStop(0, 'rgba(0,0,0,1)');
  edge.addColorStop(0.38, 'rgba(0,0,0,0)');
  edge.addColorStop(0.62, 'rgba(0,0,0,0)');
  edge.addColorStop(1, 'rgba(0,0,0,1)');
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = edge;
  ctx.fillRect(0, 0, 256, 32);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
