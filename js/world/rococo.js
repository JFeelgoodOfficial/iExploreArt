import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  damaskMaterial, panelOrnament, cartouche, bandMaterial, flutingMaterial,
  plasterMaterial, giltMaterial, frescoMaterial, parquetMaterial, marbleMaterial,
  placeholderArt,
} from './rococo-surfaces.js';
import { fitToSlot } from '../art/fit.js';
import { loadArtTexture } from '../art/load.js';

// ---------------------------------------------------------------------------
// A rococo double-height gallery hall, after the Musikzimmer at Schloss
// Augustusburg: gilt boiserie, a coved fresco ceiling, a first-floor gallery
// running on three sides, arched glazing on the end wall, and hanging space
// for ten pictures (four on each side wall, two flanking the end doors).
//
//   const room = buildRococoRoom(scene, { tier, art: ROCOCO_HANG });
//   room.slots[0].setImage('assets/art/liberty.webp');
//
// `art` is an array indexed by slot (data/residency-artworks.js). Each entry's
// true pixel size is contain-fitted into that slot's ENVELOPE below, so the
// gilt moulding is cut to the picture instead of the picture being stretched to
// a fixed frame. Sizes have to be settled here, before buildFrame extrudes the
// moulding and mergeStatics() batches it away.
// ---------------------------------------------------------------------------

export const ROOM = {
  w: 15, d: 11, wallH: 7.6, coveH: 1.0, ceilY: 8.6,
  x0: -7.5, x1: 7.5, z0: -5.5, z1: 5.5,
  galleryY: 4.3, gallerySlab: 0.36, galleryDepth: 1.6,
  wallT: 0.4,
};

const PIER_Z = [-5.2, -3.55, 0, 3.55, 5.2];
const BAY_Z = [-1.775, 1.775];
const DOOR_X = [-2.4, 0, 2.4];
// near (south) wall: entrance door below, three arched windows at gallery level
const SOUTH_DOOR = { w: 2.1, h: 3.6 };
const SOUTH_WIN = { w: 1.3, h: 2.0, y: 4.95, xs: [-4.6, 0, 4.6] };
// enclosed glass lift, standing in the south-east corner of the gallery run
export const LIFT = { x: 6.7, z: 4.35, w: 1.5, d: 1.5, h: 2.35, deckCut: 3.3 };

// The largest picture each wall can carry, [maxW, maxH] in metres. Pictures are
// contain-fitted inside these, so one dimension always lands on the envelope and
// the other follows the photograph.
//
//   lower — height stops under the gallery slab soffit (y 3.94) and above the
//           dado rail; width is capped by the boiserie's painted moulding, whose
//           outer edge sits ±1.317 on a 2.9 m panel → outer frame 2.62.
//   upper — height is left exactly as it hung: the frame already laps the first
//           two cornice courses, and growing it makes that worse. Width is
//           capped by the upper panel's moulding (outer 2.45), which bites
//           before the pier abacus at y 6.94 does.
//   end   — the widest wall in the room and the one you face on arrival. The
//           only obstruction is the x 2.4 archivolt, whose jamb ends at x 3.335;
//           the back gallery run overhead sets the same 3.94 ceiling as the
//           lower side walls.
const ENVELOPE = { lower: [2.30, 2.45], upper: [2.10, 2.05], end: [2.40, 2.45] };

