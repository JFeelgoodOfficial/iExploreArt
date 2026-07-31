import * as THREE from 'three';
import { makeCanvas, fbmField, tex, heightToNormal, bake, pbr, Pen, mulberry32 } from './rococo-tex.js';

// ---------------------------------------------------------------------------
// Art nouveau surfaces, after Horta's Brussels interiors: leaded glass cut into
// irregular cames, figured mahogany, green mosaic paving, polished brass and
// sgraffito friezes. Everything is drawn on canvases and baked to a PBR set so
// lead, grout and inlay catch raking light.
// ---------------------------------------------------------------------------

const BRASS = [204, 158, 78];
const BRASS_DK = [92, 62, 20];
const MAHOG = [64, 27, 19];

function layers(w, h) {
  const [hc, hctx] = makeCanvas(w, h);
  const [gc, gctx] = makeCanvas(w, h);
  hctx.fillStyle = '#000'; hctx.fillRect(0, 0, w, h);
  gctx.fillStyle = '#000'; gctx.fillRect(0, 0, w, h);
  return { hc, hctx, gc, gctx, pen: Pen(hctx, gctx) };
}

const cl = (v) => Math.max(0, Math.min(255, v | 0));

// --- flat-colour drawing helpers -------------------------------------------
function poly(ctx, pts, fill) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath(); ctx.fill();
}
function ribbon(ctx, pts, w0, w1, fill) {
  // a tapering sinuous band through a polyline
  ctx.fillStyle = fill;
  ctx.beginPath();
  const n = pts.length;
  const norm = (i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const l = Math.hypot(dx, dy) || 1;
    return [-dy / l, dx / l];
  };
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1), w = (w0 + (w1 - w0) * t) / 2;
    const [nx, ny] = norm(i);
    const x = pts[i][0] + nx * w, y = pts[i][1] + ny * w;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  for (let i = n - 1; i >= 0; i--) {
    const t = i / (n - 1), w = (w0 + (w1 - w0) * t) / 2;
    const [nx, ny] = norm(i);
    ctx.lineTo(pts[i][0] - nx * w, pts[i][1] - ny * w);
  }
  ctx.closePath(); ctx.fill();
}
function whiplash(x0, y0, x1, y1, bow, steps = 26) {
  // a single-curvature S, the signature line of the style
  const pts = [];
  const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
  const dx = x1 - x0, dy = y1 - y0;
  const c1 = [x0 + dx * 0.1 - dy * bow, y0 + dy * 0.1 + dx * bow];
  const c2 = [mx + dy * bow * 0.6, my - dx * bow * 0.6];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, u = 1 - t;
    pts.push([
      u * u * u * x0 + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * x1,
      u * u * u * y0 + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * y1,
    ]);
  }
  return pts;
}
function petal(ctx, cx, cy, r, rot, fill, squash = 0.62) {
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot);
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(r * 0.7, -r * squash, r * 1.05, -r * 0.35, r, r * 0.06);
  ctx.bezierCurveTo(r * 1.02, r * 0.42, r * 0.6, r * squash, 0, 0);
  ctx.closePath(); ctx.fill();
  ctx.restore();
}

