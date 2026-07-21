import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

// ---------- config ----------
const COLS = 24;          // equalizer columns
const ROWS = 16;          // segments per column
const SEG_W = 0.30;       // segment width
const SEG_H = 0.16;       // segment height
const SEG_D = 0.10;       // segment depth
const GAP_X = 0.10;       // horizontal gap between columns
const GAP_Y = 0.075;      // vertical gap between segments
const AUDIO_SRC = 'uploads/kenny-barron-type-piano-melody_D_major.mp3';

const panelW = COLS*SEG_W + (COLS-1)*GAP_X;
const panelH = ROWS*SEG_H + (ROWS-1)*GAP_Y;

// ---------- scene ----------
const app = document.getElementById('app');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0a0c);
scene.fog = new THREE.Fog(0x0a0a0c, 18, 46);

const camera = new THREE.PerspectiveCamera(45, innerWidth/innerHeight, 0.1, 200);
camera.position.set(4.5, 3.2, 9.5);

const renderer = new THREE.WebGLRenderer({ antialias:true });
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
app.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 1.6, 0);
controls.minDistance = 5; controls.maxDistance = 24;
controls.maxPolarAngle = Math.PI*0.52;

// lights
scene.add(new THREE.AmbientLight(0x404a5c, 1.2));
const key = new THREE.DirectionalLight(0xffffff, 1.4);
key.position.set(5, 9, 6); scene.add(key);
const rim = new THREE.DirectionalLight(0x3a6bff, 0.6);
rim.position.set(-6, 4, -4); scene.add(rim);

// floor
const floorMat = new THREE.MeshStandardMaterial({ color:0x14161c, roughness:0.85, metalness:0.0 });
const floor = new THREE.Mesh(new THREE.PlaneGeometry(80,80), floorMat);
floor.rotation.x = -Math.PI/2; floor.position.y = 0; scene.add(floor);

// pedestal
const pedH = 3.0, pedW = panelW*0.78, pedD = panelW*0.5;
const pedMat = new THREE.MeshStandardMaterial({ color:0xcfd2d8, roughness:0.6, metalness:0.05 });
const pedestal = new THREE.Mesh(new THREE.BoxGeometry(pedW, pedH, pedD), pedMat);
pedestal.position.y = pedH/2; scene.add(pedestal);
const pedTopY = pedH;

// blue glow spill on pedestal top
const spill = new THREE.PointLight(0x40b8ff, 6, 6, 2);
spill.position.set(0, pedTopY+0.4, 0); scene.add(spill);

// ---------- LED grid ----------
const geo = new THREE.BoxGeometry(SEG_W, SEG_H, SEG_D);
const mat = new THREE.MeshBasicMaterial({ vertexColors:true, toneMapped:false });
const grid = new THREE.InstancedMesh(geo, mat, COLS*ROWS);
grid.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

const dummy = new THREE.Object3D();
const baseY = pedTopY + 0.12;                 // sit just above pedestal top
const startX = -panelW/2 + SEG_W/2;
let n = 0;
const colOf = new Int16Array(COLS*ROWS);
const rowOf = new Int16Array(COLS*ROWS);
for (let c=0;c<COLS;c++){
  const x = startX + c*(SEG_W+GAP_X);
  for (let r=0;r<ROWS;r++){
    const y = baseY + SEG_H/2 + r*(SEG_H+GAP_Y);
    dummy.position.set(x, y, 0);
    dummy.updateMatrix();
    grid.setMatrixAt(n, dummy.matrix);
    colOf[n]=c; rowOf[n]=r; n++;
  }
}
grid.instanceMatrix.needsUpdate = true;
scene.add(grid);

// per-row base color: blue (bottom) -> cyan (mid) -> magenta/pink (top)
function rowColor(r){
  const t = r/(ROWS-1);
  const col = new THREE.Color();
  if (t < 0.62){                    // blue -> cyan
    col.setHSL(0.60 - (t/0.62)*0.12, 1.0, 0.5);
  } else {                          // cyan -> magenta/pink
    const u = (t-0.62)/0.38;
    col.setHSL(0.50 + u*0.35, 1.0, 0.55);
  }
  return col;
}
const rowBase = Array.from({length:ROWS}, (_,r)=>rowColor(r));

