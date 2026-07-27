import * as THREE from 'three';
import { makeCanvas, fbmField, tex, heightToNormal, bake, pbr, Pen, cScroll, shellCrest, acanthusSpray, ribbonBand, eggAndDart, mulberry32 } from './rococo-tex.js';

const GILT = [206, 165, 82];
const GILT_DK = [116, 82, 26];
const ROSE = [238, 214, 203];
const CREAM = [246, 234, 218];

function layers(w, h) {
  const [hc, hctx] = makeCanvas(w, h);
  const [gc, gctx] = makeCanvas(w, h);
  hctx.fillStyle = '#000'; hctx.fillRect(0, 0, w, h);
  gctx.fillStyle = '#000'; gctx.fillRect(0, 0, w, h);
  return { hc, hctx, gc, gctx, pen: Pen(hctx, gctx) };
}

// ---------------------------------------------------------------------------
// Silk damask for the wall fields — woven ground, tone-on-tone motif.
// ---------------------------------------------------------------------------
export function damaskMaterial({ base = [232, 205, 196], motif = [246, 226, 214], repeat = [4, 3] } = {}) {
  const S = 512;
  const [c, ctx] = makeCanvas(S, S);
  const f = fbmField(S, S, 77, 4, 9);
  const img = ctx.createImageData(S, S);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const i = (y * S + x) * 4;
      const weave = ((x % 3 < 2) !== (y % 3 < 2)) ? 4 : -4;
      const n = (f[y * S + x] - 0.5) * 12;
      img.data[i] = base[0] + weave + n;
      img.data[i + 1] = base[1] + weave + n;
      img.data[i + 2] = base[2] + weave + n;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  // damask motif: mirrored ogee with a palmette heart
  const [mc, mctx] = makeCanvas(S, S);
  mctx.clearRect(0, 0, S, S);
  mctx.strokeStyle = `rgb(${motif[0]},${motif[1]},${motif[2]})`;
  mctx.lineCap = 'round';
  const drawMotif = (cx, cy, s) => {
    mctx.save(); mctx.translate(cx, cy); mctx.scale(s, s);
    for (const fl of [1, -1]) {
      mctx.save(); mctx.scale(fl, 1);
      mctx.lineWidth = 9;
      mctx.beginPath();
      mctx.moveTo(0, -96); mctx.bezierCurveTo(52, -70, 74, -18, 56, 26);
      mctx.bezierCurveTo(42, 60, 4, 66, 0, 34);
      mctx.stroke();
      mctx.lineWidth = 6;
      mctx.beginPath();
      mctx.moveTo(0, 34); mctx.bezierCurveTo(26, 62, 34, 96, 12, 122);
      mctx.stroke();
      mctx.beginPath();
      mctx.moveTo(18, -34); mctx.bezierCurveTo(50, -34, 66, -6, 52, 18);
      mctx.stroke();
      mctx.lineWidth = 5;
      mctx.beginPath();
      mctx.moveTo(-2, -96); mctx.bezierCurveTo(20, -122, 44, -120, 54, -100);
      mctx.stroke();
      mctx.restore();
    }
    mctx.restore();
  };
  drawMotif(S * 0.5, S * 0.42, 1);
  drawMotif(0, S * 0.92, 1); drawMotif(S, S * 0.92, 1);
  mctx.globalAlpha = 0.55;
  ctx.globalAlpha = 0.62;
  ctx.drawImage(mc, 0, 0);
  ctx.globalAlpha = 1;

  const [hc, hctx] = makeCanvas(S, S);
  hctx.fillStyle = '#2a2a2a'; hctx.fillRect(0, 0, S, S);
  hctx.globalAlpha = 0.85; hctx.drawImage(mc, 0, 0);

  const map = tex(c, { srgb: true, repeat });
  const nrm = tex(heightToNormal(hc, 0.7), { repeat });
  return new THREE.MeshStandardMaterial({
    map, normalMap: nrm, roughness: 0.78, metalness: 0,
    normalScale: new THREE.Vector2(0.6, 0.6), envMapIntensity: 0.7,
  });
}

