import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  leadedGlassMaterial, mosaicFloorMaterial, mahoganyMaterial, brassMaterial, ironMaterial,
  opalMaterial, friezeMaterial, inlayMaterial, stuccoMaterial, greenMarbleMaterial, nouveauArt,
} from './js/nouveau-surfaces.js';

// ---------------------------------------------------------------------------
// An art nouveau picture hall, after Horta's Hôtel van Eetvelde: a nine-sided
// room — eight mahogany picture bays and one arched entranceway — separated by
// canted facets of leaded glass, brass colonnettes carrying a glazed dome,
// green mosaic paving, and a curved mahogany stair in the hall beyond.
//
//   const room = buildNouveauRoom(scene, { shadowSize: 1024 });
//   room.setImage(0, 'assets/art/lily.webp');
//
// The file also registers <nouveau-hall>, a self-contained walkthrough viewer.
// ---------------------------------------------------------------------------

export const HALL = {
  N: 9,            // wall bays
  A: 6.0,          // apothem: centre to a bay wall
  bayW: 3.0,
  wallH: 6.0,
  domeR: 7.8,
  rim: 6.15,       // radius at which the dome springs
  floorSpan: 14,
};
HALL.domeCY = HALL.wallH - Math.sqrt(HALL.domeR ** 2 - HALL.rim ** 2);
HALL.domePhi = Math.asin(HALL.rim / HALL.domeR);
HALL.crownY = HALL.domeCY + HALL.domeR;

// the entrance occupies the bay on the +z axis; the rest carry pictures
const ENTRY_BAY = 0;
const PORTAL = { w: 2.2, springY: 2.9, r: 1.1 };
const PICT = { w: 1.72, h: 2.1, y: 2.44 };
// the stair hall beyond the portal
export const VEST = { x: 4.3, z0: 6.4, z1: 11.6, h: 4.7 };
const STAIR = { cx: 1.6, cz: 9.2, rIn: 0.95, rOut: 2.5, rRail: 2.32, steps: 16, a0: -105, da: 10, rise: 0.185 };

// --- plan ------------------------------------------------------------------
function plan() {
  const { N, A, bayW } = HALL;
  const bays = [];
  for (let k = 0; k < N; k++) {
    const th = (k * Math.PI * 2) / N;
    const c = new THREE.Vector2(Math.sin(th) * A, Math.cos(th) * A);
    const t = new THREE.Vector2(Math.cos(th), -Math.sin(th));
    bays.push({ k, a: c.clone().addScaledVector(t, -bayW / 2), b: c.clone().addScaledVector(t, bayW / 2) });
  }
  const segs = [], poly = [];
  for (let k = 0; k < N; k++) {
    const bay = bays[k], next = bays[(k + 1) % N];
    segs.push({ kind: 'bay', index: k, ...span(bay.a, bay.b) });
    segs.push({ kind: 'facet', index: k, ...span(bay.b, next.a) });
    poly.push(bay.a, bay.b);
  }
  return { segs, poly };
}

function span(p, q) {
  const mid = p.clone().add(q).multiplyScalar(0.5);
  const d = q.clone().sub(p);
  const len = d.length();
  d.normalize();
  let ry = Math.atan2(-d.y, d.x);
  const n = new THREE.Vector2(Math.sin(ry), Math.cos(ry));
  if (n.dot(mid.clone().negate()) < 0) ry += Math.PI;
  return { x: mid.x, z: mid.y, len, ry, nx: Math.sin(ry), nz: Math.cos(ry) };
}

