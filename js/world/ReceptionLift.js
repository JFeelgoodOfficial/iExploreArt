import * as THREE from 'three';
import { DOOR } from './layout.js';
import { RESIDENCIES, FLOOR_HEIGHT } from '../../data/residencies.js';

// The lift beside the reception desk — the only way to an artist residency.
//
// The gallery's west wall (x = 0) used to carry a painted-on door. It's now a
// real opening onto a cabin recessed behind the wall, in the space the gallery
// doesn't occupy (x < 0). Step in, press a floor, and the cabin closes and
// climbs; the player rides with it because `groundAt()` reports the cabin floor
// as walking height, the same trick CourtyardRoom uses for its own lift.
//
// The ride ends behind an opaque veil, and every destination spawns at ground
// height 0, so the room switch itself is never seen.
//
//   const lift = buildReceptionLift(scene, materials);
//   lift.panel.userData.lift = { open: () => ui.openLift(...) };

// Cabin footprint. Depth runs from the wall face at x = 0 back to CAB.x0.
export const CAB = {
  x0: -2.3, x1: 0,
  z0: DOOR.z0, z1: DOOR.z1,
  h: DOOR.h,
  wallT: 0.12,
};
const CAB_CZ = (CAB.z0 + CAB.z1) / 2;
const DOOR_W = CAB.z1 - CAB.z0;

// Height of the call plate's centre. The panel is 0.86 m tall, so this puts it
// between 0.99 m and 1.85 m — see panelTex() for why the bottom edge matters.
const PANEL_Y = 1.42;
const PANEL_H = 0.86;

const SPEED = 2.6;          // m/s of climb
const CLOSE_TIME = 0.9;     // seconds for the leaves to shut
const VEIL_TIME = 0.55;     // seconds of fade before the room switch

