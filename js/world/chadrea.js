/* CHADREA — walkable brutalist gallery house.
   Drop-in ES module. Needs an import map (or bundler) resolving "three":

     <script type="importmap">
     { "imports": { "three": "./vendor/three/three.module.min.js" } }
     <\/script>
     <script type="module" src="./chadrea.js"><\/script>

   It builds its own canvas, overlay and styles into document.body,
   or call mountChadrea(el) to mount somewhere else. */

import * as THREE from 'three';

const HOST = document.createElement('div');
HOST.id = 'chadrea';
HOST.innerHTML = `
<style>
  #chadrea{position:fixed;inset:0;background:#0a0908;color:#d6cec1;
    font:11px/1.6 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.09em}
  #chadrea canvas{display:block;width:100%;height:100%}
  #chadrea .hud{position:absolute;left:16px;bottom:14px;opacity:.55;text-transform:uppercase;pointer-events:none}
  #chadrea .gate{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;
    gap:18px;background:#0a0908;cursor:pointer;z-index:5;transition:opacity .7s}
  #chadrea .gate h1{margin:0;font:300 13px/1 ui-monospace,Menlo,monospace;letter-spacing:.55em;color:#e8e0d2}
  #chadrea .gate p{margin:0;opacity:.45;text-transform:uppercase}
  #chadrea .gate .r{width:120px;height:1px;background:#3a352e}
  #chadrea .gate.off{opacity:0;pointer-events:none}
</style>
<canvas class="scene"></canvas>
<div class="hud">W A S D walk · shift run · mouse look · esc release</div>
<div class="gate"><h1>CHADREA</h1><div class="r"></div><p>click to enter</p></div>`;
export function mountChadrea(parent = document.body) { parent.appendChild(HOST); return HOST; }
mountChadrea();
const $ = s => HOST.querySelector(s);
/* ─────────────────────────── plan (metres) ───────────────────────────
   main hall   x −8 … 4     z −11 … 11    h 8.6
   west wall   x −8         art, console, recessed LED cove at 6.9
   north wall  z −11        cantilevered stair, rises +x → −x
   mezzanine   x −8…−3.2    z −11…2       top 4.2, black steel balustrade
   pier wall   x 4          rounded plaster arch at z 2.4…8
   wing        x 4.9…13     z 0…11        h 5.2, white plaster, daylight
   skylight    ceiling slot x −1.4…−0.6   z −11…−5.4
   ────────────────────────────────────────────────────────────────── */
const HALL = { x0:-8, x1:4, z0:-11, z1:11, h:8.6 };
const MEZZ = { x0:-8, x1:-3.2, z0:-11, z1:-1, top:4.2, t:0.42 };
const STAIR = { xb:3.5, xt:MEZZ.x1, z0:-10.9, z1:-9.3, top:MEZZ.top };
const WING = { x0:4.9, x1:13, z0:0, z1:11, h:5.2 };
const PIER = { x:4, t:0.9, az0:2.4, az1:8 };

const renderer = new THREE.WebGLRenderer({ canvas: $('.scene'), antialias:true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.85));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.02;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x1a1714, 0.017);
const camera = new THREE.PerspectiveCamera(70, innerWidth/innerHeight, 0.06, 220);
camera.position.set(0.6, 1.62, 7.4);

/* ───────────────────────────── texture kit ───────────────────────────── */
const cv = (w,h=w) => { const c=document.createElement('canvas'); c.width=w; c.height=h; return c; };
const rnd = (a,b)=>a+Math.random()*(b-a);
function blotch(ctx,w,h,n,rMin,rMax,cols,aMax){
  for(let i=0;i<n;i++){
    const x=Math.random()*w, y=Math.random()*h, r=rnd(rMin,rMax);
    const g=ctx.createRadialGradient(x,y,0,x,y,r);
    const c=cols[(Math.random()*cols.length)|0];
    g.addColorStop(0,`rgba(${c},${rnd(aMax*0.3,aMax).toFixed(3)})`);
    g.addColorStop(1,`rgba(${c},0)`);
    ctx.fillStyle=g; ctx.beginPath(); ctx.arc(x,y,r,0,7); ctx.fill();
  }
}
function grain(ctx,w,h,amt){
  const d=ctx.getImageData(0,0,w,h), p=d.data;
  for(let i=0;i<p.length;i+=4){ const n=(Math.random()-0.5)*amt; p[i]+=n; p[i+1]+=n; p[i+2]+=n; }
  ctx.putImageData(d,0,0);
}
/* one GPU upload per canvas — every user gets a clone that shares the source */
const _texCache=new Map();
const tex = (c,repX=1,repY=1,srgb=false)=>{
  const key=(c.__id ??= Math.random())+(srgb?'s':'l');
  let base=_texCache.get(key);
  if(!base){
    base=new THREE.CanvasTexture(c);
    base.wrapS=base.wrapT=THREE.RepeatWrapping; base.anisotropy=4;
    if(srgb) base.colorSpace=THREE.SRGBColorSpace;
    _texCache.set(key,base);
  }
  const t=base.clone(); t.repeat.set(repX,repY); t.needsUpdate=false;
  return t;
};