export function buildNouveauRoom(scene, opts = {}) {
  const tier = { shadowSize: 1024, anisotropy: 8, ...opts };
  const group = new THREE.Group();
  group.name = 'nouveau-hall';
  const { segs, poly } = plan();

  // ---- materials ----------------------------------------------------------
  const M = {
    mosaic: mosaicFloorMaterial(1024),
    mahogany: mahoganyMaterial([1, 1]),
    mahoganyDoor: mahoganyMaterial([1, 1], { light: 0.35 }),
    mahoganyFine: Object.assign(mahoganyMaterial([3, 3]), { roughness: 0.42, envMapIntensity: 0.75 }),
    brass: brassMaterial(6),
    brassDeep: brassMaterial(11, { rough: 0.3 }),
    iron: ironMaterial(),
    opal: opalMaterial(1.1),
    frieze: friezeMaterial(1),
    inlay: inlayMaterial(0.26, 4),
    stucco: stuccoMaterial([228, 218, 196], [3, 3]),
    marble: greenMarbleMaterial([2, 2]),
    glassIris: leadedGlassMaterial({ W: 384, H: 640, motif: 'iris', cell: 26, seed: 7, glow: 0.8 }),
    glassPeacock: leadedGlassMaterial({ W: 512, H: 384, motif: 'peacock', cell: 26, seed: 13, glow: 0.78 }),
    glassTendril: leadedGlassMaterial({ W: 512, H: 256, motif: 'tendril', cell: 24, seed: 21, glow: 0.72 }),
    glassDome: leadedGlassMaterial({ W: 256, H: 512, motif: 'domePanel', cell: 22, seed: 5, repeat: [16, 1], glow: 0.95 }),
    glassRose: leadedGlassMaterial({ W: 512, H: 512, motif: 'rosette', cell: 22, seed: 9, glow: 1.05 }),
  };
  const glassMats = [M.glassIris, M.glassPeacock, M.glassTendril, M.glassDome, M.glassRose];

  const perMetre = (mat, ru, rv) => {
    const c = mat.clone();
    for (const k of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'alphaMap', 'emissiveMap']) {
      if (c[k]) { c[k] = c[k].clone(); c[k].needsUpdate = true; c[k].repeat.set(ru, rv); }
    }
    return c;
  };
  const uv1 = (g) => {
    if (g.attributes.uv && !g.attributes.uv1) g.setAttribute('uv1', g.attributes.uv.clone());
    return g;
  };
  const panel = (w, h, mat, s, y, inset, parent = group) => {
    const m = new THREE.Mesh(uv1(new THREE.PlaneGeometry(w, h)), mat);
    m.position.set(s.x + s.nx * inset, y, s.z + s.nz * inset);
    m.rotation.y = s.ry;
    m.receiveShadow = true;
    parent.add(m); return m;
  };
  // a box placed in a wall segment's frame: u along the wall, inset inward
  const inWall = (s, w, h, d, u, y, inset, mat, parent = group) => {
    const m = new THREE.Mesh(uv1(new THREE.BoxGeometry(w, h, d)), mat);
    const tx = Math.cos(s.ry), tz = -Math.sin(s.ry);
    m.position.set(s.x + tx * u + s.nx * inset, y, s.z + tz * u + s.nz * inset);
    m.rotation.y = s.ry;
    m.castShadow = true; m.receiveShadow = true;
    parent.add(m); return m;
  };
  const atWall = (s, u, inset) => {
    const tx = Math.cos(s.ry), tz = -Math.sin(s.ry);
    return [s.x + tx * u + s.nx * inset, s.z + tz * u + s.nz * inset];
  };

  // ---- floor --------------------------------------------------------------
  const shape = new THREE.Shape(poly.map(v => new THREE.Vector2(v.x, -v.y)));
  const floorGeo = uv1(new THREE.ShapeGeometry(shape));
  floorGeo.rotateX(-Math.PI / 2);
  for (const k of ['map', 'normalMap']) {
    const t = M.mosaic[k];
    if (t) {
      t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
      t.repeat.set(1 / HALL.floorSpan, 1 / HALL.floorSpan);
      t.offset.set(0.5, 0.5);
    }
  }
  const floor = new THREE.Mesh(floorGeo, M.mosaic);
  floor.receiveShadow = true; floor.name = 'mosaic-floor';
  group.add(floor);

  // ---- walls, bay by bay --------------------------------------------------
  const slots = [];
  for (const s of segs) {
    const L = s.len;
    const isEntry = s.kind === 'bay' && s.index === ENTRY_BAY;

    // structural backing — split around the portal
    if (isEntry) {
      const pier = (L - PORTAL.w) / 2;
      for (const sx of [-1, 1]) {
        inWall(s, pier + 0.2, HALL.wallH + 0.3, 0.36, sx * (PORTAL.w + pier) / 2, (HALL.wallH + 0.3) / 2, -0.2, M.stucco);
      }
      inWall(s, L + 0.4, HALL.wallH - 4.0 + 0.3, 0.36, 0, 4.0 + (HALL.wallH - 4.0 + 0.3) / 2, -0.2, M.stucco);
    } else {
      inWall(s, L + 0.4, HALL.wallH + 0.3, 0.36, 0, (HALL.wallH + 0.3) / 2, -0.2, M.stucco);
      // brass skirting, marble dado, mahogany rail
      inWall(s, L, 0.17, 0.1, 0, 0.085, 0.05, M.brassDeep);
      inWall(s, L, 0.86, 0.09, 0, 0.6, 0.045, perMetre(M.marble, L / 2.4, 0.5));
      inWall(s, L, 0.11, 0.17, 0, 1.09, 0.06, M.mahogany);
      inWall(s, L, 0.035, 0.2, 0, 1.165, 0.07, M.brass);
    }
    // frieze, cornice and the clerestory run right round
    inWall(s, L, 0.34, 0.1, 0, 4.57, 0.05, perMetre(M.frieze, L / 1.9, 1));
    inWall(s, L, 0.16, 0.26, 0, 5.9, 0.08, M.brassDeep);
    panel(L - 0.06, 1.06, perMetre(M.glassTendril, Math.max(1, Math.round(L / 1.6)), 1), s, 5.31, 0.035);
    const bars = Math.max(1, Math.round(L / 0.62));
    for (let i = 1; i < bars; i++) inWall(s, 0.045, 1.06, 0.07, -L / 2 + (i / bars) * L, 5.31, 0.075, M.brass);
    inWall(s, L, 0.05, 0.1, 0, 4.78, 0.07, M.brass);

    if (isEntry) { buildPortal(M, s, { inWall, panel, atWall, perMetre, group }); continue; }

    if (s.kind === 'bay') {
      // mahogany field with marquetry either side of the picture
      panel(L, 3.2, perMetre(M.mahogany, L / 1.6, 2), s, 2.8, 0.02);
      for (const sx of [-1, 1]) {
        const [mx, mz] = atWall(s, sx * (L / 2 - 0.34), 0.045);
        const m = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 2.7), M.inlay);
        m.position.set(mx, 2.74, mz); m.rotation.y = s.ry;
        group.add(m);
      }
      const f = buildFrame(M, PICT.w, PICT.h, slots.length);
      const [fx, fz] = atWall(s, 0, 0.06);
      f.position.set(fx, PICT.y, fz); f.rotation.y = s.ry;
      group.add(f);
      slots.push(f.userData.slot);
      continue;
    }

    // --- facets: slender iris / peacock casements ---
    const ww = Math.min(0.78, L - 0.5);
    const alt = s.index % 3 === 1;
    panel(L, 3.2, perMetre(M.mahogany, L / 1.6, 2), s, 2.8, 0.015);
    panel(ww, 2.9, perMetre(alt ? M.glassPeacock : M.glassIris, 1, 1), s, 2.72, 0.03);
    for (const sx of [-1, 1]) inWall(s, 0.07, 3.02, 0.13, sx * (ww / 2 + 0.035), 2.72, 0.06, M.brass);
    for (const y of [1.27, 4.19]) inWall(s, ww + 0.14, 0.08, 0.14, 0, y, 0.06, M.brass);
    for (const y of [2.0, 3.44]) inWall(s, ww, 0.04, 0.09, 0, y, 0.065, M.brass);
    inWall(s, ww + 0.34, 0.1, 0.22, 0, 1.2, 0.08, M.marble);
  }

  // ---- colonnettes at every polygon vertex --------------------------------
  const verts = poly.map(v => ({ x: v.x, z: v.y, az: Math.atan2(v.x, v.y) }));
  verts.forEach((v, i) => {
    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.21, 0.36, 16), M.marble);
    plinth.position.set(v.x, 0.18, v.z);
    plinth.castShadow = true; plinth.receiveShadow = true; group.add(plinth);
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.115, 5.5, 18), M.brass);
    shaft.position.set(v.x, 3.11, v.z);
    shaft.castShadow = true; group.add(shaft);
    for (const y of [1.24, 3.0, 4.62]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.03, 8, 20), M.brassDeep);
      ring.position.set(v.x, y, v.z); ring.rotation.x = Math.PI / 2;
      ring.castShadow = true; group.add(ring);
    }
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.13, 0.2, 18), M.brassDeep);
    cap.position.set(v.x, 5.94, v.z); cap.castShadow = true; group.add(cap);
    const br = new THREE.Group();
    br.position.set(v.x, 5.82, v.z);
    br.rotation.y = v.az - Math.PI / 2;
    const arc = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.045, 8, 18, Math.PI * 0.48), M.brass);
    arc.rotation.z = Math.PI; arc.position.y = 0.5; arc.castShadow = true;
    br.add(arc);
    group.add(br);
    if (i % 2 === 0) group.add(buildSconce(M, v));
  });

  // ---- dome, stair hall, fittings ----------------------------------------
  group.add(buildDome(M, verts));
  const lights = buildLights(scene, tier);
  group.add(buildVestibule(M, lights));
  group.add(buildPendant(M, lights));
  for (let k = 0; k < 4; k++) {
    const az = Math.PI / 4 + (k * Math.PI) / 2;
    group.add(buildTorchere(M, Math.sin(az) * 4.3, Math.cos(az) * 4.3, -az, lights));
  }

  mergeStatics(group, new Set());
  scene.add(group);

  return {
    group, slots, lights, HALL, VEST, glassMats,
    spawn: { x: 0, y: 1.66, z: 4.2 },
    radius: HALL.A - 1.05,
    setImage(i, url) { slots[i] && slots[i].setImage(url); },
    setGlassGlow(k) {
      for (const m of glassMats) m.emissiveIntensity = (m.userData.glow ?? 1) * k;
      M.opal.emissiveIntensity = (M.opal.userData.glow ?? 1.1) * Math.max(0.4, k);
    },
    dispose() { group.traverse(o => o.geometry?.dispose?.()); },
  };
}

