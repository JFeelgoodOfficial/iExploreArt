import * as THREE from 'three';

// Procedural canvas textures for surfaces we can't source as files:
// plaster, concrete, marble, bark, foliage, flowers, stone paving.
// Deterministic (seeded) so the gallery always looks the same.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Value-noise fbm sampled onto a grid; returns size*size Float32Array in [0,1].
function fbmField(size, seed, octaves = 4, baseFreq = 4) {
  const rand = mulberry32(seed);
  const out = new Float32Array(size * size);
  let amp = 1, freq = baseFreq, total = 0;
  for (let o = 0; o < octaves; o++) {
    const g = Math.max(2, Math.round(freq));
    const grid = new Float32Array((g + 1) * (g + 1));
    for (let i = 0; i < grid.length; i++) grid[i] = rand();
    // wrap edges for tileability
    for (let i = 0; i <= g; i++) { grid[i * (g + 1) + g] = grid[i * (g + 1)]; grid[g * (g + 1) + i] = grid[i]; }
    for (let y = 0; y < size; y++) {
      const gy = (y / size) * g, y0 = Math.floor(gy), fy = smooth(gy - y0);
      for (let x = 0; x < size; x++) {
        const gx = (x / size) * g, x0 = Math.floor(gx), fx = smooth(gx - x0);
        const i00 = grid[y0 * (g + 1) + x0], i10 = grid[y0 * (g + 1) + x0 + 1];
        const i01 = grid[(y0 + 1) * (g + 1) + x0], i11 = grid[(y0 + 1) * (g + 1) + x0 + 1];
        const v = lerp(lerp(i00, i10, fx), lerp(i01, i11, fx), fy);
        out[y * size + x] += v * amp;
      }
    }
    total += amp; amp *= 0.5; freq *= 2;
  }
  for (let i = 0; i < out.length; i++) out[i] /= total;
  return out;
}

function smooth(t) { return t * t * (3 - 2 * t); }
function lerp(a, b, t) { return a + (b - a) * t; }

function makeCanvas(size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return [c, c.getContext('2d')];
}

function toTexture(canvas, { srgb = true, repeat = 1 } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  return t;
}

// ---------------------------------------------------------------------------
export function plasterTexture(size = 512) {
  const [c, ctx] = makeCanvas(size);
  const f = fbmField(size, 101, 5, 5);
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    const n = f[i];
    const v = 238 + (n - 0.5) * 14;
    img.data[i * 4] = v + 3;         // slightly warm
    img.data[i * 4 + 1] = v;
    img.data[i * 4 + 2] = v - 6;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const map = toTexture(c);

  // bump from the same field for subtle tooth
  const [cb, ctxb] = makeCanvas(size);
  const imgb = ctxb.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    const v = 128 + (f[i] - 0.5) * 90;
    imgb.data[i * 4] = imgb.data[i * 4 + 1] = imgb.data[i * 4 + 2] = v;
    imgb.data[i * 4 + 3] = 255;
  }
  ctxb.putImageData(imgb, 0, 0);
  const bump = toTexture(cb, { srgb: false });
  return { map, bump };
}

export function concreteTexture(size = 512) {
  const [c, ctx] = makeCanvas(size);
  const f = fbmField(size, 202, 5, 6);
  const speck = fbmField(size, 203, 2, 48);
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    let v = 176 + (f[i] - 0.5) * 34 + (speck[i] - 0.5) * 16;
    img.data[i * 4] = v;
    img.data[i * 4 + 1] = v - 2;
    img.data[i * 4 + 2] = v - 7;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return { map: toTexture(c) };
}