const color = new THREE.Color();
const DIM = 0.05;
function paint(levels, peaks){
  for (let i=0;i<COLS*ROWS;i++){
    const c = colOf[i], r = rowOf[i];
    const lit = levels[c]*(ROWS);
    const peak = peaks[c]*(ROWS-1);
    let b;
    if (r < lit){
      const tip = lit - r;
      b = tip < 1.3 ? 1.9 : 1.0;              // bright tip
    } else if (Math.abs(r-peak) < 0.7){
      b = 1.7;                                 // falling peak marker
    } else {
      b = DIM;                                 // resting
    }
    color.copy(rowBase[r]).multiplyScalar(b);
    grid.setColorAt(i, color);
  }
  grid.instanceColor.needsUpdate = true;
}
paint(new Float32Array(COLS), new Float32Array(COLS));

// ---------- audio ----------
const audio = document.getElementById('audio');
let actx, analyser, freq, srcNode;
function initAudio(){
  if (actx) return;
  actx = new (window.AudioContext||window.webkitAudioContext)();
  srcNode = actx.createMediaElementSource(audio);
  analyser = actx.createAnalyser();
  analyser.fftSize = 128;
  analyser.smoothingTimeConstant = 0.75;
  freq = new Uint8Array(analyser.frequencyBinCount);
  srcNode.connect(analyser); analyser.connect(actx.destination);
}

const levels = new Float32Array(COLS);
const peaks  = new Float32Array(COLS);
function updateLevels(t){
  let spec = null;
  if (analyser){ analyser.getByteFrequencyData(freq); spec = freq; }
  for (let c=0;c<COLS;c++){
    let target;
    if (spec){
      const f = Math.pow(c/(COLS-1), 1.5);
      const idx = Math.min(spec.length-1, Math.floor(1 + f*(spec.length*0.8)));
      target = Math.pow(spec[idx]/255, 0.8)*1.2;
    } else {
      target = 0.22 + 0.18*Math.sin(c*0.5 + t*2.0) + 0.08*Math.sin(c*1.3 - t*3.1);
    }
    target = Math.max(0, Math.min(1, target));
    if (target > levels[c]) levels[c] = target;          // snap up
    else levels[c] += (target - levels[c]) * 0.14;       // ease down
    if (levels[c] >= peaks[c]) peaks[c] = levels[c];
    else peaks[c] = Math.max(levels[c], peaks[c] - 0.012);
  }
}

// ---------- postprocessing (bloom) ----------
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.9, 0.6, 0.2);
composer.addPass(bloom);

// ---------- loop ----------
const clock = new THREE.Clock();
function animate(){
  requestAnimationFrame(animate);
  const t = clock.getElapsedTime();
  updateLevels(t);
  paint(levels, peaks);
  let energy = 0; for (let c=0;c<COLS;c++) energy += levels[c];
  spill.intensity = 3 + (energy/COLS)*10;
  controls.update();
  composer.render();
}
animate();

// ---------- UI ----------
const gate = document.getElementById('gate');
const playBtn = document.getElementById('play');
const tname = document.getElementById('tname');
const fileInput = document.getElementById('file');

function play(){ initAudio(); if (actx.state==='suspended') actx.resume(); audio.play().catch(()=>{}); }
function setPlayLabel(){ playBtn.textContent = audio.paused ? '▶ Play' : '❚❚ Pause'; }
audio.addEventListener('play', setPlayLabel);
audio.addEventListener('pause', setPlayLabel);
audio.addEventListener('ended', setPlayLabel);

gate.addEventListener('click', ()=>{ gate.style.display='none'; play(); });
playBtn.addEventListener('click', ()=>{ if (audio.paused) play(); else audio.pause(); });
document.getElementById('load').addEventListener('click', ()=> fileInput.click());
fileInput.addEventListener('change', e=>{
  const f = e.target.files[0]; if(!f) return;
  audio.src = URL.createObjectURL(f);
  tname.textContent = f.name.replace(/\.[^.]+$/,'');
  play();
});

addEventListener('resize', ()=>{
  camera.aspect = innerWidth/innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
});