// ---------------------------------------------------------------------------
// The entranceway: a brass-ringed arch with a leaded fanlight, marble threshold
// and mahogany reveals, opening onto the stair hall.
function buildPortal(M, s, H) {
  const { inWall, panel, atWall, perMetre, group } = H;
  const L = s.len, pier = (L - PORTAL.w) / 2;
  const crown = PORTAL.springY + PORTAL.r;

  for (const sx of [-1, 1]) {
    const u = sx * (PORTAL.w + pier) / 2;
    inWall(s, pier, 0.17, 0.14, u, 0.085, 0.06, M.brassDeep);
    inWall(s, pier, 1.0, 0.13, u, 0.67, 0.055, perMetre(M.marble, 0.5, 0.6));
    inWall(s, pier, 0.12, 0.2, u, 1.23, 0.07, M.mahogany);
    inWall(s, pier, 3.0, 0.1, u, 2.8, 0.04, perMetre(M.mahogany, 0.4, 1.8));
    // the reveal, turning into the hall beyond
    inWall(s, 0.34, crown, 0.12, sx * (PORTAL.w / 2 + 0.06), crown / 2, -0.16, M.mahogany);
    inWall(s, 0.16, crown + 0.1, 0.22, sx * (PORTAL.w / 2 + 0.07), (crown + 0.1) / 2, 0.07, M.brass);
  }
  // arch ring and fanlight
  const [ax, az] = atWall(s, 0, 0.07);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(PORTAL.r + 0.09, 0.1, 10, 40, Math.PI), M.brass);
  ring.position.set(ax, PORTAL.springY, az); ring.rotation.y = s.ry;
  ring.castShadow = true;
  group.add(ring);
  const fan = new THREE.Mesh(new THREE.CircleGeometry(PORTAL.r, 40, 0, Math.PI), perMetre(M.glassTendril, 1, 1));
  const [fx, fz] = atWall(s, 0, 0.02);
  fan.position.set(fx, PORTAL.springY, fz); fan.rotation.y = s.ry;
  group.add(fan);
  const bar = inWall(s, PORTAL.w + 0.1, 0.11, 0.24, 0, PORTAL.springY - 0.05, 0.05, M.brass);
  bar.castShadow = true;
  for (let i = 1; i < 4; i++) {
    const a = (i / 4) * Math.PI;
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(PORTAL.r - 0.06, 0.04, 0.05), M.brass);
    const [px, pz] = atWall(s, Math.cos(a) * (PORTAL.r - 0.06) / 2, 0.05);
    spoke.position.set(px, PORTAL.springY + Math.sin(a) * (PORTAL.r - 0.06) / 2, pz);
    spoke.rotation.y = s.ry; spoke.rotation.z = a;
    group.add(spoke);
  }
  // panel between arch crown and frieze, and a marble threshold
  panel(L, 4.4 - crown - 0.06, perMetre(M.mahogany, L / 1.6, 0.5), s, crown + (4.4 - crown) / 2, 0.03);
  inWall(s, PORTAL.w + 0.5, 0.045, 0.7, 0, 0.022, -0.1, perMetre(M.marble, 1.2, 0.4));
}
// ---------------------------------------------------------------------------
function buildDome(M, verts) {
  const g = new THREE.Group(); g.name = 'dome';
  const { domeR: R, domeCY: cy, domePhi: phi, rim, wallH, crownY } = HALL;

  const cap = new THREE.Mesh(new THREE.SphereGeometry(R, 64, 24, 0, Math.PI * 2, 0, phi), M.glassDome);
  cap.position.y = cy; cap.name = 'dome-glass';
  g.add(cap);
  const shell = new THREE.Mesh(new THREE.SphereGeometry(R + 0.12, 40, 18, 0, Math.PI * 2, 0, phi), M.stucco.clone());
  shell.position.y = cy;
  shell.material.side = THREE.BackSide;
  g.add(shell);

  const rimRing = new THREE.Mesh(new THREE.TorusGeometry(rim + 0.05, 0.1, 10, 96), M.brassDeep);
  rimRing.position.y = wallH; rimRing.rotation.x = Math.PI / 2;
  rimRing.castShadow = true; g.add(rimRing);

  for (const v of verts) {
    const rib = new THREE.Group();
    rib.position.y = cy;
    rib.rotation.y = v.az - Math.PI / 2;
    const arc = new THREE.Mesh(new THREE.TorusGeometry(R, 0.055, 8, 44, phi), M.brass);
    arc.rotation.z = Math.PI / 2 - phi;
    arc.castShadow = true;
    rib.add(arc);
    g.add(rib);
  }
  for (const t of [0.3, 0.58, 0.84]) {
    const p = phi * t;
    const hoop = new THREE.Mesh(new THREE.TorusGeometry(R * Math.sin(p), 0.04, 8, 72), M.brass);
    hoop.position.y = cy + R * Math.cos(p);
    hoop.rotation.x = Math.PI / 2;
    hoop.castShadow = true;
    g.add(hoop);
  }
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.66, 0.075, 10, 40), M.brassDeep);
  collar.position.y = crownY - 0.22; collar.rotation.x = Math.PI / 2; g.add(collar);
  const rose = new THREE.Mesh(new THREE.CircleGeometry(0.64, 48), M.glassRose);
  rose.position.y = crownY - 0.2; rose.rotation.x = Math.PI / 2;
  g.add(rose);
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.035, 0.035), M.brass);
    spoke.position.set(Math.cos(a) * 0.36, crownY - 0.19, Math.sin(a) * 0.36);
    spoke.rotation.y = -a;
    g.add(spoke);
  }
  return g;
}