export function buildReceptionLift(scene, mats) {
  const group = new THREE.Group();
  group.name = 'reception-lift';

  // Panelled in dark wood rather than the gallery's plaster: the cabin should
  // read as a different, smaller space the moment you step in, and it gives the
  // brass call panel something to sit against.
  const M = {
    shell: mats.woodDark,
    ceil: mats.plasterWarm || mats.plaster,
    floor: mats.marble || mats.concrete,
    leaf: mats.bronze || mats.brass,
    brass: mats.brass,
  };

  const box = (w, h, d, x, y, z, mat, parent = group) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.castShadow = false; m.receiveShadow = true;
    parent.add(m);
    return m;
  };

  // ---- the shaft: a car-height box that travels with the cabin -------------
  // Everything that moves lives under `car`; the shaft lining does not.
  const car = new THREE.Group();
  car.name = 'lift-car';
  group.add(car);

  const d = CAB.x1 - CAB.x0, cx = (CAB.x0 + CAB.x1) / 2;
  // back + two sides + floor + ceiling
  box(CAB.wallT, CAB.h, DOOR_W, CAB.x0 + CAB.wallT / 2, CAB.h / 2, CAB_CZ, M.shell, car);
  box(d, CAB.h, CAB.wallT, cx, CAB.h / 2, CAB.z0 + CAB.wallT / 2, M.shell, car);
  box(d, CAB.h, CAB.wallT, cx, CAB.h / 2, CAB.z1 - CAB.wallT / 2, M.shell, car);
  box(d, 0.08, DOOR_W, cx, -0.04, CAB_CZ, M.floor, car);
  box(d, 0.08, DOOR_W, cx, CAB.h + 0.04, CAB_CZ, M.ceil, car);
  // a brass reveal where the walls meet the floor, and a ceiling light disc
  // (stops short of the door plane so the leaves don't clip through it)
  box(d - 0.14, 0.06, DOOR_W - 0.02, cx - 0.07, 0.03, CAB_CZ, M.brass, car);
  // Kept deliberately dim: the gallery's hemisphere and ambient lights already
  // reach inside the cabin (they aren't occluded by its walls), so anything
  // brighter blows the interior out and the call panel stops being legible.
  const lamp = new THREE.Mesh(
    new THREE.CircleGeometry(0.34, 24),
    new THREE.MeshStandardMaterial({ color: 0xfff4e0, emissive: 0xffe6bc, emissiveIntensity: 0.45, roughness: 0.6 })
  );
  lamp.rotation.x = Math.PI / 2;
  lamp.position.set(cx, CAB.h - 0.02, CAB_CZ);
  car.add(lamp);
  const glow = new THREE.PointLight(0xffe2b4, 0.9, 4.5, 2);
  glow.position.set(cx, CAB.h - 0.25, CAB_CZ);
  car.add(glow);

  // ---- the doors: two leaves that part at the opening ---------------------
  const leafW = DOOR_W / 2;
  const leaves = [-1, 1].map((s) => {
    // Recessed a touch behind the wall face at x = 0: when the leaves slide
    // open they sit in front of the gallery's west wall, and a face at x = 0
    // would be coplanar with the plaster and z-fight (flickering patches
    // either side of the opening, seen from the reception desk).
    const m = box(0.07, CAB.h - 0.04, leafW, -0.05, (CAB.h - 0.04) / 2, CAB_CZ + s * leafW / 2, M.leaf, car);
    m.userData.side = s;
    m.userData.shut = m.position.z;
    return m;
  });

  // ---- the button panel ---------------------------------------------------
  const panel = new THREE.Mesh(
    new THREE.PlaneGeometry(0.42, 0.86),
    new THREE.MeshStandardMaterial({ map: panelTex(), roughness: 0.45, metalness: 0.2 })
  );
  // Raised from 1.3: the cabin is only 2.3 m deep, so the plate is read from
  // under a metre away and its lower half sits a long way below the 1.65 m eye.
  // See panelTex() — the bottom disc is the one that decides this number.
  panel.position.set(cx + 0.25, PANEL_Y, CAB.z0 + CAB.wallT + 0.01);
  panel.rotation.y = 0;
  panel.name = 'reception-lift-panel';
  car.add(panel);

  // No shaft lining: the cabin is sealed on all six sides once the leaves shut,
  // and it is always back at ground level whenever anyone is in the gallery to
  // look through the doorway. There is no vantage point that ever sees a shaft.

  scene.add(group);

  // ---- ride state machine -------------------------------------------------
  // idle → closing → riding → arriving → (room switch) → opening → idle
  let phase = 'idle';
  let y = 0, targetY = 0, t = 0, doorK = 0;   // doorK: 0 open, 1 shut
  let dest = null;
  let onArrive = null, onVeil = null;

  function applyDoors() {
    for (const m of leaves) {
      m.position.z = m.userData.shut + m.userData.side * leafW * (1 - doorK);
    }
  }
  applyDoors();

  function ride(residency) {
    if (phase !== 'idle') return;
    dest = residency;
    targetY = residency.floor * FLOOR_HEIGHT;
    phase = 'closing';
    t = 0;
  }

  function update(dt) {
    if (phase === 'idle') return;
    if (phase === 'closing') {
      t += dt;
      doorK = Math.min(1, t / CLOSE_TIME);
      applyDoors();
      if (doorK >= 1) { phase = 'riding'; }
      return;
    }
    if (phase === 'riding') {
      y = Math.min(targetY, y + SPEED * dt);
      car.position.y = y;
      if (y >= targetY - 1e-4) {
        y = targetY; car.position.y = y;
        phase = 'arriving'; t = 0;
        onVeil?.(true);
      }
      return;
    }
    if (phase === 'arriving') {
      t += dt;
      if (t >= VEIL_TIME) {
        // Behind the veil: hand over to the room switch, then drop the cabin
        // back to the ground so the doorway isn't left showing an empty shaft.
        // `phase` stays 'switching' across the handover, so `busy` stays true
        // and the player is still frozen while the destination compiles.
        phase = 'switching';
        Promise.resolve(onArrive?.(dest.id))
          .catch((e) => console.error('[lift] arrival failed', e))
          .then(() => {
            reset();
            onVeil?.(false);
          });
      }
    }
  }

  // Put the cabin back on the ground with its doors open. Called after every
  // arrival and whenever the player re-enters the gallery.
  function reset() {
    y = 0; targetY = 0; car.position.y = 0;
    doorK = 0; applyDoors();
    phase = 'idle';
    dest = null;
  }

  // Walking height inside the cabin — null means "not in the lift, ask the
  // room's own ground function". Mirrors CourtyardRoom's inLift() trick.
  function groundAt(x, z) {
    if (x > CAB.x0 && x < CAB.x1 && z > CAB.z0 && z < CAB.z1) return y;
    return null;
  }

  // Cabin walls. All 'all' level, deliberately: a level-tagged segment is
  // skipped once the player's walking height drifts from it (Collision.js), so
  // a level-0 wall would switch off the moment the cabin left the ground.
  // There is no +X segment — that side is the doorway.
  const seg = (ax, az, bx, bz) => ({ a: [ax, az], b: [bx, bz], level: 'all' });
  const colliders = [
    seg(CAB.x0, CAB.z0, CAB.x0, CAB.z1),   // back
    seg(CAB.x0, CAB.z0, CAB.x1, CAB.z0),   // north side
    seg(CAB.x0, CAB.z1, CAB.x1, CAB.z1),   // south side
  ];

  return {
    group,
    panel,
    colliders,
    // Where the gallery drops you: inside the cabin, facing out into the hall.
    spawn: { x: cx, z: CAB_CZ, yaw: -Math.PI / 2 },
    labels: RESIDENCIES.map((r) => `${r.name} — floor ${r.floor}`),
    residencies: RESIDENCIES,
    ride,
    update,
    reset,
    groundAt,
    // true while the cabin is doing anything — main.js freezes walking on it
    get busy() { return phase !== 'idle'; },
    set onArrive(fn) { onArrive = fn; },
    set onVeil(fn) { onVeil = fn; },
  };
}

