import * as THREE from 'three';

// ---------------------------------------------------------------------------
// LedEqualizer — a spectrum-analyser sculpture that stands where the corner
// plinth used to be. A grid of LED segments rises and falls with the gallery's
// background music: an InstancedMesh (COLS×ROWS boxes) painted each frame from a
// THREE.AudioAnalyser tapping the shared THREE.Audio. Segments read black when
// off and light up blue when active — columns map low→high frequency left→right,
// each lighting bottom-up with a bright blue tip and a falling peak marker.
// Before the (gesture-gated) music starts, a gentle sine wave keeps the bars
// alive.
//
//   import { buildLedEqualizer } from './world/led-equalizer.js';
//   const equalizer = buildLedEqualizer(scene, materials, { sound: music.sound });
//   // in the frame loop: equalizer.update(t);
//
// The grid material is unlit + toneMapped:false so the LEDs read full-bright on
// every tier, and cross the bloom threshold for free on bloom-capable devices.
// ---------------------------------------------------------------------------

// ---------- config ----------
const COLS = 24;          // equalizer columns
const ROWS = 16;          // segments per column
const SEG_W = 0.30;       // segment width
const SEG_H = 0.16;       // segment height
const SEG_D = 0.10;       // segment depth
const GAP_X = 0.10;       // horizontal gap between columns
const GAP_Y = 0.075;      // vertical gap between segments

const panelW = COLS * SEG_W + (COLS - 1) * GAP_X;
const panelH = ROWS * SEG_H + (ROWS - 1) * GAP_Y;