// ---------------------------------------------------------------------------
// The stair hall behind the portal, and the curved mahogany flight in it.
function buildVestibule(M, lights) {
  const g = new THREE.Group(); g.name = 'stair-hall';
  const W = VEST.x * 2, D = VEST.z1 - VEST.z0, cz = (VEST.z0 + VEST.z1) / 2;

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), M.marble.clone());
  floor.material.map = floor.material.map.clone();
  floor.material.map.repeat.set(4, 4);
  floor.material.map.needsUpdate = true;
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0.001, cz);
  floor.receiveShadow = true;
  g.add(floor);
  // a mosaic runner leading in from the portal
  const runner = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.6), M.mosaic);
  runner.rotation.x = -Math.PI / 2;
  runner.position.set(0, 0.004, VEST.z0 + 1.3);
  runner.receiveShadow = true;
  g.add(runner);

  const wall = (w, h, x, y, z, ry, mat) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    m.position.set(x, y, z); m.rotation.y = ry;
    m.receiveShadow = true; g.add(m); return m;
  };
  const solid = (w, h, d, x, y, z, mat) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.castShadow = true; m.receiveShadow = true; g.add(m); return m;
  };
  const dadoM = M.mahoganyFine;
  const upperM = stuccoMaterial([214, 196, 168], [3, 3]);
  const friezeM = M.frieze.clone();
  friezeM.map = friezeM.map.clone(); friezeM.map.repeat.set(6, 1); friezeM.map.needsUpdate = true;

  // back wall, with an arched opening to the upper floor and a tall casement
  wall(W, VEST.h, 0, VEST.h / 2, VEST.z1, Math.PI, upperM);
  solid(W, 1.12, 0.12, 0, 0.56, VEST.z1 - 0.06, dadoM);
  solid(W, 0.12, 0.2, 0, 1.18, VEST.z1 - 0.1, M.brass);
  const win = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 2.6), M.glassIris);
  win.position.set(-2.3, 2.6, VEST.z1 - 0.1); win.rotation.y = Math.PI;
  g.add(win);
  for (const sx of [-1, 1]) solid(0.1, 2.74, 0.16, -2.3 + sx * 0.8, 2.6, VEST.z1 - 0.14, M.brass);
  for (const y of [1.24, 3.96]) solid(1.7, 0.1, 0.18, -2.3, y, VEST.z1 - 0.14, M.brass);
  for (const y of [2.0, 3.3]) solid(1.5, 0.045, 0.1, -2.3, y, VEST.z1 - 0.13, M.brass);
  // frieze and marquetry, so the stair hall belongs to the same room
  solid(W, 0.3, 0.08, 0, 3.62, VEST.z1 - 0.05, friezeM);
  for (const x of [0.4, 1.4]) {
    const inl = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 2.0), M.inlay);
    inl.position.set(-x - 0.4, 2.5, VEST.z1 - 0.08); inl.rotation.y = Math.PI;
    g.add(inl);
  }
  for (const sx of [-1, 1]) {
    solid(0.08, 0.3, D, sx * (VEST.x - 0.04), 3.62, cz, friezeM);
    for (const dz of [-1.4, 0.4, 2.0]) {
      const inl = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 2.0), M.inlay);
      inl.position.set(sx * (VEST.x - 0.07), 2.5, cz + dz);
      inl.rotation.y = -sx * Math.PI / 2;
      g.add(inl);
    }
  }
  // the doorway upstairs, at the head of the flight
  const top = STAIR.rise * STAIR.steps;
  solid(1.5, 0.14, 0.24, 2.6, top + 2.34, VEST.z1 - 0.12, M.brass);
  wall(1.3, 2.2, 2.6, top + 1.2, VEST.z1 - 0.14, Math.PI, new THREE.MeshBasicMaterial({ color: 0x140f0a }));
  for (const sx of [-1, 1]) solid(0.12, 2.3, 0.22, 2.6 + sx * 0.71, top + 1.15, VEST.z1 - 0.12, M.brass);

  // side walls
  for (const sx of [-1, 1]) {
    wall(D, VEST.h, sx * VEST.x, VEST.h / 2, cz, -sx * Math.PI / 2, upperM);
    const skirt = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.12, D), dadoM);
    skirt.position.set(sx * (VEST.x - 0.06), 0.56, cz);
    skirt.receiveShadow = true; g.add(skirt);
  }
  // ceiling and its lay-light
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, D), upperM);
  ceil.rotation.x = Math.PI / 2; ceil.position.set(0, VEST.h, cz);
  ceil.receiveShadow = true; g.add(ceil);
  const lay = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.4), M.glassRose);
  lay.rotation.x = Math.PI / 2; lay.position.set(-0.4, VEST.h - 0.03, cz + 0.6);
  g.add(lay);
  for (const sx of [-1, 1]) {
    solid(2.6, 0.1, 0.1, -0.4, VEST.h - 0.06, cz + 0.6 + sx * 1.2, M.brass);
    solid(0.1, 0.1, 2.6, -0.4 + sx * 1.2, VEST.h - 0.06, cz + 0.6, M.brass);
  }

  g.add(buildStair(M, lights));

  const l = new THREE.PointLight(0xffdcae, 7, 14, 2);
  l.position.set(-0.6, 3.4, cz + 0.4);
  g.add(l);
  lights.lamps.push({ light: l, base: 7 });
  return g;
}

