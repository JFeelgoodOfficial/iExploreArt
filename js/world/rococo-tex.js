import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Procedural rococo ornament. Everything is drawn on canvases and converted to
// a full PBR set (albedo / normal / roughness / metalness / ao) so gilt stucco
// catches raking light the way modelled plasterwork does, at texture cost.
// Deterministic: same seed -> same room.
// ---------------------------------------------------------------------------

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

function smooth(t) { return t * t * (3 - 2 * t); }
function lerp(a, b, t) { return a + (b - a) * t; }

// Tileable value-noise fbm, [0,1].
export function fbmField(w, h, seed, octaves = 4, baseFreq = 4) {
  const rand = mulberry32(seed);
  const out = new Float32Array(w * h);
  let amp = 1, freq = baseFreq, total = 0;
  for (let o = 0; o < octaves; o++) {
    const g = Math.max(2, Math.round(freq));
    const grid = new Float32Array((g + 1) * (g + 1));
    for (let i = 0; i < grid.length; i++) grid[i] = rand();
    for (let i = 0; i <= g; i++) { grid[i * (g + 1) + g] = grid[i * (g + 1)]; grid[g * (g + 1) + i] = grid[i]; }
    for (let y = 0; y < h; y++) {
      const gy = (y / h) * g, y0 = Math.floor(gy), fy = smooth(gy - y0);
      for (let x = 0; x < w; x++) {
        const gx = (x / w) * g, x0 = Math.floor(gx), fx = smooth(gx - x0);
        const i00 = grid[y0 * (g + 1) + x0], i10 = grid[y0 * (g + 1) + x0 + 1];
        const i01 = grid[(y0 + 1) * (g + 1) + x0], i11 = grid[(y0 + 1) * (g + 1) + x0 + 1];
        out[y * w + x] += lerp(lerp(i00, i10, fx), lerp(i01, i11, fx), fy) * amp;
      }
    }
    total += amp; amp *= 0.5; freq *= 2;
  }
  for (let i = 0; i < out.length; i++) out[i] /= total;
  return out;
}

export function tex(canvas, { srgb = false, repeat = null, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (repeat) t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = aniso;
  return t;
}

// Sobel height -> tangent-space normal map.
export function heightToNormal(hCanvas, strength = 2.2) {
  const w = hCanvas.width, h = hCanvas.height;
  const src = hCanvas.getContext('2d').getImageData(0, 0, w, h).data;
  const [c, ctx] = makeCanvas(w, h);
  const out = ctx.createImageData(w, h);
  const at = (x, y) => src[((y & (h - 1) || ((y % h) + h) % h) * w + (((x % w) + w) % w)) * 4] / 255;
  const H = (x, y) => src[((((y % h) + h) % h) * w + (((x % w) + w) % w)) * 4] / 255;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (H(x + 1, y - 1) + 2 * H(x + 1, y) + H(x + 1, y + 1)) - (H(x - 1, y - 1) + 2 * H(x - 1, y) + H(x - 1, y + 1));
      const dy = (H(x - 1, y + 1) + 2 * H(x, y + 1) + H(x + 1, y + 1)) - (H(x - 1, y - 1) + 2 * H(x, y - 1) + H(x + 1, y - 1));
      let nx = -dx * strength, ny = -dy * strength, nz = 1;
      const l = Math.hypot(nx, ny, nz);
      const i = (y * w + x) * 4;
      out.data[i] = ((nx / l) * 0.5 + 0.5) * 255;
      out.data[i + 1] = ((ny / l) * 0.5 + 0.5) * 255;
      out.data[i + 2] = ((nz / l) * 0.5 + 0.5) * 255;
      out.data[i + 3] = 255;
    }
  }
  ctx.putImageData(out, 0, 0);
  return c;
}

// ---------------------------------------------------------------------------
// Ornament primitives. Each draws into a height context (grey = relief) and a
// gilt-mask context (white = gilded). Coordinates are in canvas pixels.
// ---------------------------------------------------------------------------

