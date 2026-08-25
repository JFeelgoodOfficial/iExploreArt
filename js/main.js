import * as THREE from 'three';
import { detectTier, IS_TOUCH, ADAPTIVE_DPR } from './config.js';
import { createMaterials } from './world/materials.js';
import { buildGallery } from './world/Gallery.js';
import { setupLighting } from './world/Lighting.js';
import { Player } from './Player.js';
import { DesktopControls } from './controls/DesktopControls.js';
import { TouchControls } from './controls/TouchControls.js';
import { createAssetPipeline } from './utils/assets.js';
import { createEffects } from './Effects.js';
import { buildArtworks } from './art/Artworks.js';
import { buildCityView } from './world/CityView.js';
import { buildCourtyard } from './world/Courtyard.js';
import { buildCourtyardRoom, setupCourtyardLighting, CR } from './world/CourtyardRoom.js';
import { buildReceptionLift } from './world/ReceptionLift.js';
import { buildNouveauRoom, nouveauGround, nouveauSegments, LANDING } from './world/nouveau.js';
import { buildRococoRoom, ROOM as ROCOCO, LIFT as ROCOCO_LIFT, LOBE } from './world/rococo.js';
import {
  buildBrutalistRoom, setupBrutalistLighting,
  brutalistGround, brutalistSegments, SPAWN as BX_SPAWN, BX, SUN_POS as BX_SUN,
} from './world/brutalism/brutalist.js';
import {
  buildChadreaRoom, setupChadreaLighting,
  chadreaGround, chadreaSegments, SPAWN as CH_SPAWN, LIFT as CH_LIFT,
  SUN_POS as CH_SUN,
} from './world/chadrea/chadrea.js';
import {
  buildDecetiseRoom, setupDecetiseLighting,
  decetiseGround, decetiseSegments, DECETISE_HANG,
  DX, SPAWN as DX_SPAWN, SUN_POS as DX_SUN,
} from './world/decetise.js';
import { ROCOCO_HANG, NOUVEAU_HANG, INTO_BLOOM } from '../data/residency-artworks.js';
import { BRUTALIST_HANG } from '../data/brutalist-artworks.js';
import { CHADREA_HANG } from '../data/chadrea-artworks.js';
import { PLINTH } from './world/rococo-plinth.js';
import { createRoomManager } from './RoomManager.js';
import { groundHeight as galleryGround, buildColliders as buildGalleryColliders } from './world/layout.js';
import { buildWallFountain } from './world/WallFountain.js';
import { buildDetails } from './world/Details.js';
import { buildFoyerRoom, foyerGround, FY_CURATOR } from './world/foyer.js';
import { FEATURED } from '../data/featured.js';
import { LISTED_RESIDENCIES, findResidency } from '../data/residencies.js';
import { buildLedEqualizer } from './world/led-equalizer.js';
import { buildMusic } from './audio/Music.js';
import { buildAudioControls } from './audio/AudioControls.js';
import { Curator } from './curator/Curator.js';
import { tickWind } from './world/wind.js';
import { Interaction } from './Interaction.js';
import { UI } from './ui/UI.js';
import { drainUploads } from './utils/texqueue.js';

const tier = detectTier();
if (IS_TOUCH) document.body.classList.add('touch');

const canvas = document.getElementById('scene');
// MSAA is wasted under the EffectComposer (it renders the scene into its own
// non-multisampled target), so only request it on the no-bloom path.
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !tier.bloom, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, tier.pixelRatio));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
// Transmission glass renders the scene a second time into a transmission
// target each frame; half the internal resolution quarters that cost and is
// imperceptible on the near-clear panes.
renderer.transmissionResolutionScale = 0.5;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xcfd8de);

const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.08, 500);

const materials = createMaterials(tier);
const gallery = buildGallery(scene, materials);
const lighting = setupLighting(scene, renderer, tier);

const player = new Player(camera);
const controls = IS_TOUCH ? new TouchControls(canvas, player) : new DesktopControls(canvas, player);
const ui = new UI(controls);
const interaction = new Interaction(camera, ui, canvas);
// Touch passes the point it was tapped at; the keyboard passes nothing and
// means "whatever the crosshair is on".
controls.onInteract = (px, py) => interaction.activate(px, py);

// --- loading flow ---
const loadingEl = document.getElementById('loading');
const enterBtn = document.getElementById('enter-btn');
const progressBar = document.getElementById('progress-bar');
const bootUI = { progress: (f) => { progressBar.style.width = `${Math.round(f * 100)}%`; } };

const assets = createAssetPipeline(renderer, scene, materials, tier, bootUI);
const artworks = buildArtworks(scene, materials, assets.manager, renderer, tier);
interaction.register(artworks.interactables);
const city = buildCityView(scene, renderer);
const courtyard = buildCourtyard(scene, materials, tier);
const fountain = buildWallFountain(scene, camera, materials, tier, { volume: 0.75 });
const music = buildMusic(camera);
const details = buildDetails(scene, materials, tier);
const equalizer = buildLedEqualizer(scene, materials, { sound: music.sound });
// Mira moved out to the foyer with the reception desk — she is constructed
// inside the foyer's captureLayer below, so she hides with that room. The
// frame loop only runs after this module finishes, so the late assignment is
// safe.
let curator;
// Music + ambient-sound mute toggles, plus the mobile Web Audio unlock.
const audio = buildAudioControls({ music, fountain, camera });

