import { ALBUM_TEMPLATES } from './album-storage.js';

const PAGE_W=860,PAGE_H=622,RES=1.5;
const albumImageCache=new Map();
const albumArtCache=new Map();
const albumFont=(size,serif=true)=>`${size}px ${serif?'"Songti SC","Noto Serif SC",serif':'"PingFang SC",system-ui,sans-serif'}`;
export function albumWrap(text,width,size,measure){
  const result=[];
  for(const paragraph of text.split('\n')){
    if(!paragraph){result.push('');continue;}
    let current='';for(const char of Array.from(paragraph)){
      if(current&&measure(current+char,size)>width){
        const letters=Array.from(current);
        if(/[，。！？：；、）》」』”’…]/.test(char)&&letters.length>1){const last=letters.pop();result.push(letters.join(''));current=last+char;}
        else{result.push(current);current=char;}
      }else current+=char;
    }result.push(current);
  }
  return result;
}
export function albumPaginate(records,measure=(text,size)=>Array.from(text).length*size*.85){
  const pages=[];
  const ordered=[...records].sort((a,b)=>a.date.localeCompare(b.date)||a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id));
  for(const record of ordered){
    const spec=ALBUM_TEMPLATES[record.template],lines=record.note?albumWrap(record.note,spec.noteWidth,spec.noteSize,measure):[];
    const count=Math.max(1,Math.ceil(record.photos.length/spec.capacity),Math.ceil(lines.length/spec.noteLines));
    for(let part=0;part<count;part++)pages.push({key:record.id+':'+part,record,part,parts:count,photoStart:part*spec.capacity,photos:record.photos.slice(part*spec.capacity,(part+1)*spec.capacity),lines:lines.slice(part*spec.noteLines,(part+1)*spec.noteLines)});
  }
  return pages;
}
let albumMeasureContext;
export function albumMeasure(text,size){const c=albumMeasureContext||(albumMeasureContext=document.createElement('canvas').getContext('2d'));c.font=albumFont(size);return c.measureText(text).width;}
export function albumCropRect(imageWidth,imageHeight,width,height,crop={x:.5,y:.5,zoom:1}){
  const scale=Math.max(width/imageWidth,height/imageHeight)*crop.zoom,sourceWidth=width/scale,sourceHeight=height/scale;
  return {x:(imageWidth-sourceWidth)*crop.x,y:(imageHeight-sourceHeight)*crop.y,width:sourceWidth,height:sourceHeight};
}
export function albumCoverOptions(pages){
  const years=[...new Set(pages.filter(page=>page.record&&!page.record.sample).map(page=>+page.record.date.slice(0,4)))];
  return {years:years.length?[Math.min(...years),Math.max(...years)].filter((year,i,list)=>!i||year!==list[0]).join(' — '):'',
    coverPhoto:(pages.find(page=>!page.record?.sample&&page.photos?.length)||pages.find(page=>page.photos?.length))?.photos?.[0]};
}
function albumImage(src){
  if(albumImageCache.has(src))return albumImageCache.get(src);
  const task=new Promise(resolve=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>resolve(null);im.src=src;});albumImageCache.set(src,task);
  if(albumImageCache.size>40)albumImageCache.delete(albumImageCache.keys().next().value);return task;
}
function albumArt(kind){
  if(albumArtCache.has(kind))return albumArtCache.get(kind);
  const c=document.createElement('canvas');c.width=800;c.height=600;const ctx=c.getContext('2d');
  function box(x,y,w,h,col){ctx.fillStyle=col;ctx.fillRect(x,y,w,h);}
  function shape(points,col){ctx.fillStyle=col;ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fill();}
  function circle(x,y,r,col){ctx.fillStyle=col;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();}
  box(0,0,800,600,kind==='home'?'#e6dac2':kind==='flowers'?'#e5ddd0':'#bed0cf');circle(638,116,45,'#f5e6b5');
  if(['hills','lake','snow'].includes(kind)){
    shape([[0,423],[183,186],[410,342],[606,202],[800,405],[800,600],[0,600]],'#96aa93');
    if(kind==='snow'){shape([[90,310],[183,186],[300,276],[255,290],[194,250],[151,275]],'#e9efea');shape([[518,281],[606,202],[724,326],[654,304],[609,271]],'#e6eee7');}
    shape([[0,510],[220,390],[492,481],[800,359],[800,600],[0,600]],'#799780');
    if(kind==='lake'){box(0,482,800,118,'#a6c4c5');for(let i=0;i<5;i++)box(270+i*13,511+i*16,300-i*14,2,'#e0e8d8');}
    else shape([[252,600],[452,436],[472,431],[414,600]],'#d9c9a2');
  }else if(kind==='home'){
    box(0,399,800,201,'#c4b48b');box(80,80,268,275,'#fff4df');box(94,94,240,247,'#cad6c0');box(207,90,12,258,'#fff4df');box(91,208,247,12,'#fff4df');
    box(61,367,470,170,'#a6b192');box(82,314,419,105,'#e7ead3');
    ctx.fillStyle='#b7a076';ctx.beginPath();ctx.ellipse(518,466,168,48,0,0,7);ctx.fill();box(384,465,12,135,'#b7a076');box(642,465,12,135,'#b7a076');box(525,435,66,36,'#fff5df');
    box(668,298,54,117,'#a2a17e');box(691,192,5,113,'#859775');circle(672,199,35,'#c49b8b');circle(712,176,35,'#c49b8b');circle(735,228,34,'#c49b8b');
  }else if(kind==='street'){
    box(0,452,800,148,'#d2c29e');['#c7b18c','#dfccab','#a8b597'].forEach((col,i)=>{const x=40+i*245;box(x,125,204,333,col);box(x+24,190,58,148,'#ecedda');box(x+127,190,57,148,'#ecedda');box(x+60,363,93,95,'#7c917e');});
    circle(90,218,71,'#a6b895');circle(715,190,64,'#a6b895');box(89,250,5,223,'#7d916f');box(715,220,5,253,'#7d916f');
  }else{
    box(0,428,800,172,'#d5c5aa');shape([[341,396],[471,396],[447,558],[362,558]],'#9aac93');
    [[263,180,'#c79889'],[438,125,'#e1cc8b'],[527,242,'#bea7b2'],[337,275,'#d5a497']].forEach(([x,y,col])=>{ctx.strokeStyle='#7d976f';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(409,411);ctx.lineTo(x,y);ctx.stroke();for(let i=0;i<5;i++)circle(x+Math.cos(i*1.256)*36,y+Math.sin(i*1.256)*36,33,col);circle(x,y,17,'#d1b16c');});
  }
  const src=c.toDataURL('image/png');albumArtCache.set(kind,src);return src;
}
export function albumSampleRecords(){
  return [
    ['daily','2025-03-16','把普通的一天，过成喜欢的样子。','听了一下午的歌，也没有做什么大事。\n但和你在一起的日子，总想好好留下来。',['home','flowers','street']],
    ['letter','2025-07-02','写给今天，也写给以后的我们。','今天想记录的，是一点小小的开心。\n\n一起听过的歌，吃过的晚饭，走过的那条街。\n\n等到以后翻到这一页，希望还能记起当时的心情。',['flowers']],
    ['anniversary','2025-08-18','和你，又走过了一季。','想把和你在一起的日子，慢慢写成一本书。',['lake','home']],
    ['large','2025-09-12','这一刻，不用很多话。','把喜欢的风景，和喜欢的人，放在一起。',['snow']]
  ].map(([template,date,title,note,arts])=>({id:'album-sample-'+template,sample:true,date,title,note,template,photos:arts.map(kind=>({src:albumArt(kind),crop:{x:.5,y:.5,zoom:1}})),createdAt:date+'T00:00:00.000Z',updatedAt:date+'T00:00:00.000Z'}));
}
// Frames stay on one side of the crease; editor crop uses these same dimensions.
export function albumPhotoSlots(template){
  const slots={
    daily:[[45,218,338,262,true],[486,107,277,224,true],[555,365,235,223,true]],
    travel:[[24,73,381,523,false],[467,434,346,117,false]],
    anniversary:[[67,223,300,278,true],[493,214,290,287,true]],
    film:Array.from({length:6},(_,i)=>[43+Math.floor(i/3)*434,166+(i%3)*137,338,123,false]),
    letter:[[491,218,299,304,true]],large:[[456,73,380,523,false]]
  };
  return slots[template]||[];
}
export function albumSlotAspect(template,index){const slot=albumPhotoSlots(template)[index%ALBUM_TEMPLATES[template].capacity];if(!slot)return 1;const [, ,w,h,polaroid]=slot;if(template==='film')return (w-16)/(h-31);return (w-(polaroid?24:0))/(h-(polaroid?66:0));}
export async function renderAlbumPage(page,{cover=false,pageNumber=1,years='',coverPhoto=null,placeholder=false}={}){
  const canvas=document.createElement('canvas');canvas.width=PAGE_W*RES;canvas.height=PAGE_H*RES;const ctx=canvas.getContext('2d');ctx.scale(RES,RES);
  const hits=[];const r=page?.record,template=cover?'cover':r.template,photos=page?.photos||[];
  const imgs=await Promise.all(photos.map(p=>albumImage(p.src))),defaults=await Promise.all(['home','flowers','street','hills','lake','snow'].map(k=>albumImage(albumArt(k))));
  function box(x,y,w,h,col,radius=0,stroke=null){ctx.fillStyle=col;ctx.beginPath();ctx.roundRect(x,y,w,h,radius);ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.stroke();}}
  function text(t,x,y,size=18,col='#4e5947',serif=true,align='left'){ctx.font=albumFont(size,serif);ctx.fillStyle=col;ctx.textAlign=align;ctx.textBaseline='top';ctx.fillText(t,x,y);}
  function lines(content,x,y,size,gap,col='#69745f'){content.forEach((s,i)=>text(s,x,y+i*gap,size,col));}
  function title(x,y,width,size=32,col='#4e5947',height=112){
    const value=r?.title||(r?.date?.replaceAll('-','.')+'的一页')||'';let fontSize=size,wrapped=albumWrap(value,width,fontSize,albumMeasure);
    while(fontSize>14&&wrapped.length*(fontSize+5)>height){fontSize--;wrapped=albumWrap(value,width,fontSize,albumMeasure);}
    lines(wrapped,x,y,fontSize,fontSize+5,col);
  }
  function tape(x,y,w=100,col='#d6c58f',angle=-.07){ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.globalAlpha=.85;box(0,0,w,26,col);ctx.globalAlpha=.5;for(let j=9;j<w;j+=13){ctx.strokeStyle='#fff1cd';ctx.beginPath();ctx.moveTo(j,3);ctx.lineTo(j+4,23);ctx.stroke();}ctx.restore();}
  function photoSlot(index,rect,{polaroid=false,angle=0,kind='hills',caption=''}={}){
    const [x,y,w,h]=rect;ctx.save();ctx.translate(x+w/2,y+h/2);ctx.rotate(angle);
    if(polaroid){ctx.shadowColor='rgba(71,57,33,.13)';ctx.shadowBlur=13;ctx.shadowOffsetY=5;box(-w/2,-h/2,w,h,'#fffef7',2,'#e6dfd0');ctx.shadowColor='transparent';}
    const padding=polaroid?12:0,footer=polaroid?42:0,dx=-w/2+padding,dy=-h/2+padding,dw=w-padding*2,dh=h-padding*2-footer;
    const image=imgs[index]||defaults[['home','flowers','street','hills','lake','snow'].indexOf(kind)]||defaults[3],crop=photos[index]?.crop||{x:.5,y:.5,zoom:1};
    if(!imgs[index]&&!r?.sample&&!placeholder){box(dx,dy,dw,dh,'#f0edde');}
    else{const source=albumCropRect(image.naturalWidth,image.naturalHeight,dw,dh,crop);ctx.save();ctx.beginPath();ctx.rect(dx,dy,dw,dh);ctx.clip();ctx.drawImage(image,source.x,source.y,source.width,source.height,dx,dy,dw,dh);ctx.restore();}
    if(caption)text(caption,0,h/2-31,14,'#78856e',true,'center');ctx.restore();
    if(photos[index])hits.push({rect:[x,y,w,h],index:page.photoStart+index});
  }
  function slot(i,options={}){const [x,y,w,h,polaroid]=albumPhotoSlots(template)[i];photoSlot(i,[x,y,w,h],{polaroid,...options});}
  if(template==='cover')box(430,0,430,622,'#7fa3c3',[0,21,21,0]);else box(0,0,860,622,template==='anniversary'?'#fff6ec':'#fffaf0',21);
  if(template!=='cover'){
    text(r.date.replaceAll('-','.'),46,34,13,'#9d9c8d',false);text(pageNumber.toString().padStart(2,'0'),815,591,12,'#a6a393',false,'right');
  }
  if(template==='cover'){
    box(430,0,10,622,'#eee8d9');box(441,0,2,622,'#a9c6dd');box(447,0,1,622,'#8fb0cb');text('little us.',491,91,43,'#fff9e9');text('相册',494,149,19,'#f3ead8');text(years,494,570,14,'#f3ead8',false);
    const cp=(coverPhoto?await albumImage(coverPhoto.src):null)||defaults[3];
    box(491,216,304,322,'#fffdf2',3);const crop=albumCropRect(cp.naturalWidth,cp.naturalHeight,280,270,coverPhoto?.crop);ctx.drawImage(cp,crop.x,crop.y,crop.width,crop.height,503,228,280,270);
  }else if(template==='daily'){
    title(44,88,340,30,'#535e4c',108);
    slot(0,{kind:'home'});slot(1,{kind:'flowers'});slot(2,{kind:'street'});tape(154,207,84,'#d9ceb4',0);tape(584,96,75,'#a9c6dd',0);lines(page.lines,47,512,19,24);
  }else if(template==='travel'){
    slot(0,{kind:'hills'});title(466,90,349,30,'#535e4c',105);lines(page.lines,467,205,20,25);slot(1,{kind:'lake'});
  }else if(template==='anniversary'){
    title(48,90,340,32,'#655c50',116);
    slot(0,{kind:'lake'});slot(1,{kind:'home'});tape(168,212,84,'#dfcbb4',0);tape(599,203,79,'#b7d0e2',0);
    lines(page.lines.slice(0,2),47,539,23,28,'#8d7968');lines(page.lines.slice(2),477,539,23,28,'#8d7968');
  }else if(template==='film'){
    title(44,85,342,29,'#535e4c',73);const frames=albumPhotoSlots(template);for(let i=0;i<6;i++){const [x,y,w,h]=frames[i];box(x,y,w,h,'#5c664f',2);photoSlot(i,[x+8,y+8,w-16,h-31],{kind:['street','home','flowers','hills','lake','snow'][i]});text(String(page.photoStart+i+1).padStart(2,'0'),x+10,y+h-17,10,'#e4e7d4',false);}
    lines(page.lines.slice(0,1),45,580,18,22);lines(page.lines.slice(1),479,580,18,22);
  }else if(template==='letter'){
    title(44,88,341,29,'#535e4c',106);for(let y=228;y<584;y+=29){ctx.strokeStyle='#eae4d6';ctx.beginPath();ctx.moveTo(45,y);ctx.lineTo(390,y);ctx.stroke();}lines(page.lines,47,201,21,29);slot(0,{kind:'flowers'});tape(599,207,80,'#b7d0e2',0);
  }else if(template==='large'){
    slot(0,{kind:'snow'});title(49,148,338,34,'#535e4c',147);lines(page.lines,49,339,22,29);
  }
  if(template!=='cover'){const crease=ctx.createLinearGradient(409,0,451,0);crease.addColorStop(0,'rgba(76,69,47,0)');crease.addColorStop(.43,'rgba(76,69,47,.06)');crease.addColorStop(.5,'rgba(76,69,47,.11)');crease.addColorStop(.57,'rgba(255,254,244,.55)');crease.addColorStop(1,'rgba(255,254,244,0)');box(409,1,42,620,crease);}
  return {canvas,hits};
}
