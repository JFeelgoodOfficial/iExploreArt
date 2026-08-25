import * as THREE from 'three';
import { FEATURED, featuredResidency, featuredArtwork } from '../../data/featured.js';
import { buildReceptionDesk, signTexture } from './Details.js';
import { loadArtTexture } from '../art/load.js';

// The reception foyer — where every visit begins. A small lobby, not a
// gallery: the reception desk with Mira behind it, the house sign above,
// a single door in the north wall that opens onto the currently featured
// show (data/featured.js), and one work from that show beside the door.
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
  const floor = box(W + 0.6, 0.1, D + 1.2, mats.wood, CX, -0.05, CZ - 0.3);
  floor.castShadow = false;
  const ceil = box(W + 0.6, 0.2, D + 0.6, mats.plasterWarm, CX, FY.h + 0.1, CZ);
  ceil.castShadow = false;
  box(0.3, FY.h, D + 0.6, mats.plaster, FY.x0 - 0.15, FY.h / 2, CZ);          // west
  box(0.3, FY.h, D + 0.6, mats.plaster, FY.x1 + 0.15, FY.h / 2, CZ);          // east
  box(W + 0.6, FY.h, 0.3, mats.plaster, CX, FY.h / 2, FY.z1 + 0.15);          // south
  // north wall, opened around the doorway
  const wN = DOOR.x0 - (FY.x0 - 0.3);
  box(wN, FY.h, 0.3, mats.plaster, FY.x0 - 0.3 + wN / 2, FY.h / 2, FY.z0 - 0.15);
  const eN = (FY.x1 + 0.3) - DOOR.x1;
  box(eN, FY.h, 0.3, mats.plaster, DOOR.x1 + eN / 2, FY.h / 2, FY.z0 - 0.15);
  box(DOOR.x1 - DOOR.x0, FY.h - DOOR.h, 0.3, mats.plaster,
      DOOR_CX, DOOR.h + (FY.h - DOOR.h) / 2, FY.z0 - 0.15);                   // lintel

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
  };
}