// --- glass motifs (flat colour cartoons, later cut into cames) -------------
const MOTIF = {
  iris(ctx, W, H, rnd) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#e9d9a4'); g.addColorStop(0.5, '#dfcd93'); g.addColorStop(1, '#cdba7d');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // pale amber quarry ground with a faint halo behind the flowers
    const halo = ctx.createRadialGradient(W * 0.5, H * 0.42, 4, W * 0.5, H * 0.42, W * 0.62);
    halo.addColorStop(0, 'rgba(252,240,196,0.8)'); halo.addColorStop(1, 'rgba(252,240,196,0)');
    ctx.fillStyle = halo; ctx.fillRect(0, 0, W, H);
    const greens = ['#3d7a37', '#2c5f2e', '#4f7c2c', '#1f4a28'];
    for (let i = 0; i < 9; i++) {
      const bx = W * (0.08 + rnd() * 0.84);
      const top = H * (0.18 + rnd() * 0.4);
      const bow = (rnd() - 0.5) * 0.5;
      ribbon(ctx, whiplash(bx, H * 1.02, bx + (rnd() - 0.5) * W * 0.3, top, bow),
        W * 0.055, W * 0.008, greens[(rnd() * greens.length) | 0]);
    }
    const stems = [0.28, 0.52, 0.76];
    for (const s of stems) {
      const bx = W * s, hy = H * (0.24 + (s === 0.52 ? -0.05 : 0.07));
      ribbon(ctx, whiplash(bx + (rnd() - 0.5) * 30, H * 1.0, bx, hy + H * 0.1, (rnd() - 0.5) * 0.3),
        W * 0.035, W * 0.018, '#3f7a3f');
      const r = W * 0.15;
      const vio = ['#4f4394', '#3c3180', '#6659ac'];
      petal(ctx, bx, hy, r, Math.PI * 0.62, vio[0]);
      petal(ctx, bx, hy, r, Math.PI * 0.38, vio[1]);
      petal(ctx, bx, hy, r * 0.9, Math.PI * 1.5, vio[2], 0.5);
      petal(ctx, bx, hy - r * 0.1, r * 0.72, Math.PI * 1.22, '#7264b6', 0.45);
      petal(ctx, bx, hy - r * 0.1, r * 0.72, Math.PI * 1.78, '#7264b6', 0.45);
      poly(ctx, [[bx - r * 0.1, hy], [bx + r * 0.1, hy], [bx, hy + r * 0.34]], '#cfa430');
    }
    return ctx;
  },
  peacock(ctx, W, H, rnd) {
    const g = ctx.createLinearGradient(0, H, W, 0);
    g.addColorStop(0, '#dfe3c2'); g.addColorStop(0.6, '#d6e0c4'); g.addColorStop(1, '#e6e4c6');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const teal = ['#1d8290', '#12626f', '#2f9a95', '#155b6d'];
    const root = [W * 0.12, H * 1.02];
    for (let i = 0; i < 11; i++) {
      const t = i / 10;
      const ex = W * (0.14 + t * 0.86), ey = H * (0.78 - t * 0.68) + (rnd() - 0.5) * H * 0.06;
      const pts = whiplash(root[0], root[1], ex, ey, 0.18 + t * 0.22);
      ribbon(ctx, pts, W * 0.03, W * 0.012, teal[i % teal.length]);
      // the eye
      const r = W * (0.05 + rnd() * 0.02);
      ctx.fillStyle = '#1c5f6e'; ctx.beginPath(); ctx.ellipse(ex, ey, r * 1.5, r * 1.1, -0.4, 0, 7); ctx.fill();
      ctx.fillStyle = '#c8a94a'; ctx.beginPath(); ctx.ellipse(ex, ey, r * 1.05, r * 0.76, -0.4, 0, 7); ctx.fill();
      ctx.fillStyle = '#3b4f9c'; ctx.beginPath(); ctx.ellipse(ex, ey, r * 0.52, r * 0.4, -0.4, 0, 7); ctx.fill();
    }
    for (let i = 0; i < 5; i++) {
      ribbon(ctx, whiplash(W * rnd(), H * 0.02, W * (0.3 + rnd() * 0.7), H * 0.5, (rnd() - 0.5) * 0.6),
        W * 0.012, W * 0.004, '#b9a44e');
    }
    return ctx;
  },
  tendril(ctx, W, H, rnd) {
    ctx.fillStyle = '#e3ddb8'; ctx.fillRect(0, 0, W, H);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'rgba(210,224,192,0.92)'); g.addColorStop(1, 'rgba(228,214,170,0.92)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 6; i++) {
      const y0 = H * (0.1 + rnd() * 0.8);
      ribbon(ctx, whiplash(-W * 0.05, y0, W * 1.05, H * (0.1 + rnd() * 0.8), (rnd() - 0.5) * 0.5),
        W * 0.024, W * 0.012, i % 2 ? '#3a6c3a' : '#75833f');
    }
    for (let i = 0; i < 5; i++) {
      const cx = W * (0.1 + i * 0.2 + (rnd() - 0.5) * 0.05), cy = H * (0.3 + rnd() * 0.4);
      const r = Math.min(W, H) * 0.12;
      for (let k = 0; k < 5; k++) petal(ctx, cx, cy, r, (k / 5) * Math.PI * 2, k % 2 ? '#b1545f' : '#c26b70');
      ctx.fillStyle = '#e8c65e'; ctx.beginPath(); ctx.arc(cx, cy, r * 0.24, 0, 7); ctx.fill();
    }
    return ctx;
  },
  domePanel(ctx, W, H, rnd) {
    // one meridional panel of the glazed dome: pale glass, a rising stem,
    // paired leaves, and green bands where the latitude hoops cross
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#e8efdc'); g.addColorStop(0.45, '#d9e6cd'); g.addColorStop(1, '#c8dcbc');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    for (const [y, h, c] of [[H * 0.12, H * 0.05, '#7fa46a'], [H * 0.52, H * 0.04, '#6f9660'], [H * 0.86, H * 0.05, '#89ad72']]) {
      ctx.fillStyle = c; ctx.fillRect(0, y, W, h);
    }
    ribbon(ctx, whiplash(W * 0.5, H * 1.0, W * 0.5, 0, 0.02), W * 0.06, W * 0.03, '#5f8a52');
    for (let i = 0; i < 6; i++) {
      const y = H * (0.12 + i * 0.15);
      for (const s of [-1, 1]) {
        ribbon(ctx, whiplash(W * 0.5, y, W * (0.5 + s * 0.42), y - H * 0.09, s * 0.3),
          W * 0.05, W * 0.01, i % 2 ? '#588045' : '#6d9457');
      }
    }
    for (let i = 0; i < 4; i++) {
      const y = H * (0.2 + i * 0.22);
      for (const s of [-1, 1]) {
        const cx = W * (0.5 + s * 0.3), r = W * 0.09;
        for (let k = 0; k < 5; k++) petal(ctx, cx, y, r, (k / 5) * Math.PI * 2 + 0.4, '#b85f5f');
        ctx.fillStyle = '#e9cf72'; ctx.beginPath(); ctx.arc(cx, y, r * 0.22, 0, 7); ctx.fill();
      }
    }
    return ctx;
  },
  rosette(ctx, W, H, rnd) {
    ctx.fillStyle = '#eef3e6'; ctx.fillRect(0, 0, W, H);
    const cx = W / 2, cy = H / 2;
    for (const [r, c] of [[W * 0.48, '#9dbb8b'], [W * 0.42, '#f2f6ec'], [W * 0.3, '#c9d9bb'], [W * 0.2, '#eef3e6']]) {
      ctx.fillStyle = c; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fill();
    }
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2;
      ribbon(ctx, whiplash(cx + Math.cos(a) * W * 0.2, cy + Math.sin(a) * W * 0.2,
        cx + Math.cos(a + 0.5) * W * 0.44, cy + Math.sin(a + 0.5) * W * 0.44, 0.2),
        W * 0.03, W * 0.008, k % 2 ? '#7fa46c' : '#a8bf8e');
      petal(ctx, cx + Math.cos(a) * W * 0.31, cy + Math.sin(a) * W * 0.31, W * 0.07, a, k % 2 ? '#c86f6f' : '#d98a84');
    }
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2 + 0.3;
      petal(ctx, cx, cy, W * 0.17, a, '#cf7a76');
    }
    ctx.fillStyle = '#e6c664'; ctx.beginPath(); ctx.arc(cx, cy, W * 0.055, 0, 7); ctx.fill();
    return ctx;
  },
};