export function buildRococoRoom(scene, opts = {}) {
  const tier = opts.tier || { anisotropy: 8, shadowSize: 2048 };
  const hangList = opts.art || [];
  // main.js clamps anisotropy against the renderer's real ceiling; fall back to
  // the tier's own numbers when the room is built standalone.
  const aniso = opts.anisotropy ?? tier.anisotropy ?? 8;
  const maxEdge = opts.artMaxEdge ?? tier.artMaxEdge ?? 0;
  const group = new THREE.Group();
  group.name = 'rococo-hall';

  // ---- materials ----------------------------------------------------------
  const M = {
    silk: damaskMaterial({ base: [231, 202, 192], motif: [247, 227, 214], repeat: [3, 2] }),
    silkUpper: damaskMaterial({ base: [236, 212, 200], motif: [250, 233, 220], repeat: [3, 2] }),
    plaster: plasterMaterial([245, 230, 218], [4, 4]),
    plasterWarm: plasterMaterial([238, 218, 204], [3, 3]),
    gilt: giltMaterial(4),
    giltDeep: giltMaterial(9),
    egg: bandMaterial('egg', 60),
    guilloche: bandMaterial('guilloche', 40),
    dentil: bandMaterial('dentil', 90),
    bead: bandMaterial('bead', 80),
    fluting: flutingMaterial(7, 1),
    fresco: frescoMaterial(1024, 768),
    parquet: parquetMaterial([3, 2.2]),
    marble: marbleMaterial([216, 206, 197], [120, 100, 92], [3, 3]),
    marbleDark: marbleMaterial([158, 128, 118], [72, 52, 46], [2, 2]),
    ornPanel: panelOrnament(0.62, 3),
    ornPanelUpper: panelOrnament(0.78, 11, { pendant: false }),
    ornCartouche: cartouche(5),
    glass: new THREE.MeshStandardMaterial({
      color: 0xeff5fa, roughness: 0.07, metalness: 0.1,
      transparent: true, opacity: 0.3, envMapIntensity: 2.2, side: THREE.DoubleSide,
    }),
    crystal: new THREE.MeshStandardMaterial({
      color: 0xffffff, roughness: 0.04, metalness: 0.2,
      transparent: true, opacity: 0.55, envMapIntensity: 3.2,
    }),
    flame: new THREE.MeshBasicMaterial({ color: 0xffd9a0 }),
    sky: new THREE.MeshBasicMaterial({ color: 0xdfeaf4 }),
  };
  M.silk.side = M.silkUpper.side = THREE.FrontSide;

  const add = (mesh, { cast = true, receive = true } = {}) => {
    mesh.castShadow = cast; mesh.receiveShadow = receive;
    group.add(mesh); return mesh;
  };
  const uv1 = (g) => { if (g.attributes.uv && !g.attributes.uv1) g.setAttribute('uv1', g.attributes.uv.clone()); return g; };
  const box = (w, h, d, x, y, z, mat, name) => {
    const m = new THREE.Mesh(uv1(new THREE.BoxGeometry(w, h, d)), mat);
    m.position.set(x, y, z); m.name = name || 'box';
    return add(m);
  };
  const plane = (w, h, mat, name) => {
    const m = new THREE.Mesh(uv1(new THREE.PlaneGeometry(w, h, 1, 1)), mat);
    m.name = name || 'plane';
    return m;
  };
  // clone a material with texture repeat expressed per metre (extruded caps
  // carry world-unit UVs, so this keeps pattern density constant)
  const perMetre = (mat, ru, rv) => {
    const c = mat.clone();
    for (const k of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'alphaMap']) {
      if (c[k]) { c[k] = c[k].clone(); c[k].needsUpdate = true; c[k].repeat.set(ru, rv); }
    }
    return c;
  };

  // ---- floor --------------------------------------------------------------
  const floor = plane(ROOM.w, ROOM.d, M.parquet, 'floor');
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true; floor.castShadow = false;
  group.add(floor);
  // marble threshold band along the walls
  const bandMat = M.marble;
  for (const [w, d, x, z] of [[ROOM.w, 0.5, 0, ROOM.z0 + 0.25], [ROOM.w, 0.5, 0, ROOM.z1 - 0.25],
    [0.5, ROOM.d - 1, ROOM.x0 + 0.25, 0], [0.5, ROOM.d - 1, ROOM.x1 - 0.25, 0]]) {
    const b = plane(w, d, bandMat); b.rotation.x = -Math.PI / 2;
    b.position.set(x, 0.004, z); b.receiveShadow = true; group.add(b);
  }

  // ---- ceiling + cove -----------------------------------------------------
  const ceil = plane(ROOM.w - 2, ROOM.d - 2, M.fresco, 'ceiling-fresco');
  ceil.rotation.x = Math.PI / 2;
  ceil.position.y = ROOM.ceilY;
  ceil.receiveShadow = true;
  group.add(ceil);
  group.add(buildCove(M, perMetre));

  // ---- shell walls --------------------------------------------------------
  const sideSilk = perMetre(M.silk, 0.34, 0.34);
  const upperSilk = perMetre(M.silkUpper, 0.34, 0.34);

  for (const sx of [-1, 1]) {
    const w = new THREE.Mesh(uv1(new THREE.PlaneGeometry(ROOM.d, ROOM.wallH)), sideSilk);
    w.position.set(sx * ROOM.x1, ROOM.wallH / 2, 0);
    w.rotation.y = -sx * Math.PI / 2;
    w.receiveShadow = true; w.name = `wall-${sx < 0 ? 'west' : 'east'}`;
    group.add(w);
    // structural thickness behind, so the room reads solid from outside
    box(0.4, ROOM.wallH + ROOM.coveH, ROOM.d, sx * (ROOM.x1 + 0.2), (ROOM.wallH + ROOM.coveH) / 2, 0, M.plaster, 'wall-core');
  }
  // near wall — entrance doorway, upper glazing
  group.add(buildSouthWall(M, perMetre, uv1));

  // ---- end wall with arched openings --------------------------------------
  group.add(buildEndWall(M, perMetre, uv1));

  // ---- order: cornice, dado, piers, panels, gallery, frames ---------------
  group.add(buildCornice(M, perMetre));
  group.add(buildDado(M, perMetre, uv1));
  group.add(buildPiers(M, perMetre, uv1));
  group.add(buildPanels(M, perMetre));
  const gallery = buildGalleryLevel(M, perMetre, uv1);
  group.add(gallery);
  const elevator = buildElevator(M);
  group.add(elevator.group);

  // ---- pictures -----------------------------------------------------------
  const slots = [];
  const interactables = [];
  // Each slot is cut to whatever hangs in it: contain-fit the artwork's true
  // pixel aspect into the wall's envelope. An empty slot falls back to a frame
  // narrower than its envelope, so a generated placeholder never ends up the
  // largest thing on the wall; its canvas is drawn at that aspect too, so the
  // placeholder isn't stretched either.
  const hang = (i, x, y, z, ry, [maxW, maxH]) => {
    const art = hangList[i] || null;
    const [w, h] = art
      ? fitToSlot(art.px[0] / art.px[1], maxW, maxH)
      : [maxW * 0.85, maxH];
    const f = buildFrame(M, w, h, i, art, aniso, maxEdge);
    f.position.set(x, y, z); f.rotation.y = ry;
    group.add(f);
    slots.push(f.userData.slot);
    if (art) interactables.push(f.userData.slot.mesh);
  };
  // side walls: two lower, two upper per side
  let n = 0;
  for (const sx of [-1, 1]) {
    const ry = -sx * Math.PI / 2;
    for (const z of BAY_Z) hang(n++, sx * (ROOM.x1 - 0.06), 2.32, z, ry, ENVELOPE.lower);
    for (const z of BAY_Z) hang(n++, sx * (ROOM.x1 - 0.06), 6.05, z, ry, ENVELOPE.upper);
  }
  // end wall: flanking the doors
  for (const x of [-5.35, 5.35]) hang(n++, x, 2.32, ROOM.z0 + 0.06, 0, ENVELOPE.end);

  // ---- lights -------------------------------------------------------------
  const lights = buildLights(scene, group, M, tier);
  group.add(buildChandelier(M, lights));
  for (const sx of [-1, 1]) {
    for (const z of [PIER_Z[1], PIER_Z[3]]) {
      group.add(buildSconce(M, sx * (ROOM.x1 - 0.12), 2.9, z, sx * Math.PI / 2, lights));
    }
  }

  mergeStatics(group, new Set([elevator.group, ...lights.flames]));

  // ---- hang the collection ------------------------------------------------
  // After the merge: the canvases keep their own materials so they survive it,
  // and the textures land asynchronously through the frame loop's upload queue.
  hangList.forEach((art, i) => { if (art) slots[i]?.setImage(art.image); });

  scene.add(group);

  return {
    group, slots, interactables, lights, ROOM, elevator,
    spawn: { x: 0, y: 1.68, z: 4.2 },
    setImage(i, url) { slots[i] && slots[i].setImage(url); },
    dispose() { group.traverse(o => { o.geometry?.dispose?.(); }); },
  };
}

