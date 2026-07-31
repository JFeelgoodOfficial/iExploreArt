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
import { buildRococoRoom, ROOM as ROCOCO, LIFT as ROCOCO_LIFT } from './world/rococo.js';
import { RESIDENCIES } from '../data/residencies.js';
import { ROCOCO_HANG, NOUVEAU_HANG, INTO_BLOOM } from '../data/residency-artworks.js';
import { PLINTH } from './world/rococo-plinth.js';
import { createRoomManager } from './RoomManager.js';
import { groundHeight as galleryGround, buildColliders as buildGalleryColliders } from './world/layout.js';
import { buildWallFountain } from './world/WallFountain.js';
import { buildDetails } from './world/Details.js';
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
const interaction = new Interaction(camera, ui);
controls.onInteract = () => interaction.activate();

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
const curator = new Curator(scene, materials, ui, player, { manager: assets.manager, renderer, tier });
interaction.register(curator.interactables);
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

// The reception lift: the door beside the curator is now an elevator, and the
// only way to an artist residency. Built before the gallery snapshot so the
// cabin belongs to the gallery layer.
const lift = buildReceptionLift(scene, materials);
interaction.register([lift.panel]);

// Snapshot everything currently in the scene as the gallery "layer", and the
// current interaction targets (artworks + curator + the lift panel).
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

// Every residency's way back: an invisible plane by the spawn, facing the way
// the visitor arrived. Hub and spoke — you ride up, you walk back.
function returnDoor(x, y, z, rotY) {
  const hit = doorHitbox(2.0, 2.3, x, y, z, rotY, 'door-to-reception');
  hit.userData.door = { label: 'return to reception', onEnter: () => rooms.enter('gallery') };
  scene.add(hit);
  return hit;
}

// --- the courtyard --------------------------------------------------------
const { value: cy, layer: courtyardLayer } = rooms.captureLayer(() => {
  const room = buildCourtyardRoom(scene, materials, tier);
  const lights = setupCourtyardLighting(scene, renderer, tier);
  // South hallway wall by the spawn, facing −Z toward the garden. Offset to
  // x = 2.25 — the pictures hang at x ∈ {−4.5, 0, 4.5}, and a door hitbox laid
  // over one of them would prompt "return to reception" while you look at art.
  const door = returnDoor(2.25, 1.2, 8.8, Math.PI);
  return { room, lights, door };
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
    liftDoor.userData.door = { label: 'ride the lift to reception', onEnter: () => travelTo('gallery') };
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
    // Cab footprint (a whisker inside the cage rails), then the three gallery
    // deck strips. prevY gates keep the ground floor and the deck from
    // capturing each other: you only resolve to a height you're already near.
    const CABX0 = ROCOCO_LIFT.x - ROCOCO_LIFT.w / 2, CABX1 = ROCOCO_LIFT.x + ROCOCO_LIFT.w / 2;
    const CABZ0 = ROCOCO_LIFT.z - ROCOCO_LIFT.d / 2, CABZ1 = ROCOCO_LIFT.z + ROCOCO_LIFT.d / 2;
    // The cab's open side faces the deck. When the car isn't parked at the top
    // that opening is a hole, so this segment closes it — the frame loop flips
    // its level out of range whenever the cab is actually there to step into.
    const shaftGuard = seg(CABX0, CABZ0, CABX1, CABZ0, G);
    el.shaftGuard = shaftGuard;
    const ground = (x, z, prevY) => {
      if (el.overFloor(x, z)) {
        const fy = el.floorY;                   // the cab's marble floor plate
        if (Math.abs(prevY - fy) < 0.8) return fy;
      }
      if (prevY > 2.2) {
        if (z > -5.5 && z < -3.9 && x > -7.5 && x < 7.5) return G;   // north run
        if (x > -7.5 && x < -5.9 && z > -3.9 && z < 5.5) return G;   // west run
        if (x > 5.9 && x < 7.5 && z > -3.9 && z < CABZ0 + 0.02) return G; // east run + sill
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
          seg(-6.9, 4.9, CABX0, 4.9, 0),           // south, stops at the cage
          seg(6.9, -4.9, 6.9, CABZ0 - 0.25, 0),    // east, stops short of the cage
          seg(6.9, CABZ0 - 0.25, CABX1, CABZ0 - 0.25, 0),
          // the cage itself: glazed east/west/south sides, open to the north
          seg(CABX0, CABZ0, CABX0, CABZ1),
          seg(CABX1, CABZ0, CABX1, CABZ1),
          seg(CABX0, CABZ1, CABX1, CABZ1),
          // gallery deck at 4.3: perimeter walls…
          seg(-7.35, -5.35, 7.35, -5.35, G),
          seg(-7.35, -5.35, -7.35, 5.35, G),
          seg(-7.35, 5.35, -5.9, 5.35, G),
          seg(7.35, -5.35, 7.35, CABZ0, G),
          // …and the balustrade edges nobody should step over
          seg(-5.9, -3.9, 5.9, -3.9, G),
          seg(-5.9, -3.9, -5.9, 5.35, G),
          seg(5.9, -3.9, 5.9, ROCOCO_LIFT.deckCut, G),
          seg(5.9, ROCOCO_LIFT.deckCut, 5.9, CABZ0, G),  // sill's open west edge
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
    if (renderer.compileAsync) await renderer.compileAsync(scene, camera);
  } catch (e) {
    console.error('[travel] failed', e);
  } finally {
    ui.veil(false);
    travelling = false;
  }
}

// --- register every room --------------------------------------------------
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

// Collision.js seeds its active room at module load, so the gallery's real
// segments + the cabin ground override only go live once this runs.
rooms.start('gallery');

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
lift.panel.userData.lift = {
  label: 'call the lift',
  open: () => ui.openLift(
    lift.labels, -1,
    (i) => lift.ride(RESIDENCIES[i]),
    { speaker: 'Reception lift', title: 'Which residency?' }
  ),
};

// The courtyard's own lift serves that room's three floors, plus a starred
// button that rides the veil back to the reception hall (you step out of the
// reception cabin, right by the desk).
const cyLift = courtyardRoom.lift;
cyLift.panel.userData.lift = {
  open: () => ui.openLift(
    ['★ Reception Hall', ...cyLift.labels],
    cyLift.currentIndex() + 1,
    (i) => (i === 0 ? travelTo('gallery') : cyLift.selectFloor(i - 1))
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
  details.update(t);
  equalizer.update(t);
  fountain.update(t);
  courtyardRoom.update(t);   // foliage wind (cheap; harmless while hidden)
  // the rococo table's slow turn — only while you're in the room to see it
  if (rooms.current === 'rococo') residencyRooms.rococo?.plinth?.update(dt);
  residencyRooms[rooms.current]?.lights?.update(dt);   // candle / lamp flicker
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
window.__gallery = { player, camera, scene, renderer, controls, lighting, ui, interaction, curator, details, city, fountain, music, equalizer, audio, rooms, courtyardRoom, lift, residencyRooms, ensureRoom };
