import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { mulberry32 } from '../utils/proctex.js';

// The view out of a window: a real 3D city, not a poster.
// Near buildings give true parallax; scene fog supplies aerial perspective;
// a facade shader draws window grids; birds and clouds keep it alive.
//
// The city is authored looking down −Z, which is where the gallery's north
// window points. A second instance serves the courtyard room's west windows;
// `opts` is what lets one builder cover both:
//
//   name         group name, so the two are tellable apart in the scene graph
//   seed         PRNG seed — a different skyline for a different window
//   yaw          rotates the whole city about Y. +π/2 swings the −Z spread onto
//                −X, which is what a west-facing window looks at.
//   surround     ring the building instead of fanning out ahead of one window.
//                The default city is a wedge along −Z, which is all a room with
//                one wall of glass can see; a room glazed on three sides (the
//                decetise plate) shows sky where the wedge runs out. This swings
//                every block round the compass instead. Counts are unchanged —
//                the same towers, redistributed — so it costs a rotation and
//                nothing else. `yaw` stops mattering when it is on.
//   fog          set scene.fog. Global and shared, so only the first caller
//                should; the distances suit any room whose interior is under
//                ~20 m across, which both of ours are.
//   sky          add a Sky dome
//   sunPosition  where that dome puts the sun. Match it to the room's own
//                directional light or the daylight reads from two directions.
//   nearProps    rooftop clutter (parapets, AC boxes, tanks). Off on the low
//                tier for a second instance — it is the fiddliest geometry here
//                and the least legible at distance.
//
// Everything is parented to `group`, INCLUDING the sky, so a caller wrapping
// this in RoomManager.captureLayer gets a city that hides with its room.

const HAZE = new THREE.Color(0xc6d2dc);

