// Design-only scene. No application routing, persistence or uploads.
import * as THREE from 'three';
import { RoundedBoxGeometry } from '../../dist/assets/RoundedBoxGeometry.js';
import { albumSampleRecords } from '../../src/album-pages.js';

const renderer=new THREE.WebGLRenderer({antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.0;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
document.getElementById('scene').append(renderer.domElement);
const scene=new THREE.Scene();scene.background=new THREE.Color('#868a71');scene.fog=new THREE.Fog('#747b65',24,42);
const camera=new THREE.PerspectiveCamera(43,1,.1,70);camera.position.set(0,3.8,7.6);camera.lookAt(0,4.05,-8);
const mats=new Map();function mat(color){if(!mats.has(color))mats.set(color,new THREE.MeshStandardMaterial({color,roughness:.92}));return mats.get(color);}
function box(x,y,z,w,h,d,color,r=.03,parent=scene){const m=new THREE.Mesh(new RoundedBoxGeometry(w,h,d,3,Math.min(r,w/3,h/3,d/3)),typeof color==='string'?mat(color):color);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
function cylinder(x,y,z,r1,r2,h,color,parent=scene){const m=new THREE.Mesh(new THREE.CylinderGeometry(r1,r2,h,24),mat(color));m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
scene.add(new THREE.HemisphereLight('#ffefd2','#536347',1.65));
const ceiling=new THREE.DirectionalLight('#ffe2b5',1.35);ceiling.position.set(-3,10,5);ceiling.castShadow=true;ceiling.shadow.mapSize.set(2048,2048);ceiling.shadow.camera.left=-15;ceiling.shadow.camera.right=15;ceiling.shadow.camera.top=15;ceiling.shadow.camera.bottom=-15;ceiling.shadow.bias=-.001;scene.add(ceiling);
box(0,-.18,-3,28,.32,32,'#aca389');
box(0,5,-9,27,10,.3,'#819175');
// Ceiling, wall panels and warm wood rail keep the existing room's materials.
box(0,10,-1,27,.25,20,'#9b997f');
for(let i=-14;i<=14;i++){box(i*.92,10-.1,-1,.08,.12,20,'#beb192');box(i*.9,4.7,-8.79,.04,9,.035,'#a4b090');}
box(0,.48,-8.75,27,.14,.18,'#d2bb94');box(0,9.3,-8.75,27,.12,.18,'#d2bb94');
for(const side of [-1,1]){
  box(side*13.4,5,-1,.3,10,20,'#77826a');
  for(let i=0;i<10;i++)box(side*13.22,3,-8+i*1.6,.06,5,.04,'#b2aa8c');
  // Repeated rounded pleats, no red velvet or ornate decoration.
  for(let i=0;i<9;i++){const x=side*(7.05+i*.19);cylinder(x,5.3,-8.32,.135,.155,7.4,i%2?'#949d7e':'#a7af92');}
  box(side*7.8,9.1,-8.25,2.1,.24,.34,'#cbb691',.09);
  for(const z of [-6,-.8]){
    box(side*13.05,5.2,z,.16,.78,.58,'#d4bc8d',.08);
    const glow=new THREE.MeshStandardMaterial({color:'#ffe5b4',emissive:'#ffdba0',emissiveIntensity:.8,roughness:1});
    box(side*12.9,5.3,z,.24,.43,.38,glow,.07);
    const light=new THREE.PointLight('#ffe1aa',2,7,2);light.position.set(side*12.55,5.3,z);scene.add(light);
  }
}
// Small raised stage and large cream projection screen.
box(0,.25,-7.5,19,.5,3,'#b8ac90',.09);box(0,.08,-6.2,20,.16,.9,'#c9ba9c',.06);
box(0,5.45,-8.58,13.13,7.42,.21,'#cbb998',.12);
box(0,5.45,-8.43,12.89,7.16,.13,'#f5eedc',.07);
const samples=albumSampleRecords();
const photoSources=[samples[0].photos[0].src,samples[2].photos[0].src,samples[3].photos[0].src,samples[0].photos[2].src,samples[0].photos[1].src,samples[2].photos[1].src];
const images=await Promise.all(photoSources.map(src=>new Promise(resolve=>{const im=new Image();im.onload=()=>resolve(im);im.src=src;})));
const film=location.hash==='#film',portrait=location.hash==='#portrait',next=location.hash==='#next';
if(film)document.body.classList.add('film');
const c=document.createElement('canvas');c.width=1600;c.height=900;const ctx=c.getContext('2d');
function drawFrame(image,y=0,vertical=false){
  ctx.save();ctx.translate(0,y);const grad=ctx.createLinearGradient(0,0,1600,0);grad.addColorStop(0,'#d1d7c0');grad.addColorStop(.35,'#f2eddd');grad.addColorStop(1,'#d1d7c0');ctx.fillStyle=grad;ctx.fillRect(0,0,1600,900);
  const w=vertical?568:1200,h=900;ctx.drawImage(image,(1600-w)/2,0,w,h);ctx.restore();
}
drawFrame(images[portrait?4:next?1:0],film?-630:0,portrait);
if(film){drawFrame(images[1],300);ctx.fillStyle='#20271e';ctx.fillRect(0,264,1600,36);ctx.fillStyle='#e5dcbe';for(let y=12;y<900;y+=68){ctx.fillRect(10,y,20,34);ctx.fillRect(1570,y,20,34);}ctx.fillStyle='#605f3122';for(let i=0;i<18;i++)ctx.fillRect(0,i*53,1600,1);}
const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=renderer.capabilities.getMaxAnisotropy();
const surface=new THREE.Mesh(new THREE.PlaneGeometry(12.65,12.65*9/16),new THREE.MeshBasicMaterial({map:texture,toneMapped:false}));surface.position.set(0,5.45,-8.34);scene.add(surface);
const screenLight=new THREE.PointLight('#e6efd5',9,24,2);screenLight.position.set(0,5.5,-7.5);scene.add(screenLight);
// Four staggered rows, central aisle and rounded upholstered seat backs.
for(let row=0;row<4;row++){
  const z=-3.9+row*2.7,step=row*.22;
  box(0,.04+step/2,z,26,.09+step,2.7,'#9e9f81',.01);
  for(let col=0;col<10;col++){
    const x=(col-4.5)*2.15+(col<5?-.48:.48);const g=new THREE.Group();g.position.set(x,step,z);scene.add(g);
    box(0,1.22,.65,1.63,1.74,.44,'#7d9269',.2,g);
    box(0,1.35,.9,1.39,1.32,.095,'#8fa37d',.18,g);
    box(0,1.81,.975,1.2,.09,.035,'#a4b38d',.03,g);
    box(0,.47,-.06,1.51,.27,1.3,'#95a984',.13,g);
    for(const s of [-1,1]){box(s*.92,.66,.12,.24,.28,1.4,'#b6a384',.08,g);box(s*.92,.45,.53,.17,.66,.15,'#afa183',.03,g);}
    cylinder(0,.2,.1,.11,.16,.4,'#646f58',g);
  }
  for(const side of [-1,1]){const lightMat=new THREE.MeshBasicMaterial({color:'#e8ce9c',toneMapped:false});box(side*.6,.15+step,z+.45,.05,.06,.65,lightMat,.01);}
}
const grid=document.getElementById('photo-grid');images.forEach((img,i)=>{const wrap=document.createElement('div');wrap.innerHTML=`<div class="thumb"><img alt="占位图 ${i+1}" src="${img.src}"><span class="number">${String(i+1).padStart(2,'0')}</span><span class="remove">×</span></div><div class="move">←　→</div>`;grid.append(wrap);});
const editor=document.getElementById('editor');document.getElementById('edit').onclick=()=>editor.hidden=false;document.getElementById('close').onclick=()=>editor.hidden=true;
if(location.hash==='#manage')editor.hidden=false;
if(next){document.querySelector('.count').textContent='2 / 6';const dots=document.querySelectorAll('.dot');dots[0].classList.remove('active');dots[1].classList.add('active');}
function fit(){renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.fov=innerWidth<650?60:43;camera.updateProjectionMatrix();renderer.render(scene,camera);}addEventListener('resize',fit);fit();
