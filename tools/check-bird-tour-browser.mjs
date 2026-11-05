import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)('playwright');
const root=new URL('../',import.meta.url),bundle=await fs.readFile(new URL('dist/bundle.js',root),'utf8');
const testBundle=bundle.replace('const popUp=createPopUp({scene,room','window.__tourRoom={scene,room,camera,controls,bird:birdCharacter.group,house,birdTour};\n  const popUp=createPopUp({scene,room').replace("$('home').onclick=()=>roomView.reset();","window.__tourUI=birdTour;\n  $('home').onclick=()=>roomView.reset();");
assert.notEqual(testBundle,bundle);
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}),errors=[];
const url=process.env.BIRD_TOUR_URL||'http://127.0.0.1:4173';
async function createPage(options={}){
 const page=await browser.newPage({viewport:{width:1440,height:960},...options});page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/bundle.js*',route=>route.fulfill({contentType:'application/javascript',body:testBundle}));
 await page.goto(url);await page.keyboard.press('Escape');await page.waitForSelector('#bird-tour-cue:visible');
 return page;
}
const state=page=>page.evaluate(()=>window.__tourUI.getState());
async function waitStop(page,index){await page.waitForFunction(i=>window.__tourUI.getState().state==='stop'&&window.__tourUI.getState().index===i,index);await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));}
async function clickBird(page){
 const point=await page.evaluate(()=>{const h=window.__tourRoom;h.scene.updateMatrixWorld(true);const p=h.bird.localToWorld(new h.bird.position.constructor(0,1.3,.85)).project(h.camera);return {x:(p.x+1)*innerWidth/2,y:(1-p.y)*innerHeight/2};});await page.mouse.click(point.x,point.y);
}
async function snapshot(page){return page.evaluate(()=>{const h=window.__tourRoom;return {parent:h.bird.parent===h.house,position:h.bird.position.toArray(),scale:h.bird.scale.toArray(),controls:h.controls.enabled,camera:h.camera.position.toArray(),target:h.controls.target.toArray()};});}
try{
 const page=await createPage();assert.equal((await state(page)).state,'cue');
 assert.equal(await page.locator('#bird-tour-cue p').textContent(),'我是lumi，欢迎来到雪海的小屋，让我带你参观一圈吧');
 assert.equal(await page.locator('#bird-tour-start').textContent(),'跟随参观');assert.equal(await page.locator('#bird-tour-explore').textContent(),'自由探索');
 await page.locator('#bird-tour-explore').click();assert.equal(await page.locator('#bird-tour-cue').isHidden(),true);assert.equal((await state(page)).state,'hidden');
 await page.evaluate(()=>window.__tourUI.showCue());await page.waitForSelector('#bird-tour-cue:visible');
 // The wooden house is decoration now; only the bird starts the tour.
 assert.equal(await page.locator('[data-object="bird"]').count(),0);
 assert.equal(await page.locator('[data-object="vase"]').count(),1);
 await page.locator('#bird-tour-explore').click();
 const housePoint=await page.evaluate(()=>{const h=window.__tourRoom;const p=h.house.localToWorld(new h.bird.position.constructor(.26,.55,.43)).project(h.camera);return {x:(p.x+1)*innerWidth/2,y:(1-p.y)*innerHeight/2};});
 await page.mouse.click(housePoint.x,housePoint.y);await page.waitForTimeout(150);assert.equal(await page.locator('#object-panel').isHidden(),true);assert.equal((await state(page)).state,'hidden');
 await page.locator('[data-object="vase"]').click();await page.waitForSelector('#object-panel:visible');assert.equal(await page.locator('#object-title').textContent(),'花瓶');await page.locator('#close-object').click();await page.evaluate(()=>window.__tourUI.showCue());await page.waitForSelector('#bird-tour-cue:visible');
 const before=await snapshot(page);await clickBird(page);await waitStop(page,0);assert.equal((await state(page)).id,'bird');assert.equal((await snapshot(page)).controls,false);
 assert.equal(await page.locator('#bird-tour-prev').isDisabled(),true);assert.equal(await page.locator('#bird-tour-mark').count(),0);assert.equal(await page.locator('#bird-tour-link').count(),0);assert.equal(await page.locator('#bird-tour-enter').count(),0);assert.equal(await page.locator('#bird-tour-panel #bird-tour-skip').count(),0);
 const skipBox=await page.locator('#bird-tour-skip').boundingBox();assert.ok(skipBox.x<100&&skipBox.y<60);assert.equal(await page.locator('#bird-tour-prev').textContent(),'上一步');assert.equal(await page.locator('#bird-tour-next').textContent(),'下一步');
 await page.locator('#bird-tour-next').click();await waitStop(page,1);await page.locator('#bird-tour-prev').click();await waitStop(page,0);
 await clickBird(page);assert.equal((await state(page)).index,0,'clicking bird during a tour must not restart it');
 const ids=['bird'];
 for(let i=1;i<5;i++){
  await page.locator('#bird-tour-next').click();assert.equal((await state(page)).state,'flying');assert.equal(await page.locator('#bird-tour-panel').isHidden(),true);assert.equal(await page.locator('#bird-tour-skip').isVisible(),true);await waitStop(page,i);ids.push((await state(page)).id);
  const boxes=await page.evaluate(()=>({panel:document.getElementById('bird-tour-panel').getBoundingClientRect().toJSON(),target:window.__tourRoom.birdTour.anchor(window.__tourUI.getState().id,innerWidth,innerHeight).target}));
  assert.ok(boxes.panel.right<=1440&&boxes.panel.left>=0);
  const a=boxes.panel,b=boxes.target;assert.ok(a.left>=b.right||a.right<=b.left||a.top>=b.bottom||a.bottom<=b.top,'bubble obscures current furniture');
 }
 assert.deepEqual(ids,['bird','photos','guitar','map','screen']);await page.locator('#bird-tour-next').click();await page.waitForSelector('#bird-tour-panel[data-state="done"]');assert.equal(await page.locator('#bird-tour-next').textContent(),'完成');
 assert.equal((await snapshot(page)).parent,true);await page.locator('#bird-tour-prev').click();await waitStop(page,4);assert.equal(await page.locator('#bird-tour-next').textContent(),'下一步');await page.locator('#bird-tour-next').click();await page.waitForSelector('#bird-tour-panel[data-state="done"]');assert.equal(await page.locator('#bird-tour-next').textContent(),'完成');await page.locator('#bird-tour-next').click();
 const returned=await snapshot(page);assert.equal(returned.parent,true);assert.deepEqual(returned.position,[0,.251,.646]);assert.deepEqual(returned.scale,[.16,.16,.16]);assert.equal(returned.controls,true);assert.deepEqual(returned.camera,before.camera);assert.deepEqual(returned.target,before.target);
 assert.equal((await state(page)).state,'hidden');
 // Cancel in flight, then ensure its late callback cannot resurrect the panel.
 await clickBird(page);await page.locator('#bird-tour-skip').click();await page.waitForFunction(()=>window.__tourUI.getState().state==='hidden',null,{timeout:5500});assert.equal((await state(page)).state,'hidden');assert.equal((await snapshot(page)).parent,true);
 await clickBird(page);await waitStop(page,0);await page.locator('#opening-replay').click();await page.waitForSelector('#opening-page:visible');assert.equal((await snapshot(page)).parent,true);await page.keyboard.press('Escape');await page.waitForSelector('#bird-tour-cue:visible');
 // Faster route verification uses the same UI, with the OS reduced-motion preference.
 await page.emulateMedia({reducedMotion:'reduce'});
 for(const [index,hash,pageId,back] of [[1,'#album','album-page','album-back'],[2,'#ktv','ktv-page','ktv-back'],[3,'#map','travel-page','travel-back'],[4,'#cinema','cinema-page','cinema-back']]){
  await clickBird(page);await waitStop(page,0);for(let i=1;i<=index;i++){await page.locator('#bird-tour-next').click();await waitStop(page,i);}
  await page.locator(`[data-object="${['bird','photos','guitar','map','screen'][index]}"]`).click();await page.waitForSelector(`#${pageId}:visible`);assert.equal(await page.evaluate(()=>location.hash),hash);assert.equal((await state(page)).state,'hidden');
  await page.locator(`#${back}`).click();await page.waitForSelector('#app:visible');assert.equal((await snapshot(page)).parent,true);
 }
 const phone=await createPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});await phone.emulateMedia({reducedMotion:'reduce'});const cueBox=await phone.locator('#bird-tour-cue').boundingBox();assert.ok(cueBox.x>=0&&cueBox.x+cueBox.width<=390&&cueBox.y>=0&&cueBox.y+cueBox.height<=844);await phone.locator('#bird-tour-start').click();await waitStop(phone,0);
 for(let i=0;i<5;i++){
  const box=await phone.locator('#bird-tour-panel').boundingBox();assert.ok(box.x>=0&&box.x+box.width<=390&&box.y+box.height<=844);assert.equal(await phone.evaluate(()=>document.documentElement.scrollWidth),390);
  if(i<4){await phone.locator('#bird-tour-next').click();await waitStop(phone,i+1);}
 }
 await phone.screenshot({path:new URL('preview/bird-tour-mobile-screen.png',root).pathname});await phone.locator('#bird-tour-next').click();await phone.waitForSelector('#bird-tour-panel[data-state="done"]');assert.equal((await snapshot(phone)).parent,true);
 const offline=await browser.newPage({viewport:{width:1024,height:768},reducedMotion:'reduce'});offline.on('pageerror',e=>errors.push(e.message));await offline.goto(new URL('little-us.html',root).href);await offline.keyboard.press('Escape');await offline.waitForSelector('#bird-tour-cue:visible');await offline.locator('#bird-tour-start').click();await offline.waitForSelector('#bird-tour-panel[data-state="stop"]');assert.equal(await offline.locator('#bird-tour-title').textContent(),'小木屋');await offline.locator('#bird-tour-skip').click();await offline.waitForTimeout(2600);
 assert.deepEqual(errors,[]);
 console.log('PASS: actual bird versus wooden house picking; forward/backward tour; no dashed outlines or entry buttons; top-left skip; hidden flight cards; visible furniture; cancellation/replay; all four entry links; camera/parent restoration; mobile layout; reduced motion; offline HTML; no browser errors.');
}finally{await browser.close();}
