import * as THREE from 'three';

// ---------------------------------------------------------------------------
// WallFountain.js — a weathered-Corten wall fountain for the courtyard.
//
// A tall rusted-steel (Corten) monolith standing against the courtyard back
// wall — the wall you see behind the giant tree through the south glass. A
// recessed rectangular channel is carved into its warm, mottled face, and a
// wide curtain of fine rain-like streaks pours from the channel's top lip all
// the way down, scattering into a shallow splash pool on the stone at its
// base. A soft, spatial, looping water sound plays from the fountain once the
// visitor interacts with the page.
//
// Coordinate system (from js/world/layout.js): X east 0..24, Z south, Y up,
// meters. The courtyard back wall front face sits at z ≈ 23.675; the tree is
// at (x:12, z:19.2), so the fountain defaults to x:12, hard against that wall.
//
// ── Wiring it into the gallery (js/main.js) ────────────────────────────────
//   import { buildWallFountain } from './world/WallFountain.js';
//   ...
//   const fountain = buildWallFountain(scene, camera, materials, tier);
//   ...  // inside renderer.setAnimationLoop, alongside details.update(t):
//   fountain.update(t);
//
// `camera` is passed so the sound can be spatial (an AudioListener is attached
// to it if one isn't already there). Audio auto-starts on the first click /
// keypress / tap — the same gesture that enters the gallery — as browsers
// require. Nothing else is needed; everything below is self-contained.
//
// Options (all optional): buildWallFountain(scene, camera, mats, tier, {
//   x: 12,            // centre of the fountain along the wall
//   wallZ: 23.675,    // front face of the wall it mounts to
//   facing: -1,       // -1 = faces back toward the gallery (default), +1 = +Z
//   panelH: 3.4, panelW: 1.9, panelT: 0.3,
//   sound: true, volume: 0.85,
// });
// Note: the default x:12 sits behind the centre courtyard painting slot
// (C-S2). Move `x`, or drop that slot from data/artworks.js, if they clash.
// ---------------------------------------------------------------------------