// --- second room: the courtyard, entered through the west door by reception --
// An invisible-but-raycastable hitbox: renders nothing (opacity 0) yet
// Mesh.raycast still hits it, so looking at it shows the "press E" prompt.
function doorHitbox(w, h, x, y, z, rotY, name) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
  );
  m.position.set(x, y, z);
  m.rotation.y = rotY;
  m.name = name;
  return m;
}

// The reception lift, in the hall's west wall. Retired from visitor use since
// the reception (and the way in) moved out to the foyer, but left fully wired:
// if Hall of JFeelgood reopens, the cabin still rides. Built before the
// gallery snapshot so it belongs to the gallery layer.
const lift = buildReceptionLift(scene, materials);
// The floor buttons first: aiming at one rides straight to that floor, and the
// plate behind them is the fallback that opens the picker list.
interaction.register([...lift.buttons, lift.panel]);

// Snapshot everything currently in the scene as the gallery "layer", and the
// current interaction targets (artworks + the lift panel).
const galleryChildren = new Set(scene.children);
const galleryTargets = interaction.targets.slice();

const rooms = createRoomManager({ scene, player, interaction });

// Every residency room is built inside captureLayer so that whatever it adds to
// the scene — geometry, lights, its return-door hitbox — is hidden with it.
// A stray scene.add() after the capture would float visibly in every room.
const seg = (ax, az, bx, bz, level = 'all') => ({ a: [ax, az], b: [bx, bz], level });

// A closed ring of colliders around a freestanding object, so you walk round it
// instead of through it. `r` is measured to the flat of each side.
function ringSegments(cx, cz, r, sides = 8, level = 'all') {
  const pt = (i) => {
    const a = (i / sides) * Math.PI * 2 + Math.PI / sides;
    return [cx + Math.cos(a) * r, cz + Math.sin(a) * r];
  };
  const out = [];
  for (let i = 0; i < sides; i++) {
    const [ax, az] = pt(i), [bx, bz] = pt(i + 1);
    out.push(seg(ax, az, bx, bz, level));
  }
  return out;
}

// An open run of colliders along an arc — a curved balustrade, as opposed to
// ringSegments' closed fence around an object. Chords, so `steps` has to be
// generous enough that the flats don't read as corners under a hand on the rail.
function arcSegments(cx, cz, r, a0, a1, steps = 10, level = 'all') {
  const pt = (i) => {
    const a = a0 + ((a1 - a0) * i) / steps;
    return [cx + Math.cos(a) * r, cz + Math.sin(a) * r];
  };
  const out = [];
  for (let i = 0; i < steps; i++) {
    const [ax, az] = pt(i), [bx, bz] = pt(i + 1);
    out.push(seg(ax, az, bx, bz, level));
  }
  return out;
}

// Every residency's way back: an invisible plane by the spawn, facing the way
// the visitor arrived. Hub and spoke — you ride up, you walk back.
function returnDoor(x, y, z, rotY) {
  const hit = doorHitbox(2.0, 2.3, x, y, z, rotY, 'door-to-reception');
  hit.userData.door = { label: 'return to reception', onEnter: () => { rooms.enter('foyer'); reflectHash('foyer'); } };
  scene.add(hit);
  return hit;
}

// --- the courtyard --------------------------------------------------------
const { value: cy, layer: courtyardLayer } = rooms.captureLayer(() => {
  const room = buildCourtyardRoom(scene, materials, tier);
  const lights = setupCourtyardLighting(scene, renderer, tier);
  // The city seen through the west hallway windows. Same builder as the
  // gallery's north view, yawed a quarter turn so its skyline lies out along −X
  // instead of −Z, and given its own seed so it isn't the same street twice.
  // scene.fog is global and already set by the gallery instance, so this one
  // leaves it alone; its sun matches setupCourtyardLighting's, or the daylight
  // would arrive from two different quarters at once.
  const city = buildCityView(scene, renderer, {
    name: 'city-courtyard',
    seed: 91_827,
    yaw: Math.PI / 2,
    fog: false,
    sunPosition: new THREE.Vector3(13, 34, 15),
    nearProps: tier.name !== 'low',
  });
  // South hallway wall by the spawn, facing −Z toward the garden. Offset to
  // x = 2.25 — the pictures hang at x ∈ {−4.5, 0, 4.5}, and a door hitbox laid
  // over one of them would prompt "return to reception" while you look at art.
  const door = returnDoor(2.25, 1.2, 8.8, Math.PI);
  return { room, lights, door, city };
});
const courtyardRoom = cy.room;

