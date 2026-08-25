import * as THREE from 'three';
import { FEATURED, featuredResidency, featuredArtwork } from '../../data/featured.js';
import { buildReceptionDesk, signTexture } from './Details.js';
import { loadArtTexture } from '../art/load.js';

// The reception foyer — where every visit begins. A small lobby, not a
// gallery: the reception desk with Mira behind it, the house sign above,
// a single door in the north wall that opens onto the currently featured
// show (data/featured.js), and one work from that show beside the door.
//
// The foyer shares the one world scene the way every room does — as a layer
// the RoomManager toggles — and sits on its own coordinate patch, east of the
// gallery's footprint, so the hidden reception hall's positional audio (the
// wall fountain) stays out of earshot.
//
// The doorway is a dressed reveal, solid to collision: the walk-through is an
// invisible hitbox in front of it (userData.door), the same trick every
// residency exit uses, so the visitor presses E at the door and rides the veil.

const X0 = 40;                                   // west edge of the patch
export const FY = { x0: X0, x1: X0 + 7, z0: 0, z1: 6, h: 3.4 };
export const FY_DESK = { x0: X0 + 1.0, x1: X0 + 1.8, z0: 1.6, z1: 4.0, h: 1.08 };
export const FY_CURATOR = { x: X0 + 0.62, z: 2.8, facing: Math.PI / 2 };
const DOOR = { x0: X0 + 3.0, x1: X0 + 4.6, h: 2.4 };   // in the north wall
const DOOR_CX = (DOOR.x0 + DOOR.x1) / 2;

// Facing west: the desk, the sign, and Mira are the first thing a visitor
// sees — she has the instructions.
export const SPAWN = { x: X0 + 4.9, z: 2.8, yaw: Math.PI / 2 };

export const foyerGround = () => 0;

const seg = (ax, az, bx, bz, level = 'all') => ({ a: [ax, az], b: [bx, bz], level });
function rect(x0, z0, x1, z1, level = 'all') {
  return [seg(x0, z0, x1, z0, level), seg(x1, z0, x1, z1, level),
          seg(x1, z1, x0, z1, level), seg(x0, z1, x0, z0, level)];
}

export function buildFoyerColliders() {
  // The perimeter stays solid across the doorway — the door hitbox teleports
  // the visitor before the wall could matter.
  return [...rect(FY.x0, FY.z0, FY.x1, FY.z1),
          ...rect(FY_DESK.x0, FY_DESK.z0, FY_DESK.x1, FY_DESK.z1, 0)];
}

