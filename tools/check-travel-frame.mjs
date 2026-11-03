import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const encode=text=>'data:text/javascript;base64,'+Buffer.from(text).toString('base64');
const read=name=>fs.readFile(new URL('../'+name,import.meta.url),'utf8');
const threeURL=encode(await read('dist/assets/three.module.js'));
const THREE=await import(threeURL);
const layoutURL=encode(await read('src/wall-layout.js'));
const {WALL_DECOR_LAYOUT:L}=await import(layoutURL);
const dataURL=encode(await read('src/china-map-data.js'));
const mapURL=encode((await read('src/china-map.js')).replace("'./china-map-data.js'",`'${dataURL}'`));
const {chinaMapLayout}=await import(mapURL);
const roundedURL=encode((await read('dist/assets/RoundedBoxGeometry.js')).replace("'three'",`'${threeURL}'`));
const decorURL=encode((await read('src/wall-decor.js')).replace("'three'",`'${threeURL}'`).replace("'./assets/RoundedBoxGeometry.js'",`'${roundedURL}'`).replace("'./china-map.js'",`'${mapURL}'`).replace("'./wall-layout.js'",`'${layoutURL}'`));
// Canvas drawing itself is checked in the browser; these tests inspect real geometry.
globalThis.document={createElement:()=>({getContext:()=>new Proxy({},{get:()=>()=>{}})})};
const {createChinaMapModel,createSageWallPanel,createWindowModel}=await import(decorURL);
const model=createChinaMapModel(),wall=createSageWallPanel(),windowModel=createWindowModel();
assert.equal(model.face.material.toneMapped,false,'paper must preserve its colors across lighting setups');
assert.ok(model.face.material.isMeshBasicMaterial,'printed map must not be relit independently on either page');
const glass=windowModel.getObjectByName('Clear glass');
assert.ok(glass.material.transparent&&glass.material.opacity<=.1&&!glass.material.depthWrite,'glass should be clear without hiding the background');
wall.updateMatrixWorld(true);
const ray=new THREE.Raycaster(new THREE.Vector3(L.window.x+.3,L.window.y+.3,2),new THREE.Vector3(0,0,-1));
assert.equal(ray.intersectObject(wall,true).length,0,'transparent window must have a real opening behind it');
ray.set(new THREE.Vector3(L.map.x,L.map.y,2),new THREE.Vector3(0,0,-1));
assert.ok(ray.intersectObject(wall,true).length,'solid wall must remain behind the map');
const projection=chinaMapLayout(1024,720);
for(const [lon,lat] of [[116.4053,39.9049],[87.617,43.7928],[121.47,31.23],[110.35,20.02]]){
  const p=model.point(lon,lat),[x,y]=projection.project([lon,lat]);
  assert.ok(Math.abs((p.x/L.map.faceWidth+.5)*1024-x)<1e-9);
  assert.ok(Math.abs((.5-p.y/L.map.faceHeight)*720-y)<1e-9,'pins must coincide with the shared printed geographic projection');
}
const assembly=new THREE.Group();assembly.rotation.x=-Math.PI/2;assembly.scale.setScalar(L.view.scale);
assembly.position.set(-L.map.x*L.view.scale,-(L.map.z+L.map.faceZ)*L.view.scale,L.map.y*L.view.scale);
model.group.position.set(L.map.x,L.map.y,L.map.z);assembly.add(model.group);
const solidWall=createSageWallPanel({windowOpening:false});assembly.add(solidWall);assembly.updateMatrixWorld(true);
const filledOpening=new THREE.Raycaster(new THREE.Vector3(L.window.x+.3,L.window.y+.3,2),new THREE.Vector3(0,0,-1));
solidWall.updateMatrixWorld(true);
// Inspect in local wall coordinates before applying the presentation transform.
const solidLocal=createSageWallPanel({windowOpening:false});solidLocal.updateMatrixWorld(true);
assert.ok(filledOpening.intersectObject(solidLocal,true).length,'map page wall must fill the former window opening');
const faceCenter=model.face.getWorldPosition(new THREE.Vector3());assert.ok(faceCenter.length()<1e-10);
const normal=new THREE.Vector3(0,0,1).transformDirection(model.face.matrixWorld);assert.ok(normal.distanceTo(new THREE.Vector3(0,1,0))<1e-10,'map must face the fixed overhead camera');
const {travelFrame,travelCardMaxHeight}=await import(encode((await read('src/travel-frame.js')).replace("'./wall-layout.js'",`'${layoutURL}'`)));
const mapCorners=[[-L.map.width/2,-L.map.height/2],[L.map.width/2,L.map.height/2]].map(([x,y])=>model.group.localToWorld(new THREE.Vector3(x,y,L.map.faceZ)));
const {matchedSurfaceFrame}=await import(encode(await read('src/feature-frame.js')));
const homeMap=createChinaMapModel();homeMap.group.position.set(-4.355,2.82,1.05);homeMap.group.rotation.y=Math.PI/2;homeMap.group.updateMatrixWorld(true);
let views=0;
function setup(w,h,fitWidth,area,mobile=false){
  const f=travelFrame(w,h,area,{fitWidth,mobile}),ca=new THREE.OrthographicCamera(-f.viewHeight*f.aspect/2,f.viewHeight*f.aspect/2,f.viewHeight/2,-f.viewHeight/2,.1,180);
  ca.up.set(0,0,-1);ca.position.set(f.targetX,30,0);ca.lookAt(f.targetX,0,0);ca.setViewOffset(w,h,-f.offsetX,-f.offsetY,w,h);ca.updateMatrixWorld();return ca;
}
function px(p,ca,w,h){p=p.clone().project(ca);return {x:(p.x+1)*w/2,y:(1-p.y)*h/2};}
function assertHandoff(ca,w,h){
  const {faceWidth:fw,faceHeight:fh}=L.map;
  const corners=[[-fw/2,-fh/2],[fw/2,fh/2]];
  const expected=corners.map(([x,y])=>px(model.face.localToWorld(new THREE.Vector3(x,y,0)),ca,w,h));
  const bounds={left:expected[0].x,top:expected[1].y,width:expected[1].x-expected[0].x,height:expected[0].y-expected[1].y};
  const f=matchedSurfaceFrame({surfaceHeight:fh,fov:2,width:w,height:h,bounds});
  const homeCamera=new THREE.PerspectiveCamera(2,w/h,.5,180),center=homeMap.face.getWorldPosition(new THREE.Vector3()),normal=new THREE.Vector3(0,0,1).transformDirection(homeMap.face.matrixWorld);
  homeCamera.position.copy(center).addScaledVector(normal,f.distance);homeCamera.up.set(0,1,0);homeCamera.lookAt(center);homeCamera.setViewOffset(w,h,f.offsetX,f.offsetY,w,h);homeCamera.updateMatrixWorld(true);
  corners.forEach(([x,y],i)=>{const actual=px(homeMap.face.localToWorld(new THREE.Vector3(x,y,0)),homeCamera,w,h);assert.ok(Math.abs(actual.x-expected[i].x)<1e-8&&Math.abs(actual.y-expected[i].y)<1e-8,'home and page map faces must occupy the same screen rectangle');});
  // Check the actual rounded frame's vertices, including its depth.
  function frameBounds(mesh,camera){const positions=mesh.geometry.attributes.position,points=[];for(let i=0;i<positions.count;i++)points.push(px(mesh.localToWorld(new THREE.Vector3().fromBufferAttribute(positions,i)),camera,w,h));return [Math.min(...points.map(p=>p.x)),Math.max(...points.map(p=>p.x)),Math.min(...points.map(p=>p.y)),Math.max(...points.map(p=>p.y))];}
  const from=frameBounds(homeMap.group.children[0],homeCamera),to=frameBounds(model.group.children[0],ca);from.forEach((value,i)=>assert.ok(Math.abs(value-to[i])<1,'wood frame handoff must remain within one pixel'));
}
for(const [w,h,fitWidth,top] of [[1280,720,888,99],[1440,900,1048,99],[1600,900,1175,105],[1000,720,680,99],[701,844,381,99]]){
  const area={top,bottom:top+travelCardMaxHeight(fitWidth)},ca=setup(w,h,fitWidth,area);
  const [a,b]=mapCorners.map(p=>px(p,ca,w,h));assertHandoff(ca,w,h);
  assert.ok(Math.abs(b.y-area.top)<1e-8&&Math.abs(a.y-area.bottom)<1e-8,'map frame must align with both card edges');
  assert.ok(a.x>=16&&b.x<fitWidth-16,'map frame must fit the left column');
  assert.ok(Math.abs((a.x+b.x)/2-fitWidth/2)<1e-8,'map must be centered in the left column');
  const old=setup(fitWidth,h,fitWidth,area);
  mapCorners.forEach(p=>{assert.ok(Math.abs(px(p,old,fitWidth,h).x-px(p,ca,w,h).x)<1e-8,'full-page canvas must preserve framing');});
  const orientation=ca.quaternion.clone();
  for(const zoom of [.65,1,1.2,1.6,2.5]){
    ca.zoom=zoom;ca.updateProjectionMatrix();
    assert.ok(ca.quaternion.equals(orientation),'zoom must preserve overhead orientation');
    const enlarged=mapCorners.map(p=>px(p,ca,w,h));
    assert.ok(Math.abs((enlarged[1].x-enlarged[0].x)/(b.x-a.x)-zoom)<1e-9);
    assert.ok(Math.abs((enlarged[0].y-enlarged[1].y)/(a.y-b.y)-zoom)<1e-9);
    if(zoom===2.5)assert.ok(enlarged[1].x>fitWidth,'enlarged map must extend underneath the UI');
    views++;
  }
}
for(const [w,h,top,bottom] of [[390,844,84,466],[390,844,84,245],[844,390,84,260]]){
  const ca=setup(w,h,w,{top,bottom},true),points=mapCorners.map(p=>px(p,ca,w,h));
  assertHandoff(ca,w,h);
  assert.ok(points[0].x>=16&&points[1].x<=w-16);
  assert.ok(points[1].y>=top-1e-8&&points[0].y<=bottom+1e-8,'mobile default map must fit above the card');views++;
}
console.log(`PASS: real clear-window opening, shared unlit map and city projection; solid map-page wall, left-column centering, card alignment, aligned home/page handoff (frame within 1 px), UI overlap and ${views} fixed overhead zoom/responsive views.`);