/* board-formed concrete — one 4 m × 4 m tile: 6 boards of 667 mm, tie holes on a 1.33 m grid */
function concreteTile(px=1024){
  const col=cv(px), rgh=cv(px), bmp=cv(px);
  const a=col.getContext('2d'), r=rgh.getContext('2d'), b=bmp.getContext('2d');
  a.fillStyle='#8e8880'; a.fillRect(0,0,px,px);
  r.fillStyle='#b4b4b4'; r.fillRect(0,0,px,px);
  b.fillStyle='#808080'; b.fillRect(0,0,px,px);
  blotch(a,px,px,150,px*0.05,px*0.30,['120,116,108','160,156,148','98,94,88'],0.16);
  blotch(a,px,px,60,px*0.02,px*0.09,['76,72,66','172,168,160'],0.13);
  blotch(r,px,px,110,px*0.04,px*0.26,['210,210,210','140,140,140'],0.30);
  blotch(b,px,px,90,px*0.03,px*0.22,['150,150,150','105,105,105'],0.35);
  const boards=6, bh=px/boards;
  for(let i=0;i<=boards;i++){
    const y=Math.round(i*bh);
    a.fillStyle='rgba(58,54,49,0.55)'; a.fillRect(0,y-1,px,3);
    a.fillStyle='rgba(196,192,184,0.20)'; a.fillRect(0,y+2,px,2);
    b.fillStyle='rgba(40,40,40,0.85)'; b.fillRect(0,y-1,px,3);
    b.fillStyle='rgba(205,205,205,0.5)'; b.fillRect(0,y+2,px,2);
    r.fillStyle='rgba(235,235,235,0.35)'; r.fillRect(0,y-1,px,4);
    // faint vertical panel joints, offset per board
    const jx=Math.round(((i*0.37)%1)*px);
    a.fillStyle='rgba(70,66,60,0.16)'; a.fillRect(jx,y,2,bh);
  }
  const grid=px/3;
  for(let gx=0;gx<3;gx++) for(let gy=0;gy<3;gy++){
    const x=(gx+0.5)*grid+rnd(-6,6), y=(gy+0.5)*grid+rnd(-6,6), rad=px*0.0075;
    const g=a.createRadialGradient(x,y,0,x,y,rad*2.6);
    g.addColorStop(0,'rgba(48,44,40,0.85)'); g.addColorStop(0.42,'rgba(70,66,60,0.5)'); g.addColorStop(1,'rgba(120,116,108,0)');
    a.fillStyle=g; a.beginPath(); a.arc(x,y,rad*2.6,0,7); a.fill();
    b.fillStyle='rgba(26,26,26,0.9)'; b.beginPath(); b.arc(x,y,rad,0,7); b.fill();
    r.fillStyle='rgba(245,245,245,0.5)'; r.beginPath(); r.arc(x,y,rad*1.6,0,7); r.fill();
  }
  grain(a,px,px,16); grain(b,px,px,22);
  return { col, rgh, bmp };
}
const CT = concreteTile(768);
function concrete(w,h,{tint=0xffffff,rough=0.94,bump=0.055}={}){
  const m=new THREE.MeshStandardMaterial({
    color:tint, roughness:rough, metalness:0,
    map:tex(CT.col,w/4,h/4,true), roughnessMap:tex(CT.rgh,w/4,h/4),
    bumpMap:tex(CT.bmp,w/4,h/4), bumpScale:bump
  });
  const o=Math.random()*4, o2=Math.random()*4;
  for(const k of ['map','roughnessMap','bumpMap']) m[k].offset.set(o/4,o2/4);
  return m;
}
/* polished poured floor: same family, far smoother, envMap does the work */
function floorMat(w,h){
  return new THREE.MeshPhysicalMaterial({
    color:0x9a938a, roughness:0.24, metalness:0,
    map:tex(CT.col,w/9,h/9,true), roughnessMap:tex(CT.rgh,w/9,h/9),
    bumpMap:tex(CT.bmp,w/9,h/9), bumpScale:0.012,
    clearcoat:0.55, clearcoatRoughness:0.32, envMapIntensity:0.85
  });
}
let _plasterCv;
function plasterMat(tint=0xece6dc,rough=0.95){
  if(!_plasterCv){ const c=cv(512), x=c.getContext('2d');
    x.fillStyle='#fff'; x.fillRect(0,0,512,512);
    blotch(x,512,512,90,20,150,['225,220,212','248,246,242'],0.35); grain(x,512,512,7); _plasterCv=c; }
  const c=_plasterCv;
  return new THREE.MeshStandardMaterial({color:tint,roughness:rough,metalness:0,map:tex(c,3,3,true),bumpMap:tex(c,3,3),bumpScale:0.012});
}
let _travCv;
function travertineMat(){
  if(!_travCv){ const c=cv(768), x=c.getContext('2d');
  x.fillStyle='#c3ae90'; x.fillRect(0,0,768,768);
  for(let i=0;i<70;i++){ x.strokeStyle=`rgba(${Math.random()<0.5?'150,132,106':'214,200,176'},${rnd(0.1,0.4)})`;
    x.lineWidth=rnd(1,7); x.beginPath(); const y=Math.random()*768; x.moveTo(0,y);
    for(let s=0;s<768;s+=48) x.lineTo(s,y+rnd(-9,9)); x.stroke(); }
  for(let i=0;i<340;i++){ x.fillStyle=`rgba(112,96,74,${rnd(0.15,0.5)})`; x.beginPath();
    x.ellipse(Math.random()*768,Math.random()*768,rnd(1.5,7),rnd(1,3.5),Math.random()*3,0,7); x.fill(); }
  grain(x,768,768,12); _travCv=c; }
  const c=_travCv;
  return new THREE.MeshPhysicalMaterial({color:0xffffff,roughness:0.52,metalness:0,map:tex(c,1,1,true),bumpMap:tex(c,1,1),bumpScale:0.02,clearcoat:0.25,envMapIntensity:0.7});
}
const _woodCv={};
function woodMat(dark=false){
  if(!_woodCv[dark?1:0]){ const c=cv(1024,256), x=c.getContext('2d');
  x.fillStyle=dark?'#3b2419':'#5a3a26'; x.fillRect(0,0,1024,256);
  for(let i=0;i<130;i++){ x.strokeStyle=`rgba(${dark?'26,15,10':'40,24,15'},${rnd(0.1,0.5)})`; x.lineWidth=rnd(0.6,3.4);
    x.beginPath(); const y=Math.random()*256; x.moveTo(0,y);
    for(let s=0;s<1024;s+=32) x.lineTo(s,y+Math.sin(s*0.02+y)*rnd(0.5,4)); x.stroke(); }
  blotch(x,1024,256,40,20,90,['110,74,46','30,18,12'],0.22); grain(x,1024,256,9); _woodCv[dark?1:0]=c; }
  const c=_woodCv[dark?1:0];
  return new THREE.MeshPhysicalMaterial({color:0xffffff,roughness:0.46,metalness:0,map:tex(c,1,1,true),bumpMap:tex(c,1,1),bumpScale:0.008,clearcoat:0.35,clearcoatRoughness:0.5});
}
function linenMat(){
  const c=cv(512), x=c.getContext('2d');
  x.fillStyle='#ded7c9'; x.fillRect(0,0,512,512);
  for(let i=0;i<512;i+=2){ x.fillStyle=`rgba(255,255,255,${rnd(0.02,0.09)})`; x.fillRect(i,0,1,512); x.fillRect(0,i,512,1); }
  blotch(x,512,512,50,30,140,['198,190,176','246,242,234'],0.25); grain(x,512,512,10);
  return new THREE.MeshStandardMaterial({color:0xf0ece2,roughness:0.9,metalness:0,map:tex(c,4,4,true),bumpMap:tex(c,4,4),bumpScale:0.006});
}
const steelMat = new THREE.MeshPhysicalMaterial({color:0x171615,roughness:0.44,metalness:0.85,envMapIntensity:0.7});
const blackenedMat = (()=>{
  const c=cv(512), x=c.getContext('2d');
  x.fillStyle='#2a2724'; x.fillRect(0,0,512,512);
  blotch(x,512,512,120,10,110,['74,64,54','18,17,16','96,80,60'],0.4); grain(x,512,512,14);
  return new THREE.MeshPhysicalMaterial({color:0xffffff,roughness:0.55,metalness:0.72,map:tex(c,2,2,true),bumpMap:tex(c,2,2),bumpScale:0.01,envMapIntensity:0.8});
})();
const ceramicMat = (t=0x6d5442)=>new THREE.MeshPhysicalMaterial({color:t,roughness:0.62,metalness:0.05,clearcoat:0.3,envMapIntensity:0.6});

/* ─────────────────────────── environment (PMREM) ─────────────────────── */
{
  const c=cv(64,256), x=c.getContext('2d');
  const g=x.createLinearGradient(0,0,0,256);
  g.addColorStop(0,'#cfd8de'); g.addColorStop(0.42,'#e9e2d6'); g.addColorStop(0.52,'#6f6659'); g.addColorStop(1,'#221e1a');
  x.fillStyle=g; x.fillRect(0,0,64,256);
  const sun=x.createRadialGradient(18,44,0,18,44,40);
  sun.addColorStop(0,'rgba(255,246,226,1)'); sun.addColorStop(1,'rgba(255,246,226,0)');
  x.fillStyle=sun; x.fillRect(0,0,64,110);
  const t=new THREE.CanvasTexture(c); t.mapping=THREE.EquirectangularReflectionMapping; t.colorSpace=THREE.SRGBColorSpace;
  const pm=new THREE.PMREMGenerator(renderer);
  scene.environment=pm.fromEquirectangular(t).texture;
  if(THREE.REVISION>=163) scene.environmentIntensity=0.5;
  pm.dispose(); t.dispose();
}