// ---------------------------------------------------------------------------
// Batch every static mesh that shares a material into one geometry. The room is
// modelled as hundreds of small boxes and rings; unbatched that is ~650 draw
// calls a frame, which is what limits the frame rate, not the triangle count.
// ---------------------------------------------------------------------------
function mergeStatics(root, skip) {
  root.updateMatrixWorld(true);
  const buckets = new Map();
  const doomed = [];
  const excluded = (o) => {
    for (let p = o; p; p = p.parent) if (skip.has(p)) return true;
    return false;
  };
  root.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || Array.isArray(o.material) || excluded(o)) return;
    const key = `${o.material.uuid}|${o.castShadow ? 1 : 0}|${o.receiveShadow ? 1 : 0}`;
    if (!buckets.has(key)) buckets.set(key, { mat: o.material, cast: o.castShadow, recv: o.receiveShadow, list: [] });
    buckets.get(key).list.push(o);
  });
  const normalize = (geo) => {
    let g = geo.index ? geo.toNonIndexed() : geo.clone();
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

// ---------------------------------------------------------------------------
function buildCove(M, perMetre) {
  const g = new THREE.Group(); g.name = 'cove';
  const { x0, x1, z0, z1, wallH, ceilY } = ROOM;
  const ix0 = x0 + 1, ix1 = x1 - 1, iz0 = z0 + 1, iz1 = z1 - 1;
  const outer = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
  const inner = [[ix0, iz0], [ix1, iz0], [ix1, iz1], [ix0, iz1]];
  const pos = [], uv = [], idx = [];
  const push = (ax, az, bx, bz, cx2, cz, dx, dz, len) => {
    const base = pos.length / 3;
    pos.push(ax, wallH, az, bx, wallH, bz, cx2, ceilY, cz, dx, ceilY, dz);
    uv.push(0, 0, len, 0, len, 1, 0, 1);
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };
  for (let i = 0; i < 4; i++) {
    const a = outer[i], b = outer[(i + 1) % 4];
    const c = inner[(i + 1) % 4], d = inner[i];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) * 0.5;
    push(a[0], a[1], b[0], b[1], c[0], c[1], d[0], d[1], len);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('uv1', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const mat = perMetre(M.ornCartouche, 1, 1);
  mat.side = THREE.DoubleSide; mat.alphaTest = 0; mat.transparent = false;
  const base = new THREE.Mesh(geo, perMetre(M.plasterWarm, 1, 1));
  base.receiveShadow = true; base.name = 'cove-face';
  g.add(base);
  // gilt ribs along the cove edges
  for (const y of [wallH + 0.02, ceilY - 0.02]) {
    const inset = y === ceilY - 0.02 ? 1 : 0.04;
    const w = (x1 - x0) - inset * 2, d = (z1 - z0) - inset * 2;
    const ribMat = perMetre(M.egg, 1, 1);
    for (const [sw, sd, px, pz, rot] of [
      [w, 0.14, 0, z0 + inset, 0], [w, 0.14, 0, z1 - inset, 0],
      [d, 0.14, x0 + inset, 0, Math.PI / 2], [d, 0.14, x1 - inset, 0, Math.PI / 2],
    ]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(sw, 0.14, 0.14), ribMat);
      m.position.set(px, y, pz); m.rotation.y = rot;
      m.castShadow = true; g.add(m);
    }
  }
  return g;
}

function archShape(w, h, cx = 0, cy = 0) {
  const r = w / 2, straight = h - r;
  const s = new THREE.Path();
  s.moveTo(cx - r, cy);
  s.lineTo(cx - r, cy + straight);
  s.absarc(cx, cy + straight, r, Math.PI, 0, true);
  s.lineTo(cx + r, cy);
  s.closePath();
  return s;
}

function buildEndWall(M, perMetre, uv1) {
  const g = new THREE.Group(); g.name = 'end-wall';
  const { w, wallH, z0, wallT } = ROOM;
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2, 0); shape.lineTo(w / 2, 0); shape.lineTo(w / 2, wallH); shape.lineTo(-w / 2, wallH); shape.closePath();
  for (const x of DOOR_X) shape.holes.push(archShape(1.6, 3.35, x, 0));
  for (const x of DOOR_X) shape.holes.push(archShape(1.45, 2.25, x, 4.85));
  const geo = uv1(new THREE.ExtrudeGeometry(shape, { depth: wallT, bevelEnabled: false, curveSegments: 24 }));
  geo.translate(0, 0, z0 - wallT);
  const mat = perMetre(M.silk, 0.34, 0.34);
  mat.side = THREE.DoubleSide;
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'end-wall-plaster'; mesh.castShadow = true; mesh.receiveShadow = true;
  g.add(mesh);

  // gilt archivolts + keystones
  for (const [x, aw, ah, y] of [
    ...DOOR_X.map(x => [x, 1.6, 3.35, 0]),
    ...DOOR_X.map(x => [x, 1.45, 2.25, 4.85]),
  ]) {
    const r = aw / 2;
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(r + 0.06, 0.075, 10, 40, Math.PI),
      M.gilt);
    ring.position.set(x, y + ah - r, z0 + 0.02);
    ring.castShadow = true; g.add(ring);
    for (const sx of [-1, 1]) {
      const j = new THREE.Mesh(new THREE.BoxGeometry(0.15, ah - r, 0.15), M.gilt);
      j.position.set(x + sx * (r + 0.06), (y + ah - r) / 2 + y / 2, z0 + 0.02);
      j.position.y = y + (ah - r) / 2;
      j.castShadow = true; g.add(j);
    }
    const key = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.42, 0.2), M.gilt);
    key.position.set(x, y + ah + 0.1, z0 + 0.04); key.castShadow = true; g.add(key);
    const crest = new THREE.Mesh(new THREE.PlaneGeometry(aw * 1.5, aw * 0.75), M.ornCartouche);
    crest.position.set(x, y + ah + 0.42, z0 + 0.05);
    g.add(crest);
  }

  // glazing + mullions + a luminous exterior
  const glassGroup = new THREE.Group(); glassGroup.name = 'glazing';
  const paneFor = (x, aw, ah, y) => {
    const shp = new THREE.Shape();
    const p = archShape(aw - 0.04, ah - 0.02, 0, 0);
    shp.curves = p.curves; shp.autoClose = true;
    const pg = new THREE.ShapeGeometry(shp, 24);
    const pane = new THREE.Mesh(pg, M.glass);
    pane.position.set(x, y, z0 - 0.14);
    glassGroup.add(pane);
    // muntins
    const cols = 3, rows = Math.round((ah - aw / 2) / 0.55);
    for (let i = 1; i < cols; i++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.035, ah - 0.1, 0.05), M.gilt);
      b.position.set(x - (aw - 0.04) / 2 + (i / cols) * (aw - 0.04), y + (ah - 0.1) / 2, z0 - 0.13);
      glassGroup.add(b);
    }
    for (let j = 1; j <= rows; j++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(aw - 0.06, 0.035, 0.05), M.gilt);
      b.position.set(x, y + (j / (rows + 1)) * (ah - aw / 2), z0 - 0.13);
      glassGroup.add(b);
    }
  };
  for (const x of DOOR_X) paneFor(x, 1.6, 3.35, 0);
  for (const x of DOOR_X) paneFor(x, 1.45, 2.25, 4.85);
  g.add(glassGroup);

  const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(16, 12), new THREE.MeshBasicMaterial({
    color: 0xeaf1f7, toneMapped: false,
  }));
  backdrop.position.set(0, 4, z0 - 1.4);
  backdrop.name = 'daylight-backdrop';
  g.add(backdrop);
  return g;
}

