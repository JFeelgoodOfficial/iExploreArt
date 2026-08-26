import * as THREE from 'three';
import { FEATURED, featuredResidency, featuredArtwork } from '../../data/featured.js';
import { buildReceptionDesk, signTexture, plaqueTexture } from './Details.js';
import { loadArtTexture } from '../art/load.js';
import { SHOW_CARD, STATEMENT } from '../../data/chadrea-artworks.js';

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
  const { anisotropy = 8, artMaxEdge = 0, onDoor, tier } = opts;
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
  const update = buildPoolCorner(g, mats, tier);

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

  // --- the show's title wall, repeated where the visitor waits --------------
  // West of the door, on the clear stretch of the north wall: the featured
  // show's name, artist, and series statement, painted the way the hall's own
  // title wall is (js/world/chadrea/chadrea.js) — so the foyer says what the
  // door opens onto before anyone steps through. Dark ink here: this plaster
  // is light where the chadrea pier is dark. Pressing E opens the show card.
  // Read from the featured show's own data — the foyer is that show's lobby.
  const PLAQUE = { x: FY.x0 + 1.5, y: 1.7, w: 1.5, h: 2.0 };
  const plaque = new THREE.Mesh(
    new THREE.PlaneGeometry(PLAQUE.w, PLAQUE.h),
    new THREE.MeshStandardMaterial({
      map: plaqueTexture({
        title: SHOW_CARD.title, artist: SHOW_CARD.artist, body: STATEMENT,
        width: 1024, height: 1365,     // the plane's 1.5 × 2.0 aspect
      }),
      transparent: true, roughness: 0.9, metalness: 0,
    })
  );
  plaque.position.set(PLAQUE.x, PLAQUE.y, FY.z0 + 0.02);
  plaque.name = 'foyer-show-plaque';
  plaque.userData.artwork = SHOW_CARD;
  g.add(plaque);
  interactables.push(plaque);

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
  // the show plaque west of the door
  spot(PLAQUE.x, FY.h - 0.1, 1.7, PLAQUE.x, PLAQUE.y, FY.z0, 7, 6, 0.5, 0.8);

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