// Cut a flat cartoon into leaded cames: irregular quads, dark lead, raised.
function tesselate(ctx, hctx, W, H, motif, opts = {}) {
  const { cell = 22, jitter = 0.26, lead = '#171a1e', lw = 2.8, variation = 16, seed = 5, raise = true } = opts;
  const rnd = mulberry32(seed);
  const cols = Math.max(2, Math.round(W / cell)), rows = Math.max(2, Math.round(H / cell));
  const src = motif.getContext('2d').getImageData(0, 0, W, H).data;
  const vx = [], vy = [];
  for (let j = 0; j <= rows; j++) {
    vx.push([]); vy.push([]);
    for (let i = 0; i <= cols; i++) {
      const jx = i === 0 || i === cols ? 0 : (rnd() - 0.5) * cell * jitter * 2;
      const jy = j === 0 || j === rows ? 0 : (rnd() - 0.5) * cell * jitter * 2;
      vx[j].push((i / cols) * W + jx);
      vy[j].push((j / rows) * H + jy);
    }
  }
  ctx.lineJoin = hctx.lineJoin = 'round';
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const p = [[vx[j][i], vy[j][i]], [vx[j][i + 1], vy[j][i + 1]],
        [vx[j + 1][i + 1], vy[j + 1][i + 1]], [vx[j + 1][i], vy[j + 1][i]]];
      const cx = (p[0][0] + p[1][0] + p[2][0] + p[3][0]) / 4;
      const cy = (p[0][1] + p[1][1] + p[2][1] + p[3][1]) / 4;
      const si = (Math.min(H - 1, Math.max(0, cy | 0)) * W + Math.min(W - 1, Math.max(0, cx | 0))) * 4;
      const v = (rnd() - 0.5) * variation;
      const path = (c) => {
        c.beginPath(); c.moveTo(p[0][0], p[0][1]);
        for (let k = 1; k < 4; k++) c.lineTo(p[k][0], p[k][1]);
        c.closePath();
      };
      ctx.fillStyle = `rgb(${cl(src[si] + v)},${cl(src[si + 1] + v)},${cl(src[si + 2] + v)})`;
      path(ctx); ctx.fill();
      ctx.strokeStyle = lead; ctx.lineWidth = lw; path(ctx); ctx.stroke();
      hctx.fillStyle = '#3a3a3a'; path(hctx); hctx.fill();
      hctx.strokeStyle = raise ? '#e8e8e8' : '#0e0e0e';
      hctx.lineWidth = lw * 1.25; path(hctx); hctx.stroke();
    }
  }
}