/* ─────────────────────────── build helpers ───────────────────────────── */
const world = new THREE.Group(); scene.add(world);
const COLLIDERS = [];   // {x0,x1,z0,z1,y0,y1}
const PLATFORMS = [];   // {x0,x1,z0,z1,top}
function box(w,h,d,mat,x,y,z,{shadow=true,recv=true,collide=null,rotY=0}={}){
  const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
  m.position.set(x,y,z); m.rotation.y=rotY; m.castShadow=shadow; m.receiveShadow=recv;
  world.add(m);
  if(collide!==false) COLLIDERS.push({x0:x-w/2,x1:x+w/2,z0:z-d/2,z1:z+d/2,y0:y-h/2,y1:y+h/2});
  return m;
}
const slab=(w,d,mat,x,y,z,t=0.4)=>{ const m=box(w,t,d,mat,x,y,z,{collide:false}); return m; };

/* ── floors ───────────────────────────────────────────────────────────── */
const hallFloor = new THREE.Mesh(new THREE.PlaneGeometry(HALL.x1-HALL.x0+1.8, HALL.z1-HALL.z0+0.4), floorMat(HALL.x1-HALL.x0,HALL.z1-HALL.z0));
hallFloor.rotation.x=-Math.PI/2; hallFloor.position.set((HALL.x0+HALL.x1)/2+0.9,0,(HALL.z0+HALL.z1)/2); hallFloor.receiveShadow=true; world.add(hallFloor);
PLATFORMS.push({x0:HALL.x0,x1:PIER.x+PIER.t,z0:HALL.z0,z1:HALL.z1,top:0});

const wingFloor = new THREE.Mesh(new THREE.PlaneGeometry(WING.x1-WING.x0+1, WING.z1-WING.z0), floorMat(WING.x1-WING.x0,WING.z1-WING.z0));
wingFloor.rotation.x=-Math.PI/2; wingFloor.position.set((WING.x0+WING.x1)/2-0.5,0.001,(WING.z0+WING.z1)/2); wingFloor.receiveShadow=true; world.add(wingFloor);
PLATFORMS.push({x0:PIER.x,x1:WING.x1,z0:WING.z0,z1:WING.z1,top:0});

/* ── hall walls ───────────────────────────────────────────────────────── */
const wallW = concrete(HALL.z1-HALL.z0, HALL.h, {bump:0.07});
const wallN = concrete(HALL.x1-HALL.x0, HALL.h, {bump:0.07});
function wallPanel(mat,w,h,x,y,z,rotY,flip=false){
  const g=new THREE.PlaneGeometry(w,h);
  const m=new THREE.Mesh(g,mat); m.position.set(x,y,z); m.rotation.y=rotY;
  m.receiveShadow=true; m.castShadow=false; world.add(m); return m;
}
// west (long art wall) — split into lower field and an upper band above the cove
wallPanel(wallW,HALL.z1-HALL.z0,6.6,HALL.x0,3.3,(HALL.z0+HALL.z1)/2,Math.PI/2);
wallPanel(concrete(22,2,{tint:0xbfb8ae}),HALL.z1-HALL.z0,1.55,HALL.x0,7.82,(HALL.z0+HALL.z1)/2,Math.PI/2);
COLLIDERS.push({x0:HALL.x0-0.6,x1:HALL.x0+0.06,z0:HALL.z0-1,z1:HALL.z1+1,y0:-1,y1:HALL.h});
// north (stair wall)
wallPanel(wallN,HALL.x1-HALL.x0+1,HALL.h,(HALL.x0+HALL.x1)/2,HALL.h/2,HALL.z0,0);
COLLIDERS.push({x0:HALL.x0-1,x1:PIER.x+1,z0:HALL.z0-0.6,z1:HALL.z0+0.06,y0:-1,y1:HALL.h});
// south (behind the camera at spawn)
wallPanel(concrete(14,9,{tint:0xa9a29a}),HALL.x1-HALL.x0+1,HALL.h,(HALL.x0+HALL.x1)/2,HALL.h/2,HALL.z1,Math.PI);
COLLIDERS.push({x0:HALL.x0-1,x1:WING.x1,z0:HALL.z1-0.06,z1:HALL.z1+0.6,y0:-1,y1:HALL.h});
// dark walnut doorway reveals in the west wall (as in the reference)
for(const dz of [-1.9, 6.6]){
  box(0.34,2.62,1.06,woodMat(true),HALL.x0+0.17,1.31,dz,{collide:false});
  box(0.12,2.9,1.42,concrete(1.5,3,{tint:0x8f8880}),HALL.x0+0.30,1.45,dz,{collide:false});
}

/* ── pier wall with rounded plaster archway ───────────────────────────── */
{
  const plaster = plasterMat(0xd8d0c4,0.93);
  const H=HALL.h, z0=HALL.z0, z1=HALL.z1, aw=PIER.az1-PIER.az0, ah=5.6, r=aw/2;
  const s=new THREE.Shape();
  s.moveTo(z0,0); s.lineTo(z1,0); s.lineTo(z1,H); s.lineTo(z0,H); s.lineTo(z0,0);
  const hole=new THREE.Path();
  hole.moveTo(PIER.az0,0); hole.lineTo(PIER.az0,ah-r);
  hole.absarc(PIER.az0+r,ah-r,r,Math.PI,0,true);
  hole.lineTo(PIER.az1,0); hole.lineTo(PIER.az0,0);
  s.holes.push(hole);
  const g=new THREE.ExtrudeGeometry(s,{depth:PIER.t,bevelEnabled:false,curveSegments:48});
  g.computeVertexNormals();
  const m=new THREE.Mesh(g,[concrete(20,9,{tint:0xa39c93}),plaster]);
  // rotate the z-x shape plane into the wall plane
  m.rotation.y=-Math.PI/2; m.position.set(PIER.x,0,0);
  m.castShadow=true; m.receiveShadow=true; world.add(m);
  // rounded soffit lining inside the arch (gives the reveal real thickness)
  const lin=new THREE.Mesh(new THREE.CylinderGeometry(r,r,PIER.t,48,1,true,0,Math.PI),plaster);
  lin.rotation.z=Math.PI/2; lin.rotation.y=Math.PI/2;
  lin.position.set(PIER.x+PIER.t/2,ah-r,PIER.az0+r); lin.receiveShadow=true; world.add(lin);
  for(const zz of [PIER.az0,PIER.az1]) box(PIER.t,ah-r,0.02,plaster,PIER.x+PIER.t/2,(ah-r)/2,zz,{collide:false});
  // pier blocks either side of the opening
  COLLIDERS.push({x0:PIER.x,x1:PIER.x+PIER.t,z0:HALL.z0,z1:PIER.az0,y0:-1,y1:H});
  COLLIDERS.push({x0:PIER.x,x1:PIER.x+PIER.t,z0:PIER.az1,z1:HALL.z1,y0:-1,y1:H});
}

/* ── adjoining wing: white plaster, diffuse daylight ─────────────────── */
{
  const pl=plasterMat(0xf1ece2,0.94);
  wallPanel(pl,WING.z1-WING.z0,WING.h,WING.x1,WING.h/2,(WING.z0+WING.z1)/2,-Math.PI/2);
  COLLIDERS.push({x0:WING.x1-0.05,x1:WING.x1+0.6,z0:WING.z0-1,z1:WING.z1+1,y0:-1,y1:WING.h});
  wallPanel(pl,WING.x1-WING.x0+1,WING.h,(WING.x0+WING.x1)/2,WING.h/2,WING.z0,0);
  COLLIDERS.push({x0:PIER.x,x1:WING.x1,z0:WING.z0-0.6,z1:WING.z0+0.05,y0:-1,y1:WING.h});
  wallPanel(pl,WING.x1-WING.x0+1,WING.h,(WING.x0+WING.x1)/2,WING.h/2,WING.z1,Math.PI);
  const cl=new THREE.Mesh(new THREE.PlaneGeometry(WING.x1-WING.x0+1,WING.z1-WING.z0),pl);
  cl.rotation.x=Math.PI/2; cl.position.set((WING.x0+WING.x1)/2-0.5,WING.h,(WING.z0+WING.z1)/2); world.add(cl);
  // slim vertical light panel + walnut bench, as in the reference wing
  box(0.05,2.0,0.5,new THREE.MeshStandardMaterial({color:0xf7f4ee,roughness:0.6}),WING.x1-0.05,2.5,3.1,{collide:false});
  const bench=box(0.5,0.08,2.6,woodMat(),WING.x1-0.42,0.44,9.1);  for(const bz of [8.1,10.1]) box(0.06,0.44,0.06,steelMat,WING.x1-0.42,0.22,bz,{collide:false});
}

