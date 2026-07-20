import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { DESK, BENCHES, PLINTHS, POTS } from './layout.js';
import { leafClusterTexture, flowerCardTexture } from '../utils/proctex.js';
import { applyWind } from './wind.js';

// Furniture and life: reception desk, benches, plinth sculptures, potted
// plants, wall signage, and dust motes drifting in the sun shaft.

export function buildDetails(scene, mats, tier) {
  const group = new THREE.Group();
  group.name = 'details';

  // --- reception desk -------------------------------------------------------
  const dw = DESK.x1 - DESK.x0, dd = DESK.z1 - DESK.z0;
  const dx = (DESK.x0 + DESK.x1) / 2, dz = (DESK.z0 + DESK.z1) / 2;
  const deskBody = new THREE.Mesh(new THREE.BoxGeometry(dw, DESK.h - 0.05, dd), mats.woodDark);
  deskBody.position.set(dx, (DESK.h - 0.05) / 2, dz);
  const deskTop = new THREE.Mesh(new THREE.BoxGeometry(dw + 0.12, 0.05, dd + 0.12), mats.marble);
  deskTop.position.set(dx, DESK.h - 0.025, dz);
  group.add(deskBody, deskTop);

  // brass reading lamp on the desk
  const lampBase = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.04, 12), mats.brass);
  lampBase.position.set(dx, DESK.h + 0.02, dz - 0.75);
  const lampStem = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.34, 8), mats.brass);
  lampStem.position.set(dx, DESK.h + 0.2, dz - 0.75);
  const lampShade = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.1, 0.11, 12, 1, true), mats.brass);
  lampShade.position.set(dx, DESK.h + 0.38, dz - 0.75);
  const lampGlow = new THREE.PointLight(0xffd9a0, 3, 2.2, 2);
  lampGlow.position.set(dx, DESK.h + 0.33, dz - 0.75);
  group.add(lampBase, lampStem, lampShade, lampGlow);

  // a small vase of flowers on the desk
  const vase = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 0.16, 10), mats.marble);
  vase.position.set(dx - 0.05, DESK.h + 0.08, dz + 0.7);
  const vaseFlowers = cardCross(flowerCardTexture(256, 501, 335), 0.3, 0.38);
  vaseFlowers.position.set(dx - 0.05, DESK.h + 0.3, dz + 0.7);
  group.add(vase, vaseFlowers);

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

  // --- wall signage above the desk -----------------------------------------
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(2.2, 0.62),
    new THREE.MeshBasicMaterial({ map: signTexture(), transparent: true })
  );
  sign.position.set(0.17, 2.55, 12.0);
  sign.rotation.y = Math.PI / 2;
  group.add(sign);

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
  const motes = new THREE.Points(moteGeo, new THREE.PointsMaterial({
    map: moteTexture(), size: 0.035, transparent: true, opacity: 0.5,
    blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
  }));
  motes.name = 'dust-motes';
  group.add(motes);

  group.traverse((o) => {
    if (o.isMesh && o.name !== 'dust-motes') { o.castShadow = true; o.receiveShadow = true; }
  });

  scene.add(group);

  function update(t) {
    const pos = moteGeo.attributes.position;
    for (let i = 0; i < moteCount; i++) {
      const s = seeds[i];
      pos.array[i * 3] += Math.sin(t * 0.24 + s) * 0.0009;
      pos.array[i * 3 + 1] += Math.cos(t * 0.17 + s * 1.7) * 0.0007 - 0.0004;
      if (pos.array[i * 3 + 1] < 0) pos.array[i * 3 + 1] = 6.5;
      pos.array[i * 3 + 2] += Math.sin(t * 0.2 + s * 2.3) * 0.0008;
    }
    pos.needsUpdate = true;
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

function signTexture() {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 288;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 1024, 288);
  ctx.fillStyle = '#2a2521';
  ctx.textAlign = 'center';
  ctx.font = '600 128px "Cormorant Garamond", Georgia, serif';
  ctx.fillText('iExploreArt', 512, 150);
  ctx.font = '500 34px Inter, sans-serif';
  ctx.fillStyle = '#6f675f';
  ctx.fillText('A   G A L L E R Y   B Y   J F E E L G O O D', 512, 224);
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
