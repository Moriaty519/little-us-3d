import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const source=name=>fs.readFile(new URL('../src/'+name,import.meta.url),'utf8');
const encode=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
const {layoutTravelLabels}=await import(encode(await source('travel-labels.js')));
const {CHINA_CITIES}=await import(encode(await source('cities.js')));
const dataURL=encode(await source('china-map-data.js'));
const {chinaMapLayout}=await import(encode((await source('china-map.js')).replace("'./china-map-data.js'",`'${dataURL}'`)));
const map=chinaMapLayout(1024,720);
const overlap=(a,b,pad=0)=>a.x<b.x+b.width+pad&&a.x+a.width>b.x-pad&&a.y<b.y+b.height+pad&&a.y+a.height>b.y-pad;
function verify(items,options){
  const result=layoutTravelLabels(items,options),{bounds,obstacles=[]}=options;
  assert.deepEqual(result,layoutTravelLabels([...items].reverse(),options),'record order must not change label layout');
  const ids=new Set();
  for(const p of result){
    assert.ok(!ids.has(p.id));ids.add(p.id);
    assert.ok(p.x>=bounds.x&&p.y>=bounds.y&&p.x+p.width<=bounds.x+bounds.width&&p.y+p.height<=bounds.y+bounds.height,'name must fit the visible map');
    assert.ok(!obstacles.some(o=>overlap(p,o,4)),'labels must stay clear of cards and controls');
    assert.ok(!items.some(i=>i.x>=bounds.x&&i.x<=bounds.x+bounds.width&&i.y>=bounds.y&&i.y<=bounds.y+bounds.height&&!obstacles.some(o=>i.x>=o.x&&i.x<=o.x+o.width&&i.y>=o.y&&i.y<=o.y+o.height)&&overlap(p,{x:i.x-4,y:i.y-4,width:8,height:8})),'labels must not cover real pin locations');
    const original=items.find(i=>i.id===p.id);
    assert.ok(Math.abs(Math.hypot(p.start.x-original.x,p.start.y-original.y)-4)<1e-7,'leader starts at its own pin');
    assert.ok(p.end.x>=p.x&&p.end.x<=p.x+p.width&&p.end.y>=p.y&&p.end.y<=p.y+p.height,'leader ends at its name');
  }
  for(let i=0;i<result.length;i++)for(let j=i+1;j<result.length;j++)assert.ok(!overlap(result[i],result[j],3.99),'visible names must have a readable gap');
  return result;
}
let views=0;
for(const [w,h] of [[1280,720],[900,680],[700,844],[390,844],[320,568]]){
  const mobile=w<=700,paperW=mobile?w-44:(w-392)*.76,paperH=paperW*720/1024;
  const cx=mobile?w/2:(w-392)/2,cy=mobile?220:360;
  for(const zoom of [.65,1,1.15,1.6,2.5]){
    const items=CHINA_CITIES.map(c=>{const [px,py]=map.project([c.lon,c.lat]);return {id:c.id,x:cx+(px/1024-.5)*paperW*zoom,y:cy+(py/720-.5)*paperH*zoom,width:Math.min(140,c.name.length*11+16),height:mobile?21:25,count:1,priority:c.name==='上海市'?1:0};});
    const left=Math.max(12,cx-paperW*zoom/2+5),top=Math.max(12,cy-paperH*zoom/2+5);
    const bounds={x:left,y:top,width:Math.max(0,Math.min(w-12,cx+paperW*zoom/2-5)-left),height:Math.max(0,Math.min(h-12,cy+paperH*zoom/2-5)-top)};
    const obstacles=[{x:mobile?14:w-376,y:mobile?450:99,width:mobile?w-28:348,height:300},{x:cx-73,y:h-73,width:146,height:50}];
    verify(items,{bounds,obstacles,maxOffset:mobile?24:44});views++;
  }
}
// Every dense region city can be brought to the front without moving its pin.
const cluster=CHINA_CITIES.filter(c=>['江苏省','浙江省','上海市'].includes(c.province)).map(c=>{const [x,y]=map.project([c.lon,c.lat]);return {id:c.id,x,y,width:38,height:25,count:1};});
const bounds={x:0,y:0,width:1024,height:720};
for(const city of cluster){const result=verify(cluster.map(c=>({...c,priority:c.id===city.id?3:0})),{bounds,maxOffset:44});assert.ok(result.some(p=>p.id===city.id),'selected dense city should be readable');views++;}
const base=verify(cluster,{bounds,maxOffset:44});
const enlarged=verify(cluster.map(c=>({...c,x:750+(c.x-750)*2.5,y:430+(c.y-430)*2.5})),{bounds:{x:0,y:0,width:1500,height:1000},maxOffset:44});
assert.ok(enlarged.length>base.length,'zoom should reveal more names in a dense region');
const one={id:'focus',x:100,y:100,width:40,height:25,priority:3,count:1,preferred:{x:120,y:120}};
assert.deepEqual(layoutTravelLabels([one],{bounds})[0].x,120,'hovered and focused names should stay under the pointer');
assert.equal(layoutTravelLabels([{...one,x:NaN}],{bounds}).length,0);
assert.equal(layoutTravelLabels([one],{bounds:{x:0,y:0,width:20,height:20}}).length,0);
console.log(`PASS: ${views} real-city dense/zoom/responsive/selection layouts; names do not overlap each other, pins or UI; deterministic placement, connected leaders, focused stability and zoom reveals more names (${base.length} → ${enlarged.length}).`);
