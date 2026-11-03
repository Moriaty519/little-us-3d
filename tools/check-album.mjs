// Data safety, backup compatibility, text continuation and crop geometry.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const root=new URL('../src/',import.meta.url),source=async name=>(await fs.readFile(new URL(name,root),'utf8')).replace(/^import .*;\s*$/gm,'');
const parts=await Promise.all(['storage.js','cities.js','album-storage.js','travel-storage.js','album-pages.js','album-fold.js'].map(source));
const api=await import('data:text/javascript;base64,'+Buffer.from(parts.join('\n')).toString('base64'));
const record={id:'album-test',date:'2026-11-01',title:'一页故事',note:'第一段文字\n第二段文字',template:'daily',photos:[{src:'data:image/jpeg;base64,/9j/',crop:{x:.5,y:.4,zoom:1.5}}],createdAt:'2026-11-01T00:00:00.000Z',updatedAt:'2026-11-01T00:00:00.000Z'};
assert.deepEqual(api.validAlbums([record]),[record]);
for(const patch of [{id:''},{date:'2026-02-30'},{template:'__proto__'},{template:'bad'},{title:'x'.repeat(61)},{note:'x'.repeat(4001)},{photos:Array(25).fill(record.photos[0])},{photos:[{src:'data:image/svg+xml;base64,PHN2Zz4=',crop:record.photos[0].crop}]},{photos:[{...record.photos[0],crop:{x:2,y:.5,zoom:1}}]},{photos:[{...record.photos[0],crop:{x:.5,y:.5,zoom:0}}]}])assert.throws(()=>api.validAlbums([{...record,...patch}]));
assert.throws(()=>api.validAlbums([record,record]));
const v3={format:'little-us-backup',version:3,memories:[],journeys:[],albums:[record]};assert.deepEqual(api.validFullBackup(v3),{memories:[],journeys:[],albums:[record]});
for(const version of [1,2])assert.deepEqual(api.validFullBackup({format:'little-us-backup',version,memories:[],journeys:[]}).albums,[]);
const later={...record,updatedAt:'2026-11-01T01:00:00.000Z'};assert.deepEqual(api.mergeRecords([later],[record]),[later]);
const photos=Array.from({length:7},()=>record.photos[0]);
const pages=api.albumPaginate([{...record,photos,note:''}],t=>t.length*20);assert.equal(pages.length,3);assert.deepEqual(pages.map(p=>p.photos.length),[3,3,1]);assert.deepEqual(pages.map(p=>p.photoStart),[0,3,6]);
const long='一起走过的日子'.repeat(100);const continued=api.albumPaginate([{...record,note:long,photos:[]}],t=>t.length*20);assert.ok(continued.length>1);assert.equal(continued.flatMap(p=>p.lines).join(''),long);
const ordered=api.albumPaginate([{...record,id:'late',date:'2026-12-01'},record],t=>t.length*20);assert.equal(ordered[0].record.id,record.id);
const coverOptions=api.albumCoverOptions([{record:{...record,sample:true},photos:[{src:'sample'}]},{record:{...record,date:'2024-01-01'},photos:[record.photos[0]]},{record,photos:[]}]);assert.equal(coverOptions.years,'2024 — 2026');assert.deepEqual(coverOptions.coverPhoto,record.photos[0]);
for(const [iw,ih,w,h] of [[800,600,600,400],[600,800,600,400],[800,600,300,500]])for(const zoom of [1,3])for(const x of [0,.5,1]){
 const crop=api.albumCropRect(iw,ih,w,h,{x,y:x,zoom});assert.ok(crop.x>=0&&crop.y>=0&&crop.x+crop.width<=iw+.00001&&crop.y+crop.height<=ih+.00001);assert.ok(Math.abs(crop.width/crop.height-w/h)<.00001);
}
for(const template of Object.keys(api.ALBUM_TEMPLATES)){
 const slots=api.albumPhotoSlots(template);assert.equal(slots.length,api.ALBUM_TEMPLATES[template].capacity);
 for(let i=0;i<slots.length;i++){const [x,y,w,h]=slots[i];assert.ok(x>=0&&x+w<=860&&y>=0&&y+h<=622);assert.ok(x+w<=409||x>=451,template+' frame crosses fold');assert.ok(api.albumSlotAspect(template,i)>0);}
}
const rest=api.albumFoldColumns(0);assert.equal(rest.length,65);assert.ok(rest[32][1]<rest[0][1]&&rest[32][1]<rest[64][1]);
for(const p of [0,.1,.35,.5,.75,1]){const points=api.albumFoldColumns(p);for(let i=1;i<points.length;i++){assert.ok(points[i].every(Number.isFinite));assert.ok(Math.abs(Math.hypot(points[i][0]-points[i-1][0],points[i][1]-points[i-1][1])-8.6/64)<1e-9);}}
assert.deepEqual(api.ALBUM_TEMPLATE_CHOICES,['large','anniversary','letter','daily']);
assert.equal(api.ALBUM_TEMPLATES.daily.name,'日常拼接');
for(const template of ['travel','film'])assert.equal(api.validAlbums([{...record,template}])[0].template,template);
for(const p of [0,.1,.35,.5,.75,.9,1]){
 const points=api.albumTurnColumns(p);assert.deepEqual(points[0],[0,.14]);
 for(let i=1;i<points.length;i++){
  assert.ok(points[i].every(Number.isFinite));
  assert.ok(Math.abs(Math.hypot(points[i][0]-points[i-1][0],points[i][1]-points[i-1][1])-4.3/32)<1e-9);
  assert.ok(Math.abs(points[i][0])<=4.3&&points[i][1]>=.13&&points[i][1]<=4.44);
 }
}
const right=api.albumTurnColumns(0),left=api.albumTurnColumns(1);
for(let i=0;i<=32;i++){assert.ok(Math.abs(right[i][0]-rest[32+i][0])<1e-9);assert.ok(Math.abs(left[i][0]-rest[32-i][0])<1e-9);assert.ok(Math.abs(left[i][1]-rest[32-i][1])<1e-9);}
assert.equal(api.albumTurnUV(0),.5);assert.equal(api.albumTurnUV(1),1);assert.equal(api.albumTurnUV(0,true),.5);assert.equal(api.albumTurnUV(1,true),0);
// The closed half-page is centered; opening restores the shared spine.
assert.equal(api.albumBookPose(0).hingeX+api.ALBUM_FOLD_WIDTH/4,0);
assert.deepEqual(api.albumBookPose(1),{hingeX:0,shadowScale:1});
assert.deepEqual(api.albumBookPose(-1),api.albumBookPose(0));
assert.deepEqual(api.albumBookPose(2),api.albumBookPose(1));
for(const p of [0,.25,.5,.75,1]){const pose=api.albumBookPose(p);assert.ok(pose.hingeX>=-2.15&&pose.hingeX<=0);assert.ok(pose.shadowScale>=.56&&pose.shadowScale<=1);}
assert.equal(api.albumDragProgress(-10,100),0);assert.equal(api.albumDragProgress(35,100),.35);assert.equal(api.albumDragProgress(200,100),1);
assert.ok(api.albumFoldLayout(-2).x<0&&api.albumFoldLayout(2).x>0);assert.equal(api.albumFoldLayout(0).scale,1);
assert.deepEqual(api.albumFoldWindow(1000,2000,3,0),[997,998,999,1000,1001,1002,1003]);
assert.equal(api.albumFoldWindow(1000,2000,3,999).length,8);assert.deepEqual(api.albumFoldWindow(0,1),[0]);
// Month jumps preserve direction and endpoints without loading an unbounded album.
for(const [from,to] of [[0,0],[0,1],[1,0],[0,4],[4,0],[1,4],[4,1],[0,2000],[2000,0],[1,2000],[2000,1]]){
 const path=api.albumJumpPath(from,to);assert.equal(path[0],from);assert.equal(path.at(-1),to);assert.ok(path.length<=8);assert.equal(new Set(path).size,path.length);
 for(let i=1;i<path.length;i++){assert.equal(Math.sign(path[i]-path[i-1]),Math.sign(to-from));assert.ok(Number.isInteger(path[i]));}
 if(from===0&&to>1)assert.equal(path[1],1);if(to===0&&from>1)assert.equal(path.at(-2),1);
}
assert.deepEqual(api.albumJumpPath(1,4),[1,2,3,4]);assert.deepEqual(api.albumJumpPath(4,1),[4,3,2,1]);
for(const count of [1,2,4,7]){
 assert.ok(api.albumJumpTiming(count).duration<=1100);
 for(let i=0;i<count;i++){assert.equal(api.albumJumpProgress(0,i,count),0);assert.equal(api.albumJumpProgress(1,i,count),1);let before=0;for(let t=0;t<=100;t++){const p=api.albumJumpProgress(t/100,i,count);assert.ok(p>=before&&p<=1);before=p;}}
 if(count>1)assert.ok(Array.from({length:count},(_,i)=>api.albumJumpProgress(.5,i,count)).filter(p=>p>0&&p<1).length>1);
}
const punct='一起走过的日子，总想好好留下来。';const wrapped=api.albumWrap(punct,120,20,t=>t.length*20);assert.equal(wrapped.join(''),punct);assert.ok(wrapped.every(line=>!/[，。！？]/.test(line[0])));
console.log('PASS: album validation, legacy/v3 backups, newer merge, chronology, multi-photo/text pagination, bounded crop geometry, crease-safe frames and bound turning-leaf geometry, upright front/back mapping, four public templates, legacy layouts, bounded page loading and overlapping directional month jumps.');
