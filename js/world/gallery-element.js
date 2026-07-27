import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { buildRococoRoom, ROOM, LIFT } from './rococo.js';

const AMBIENCE = {
  'Morning daylight': { sun: 2.9, sunCol: 0xfff2dc, hemi: 0.5, hemiSky: 0xd8e6f2, candle: 0.5, exposure: 0.82, bloom: 0 },
  'Candlelit evening': { sun: 0.14, sunCol: 0x5f79a8, hemi: 0.14, hemiSky: 0x33425c, candle: 1.5, exposure: 1.0, bloom: 0.3 },
  'Overcast museum': { sun: 1.3, sunCol: 0xdfe7f0, hemi: 0.8, hemiSky: 0xe2eaf2, candle: 0.2, exposure: 0.8, bloom: 0 },
};

// walkable strips: ground floor is the whole room; the gallery is a U-shaped ring
const GROUND_Y = 1.66;
const GALLERY_Y = ROOM.galleryY + 1.62;
const PAD = 0.55;

function clampGround(p) {
  p.x = Math.min(ROOM.x1 - 0.7, Math.max(ROOM.x0 + 0.7, p.x));
  p.z = Math.min(ROOM.z1 - 0.7, Math.max(ROOM.z0 + 0.9, p.z));
}

// three strips of the gallery deck, in [xmin,xmax,zmin,zmax]
const STRIPS = [
  [ROOM.x0 + PAD, ROOM.x1 - PAD, ROOM.z0 + PAD, ROOM.z0 + ROOM.galleryDepth - 0.35],
  [ROOM.x0 + PAD, ROOM.x0 + ROOM.galleryDepth - 0.35, ROOM.z0 + PAD, ROOM.z1 - PAD],
  [ROOM.x1 - ROOM.galleryDepth + 0.35, ROOM.x1 - PAD, ROOM.z0 + PAD, LIFT.deckCut - 0.3],
  // the lift landing, reachable only by riding up
  [LIFT.x - LIFT.w / 2 + 0.2, LIFT.x + LIFT.w / 2 - 0.2, LIFT.deckCut - 0.3, LIFT.z + LIFT.d / 2 - 0.2],
];

function clampGallery(p, prev) {
  let best = null, bd = Infinity;
  for (const [xa, xb, za, zb] of STRIPS) {
    const x = Math.min(xb, Math.max(xa, p.x));
    const z = Math.min(zb, Math.max(za, p.z));
    const d = (x - p.x) ** 2 + (z - p.z) ** 2;
    if (d < bd) { bd = d; best = [x, z]; }
  }
  // don't let a clamp teleport across the void
  if (bd > 1.6 && prev) { p.x = prev.x; p.z = prev.z; return; }
  p.x = best[0]; p.z = best[1];
}

// heading convention: forward = (-sin yaw, 0, -cos yaw), so yaw 0 faces the window wall
const VIEWS = [
  { name: 'Hall, from the door', pos: [0, GROUND_Y, 4.6], yaw: 0, pitch: 0.03, level: 0 },
  { name: 'Right range', pos: [-3.4, GROUND_Y, 1.1], yaw: -Math.PI / 2 + 0.16, pitch: 0.04, level: 0 },
  { name: 'Left range', pos: [3.4, GROUND_Y, 1.1], yaw: Math.PI / 2 - 0.16, pitch: 0.04, level: 0 },
  { name: 'Window bay', pos: [0, GROUND_Y, -1.6], yaw: 0, pitch: 0.13, level: 0 },
  { name: 'Gallery, right range', pos: [6.6, GALLERY_Y, 1.8], yaw: Math.PI / 2 - 0.3, pitch: -0.1, level: 1 },
  { name: 'Gallery, over the hall', pos: [-2.4, GALLERY_Y, ROOM.z0 + 1.0], yaw: Math.PI * 0.86, pitch: -0.16, level: 1 },
];

