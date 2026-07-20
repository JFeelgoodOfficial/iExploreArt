import * as THREE from 'three';
import { ROOM, SKYLIGHT, MEZZ_RECTS } from './layout.js';

// Physically-plausible interior rig. The scene is static, so shadow maps
// render once (autoUpdate=false) and are only re-baked on demand.

export function setupLighting(scene, renderer, tier) {
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;

  // Soft ambient base until/alongside the HDR environment.
  const hemi = new THREE.HemisphereLight(0xdfe8ee, 0x8a7a66, 0.5);
  scene.add(hemi);

  // Afternoon sun from the south-west, raking through the courtyard glass
  // and skylight; the courtyard tree breaks it into dappled light.
  // steep enough that light clears the courtyard's tall walls
  const sun = new THREE.DirectionalLight(0xfff0dd, 3.2);
  sun.position.set(-8, 30, 26);
  sun.target.position.set(13, 0, 5);
  sun.castShadow = true;
  sun.shadow.mapSize.setScalar(tier.shadowSize);
  sun.shadow.camera.left = -26;
  sun.shadow.camera.right = 26;
  sun.shadow.camera.top = 26;
  sun.shadow.camera.bottom = -22;
  sun.shadow.camera.near = 4;
  sun.shadow.camera.far = 90;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);

  // Gallery downlights: warm pools along the art walls.
  const spots = [];
  const addSpot = (x, y, z, tx, ty, tz, intensity = 60, angle = 0.7, shadow = false) => {
    const s = new THREE.SpotLight(0xfff4e2, intensity, 0, angle, 0.45, 1.6);
    s.position.set(x, y, z);
    s.target.position.set(tx, ty, tz);
    if (shadow) {
      s.castShadow = true;
      s.shadow.mapSize.setScalar(1024);
      s.shadow.bias = -0.0003;
    }
    scene.add(s, s.target);
    spots.push(s);
    return s;
  };

  // under-mezzanine ceilings (west + east wings)
  addSpot(3.5, 3.7, 4.0, 1.0, 1.2, 4.0, 50, 0.75, true);   // west art wall
  addSpot(3.5, 3.7, 11.5, 2.2, 0.8, 12.2, 40, 0.8);        // reception
  addSpot(20.5, 3.7, 11.0, 23.4, 1.3, 11.5, 50, 0.75);     // east art wall
  // atrium height, washing the freestanding wall + centre floor
  addSpot(12, 7.2, 4.6, 12, 1.2, 6.8, 90, 0.55);
  addSpot(12, 7.2, 9.4, 12, 1.2, 7.4, 90, 0.55);
  // mezzanine bridge / upper walls
  addSpot(12, 7.25, 12.6, 12, 5.4, 13.9, 70, 0.6);
  // courtyard display wall — three warm washes over the outdoor works
  addSpot(6.5, 6.8, 20.8, 6.5, 2.2, 23.7, 55, 0.5);
  addSpot(12, 6.8, 20.8, 12, 2.2, 23.7, 55, 0.5);
  addSpot(17.5, 6.8, 20.8, 17.5, 2.2, 23.7, 55, 0.5);

  const bake = () => { renderer.shadowMap.needsUpdate = true; };
  return { hemi, sun, spots, bake };
}