// ---------------------------------------------------------------------------
// Gilt ornament decal sheets — drawn on transparency, mounted proud of the wall
// ---------------------------------------------------------------------------
function decalMaterial(hc, gc, opts = {}) {
  const set = bake(hc, gc, { ground: [150, 120, 70], gilt: [216, 176, 92], giltDark: [88, 58, 16], giltRough: 0.22, normalStrength: 4.0, ...opts });
  const [ac, actx] = makeCanvas(hc.width, hc.height);
  actx.drawImage(gc, 0, 0);
  const alphaMap = tex(ac);
  return new THREE.MeshStandardMaterial({
    map: set.map, normalMap: set.normalMap, roughnessMap: set.roughnessMap,
    metalnessMap: set.metalnessMap, alphaMap, transparent: true, alphaTest: 0.42,
    metalness: 1, roughness: 1, envMapIntensity: 1.6, side: THREE.DoubleSide,
    normalScale: new THREE.Vector2(1.1, 1.1), depthWrite: true,
  });
}

// Panel cartouche: a full boiserie panel's worth of rocaille (frame + crest +
// corner scrolls + pendant). Aspect is passed so it maps 1:1 onto the panel.
export function panelOrnament(aspect = 0.75, seed = 3, { crest = true, pendant = true } = {}) {
  const W = 512, H = Math.round(512 / aspect);
  const L = layers(W, H);
  const { pen } = L;
  const m = W * 0.055;
  const rnd = mulberry32(seed);

  // panel moulding — double bead with flowing corners
  const frame = (inset, lw) => (ctx) => {
    const x0 = m + inset, y0 = m + inset, x1 = W - m - inset, y1 = H - m - inset;
    const r = W * 0.11;
    ctx.beginPath();
    ctx.moveTo(x0 + r, y0);
    ctx.lineTo(x1 - r, y0);
    ctx.quadraticCurveTo(x1, y0, x1, y0 + r);
    ctx.lineTo(x1, y1 - r);
    ctx.quadraticCurveTo(x1, y1, x1 - r, y1);
    ctx.lineTo(x0 + r, y1);
    ctx.quadraticCurveTo(x0, y1, x0, y1 - r);
    ctx.lineTo(x0, y0 + r);
    ctx.quadraticCurveTo(x0, y0, x0 + r, y0);
    ctx.closePath();
  };
  pen.stroke(frame(0, 1), W * 0.018);
  pen.stroke(frame(W * 0.035, 1), W * 0.008, { height: 0.7 });

  // corner rocaille
  const cs = W * 0.20;
  cScroll(pen, m + W * 0.03, m + W * 0.03, cs, 0.0, 1);
  cScroll(pen, W - m - W * 0.03, m + W * 0.03, cs, 0.0, -1);
  cScroll(pen, m + W * 0.03, H - m - W * 0.03, cs, -Math.PI / 2, -1);
  cScroll(pen, W - m - W * 0.03, H - m - W * 0.03, cs, -Math.PI / 2, 1);

  if (crest) shellCrest(pen, W / 2, m + W * 0.02, W * 0.24, 0);
  if (pendant) {
    acanthusSpray(pen, W / 2, H - m - W * 0.05, W * 0.17, Math.PI * 0.86, 1);
    acanthusSpray(pen, W / 2, H - m - W * 0.05, W * 0.17, Math.PI * 0.86, -1);
    pen.fill((ctx) => { ctx.beginPath(); ctx.arc(W / 2, H - m - W * 0.05, W * 0.022, 0, Math.PI * 2); }, { height: 0.9 });
  }
  // sprigs down the long sides
  for (const t of [0.34, 0.66]) {
    acanthusSpray(pen, m + W * 0.02, H * t, W * 0.1, -Math.PI * 0.5 + (rnd() - 0.5) * 0.2, 1);
    acanthusSpray(pen, W - m - W * 0.02, H * t, W * 0.1, -Math.PI * 0.5 + (rnd() - 0.5) * 0.2, -1);
  }
  return decalMaterial(L.hc, L.gc);
}

// Over-door / overmantel cartouche used above the upper-storey openings.
export function cartouche(seed = 5) {
  const W = 512, H = 256;
  const L = layers(W, H);
  const { pen } = L;
  shellCrest(pen, W / 2, H * 0.42, W * 0.3, 0);
  cScroll(pen, W * 0.22, H * 0.34, W * 0.2, 0.15, 1);
  cScroll(pen, W * 0.78, H * 0.34, W * 0.2, 0.15, -1);
  acanthusSpray(pen, W * 0.30, H * 0.62, W * 0.17, Math.PI * 0.1, -1);
  acanthusSpray(pen, W * 0.70, H * 0.62, W * 0.17, Math.PI * 0.1, 1);
  ribbonBand(pen, W * 0.16, H * 0.86, W * 0.84, H * 0.05, W * 0.16, W * 0.012);
  return decalMaterial(L.hc, L.gc);
}