class RococoHall extends HTMLElement {
  connectedCallback() {
    if (this._booted) return;
    this._booted = true;
    this.style.display = 'block';
    this.style.position = 'relative';
    this.style.width = '100%';
    this.style.height = '100%';
    this.style.overflow = 'hidden';
    this.style.background = '#0d0805';

    const veil = document.createElement('div');
    veil.setAttribute('style', 'position:absolute;inset:0;display:grid;place-items:center;z-index:4;background:#0d0805;color:#c9a24d;font:400 15px/1.5 "Cormorant Garamond",Georgia,serif;letter-spacing:.24em;text-transform:uppercase;transition:opacity .7s ease');
    veil.textContent = 'Gilding the room…';
    this.appendChild(veil);
    this._veil = veil;

    const canvas = document.createElement('canvas');
    canvas.setAttribute('style', 'position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none;cursor:grab');
    this.appendChild(canvas);
    this._canvas = canvas;

    // let the veil paint before the (synchronous, texture-heavy) build
    requestAnimationFrame(() => requestAnimationFrame(() => this._build()));
  }

  _build() {
    const canvas = this._canvas;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this._renderer = renderer;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0d0805);
    this._scene = scene;

    const camera = new THREE.PerspectiveCamera(58, 1, 0.05, 90);
    this._camera = camera;

    const room = buildRococoRoom(scene, { anisotropy: 8, shadowSize: 1024 });
    this._room = room;
    window.rococoRoom = room;

