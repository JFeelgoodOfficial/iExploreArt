import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { VignetteShader } from 'three/addons/shaders/VignetteShader.js';

// Post chain: render → gentle bloom (sky/sun through glass) → vignette → out.

export function createEffects(renderer, scene, camera, tier) {
  if (!tier.bloom) return null;

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  const bloom = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.22, 0.55, 0.92
  );
  composer.addPass(bloom);

  if (tier.vignette) {
    const vignette = new ShaderPass(VignetteShader);
    vignette.uniforms.offset.value = 0.92;
    vignette.uniforms.darkness.value = 1.12;
    composer.addPass(vignette);
  }

  composer.addPass(new OutputPass());

  return {
    render: () => composer.render(),
    resize: (w, h) => composer.setSize(w, h),
  };
}
