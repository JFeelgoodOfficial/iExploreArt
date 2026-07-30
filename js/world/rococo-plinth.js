import * as THREE from 'three';
import { loadArtTexture } from '../art/load.js';

// ---------------------------------------------------------------------------
// The table in the middle of the Rococo Hall: a slim stone column carrying a
// shaped, extruded panel that turns very slowly.
//
//   const plinth = buildPlinth(group, { art: INTO_BLOOM, aniso, maxEdge });
//   plinth.update(dt);   // driven by the gallery's frame loop
//
// Ported from a standalone scene, which brought its own renderer, camera,
// lights, floor, resize handling and requestAnimationFrame loop. All of that
// belongs to the gallery here, so what survives is the geometry, the materials
// and the spin. Two things did change:
//
//   • Height. The original stood 1.5 m with the camera looking down from 30°.
//     The gallery's eye height is 1.65 m, so a flat top up there is seen very
//     nearly edge-on and the piece reads as a sliver. At table height you look
//     down at it the way the original camera did. The column keeps its profile.
//   • Size. Scaled with the height (0.9 / 1.5) so the panel keeps the same
//     proportion to its column as it had at full height.
// ---------------------------------------------------------------------------

export const PLINTH = {
  x: 0, z: 0,          // dead centre of the hall, under the chandelier
  h: 0.9,              // floor to the top disc
  long: 1.30,          // the panel's longer edge, in metres
  thickness: 0.05,
  spin: 0.13,          // rad/s — about 48 s a turn
  stone: 0xcfc7bb,
  edge: 0xe6dccb,
};
// How far the panel's corner sweeps from the centre as it turns. The collider in
// js/main.js is built from this, so a rectangle spinning inside a round barrier
// never clips the visitor.
PLINTH.reach = 0;   // filled in by buildPlinth once the panel is sized

// The panel's outline, as fractions of the source image (x right, y down) —
// same convention as `outline` in data/artworks.js. 'Into Bloom' is a
// rectangular photograph with no alpha channel, so the silhouette is its own
// frame. Swap in a traced outline here and the extrusion follows it; nothing
// else needs to change.
const RECT = [[0, 0], [1, 0], [1, 1], [0, 1]];

export function buildPlinth(parent, opts = {}) {
  const art = opts.art || null;
  const outline = art?.outline || RECT;
  const g = new THREE.Group();
  g.name = 'rococo-plinth';
  g.position.set(PLINTH.x, 0, PLINTH.z);

  // ---- pedestal -----------------------------------------------------------
  const stone = new THREE.MeshStandardMaterial({
    color: PLINTH.stone, roughness: 0.72, metalness: 0,
  });
  const H = PLINTH.h;
  const col = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, H, 48), stone);
  col.position.y = H / 2;
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.31, 0.035, 56), stone);
  cap.position.y = H + 0.0175;
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.3, 0.025, 48), stone);
  base.position.y = 0.0125;
  for (const m of [col, cap, base]) { m.castShadow = true; m.receiveShadow = true; }
  g.add(col, cap, base);
  const topY = H + 0.035;

  // ---- the panel ----------------------------------------------------------
  // The shape is built in 0..1 so ExtrudeGeometry's UV generator lays the
  // photograph across the caps 0..1, then translated to centre it — position
  // only, which is why the UVs survive. Scale then takes it to metres: local x
  // and y become world x and z under the -90° tilt, local z is the thickness
  // and stays at 1 so `depth` is already in metres.
  const px = art?.px || [1, 1];
  const aspect = px[0] / px[1];
  const [sx, sz] = aspect >= 1
    ? [PLINTH.long, PLINTH.long / aspect]
    : [PLINTH.long * aspect, PLINTH.long];

  const shape = new THREE.Shape();
  outline.forEach(([u, v], i) => (i === 0 ? shape.moveTo(u, 1 - v) : shape.lineTo(u, 1 - v)));
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: PLINTH.thickness,
    curveSegments: 1,
    bevelEnabled: true,
    bevelThickness: PLINTH.thickness * 0.12,
    bevelSize: 0.004,
    bevelSegments: 2,
  });
  geo.translate(-0.5, -0.5, 0);
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

  PLINTH.reach = Math.hypot(sx, sz) / 2;

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
    topY, width: sx, depth: sz, reach: PLINTH.reach,
    update(dt) { spinner.rotation.y += dt * PLINTH.spin; },
  };
}
