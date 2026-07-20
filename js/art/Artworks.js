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

    // Shaped works carry an alpha channel; `outline` is the opaque silhouette as
    // fractions of the source image. bb is its bounding box — the plane samples
    // only that region so the art centres in the slot, and the frame follows the
    // outline rather than the transparent image rectangle.
    const shaped = !!art.outline;
    const bb = shaped ? bboxOf(art.outline) : [0, 0, 1, 1];

    // --- canvas ---
    const canvasMat = new THREE.MeshStandardMaterial({
      roughness: 0.82,
      transparent: !!art.transparent,   // let the wall show through cut-out areas
      alphaTest: art.transparent ? 0.06 : 0,
    });
    if (art.image) {
      canvasMat.map = texLoader.load(
        art.image,
        (t) => {
          t.colorSpace = THREE.SRGBColorSpace;
          t.anisotropy = 8;
          if (shaped) {
            // crop the sampled region to the opaque bounding box
            t.offset.set(bb[0], 1 - bb[3]);
            t.repeat.set(bb[2] - bb[0], bb[3] - bb[1]);
            t.needsUpdate = true;
          }
          // keep manifest width, adapt height to the sampled region's aspect
          const aspect = (t.image.width * (bb[2] - bb[0])) / (t.image.height * (bb[3] - bb[1]));
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

    // --- frame ---
    const bar = 0.075, depth = 0.07;
    if (shaped) {
      // trace the opaque silhouette; no backing board so the wall reads through
      addOutlineFrame(frameGeos, art.outline, bb, w, h, bar, depth, pos, n, yaw);
    } else {
      // four mitred-ish bars + backing board
      const fw = w + bar * 2, fh = h + bar * 2;
      addBar(frameGeos, fw, bar, depth, pos, n, yaw, 0, h / 2 + bar / 2);
      addBar(frameGeos, fw, bar, depth, pos, n, yaw, 0, -(h / 2 + bar / 2));
      addBar(frameGeos, bar, h, depth, pos, n, yaw, w / 2 + bar / 2, 0);
      addBar(frameGeos, bar, h, depth, pos, n, yaw, -(w / 2 + bar / 2), 0);
      const back = new THREE.BoxGeometry(fw, fh, 0.02);
      orient(back, pos, n, yaw, 0, 0, 0.01);
      frameGeos.push(back);
    }

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

// bounding box [x0,y0,x1,y1] of a list of [x,y] outline points.
function bboxOf(outline) {
  let x0 = 1, y0 = 1, x1 = 0, y1 = 0;
  for (const [x, y] of outline) {
    x0 = Math.min(x0, x); y0 = Math.min(y0, y);
    x1 = Math.max(x1, x); y1 = Math.max(y1, y);
  }
  return [x0, y0, x1, y1];
}

// Trace a rectilinear frame along the artwork's opaque silhouette. Outline
// points are image fractions (x east, y from top); bb is their bounding box,
// which the canvas plane (w × h) is sized to. Each edge becomes a bar centred
// on the outline; the +bar overlap fills the corners.
function addOutlineFrame(list, outline, bb, w, h, bar, depth, pos, n, yaw) {
  const [bx0, by0, bx1, by1] = bb;
  const toLocal = ([fx, fy]) => [
    ((fx - bx0) / (bx1 - bx0) - 0.5) * w,
    (0.5 - (fy - by0) / (by1 - by0)) * h,
  ];
  const pts = outline.map(toLocal);
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const cx = (a[0] + b[0]) / 2, cy = (a[1] + b[1]) / 2;
    const dx = Math.abs(b[0] - a[0]), dy = Math.abs(b[1] - a[1]);
    if (dx < 1e-4) addBar(list, bar, dy + bar, depth, pos, n, yaw, cx, cy);       // vertical edge
    else           addBar(list, dx + bar, bar, depth, pos, n, yaw, cx, cy);       // horizontal edge
  }
}

// place geometry in the slot's local frame: x = along wall, y = up, z = out
function orient(g, pos, n, yaw, ox, oy, oz) {
  g.translate(ox, oy, 0);
  g.rotateY(yaw);
  g.translate(pos.x + n.x * oz, pos.y, pos.z + n.z * oz);
}
