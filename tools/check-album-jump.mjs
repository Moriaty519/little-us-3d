// Exercise the real scene/geometry with a renderer stub and deterministic frames.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url);
const threeSource=await fs.readFile(new URL('dist/assets/three.module.js',root),'utf8');
const three=await import('data:text/javascript;base64,'+Buffer.from(threeSource).toString('base64'));
const foldSource=await fs.readFile(new URL('src/album-fold.js',root),'utf8');
const fold=await import('data:text/javascript;base64,'+Buffer.from(foldSource).toString('base64'));
const sceneSource=(await fs.readFile(new URL('src/album-scene.js',root),'utf8')).replace(/^import .*;\s*$/gm,'').replace('export function createAlbumScene','function createAlbumScene');
const canvas=()=>({style:{},width:512,height:384,setAttribute(){},addEventListener(){},getContext:()=>({translate(){},scale(){},fillRect(){},createRadialGradient:()=>({addColorStop(){}})})});
let renderer,frames=[],reduced=false,mobile=false,clock=0;
class Renderer{
 constructor(){renderer=this;this.domElement=canvas();this.shadowMap={};this.capabilities={getMaxAnisotropy:()=>4};}
 setPixelRatio(){}setClearColor(){}setSize(){}dispose(){}
 render(scene){this.scene=scene;}
}
const document={hidden:false,createElement:canvas},states=[],draws=[],layoutBounds=[];
const create=new Function('THREE','renderAlbumPage','albumCoverOptions','fold','document','ResizeObserver','matchMedia','requestAnimationFrame','devicePixelRatio',
 'const {'+Object.keys(fold).join(',')+'}=fold;\n'+sceneSource+'\nreturn createAlbumScene;')(
 {...three,WebGLRenderer:Renderer},async(page,options)=>{draws.push(options.pageNumber);return {canvas:{pageNumber:options.pageNumber},hits:[]};},()=>({}),fold,document,
 class{observe(){}disconnect(){}},query=>({matches:query.includes('reduced-motion')?reduced:query.includes('max-width')&&mobile}),callback=>frames.push(callback),1);
const container={clientWidth:1440,clientHeight:600,prepend(){},getBoundingClientRect(){return {left:mobile?0:24,top:mobile?120:128,width:this.clientWidth,height:this.clientHeight};}};
const view=create(container,{onState:value=>states.push(value),onLayout:bounds=>layoutBounds.push(bounds)});
const flush=async()=>{for(let i=0;i<6;i++)await Promise.resolve();};
async function tick(delta=50){clock+=delta;const pending=frames;frames=[];pending.forEach(callback=>callback(clock));await flush();}
async function finish(){for(let i=0;i<24;i++)await tick();}
const turning=()=>renderer.scene.children.filter(group=>group.isGroup&&group.visible&&group.children.length===2&&group.children[0].geometry!==group.children[1].geometry);
const currentPage=()=>renderer.scene.children.find(group=>group.isGroup&&group.visible&&group.children[0]?.material?.map?.image?.pageNumber!==undefined&&group.children[0].material.color.getHex()===0xffffff&&group.position.x===0)?.children[0].material.map.image.pageNumber;
const pages=Array.from({length:2001},(_,i)=>({key:String(i),cover:i===0}));
view.setActive(true);assert.equal(await view.show(pages,0),true);await tick();
let cover=view.coverBounds();assert.ok(cover.height>480&&cover.height<495,'larger desktop cover remains inside its stage');
assert.ok(Math.abs(layoutBounds.at(-1).bottom-cover.top-cover.height)<1,'controls follow the rendered book bottom');

// Thousands of pages still use at most seven turning leaves and bounded drawings.
draws.length=0;
let pending=view.show(pages,1500,{jump:true});await flush();assert.equal(view.isBusy(),true);assert.ok(draws.length<=13);
await tick();await tick(450);assert.equal(turning().length,7);assert.equal(states.at(-1),true);
assert.ok(turning().some(group=>group.children[0].geometry.attributes.position.getX(32)<0));
assert.ok(turning().some(group=>group.children[0].geometry.attributes.position.getX(32)>0));
await finish();assert.equal(await pending,true);assert.equal(view.isBusy(),false);assert.equal(currentPage(),1500);assert.equal(turning().length,0);

// A new preview cancels the jump, and its page cannot be overwritten later.
pending=view.show(pages,5,{jump:true});await flush();await tick();await tick(200);
assert.equal(await view.show(pages,11,{preview:true}),true);assert.equal(await pending,false);
await finish();assert.equal(currentPage(),11);assert.equal(turning().length,0);assert.equal(view.isBusy(),false);

// Leaving during a jump restores its source and releases the busy state.
assert.equal(await view.show(pages,1500),true);
pending=view.show(pages,5,{jump:true});await flush();await tick();view.setActive(false);
assert.equal(await pending,false);assert.equal(view.isBusy(),false);
view.setActive(true);assert.equal(await view.show(pages,1500),true);await tick();assert.equal(currentPage(),1500);

// Reduced motion lands directly, and cover closing finishes with no loose leaves.
reduced=true;draws.length=0;assert.equal(await view.show(pages,5,{jump:true}),true);await tick();assert.equal(currentPage(),5);assert.ok(draws.length<=5);assert.equal(turning().length,0);
reduced=false;pending=view.show(pages,0,{jump:true});await flush();await finish();assert.equal(await pending,true);assert.equal(turning().length,0);assert.equal(view.isBusy(),false);
assert.ok(renderer.scene.children.some(group=>group.isGroup&&group.visible&&group.children[0]?.material?.map?.image?.pageNumber===0));
// Responsive framing and cover opening keep control placement tied to the book.
mobile=true;container.clientWidth=390;container.clientHeight=624;view.fit();
cover=view.coverBounds();assert.ok(cover.left>40&&cover.left+cover.width<350);assert.ok(cover.height>410&&cover.height<425);
const closedBottom=layoutBounds.at(-1).bottom;assert.ok(Math.abs(closedBottom-cover.top-cover.height)<1);
layoutBounds.length=0;pending=view.show(pages,5,{jump:true});await flush();await finish();assert.equal(await pending,true);
assert.ok(layoutBounds.at(-1).bottom<closedBottom-70,'open-book controls move closer to its shorter mobile spread');
assert.ok(layoutBounds.some(bounds=>bounds.bottom<closedBottom-20&&bounds.bottom>layoutBounds.at(-1).bottom+20),'control placement follows the animation between cover and spread');
view.dispose();
console.log('PASS: real paper geometry, overlapping seven-leaf distant jumps, bounded rendering, cancellation by preview/exit, reduced motion, enlarged responsive framing, animated control placement and busy-state cleanup.');