function buildCornice(M, perMetre) {
  const g = new THREE.Group(); g.name = 'cornice';
  const { x0, x1, z0, z1, wallH } = ROOM;
  const runs = [
    [x1 - x0, 0, z0, 0], [x1 - x0, 0, z1, 0],
    [z1 - z0, x0, 0, Math.PI / 2], [z1 - z0, x1, 0, Math.PI / 2],
  ];
  // profile: cyma (plain) / dentil / egg-and-dart / bead, stepping out
  const courses = [
    { y: wallH - 0.62, h: 0.10, d: 0.10, mat: M.bead },
    { y: wallH - 0.48, h: 0.20, d: 0.16, mat: M.dentil },
    { y: wallH - 0.26, h: 0.16, d: 0.22, mat: M.egg },
    { y: wallH - 0.08, h: 0.14, d: 0.30, mat: M.guilloche },
  ];
  for (const [len, px, pz, rot] of runs) {
    for (const c of courses) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(len, c.h, c.d), perMetre(c.mat, 1, 1));
      m.position.set(px === 0 ? 0 : px + (px < 0 ? c.d / 2 : -c.d / 2), c.y,
        pz === 0 ? 0 : pz + (pz < 0 ? c.d / 2 : -c.d / 2));
      m.rotation.y = rot;
      m.castShadow = true; m.receiveShadow = true;
      g.add(m);
    }
  }
  return g;
}

function buildDado(M, perMetre, uv1) {
  const g = new THREE.Group(); g.name = 'dado';
  const { x0, x1, z0, z1 } = ROOM;
  const dw = SOUTH_DOOR.w / 2 + 0.1, seg = (x1 - dw);
  const runs = [
    [seg, -(dw + seg / 2), z1 - 0.08, 0], [seg, dw + seg / 2, z1 - 0.08, 0],
    [x1 - x0, 0, z0 + 0.08, 0],
    [z1 - z0, x0 + 0.08, 0, Math.PI / 2], [z1 - z0, x1 - 0.08, 0, Math.PI / 2],
  ];
  for (const [len, px, pz, rot] of runs) {
    const skirt = new THREE.Mesh(uv1(new THREE.BoxGeometry(len, 0.34, 0.16)), perMetre(M.marbleDark, 1, 1));
    skirt.position.set(px, 0.17, pz); skirt.rotation.y = rot;
    skirt.castShadow = true; skirt.receiveShadow = true; g.add(skirt);
    const field = new THREE.Mesh(uv1(new THREE.BoxGeometry(len, 0.72, 0.10)), perMetre(M.plaster, 1, 1));
    field.position.set(px, 0.70, pz); field.rotation.y = rot;
    field.receiveShadow = true; g.add(field);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(len, 0.12, 0.18), perMetre(M.bead, 1, 1));
    rail.position.set(px, 1.12, pz); rail.rotation.y = rot;
    rail.castShadow = true; g.add(rail);
  }
  return g;
}

function buildPiers(M, perMetre, uv1) {
  const g = new THREE.Group(); g.name = 'piers';
  const { x1, wallH } = ROOM;
  const H = wallH - 0.72;
  for (const sx of [-1, 1]) {
    for (const z of PIER_Z) {
      const shaft = new THREE.Mesh(uv1(new THREE.BoxGeometry(0.22, H - 1.5, 0.62)),
        perMetre(M.fluting, 1, (H - 1.5) / 1.2));
      shaft.position.set(sx * (x1 - 0.11), 1.18 + (H - 1.5) / 2, z);
      shaft.castShadow = true; shaft.receiveShadow = true; g.add(shaft);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.34, 0.78), M.gilt);
      cap.position.set(sx * (x1 - 0.15), 1.18 + (H - 1.5) + 0.17, z);
      cap.castShadow = true; g.add(cap);
      const abac = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.09, 0.88), M.gilt);
      abac.position.set(sx * (x1 - 0.17), 1.18 + (H - 1.5) + 0.38, z);
      abac.castShadow = true; g.add(abac);
      const base = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.18, 0.76), M.gilt);
      base.position.set(sx * (x1 - 0.15), 1.27, z);
      base.castShadow = true; g.add(base);
      // acanthus on the capital
      const orn = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.4), M.ornCartouche);
      orn.position.set(sx * (x1 - 0.32), 1.18 + (H - 1.5) + 0.17, z);
      orn.rotation.y = -sx * Math.PI / 2;
      g.add(orn);
    }
  }
  return g;
}

function buildPanels(M, perMetre) {
  const g = new THREE.Group(); g.name = 'boiserie';
  const { x1, galleryY } = ROOM;
  for (const sx of [-1, 1]) {
    for (const z of BAY_Z) {
      // lower storey panel
      const p = new THREE.Mesh(new THREE.PlaneGeometry(2.9, 2.6), M.ornPanel);
      p.position.set(sx * (x1 - 0.02), 2.5, z);
      p.rotation.y = -sx * Math.PI / 2;
      p.castShadow = false; g.add(p);
      // upper storey panel
      const u = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 2.1), M.ornPanelUpper);
      u.position.set(sx * (x1 - 0.03), 6.05, z);
      u.rotation.y = -sx * Math.PI / 2;
      g.add(u);
      // frieze cartouche between the storeys
      const c = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.95), M.ornCartouche);
      c.position.set(sx * (x1 - 0.03), galleryY - 0.62, z);
      c.rotation.y = -sx * Math.PI / 2;
      g.add(c);
    }
  }
  // end wall spandrels
  for (const x of [-5.35, 5.35]) {
    const c = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 1.05), M.ornCartouche);
    c.position.set(x, 5.9, ROOM.z0 + 0.04);
    g.add(c);
  }
  return g;
}