export function buildWallFountain(scene, camera, mats = {}, tier = {}, opts = {}) {
  const o = Object.assign({
    x: 12, wallZ: 23.675, facing: -1,
    panelH: 3.4, panelW: 1.9, panelT: 0.3,
    sound: true, volume: 0.85,
  }, opts);

  const group = new THREE.Group();
  group.name = 'wallFountain';
  // Local space: +Y up, ground at y = 0, the wall behind at local z ≈ 0, and
  // "front" (toward the gallery) is local -Z. The block stands on the stone
  // and protrudes forward off the wall.
  group.position.set(o.x, 0, o.wallZ);
  if (o.facing > 0) group.rotation.y = Math.PI;

  const PW = o.panelW, PH = o.panelH, PT = o.panelT;
  const zBack = 0.06;               // block's rear face, just into the wall
  const zF = zBack - PT;            // block's front face (toward gallery)

  const env = makeWarmEnv();

  // ── the Corten monolith ───────────────────────────────────────────────────
  const rust = makeRustTexture();
  const rustRough = makeRustRoughTexture();
  const cortenMat = new THREE.MeshStandardMaterial({
    color: 0xb0693a, map: rust, roughnessMap: rustRough,
    metalness: 0.55, roughness: 0.62, envMap: env, envMapIntensity: 0.5,
  });
  const block = new THREE.Mesh(new THREE.BoxGeometry(PW, PH, PT), cortenMat);
  block.position.set(0, PH / 2, (zBack + zF) / 2);
  block.castShadow = true; block.receiveShadow = true;
  group.add(block);

  // ── the recessed channel ──────────────────────────────────────────────────
  const recW = PW * 0.54, recTop = PH - 0.52, recBot = 0.34;
  const recH = recTop - recBot, recCY = (recTop + recBot) / 2;
  const recDepth = 0.05;                 // how far the channel is set back
  const zRec = zF + recDepth;            // wet channel face (recessed)

  // wet, darker, glossier metal at the back of the channel, with vertical
  // water-staining streaks
  const wetTex = makeWetStreakTexture();
  const wetMat = new THREE.MeshStandardMaterial({
    color: 0x6e3b22, map: wetTex, metalness: 0.72, roughness: 0.3,
    envMap: env, envMapIntensity: 0.85,
  });
  const channel = new THREE.Mesh(new THREE.PlaneGeometry(recW, recH), wetMat);
  channel.position.set(0, recCY, zRec);
  channel.receiveShadow = true;
  group.add(channel);

  // reveal walls of the recess (thin boxes bridging face → channel) so the
  // cut reads with real depth and a shadow line
  const revealMat = new THREE.MeshStandardMaterial({
    color: 0x7a4326, map: rust, metalness: 0.6, roughness: 0.5,
    envMap: env, envMapIntensity: 0.45,
  });
  const rv = [
    new THREE.BoxGeometry(recW + 0.02, 0.02, recDepth).translate(0, recTop, zF + recDepth / 2),
    new THREE.BoxGeometry(recW + 0.02, 0.02, recDepth).translate(0, recBot, zF + recDepth / 2),
    new THREE.BoxGeometry(0.02, recH, recDepth).translate(-recW / 2, recCY, zF + recDepth / 2),
    new THREE.BoxGeometry(0.02, recH, recDepth).translate(recW / 2, recCY, zF + recDepth / 2),
  ];
  const reveal = new THREE.Mesh(mergeBoxes(rv), revealMat);
  group.add(reveal);

  // the top lip / weir the water spills over
  const lip = new THREE.Mesh(
    new THREE.BoxGeometry(recW + 0.04, 0.05, 0.06),
    new THREE.MeshStandardMaterial({ color: 0x8a4a28, metalness: 0.7, roughness: 0.35, envMap: env, envMapIntensity: 0.9 })
  );
  lip.position.set(0, recTop + 0.005, zF - 0.01);
  lip.castShadow = true;
  group.add(lip);

  // ── the water curtain (fine rain-like streaks over the channel) ───────────
  const curTop = recTop - 0.02, curBot = 0.02;
  const curH = curTop - curBot;
  const curtainMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 }, uH: { value: curH } },
    vertexShader: BASIC_UV_VERT,
    fragmentShader: NOISE_GLSL + CURTAIN_FRAG,
  });
  const curtain = new THREE.Mesh(new THREE.PlaneGeometry(recW - 0.03, curH), curtainMat);
  curtain.position.set(0, (curTop + curBot) / 2, zF - 0.025);
  group.add(curtain);

  // a faint wet sheen film hugging the channel just under the lip
  const film = new THREE.Mesh(
    new THREE.PlaneGeometry(recW - 0.04, recH * 0.9),
    new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      uniforms: { uTime: { value: 0 } },
      vertexShader: BASIC_UV_VERT,
      fragmentShader: NOISE_GLSL + FILM_FRAG,
    })
  );
  film.position.set(0, recCY, zRec + 0.008);
  group.add(film);

  // ── shallow splash pool on the stone at the base ──────────────────────────
  const poolY = 0.015, poolZ = zF - 0.28, poolW = recW + 0.7, poolD = 0.95;
  const poolMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uImpact: { value: new THREE.Vector2(0.5, 0.78) },
      uSky: { value: new THREE.Color(0xe0c39a) },   // warm sky tint
    },
    vertexShader: POOL_VERT,
    fragmentShader: NOISE_GLSL + POOL_FRAG,
  });
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(poolW, poolD), poolMat);
  pool.rotation.x = -Math.PI / 2;
  pool.position.set(0, poolY, poolZ);
  group.add(pool);

  const impactZ = zF - 0.06;

  // fine spray/mist where the curtain scatters at the bottom of the channel
  const spray = new THREE.Mesh(
    new THREE.PlaneGeometry(recW + 0.1, 0.7),
    new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      uniforms: { uTime: { value: 0 } },
      vertexShader: BASIC_UV_VERT,
      fragmentShader: NOISE_GLSL + SPRAY_FRAG,
      blending: THREE.AdditiveBlending,
    })
  );
  spray.position.set(0, 0.32, zF - 0.05);
  group.add(spray);

  // soft splash glow at the foot
  const splash = new THREE.Sprite(new THREE.SpriteMaterial({
    map: makeGlowTexture(), color: 0xfff0dc, transparent: true,
    opacity: 0.42, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  splash.scale.set(recW + 0.2, 0.34, 1);
  splash.position.set(0, 0.09, impactZ);
  group.add(splash);

  scene.add(group);

  // ── sound: a soft, spatial, looping water loop ────────────────────────────
  let sound = null;
  if (o.sound && camera) {
    try {
      let listener = camera.children.find((c) => c.isAudioListener);
      if (!listener) { listener = new THREE.AudioListener(); camera.add(listener); }
      const ctx = listener.context;
      sound = new THREE.PositionalAudio(listener);
      sound.setBuffer(makeWaterBuffer(ctx));
      sound.setLoop(true);
      sound.setRefDistance(2.6);
      sound.setRolloffFactor(1.3);
      sound.setVolume(o.volume);
      const emitter = new THREE.Object3D();
      group.updateWorldMatrix(true, false);
      emitter.position.copy(group.localToWorld(new THREE.Vector3(0, 0.3, impactZ)));
      scene.add(emitter);
      emitter.add(sound);

      const start = () => {
        if (ctx.state !== 'running') ctx.resume();
        if (sound && !sound.isPlaying) sound.play();
        remove();
      };
      const evs = ['pointerdown', 'keydown', 'touchend', 'click'];
      const remove = () => evs.forEach((e) => window.removeEventListener(e, start));
      evs.forEach((e) => window.addEventListener(e, start, { passive: true }));
    } catch (e) {
      console.warn('[WallFountain] audio unavailable:', e);
    }
  }

  // ── per-frame update — pass the elapsed clock time, like details.update(t) ─
  function update(t) {
    curtainMat.uniforms.uTime.value = t;
    poolMat.uniforms.uTime.value = t;
    film.material.uniforms.uTime.value = t;
    spray.material.uniforms.uTime.value = t;
    splash.material.opacity = 0.36 + 0.12 * Math.sin(t * 9.0) + 0.05 * Math.sin(t * 23.0);
    const s = 1.0 + 0.04 * Math.sin(t * 7.0);
    splash.scale.set((recW + 0.2) * s, 0.34 * s, 1);
  }

  function setVolume(v) { if (sound) sound.setVolume(v); }
  function dispose() {
    if (sound && sound.isPlaying) sound.stop();
    scene.remove(group);
  }

  return { group, update, setVolume, dispose, sound };
}

// ── geometry helper ───────────────────────────────────────────────────────

// Minimal BoxGeometry merge (avoids depending on BufferGeometryUtils here).
function mergeBoxes(geos) {
  let total = 0, idxTotal = 0;
  geos.forEach((g) => { total += g.attributes.position.count; idxTotal += g.index.count; });
  const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), uv = new Float32Array(total * 2);
  const idx = new Uint32Array(idxTotal);
  let vo = 0, io = 0;
  geos.forEach((g) => {
    const p = g.attributes.position.array, n = g.attributes.normal.array, u = g.attributes.uv.array, ix = g.index.array;
    pos.set(p, vo * 3); nor.set(n, vo * 3); uv.set(u, vo * 2);
    for (let i = 0; i < ix.length; i++) idx[io + i] = ix[i] + vo;
    vo += g.attributes.position.count; io += ix.length;
  });
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  return out;
}

// ── procedural textures ──────────────────────────────────────────────────────

// Weathered Corten steel: warm rust base with mottled orange/brown/umber
// blotches and faint vertical staining.
function makeRustTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#a9622f'; g.fillRect(0, 0, 512, 512);
  const tones = ['#8f4a24', '#b8743d', '#7c3f1f', '#c78a4e', '#6b3418', '#a05a2c', '#d29a5f'];
  for (let i = 0; i < 620; i++) {
    const x = Math.random() * 512, y = Math.random() * 512, r = 12 + Math.random() * 110;
    const col = tones[(Math.random() * tones.length) | 0];
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, col); grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.globalAlpha = 0.10 + Math.random() * 0.28;
    g.fillStyle = grd; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  }
  // faint vertical drip stains
  g.globalAlpha = 0.12;
  for (let i = 0; i < 90; i++) {
    const x = Math.random() * 512, w = 1 + Math.random() * 3, h = 40 + Math.random() * 260;
    g.fillStyle = Math.random() < 0.5 ? '#5f3016' : '#c98a52';
    g.fillRect(x, Math.random() * 300, w, h);
  }
  g.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.anisotropy = 4;
  return tex;
}