// Backlit leaded glass: albedo doubles as the emissive map so the panel reads
// as daylight coming through, without a transmission shader.
export function leadedGlassMaterial({ W = 512, H = 512, motif = 'iris', seed = 7, cell = 22, repeat = [1, 1], glow = 0.85 } = {}) {
  const [mc, mctx] = makeCanvas(W, H);
  MOTIF[motif](mctx, W, H, mulberry32(seed + 11));
  const [c, ctx] = makeCanvas(W, H);
  const [hc, hctx] = makeCanvas(W, H);
  hctx.fillStyle = '#000'; hctx.fillRect(0, 0, W, H);
  tesselate(ctx, hctx, W, H, mc, { cell, seed });
  const map = tex(c, { srgb: true, repeat });
  const nrm = tex(heightToNormal(hc, 1.5), { repeat });
  const m = new THREE.MeshStandardMaterial({
    map, normalMap: nrm, emissive: 0xffffff, emissiveMap: map, emissiveIntensity: glow,
    roughness: 0.24, metalness: 0, side: THREE.DoubleSide, envMapIntensity: 1.1,
    normalScale: new THREE.Vector2(0.7, 0.7),
  });
  m.userData.glow = glow;
  return m;
}

// Mosaic paving: a green field with cream whiplash waves and a centre medallion,
// cut into tesserae. Mapped once across the whole floor (no tiling).
export function mosaicFloorMaterial(S = 1024) {
  const [mc, m] = makeCanvas(S, S);
  const rnd = mulberry32(19);
  const f = fbmField(S, S, 44, 4, 6);
  const img = m.createImageData(S, S);
  for (let i = 0; i < S * S; i++) {
    const n = (f[i] - 0.5) * 26;
    img.data[i * 4] = cl(92 + n); img.data[i * 4 + 1] = cl(106 + n * 0.9); img.data[i * 4 + 2] = cl(70 + n * 0.7);
    img.data[i * 4 + 3] = 255;
  }
  m.putImageData(img, 0, 0);
  const R = S / 2;
  // border courses
  m.strokeStyle = '#5f6b48'; m.lineWidth = S * 0.03;
  m.beginPath(); m.arc(R, R, R * 0.95, 0, 7); m.stroke();
  m.strokeStyle = '#d9d2b4'; m.lineWidth = S * 0.012;
  m.beginPath(); m.arc(R, R, R * 0.9, 0, 7); m.stroke();
  // eight whiplash waves sweeping around the field
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    const b = a + 0.9;
    ribbon(m, whiplash(R + Math.cos(a) * R * 0.86, R + Math.sin(a) * R * 0.86,
      R + Math.cos(b) * R * 0.42, R + Math.sin(b) * R * 0.42, 0.34),
      S * 0.055, S * 0.014, '#cec69f');
    ribbon(m, whiplash(R + Math.cos(a + 0.16) * R * 0.86, R + Math.sin(a + 0.16) * R * 0.86,
      R + Math.cos(b + 0.2) * R * 0.5, R + Math.sin(b + 0.2) * R * 0.5, 0.3),
      S * 0.02, S * 0.006, '#7f8459');
    petal(m, R + Math.cos(a + 0.45) * R * 0.66, R + Math.sin(a + 0.45) * R * 0.66, S * 0.05, a + 1.6, '#b1704f');
  }
  // medallion
  for (const [r, c] of [[R * 0.34, '#e3dcbd'], [R * 0.31, '#6d7a4e'], [R * 0.28, '#eae4c8']]) {
    m.fillStyle = c; m.beginPath(); m.arc(R, R, r, 0, 7); m.fill();
  }
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    petal(m, R, R, R * 0.24, a, k % 2 ? '#93a06a' : '#a9b37c');
    petal(m, R, R, R * 0.15, a + Math.PI / 6, '#b8724f');
  }
  m.fillStyle = '#dbc272'; m.beginPath(); m.arc(R, R, R * 0.05, 0, 7); m.fill();

  const [c2, ctx] = makeCanvas(S, S);
  const [hc, hctx] = makeCanvas(S, S);
  hctx.fillStyle = '#000'; hctx.fillRect(0, 0, S, S);
  tesselate(ctx, hctx, S, S, mc, { cell: 7, jitter: 0.14, lead: '#2a2e25', lw: 1.2, variation: 30, seed: 3, raise: false });
  return new THREE.MeshStandardMaterial({
    map: tex(c2, { srgb: true }), normalMap: tex(heightToNormal(hc, 0.9)),
    roughness: 0.3, metalness: 0.02, envMapIntensity: 1.05,
    normalScale: new THREE.Vector2(0.5, 0.5),
  });
}