// Repeating enrichment strips for cornices (tiles in u).
export function bandMaterial(kind, repeatU = 24) {
  const W = 256, H = 128;
  const L = layers(W, H);
  const { pen } = L;
  if (kind === 'egg') eggAndDart(pen, 0, H / 2, W + 64, 64);
  else if (kind === 'guilloche') ribbonBand(pen, -20, H / 2, W + 20, H * 0.22, W / 2, 10);
  else if (kind === 'dentil') {
    for (let x = 0; x < W; x += 32) {
      pen.fill((ctx) => { ctx.beginPath(); ctx.rect(x + 6, H * 0.24, 20, H * 0.52); }, { gild: false, height: 1 });
    }
  } else if (kind === 'bead') {
    for (let x = 0; x < W; x += 24) {
      pen.fill((ctx) => { ctx.beginPath(); ctx.arc(x + 12, H / 2, 8, 0, Math.PI * 2); }, { height: 1 });
      pen.fill((ctx) => { ctx.beginPath(); ctx.ellipse(x + 24, H / 2, 3, 9, 0, 0, Math.PI * 2); }, { height: 0.8 });
    }
  }
  const gildAll = kind !== 'dentil';
  const set = bake(L.hc, L.gc, {
    ground: gildAll ? CREAM : CREAM, gilt: GILT, giltDark: GILT_DK, normalStrength: 3.0,
  });
  for (const t of [set.map, set.normalMap, set.roughnessMap, set.metalnessMap, set.aoMap]) t.repeat.set(repeatU, 1);
  return pbr(set, { envMapIntensity: 1.4 });
}

// Fluted pilaster shaft.
export function flutingMaterial(flutes = 7, repeatV = 1) {
  const W = 256, H = 64;
  const [hc, hctx] = makeCanvas(W, H);
  const g = hctx.createLinearGradient(0, 0, W, 0);
  hctx.fillStyle = '#8a8a8a'; hctx.fillRect(0, 0, W, H);
  for (let i = 0; i < flutes; i++) {
    const cx = ((i + 0.5) / flutes) * W, wdt = (W / flutes) * 0.62;
    const grad = hctx.createLinearGradient(cx - wdt / 2, 0, cx + wdt / 2, 0);
    grad.addColorStop(0, '#c8c8c8'); grad.addColorStop(0.5, '#1a1a1a'); grad.addColorStop(1, '#c8c8c8');
    hctx.fillStyle = grad;
    hctx.fillRect(cx - wdt / 2, 0, wdt, H);
  }
  const [gc, gctx] = makeCanvas(W, H);
  gctx.fillStyle = '#000'; gctx.fillRect(0, 0, W, H);
  const set = bake(hc, gc, { ground: [244, 231, 218], gilt: GILT, normalStrength: 1.8, plasterRough: 0.88 });
  for (const t of [set.map, set.normalMap, set.roughnessMap, set.metalnessMap, set.aoMap]) t.repeat.set(1, repeatV);
  return pbr(set, { metalness: 0 });
}