// Roughness companion: darker (rougher) where the rust is heaviest.
function makeRustRoughTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#9a9a9a'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 260; i++) {
    const x = Math.random() * 256, y = Math.random() * 256, r = 8 + Math.random() * 60;
    const v = 120 + Math.floor(Math.random() * 110);
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, `rgba(${v},${v},${v},0.4)`); grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

// Wet channel: dark, glossy, with strong vertical water streaks.
function makeWetStreakTexture() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#5a3018'; g.fillRect(0, 0, 256, 512);
  for (let i = 0; i < 200; i++) {
    const x = Math.random() * 256, w = 1 + Math.random() * 4;
    g.globalAlpha = 0.1 + Math.random() * 0.25;
    g.fillStyle = Math.random() < 0.5 ? '#3c1f10' : '#8a5030';
    g.fillRect(x, 0, w, 512);
  }
  g.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

// A small warm environment so the rusted steel and water carry warm reflections
// even though the gallery scene sets no scene.environment. px,nx,py,ny,pz,nz.
function makeWarmEnv() {
  const face = (top, mid, bot) => {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d');
    if (mid === null) { g.fillStyle = top; g.fillRect(0, 0, 64, 64); return c; }
    const grd = g.createLinearGradient(0, 0, 0, 64);
    grd.addColorStop(0, top); grd.addColorStop(0.5, mid); grd.addColorStop(1, bot);
    g.fillStyle = grd; g.fillRect(0, 0, 64, 64); return c;
  };
  const side = () => face('#f4e2c4', '#d9b487', '#6e5b45');
  const imgs = [side(), side(), face('#faedd6', null, null), face('#4a3d2e', null, null), side(), side()];
  const tex = new THREE.CubeTexture(imgs);
  tex.needsUpdate = true;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeGlowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,255,0.9)');
  grd.addColorStop(0.4, 'rgba(245,235,220,0.35)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

// ── audio: synthesize a soft, seamless water loop (no external file) ─────────
function makeWaterBuffer(ctx) {
  const dur = 6, sr = ctx.sampleRate, n = Math.floor(dur * sr);
  const buf = ctx.createBuffer(1, n, sr);
  const d = buf.getChannelData(0);
  // brown noise → gentle rushing body
  let last = 0;
  for (let i = 0; i < n; i++) {
    const w = Math.random() * 2 - 1;
    last = (last + 0.02 * w) / 1.02;
    d[i] = last * 3.2;
  }
  // one-pole low-pass to soften
  let lp = 0;
  for (let i = 0; i < n; i++) { lp += (d[i] - lp) * 0.22; d[i] = lp; }
  // slow amplitude wander → the "trickle" swell
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    d[i] *= 0.62 + 0.38 * (0.5 + 0.5 * Math.sin(t * 0.7 * 2 * Math.PI)) * (0.6 + 0.4 * Math.sin(t * 0.23 * 2 * Math.PI));
  }
  // faint high hiss → spray
  let prev = 0;
  for (let i = 0; i < n; i++) { const w = Math.random() * 2 - 1; d[i] += (w - prev) * 0.045; prev = w; }
  // soft random bubbles
  for (let b = 0; b < 26; b++) {
    const start = Math.floor(Math.random() * (n - sr * 0.2));
    const f = 300 + Math.random() * 700, len = Math.floor(sr * (0.03 + Math.random() * 0.06)), amp = 0.05 + Math.random() * 0.08;
    for (let i = 0; i < len; i++) {
      const e = Math.sin((i / len) * Math.PI);
      d[start + i] += Math.sin((i / sr) * f * 2 * Math.PI) * e * e * amp;
    }
  }
  // crossfade the tail into the head so the loop is seamless
  const cf = Math.floor(0.3 * sr);
  for (let i = 0; i < cf; i++) { const a = i / cf; d[i] = d[i] * a + d[n - cf + i] * (1 - a); }
  // normalize
  let max = 0; for (let i = 0; i < n; i++) max = Math.max(max, Math.abs(d[i]));
  const gain = 0.5 / (max || 1);
  for (let i = 0; i < n; i++) d[i] *= gain;
  return buf;
}