/* ── ceiling: waffle-free flat soffit + downstand beams + skylight slot ─ */
const SKY = { x0:-1.4, x1:-0.6, z0:HALL.z0, z1:-5.4 };
{
  const cm=concrete(14,22,{tint:0x8b847c,bump:0.05});
  const y=HALL.h;
  const parts=[
    [HALL.x0,SKY.x0,HALL.z0,HALL.z1],
    [SKY.x1,PIER.x+PIER.t,HALL.z0,HALL.z1],
    [SKY.x0,SKY.x1,SKY.z1,HALL.z1]
  ];
  for(const [x0,x1,z0,z1] of parts){
    const p=new THREE.Mesh(new THREE.BoxGeometry(x1-x0,0.5,z1-z0),cm);
    p.position.set((x0+x1)/2,y+0.25,(z0+z1)/2); p.castShadow=true; p.receiveShadow=true; world.add(p);
  }
  // skylight reveal: deep concrete jambs, then a bright glazing plane
  const jamb=concrete(6,1.2,{tint:0x9d968d});
  box(0.06,1.1,SKY.z1-SKY.z0,jamb,SKY.x0,y+0.6,(SKY.z0+SKY.z1)/2,{collide:false});
  box(0.06,1.1,SKY.z1-SKY.z0,jamb,SKY.x1,y+0.6,(SKY.z0+SKY.z1)/2,{collide:false});
  const glaze=new THREE.Mesh(new THREE.PlaneGeometry(SKY.x1-SKY.x0,SKY.z1-SKY.z0),
    new THREE.MeshBasicMaterial({color:0xfff6e4,toneMapped:false}));
  glaze.rotation.x=Math.PI/2; glaze.position.set((SKY.x0+SKY.x1)/2,y+1.05,(SKY.z0+SKY.z1)/2); world.add(glaze);

  // instanced downstand beams across the hall soffit
  const bg=new THREE.BoxGeometry(HALL.x1-HALL.x0+0.9,0.46,0.34);
  const beams=new THREE.InstancedMesh(bg,cm,14);
  beams.castShadow=true; beams.receiveShadow=true;
  const M=new THREE.Matrix4(); let n=0;
  for(let i=0;i<14;i++){
    const z=HALL.z0+1.4+i*1.52;
    if(z>SKY.z0-0.4 && z<SKY.z1+0.4) continue;
    M.makeTranslation((HALL.x0+PIER.x)/2+0.45,y-0.23,z); beams.setMatrixAt(n++,M);
  }
  beams.count=n; world.add(beams);
}

/* ── recessed linear LED cove down the west wall ──────────────────────── */
{
  const zc=(HALL.z0+HALL.z1)/2, L=HALL.z1-HALL.z0-1.2, yc=6.95;
  // the returned concrete lip that hides the fitting
  box(0.62,0.30,L,concrete(22,1,{tint:0x9b948b}),HALL.x0+0.31,yc+0.34,zc,{collide:false});
  box(0.62,0.16,L,concrete(22,1,{tint:0x7e786f}),HALL.x0+0.31,yc-0.30,zc,{collide:false});
  const strip=new THREE.Mesh(new THREE.BoxGeometry(0.05,0.06,L),
    new THREE.MeshBasicMaterial({color:0xffd9a0,toneMapped:false}));
  strip.position.set(HALL.x0+0.56,yc+0.12,zc); world.add(strip);
  // a soft glow card so the lip reads as lit, plus discrete point lights
  const glow=new THREE.Mesh(new THREE.PlaneGeometry(0.55,L),
    new THREE.MeshBasicMaterial({color:0xffc784,transparent:true,opacity:0.30,blending:THREE.AdditiveBlending,depthWrite:false}));
  glow.rotation.x=Math.PI/2; glow.position.set(HALL.x0+0.34,yc+0.18,zc); world.add(glow);
  for(let i=0;i<7;i++){
    const p=new THREE.PointLight(0xffbe79,10,9,2.1);
    p.position.set(HALL.x0+0.7,yc+0.05,HALL.z0+1.6+i*(L/6.2)); world.add(p);
  }
  // matching cove above the arch pier, seen at the top right of the reference
  box(0.5,0.26,7,concrete(8,1,{tint:0x968f86}),PIER.x-0.25,7.3,-3.6,{collide:false});
  const s2=new THREE.Mesh(new THREE.BoxGeometry(0.05,0.05,6.6),new THREE.MeshBasicMaterial({color:0xffd9a0,toneMapped:false}));
  s2.position.set(PIER.x-0.48,7.2,-3.6); world.add(s2);
  for(let i=0;i<3;i++){ const p=new THREE.PointLight(0xffb872,6,8,2.2); p.position.set(PIER.x-0.7,7.1,-6.3+i*2.7); world.add(p); }
}

/* ── mezzanine ────────────────────────────────────────────────────────── */
{
  const mm=concrete(12,6,{tint:0x8f8880});
  const w=MEZZ.x1-MEZZ.x0, d=MEZZ.z1-MEZZ.z0, cx=(MEZZ.x0+MEZZ.x1)/2, cz=(MEZZ.z0+MEZZ.z1)/2;
  const s=box(w,MEZZ.t,d,mm,cx,MEZZ.top-MEZZ.t/2,cz,{collide:false});
  PLATFORMS.push({x0:MEZZ.x0,x1:MEZZ.x1,z0:MEZZ.z0,z1:MEZZ.z1,top:MEZZ.top});
  // upstand edge beam (the deep fascia in the reference)
  box(0.32,0.86,d,mm,MEZZ.x1-0.16,MEZZ.top-0.62,cz,{collide:false});
  box(w,0.86,0.32,mm,cx,MEZZ.top-0.62,MEZZ.z1-0.16,{collide:false});
  // slim black steel balustrade — instanced balusters
  const bal=new THREE.InstancedMesh(new THREE.BoxGeometry(0.022,1.03,0.022),steelMat,220);
  bal.castShadow=true; const M=new THREE.Matrix4(); let n=0;
  for(let z=MEZZ.z0+0.2; z<=MEZZ.z1-0.05; z+=0.115){ M.makeTranslation(MEZZ.x1-0.06,MEZZ.top+0.52,z); bal.setMatrixAt(n++,M); }
  for(let x=MEZZ.x0+0.2; x<=MEZZ.x1-0.12; x+=0.115){ M.makeTranslation(x,MEZZ.top+0.52,MEZZ.z1-0.06); bal.setMatrixAt(n++,M); }
  bal.count=n; world.add(bal);
  box(0.05,0.035,d-0.2,steelMat,MEZZ.x1-0.06,MEZZ.top+1.05,cz,{collide:false});
  box(w-0.2,0.035,0.05,steelMat,cx,MEZZ.top+1.05,MEZZ.z1-0.06,{collide:false});
  // rails as barriers
  COLLIDERS.push({x0:MEZZ.x1-0.14,x1:MEZZ.x1+0.02,z0:MEZZ.z0,z1:MEZZ.z1,y0:MEZZ.top,y1:MEZZ.top+1.1});
  COLLIDERS.push({x0:MEZZ.x0,x1:MEZZ.x1,z0:MEZZ.z1-0.14,z1:MEZZ.z1+0.02,y0:MEZZ.top,y1:MEZZ.top+1.1});
}

