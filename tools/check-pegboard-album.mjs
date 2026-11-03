import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url),encode=text=>'data:text/javascript;base64,'+Buffer.from(text).toString('base64');
const THREE=await import(encode(await fs.readFile(new URL('dist/assets/three.module.js',root),'utf8')));
const fold=await import(encode(await fs.readFile(new URL('src/album-fold.js',root),'utf8')));
const source=(await fs.readFile(new URL('src/pegboard-album.js',root),'utf8')).replace(/^import .*;\s*$/gm,'').replace(/^export /gm,'');
const api=new Function('THREE','fold','renderAlbumPage','albumCoverOptions','PHOTO_WALL_ART','PHOTO_WALL_SLOTS','Image',
 'const {'+Object.keys(fold).join(',')+'}=fold;\n'+source+'\nreturn {createPegboardAlbum,pegboardShape,SHELF_ALBUM_WIDTH,SHELF_ALBUM_HEIGHT};')(
 THREE,fold,async()=>({canvas:{}}),()=>({}),'',Array.from({length:6},()=>({x:0,y:0,w:400,h:400,angle:0})),class{decode(){return Promise.resolve();}});
const shape=api.pegboardShape();assert.equal(shape.holes.length,143);
for(const hole of shape.holes){for(const point of hole.getPoints()){assert.ok(Math.abs(point.x)<1.3&&Math.abs(point.y)<1.05);}}
const wall=api.createPegboardAlbum({texture:()=>new THREE.Texture(),onChange(){}});
assert.ok(Math.abs(api.SHELF_ALBUM_WIDTH/api.SHELF_ALBUM_HEIGHT-4.3/6.22)<1e-12);
const shelf=wall.group.getObjectByName('Projecting oak journal shelf');
wall.group.updateMatrixWorld(true);const shelfBox=new THREE.Box3().setFromObject(shelf),bookBox=new THREE.Box3().setFromObject(wall.book),positions=wall.face.geometry.attributes.position;
assert.ok(shelfBox.max.z>.35,'small shelf still projects out of the board');
assert.ok(shelfBox.min.x>0&&shelfBox.max.x<1.3&&shelfBox.min.y>0,'shelf stays inside the upper-right board area');
assert.ok(bookBox.min.x>0&&bookBox.min.y>0&&bookBox.max.y<1.05,'journal stays in the upper-right board area');
assert.ok(bookBox.getSize(new THREE.Vector3()).x<.45&&bookBox.getSize(new THREE.Vector3()).y<.65,'journal has been reduced');
let low=Infinity;for(let i=0;i<positions.count;i++){const point=new THREE.Vector3().fromBufferAttribute(positions,i).applyMatrix4(wall.face.matrixWorld);low=Math.min(low,point.y);}
const shelfTop=shelfBox.max.y;assert.ok(low>=shelfTop-.001&&low<shelfTop+.01,'journal must rest on the wooden shelf');
// Match its projected cover to the reader at desktop and phone dimensions.
wall.face.geometry.computeBoundingBox();
for(const [w,h,target] of [[1470,779,{left:605,top:206,width:267.6,height:392}],[390,844,{left:90,top:320,width:210,height:304}]]){
 const center=wall.face.localToWorld(wall.face.geometry.boundingBox.getCenter(new THREE.Vector3()));
 const normal=new THREE.Vector3().fromBufferAttribute(wall.face.geometry.attributes.normal,0).transformDirection(wall.face.matrixWorld),up=new THREE.Vector3(0,1,0).applyQuaternion(wall.face.getWorldQuaternion(new THREE.Quaternion()));
 const camera=new THREE.PerspectiveCamera(38,w/h,.5,180),distance=api.SHELF_ALBUM_HEIGHT*wall.face.getWorldScale(new THREE.Vector3()).y*h/(2*Math.tan(38*Math.PI/360)*target.height);
 camera.up.copy(up);camera.position.copy(center).addScaledVector(normal,distance);camera.setViewOffset(w,h,w/2-target.left-target.width/2,h/2-target.top-target.height/2,w,h);camera.lookAt(center);camera.updateMatrixWorld(true);
 let left=Infinity,right=-Infinity,top=Infinity,bottom=-Infinity;
 for(let i=0;i<positions.count;i++){const point=new THREE.Vector3().fromBufferAttribute(positions,i).applyMatrix4(wall.face.matrixWorld).project(camera),x=(point.x+1)*w/2,y=(1-point.y)*h/2;left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
 assert.ok(Math.abs((left+right)/2-target.left-target.width/2)<1);assert.ok(Math.abs((top+bottom)/2-target.top-target.height/2)<1);
 assert.ok(Math.abs(bottom-top-target.height)<3);assert.ok(Math.abs((right-left)/(bottom-top)-4.3/6.22)<.003,JSON.stringify({w,h,left,right,top,bottom,ratio:(right-left)/(bottom-top)}));
}
await Promise.resolve();console.log('PASS: 143 real peg holes, smaller upper-right projecting shelf and grounded journal, shared cover proportions and subpixel centered desktop/mobile handoff.');