// A curved flight: mahogany treads on a brass-balustered helix.
function buildStair(M, lights) {
  const g = new THREE.Group(); g.name = 'curved-stair';
  const { cx, cz, rIn, rOut, rRail, steps, a0, da, rise } = STAIR;
  const rMid = (rIn + rOut) / 2, depth = rOut - rIn;
  const rad = (i) => ((a0 + i * da) * Math.PI) / 180;
  const at = (r, a) => [cx + Math.cos(a) * r, cz + Math.sin(a) * r];

  for (let i = 0; i < steps; i++) {
    const a = rad(i), y = (i + 1) * rise;
    const [tx, tz] = at(rMid, a);
    const tread = new THREE.Mesh(new THREE.BoxGeometry(depth, 0.075, 0.46), M.mahoganyFine);
    tread.position.set(tx, y - 0.037, tz);
    tread.rotation.y = -a;
    tread.castShadow = true; tread.receiveShadow = true;
    g.add(tread);
    const [rx, rz] = at(rMid, a - (da * Math.PI) / 360);
    const riser = new THREE.Mesh(new THREE.BoxGeometry(depth, rise, 0.06), M.mahoganyDoor);
    riser.position.set(rx, y - rise / 2 - 0.06, rz);
    riser.rotation.y = -a;
    riser.receiveShadow = true;
    g.add(riser);
    // baluster
    const [bx, bz] = at(rRail, a);
    const bal = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.02, 0.92, 8), M.brass);
    bal.position.set(bx, y + 0.46, bz);
    bal.castShadow = true;
    g.add(bal);
    // whiplash scroll between balusters, in the Horta manner
    if (i < steps - 1) {
      const scroll = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.012, 6, 18, Math.PI * 1.3), M.brass);
      scroll.position.set(bx, y + 0.3, bz);
      scroll.rotation.set(Math.PI / 2, 0, 0);
      scroll.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), -a);
      scroll.rotateX(1.1);
      g.add(scroll);
    }
  }
  // handrail and stringer as tubes along the helix
  const curve = (r, dy) => {
    const pts = [];
    for (let i = -1; i <= steps + 1; i++) {
      const a = rad(i), y = Math.max(0, Math.min(steps, i + 1)) * rise + dy;
      const [px, pz] = at(r, a);
      pts.push(new THREE.Vector3(px, y, pz));
    }
    return new THREE.CatmullRomCurve3(pts);
  };
  const rail = new THREE.Mesh(new THREE.TubeGeometry(curve(rRail, 0.94), 90, 0.035, 10, false), M.mahoganyFine);
  rail.castShadow = true; g.add(rail);
  const under = new THREE.Mesh(new THREE.TubeGeometry(curve(rRail, 0.42), 90, 0.02, 8, false), M.brass);
  g.add(under);
  const stringer = new THREE.Mesh(new THREE.TubeGeometry(curve(rOut - 0.04, -0.16), 90, 0.1, 10, false), M.mahoganyFine);
  stringer.castShadow = true; g.add(stringer);
  const inner = new THREE.Mesh(new THREE.TubeGeometry(curve(rIn + 0.04, -0.16), 90, 0.08, 8, false), M.mahoganyFine);
  g.add(inner);

  // landing at the head of the flight
  const topY = steps * rise;
  const [lx, lz] = at(rMid + 0.3, rad(steps));
  const backZ = VEST.z1 - 0.12;
  const landing = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.14, backZ - lz + 1.0), M.mahoganyFine);
  landing.position.set(2.6, topY - 0.07, (lz - 0.5 + backZ) / 2);
  landing.castShadow = true; landing.receiveShadow = true;
  g.add(landing);
  // corbels carrying it
  for (const sx of [-1, 1]) {
    const cb = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.05, 8, 18, Math.PI * 0.5), M.brass);
    cb.position.set(2.6 + sx * 0.9, topY - 0.14, lz + 0.1);
    cb.rotation.set(0, sx > 0 ? 0 : Math.PI, Math.PI);
    cb.position.y = topY - 0.14 + 0.4;
    g.add(cb);
  }
  // landing balustrade along its open edge
  const edgePts = [new THREE.Vector3(1.6, topY + 0.94, lz - 0.3), new THREE.Vector3(1.6, topY + 0.94, backZ - 0.2)];
  const edgeRail = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(edgePts), 12, 0.035, 8, false), M.mahoganyFine);
  edgeRail.castShadow = true; g.add(edgeRail);
  for (let i = 0; i <= 4; i++) {
    const bz = lz - 0.3 + (i / 4) * (backZ - 0.2 - (lz - 0.3));
    const bal = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.02, 0.92, 8), M.brass);
    bal.position.set(1.6, topY + 0.46, bz);
    g.add(bal);
  }

  // newel with an opal globe — the lamp at the foot of the stair
  const [nx, nz] = at(rRail, rad(-1));
  const prof = [];
  for (const [r, y] of [[0.001, 0], [0.13, 0.02], [0.11, 0.1], [0.07, 0.24], [0.062, 0.9],
    [0.085, 1.02], [0.05, 1.12], [0.04, 1.24]]) prof.push(new THREE.Vector2(r, y));
  const newel = new THREE.Mesh(new THREE.LatheGeometry(prof, 18), M.mahoganyFine);
  newel.position.set(nx, 0, nz);
  newel.castShadow = true; g.add(newel);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.42, 8), M.brass);
  stem.position.set(nx, 1.42, nz); g.add(stem);
  const globe = new THREE.Mesh(new THREE.SphereGeometry(0.17, 18, 14), M.opal);
  globe.position.set(nx, 1.74, nz); g.add(globe);
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.07, 0.07, 14), M.brassDeep);
  collar.position.set(nx, 1.62, nz); g.add(collar);
  const lamp = new THREE.PointLight(0xffd7a0, 4, 7, 2);
  lamp.position.set(nx, 1.74, nz);
  g.add(lamp);
  lights.lamps.push({ light: lamp, base: 4 });
  return g;
}

// ---------------------------------------------------------------------------
function buildFrame(M, w, h, index) {
  const g = new THREE.Group();
  g.name = `picture-${index}`;
  const t = 0.11, d = 0.1;
  const rr = (s, W, H, r) => {
    s.moveTo(-W / 2 + r, -H / 2);
    s.lineTo(W / 2 - r, -H / 2); s.quadraticCurveTo(W / 2, -H / 2, W / 2, -H / 2 + r);
    s.lineTo(W / 2, H / 2 - r); s.quadraticCurveTo(W / 2, H / 2, W / 2 - r, H / 2);
    s.lineTo(-W / 2 + r, H / 2); s.quadraticCurveTo(-W / 2, H / 2, -W / 2, H / 2 - r);
    s.lineTo(-W / 2, -H / 2 + r); s.quadraticCurveTo(-W / 2, -H / 2, -W / 2 + r, -H / 2);
  };
  const outer = new THREE.Shape();
  rr(outer, w + t * 2, h + t * 2, 0.14);
  const hole = new THREE.Path();
  rr(hole, w, h, 0.06);
  outer.holes.push(hole);
  const geo = new THREE.ExtrudeGeometry(outer, {
    depth: d, bevelEnabled: true, bevelThickness: 0.035, bevelSize: 0.03, bevelSegments: 2, curveSegments: 6,
  });
  geo.setAttribute('uv1', geo.attributes.uv.clone());
  const frame = new THREE.Mesh(geo, M.mahogany);
  frame.castShadow = true; frame.receiveShadow = true;
  g.add(frame);

  const bead = new THREE.Shape();
  rr(bead, w + 0.05, h + 0.05, 0.06);
  const beadHole = new THREE.Path();
  rr(beadHole, w - 0.015, h - 0.015, 0.05);
  bead.holes.push(beadHole);
  const bg = new THREE.ExtrudeGeometry(bead, { depth: 0.05, bevelEnabled: false, curveSegments: 6 });
  bg.setAttribute('uv1', bg.attributes.uv.clone());
  const beadMesh = new THREE.Mesh(bg, M.brass);
  beadMesh.position.z = 0.055;
  beadMesh.castShadow = true;
  g.add(beadMesh);

  const artMat = new THREE.MeshStandardMaterial({
    map: nouveauArt(index), roughness: 0.55, metalness: 0, envMapIntensity: 0.55,
  });
  const art = new THREE.Mesh(new THREE.PlaneGeometry(w, h), artMat);
  art.position.z = 0.045;
  art.receiveShadow = true;
  g.add(art);

  const crest = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.8, 0.34), M.inlay);
  crest.position.set(0, h / 2 + t + 0.2, 0.06);
  g.add(crest);
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.07, 0.02), M.brass);
  plate.position.set(0, -h / 2 - t - 0.11, 0.07);
  g.add(plate);

  g.userData.slot = {
    index, mesh: art, material: artMat, width: w, height: h,
    setImage(url) {
      new THREE.TextureLoader().load(url, (tx) => {
        tx.colorSpace = THREE.SRGBColorSpace;
        tx.anisotropy = 8;
        artMat.map = tx; artMat.needsUpdate = true;
      });
    },
    setTexture(tx) { artMat.map = tx; artMat.needsUpdate = true; },
  };
  return g;
}