// opts: { anisotropy, artMaxEdge, onDoor } — onDoor is called when the visitor
// takes the featured door; main.js points it at travelTo(featured hall).
export function buildFoyerRoom(scene, mats, opts = {}) {
  const { anisotropy = 8, artMaxEdge = 0, onDoor } = opts;
  const g = new THREE.Group();
  g.name = 'foyer';

  const f = featuredResidency();

  const box = (w, h, d, mat, x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
    return m;
  };

  const W = FY.x1 - FY.x0;                        // 7
  const D = FY.z1 - FY.z0;                        // 6
  const CX = FY.x0 + W / 2, CZ = FY.z0 + D / 2;

  // --- shell ----------------------------------------------------------------
  // Two solid walls (west carries the desk and sign, north the door and the
  // featured work). The other two — east and south — are open above a glass
  // parapet: the room sits at the corner of an infinity pool, sunset over the
  // water to the east, night over it to the south, a city all round. The
  // perimeter colliders stay on the wall lines, so the water is only looked at.
  const floor = box(W + 0.6, 0.1, D + 1.2, mats.wood, CX, -0.05, CZ - 0.3);
  floor.castShadow = false;
  const ceil = box(W + 0.6, 0.2, D + 0.6, mats.plasterWarm, CX, FY.h + 0.1, CZ);
  ceil.castShadow = false;
  box(0.3, FY.h, D + 0.6, mats.plaster, FY.x0 - 0.15, FY.h / 2, CZ);          // west
  // north wall, opened around the doorway
  const wN = DOOR.x0 - (FY.x0 - 0.3);
  box(wN, FY.h, 0.3, mats.plaster, FY.x0 - 0.3 + wN / 2, FY.h / 2, FY.z0 - 0.15);
  const eN = (FY.x1 + 0.3) - DOOR.x1;
  box(eN, FY.h, 0.3, mats.plaster, DOOR.x1 + eN / 2, FY.h / 2, FY.z0 - 0.15);
  box(DOOR.x1 - DOOR.x0, FY.h - DOOR.h, 0.3, mats.plaster,
      DOOR_CX, DOOR.h + (FY.h - DOOR.h) / 2, FY.z0 - 0.15);                   // lintel

  // --- the open corner: parapet, posts, water, sky, city --------------------
  const update = buildPoolCorner(g, mats);

  // --- the doorway reveal ---------------------------------------------------
  // Walnut jambs and head, a shallow dark throat, and a closed pair of doors
  // at the back of it — the hall beyond is reached on the veil, so the reveal
  // only has to promise a somewhere.
  const RD = 0.5;                                 // reveal depth
  box(0.09, DOOR.h, RD, mats.woodDark, DOOR.x0 + 0.045, DOOR.h / 2, FY.z0 - RD / 2);
  box(0.09, DOOR.h, RD, mats.woodDark, DOOR.x1 - 0.045, DOOR.h / 2, FY.z0 - RD / 2);
  box(DOOR.x1 - DOOR.x0, 0.09, RD, mats.woodDark, DOOR_CX, DOOR.h - 0.045, FY.z0 - RD / 2);
  const revealFloor = box(DOOR.x1 - DOOR.x0, 0.02, RD, mats.woodDark, DOOR_CX, 0.01, FY.z0 - RD / 2);
  revealFloor.castShadow = false;
  // the door leaves, dark with brass pulls
  const leafW = (DOOR.x1 - DOOR.x0 - 0.18) / 2;
  for (const s of [-1, 1]) {
    box(leafW, DOOR.h - 0.13, 0.06, mats.woodDark,
        DOOR_CX + s * (leafW / 2 + 0.01), (DOOR.h - 0.13) / 2, FY.z0 - RD + 0.08);
    const pull = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.3, 8), mats.brass);
    pull.position.set(DOOR_CX + s * 0.12, 1.05, FY.z0 - RD + 0.13);
    g.add(pull);
  }

  // --- reception desk (the one that used to stand in the hall) --------------
  buildReceptionDesk(g, mats, FY_DESK);

  // --- signage --------------------------------------------------------------
  // Above the desk: the house name over the current show — the first thing the
  // visitor reads, facing them as they arrive.
  const deskSign = new THREE.Mesh(
    new THREE.PlaneGeometry(2.2, 0.62),
    new THREE.MeshBasicMaterial({ map: signTexture('iExploreArt', `Now Showing · ${f.artist}`), transparent: true })
  );
  deskSign.position.set(FY.x0 + 0.02, 2.35, 2.8);
  deskSign.rotation.y = Math.PI / 2;
  g.add(deskSign);

  // Over the door: where that door goes.
  const lintelSign = new THREE.Mesh(
    new THREE.PlaneGeometry(1.7, 0.48),
    new THREE.MeshBasicMaterial({ map: signTexture(FEATURED.series, `${f.artist} — ${f.name}`), transparent: true })
  );
  lintelSign.position.set(DOOR_CX, DOOR.h + 0.48, FY.z0 + 0.02);
  g.add(lintelSign);

  // --- the featured work, beside the door -----------------------------------
  // Hung the way its own hall hangs it (js/world/chadrea/chadrea.js): an
  // unframed box canvas at true size, interactable, photograph loaded in.
  const interactables = [];
  const piece = featuredArtwork();
  if (piece) {
    const [w, h] = piece.size || [1.2, 1.2];
    const edge = () => new THREE.MeshStandardMaterial({ color: 0x8a8177, roughness: 0.92 });
    const face = new THREE.MeshStandardMaterial({ color: 0x2e2823, roughness: 0.66, metalness: 0 });
    const canvas = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.045), [
      edge(), edge(), edge(), edge(), face, edge(),
    ]);
    canvas.position.set(FY.x0 + 5.85, 1.55, FY.z0 + 0.047);
    canvas.castShadow = true;
    canvas.receiveShadow = true;
    canvas.name = 'art-foyer-featured';
    canvas.userData.artwork = piece;
    g.add(canvas);
    interactables.push(canvas);
    if (piece.image) {
      loadArtTexture(piece.image, { anisotropy, px: piece.px, maxEdge: artMaxEdge }, (tx) => {
        face.map = tx;
        face.color.setHex(0xffffff);
        face.needsUpdate = true;
      });
    }
  }

  // --- the way in -----------------------------------------------------------
  // Invisible but raycastable, standing just proud of the reveal so the prompt
  // reads while the visitor walks up. Pressing E rides the veil to the hall.
  const door = new THREE.Mesh(
    new THREE.PlaneGeometry(1.8, DOOR.h),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
  );
  door.position.set(DOOR_CX, DOOR.h / 2, FY.z0 + 0.4);
  door.name = 'foyer-door-to-featured';
  door.userData.door = {
    label: `into ${f.name}`,
    onEnter: () => onDoor?.(),
  };
  g.add(door);

  // --- light ----------------------------------------------------------------
  const hemi = new THREE.HemisphereLight(0xf2e9db, 0x3d332a, 0.5);
  g.add(hemi);
  const spot = (x, y, z, tx, ty, tz, intensity, dist, angle, pen) => {
    const s = new THREE.SpotLight(0xffe7c8, intensity, dist, angle, pen, 1.8);
    s.position.set(x, y, z);
    s.target.position.set(tx, ty, tz);
    g.add(s, s.target);
    return s;
  };
  // the desk and Mira, warm and centred; this one carries the room's shadows
  const deskSpot = spot(FY.x0 + 2.7, FY.h - 0.1, 2.8, FY.x0 + 1.2, 1.0, 2.8, 14, 9, 0.62, 0.7);
  deskSpot.castShadow = true;
  deskSpot.shadow.mapSize.set(1024, 1024);
  deskSpot.shadow.bias = -0.0004;
  // the sign above the desk
  spot(FY.x0 + 2.2, FY.h - 0.1, 2.8, FY.x0, 2.35, 2.8, 7, 6, 0.5, 0.8);
  // the featured work
  spot(FY.x0 + 5.85, FY.h - 0.1, 1.7, FY.x0 + 5.85, 1.55, FY.z0, 9, 6, 0.5, 0.7);
  // the doorway and its lintel sign
  spot(DOOR_CX, FY.h - 0.1, 1.7, DOOR_CX, 1.6, FY.z0, 7, 6, 0.55, 0.8);

  scene.add(g);

  return {
    group: g,
    interactables,
    door,
    colliders: buildFoyerColliders(),
    spawn: SPAWN,
    update,               // the night side's stars twinkle
  };
}