function buildGalleryLevel(M, perMetre, uv1) {
  const g = new THREE.Group(); g.name = 'gallery-level';
  const { x0, x1, z0, z1, galleryY: Y, gallerySlab: S, galleryDepth: DP } = ROOM;
  const runs = [
    // balLen trims each balustrade to the walkable span: the back run stops at
    // the corner squares so the side runs can be reached, and the east run
    // stops with its deck at the lift. The fascia keeps the full slab edge.
    { len: x1 - x0, w: DP, x: 0, z: z0 + DP / 2, rot: 0, railZ: z0 + DP, railLen: x1 - x0, railRot: 0, balLen: (x1 - x0) - 2 * DP },
    { len: z1 - z0 - DP, w: DP, x: x0 + DP / 2, z: (z0 + DP + z1) / 2, rot: 0, railX: x0 + DP, railLen: z1 - z0 - DP, railRot: Math.PI / 2 },
    { len: z1 - z0 - DP, w: DP, x: x1 - DP / 2, z: (z0 + DP + LIFT.deckCut) / 2, rot: 0, railX: x1 - DP, railLen: z1 - z0 - DP, railRot: Math.PI / 2, deckLen: LIFT.deckCut - (z0 + DP), balLen: LIFT.deckCut - (z0 + DP), fasciaLen: LIFT.deckCut - z0 - 0.5, fasciaZ: (z0 + 0.5 + LIFT.deckCut) / 2 },
  ];
  for (const r of runs) {
    const isBack = r.railZ !== undefined;
    const sw = isBack ? r.len : r.w;
    const sd = isBack ? r.w : (r.deckLen ?? (z1 - z0 - DP));
    const slab = new THREE.Mesh(uv1(new THREE.BoxGeometry(sw, S, sd)), perMetre(M.plasterWarm, 1, 1));
    slab.position.set(r.x, Y - S / 2, r.z);
    slab.castShadow = true; slab.receiveShadow = true;
    g.add(slab);
    // walking surface
    const deck = new THREE.Mesh(uv1(new THREE.PlaneGeometry(sw, sd)), perMetre(M.parquet, 0.62, 0.62));
    deck.rotation.x = -Math.PI / 2; deck.position.set(r.x, Y + 0.002, r.z);
    deck.receiveShadow = true; g.add(deck);
    // moulded soffit edge
    const fx = isBack ? r.x : r.railX;
    const fz = isBack ? r.railZ : r.z;
    const fLen = r.railLen;
    const fRot = r.railRot;
    const fascia = new THREE.Mesh(new THREE.BoxGeometry(r.fasciaLen ?? fLen, S + 0.14, 0.16), perMetre(M.egg, 1, 1));
    fascia.position.set(fx, Y - S / 2, r.fasciaZ ?? fz);
    fascia.rotation.y = fRot; fascia.castShadow = true;
    g.add(fascia);
    // balustrade
    g.add(balustrade(M, r.balLen ?? fLen, fx, Y, fz, fRot));
  }
  return g;
}

function balustrade(M, len, x, y, z, rot) {
  const g = new THREE.Group();
  g.position.set(x, y, z); g.rotation.y = rot;
  const H = 1.02;
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(len, 0.16, 0.26), M.marble);
  plinth.position.y = 0.08; plinth.castShadow = true; plinth.receiveShadow = true;
  g.add(plinth);
  const rail = new THREE.Mesh(new THREE.BoxGeometry(len, 0.12, 0.30), M.marble);
  rail.position.y = H; rail.castShadow = true; g.add(rail);
  const bead = new THREE.Mesh(new THREE.BoxGeometry(len, 0.05, 0.34), M.giltDeep);
  bead.position.y = H + 0.085; bead.castShadow = true; g.add(bead);

  // turned baluster profile
  const prof = [];
  const add = (r, y2) => prof.push(new THREE.Vector2(r, y2));
  add(0.001, 0); add(0.085, 0); add(0.085, 0.05); add(0.062, 0.08);
  add(0.052, 0.14); add(0.075, 0.22); add(0.088, 0.32); add(0.082, 0.44);
  add(0.055, 0.54); add(0.038, 0.60); add(0.048, 0.66); add(0.040, 0.72);
  add(0.030, 0.78); add(0.052, 0.82); add(0.052, 0.86); add(0.001, 0.86);
  const geo = new THREE.LatheGeometry(prof, 20);
  const count = Math.max(6, Math.round(len / 0.32));
  const inst = new THREE.InstancedMesh(geo, M.marble, count);
  inst.castShadow = true; inst.receiveShadow = true;
  const mtx = new THREE.Matrix4();
  for (let i = 0; i < count; i++) {
    const px = -len / 2 + (i + 0.5) * (len / count);
    mtx.makeTranslation(px, 0.16, 0);
    inst.setMatrixAt(i, mtx);
  }
  inst.instanceMatrix.needsUpdate = true;
  g.add(inst);
  // newels
  for (const sx of [-1, 1]) {
    const n = new THREE.Mesh(new THREE.BoxGeometry(0.2, H, 0.28), M.marble);
    n.position.set(sx * (len / 2 - 0.1), H / 2, 0);
    n.castShadow = true; g.add(n);
  }
  return g;
}

// A carved gilt picture frame with a canvas and a crest. `w`/`h` are the
// picture's own metres — every frame in the hall is a different size.
function buildFrame(M, w, h, index, art = null, aniso = 8, maxEdge = 0) {
  const g = new THREE.Group(); g.name = `picture-${index}`;
  const t = 0.16, d = 0.13;
  const outer = new THREE.Shape();
  const rr = (s, W, H, r) => {
    s.moveTo(-W / 2 + r, -H / 2);
    s.lineTo(W / 2 - r, -H / 2); s.quadraticCurveTo(W / 2, -H / 2, W / 2, -H / 2 + r);
    s.lineTo(W / 2, H / 2 - r); s.quadraticCurveTo(W / 2, H / 2, W / 2 - r, H / 2);
    s.lineTo(-W / 2 + r, H / 2); s.quadraticCurveTo(-W / 2, H / 2, -W / 2, H / 2 - r);
    s.lineTo(-W / 2, -H / 2 + r); s.quadraticCurveTo(-W / 2, -H / 2, -W / 2 + r, -H / 2);
  };
  rr(outer, w + t * 2, h + t * 2, 0.1);
  const hole = new THREE.Path();
  rr(hole, w, h, 0.05);
  outer.holes.push(hole);
  const geo = new THREE.ExtrudeGeometry(outer, {
    depth: d, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.045, bevelSegments: 3, curveSegments: 8,
  });
  geo.setAttribute('uv1', geo.attributes.uv.clone());
  const frame = new THREE.Mesh(geo, M.giltDeep);
  frame.castShadow = true; frame.receiveShadow = true;
  g.add(frame);

  // canvas — an empty slot draws its generated canvas at the frame's own aspect.
  // A slot that IS hung skips the generator entirely (it's the expensive part of
  // building this hall) and sits at a dark canvas colour until its photo lands;
  // setImage clears the tint, since `color` multiplies `map`.
  const artMat = new THREE.MeshStandardMaterial({
    map: art ? null : placeholderArt(index, 512, Math.round(512 * h / w)),
    color: art ? 0x3a3129 : 0xffffff,
    roughness: 0.52, metalness: 0, envMapIntensity: 0.5,
  });
  const canvas = new THREE.Mesh(new THREE.PlaneGeometry(w, h), artMat);
  canvas.position.z = 0.05;
  canvas.receiveShadow = true;
  canvas.name = `picture-canvas-${index}`;
  // the one field js/Interaction.js needs to make it hoverable and viewable
  if (art) canvas.userData.artwork = art;
  g.add(canvas);

  // Crest + corner rocaille sit proud of the frame. Both its height and its
  // offset were scaled off `w` alone, which is backwards once frames vary: a
  // landscape work is the widest AND the shortest, so it would wear the tallest
  // cartouche pushed furthest up. Drive it off the smaller dimension, and cap it
  // at the width every frame in this hall used to be — the cartouche already
  // sinks into the gallery slab and the cornice at that size, and nothing here
  // should make that worse. With both limits no crest rises above y 4.46 on the
  // lower storey or y 7.86 on the upper, which is where they all sat before.
  const CREST_MAX = 1.95;
  const cw = Math.min(w, h, CREST_MAX);
  const crest = new THREE.Mesh(new THREE.PlaneGeometry(cw * 0.9, cw * 0.45), M.ornCartouche);
  crest.position.set(0, h / 2 + t + cw * 0.16, 0.1);
  g.add(crest);

  // brass plate
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.09, 0.02), M.gilt);
  plate.position.set(0, -h / 2 - t - 0.1, 0.08);
  g.add(plate);

  g.userData.slot = {
    index, mesh: canvas, material: artMat, artwork: art, width: w, height: h,
    setImage(url) {
      loadArtTexture(url, { anisotropy: aniso, px: art?.px, maxEdge }, (tx) => {
        artMat.map = tx;
        if (artMat.emissiveMap) artMat.emissiveMap = tx;   // a hover may have bound the old map
        artMat.color.setHex(0xffffff);                     // drop the waiting tint
        artMat.needsUpdate = true;
      });
    },
    setTexture(tx) { artMat.map = tx; artMat.needsUpdate = true; },
  };
  return g;
}