function buildPoolCorner(g, mats, tier) {
  const CXX = (FY.x0 + FY.x1) / 2, CZZ = (FY.z0 + FY.z1) / 2;
  const W = FY.x1 - FY.x0, D = FY.z1 - FY.z0;

  const add = (mesh) => { g.add(mesh); return mesh; };
  const slab = (x0, z0, x1, z1, mat, top = 0, thick = DECK.t) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, thick, z1 - z0), mat);
    m.position.set((x0 + x1) / 2, top - thick / 2, (z0 + z1) / 2);
    m.receiveShadow = true;
    return add(m);
  };

  // --- the glass screen ----------------------------------------------------
  // Waist-high, no posts, and it runs the whole way round: across the two
  // foyer openings, and again along the terrace's outer edge above the pool.
  // Runs are given as explicit spans rather than centred lengths, so each one
  // stops exactly where the next begins — the corners meet, they never cross.
  const glass = mats.railGlass.clone();
  glass.envMapIntensity = 0;      // the interior HDR turned it into a grey fog bank
  glass.opacity = 0.05;
  glass.roughness = 0.02;
  const GT = 0.04, GH = 1.02, CAP = 0.09;

  const pane = (w, h, d, mat, x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    return add(m);
  };
  // A screen running along x, or along z, spanning a…b, with its cap rail.
  const screen = (run, at, a, b) => {
    const len = b - a, mid = (a + b) / 2;
    if (run === 'x') {
      pane(len, GH, GT, glass, mid, GH / 2, at);
      pane(len, 0.04, CAP, mats.woodDark, mid, GH + 0.02, at);
    } else {
      pane(GT, GH, len, glass, at, GH / 2, mid);
      pane(CAP, 0.04, len, mats.woodDark, at, GH + 0.02, mid);
    }
  };
  // The foyer's own two openings: the east run carries through the corner and
  // the south run butts on its face.
  const FE = FY.x1 + 0.02, FS = FY.z1 + 0.02;
  screen('z', FE, FY.z0 - 0.3, FS + GT / 2);
  screen('x', FS, FY.x0 - 0.31, FE - GT / 2);
  // …and the terrace edge, along the pool's outer lip. Same rule at the far
  // corner, so those two meet without passing through each other either.
  const TE = DECK.x1 - GT / 2, TS = DECK.z1 - GT / 2;
  screen('z', TE, DECK.z0, TS + GT / 2);
  screen('x', TS, DECK.x0, TE - GT / 2);

  // --- the paving ----------------------------------------------------------
  const paving = new THREE.MeshStandardMaterial({
    color: 0x494440, roughness: 0.9, metalness: 0, envMapIntensity: 0.12,
  });
  // Each slab stops at the pool wall's outer face (a wall's thickness short of
  // the water), never at the waterline itself: a slab ending flush with a tile
  // wall shares that wall's plane, and the pool's sides flicker between paving
  // and tile. The tile walls own the basin's faces; the paving never touches
  // them. (WT is the pool-wall thickness, declared with the basin below.)
  const PWT = 0.16;
  slab(FY.x1 + 0.3, DECK.z0, POOL_E.x0 - PWT, POOL_S.z0 - PWT, paving);   // east patio
  slab(DECK.x0, FY.z1 + 0.3, POOL_E.x0 - PWT, POOL_S.z0 - PWT, paving);   // south patio
  slab(DECK.x0, POOL_S.z0 - PWT, POOL_S.x0 - PWT, DECK.z1, paving);       // west margin

  // --- the pool ------------------------------------------------------------
  // One L of water round the building's corner — a single surface, so there is
  // no seam down it and nothing standing in the middle of it. The basin is
  // tiled and lit from under the water, the way a roof pool is after dark, and
  // its two outer sides are the infinity lip.
  const lShape = () => {
    const sh = new THREE.Shape();
    sh.moveTo(POOL_E.x0, POOL_E.z0);
    sh.lineTo(POOL_E.x1, POOL_E.z0);
    sh.lineTo(POOL_E.x1, POOL_E.z1);
    sh.lineTo(POOL_S.x0, POOL_S.z1);
    sh.lineTo(POOL_S.x0, POOL_S.z0);
    sh.lineTo(POOL_E.x0, POOL_S.z0);
    sh.closePath();
    return sh;
  };
  const DEPTH = 1.05;
  const tile = poolTileTexture();
  tile.repeat.set(1 / 0.55, 1 / 0.55);          // a 55 cm tile, in world units
  const tileMat = new THREE.MeshStandardMaterial({
    map: tile, color: 0xa8ccd6, roughness: 0.5, metalness: 0, envMapIntensity: 0.12,
  });
  const floorGeo = new THREE.ShapeGeometry(lShape());
  floorGeo.rotateX(Math.PI / 2);
  const basinFloor = new THREE.Mesh(floorGeo, tileMat);
  basinFloor.position.y = WATER_Y - DEPTH;
  basinFloor.receiveShadow = true;
  add(basinFloor);
  // the basin's sides, one per side of the L. The two outer ones stop at the
  // waterline: that lip is what the sheet runs over.
  const WT = 0.16;
  const wall = (x0, z0, x1, z1, top) => {
    const h = top - (WATER_Y - DEPTH);
    pane(Math.max(x1 - x0, WT), h, Math.max(z1 - z0, WT), tileMat,
         (x0 + x1) / 2, WATER_Y - DEPTH + h / 2, (z0 + z1) / 2);
  };
  wall(POOL_E.x0, POOL_E.z0 - WT, POOL_E.x1, POOL_E.z0, 0);           // north end
  wall(POOL_E.x0 - WT, POOL_E.z0, POOL_E.x0, POOL_S.z0, 0);           // west, long arm
  wall(POOL_S.x0 - WT, POOL_S.z0, POOL_S.x0, POOL_S.z1, 0);           // west, short arm
  wall(POOL_S.x0, POOL_S.z0 - WT, POOL_E.x0, POOL_S.z0, 0);           // the L's step
  wall(POOL_E.x1, POOL_E.z0, POOL_E.x1 + WT, POOL_E.z1, WATER_Y);     // east lip
  wall(POOL_S.x0, POOL_S.z1, POOL_E.x1, POOL_S.z1 + WT, WATER_Y);     // south lip

  // The coping, a pale stone lip on the sides you can stand at — following the
  // L's real boundary, never across the water.
  const coping = new THREE.MeshStandardMaterial({
    color: 0x6f675e, roughness: 0.82, metalness: 0, envMapIntensity: 0.14,
  });
  // The coping rides 4 cm proud of the paving and noses 1 cm out over the
  // water — a real pool's lip does both, and a stone lip whose top sat exactly
  // at deck level (or whose face sat exactly on the tile's plane) shared that
  // surface's plane and shimmered against it.
  const CW = 0.3;
  pane(CW, 0.06, POOL_S.z0 - POOL_E.z0 + 0.01, coping,
       POOL_E.x0 - CW / 2 + 0.01, 0.01, (POOL_E.z0 + POOL_S.z0) / 2 + 0.005);
  pane(POOL_E.x0 - POOL_S.x0 + 0.01, 0.06, CW, coping,
       (POOL_S.x0 + POOL_E.x0) / 2 + 0.005, 0.01, POOL_S.z0 - CW / 2 + 0.01);
  pane(CW, 0.06, POOL_S.z1 - POOL_S.z0, coping,
       POOL_S.x0 - CW / 2 + 0.01, 0.01, (POOL_S.z0 + POOL_S.z1) / 2);

  // The water: the same L, one surface. Two ripple normals crossing and
  // scrolling past each other (the trick the courtyard pool downstairs uses —
  // still water reads as plastic), over a body deep enough to take its colour
  // from the tile beneath it.
  const rA = rippleNormal(256, 11), rB = rippleNormal(256, 29);
  rA.repeat.set(1 / 2.1, 1 / 2.1);
  rB.repeat.set(1 / 3.4, 1 / 3.4);
  const waterGeo = new THREE.ShapeGeometry(lShape(), 12);
  waterGeo.rotateX(Math.PI / 2);
  // Deliberately NOT transmissive. The scene's shared environment map is a
  // bright interior HDR, and a transmissive sheet under it renders as milk
  // whatever the tint — the courtyard pool downstairs gets away with it
  // because it stands in daylight. This is dusk water: dark, faintly lit from
  // under, with the tile just readable through it and two ripple layers on
  // top, the clearcoat one rough enough not to mirror the room.
  const waterMat = new THREE.MeshPhysicalMaterial({
    color: 0x0e3c4f, roughness: 0.17, metalness: 0,
    transmission: 0, transparent: true, opacity: 0.8,
    clearcoat: 0.55, clearcoatRoughness: 0.28,
    clearcoatNormalMap: rB, clearcoatNormalScale: new THREE.Vector2(0.35, 0.35),
    normalMap: rA, normalScale: new THREE.Vector2(0.4, 0.4),
    emissive: new THREE.Color(0x0b3d4e), emissiveIntensity: 0.5,
    envMapIntensity: 0.22, side: THREE.DoubleSide, fog: false,
  });
  const waterMesh = new THREE.Mesh(waterGeo, waterMat);
  waterMesh.position.y = WATER_Y;
  waterMesh.name = 'foyer-pool';
  add(waterMesh);

  // Underwater light — two lamps down the long arm, one in the short, so the
  // pool is the brightest thing on the terrace once the sun is down.
  for (const [lx, lz] of [[POOL_E.x0 + 2.3, 2.0], [POOL_E.x0 + 2.3, 9.6],
                          [POOL_S.x0 + 3.2, POOL_S.z0 + 2.1]]) {
    const l = new THREE.PointLight(0x5fc6dc, 2.6, 7, 2);
    l.position.set(lx, WATER_Y - 0.55, lz);
    g.add(l);
  }

  // the sun's own reflection, laid on the water toward it
  const lane = (len, wide, x, z, color, opacity, yaw) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(len, wide),
      new THREE.MeshBasicMaterial({
        map: glintTexture(), transparent: true, blending: THREE.AdditiveBlending,
        depthWrite: false, fog: false, color, opacity,
      })
    );
    m.rotation.set(-Math.PI / 2, yaw, 0, 'YXZ');
    m.position.set(x, WATER_Y + 0.006, z);
    return add(m);
  };
  lane(POOL_E.x1 - POOL_E.x0, 1.5, (POOL_E.x0 + POOL_E.x1) / 2, CZZ, 0xffc98d, 0.28, 0);

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
    // the two ripple sheets crossing, each drifting at its own rate
    rA.offset.set(t * 0.013, t * 0.009);
    rB.offset.set(-t * 0.008, t * 0.015);
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
  grad.addColorStop(0, 'rgba(255,206,132,0.6)');
  grad.addColorStop(0.3, 'rgba(255,140,70,0.24)');
  grad.addColorStop(1, 'rgba(255,110,60,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(sunX - 46 * PPD, sunY - 46 * PPD, 92 * PPD, 92 * PPD);
  grad = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, 3.4 * PPD);
  grad.addColorStop(0, 'rgba(255,250,232,1)');
  grad.addColorStop(0.7, 'rgba(255,219,150,0.98)');
  grad.addColorStop(1, 'rgba(255,190,110,0)');
  ctx.fillStyle = grad;
  ctx.beginPath(); ctx.arc(sunX, sunY, 3.4 * PPD, 0, Math.PI * 2); ctx.fill();

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

  // ── the cloud deck, drawn over both the sun and the moon ────────────────
  paintClouds(ctx, W, H);

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// A flat deck of cloud at a fixed altitude, drawn in perspective rather than
// as a pattern smeared across the sky. For a pixel looking out at elevation e,
// the deck is met at horizontal distance h/tan(e) — so the cloud shapes pile
// up and compress toward the horizon on their own, which is the thing that
// makes a cloud layer read as real. Sampling a circle on that plane closes
// seamlessly all the way round the compass, so nothing has to tile.
//
// Shape is fractal noise, domain-warped once to kill the grid in it. Light is
// a second sample taken a step toward the sun: where the deck thins in that
// direction the light gets through, which gives the tops their rim and leaves
// the undersides heavy.
function paintClouds(ctx, W, H) {
  const cw = 1024, ch = 512;                    // drawn here, scaled up after
  const off = document.createElement('canvas');
  off.width = cw; off.height = ch;
  const octx = off.getContext('2d');
  const img = octx.createImageData(cw, ch);

  const hash = (x, y) => {
    const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return n - Math.floor(n);
  };
  const vnoise = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = hash(xi, yi), b = hash(xi + 1, yi);
    const c2 = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
    return a * (1 - u) * (1 - v) + b * u * (1 - v) + c2 * (1 - u) * v + d * u * v;
  };
  const fbm = (x, y) => {
    let sum = 0, amp = 0.5, f = 1;
    for (let i = 0; i < 5; i++) { sum += amp * vnoise(x * f, y * f); amp *= 0.5; f *= 2; }
    return sum;
  };
  const density = (x, y) => {
    const wx = fbm(x * 0.6 + 5.2, y * 0.6 + 1.3);
    const wy = fbm(x * 0.6 + 9.2, y * 0.6 + 7.7);
    return fbm(x + 2.1 * wx, y + 2.1 * wy);
  };

  const ALT = 1400;                 // deck altitude, metres above the terrace
  const SCALE = 1 / 2600;           // noise units per metre
  const COVER = 0.46;               // lower = more sky
  const smooth = (t) => t * t * (3 - 2 * t);
  const clamp01 = (t) => (t < 0 ? 0 : t > 1 ? 1 : t);
  // the sun's direction on the deck, for the light sample
  const [sunDx, sunDz] = dirOf(A_EAST);

  for (let py = 0; py < ch; py++) {
    const e = (0.5 - py / (ch - 1)) * Math.PI;          // elevation, + is up
    if (e <= 0.012) continue;                           // below the deck's reach
    const d = ALT / Math.tan(e);
    if (d > 90000) continue;
    // Distance haze: far cloud loses contrast into the horizon's own glow.
    const near = Math.exp(-d / 26000);
    for (let px = 0; px < cw; px++) {
      const A = ((px / (cw - 1)) - 0.25) * Math.PI * 2;
      const [ax, az] = dirOf(A);
      const cx = ax * d * SCALE, cz = az * d * SCALE;
      const n = density(cx, cz);
      let a = smooth(clamp01((n - COVER) / 0.2));
      if (a <= 0.004) continue;
      a *= 0.35 + 0.65 * near;
      // thinner at the very top of the sky, where the deck runs out overhead
      a *= 1 - smooth(clamp01((e - 1.15) / 0.42));
      // light: is the deck thinner a step toward the sun?
      const L = 0.06;
      const nl = density(cx + sunDx * L, cz + sunDz * L);
      const lit = smooth(clamp01((n - nl) * 3.4 + 0.45));
      // how much of the sunset's own warmth reaches this bearing at all
      const dA = Math.abs(Math.atan2(Math.sin(A - A_EAST), Math.cos(A - A_EAST)));
      const warm = 1 - smooth(clamp01(dA / 1.5));
      // shadowed body → lit top, then tinted by how near the sun it is
      const base = [26 + 34 * lit, 22 + 30 * lit, 34 + 38 * lit];
      const glow = [96 + 159 * lit, 48 + 140 * lit, 52 + 92 * lit];
      const k = warm * (0.35 + 0.65 * near);
      const i = (py * cw + px) * 4;
      img.data[i] = base[0] + (glow[0] - base[0]) * k;
      img.data[i + 1] = base[1] + (glow[1] - base[1]) * k;
      img.data[i + 2] = base[2] + (glow[2] - base[2]) * k;
      img.data[i + 3] = a * 255;
    }
  }
  octx.putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(off, 0, 0, W, H);
}

// Pale glass mosaic for the pool's basin: a tile grid with grout, each tile
// nudged a shade off its neighbours so the floor reads through moving water.
function poolTileTexture() {
  const S = 256, N = 4;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#20596b';
  ctx.fillRect(0, 0, S, S);
  const t = S / N;
  let seed = 4211;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const k = 0.86 + rnd() * 0.24;
      ctx.fillStyle = `rgb(${Math.round(48 * k)},${Math.round(112 * k)},${Math.round(132 * k)})`;
      ctx.fillRect(x * t + 1.5, y * t + 1.5, t - 3, t - 3);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// A tileable ripple normal map — a few crossed swells summed into a height
// field and differenced. Two of these, scrolled past each other by update(),
// are what stop still water reading as a sheet of plastic.
function rippleNormal(size = 256, seed = 11) {
  let st = seed >>> 0;
  const rand = () => { st = (st * 1664525 + 1013904223) >>> 0; return st / 4294967296; };
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
  const h = (x, y) => waves.reduce((sm, w) => sm + w.amp * Math.sin(w.kx * x + w.kz * y + w.ph), 0);
  const c = document.createElement('canvas');
  c.width = c.height = size;
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
