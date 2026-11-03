import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const root=new URL('../src/',import.meta.url),source=async name=>(await fs.readFile(new URL(name,root),'utf8')).replace(/^import .*;\s*$/gm,'');
const parts=await Promise.all(['storage.js','cities.js','album-storage.js','cinema-storage.js','travel-storage.js','cinema-frame.js','cinema-sort.js'].map(source));
const api=await import('data:text/javascript;base64,'+Buffer.from(parts.join('\n')).toString('base64'));
const record={id:'cinema-playlist',photos:[{id:'photo-1',src:'data:image/jpeg;base64,/9j/'}],music:{name:'music.mp3',type:'audio/mpeg',src:'data:audio/mpeg;base64,SUQz'},sampleIds:[],updatedAt:'2026-11-01T00:00:00.000Z'};
assert.deepEqual(api.validCinema(record),record);assert.equal(api.validCinema(null),null);
for(const patch of [{id:'wrong'},{photos:[record.photos[0],record.photos[0]]},{photos:[{id:'x',src:'https://remote/photo.jpg'}]},{photos:Array.from({length:61},(_,i)=>({...record.photos[0],id:String(i)}))},{sampleIds:[0,0]},{sampleIds:[6]},{music:{...record.music,type:'text/html'}},{music:{...record.music,src:'https://remote/music.mp3'}},{updatedAt:'bad'}])assert.throws(()=>api.validCinema({...record,...patch}));
const v4={format:'little-us-backup',version:4,memories:[],journeys:[],albums:[],cinema:record};assert.deepEqual(api.validFullBackup(v4).cinema,record);
assert.throws(()=>api.validFullBackup({...v4,cinema:undefined}));
const later={...record,photos:[],music:null,sampleIds:[],updatedAt:'2026-11-01T01:00:00.000Z'};
assert.equal(api.mergeCinema(record,later),later);assert.equal(api.mergeCinema(later,record),later);assert.equal(api.mergeCinema(later,null),later);
for(const [iw,ih,w,h] of [[1600,900,1600,900],[900,1600,1600,900],[800,600,1600,900]]){const r=api.cinemaContain(iw,ih,w,h);assert.ok(r.x>=0&&r.y>=0&&r.width<=w&&r.height<=h);assert.ok(Math.abs(r.width/r.height-iw/ih)<1e-10,'photo was stretched');}
for(const direction of [-1,1]){const first=api.cinemaFilmOffsets(0,1600,direction),last=api.cinemaFilmOffsets(1,1600,direction);assert.ok(first.previous===0);assert.ok(last.next===0);for(let i=0;i<=100;i++){const p=api.cinemaFilmOffsets(i/100,1600,direction);assert.ok(Math.abs(Math.abs(p.next-p.previous)-1600)<1e-8,'film frames have gap or overlap');}}
const order=[{id:'a'},{id:'b'},{id:'c'},{id:'d'}];
assert.deepEqual(api.swapCinemaPhotos(order,0,3).map(p=>p.id),['d','b','c','a']);
assert.deepEqual(api.swapCinemaPhotos(order,3,0).map(p=>p.id),['d','b','c','a']);
assert.deepEqual(order.map(p=>p.id),['a','b','c','d']);
for(let from=0;from<order.length;from++)for(let to=0;to<order.length;to++){const next=api.swapCinemaPhotos(order,from,to);assert.equal(next[to],order[from]);assert.equal(next[from],order[to]);for(let i=0;i<order.length;i++)if(i!==from&&i!==to)assert.equal(next[i],order[i],'other photo positions changed');assert.deepEqual(new Set(next),new Set(order));}
const THREE=await import('data:text/javascript;base64,'+Buffer.from(await fs.readFile(new URL('../dist/assets/three.module.js',import.meta.url),'utf8')).toString('base64'));
for(const target of [[-.75,2.64,-3.232],[-1.13,2.64,-3.232],[-1.46,2.64,-3.232]])for(const [w,h] of [[1280,720],[1440,900],[556,673],[390,844],[320,740],[844,390]]){
  const f=api.cinemaViewport(w,h,target),camera=new THREE.PerspectiveCamera(f.fov,f.aspect,.12,45);
  assert.deepEqual(f.position,api.cinemaViewport(1280,720,target).position,'resizing changes the viewing direction');
  assert.equal(f.position[0],f.target[0],'screen is viewed from the side');
  assert.equal(f.position[1],f.target[1],'screen is viewed at a vertical angle');
  assert.ok(f.position[2]>f.target[2]);assert.ok(f.offsetY>0&&f.offsetY<=24);
  camera.position.fromArray(f.position);camera.lookAt(...f.target);camera.setViewOffset(w,h,0,f.offsetY,w,h);camera.updateMatrixWorld();
  const centre=new THREE.Vector3(...f.target).project(camera);
  assert.ok(Math.abs(centre.x)<1e-10&&Math.abs(centre.y-2*f.offsetY/h)<1e-10,'screen is not centred horizontally and slightly raised');
  const corners=[];
  for(const x of [target[0]-1.64,target[0]+1.64])for(const y of [2.64-.845,2.64+.845]){
    const p=new THREE.Vector3(x,y,-3.232).project(camera);
    assert.ok(Math.abs(p.x)<.86&&Math.abs(p.y)<.72&&Math.abs(p.z)<1,'living-room screen clips or overlaps the controls');corners.push(p);
  }
  assert.ok(Math.abs(corners[0].x-corners[1].x)<1e-10&&Math.abs(corners[2].x-corners[3].x)<1e-10,'screen sides are slanted');
  assert.ok(Math.abs(corners[0].x+corners[3].x)<1e-10&&Math.abs(corners[0].y+corners[3].y-2*centre.y)<1e-10,'screen corners are asymmetric');
  for(const x of [target[0]-1.85,target[0]+1.85])for(const y of [2.64-1.06,2.64+1.06]){
    const p=new THREE.Vector3(x,y,-3.29).project(camera),py=(1-p.y)*h/2;
    assert.ok(Math.abs(p.x)<.87&&py>75&&py<h-105,'screen rails overlap the toolbar or playback controls');
  }
  if(w===1280&&h===720)assert.ok(corners[1].y-corners[0].y>1.1,'desktop screen was not enlarged');
}
console.log('PASS: v4/legacy cinema backups, safe photo/music data, latest playlist merge, full-aspect photos, horizontal film advance, pairwise photo swaps and centred front-facing living-room framing on desktop/mobile.');