// Courtyard colliders are AABBs whose `level` is a storey INDEX; the collision
// system wants segments whose level is a walking HEIGHT. Convert, then add a
// keep-in box — the room's own colliders omit the perimeter back walls.
function courtyardCollisionSegments() {
  const segs = [];
  for (const a of courtyardRoom.colliders) {
    const lv = a.level === 'all' ? 'all' : CR.floors[a.level];
    segs.push(
      { a: [a.x0, a.z0], b: [a.x1, a.z0], level: lv },
      { a: [a.x1, a.z0], b: [a.x1, a.z1], level: lv },
      { a: [a.x1, a.z1], b: [a.x0, a.z1], level: lv },
      { a: [a.x0, a.z1], b: [a.x0, a.z0], level: lv }
    );
  }
  const K = CR.clamp;
  segs.push(
    { a: [-K, -K], b: [K, -K], level: 'all' },
    { a: [K, -K], b: [K, K], level: 'all' },
    { a: [K, K], b: [-K, K], level: 'all' },
    { a: [-K, K], b: [-K, -K], level: 'all' }
  );
  return segs;
}

// --- Nouveau and Rococo, built on first visit ------------------------------
// Both generate a lot of procedural canvas texture, and rococo in particular is
// an order of magnitude more expensive to build than the whole courtyard. Doing
// that at boot blocks the main thread well past the loading screen's own 12 s
// watchdog, so instead each is built the first time someone rides to it —
// behind the lift's opaque veil, where a stalled frame doesn't show.
const residencyRooms = {};   // id -> the builder's room object, once built

// Hung photographs: anisotropy against the GPU's real ceiling, and a decode
// cap so the low tier doesn't hold fifteen 2048px canvases in texture memory.
const artOpts = {
  anisotropy: Math.min(tier.anisotropy, renderer.capabilities.getMaxAnisotropy()),
  artMaxEdge: tier.artMaxEdge,
};

