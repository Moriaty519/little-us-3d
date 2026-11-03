import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import * as THREE from '../dist/assets/three.module.js';
const source=(await fs.readFile(new URL('../src/pop-up.js',import.meta.url),'utf8')).replace("import * as THREE from 'three';",`import * as THREE from '${new URL('../dist/assets/three.module.js',import.meta.url)}';`);
const {createPopUp,popUpPose}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const {openingFrame,roomFrame}=await import('data:text/javascript;base64,'+Buffer.from(await fs.readFile(new URL('../src/room-frame.js',import.meta.url),'utf8')).toString('base64'));
const scene=new THREE.Scene(),room=new THREE.Group();scene.add(room);
const make=(x,y,z)=>{const node=new THREE.Mesh(new THREE.BoxGeometry(.2,2,.2),new THREE.MeshBasicMaterial());node.position.set(x,y,z);room.add(node);return node;};
const left=make(-4.5,2,0),back=make(0,2,-3.5),floor=make(0,.1,0),furniture=Array.from({length:9},(_,i)=>make(i*.3,.23,i*.2));
left.geometry=new THREE.BoxGeometry(.16,4.3,7.06);left.position.y=2.35;
back.geometry=new THREE.BoxGeometry(9.05,4.3,.16);back.position.y=2.35;
floor.geometry=new THREE.BoxGeometry(9.35,.45,7.35);floor.position.y=-.015;
furniture[0].rotation.y=Math.PI/2;furniture[2].scale.set(.8,1.1,.7);scene.updateMatrixWorld(true);
const nodes=[left,back,floor,...furniture],originals=nodes.map(n=>n.matrixWorld.toArray());
const originalLeftVertices=left.geometry.attributes.position.array.slice();
const popup=createPopUp({scene,room,leftWall:[left],backWall:[back],furniture,floor:[floor],texture:()=>new THREE.Texture()});
const unchanged=()=>{scene.updateMatrixWorld(true);nodes.forEach((node,i)=>node.matrixWorld.toArray().forEach((v,j)=>assert.ok(Math.abs(v-originals[i][j])<1e-10,'the final live room must preserve its original transform')));assert.deepEqual(left.geometry.attributes.position.array,originalLeftVertices,'wall vertices must restore exactly');};
unchanged();popup.enable(true);popup.reset();assert.equal(room.visible,false);
for(let i=0;i<=15;i++){
  popup.draw(i/100);scene.updateMatrixWorld(true);
  const leftBox=new THREE.Box3().setFromObject(left),backBox=new THREE.Box3().setFromObject(back);
  assert.ok(leftBox.min.y>.235,'the folded left wall must clear the floorboards');
  assert.ok(backBox.min.y-leftBox.max.y>.02,'folded walls must occupy separate layers');
  const top=new THREE.Box3().setFromObject(scene.getObjectByName('Envelope lower crease'));
  const rightCover=new THREE.Box3().setFromObject(scene.getObjectByName('Envelope right crease'));
  assert.ok(top.min.y-rightCover.max.y>.01,'the visible upper triangle must clear the covers while it begins to lift');
}
popup.draw(.12);assert.ok(Math.abs(scene.getObjectByName('Envelope lower crease').rotation.x)>.1,'visible upper triangle must open first');
assert.equal(Math.abs(scene.getObjectByName('Envelope top crease').rotation.x),0,'opposite triangle must remain closed initially');
assert.equal(Math.abs(scene.getObjectByName('Envelope right crease').rotation.z),0,'side cover must remain closed initially');
// Test the inner wall bodies; the final corner joint intentionally overlaps.
function orientedBox(node,localBox){
  const center=localBox.getCenter(new THREE.Vector3()).applyMatrix4(node.matrixWorld),size=localBox.getSize(new THREE.Vector3()).multiplyScalar(.5),axes=[0,1,2].map(i=>new THREE.Vector3().setFromMatrixColumn(node.matrixWorld,i));
  const half=axes.map((axis,i)=>size.getComponent(i)*axis.length());axes.forEach(axis=>axis.normalize());return {center,axes,half};
}
function intersects(a,b){
  const delta=b.center.clone().sub(a.center),directions=[...a.axes,...b.axes];
  for(const x of a.axes)for(const y of b.axes)directions.push(new THREE.Vector3().crossVectors(x,y));
  for(const axis of directions){if(axis.lengthSq()<1e-12)continue;axis.normalize();
    const radius=box=>box.axes.reduce((sum,basis,i)=>sum+box.half[i]*Math.abs(basis.dot(axis)),0);
    if(Math.abs(delta.dot(axis))>radius(a)+radius(b)+1e-9)return false;
  }return true;
}
left.geometry.computeBoundingBox();back.geometry.computeBoundingBox();
const backBody=back.geometry.boundingBox.clone();backBody.min.x=-4.25;
for(let i=0;i<=400;i++){
  const p=i/400,pose=popup.draw(p);scene.updateMatrixWorld(true);
  for(const [key,value] of Object.entries(pose))if(typeof value==='number')assert.ok(value>=0&&value<=1,key);
  assert.ok(!(pose.leftWall>0&&pose.leftWall<1&&pose.backWall>0&&pose.backWall<1),'the two walls must not rise together');
  if(pose.leftWall>0)assert.equal(pose.backWall,1,'rear wall must finish before the left wall starts');
  if(pose.furniture>0)assert.equal(pose.leftWall,1,'furniture must wait until both walls stand');
  assert.equal(left.parent.position.z,0,'the left wall hinge must never translate along the wall');
  assert.equal(intersects(orientedBox(left,left.geometry.boundingBox),orientedBox(back,backBody)),false,`wall bodies intersect at progress ${p}`);
  for(let j=0;j<originalLeftVertices.length;j+=3)if(originalLeftVertices[j+2]>=-3.05)assert.equal(left.geometry.attributes.position.array[j+2],originalLeftVertices[j+2],'the visible wall body must not slide');
}
unchanged();
popup.draw(.73);const leftHinge=left.parent,anchor=leftHinge.getWorldPosition(new THREE.Vector3());assert.equal(anchor.x,-4.5);assert.equal(anchor.z,0);assert.ok(anchor.y>=.23);assert.ok(Math.abs(leftHinge.rotation.z)>0,'walls must rotate around a floor crease');
popup.exit(.74);popup.enable(false);unchanged();
for(const p of [.33,.56,.74]){popup.enable(true);popup.reset();popup.draw(p);popup.enable(false);unchanged();}
for(const p of [-10,0,1,10])assert.deepEqual(popUpPose(p),popUpPose(Math.max(0,Math.min(1,p))));
assert.equal(popUpPose(1).walls,1);assert.equal(popUpPose(1).furniture,1);
let views=0;
for(const [w,h] of [[1280,720],[556,673],[390,844],[844,390]]){
  popup.enable(true);popup.reset();
  const camera=new THREE.PerspectiveCamera(38,w/h,.1,180);
  for(let i=0;i<=100;i++){
    const p=i/100,pose=popUpPose(p),frame=openingFrame(w,h,pose.camera,0,{mobile:w<=700,spread:Math.max(pose.front,pose.back)});popup.draw(p);scene.updateMatrixWorld(true);
    const target=new THREE.Vector3(0,frame.targetY,0);camera.position.fromArray(frame.direction).normalize().multiplyScalar(frame.distance).add(target);camera.lookAt(target);camera.updateMatrixWorld();
    scene.traverse(node=>{
      if(!node.isMesh||(node.parent===room&&!room.visible))return;
      const positions=node.geometry.attributes.position;
      for(let j=0;j<positions.count;j++){
        const point=new THREE.Vector3().fromBufferAttribute(positions,j).applyMatrix4(node.matrixWorld).project(camera);
        assert.ok(Math.abs(point.x)<1&&Math.abs(point.y)<1,`opening geometry clipped at ${w}x${h}, progress ${p}: ${node.parent.name||node.name} (${point.x},${point.y})`);
      }
    });views++;
    if(i===0){
      const a=new THREE.Vector3(-5.3,0,-4.25).project(camera),b=new THREE.Vector3(5.3,0,-4.25).project(camera),c=new THREE.Vector3(-5.3,0,4.25).project(camera);
      assert.ok(Math.abs(a.y-b.y)<1e-10&&Math.abs(a.x-c.x)<1e-6,'closed envelope must be straight');
      assert.ok(Math.abs(a.x+b.x)<1e-10&&Math.abs(a.y+c.y)<1e-6,'closed envelope must be centered');
    }
  }
  const final=openingFrame(w,h,1,1,{mobile:w<=700}),normal=roomFrame(w,h,{mobile:w<=700});
  assert.equal(final.distance,normal.distance);assert.equal(final.offsetY,normal.offsetY);assert.equal(final.targetY,2.1);
}
console.log(`PASS: sequential walls, 401 collision-free wall poses, hinged clearance, original transforms, replay and ${views} uncropped opening views; centered envelope and continuous home framing.`);
