import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url),encode=text=>'data:text/javascript;base64,'+Buffer.from(text).toString('base64');
const THREE=await import(encode(await fs.readFile(new URL('dist/assets/three.module.js',root),'utf8')));
const source=(await fs.readFile(new URL('src/album-isolation.js',root),'utf8')).replace(/^import .*;\s*$/gm,'').replace('export function','function');
const create=new Function('THREE',source+'\nreturn createAlbumIsolation;')(THREE);
const scene=new THREE.Scene(),book=new THREE.Group(),original=new THREE.MeshBasicMaterial({color:'#899c77'});
const front=new THREE.Mesh(new THREE.PlaneGeometry(1,1),original);front.castShadow=true;book.add(front);book.position.set(3,2,-3);scene.add(book);
const backgrounds=Array.from({length:100},()=>{const node=new THREE.Mesh(new THREE.PlaneGeometry(1,1),original);scene.add(node);return node;});backgrounds[0].visible=false;
const down=new THREE.LineSegments(new THREE.BufferGeometry(),new THREE.LineBasicMaterial());scene.add(down);
let current=null,captured=0,freed=0,fail=false,visibleCounts=[],targets=new Set();
const renderer={domElement:{width:800,height:600},autoClear:true,shadowMap:{},compile(){},clear(){},getRenderTarget:()=>current,setRenderTarget:target=>{current=target;if(target&&!targets.has(target)){targets.add(target);target.addEventListener('dispose',()=>freed++);}},clearDepth(){},render(renderScene){
 if(current){assert.equal(book.visible,false);assert.equal(backgrounds[1].visible,true);captured++;if(fail)throw new Error('capture failed');}
 else if(renderScene===scene)visibleCounts.push(backgrounds.filter(node=>node.visible).length);
}};
const camera=new THREE.PerspectiveCamera(),position=book.position.clone(),effect=create(scene,book,renderer);
assert.equal(front.material===original,false);assert.equal(backgrounds[1].material,original);assert.equal(effect.ready,false);
effect.background(0,camera);assert.equal(effect.ready,true);assert.equal(captured,1);assert.equal(current,null);assert.equal(book.visible,true);assert.ok(backgrounds.every(node=>!node.visible));
assert.equal(down.visible,false,'bird down must disappear with the room during the album transition');
effect.background(.5,camera);effect.transfer(0);effect.render(camera);assert.equal(front.material.opacity,1);assert.deepEqual(book.position,position);assert.equal(captured,1);assert.deepEqual(visibleCounts,[0]);assert.equal(renderer.autoClear,true);
effect.background(1,camera);effect.transfer(.5);assert.equal(front.material.opacity,.5);effect.transfer(1);assert.equal(front.visible,false);
effect.dispose();effect.dispose();assert.equal(freed,1);assert.equal(front.material,original);assert.equal(front.visible,true);assert.equal(front.castShadow,true);assert.equal(backgrounds[0].visible,false);assert.equal(backgrounds[1].visible,true);
assert.equal(down.visible,true,'returning home must restore the bird down');
fail=true;const broken=create(scene,book,renderer);assert.throws(()=>broken.background(0,camera),/capture failed/);assert.equal(current,null);assert.equal(book.visible,true);broken.dispose();assert.equal(front.material,original);assert.equal(freed,2);
console.log('PASS: one background capture, live stationary book, no background draw calls during fade, preserved shared materials, idempotent cleanup and safe capture failure.');