function buildSconce(M, v) {
  const g = new THREE.Group();
  g.position.set(v.x, 2.62, v.z);
  g.rotation.y = v.az - Math.PI / 2;
  const arm = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.026, 8, 20, Math.PI * 0.6), M.brass);
  arm.rotation.z = Math.PI * 0.75;
  arm.position.set(-0.1, 0.05, 0);
  arm.castShadow = true;
  g.add(arm);
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.07, 14), M.brassDeep);
  collar.position.set(-0.3, 0.1, 0);
  g.add(collar);
  const tulip = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.055, 0.2, 18, 1, true), M.opal);
  tulip.position.set(-0.3, 0.22, 0);
  g.add(tulip);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 10), M.opal);
  bulb.position.set(-0.3, 0.22, 0);
  g.add(bulb);
  return g;
}

function buildPendant(M, lights) {
  const g = new THREE.Group();
  g.name = 'pendant';
  const top = HALL.crownY - 0.3, hub = 5.15;
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, top - hub, 10), M.brass);
  rod.position.y = (top + hub) / 2;
  rod.castShadow = true;
  g.add(rod);
  const boss = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), M.brassDeep);
  boss.position.y = hub; g.add(boss);
  const centre = new THREE.Mesh(new THREE.SphereGeometry(0.24, 20, 16), M.opal);
  centre.position.y = hub - 0.34; g.add(centre);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.03, 8, 24), M.brass);
  ring.position.y = hub - 0.1; ring.rotation.x = Math.PI / 2; g.add(ring);
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2;
    const arm = new THREE.Group();
    arm.rotation.y = -a;
    const bow = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.028, 8, 22, Math.PI * 0.62), M.brass);
    bow.rotation.set(Math.PI / 2, 0, Math.PI * 0.2);
    bow.position.set(0, hub - 0.02, 0);
    bow.castShadow = true;
    arm.add(bow);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.4, 8), M.brass);
    stem.position.set(0.62, hub - 0.24, 0);
    arm.add(stem);
    const globe = new THREE.Mesh(new THREE.SphereGeometry(0.16, 18, 14), M.opal);
    globe.position.set(0.62, hub - 0.52, 0);
    arm.add(globe);
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.06, 14), M.brassDeep);
    collar.position.set(0.62, hub - 0.4, 0);
    arm.add(collar);
    g.add(arm);
  }
  const l = new THREE.PointLight(0xffe0b4, 16, 15, 2);
  l.position.y = hub - 0.4;
  g.add(l);
  lights.lamps.push({ light: l, base: 16 });
  return g;
}

function buildTorchere(M, x, z, ry, lights) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = ry;
  const prof = [];
  for (const [r, y] of [[0.001, 0], [0.16, 0.02], [0.13, 0.06], [0.05, 0.16], [0.038, 0.6],
    [0.032, 1.1], [0.045, 1.42], [0.03, 1.56], [0.024, 1.74]]) prof.push(new THREE.Vector2(r, y));
  const stem = new THREE.Mesh(new THREE.LatheGeometry(prof, 18), M.iron);
  stem.castShadow = true; stem.receiveShadow = true;
  g.add(stem);
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2;
    const foot = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.022, 8, 18, Math.PI * 0.55), M.iron);
    foot.position.set(Math.cos(a) * 0.12, 0.2, Math.sin(a) * 0.12);
    foot.rotation.set(Math.PI / 2, 0, 0);
    foot.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), a);
    foot.rotateX(1.3);
    foot.castShadow = true;
    g.add(foot);
    const curl = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.016, 6, 20, Math.PI * 0.8), M.iron);
    curl.position.set(0, 0.95, 0);
    curl.rotation.set(0, a, Math.PI * 0.1);
    g.add(curl);
  }
  const cage = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.018, 6, 24), M.iron);
  cage.position.y = 1.62; cage.rotation.x = Math.PI / 2; g.add(cage);
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.13, 0.26, 28, 1, true), M.opal);
  shade.position.y = 1.86;
  g.add(shade);
  const disc = new THREE.Mesh(new THREE.CircleGeometry(0.42, 28), M.opal);
  disc.position.y = 1.99; disc.rotation.x = Math.PI / 2;
  g.add(disc);
  const l = new THREE.PointLight(0xffd9a6, 5.5, 7.5, 2);
  l.position.y = 1.9;
  g.add(l);
  lights.lamps.push({ light: l, base: 5.5 });
  return g;
}

function buildLights(scene, tier) {
  const out = { lamps: [], t: 0, lampScale: 1 };
  const hemi = new THREE.HemisphereLight(0xdfe8dd, 0x4c4a34, 0.34);
  scene.add(hemi);
  out.hemi = hemi;

  const sun = new THREE.DirectionalLight(0xffeed6, 1.55);
  sun.position.set(-5.5, 15, -7);
  sun.target.position.set(1, 1.2, 2);
  sun.castShadow = true;
  sun.shadow.mapSize.setScalar(tier.shadowSize || 1024);
  const c = sun.shadow.camera;
  c.left = -10; c.right = 10; c.top = 10; c.bottom = -10; c.near = 4; c.far = 36;
  sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);
  out.sun = sun;

  const fill = new THREE.PointLight(0xd9e0bd, 1.8, 18, 2);
  fill.position.set(0, 1.2, 0);
  scene.add(fill);
  out.fill = fill;

  out.update = (dt) => {
    out.t += dt;
    for (let i = 0; i < out.lamps.length; i++) {
      const L = out.lamps[i];
      L.light.intensity = L.base * out.lampScale * (0.985 + Math.sin(out.t * 3.1 + i * 1.9) * 0.015);
    }
  };
  return out;
}