// ── shaders ──────────────────────────────────────────────────────────────────

const NOISE_GLSL = `
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  float a = hash(i), b = hash(i+vec2(1.,0.)), c = hash(i+vec2(0.,1.)), d = hash(i+vec2(1.,1.));
  vec2 u = f*f*(3.-2.*f);
  return mix(a,b,u.x) + (c-a)*u.y*(1.-u.x) + (d-b)*u.x*u.y;
}
`;

const BASIC_UV_VERT = `
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
`;

const POOL_VERT = `
varying vec2 vUv;
varying vec3 vWorld;
void main(){
  vUv = uv;
  vWorld = (modelMatrix * vec4(position,1.0)).xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
}
`;

// A wide curtain of many fine vertical streaks scrolling downward, feathering
// and scattering toward the bottom (vUv.y = 1 top, 0 bottom).
const CURTAIN_FRAG = `
varying vec2 vUv;
uniform float uTime;
uniform float uH;
void main(){
  float y = vUv.y;
  float fall = y - uTime*0.9;              // downward scroll
  // dense set of thin vertical lines, each with its own phase & speed
  float lines = 150.0;
  float col = vUv.x * lines;
  float id = floor(col);
  float within = fract(col);
  float ph = hash(vec2(id, 1.0));
  float spd = 0.7 + ph*0.8;
  float streak = vnoise(vec2(id*1.7, (y*2.4 - uTime*(1.8*spd)) )); // per-column brightness
  // thin bright core of each line, jittered horizontally more toward bottom
  float jitter = (hash(vec2(id, floor(fall*3.0))) - 0.5) * (0.5 + (1.0-y)*1.6);
  float core = smoothstep(0.5, 0.0, abs(within - 0.5 + jitter*0.15));
  // droplet breaks along each line, denser & gappier lower down
  float breakup = vnoise(vec2(id*3.1, y*(14.0+ (1.0-y)*26.0) - uTime*(6.0*spd)));
  breakup = smoothstep(0.35, 0.85, breakup);
  float density = mix(0.95, 0.55, 1.0-y);  // thins out as it falls
  float ln = core * breakup * density;
  float shimmer = 0.55 + 0.7*streak;
  // soft side feathering of the whole curtain
  float edge = smoothstep(0.0,0.05,vUv.x) * smoothstep(1.0,0.95,vUv.x);
  float topFade = smoothstep(0.0,0.03,1.0-y);
  float a = ln * shimmer * edge * topFade;
  a *= 0.9;
  vec3 colr = mix(vec3(0.80,0.86,0.9), vec3(1.0), clamp(streak,0.0,1.0));
  gl_FragColor = vec4(colr, a);
}
`;