// Figured mahogany, french-polished.
export function mahoganyMaterial(repeat = [1, 1], { light = 0 } = {}) {
  const S = 512;
  const [c, ctx] = makeCanvas(S, S);
  const [hc, hctx] = makeCanvas(S, S);
  const f = fbmField(S, S, 61, 5, 5);
  const img = ctx.createImageData(S, S);
  const hi = hctx.createImageData(S, S);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const i = y * S + x;
      // ribbon figure: bands running with the grain, warped by noise
      const band = Math.sin((x / S) * Math.PI * 2 * 5 + f[i] * 9) * 0.5 + 0.5;
      const fleck = Math.pow(Math.abs(Math.sin((x / S) * Math.PI * 150 + f[i] * 16)), 6);
      const t = Math.pow(band, 1.6) * 0.8 + fleck * 0.3 + (f[i] - 0.5) * 0.35;
      img.data[i * 4] = cl(MAHOG[0] + light * 30 + t * 78);
      img.data[i * 4 + 1] = cl(MAHOG[1] + light * 20 + t * 40);
      img.data[i * 4 + 2] = cl(MAHOG[2] + light * 14 + t * 27);
      img.data[i * 4 + 3] = 255;
      const v = 128 + (band - 0.5) * 40 + (f[i] - 0.5) * 30;
      hi.data[i * 4] = hi.data[i * 4 + 1] = hi.data[i * 4 + 2] = v; hi.data[i * 4 + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0); hctx.putImageData(hi, 0, 0);
  return new THREE.MeshStandardMaterial({
    map: tex(c, { srgb: true, repeat }), normalMap: tex(heightToNormal(hc, 0.5), { repeat }),
    roughness: 0.3, metalness: 0.03, envMapIntensity: 1.1,
    normalScale: new THREE.Vector2(0.5, 0.5),
  });
}