// ---------------------------------------------------------------------------
function mergeStatics(root, skip) {
  root.updateMatrixWorld(true);
  const buckets = new Map();
  const doomed = [];
  const excluded = (o) => { for (let p = o; p; p = p.parent) if (skip.has(p)) return true; return false; };
  root.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || Array.isArray(o.material) || excluded(o)) return;
    const key = `${o.material.uuid}|${o.castShadow ? 1 : 0}|${o.receiveShadow ? 1 : 0}`;
    if (!buckets.has(key)) buckets.set(key, { mat: o.material, cast: o.castShadow, recv: o.receiveShadow, list: [] });
    buckets.get(key).list.push(o);
  });
  const normalize = (geo) => {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    if (!g.attributes.normal) g.computeVertexNormals();
    const n = g.attributes.position.count;
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n * 2), 2));
    if (!g.attributes.uv1) g.setAttribute('uv1', g.attributes.uv.clone());
    for (const k of Object.keys(g.attributes)) {
      if (!['position', 'normal', 'uv', 'uv1'].includes(k)) g.deleteAttribute(k);
    }
    g.morphAttributes = {};
    g.clearGroups();
    return g;
  };
  for (const b of buckets.values()) {
    if (b.list.length < 2) continue;
    const geos = [];
    for (const m of b.list) {
      const g = normalize(m.geometry);
      g.applyMatrix4(m.matrixWorld);
      geos.push(g);
    }
    const merged = mergeGeometries(geos, false);
    for (const g of geos) g.dispose();
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, b.mat);
    mesh.castShadow = b.cast; mesh.receiveShadow = b.recv;
    mesh.name = 'batched';
    root.add(mesh);
    for (const m of b.list) { m.parent?.remove(m); doomed.push(m); }
  }
  for (const m of doomed) m.geometry.dispose();
}

// ===========================================================================
// <nouveau-hall> — walkthrough viewer
// ===========================================================================
const AMBIENCE = {
  'Midday glass': { sun: 1.55, sunCol: 0xffeed6, hemi: 0.34, hemiSky: 0xdfe8dd, glass: 0.62, lamp: 0.5, fill: 1.8, exposure: 0.66, bloom: 0.14 },
  'Amber dusk': { sun: 0.22, sunCol: 0x7d6f96, hemi: 0.12, hemiSky: 0x3c4356, glass: 0.2, lamp: 1.6, fill: 0.8, exposure: 0.86, bloom: 0.26 },
  'Soft overcast': { sun: 0.8, sunCol: 0xdfe6ee, hemi: 0.5, hemiSky: 0xe6ecef, glass: 0.46, lamp: 0.35, fill: 1.5, exposure: 0.7, bloom: 0.05 },
};

const EYE = 1.66;
const VIEWS = [
  { name: 'Under the dome', pos: [0, EYE, 4.2], yaw: 0, pitch: 0.1 },
  { name: 'The mosaic medallion', pos: [0, EYE, 2.6], yaw: 0, pitch: -0.44 },
  { name: 'The far bay', pos: [0, EYE, -1.6], yaw: 0, pitch: 0.03 },
  { name: 'East colonnade', pos: [3.4, EYE, 1.6], yaw: -1.12, pitch: 0.04 },
  { name: 'Crown of the glass', pos: [0, EYE, 1.4], yaw: 0.3, pitch: 0.58 },
  { name: 'The stair hall', pos: [0, EYE, 3.4], yaw: Math.PI, pitch: 0.06 },
];

// walkable ground: the hall, the portal threshold, and the stair hall
function clampWalk(p, prev, radius) {
  const rects = [
    [-1.0, 1.0, HALL.A - 1.2, VEST.z0 + 0.6],
    [-VEST.x + 0.7, VEST.x - 0.7, VEST.z0 + 0.5, VEST.z1 - 0.9],
  ];
  const d0 = Math.hypot(p.x, p.z);
  let best = d0 <= radius ? [p.x, p.z] : [(p.x * radius) / d0, (p.z * radius) / d0];
  let bd = (best[0] - p.x) ** 2 + (best[1] - p.z) ** 2;
  for (const [xa, xb, za, zb] of rects) {
    const x = Math.min(xb, Math.max(xa, p.x));
    const z = Math.min(zb, Math.max(za, p.z));
    const d = (x - p.x) ** 2 + (z - p.z) ** 2;
    if (d < bd) { bd = d; best = [x, z]; }
  }
  if (bd > 2.2 && prev) { p.x = prev.x; p.z = prev.z; return; }
  p.x = best[0]; p.z = best[1];
}

class NouveauHall extends HTMLElement {
  connectedCallback() {
    if (this._booted) return;
    this._booted = true;
    this.setAttribute('style', 'display:block;position:relative;width:100%;height:100%;overflow:hidden;background:#0b0e0a');

    const veil = document.createElement('div');
    veil.setAttribute('style', 'position:absolute;inset:0;display:grid;place-items:center;z-index:4;background:#0b0e0a;color:#c9a24d;font:400 15px/1.5 Georgia,serif;letter-spacing:.24em;text-transform:uppercase;transition:opacity .7s ease');
    veil.textContent = 'Leading the glass…';
    this.appendChild(veil);
    this._veil = veil;

    const canvas = document.createElement('canvas');
    canvas.setAttribute('style', 'position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none;cursor:grab');
    this.appendChild(canvas);
    this._canvas = canvas;

    requestAnimationFrame(() => requestAnimationFrame(() => this._build()));
  }

