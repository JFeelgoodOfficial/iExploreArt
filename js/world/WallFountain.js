import * as THREE from 'three';

// ---------------------------------------------------------------------------
// WallFountain.js — a stainless-steel wall fountain for the courtyard.
//
// A tall brushed-steel blade mounted on the courtyard back wall (the wall you
// see behind the giant tree through the south glass). A slim spout at the top
// pours a shimmering sheet of water down the face into a low white trough,
// where it ripples and rings out from the point of impact. A soft, looping
// water sound plays from the fountain's position once the visitor interacts.
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
//   panelH: 2.6, panelW: 1.1,
//   sound: true, volume: 0.85,
// });
// Note: the default x:12 sits behind the centre courtyard painting slot
// (C-S2). Move `x`, or drop that slot from data/artworks.js, if they clash.
// ---------------------------------------------------------------------------

export function buildWallFountain(scene, camera, mats = {}, tier = {}, opts = {}) {
  const o = Object.assign({
    x: 12, wallZ: 23.675, facing: -1,
    panelH: 2.6, panelW: 1.1,
    sound: true, volume: 0.85,
  }, opts);

  const group = new THREE.Group();
  group.name = 'wallFountain';
  // Local space: +Y up, the wall is at local z = 0, "front" (toward the
  // gallery) is local -Z. We place the group at the wall and flip it if the
  // wall it mounts to faces +Z instead.
  group.position.set(o.x, 0, o.wallZ);
  if (o.facing > 0) group.rotation.y = Math.PI;

  const PANEL_W = o.panelW, PANEL_H = o.panelH, PANEL_T = 0.06;
  const baseY = 0.5;                       // trough rim height
  const panelCY = baseY + PANEL_H / 2 + 0.04;
  const panelTopY = baseY + 0.04 + PANEL_H;
  const front = -0.02;                     // panel face, just off the wall

  const env = makeStudioEnv();

  // ── brushed stainless-steel panel ─────────────────────────────────────────
  const brush = makeBrushedTexture();
  const steelMat = new THREE.MeshStandardMaterial({
    color: 0xc4c8cd, metalness: 0.92, roughness: 0.34,
    map: brush, roughnessMap: brush, envMap: env, envMapIntensity: 1.15,
  });
  const panel = new THREE.Mesh(new THREE.BoxGeometry(PANEL_W, PANEL_H, PANEL_T), steelMat);
  panel.position.set(0, panelCY, front + PANEL_T / 2);
  panel.castShadow = true; panel.receiveShadow = true;
  group.add(panel);

  // slim spout / weir at the top that the water pours from
  const spoutMat = new THREE.MeshStandardMaterial({
    color: 0xd6d9dd, metalness: 0.95, roughness: 0.28, envMap: env, envMapIntensity: 1.2,
  });
  const spoutW = 0.5, spoutDepth = 0.16;
  const spout = new THREE.Mesh(new THREE.BoxGeometry(spoutW, 0.07, spoutDepth), spoutMat);
  const spoutY = panelTopY - 0.14;
  spout.position.set(0, spoutY, front - spoutDepth / 2 + 0.02);
  spout.castShadow = true;
  group.add(spout);

  // ── white trough / basin at the base ──────────────────────────────────────
  // Everything that protrudes does so toward the viewer/gallery, which is
  // local -Z (the wall face is at local z = 0). The basin runs from just
  // inside the wall (bzWall) forward to bzFront.
  const BW = PANEL_W + 0.72, BD = 0.82, BH = baseY, WALLT = 0.09;
  const bzWall = 0.02, bzFront = 0.02 - BD, bzC = (bzWall + bzFront) / 2;
  const basinMat = mats.concrete
    ? mats.concrete.clone()
    : new THREE.MeshStandardMaterial({ color: 0xe9e7e1, roughness: 0.85 });
  basinMat.color = new THREE.Color(0xeceae4);
  const basinGeos = [
    new THREE.BoxGeometry(BW, BH, WALLT).translate(0, BH / 2, bzWall - WALLT / 2),  // rim by the wall
    new THREE.BoxGeometry(BW, BH, WALLT).translate(0, BH / 2, bzFront + WALLT / 2), // rim facing gallery
    new THREE.BoxGeometry(WALLT, BH, BD).translate(-BW / 2 + WALLT / 2, BH / 2, bzC),
    new THREE.BoxGeometry(WALLT, BH, BD).translate(BW / 2 - WALLT / 2, BH / 2, bzC),
    new THREE.BoxGeometry(BW, 0.08, BD).translate(0, 0.04, bzC),                    // floor
  ];
  const basin = new THREE.Mesh(mergeBoxes(basinGeos), basinMat);
  basin.castShadow = true; basin.receiveShadow = true;
  group.add(basin);

  const poolZ = bzC;                         // pool centre in Z
  const poolY = baseY - 0.08;
  const impactZ = bzWall - 0.13;             // stream lands close to the panel
  const innerNear = bzWall - WALLT, innerFar = bzFront + WALLT;
  const impactU = 0.5;
  const impactV = (impactZ - innerFar) / (innerNear - innerFar);

  // ── pool surface (ripples + impact rings + fresnel) ───────────────────────
  const poolMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uImpact: { value: new THREE.Vector2(impactU, THREE.MathUtils.clamp(impactV, 0.08, 0.92)) },
      uSky: { value: new THREE.Color(0xcfd8de) },
    },
    vertexShader: POOL_VERT,
    fragmentShader: NOISE_GLSL + POOL_FRAG,
  });
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(BW - 2 * WALLT, BD - 2 * WALLT), poolMat);
  pool.rotation.x = -Math.PI / 2;
  pool.position.set(0, poolY + 0.001, poolZ);
  group.add(pool);

  // ── the falling sheet of water (a feathered fan from spout to pool) ───────
  const streamTopY = spoutY - 0.02, streamBotY = poolY + 0.02;
  const streamH = streamTopY - streamBotY;
  const stream = new THREE.Mesh(
    makeFanGeometry(spoutW * 0.82, spoutW * 1.28, streamH),
    new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      uniforms: { uTime: { value: 0 } },
      vertexShader: BASIC_UV_VERT,
      fragmentShader: NOISE_GLSL + STREAM_FRAG,
    })
  );
  // top-anchored: geometry origin at its top edge (see makeFanGeometry)
  stream.position.set(0, streamTopY, -0.09);
  stream.rotation.x = -0.09;                 // lean the fan slightly toward the gallery
  group.add(stream);

  // faint wet film clinging to the steel just below the spout
  const film = new THREE.Mesh(
    new THREE.PlaneGeometry(spoutW * 0.96, PANEL_H * 0.5),
    new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      uniforms: { uTime: { value: 0 } },
      vertexShader: BASIC_UV_VERT,
      fragmentShader: NOISE_GLSL + FILM_FRAG,
    })
  );
  film.position.set(0, spoutY - PANEL_H * 0.25 - 0.04, -0.03);
  group.add(film);

  // soft splash / mist glow where the stream meets the pool
  const splash = new THREE.Sprite(new THREE.SpriteMaterial({
    map: makeGlowTexture(), color: 0xffffff, transparent: true,
    opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  splash.scale.set(0.55, 0.28, 1);
  splash.position.set(0, poolY + 0.05, impactZ);
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
      sound.setRefDistance(2.4);
      sound.setRolloffFactor(1.3);
      sound.setVolume(o.volume);
      const emitter = new THREE.Object3D();
      group.updateWorldMatrix(true, false);
      emitter.position.copy(group.localToWorld(new THREE.Vector3(0, poolY + 0.3, impactZ)));
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
    poolMat.uniforms.uTime.value = t;
    stream.material.uniforms.uTime.value = t;
    film.material.uniforms.uTime.value = t;
    splash.material.opacity = 0.42 + 0.14 * Math.sin(t * 9.0) + 0.06 * Math.sin(t * 23.0);
    const s = 0.55 + 0.05 * Math.sin(t * 7.0);
    splash.scale.set(s, s * 0.5, 1);
  }

  function setVolume(v) { if (sound) sound.setVolume(v); }
  function dispose() {
    if (sound && sound.isPlaying) sound.stop();
    scene.remove(group);
  }

  return { group, update, setVolume, dispose, sound };
}

// ── geometry helpers ────────────────────────────────────────────────────────

// A downward fan: narrow at the top, wider at the bottom, its top edge at the
// local origin so we can hang it from the spout. UV.y = 1 at top, 0 at bottom.
function makeFanGeometry(topW, botW, h) {
  const g = new THREE.BufferGeometry();
  const ht = topW / 2, hb = botW / 2;
  const pos = new Float32Array([
    -ht, 0, 0, ht, 0, 0, hb, -h, 0, -hb, -h, 0,
  ]);
  const uv = new Float32Array([0, 1, 1, 1, 1, 0, 0, 0]);
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex([0, 2, 1, 0, 3, 2]);
  g.computeVertexNormals();
  return g;
}

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

function makeBrushedTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 8;
  const g = c.getContext('2d');
  g.fillStyle = '#c8ccd1'; g.fillRect(0, 0, 256, 8);
  for (let x = 0; x < 256; x++) {
    const v = 200 + Math.floor(Math.random() * 55);
    g.fillStyle = `rgba(${v},${v + 4},${v + 8},${0.35 + Math.random() * 0.4})`;
    g.fillRect(x, 0, 1, 8);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 6); // grain runs vertically down the panel
  tex.anisotropy = 4;
  return tex;
}