/* ── cantilevered stair ───────────────────────────────────────────────── */
const stairLen = STAIR.xb - STAIR.xt;
{
  const risers=22, rise=STAIR.top/risers, run=stairLen/risers;
  const sm=concrete(8,3,{tint:0x968f86,bump:0.04});
  const tg=new THREE.BoxGeometry(run+0.04,rise*0.42,STAIR.z1-STAIR.z0);
  const treads=new THREE.InstancedMesh(tg,sm,risers);
  treads.castShadow=true; treads.receiveShadow=true;
  const M=new THREE.Matrix4();
  for(let i=0;i<risers;i++) { M.makeTranslation(STAIR.xb-(i+0.5)*run, (i+1)*rise-rise*0.21, (STAIR.z0+STAIR.z1)/2); treads.setMatrixAt(i,M); }
  world.add(treads);
  // raking soffit beam under the flight
  const soff=new THREE.Mesh(new THREE.BoxGeometry(Math.hypot(stairLen,STAIR.top)+0.4,0.34,STAIR.z1-STAIR.z0-0.06),sm);
  soff.position.set((STAIR.xb+STAIR.xt)/2,STAIR.top/2-0.30,(STAIR.z0+STAIR.z1)/2);
  soff.rotation.z=-Math.atan2(STAIR.top,stairLen)*-1; soff.rotation.z=Math.atan2(STAIR.top,stairLen);
  soff.castShadow=true; soff.receiveShadow=true; world.add(soff);
  // three broad bottom steps spilling into the room
  for(let i=0;i<3;i++) box(1.5,0.17,STAIR.z1-STAIR.z0+0.5+i*0.5,sm,STAIR.xb+0.75,0.085+i*0.001,(STAIR.z0+STAIR.z1)/2+0.4+i*0.22,{collide:false});
  PLATFORMS.push({x0:STAIR.xb,x1:STAIR.xb+1.5,z0:STAIR.z0-0.2,z1:STAIR.z1+1.6,top:0.17,ramp:null});
  PLATFORMS.push({stair:true,x0:STAIR.xt,x1:STAIR.xb,z0:STAIR.z0,z1:STAIR.z1,top:STAIR.top});
  // slim steel balustrade on the open (south) side of the flight
  const ang=Math.atan2(STAIR.top,stairLen);
  const bal=new THREE.InstancedMesh(new THREE.BoxGeometry(0.02,1.0,0.02),steelMat,70);
  bal.castShadow=true; let n=0;
  for(let i=0;i<=Math.floor(stairLen/0.115);i++){
    const x=STAIR.xb-i*0.115, y=STAIR.top*(STAIR.xb-x)/stairLen;
    M.makeTranslation(x,y+0.52,STAIR.z1-0.05); bal.setMatrixAt(n++,M);
  }
  bal.count=n; world.add(bal);
  const rail=box(Math.hypot(stairLen,STAIR.top),0.032,0.05,steelMat,(STAIR.xb+STAIR.xt)/2,STAIR.top/2+1.02,STAIR.z1-0.05,{collide:false});
  rail.rotation.z=ang;
  COLLIDERS.push({x0:STAIR.xt-0.1,x1:STAIR.xb,z0:STAIR.z1-0.12,z1:STAIR.z1+0.02,y0:0,y1:STAIR.top+1.1});
}

/* ── ten placeholder works, hung flat on the concrete ─────────────────── */
function placeholderCanvas(w,h,idx,tone){
  const px=Math.round(360*Math.max(1,w/h)), py=Math.round(360*Math.max(1,h/w));
  const c=cv(px,py), x=c.getContext('2d');
  x.fillStyle=tone.bg; x.fillRect(0,0,px,py);
  blotch(x,px,py,140,px*0.03,px*0.32,tone.cols,0.42);
  for(let i=0;i<420;i++){ x.fillStyle=`rgba(${Math.random()<0.5?tone.cols[0]:tone.cols[1]},${rnd(0.04,0.22)})`;
    x.fillRect(Math.random()*px,Math.random()*py,rnd(2,16),rnd(2,11)); }
  grain(x,px,py,20);
  x.globalAlpha=0.30; x.fillStyle=tone.ink; x.textAlign='center';
  x.font=`300 ${Math.round(py*0.16)}px ui-monospace, Menlo, monospace`;
  x.fillText(String(idx).padStart(2,'0'), px/2, py*0.53);
  x.font=`300 ${Math.round(py*0.045)}px ui-monospace, Menlo, monospace`;
  x.fillText(`${w.toFixed(2)} × ${h.toFixed(2)} m`, px/2, py*0.62);
  x.globalAlpha=0.18; x.strokeStyle=tone.ink; x.lineWidth=2;
  x.strokeRect(px*0.06,py*0.06,px*0.88,py*0.88); x.globalAlpha=1;
  return new THREE.MeshStandardMaterial({color:0xffffff,roughness:0.84,metalness:0,
    map:tex(c,1,1,true),bumpMap:tex(c,1,1),bumpScale:0.03});
}
const TONES=[
  {bg:'#6b5a44',cols:['150,124,88','58,46,34','106,88,62'],ink:'#efe4cf'},
  {bg:'#2a2523',cols:['82,68,56','16,14,13','128,104,78'],ink:'#e6dccb'},
  {bg:'#8d8578',cols:['186,178,164','96,90,80','62,58,52'],ink:'#2a2523'},
  {bg:'#4a4441',cols:['110,100,90','28,25,23','154,138,116'],ink:'#e8dfd0'}
];
// [w, h, x, y, z, rotY]
const WORKS=[
  [2.35,2.00, HALL.x0+0.09, 3.45,  3.0,  Math.PI/2],
  [1.45,1.85, HALL.x0+0.09, 2.55,  8.6,  Math.PI/2],
  [1.30,1.00, HALL.x0+0.09, 2.05, -4.5,  Math.PI/2],
  [1.05,1.35, HALL.x0+0.09, 2.00, -7.6,  Math.PI/2],
  [1.70,1.25, 1.80,         3.70, HALL.z0+0.09, 0],
  [2.00,1.50, -2.00,        2.65, HALL.z1-0.09, Math.PI],
  [1.90,1.40, MEZZ.x0+0.09, MEZZ.top+1.60, -6.4, Math.PI/2],
  [1.35,1.10, -5.60,        MEZZ.top+1.55, HALL.z0+0.09, 0],
  [3.10,2.30, WING.x1-0.09, 2.50,  6.2, -Math.PI/2],
  [1.55,1.95, 9.50,         2.40, WING.z0+0.09, 0]
];
WORKS.forEach(([w,h,x,y,z,ry],i)=>{
  const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,0.055),placeholderCanvas(w,h,i+1,TONES[i%TONES.length]));
  m.position.set(x,y,z); m.rotation.y=ry; m.castShadow=true; m.receiveShadow=true; world.add(m);
});