export function marbleTexture(size = 512) {
  const [c, ctx] = makeCanvas(size);
  const f = fbmField(size, 303, 5, 4);
  const warp = fbmField(size, 304, 4, 3);
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const vein = Math.abs(Math.sin((x / size + warp[i] * 2.2) * Math.PI * 3 + f[i] * 6));
      const streak = Math.pow(1 - vein, 14);
      let v = 32 + f[i] * 14 + streak * 150;
      img.data[i * 4] = v;
      img.data[i * 4 + 1] = v + 2;
      img.data[i * 4 + 2] = v + 6;
      img.data[i * 4 + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return { map: toTexture(c) };
}

export function barkTexture(size = 256) {
  const [c, ctx] = makeCanvas(size);
  const f = fbmField(size, 404, 5, 6);
  const ridge = fbmField(size, 405, 3, 14);
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      // vertical ridges: high-freq in x, low in y
      const r = ridge[(y >> 2) * size + x];
      let v = 58 + f[i] * 42 + Math.sin(x * 0.55 + r * 9) * 12;
      img.data[i * 4] = v + 12;
      img.data[i * 4 + 1] = v - 2;
      img.data[i * 4 + 2] = v - 16;
      img.data[i * 4 + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const map = toTexture(c);
  map.repeat.set(2, 1);
  return { map };
}

export function stoneTexture(size = 512) {
  const [c, ctx] = makeCanvas(size);
  const f = fbmField(size, 505, 4, 5);
  const img = ctx.createImageData(size, size);
  const cells = 4; // paving grid
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const gx = (x / size) * cells % 1, gy = (y / size) * cells % 1;
      const edge = Math.min(gx, 1 - gx, gy, 1 - gy);
      const groove = edge < 0.035 ? 0.55 : 1;
      let v = (150 + (f[i] - 0.5) * 40) * groove;
      img.data[i * 4] = v + 4;
      img.data[i * 4 + 1] = v;
      img.data[i * 4 + 2] = v - 6;
      img.data[i * 4 + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return { map: toTexture(c) };
}

export function fabricTexture(size = 256, base = [54, 98, 106]) {
  const [c, ctx] = makeCanvas(size);
  const f = fbmField(size, 606, 3, 8);
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const weave = ((x % 4 < 2) !== (y % 4 < 2)) ? 6 : -6;
      img.data[i * 4] = base[0] + weave + (f[i] - 0.5) * 22;
      img.data[i * 4 + 1] = base[1] + weave + (f[i] - 0.5) * 22;
      img.data[i * 4 + 2] = base[2] + weave + (f[i] - 0.5) * 22;
      img.data[i * 4 + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return { map: toTexture(c) };
}

// Foliage cluster card with alpha — painterly leaf mass.
export function leafClusterTexture(size = 256, seed = 7, hueShift = 0) {
  const [c, ctx] = makeCanvas(size);
  const rand = mulberry32(seed);
  ctx.clearRect(0, 0, size, size);
  const leaves = 240;
  for (let i = 0; i < leaves; i++) {
    // cluster density toward center
    const a = rand() * Math.PI * 2;
    const r = Math.pow(rand(), 0.6) * size * 0.42;
    const x = size / 2 + Math.cos(a) * r;
    const y = size / 2 + Math.sin(a) * r * 0.9;
    const s = 5 + rand() * 11;
    const h = 88 + hueShift + (rand() - 0.5) * 34;
    const l = 24 + rand() * 26;
    ctx.fillStyle = `hsla(${h}, ${38 + rand() * 26}%, ${l}%, ${0.85})`;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rand() * Math.PI * 2);
    ctx.beginPath();
    ctx.ellipse(0, 0, s, s * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// A small flowering plant: stems + blossoms, drawn for a crossed-quad card.
export function flowerCardTexture(size = 256, seed = 21, petalHue = 18) {
  const [c, ctx] = makeCanvas(size);
  const rand = mulberry32(seed);
  ctx.clearRect(0, 0, size, size);
  const stems = 7;
  for (let s = 0; s < stems; s++) {
    const baseX = size * (0.3 + rand() * 0.4);
    const topX = baseX + (rand() - 0.5) * size * 0.3;
    const topY = size * (0.12 + rand() * 0.3);
    ctx.strokeStyle = `hsl(${95 + rand() * 25}, 38%, ${26 + rand() * 12}%)`;
    ctx.lineWidth = 2 + rand() * 1.5;
    ctx.beginPath();
    ctx.moveTo(baseX, size);
    ctx.quadraticCurveTo(baseX + (rand() - 0.5) * 30, size * 0.6, topX, topY);
    ctx.stroke();
    // leaves on stem
    for (let l = 0; l < 3; l++) {
      const t = 0.35 + rand() * 0.5;
      const lx = baseX + (topX - baseX) * t;
      const ly = size - (size - topY) * t;
      ctx.fillStyle = `hsla(${100 + rand() * 20}, 40%, ${30 + rand() * 10}%, 0.9)`;
      ctx.save(); ctx.translate(lx, ly); ctx.rotate((rand() - 0.5) * 2);
      ctx.beginPath(); ctx.ellipse(0, 0, 9 + rand() * 6, 3.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    // blossom
    const petals = 5 + Math.floor(rand() * 3);
    const pr = 9 + rand() * 8;
    const hue = petalHue + (rand() - 0.5) * 24;
    for (let p = 0; p < petals; p++) {
      const pa = (p / petals) * Math.PI * 2 + rand() * 0.3;
      ctx.fillStyle = `hsla(${hue}, ${58 + rand() * 22}%, ${58 + rand() * 16}%, 0.95)`;
      ctx.save();
      ctx.translate(topX + Math.cos(pa) * pr * 0.6, topY + Math.sin(pa) * pr * 0.6);
      ctx.rotate(pa);
      ctx.beginPath(); ctx.ellipse(0, 0, pr * 0.62, pr * 0.34, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = `hsl(${45 + rand() * 12}, 80%, 55%)`;
    ctx.beginPath(); ctx.arc(topX, topY, pr * 0.28, 0, Math.PI * 2); ctx.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
