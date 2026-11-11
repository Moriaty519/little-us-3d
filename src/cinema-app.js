import { createCinemaScene } from './cinema-scene.js';
import { cinemaLoad,cinemaSave,validCinema,CINEMA_PHOTO_LIMIT } from './cinema-storage.js';
import { albumSampleRecords } from './album-pages.js';
import { confirmAction,modalOpen } from './ui.js';
import { createCinemaSorter,moveCinemaPhotos } from './cinema-sort.js';

export function createCinemaApp({compressPhoto,onOpen,onClose,onExport,onImport,onCoverChange=()=>{},getRoomPhotos=()=>[],getAlbumPages=()=>[],namespace='cinema',pageHash='#cinema',sceneFactory=createCinemaScene,loadRecord=cinemaLoad,saveRecord=cinemaSave,validateRecord=validCinema,playlistId='cinema-playlist',allowSamples=true,photoInterval=1000,sceneLabel='客厅投影',musicOnly=false,instrumentSound=false,swipePhotos=true}){
  const el=id=>document.getElementById(id.replace(/^cinema-/,namespace+'-')),page=el('cinema-page'),editor=el('cinema-editor');
  const examples=albumSampleRecords(),samplePhotos=[examples[0].photos[0],examples[2].photos[0],examples[3].photos[0],examples[0].photos[2],examples[0].photos[1],examples[2].photos[1]].map((p,i)=>({id:'cinema-sample-'+i,src:p.src,sample:i}));
  let record=null,draft=null,loaded=false,opened=false,view=null,index=0,playing=false,moving=false,muted=false,audio=null,audioSrc=null,timer=0,nextAt=0,toastTimer=0,generation=0,dirty=false,processing=false,saving=false,displayVersion=0,openVersion=0,renderedPlay=null,renderedMute=null;
  const icon=name=>{const paths={play:'<path d="m7 4 9 6-9 6Z"/>',pause:'<path d="M6 4v12M14 4v12"/>',sound:'<path d="M3 8h3l5-4v12l-5-4H3ZM15 6a6 6 0 0 1 0 8"/>',mute:'<path d="M3 8h3l5-4v12l-5-4H3ZM14 7l4 6M18 7l-4 6"/>'};return `<svg viewBox="0 0 20 20" aria-hidden="true"${name==='play'?' style="fill:currentColor;stroke:none"':''}>${paths[name]}</svg>`;};
  function toast(message){el('cinema-toast').textContent=message;el('cinema-toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el('cinema-toast').classList.remove('show'),3500);}
  function config(){return record||{photos:[],music:null,sampleIds:allowSamples?[0,1,2,3,4,5]:[]};}
  function photosFor(value=config()){return value.photos.length?value.photos:value.sampleIds.map(i=>samplePhotos[i]);}
  async function syncCover(){try{await onCoverChange(photosFor()[0]?.src||null);}catch(reason){console.warn('Projection cover failed to load',reason);}}
  function sync(){
    const photos=photosFor(),hasPhotos=photos.length>0;
    el('cinema-count').textContent=hasPhotos?`${index+1} / ${photos.length}`:'0 / 0';
    // Replacing the button's children while a photo wipe is running can swallow
    // a pointerup on the old SVG. Only refresh the glyph when the state changes.
    if(renderedPlay!==playing){renderedPlay=playing;el('cinema-play').innerHTML=icon(playing?'pause':'play');}
    el('cinema-play').setAttribute('aria-label',playing?'暂停放映':'开始放映');el('cinema-play').setAttribute('aria-pressed',String(playing));
    el('cinema-play').disabled=!hasPhotos&&!(musicOnly&&config().music);el('cinema-prev').disabled=el('cinema-next').disabled=!hasPhotos||photos.length<2||moving;
    if(renderedMute!==muted){renderedMute=muted;el('cinema-mute').innerHTML=icon(muted?'mute':'sound');}
    el('cinema-mute').disabled=!config().music&&!instrumentSound;el('cinema-mute').setAttribute('aria-label',muted?'开启放映音乐':'静音放映音乐');el('cinema-mute').setAttribute('aria-pressed',String(muted));
    el('cinema-empty').hidden=hasPhotos;el('cinema-scene').setAttribute('aria-label',hasPhotos?`${sceneLabel}，照片 ${index+1} / ${photos.length}${photos[index]?.sample!==undefined?'，占位图':''}`:sceneLabel+'，暂无照片');
    for(const dot of el('cinema-dots').children)dot.classList.toggle('selected',Number(dot.dataset.index)===index);
  }
  function dots(){el('cinema-dots').replaceChildren();const list=photosFor();if(list.length>12)return;list.forEach((_,i)=>{const button=document.createElement('button');button.dataset.index=i;button.setAttribute('aria-label','放映第 '+(i+1)+' 张照片');button.onclick=()=>{if(!moving){show(i,true,i>=index?1:-1);if(playing)schedule(true);}};el('cinema-dots').append(button);});}
  function setMusic(){
    const music=config().music;if(music?.src===audioSrc)return;
    if(audio){audio.pause();audio.removeAttribute('src');audio.load();}
    audio=null;audioSrc=music?.src||null;if(music){audio=el('cinema-audio');audio.src=music.src;audio.loop=true;audio.preload='metadata';audio.muted=muted;}
  }
  async function show(target,animate=false,direction=1){
    const list=photosFor();if(!view)return;
    const version=++displayVersion;moving=true;sync();
    try{const destination=list.length?((target%list.length)+list.length)%list.length:0;const success=await view.setPhoto(list[destination]?.src||null,{animate,direction});if(version!==displayVersion||!opened)return;if(success)index=destination;else if(success===false)toast('这张照片无法显示，请替换后重试。');view.preload(list[(index+1)%list.length]?.src);}
    finally{if(version===displayVersion){moving=false;el('cinema-loading').hidden=true;sync();}}
  }
  function schedule(reset=false){clearTimeout(timer);if(!playing||!opened)return;if(reset)nextAt=performance.now()+photoInterval;const wait=Math.max(0,nextAt-performance.now());timer=setTimeout(()=>{if(!playing||!opened)return;if(!moving&&photosFor().length>1)show(index+1,true,1);nextAt+=photoInterval;if(nextAt<performance.now())nextAt=performance.now()+photoInterval;schedule();},wait);}
  function pause(){playing=false;clearTimeout(timer);audio?.pause();view?.stop();sync();}
  function play(){if((!photosFor().length&&!(musicOnly&&config().music))||!opened||editor.open)return;playing=true;if(audio){audio.muted=muted;audio.play().catch(error=>{if(opened&&playing&&error.name!=='AbortError')toast('音乐暂时无法播放，照片仍会继续放映。');});}schedule(true);sync();}
  function step(delta){if(moving)return;show(index+delta,true,delta);if(playing)schedule(true);}
  function error(message){el('cinema-form-error').textContent=message;el('cinema-form-error').hidden=false;}
  const sorter=createCinemaSorter(el('cinema-photo-drafts'),(from,to,{keyboard=false}={})=>{
    if(!draft||processing||saving)return;
    if(draft.photos.length)draft.photos=moveCinemaPhotos(draft.photos,from,to);else draft.sampleIds=moveCinemaPhotos(draft.sampleIds,from,to);
    const landed=from<to?to-1:to;
    dirty=true;renderDraft();const card=el('cinema-photo-drafts').children[landed];card?.focus({preventScroll:true});if(keyboard)card?.scrollIntoView({block:'nearest',inline:'nearest'});
  });
  function renderDraft(){
    sorter.reset();const list=photosFor(draft),grid=el('cinema-photo-drafts'),scrollLeft=grid.scrollLeft;grid.replaceChildren();
    if(!list.length){const empty=document.createElement('p');empty.className='cinema-drafts-empty';empty.textContent='暂无照片';grid.append(empty);}
    list.forEach((photo,i)=>{
      const figure=document.createElement('div');figure.className='cinema-draft-photo';figure.tabIndex=0;figure.setAttribute('role','listitem');figure.dataset.photoId=photo.id;figure.setAttribute('aria-label','第 '+(i+1)+' 张照片，拖动或按方向键交换位置');figure.title='拖动交换位置';const frame=document.createElement('div'),image=document.createElement('img');image.src=photo.src;image.alt='影院照片 '+(i+1);image.draggable=false;frame.append(image);
      const tag=document.createElement('small');tag.textContent=photo.sample!==undefined?'占位图 '+(i+1):String(i+1).padStart(2,'0');frame.append(tag);
      const remove=document.createElement('button');remove.type='button';remove.className='cinema-remove';remove.textContent='×';remove.setAttribute('aria-label','移除第 '+(i+1)+' 张影院照片');remove.onclick=()=>{dirty=true;if(photo.sample!==undefined)draft.sampleIds.splice(i,1);else draft.photos.splice(i,1);renderDraft();};frame.append(remove);figure.append(frame);
      grid.append(figure);
    });
    grid.scrollLeft=scrollLeft;
    el('cinema-samples').hidden=!allowSamples||draft.photos.length>0;el('cinema-samples').textContent=draft.sampleIds.length?'移除占位图':'恢复占位图';
    el('cinema-music-name').textContent=draft.music?.name||'未添加';el('cinema-music-upload').textContent=draft.music?'替换':'添加';el('cinema-music-remove').hidden=!draft.music;
  }
  function openEditor(section='photos'){if(!loaded||saving){toast('本地存储尚未就绪。');return;}pause();generation++;const value=config();draft={photos:value.photos.map(p=>({...p})),music:value.music?{...value.music}:null,sampleIds:[...value.sampleIds]};dirty=false;processing=false;el('cinema-form').inert=false;el('cinema-save').disabled=false;el('cinema-form-error').hidden=true;renderDraft();editor.showModal();el('cinema-photo-drafts').scrollLeft=0;editor.scrollTop=0;(section==='music'?el('cinema-music-upload'):el('cinema-upload')).focus();}
  async function closeEditor(){if(saving)return false;if(dirty&&!await confirmAction('放弃修改？','未保存的内容会丢失。'))return false;editor.close();return true;}
  editor.addEventListener('close',()=>{sorter.reset();generation++;dirty=false;processing=false;draft=null;el('cinema-files').value='';el('cinema-music-file').value='';});
  editor.addEventListener('cancel',event=>{event.preventDefault();closeEditor();});
  el('cinema-editor-close').onclick=el('cinema-cancel').onclick=closeEditor;
  el('cinema-upload').onclick=()=>el('cinema-files').click();
  el('cinema-files').onchange=async()=>{
    const files=[...el('cinema-files').files];if(!files.length||!draft||processing)return;
    if(draft.photos.length+files.length>CINEMA_PHOTO_LIMIT){error('最多添加 60 张照片。');el('cinema-files').value='';return;}
    const token=++generation;dirty=true;processing=true;el('cinema-form').inert=true;el('cinema-save').disabled=true;el('cinema-form-error').hidden=true;
    try{const pictures=[];for(const file of files){const src=await compressPhoto(file);if(token!==generation)return;pictures.push({id:globalThis.crypto?.randomUUID?.()||'cinema-'+Date.now()+'-'+Math.random().toString(36).slice(2),src});}draft.photos.push(...pictures);draft.sampleIds=[];renderDraft();}
    catch(reason){if(token===generation)error(reason.message||'照片处理失败。');}
    finally{if(token===generation){processing=false;el('cinema-form').inert=false;el('cinema-save').disabled=false;el('cinema-files').value='';}}
  };
  function checkAudio(source){return new Promise((resolve,reject)=>{const test=new Audio();let settled=false;const finish=reason=>{if(settled)return;settled=true;clearTimeout(timeout);test.onloadedmetadata=test.onerror=null;test.removeAttribute('src');test.load();reason?reject(new Error('无法读取这首音乐，请换一个 MP3、M4A、WAV 或 OGG 文件。')):resolve();};const timeout=setTimeout(()=>finish(true),15000);test.onloadedmetadata=()=>finish(!Number.isFinite(test.duration)||test.duration<=0);test.onerror=()=>finish(true);test.preload='metadata';test.src=source;});}
  el('cinema-music-upload').onclick=()=>el('cinema-music-file').click();
  el('cinema-music-file').onchange=async()=>{
    const file=el('cinema-music-file').files[0];if(!file||!draft||processing)return;
    const token=++generation;dirty=true;processing=true;el('cinema-form').inert=true;el('cinema-save').disabled=true;el('cinema-form-error').hidden=true;
    try{if(file.size>30*1024*1024)throw new Error('音乐超过 30 MB，请选择小一些的文件。');const fallback={mp3:'audio/mpeg',m4a:'audio/mp4',wav:'audio/wav',ogg:'audio/ogg'},type=file.type||fallback[file.name.split('.').pop().toLowerCase()];if(!['audio/mpeg','audio/mp4','audio/x-m4a','audio/wav','audio/x-wav','audio/ogg'].includes(type))throw new Error('请选择 MP3、M4A、WAV 或 OGG 音乐。');const source=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve('data:'+type+';base64,'+String(reader.result).split(',')[1]);reader.onerror=()=>reject(new Error('读取音乐失败。'));reader.readAsDataURL(file);});await checkAudio(source);if(token!==generation)return;draft.music={name:file.name.slice(0,180),type,src:source};renderDraft();}
    catch(reason){if(token===generation)error(reason.message||'音乐处理失败。');}
    finally{if(token===generation){processing=false;el('cinema-form').inert=false;el('cinema-save').disabled=false;el('cinema-music-file').value='';}}
  };
  el('cinema-music-remove').onclick=()=>{draft.music=null;dirty=true;renderDraft();};
  el('cinema-samples').onclick=()=>{draft.sampleIds=draft.sampleIds.length?[]:[0,1,2,3,4,5];dirty=true;renderDraft();};
  el('cinema-reverse').onclick=()=>{if(!draft||processing||saving)return;sorter.reset();if(draft.photos.length)draft.photos.reverse();else draft.sampleIds.reverse();dirty=true;renderDraft();el('cinema-photo-drafts').scrollLeft=0;};
  el('cinema-form').onsubmit=async event=>{
    event.preventDefault();if(saving||processing||!draft)return;saving=true;el('cinema-form').inert=true;el('cinema-save').disabled=true;
    try{const next=validateRecord({id:playlistId,...draft,updatedAt:new Date().toISOString()});await saveRecord(next);record=next;index=0;dirty=false;editor.close();setMusic();dots();await Promise.all([syncCover(),show(0)]);toast('已保存');}
    catch(reason){error(reason.name==='QuotaExceededError'?'存储空间不足，请先备份并整理照片。':reason.message||'保存失败，请重试。');}
    finally{saving=false;el('cinema-form').inert=false;el('cinema-save').disabled=false;sync();}
  };
  async function open(updateURL=true){
    if(updateURL){location.hash=pageHash;return;}if(opened)return;
    const version=++openVersion;
    opened=true;index=0;page.hidden=false;onOpen();dots();sync();await ready;if(!opened||version!==openVersion)return;
    try{
      const [photos,albumPages]=await Promise.all([getRoomPhotos(),getAlbumPages()]);if(!opened||version!==openVersion)return;
      view||=sceneFactory(el('cinema-scene'));view.setActive(true);
      await Promise.all([view.setPhotos(photos),view.setAlbumPages(albumPages),show(0)]);
      if(opened&&version===openVersion)el('cinema-play').focus({preventScroll:true});
    }catch(reason){if(!opened||version!==openVersion)return;console.error(reason);el('cinema-loading').hidden=false;el('cinema-loading').textContent='无法显示 3D 空间，请开启浏览器硬件加速后刷新。';}
  }
  async function close(updateURL=true){if(!opened)return true;if(editor.open&&!await closeEditor())return false;openVersion++;pause();displayVersion++;moving=false;view?.setActive(false);opened=false;page.hidden=true;if(updateURL)history.replaceState(null,'',location.pathname+location.search);onClose();return true;}
  el('cinema-edit').onclick=el('cinema-empty-add').onclick=()=>openEditor();el('cinema-back').onclick=()=>close();el('cinema-play').onclick=()=>playing?pause():play();el('cinema-prev').onclick=()=>step(-1);el('cinema-next').onclick=()=>step(1);el('cinema-mute').onclick=()=>{muted=!muted;if(audio)audio.muted=muted;sync();};el('cinema-backup').onclick=onExport;el('cinema-import').onclick=onImport;
  document.addEventListener('keydown',event=>{if(!opened||modalOpen()||event.altKey||event.ctrlKey||event.metaKey)return;if(event.key==='ArrowLeft'){event.preventDefault();step(-1);}if(event.key==='ArrowRight'){event.preventDefault();step(1);}if(event.code==='Space'&&event.target.tagName!=='BUTTON'){event.preventDefault();playing?pause():play();}if(event.key==='Escape')close();});
  let touch=null;el('cinema-scene').addEventListener('pointerdown',event=>{if(!swipePhotos)return;if(touch){touch=null;return;}if(event.isPrimary)touch={id:event.pointerId,x:event.clientX,y:event.clientY};});el('cinema-scene').addEventListener('pointercancel',()=>touch=null);el('cinema-scene').addEventListener('pointerup',event=>{const start=touch;touch=null;if(!start||start.id!==event.pointerId||!opened||modalOpen())return;const dx=event.clientX-start.x,dy=event.clientY-start.y;if(Math.abs(dx)>45&&Math.abs(dx)>Math.abs(dy)*1.5)step(dx<0?1:-1);});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&opened)pause();});window.addEventListener('beforeunload',event=>{if(dirty||saving){event.preventDefault();event.returnValue='';}});
  const ready=loadRecord().then(async value=>{record=value;loaded=true;setMusic();dots();sync();await syncCover();}).catch(reason=>{console.error(reason);toast('浏览器存储不可用，放映照片暂时无法保存。');syncCover();});
  sync();return {open,close,ready,toast,openEditor,togglePlay:()=>playing?pause():play(),step,fit:()=>view?.fit(),isOpen:()=>opened,isReady:()=>loaded,isWorking:()=>processing||saving,getRecord:()=>record,prepareImport:async()=>{pause();return !editor.open||await closeEditor();},checkMusic:async value=>{if(value?.music)await checkAudio(value.music.src);},replaceRecord:async value=>{pause();record=value;index=0;setMusic();dots();await Promise.all([syncCover(),opened?show(0):Promise.resolve()]);sync();}};
}
