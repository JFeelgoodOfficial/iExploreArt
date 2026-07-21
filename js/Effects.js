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
    0.22, 0.60, 0.92
  );
  // Run the bloom mip chain at half the composer resolution. It's a soft, wide
  // glow, so starting one mip level lower is imperceptible but roughly quarters
  // the pass cost. The radius bump above compensates for the slightly wider
  // blur kernel at the lower resolution. The composer drives setSize on add and
  // on every resize, so overriding it here covers both.
  const bloomSetSize = UnrealBloomPass.prototype.setSize;
  bloom.setSize = function (w, h) {
    bloomSetSize.call(this, Math.max(1, Math.round(w / 2)), Math.max(1, Math.round(h / 2)));
  };
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
    setPixelRatio: (r) => composer.setPixelRatio(r),
  };
}