// ---------------------------------------------------------------------------
// The pool corner. The foyer's east and south sides give onto one sheet of
// water that runs to an infinity edge with a city standing beyond it — and
// the sky above the water disagrees with itself on purpose: a vibrant sunset
// over the east side, a star-strewn night over the south, meeting in a band
// of twilight at the corner. One curved backdrop carries both, so there is no
// seam, only dusk.
//
// Everything out there is scenery, not world: the perimeter colliders hold
// the visitor at the parapet, the backdrop and towers are unlit and unfogged
// (the global haze would grey the night out), and the only moving part is the
// twinkle — one time uniform driving per-star point sizes.
function buildPoolCorner(g, mats) {
  const CXX = (FY.x0 + FY.x1) / 2, CZZ = (FY.z0 + FY.z1) / 2;
  const W = FY.x1 - FY.x0, D = FY.z1 - FY.z0;

  const add = (mesh) => { g.add(mesh); return mesh; };
  const noShadowBox = (w, h, d, mat, x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    return add(m);
  };

  // --- parapet: waist-high glass with a walnut cap, and one corner post ----
  // A quieter clone of the shared rail glass: at full envMapIntensity the
  // sheets catch the bright interior HDR and flare into white panels against
  // the night side.
  const parapetGlass = mats.railGlass.clone();
  parapetGlass.envMapIntensity = 0.25;
  parapetGlass.opacity = 0.12;
  noShadowBox(0.05, 1.02, D + 0.6, parapetGlass, FY.x1 + 0.02, 0.51, CZZ);
  noShadowBox(0.1, 0.045, D + 0.75, mats.woodDark, FY.x1 + 0.02, 1.05, CZZ);
  noShadowBox(W + 0.6, 1.02, 0.05, parapetGlass, CXX, 0.51, FY.z1 + 0.02);
  noShadowBox(W + 0.75, 0.045, 0.1, mats.woodDark, CXX, 1.05, FY.z1 + 0.02);
  const post = noShadowBox(0.16, FY.h + 0.2, 0.16, mats.steel, FY.x1 + 0.06, FY.h / 2, FY.z1 + 0.06);
  post.castShadow = true;

  // --- the water -----------------------------------------------------------
  // Two adjacent planes (never overlapping — coplanar water z-fights) tinted
  // for dusk; unfogged so the far reaches stay dark under the night side
  // instead of greying into the haze. scene.environment gives it its sheen.
  // Unlit on purpose: a lit material catches the foyer's hemisphere light and
  // reads as a fog bank, and the shared environment map is a bright interior
  // HDR. Flat dark dusk-water, with the reflections painted on as lanes.
  const water = new THREE.MeshBasicMaterial({ color: 0x152638, fog: false });
  const pool = (w, d, x, z) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), water);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, -0.07, z);
    add(m);
  };
  pool(68, 152, FY.x1 + 34, 31);          // east sheet
  pool(42, 100, FY.x1 - 21, FY.z1 + 50);  // south sheet, up to the east one's edge

  // the sunset's reflection on the east water: a broad warm wash, and the
  // sun's own glint lane down the middle of it
  const lane = (w, d, x, z, color, opacity, y, spin = 0) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, d),
      new THREE.MeshBasicMaterial({
        map: glintTexture(), transparent: true, blending: THREE.AdditiveBlending,
        depthWrite: false, fog: false, color, opacity,
      })
    );
    m.rotation.set(-Math.PI / 2, 0, spin);   // spin turns the lane in the water plane
    m.position.set(x, y, z);
    add(m);
  };
  lane(64, 42, FY.x1 + 32, CZZ + 6, 0xa03a4c, 0.35, -0.06);   // sky wash
  lane(50, 4.2, FY.x1 + 26, CZZ, 0xffb36b, 0.5, -0.055);      // sun glint
  // the moon's, faint, receding south toward it
  lane(36, 3.2, CXX - 8, FY.z1 + 20, 0x8fa4d8, 0.16, -0.055, Math.PI / 2);

  // --- the sky: one arc, night through dusk into sunset --------------------
  const SKY_R = 130, SKY_H = 140;
  const THETA0 = -0.7, THETA_LEN = 3.17;   // θ: 0 = south (+z), π/2 = east (+x)
  const skyGeo = new THREE.CylinderGeometry(SKY_R, SKY_R, SKY_H, 96, 1, true, THETA0, THETA_LEN);
  const sky = new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({
    map: skyTexture(THETA0, THETA_LEN), side: THREE.BackSide, fog: false, depthWrite: false,
  }));
  sky.position.set(CXX, 20, CZZ);
  sky.renderOrder = -2;
  sky.name = 'foyer-sky';
  add(sky);

  // --- the city, past the infinity edge ------------------------------------
  // A ring of silhouette towers standing well below pool level — the water
  // simply ends and the city is there under it. One instanced mesh; the night
  // side's towers get their windows as a separate point cloud.
  const N = 56;
  const towers = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshBasicMaterial({ color: 0x14101f, fog: false }),
    N
  );
  const M = new THREE.Matrix4();
  const windows = [];
  let seed = 9271;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  for (let i = 0; i < N; i++) {
    const th = THETA0 + 0.06 + ((THETA_LEN - 0.12) * i) / (N - 1) + (rnd() - 0.5) * 0.03;
    const r = 70 + rnd() * 35;
    const w = 4 + rnd() * 7, dep = 4 + rnd() * 7, h = 8 + rnd() * 18;
    const x = CXX + Math.sin(th) * r, z = CZZ + Math.cos(th) * r;
    // Bases sit under the water plane — the towers rise straight out of the
    // bay, so most of every tower clears the surface.
    M.makeScale(w, h, dep);
    M.setPosition(x, -8 + h / 2, z);
    towers.setMatrixAt(i, M);
    // lit windows on the faces that look back at the foyer — night side only,
    // and only above the waterline
    if (th < 0.55) {
      const count = 6 + Math.floor(rnd() * 14);
      for (let k = 0; k < count; k++) {
        const fr = r - dep / 2 - 0.3;
        const wx = CXX + Math.sin(th) * fr + (rnd() - 0.5) * w * 0.8;
        const wz = CZZ + Math.cos(th) * fr + (rnd() - 0.5) * 0.5;
        windows.push(wx, 0.5 + rnd() * (h - 7), wz);
      }
    }
  }
  towers.instanceMatrix.needsUpdate = true;
  add(towers);

  const winGeo = new THREE.BufferGeometry();
  winGeo.setAttribute('position', new THREE.Float32BufferAttribute(windows, 3));
  const winPts = new THREE.Points(winGeo, new THREE.PointsMaterial({
    map: starSprite(), color: 0xffd9a0, size: 0.9, transparent: true, opacity: 0.85,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false, sizeAttenuation: true,
  }));
  add(winPts);

  // --- the stars, and their twinkle ----------------------------------------
  // Scattered over the night arc only. The twinkle is one uTime uniform
  // scaling each star's point size on its own seed — the same trick the old
  // hall's dust motes use, applied to gl_PointSize instead of position.
  const S = 340;
  const sPos = new Float32Array(S * 3);
  const sSeed = new Float32Array(S);
  for (let i = 0; i < S; i++) {
    const th = THETA0 + 0.02 + rnd() * 1.05;             // south quadrant of the arc
    const r = SKY_R - 5;
    const y = 8 + Math.pow(rnd(), 0.7) * 76;
    sPos[i * 3] = CXX + Math.sin(th) * r;
    sPos[i * 3 + 1] = y;
    sPos[i * 3 + 2] = CZZ + Math.cos(th) * r;
    sSeed[i] = rnd() * Math.PI * 2;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
  starGeo.setAttribute('aSeed', new THREE.BufferAttribute(sSeed, 1));
  const starUniforms = { uTime: { value: 0 } };
  const starMat = new THREE.PointsMaterial({
    map: starSprite(), color: 0xeaf2ff, size: 1.1, transparent: true, opacity: 0.95,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false, sizeAttenuation: true,
  });
  starMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = starUniforms.uTime;
    shader.vertexShader = 'attribute float aSeed;\nuniform float uTime;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      'gl_PointSize = size;',
      'gl_PointSize = size * (0.55 + 0.45 * sin(uTime * (1.2 + fract(aSeed) * 1.6) + aSeed * 13.0));'
    );
  };
  const stars = new THREE.Points(starGeo, starMat);
  add(stars);

  // --- the light the two skies throw into the room -------------------------
  const sunLow = new THREE.DirectionalLight(0xff8f4f, 0.5);
  sunLow.position.set(CXX + 40, 7, CZZ);
  sunLow.target.position.set(CXX, 1, CZZ);
  g.add(sunLow, sunLow.target);
  const moonCool = new THREE.DirectionalLight(0x6f83c9, 0.28);
  moonCool.position.set(CXX - 4, 14, CZZ + 45);
  moonCool.target.position.set(CXX, 1, CZZ);
  g.add(moonCool, moonCool.target);

  return function update(t) {
    starUniforms.uTime.value = t;
  };
}

