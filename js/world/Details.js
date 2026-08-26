import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { BENCHES, PLINTHS, POTS } from './layout.js';
import { leafClusterTexture, flowerCardTexture } from '../utils/proctex.js';
import { applyWind } from './wind.js';

// Furniture and life: benches, plinth sculptures, potted plants, and dust
// motes drifting in the sun shaft. The reception desk build lives here too,
// but as an export — the desk itself moved out to the foyer
// (js/world/foyer.js) when the reception did; this hall no longer sets it up.

// The reception desk: dark-wood body, marble top, brass reading lamp, vase of
// flowers. `desk` is a DESK-style rect {x0,x1,z0,z1,h}; the caller owns the
// matching collider.
export function buildReceptionDesk(group, mats, desk) {
  const dw = desk.x1 - desk.x0, dd = desk.z1 - desk.z0;
  const dx = (desk.x0 + desk.x1) / 2, dz = (desk.z0 + desk.z1) / 2;
  const deskBody = new THREE.Mesh(new THREE.BoxGeometry(dw, desk.h - 0.05, dd), mats.woodDark);
  deskBody.position.set(dx, (desk.h - 0.05) / 2, dz);
  const deskTop = new THREE.Mesh(new THREE.BoxGeometry(dw + 0.12, 0.05, dd + 0.12), mats.marble);
  deskTop.position.set(dx, desk.h - 0.025, dz);
  group.add(deskBody, deskTop);

  // brass reading lamp on the desk
  const lampBase = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.04, 12), mats.brass);
  lampBase.position.set(dx, desk.h + 0.02, dz - 0.75);
  const lampStem = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.34, 8), mats.brass);
  lampStem.position.set(dx, desk.h + 0.2, dz - 0.75);
  const lampShade = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.1, 0.11, 12, 1, true), mats.brass);
  lampShade.position.set(dx, desk.h + 0.38, dz - 0.75);
  const lampGlow = new THREE.PointLight(0xffd9a0, 3, 2.2, 2);
  lampGlow.position.set(dx, desk.h + 0.33, dz - 0.75);
  group.add(lampBase, lampStem, lampShade, lampGlow);

  // a small vase of flowers on the desk
  const vase = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 0.16, 10), mats.marble);
  vase.position.set(dx - 0.05, desk.h + 0.08, dz + 0.7);
  const vaseFlowers = cardCross(flowerCardTexture(256, 501, 335), 0.3, 0.38);
  vaseFlowers.position.set(dx - 0.05, desk.h + 0.3, dz + 0.7);
  group.add(vase, vaseFlowers);
}