export function buildLedEqualizer(scene, mats, opts = {}) {
  const o = Object.assign({
    sound: null,                                   // THREE.Audio from buildMusic
    fftSize: 128,                                  // 64 bins, same as the sketch
    x: 18.6, z: 10.6,
    rotationY: Math.atan2(12 - 18.6, 7 - 10.6),    // face the room centre (~-2.07 rad)
    scale: 0.2,
  }, opts);

  const group = new THREE.Group();
  group.name = 'led-equalizer';

  // pedestal — a white plaster base so the black grid and blue LEDs pop
  const pedH = 3.0, pedW = panelW * 0.78, pedD = panelW * 0.5;
  const pedestal = new THREE.Mesh(new THREE.BoxGeometry(pedW, pedH, pedD), mats.plaster);
  pedestal.position.y = pedH / 2;
  pedestal.castShadow = true;
  pedestal.receiveShadow = true;
  group.add(pedestal);
  const pedTopY = pedH;

  // "SR" monogram on the room-facing (+Z) side of the base. The PNG is a black
  // shape on a transparent background, so alphaTest drops the background and only
  // the black shape shows over the white plaster.
  const logoMat = new THREE.MeshBasicMaterial({ transparent: true, alphaTest: 0.5, depthWrite: false });
  const logoW = pedW * 0.5, logoH = logoW * (393 / 726); // preserve the source aspect
  const logo = new THREE.Mesh(new THREE.PlaneGeometry(logoW, logoH), logoMat);
  logo.position.set(0, pedH / 2, pedD / 2 + 0.01);       // just proud of the front face
  logo.visible = false;                                  // reveal once decoded (no white flash)
  group.add(logo);
  new THREE.TextureLoader().load('assets/image/sr-logo.png', (t) => {
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    logoMat.map = t;
    logoMat.needsUpdate = true;
    logo.visible = true;
  });

  // blue glow spill on the pedestal top (world-space intensity/distance —
  // these don't scale with the group, so tune them for the final ~0.2 scale)
  const spill = new THREE.PointLight(0x40b8ff, 1.5, 3, 2);
  spill.position.set(0, pedTopY + 0.4, 0);
  group.add(spill);

  // ---------- LED grid ----------
  const geo = new THREE.BoxGeometry(SEG_W, SEG_H, SEG_D);
  // This three.js build zeroes vColor via `vColor *= color` before applying the
  // per-instance color, and BoxGeometry has no color attribute (so it defaults
  // to black). Give every vertex white so the color set by setColorAt() below
  // survives to the fragment instead of being multiplied to zero.
  const whites = new Float32Array(geo.attributes.position.count * 3).fill(1);
  geo.setAttribute('color', new THREE.BufferAttribute(whites, 3));
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
  const grid = new THREE.InstancedMesh(geo, mat, COLS * ROWS);
  grid.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  grid.castShadow = false;

  const dummy = new THREE.Object3D();
  const baseY = pedTopY + 0.12;                 // sit just above pedestal top
  const startX = -panelW / 2 + SEG_W / 2;
  let n = 0;
  const colOf = new Int16Array(COLS * ROWS);
  const rowOf = new Int16Array(COLS * ROWS);
  for (let c = 0; c < COLS; c++) {
    const x = startX + c * (SEG_W + GAP_X);
    for (let r = 0; r < ROWS; r++) {
      const y = baseY + SEG_H / 2 + r * (SEG_H + GAP_Y);
      dummy.position.set(x, y, 0);
      dummy.updateMatrix();
      grid.setMatrixAt(n, dummy.matrix);
      colOf[n] = c; rowOf[n] = r; n++;
    }
  }
  grid.instanceMatrix.needsUpdate = true;
  group.add(grid);

  // every lit segment is the same blue; off segments are black
  const BLUE = new THREE.Color().setHSL(0.60, 1.0, 0.5);
  const color = new THREE.Color();
  function paint(levels, peaks) {
    for (let i = 0; i < COLS * ROWS; i++) {
      const c = colOf[i], r = rowOf[i];
      const lit = levels[c] * (ROWS);
      const peak = peaks[c] * (ROWS - 1);
      let b;
      if (r < lit) {
        const tip = lit - r;
        b = tip < 1.3 ? 1.9 : 1.0;              // bright tip
      } else if (Math.abs(r - peak) < 0.7) {
        b = 1.7;                                 // falling peak marker
      } else {
        b = 0;                                   // resting = off (black)
      }
      color.copy(BLUE).multiplyScalar(b);
      grid.setColorAt(i, color);
    }
    grid.instanceColor.needsUpdate = true;
  }
  paint(new Float32Array(COLS), new Float32Array(COLS));

  // ---------- audio analysis ----------
  // AudioAnalyser taps the shared THREE.Audio's output; getFrequencyData()
  // returns a Uint8Array of `fftSize/2` bins (64 here) — the same shape the
  // original sketch's bin-mapping expects.
  let analyser = null;
  function setSound(sound) {
    if (!sound || analyser) return;
    analyser = new THREE.AudioAnalyser(sound, o.fftSize);
    analyser.analyser.smoothingTimeConstant = 0.75;
  }

  const levels = new Float32Array(COLS);
  const peaks = new Float32Array(COLS);
  function updateLevels(t) {
    const spec = (analyser && o.sound && o.sound.isPlaying)
      ? analyser.getFrequencyData()
      : null;
    for (let c = 0; c < COLS; c++) {
      let target;
      if (spec) {
        const f = Math.pow(c / (COLS - 1), 1.5);
        const idx = Math.min(spec.length - 1, Math.floor(1 + f * (spec.length * 0.8)));
        target = Math.pow(spec[idx] / 255, 0.8) * 1.2;
      } else {
        target = 0.22 + 0.18 * Math.sin(c * 0.5 + t * 2.0) + 0.08 * Math.sin(c * 1.3 - t * 3.1);
      }
      target = Math.max(0, Math.min(1, target));
      if (target > levels[c]) levels[c] = target;          // snap up
      else levels[c] += (target - levels[c]) * 0.14;       // ease down
      if (levels[c] >= peaks[c]) peaks[c] = levels[c];
      else peaks[c] = Math.max(levels[c], peaks[c] - 0.012);
    }
  }

  function update(t) {
    updateLevels(t);
    paint(levels, peaks);
    let energy = 0; for (let c = 0; c < COLS; c++) energy += levels[c];
    spill.intensity = 0.8 + (energy / COLS) * 4;
  }

  // place, orient, and scale the whole assembly into the gallery corner
  group.position.set(o.x, 0, o.z);
  group.rotation.y = o.rotationY;
  group.scale.setScalar(o.scale);
  scene.add(group);

  if (o.sound) setSound(o.sound);

  return { group, update, setSound };
}