// A tiny studio cube-environment so the stainless reads as bright metal even
// though the gallery scene sets no scene.environment. Order: px,nx,py,ny,pz,nz.
function makeStudioEnv() {
  const face = (top, mid, bot) => {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d');
    if (mid === null) { g.fillStyle = top; g.fillRect(0, 0, 64, 64); return c; }
    const grd = g.createLinearGradient(0, 0, 0, 64);
    grd.addColorStop(0, top); grd.addColorStop(0.5, mid); grd.addColorStop(1, bot);
    g.fillStyle = grd; g.fillRect(0, 0, 64, 64); return c;
  };
  const side = () => face('#eef2f6', '#c0c8cf', '#787f87');
  const imgs = [side(), side(), face('#f2f5f8', null, null), face('#454a51', null, null), side(), side()];
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
  grd.addColorStop(0.4, 'rgba(230,240,245,0.35)');
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

const STREAM_FRAG = `
varying vec2 vUv;
uniform float uTime;
void main(){
  // fast vertical streaks scrolling downward (vUv.y = 1 at top)
  float s  = vnoise(vec2(vUv.x*24.0, vUv.y*2.2 - uTime*2.6));
  s += 0.55 * vnoise(vec2(vUv.x*58.0, vUv.y*3.4 - uTime*4.1));
  float shimmer = 0.55 + 0.75 * s;
  float edge = smoothstep(0.0,0.16,vUv.x) * smoothstep(1.0,0.84,vUv.x);
  float topFade = smoothstep(0.0,0.05,1.0-vUv.y);     // emerge cleanly at spout
  float botFade = smoothstep(0.0,0.10,vUv.y);          // dissolve into the pool
  float a = edge * topFade * botFade * shimmer * 0.52;
  vec3 col = mix(vec3(0.82,0.89,0.93), vec3(1.0), clamp(s,0.0,1.0));
  gl_FragColor = vec4(col, a);
}
`;

const FILM_FRAG = `
varying vec2 vUv;
uniform float uTime;
void main(){
  float s = vnoise(vec2(vUv.x*30.0, vUv.y*3.0 - uTime*1.8));
  float edge = smoothstep(0.0,0.2,vUv.x) * smoothstep(1.0,0.8,vUv.x);
  float a = edge * (0.05 + 0.12*s) * smoothstep(0.0,0.15,vUv.y);
  gl_FragColor = vec4(mix(vec3(0.85,0.9,0.94), vec3(1.0), s), a);
}
`;

const POOL_FRAG = `
varying vec2 vUv;
varying vec3 vWorld;
uniform float uTime;
uniform vec2 uImpact;
uniform vec3 uSky;
void main(){
  // layered wavelets
  float r = 0.0;
  r += sin(vUv.x*38.0 + uTime*1.9);
  r += sin(vUv.y*31.0 - uTime*1.5);
  r += 0.6 * sin((vUv.x+vUv.y)*57.0 + uTime*2.7);
  r += 0.5 * vnoise(vUv*22.0 + vec2(uTime*0.4, -uTime*0.3));
  float ripple = r * 0.14;
  // concentric rings expanding from the stream's impact point
  float dd = distance(vUv, uImpact);
  ripple += sin(dd*70.0 - uTime*7.0) * exp(-dd*6.5) * 0.5;
  // grazing-angle fresnel toward the sky colour
  vec3 V = normalize(cameraPosition - vWorld);
  float fres = pow(1.0 - clamp(V.y, 0.0, 1.0), 3.0);
  vec3 deep = vec3(0.14,0.22,0.26);
  vec3 col = mix(deep, uSky, clamp(fres + ripple*0.35 + 0.12, 0.0, 1.0));
  col += vec3(1.0) * pow(max(ripple,0.0), 5.0) * 0.35;  // glints
  gl_FragColor = vec4(col, 0.92);
}
`;
