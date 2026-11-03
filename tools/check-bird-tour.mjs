import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import * as THREE from '../dist/assets/three.module.js';
const encode=source=>'data:text/javascript;base64,'+Buffer.from(source).toString('base64');
const source=(await fs.readFile(new URL('../src/bird-tour-flight.js',import.meta.url),'utf8')).replace("from 'three'",`from '${new URL('../dist/assets/three.module.js',import.meta.url)}'`);
const {createBirdTourFlight}=await import(encode(source));
const {BIRD_TOUR_STOPS}=await import(encode(await fs.readFile(new URL('../src/bird-tour.js',import.meta.url),'utf8')));
assert.deepEqual(BIRD_TOUR_STOPS.map(s=>s.id),['bird','photos','guitar','map','screen']);
const room=new THREE.Group(),house=new THREE.Group(),bird=new THREE.Group();room.add(house);house.add(bird);
room.position.set(2,0,3);room.rotation.y=.2;house.position.set(3.65,1.36,2.6);house.rotation.y=-.18;bird.position.set(0,.251,.646);bird.rotation.y=.65;bird.scale.setScalar(.16);
const rest={position:bird.position.clone(),quaternion:bird.quaternion.clone(),scale:bird.scale.clone()};
const controls={enabled:true,enableDamping:true,update(){}};const camera=new THREE.PerspectiveCamera(38,1.5,.5,180);camera.position.set(12,9,14);camera.lookAt(0,2,0);camera.updateMatrixWorld();
const cameraRest=camera.matrixWorld.clone(),targets={home:{object:house}};
for(const [i,id] of BIRD_TOUR_STOPS.map(s=>s.id).entries())targets[id]={object:house,point:()=>new THREE.Vector3(i-2,2,-i*.4)};
let draws=0,arrivals=[];const flight=createBirdTourFlight({room,bird,camera,controls,targets,invalidate:()=>draws++});
assert.equal(flight.begin(),true);assert.equal(flight.begin(),false);assert.equal(bird.parent,room);assert.equal(controls.enabled,false);
for(const id of [...BIRD_TOUR_STOPS.map(s=>s.id),'home']){
 assert.equal(flight.fly(id,()=>arrivals.push(id)),true);assert.equal(flight.fly(id),false,'double flight must be ignored');
 flight.update(0);flight.update(50);const before=bird.position.clone();flight.pause();flight.update(100000);assert.ok(bird.position.equals(before),'hidden time must not advance the bird');
 const poses=[];for(let t=100050;t<104000&&flight.isFlying();t+=50){
  const previous=bird.position.clone();flight.update(t);const motion=bird.position.clone().sub(previous);poses.push(bird.position.clone());
  if(t>100250&&motion.length()>1e-5&&bird.parent===room&&flight.isFlying()){
   motion.y=0;motion.normalize();const forward=new THREE.Vector3(0,0,1).applyQuaternion(bird.quaternion);forward.y=0;forward.normalize();assert.ok(forward.dot(motion)>.98,'flying bird must face its travel direction');
  }
 }
 assert.equal(flight.isFlying(),false);assert.ok(poses.every(p=>p.toArray().every(Number.isFinite)));
 if(id!=='home')assert.ok(bird.position.distanceTo(targets[id].point())<1e-9);
 room.updateWorldMatrix(true,true);const forward=new THREE.Vector3(0,0,1).applyQuaternion(bird.getWorldQuaternion(new THREE.Quaternion()));forward.y=0;forward.normalize();const viewer=camera.getWorldPosition(new THREE.Vector3()).sub(bird.getWorldPosition(new THREE.Vector3()));viewer.y=0;viewer.normalize();assert.ok(forward.dot(viewer)>.999,'arrived bird must face the camera');
 assert.ok(camera.matrixWorld.equals(cameraRest),'tour must preserve the viewing camera');
}
assert.deepEqual(arrivals,['bird','photos','guitar','map','screen','home']);
flight.end();assert.equal(bird.parent,house);assert.ok(bird.position.equals(rest.position));assert.ok(bird.quaternion.equals(rest.quaternion));assert.ok(bird.scale.equals(rest.scale));assert.equal(controls.enabled,true);
flight.begin();flight.fly('map',()=>assert.fail('cancelled arrival fired'));flight.update(0);flight.update(100);flight.end();flight.update(10000);assert.ok(bird.position.equals(rest.position));assert.equal(flight.isActive(),false);
controls.enabled=false;flight.begin();flight.fly('screen',()=>arrivals.push('reduced'));flight.update(0,true);assert.equal(flight.isFlying(),false);assert.equal(arrivals.at(-1),'reduced');flight.end();assert.equal(controls.enabled,false,'restore previous control state');
assert.ok(draws>0);
console.log('PASS: exact five-stop order and return, visible-frame clock, duplicate prevention, travel-facing flight, camera-facing arrivals, camera preservation, cancelled callbacks, exact parent/pose restoration and reduced motion.');