export function Pen(hctx, gctx) {
  const api = {
    // stroke the same path on both layers, with a soft raised core
    stroke(path, width, { gild = true, height = 1, soft = true } = {}) {
      if (soft) {
        hctx.save();
        hctx.strokeStyle = `rgba(255,255,255,${0.35 * height})`;
        hctx.lineWidth = width * 2.1; hctx.lineCap = 'round'; hctx.lineJoin = 'round';
        hctx.filter = `blur(${Math.max(1, width * 0.6)}px)`;
        path(hctx); hctx.stroke();
        hctx.restore();
      }
      hctx.save();
      hctx.strokeStyle = `rgba(255,255,255,${Math.min(1, 0.85 * height)})`;
      hctx.lineWidth = width; hctx.lineCap = 'round'; hctx.lineJoin = 'round';
      path(hctx); hctx.stroke();
      hctx.restore();
      if (gild) {
        gctx.save();
        gctx.strokeStyle = '#fff';
        gctx.lineWidth = width * 1.25; gctx.lineCap = 'round'; gctx.lineJoin = 'round';
        path(gctx); gctx.stroke();
        gctx.restore();
      }
    },
    fill(path, { gild = true, height = 1 } = {}) {
      hctx.save();
      hctx.fillStyle = `rgba(255,255,255,${Math.min(1, 0.8 * height)})`;
      path(hctx); hctx.fill();
      hctx.restore();
      if (gild) { gctx.save(); gctx.fillStyle = '#fff'; path(gctx); gctx.fill(); gctx.restore(); }
    },
    // engraved line (recessed)
    incise(path, width) {
      hctx.save();
      hctx.strokeStyle = 'rgba(0,0,0,0.85)';
      hctx.lineWidth = width; hctx.lineCap = 'round';
      path(hctx); hctx.stroke();
      hctx.restore();
    },
  };
  return api;
}

// A rocaille C-scroll with a curling tail and a leaf barb.
export function cScroll(pen, x, y, s, rot = 0, flip = 1, lw = 1) {
  const T = (px, py) => {
    const c = Math.cos(rot), si = Math.sin(rot);
    return [x + (px * c - py * si) * s * flip, y + (px * si + py * c) * s];
  };
  const P = (pts) => (ctx) => {
    ctx.beginPath();
    const [sx, sy] = T(pts[0][0], pts[0][1]);
    ctx.moveTo(sx, sy);
    for (let i = 1; i < pts.length; i += 3) {
      const [c1x, c1y] = T(pts[i][0], pts[i][1]);
      const [c2x, c2y] = T(pts[i + 1][0], pts[i + 1][1]);
      const [ex, ey] = T(pts[i + 2][0], pts[i + 2][1]);
      ctx.bezierCurveTo(c1x, c1y, c2x, c2y, ex, ey);
    }
  };
  const w = 0.09 * s * lw;
  pen.stroke(P([[0, 0], [0.55, -0.02], [0.92, 0.28], [0.9, 0.66], [0.88, 0.98], [0.5, 1.16], [0.24, 0.98], [0.02, 0.82], [0.1, 0.52], [0.36, 0.56], [0.56, 0.6], [0.56, 0.86], [0.36, 0.88]]), w);
  pen.stroke(P([[0, 0], [-0.35, 0.02], [-0.62, 0.2], [-0.72, 0.5], [-0.8, 0.76], [-0.66, 1.02], [-0.42, 1.08]]), w * 0.8);
  // leaf barbs
  for (const t of [0.25, 0.55]) {
    pen.stroke(P([[-0.2 - t * 0.3, 0.28 + t * 0.5], [-0.05, 0.3 + t * 0.5], [0.12, 0.42 + t * 0.5], [0.06, 0.6 + t * 0.5]]), w * 0.6);
  }
}

export function shellCrest(pen, x, y, s, rot = 0) {
  const T = (px, py) => {
    const c = Math.cos(rot), si = Math.sin(rot);
    return [x + (px * c - py * si) * s, y + (px * si + py * c) * s];
  };
  const line = (pts) => (ctx) => {
    ctx.beginPath();
    const [sx, sy] = T(pts[0][0], pts[0][1]); ctx.moveTo(sx, sy);
    for (let i = 1; i < pts.length; i++) { const [px, py] = T(pts[i][0], pts[i][1]); ctx.lineTo(px, py); }
  };
  const w = 0.055 * s;
  // shell body
  pen.fill((ctx) => {
    ctx.beginPath();
    const [ax, ay] = T(0, -0.5);
    ctx.moveTo(ax, ay);
    const [c1x, c1y] = T(0.62, -0.42), [c2x, c2y] = T(0.68, 0.34), [ex, ey] = T(0, 0.5);
    ctx.bezierCurveTo(c1x, c1y, c2x, c2y, ex, ey);
    const [d1x, d1y] = T(-0.68, 0.34), [d2x, d2y] = T(-0.62, -0.42);
    ctx.bezierCurveTo(d1x, d1y, d2x, d2y, ax, ay);
  }, { height: 0.55 });
  // radiating flutes
  for (let i = -5; i <= 5; i++) {
    const a = (i / 5) * 0.9;
    pen.stroke(line([[Math.sin(a) * 0.08, -0.42], [Math.sin(a) * 0.6, 0.46]]), w * 0.8);
  }
  pen.stroke(line([[-0.62, 0.22], [0, 0.5], [0.62, 0.22]]), w);
  // side scrolls
  cScroll(pen, ...T(-0.55, 0.12), s * 0.42, -0.5, 1, 0.9);
  cScroll(pen, ...T(0.55, 0.12), s * 0.42, -0.5, -1, 0.9);
  // crowning sprig
  pen.stroke(line([[0, -0.5], [0, -0.86]]), w * 0.7);
  pen.stroke((ctx) => {
    ctx.beginPath();
    const [mx, my] = T(0, -0.86); ctx.moveTo(mx, my);
    const [q1x, q1y] = T(0.26, -0.98), [q2x, q2y] = T(0.34, -0.7);
    ctx.quadraticCurveTo(q1x, q1y, q2x, q2y);
    ctx.moveTo(mx, my);
    const [r1x, r1y] = T(-0.26, -0.98), [r2x, r2y] = T(-0.34, -0.7);
    ctx.quadraticCurveTo(r1x, r1y, r2x, r2y);
  }, w * 0.6);
}

