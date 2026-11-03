import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
// Use the real bundled Three.js geometry and camera matrices, with rendering stubbed.
let source=await fs.readFile(new URL('../dist/bundle.js',import.meta.url),'utf8');
source=source.slice(0,source.indexOf('// A fresh document always starts')).replace(/^\(\(\)=>\{/,'return (()=>{').replace('const {OrbitControls}=ControlsModule;','const OrbitControls=StubControls;');
source+='THREE.WebGLRenderer=Renderer;return {createRoom,createKtvScene,validKtv,validFullBackup,THREE};})();';
const gradient={addColorStop(){}},ctx=new Proxy({measureText:text=>({width:String(text).length*12}),createRadialGradient:()=>gradient,createLinearGradient:()=>gradient},{get:(target,key)=>key in target?target[key]:()=>{}});
const canvas=()=>({width:512,height:512,style:{},addEventListener(){},getContext:()=>ctx,toDataURL:()=> 'data:image/png;base64,AA==',getBoundingClientRect:()=>({left:0,top:0,width:556,height:673})});
const videoMock=()=>({readyState:0,videoWidth:0,videoHeight:0,duration:0,currentTime:0,paused:true,ended:false,muted:false,src:'',playsInline:false,preload:'',loop:false,setAttribute(){},removeAttribute(){},load(){},play(){this.paused=false;return Promise.resolve();},pause(){this.paused=true;},addEventListener(){},removeEventListener(){}});
let frames=[],renderers=[];
class Renderer{constructor(){this.domElement=canvas();this.shadowMap={};this.capabilities={getMaxAnisotropy:()=>4};this.info={render:{calls:0,triangles:0}};renderers.push(this);}setPixelRatio(){}setSize(w,h){this.domElement.width=w;this.domElement.height=h;}render(scene,camera){if(camera.isPerspectiveCamera){this.scene=scene;this.camera=camera;}}compile(){}getRenderTarget(){return null;}setRenderTarget(){}clear(){}clearDepth(){}}
class StubControls{constructor(camera){this.camera=camera;this.target=new camera.position.constructor();}addEventListener(){}update(){this.camera.lookAt(this.target);}saveState(){}}
class ImageMock{constructor(){this.width=this.naturalWidth=1600;this.height=this.naturalHeight=1100;}set src(value){queueMicrotask(()=>this.onload?.());}async decode(){}}
const document={hidden:false,createElement:tag=>tag==='video'?videoMock():canvas(),getElementById:()=>null},window={innerWidth:556,innerHeight:673,addEventListener(){},matchMedia:()=>({matches:false})};
const api=new Function('Renderer','StubControls','document','window','ResizeObserver','Image','requestAnimationFrame','cancelAnimationFrame',source)(Renderer,StubControls,document,window,class{observe(){}disconnect(){}},ImageMock,fn=>frames.push(fn),()=>{});
function draw(){const pending=frames;frames=[];pending.forEach(fn=>fn(1000));}
function portal(scene){let found;scene.traverse(node=>{if(node.isMesh&&node.visible===false&&node.geometry.parameters.width===.91)found=node;});return found;}
function corners(face,camera,w,h){camera.updateMatrixWorld();return [[-.455,-1.09],[.455,-1.09],[-.455,1.09],[.455,1.09]].map(([x,y])=>{const p=face.localToWorld(new api.THREE.Vector3(x,y,0)).project(camera);return [(p.x+1)*w/2,(1-p.y)*h/2];});}
for(const [w,h] of [[1280,720],[900,680],[556,673],[390,844],[320,568]]){
  window.innerWidth=w;window.innerHeight=h;const container=()=>({clientWidth:w,clientHeight:h,append(){}});
  const home=api.createRoom(container(),()=>{}),homeRenderer=renderers.at(-1),ktv=api.createKtvScene(container(),()=>{}),ktvRenderer=renderers.at(-1);
  ktv.setActive(true);draw();const target=ktv.guitarBounds();assert.ok(target.width>0&&target.height>0);
  assert.equal(home.beginFeatureFocus('guitar'),true);home.featureFocusBounds(target);home.featureFocusProgress(1);draw();
  const a=corners(portal(homeRenderer.scene),homeRenderer.camera,w,h),b=corners(portal(ktvRenderer.scene),ktvRenderer.camera,w,h);
  a.forEach((corner,i)=>corner.forEach((value,j)=>assert.ok(Math.abs(value-b[i][j])<.001,`guitar jump ${w}x${h}: ${value-b[i][j]}`)));
  for(let step=0;step<=100;step++){ktv.entranceProgress(step/100);draw();assert.ok(ktvRenderer.camera.position.toArray().every(Number.isFinite));assert.ok(ktvRenderer.camera.near>0);}
  ktvRenderer.scene.updateMatrixWorld(true);const camera=ktvRenderer.camera;
  const stage=ktvRenderer.scene.getObjectByName('ktv-stage'),stand=ktvRenderer.scene.getObjectByName('ktv-stand-mic'),tablet=ktvRenderer.scene.getObjectByName('ktv-song-console'),bench=ktvRenderer.scene.getObjectByName('ktv-bench'),setTop=ktvRenderer.scene.getObjectByName('ktv-set-top'),screenGroup=ktvRenderer.scene.getObjectByName('ktv-screen');
  assert.ok(stage&&stand&&stand.parent===stage,'stage has its own standing microphone');
  assert.ok(bench&&Math.abs(bench.position.x-.42)<.001,'sofa shifted to the screen centre line');
  const benchBox=new api.THREE.Box3().setFromObject(bench);assert.ok(benchBox.max.x-benchBox.min.x>3,'sofa widened');
  assert.ok(setTop&&Math.abs(setTop.position.x)<.001&&Math.abs(setTop.position.y-.89)<.001,'set-top box centred and flush on the cabinet');
  assert.ok(screenGroup&&Math.abs(screenGroup.position.x-bench.position.x)<.001,'sofa faces the screen');
  assert.ok(stand.position.z<-1.5,'standing microphone leaves the length of the stage clear');
  assert.ok(tablet.position.z<-2.5&&tablet.position.x>3,'song console is against the rear wall');
  const spots=[];ktvRenderer.scene.traverse(node=>{if(node.name==='ktv-wall-spot')spots.push(node);});assert.equal(spots.length,5);assert.ok(spots.every(node=>node.position.x<-3.9),'all five spots mount on the left wall');assert.ok(spots.every(node=>node.children.some(child=>child.name==='ktv-spot-head'&&Math.abs(child.rotation.z+2.34)<.001)),'spot heads tilt further down');
  const framePoints=[[-4.3,.24,3.4],[4.3,.24,3.4],[-4.3,4.55,-3.4],[4.3,4.55,-3.4]].map(p=>new api.THREE.Vector3(...p).project(camera));
  assert.ok(framePoints.every(p=>Math.abs(p.x)<1&&Math.abs(p.y)<1&&p.z<1),'booth is clipped');
  ktv.setActive(false);home.endFeatureFocus();home.setActive(false);
}
const video={name:'clip.webm',type:'video/webm',src:'data:video/webm;base64,AA==',size:2048};
const record={id:'ktv-playlist',video,updatedAt:'2026-11-01T12:00:00Z'};
assert.equal(api.validKtv(record).video.src,video.src);assert.equal(api.validKtv(record).video.name,'clip.webm');
assert.throws(()=>api.validKtv({...record,id:'cinema-playlist'}));
for(const patch of [{video:{...video,type:'text/plain'}},{video:{...video,src:'https://remote/clip.webm'}},{video:{...video,src:'data:video/webm;base64,'}},{video:{...video,name:''}}])assert.throws(()=>api.validKtv({...record,...patch}));
const legacy={id:'ktv-playlist',photos:[{id:'p',src:'data:image/jpeg;base64,AA=='}],sampleIds:[],music:null,updatedAt:'2026-11-01T12:00:00Z'};
assert.equal(api.validKtv(legacy).video,null,'legacy photo/music playlists still import as an empty video room');
const backup={format:'little-us-backup',version:5,memories:[],journeys:[],albums:[],cinema:null,ktv:record};
assert.deepEqual(api.validFullBackup(backup).ktv,api.validKtv(record));
assert.deepEqual(api.validFullBackup({...backup,version:6}).ktv,api.validKtv(record));
assert.equal(api.validFullBackup({...backup,version:4}).ktv,undefined);assert.throws(()=>api.validFullBackup({...backup,ktv:{...record,id:'cinema-playlist'}}));
console.log('PASS: subpixel matching of all four guitar corners at five viewport sizes; 505 finite reveal poses; unclipped booth; one-video validation, legacy playlist migration and v4/v5/v6 backup compatibility.');
const chordsSource=await fs.readFile(new URL('../src/ktv-chords.js',import.meta.url),'utf8');const {createGuitarStrummer}=await import('data:text/javascript;base64,'+Buffer.from(chordsSource).toString('base64'));
let notes=0,filters=[];class Context{constructor(){this.sampleRate=22050;this.currentTime=0;this.destination={};}resume(){return Promise.resolve();}suspend(){return Promise.resolve();}createBuffer(_,length){const samples=new Float32Array(length);return {getChannelData:()=>samples};}createBiquadFilter(){const filter={frequency:{value:0},Q:{value:0},connect(){return this;}};filters.push(filter);return filter;}createGain(){return {gain:{setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){return this;},disconnect(){}};}createBufferSource(){return {connect(){return this;},disconnect(){},start(){notes++;},stop(){}};}}
const instrument=createGuitarStrummer(Context);assert.deepEqual(Array.from({length:5},()=>instrument.strum()),['C','Am','F','G','C']);await Promise.resolve();assert.equal(notes,30);instrument.stop();assert.equal(instrument.strum(true),'Am');assert.equal(notes,30);
assert.equal(filters.length,1);assert.equal(filters[0].type,'lowpass');assert.equal(filters[0].frequency.value,1750);
console.log('PASS: clear left-wall stage, one standing microphone, five down-tilted wall spots, rear-wall console, widened/right-shifted sofa and centred set-top box; one-video validation; four softened chord voices and mute.');