function buildChandelier(M, lights) {
  const g = new THREE.Group();
  g.name = 'chandelier';
  g.position.set(0, 0, 0);
  const topY = ROOM.ceilY - 0.1, bodyY = 4.6;

  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, topY - bodyY - 0.5, 8),
    new THREE.MeshStandardMaterial({ color: 0x8f2f2a, roughness: 0.8 }));
  cord.position.set(0, (topY + bodyY + 0.5) / 2, 0);
  cord.castShadow = true; g.add(cord);
  const boss = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 12), M.gilt);
  boss.position.set(0, bodyY + 0.5, 0); g.add(boss);

  // gilt stem
  const stemProf = [];
  for (const [r, y] of [[0.02, 0], [0.10, 0.08], [0.06, 0.2], [0.16, 0.34], [0.10, 0.5], [0.05, 0.7], [0.02, 0.9]]) stemProf.push(new THREE.Vector2(r, y));
  const stem = new THREE.Mesh(new THREE.LatheGeometry(stemProf, 20), M.gilt);
  stem.position.set(0, bodyY - 0.45, 0); stem.castShadow = true; g.add(stem);

  // two tiers of arms with candles; crystal drops are instanced (they were 80 draw calls)
  const drops = [];
  const tiers = [{ r: 0.95, y: bodyY - 0.1, n: 8 }, { r: 0.66, y: bodyY + 0.28, n: 6 }];
  for (const t of tiers) {
    for (let i = 0; i < t.n; i++) {
      const a = (i / t.n) * Math.PI * 2;
      const arm = new THREE.Mesh(new THREE.TorusGeometry(t.r * 0.62, 0.028, 8, 24, Math.PI * 0.85), M.gilt);
      arm.position.set(0, t.y, 0);
      arm.rotation.set(Math.PI / 2, 0, 0);
      arm.rotation.z = 0;
      arm.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), a);
      arm.rotateX(-0.5);
      arm.castShadow = true;
      g.add(arm);
      const cx = Math.cos(a) * t.r, cz = Math.sin(a) * t.r;
      const pan = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.06, 0.05, 14), M.gilt);
      pan.position.set(cx, t.y + 0.24, cz); g.add(pan);
      const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.032, 0.26, 10),
        new THREE.MeshStandardMaterial({ color: 0xfdf3dd, roughness: 0.7 }));
      candle.position.set(cx, t.y + 0.39, cz); candle.castShadow = true; g.add(candle);
      const flame = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 8), M.flame);
      flame.scale.set(1, 2.1, 1);
      flame.position.set(cx, t.y + 0.56, cz);
      flame.name = 'flame';
      g.add(flame);
      lights.flames.push(flame);
      // crystal drops
      for (let k = 0; k < 3; k++) {
        drops.push([cx * (0.6 + k * 0.12), t.y - 0.08 - k * 0.14, cz * (0.6 + k * 0.12)]);
      }
    }
  }
  // hanging swags of crystal
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * Math.PI * 2;
    drops.push([Math.cos(a) * 0.5, bodyY - 0.75 - Math.abs(Math.sin(i * 1.7)) * 0.25, Math.sin(a) * 0.5]);
  }
  const dropMesh = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.045, 0), M.crystal, drops.length);
  const dm = new THREE.Matrix4(), ds = new THREE.Vector3(1, 1.7, 1), dq = new THREE.Quaternion();
  drops.forEach((p, i) => {
    dm.compose(new THREE.Vector3(p[0], p[1], p[2]), dq, ds);
    dropMesh.setMatrixAt(i, dm);
  });
  dropMesh.instanceMatrix.needsUpdate = true;
  g.add(dropMesh);
  const finial = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), M.crystal);
  finial.position.set(0, bodyY - 1.0, 0); g.add(finial);

  const l = new THREE.PointLight(0xffcf92, 26, 16, 2);
  l.position.set(0, bodyY, 0);
  l.castShadow = false;
  g.add(l);
  lights.candleLights.push(l);
  return g;
}

function buildSconce(M, x, y, z, ry, lights) {
  const g = new THREE.Group();
  g.position.set(x, y, z); g.rotation.y = ry;
  const back = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.75), M.ornCartouche);
  back.position.set(0, 0.1, 0.01);
  g.add(back);
  for (const sx of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.022, 8, 18, Math.PI * 0.8), M.gilt);
    arm.position.set(sx * 0.08, -0.02, 0.12);
    arm.rotation.set(0, sx * 0.4, sx * 1.2);
    arm.castShadow = true;
    g.add(arm);
    const pan = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.04, 0.04, 12), M.gilt);
    pan.position.set(sx * 0.2, 0.06, 0.2); g.add(pan);
    const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.025, 0.22, 10),
      new THREE.MeshStandardMaterial({ color: 0xfdf3dd, roughness: 0.7 }));
    candle.position.set(sx * 0.2, 0.19, 0.2); g.add(candle);
    const flame = new THREE.Mesh(new THREE.SphereGeometry(0.024, 8, 8), M.flame);
    flame.scale.set(1, 2.2, 1);
    flame.position.set(sx * 0.2, 0.33, 0.2);
    g.add(flame);
    lights.flames.push(flame);
  }
  return g;
}