export function buildCityView(scene, renderer, opts = {}) {
  const {
    name = 'city', seed = 4242, yaw = 0, fog = true, sky: wantSky = true,
    sunPosition = new THREE.Vector3(-21, 30, 21), nearProps: wantNearProps = true,
    surround = false,
  } = opts;

  // Rotate a point about Y, the same sense as group.rotation.y. Everything
  // `surround` does is this, applied to positions that were authored along −Z.
  const spin = (x, z, a) => [x * Math.cos(a) + z * Math.sin(a), -x * Math.sin(a) + z * Math.cos(a)];

  const group = new THREE.Group();
  group.name = name;
  group.rotation.y = yaw;

  // --- atmosphere -----------------------------------------------------------
  if (fog) scene.fog = new THREE.Fog(HAZE, 55, 430);

  // The sun direction the caller asked for, expressed in the group's own frame
  // so the sky still lights from the right quarter after `yaw` turns the city.
  const sunDir = sunPosition.clone().normalize();
  const localSunDir = sunDir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), -yaw);
  if (wantSky) {
    const sky = new Sky();
    sky.scale.setScalar(2000);
    const su = sky.material.uniforms;
    su.turbidity.value = 7;
    su.rayleigh.value = 1.6;
    su.mieCoefficient.value = 0.004;
    su.mieDirectionalG.value = 0.8;
    su.sunPosition.value.copy(localSunDir);
    // Clamp the dome's own output. The sun disc this shader draws runs to five
    // and six figures of radiance, and the composer's buffer is half-float,
    // which tops out at 65504: a clear line of sight to the sun overflows it to
    // Infinity, UnrealBloomPass blurs that Infinity into NaN across the whole
    // mip chain, and the frame comes out solid black. It only bites where
    // nothing stands between a window and the sun, which is why it surfaced on
    // the decetise plate — every other room has the city in the way.
    //
    // 60 is far under the ceiling and still thirty times the bloom threshold
    // (js/Effects.js), so the sun keeps its glare and tone-maps to white.
    sky.material.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        'gl_FragColor = vec4( texColor, 1.0 );',
        'gl_FragColor = vec4( min( texColor, vec3( 60.0 ) ), 1.0 );'
      );
    };
    group.add(sky);
    // Only the instance that owns the atmosphere clears the scene background;
    // every other room sets its own through RoomManager on entry.
    if (fog) scene.background = null;
  }

  // --- facade material ------------------------------------------------------
  const facadeMat = new THREE.MeshLambertMaterial({ color: 0xcfc8ba });
  injectFacadeShader(facadeMat);

  const rooftopMat = new THREE.MeshLambertMaterial({ color: 0x8e8a82 });

  const rand = mulberry32(seed);

  // --- near ring: hand-authored rooftops (25–70m out) — the parallax stars -
  const near = [];
  const nearProps = [];
  const nearDefs = [
    // x, z(out, negative), top y, footprint w, d  — rooftops mostly below sightline
    { x: 2, z: -26, top: 0.4, w: 14, d: 12 },
    { x: 15, z: -32, top: -0.8, w: 12, d: 14 },
    { x: -8, z: -38, top: 3.6, w: 10, d: 10 },
    { x: 28, z: -42, top: 2.2, w: 12, d: 12 },
    { x: 8, z: -52, top: 6.5, w: 14, d: 12 },
    { x: 34, z: -60, top: 9, w: 14, d: 14 },
    { x: -14, z: -58, top: 12, w: 12, d: 12 },
    { x: 22, z: -70, top: 16, w: 15, d: 13 },
  ];
  // The prop draws are made either way and only kept when wanted, so dropping
  // them doesn't shift the PRNG under the tower rings that follow — the two
  // tiers see the same skyline, one of them just without the clutter on it.
  const keepProp = (g) => { if (wantNearProps) nearProps.push(g); return g; };
  // The angle comes off the index, not the PRNG, so switching `surround` on
  // moves the blocks without shifting the random stream the towers below draw
  // from — the same skyline, put round the compass instead of stacked ahead.
  //
  // Two corrections go with the turn. The blocks are pushed out: these are
  // authored 26–70 m from a window that only ever looks one way, and swung onto
  // a bearing of their own the nearest of them stopped being a rooftop and
  // became a facade filling the glass. And the ring is rotated half a step, so
  // eight blocks at 45° apart sit BETWEEN the compass points rather than on
  // them — a window looks down a gap, not into a wall.
  const NEAR_OUT = 1.8;
  nearDefs.forEach((def, i) => {
    const [bx, bz] = surround
      ? spin(def.x * NEAR_OUT, def.z * NEAR_OUT,
        (i / nearDefs.length) * Math.PI * 2 + Math.PI / nearDefs.length)
      : [def.x, def.z];
    const b = { ...def, x: bx, z: bz };
    const h = b.top + 45; // extend well below the visible horizon
    const g = new THREE.BoxGeometry(b.w, h, b.d);
    g.translate(b.x, b.top - h / 2, b.z);
    near.push(g);
    // rooftop props: parapet, AC boxes, the occasional antenna/water tank
    const pw = 0.35;
    keepProp(strip(b.x, b.top, b.z, b.w, b.d, pw));
    const nAC = 1 + Math.floor(rand() * 3);
    for (let j = 0; j < nAC; j++) {
      const ac = new THREE.BoxGeometry(0.9 + rand() * 1.4, 0.7 + rand() * 0.5, 0.9 + rand());
      ac.translate(b.x + (rand() - 0.5) * (b.w - 3), b.top + 0.35, b.z + (rand() - 0.5) * (b.d - 3));
      keepProp(ac);
    }
    if (rand() > 0.55) {
      const ant = new THREE.CylinderGeometry(0.04, 0.07, 3 + rand() * 4, 6);
      ant.translate(b.x + (rand() - 0.5) * (b.w - 4), b.top + 2, b.z + (rand() - 0.5) * (b.d - 4));
      keepProp(ant);
    }
    if (rand() > 0.7) {
      const tank = new THREE.CylinderGeometry(1.1, 1.1, 1.8, 10);
      tank.translate(b.x + (rand() - 0.5) * (b.w - 4), b.top + 1.4, b.z + (rand() - 0.5) * (b.d - 4));
      keepProp(tank);
    }
  });
  const nearMesh = new THREE.Mesh(mergeGeometries(near), facadeMat);
  group.add(nearMesh);
  if (nearProps.length) group.add(new THREE.Mesh(mergeGeometries(nearProps), rooftopMat));

  // --- mid + far rings: instanced towers -----------------------------------
  group.add(instancedRing(facadeMat, rand, 80, 75, 190, 10, 45, 12, false, surround));
  group.add(instancedRing(facadeMat, rand, 130, 190, 400, 25, 95, 18, false, surround));

  // dark curtain-wall towers catching the sky in their glass
  const glassTowerMat = new THREE.MeshStandardMaterial({
    color: 0x2e3944, metalness: 0.85, roughness: 0.28,
  });
  group.add(instancedRing(glassTowerMat, rand, 26, 90, 360, 40, 120, 15, true, surround));

  // --- ground far below (fills gaps between blocks) ------------------------
  // Surrounded, the street below has to run out under every window, so the
  // plate is square and centred instead of a slab laid out ahead of one.
  const ground = new THREE.Mesh(
    surround ? new THREE.PlaneGeometry(1500, 1500) : new THREE.PlaneGeometry(1200, 700),
    new THREE.MeshLambertMaterial({ color: 0x4d4a45 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(surround ? 0 : 12, -42, surround ? 0 : -300);
  group.add(ground);

  // --- drifting clouds ------------------------------------------------------
  // Surrounded, a cloud parked out along −Z would be edge-on from the windows
  // facing the other way — a flat plane seen from 90° is nothing at all. So each
  // one hangs under a holder turned to its own quarter of the sky: the plane
  // still faces the middle of the room, and `update` still drifts it along its
  // own local x, which is now the tangent rather than world x.
  const cloudTex = cloudTexture();
  const clouds = [];
  const CLOUDS = 4;
  for (let i = 0; i < CLOUDS; i++) {
    const w = 160 + rand() * 200;
    const c = new THREE.Mesh(
      new THREE.PlaneGeometry(w, w * 0.36),
      new THREE.MeshBasicMaterial({
        map: cloudTex, transparent: true, opacity: 0.5 + rand() * 0.25,
        depthWrite: false, fog: false,
      })
    );
    c.position.set(-250 + rand() * 500, 80 + rand() * 90, -320 - rand() * 120);
    c.userData.speed = 0.8 + rand() * 0.7;
    clouds.push(c);
    if (surround) {
      const holder = new THREE.Group();
      holder.rotation.y = (i / CLOUDS) * Math.PI * 2 + rand() * 0.8;
      holder.add(c);
      group.add(holder);
    } else {
      group.add(c);
    }
  }

  // --- birds ----------------------------------------------------------------
  const birdTex = birdTexture();
  const birds = [];
  const BIRDS = 7;
  for (let i = 0; i < BIRDS; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: birdTex, fog: false, depthWrite: false }));
    const scale = 1.6 + rand() * 1.4;
    s.scale.set(scale, scale * 0.45, 1);
    s.userData = {
      cx: -40 + rand() * 110, cy: 12 + rand() * 26, cz: -60 - rand() * 90,
      r: 12 + rand() * 26, speed: 0.12 + rand() * 0.14, phase: rand() * Math.PI * 2,
      dir: rand() > 0.5 ? 1 : -1,
    };
    birds.push(s);
    // Sprites always face the camera, so only the circle they fly needs moving
    // — same holder trick as the clouds, and `update` keeps writing local space.
    if (surround) {
      const holder = new THREE.Group();
      holder.rotation.y = (i / BIRDS) * Math.PI * 2 + rand() * 0.7;
      holder.add(s);
      group.add(holder);
    } else {
      group.add(s);
    }
  }

  scene.add(group);

  // The city only shows through a window; skip the cloud/bird churn whenever it
  // isn't on screen. nearMesh always draws when the city is visible, so its
  // onBeforeRender marks the city as seen this frame.
  let seen = false;
  nearMesh.onBeforeRender = () => { seen = true; };

  function update(t) {
    if (!seen) return;
    seen = false;
    for (const c of clouds) {
      c.position.x += c.userData.speed * 0.016;
      if (c.position.x > 420) c.position.x = -420;
    }
    for (const b of birds) {
      const u = b.userData;
      const a = u.phase + t * u.speed * u.dir;
      b.position.set(u.cx + Math.cos(a) * u.r, u.cy + Math.sin(t * 0.7 + u.phase) * 1.6, u.cz + Math.sin(a) * u.r * 0.6);
    }
  }

  return { group, update, sunDir };
}

