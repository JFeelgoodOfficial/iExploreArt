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

// Gallery → courtyard: west wall next to the curator, facing +X into the room.
const galleryDoorHit = doorHitbox(1.7, 2.2, 0.15, 1.2, 9.5, Math.PI / 2, 'door-to-courtyard');
scene.add(galleryDoorHit);
interaction.register([galleryDoorHit]);

// Snapshot everything currently in the scene as the gallery "layer", and the
// current interaction targets (artworks + curator + this door).
const galleryChildren = new Set(scene.children);
const galleryTargets = interaction.targets.slice();

// Build the courtyard room + its own lighting; whatever they add is its layer.
const courtyardRoom = buildCourtyardRoom(scene, materials, tier);
const crLights = setupCourtyardLighting(scene, renderer, tier);

// Courtyard → gallery: the south-wall ground door nearest the spawn, facing
// −Z toward the garden (the way the player came in).
const courtyardDoorHit = doorHitbox(1.6, 2.2, 0, 1.2, 8.8, Math.PI, 'door-to-gallery');
scene.add(courtyardDoorHit);

const courtyardLayer = scene.children.filter((o) => !galleryChildren.has(o));
for (const o of courtyardLayer) o.visible = false;

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

const rooms = createRoomManager({
  scene, player, interaction, lighting, crLights,
  galleryLayer: [...galleryChildren],
  courtyardLayer,
  galleryTargets,
  courtyardTargets: [courtyardDoorHit],
  gallerySpawn: { x: 1.8, z: 9.5, yaw: -Math.PI / 2 }, // just inside the west door, facing the hall
  courtyardSpawn: courtyardRoom.spawn,
  gallerySegments: buildGalleryColliders(),
  galleryGround,
  courtyardSegments: courtyardCollisionSegments(),
  courtyardGround: courtyardRoom.groundHeight,
  galleryBackground: scene.background,               // whatever CityView left it (null)
  courtyardBackground: new THREE.Color(0xbcd3e0),    // soft daylit sky through the glass roof
});

galleryDoorHit.userData.door = { label: 'enter the courtyard', onEnter: () => rooms.enterCourtyard() };
courtyardDoorHit.userData.door = { label: 'return to the gallery', onEnter: () => rooms.enterGallery() };

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
const clock = new THREE.Clock();
let frame = 0;
renderer.setAnimationLoop(() => {
  frame++;
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  // Spread GPU texture uploads across frames — mostly drained behind the
  // loading screen, so drawing a painting for the first time never hitches.
  drainUploads(renderer, 1);

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

  player.update(dt, controls.intent);
  interaction.enabled = !ui.activePanel;
  interaction.update(dt);
  tickWind(t);
  city.update(t);
  details.update(t);
  equalizer.update(t);
  fountain.update(t);
  courtyardRoom.update(t);   // foliage wind (cheap; harmless while hidden)
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
window.__gallery = { player, camera, scene, renderer, controls, lighting, ui, interaction, curator, details, city, fountain, music, equalizer, audio, rooms, courtyardRoom };