  async _build() {
    const [{ EffectComposer }, { RenderPass }, { UnrealBloomPass }, { OutputPass }] = await Promise.all([
      import('three/addons/postprocessing/EffectComposer.js'),
      import('three/addons/postprocessing/RenderPass.js'),
      import('three/addons/postprocessing/UnrealBloomPass.js'),
      import('three/addons/postprocessing/OutputPass.js'),
    ]);
    const renderer = new THREE.WebGLRenderer({ canvas: this._canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    this._renderer = renderer;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b0e0a);
    this._scene = scene;
    const camera = new THREE.PerspectiveCamera(58, 1, 0.05, 90);
    this._camera = camera;

    const room = buildNouveauRoom(scene, { shadowSize: 1024 });
    this._room = room;
    window.nouveauRoom = room;
    scene.environment = this._env(renderer);

    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.2, 0.62, 0.9);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
    this._composer = composer;
    this._bloom = bloom;

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

  _env(renderer) {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 128;
    const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, 128);
    g.addColorStop(0, '#e8ecd8'); g.addColorStop(0.42, '#c8cfb4');
    g.addColorStop(0.62, '#8a7c58'); g.addColorStop(1, '#241f14');
    x.fillStyle = g; x.fillRect(0, 0, 256, 128);
    const glow = x.createRadialGradient(120, 30, 4, 120, 30, 90);
    glow.addColorStop(0, 'rgba(255,250,232,.95)'); glow.addColorStop(1, 'rgba(255,250,232,0)');
    x.fillStyle = glow; x.fillRect(0, 0, 256, 128);
    const t = new THREE.CanvasTexture(c);
    t.mapping = THREE.EquirectangularReflectionMapping;
    t.colorSpace = THREE.SRGBColorSpace;
    const pm = new THREE.PMREMGenerator(renderer);
    const env = pm.fromEquirectangular(t).texture;
    pm.dispose(); t.dispose();
    return env;
  }

  static get observedAttributes() { return ['ambience', 'bloom', 'view']; }
  attributeChangedCallback(n, o, v) {
    if (!this._renderer) return;
    if (n === 'ambience' || n === 'bloom') this._applyAmbience();
    if (n === 'view' && v != null) this.goTo(Number(v));
  }

  _applyAmbience() {
    const P = AMBIENCE[this.getAttribute('ambience')] || AMBIENCE['Midday glass'];
    const L = this._room.lights;
    this._renderer.toneMappingExposure = P.exposure;
    L.sun.intensity = P.sun; L.sun.color.setHex(P.sunCol);
    L.hemi.intensity = P.hemi; L.hemi.color.setHex(P.hemiSky);
    L.fill.intensity = P.fill;
    L.lampScale = P.lamp;
    this._room.setGlassGlow(P.glass);
    const b = this.getAttribute('bloom');
    this._bloom.strength = P.bloom * (b == null ? 1 : Number(b) / 50);
    this._bloom.enabled = this._bloom.strength > 0.02;
    this._renderer.shadowMap.needsUpdate = true;
  }

  _bindInput() {
    const cv = this._canvas;
    let drag = null, moved = 0;
    cv.addEventListener('pointerdown', (e) => {
      drag = { x: e.clientX, y: e.clientY }; moved = 0;
      cv.setPointerCapture(e.pointerId);
      cv.style.cursor = 'grabbing';
      this._glide = null;
    });
    cv.addEventListener('pointermove', (e) => {
      if (!drag) return;
      moved += Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y);
      this._yaw -= (e.clientX - drag.x) * 0.0042;
      this._pitch = Math.max(-0.7, Math.min(0.78, this._pitch - (e.clientY - drag.y) * 0.003));
      drag = { x: e.clientX, y: e.clientY };
    });
    const end = () => { drag = null; cv.style.cursor = 'grab'; };
    cv.addEventListener('pointerup', end);
    cv.addEventListener('pointercancel', end);
    cv.addEventListener('wheel', (e) => {
      e.preventDefault();
      const p = this._pos.clone();
      const d = -Math.sign(e.deltaY) * 0.42;
      p.x -= Math.sin(this._yaw) * d; p.z -= Math.cos(this._yaw) * d;
      clampWalk(p, this._pos, this._room.radius);
      this._pos.copy(p);
    }, { passive: false });

    this._onKey = (e) => {
      const k = e.key.toLowerCase();
      if (k >= '1' && k <= '6') { this.goTo(Number(k) - 1); return; }
      this._keys.add(k);
    };
    this._onKeyUp = (e) => this._keys.delete(e.key.toLowerCase());
    window.addEventListener('keydown', this._onKey);
    window.addEventListener('keyup', this._onKeyUp);

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
      if (slot) { slot.material.emissive = new THREE.Color(0x3d4a2a); slot.material.needsUpdate = true; }
    };
    cv.addEventListener('dragover', (e) => { e.preventDefault(); highlight(pick(e)); });
    cv.addEventListener('dragleave', () => highlight(null));
    cv.addEventListener('drop', (e) => {
      e.preventDefault();
      const slot = pick(e) || this._hi;
      highlight(null);
      const file = [...(e.dataTransfer?.files || [])].find(f => f.type.startsWith('image/'));
      if (!file) return;
      (slot || this._room.slots[0]).setImage(URL.createObjectURL(file));
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

  goTo(i) {
    const v = VIEWS[i];
    if (!v) return;
    this._glide = { pos: new THREE.Vector3(...v.pos), yaw: v.yaw, pitch: v.pitch, t: 0 };
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
    this._room.lights.update(dt);

    if (this._glide) {
      const g = this._glide;
      g.t = Math.min(1, g.t + dt / 1.4);
      this._pos.lerp(g.pos, 1 - Math.pow(0.001, dt * 1.6));
      this._yaw += (((g.yaw - this._yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * Math.min(1, dt * 2.4);
      this._pitch += (g.pitch - this._pitch) * Math.min(1, dt * 2.4);
      if (g.t >= 1 || this._pos.distanceTo(g.pos) < 0.02) this._glide = null;
    } else {
      const k = this._keys;
      const fwd = (k.has('w') || k.has('arrowup') ? 1 : 0) - (k.has('s') || k.has('arrowdown') ? 1 : 0);
      const str = (k.has('d') || k.has('arrowright') ? 1 : 0) - (k.has('a') || k.has('arrowleft') ? 1 : 0);
      if (fwd || str) {
        const sp = (k.has('shift') ? 4.2 : 2.0) * dt;
        const p = this._pos.clone();
        p.x -= Math.sin(this._yaw) * fwd * sp - Math.cos(this._yaw) * str * sp;
        p.z -= Math.cos(this._yaw) * fwd * sp + Math.sin(this._yaw) * str * sp;
        clampWalk(p, this._pos, this._room.radius);
        this._pos.copy(p);
      }
      this._pos.y += (EYE - this._pos.y) * Math.min(1, dt * 3);
    }

    const c = this._camera;
    c.position.copy(this._pos);
    c.rotation.set(0, 0, 0);
    c.rotateY(this._yaw);
    c.rotateX(this._pitch);
    this._composer.render();
    this._adapt(dt);
  }

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

if (!customElements.get('nouveau-hall')) customElements.define('nouveau-hall', NouveauHall);