export function acanthusSpray(pen, x, y, s, rot = 0, flip = 1) {
  const T = (px, py) => {
    const c = Math.cos(rot), si = Math.sin(rot);
    return [x + (px * c - py * si) * s * flip, y + (px * si + py * c) * s];
  };
  const w = 0.07 * s;
  const curve = (a, b, c1, c2) => (ctx) => {
    ctx.beginPath();
    const [sx, sy] = T(a[0], a[1]); ctx.moveTo(sx, sy);
    const [p1x, p1y] = T(c1[0], c1[1]); const [p2x, p2y] = T(c2[0], c2[1]); const [ex, ey] = T(b[0], b[1]);
    ctx.bezierCurveTo(p1x, p1y, p2x, p2y, ex, ey);
  };
  pen.stroke(curve([0, 0], [1.05, -0.55], [0.4, 0.1], [0.8, -0.1]), w);
  for (let i = 0; i < 5; i++) {
    const t = 0.12 + i * 0.2;
    const bx = t * 1.05, by = -t * t * 0.5;
    pen.stroke(curve([bx, by], [bx + 0.16, by - 0.34 - i * 0.02], [bx + 0.2, by - 0.06], [bx + 0.26, by - 0.2]), w * 0.62);
    pen.stroke(curve([bx, by], [bx + 0.1, by + 0.3], [bx + 0.22, by + 0.08], [bx + 0.2, by + 0.22]), w * 0.5);
  }
  pen.fill((ctx) => {
    ctx.beginPath();
    const [ex, ey] = T(1.05, -0.55); ctx.arc(ex, ey, 0.075 * s, 0, Math.PI * 2);
  }, { height: 0.7 });
}

export function ribbonBand(pen, x0, y, x1, amp, period, lw) {
  const path = (phase) => (ctx) => {
    ctx.beginPath();
    for (let x = x0; x <= x1; x += 3) {
      const yy = y + Math.sin((x / period) * Math.PI * 2 + phase) * amp;
      x === x0 ? ctx.moveTo(x, yy) : ctx.lineTo(x, yy);
    }
  };
  pen.stroke(path(0), lw);
  pen.stroke(path(Math.PI), lw);
  for (let x = x0; x <= x1; x += period / 2) {
    pen.fill((ctx) => { ctx.beginPath(); ctx.arc(x, y, lw * 0.75, 0, Math.PI * 2); }, { height: 0.8 });
  }
}

export function eggAndDart(pen, x0, y, x1, unit) {
  for (let x = x0; x + unit <= x1; x += unit) {
    pen.fill((ctx) => { ctx.beginPath(); ctx.ellipse(x + unit * 0.3, y, unit * 0.2, unit * 0.3, 0, 0, Math.PI * 2); }, { height: 0.85 });
    pen.stroke((ctx) => {
      ctx.beginPath(); ctx.ellipse(x + unit * 0.3, y, unit * 0.29, unit * 0.42, 0, 0, Math.PI * 2);
    }, unit * 0.07);
    pen.fill((ctx) => {
      ctx.beginPath();
      ctx.moveTo(x + unit * 0.78, y - unit * 0.34);
      ctx.lineTo(x + unit * 0.88, y);
      ctx.lineTo(x + unit * 0.78, y + unit * 0.34);
      ctx.lineTo(x + unit * 0.68, y);
      ctx.closePath();
    }, { height: 0.9 });
  }
}