// The near wall: a single tall doorway with an overdoor cartouche, and three
// arched windows at gallery level so the room is lit from both ends.
function buildSouthWall(M, perMetre, uv1) {
  const g = new THREE.Group(); g.name = 'wall-south';
  const { w, wallH, z1, wallT } = ROOM;
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2, 0); shape.lineTo(w / 2, 0); shape.lineTo(w / 2, wallH); shape.lineTo(-w / 2, wallH); shape.closePath();
  shape.holes.push(archShape(SOUTH_DOOR.w, SOUTH_DOOR.h, 0, 0));
  for (const x of SOUTH_WIN.xs) shape.holes.push(archShape(SOUTH_WIN.w, SOUTH_WIN.h, x, SOUTH_WIN.y));
  const geo = uv1(new THREE.ExtrudeGeometry(shape, { depth: wallT, bevelEnabled: false, curveSegments: 24 }));
  geo.translate(0, 0, z1);
  const mat = perMetre(M.silk, 0.34, 0.34);
  mat.side = THREE.DoubleSide;
  const wall = new THREE.Mesh(geo, mat);
  wall.castShadow = true; wall.receiveShadow = true;
  g.add(wall);

  const gilt = (wd, ht, dp, x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(wd, ht, dp), M.gilt);
    m.position.set(x, y, z); m.castShadow = true; g.add(m); return m;
  };
  // door architrave, keystone, overdoor cartouche
  const dr = SOUTH_DOOR.w / 2, dh = SOUTH_DOOR.h;
  const arch = new THREE.Mesh(new THREE.TorusGeometry(dr + 0.09, 0.09, 10, 44, Math.PI), M.gilt);
  arch.position.set(0, dh - dr, z1 - 0.02); arch.rotation.z = Math.PI; arch.castShadow = true; g.add(arch);
  for (const sx of [-1, 1]) gilt(0.18, dh - dr, 0.18, sx * (dr + 0.09), (dh - dr) / 2, z1 - 0.02);
  gilt(0.3, 0.46, 0.22, 0, dh + 0.14, z1 - 0.04);
  const crest = new THREE.Mesh(new THREE.PlaneGeometry(2.9, 1.45), M.ornCartouche);
  crest.position.set(0, dh + 0.92, z1 - 0.06); crest.rotation.y = Math.PI;
  g.add(crest);

  // door leaves — walnut with gilt mouldings, shut
  const oak = new THREE.MeshStandardMaterial({ color: 0x513322, roughness: 0.45, metalness: 0.05, envMapIntensity: 0.8 });
  for (const sx of [-1, 1]) {
    const leaf = new THREE.Mesh(uv1(new THREE.BoxGeometry(dr - 0.03, dh - 0.12, 0.07)), oak);
    leaf.position.set(sx * dr / 2, (dh - 0.12) / 2, z1 - 0.12);
    leaf.castShadow = true; leaf.receiveShadow = true; g.add(leaf);
    for (const [ph, py] of [[1.45, 0.92], [0.95, 2.42]]) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(dr - 0.34, ph), M.ornPanelUpper);
      p.position.set(sx * dr / 2, py, z1 - 0.155); p.rotation.y = Math.PI; g.add(p);
    }
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.055, 14, 10), M.gilt);
    knob.position.set(sx * 0.16, 1.08, z1 - 0.18); g.add(knob);
  }
  // dim vestibule beyond
  const beyond = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 4.6), new THREE.MeshBasicMaterial({ color: 0x1b1208 }));
  beyond.position.set(0, 1.9, z1 + 0.5); beyond.rotation.y = Math.PI; g.add(beyond);

  // upper glazing
  for (const x of SOUTH_WIN.xs) {
    const r = SOUTH_WIN.w / 2, hh = SOUTH_WIN.h, y = SOUTH_WIN.y;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r + 0.07, 0.07, 10, 36, Math.PI), M.gilt);
    ring.position.set(x, y + hh - r, z1 - 0.02); ring.rotation.z = Math.PI; ring.castShadow = true; g.add(ring);
    for (const sx of [-1, 1]) gilt(0.14, hh - r, 0.14, x + sx * (r + 0.07), y + (hh - r) / 2, z1 - 0.02);
    const shp = new THREE.Shape();
    shp.curves = archShape(SOUTH_WIN.w - 0.05, hh - 0.03, 0, 0).curves; shp.autoClose = true;
    const pane = new THREE.Mesh(new THREE.ShapeGeometry(shp, 24), M.glass);
    pane.position.set(x, y, z1 + 0.12); g.add(pane);
    for (let i = 1; i < 3; i++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.03, hh - 0.1, 0.05), M.gilt);
      b.position.set(x - r + (i / 3) * SOUTH_WIN.w, y + (hh - 0.1) / 2, z1 + 0.1); g.add(b);
    }
    for (let j = 1; j <= 3; j++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(SOUTH_WIN.w - 0.06, 0.03, 0.05), M.gilt);
      b.position.set(x, y + (j / 4) * (hh - r), z1 + 0.1); g.add(b);
    }
    const sill = new THREE.Mesh(new THREE.BoxGeometry(SOUTH_WIN.w + 0.5, 0.12, 0.26), M.marble);
    sill.position.set(x, y - 0.06, z1 - 0.12); sill.castShadow = true; g.add(sill);
  }
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(16, 9), new THREE.MeshBasicMaterial({ color: 0x93aec6 }));
  sky.position.set(0, 5.4, z1 + 1.6); sky.rotation.y = Math.PI;
  sky.name = 'south-sky';
  g.add(sky);
  return g;
}

