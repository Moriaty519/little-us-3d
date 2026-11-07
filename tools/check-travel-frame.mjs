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
const roundedURL=encode((await read('dist/assets/RoundedBoxGeometry.js')).replace("'three'",`'${threeURL}'`));
const decorURL=encode((await read('src/wall-decor.js')).replace("'three'",`'${threeURL}'`).replace("'./assets/RoundedBoxGeometry.js'",`'${roundedURL}'`).replace("'./china-map.js'",`'${mapURL}'`).replace("'./wall-layout.js'",`'${layoutURL}'`));
globalThis.document={createElement:()=>({width:512,height:512,getContext:()=>new Proxy({},{get:()=>()=>{}})})};
const {createChinaMapModel}=await import(decorURL);
const {matchedSurfaceFrame}=await import(encode(await read('src/feature-frame.js')));
const MAP_SCALE=L.view.scale,MAP_WIDTH=L.map.width*MAP_SCALE,MAP_HEIGHT=L.map.height*MAP_SCALE,MAP_CENTER_Y=2.08;
const model=createChinaMapModel();
const root=new THREE.Group();root.position.set(0,MAP_CENTER_Y,0);root.scale.setScalar(MAP_SCALE);root.add(model.group);root.updateMatrixWorld(true);
const homeMap=createChinaMapModel();homeMap.group.position.set(-4.355,2.82,1.05);homeMap.group.rotation.y=Math.PI/2;homeMap.group.updateMatrixWorld(true);
function wallViewHeight(w,h){const aspect=w/h,safeHeight=Math.max(220,h-170);return Math.max(MAP_HEIGHT*1.28,MAP_WIDTH/aspect*1.08,MAP_HEIGHT*h/safeHeight);}
function focusViewHeight(w,h){return Math.max(1.55,1.05/(w/h));}
function pageCamera(w,h){
  const camera=new THREE.OrthographicCamera(-1,1,1,-1,.1,200);camera.up.set(0,1,0);
  const viewHeight=wallViewHeight(w,h),aspect=w/h;camera.top=viewHeight/2;camera.bottom=-camera.top;camera.right=camera.top*aspect;camera.left=-camera.right;
  camera.position.set(0,MAP_CENTER_Y,22);camera.lookAt(0,MAP_CENTER_Y,0);camera.updateProjectionMatrix();camera.updateMatrixWorld(true);return camera;
}
function px(point,camera,w,h){const p=point.clone().project(camera);return {x:(p.x+1)*w/2,y:(1-p.y)*h/2};}
function faceCorners(world){
  const {faceWidth:fw,faceHeight:fh}=L.map;
  return [[-fw/2,-fh/2],[fw/2,-fh/2],[-fw/2,fh/2],[fw/2,fh/2]].map(([x,y])=>world.face.localToWorld(new THREE.Vector3(x,y,0)));
}
function frameBounds(mesh,camera,w,h){
  const positions=mesh.geometry.attributes.position,points=[];
  for(let i=0;i<positions.count;i++)points.push(px(mesh.localToWorld(new THREE.Vector3().fromBufferAttribute(positions,i)),camera,w,h));
  return [Math.min(...points.map(p=>p.x)),Math.max(...points.map(p=>p.x)),Math.min(...points.map(p=>p.y)),Math.max(...points.map(p=>p.y))];
}
let handoffs=0,focusViews=0;
for(const [w,h] of [[1280,720],[1440,900],[1024,768],[390,844],[844,390]]){
  const camera=pageCamera(w,h),corners=faceCorners({face:model.face}).map(p=>px(p,camera,w,h));
  const left=Math.min(...corners.map(p=>p.x)),right=Math.max(...corners.map(p=>p.x)),top=Math.min(...corners.map(p=>p.y)),bottom=Math.max(...corners.map(p=>p.y));
  assert.ok(left>=12&&right<=w-12,`wall map clipped at ${w}x${h}`);
  assert.ok(top>=72&&bottom<=h-72,`wall map must leave room for topbar/footer at ${w}x${h}`);
  assert.ok(Math.abs((left+right)/2-w/2)<1e-8,'wall map must be horizontally centered');
  assert.ok(Math.abs((top+bottom)/2-h/2)<1e-8,'wall map must be vertically centered');
  assert.ok(right-left>MAP_WIDTH*.5&&bottom-top>MAP_HEIGHT*.5,'wall map must remain prominent');
  // Home's framed map hands off to this upright map with the same fov=2 lens.
  const bounds={left,top,width:right-left,height:bottom-top};
  const f=matchedSurfaceFrame({surfaceHeight:L.map.faceHeight,fov:2,width:w,height:h,bounds});
  const homeCamera=new THREE.PerspectiveCamera(2,w/h,.5,180);
  const homeCenter=homeMap.face.getWorldPosition(new THREE.Vector3()),homeNormal=new THREE.Vector3(0,0,1).transformDirection(homeMap.face.matrixWorld);
  homeCamera.position.copy(homeCenter).addScaledVector(homeNormal,f.distance);homeCamera.up.set(0,1,0);homeCamera.lookAt(homeCenter);homeCamera.setViewOffset(w,h,f.offsetX,f.offsetY,w,h);homeCamera.updateMatrixWorld(true);
  const homeCorners=faceCorners({face:homeMap.face}).map(p=>px(p,homeCamera,w,h));
  homeCorners.forEach((p,i)=>{assert.ok(Math.abs(p.x-corners[i].x)<1e-7&&Math.abs(p.y-corners[i].y)<1e-7,`map face handoff differs at ${w}x${h}`);});
  const from=frameBounds(homeMap.face,homeCamera,w,h),to=frameBounds(model.face,camera,w,h);
  from.forEach((value,i)=>assert.ok(Math.abs(value-to[i])<1,'map paper handoff must stay within one pixel'));
  // The Qingdao focus camera must frame the point before the island scene takes over.
  root.rotation.x=-Math.PI/2;root.updateMatrixWorld(true);
  const q=model.point(120.355173,36.082982,.025),world=model.group.localToWorld(q.clone());
  const viewHeight=focusViewHeight(w,h),aspect=w/h;
  const focusCamera=new THREE.OrthographicCamera(-viewHeight*aspect/2,viewHeight*aspect/2,viewHeight/2,-viewHeight/2,.1,200);focusCamera.up.set(0,1,0);
  const target=world.clone().add(new THREE.Vector3(0,0,0)),position=target.clone().add(new THREE.Vector3(0,Math.sin(.42),Math.cos(.42)).multiplyScalar(20));
  focusCamera.position.copy(position);focusCamera.lookAt(target);focusCamera.updateProjectionMatrix();focusCamera.updateMatrixWorld(true);
  const qp=px(world,focusCamera,w,h);
  assert.ok(qp.x>w*.2&&qp.x<w*.8&&qp.y>h*.2&&qp.y<h*.9,`Qingdao focus is off-centre at ${w}x${h}: ${qp.x},${qp.y}`);
  // The flat-map handoff patch must stay inside the focus view.
  const clusterRadius=.18;
  for(const [dx,dy] of [[-1,0],[1,0],[0,-1],[0,1]]){
    const p=px(world.clone().add(new THREE.Vector3(dx*clusterRadius,0,dy*clusterRadius)),focusCamera,w,h);
    if(!(p.x>0&&p.x<w&&p.y>0&&p.y<h))console.log('clip',w,h,dx,dy,p.x,p.y);
    assert.ok(p.x>0&&p.x<w&&p.y>0&&p.y<h,`diorama patch clipped at ${w}x${h}`);
  }
  focusViews++;handoffs++;
  root.rotation.x=0;root.updateMatrixWorld(true);
}
console.log(`PASS: ${handoffs} upright framed-map handoffs with the home wall (frame within 1px), centered wall presentation, and ${focusViews} uncropped Qingdao map-focus framings on desktop/mobile/landscape.`);
