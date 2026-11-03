import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const source=(await fs.readFile(new URL('../src/room-details.js',import.meta.url),'utf8')).replace("from 'three'",`from '${new URL('../dist/assets/three.module.js',import.meta.url)}'`);
const {createDaisyHead,guitarStringPath,createGuitarStrings}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const daisy=createDaisyHead(),white=daisy.getObjectByName('Separated chamomile petals'),core=daisy.getObjectByName('Chamomile yellow dome'),vertices=white.geometry.attributes.position;
for(let i=0;i<vertices.count;i++){
  const x=vertices.getX(i),y=vertices.getY(i),z=vertices.getZ(i);
  const ellipsoid=(x/core.scale.x)**2+((y-core.position.y)/core.scale.y)**2+(z/core.scale.z)**2;
  assert.ok(ellipsoid>1.1,'white petals intersect the yellow dome');
  const sector=Math.floor(i/55),angle=Math.atan2(x,z)-sector*Math.PI/4,wrapped=Math.atan2(Math.sin(angle),Math.cos(angle));
  assert.ok(Math.abs(wrapped)<Math.PI/8-.08,'neighboring petals overlap');
}
const strings=createGuitarStrings();assert.equal(strings.children.length,6);
for(let i=0;i<6;i++){
  const path=guitarStringPath(-.047+i*.019);
  for(let j=0;j<=1000;j++){
    const p=path.getPoint(j/1000),front=p.z-.0038;
    if(p.y<=1.035)assert.ok(front>.238,'string sinks into soundboard, bridge or rosette');
    if(p.y>=1.145&&p.y<=1.88)assert.ok(front>.1745,'string sinks into a fret');
    if(p.y>=1.88)assert.ok(front>.15,'string sinks into the headstock');
  }
  for(let j=1;j<path.curves.length;j++)assert.ok(path.curves[j-1].v2.distanceTo(path.curves[j].v1)<1e-12,'string path has a gap');
}
console.log('PASS: separated chamomile petals/dome and 6006 continuous string samples clear the guitar surfaces.');