// Polished brass — the structural metal of the whole room.
export function brassMaterial(seed = 6, { rough = 0.22 } = {}) {
  const S = 512;
  const [c, ctx] = makeCanvas(S, S);
  const [rc, rctx] = makeCanvas(S, S);
  const f = fbmField(S, S, seed, 5, 7);
  const g2 = fbmField(S, S, seed + 3, 3, 26);
  const img = ctx.createImageData(S, S);
  const ri = rctx.createImageData(S, S);
  for (let i = 0; i < S * S; i++) {
    const n = f[i], s = g2[i];
    img.data[i * 4] = cl(BRASS[0] + (n - 0.5) * 40 - s * 16);
    img.data[i * 4 + 1] = cl(BRASS[1] + (n - 0.5) * 34 - s * 18);
    img.data[i * 4 + 2] = cl(BRASS[2] + (n - 0.5) * 26 - s * 12);
    img.data[i * 4 + 3] = 255;
    const v = (rough + n * 0.2 + s * 0.08) * 255;
    ri.data[i * 4] = ri.data[i * 4 + 1] = ri.data[i * 4 + 2] = v; ri.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0); rctx.putImageData(ri, 0, 0);
  return new THREE.MeshStandardMaterial({
    map: tex(c, { srgb: true, repeat: [2, 2] }), roughnessMap: tex(rc, { repeat: [2, 2] }),
    metalness: 1, roughness: 1, envMapIntensity: 1.9,
  });
}

// Opal glass for the lamp shades.
export function opalMaterial(glow = 1.1) {
  const m = new THREE.MeshStandardMaterial({
    color: 0xfff6e4, emissive: 0xffe6bd, emissiveIntensity: glow,
    roughness: 0.46, metalness: 0, envMapIntensity: 0.6, side: THREE.DoubleSide,
  });
  m.userData.glow = glow;
  return m;
}

// Sgraffito frieze: a repeating tendril band, incised into cream stucco with
// brass highlights (tiles in u).
export function friezeMaterial(repeatU = 18) {
  const W = 512, H = 128;
  const L = layers(W, H);
  const { pen } = L;
  const path = (pts) => (ctx) => {
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  };
  pen.stroke(path(whiplash(-10, H * 0.5, W / 2, H * 0.5, 0.34)), 9);
  pen.stroke(path(whiplash(W / 2, H * 0.5, W + 10, H * 0.5, -0.34)), 9);
  for (const x of [W * 0.14, W * 0.5, W * 0.86]) {
    for (let k = 0; k < 5; k++) {
      pen.stroke(path(whiplash(x, H * 0.5, x + Math.cos((k / 5) * 6.28) * 34, H * 0.5 + Math.sin((k / 5) * 6.28) * 30, 0.3)), 5);
    }
    pen.fill((ctx) => { ctx.beginPath(); ctx.arc(x, H * 0.5, 9, 0, 7); }, { height: 0.9 });
  }
  for (let x = 0; x < W; x += 32) {
    pen.incise((ctx) => { ctx.beginPath(); ctx.moveTo(x, H * 0.06); ctx.lineTo(x + 14, H * 0.06); }, 4);
  }
  pen.stroke((ctx) => { ctx.beginPath(); ctx.moveTo(0, H * 0.94); ctx.lineTo(W, H * 0.94); }, 6);
  const set = bake(L.hc, L.gc, {
    ground: [236, 226, 200], gilt: BRASS, giltDark: BRASS_DK, normalStrength: 2.6, plasterRough: 0.88, giltRough: 0.26,
  });
  for (const t of [set.map, set.normalMap, set.roughnessMap, set.metalnessMap, set.aoMap]) t.repeat.set(repeatU, 1);
  return pbr(set, { envMapIntensity: 1.3 });
}

