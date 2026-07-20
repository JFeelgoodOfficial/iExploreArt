import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mulberry32, barkTexture, stoneTexture, leafClusterTexture, flowerCardTexture } from '../utils/proctex.js';
import { applyWind } from './wind.js';
import { ROOM, GLASS_S } from './layout.js';

// The walled garden behind the south glass: a giant tree, flower beds,
// a stone path — everything sways gently in the vertex-shader wind.

const CY = { z0: 14.3, z1: 23.8, x0: 0.6, x1: 23.4 };   // courtyard bounds
const TREE = { x: 12, z: 19.2 };

export function buildCourtyard(scene, mats, tier) {
  const group = new THREE.Group();
  group.name = 'courtyard';
  const rand = mulberry32(9001);

  // --- ground ---------------------------------------------------------------
  const grassMat = mats.grass || new THREE.MeshStandardMaterial({ color: 0x6d7d58, roughness: 1 });
  const grass = new THREE.Mesh(
    new THREE.PlaneGeometry(CY.x1 - CY.x0, CY.z1 - CY.z0),
    grassMat
  );
  grass.rotation.x = -Math.PI / 2;
  grass.position.set((CY.x0 + CY.x1) / 2, -0.03, (CY.z0 + CY.z1) / 2);
  grass.receiveShadow = true;
  // UVs in world scale
  const guv = grass.geometry.attributes.uv;
  for (let i = 0; i < guv.count; i++) guv.setXY(i, guv.getX(i) * (CY.x1 - CY.x0), guv.getY(i) * (CY.z1 - CY.z0));
  group.add(grass);

  // --- stone path from the glass to the tree --------------------------------
  const stoneTex = stoneTexture().map;
  stoneTex.repeat.set(1 / 1.6, 1 / 1.6);
  stoneTex.anisotropy = 4;
  const stoneMat = new THREE.MeshStandardMaterial({ map: stoneTex, roughness: 0.92 });
  const path = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.05, TREE.z - 14.2 + 1.6), stoneMat);
  pathUV(path.geometry, 2.0, TREE.z - 14.2 + 1.6);
  path.position.set(12, 0.005, (14.2 + TREE.z + 1.6) / 2);
  path.receiveShadow = true;
  group.add(path);

  // --- enclosure walls: an open-air room, walls as tall as the tree --------
  const WH = 8.4;
  const wallGeos = [
    new THREE.BoxGeometry(CY.x1 - CY.x0 + 0.6, WH, 0.35).translate((CY.x0 + CY.x1) / 2, WH / 2, CY.z1 + 0.05),
    new THREE.BoxGeometry(0.35, WH, CY.z1 - 14 + 0.3).translate(CY.x0 - 0.1, WH / 2, (14 + CY.z1) / 2),
    new THREE.BoxGeometry(0.35, WH, CY.z1 - 14 + 0.3).translate(CY.x1 + 0.1, WH / 2, (14 + CY.z1) / 2),
  ];
  worldUVAll(wallGeos);
  const walls = new THREE.Mesh(mergeGeometries(wallGeos), mats.plasterWarm);
  walls.receiveShadow = true;
  walls.castShadow = true;
  group.add(walls);
  // slim coping along the wall tops
  const copingGeos = [
    new THREE.BoxGeometry(CY.x1 - CY.x0 + 0.8, 0.12, 0.5).translate((CY.x0 + CY.x1) / 2, WH + 0.06, CY.z1 + 0.05),
    new THREE.BoxGeometry(0.5, 0.12, CY.z1 - 14 + 0.4).translate(CY.x0 - 0.1, WH + 0.06, (14 + CY.z1) / 2),
    new THREE.BoxGeometry(0.5, 0.12, CY.z1 - 14 + 0.4).translate(CY.x1 + 0.1, WH + 0.06, (14 + CY.z1) / 2),
  ];
  const coping = new THREE.Mesh(mergeGeometries(copingGeos), mats.concrete);
  coping.castShadow = true;
  group.add(coping);
  // gravel strip at the foot of the display wall, under the three paintings
  const gravel = new THREE.Mesh(new THREE.BoxGeometry(CY.x1 - CY.x0 - 1, 0.06, 1.4), mats.concrete);
  gravel.position.set((CY.x0 + CY.x1) / 2, 0.0, CY.z1 - 0.9);
  gravel.receiveShadow = true;
  group.add(gravel);

  // --- the giant tree -------------------------------------------------------
  const bark = barkTexture();
  const barkMat = new THREE.MeshStandardMaterial({ map: bark.map, roughness: 0.95 });
  const trunkGeos = [];

  // trunk: stacked, slightly tilting tapered segments
  let base = new THREE.Vector3(TREE.x, 0, TREE.z);
  let dir = new THREE.Vector3(0, 1, 0);
  let radius = 0.55;
  for (let s = 0; s < 4; s++) {
    const len = 1.1 + s * 0.15;
    const next = base.clone().addScaledVector(dir, len);
    trunkGeos.push(limb(base, next, radius, radius * 0.82));
    base = next;
    radius *= 0.82;
    dir = dir.clone().add(new THREE.Vector3((rand() - 0.5) * 0.16, 0, (rand() - 0.5) * 0.16)).normalize();
  }
  // primary branches fanning out from the crown point
  const crown = base.clone();
  const branchTips = [];
  const nBranch = 6;
  for (let b = 0; b < nBranch; b++) {
    const ang = (b / nBranch) * Math.PI * 2 + rand() * 0.5;
    let bDir = new THREE.Vector3(Math.cos(ang) * 0.75, 0.85 + rand() * 0.35, Math.sin(ang) * 0.75).normalize();
    let bBase = crown.clone();
    let bRad = radius * (0.55 + rand() * 0.2);
    const segs = 3;
    for (let s = 0; s < segs; s++) {
      const len = 1.5 - s * 0.25 + rand() * 0.5;
      const next = bBase.clone().addScaledVector(bDir, len);
      trunkGeos.push(limb(bBase, next, bRad, bRad * 0.6));
      bBase = next;
      bRad *= 0.6;
      bDir = bDir.clone().add(new THREE.Vector3((rand() - 0.5) * 0.7, 0.25 + rand() * 0.2, (rand() - 0.5) * 0.7)).normalize();
      branchTips.push(next.clone());
    }
  }
  const trunk = new THREE.Mesh(mergeGeometries(trunkGeos), barkMat);
  trunk.castShadow = true;
  trunk.receiveShadow = true;
  group.add(trunk);

  // --- canopy: instanced leaf-cluster cards around the branch tips ----------
  const leafTexs = [leafClusterTexture(256, 7, 0), leafClusterTexture(256, 8, -14)];
  const canopyCount = tier.name === 'high' ? 150 : 90;
  const canopies = [];
  for (let v = 0; v < 2; v++) {
    const leafMat = new THREE.MeshStandardMaterial({
      map: leafTexs[v], alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.9,
    });
    applyWind(leafMat, { strength: 0.14, y0: 3.0, y1: 8.5 });
    const card = new THREE.PlaneGeometry(2.2, 2.2);
    const inst = new THREE.InstancedMesh(card, leafMat, Math.ceil(canopyCount / 2));
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    const center = new THREE.Vector3(TREE.x, 6.4, TREE.z);
    for (let i = 0; i < inst.count; i++) {
      // bias positions toward branch tips, jittered into an ellipsoid shell
      const tip = branchTips[Math.floor(rand() * branchTips.length)];
      const p = tip.clone().lerp(center, rand() * 0.5);
      p.x += (rand() - 0.5) * 2.6;
      p.y += (rand() - 0.3) * 2.0;
      p.z += (rand() - 0.5) * 2.6;
      e.set((rand() - 0.5) * 0.9, rand() * Math.PI * 2, (rand() - 0.5) * 0.9);
      q.setFromEuler(e);
      const s = 0.8 + rand() * 1.1;
      m.compose(p, q, new THREE.Vector3(s, s, s));
      inst.setMatrixAt(i, m);
    }
    inst.instanceMatrix.needsUpdate = true;
    inst.castShadow = true;
    inst.customDepthMaterial = new THREE.MeshDepthMaterial({
      depthPacking: THREE.RGBADepthPacking, map: leafTexs[v], alphaTest: 0.4,
    });
    canopies.push(inst);
    group.add(inst);
  }

  // --- flower beds ----------------------------------------------------------
  // dark soil strips along the glass and side walls
  const soilMat = new THREE.MeshStandardMaterial({ color: 0x3a2f26, roughness: 1 });
  // split at the door so the path stays clear
  const soilGeos = [
    new THREE.BoxGeometry(7.3, 0.12, 0.85).translate(6.85, 0.03, CY.z0 + 0.62),
    new THREE.BoxGeometry(7.3, 0.12, 0.85).translate(17.15, 0.03, CY.z0 + 0.62),
    new THREE.BoxGeometry(5.5, 0.12, 1.0).translate(4.4, 0.03, CY.z1 - 2.0),
    new THREE.BoxGeometry(5.5, 0.12, 1.0).translate(19.6, 0.03, CY.z1 - 2.0),
  ];
  const soil = new THREE.Mesh(mergeGeometries(soilGeos), soilMat);
  soil.receiveShadow = true;
  group.add(soil);

  // flowers: crossed-quad instanced cards in three colourways
  const flowerHues = [16, 335, 48]; // terracotta, magenta-rose, gold
  const flowerZones = [
    { x0: 3.4, x1: 10.3, z0: CY.z0 + 0.3, z1: CY.z0 + 1.0 },
    { x0: 13.7, x1: 20.6, z0: CY.z0 + 0.3, z1: CY.z0 + 1.0 },
    { x0: 2.0, x1: 6.9, z0: CY.z1 - 2.45, z1: CY.z1 - 1.6 },
    { x0: 17.1, x1: 22.0, z0: CY.z1 - 2.45, z1: CY.z1 - 1.6 },
    { x0: TREE.x - 3.4, x1: TREE.x + 3.4, z0: TREE.z - 3.0, z1: TREE.z + 3.0 }, // ring under tree
  ];
  const crossGeo = crossedQuads(0.5, 0.6);
  const perColour = Math.ceil(tier.flowers / flowerHues.length);
  for (let f = 0; f < flowerHues.length; f++) {
    const tex = flowerCardTexture(256, 100 + f * 13, flowerHues[f]);
    const fMat = new THREE.MeshStandardMaterial({
      map: tex, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.95,
    });
    applyWind(fMat, { strength: 0.05, y0: 0.0, y1: 0.6 });
    const inst = new THREE.InstancedMesh(crossGeo, fMat, perColour);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    for (let i = 0; i < inst.count; i++) {
      const zone = flowerZones[Math.floor(rand() * flowerZones.length)];
      let x = zone.x0 + rand() * (zone.x1 - zone.x0);
      let z = zone.z0 + rand() * (zone.z1 - zone.z0);
      // keep the tree-ring flowers off the path and trunk
      if (zone === flowerZones[4]) {
        const dx = x - TREE.x, dz = z - TREE.z;
        const d = Math.hypot(dx, dz);
        if (d < 1.3) { const k = (1.3 + rand() * 1.6) / (d || 1); x = TREE.x + dx * k; z = TREE.z + dz * k; }
        if (Math.abs(x - 12) < 1.2 && z < TREE.z) x += x < 12 ? -1.4 : 1.4;
      }
      e.set(0, rand() * Math.PI, 0);
      q.setFromEuler(e);
      const s = 0.7 + rand() * 0.7;
      m.compose(new THREE.Vector3(x, 0.28 * s, z), q, new THREE.Vector3(s, s, s));
      inst.setMatrixAt(i, m);
    }
    inst.instanceMatrix.needsUpdate = true;
    group.add(inst);
  }

  // --- a pair of stone benches under the tree -------------------------------
  const benchGeos = [
    new THREE.BoxGeometry(1.7, 0.12, 0.5).translate(TREE.x - 3.2, 0.42, TREE.z + 0.6),
    new THREE.BoxGeometry(0.3, 0.36, 0.4).translate(TREE.x - 3.8, 0.18, TREE.z + 0.6),
    new THREE.BoxGeometry(0.3, 0.36, 0.4).translate(TREE.x - 2.6, 0.18, TREE.z + 0.6),
    new THREE.BoxGeometry(1.7, 0.12, 0.5).translate(TREE.x + 3.3, 0.42, TREE.z - 0.4),
    new THREE.BoxGeometry(0.3, 0.36, 0.4).translate(TREE.x + 2.7, 0.18, TREE.z - 0.4),
    new THREE.BoxGeometry(0.3, 0.36, 0.4).translate(TREE.x + 3.9, 0.18, TREE.z - 0.4),
  ];
  const benches = new THREE.Mesh(mergeGeometries(benchGeos), mats.concrete);
  benches.castShadow = true;
  benches.receiveShadow = true;
  group.add(benches);

  scene.add(group);
  return { group };
}

// tapered limb between two points
function limb(a, b, r0, r1) {
  const len = a.distanceTo(b);
  const g = new THREE.CylinderGeometry(r1, r0, len, 7, 1);
  g.translate(0, len / 2, 0);
  const dir = b.clone().sub(a).normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  g.applyQuaternion(q);
  g.translate(a.x, a.y, a.z);
  return g;
}

function crossedQuads(w, h) {
  const a = new THREE.PlaneGeometry(w, h);
  const b = new THREE.PlaneGeometry(w, h);
  b.rotateY(Math.PI / 2);
  return mergeGeometries([a, b]);
}

function pathUV(g, w, d) {
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w, uv.getY(i) * d);
}

function worldUVAll(geos) {
  // approximate world-scale UVs for the tall walls so plaster doesn't stretch
  for (const g of geos) {
    const size = new THREE.Vector3();
    g.computeBoundingBox();
    g.boundingBox.getSize(size);
    const uv = g.attributes.uv;
    const su = Math.max(size.x, size.z), sv = size.y;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
  }
}
