import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const encode=text=>'data:text/javascript;base64,'+Buffer.from(text).toString('base64');
const {roomFrame}=await import(encode(await fs.readFile(new URL('../src/room-frame.js',import.meta.url),'utf8')));
const THREE=await import(encode(await fs.readFile(new URL('../dist/assets/three.module.js',import.meta.url),'utf8')));
const target=new THREE.Vector3(0,2.1,0);let checked=0;
for(const [w,h,options] of [[1280,720,{}],[1440,900,{}],[390,844,{mobile:true}],[844,390,{}],[220,185,{compact:true}]]){
  const f=roomFrame(w,h,options),camera=new THREE.PerspectiveCamera(f.fov,f.aspect,.5,180);
  camera.setViewOffset(w,h,0,-f.offsetY,w,h);const projection=[...camera.projectionMatrix.elements];
  for(let a=-.25;a<=1.5;a+=.05)for(const polar of [.001,.35,.75,1.2])for(const zoom of [1,1/2.4]){
    camera.position.setFromSphericalCoords(f.distance*zoom,polar,a).add(target);camera.lookAt(target);camera.updateMatrixWorld();
    assert.deepEqual(camera.projectionMatrix.elements,projection,'rotation changes projection');
    assert.ok(Math.abs(camera.position.distanceTo(target)-f.distance*zoom)<1e-10,'rotation changes scale');
    for(const x of [-4.675,4.675])for(const y of [-.24,4.95])for(const z of [-3.675,3.675]){
      const p=new THREE.Vector3(x,y,z).project(camera);
      if(zoom===1)assert.ok(Math.abs(p.x)<1&&Math.abs(p.y)<1,'room clipped at default size');
      assert.ok(p.z>-1&&p.z<1,'near/far plane clips the room at allowed zoom');
    }checked++;
  }
}
const f=roomFrame(1280,720),camera=new THREE.PerspectiveCamera(f.fov,f.aspect,.1,180);
camera.position.setFromSphericalCoords(f.distance,1.2,0).add(target);camera.lookAt(target);camera.updateMatrixWorld();
const edge=z=>Math.abs(new THREE.Vector3(4.4,.3,z).project(camera).x-new THREE.Vector3(-4.4,.3,z).project(camera).x);
assert.ok(edge(3.5)>edge(-3.5)*1.1,'near room edge must project wider');
console.log(`PASS: ${checked} default/maximum-zoom orbit views; fixed framing, safe near/far depth and near edge wider.`);