const ROOM_FACTORIES = {
  nouveau: () => {
    const room = buildNouveauRoom(scene, {
      shadowSize: tier.shadowSize, ...artOpts, art: NOUVEAU_HANG,
    });
    // the doorway at the head of the stair opens into the rococo hall
    const stairDoor = doorHitbox(1.3, 2.2, LANDING.doorX, LANDING.y + 1.2, LANDING.doorZ - 0.1, Math.PI, 'door-to-rococo');
    stairDoor.userData.door = { label: 'through the doorway', onEnter: () => travelTo('rococo') };
    scene.add(stairDoor);
    // the lift set into the stair hall's west wall rides back to reception
    // (entering 'gallery' spawns you inside the reception cabin, doors open)
    const liftDoor = doorHitbox(1.6, 2.3, -4.1, 1.25, 8.5, Math.PI / 2, 'nouveau-lift-to-reception');
    liftDoor.userData.door = { label: 'ride the lift to reception', onEnter: () => travelTo('foyer') };
    scene.add(liftDoor);
    return {
      room,
      def: {
        targets: [stairDoor, liftDoor, ...room.interactables],
        spawn: { x: 0, z: 4.2, yaw: 0 },   // NB: room.spawn.y is an eye height, not a floor
        segments: nouveauSegments(),
        ground: nouveauGround,
        background: new THREE.Color(0x1a1712),
        bake: () => { renderer.shadowMap.needsUpdate = true; },
      },
    };
  },

  rococo: () => {
    const room = buildRococoRoom(scene, { tier, ...artOpts, art: ROCOCO_HANG, plinthArt: INTO_BLOOM });
    const door = returnDoor(0, 1.25, ROCOCO.z1 - 0.14, Math.PI);
    const el = room.elevator;
    const G = ROCOCO.galleryY;
    // Every deck number below is derived from the room, not written out: the
    // gallery's depth is a thing you tune (js/world/rococo.js), and hand-copied
    // literals here drifted from it the moment it moved.
    const { x0, x1, z0, z1, galleryDepth: DP } = ROCOCO;
    const RAIL_Z = z1 - DP;                       // the near run's balustrade line
    const RAIL_X0 = x0 + DP, RAIL_X1 = x1 - DP;   // the side runs' balustrade lines
    const WALL = 0.15;                            // deck keep-in, clear of the wall face
    // Half the gilt bead's depth. The balustrade colliders sit on the rail's
    // VOID-side face rather than its centreline, so the visitor's body finishes
    // over the rail the way it would if they leaned on it, instead of stopping a
    // player-radius short of it. That 0.17 m is what decides whether the table
    // on the floor below is visible over the rail or cut off by it: at eye
    // height the sight line clears the bead by a wide enough margin to take in
    // the whole disc, and 0.17 further back it does not. Nothing to clip
    // against — the rail top is 0.72 m below the eye.
    const LEAN = 0.17;
    // Where a side run's bowed end hands back to its straight rail, measured on
    // the collider line rather than the rail line — so the arc's own endpoint
    // lands on it and the two meet without a notch to slip through.
    const LOBE_TIP = LOBE.z + LOBE.r + LEAN;
    // Cab footprint (a whisker inside the cage rails). prevY gates keep the
    // ground floor and the deck from capturing each other: you only resolve to a
    // height you're already near.
    const CABX0 = ROCOCO_LIFT.x - ROCOCO_LIFT.w / 2, CABX1 = ROCOCO_LIFT.x + ROCOCO_LIFT.w / 2;
    const CABZ0 = ROCOCO_LIFT.z - ROCOCO_LIFT.d / 2, CABZ1 = ROCOCO_LIFT.z + ROCOCO_LIFT.d / 2;
    // The cab's open side faces the landing ledge. When the car isn't parked at
    // the top that opening is a hole down the shaft, so this segment closes it —
    // the frame loop flips its level out of range whenever the cab is there.
    const shaftGuard = seg(CABX0, CABZ0, CABX1, CABZ0, G);
    el.shaftGuard = shaftGuard;
    const ground = (x, z, prevY) => {
      if (el.overFloor(x, z)) {
        const fy = el.floorY;                   // the cab's marble floor plate
        if (Math.abs(prevY - fy) < 0.8) return fy;
      }
      if (prevY > 2.2) {
        // near run, up to the shaft; then the ledge in front of the cab
        if (z > RAIL_Z && z < z1 && x > x0 && x < CABX0) return G;
        if (z > RAIL_Z && z < CABZ0 && x >= CABX0 && x < x1) return G;
        if (x > x0 && x < RAIL_X0 && z > z0 && z < RAIL_Z) return G;   // west run
        if (x > RAIL_X1 && x < x1 && z > z0 && z < RAIL_Z) return G;   // east run
        // …and the bowed ends those two runs finish on, which stand out past
        // the rail line into the room (js/world/rococo.js, LOBE)
        if (x >= RAIL_X0 && Math.hypot(x - RAIL_X0, z - LOBE.z) < LOBE.r) return G;
        if (x <= RAIL_X1 && Math.hypot(x - RAIL_X1, z - LOBE.z) < LOBE.r) return G;
      }
      return 0;
    };
    return {
      room,
      def: {
        targets: [door, ...el.buttons, ...room.interactables],
        spawn: { x: 0, z: 4.2, yaw: 0 },
        segments: [
          // ground-floor keep-in, opened where the floor meets the lift cage
          seg(-6.9, -4.9, 6.9, -4.9, 0),
          seg(-6.9, -4.9, -6.9, 4.9, 0),
          seg(-6.9, 4.9, CABX0, 4.9, 0),           // near wall, stops at the cage
          seg(6.9, -4.9, 6.9, CABZ0 - 0.25, 0),    // east, stops short of the cage
          seg(6.9, CABZ0 - 0.25, CABX1, CABZ0 - 0.25, 0),
          // the cage itself: glazed east/west/south sides, open to the north
          seg(CABX0, CABZ0, CABX0, CABZ1),
          seg(CABX1, CABZ0, CABX1, CABZ1),
          seg(CABX0, CABZ1, CABX1, CABZ1),
          // Gallery deck perimeter. It stands off the wall by WALL so the
          // visitor cannot walk into the upper pictures — their frames project
          // about 0.13 m off the wall face, so a line flush with the wall let
          // you push your face through the canvas.
          seg(x0 + WALL, z0 + WALL, x1 - WALL, z0 + WALL, G),
          seg(x0 + WALL, z0 + WALL, x0 + WALL, z1 - WALL, G),
          seg(x0 + WALL, z1 - WALL, x1 - WALL, z1 - WALL, G),
          seg(x1 - WALL, z0 + WALL, x1 - WALL, z1 - WALL, G),
          // …and the balustrade edges nobody should step over
          // The near run's rail stops at each side run's rail line, exactly as
          // the balustrade does — beyond it the deck turns the corner and the
          // east run is directly across, so there is nothing to fall off and
          // nothing to block. That corner is the only way round to the lift.
          seg(RAIL_X0, RAIL_Z - LEAN, RAIL_X1, RAIL_Z - LEAN, G),
          // Each side run's rail is now straight only as far as its bowed end,
          // where it swings out on LOBE.r and comes back — same LEAN offset,
          // measured outward from the lobe's centre instead of sideways off the
          // rail line. The short stub is the 0.17 jog between the two, which the
          // player would otherwise slip through at the junction.
          seg(RAIL_X0 + LEAN, LOBE_TIP, RAIL_X0 + LEAN, RAIL_Z, G),   // west run
          seg(RAIL_X1 - LEAN, LOBE_TIP, RAIL_X1 - LEAN, RAIL_Z, G),   // east run
          seg(RAIL_X0, LOBE_TIP, RAIL_X0 + LEAN, LOBE_TIP, G),
          seg(RAIL_X1, LOBE_TIP, RAIL_X1 - LEAN, LOBE_TIP, G),
          ...arcSegments(RAIL_X0, LOBE.z, LOBE.r + LEAN, -Math.PI / 2, Math.PI / 2, 10, G),
          ...arcSegments(RAIL_X1, LOBE.z, LOBE.r + LEAN, Math.PI / 2, Math.PI * 1.5, 10, G),
          shaftGuard,
          // the table at the centre: a ring around the farthest point the panel
          // sweeps as it turns, so nothing spinning inside it ever clips. The
          // top is a round panel roughly 1.9 m across, so the barrier is walked
          // along rather than met head-on — 16 segments, not 8, or the flats
          // read as corners.
          ...ringSegments(PLINTH.x, PLINTH.z, room.plinth.reach + 0.08, 16, 0),
        ],
        ground,
        background: new THREE.Color(0xdfeaf4),
        bake: () => { renderer.shadowMap.needsUpdate = true; },
      },
    };
  },

  brutalist: () => {
    const room = buildBrutalistRoom(scene, { tier, ...artOpts, art: BRUTALIST_HANG });
    const lights = setupBrutalistLighting(scene, renderer, tier);
    // The city both openings look over. Same builder as the gallery's north
    // view, yawed a quarter turn the other way so the skyline lies out along +X,
    // past the pool's infinity edge. `fog` is global and the gallery already set
    // it; the sun matches setupBrutalistLighting's, or the daylight would arrive
    // from two quarters at once.
    const city = buildCityView(scene, renderer, {
      name: 'city-brutalism', seed: 5150, yaw: -Math.PI / 2, fog: false,
      sunPosition: BX_SUN, nearProps: tier.name !== 'low',
    });
    // The skyline was authored around a 4.4 m eye. It's read from the level-1
    // window at 6 m and from the pool at 13 m, so lift it to keep the near
    // rooftops near the horizon rather than all of them underfoot.
    city.group.position.y = 5.5;
    // South wall by the spawn, facing back up the hall.
    const door = returnDoor(2.6, 1.35, BX.z1 - 0.14, Math.PI);
    return {
      room: { ...room, lights, city },
      def: {
        targets: [door, ...room.interactables],
        spawn: BX_SPAWN,
        segments: brutalistSegments(),
        ground: brutalistGround,
        background: new THREE.Color(0x9aa3a8),
        bake: () => { lights.bake(); },
      },
    };
  },

  chadrea: () => {
    const room = buildChadreaRoom(scene, { tier, ...artOpts, art: CHADREA_HANG });
    const lights = setupChadreaLighting(scene, renderer, tier);
    // The city over the courtyard's far wall — the only place in this
    // residency you see out. Yawed a half turn so the skyline lies along +Z,
    // past the terrace. `fog` is global and the gallery already set it; the sun
    // matches setupChadreaLighting's, or the daylight arrives from two quarters.
    const city = buildCityView(scene, renderer, {
      name: 'city-chadrea', seed: 7311, yaw: Math.PI, fog: false,
      sunPosition: CH_SUN, nearProps: tier.name !== 'low',
    });
    // Read from a 1.65 m eye over a 4.6 m wall, so the near rooftops want to
    // sit above it rather than below the coping.
    city.group.position.y = 3.4;
    // No return door on the south wall. Every other residency has one there,
    // behind the spawn, but this hall also has a lift of its own through the
    // arch — two ways out of one room, and the door was standing on the only
    // large wall in the hall with nothing on it. The wall hangs work now
    // (SLOTS CH-S1/CH-S2); the lift below is how you leave.
    //
    // The lift is in the wing's south wall. It rides the
    // veil rather than switching outright, the way the nouveau stair hall's
    // does — entering 'gallery' puts you inside the reception cabin with its
    // doors open, so the trip reads as a lift rather than a cut.
    const liftDoor = doorHitbox(CH_LIFT.w + 0.2, CH_LIFT.h, CH_LIFT.x, CH_LIFT.h / 2,
      CH_LIFT.z - 0.16, Math.PI, 'chadrea-lift-to-reception');
    liftDoor.userData.door = {
      label: 'ride the lift to reception',
      onEnter: () => travelTo('foyer'),
    };
    scene.add(liftDoor);
    return {
      room: { ...room, lights, city },
      def: {
        targets: [liftDoor, ...room.interactables],
        spawn: CH_SPAWN,
        segments: chadreaSegments(),
        ground: chadreaGround,
        background: new THREE.Color(0x1a1714),
        bake: () => { lights.bake(); },
      },
    };
  },

  decetise: () => {
    const room = buildDecetiseRoom(scene, { tier, ...artOpts, art: DECETISE_HANG });
    const lights = setupDecetiseLighting(scene, renderer, tier);
    // A whole floor plate five storeys up, glazed on three of its four sides —
    // north, east, and the west wall over the pool. Every other room in the
    // building looks out of one wall, so the default city is a wedge aimed at
    // it; here a wedge leaves two windows showing bare sky whichever way it is
    // yawed. `surround` rings the building with the same towers instead, so the
    // city is there out of every window and over the pool's weir. `fog` is
    // global and the gallery already set it; the sun matches
    // setupDecetiseLighting's, or the daylight arrives from two quarters at once.
    const city = buildCityView(scene, renderer, {
      name: 'city-decetise', seed: 1207, surround: true, fog: false,
      sunPosition: DX_SUN, nearProps: tier.name !== 'low',
    });
    // The skyline is authored to be read from near its own rooftops. Lifted, so
    // that from a 1.65 m eye up here the near roofs sit around the horizon
    // instead of spread out underfoot.
    city.group.position.y = 5.0;
    // No return door on a wall: the way down is the cabin you arrived in, whose
    // brass back wall closes the lift core behind you. The whole of that wall
    // answers — the steel call plate on it is 0.34 m across, which is no way to
    // ask for reception. It rides the veil like the chadrea and nouveau lifts
    // do: entering 'gallery' puts you inside the reception cabin, doors open.
    //
    // Stood off the brass by a hand's width, because the plate projects and
    // because the hitbox has to stay in FRONT of the visitor: walking into that
    // wall stops you a player-radius short of it (decetiseSegments), and a
    // plane flush with the brass would sit behind the eye at exactly the moment
    // someone is nose to the wall looking for the way out.
    const liftDoor = doorHitbox(DX.core * 2 - 0.2, 2.4, 0, 1.25, DX.core - 0.28,
      Math.PI, 'decetise-lift-to-reception');
    liftDoor.userData.door = {
      label: 'ride the lift to reception',
      onEnter: () => travelTo('foyer'),
    };
    scene.add(liftDoor);
    return {
      room: { ...room, lights, city },
      def: {
        targets: [liftDoor, ...room.interactables],
        spawn: DX_SPAWN,
        segments: decetiseSegments(),
        ground: decetiseGround,
        background: new THREE.Color(0xdcc6a6),
        bake: () => { lights.bake(); },
      },
    };
  },
};

