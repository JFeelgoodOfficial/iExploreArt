import * as THREE from 'three';
import { detectTier, IS_TOUCH } from './config.js';
import { createMaterials } from './world/materials.js';
import { buildGallery } from './world/Gallery.js';
import { setupLighting } from './world/Lighting.js';
import { Player } from './Player.js';
import { DesktopControls } from './controls/DesktopControls.js';
import { createAssetPipeline } from './utils/assets.js';
import { buildArtworks } from './art/Artworks.js';
import { Interaction } from './Interaction.js';
import { UI } from './ui/UI.js';

const tier = detectTier();
if (IS_TOUCH) document.body.classList.add('touch');

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, tier.pixelRatio));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xcfd8de);

const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.08, 500);

const materials = createMaterials(tier);
const gallery = buildGallery(scene, materials);
const lighting = setupLighting(scene, renderer, tier);

const player = new Player(camera);
const controls = new DesktopControls(canvas, player);
const ui = new UI(controls);
const interaction = new Interaction(camera, ui);
controls.onInteract = () => interaction.activate();

// --- loading flow ---
const loadingEl = document.getElementById('loading');
const enterBtn = document.getElementById('enter-btn');
const progressBar = document.getElementById('progress-bar');
const bootUI = { progress: (f) => { progressBar.style.width = `${Math.round(f * 100)}%`; } };

const assets = createAssetPipeline(renderer, scene, materials, tier, bootUI);
const artworks = buildArtworks(scene, materials, assets.manager);
interaction.register(artworks.interactables);

let entered = false;
function readyToEnter() {
  progressBar.style.width = '100%';
  enterBtn.disabled = false;
  enterBtn.textContent = 'Enter the gallery';
  lighting.bake();
}
assets.done.then(readyToEnter);
setTimeout(readyToEnter, 12000); // never gate entry on a stuck download

enterBtn.addEventListener('click', () => {
  if (enterBtn.disabled) return;
  entered = true;
  loadingEl.classList.add('fade-out');
  ui.enter();
  controls.lock();
});

lighting.bake();

// --- frame loop ---
const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  player.update(dt, controls.intent);
  interaction.enabled = !ui.activePanel;
  interaction.update(dt);
  renderer.render(scene, camera);
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// debug/testing handle (harmless in production)
window.__gallery = { player, camera, scene, renderer, controls, lighting, ui, interaction };
