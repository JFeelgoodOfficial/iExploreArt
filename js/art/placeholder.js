import * as THREE from 'three';
import { mulberry32 } from '../utils/proctex.js';

// Generates an abstract painting in the artist's palette as a CanvasTexture.
// Used for every artwork whose manifest entry has image: null, so the
// gallery reads as complete before the real .webp photographs arrive.

const PALETTES = {
  teal: {
    fields: [[47, 111, 115], [86, 140, 143], [30, 26, 23], [214, 226, 224]],
    strokes: [[26, 82, 86], [180, 111, 61], [30, 26, 23]],
  },
  terracotta: {
    fields: [[180, 111, 61], [206, 148, 104], [122, 72, 41], [240, 228, 210]],
    strokes: [[150, 84, 42], [47, 111, 115], [58, 40, 28]],
  },
  ink: {
    fields: [[30, 26, 23], [82, 74, 66], [214, 208, 196], [242, 238, 229]],
    strokes: [[20, 17, 15], [47, 111, 115], [111, 103, 95]],
  },
  mixed: {
    fields: [[47, 111, 115], [180, 111, 61], [30, 26, 23], [235, 226, 212]],
    strokes: [[26, 82, 86], [150, 84, 42], [30, 26, 23]],
  },
};

export function generatePainting(seed, paletteName, aspect = 0.8) {
  const rand = mulberry32(seed);
  const W = 896;
  const H = Math.round(W / aspect);
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const pal = PALETTES[paletteName] || PALETTES.mixed;

  // 1 — warm paper ground with grain
  ctx.fillStyle = '#f4efe5';
  ctx.fillRect(0, 0, W, H);
  const grain = ctx.getImageData(0, 0, W, H);
  for (let i = 0; i < grain.data.length; i += 4) {
    const n = (rand() - 0.5) * 10;
    grain.data[i] += n; grain.data[i + 1] += n; grain.data[i + 2] += n;
  }
  ctx.putImageData(grain, 0, 0);

  // 2 — large translucent colour fields
  const nFields = 2 + Math.floor(rand() * 3);
  ctx.globalCompositeOperation = 'multiply';
  for (let f = 0; f < nFields; f++) {
    const col = pal.fields[Math.floor(rand() * pal.fields.length)];
    ctx.globalAlpha = 0.45 + rand() * 0.3;
    ctx.fillStyle = `rgb(${col[0]},${col[1]},${col[2]})`;
    blob(ctx, rand, W * (0.2 + rand() * 0.6), H * (0.2 + rand() * 0.6),
         W * (0.22 + rand() * 0.3), 7 + Math.floor(rand() * 5));
  }

  // 3 — gestural strokes
  ctx.globalCompositeOperation = 'source-over';
  const nStrokes = 18 + Math.floor(rand() * 22);
  for (let s = 0; s < nStrokes; s++) {
    const col = pal.strokes[Math.floor(rand() * pal.strokes.length)];
    const jitter = (rand() - 0.5) * 24;
    ctx.strokeStyle = `rgba(${Math.max(0, col[0] + jitter)},${Math.max(0, col[1] + jitter)},${Math.max(0, col[2] + jitter)},${0.5 + rand() * 0.45})`;
    ctx.lineWidth = 3 + Math.pow(rand(), 2) * 34;
    ctx.lineCap = rand() > 0.5 ? 'round' : 'butt';
    const x0 = rand() * W, y0 = rand() * H;
    const x1 = x0 + (rand() - 0.5) * W * 0.8, y1 = y0 + (rand() - 0.5) * H * 0.8;
    const cx = (x0 + x1) / 2 + (rand() - 0.5) * W * 0.4;
    const cy = (y0 + y1) / 2 + (rand() - 0.5) * H * 0.4;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo(cx, cy, x1, y1);
    ctx.stroke();
  }

  // 4 — a few high-contrast ink accents
  const nAccents = 3 + Math.floor(rand() * 5);
  for (let a = 0; a < nAccents; a++) {
    ctx.fillStyle = `rgba(24,20,17,${0.6 + rand() * 0.35})`;
    const x = rand() * W, y = rand() * H, r = 3 + rand() * 10;
    if (rand() > 0.5) {
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.lineWidth = 2 + rand() * 4;
      ctx.strokeStyle = ctx.fillStyle;
      ctx.beginPath(); ctx.arc(x, y, r * 3, rand() * Math.PI, rand() * Math.PI + 1.2); ctx.stroke();
    }
  }

  // 5 — soft vignette so edges settle
  const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.45, W / 2, H / 2, Math.max(W, H) * 0.72);
  vg.addColorStop(0, 'rgba(30,26,23,0)');
  vg.addColorStop(1, 'rgba(30,26,23,0.14)');
  ctx.globalAlpha = 1;
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

// organic multi-lobed blob
function blob(ctx, rand, cx, cy, r, points) {
  ctx.beginPath();
  const offsets = [];
  for (let i = 0; i < points; i++) offsets.push(0.55 + rand() * 0.75);
  for (let i = 0; i <= points; i++) {
    const a = (i / points) * Math.PI * 2;
    const rr = r * offsets[i % points];
    const x = cx + Math.cos(a) * rr;
    const y = cy + Math.sin(a) * rr * (0.75 + rand() * 0.4);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
}