async function ensureRoom(id) {
  if (rooms.has(id) || !ROOM_FACTORIES[id]) return;
  // Let the veil paint before the build takes the main thread for several seconds.
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const { value, layer } = rooms.captureLayer(ROOM_FACTORIES[id]);
  residencyRooms[id] = value.room;
  rooms.define(id, { layer, ...value.def });
}

// A veiled hop between rooms for doors and lifts that don't ride the reception
// cabin: fade to black, switch (building the destination if this is its first
// visit), fade back. `travelling` gates re-entrant presses and freezes walking.
let travelling = false;
async function travelTo(id) {
  if (travelling) return;
  travelling = true;
  try {
    ui.veil(true);
    await new Promise((r) => setTimeout(r, 600));  // #veil's CSS fade is 0.5 s
    await ensureRoom(id);
    rooms.enter(id);
    reflectHash(id);
    if (renderer.compileAsync) await renderer.compileAsync(scene, camera);
  } catch (e) {
    console.error('[travel] failed', e);
  } finally {
    ui.veil(false);
    travelling = false;
  }
}

// --- share links ------------------------------------------------------------
// Every open hall has a slug (data/residencies.js), and visiting the page as
// #that-slug walks straight into the hall once the visitor clicks Enter — the
// link an artist hands out for their own show, whether or not it is the one
// the foyer door opens onto. Unknown, closed, or unbuildable targets fall
// through to the foyer. Raw room ids are accepted too.
function roomFromHash() {
  const h = decodeURIComponent(location.hash.replace(/^#/, '')).trim().toLowerCase();
  if (!h) return null;
  const r = LISTED_RESIDENCIES.find((x) => x.slug === h || x.id === h);
  if (!r || r.closed) return null;
  if (!rooms.has(r.id) && !ROOM_FACTORIES[r.id]) return null;
  return r.id;
}

// Keep the address bar honest: arriving in a hall writes its slug, returning
// to the foyer clears it. replaceState doesn't fire hashchange, so this never
// echoes back into the listener below.
function reflectHash(id) {
  const r = findResidency(id);
  const url = r && !r.closed
    ? `#${r.slug || r.id}`
    : location.pathname + location.search;
  history.replaceState(null, '', url);
}

// A hash pasted or edited mid-visit travels there (or back to the foyer).
window.addEventListener('hashchange', () => {
  const dest = roomFromHash() || 'foyer';
  if (dest !== rooms.current) travelTo(dest);
});

// --- register every room --------------------------------------------------
// The old reception hall — Hall of JFeelgood now (data/residencies.js), closed
// to visitors since the reception moved out to the foyer. Everything stays
// built and defined so reopening it is a data change: delete the residency's
// `closed` flag and give visitors a way in (the lift below still works).
rooms.define('gallery', {
  layer: [...galleryChildren],
  targets: galleryTargets,
  spawn: lift.spawn,                    // you arrive standing in the cabin
  segments: [...buildGalleryColliders(), ...lift.colliders],
  // The cabin floor overrides the gallery's own ground while you're inside it,
  // so the car carries you up. Composed here to keep layout.js free of lift state.
  ground: (x, z, prevY) => lift.groundAt(x, z) ?? galleryGround(x, z, prevY),
  background: scene.background,         // whatever CityView left it (null)
  bake: () => lighting.bake(),
  onEnter: () => lift.reset(),          // cabin back on the ground before the spawn lands in it
});

rooms.define('courtyard', {
  layer: courtyardLayer,
  targets: [cy.door, courtyardRoom.lift.panel],
  spawn: courtyardRoom.spawn,
  segments: courtyardCollisionSegments(),
  ground: courtyardRoom.groundHeight,
  background: new THREE.Color(0xbcd3e0),  // soft daylit sky through the glass roof
  bake: () => cy.lights.bake(),
});

// --- the foyer: where every visit begins ------------------------------------
// A small reception lobby on its own coordinate patch (js/world/foyer.js): the
// desk, Mira, the featured show's signage and one of its works, and the door
// that rides the veil into the featured hall (data/featured.js).
const { value: fy, layer: foyerLayer } = rooms.captureLayer(() => {
  const room = buildFoyerRoom(scene, materials, {
    ...artOpts,
    onDoor: () => travelTo(FEATURED.residencyId),
  });
  curator = new Curator(scene, materials, ui, player, {
    manager: assets.manager, renderer, tier, pos: FY_CURATOR,
  });
  return room;
});
rooms.define('foyer', {
  layer: foyerLayer,
  targets: [fy.door, ...fy.interactables, ...curator.interactables],
  spawn: fy.spawn,
  segments: fy.colliders,
  ground: foyerGround,
  background: new THREE.Color(0x2b241d),
  bake: () => { renderer.shadowMap.needsUpdate = true; },
});

// Collision.js seeds its active room at module load, so the start room's real
// segments + ground only go live once this runs.
rooms.start('foyer');

// Reception lift: press E inside the cabin → pick a residency → it rides up and
// arrives behind the veil.
lift.onVeil = (on) => ui.veil(on);
lift.onArrive = async (id) => {
  await ensureRoom(id);              // first visit: build it behind the veil
  rooms.enter(id);
  // Recompile with the destination's lights visible while the veil is still up
  // (renderer.compile gathers lights from visible objects only).
  if (renderer.compileAsync) await renderer.compileAsync(scene, camera);
};
// Aiming at the plate itself — between the buttons — still opens the list, so
// there is always a way through even if the discs are awkward to hit.
lift.panel.userData.lift = {
  label: 'call the lift',
  open: () => ui.openLift(
    lift.labels, -1,
    // indexed against lift.labels, so read the destinations back off the lift —
    // it offers only the rooms that exist (data/residencies.js, `pending`)
    (i) => lift.ride(lift.residencies[i]),
    { speaker: 'Reception lift', title: 'Which residency?' }
  ),
};

// The courtyard's own lift serves that room's three floors, plus a starred
// button that rides the veil back to the reception foyer.
const cyLift = courtyardRoom.lift;
cyLift.panel.userData.lift = {
  open: () => ui.openLift(
    ['★ Reception', ...cyLift.labels],
    cyLift.currentIndex() + 1,
    (i) => (i === 0 ? travelTo('foyer') : cyLift.selectFloor(i - 1))
  ),
};

let entered = false;
let ready = false;
function readyToEnter() {
  if (ready) return;
  ready = true;
  progressBar.style.width = '100%';
  enterBtn.disabled = false;
  enterBtn.textContent = 'Enter the gallery';
  lighting.bake();
}
// Warm every shader program (fountain, foliage, transmission glass) while the
// loading screen is still up, so first sight of the courtyard doesn't hitch on
// a synchronous compile. compileAsync runs after all maps + scene.environment
// are assigned (both resolve before assets.done), then unlocks entry.
assets.done
  .then(() => (renderer.compileAsync ? renderer.compileAsync(scene, camera) : null))
  .then(readyToEnter)
  .catch(readyToEnter);
setTimeout(readyToEnter, 12000); // never gate entry on a stuck download

enterBtn.addEventListener('click', () => {
  if (enterBtn.disabled) return;
  entered = true;
  loadingEl.classList.add('fade-out');
  audio.unlock();      // resume + prime the AudioContext inside this gesture (mobile)
  audio.reveal();      // show the music / sound mute buttons
  ui.enter();
  controls.lock();
  // A share link (#slug) skips the walk: ride the veil straight to the hall.
  const dest = roomFromHash();
  if (dest && dest !== rooms.current) travelTo(dest);
});

lighting.bake();

// --- frame loop ---
const NO_INTENT = { forward: 0, strafe: 0, running: false };
const clock = new THREE.Clock();
let frame = 0;
renderer.setAnimationLoop(() => {
  frame++;
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  // Spread GPU texture uploads across frames — mostly drained behind the
  // loading screen, so drawing a painting for the first time never hitches.
  drainUploads(renderer, 1);

  // The reception lift drives its own ride/fade state machine. Tick it above
  // the throttle early-return, or pausing mid-ride would strand it forever, and
  // above player.update so the cabin floor this frame is what ground sampling sees.
  lift.update(dt);
  // Same reasoning for the rococo glass lift, whose cab floor is the ground fn.
  const glassLift = rooms.current === 'rococo' ? residencyRooms.rococo?.elevator : null;
  if (glassLift) {
    glassLift.update(dt);
    // open the deck-level opening only while the car is parked up there
    if (glassLift.shaftGuard) {
      glassLift.shaftGuard.level = glassLift.y > glassLift.top - 0.05 ? -99 : ROCOCO.galleryY;
    }
    // Standing in the cab calls the car without having to find a button — at
    // the bottom it goes up, at the top it comes back down (lift.call() is a
    // toggle). Uses the ground height the player actually resolved to, so it
    // only fires for someone the platform is carrying.
    interaction.setStanding(
      glassLift.standingOn(player.position.x, player.position.z, player.walkY)
        ? glassLift.callAction
        : null,
    );
  } else {
    interaction.setStanding(null);
  }

  // Behind a blurred full-screen overlay the gallery is barely visible; render
  // it a quarter as often to drop the render+backdrop-blur double cost. Never
  // throttle before entry — the loading screen needs frames to drain uploads.
  if (entered && ui.isObscured()) {
    curator.update(dt, t); // keep the portrait facing / breathing under the panel
    if (frame % 4 === 0) {
      if (effects) effects.render();
      else renderer.render(scene, camera);
    }
    return;
  }

  // Freeze walking while any elevator is travelling so you can't step out of
  // the cabin mid-ride (the cabin carries you between floors), and during a
  // veiled door/lift hop.
  const riding = courtyardRoom.liftMoving || lift.busy || travelling
    || !!residencyRooms.rococo?.elevator.moving;
  player.update(dt, riding ? NO_INTENT : controls.intent);
  interaction.enabled = !ui.activePanel && !riding;
  interaction.update(dt);
  tickWind(t);
  city.update(t);
  cy.city.update(t);         // clouds + birds past the courtyard's west windows
  details.update(t);
  equalizer.update(t);
  fountain.update(t);
  courtyardRoom.update(t);   // foliage wind (cheap; harmless while hidden)
  // the rococo table's slow turn — only while you're in the room to see it
  if (rooms.current === 'rococo') residencyRooms.rococo?.plinth?.update(dt);
  // the brutalist hall's own skyline past the terrace, and the pool's ripples
  if (rooms.current === 'brutalist') {
    residencyRooms.brutalist?.city.update(t);
    residencyRooms.brutalist?.update(dt);
  }
  // the haze in Chadrea Hall's light shaft, its pool, and the city over the
  // courtyard wall
  if (rooms.current === 'chadrea') {
    residencyRooms.chadrea?.city.update(t);
    residencyRooms.chadrea?.update(dt);
  }
  // Decetise Hall's own skyline, the pool's swell, the plane trees and the jet.
  // Its update() reads elapsed time, not a delta — the sway and the swell are
  // sampled off `t` rather than integrated.
  if (rooms.current === 'decetise') {
    residencyRooms.decetise?.city.update(t);
    residencyRooms.decetise?.update(t);
  }
  // Candle / lamp flicker, for the rooms that have any. The call is optional as
  // well as the rig: a room lit by daylight alone (the brutalist hall) returns a
  // rig with no `update`, and setAnimationLoop re-arms its rAF *after* the
  // callback — so a TypeError here doesn't skip a frame, it stops the loop dead.
  residencyRooms[rooms.current]?.lights?.update?.(dt);
  curator.update(dt, t);
  if (effects) effects.render();
  else renderer.render(scene, camera);
  if (entered) governDpr(dt);
});

const effects = createEffects(renderer, scene, camera, tier);

// --- adaptive resolution governor (opt-in via ADAPTIVE_DPR) -----------------
// Watches the 75th-percentile frame time and steps the device pixel ratio down
// one notch under sustained slowness, back up after a long comfortable spell.
// Hysteresis + a settle window keep it from oscillating; each step reallocates
// render targets (a one-frame cost), so it fires rarely and only when already
// slow. rAF pauses on a hidden tab, so the timers naturally ignore that.
const dprSteps = [Math.min(window.devicePixelRatio, tier.pixelRatio), 1.75, 1.5, 1.25]
  .filter((r, i) => i === 0 || r < Math.min(window.devicePixelRatio, tier.pixelRatio));
let dprIdx = 0, dprPressure = 0, sinceEntered = 0, resizeSuspend = 0;
let dtRing = [];
function setDpr(i) {
  dprIdx = i; dprPressure = 0; dtRing = [];
  renderer.setPixelRatio(dprSteps[i]);
  if (effects) effects.setPixelRatio(dprSteps[i]);
}
function governDpr(dt) {
  if (!ADAPTIVE_DPR || !effects || dprSteps.length < 2) return;
  sinceEntered += dt;
  if (sinceEntered < 5) return;                          // settle after entry
  if (resizeSuspend > 0) { resizeSuspend -= dt; return; }
  dtRing.push(dt);
  if (dtRing.length > 90) dtRing.shift();
  if (dtRing.length < 90) return;
  const sorted = [...dtRing].sort((a, b) => a - b);
  const p75 = sorted[Math.floor(sorted.length * 0.75)] * 1000; // ms
  if (p75 > 20 && dprIdx < dprSteps.length - 1) {
    dprPressure = dprPressure > 0 ? dprPressure + dt : dt;
    if (dprPressure >= 3) setDpr(dprIdx + 1);            // sustained slow → down
  } else if (p75 < 12 && dprIdx > 0) {
    dprPressure = dprPressure < 0 ? dprPressure - dt : -dt;
    if (-dprPressure >= 10) setDpr(dprIdx - 1);          // long comfortable → up
  } else {
    dprPressure = 0;
  }
}

// Aspect is cheap and stops the view stretching immediately; the expensive
// render-target reallocation is debounced so dragging the window edge doesn't
// thrash it every event.
let resizeTimer = 0;
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  clearTimeout(resizeTimer);
  resizeSuspend = 1.0; // don't let the DPR governor react to a resize storm
  resizeTimer = setTimeout(() => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    if (effects) effects.resize(window.innerWidth, window.innerHeight);
  }, 150);
});

// debug/testing handle (harmless in production)
window.__gallery = { player, camera, scene, renderer, controls, lighting, ui, interaction, curator, details, city, fountain, music, equalizer, audio, rooms, courtyardRoom, lift, residencyRooms, ensureRoom, effects };