// Enclosed glass lift: gilt cage, glazed on three sides, open toward the room.
// Two brass buttons (one in the cage, one on the landing post) call it.
function buildElevator(M) {
  const g = new THREE.Group(); g.name = 'elevator';
  const { x, z, w, d, h } = LIFT;
  const top = ROOM.galleryY;
  const glass = new THREE.MeshStandardMaterial({
    color: 0xeaf3f7, roughness: 0.06, metalness: 0.1,
    transparent: true, opacity: 0.28, envMapIntensity: 2.4, side: THREE.DoubleSide,
  });
  const brass = new THREE.MeshStandardMaterial({ color: 0xd8b169, roughness: 0.28, metalness: 1, envMapIntensity: 1.6 });

  // shaft: two guide columns against the wall, with a moulded head beam
  for (const sx of [-1, 1]) {
    const col = new THREE.Mesh(new THREE.BoxGeometry(0.13, top + 1.7, 0.13), M.gilt);
    col.position.set(x + sx * (w / 2 + 0.05), (top + 1.7) / 2, z + d / 2 + 0.08);
    col.castShadow = true; g.add(col);
  }
  const head = new THREE.Mesh(new THREE.BoxGeometry(w + 0.5, 0.2, 0.34), M.gilt);
  head.position.set(x, top + 1.72, z + d / 2 + 0.08); head.castShadow = true; g.add(head);
  const pulley = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.035, 10, 24), M.gilt);
  pulley.position.set(x, top + 1.55, z); pulley.rotation.y = Math.PI / 2; g.add(pulley);

  // the cage
  const cab = new THREE.Group(); cab.name = 'lift-cab';
  const rail = (wd, ht, dp, px, py, pz) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(wd, ht, dp), M.gilt);
    m.position.set(px, py, pz); m.castShadow = true; cab.add(m);
  };
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) rail(0.08, h, 0.08, sx * (w / 2), h / 2, sz * (d / 2));
  for (const py of [0.06, h - 0.06]) {
    rail(w + 0.08, 0.12, 0.1, 0, py, -d / 2);
    rail(w + 0.08, 0.12, 0.1, 0, py, d / 2);
    rail(0.1, 0.12, d, -w / 2, py, 0);
    rail(0.1, 0.12, d, w / 2, py, 0);
  }
  const floorPl = new THREE.Mesh(new THREE.BoxGeometry(w - 0.06, 0.09, d - 0.06), M.marble);
  floorPl.position.y = 0.05; floorPl.receiveShadow = true; cab.add(floorPl);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.14, 0.11, d + 0.14), M.giltDeep);
  roof.position.y = h + 0.05; roof.castShadow = true; cab.add(roof);
  // glazing on three sides; the fourth stays open onto the room
  const pane = (wd, ht, px, py, pz, ry) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(wd, ht), glass);
    m.position.set(px, py, pz); m.rotation.y = ry; cab.add(m);
  };
  pane(w - 0.12, h - 0.26, 0, h / 2, d / 2 - 0.01, 0);
  pane(d - 0.12, h - 0.26, w / 2 - 0.01, h / 2, 0, Math.PI / 2);
  pane(d - 0.12, h - 0.26, -w / 2 + 0.01, h / 2, 0, Math.PI / 2);
  // a lantern in the roof
  const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.075, 14, 10), new THREE.MeshStandardMaterial({
    color: 0xfff0cf, emissive: 0xffd79a, emissiveIntensity: 1.1, roughness: 0.5,
  }));
  lantern.position.y = h - 0.16; cab.add(lantern);
  const lamp = new THREE.PointLight(0xffd8a4, 1.8, 4, 2);
  lamp.position.y = h - 0.2; cab.add(lamp);

  const buttons = [];
  const buttonPlate = (px, py, pz, ry, parent) => {
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.3, 0.03), brass);
    plate.position.set(px, py, pz); plate.rotation.y = ry; plate.castShadow = true;
    parent.add(plate);
    for (const [i, dy] of [[0, 0.065], [1, -0.065]]) {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.022, 16), new THREE.MeshStandardMaterial({
        color: 0xf0d79a, roughness: 0.22, metalness: 1, emissive: 0x000000, envMapIntensity: 1.8,
      }));
      b.rotation.x = Math.PI / 2;
      b.position.set(0, dy, 0.024);
      b.name = i === 0 ? 'lift-up' : 'lift-down';
      plate.add(b);
      buttons.push(b);
    }
  };
  buttonPlate(w / 2 - 0.09, 1.18, -d / 2 + 0.14, -Math.PI / 2, cab);
  g.add(cab);

  // landing post outside the cage, on the room side
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 1.16, 12), M.gilt);
  post.position.set(x - w / 2 - 0.22, 0.58, z - d / 2 - 0.1);
  post.castShadow = true; g.add(post);
  const capital = new THREE.Mesh(new THREE.SphereGeometry(0.09, 14, 10), M.gilt);
  capital.position.set(post.position.x, 1.2, post.position.z); g.add(capital);
  const holder = new THREE.Group();
  holder.position.set(post.position.x, 1.02, post.position.z - 0.04);
  buttonPlate(0, 0, 0, 0, holder);
  g.add(holder);

  cab.position.set(x, 0, z);

  // marble sill bridging the gap between the gallery deck's end and the cab's
  // open side, so stepping in at the top isn't a stride over fresh air
  const sill = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.12, 0.36), M.marble);
  sill.position.set(x, top - 0.06, z - d / 2 - 0.15);
  sill.receiveShadow = true; g.add(sill);

  const lift = {
    group: g, cab, buttons, y: 0, target: 0, bottom: 0, top, moving: false, chime: 0,
    call() {
      if (this.moving) return;
      this.target = Math.abs(this.y - this.bottom) < 0.02 ? this.top : this.bottom;
      this.moving = true;
    },
    inside(p) {
      return Math.abs(p.x - x) < w / 2 - 0.12 && Math.abs(p.z - z) < d / 2 - 0.12
        && p.y - this.y > -0.4 && p.y - this.y < h + 1.2;
    },
    update(dt) {
      if (!this.moving) return 0;
      const dir = Math.sign(this.target - this.y);
      const step = Math.min(Math.abs(this.target - this.y), 1.05 * dt);
      this.y += dir * step;
      if (Math.abs(this.target - this.y) < 0.004) { this.y = this.target; this.moving = false; }
      cab.position.y = this.y;
      const glow = this.moving ? 0.9 : 0;
      for (const b of this.buttons) b.material.emissive.setRGB(glow * 0.55, glow * 0.34, 0);
      return dir * step;
    },
  };
  // Pressing either plate just calls the car — Interaction.activate expects
  // `userData.lift.open()`, the same contract as the other lift panels.
  for (const b of buttons) b.userData.lift = { label: 'ride the lift', open: () => lift.call() };
  return lift;
}

function buildLights(scene, group, M, tier) {
  const out = { flames: [], candleLights: [], t: 0 };

  const hemi = new THREE.HemisphereLight(0xd8e6f2, 0x8a6a4e, 0.55);
  scene.add(hemi);
  out.hemi = hemi;

  // daylight raking in through the end-wall glazing
  const sun = new THREE.DirectionalLight(0xfff2dc, 3.2);
  sun.position.set(-3.5, 9, -18);
  sun.target.position.set(1.5, 1.2, 3);
  sun.castShadow = true;
  sun.shadow.mapSize.setScalar(tier.shadowSize || 2048);
  const c = sun.shadow.camera;
  c.left = -11; c.right = 11; c.top = 11; c.bottom = -9; c.near = 2; c.far = 46;
  sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.025;
  scene.add(sun, sun.target);
  out.sun = sun;

  // bounced fill from the parquet, keeps the cove from going flat
  const fill = new THREE.PointLight(0xffe0bb, 8, 22, 2);
  fill.position.set(0, 1.4, 1.5);
  scene.add(fill);
  out.fill = fill;

  out.update = (dt) => {
    out.t += dt;
    for (let i = 0; i < out.flames.length; i++) {
      const f = out.flames[i];
      const s = 0.86 + Math.sin(out.t * 9 + i * 2.3) * 0.09 + Math.sin(out.t * 21 + i) * 0.05;
      f.scale.set(s, s * 2.1, s);
    }
    for (let i = 0; i < out.candleLights.length; i++) {
      const l = out.candleLights[i];
      const base = i === 0 ? 26 : 5.5;
      l.intensity = base * (0.93 + Math.sin(out.t * 7.5 + i * 1.7) * 0.05 + Math.sin(out.t * 17 + i) * 0.025);
    }
  };
  return out;
}
