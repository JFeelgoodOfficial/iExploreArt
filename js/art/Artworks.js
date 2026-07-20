import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ARTWORKS } from '../../data/artworks.js';
import { SLOTS } from '../world/layout.js';
import { generatePainting } from './placeholder.js';

// Hangs the collection: frame + canvas + brass placard per manifest entry.
// All frames merge into one mesh; each canvas is its own mesh (unique
// texture) and doubles as the interactable the raycaster hits.

export function buildArtworks(scene, mats, manager) {
  const slotById = Object.fromEntries(SLOTS.map(s => [s.id, s]));
  const group = new THREE.Group();
  group.name = 'artworks';
  const frameGeos = [];
  const placardGeos = [];
  const interactables = [];
  const texLoader = new THREE.TextureLoader(manager);

  for (const art of ARTWORKS) {
    const slot = slotById[art.slot];
    if (!slot) { console.warn(`[artworks] unknown slot ${art.slot} for ${art.id}`); continue; }

    let [w, h] = art.size;
    if (w > slot.maxW) { h *= slot.maxW / w; w = slot.maxW; }

    const pos = new THREE.Vector3(...slot.pos);
    const n = new THREE.Vector3(...slot.n);
    const yaw = Math.atan2(n.x, n.z); // rotate +Z face onto the normal

    // --- canvas ---
    const canvasMat = new THREE.MeshStandardMaterial({ roughness: 0.82 });
    if (art.image) {
      canvasMat.map = texLoader.load(
        art.image,
        (t) => {
          t.colorSpace = THREE.SRGBColorSpace;
          t.anisotropy = 8;
          // keep manifest width, adapt height to the photo's aspect
          const aspect = t.image.width / t.image.height;
          canvasMesh.scale.y = (w / aspect) / h;
        },
        undefined,
        () => { canvasMat.map = generatePainting(art.seed, art.palette, w / h); canvasMat.needsUpdate = true; }
      );
    } else {
      canvasMat.map = generatePainting(art.seed, art.palette, w / h);
    }

    const canvasMesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), canvasMat);
    canvasMesh.position.copy(pos).addScaledVector(n, 0.045);
    canvasMesh.rotation.y = yaw;
    canvasMesh.castShadow = false;
    canvasMesh.receiveShadow = true;
    canvasMesh.userData.artwork = art;
    group.add(canvasMesh);
    interactables.push(canvasMesh);

    // --- frame: four mitred-ish bars + backing board ---
    const bar = 0.075, depth = 0.07;
    const fw = w + bar * 2, fh = h + bar * 2;
    addBar(frameGeos, fw, bar, depth, pos, n, yaw, 0, h / 2 + bar / 2);
    addBar(frameGeos, fw, bar, depth, pos, n, yaw, 0, -(h / 2 + bar / 2));
    addBar(frameGeos, bar, h, depth, pos, n, yaw, w / 2 + bar / 2, 0);
    addBar(frameGeos, bar, h, depth, pos, n, yaw, -(w / 2 + bar / 2), 0);
    // backing board just behind the canvas
    const back = new THREE.BoxGeometry(fw, fh, 0.02);
    orient(back, pos, n, yaw, 0, 0, 0.01);
    frameGeos.push(back);

    // --- brass placard beside the frame ---
    const placard = new THREE.BoxGeometry(0.16, 0.1, 0.006);
    orient(placard, pos, n, yaw, w / 2 + bar + 0.17, -h / 2 + 0.28, 0.006);
    placardGeos.push(placard);
  }

  const frameMesh = new THREE.Mesh(mergeGeometries(frameGeos), mats.woodDark);
  frameMesh.castShadow = true;
  frameMesh.receiveShadow = true;
  group.add(frameMesh);

  const placardMesh = new THREE.Mesh(mergeGeometries(placardGeos), mats.brass);
  group.add(placardMesh);

  scene.add(group);
  return { group, interactables };
}

function addBar(list, bw, bh, depth, pos, n, yaw, ox, oy) {
  const g = new THREE.BoxGeometry(bw, bh, depth);
  orient(g, pos, n, yaw, ox, oy, depth / 2);
  list.push(g);
}

// place geometry in the slot's local frame: x = along wall, y = up, z = out
function orient(g, pos, n, yaw, ox, oy, oz) {
  g.translate(ox, oy, 0);
  g.rotateY(yaw);
  g.translate(pos.x + n.x * oz, pos.y, pos.z + n.z * oz);
}