// ---------------------------------------------------------------------------
function strip(x, top, z, w, d, t) {
  // parapet ring as 4 thin boxes merged later
  const parts = [
    new THREE.BoxGeometry(w, 0.7, t).translate(x, top + 0.35, z - d / 2 + t / 2),
    new THREE.BoxGeometry(w, 0.7, t).translate(x, top + 0.35, z + d / 2 - t / 2),
    new THREE.BoxGeometry(t, 0.7, d).translate(x - w / 2 + t / 2, top + 0.35, z),
    new THREE.BoxGeometry(t, 0.7, d).translate(x + w / 2 - t / 2, top + 0.35, z),
  ];
  return mergeGeometries(parts);
}

function instancedRing(mat, rand, count, zMin, zMax, hMin, hMax, footprint, glassy = false, surround = false) {
  const geo = new THREE.BoxGeometry(1, 1, 1);
  geo.translate(0, 0.5, 0); // pivot at base
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  for (let i = 0; i < count; i++) {
    const z = -(zMin + rand() * (zMax - zMin));
    const spread = Math.abs(z) * 1.9 + 60;
    let x = 12 + (rand() - 0.5) * spread;
    let zz = z;
    // Surrounded, the wedge becomes an annulus: the block keeps the point it was
    // drawn at and is swung to a random bearing. Its distance is hypot(x, z),
    // which is never less than |z| and so never less than zMin — whatever the
    // lateral spread does, no tower can land nearer than the ring's own floor,
    // and none of them end up inside the room looking out at it.
    if (surround) {
      const a = rand() * Math.PI * 2;
      const ca = Math.cos(a), sa = Math.sin(a);
      [x, zz] = [x * ca + z * sa, -x * sa + z * ca];
    }
    const h = hMin + Math.pow(rand(), 1.6) * (hMax - hMin);
    const w = footprint * (0.5 + rand() * 0.9);
    const d = footprint * (0.5 + rand() * 0.9);
    e.set(0, (rand() - 0.5) * 0.35, 0);
    q.setFromEuler(e);
    m.compose(new THREE.Vector3(x, -40, zz), q, new THREE.Vector3(w, h + 40, d));
    mesh.setMatrixAt(i, m);
    if (glassy) continue;
    // per-building tint: concrete greys, warm limestone, occasional brick
    const tone = 0.5 + rand() * 0.5;
    const pick = rand();
    let col;
    if (pick < 0.15) col = new THREE.Color(tone * 0.9, tone * 0.55, tone * 0.42);      // brick
    else if (pick < 0.45) col = new THREE.Color(tone * 1.05, tone * 0.98, tone * 0.85); // limestone
    else col = new THREE.Color(tone * 0.92, tone * 0.94, tone * 0.97);                  // cool concrete
    mesh.setColorAt(i, col);
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  return mesh;
}

// Window grid + aerial-perspective shading injected into Lambert.
function injectFacadeShader(mat) {
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        varying vec3 vFacadePos;
        varying vec3 vFacadeNormal;`)
      .replace('#include <project_vertex>', `
        {
          vec4 _fp = vec4(transformed, 1.0);
          vec3 _fn = normal;
          #ifdef USE_INSTANCING
            _fp = instanceMatrix * _fp;
            _fn = mat3(instanceMatrix) * _fn;
          #endif
          vFacadePos = (modelMatrix * _fp).xyz;
          vFacadeNormal = normalize(mat3(modelMatrix) * _fn);
        }
        #include <project_vertex>`);

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vFacadePos;
        varying vec3 vFacadeNormal;
        float winHash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          vec3 an = abs(vFacadeNormal);
          if (an.y < 0.6) {
            float u = an.x > an.z ? vFacadePos.z : vFacadePos.x;
            float v = vFacadePos.y;
            float faceSeed = an.x > an.z ? sign(vFacadeNormal.x) * 13.7 : sign(vFacadeNormal.z) * 7.3;
            vec2 cellId = vec2(floor(u / 2.6) + faceSeed, floor(v / 3.1));
            vec2 f = vec2(fract(u / 2.6), fract(v / 3.1));
            float inWin = step(0.16, f.x) * (1.0 - step(0.84, f.x))
                        * step(0.28, f.y) * (1.0 - step(0.82, f.y));
            float h = winHash(cellId);
            // daytime glass: dark blue-grey with per-window variance,
            // a few warm interiors showing through
            vec3 glassCol = mix(vec3(0.10, 0.13, 0.17), vec3(0.35, 0.42, 0.50), h * h);
            vec3 litCol = vec3(0.95, 0.75, 0.42);
            vec3 winCol = mix(glassCol, litCol, step(0.955, h) * 0.85);
            // slight floor-slab band above windows
            float slab = step(0.9, f.y);
            vec3 slabCol = diffuseColor.rgb * 0.82;
            diffuseColor.rgb = mix(mix(diffuseColor.rgb, winCol, inWin), slabCol, slab * 0.6);
          }
        }`);
  };
}

function cloudTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 96;
  const ctx = c.getContext('2d');
  const rand = mulberry32(777);
  ctx.clearRect(0, 0, 256, 96);
  for (let i = 0; i < 26; i++) {
    const x = 30 + rand() * 196, y = 30 + rand() * 40, r = 12 + rand() * 26;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 96);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function birdTexture() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 32;
  const ctx = c.getContext('2d');
  ctx.strokeStyle = 'rgba(30,30,34,0.9)';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(6, 22);
  ctx.quadraticCurveTo(20, 8, 32, 18);
  ctx.quadraticCurveTo(44, 8, 58, 22);
  ctx.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
