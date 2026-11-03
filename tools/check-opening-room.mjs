import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

// Exercise the built room's real vertices, including the rotated coffee table.
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
  addEventListener(){}update(){this.camera.lookAt(this.target);}saveState(){}
}
class ImageMock{
  constructor(){this.width=this.naturalWidth=1600;this.height=this.naturalHeight=1100;}
  set src(value){this.value=value;queueMicrotask(()=>this.onload?.());}get src(){return this.value;}async decode(){}
}
const window={innerWidth:556,innerHeight:673,addEventListener(){},matchMedia:()=>({matches:false})};
const document={hidden:false,createElement:canvas};
const api=new Function('Renderer','StubControls','document','window','ResizeObserver','Image','requestAnimationFrame','cancelAnimationFrame',source)
  (Renderer,StubControls,document,window,class{observe(){}disconnect(){}},ImageMock,fn=>frames.push(fn),()=>{});
const view=api.createRoom({clientWidth:556,clientHeight:673,append(){}},()=>{});
frames.shift()(100);
const {scene}=renderer,rigs=[];scene.updateMatrixWorld(true);
scene.traverse(node=>{if(node.name.startsWith('Furniture paper hinge'))rigs.push(node);});
assert.equal(rigs.length,9);
const originals=rigs.map(rig=>({matrix:rig.children[0].matrixWorld.toArray(),bottom:new api.THREE.Box3().setFromObject(rig,true).min.y}));
const restored=()=>{
  scene.updateMatrixWorld(true);
  rigs.forEach((rig,i)=>rig.children[0].matrixWorld.toArray().forEach((value,j)=>
    assert.ok(Math.abs(value-originals[i].matrix[j])<1e-10,`furniture ${i} did not return to its original transform`)));
};
view.beginOpening();
for(let i=0;i<=200;i++){
  const progress=i/200;view.unfold(progress);scene.updateMatrixWorld(true);
  const wallBottom=i===0?Math.min(...['Left wall paper hinge','Back wall paper hinge'].map(name=>
    new api.THREE.Box3().setFromObject(scene.getObjectByName(name),true).min.y)):0;
  const coverBottom=i===0?Math.min(...['Envelope left crease','Envelope right crease','Envelope top crease','Envelope lower crease'].map(name=>
    new api.THREE.Box3().setFromObject(scene.getObjectByName(name),true).min.y)):0;
  rigs.forEach((rig,j)=>{
    const bounds=new api.THREE.Box3().setFromObject(rig,true);
    assert.ok(bounds.min.y>=Math.max(.23,originals[j].bottom)-1e-7,
      `furniture ${j} crosses the floor at progress ${progress}: ${bounds.min.y}`);
    if(i===0){
      assert.ok(bounds.max.y<wallBottom-.005,'both folded walls must lie above the furniture');
      assert.ok(bounds.max.y<coverBottom-.005,'folded furniture must stay below the closed envelope covers in world coordinates');
      assert.ok(Math.max(Math.abs(bounds.min.x),Math.abs(bounds.max.x))<5.3&&Math.max(Math.abs(bounds.min.z),Math.abs(bounds.max.z))<4.25,
        'folded furniture must fit inside the envelope footprint');
    }
  });
}
restored();view.endOpening();restored();
view.beginOpening();view.unfold(.02);scene.updateMatrixWorld(true);
for(const rig of rigs){
  const centre=new api.THREE.Box3().setFromObject(rig,true).getCenter(new api.THREE.Vector3());
  const origin=renderer.camera.position.clone(),ray=new api.THREE.Raycaster(origin,centre.sub(origin).normalize());
  const first=ray.intersectObjects(scene.children,true)[0];
  let ancestor=first?.object;while(ancestor&&ancestor.name!=='Unfolding envelope')ancestor=ancestor.parent;
  assert.ok(ancestor,`sealed envelope does not occlude ${rig.name}`);
}
view.endOpening();restored();
view.beginOpening();
for(const progress of [.40,.45,.48]){
  view.unfold(progress);scene.updateMatrixWorld(true);
  for(const rig of rigs){
    const centre=new api.THREE.Box3().setFromObject(rig,true).getCenter(new api.THREE.Vector3());
    const origin=renderer.camera.position.clone(),ray=new api.THREE.Raycaster(origin,centre.sub(origin).normalize());
    const first=ray.intersectObjects(rig.parent.children,true)[0];
    let ancestor=first?.object;
    while(ancestor&&!['Left wall paper hinge','Back wall paper hinge'].includes(ancestor.name))ancestor=ancestor.parent;
    assert.ok(ancestor,`folded wall does not cover furniture ${rig.name} at ${progress}`);
  }
}
view.endOpening();restored();
view.beginOpening();view.unfold(.73);view.endOpening();restored();
console.log('PASS: 9 real furniture models clear the floor in 201 poses, stow under the folded walls, remain occluded before wall rise and restore exactly after entry/replay.');