/* console: blackened steel carcass on a slim base, reclaimed-wood top */
{
  const cx=HALL.x0+0.44, cz=2.7, L=4.6;
  box(0.78,0.66,L,blackenedMat,cx,0.52,cz);
  box(0.84,0.055,L+0.1,woodMat(),cx,0.875,cz);
  for(let i=0;i<3;i++) box(0.005,0.5,0.02,steelMat,cx-0.39,0.52,cz-L/2+0.6+i*1.5,{collide:false});
  for(const lz of [cz-L/2+0.25,cz+L/2-0.25]) for(const lx of [cx-0.28,cx+0.28]) box(0.04,0.18,0.04,steelMat,lx,0.09,lz,{collide:false});
  // ceramics + dried botanicals
  const vase=(x,z,r,hh,t)=>{
    const pts=[]; for(let i=0;i<=14;i++){ const u=i/14; pts.push(new THREE.Vector2(r*(0.42+0.72*Math.sin(Math.PI*(0.14+u*0.78))),u*hh)); }
    const m=new THREE.Mesh(new THREE.LatheGeometry(pts,40),ceramicMat(t));
    m.position.set(x,0.9,z); m.castShadow=true; world.add(m);
    COLLIDERS.push({x0:x-r,x1:x+r,z0:z-r,z1:z+r,y0:0.9,y1:0.9+hh}); return m;
  };
  vase(cx,cz-1.9,0.30,0.62,0x6b5340);
  vase(cx,cz+1.55,0.22,0.30,0x7a5c3f);
  // branches
  const br=new THREE.Group(); br.position.set(cx,1.5,cz-1.9); world.add(br);
  const twig=new THREE.MeshStandardMaterial({color:0x3a2f24,roughness:0.9});
  for(let i=0;i<26;i++){
    const len=rnd(0.5,1.25), g=new THREE.CylinderGeometry(0.006,0.011,len,4);
    const m=new THREE.Mesh(g,twig);
    m.position.set(rnd(-0.1,0.1),len/2,rnd(-0.1,0.1));
    m.rotation.set(rnd(-0.5,0.5),Math.random()*6,rnd(-0.5,0.5));
    br.add(m);
    for(let j=0;j<5;j++){ const l=new THREE.Mesh(new THREE.SphereGeometry(0.022,5,4),twig);
      l.scale.set(1,0.4,2.4); l.position.set(rnd(-0.16,0.16),len*rnd(0.4,1),rnd(-0.16,0.16)); m.add(l); }
  }
  box(0.3,0.05,0.42,new THREE.MeshStandardMaterial({color:0x24201d,roughness:0.7}),cx,0.93,cz+0.1,{collide:false});
}
/* dark plinth + vessel by the stair, and a wide-mouthed bowl on the floor */
{
  box(0.42,1.32,0.42,woodMat(true),2.05,0.66,-8.0);
  const pts=[]; for(let i=0;i<=16;i++){ const u=i/16; pts.push(new THREE.Vector2(0.30*Math.sin(Math.PI*(0.18+u*0.74)),u*0.52)); }
  const v=new THREE.Mesh(new THREE.LatheGeometry(pts,40),ceramicMat(0x4a3c30));
  v.position.set(2.05,1.32,-8.0); v.castShadow=true; world.add(v);
}

/* ── furniture: sofa, coffee table, travertine pedestal, rug ─────────── */
const linen = linenMat();
function cushion(w,h,d,x,y,z,soft=0.06){
  const g=new THREE.BoxGeometry(w,h,d,3,3,3);
  const p=g.attributes.position;
  for(let i=0;i<p.count;i++){ // round the edges a touch so linen doesn't read as a crate
    p.setXYZ(i,p.getX(i)*(1-soft*0.3),p.getY(i)*(1-soft*0.2)+Math.sin(p.getX(i)*2)*0.006,p.getZ(i)*(1-soft*0.3));
  }
  g.computeVertexNormals();
  const m=new THREE.Mesh(g,linen); m.position.set(x,y,z); m.castShadow=true; m.receiveShadow=true; world.add(m);
  return m;
}
{
  const rug=new THREE.Mesh(new THREE.PlaneGeometry(6.6,5.2),(()=>{
    const c=cv(512), x=c.getContext('2d'); x.fillStyle='#8e877c'; x.fillRect(0,0,512,512);
    blotch(x,512,512,120,20,180,['122,116,106','168,162,150'],0.35); grain(x,512,512,14);
    return new THREE.MeshStandardMaterial({color:0xa9a297,roughness:0.95,map:tex(c,1,1,true)});
  })());
  rug.rotation.x=-Math.PI/2; rug.position.set(-1.4,0.012,2.0); rug.receiveShadow=true; world.add(rug);

  // modular L sofa, bone-white linen: base slabs + seat + back cushions
  const S={x:-2.6,z:1.4};
  cushion(3.5,0.30,1.9,S.x,0.16,S.z+1.2);          // chaise base
  cushion(3.4,0.26,1.8,S.x,0.44,S.z+1.2);          // chaise pad
  cushion(1.9,0.30,3.0,S.x+2.7,0.16,S.z+0.1);      // main base
  for(let i=0;i<2;i++) cushion(1.85,0.28,1.45,S.x+2.7,0.45,S.z-0.62+i*1.48);
  for(let i=0;i<2;i++) cushion(1.8,0.52,0.34,S.x+2.7,0.78,S.z-1.22+i*0.0,0.1);
  cushion(1.85,0.5,0.32,S.x+2.7,0.79,S.z-1.28);
  for(const p of [[-0.45,-0.9],[0.42,-0.86],[0.0,-1.0]])
    cushion(0.62,0.2,0.6,S.x+2.7+p[0],0.68,S.z+p[1]+0.35,0.14).rotation.set(rnd(-0.2,0.2),rnd(-0.3,0.3),rnd(-0.1,0.1));
  COLLIDERS.push({x0:S.x-1.8,x1:S.x+3.7,z0:S.z-1.5,z1:S.z+2.2,y0:0,y1:0.95});

  // walnut coffee table
  box(1.7,0.09,1.15,woodMat(),0.35,0.40,2.35);
  box(1.2,0.36,0.75,woodMat(true),0.35,0.19,2.35,{collide:false});
  box(0.42,0.055,0.3,new THREE.MeshStandardMaterial({color:0x1e1a18,roughness:0.55}),0.05,0.47,2.15,{collide:false});
  const bowl=new THREE.Mesh(new THREE.LatheGeometry((()=>{const p=[];for(let i=0;i<=12;i++){const u=i/12;p.push(new THREE.Vector2(0.05+0.20*u,u*u*0.16));}return p;})(),36),ceramicMat(0x1d1917));
  bowl.position.set(0.85,0.44,2.5); bowl.castShadow=true; world.add(bowl);

  // round travertine pedestal table
  const tv=travertineMat();
  const top=new THREE.Mesh(new THREE.CylinderGeometry(1.32,1.32,0.11,64),tv);
  top.position.set(2.5,0.74,5.6); top.castShadow=true; top.receiveShadow=true; world.add(top);
  const base=new THREE.Mesh(new THREE.CylinderGeometry(0.5,0.52,0.69,48),tv);
  base.position.set(2.5,0.345,5.6); base.castShadow=true; base.receiveShadow=true; world.add(base);
  COLLIDERS.push({x0:1.2,x1:3.8,z0:4.3,z1:6.9,y0:0,y1:0.8});
  const bulb=new THREE.Mesh(new THREE.SphereGeometry(0.29,28,20),ceramicMat(0x2a2320));
  bulb.scale.set(1,0.86,1); bulb.position.set(2.0,1.05,5.2); bulb.castShadow=true; world.add(bulb);
  const platter=new THREE.Mesh(new THREE.LatheGeometry((()=>{const p=[];for(let i=0;i<=10;i++){const u=i/10;p.push(new THREE.Vector2(0.08+0.32*u,u*u*0.10));}return p;})(),40),ceramicMat(0x7a6349));
  platter.position.set(3.05,0.8,5.95); platter.castShadow=true; world.add(platter);
  // dried stems in a low bowl beside the arch
  const g2=new THREE.Group(); g2.position.set(2.0,1.2,5.2); world.add(g2);
  const twig=new THREE.MeshStandardMaterial({color:0x40342a,roughness:0.9});
  for(let i=0;i<20;i++){ const len=rnd(0.6,1.5), m=new THREE.Mesh(new THREE.CylinderGeometry(0.005,0.009,len,4),twig);
    m.position.set(rnd(-0.08,0.08),len/2,rnd(-0.08,0.08)); m.rotation.set(rnd(-0.45,0.45),Math.random()*6,rnd(-0.45,0.45)); g2.add(m); }
}

