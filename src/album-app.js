import { ALBUM_TEMPLATES,ALBUM_TEMPLATE_CHOICES,albumLoad,albumSave,albumRemove,validAlbums,albumSamplesHidden,hideAlbumSamples } from './album-storage.js';
import { albumPaginate,albumMeasure,albumSampleRecords,albumCropRect,albumSlotAspect,renderAlbumPage } from './album-pages.js';
import { createAlbumScene } from './album-scene.js';
import { confirmAction,modalOpen } from './ui.js';

export function createAlbumApp({compressPhoto,onOpen,onClose,onExport,onImport,onCoverChange}){
  const el=id=>document.getElementById(id),page=el('album-page');
  let records=[],samples=albumSampleRecords(),samplesHidden=false,pages=[],index=0,opened=false,loaded=false,view=null,busy=false,editing=false,editingId=null,draftPhotos=[],draftTemplate='daily',dirty=false,processing=false,saving=false,draftPart=0,generation=0,previewTimer,toastTimer,galleryMode='overview',galleryPart=0,galleryGeneration=0,cropState=null,lightboxRecord=null,lightboxIndex=0,paintVersion=0;
  const make=(parent,tag,text,className)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;parent.append(node);return node;};
  const button=(parent,text,action,className)=>{const b=make(parent,'button',text,className);b.type='button';b.onclick=action;return b;};
  function toast(message){el('album-toast').textContent=message;el('album-toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el('album-toast').classList.remove('show'),4500);}
  function error(message){el('album-form-error').textContent=message;el('album-form-error').hidden=false;}
  async function guard(){return !saving&&(!dirty||await confirmAction('放弃修改？','未保存的内容会丢失。'));}
  function setBusy(value){busy=value;el('album-delete').disabled=value||saving;el('album-overview').disabled=value;el('album-year').disabled=value;for(const item of el('album-months').querySelectorAll('button'))item.disabled=value;el('album-edit').disabled=value||!pages[index]?.record;el('album-prev').disabled=value||index===0;el('album-next').disabled=value||index===pages.length-1;el('album-stage').setAttribute('aria-busy',String(value));}
  function rebuild(key=pages[index]?.key){pages=[{key:'cover',cover:true},...albumPaginate([...records,...(samplesHidden?[]:samples)],albumMeasure)];index=Math.max(0,pages.findIndex(p=>p.key===key));timeline();updateInfo();if(onCoverChange)Promise.resolve(onCoverChange(pages)).catch(console.error);if(opened&&!editing)paint(pages,index);}
  function timeline(){
    const yearSelect=el('album-year'),chosen=yearSelect.value,years=[...new Set(pages.filter(p=>p.record).map(p=>p.record.date.slice(0,4)))].sort();
    yearSelect.replaceChildren();for(const year of years){const option=make(yearSelect,'option',year+' 年');option.value=year;}if(years.includes(chosen))yearSelect.value=chosen;
    if(!years.length){const option=make(yearSelect,'option','暂无故事');option.value='';}
    renderMonths();el('album-samples').textContent=samplesHidden?'恢复模板示例':'移除模板示例';
  }
  function renderMonths(){
    const nav=el('album-months');nav.replaceChildren();const cover=button(nav,'',()=>changePage(0,'jump'));make(cover,'strong','封面');cover.classList.toggle('active',index===0);cover.disabled=busy;
    const months=new Map();pages.forEach((p,i)=>{if(p.record&&p.part===0&&p.record.date.slice(0,4)===el('album-year').value){const m=p.record.date.slice(5,7);if(!months.has(m))months.set(m,{index:i,count:0});months.get(m).count++;}});
    for(const [month,info] of months){const b=button(nav,'',()=>changePage(info.index,'jump'));make(b,'strong',month+' 月');b.classList.toggle('active',pages[index]?.record?.date.slice(0,7)===el('album-year').value+'-'+month);b.disabled=busy;b.setAttribute('aria-label',`${el('album-year').value}年${month}月，${info.count}个故事`);}
  }
  function updatePageEdit(at=index){const page=pages[at],record=page?.record,btn=el('album-page-edit');if(!btn)return;const show=!!record&&!page.cover&&!editing;btn.hidden=!show;btn.disabled=busy;
    const corner=show?view?.pageCorner?.():null;
    if(corner){const stage=el('album-stage').getBoundingClientRect();btn.style.left=(corner.x-stage.left-46)+'px';btn.style.top=(corner.y-stage.top+10)+'px';btn.style.right='auto';}
    btn.onclick=()=>{const current=pages[index]?.record;if(current)openEditor(current.sample?null:current,current.template);};}
  function updateInfo(){
    const p=pages[index],r=p?.record;el('album-page-number').textContent=index===0?'封面':`${index} / ${pages.length-1}`;setBusy(busy);
    el('album-edit').disabled=busy||!r;el('album-edit').hidden=!r||!!r.sample;el('album-edit').textContent='编辑';el('album-delete').hidden=!r||!!r.sample;
    const readable=el('album-readable');readable.replaceChildren();if(r){make(readable,'h2',r.title||r.date);make(readable,'p',p.lines.join('\n'));p.photos.forEach((photo,i)=>{button(readable,`查看第 ${p.photoStart+i+1} 张照片`,()=>showPhoto(r,p.photoStart+i));});if(!p.photos.length)button(readable,r.sample?'用这个模板':'编辑这一页',()=>openEditor(r.sample?null:r,r.template));}
    if(r&&el('album-year').value!==r.date.slice(0,4))el('album-year').value=r.date.slice(0,4);renderMonths();
  }
  async function paint(list,at,options={}){
    if(!opened)return false;const gen=++paintVersion;setBusy(true);
    try{
      if(view){if(!await view.show(list,at,options)){if(gen===paintVersion)toast('页面加载失败，请重试。');return false;}}
      else{const rendered=await renderAlbumPage(list[at],{cover:!!list[at].cover,pageNumber:at,placeholder:!!options.preview});if(gen!==paintVersion||!opened)return false;const stage=el('album-stage');stage.querySelector('canvas')?.remove();rendered.canvas.style.objectFit='contain';stage.prepend(rendered.canvas);}
      updatePageEdit(at);return gen===paintVersion&&opened;
    }catch(e){console.error(e);if(gen===paintVersion)toast('页面加载失败，请重试。');return false;}
    finally{if(gen===paintVersion){el('album-loading').hidden=true;setBusy(false);}}
  }
  async function changePage(next,animate=true){if(!opened||editing||busy||!pages.length)return;const target=Math.max(0,Math.min(pages.length-1,next));if(target===index)return;const direction=target>index?1:-1;if(await paint(pages,target,{animate:animate?direction:0,jump:animate==='jump'})){index=target;updateInfo();}}
  function draftRecord(){const previous=records.find(r=>r.id===editingId),now=new Date().toISOString();return {id:editingId||'album-draft',date:el('album-date').value,title:el('album-title').value.trim(),note:noteSupported()?el('album-note').value.trim():'',template:draftTemplate,photos:draftPhotos.map(p=>({src:p.src,crop:{...p.crop}})),createdAt:previous?.createdAt||now,updatedAt:now};}
  function noteSupported(template=draftTemplate){return ['letter','anniversary','daily'].includes(template);}
  function updateNoteVisibility(){const note=el('album-note'),label=note?.closest('label');const show=noteSupported();if(note)note.hidden=!show;if(label)label.hidden=!show;}
  function updateTemplateButton(){updateNoteVisibility();const button=el('album-templates');if(!button)return;const name=ALBUM_TEMPLATES[draftTemplate].name;button.textContent=`模板：${name} ›`;button.setAttribute('aria-label',`预览并选择模板，当前：${name}`);}
  function schedulePreview(){clearTimeout(previewTimer);previewTimer=setTimeout(preview,100);}
  async function preview(){if(!editing)return;const list=albumPaginate([draftRecord()],albumMeasure);draftPart=Math.max(0,Math.min(draftPart,list.length-1));el('album-draft-pages').textContent=`预览 ${draftPart+1} / ${list.length}`;el('album-draft-prev').disabled=draftPart===0;el('album-draft-next').disabled=draftPart===list.length-1;await paint(list,draftPart,{preview:true});}
  function draftThumbnails(){
    const list=el('album-photo-drafts');list.replaceChildren();el('album-draft-photo-count').textContent=`照片 · ${draftPhotos.length} 张`;
    draftPhotos.forEach((photo,i)=>{const figure=make(list,'figure');figure.draggable=true;const img=make(figure,'img');img.src=photo.src;img.alt=`待保存的第 ${i+1} 张照片`;img.draggable=false;
      figure.addEventListener('dragstart',e=>{e.dataTransfer.setData('text/plain',String(i));e.dataTransfer.effectAllowed='move';figure.classList.add('dragging');});
      figure.addEventListener('dragend',()=>figure.classList.remove('dragging'));
      figure.addEventListener('dragover',e=>{e.preventDefault();figure.classList.add('drag-over');});
      figure.addEventListener('dragleave',()=>figure.classList.remove('drag-over'));
      figure.addEventListener('drop',e=>{e.preventDefault();figure.classList.remove('drag-over');const from=Number(e.dataTransfer.getData('text/plain'));if(Number.isInteger(from)&&from!==i)movePhotoTo(from,i);});
      const remove=button(figure,'×',()=>{draftPhotos.splice(i,1);dirty=true;applyAutoTemplate();updateTemplateButton();draftThumbnails();schedulePreview();},'album-thumb-remove');remove.setAttribute('aria-label',`移除相册第 ${i+1} 张照片`);remove.disabled=processing||saving;
      const order=make(figure,'div',undefined,'album-thumb-order');const left=button(order,'←',()=>movePhoto(i,-1)),right=button(order,'→',()=>movePhoto(i,1));left.setAttribute('aria-label',`前移第 ${i+1} 张照片`);right.setAttribute('aria-label',`后移第 ${i+1} 张照片`);left.disabled=i===0||processing||saving;right.disabled=i===draftPhotos.length-1||processing||saving;
    });
  }
  function movePhoto(i,delta){const next=i+delta;[draftPhotos[i],draftPhotos[next]]=[draftPhotos[next],draftPhotos[i]];dirty=true;draftThumbnails();schedulePreview();}
  function movePhotoTo(from,to){const next=[...draftPhotos];const [photo]=next.splice(from,1);next.splice(from<to?to-1:to,0,photo);draftPhotos=next;dirty=true;draftThumbnails();schedulePreview();}
  function autoTemplateFor(count){if(count<=1)return 'letter';if(count===2)return 'anniversary';if(count===3)return 'daily';if(count===4)return 'quad';if(count===5)return 'five';return 'six';}
  function applyAutoTemplate(){if(!editing||!draftPhotos.length)return;const next=autoTemplateFor(draftPhotos.length);if(next!==draftTemplate){draftTemplate=next;updateTemplateButton();}}
  async function openEditor(record=null,template='daily'){
    if(!await guard())return;if(!loaded){toast('本地存储尚未准备好，请稍后重试。');return;}
    generation++;clearTimeout(previewTimer);editing=true;updatePageEdit();editingId=record?.id||null;draftPhotos=(record?.photos||[]).map(p=>({src:p.src,crop:{...p.crop}}));dirty=false;processing=false;draftPart=0;
    el('album-form').reset();el('album-date').value=record?.date||new Date().toLocaleDateString('sv-SE');el('album-title').value=record?.title||'';el('album-note').value=record?.note||'';const selected=record?.template||template;draftTemplate=record?selected:ALBUM_TEMPLATE_CHOICES.includes(selected)?selected:autoTemplateFor(draftPhotos.length);if(!record)applyAutoTemplate();updateTemplateButton();
    el('album-editor-title').textContent=record?'编辑故事':'添加故事';el('album-form-error').hidden=true;el('album-save').disabled=false;el('album-upload').disabled=false;el('album-editor').hidden=false;page.classList.add('album-editing');draftThumbnails();await preview();el('album-title').focus({preventScroll:true});
  }
  function resetEditor(){generation++;paintVersion++;clearTimeout(previewTimer);editing=false;dirty=false;processing=false;draftPhotos=[];editingId=null;el('album-files').value='';el('album-editor').hidden=true;page.classList.remove('album-editing');}
  async function closeEditor(){if(!await guard())return false;resetEditor();updateInfo();await paint(pages,index);return true;}
  el('album-form').addEventListener('input',()=>{dirty=true;schedulePreview();});
  el('album-upload').onclick=()=>el('album-files').click();
  el('album-files').onchange=async()=>{
    const files=[...el('album-files').files];if(!files.length)return;const gen=++generation,room=24-draftPhotos.length;processing=true;dirty=true;el('album-save').disabled=true;el('album-upload').disabled=true;el('album-form-error').hidden=true;draftThumbnails();const errors=[];
    if(files.length>room)errors.push('一个故事最多 24 张，超出的照片未添加。');
    for(const file of files.slice(0,room)){try{const src=await compressPhoto(file);if(gen!==generation)return;draftPhotos.push({src,crop:{x:.5,y:.5,zoom:1}});}catch(e){errors.push(e.message);}}
    if(gen!==generation)return;processing=false;el('album-save').disabled=false;el('album-upload').disabled=false;el('album-files').value='';applyAutoTemplate();updateTemplateButton();draftThumbnails();schedulePreview();if(errors.length)error([...new Set(errors)].join(' '));
  };
  el('album-form').onsubmit=async event=>{
    event.preventDefault();if(processing||saving||!loaded)return;el('album-form-error').hidden=true;
    const previous=records.find(r=>r.id===editingId);if(!previous&&records.length>=1000){error('相册已达到 1000 个故事，请先备份再整理一些内容。');return;}
    const record=draftRecord();if(!record.title&&!record.note&&!record.photos.length){error('请添加照片、标题或正文。');return;}if(!editingId)record.id=globalThis.crypto?.randomUUID?.()||'album-'+Date.now()+'-'+Math.random().toString(36).slice(2);
    try{validAlbums([record]);saving=true;el('album-form').inert=true;el('album-save').disabled=true;el('album-upload').disabled=true;await albumSave(record);records=records.filter(r=>r.id!==record.id);records.push(record);resetEditor();rebuild(record.id+':0');toast('已保存');}catch(e){error(e.name==='QuotaExceededError'?'浏览器空间不足，请先导出备份，再整理一些照片。':e.message||'保存失败，请重试。');}finally{saving=false;el('album-form').inert=false;el('album-save').disabled=false;el('album-upload').disabled=false;}
  };
  async function removeStory(){const r=pages[index]?.record;if(busy||!r||r.sample)return;if(saving||!await confirmAction('删除故事？',`“${r.title||r.date}”及全部照片和续页将被删除。`,'删除','取消'))return;saving=true;try{await albumRemove(r.id);records=records.filter(p=>p.id!==r.id);rebuild('cover');toast('这个故事已删除');}catch{toast('删除失败，请重试。');}finally{saving=false;}}
  async function toggleSamples(){if(!loaded||saving)return;if(editing&&!await closeEditor())return;saving=true;try{await hideAlbumSamples(!samplesHidden);samplesHidden=!samplesHidden;rebuild('cover');toast(samplesHidden?'模板示例已移除，自己的故事仍保留。':'模板示例已恢复，不计入自己的故事。');}catch{toast('无法保存示例设置，请重试。');}finally{saving=false;}}
  async function showGallery(mode){if(saving||(mode==='templates'&&!editing))return;if(mode==='overview'&&editing&&!await closeEditor())return;galleryMode=mode;galleryPart=0;el('album-gallery-title').textContent=mode==='templates'?'模板':'页面总览';el('album-gallery').showModal();await renderGallery();}
  async function renderGallery(){
    const gen=++galleryGeneration,grid=el('album-gallery-grid');grid.replaceChildren();const list=galleryMode==='templates'?ALBUM_TEMPLATE_CHOICES.map(kind=>albumPaginate(samples.filter(r=>r.template===kind),albumMeasure)[0]):pages,per=18,start=galleryPart*per,end=Math.min(start+per,list.length);
    el('album-gallery-prev').disabled=start===0;el('album-gallery-next').disabled=end===list.length;el('album-gallery-count').textContent=`${start+1}—${end} / ${list.length}`;
    for(let i=start;i<end;i++){
      const p=list[i],b=button(grid,'',async()=>{el('album-gallery').close();if(galleryMode==='templates'){if(editing&&draftTemplate!==p.record.template){draftTemplate=p.record.template;updateTemplateButton();dirty=true;draftPart=0;schedulePreview();}}else await changePage(i,false);});if(galleryMode==='templates'){const selected=p.record.template===draftTemplate;b.classList.toggle('selected',selected);b.setAttribute('aria-pressed',String(selected));}const img=make(b,'img');img.alt='';make(b,'strong',galleryMode==='templates'?ALBUM_TEMPLATES[p.record.template].name:p.cover?'相册封面':p.record.title||p.record.date);if(galleryMode!=='templates'&&!p.cover)make(b,'small',p.record.date);
      const rendered=await renderAlbumPage(p,{cover:!!p.cover,pageNumber:i});if(gen!==galleryGeneration||!el('album-gallery').open)return;const thumbnail=document.createElement('canvas');thumbnail.width=430;thumbnail.height=311;const context=thumbnail.getContext('2d');context.fillStyle='#fffaf0';context.fillRect(0,0,430,311);if(p.cover)context.drawImage(rendered.canvas,rendered.canvas.width/2,0,rendered.canvas.width/2,rendered.canvas.height,107.5,0,215,311);else context.drawImage(rendered.canvas,0,0,430,311);img.src=thumbnail.toDataURL('image/jpeg',.86);
    }
  }
  function showPhoto(record,at){if(!record.photos.length)return;lightboxRecord=record;lightboxIndex=at;renderPhoto();el('album-lightbox').showModal();}
  function renderPhoto(){const r=lightboxRecord;if(!r)return;el('album-lightbox-title').textContent=r.title||r.date;el('album-lightbox-image').src=r.photos[lightboxIndex].src;el('album-lightbox-image').alt=(r.title||r.date)+'，第 '+(lightboxIndex+1)+' 张';el('album-photo-number').textContent=`${lightboxIndex+1} / ${r.photos.length}`;el('album-photo-prev').disabled=lightboxIndex===0;el('album-photo-next').disabled=lightboxIndex===r.photos.length-1;}
  function nextPhoto(delta){lightboxIndex=Math.max(0,Math.min(lightboxRecord.photos.length-1,lightboxIndex+delta));renderPhoto();}
  async function openCrop(at){const photo=draftPhotos[at],gen=generation;if(!photo||processing||saving)return;const image=new Image();image.src=photo.src;try{await image.decode();}catch{error('这张照片无法读取。');return;}if(!editing||gen!==generation||draftPhotos[at]!==photo)return;const aspect=albumSlotAspect(draftTemplate,at);cropState={at,image,crop:{...photo.crop},aspect};el('album-crop-zoom').value=cropState.crop.zoom;drawCrop();el('album-crop').showModal();}
  function cropGeometry(){const fw=Math.min(710,420*cropState.aspect),fh=fw/cropState.aspect;return {x:(840-fw)/2,y:(500-fh)/2,width:fw,height:fh};}
  function drawCrop(){
    if(!cropState)return;const c=el('album-crop-canvas'),ctx=c.getContext('2d'),g=cropGeometry(),im=cropState.image,scale=Math.max(g.width/im.naturalWidth,g.height/im.naturalHeight)*cropState.crop.zoom;
    ctx.fillStyle='#e2ddce';ctx.fillRect(0,0,840,500);ctx.drawImage(im,g.x-(im.naturalWidth*scale-g.width)*cropState.crop.x,g.y-(im.naturalHeight*scale-g.height)*cropState.crop.y,im.naturalWidth*scale,im.naturalHeight*scale);
    ctx.fillStyle='rgba(52,62,45,.38)';ctx.fillRect(0,0,840,g.y);ctx.fillRect(0,g.y+g.height,840,500-g.y-g.height);ctx.fillRect(0,g.y,g.x,g.height);ctx.fillRect(g.x+g.width,g.y,840-g.x-g.width,g.height);ctx.strokeStyle='#fffdf0';ctx.lineWidth=2;ctx.strokeRect(g.x,g.y,g.width,g.height);ctx.lineWidth=1;ctx.strokeStyle='rgba(255,251,233,.7)';for(const t of [1/3,2/3]){ctx.beginPath();ctx.moveTo(g.x+g.width*t,g.y);ctx.lineTo(g.x+g.width*t,g.y+g.height);ctx.moveTo(g.x,g.y+g.height*t);ctx.lineTo(g.x+g.width,g.y+g.height*t);ctx.stroke();}
  }
  const cropCanvas=el('album-crop-canvas');let cropDown=null;
  cropCanvas.onpointerdown=event=>{if(!cropState||cropDown)return;cropDown={id:event.pointerId,x:event.clientX,y:event.clientY,crop:{...cropState.crop}};cropCanvas.setPointerCapture(event.pointerId);};
  cropCanvas.onpointermove=event=>{if(!cropDown||!cropState||cropDown.id!==event.pointerId)return;const g=cropGeometry(),im=cropState.image,scale=Math.max(g.width/im.naturalWidth,g.height/im.naturalHeight)*cropState.crop.zoom,ratio=840/cropCanvas.getBoundingClientRect().width,dx=(event.clientX-cropDown.x)*ratio,dy=(event.clientY-cropDown.y)*ratio;const clamp=x=>Math.max(0,Math.min(1,x)),overflowX=im.naturalWidth*scale-g.width,overflowY=im.naturalHeight*scale-g.height;cropState.crop.x=overflowX>.1?clamp(cropDown.crop.x-dx/overflowX):.5;cropState.crop.y=overflowY>.1?clamp(cropDown.crop.y-dy/overflowY):.5;drawCrop();};
  cropCanvas.onpointerup=cropCanvas.onpointercancel=()=>cropDown=null;
  cropCanvas.onkeydown=event=>{if(!cropState)return;const shifts={ArrowLeft:[-.025,0],ArrowRight:[.025,0],ArrowUp:[0,-.025],ArrowDown:[0,.025]};if(shifts[event.key]){event.preventDefault();const [x,y]=shifts[event.key];cropState.crop.x=Math.max(0,Math.min(1,cropState.crop.x+x));cropState.crop.y=Math.max(0,Math.min(1,cropState.crop.y+y));drawCrop();}};
  el('album-crop-zoom').oninput=()=>{if(cropState){cropState.crop.zoom=+el('album-crop-zoom').value;drawCrop();}};el('album-crop-reset').onclick=()=>{if(cropState){cropState.crop={x:.5,y:.5,zoom:1};el('album-crop-zoom').value=1;drawCrop();}};el('album-crop-apply').onclick=()=>{if(cropState&&draftPhotos[cropState.at]){draftPhotos[cropState.at].crop={...cropState.crop};dirty=true;draftThumbnails();schedulePreview();}el('album-crop').close();};
  el('album-crop-close').onclick=el('album-crop-cancel').onclick=()=>el('album-crop').close();el('album-crop').addEventListener('close',()=>{cropState=null;cropDown=null;});
  async function open(updateURL=true,{cover=false}={}){if(opened)return true;if(cover)index=0;opened=true;onOpen();page.hidden=false;if(updateURL&&location.hash!=='#album')history.pushState(null,'','#album');if(!view){try{view=createAlbumScene(el('album-stage'),{onPhoto:at=>{const r=pages[index]?.record;if(r)showPhoto(r,at);},onState:setBusy,onLayout:bounds=>page.style.setProperty('--album-book-bottom',`${bounds.bottom}px`)});}catch(e){console.error(e);toast('当前浏览器无法显示 3D，已使用平面阅读模式。');}}view?.setActive(true);timeline();updateInfo();await paint(pages,index);el('album-add').focus({preventScroll:true});return true;}
  async function close(updateURL=true){if(!opened)return true;if(!await guard())return false;resetEditor();opened=false;page.hidden=true;view?.setActive(false);for(const id of ['album-crop','album-gallery','album-lightbox'])el(id).close();galleryGeneration++;if(updateURL&&location.hash==='#album')history.replaceState(null,'',location.pathname+location.search);onClose();return true;}
  el('album-back').onclick=()=>close();el('album-prev').onclick=()=>changePage(index-1);el('album-next').onclick=()=>changePage(index+1);el('album-year').onchange=renderMonths;el('album-add').onclick=()=>openEditor();el('album-edit').onclick=()=>{const r=pages[index]?.record;if(r)openEditor(r.sample?null:r,r.template);};el('album-delete').onclick=removeStory;el('album-samples').onclick=toggleSamples;
  el('album-cancel').onclick=el('album-close-editor').onclick=closeEditor;el('album-draft-prev').onclick=()=>{draftPart--;preview();};el('album-draft-next').onclick=()=>{draftPart++;preview();};
  if(el('album-templates'))el('album-templates').onclick=()=>showGallery('templates');el('album-overview').onclick=()=>showGallery('overview');el('album-gallery-close').onclick=()=>el('album-gallery').close();el('album-gallery-prev').onclick=()=>{galleryPart--;renderGallery();};el('album-gallery-next').onclick=()=>{galleryPart++;renderGallery();};el('album-gallery').addEventListener('close',()=>galleryGeneration++);
  el('album-lightbox-close').onclick=()=>el('album-lightbox').close();el('album-photo-prev').onclick=()=>nextPhoto(-1);el('album-photo-next').onclick=()=>nextPhoto(1);el('album-backup').onclick=onExport;el('album-import').onclick=async()=>{if(editing&&!await closeEditor())return;onImport();};
  document.addEventListener('keydown',event=>{if(!opened)return;if(el('album-lightbox').open){if(event.key==='ArrowLeft')nextPhoto(-1);if(event.key==='ArrowRight')nextPhoto(1);return;}if(modalOpen())return;if(event.key==='Escape'&&editing){event.preventDefault();closeEditor();}});
  window.addEventListener('beforeunload',event=>{if(dirty||saving){event.preventDefault();event.returnValue='';}});
  rebuild('cover');
  const ready=Promise.all([albumLoad(),albumSamplesHidden()]).then(([list,hidden])=>{records=validAlbums(list);samplesHidden=hidden;loaded=true;rebuild();return true;}).catch(e=>{console.error(e);toast('浏览器存储不可用。请关闭旧版小屋窗口后刷新。');return false;});
  return {open,close,ready,toast,fit:()=>view?.fit(),coverBounds:()=>view?.coverBounds(),isWorking:()=>processing||saving,prepareImport:async()=>{if(saving)return false;return !editing||await closeEditor();},isReady:()=>loaded,isOpen:()=>opened,getRecords:()=>records,replaceRecords:list=>{records=validAlbums(list);rebuild();}};
}
