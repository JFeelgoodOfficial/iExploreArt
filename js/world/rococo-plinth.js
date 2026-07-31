import * as THREE from 'three';
import { loadArtTexture } from '../art/load.js';
import { bboxOf } from '../art/fit.js';

// ---------------------------------------------------------------------------
// The table in the middle of the Rococo Hall: a dark stone column carrying a
// shaped, extruded panel that turns very slowly.
//
//   const plinth = buildPlinth(group, { art: INTO_BLOOM, aniso, maxEdge });
//   plinth.update(dt);   // driven by the gallery's frame loop
//
// Ported from a standalone scene, which brought its own renderer, camera,
// lights, floor, resize handling and requestAnimationFrame loop. All of that
// belongs to the gallery here, so what survives is the geometry, the materials
// and the spin. What did change:
//
//   • Height. The original stood 1.5 m with the camera looking down from 30°.
//     The gallery's eye height is 1.65 m, so a flat top up there is seen very
//     nearly edge-on and the piece reads as a sliver. At table height you look
//     down at it the way the original camera did.
//   • Size. The standalone scene took a `diameter`, and so does this: the top
//     is a shaped panel measured across the ARTWORK, and everything else — the
//     column, the cap, the foot, the collider — is derived from it. Change
//     PLINTH.diameter and the whole table follows.
// ---------------------------------------------------------------------------

export const PLINTH = {
  x: 0, z: 0,          // dead centre of the hall, under the chandelier
  h: 0.9,              // floor to the top disc
  diameter: 1.9,       // the ARTWORK's widest span, in metres — see below
  thickness: 0.05,
  spin: 0.13,          // rad/s — about 48 s a turn
  stone: 0x3c3a37,     // dark, so the pedestal recedes under the picture
  edge: 0x4a443e,      // the panel's own cut edge, not a mount or a mat
};
// How far the panel's silhouette sweeps from its centre as it turns. The
// collider in js/main.js is built from this, so nothing spinning inside a round
// barrier ever clips the visitor.
PLINTH.reach = 0;   // filled in by buildPlinth once the panel is sized

// Fallback silhouette for a work that declares no `outline`: the whole image.
// A shaped work should bring its own — see INTO_BLOOM in
// data/residency-artworks.js, whose round panel is traced there.
const RECT = [[0, 0], [1, 0], [1, 1], [0, 1]];