// Brass-and-lighter-wood marquetry decal, mounted proud of the mahogany field.
export function inlayMaterial(aspect = 0.28, seed = 4) {
  const W = 256, H = Math.round(W / aspect);
  const L = layers(W, H);
  const { pen } = L;
  const path = (pts) => (ctx) => {
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  };
  const rnd = mulberry32(seed);
  pen.stroke(path(whiplash(W * 0.5, H * 0.98, W * 0.5, H * 0.02, 0.1)), 7);
  for (let i = 0; i < 7; i++) {
    const y = H * (0.1 + i * 0.13);
    const s = i % 2 ? 1 : -1;
    pen.stroke(path(whiplash(W * 0.5, y, W * (0.5 + s * 0.36), y - H * 0.07, s * 0.4)), 5);
    pen.fill((ctx) => { ctx.beginPath(); ctx.ellipse(W * (0.5 + s * 0.36), y - H * 0.07, 7, 11, s * 0.6, 0, 7); }, { height: 0.85 });
  }
  for (const y of [H * 0.06, H * 0.94]) {
    for (let k = 0; k < 5; k++) {
      pen.stroke(path(whiplash(W * 0.5, y, W * 0.5 + Math.cos((k / 5) * 6.28) * 30, y + Math.sin((k / 5) * 6.28) * 26, 0.3)), 4.5);
    }
    pen.fill((ctx) => { ctx.beginPath(); ctx.arc(W * 0.5, y, 10, 0, 7); }, { height: 1 });
  }
  const set = bake(L.hc, L.gc, {
    ground: [120, 62, 42], gilt: BRASS, giltDark: BRASS_DK, normalStrength: 3.4, plasterRough: 0.5, giltRough: 0.22,
  });
  const [ac, actx] = makeCanvas(W, H);
  actx.drawImage(L.gc, 0, 0);
  return new THREE.MeshStandardMaterial({
    map: set.map, normalMap: set.normalMap, roughnessMap: set.roughnessMap, metalnessMap: set.metalnessMap,
    alphaMap: tex(ac), transparent: true, alphaTest: 0.4,
    metalness: 1, roughness: 1, envMapIntensity: 1.7, side: THREE.DoubleSide,
    normalScale: new THREE.Vector2(1.1, 1.1),
  });
}

// Warm stucco for the dome spandrels and structural backing.
export function stuccoMaterial(color = [232, 220, 198], repeat = [3, 3]) {
  const S = 512;
  const [c, ctx] = makeCanvas(S, S);
  const f = fbmField(S, S, 27, 5, 7);
  const img = ctx.createImageData(S, S);
  const [hc, hctx] = makeCanvas(S, S);
  const hi = hctx.createImageData(S, S);
  for (let i = 0; i < S * S; i++) {
    const n = (f[i] - 0.5) * 14;
    img.data[i * 4] = cl(color[0] + n); img.data[i * 4 + 1] = cl(color[1] + n); img.data[i * 4 + 2] = cl(color[2] + n);
    img.data[i * 4 + 3] = 255;
    const v = 128 + (f[i] - 0.5) * 60;
    hi.data[i * 4] = hi.data[i * 4 + 1] = hi.data[i * 4 + 2] = v; hi.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0); hctx.putImageData(hi, 0, 0);
  return new THREE.MeshStandardMaterial({
    map: tex(c, { srgb: true, repeat }), normalMap: tex(heightToNormal(hc, 0.5), { repeat }),
    roughness: 0.9, metalness: 0, envMapIntensity: 0.85,
  });
}

