import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

// Check the actual room camera handoff against the independent projection scene.
// Only browser rendering, image decoding and input are stubbed for this check.
let source=await fs.readFile(new URL('../dist/bundle.js',import.meta.url),'utf8');
const end=source.indexOf('// A fresh document always starts');
assert.ok(end>0,'build the application before checking its room geometry');
source=source.slice(0,end).replace(/^\(\(\)=>\{/,'return (()=>{')
  .replace('const {OrbitControls}=ControlsModule;','const OrbitControls=StubControls;');
source+='THREE.WebGLRenderer=Renderer;return {createRoom,THREE};})();';
const gradient={addColorStop(){}};
const context=new Proxy({measureText:text=>({width:String(text).length*12}),createRadialGradient:()=>gradient,createLinearGradient:()=>gradient},
  {get:(target,key)=>key in target?target[key]:()=>{}});
const canvas=()=>({width:512,height:512,style:{},addEventListener(){},setAttribute(){},getContext:()=>context,
  toDataURL:()=> 'data:image/png;base64,AA==',getBoundingClientRect:()=>({left:0,top:0,width:556,height:673})});
let renderer,frames=[];
class Renderer{
  constructor(){renderer=this;this.domElement=canvas();this.shadowMap={};this.capabilities={getMaxAnisotropy:()=>4};this.info={render:{calls:0,triangles:0}};}
  setPixelRatio(){}setSize(){}render(scene,camera){this.scene=scene;this.camera=camera;}compile(){}
}
class StubControls{
  constructor(camera){this.camera=camera;this.target=new camera.position.constructor();}
  addEventListener(name,fn){if(name==='change')this.changed=fn;}update(){this.camera.lookAt(this.target);this.changed?.();}saveState(){}
}
class ImageMock{
  constructor(){this.width=this.naturalWidth=1600;this.height=this.naturalHeight=1100;}
  set src(value){this.value=value;queueMicrotask(()=>this.onload?.());}get src(){return this.value;}async decode(){}
}
const window={innerWidth:556,innerHeight:673,addEventListener(){},matchMedia:()=>({matches:false})};
const document={hidden:false,createElement:canvas};
const api=new Function('Renderer','StubControls','document','window','ResizeObserver','Image','requestAnimationFrame','cancelAnimationFrame',source)
  (Renderer,StubControls,document,window,class{observe(){}disconnect(){}},ImageMock,fn=>frames.push(fn),()=>{});
let time=100,checked=0;
function renderNow(){time+=40;const pending=frames;frames=[];pending.forEach(fn=>fn(time));}
function photoSurface(scene){let surface;scene.traverse(node=>{if(node.geometry?.parameters?.width===3.28&&node.geometry?.parameters?.height===1.69)surface=node;});assert.ok(surface);return surface;}
function pixel(point,camera,w,h){const p=point.clone().project(camera);return [(p.x+1)*w/2,(1-p.y)*h/2];}
for(const [w,h] of [[1280,720],[1440,900],[556,673],[390,844],[320,740],[844,390]]){
  window.innerWidth=w;window.innerHeight=h;const container={clientWidth:w,clientHeight:h,append(){}};
  const home=api.createRoom(container,()=>{}),homeRenderer=renderer;
  renderNow();const camera=homeRenderer.camera,initial=camera.clone(),initialProjection=[...camera.projectionMatrix.elements];
  const cinema=api.createRoom(container,()=>{},{projection:true}),cinemaRenderer=renderer;cinema.setActive(true);renderNow();
  const destination=cinemaRenderer.camera,portal=photoSurface(homeRenderer.scene);
  for(const zoom of [1,1.4]){
    if(zoom!==1)home.zoom(zoom);renderNow();const before=camera.clone(),projection=[...camera.projectionMatrix.elements];
    assert.equal(home.beginFeatureFocus('screen'),true);renderNow();
    assert.ok(camera.position.distanceTo(before.position)<1e-10);
    assert.ok(camera.quaternion.angleTo(before.quaternion)<1e-7,'starting the flight changes the viewing direction');
    camera.projectionMatrix.elements.forEach((v,i)=>assert.ok(Math.abs(v-projection[i])<1e-10,'first flight frame changes the lens'));
    for(let i=0;i<=100;i++){
      home.featureFocusProgress(i/100);renderNow();assert.ok(camera.projectionMatrix.elements.every(Number.isFinite));
    }
    assert.ok(camera.position.distanceTo(destination.position)<1e-10,'arrival eye point differs');
    assert.ok(camera.quaternion.angleTo(destination.quaternion)<1e-7,'arrival direction differs');
    assert.ok(Math.abs(camera.fov-destination.fov)<1e-10,'arrival lens differs');
    homeRenderer.scene.updateMatrixWorld(true);const verts=portal.geometry.attributes.position;
    for(let i=0;i<verts.count;i++){
      const point=portal.localToWorld(new api.THREE.Vector3().fromBufferAttribute(verts,i));
      const a=pixel(point,camera,w,h),b=pixel(point,destination,w,h);
      a.forEach((v,j)=>assert.ok(Math.abs(v-b[j])<1e-7,'screen moves or resizes at handoff'));checked++;
    }
    for(const point of [[portal.position.x,3.62,-3.29],[-2.1,1.13,-2.22],[-.75,1.08,-2.61],[2.65,1.67,-2.36]]){
      const p=new api.THREE.Vector3(...point),a=pixel(p,camera,w,h),b=pixel(p,destination,w,h);
      a.forEach((v,j)=>assert.ok(Math.abs(v-b[j])<1e-7,'nearby room geometry moves at handoff'));checked++;
    }
    home.fit();renderNow();assert.ok(camera.position.distanceTo(destination.position)<1e-10,'resize/fit breaks matching');
    home.endFeatureFocus();renderNow();assert.ok(camera.position.distanceTo(before.position)<1e-9,`return fails to restore the room view at ${w}x${h} zoom ${zoom}: ${before.position.toArray()} -> ${camera.position.toArray()}`);
    camera.projectionMatrix.elements.forEach((v,i)=>assert.ok(Math.abs(v-projection[i])<1e-9,'return fails to restore the room lens'));
  }
  home.reset();renderNow();assert.ok(camera.position.distanceTo(initial.position)<1e-9);
  camera.projectionMatrix.elements.forEach((v,i)=>assert.ok(Math.abs(v-initialProjection[i])<1e-9));
  home.setActive(false);cinema.setActive(false);frames=[];
}
console.log(`PASS: ${checked} screen/furniture handoff projections on six viewport sizes from default/zoomed room views; continuous starting frame, matching lens/eye point and restored return view.`);