const FILM_FRAG = `
varying vec2 vUv;
uniform float uTime;
void main(){
  float s = vnoise(vec2(vUv.x*40.0, vUv.y*3.0 - uTime*1.4));
  float edge = smoothstep(0.0,0.12,vUv.x) * smoothstep(1.0,0.88,vUv.x);
  float a = edge * (0.05 + 0.14*s) * smoothstep(0.0,0.12,vUv.y);
  gl_FragColor = vec4(mix(vec3(0.7,0.78,0.82), vec3(1.0), s), a);
}
`;

// Fine mist / scattered droplets where the curtain hits the base.
const SPRAY_FRAG = `
varying vec2 vUv;
uniform float uTime;
void main(){
  vec2 p = vec2(vUv.x*40.0, vUv.y*22.0 + uTime*3.0);
  float d = vnoise(p) * vnoise(p*2.3 + 5.0);
  d = smoothstep(0.45, 0.9, d);
  float rise = smoothstep(0.0,0.2,vUv.y) * smoothstep(1.0,0.35,vUv.y);
  float edge = smoothstep(0.0,0.12,vUv.x) * smoothstep(1.0,0.88,vUv.x);
  float a = d * rise * edge * (0.5 + 0.5*sin(uTime*11.0 + vUv.x*30.0));
  gl_FragColor = vec4(vec3(1.0,0.98,0.95), a*0.5);
}
`;

const POOL_FRAG = `
varying vec2 vUv;
varying vec3 vWorld;
uniform float uTime;
uniform vec2 uImpact;
uniform vec3 uSky;
void main(){
  float r = 0.0;
  r += sin(vUv.x*40.0 + uTime*1.9);
  r += sin(vUv.y*33.0 - uTime*1.5);
  r += 0.6 * sin((vUv.x+vUv.y)*60.0 + uTime*2.7);
  r += 0.5 * vnoise(vUv*24.0 + vec2(uTime*0.4, -uTime*0.3));
  float ripple = r * 0.13;
  // rings from the line of impact along the base of the panel
  float dd = abs(vUv.y - uImpact.y);
  ripple += sin(dd*80.0 - uTime*7.0) * exp(-dd*7.0) * 0.5;
  vec3 V = normalize(cameraPosition - vWorld);
  float fres = pow(1.0 - clamp(V.y, 0.0, 1.0), 3.0);
  vec3 deep = vec3(0.10,0.09,0.07);
  vec3 col = mix(deep, uSky, clamp(fres + ripple*0.35 + 0.12, 0.0, 1.0));
  col += vec3(1.0,0.95,0.88) * pow(max(ripple,0.0), 5.0) * 0.4;
  gl_FragColor = vec4(col, 0.9);
}
`;
