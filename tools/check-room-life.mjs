import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import * as THREE from '../dist/assets/three.module.js';
const moduleUrl=source=>'data:text/javascript;base64,'+Buffer.from(source).toString('base64');
const {roomBirdPose,createRoomLife}=await import(moduleUrl(await fs.readFile(new URL('../src/room-life.js',import.meta.url),'utf8')));
const birdSource=(await fs.readFile(new URL('../src/bird-character.js',import.meta.url),'utf8'))
  .replace("from 'three'",`from '${new URL('../dist/assets/three.module.js',import.meta.url)}'`);
const {createBirdCharacter}=await import(moduleUrl(birdSource));
const bird=createBirdCharacter().group,body=bird.getObjectByName('Soft egg-shaped body').geometry.attributes.position;
// Conservative solid bounds of the existing wooden roof, ridge, side walls and base.
const solids=[[-.238,.829,0,.625,.075,.99,.598],[.238,.829,0,.625,.075,.99,-.598],
  [0,.996,0,.053,.05,1.015,0],[-.425,.35,0,.06,.65,.75,0],[.425,.35,0,.06,.65,.75,0],[0,.025,0,1.02,.09,.91,0]]
  .map(([x,y,z,w,h,d,angle])=>({inverse:new THREE.Matrix4().compose(new THREE.Vector3(x,y,z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(0,0,angle)),new THREE.Vector3(1,1,1)).invert(),half:[w/2,h/2,d/2]}));
const matrix=new THREE.Matrix4(),point=new THREE.Vector3(),local=new THREE.Vector3();let samples=0;
for(let i=0;i<=560;i++){
  const seconds=i/20,pose=roomBirdPose(seconds);
  matrix.compose(new THREE.Vector3(...pose.position),new THREE.Quaternion().setFromEuler(new THREE.Euler(...pose.rotation)),new THREE.Vector3(...pose.scale));
  for(let j=0;j<body.count;j+=7){
    point.fromBufferAttribute(body,j).applyMatrix4(matrix);
    for(const {inverse,half} of solids){
      local.copy(point).applyMatrix4(inverse);
      assert.ok(!half.every((limit,k)=>Math.abs(local.getComponent(k))<limit-1e-5),`bird enters wooden solid at ${seconds}s`);
    }
    // The gabled front board includes a round entrance, but has no other holes.
    const top=.98-.30*Math.abs(point.x)/.425;
    if(Math.abs(point.x)<.425&&point.y>.07&&point.y<top&&point.z>.354&&point.z<.423){
      assert.ok(Math.hypot(point.x,point.y-.45)<.133,`bird enters house front at ${seconds}s`);
    }
    samples++;
  }
}
for(const boundary of [4.8,6,6.42,10.8,11.85,12.27,28]){
  const a=roomBirdPose(boundary-1e-6),b=roomBirdPose(boundary+1e-6);
  for(const key of ['position','scale','rotation'])a[key].forEach((v,i)=>assert.ok(Math.abs(v-b[key][i])<1e-4,'pose jumps at a phase boundary'));
}
bird.position.set(0,.251,.646);bird.rotation.y=.65;bird.scale.setScalar(.16);
const rest=bird.position.clone(),life=createRoomLife({bird});
life.update(0,true);for(let i=1;i<=120;i++)life.update(i*50,true);
const paused=bird.position.clone();life.update(7000,false);life.update(300000,false);
assert.ok(bird.position.equals(paused),'paused room moves');
life.update(300050,true);assert.ok(bird.position.equals(paused),'resume catches up hidden time');
life.reset();assert.ok(bird.position.equals(rest),'opening reset does not restore the original perch');
life.update(0,true);let movingFrames=0,cachedFrames=0;
for(let i=1;i<=840;i++){
  const seconds=i/30,before=[...bird.position.toArray(),...bird.rotation.toArray().slice(0,3),...bird.scale.toArray()];
  const result=life.update(seconds*1000,true);
  const after=[...bird.position.toArray(),...bird.rotation.toArray().slice(0,3),...bird.scale.toArray()];
  const changed=after.some((value,j)=>Math.abs(value-before[j])>1e-10);
  if(changed){assert.equal(result.shadow,true,'moving bird has a stale shadow frame');movingFrames++;}
  else {assert.equal(result.shadow,false,'still bird unnecessarily redraws shadows');cachedFrames++;}
  if(seconds<4.79||(seconds>6.5&&seconds<10.79)||seconds>12.35){
    assert.equal(changed,false,`bird moves outside hopping and landing at ${seconds}s`);
  }
}
assert.ok(movingFrames>70&&cachedFrames>700,'hopping should be brief with long still intervals');
const beforeCue=bird.position.clone();life.update(29000,true,false);life.update(300000,true,false);
life.update(300050,true);assert.ok(bird.position.equals(beforeCue),'tour cue resume advances hidden time');
console.log(`PASS: ${samples} real bird vertices clear wooden surfaces; ${movingFrames} moving frames refresh shadows immediately and ${cachedFrames} still frames reuse them. Transitions are continuous, pause does not catch up, and opening restores the original perch.`);
