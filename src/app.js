import { createKtvApp } from './ktv-app.js';
import { createOpening } from './opening.js';
import { createRoom } from './scene.js';
import { confirmAction,modalOpen } from './ui.js';
import { memoryLoad, memorySave, memoryRemove, validBackup } from './storage.js';
import { createAlbumApp } from './album-app.js';
import { createTravelApp } from './travel-app.js';
import { validFullBackup, mergeRecords, saveFullBackup } from './travel-storage.js';
import { createCinemaApp } from './cinema-app.js';
import { mergeCinema } from './cinema-storage.js';
import { createPageTransition } from './page-transition.js';
import { createBirdTour } from './bird-tour.js';

// A fresh document always starts with the letter and the interactive home.
if(location.hash)history.replaceState(null,'',location.pathname+location.search);

const $=id=>document.getElementById(id);
const ICONS={back:'<path d="m12 4-6 6 6 6M6 10h12"/>',map:'<path d="m2 5 5-2 6 2 5-2v14l-5 2-6-2-5 2ZM7 3v14M13 5v14"/>',search:'<circle cx="8" cy="8" r="5"/><path d="m12 12 5 5"/>',home:'<path d="m3 10 7-7 7 7v7H3z"/><path d="M8 17v-6h4v6"/>',box:'<rect x="3" y="4" width="14" height="13" rx="3"/><path d="M7 4V2h6v2M3 9h14M8 12h4"/>',plus:'<path d="M10 4v12M4 10h12"/>',minus:'<path d="M4 10h12"/>',close:'<path d="m5 5 10 10M15 5 5 15"/>',reset:'<path d="M4 7a7 7 0 1 1-1 6M4 3v4h4"/>',heart:'<path d="M10 17S2 12 2 7a4 4 0 0 1 8-1 4 4 0 0 1 8 1c0 5-8 10-8 10Z"/>',music:'<path d="M8 14V4l8-2v10M8 7l8-2"/><ellipse cx="5" cy="15" rx="3" ry="2"/><ellipse cx="13" cy="13" rx="3" ry="2"/>',mic:'<rect x="7" y="2" width="6" height="11" rx="3"/><path d="M4 9v1a6 6 0 0 0 12 0V9M10 16v3M7 19h6"/>',film:'<rect x="2" y="3" width="16" height="12" rx="2"/><path d="m8 6 5 3-5 3ZM10 15v3M6 18h8"/>',bird:'<path d="M4 16c1-3 2-4 3-5V7a4 4 0 0 1 7-3l3 2-3 1c0 7-4 10-10 9Z"/><path d="M7 11c0 2 2 3 4 2M9 16v2M12 16v2"/><circle cx="11" cy="5" r=".6"/>',photo:'<rect x="2" y="3" width="16" height="14" rx="2"/><circle cx="7" cy="7" r="1.5"/><path d="m3 15 5-5 3 3 3-4 4 5"/>',move:'<path d="M10 2v16M2 10h16M7 5l3-3 3 3M7 15l3 3 3-3M5 7l-3 3 3 3M15 7l3 3-3 3"/>',arrow:'<path d="M3 10h14m-5-5 5 5-5 5"/>',vase:'<path d="M7 2h6M8 2v3c0 1.6-2 2.2-2 4.1v5c0 1.8 1.6 2.6 4 2.6s4-.8 4-2.6v-5C14 7.2 12 6.6 12 5V2M10 8.4c-1 .7-1.6 1.7-1.7 2.9"/>',download:'<path d="M10 2v11m-4-4 4 4 4-4M3 13v4h14v-4"/>',upload:'<path d="M10 13V2m-4 4 4-4 4 4M3 13v4h14v-4"/>'};
function icon(name){return '<svg viewBox="0 0 20 20" aria-hidden="true">'+(ICONS[name]||ICONS.heart)+'</svg>';}
document.querySelectorAll('[data-icon]').forEach(el=>el.innerHTML=icon(el.dataset.icon));
const OBJECTS={guitar:{name:'吉他',icon:'music'},studio:{name:'录音台',icon:'mic'},screen:{name:'幕布',icon:'film'},photos:{name:'照片墙',icon:'photo'},vase:{name:'花瓶',icon:'vase'},bird:{name:'小鸟屋',icon:'home'},sofa:{name:'沙发',icon:'heart'}};
let albumRoomPages=[],memories=[],selectedId=null,roomView,birdTour,travelApp,albumApp,cinemaApp,ktvApp,openingApp,pageTransition,editingId=null,draftPhoto=null,photoTask=null,photoGeneration=0,storageReady=false,previousFocus=null,memoryDirty=false,memorySaving=false,importing=false;
function localDate(){const now=new Date();return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;}
let toastTimer;
function toast(message){$('toast').textContent=message;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),4000);}
function sortedMemories(){return [...memories].sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt.localeCompare(a.createdAt));}
function addText(parent,tag,text,className){const el=document.createElement(tag);el.textContent=text;if(className)el.className=className;parent.append(el);return el;}
function renderObject(){
  if(!selectedId)return;const object=OBJECTS[selectedId];
  $('object-title').textContent=object.name;
  $('object-memories').replaceChildren();const records=sortedMemories().filter(m=>m.objectId===selectedId);
  if(!records.length){addText($('object-memories'),'div','暂无回忆','object-empty');return;}
  for(const record of records){const card=document.createElement('article');card.className='mini-card';if(record.photo){const img=document.createElement('img');img.src=record.photo;img.alt=record.title;card.append(img);}addText(card,'h3',record.title);addText(card,'time',record.date.replaceAll('-','.'));if(record.note)addText(card,'p',record.note);$('object-memories').append(card);}
}
function selectObject(id,hit){if(pageTransition?.isActive())return;if(hit?.action==='bird-tour'){if(!birdTour?.isActive()){if(!$('memory-drawer').hidden||modalOpen())return;$('object-panel').hidden=true;birdTour?.start();}return;}birdTour?.cancel();const route={photos:'#album',map:'#map',screen:'#cinema',guitar:'#ktv'}[id];if(route){location.hash=route;return;}if(!OBJECTS[id])return;selectedId=id;roomView?.selectObject(id);renderObject();$('object-panel').hidden=false;$('close-object').focus({preventScroll:true});}
function renderMemories(){
  $('memory-count').textContent=memories.length;$('memory-list').replaceChildren();
  if(!memories.length){const empty=document.createElement('div');empty.className='empty-memories';empty.innerHTML=icon('heart');addText(empty,'div','暂无回忆');$('memory-list').append(empty);}
  for(const record of sortedMemories()){
    const article=document.createElement('article');article.className='memory-card';
    if(record.photo){const img=document.createElement('img');img.src=record.photo;img.alt=record.title;img.loading='lazy';article.append(img);}
    const meta=document.createElement('div');meta.className='card-meta';const label=document.createElement('span');label.innerHTML=icon(OBJECTS[record.objectId].icon);label.append(document.createTextNode(OBJECTS[record.objectId].name));meta.append(label);addText(meta,'time',record.date.replaceAll('-','.'));article.append(meta);
    addText(article,'h3',record.title);if(record.note)addText(article,'p',record.note);
    const actions=document.createElement('div');actions.className='card-actions';
    const edit=addText(actions,'button','编辑');edit.type='button';edit.setAttribute('aria-label','编辑回忆：'+record.title);edit.onclick=()=>openForm(record.objectId,record);
    const remove=addText(actions,'button','删除');remove.type='button';remove.setAttribute('aria-label','删除回忆：'+record.title);remove.onclick=async()=>{if(memorySaving||!await confirmAction('删除回忆？',`“${record.title}”及照片将被删除。`,'删除','取消'))return;memorySaving=true;try{await memoryRemove(record.id);memories=memories.filter(m=>m.id!==record.id);await refreshMemories();toast('这段回忆已移除');}catch{toast('删除失败，请重试。');}finally{memorySaving=false;}};
    article.append(actions);$('memory-list').append(article);
  }
  renderObject();
}
async function refreshMemories(){renderMemories();try{await roomView?.setPhotos(memories);}catch(error){console.warn(error);toast('照片预览加载失败，请刷新。');}}
function drawerBackgroundInert(value){for(const child of $('app').children){if(!['drawer-overlay','memory-drawer','memory-dialog','toast'].includes(child.id))child.inert=value;}}
function openDrawer(){birdTour?.cancel();previousFocus=document.activeElement;$('drawer-overlay').hidden=false;$('memory-drawer').hidden=false;$('memory-drawer').setAttribute('role','dialog');$('memory-drawer').setAttribute('aria-modal','true');drawerBackgroundInert(true);$('close-drawer').focus();}
function closeDrawer(){ $('drawer-overlay').hidden=true;$('memory-drawer').hidden=true;drawerBackgroundInert(false);previousFocus?.focus?.();}
function showDraftPhoto(){ $('photo-preview').hidden=!draftPhoto;$('upload-placeholder').hidden=!!draftPhoto;$('remove-photo').hidden=!draftPhoto;if(draftPhoto)$('photo-preview').src=draftPhoto;else $('photo-preview').removeAttribute('src');}
function openForm(objectId='photos',record=null){
  if(importing||memorySaving||$('memory-dialog').open)return;if(!storageReady){toast('本地存储尚未就绪。');return;}
  birdTour?.cancel();photoGeneration++;photoTask=null;memoryDirty=false;$('memory-form').inert=false;editingId=record?.id||null;draftPhoto=record?.photo||null;$('memory-form').reset();
  $('memory-date').value=record?.date||localDate();$('memory-object').value=objectId;
  $('memory-title').value=record?.title||'';$('memory-note').value=record?.note||'';
  $('modal-title').textContent=record?'编辑回忆':'添加回忆';$('save-memory').disabled=false;$('save-memory').firstElementChild.textContent='保存';$('form-error').hidden=true;showDraftPhoto();$('memory-dialog').showModal();setTimeout(()=>$('memory-title').focus(),0);
}
function formError(message){$('form-error').textContent=message;$('form-error').hidden=false;}
async function compressPhoto(file){
  if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('请选择 JPG、PNG 或 WebP 照片。');
  if(file.size>20*1024*1024)throw new Error('这张照片超过 20 MB，请选择小一些的照片。');
  const url=URL.createObjectURL(file),img=new Image();
  try{img.src=url;await img.decode();const scale=Math.min(1,1600/Math.max(img.naturalWidth,img.naturalHeight));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));const ctx=canvas.getContext('2d');ctx.fillStyle='#fffcf3';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);return canvas.toDataURL('image/jpeg',.88);}catch(error){throw new Error('无法读取这张照片，请换一张 JPG、PNG 或 WebP 图片。');}finally{URL.revokeObjectURL(url);}
}
$('memory-form').addEventListener('input',()=>memoryDirty=true);
$('memory-photo').onchange=()=>{memoryDirty=true;const file=$('memory-photo').files[0];if(!file)return;const generation=++photoGeneration;$('form-error').hidden=true;$('save-memory').disabled=true;
  photoTask=compressPhoto(file).then(photo=>{if(generation===photoGeneration){draftPhoto=photo;showDraftPhoto();}return photo;}).catch(error=>{if(generation===photoGeneration)formError(error.message);return null;}).finally(()=>{if(generation===photoGeneration){$('save-memory').disabled=memorySaving;photoTask=null;$('memory-photo').value='';}});
};
$('remove-photo').onclick=e=>{e.preventDefault();e.stopPropagation();memoryDirty=true;photoGeneration++;photoTask=null;draftPhoto=null;$('memory-photo').value='';$('save-memory').disabled=false;showDraftPhoto();};
$('memory-form').onsubmit=async e=>{
  e.preventDefault();if(memorySaving||importing||!storageReady)return;
  const title=$('memory-title').value.trim();if(!title){formError('请输入标题。');return;}
  const generation=photoGeneration;memorySaving=true;$('memory-form').inert=true;$('save-memory').disabled=true;
  try{
    if(photoTask&&await photoTask===null)return;
    if(generation!==photoGeneration||!$('memory-dialog').open)return;
    const existing=memories.find(m=>m.id===editingId),now=new Date().toISOString();
    if(!existing&&memories.length>=1000){formError('回忆已满，请先备份并整理。');return;}
    const record={id:editingId||(globalThis.crypto?.randomUUID?.()||'memory-'+Date.now()+'-'+Math.random().toString(36).slice(2)),title,date:$('memory-date').value,note:$('memory-note').value.trim(),objectId:$('memory-object').value,photo:draftPhoto,createdAt:existing?.createdAt||now,updatedAt:now};
    validBackup({format:'little-us-backup',version:1,memories:[record]});await memorySave(record);memories=memories.filter(m=>m.id!==record.id);memories.push(record);memoryDirty=false;$('memory-dialog').close();await refreshMemories();toast('已保存');
  }catch(error){formError(error.name==='QuotaExceededError'?'存储空间不足，请先备份并整理照片。':error.message||'保存失败，请重试。');}finally{memorySaving=false;$('memory-form').inert=false;$('save-memory').disabled=false;}
};
async function closeMemoryForm(){if(memorySaving)return false;if(memoryDirty&&!await confirmAction('放弃修改？','未保存的内容会丢失。'))return false;$('memory-dialog').close();return true;}
$('memory-dialog').addEventListener('close',()=>{photoGeneration++;photoTask=null;memoryDirty=false;editingId=null;draftPhoto=null;});
$('memory-dialog').addEventListener('cancel',event=>{event.preventDefault();closeMemoryForm();});
$('close-modal').onclick=closeMemoryForm;
window.addEventListener('beforeunload',event=>{if(memoryDirty||memorySaving){event.preventDefault();event.returnValue='';}});
$('add-memory').onclick=()=>openForm('photos');$('drawer-add').onclick=()=>openForm('photos');$('object-add').onclick=()=>openForm(selectedId||'photos');
$('memory-box').onclick=openDrawer;$('close-drawer').onclick=closeDrawer;$('drawer-overlay').onclick=closeDrawer;
$('close-object').onclick=()=>{$('object-panel').hidden=true;roomView?.selectObject(null);document.querySelector(`[data-object="${selectedId}"]`)?.focus();};
document.querySelectorAll('[data-object]').forEach(button=>button.onclick=()=>selectObject(button.dataset.object));
document.addEventListener('keydown',e=>{
  if($('app').hidden||openingApp?.isActive()||modalOpen())return;
  if(!$('memory-drawer').hidden){if(e.key==='Escape'){closeDrawer();return;}if(e.key==='Tab'){const focusable=[...$('memory-drawer').querySelectorAll('button:not([disabled])')];const first=focusable[0],last=focusable.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}}
  else if(e.key==='Escape'){$('object-panel').hidden=true;roomView?.selectObject(null);}
});
function backupToast(message){if(ktvApp?.isOpen())ktvApp.toast(message);else if(cinemaApp?.isOpen())cinemaApp.toast(message);else if(albumApp?.isOpen())albumApp.toast(message);else if(travelApp?.isOpen())travelApp.toast(message);else toast(message);}
async function exportAll(){
  await Promise.all([memoryReady,travelApp.ready,albumApp.ready,cinemaApp.ready,ktvApp.ready]);
  if(!storageReady||!travelApp.isReady()||!albumApp.isReady()||!cinemaApp.isReady()||!ktvApp.isReady()){backupToast('本地记录尚未读取完成或存储不可用，请稍后重试。');return;}
  if(importing||memorySaving||travelApp.isWorking()||albumApp.isWorking()||cinemaApp.isWorking()||ktvApp.isWorking()){backupToast('请等待保存或照片处理完成。');return;}
  const backup={format:'little-us-backup',version:6,exportedAt:new Date().toISOString(),memories,journeys:travelApp.getRecords(),albums:albumApp.getRecords(),cinema:cinemaApp.getRecord(),ktv:ktvApp.getRecord()};
  const blob=new Blob([JSON.stringify(backup)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`little-us-全部回忆备份-${localDate()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);backupToast('备份已导出');
}
$('export-memories').onclick=exportAll;
async function requestImport(){
  if(importing||memorySaving)return;
  if($('memory-dialog').open&&!await closeMemoryForm())return;
  if(!await travelApp.prepareImport()||!await albumApp.prepareImport()||!await cinemaApp.prepareImport()||!await ktvApp.prepareImport())return;
  $('backup-file').click();
}
$('import-memories').onclick=requestImport;
$('backup-file').onchange=async()=>{
  const file=$('backup-file').files[0];if(!file||importing)return;
  importing=true;for(const id of ['app','travel-page','album-page','cinema-page','ktv-page'])$(id).inert=true;
  $('import-memories').disabled=true;$('travel-import').disabled=true;$('album-import').disabled=true;$('cinema-import').disabled=true;$('ktv-import').disabled=true;
  try{
    await Promise.all([memoryReady,travelApp.ready,albumApp.ready,cinemaApp.ready,ktvApp.ready]);if(!storageReady||!travelApp.isReady()||!albumApp.isReady()||!cinemaApp.isReady()||!ktvApp.isReady())throw new Error('当前浏览器无法保存数据，暂不能导入。');
    if(file.size>150*1024*1024)throw new Error('备份超过 150 MB，请拆分后再导入。');
    const incoming=validFullBackup(JSON.parse(await file.text()));
    const photos=[...incoming.memories.filter(r=>r.photo).map(r=>r.photo),...incoming.journeys.flatMap(r=>r.photos),...incoming.albums.flatMap(r=>r.photos.map(p=>p.src)),...(incoming.cinema?.photos.map(p=>p.src)||[])];
    for(const photo of photos){const img=new Image();img.src=photo;try{await img.decode();}catch{throw new Error('备份里有无法读取的照片，尚未导入任何记录。');}}
    await cinemaApp.checkMusic(incoming.cinema);await ktvApp.checkVideo(incoming.ktv);
    const mergedMemories=mergeRecords(memories,incoming.memories),mergedJourneys=mergeRecords(travelApp.getRecords(),incoming.journeys),mergedAlbums=mergeRecords(albumApp.getRecords(),incoming.albums);
    const mergedCinema=mergeCinema(cinemaApp.getRecord(),incoming.cinema),mergedKtv=mergeCinema(ktvApp.getRecord(),incoming.ktv);
    await saveFullBackup(mergedMemories,mergedJourneys,mergedAlbums,mergedCinema,mergedKtv);memories=mergedMemories;travelApp.replaceRecords(mergedJourneys);albumApp.replaceRecords(mergedAlbums);await cinemaApp.replaceRecord(mergedCinema);await ktvApp.replaceRecord(mergedKtv);await refreshMemories();backupToast('备份已合并');
  }catch(error){backupToast(error instanceof SyntaxError?'这个文件不是有效的回忆备份。':error.message||'导入失败，请重试。');}
  finally{importing=false;for(const id of ['app','travel-page','album-page','cinema-page','ktv-page'])$(id).inert=false;drawerBackgroundInert(!$('memory-drawer').hidden);$('backup-file').value='';$('import-memories').disabled=false;$('travel-import').disabled=false;$('album-import').disabled=false;$('cinema-import').disabled=false;$('ktv-import').disabled=false;routePage();}
};

try{
  roomView=createRoom($('scene'),selectObject);
  birdTour=createBirdTour({room:roomView,home:$('app')});
  $('home').onclick=()=>roomView.reset();$('reset-view').onclick=()=>roomView.reset();$('zoom-in').onclick=()=>roomView.zoom(1.15);$('zoom-out').onclick=()=>roomView.zoom(1/1.15);
  $('loading').style.opacity='0';setTimeout(()=>$('loading').hidden=true,550);
}catch(error){console.error(error);$('loading').classList.add('error');$('loading').querySelector('p').textContent='暂时无法显示 3D 小屋。请使用支持 WebGL 的 Chrome、Edge 或 Safari 浏览器，并开启硬件加速。';}
const memoryReady=memoryLoad().then(async records=>{memories=validBackup({format:'little-us-backup',version:1,memories:records});storageReady=true;await refreshMemories();}).catch(error=>{console.error(error);toast('浏览器存储不可用，回忆暂时无法保存。');});
function hideRoomForPage(force=false){
  birdTour?.cancel();
  $('object-panel').hidden=true;roomView?.selectObject(null);if(!$('memory-drawer').hidden)closeDrawer();
  if(!force&&pageTransition?.isActive())return;
  $('app').hidden=true;roomView?.setActive(false);
}
function restoreRoom(focusId){
  if(pageTransition?.isActive()||openingApp?.isActive()||travelApp?.isOpen()||albumApp?.isOpen()||cinemaApp?.isOpen()||ktvApp?.isOpen())return;
  $('app').hidden=false;roomView?.setActive(true);document.querySelector(`[data-object="${focusId}"]`)?.focus({preventScroll:true});
}
travelApp=createTravelApp({compressPhoto,icon,onOpen:hideRoomForPage,onClose:()=>restoreRoom('map'),onExport:exportAll,onImport:requestImport});
albumApp=createAlbumApp({compressPhoto,onCoverChange:pages=>{albumRoomPages=pages;return roomView?.setAlbumPages(pages);},onOpen:hideRoomForPage,onClose:()=>restoreRoom('photos'),onExport:exportAll,onImport:requestImport});
cinemaApp=createCinemaApp({compressPhoto,onCoverChange:src=>roomView?.setProjectionPhoto(src),getRoomPhotos:async()=>{await memoryReady;return memories;},getAlbumPages:async()=>{await albumApp.ready;return albumRoomPages;},onOpen:hideRoomForPage,onClose:()=>restoreRoom('screen'),onExport:exportAll,onImport:requestImport});
ktvApp=createKtvApp({onOpen:hideRoomForPage,onClose:()=>restoreRoom('guitar'),onExport:exportAll,onImport:requestImport});
pageTransition=createPageTransition({room:roomView,home:$('app'),hideHome:()=>hideRoomForPage(true)});
async function enterFeature(api,hash,entrance,pageId,focusId){
  birdTour?.cancel();
  if(api.isOpen())return;await api.ready;if(location.hash!==hash)return;
  await pageTransition.enter({entrance,page:$(pageId),open:()=>api.open(false,entrance==='photos'?{cover:true}:undefined),arrivalBounds:()=>entrance==='guitar'?api.guitarBounds?.():entrance==='map'?api.mapBounds?.():api.coverBounds?.(),arrivalProgress:api.arrivalProgress,fit:()=>api.fit(),isCurrent:()=>location.hash===hash,focus:()=>$(focusId).focus({preventScroll:true})});
}
let routing=false,routePending=false;
async function routePage(){
  if(routing){routePending=true;return;}routing=true;
  try{
    if(importing||openingApp?.isActive())return;
    if($('memory-dialog').open&&!await closeMemoryForm()){history.replaceState(null,'',location.pathname+location.search);return;}
    if(location.hash!=='#ktv'&&!await ktvApp.close(false)){history.replaceState(null,'','#ktv');return;}
    if(location.hash!=='#cinema'&&!await cinemaApp.close(false)){history.replaceState(null,'','#cinema');return;}
    if(location.hash==='#album'){
      if(!await travelApp.close(false)){history.replaceState(null,'','#map');return;}
      await enterFeature(albumApp,'#album','photos','album-page','album-add');
    }else if(location.hash==='#map'){
      if(!await albumApp.close(false)){history.replaceState(null,'','#album');return;}
      await enterFeature(travelApp,'#map','map','travel-page','travel-add');
    }else if(location.hash==='#cinema'){
      if(!await albumApp.close(false)){history.replaceState(null,'','#album');return;}
      if(!await travelApp.close(false)){history.replaceState(null,'','#map');return;}
      await enterFeature(cinemaApp,'#cinema','screen','cinema-page','cinema-play');
    }else if(location.hash==='#ktv'){
      if(!await albumApp.close(false)){history.replaceState(null,'','#album');return;}
      if(!await travelApp.close(false)){history.replaceState(null,'','#map');return;}
      await enterFeature(ktvApp,'#ktv','guitar','ktv-page','ktv-edit');
    }else{
      if(!await albumApp.close(false)){history.replaceState(null,'','#album');return;}
      if(!await travelApp.close(false)){history.replaceState(null,'','#map');return;}
      restoreRoom('photos');
    }
  }catch(error){console.error(error);pageTransition.cancel();history.replaceState(null,'',location.pathname+location.search);routePending=true;toast('页面加载失败，请重试。');}
  finally{routing=false;if(routePending){routePending=false;routePage();}}
}
function requestRoute(){birdTour?.cancel();pageTransition.cancelIfStale();routePage();}
window.addEventListener('hashchange',requestRoute);window.addEventListener('popstate',requestRoute);
document.addEventListener('keydown',event=>{
  if(!pageTransition.isActive()||event.altKey||event.ctrlKey||event.metaKey)return;
  event.preventDefault();event.stopImmediatePropagation();
  if(event.key==='Escape'){pageTransition.cancel();history.replaceState(null,'',location.pathname+location.search);routePage();}
},true);
openingApp=createOpening({room:roomView,roomContainer:$('scene'),onComplete:()=>{routePage();birdTour?.showCue();}});
$('opening-replay').onclick=()=>{if(importing||memorySaving||modalOpen()||!$('memory-drawer').hidden)return;birdTour?.cancel();$('object-panel').hidden=true;roomView?.selectObject(null);openingApp.start();};

// Keep auxiliary menus out of the way once an action has been selected.
document.addEventListener('click',event=>{for(const menu of document.querySelectorAll('details[open]'))if(!menu.contains(event.target)||event.target.closest('button'))menu.open=false;});