// Plain lime plaster with tooth.
export function plasterMaterial(color = [244, 228, 216], repeat = [3, 3]) {
  const S = 512;
  const [c, ctx] = makeCanvas(S, S);
  const f = fbmField(S, S, 21, 5, 7);
  const img = ctx.createImageData(S, S);
  for (let i = 0; i < S * S; i++) {
    const n = (f[i] - 0.5) * 13;
    img.data[i * 4] = color[0] + n; img.data[i * 4 + 1] = color[1] + n; img.data[i * 4 + 2] = color[2] + n; img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const [hc, hctx] = makeCanvas(S, S);
  const hi = hctx.createImageData(S, S);
  for (let i = 0; i < S * S; i++) {
    const v = 128 + (f[i] - 0.5) * 70;
    hi.data[i * 4] = hi.data[i * 4 + 1] = hi.data[i * 4 + 2] = v; hi.data[i * 4 + 3] = 255;
  }
  hctx.putImageData(hi, 0, 0);
  return new THREE.MeshStandardMaterial({
    map: tex(c, { srgb: true, repeat }), normalMap: tex(heightToNormal(hc, 0.5), { repeat }),
    roughness: 0.93, metalness: 0, envMapIntensity: 0.8,
  });
}

// Solid gilt (for frames, balusters, rails).
export function giltMaterial(seed = 4) {
  const S = 512;
  const [c, ctx] = makeCanvas(S, S);
  const f = fbmField(S, S, seed, 5, 8);
  const g2 = fbmField(S, S, seed + 1, 3, 22);
  const img = ctx.createImageData(S, S);
  for (let i = 0; i < S * S; i++) {
    const n = f[i], s = g2[i];
    img.data[i * 4] = GILT[0] + (n - 0.5) * 46 - s * 22;
    img.data[i * 4 + 1] = GILT[1] + (n - 0.5) * 42 - s * 20;
    img.data[i * 4 + 2] = GILT[2] + (n - 0.5) * 34 - s * 14;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const [rc, rctx] = makeCanvas(S, S);
  const ri = rctx.createImageData(S, S);
  for (let i = 0; i < S * S; i++) {
    const v = (0.2 + f[i] * 0.34 + g2[i] * 0.12) * 255;
    ri.data[i * 4] = ri.data[i * 4 + 1] = ri.data[i * 4 + 2] = v; ri.data[i * 4 + 3] = 255;
  }
  rctx.putImageData(ri, 0, 0);
  return new THREE.MeshStandardMaterial({
    map: tex(c, { srgb: true, repeat: [2, 2] }), roughnessMap: tex(rc, { repeat: [2, 2] }),
    metalness: 1, roughness: 1, envMapIntensity: 1.8, color: 0xffffff,
  });
}

// ---------------------------------------------------------------------------
// Ceiling fresco — sky oval in a coved stucco field
// ---------------------------------------------------------------------------
export function frescoMaterial(w = 1024, h = 768) {
  const [c, ctx] = makeCanvas(w, h);
  const rnd = mulberry32(31);
  // stucco field
  const field = ctx.createLinearGradient(0, 0, 0, h);
  field.addColorStop(0, '#f0d9c8'); field.addColorStop(0.5, '#f5e2d2'); field.addColorStop(1, '#eed3c1');
  ctx.fillStyle = field; ctx.fillRect(0, 0, w, h);

  // sky oval
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(w / 2, h / 2, w * 0.36, h * 0.38, 0, 0, Math.PI * 2);
  ctx.clip();
  const sky = ctx.createRadialGradient(w * 0.46, h * 0.4, w * 0.02, w / 2, h / 2, w * 0.4);
  sky.addColorStop(0, '#eaf2f8'); sky.addColorStop(0.32, '#bcd6ec');
  sky.addColorStop(0.66, '#9dc0de'); sky.addColorStop(1, '#cfd9df');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
  // cumulus banks
  for (let i = 0; i < 200; i++) {
    const a = rnd() * Math.PI * 2, r = Math.pow(rnd(), 0.55);
    const x = w / 2 + Math.cos(a) * r * w * 0.36;
    const y = h / 2 + Math.sin(a) * r * h * 0.37;
    const s = (30 + rnd() * 150) * (0.5 + r);
    const warm = rnd() > 0.55;
    const gr = ctx.createRadialGradient(x, y, 0, x, y, s);
    gr.addColorStop(0, warm ? 'rgba(255,238,222,0.5)' : 'rgba(255,255,255,0.46)');
    gr.addColorStop(0.55, warm ? 'rgba(246,214,196,0.22)' : 'rgba(232,240,248,0.2)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gr;
    ctx.beginPath(); ctx.ellipse(x, y, s, s * (0.5 + rnd() * 0.3), rnd() * Math.PI, 0, Math.PI * 2); ctx.fill();
  }
  // sun-warmed break, upper left
  const glow = ctx.createRadialGradient(w * 0.36, h * 0.34, 0, w * 0.36, h * 0.34, w * 0.22);
  glow.addColorStop(0, 'rgba(255,244,214,0.7)'); glow.addColorStop(1, 'rgba(255,244,214,0)');
  ctx.fillStyle = glow; ctx.fillRect(0, 0, w, h);
  // figure groups implied as warm drapery masses at the rim
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2 + rnd() * 0.2;
    const x = w / 2 + Math.cos(a) * w * 0.3;
    const y = h / 2 + Math.sin(a) * h * 0.31;
    const s = 40 + rnd() * 70;
    const hue = [26, 12, 210, 38][(rnd() * 4) | 0];
    const gr = ctx.createRadialGradient(x, y, 0, x, y, s);
    gr.addColorStop(0, `hsla(${hue}, 46%, 68%, .5)`);
    gr.addColorStop(1, `hsla(${hue}, 46%, 68%, 0)`);
    ctx.fillStyle = gr;
    ctx.beginPath(); ctx.ellipse(x, y, s, s * 0.7, rnd() * 3, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();

  // gilt oval frame + stucco strapwork around it, drawn as relief layers
  const L = layers(w, h);
  const { pen } = L;
  const ring = (rx, ry, lw) => pen.stroke((cx) => { cx.beginPath(); cx.ellipse(w / 2, h / 2, rx, ry, 0, 0, Math.PI * 2); }, lw);
  ring(w * 0.362, h * 0.382, 26);
  ring(w * 0.386, h * 0.408, 10);
  ring(w * 0.345, h * 0.362, 6);
  // cartouches at the cardinal points
  shellCrest(pen, w / 2, h * 0.09, w * 0.075, 0);
  shellCrest(pen, w / 2, h * 0.91, w * 0.075, Math.PI);
  shellCrest(pen, w * 0.075, h / 2, w * 0.06, -Math.PI / 2);
  shellCrest(pen, 1 - w * 0.075 + w, h / 2, w * 0.06, Math.PI / 2);
  shellCrest(pen, w * 0.925, h / 2, w * 0.06, Math.PI / 2);
  // corner rocaille sprays
  const corners = [[0.07, 0.1, 1, 0], [0.93, 0.1, -1, 0], [0.07, 0.9, 1, -Math.PI / 2], [0.93, 0.9, -1, -Math.PI / 2]];
  for (const [fx, fy, fl, rot] of corners) {
    cScroll(pen, w * fx, h * fy, w * 0.09, rot, fl);
    acanthusSpray(pen, w * fx, h * fy, w * 0.07, rot + 0.6, fl);
  }
  // ribbon garlands linking them
  ribbonBand(pen, w * 0.16, h * 0.055, w * 0.84, h * 0.02, w * 0.1, 7);
  ribbonBand(pen, w * 0.16, h * 0.945, w * 0.84, h * 0.02, w * 0.1, 7);

  const set = bake(L.hc, L.gc, { ground: [240, 216, 200], gilt: GILT, giltDark: GILT_DK, normalStrength: 2.0 });
  // composite the painted sky under the relief albedo where there is no gilt
  const gData = L.gc.getContext('2d').getImageData(0, 0, w, h);
  const [outC, outCtx] = makeCanvas(w, h);
  outCtx.drawImage(c, 0, 0);
  const [giltOnly, goCtx] = makeCanvas(w, h);
  goCtx.drawImage(set.map.image, 0, 0);
  const go = goCtx.getImageData(0, 0, w, h);
  for (let i = 0; i < w * h; i++) go.data[i * 4 + 3] = gData.data[i * 4];
  goCtx.putImageData(go, 0, 0);
  outCtx.drawImage(giltOnly, 0, 0);

  return new THREE.MeshStandardMaterial({
    map: tex(outC, { srgb: true }), normalMap: set.normalMap,
    roughnessMap: set.roughnessMap, metalnessMap: set.metalnessMap, aoMap: set.aoMap,
    metalness: 1, roughness: 1, envMapIntensity: 1.1,
    normalScale: new THREE.Vector2(0.9, 0.9),
  });
}

// ---------------------------------------------------------------------------
// Parquet — herringbone oak
// ---------------------------------------------------------------------------
export function parquetMaterial(repeat = [6, 4]) {
  const S = 512;
  const [c, ctx] = makeCanvas(S, S);
  const [hc, hctx] = makeCanvas(S, S);
  ctx.fillStyle = '#8d6238'; ctx.fillRect(0, 0, S, S);
  hctx.fillStyle = '#b0b0b0'; hctx.fillRect(0, 0, S, S);
  const rnd = mulberry32(88);
  const plank = (x, y, w, h, rot) => {
    const l = 22 + rnd() * 16;
    ctx.save(); hctx.save();
    ctx.translate(x, y); ctx.rotate(rot);
    hctx.translate(x, y); hctx.rotate(rot);
    const base = `hsl(${26 + rnd() * 8}, ${34 + rnd() * 14}%, ${l}%)`;
    ctx.fillStyle = base; ctx.fillRect(-w / 2, -h / 2, w, h);
    // grain
    for (let i = 0; i < 26; i++) {
      const gy = -h / 2 + rnd() * h;
      ctx.strokeStyle = `hsla(${24 + rnd() * 8}, 40%, ${l - 6 + rnd() * 12}%, ${0.25 + rnd() * 0.4})`;
      ctx.lineWidth = 0.6 + rnd() * 1.6;
      ctx.beginPath(); ctx.moveTo(-w / 2, gy);
      ctx.bezierCurveTo(-w / 6, gy + (rnd() - 0.5) * 5, w / 6, gy + (rnd() - 0.5) * 5, w / 2, gy + (rnd() - 0.5) * 3);
      ctx.stroke();
    }
    hctx.fillStyle = `rgb(${170 + rnd() * 26 | 0},${170 + rnd() * 26 | 0},${170 + rnd() * 26 | 0})`;
    hctx.fillRect(-w / 2, -h / 2, w, h);
    hctx.strokeStyle = '#101010'; hctx.lineWidth = 3;
    hctx.strokeRect(-w / 2, -h / 2, w, h);
    ctx.strokeStyle = 'rgba(40,22,10,0.55)'; ctx.lineWidth = 1.6;
    ctx.strokeRect(-w / 2, -h / 2, w, h);
    ctx.restore(); hctx.restore();
  };
  const pw = 96, ph = 33;
  for (let gy = -1; gy < S / (pw * 0.72) + 1; gy++) {
    for (let gx = -1; gx < S / (pw * 0.72) + 1; gx++) {
      const bx = gx * pw * 0.72, by = gy * pw * 0.72 + (gx % 2 ? pw * 0.36 : 0);
      plank(bx, by, pw, ph, Math.PI / 4);
      plank(bx + pw * 0.36, by + pw * 0.36, pw, ph, -Math.PI / 4);
    }
  }
  return new THREE.MeshStandardMaterial({
    map: tex(c, { srgb: true, repeat }), normalMap: tex(heightToNormal(hc, 0.9), { repeat }),
    roughness: 0.42, metalness: 0, envMapIntensity: 1.0,
    normalScale: new THREE.Vector2(0.55, 0.55),
  });
}

export function marbleMaterial(base = [214, 205, 196], vein = [110, 92, 84], repeat = [2, 2]) {
  const S = 512;
  const [c, ctx] = makeCanvas(S, S);
  const f = fbmField(S, S, 303, 5, 4);
  const warp = fbmField(S, S, 304, 4, 3);
  const img = ctx.createImageData(S, S);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const i = y * S + x;
      const v = Math.abs(Math.sin((x / S + warp[i] * 2.4) * Math.PI * 3 + f[i] * 6));
      const streak = Math.pow(1 - v, 16);
      img.data[i * 4] = base[0] - streak * (base[0] - vein[0]) + (f[i] - 0.5) * 16;
      img.data[i * 4 + 1] = base[1] - streak * (base[1] - vein[1]) + (f[i] - 0.5) * 16;
      img.data[i * 4 + 2] = base[2] - streak * (base[2] - vein[2]) + (f[i] - 0.5) * 16;
      img.data[i * 4 + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return new THREE.MeshStandardMaterial({
    map: tex(c, { srgb: true, repeat }), roughness: 0.22, metalness: 0.02, envMapIntensity: 1.3,
  });
}

// Placeholder canvas for an unfilled painting slot: an aged, varnished ground.
export function placeholderArt(i, w = 512, h = 640) {
  const [c, ctx] = makeCanvas(w, h);
  const rnd = mulberry32(400 + i * 7);
  const hue = [28, 34, 18, 42, 200][i % 5];
  const g = ctx.createRadialGradient(w * 0.42, h * 0.36, 10, w * 0.5, h * 0.5, w);
  g.addColorStop(0, `hsl(${hue}, 26%, 34%)`);
  g.addColorStop(0.6, `hsl(${hue}, 30%, 18%)`);
  g.addColorStop(1, `hsl(${hue}, 34%, 9%)`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  for (let k = 0; k < 900; k++) {
    ctx.fillStyle = `hsla(${hue + (rnd() - 0.5) * 30}, ${20 + rnd() * 40}%, ${8 + rnd() * 46}%, ${0.05 + rnd() * 0.16})`;
    const x = rnd() * w, y = rnd() * h, s = 6 + rnd() * 60;
    ctx.beginPath(); ctx.ellipse(x, y, s, s * (0.3 + rnd()), rnd() * 3, 0, Math.PI * 2); ctx.fill();
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1;
  for (let k = 0; k < 260; k++) {
    ctx.beginPath();
    let x = rnd() * w, y = rnd() * h;
    ctx.moveTo(x, y);
    for (let s = 0; s < 4; s++) { x += (rnd() - 0.5) * 40; y += (rnd() - 0.5) * 40; ctx.lineTo(x, y); }
    ctx.stroke();
  }
  const t = tex(c, { srgb: true });
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}
