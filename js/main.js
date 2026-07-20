import * as THREE from 'three';
import { detectTier, IS_TOUCH, BRAND } from './config.js';
import { createMaterials } from './world/materials.js';
import { buildGallery } from './world/Gallery.js';
import { setupLighting } from './world/Lighting.js';
import { Player } from './Player.js';
import { DesktopControls } from './controls/DesktopControls.js';

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

// --- temporary boot flow (UI module lands in a later phase) ---
const loadingEl = document.getElementById('loading');
const enterBtn = document.getElementById('enter-btn');
enterBtn.disabled = false;
enterBtn.textContent = 'Enter the gallery';
enterBtn.addEventListener('click', () => {
  loadingEl.classList.add('fade-out');
  document.getElementById('hud').hidden = false;
  controls.lock();
});

lighting.bake();

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  player.update(dt, controls.intent);
  renderer.render(scene, camera);
});

// debug/testing handle (harmless in production)
window.__gallery = { player, camera, scene, renderer, controls, lighting };

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