/* ─────────────────────────────── lighting ────────────────────────────── */
const sun = new THREE.DirectionalLight(0xffe9c9, 4.6);
sun.position.set(-7.5, 26, -21); sun.target.position.set(2.4, 0.4, -6.5);
sun.castShadow=true; sun.shadow.mapSize.set(2048,2048);
sun.shadow.camera.left=-24; sun.shadow.camera.right=24;
sun.shadow.camera.top=26; sun.shadow.camera.bottom=-22;
sun.shadow.camera.near=1; sun.shadow.camera.far=95; sun.shadow.bias=-0.0006; sun.shadow.normalBias=0.03;
scene.add(sun, sun.target);

const wingSun = new THREE.DirectionalLight(0xfff1dc, 2.2);
wingSun.position.set(19,14,16); wingSun.target.position.set(7,1,7); scene.add(wingSun, wingSun.target);
scene.add(new THREE.HemisphereLight(0xa8b4bd, 0x2b2520, 0.55));
// warm rim grazing the west wall texture
const rim = new THREE.SpotLight(0xffca8e, 26, 24, 0.72, 0.85, 1.6);
rim.position.set(-2.2, 6.4, 8.6); rim.target.position.set(HALL.x0+0.2, 3.2, 2.2); scene.add(rim, rim.target);
const fill = new THREE.PointLight(0xd9c3a4, 8, 16, 2.0); fill.position.set(-1.0, 2.4, 4.2); scene.add(fill);

/* light shaft through the skylight — three crossing additive sheets */
{
  const c=cv(64,256), x=c.getContext('2d');
  const g=x.createLinearGradient(0,0,0,256);
  g.addColorStop(0,'rgba(255,244,224,0.85)'); g.addColorStop(0.55,'rgba(255,238,214,0.30)'); g.addColorStop(1,'rgba(255,232,206,0)');
  x.fillStyle=g; x.fillRect(0,0,64,256);
  const e=x.createLinearGradient(0,0,64,0);
  e.addColorStop(0,'rgba(0,0,0,1)'); e.addColorStop(0.14,'rgba(0,0,0,0)'); e.addColorStop(0.86,'rgba(0,0,0,0)'); e.addColorStop(1,'rgba(0,0,0,1)');
  x.globalCompositeOperation='destination-out'; x.fillStyle=e; x.fillRect(0,0,64,256);
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace;
  const mat=new THREE.MeshBasicMaterial({map:t,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide,opacity:0.6,toneMapped:false});
  const dir=new THREE.Vector3().subVectors(sun.target.position,sun.position).normalize();
  const drop=HALL.h/Math.abs(dir.y), off=new THREE.Vector3(dir.x*drop,0,dir.z*drop);
  const shaft=new THREE.Group(); world.add(shaft);
  const mk=(w,len,cx,cz)=>{
    const m=new THREE.Mesh(new THREE.PlaneGeometry(w,1,1,1),mat);    const geo=new THREE.BufferGeometry();
    const hw=w/2;
    const p=new Float32Array([
      cx-hw,HALL.h,cz, cx+hw,HALL.h,cz,
      cx+hw+off.x,HALL.h-drop*Math.abs(dir.y),cz+off.z, cx-hw+off.x,HALL.h-drop*Math.abs(dir.y),cz+off.z
    ]);
    geo.setAttribute('position',new THREE.BufferAttribute(p,3));
    geo.setAttribute('uv',new THREE.BufferAttribute(new Float32Array([0,0,1,0,1,1,0,1]),2));
    geo.setIndex([0,1,2,0,2,3]); geo.computeVertexNormals();
    return new THREE.Mesh(geo,mat);
  };
  const zc=(SKY.z0+SKY.z1)/2;
  for(const dz of [-2.0,0,2.0]) shaft.add(mk(SKY.x1-SKY.x0, 0, (SKY.x0+SKY.x1)/2, zc+dz));
  // a pool of light where the shaft lands
  const pool=new THREE.Mesh(new THREE.CircleGeometry(2.0,40),
    new THREE.MeshBasicMaterial({color:0xfff0d4,transparent:true,opacity:0.14,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false}));
  pool.rotation.x=-Math.PI/2; pool.position.set((SKY.x0+SKY.x1)/2+off.x, 0.02, zc+off.z); world.add(pool);
}
/* haze motes for depth */
{
  const N=420, pos=new Float32Array(N*3);
  for(let i=0;i<N;i++){ pos[i*3]=rnd(HALL.x0,PIER.x); pos[i*3+1]=rnd(0.3,HALL.h-0.4); pos[i*3+2]=rnd(HALL.z0,HALL.z1); }
  const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.BufferAttribute(pos,3));
  const m=new THREE.PointsMaterial({color:0xffe7c6,size:0.022,transparent:true,opacity:0.35,depthWrite:false,blending:THREE.AdditiveBlending,sizeAttenuation:true});
  const pts=new THREE.Points(g,m); world.add(pts); window.__motes=pts;
}

/* ───────────────────────── camera + collisions ───────────────────────── */
const P = { pos:new THREE.Vector3(0.6,0,7.4), vy:0, yaw:Math.PI, pitch:-0.03, bob:0, dist:0, r:0.34, eye:1.62, onGround:true };
const keys = Object.create(null);
addEventListener('keydown',e=>{ keys[e.code]=true; });
addEventListener('keyup',e=>{ keys[e.code]=false; });

const gate=$('.gate'), cvs=$('.scene');
gate.addEventListener('click',()=>{ cvs.requestPointerLock(); startAudio(); });
cvs.addEventListener('click',()=>{ if(document.pointerLockElement!==cvs) cvs.requestPointerLock(); });
document.addEventListener('pointerlockchange',()=>{
  const on=document.pointerLockElement===cvs;
  gate.classList.toggle('off',on);
  if(on && audio) audio.ctx.resume();
});
document.addEventListener('mousemove',e=>{
  if(document.pointerLockElement!==cvs) return;
  P.yaw -= e.movementX*0.0022; P.pitch -= e.movementY*0.0020;
  P.pitch=Math.max(-1.35,Math.min(1.35,P.pitch));
});

function supportAt(x,z,feetY){
  let best=-Infinity;
  for(const p of PLATFORMS){
    if(x<p.x0-0.001||x>p.x1+0.001||z<p.z0-0.001||z>p.z1+0.001) continue;
    const top = p.stair ? p.top*(p.x1-x)/(p.x1-p.x0) : p.top;
    if(top<=feetY+0.62 && top>best) best=top;
  }
  return best;
}
function resolve(x,z,feetY){
  const head=feetY+P.eye;
  for(let iter=0;iter<3;iter++){
    let hit=false;
    for(const c of COLLIDERS){
      if(head<c.y0 || feetY+0.35>c.y1) continue;
      const nx=Math.max(c.x0,Math.min(x,c.x1)), nz=Math.max(c.z0,Math.min(z,c.z1));
      const dx=x-nx, dz=z-nz, d2=dx*dx+dz*dz;
      if(d2>P.r*P.r) continue;
      hit=true;
      if(d2>1e-8){ const d=Math.sqrt(d2); x=nx+dx/d*P.r; z=nz+dz/d*P.r; }
      else {
        const l=x-c.x0, r=c.x1-x, u=z-c.z0, dn=c.z1-z, m=Math.min(l,r,u,dn);
        if(m===l) x=c.x0-P.r; else if(m===r) x=c.x1+P.r; else if(m===u) z=c.z0-P.r; else z=c.z1+P.r;
      }
    }
    if(!hit) break;
  }
  return [x,z];
}