export function buildDetails(scene, mats, tier) {
  const group = new THREE.Group();
  group.name = 'details';

  // --- benches --------------------------------------------------------------
  for (const b of BENCHES) {
    const bench = new THREE.Group();
    const seat = new THREE.Mesh(new THREE.BoxGeometry(b.w, 0.07, b.d), mats.woodDark);
    seat.position.y = 0.41;
    const cushion = new THREE.Mesh(new THREE.BoxGeometry(b.w - 0.06, 0.07, b.d - 0.06), mats.fabric);
    cushion.position.y = 0.48;
    bench.add(seat, cushion);
    for (const sx of [-b.w / 2 + 0.12, b.w / 2 - 0.12]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.38, b.d - 0.1), mats.steel);
      leg.position.set(sx, 0.19, 0);
      bench.add(leg);
    }
    bench.position.set(b.x, 0, b.z);
    bench.rotation.y = b.ry;
    group.add(bench);
  }

  // --- plinths with small sculptures ---------------------------------------
  const knotGeo = new THREE.TorusKnotGeometry(0.11, 0.035, 90, 12);
  for (let i = 0; i < PLINTHS.length; i++) {
    const p = PLINTHS[i];
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(p.s, 1.05, p.s), mats.plaster);
    plinth.position.set(p.x, 0.525, p.z);
    const sculpt = new THREE.Mesh(
      i % 2 === 0 ? knotGeo : new THREE.SphereGeometry(0.14, 24, 18),
      mats.marble
    );
    if (i % 2 !== 0) sculpt.scale.set(1, 1.35, 0.8);
    sculpt.position.set(p.x, 1.05 + 0.17, p.z);
    sculpt.rotation.y = i * 1.3;
    group.add(plinth, sculpt);
  }

  // --- potted plants --------------------------------------------------------
  const leafTex = leafClusterTexture(256, 31, 8);
  for (const pot of POTS) {
    const potMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.19, 0.42, 12), mats.concrete);
    potMesh.position.set(pot.x, 0.21, pot.z);
    group.add(potMesh);
    for (let i = 0; i < 3; i++) {
      const card = cardCross(leafTex, 0.8, 1.0);
      card.position.set(pot.x + (i - 1) * 0.08, 0.86 + i * 0.06, pot.z + (i - 1) * 0.05);
      card.rotation.y = i * 1.1;
      group.add(card);
    }
  }

  // --- dust motes in the sun shaft -----------------------------------------
  const moteCount = tier.motes;
  const positions = new Float32Array(moteCount * 3);
  const seeds = new Float32Array(moteCount);
  for (let i = 0; i < moteCount; i++) {
    positions[i * 3] = 4 + Math.random() * 16;
    positions[i * 3 + 1] = Math.random() * 6.5;
    positions[i * 3 + 2] = 6 + Math.random() * 7.5;
    seeds[i] = Math.random() * Math.PI * 2;
  }
  const moteGeo = new THREE.BufferGeometry();
  moteGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  moteGeo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
  // Drift lives in the vertex shader (driven by one uTime uniform) instead of a
  // per-frame CPU loop that re-uploaded the whole position buffer every frame.
  // The offsets below are the closed-form integral of the old per-frame motion
  // (amplitude = frame-increment × 60fps ÷ angular rate), zeroed at t=0 so the
  // look is identical — now also frame-rate independent.
  const moteUniforms = { uTime: { value: 0 } };
  const moteMat = new THREE.PointsMaterial({
    map: moteTexture(), size: 0.035, transparent: true, opacity: 0.5,
    blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
  });
  moteMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = moteUniforms.uTime;
    shader.vertexShader = 'attribute float aSeed;\nuniform float uTime;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      {
        float s = aSeed;
        transformed.x += 0.225 * (cos(s) - cos(0.24 * uTime + s));
        float yo = 0.247 * (sin(0.17 * uTime + s * 1.7) - sin(s * 1.7)) - 0.024 * uTime;
        transformed.y = mod(transformed.y + yo, 6.5);
        transformed.z += 0.24 * (cos(s * 2.3) - cos(0.2 * uTime + s * 2.3));
      }`
    );
  };
  const motes = new THREE.Points(moteGeo, moteMat);
  motes.name = 'dust-motes';
  group.add(motes);

  group.traverse((o) => {
    if (o.isMesh && o.name !== 'dust-motes') { o.castShadow = true; o.receiveShadow = true; }
  });

  scene.add(group);

  function update(t) {
    moteUniforms.uTime.value = t;
  }

  return { group, update };
}

function cardCross(tex, w, h) {
  const mat = new THREE.MeshStandardMaterial({
    map: tex, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.95,
  });
  applyWind(mat, { strength: 0.015, y0: 0, y1: 2.4 });
  const g = mergeGeometries([
    new THREE.PlaneGeometry(w, h),
    new THREE.PlaneGeometry(w, h).rotateY(Math.PI / 2),
  ]);
  return new THREE.Mesh(g, mat);
}

// Painted wall signage: a serif title over a letter-spaced grey subtitle, on a
// transparent ground so the wall shows through. Used by the foyer for the desk
// sign and the door lintel (js/world/foyer.js). The subtitle is spaced here so
// callers pass plain words.
export function signTexture(title, subtitle) {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 288;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 1024, 288);
  ctx.textAlign = 'center';
  // Either line shrinks to fit rather than running off the plate — the
  // featured show's name (data/featured.js) is whatever length it is.
  const fit = (text, weight, size, family, maxW = 940) => {
    ctx.font = `${weight} ${size}px ${family}`;
    const w = ctx.measureText(text).width;
    if (w > maxW) ctx.font = `${weight} ${Math.floor((size * maxW) / w)}px ${family}`;
  };
  ctx.fillStyle = '#2a2521';
  fit(title, 600, 128, '"Cormorant Garamond", Georgia, serif');
  ctx.fillText(title, 512, 150);
  if (subtitle) {
    const spaced = subtitle.toUpperCase().split('').join(' ');
    ctx.fillStyle = '#6f675f';
    fit(spaced, 500, 34, 'Inter, sans-serif');
    ctx.fillText(spaced, 512, 224);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// A painted title wall: the show's name stacked one word a line, the artist
// under it, then a word-wrapped statement — all on a transparent ground so the
// wall's own material reads through the letters. The ink is the caller's:
// pale on the chadrea pier's dark concrete (js/world/chadrea/chadrea.js),
// dark — the signTexture palette above — on the foyer's light plaster.
export function plaqueTexture({
  title, artist, body,
  width = 1024, height = 1386,
  ink = '#2a2521', sub = '#6f675f',
}) {
  const c = document.createElement('canvas');
  c.width = width; c.height = height;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = ink;
  ctx.textAlign = 'left';
  const M = 72;                       // margin
  let y = 190;
  ctx.font = '600 118px "Cormorant Garamond", Georgia, serif';
  for (const word of title.split(' ')) {   // one word a line, stacked
    ctx.fillText(word, M, y);
    y += 128;
  }
  y += 8;
  ctx.font = '500 46px Inter, sans-serif';
  ctx.fillStyle = sub;
  ctx.fillText(artist, M, y);
  y += 110;
  // the statement, word-wrapped
  ctx.font = '400 31px Inter, sans-serif';
  ctx.fillStyle = ink;
  const words = body.split(' ');
  let line = '';
  for (const w of words) {
    const probe = line ? `${line} ${w}` : w;
    if (ctx.measureText(probe).width > width - M * 2 && line) {
      ctx.fillText(line, M, y);
      y += 48;
      line = w;
    } else {
      line = probe;
    }
  }
  if (line) ctx.fillText(line, M, y);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function moteTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, 'rgba(255,244,220,1)');
  g.addColorStop(1, 'rgba(255,244,220,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
}