// The wrapped sky: canvas u runs along the arc (θ = THETA0 at u 0), v up.
// Night at the south end, a violet twilight band at the corner, then the
// sunset burning at the east — sun disc painted where θ = π/2 faces the
// east opening. A moon hangs in the night end.
function skyTexture(theta0, thetaLen) {
  const c = document.createElement('canvas');
  c.width = 2048; c.height = 512;
  const ctx = c.getContext('2d');
  const uOf = (theta) => (theta - theta0) / thetaLen;

  // paint per-column: blend night → sunset gradients across the arc
  const nightStops = [[0, '#02030c'], [0.55, '#071228'], [0.82, '#0d2138'], [1, '#173a52']];
  const sunsetStops = [[0, '#2a1a52'], [0.3, '#7c2a68'], [0.55, '#c33d52'], [0.78, '#f2793a'], [1, '#ffcf78']];
  const lerp = (a, b, k) => a + (b - a) * k;
  const hex = (s) => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
  const sample = (stops, v) => {
    for (let i = 1; i < stops.length; i++) {
      if (v <= stops[i][0]) {
        const k = (v - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0]);
        const a = hex(stops[i - 1][1]), b = hex(stops[i][1]);
        return [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
      }
    }
    return hex(stops[stops.length - 1][1]);
  };
  const uNightEnd = uOf(0.45), uSunsetStart = uOf(1.05);
  const img = ctx.createImageData(c.width, c.height);
  for (let x = 0; x < c.width; x++) {
    const u = x / (c.width - 1);
    // 0 = pure night, 1 = pure sunset, smooth twilight between
    let m = (u - uNightEnd) / (uSunsetStart - uNightEnd);
    m = Math.max(0, Math.min(1, m));
    m = m * m * (3 - 2 * m);
    for (let y = 0; y < c.height; y++) {
      const v = 1 - y / (c.height - 1);          // 1 at the top of the sky
      const down = 1 - v;                        // 1 at the horizon
      const nightPx = sample(nightStops, down);
      const sunsetPx = sample(sunsetStops, down);
      const i = (y * c.width + x) * 4;
      img.data[i] = lerp(nightPx[0], sunsetPx[0], m);
      img.data[i + 1] = lerp(nightPx[1], sunsetPx[1], m);
      img.data[i + 2] = lerp(nightPx[2], sunsetPx[2], m);
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  // the sun, low over the east water: a hot disc in a broad warm bloom
  const sunX = uOf(Math.PI / 2) * c.width;
  const sunY = c.height * 0.86;
  let grad = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, 300);
  grad.addColorStop(0, 'rgba(255,214,140,0.85)');
  grad.addColorStop(0.35, 'rgba(255,150,80,0.35)');
  grad.addColorStop(1, 'rgba(255,120,60,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(sunX - 320, sunY - 320, 640, 640);
  grad = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, 34);
  grad.addColorStop(0, 'rgba(255,246,222,1)');
  grad.addColorStop(0.75, 'rgba(255,214,140,0.95)');
  grad.addColorStop(1, 'rgba(255,190,110,0)');
  ctx.fillStyle = grad;
  ctx.beginPath(); ctx.arc(sunX, sunY, 34, 0, Math.PI * 2); ctx.fill();
  // a few flat cloud bars catching the light
  ctx.fillStyle = 'rgba(255,170,110,0.28)';
  for (const [dx, dy, w, h] of [[-260, -120, 340, 10], [-80, -170, 260, 8], [120, -90, 300, 12]]) {
    ctx.fillRect(sunX + dx, sunY + dy, w, h);
  }

  // the moon, high in the night end
  const moonX = uOf(-0.35) * c.width, moonY = c.height * 0.22;
  grad = ctx.createRadialGradient(moonX, moonY, 0, moonX, moonY, 60);
  grad.addColorStop(0, 'rgba(220,230,255,0.5)');
  grad.addColorStop(1, 'rgba(220,230,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(moonX - 60, moonY - 60, 120, 120);
  ctx.fillStyle = 'rgba(235,240,252,0.95)';
  ctx.beginPath(); ctx.arc(moonX, moonY, 13, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(160,175,210,0.5)';
  ctx.beginPath(); ctx.arc(moonX - 4, moonY - 3, 3.4, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(moonX + 5, moonY + 4, 2.2, 0, Math.PI * 2); ctx.fill();

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.ClampToEdgeWrapping;
  return t;
}

// A soft radial dot shared by the stars and the city windows.
let _starSprite = null;
function starSprite() {
  if (_starSprite) return _starSprite;
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const ctx = c.getContext('2d');
  const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.4, 'rgba(255,255,255,0.5)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 32, 32);
  _starSprite = new THREE.CanvasTexture(c);
  return _starSprite;
}

// The glint lane under the sun: bright at the far (sun) end, gone at the near.
function glintTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 32;
  const ctx = c.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 256, 0);
  grad.addColorStop(0, 'rgba(255,255,255,0)');
  grad.addColorStop(0.75, 'rgba(255,235,200,0.45)');
  grad.addColorStop(1, 'rgba(255,244,220,0.9)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 32);
  // soften the lane's edges
  const edge = ctx.createLinearGradient(0, 0, 0, 32);
  edge.addColorStop(0, 'rgba(0,0,0,1)');
  edge.addColorStop(0.35, 'rgba(0,0,0,0)');
  edge.addColorStop(0.65, 'rgba(0,0,0,0)');
  edge.addColorStop(1, 'rgba(0,0,0,1)');
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = edge;
  ctx.fillRect(0, 0, 256, 32);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