/* ─────────────────────────────── audio ───────────────────────────────── */
let audio=null;
function startAudio(){
  if(audio) { audio.ctx.resume(); return; }
  const Ctx=window.AudioContext||window.webkitAudioContext; if(!Ctx) return;
  const ctx=new Ctx();
  // reverberant hall: generated exponential-decay noise impulse
  const dur=3.4, len=Math.floor(ctx.sampleRate*dur), ir=ctx.createBuffer(2,len,ctx.sampleRate);
  for(let ch=0;ch<2;ch++){ const d=ir.getChannelData(ch);
    for(let i=0;i<len;i++){ const t=i/len; d[i]=(Math.random()*2-1)*Math.pow(1-t,2.4)*(i<ctx.sampleRate*0.006?0.3:1); } }
  const conv=ctx.createConvolver(); conv.buffer=ir;
  const wet=ctx.createGain(); wet.gain.value=0.9;
  const master=ctx.createGain(); master.gain.value=0.0;
  conv.connect(wet).connect(master); master.connect(ctx.destination);
  const dry=ctx.createGain(); dry.gain.value=0.55; dry.connect(master);
  master.gain.linearRampToValueAtTime(0.85, ctx.currentTime+3);

  // low ambient drone: three detuned saws through a slow-swept lowpass
  const dg=ctx.createGain(); dg.gain.value=0.0;
  const lp=ctx.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=180; lp.Q.value=0.8;
  dg.connect(lp); lp.connect(dry); lp.connect(conv);
  for(const [f,t] of [[41.2,0],[61.7,0.3],[82.4,-0.25],[123.5,0.6]]){
    const o=ctx.createOscillator(); o.type='sawtooth'; o.frequency.value=f; o.detune.value=t*12;
    const g=ctx.createGain(); g.gain.value=f>100?0.045:0.13; o.connect(g).connect(dg); o.start();
    const lfo=ctx.createOscillator(); lfo.frequency.value=0.03+Math.random()*0.05;
    const la=ctx.createGain(); la.gain.value=g.gain.value*0.5; lfo.connect(la).connect(g.gain); lfo.start();
  }
  const swp=ctx.createOscillator(); swp.frequency.value=0.017;
  const swa=ctx.createGain(); swa.gain.value=70; swp.connect(swa).connect(lp.frequency); swp.start();
  dg.gain.linearRampToValueAtTime(0.5, ctx.currentTime+6);

  // air: filtered noise bed
  const nb=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate); const nd=nb.getChannelData(0);
  for(let i=0;i<nd.length;i++) nd[i]=Math.random()*2-1;
  const air=ctx.createBufferSource(); air.buffer=nb; air.loop=true;
  const af=ctx.createBiquadFilter(); af.type='bandpass'; af.frequency.value=420; af.Q.value=0.5;
  const ag=ctx.createGain(); ag.gain.value=0.035; air.connect(af).connect(ag).connect(conv); air.start();

  audio={ctx,conv,dry,noise:nb};
}
function footstep(hard){
  if(!audio) return; const {ctx}=audio;
  const s=ctx.createBufferSource(); s.buffer=audio.noise;
  s.playbackRate.value=rnd(0.8,1.2);
  const bp=ctx.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value=rnd(900,1500); bp.Q.value=1.1;
  const lo=ctx.createBiquadFilter(); lo.type='lowshelf'; lo.frequency.value=180; lo.gain.value=8;
  const g=ctx.createGain(); const t=ctx.currentTime;
  const amp=(hard?0.5:0.32)*rnd(0.8,1.1);
  g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(amp,t+0.006);
  g.gain.exponentialRampToValueAtTime(0.0008,t+0.16);
  s.connect(bp).connect(lo).connect(g);
  g.connect(audio.conv); g.connect(audio.dry);
  s.start(t); s.stop(t+0.22);
}

/* ─────────────────────────────── loop ────────────────────────────────── */
const fwd=new THREE.Vector3(), right=new THREE.Vector3(), clock=new THREE.Clock();
let warm=0;
if(THREE.REVISION<163) world.traverse(o=>{ const m=o.material; if(!m) return;
  for(const mm of Array.isArray(m)?m:[m]) if('envMapIntensity' in mm) mm.envMapIntensity=(mm.envMapIntensity??1)*0.5; });
function frame(){
  const dt=Math.min(clock.getDelta(),0.05), t=clock.elapsedTime;
  const run=keys.ShiftLeft||keys.ShiftRight;
  const sp=(run?3.5:1.55);
  let ix=0,iz=0;
  if(keys.KeyW||keys.ArrowUp) iz-=1;
  if(keys.KeyS||keys.ArrowDown) iz+=1;
  if(keys.KeyA||keys.ArrowLeft) ix-=1;
  if(keys.KeyD||keys.ArrowRight) ix+=1;
  const l=Math.hypot(ix,iz)||1; ix/=l; iz/=l;
  fwd.set(-Math.sin(P.yaw),0,-Math.cos(P.yaw));
  right.set(Math.cos(P.yaw)*-1,0,Math.sin(P.yaw)).multiplyScalar(-1);
  const vx=(fwd.x*-iz+right.x*ix)*sp, vz=(fwd.z*-iz+right.z*ix)*sp;
  let nx=P.pos.x+vx*dt, nz=P.pos.z+vz*dt;
  [nx,nz]=resolve(nx,nz,P.pos.y);
  const sup=supportAt(nx,nz,P.pos.y);
  if(sup>-Infinity){
    if(P.pos.y<sup+0.02 || sup>=P.pos.y-0.02){ P.pos.y=sup; P.vy=0; P.onGround=true; }
  } else { P.onGround=false; }
  if(!P.onGround){ P.vy-=16*dt; P.pos.y+=P.vy*dt;
    const s2=supportAt(nx,nz,-99); if(P.pos.y<=Math.max(s2,0)){ P.pos.y=Math.max(s2,0); P.vy=0; P.onGround=true; } }
  P.pos.x=nx; P.pos.z=nz;

  const moving=(ix||iz)&&P.onGround;
  if(moving){
    P.dist+=sp*dt; P.bob+=dt*(run?13:8.2);
    if(P.dist>(run?0.72:0.82)){ P.dist=0; footstep(run); }
  } else P.bob+=dt*1.6;
  const bobY=moving?Math.sin(P.bob)*(run?0.045:0.026):Math.sin(P.bob)*0.004;
  const bobX=moving?Math.cos(P.bob*0.5)*(run?0.02:0.012):0;
  camera.position.set(P.pos.x+bobX*Math.cos(P.yaw), P.pos.y+P.eye+bobY, P.pos.z+bobX*-Math.sin(P.yaw));
  camera.rotation.set(P.pitch,P.yaw,moving?Math.sin(P.bob*0.5)*0.004:0,'YXZ');
  camera.rotation.order='YXZ';
  camera.rotation.set(P.pitch,P.yaw,0,'YXZ');

  const m=window.__motes; if(m) m.rotation.y=t*0.004;
  if(warm<3){ renderer.shadowMap.needsUpdate=true; warm++; }
  renderer.render(scene,camera);
  requestAnimationFrame(frame);
}
addEventListener('resize',()=>{ camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth,innerHeight); });
frame();