export function buildPlinth(parent, opts = {}) {
  const art = opts.art || null;
  const outline = art?.outline || RECT;
  const g = new THREE.Group();
  g.name = 'rococo-plinth';
  g.position.set(PLINTH.x, 0, PLINTH.z);

  // ---- the panel's size ---------------------------------------------------
  // Sized from the SILHOUETTE, not the file. The source is a photograph of a
  // round panel on a white ground, so the image rectangle is a good deal bigger
  // than the work and measuring the wrong one would leave the table oversized
  // and the picture adrift in it. Take the image's metre extents at its own
  // aspect, then scale until the silhouette's widest span is PLINTH.diameter.
  const [bx0, by0, bx1, by1] = bboxOf(outline);
  const px = art?.px || [1, 1];
  const aspect = px[0] / px[1];
  const [imgW, imgH] = aspect >= 1 ? [1, 1 / aspect] : [aspect, 1];
  const k = PLINTH.diameter / Math.max((bx1 - bx0) * imgW, (by1 - by0) * imgH);
  const sx = imgW * k, sz = imgH * k;

  // ---- pedestal -----------------------------------------------------------
  // Sized off the top so the proportions hold whatever PLINTH.diameter is set
  // to: the cap reads as roughly two thirds of the picture's span, as it did at
  // the original 1.3 m. Height is deliberately NOT scaled — 0.9 m is what makes
  // it a table you look down into at the gallery's 1.65 m eye height.
  const stone = new THREE.MeshStandardMaterial({
    color: PLINTH.stone, roughness: 0.72, metalness: 0,
  });
  const H = PLINTH.h;
  const r = PLINTH.diameter / 2;
  const col = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.32, r * 0.38, H, 48), stone);
  col.position.y = H / 2;
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.65, r * 0.65, 0.035, 64), stone);
  cap.position.y = H + 0.0175;
  const base = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.61, r * 0.63, 0.025, 48), stone);
  base.position.y = 0.0125;
  for (const m of [col, cap, base]) { m.castShadow = true; m.receiveShadow = true; }
  g.add(col, cap, base);
  const topY = H + 0.035;

  // ---- the panel ----------------------------------------------------------
  // The shape is built in the image's own 0..1 space, so ExtrudeGeometry's UV
  // generator lays the photograph across the caps at 0..1 and the silhouette
  // lands over exactly the pixels it was traced from. It is then translated to
  // put the SILHOUETTE's centre at the origin — position only, which is why the
  // UVs survive, and which is what keeps a shape that isn't centred in its file
  // turning about itself instead of orbiting. Scale takes it to metres: local x
  // and y become world x and z under the -90° tilt, local z is the thickness
  // and stays at 1 so `depth` is already in metres.
  const shape = new THREE.Shape();
  outline.forEach(([u, v], i) => (i === 0 ? shape.moveTo(u, 1 - v) : shape.lineTo(u, 1 - v)));
  shape.closePath();

  // No bevel: it belongs to the side material, so it wraps a ring of mount
  // colour onto the picture face and reads as a mat the work doesn't have.
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: PLINTH.thickness,
    curveSegments: 1,
    bevelEnabled: false,
  });
  geo.translate(-(bx0 + bx1) / 2, -(1 - (by0 + by1) / 2), 0);
  if (geo.attributes.uv && !geo.attributes.uv1) geo.setAttribute('uv1', geo.attributes.uv.clone());

  // caps carry the photograph, the extruded rim is plain stock
  const capMat = new THREE.MeshStandardMaterial({
    color: art ? 0x3a3129 : 0xffffff,   // waiting tint; cleared when the map lands
    roughness: 0.52, metalness: 0, envMapIntensity: 0.5,
  });
  const sideMat = new THREE.MeshStandardMaterial({
    color: PLINTH.edge, roughness: 0.88, metalness: 0,
  });

  const panel = new THREE.Mesh(geo, [capMat, sideMat]);
  panel.rotation.x = -Math.PI / 2;      // lay it flat
  panel.scale.set(sx, sz, 1);
  panel.position.y = topY;
  panel.name = 'plinth-panel';
  // Shadows are baked once per room entry (Lighting.js turns autoUpdate off), so
  // a turning caster would drag a frozen silhouette around under itself. The
  // column casts — it never moves — and the panel only receives.
  panel.castShadow = false;
  panel.receiveShadow = true;
  if (art) panel.userData.artwork = art;

  const spinner = new THREE.Group();
  spinner.name = 'plinth-spinner';
  spinner.add(panel);
  g.add(spinner);

  // The true sweep: the farthest silhouette point from the centre it turns
  // about, in metres. Measured off the outline rather than the image rectangle,
  // or the collider would stand off by the width of the photograph's margin.
  const cu = (bx0 + bx1) / 2, cv = (by0 + by1) / 2;
  PLINTH.reach = outline.reduce(
    (m, [u, v]) => Math.max(m, Math.hypot((u - cu) * sx, (cv - v) * sz)), 0,
  );

  if (art?.image) {
    loadArtTexture(art.image, { anisotropy: opts.aniso ?? 8, px: art.px, maxEdge: opts.maxEdge ?? 0 },
      (tx) => {
        capMat.map = tx;
        capMat.color.setHex(0xffffff);
        capMat.needsUpdate = true;
      });
  }

  parent.add(g);

  return {
    group: g, spinner, panel, material: capMat, artwork: art,
    // width/depth are the WORK's span, not the image's — see the sizing note above
    topY, width: (bx1 - bx0) * sx, depth: (by1 - by0) * sz, reach: PLINTH.reach,
    update(dt) { spinner.rotation.y += dt * PLINTH.spin; },
  };
}