// Canvas texture for the call panel: a brass disc per residency, numbered by
// floor. Same conventions as CourtyardRoom's liftPanelTex (sRGB, Georgia).
function panelTex() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 512;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#2b2723'; ctx.fillRect(0, 0, 256, 512);
  ctx.strokeStyle = '#c9b48a'; ctx.lineWidth = 6; ctx.strokeRect(10, 10, 236, 492);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#c9b48a'; ctx.font = 'bold 20px Georgia';
  ctx.fillText('RESIDENCIES', 128, 52);

  // The constraint here is the camera frustum, NOT the canvas border. The cabin
  // is 2.3 m deep, so the plate is read from about 0.87 m away, and the camera's
  // vertical FOV is 72° — half of that, 36°, is all the downward angle there is.
  // At that distance a disc more than ~0.5 m below the 1.65 m eye falls off the
  // bottom of the screen entirely, while still sitting comfortably inside the
  // canvas. A fixed `top + i * gap` stack grows downward and walks straight out
  // of view on the residency that gets added next — which is exactly what a
  // fourth one did.
  //
  // So the discs are spread across a band chosen in WORLD space and converted
  // back to canvas pixels: BAND_BOT is the lowest point still inside the view
  // cone, and the stack closes up as residencies are added instead of reaching
  // past it. Radius follows the gap so they never collide.
  const EYE = 1.65, READ_DIST = 0.87, MAX_DROP = READ_DIST * Math.tan(30 * Math.PI / 180);
  const yToCanvas = (worldY) => (1 - (worldY - (PANEL_Y - PANEL_H / 2)) / PANEL_H) * c.height;
  const BAND_TOP = 116;                              // clear of the header
  const BAND_BOT = Math.min(440, yToCanvas(EYE - MAX_DROP));
  const n = RESIDENCIES.length;
  const gap = n > 1 ? Math.min(108, (BAND_BOT - BAND_TOP) / (n - 1)) : 0;
  const top = BAND_TOP + ((BAND_BOT - BAND_TOP) - gap * (n - 1)) / 2;
  const R = n > 1 ? Math.min(34, gap / 2 - 6) : 34;

  RESIDENCIES.forEach((r, i) => {
    const cy = top + i * gap;
    ctx.fillStyle = '#e7dcc5';
    ctx.beginPath(); ctx.arc(76, cy, R, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2b2723'; ctx.font = `bold ${Math.round(R)}px Georgia`;
    ctx.fillText(String(r.floor), 76, cy + 2);
    ctx.fillStyle = '#e7dcc5';
    let fs = 22;
    do { ctx.font = `${fs}px Georgia`; } while (ctx.measureText(r.name).width > 118 && (fs -= 2) > 12);
    ctx.textAlign = 'left';
    ctx.fillText(r.name, 122, cy + 2);
    ctx.textAlign = 'center';
  });

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
