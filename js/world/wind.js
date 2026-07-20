import * as THREE from 'three';

// Shared wind clock. Injected into standard materials via onBeforeCompile so
// foliage keeps full PBR lighting while swaying in the vertex shader.

export const windUniform = { value: 0 };

export function tickWind(t) { windUniform.value = t; }

// strength: horizontal sway metres at full height; heightRange: [y0,y1] over
// which sway ramps from 0 to full (in world space for merged geometry, or
// local space when `local` is true — used by instanced cards).
export function applyWind(material, { strength = 0.06, y0 = 0.5, y1 = 6.0, local = false } = {}) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uWindTime = windUniform; // live shared {value} object
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        uniform float uWindTime;`)
      .replace('#include <project_vertex>', `
        {
          vec4 _wp = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
            _wp = instanceMatrix * _wp;
          #endif
          vec3 _wpos = (modelMatrix * _wp).xyz;
          float _h = smoothstep(${fmt(y0)}, ${fmt(y1)}, ${local ? 'position.y + 0.5' : '_wpos.y'});
          float _sway = sin(uWindTime * 1.3 + _wpos.x * 0.5 + _wpos.z * 0.7)
                      + 0.5 * sin(uWindTime * 2.9 + _wpos.z * 1.3 + _wpos.x * 0.4);
          transformed.x += _sway * _h * ${fmt(strength)};
          transformed.z += _sway * _h * ${fmt(strength * 0.6)};
        }
        #include <project_vertex>`);
  };
  // material must recompile if it was already compiled
  material.needsUpdate = true;
}

function fmt(n) { return Number(n).toFixed(4); }