    scene.environment = this._makeEnv(renderer);

    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.2, 0.5, 0.96);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
    this._composer = composer;
    this._bloom = bloom;

    // ---- camera state ----
    this._level = 0;
    this._pos = new THREE.Vector3(...VIEWS[0].pos);
    this._yaw = VIEWS[0].yaw;
    this._pitch = VIEWS[0].pitch;
    this._keys = new Set();
    this._glide = null;

    this._bindInput();
    this._applyAmbience();
    this._resize();
    this._ro = new ResizeObserver(() => this._resize());
    this._ro.observe(this);

    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.needsUpdate = true;
    this._clock = new THREE.Clock();
    this._fpsN = 0; this._fpsT = 0; this._dpr = Math.min(devicePixelRatio, 1.5);
    renderer.setAnimationLoop(() => this._tick());

    this._veil.style.opacity = '0';
    setTimeout(() => this._veil.remove(), 800);
    this.dispatchEvent(new CustomEvent('ready', { bubbles: true }));
  }

  // a warm interior gradient as the specular environment
  _makeEnv(renderer) {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 128;
    const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, 128);
    g.addColorStop(0, '#f6ead8'); g.addColorStop(0.45, '#e8d3c0');
    g.addColorStop(0.6, '#c7a184'); g.addColorStop(1, '#4a3220');
    x.fillStyle = g; x.fillRect(0, 0, 256, 128);
    const glow = x.createRadialGradient(70, 46, 4, 70, 46, 90);
    glow.addColorStop(0, 'rgba(255,246,222,.95)'); glow.addColorStop(1, 'rgba(255,246,222,0)');
    x.fillStyle = glow; x.fillRect(0, 0, 256, 128);
    const t = new THREE.CanvasTexture(c);
    t.mapping = THREE.EquirectangularReflectionMapping;
    t.colorSpace = THREE.SRGBColorSpace;
    const pm = new THREE.PMREMGenerator(renderer);
    const env = pm.fromEquirectangular(t).texture;
    pm.dispose(); t.dispose();
    return env;
  }

  static get observedAttributes() { return ['ambience', 'bloom', 'tour', 'view']; }
  attributeChangedCallback(n, o, v) {
    if (!this._renderer) return;
    if (n === 'ambience' || n === 'bloom') this._applyAmbience();
    if (n === 'view' && v != null) this.goTo(Number(v));
  }

  _applyAmbience() {
    const P = AMBIENCE[this.getAttribute('ambience')] || AMBIENCE['Morning daylight'];
    const L = this._room.lights;
    this._renderer.toneMappingExposure = P.exposure;
    L.sun.intensity = P.sun; L.sun.color.setHex(P.sunCol);
    L.hemi.intensity = P.hemi; L.hemi.color.setHex(P.hemiSky);
    L.candleScale = P.candle;
    L.fill.intensity = 8 * (0.35 + P.candle * 0.6);
    const b = this.getAttribute('bloom');
    this._bloom.strength = P.bloom * (b == null ? 1 : Number(b) / 100 * 2);
    this._bloom.enabled = this._bloom.strength > 0.02;
    const daylight = this._scene.getObjectByName('daylight-backdrop');
    if (daylight) daylight.material.color.setHex(P.sun > 2 ? 0xeaf1f7 : P.sun > 1 ? 0xdfe6ee : 0x2b3a52);
  }

  _bindInput() {
    const cv = this._canvas;
    let drag = null, moved = 0;
    cv.addEventListener('pointerdown', (e) => {
      drag = { x: e.clientX, y: e.clientY };
      moved = 0;
      cv.setPointerCapture(e.pointerId);
      cv.style.cursor = 'grabbing';
      this._glide = null;
    });
    cv.addEventListener('pointermove', (e) => {
      if (!drag) return;
      moved += Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y);
      this._yaw -= (e.clientX - drag.x) * 0.0042;
      this._pitch = Math.max(-0.62, Math.min(0.62, this._pitch - (e.clientY - drag.y) * 0.003));
      drag = { x: e.clientX, y: e.clientY };
    });
    const end = (e) => {
      if (drag && moved < 6 && e) this._clickAt(e);
      drag = null; cv.style.cursor = 'grab';
    };
    cv.addEventListener('pointerup', end);
    cv.addEventListener('pointercancel', end);
    cv.addEventListener('wheel', (e) => {
      e.preventDefault();
      this._nudge(-Math.sign(e.deltaY) * 0.42);
    }, { passive: false });

    this._onKey = (e) => {
      const k = e.key.toLowerCase();
      if (k === ' ') { e.preventDefault(); this.toggleLevel(); return; }
      if (k === 'e') { this._room.elevator.call(); return; }
      if (k >= '1' && k <= '6') { this.goTo(Number(k) - 1); return; }
      this._keys.add(k);
    };
    this._onKeyUp = (e) => this._keys.delete(e.key.toLowerCase());
    window.addEventListener('keydown', this._onKey);
    window.addEventListener('keyup', this._onKeyUp);

    // ---- hang pictures by dropping image files ----
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const pick = (e) => {
      const r = cv.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, this._camera);
      const hits = ray.intersectObjects(this._room.slots.map(s => s.mesh), false);
      return hits.length ? this._room.slots.find(s => s.mesh === hits[0].object) : null;
    };
    const highlight = (slot) => {
      if (this._hi === slot) return;
      if (this._hi) this._hi.material.emissive?.setHex(0x000000);
      this._hi = slot;
      if (slot) { slot.material.emissive = new THREE.Color(0x6b4a18); slot.material.needsUpdate = true; }
    };
    this._pickSlot = pick;
    cv.addEventListener('dragover', (e) => { e.preventDefault(); highlight(pick(e)); });
    cv.addEventListener('dragleave', () => highlight(null));
    cv.addEventListener('drop', (e) => {
      e.preventDefault();
      const slot = pick(e) || this._hi;
      highlight(null);
      const file = [...(e.dataTransfer?.files || [])].find(f => f.type.startsWith('image/'));
      if (!file) return;
      const url = URL.createObjectURL(file);
      const target = slot || this._room.slots[0];
      target.setImage(url);
      try {
        const store = JSON.parse(localStorage.getItem('rococo-hang') || '{}');
        store[target.index] = null; // object URLs don't survive reload; keep the slot marked
        localStorage.setItem('rococo-hang', JSON.stringify(store));
      } catch (_) {}
    });
    cv.addEventListener('dblclick', (e) => {
      const slot = pick(e);
      if (!slot) return;
      const inp = document.createElement('input');
      inp.type = 'file'; inp.accept = 'image/*';
      inp.onchange = () => { if (inp.files[0]) slot.setImage(URL.createObjectURL(inp.files[0])); };
      inp.click();
    });
  }

  // a click on a brass button sends the lift to the other floor
  _clickAt(e) {
    const cv = this._canvas, r = cv.getBoundingClientRect();
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(
      ((e.clientX - r.left) / r.width) * 2 - 1,
      -((e.clientY - r.top) / r.height) * 2 + 1), this._camera);
    const lift = this._room.elevator;
    if (ray.intersectObjects(lift.buttons, false).length) lift.call();
  }

  _nudge(d) {
    const p = this._pos.clone();
    p.x -= Math.sin(this._yaw) * d;
    p.z -= Math.cos(this._yaw) * d;
    this._level ? clampGallery(p, this._pos) : clampGround(p);
    this._pos.copy(p);
  }

  goTo(i) {
    const v = VIEWS[i];
    if (!v) return;
    this._glide = { pos: new THREE.Vector3(...v.pos), yaw: v.yaw, pitch: v.pitch, level: v.level, t: 0 };
  }

  toggleLevel() {
    const up = this._level === 0;
    this.goTo(up ? 4 : 0);
  }

  get viewNames() { return VIEWS.map(v => v.name); }

  _resize() {
    const w = this.clientWidth || 960, h = this.clientHeight || 600;
    this._renderer.setSize(w, h, false);
    this._composer.setSize(w, h);
    this._camera.aspect = w / h;
    this._camera.updateProjectionMatrix();
  }

  _tick() {
    const dt = Math.min(0.05, this._clock.getDelta());
    const L = this._room.lights;
    L.update(dt);
    const cs = L.candleScale ?? 1;
    for (const l of L.candleLights) l.intensity *= cs;

    // riding the lift overrides walking and the level clamp
    const lift = this._room.elevator;
    const dy = lift.update(dt);
    if (dy) this._renderer.shadowMap.needsUpdate = true;
    const riding = lift.inside(this._pos);
    if (riding && dy) {
      this._pos.y += dy;
      this._glide = null;
      this._level = lift.y > lift.top - 0.05 ? 1 : 0;
      this._camera.position.copy(this._pos);
      this._camera.rotation.set(0, 0, 0);
      this._camera.rotateY(this._yaw);
      this._camera.rotateX(this._pitch);
      this._composer.render();
      return;
    }

    if (this._glide) {
      const g = this._glide;
      g.t = Math.min(1, g.t + dt / 1.5);
      const e = g.t < 0.5 ? 4 * g.t ** 3 : 1 - (-2 * g.t + 2) ** 3 / 2;
      this._pos.lerp(g.pos, 1 - Math.pow(0.001, dt * 1.6));
      this._yaw += (((g.yaw - this._yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * Math.min(1, dt * 2.4);
      this._pitch += (g.pitch - this._pitch) * Math.min(1, dt * 2.4);
      this._level = g.level;
      if (e >= 1 || this._pos.distanceTo(g.pos) < 0.02) this._glide = null;
    } else {
      const k = this._keys;
      const fwd = (k.has('w') || k.has('arrowup') ? 1 : 0) - (k.has('s') || k.has('arrowdown') ? 1 : 0);
      const str = (k.has('d') || k.has('arrowright') ? 1 : 0) - (k.has('a') || k.has('arrowleft') ? 1 : 0);
      if (fwd || str) {
        const sp = (k.has('shift') ? 4.4 : 2.1) * dt;
        const p = this._pos.clone();
        p.x -= Math.sin(this._yaw) * fwd * sp - Math.cos(this._yaw) * str * sp;
        p.z -= Math.cos(this._yaw) * fwd * sp + Math.sin(this._yaw) * str * sp;
        this._level ? clampGallery(p, this._pos) : clampGround(p);
        this._pos.copy(p);
      }
      const target = this._level ? GALLERY_Y : GROUND_Y;
      this._pos.y += (target - this._pos.y) * Math.min(1, dt * 3);
    }

    const c = this._camera;
    c.position.copy(this._pos);
    c.rotation.set(0, 0, 0);
    c.rotateY(this._yaw);
    c.rotateX(this._pitch);
    this._composer.render();
    this._adapt(dt);
  }

  // step the buffer down on slower GPUs rather than crawl
  _adapt(dt) {
    this._fpsN++; this._fpsT += dt;
    if (this._fpsT < 1.6) return;
    const fps = this._fpsN / this._fpsT;
    this._fpsN = 0; this._fpsT = 0;
    if (fps < 30 && this._dpr > 1) this._dpr = 1;
    else if (fps < 22 && this._dpr > 0.75) this._dpr = 0.75;
    else return;
    this._renderer.setPixelRatio(this._dpr);
    this._resize();
    this._renderer.shadowMap.needsUpdate = true;
  }

  disconnectedCallback() {
    this._renderer?.setAnimationLoop(null);
    this._ro?.disconnect();
    window.removeEventListener('keydown', this._onKey);
    window.removeEventListener('keyup', this._onKeyUp);
    this._room?.dispose?.();
    this._renderer?.dispose();
  }
}

customElements.define('rococo-hall', RococoHall);
