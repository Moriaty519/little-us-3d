import { createTravelScene } from './travel-scene.js';
import { confirmAction,modalOpen } from './ui.js';
import { CITY_BY_ID, cityName, findCities, journeyLoad, journeySave, journeyRemove, validJourneys } from './travel-storage.js';
import { QINGDAO_ID } from './qingdao-island.js';

export function createTravelApp({compressPhoto,icon,onOpen,onClose,onExport,onImport}){
  const el=id=>document.getElementById(id),page=el('travel-page'),sidebar=el('travel-sidebar'),form=el('journey-form'),overlay=el('travel-drawer-overlay'),focusBack=el('travel-focus-back');
  let records=[],loaded=false,view=null,opened=false,cityId=null,recordId=null,editingId=null,chosenCity=null,draftPhotos=[],dirty=false,processing=false,saving=false,generation=0,toastTimer,focusActive=false,cityEditId=null;
  const make=(parent,tag,content,className)=>{const node=document.createElement(tag);if(content!==undefined)node.textContent=content;if(className)node.className=className;parent.append(node);return node;};
  function action(parent,label,callback,className){const button=make(parent,'button',label,className);button.type='button';button.onclick=callback;return button;}
  function toast(message){el('travel-toast').textContent=message;el('travel-toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el('travel-toast').classList.remove('show'),4500);}
  async function guard(){return !saving&&(!dirty||await confirmAction('放弃修改？','未保存的内容会丢失。'));}
  const sorted=list=>[...list].sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt.localeCompare(a.createdAt));
  function formError(message){el('journey-error').textContent=message;el('journey-error').hidden=false;}
  function openDrawer(){
    if(!opened||focusActive)return;
    page.classList.add('drawer-open');overlay.hidden=false;sidebar.inert=false;sidebar.setAttribute('aria-hidden','false');
    requestAnimationFrame(()=>view?.fit());
  }
  function closeDrawer(){
    page.classList.remove('drawer-open');overlay.hidden=true;sidebar.inert=true;sidebar.setAttribute('aria-hidden','true');view?.select(null);
    requestAnimationFrame(()=>view?.fit());
  }
  function setPanel(name){
    for(const id of ['travel-detail-view','travel-form-view']){const section=el(id);if(section)section.hidden=id!==name;}
    page.classList.toggle('form-open',name==='travel-form-view');page.classList.toggle('detail-open',name==='travel-detail-view');
    sidebar.scrollTop=0;requestAnimationFrame(()=>view?.fit());
  }
  const CITY_SCENES=[
    {id:'110000',name:'北京',province:'北京市',lonlat:[116.405285,39.904989],src:'地图/北京/beijing.html'},
    {id:'120000',name:'天津',province:'天津市',lonlat:[117.190182,39.125596],src:'地图/天津/tianjin-island.html'},
    {id:'630100',name:'西宁',province:'青海省',lonlat:[101.778228,36.617144],src:'地图/青海/青海/qinghai-lake.html'},
    {id:'370200',name:'青岛',province:'山东省',lonlat:[120.355173,36.082982],src:'地图/青岛/qingdao-island.html'},
    {id:'632800',name:'海西',province:'青海省',lonlat:[97.3708,37.3747],src:'地图/海西/haixi.html'}
  ];
  const isModelCity=id=>CITY_SCENES.some(scene=>scene.id===id);
  function focusQingdao(){
    if(!opened)return;
    const scene=CITY_SCENES.find(s=>s.id===QINGDAO_ID);
    if(scene)openCityScene(scene);
  }
  function openCityScene(scene){
    closePhotoBoard();closeDrawer();let layer=el('city-scene-layer');
    if(!layer){
      layer=document.createElement('div');layer.id='city-scene-layer';layer.className='city-scene-layer';layer.hidden=true;
      const close=document.createElement('button');close.type='button';close.className='city-scene-back';close.textContent='← 返回地图';close.setAttribute('aria-label','返回地图');close.onclick=()=>closeCityScene();
      const frame=document.createElement('iframe');frame.className='city-scene-frame';frame.setAttribute('allow','fullscreen');frame.setAttribute('title','城市微缩场景');
      frame.addEventListener('load',()=>{
        try{
          const doc=frame.contentDocument;if(!doc)return;
          const style=doc.createElement('style');
          style.textContent='header,.ui,.head,.kicker,.sub,.actions,.legend,.status,.error,.vignette,.qd-ui,.qd-head,.qd-kicker,.qd-note,.qd-replay,.qd-error,.note,#replay,#status,#loading,#hud,footer{display:none!important}body{margin:0!important;background:#f3ecdb!important;overflow:hidden!important}canvas{display:block!important}';
          doc.head.append(style);
        }catch(e){}
      });
      layer.append(frame,close);page.append(layer);
    }
    const show=()=>{
      layer.hidden=false;
      const frame=layer.querySelector('iframe');
      if(frame.dataset.src!==scene.src){frame.dataset.src=scene.src;frame.src=scene.src;}
    };
    if(view&&scene.lonlat){closeDrawer();view.focusCity(scene.lonlat,show);}
    else show();
  }
  function closeCityScene(){
    const layer=el('city-scene-layer');if(!layer)return;
    layer.hidden=true;const frame=layer.querySelector('iframe');frame.src='about:blank';frame.dataset.src='';
    view?.exitDiorama();
  }
  window.addEventListener('keydown',e=>{if(e.key==='Escape'&&!el('city-scene-layer')?.hidden)closeCityScene();});

  /* ---------- polaroid board for cities without a 3D scene ---------- */
  let boardLayer=null,boardCity=null;
  function openPhotoBoard(id){
    const city=CITY_BY_ID.get(id);if(!city)return;
    const items=[];
    for(const record of sorted(records.filter(r=>r.cityId===id))){
      (record.photos||[]).forEach((photo,index)=>items.push({photo,record,index}));
    }
    if(!items.length){showCity(id,true,true);return;}
    boardCity=id;
    if(!boardLayer){
      boardLayer=document.createElement('div');boardLayer.className='photo-board-layer';boardLayer.hidden=true;
      const back=document.createElement('div');back.className='photo-board-backdrop';
      const board=document.createElement('div');board.className='photo-board';
      const head=document.createElement('div');head.className='photo-board-head';
      const date=document.createElement('span');date.className='photo-board-date';
      const edit=document.createElement('button');edit.type='button';edit.className='photo-board-edit';edit.setAttribute('aria-label','编辑这条足迹');
      edit.innerHTML='<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3.6 14.4 4.5 10.7 12.8 2.4a1.5 1.5 0 0 1 2.1 0l1.6 1.6a1.5 1.5 0 0 1 0 2.1l-8.3 8.3-3.8.9z"/><path d="m11.2 4 3.9 3.9"/></svg>';
      edit.onclick=e=>{e.stopPropagation();const cid=boardCity;closePhotoBoard();openCityEdit(cid);};
      head.append(date,edit);
      boardLayer.append(back,head,board);page.append(boardLayer);
      boardLayer._board=board;boardLayer._date=date;
      boardLayer.onclick=()=>closePhotoBoard();
    }
    boardLayer._items=items;
    if(boardLayer._date)boardLayer._date.textContent=(items[0]?.record?.date||'').replaceAll('-','.');
    const board=boardLayer._board;board.replaceChildren();
    items.forEach((item,index)=>{
      const card=document.createElement('div');card.className='board-card';
      card.style.setProperty('--photo-rot',(((index%5)-2)*1.6)+'deg');
      const img=document.createElement('img');img.src=item.photo;img.alt='';img.loading='lazy';card.append(img);
      card.draggable=true;
      card.addEventListener('dragstart',e=>{e.dataTransfer.setData('text/plain',String(index));e.dataTransfer.effectAllowed='move';card.classList.add('dragging');});
      card.addEventListener('dragend',()=>card.classList.remove('dragging'));
      card.addEventListener('dragover',e=>{e.preventDefault();card.classList.add('drag-over');});
      card.addEventListener('dragleave',()=>card.classList.remove('drag-over'));
      card.addEventListener('drop',e=>{e.preventDefault();card.classList.remove('drag-over');const from=Number(e.dataTransfer.getData('text/plain'));if(Number.isInteger(from)&&from!==index)reorderBoard(from,index);});
      card.onclick=e=>{e.stopPropagation();showPhoto(item.record,item.index);};
      board.append(card);
    });
    boardLayer.hidden=false;
    cityId=id;recordId=null;view?.select(id);
  }
  async function reorderBoard(from,to){
    const items=boardLayer?._items||[];if(!items.length||from===to)return;
    const next=[...items];const [moved]=next.splice(from,1);next.splice(from<to?to-1:to,0,moved);
    const groups=new Map();
    for(const entry of next){const record=entry.record;if(!groups.has(record.id))groups.set(record.id,{record,photos:[]});groups.get(record.id).photos.push(entry.photo);}
    try{
      for(const {record,photos} of groups.values()){
        const updated={...record,photos,updatedAt:new Date().toISOString()};
        await journeySave(updated);
        const position=records.findIndex(r=>r.id===record.id);
        if(position>=0)records[position]=updated;else records.push(updated);
      }
      update();const city=boardCity;openPhotoBoard(city);toast('顺序已保存');
    }catch{toast('保存失败，请重试。');}
  }
  function closePhotoBoard(){if(!boardLayer)return;boardLayer.hidden=true;boardCity=null;cityId=null;view?.select(null);}
  window.addEventListener('keydown',e=>{if(e.key==='Escape'&&boardLayer&&!boardLayer.hidden)closePhotoBoard();});

  function update(refreshMap=true){if(refreshMap)view?.setRecords(records.filter(r=>!isModelCity(r.cityId)));}
  function resetForm(){generation++;processing=false;dirty=false;draftPhotos=[];editingId=null;chosenCity=null;cityEditId=null;
    el('journey-photos').value='';el('journey-city-options').hidden=true;el('journey-city').setAttribute('aria-expanded','false');
    el('journey-city').disabled=false;el('travel-form-view').classList.remove('city-photo-edit');el('journey-delete').hidden=true;view?.setPreview(null);}
  async function showList(skipGuard=false){if(!skipGuard&&!await guard())return;closePhotoBoard();resetForm();cityId=null;recordId=null;view?.select(null);closeDrawer();}
  async function showCity(id,skipGuard=false){
    if(!skipGuard&&!await guard())return;
    const city=CITY_BY_ID.get(id);if(!city)return;
    const scene=CITY_SCENES.find(s=>s.id===id);if(scene){openCityScene(scene);return;}
    closePhotoBoard();
    if(records.some(r=>r.cityId===id&&r.photos&&r.photos.length)){openPhotoBoard(id);return;}
    openForm(id);
  }
  function showPhoto(record,index){
    const dialog=el('travel-lightbox');dialog._record=record;dialog._index=index;renderPhoto();dialog.showModal();
  }
  function renderPhoto(){const dialog=el('travel-lightbox'),record=dialog._record,index=dialog._index;if(!record)return;el('travel-lightbox-title').textContent=record.title||`${cityName(CITY_BY_ID.get(record.cityId))} · ${record.date}`;el('travel-lightbox-image').src=record.photos[index];el('travel-lightbox-image').alt=`${el('travel-lightbox-title').textContent}，第 ${index+1} 张照片`;el('travel-photo-index').textContent=`${index+1} / ${record.photos.length}`;el('travel-photo-prev').disabled=index===0;el('travel-photo-next').disabled=index===record.photos.length-1;}
  function nextPhoto(delta){const dialog=el('travel-lightbox');dialog._index=Math.max(0,Math.min(dialog._record.photos.length-1,dialog._index+delta));renderPhoto();}
  function renderDetail(){
    const city=CITY_BY_ID.get(cityId);if(!city)return;
    const entries=sorted(records.filter(r=>r.cityId===cityId));el('travel-city-title').textContent=cityName(city);
    const photoTotal=entries.reduce((n,r)=>n+((r.photos&&r.photos.length)||0),0);
    el('travel-city-meta').textContent=`${city.province} · ${photoTotal} 张照片${cityId===QINGDAO_ID?' · 微缩场景':''}`;
    const detail=el('travel-record-detail'),list=el('travel-record-list');detail.replaceChildren();list.replaceChildren();
    if(cityId===QINGDAO_ID){const cta=action(detail,'进入微缩场景',()=>focusQingdao(),'travel-primary travel-diorama-cta');cta.setAttribute('aria-label','进入青岛微缩场景');}
    const cityScene=CITY_SCENES.find(s=>s.id===cityId);
    if(cityScene){const cta=action(detail,'进入微缩场景',()=>openCityScene(cityScene),'travel-primary travel-diorama-cta');cta.setAttribute('aria-label',`进入${cityScene.name}微缩场景`);}
    if(!entries.length){make(detail,'p','这里还没有回忆。给这座城市留下一段我们的故事吧。','travel-empty');return;}
    const record=entries.find(r=>r.id===recordId)||entries[0];recordId=record.id;
    const article=make(detail,'article',undefined,'travel-record-detail');const date=make(article,'time',record.date.replaceAll('-','.'));date.dateTime=record.date;
    make(article,'h3',record.title||`${cityName(city)}的一次同行`);
    if(record.photos.length){const cover=action(article,'',()=>showPhoto(record,0),'travel-record-cover');cover.setAttribute('aria-label','放大查看照片');const image=make(cover,'img');image.src=record.photos[0];image.alt=record.title||cityName(city);}
    if(record.note)make(article,'p',record.note,'travel-record-note');
    if(record.photos.length){const strip=make(article,'div',undefined,'travel-photo-strip');record.photos.forEach((photo,index)=>{const button=action(strip,'',()=>showPhoto(record,index));button.setAttribute('aria-label',`查看第 ${index+1} 张照片`);const img=make(button,'img');img.src=photo;img.alt=`第 ${index+1} 张照片`;});}
    const actions=make(article,'div',undefined,'travel-record-actions');action(actions,'编辑',()=>openForm(cityId,record));action(actions,'删除',()=>removeRecord(record));
  }
  async function removeRecord(record){
    if(saving||!await confirmAction('删除足迹？',`“${record.title||record.date}”及照片将被删除。`,'删除','取消'))return;
    saving=true;
    try{await journeyRemove(record.id);records=records.filter(r=>r.id!==record.id);update();if(records.some(r=>r.cityId===cityId))renderDetail();else await showList(true);toast('已删除');}catch{toast('删除失败，请重试。');}finally{saving=false;}
  }
  function chooseCity(city){chosenCity=city;el('journey-city').value=city.province+' · '+cityName(city);el('journey-city-options').hidden=true;el('journey-city').setAttribute('aria-expanded','false');view?.setPreview(city.id);dirty=true;}
  function suggestions(){
    chosenCity=null;view?.setPreview(null);const query=el('journey-city').value,list=el('journey-city-options');list.replaceChildren();const results=findCities(query).filter(city=>!isModelCity(city.id));list.hidden=!query.trim();el('journey-city').setAttribute('aria-expanded',String(!list.hidden));
    
    if(query.trim()&&!results.length)make(list,'p','未找到城市，请尝试完整城市名。');
    for(const city of results){const option=action(list,city.province+' · '+cityName(city),()=>{chooseCity(city);el('journey-date').focus();});option.setAttribute('role','option');option.tabIndex=-1;}
  }
  function draftPreviews(){const list=el('journey-photo-previews');list.replaceChildren();draftPhotos.forEach((photo,index)=>{const figure=make(list,'figure');const img=make(figure,'img');img.src=photo;img.alt=`待保存照片 ${index+1}`;const remove=action(figure,'×',()=>{draftPhotos.splice(index,1);dirty=true;draftPreviews();});remove.setAttribute('aria-label',`移除第 ${index+1} 张待保存照片`);remove.disabled=processing;});}
  async function openForm(id=null,record=null){
    if(!await guard())return;if(!loaded){toast('浏览器存储不可用或尚未准备好，请稍后重试。');return;}
    closePhotoBoard();resetForm();form.reset();cityId=null;editingId=record?.id||null;chosenCity=CITY_BY_ID.get(record?.cityId||id)||null;draftPhotos=[...(record?.photos||[])];
    el('journey-date').value=record?.date||new Date().toLocaleDateString('sv-SE');el('journey-title').value=record?.title||'';el('journey-note').value=record?.note||'';el('journey-error').hidden=true;el('journey-save').disabled=false;el('journey-upload').disabled=false;
    el('travel-form-title').textContent=record?'编辑足迹':'添加足迹';el('journey-save').textContent='保存';
    if(chosenCity){el('journey-city').value=chosenCity.province+' · '+cityName(chosenCity);view?.setPreview(chosenCity.id);}
    draftPreviews();setPanel('travel-form-view');openDrawer();el('journey-city').focus({preventScroll:true});
  }
  form.addEventListener('input',()=>dirty=true);
  el('journey-city').addEventListener('input',suggestions);
  el('journey-city').addEventListener('keydown',event=>{if(event.key==='ArrowDown'){event.preventDefault();el('journey-city-options').querySelector('button')?.focus();}if(event.key==='Escape'){el('journey-city-options').hidden=true;el('journey-city').setAttribute('aria-expanded','false');event.stopPropagation();}});
  el('journey-city-options').addEventListener('keydown',event=>{const choices=[...el('journey-city-options').querySelectorAll('button')],index=choices.indexOf(document.activeElement);if(['ArrowDown','ArrowUp'].includes(event.key)){event.preventDefault();choices[(index+(event.key==='ArrowDown'?1:-1)+choices.length)%choices.length]?.focus();}if(event.key==='Escape'){el('journey-city-options').hidden=true;el('journey-city').setAttribute('aria-expanded','false');el('journey-city').focus();event.stopPropagation();}});
  el('journey-city').addEventListener('blur',()=>setTimeout(()=>{if(!el('journey-city-options').contains(document.activeElement)){el('journey-city-options').hidden=true;el('journey-city').setAttribute('aria-expanded','false');}},150));
  el('journey-upload').onclick=()=>el('journey-photos').click();
  el('journey-photos').onchange=async()=>{
    const files=[...el('journey-photos').files];if(!files.length)return;
    const gen=++generation,room=36-draftPhotos.length;processing=true;dirty=true;el('journey-save').disabled=true;el('journey-upload').disabled=true;el('journey-error').hidden=true;draftPreviews();
    const errors=[];if(files.length>room)errors.push('每个城市最多 36 张照片，超出的照片未添加。');
    for(const file of files.slice(0,room)){try{const photo=await compressPhoto(file);if(gen!==generation)return;draftPhotos.push(photo);}catch(error){errors.push(error.message);}}
    if(gen!==generation)return;processing=false;el('journey-save').disabled=false;el('journey-upload').disabled=false;el('journey-photos').value='';draftPreviews();if(errors.length)formError([...new Set(errors)].join(' '));
  };
  async function openCityEdit(id){
    if(!await guard())return;if(!loaded){toast('浏览器存储不可用或尚未准备好，请稍后重试。');return;}
    closePhotoBoard();resetForm();
    const city=CITY_BY_ID.get(id);if(!city)return;
    const recs=sorted(records.filter(r=>r.cityId===id));
    const photos=[];for(const r of recs)for(const p of (r.photos||[]))photos.push(p);
    cityEditId=id;cityId=id;chosenCity=city;editingId=null;draftPhotos=photos.slice(0,36);
    el('journey-date').value=recs[0]?.date||new Date().toLocaleDateString('sv-SE');
    el('journey-city').value=city.province+' · '+cityName(city);
    el('journey-city').disabled=true;
    el('journey-title').value='';el('journey-note').value='';
    el('travel-form-title').textContent='编辑照片';
    el('journey-error').hidden=true;el('journey-save').disabled=false;el('journey-upload').disabled=false;
    el('travel-form-view').classList.add('city-photo-edit');el('journey-delete').hidden=false;
    draftPreviews();view?.setPreview(id);
    setPanel('travel-form-view');openDrawer();
  }
  form.onsubmit=async event=>{
    event.preventDefault();if(processing||saving||!loaded)return;el('journey-error').hidden=true;
    if(cityEditId){
      const date=el('journey-date').value;
      if(!date){formError('请选择日期。');return;}
      const existing=records.filter(r=>r.cityId===cityEditId);
      const base=existing[0],now=new Date().toISOString();
      const record={id:base?.id||(globalThis.crypto?.randomUUID?.()||'journey-'+Date.now()+'-'+Math.random().toString(36).slice(2)),cityId:cityEditId,date,title:'',note:'',photos:[...draftPhotos],createdAt:base?.createdAt||now,updatedAt:now};
      try{validJourneys([record]);saving=true;form.inert=true;el('journey-save').disabled=true;
        await journeySave(record);
        for(const r of existing){if(r.id!==record.id)await journeyRemove(r.id);}
        records=records.filter(r=>r.cityId!==cityEditId);records.push(record);
        dirty=false;update();const cid=cityEditId;cityEditId=null;closeDrawer();
        openPhotoBoard(cid);toast('已保存');
      }catch(error){formError(error.name==='QuotaExceededError'?'浏览器空间不足，请先导出备份，再整理一些照片。':error.message||'保存失败，请重试。');}
      finally{saving=false;form.inert=false;el('journey-save').disabled=false;}
      return;
    }
    if(!chosenCity){const query=el('journey-city').value.trim(),exact=findCities(query).filter(c=>c.name===query||cityName(c)===query);if(exact.length===1)chooseCity(exact[0]);}
    if(!chosenCity){formError('请从城市列表中选择一个地点。');el('journey-city').focus();suggestions();return;}
    const existing=records.filter(r=>r.cityId===chosenCity.id);
    const base=editingId?existing.find(r=>r.id===editingId):existing[0];
    const now=new Date().toISOString();
    const record={id:base?.id||(globalThis.crypto?.randomUUID?.()||'journey-'+Date.now()+'-'+Math.random().toString(36).slice(2)),cityId:chosenCity.id,date:el('journey-date').value,title:'',note:'',photos:[...draftPhotos],createdAt:base?.createdAt||now,updatedAt:now};
    try{validJourneys([record]);saving=true;form.inert=true;el('journey-save').disabled=true;await journeySave(record);for(const r of existing){if(r.id!==record.id)await journeyRemove(r.id);}records=records.filter(r=>r.cityId!==chosenCity.id);records.push(record);dirty=false;recordId=record.id;update();showCity(record.cityId,true);toast('已保存');}catch(error){formError(error.name==='QuotaExceededError'?'浏览器空间不足，请先导出备份，再整理一些照片。':error.message||'保存失败，请重试。');}finally{saving=false;form.inert=false;el('journey-save').disabled=false;}
  };
  function open(updateURL=true){
    if(opened)return;opened=true;closePhotoBoard();onOpen();page.hidden=false;
    if(updateURL&&location.hash!=='#map')history.pushState(null,'','#map');
    try{
      if(!view)view=createTravelScene(el('travel-map-stage'),id=>{
        if(page.classList.contains('drawer-open')||saving)return;
        if(id===QINGDAO_ID){focusQingdao();return;}
        const scene=CITY_SCENES.find(s=>s.id===id);
        if(scene){openCityScene(scene);return;}
        if(id)showCity(id);
        else if(view?.isFocused())view.exitDiorama();
        else if(!el('travel-detail-view').hidden)showList();
      },focused=>{
        focusActive=focused;page.classList.toggle('travel-focused',focused);focusBack.hidden=!focused;
        if(focused){closeDrawer();requestAnimationFrame(()=>focusBack.focus({preventScroll:true}));}
        else if(opened){requestAnimationFrame(()=>el('travel-add').focus({preventScroll:true}));}
      });
      view.reset();view.setActive(true);view.setRecords(records.filter(r=>!isModelCity(r.cityId)));el('travel-map-loading').hidden=true;
    }catch(error){console.error(error);el('travel-map-loading').textContent='3D 地图暂时无法显示，请开启浏览器硬件加速。城市列表和记录仍可使用。';}
    closeDrawer();el('travel-add').focus({preventScroll:true});if(!loaded)toast('正在读取本地足迹…');
  }
  async function close(updateURL=true){
    if(!opened)return true;if(!await guard()){if(!updateURL)history.replaceState(null,'','#map');return false;}
    resetForm();closePhotoBoard();closeDrawer();focusActive=false;page.classList.remove('travel-focused');focusBack.hidden=true;opened=false;page.hidden=true;view?.setActive(false);el('travel-lightbox').close();onClose();if(updateURL&&location.hash==='#map')history.replaceState(null,'',location.pathname+location.search);return true;
  }
  el('travel-back').onclick=()=>close();el('travel-add').onclick=()=>openForm();el('travel-city-add').onclick=()=>openForm(cityId);el('travel-close-detail').onclick=async()=>{await showList();};el('journey-delete').onclick=async()=>{if(!cityEditId||saving)return;const cid=cityEditId;const city=CITY_BY_ID.get(cid),owned=records.filter(r=>r.cityId===cid);if(!owned.length)return;
    if(!await confirmAction('删除这条足迹？',`${cityName(city)}的照片和记录都会被删除，地图上也不再显示。`,'删除','取消'))return;
    saving=true;try{for(const record of owned)await journeyRemove(record.id);records=records.filter(r=>r.cityId!==cid);cityEditId=null;dirty=false;update();closeDrawer();toast('已删除这条足迹');}catch{toast('删除失败，请重试。');}finally{saving=false;}
  };
  el('travel-close-form').onclick=async()=>{if(!await guard())return;const cid=cityEditId;if(cid){cityEditId=null;closeDrawer();openPhotoBoard(cid);return;}resetForm();closeDrawer();};
  async function closeFromOutside(){
    if(el('travel-form-view').hidden){closeDrawer();return;}
    if(!dirty){closeDrawer();return;}
    const save=await confirmAction('保存修改？','这条足迹有还没保存的修改。','保存','不保存');
    if(save){form.requestSubmit();return;}
    resetForm();closeDrawer();
  }
  el('travel-drawer-close').onclick=closeDrawer;overlay.onclick=closeFromOutside;
  el('travel-focus-back').onclick=()=>view?.exitDiorama();
  el('travel-backup').onclick=onExport;el('travel-import').onclick=onImport;
  el('travel-zoom-in').onclick=()=>view?.zoom(1.15);el('travel-zoom-out').onclick=()=>view?.zoom(1/1.15);el('travel-reset').onclick=()=>view?.reset();
  el('travel-lightbox-close').onclick=()=>el('travel-lightbox').close();el('travel-photo-prev').onclick=()=>nextPhoto(-1);el('travel-photo-next').onclick=()=>nextPhoto(1);
  document.addEventListener('keydown',event=>{if(el('travel-lightbox').open){if(event.key==='ArrowLeft')nextPhoto(-1);if(event.key==='ArrowRight')nextPhoto(1);return;}if(view?.isFocused()){if(event.key==='Escape'){event.preventDefault();view.exitDiorama();}return;}if(!opened||modalOpen())return;if(event.key==='Escape'){if(page.classList.contains('drawer-open')){closeDrawer();return;}if(!el('journey-city-options').hidden){el('journey-city-options').hidden=true;el('journey-city').setAttribute('aria-expanded','false');return;}if(!el('travel-form-view').hidden)el('travel-close-form').click();else closeDrawer();}});
  window.addEventListener('beforeunload',event=>{if(dirty||saving){event.preventDefault();event.returnValue='';}});
  const ready=journeyLoad().then(async list=>{records=validJourneys(list);await mergeFootprints();loaded=true;update();return true;}).catch(error=>{console.error(error);toast('浏览器存储不可用，足迹暂时无法保存。请关闭旧窗口后刷新。');return false;});
  async function mergeFootprints(){
    const groups=new Map();for(const record of records){if(!groups.has(record.cityId))groups.set(record.cityId,[]);groups.get(record.cityId).push(record);}
    for(const [city,group] of groups){
      if(group.length<2)continue;
      const ordered=[...group].sort((a,b)=>a.date.localeCompare(b.date)||a.createdAt.localeCompare(b.createdAt));
      const newest=ordered[ordered.length-1];const photos=[];for(const record of ordered)for(const photo of record.photos||[])photos.push(photo);
      const merged={...newest,title:'',note:'',photos:photos.slice(-36),createdAt:ordered[0].createdAt,updatedAt:new Date().toISOString()};
      try{await journeySave(merged);for(const record of group){if(record.id!==merged.id)await journeyRemove(record.id);}records=records.filter(r=>r.cityId!==city);records.push(merged);}catch(error){console.error(error);}
    }
  }
  return {open,close,ready,toast,mapBounds:()=>view?.mapBounds(),fit:()=>view?.fit(),isWorking:()=>processing||saving,prepareImport:async()=>{if(!await guard())return false;if(page.classList.contains('drawer-open'))await showList(true);return true;},isOpen:()=>opened,isReady:()=>loaded,getRecords:()=>records,replaceRecords:list=>{records=list;update();if(cityId&&!el('travel-detail-view').hidden)renderDetail();}};
}
