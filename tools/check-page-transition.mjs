import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const source=await fs.readFile(new URL('../src/page-transition.js',import.meta.url),'utf8');
const {createPageTransition}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const classes=()=>({values:new Set(),add(...v){v.forEach(x=>this.values.add(x));},remove(...v){v.forEach(x=>this.values.delete(x));}});
const element=()=>({style:{setProperty(name,value){this[name]=value;},removeProperty(name){delete this[name];}},inert:false,hidden:false,classList:classes()});
let reduced=false,clock=0,nextFrame=0,frames=new Map();
globalThis.window={matchMedia:()=>({get matches(){return reduced;}})};
globalThis.document={body:{classList:classes(),dataset:{}}};
globalThis.requestAnimationFrame=fn=>{const id=++nextFrame;frames.set(id,fn);return id;};
globalThis.cancelAnimationFrame=id=>frames.delete(id);
const home=element(),map=element(),album=element();
let pose='original',restores=0,focuses=0,hides=0,fits=0,focusedUI=0,current=true;
const room={beginFeatureFocus(id){pose=id;focuses++;return true;},featureFocusProgress(p){assert.ok(p>=0&&p<=1);},endFeatureFocus(){pose='original';restores++;}};
const flow=createPageTransition({room,home,hideHome(){home.hidden=true;hides++;}});
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
async function tick(ms=100){clock+=ms;const pending=frames;frames=new Map();pending.forEach(fn=>fn(clock));for(let i=0;i<8;i++)await Promise.resolve();}
const start=(page=map,ready=Promise.resolve())=>flow.enter({entrance:page===map?'map':'photos',page,open(){page.hidden=false;return ready;},fit(){fits++;},focus(){focusedUI++;},isCurrent:()=>current});
const prepared=deferred(),first=start(map,prepared.promise);
assert.equal(home.inert,true);assert.equal(map.inert,true);assert.equal(map.style.opacity,'0');
await tick(0);await tick(820);
assert.equal(document.body.dataset.transitionPhase,'focus','destination must stay concealed while preparing');
assert.equal(hides,0);assert.equal(focusedUI,0);
prepared.resolve();await tick(0);await tick(0);
assert.equal(document.body.dataset.transitionPhase,'arrive');
flow.cancelIfStale();assert.equal(flow.isActive(),true,'duplicate history events for the same destination must not cancel');
await tick(0);await tick(170);
assert.ok(Number(map.style.opacity)>0&&Number(map.style.opacity)<1);
assert.ok(Number(map.style.transform.match(/[\d.]+/)[0])>1,'arrival must shrink toward the fixed final size');
await tick(510);assert.equal(await first,true);
assert.equal(home.hidden,true);assert.equal(home.inert,false);assert.equal(map.inert,false);assert.equal(pose,'original');
assert.equal(map.style.opacity,'');assert.equal(map.style.transform,'');assert.equal(flow.isActive(),false);assert.equal(hides,1);assert.equal(fits,1);assert.equal(focusedUI,1);
// Leaving while image preparation is still pending must release routing immediately.
home.hidden=false;const slow=deferred(),cancelled=start(map,slow.promise);await tick(0);flow.cancel();
assert.equal(await cancelled,false);assert.equal(map.hidden,true);assert.equal(home.inert,false);assert.equal(pose,'original');
const next=start(album);await tick(0);slow.resolve();await tick(100);
assert.equal(pose,'photos','stale page preparation must not restore or alter the new camera flight');
current=false;flow.cancelIfStale();assert.equal(await next,false);current=true;
assert.equal(flow.isActive(),false);assert.equal(album.hidden,true);
const failed=start(map,Promise.reject(new Error('image unavailable')));await tick(0);await tick(820);
await assert.rejects(failed,/image unavailable/);assert.equal(flow.isActive(),false);assert.equal(home.inert,false);
// Reduced motion opens immediately, without moving the room camera or scaling UI.
reduced=true;const before=focuses;assert.equal(await start(album),true);assert.equal(focuses,before);
assert.equal(album.style.transform,'');assert.equal(document.body.dataset.transitionPhase,undefined);
assert.equal(frames.size,0);assert.ok(restores>=5);
// The shelf book stays opaque while the room disappears; the matching cover
// replaces it only afterward, and controls arrive last without scaling the page.
reduced=false;home.hidden=false;
let backdrop=0,bookTransfer=0,matchedBounds=null;
room.featureFocusBounds=bounds=>matchedBounds=bounds;
room.albumIsolationProgress=p=>backdrop=p;
room.albumTransferProgress=p=>bookTransfer=p;
const shelf=flow.enter({entrance:'photos',page:album,open:()=>Promise.resolve(),arrivalBounds:()=>({left:600,top:200,width:260,height:390}),isCurrent:()=>current});
await tick(0);await tick(960);await tick(0);await tick(300);
assert.equal(document.body.dataset.transitionPhase,'isolate');assert.ok(backdrop>0&&backdrop<1);assert.equal(bookTransfer,0);
assert.equal(album.style['--album-book-opacity'],'0');assert.equal(album.style['--album-ui-opacity'],'0');assert.equal(matchedBounds.height,390);assert.equal(album.style.transform,'');
await tick(420);await tick(0);assert.equal(backdrop,1);assert.equal(bookTransfer,1);assert.equal(document.body.dataset.transitionPhase,'controls');
await tick(200);assert.equal(await shelf,true);assert.equal(document.body.classList.values.has('album-shelf-transition'),false);assert.equal(home.style['--album-room-opacity'],undefined);
home.hidden=false;const interrupted=flow.enter({entrance:'photos',page:album,open:()=>Promise.resolve(),arrivalBounds:()=>matchedBounds,isCurrent:()=>current});
await tick(0);await tick(960);await tick(0);await tick(300);flow.cancel();assert.equal(await interrupted,false);assert.equal(home.inert,false);assert.equal(album.hidden,true);assert.equal(pose,'original');assert.equal(document.body.classList.values.has('album-shelf-transition'),false);
// Map handoff uses the prepared map rectangle and never scales the whole page.
home.hidden=false;map.style.transform='';const mapRect={left:90,top:120,width:680,height:490};
const aligned=flow.enter({entrance:'map',page:map,open:()=>{map.hidden=false;return Promise.resolve();},arrivalBounds:()=>mapRect,isCurrent:()=>current});
await tick(0);assert.deepEqual(matchedBounds,mapRect);await tick(0);await tick(1080);await tick(0);await tick(140);await tick(0);await tick(200);
// The mapped handoff is atomic once matched: the page is visible without a
// whole-page scale, and the transition phase may already be cleaned up.
assert.equal(map.hidden,false);assert.equal(map.style.transform,'');assert.ok(map.style.opacity===''||Number(map.style.opacity)===1);
await tick(200);assert.equal(await aligned,true);assert.equal(map.style.transform,'');assert.equal(pose,'original');
home.hidden=false;const mapCancel=flow.enter({entrance:'map',page:map,open:()=>{map.hidden=false;return Promise.resolve();},arrivalBounds:()=>mapRect,isCurrent:()=>current});
await tick(0);await tick(0);await tick(600);flow.cancel();assert.equal(await mapCancel,false);assert.equal(map.hidden,true);assert.equal(map.inert,false);assert.equal(home.inert,false);assert.equal(map.style.transform,'');
// Cinema must not scale or dim the shared scene at handoff; controls arrive later.
home.hidden=false;const cinema=element();let cinemaProgress=0;
room.featureFocusProgress=p=>cinemaProgress=p;
const startCinema=(ready=Promise.resolve())=>flow.enter({entrance:'screen',page:cinema,open:()=>ready,isCurrent:()=>current});
const cinemaReady=deferred(),film=startCinema(cinemaReady.promise);
await tick(0);await tick(540);assert.equal(cinemaProgress,0,'first visit must prepare before the camera starts');
assert.equal(cinema.style['--cinema-ui-opacity'],'0');cinemaReady.resolve();await tick(0);await tick(0);await tick(540);assert.ok(Math.abs(cinemaProgress-.5)<1e-10);
await tick(540);assert.equal(cinemaProgress,1);await tick(0);await tick(200);
assert.equal(document.body.dataset.transitionPhase,'arrive');assert.equal(cinema.style.transform,'');
assert.equal(home.style.opacity,'','both matching scenes must not become transparent together');
assert.ok(Number(cinema.style.opacity)>Number(cinema.style['--cinema-ui-opacity']));
await tick(200);assert.equal(await film,true);assert.equal(document.body.classList.values.has('cinema-matched-transition'),false);assert.equal(cinema.style['--cinema-ui-opacity'],undefined);
home.hidden=false;const cancelledFilm=startCinema();await tick(0);await tick(1080);await tick(0);await tick(150);flow.cancel();
assert.equal(await cancelledFilm,false);assert.equal(cinema.hidden,true);assert.equal(home.inert,false);assert.equal(pose,'original');assert.equal(cinema.style['--cinema-ui-opacity'],undefined);
assert.equal(document.body.classList.values.has('cinema-matched-transition'),false);
reduced=true;const cinemaFocuses=focuses;assert.equal(await startCinema(),true);assert.equal(focuses,cinemaFocuses);assert.equal(frames.size,0);
console.log('PASS: aligned cinema without scaling/dimming, delayed controls, cinema cancellation and reduced motion; live focus, ready-before-arrival, gentle shrink, aligned map handoff matching the cinema timing without page scaling, fixed end state, duplicate history events, immediate cancellation during loading, stale work isolation, load failures and reduced motion.');
// Guitar handoff holds its silhouette until the room changes, then reveals the booth.
reduced=false;home.hidden=false;current=true;let guitarBackdrop=0,guitarTransfer=0,reveal=0;
room.guitarIsolationProgress=p=>guitarBackdrop=p;room.guitarTransferProgress=p=>guitarTransfer=p;
const ktv=element();const guitarEnter=()=>flow.enter({entrance:'guitar',page:ktv,open:()=>Promise.resolve(),arrivalBounds:()=>({left:400,top:140,width:170,height:380}),arrivalProgress:p=>reveal=p,isCurrent:()=>current});
const guitarFlight=guitarEnter();await tick(0);await tick(820);await tick(0);await tick(300);
assert.equal(document.body.dataset.transitionPhase,'guitar');assert.ok(guitarBackdrop>0&&guitarBackdrop<1);assert.equal(guitarTransfer,0);assert.equal(reveal,0);assert.equal(home.hidden,false);assert.equal(ktv.inert,true);
await tick(420);await tick(0);assert.equal(guitarBackdrop,1);assert.equal(guitarTransfer,1);assert.equal(document.body.dataset.transitionPhase,'reveal');assert.equal(home.hidden,true);
await tick(560);assert.ok(reveal>0&&reveal<1);assert.equal(ktv.style['--ktv-ui-opacity'],'0');await tick(560);assert.equal(await guitarFlight,true);assert.equal(reveal,1);assert.equal(ktv.inert,false);assert.equal(document.body.classList.values.has('guitar-room-transition'),false);assert.equal(ktv.style['--ktv-ui-opacity'],undefined);
for(const phase of ['focus','guitar','reveal']){home.hidden=false;reveal=0;const pending=guitarEnter();await tick(0);if(phase!=='focus'){await tick(820);await tick(0);}if(phase==='reveal'){await tick(720);await tick(0);await tick(200);}flow.cancel();assert.equal(await pending,false);assert.equal(ktv.hidden,true);assert.equal(home.inert,false);assert.equal(pose,'original');assert.equal(document.body.classList.values.has('guitar-room-transition'),false);}
reduced=true;home.hidden=false;reveal=0;assert.equal(await guitarEnter(),true);assert.equal(reveal,1);assert.equal(ktv.inert,false);assert.equal(frames.size,0);
console.log('PASS: guitar isolation, matched transfer, delayed booth/UI reveal, cancellation in all three phases and immediate reduced-motion entry.');
// Flatten the lens only after the map has reached its final rectangle.
reduced=false;home.hidden=false;let mapLens=0;
room.mapLensProgress=p=>mapLens=p;
const lensEntry=()=>flow.enter({entrance:'map',page:map,open:()=>Promise.resolve(),arrivalBounds:()=>mapRect,isCurrent:()=>current});
const lensFlight=lensEntry();await tick(0);await tick(0);await tick(1080);await tick(0);await tick(70);
assert.equal(document.body.dataset.transitionPhase,'map-lens');assert.ok(mapLens>0&&mapLens<1);assert.equal(map.style.opacity,'0');assert.equal(map.style.transform,'');
await tick(70);assert.equal(mapLens,1);await tick(0);await tick(200);assert.equal(home.style.opacity,'','matching maps must remain opaque through the fade');await tick(200);assert.equal(await lensFlight,true);
home.hidden=false;mapLens=0;const lensCancel=lensEntry();await tick(0);await tick(0);await tick(1080);await tick(0);await tick(70);flow.cancel();assert.equal(await lensCancel,false);assert.equal(map.hidden,true);assert.equal(home.inert,false);
console.log('PASS: fixed-rectangle map lens handoff before the page fade, and cancellation during lens adjustment.');
