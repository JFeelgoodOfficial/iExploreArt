import * as THREE from 'three';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { plasterTexture, concreteTexture, marbleTexture, fabricTexture } from './proctex.js';

// Central asset pipeline: one LoadingManager drives the progress bar; every
// network texture has a graceful failure mode (the flat-colour material
// simply stays), so a missed download can never blank the gallery.

export function createAssetPipeline(renderer, scene, materials, tier, ui) {
  const manager = new THREE.LoadingManager();
  manager.onProgress = (url, loaded, total) => ui.progress(loaded / total);
  manager.onError = (url) => console.warn('[assets] failed:', url);

  const done = new Promise((resolve) => { manager.onLoad = resolve; });

  const texLoader = new THREE.TextureLoader(manager);
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const aniso = Math.min(tier.anisotropy, maxAniso);

  const color = (url, repeat) => {
    const t = texLoader.load(url);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat, repeat);
    t.anisotropy = aniso;
    return t;
  };
  const data = (url, repeat) => {
    const t = texLoader.load(url);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat, repeat);
    t.anisotropy = aniso;
    return t;
  };

  // --- wood floor (UVs are in meters; plank set spans ~2.2m) ---------------
  const woodRepeat = 1 / 2.2;
  materials.wood.map = color('assets/textures/hardwood2_diffuse.jpg', woodRepeat);
  materials.wood.bumpMap = data('assets/textures/hardwood2_bump.jpg', woodRepeat);
  materials.wood.bumpScale = 4;
  materials.wood.roughnessMap = data('assets/textures/hardwood2_roughness.jpg', woodRepeat);
  materials.wood.roughness = 1;
  materials.wood.color.set(0xbfae9b);
  materials.wood.needsUpdate = true;

  // --- courtyard grass ------------------------------------------------------
  const grass = color('assets/textures/grass.jpg', 1 / 1.9);
  materials.grass = new THREE.MeshStandardMaterial({ map: grass, color: 0x99a58a, roughness: 1 });

  // --- procedural surfaces --------------------------------------------------
  const plaster = plasterTexture();
  applyRepeat(plaster, 1 / 2.6, aniso);
  materials.plaster.map = plaster.map;
  materials.plaster.bumpMap = plaster.bump;
  materials.plaster.bumpScale = 0.6;
  materials.plaster.needsUpdate = true;
  materials.plasterWarm.map = plaster.map;
  materials.plasterWarm.bumpMap = plaster.bump;
  materials.plasterWarm.bumpScale = 0.6;
  materials.plasterWarm.needsUpdate = true;

  const conc = concreteTexture();
  applyRepeat(conc, 1 / 2.0, aniso);
  materials.concrete.map = conc.map;
  materials.concrete.needsUpdate = true;

  const marb = marbleTexture();
  applyRepeat(marb, 1 / 1.4, aniso);
  materials.marble.map = marb.map;
  materials.marble.needsUpdate = true;

  const fab = fabricTexture();
  applyRepeat(fab, 1 / 0.8, aniso);
  materials.fabric.map = fab.map;
  materials.fabric.needsUpdate = true;

  // --- HDR environment (image-based lighting only; views are 3D scenes) ----
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  new RGBELoader(manager).load(
    'assets/env/urban_1k.hdr',
    (hdr) => {
      const env = pmrem.fromEquirectangular(hdr).texture;
      scene.environment = env;
      scene.environmentIntensity = 0.55;
      hdr.dispose();
      pmrem.dispose();
    },
    undefined,
    () => console.warn('[assets] HDR environment unavailable — using lights only')
  );

  return { manager, done };
}

function applyRepeat(set, repeat, aniso) {
  for (const t of Object.values(set)) {
    if (t && t.isTexture) {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(repeat, repeat);
      t.anisotropy = aniso;
    }
  }
}