export function trellis(pen, x0, y0, x1, y1, step) {
  const clip = (ctx) => { ctx.save(); ctx.beginPath(); ctx.rect(x0, y0, x1 - x0, y1 - y0); ctx.clip(); };
  const lines = (dir) => (ctx) => {
    clip(ctx);
    ctx.beginPath();
    for (let d = -(y1 - y0); d < (x1 - x0) + (y1 - y0); d += step) {
      ctx.moveTo(x0 + d, y0);
      ctx.lineTo(x0 + d + dir * (y1 - y0), y1);
    }
  };
  pen.stroke((ctx) => { lines(1)(ctx); }, 2.2, { height: 0.5 });
  pen.stroke((ctx) => { lines(-1)(ctx); }, 2.2, { height: 0.5 });
  pen.hctxRestore && pen.hctxRestore();
}

// ---------------------------------------------------------------------------
// Composites layers into a PBR material set.
//   ground: base plaster colour, gilt: leaf colour
// ---------------------------------------------------------------------------
export function bake(hCanvas, gCanvas, {
  ground = [242, 224, 212], gilt = [201, 158, 74], seed = 9,
  giltDark = [122, 86, 28], plasterRough = 0.92, giltRough = 0.3, normalStrength = 2.4,
} = {}) {
  const w = hCanvas.width, h = hCanvas.height;
  const H = hCanvas.getContext('2d').getImageData(0, 0, w, h).data;
  const G = gCanvas.getContext('2d').getImageData(0, 0, w, h).data;
  const grain = fbmField(Math.min(w, 512), Math.min(h, 512), seed, 5, 6);
  const gw = Math.min(w, 512), gh = Math.min(h, 512);

  const [cAlb, aCtx] = makeCanvas(w, h);
  const [cRough, rCtx] = makeCanvas(w, h);
  const [cMet, mCtx] = makeCanvas(w, h);
  const [cAO, oCtx] = makeCanvas(w, h);
  const alb = aCtx.createImageData(w, h);
  const rou = rCtx.createImageData(w, h);
  const met = mCtx.createImageData(w, h);
  const ao = oCtx.createImageData(w, h);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const hh = H[i] / 255;
      const gg = G[i] / 255;
      const n = grain[(((y / h) * gh) | 0) * gw + (((x / w) * gw) | 0)];
      // gilt burnishes on the high points, darkens in the recesses
      const burnish = 0.55 + hh * 0.75;
      const gr = lerp(giltDark[0], gilt[0], Math.min(1, burnish)) + (n - 0.5) * 18;
      const gg2 = lerp(giltDark[1], gilt[1], Math.min(1, burnish)) + (n - 0.5) * 16;
      const gb = lerp(giltDark[2], gilt[2], Math.min(1, burnish)) + (n - 0.5) * 12;
      const pr = ground[0] + (n - 0.5) * 16 - (1 - hh) * 6;
      const pg = ground[1] + (n - 0.5) * 15 - (1 - hh) * 6;
      const pb = ground[2] + (n - 0.5) * 14 - (1 - hh) * 6;
      alb.data[i] = lerp(pr, gr, gg);
      alb.data[i + 1] = lerp(pg, gg2, gg);
      alb.data[i + 2] = lerp(pb, gb, gg);
      alb.data[i + 3] = 255;
      const rv = lerp(plasterRough + (n - 0.5) * 0.06, giltRough + (1 - hh) * 0.26, gg) * 255;
      rou.data[i] = rou.data[i + 1] = rou.data[i + 2] = rv; rou.data[i + 3] = 255;
      const mv = gg * 255;
      met.data[i] = met.data[i + 1] = met.data[i + 2] = mv; met.data[i + 3] = 255;
      const av = (0.62 + hh * 0.38) * 255;
      ao.data[i] = ao.data[i + 1] = ao.data[i + 2] = av; ao.data[i + 3] = 255;
    }
  }
  aCtx.putImageData(alb, 0, 0);
  rCtx.putImageData(rou, 0, 0);
  mCtx.putImageData(met, 0, 0);
  oCtx.putImageData(ao, 0, 0);

  return {
    map: tex(cAlb, { srgb: true }),
    normalMap: tex(heightToNormal(hCanvas, normalStrength)),
    roughnessMap: tex(cRough),
    metalnessMap: tex(cMet),
    aoMap: tex(cAO),
    bumpCanvas: hCanvas,
  };
}

export function pbr(set, extra = {}) {
  return new THREE.MeshStandardMaterial({
    map: set.map, normalMap: set.normalMap, roughnessMap: set.roughnessMap,
    metalnessMap: set.metalnessMap, aoMap: set.aoMap,
    metalness: 1, roughness: 1, aoMapIntensity: 0.8,
    normalScale: new THREE.Vector2(1, 1), envMapIntensity: 1.25,
    ...extra,
  });
}