// Pale green serpentine marble for dados and plinths.
export function greenMarbleMaterial(repeat = [2, 2]) {
  const S = 512;
  const [c, ctx] = makeCanvas(S, S);
  const f = fbmField(S, S, 313, 5, 4);
  const warp = fbmField(S, S, 317, 4, 3);
  const img = ctx.createImageData(S, S);
  const base = [158, 170, 142], vein = [46, 62, 44], pale = [214, 218, 194];
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const i = y * S + x;
      const v = Math.abs(Math.sin((x / S + warp[i] * 2.2) * Math.PI * 5 + f[i] * 11));
      const streak = Math.pow(1 - v, 3.2) * 0.75;
      const wisp = Math.pow(1 - Math.abs(Math.sin((y / S * 0.6 + warp[i] * 2.6) * Math.PI * 9)), 6) * 0.8;
      for (let k = 0; k < 3; k++) {
        let val = base[k] - streak * (base[k] - vein[k]) + wisp * (pale[k] - base[k]);
        img.data[i * 4 + k] = cl(val + (f[i] - 0.5) * 18);
      }
      img.data[i * 4 + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return new THREE.MeshStandardMaterial({
    map: tex(c, { srgb: true, repeat }), roughness: 0.2, metalness: 0.02, envMapIntensity: 1.4,
  });
}

// An unfilled canvas: a muted art nouveau decorative panel, not a picture.
export function nouveauArt(i, w = 512, h = 640) {
  const [c, ctx] = makeCanvas(w, h);
  const rnd = mulberry32(700 + i * 13);
  const grounds = [['#efe6cd', '#dccfae'], ['#e4e7d6', '#c9d2ba'], ['#eadfd0', '#d6c3ab'], ['#e2e2d1', '#bfc4b0']];
  const [g0, g1] = grounds[i % grounds.length];
  const g = ctx.createLinearGradient(0, 0, w * 0.3, h);
  g.addColorStop(0, g0); g.addColorStop(1, g1);
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  const inks = ['#7c6a4e', '#5d6b52', '#8c6a56', '#4f5b6b'];
  const rose = ['#c08a7d', '#b7907a', '#9f8f6e', '#a97f74'];
  ctx.globalAlpha = 0.5;
  for (let k = 0; k < 4; k++) {
    ribbon(ctx, whiplash(w * rnd(), h * 1.02, w * rnd(), h * (0.1 + rnd() * 0.4), (rnd() - 0.5) * 0.7),
      w * 0.03, w * 0.006, inks[(rnd() * 4) | 0]);
  }
  ctx.globalAlpha = 0.55;
  for (let k = 0; k < 3; k++) {
    const cx = w * (0.24 + rnd() * 0.52), cy = h * (0.2 + rnd() * 0.55), r = w * (0.06 + rnd() * 0.05);
    for (let p = 0; p < 6; p++) petal(ctx, cx, cy, r, (p / 6) * Math.PI * 2 + rnd(), rose[(rnd() * 4) | 0]);
    ctx.fillStyle = '#c9b06a'; ctx.beginPath(); ctx.arc(cx, cy, r * 0.2, 0, 7); ctx.fill();
  }
  ctx.globalAlpha = 1;
  // canvas tooth + varnish bloom
  const f = fbmField(128, 160, 900 + i, 4, 12);
  ctx.globalAlpha = 0.18;
  for (let y = 0; y < 160; y++) {
    for (let x = 0; x < 128; x++) {
      const v = f[y * 128 + x];
      ctx.fillStyle = v > 0.5 ? 'rgba(255,250,236,0.7)' : 'rgba(60,48,32,0.5)';
      ctx.fillRect(x * 4, y * 4, 4, 4);
    }
  }
  ctx.globalAlpha = 1;
  ctx.strokeStyle = 'rgba(90,72,48,0.5)'; ctx.lineWidth = 6;
  ctx.strokeRect(10, 10, w - 20, h - 20);
  const t = tex(c, { srgb: true });
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}
