import { createKtvScene } from './ktv-scene.js';
import { ktvLoad,ktvSave,validKtv } from './ktv-storage.js';
import { createGuitarStrummer } from './ktv-chords.js';
import { confirmAction,modalOpen } from './ui.js';

const VIDEO_EXTENSIONS={mp4:'video/mp4',m4v:'video/x-m4v',webm:'video/webm',ogv:'video/ogg',ogg:'video/ogg',mov:'video/quicktime'};

export function createKtvApp({onOpen,onClose,onExport,onImport}){
  const el=id=>document.getElementById('ktv-'+id),page=el('page'),editor=el('editor');
  const glyph=name=>`<svg viewBox="0 0 20 20" aria-hidden="true">${{play:'<path d="m7 4 9 6-9 6Z"/>',pause:'<path d="M6 4v12M14 4v12"/>',sound:'<path d="M3 8h3l5-4v12l-5-4H3ZM15 6a6 6 0 0 1 0 8"/>',mute:'<path d="M3 8h3l5-4v12l-5-4H3ZM14 7l4 6M18 7l-4 6"/>'}[name]}</svg>`;
  let record=null,view=null,opened=false,loaded=false,arrived=false,screenView=false,playing=false,videoMuted=false,toastTimer=0,openVersion=0,draft=null,dirty=false,processing=false,saving=false,generation=0,writeQueue=Promise.resolve(),renderedPlay=null,renderedMute=null,videoTimer=0;
  try{videoMuted=localStorage.getItem('little-us-ktv-video-muted')==='true';}catch{}
  const strummer=createGuitarStrummer(window.AudioContext||window.webkitAudioContext);
  const config=()=>record||{id:'ktv-playlist',video:null,updatedAt:new Date().toISOString()};
  function toast(message){el('toast').textContent=message;el('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el('toast').classList.remove('show'),3500);}
  function write(value){const task=writeQueue.then(()=>ktvSave(value));writeQueue=task.catch(()=>{});return task;}
  function timeLabel(seconds){const value=Math.max(0,Math.floor(Number(seconds)||0));return `${Math.floor(value/60)}:${String(value%60).padStart(2,'0')}`;}
  function updateVideoTime(){const time=view?.videoTime?.();if(time)el('video-time').textContent=time.duration?`${timeLabel(time.current)} / ${timeLabel(time.duration)}`:'';}
  function stopVideoTicker(){clearInterval(videoTimer);videoTimer=0;}
  function startVideoTicker(){
    stopVideoTicker();
    videoTimer=setInterval(()=>{
      if(!opened||!screenView){stopVideoTicker();return;}
      const still=!!view?.videoPlaying?.();
      if(still!==playing){playing=still;sync();if(!still)stopVideoTicker();}
      updateVideoTime();
    },250);
  }
  function sync(){
    const video=config().video;
    if(renderedPlay!==playing){renderedPlay=playing;el('video-play').innerHTML=glyph(playing?'pause':'play');}
    el('video-play').disabled=!video;el('video-play').setAttribute('aria-label',playing?'暂停视频':'播放视频');el('video-play').setAttribute('aria-pressed',String(playing));
    if(renderedMute!==videoMuted){renderedMute=videoMuted;el('video-mute').innerHTML=glyph(videoMuted?'mute':'sound');}
    el('video-mute').disabled=!video;el('video-mute').setAttribute('aria-label',videoMuted?'开启视频声音':'静音视频');el('video-mute').setAttribute('aria-pressed',String(videoMuted));
    el('screen-back').hidden=!screenView;el('video-name').textContent=video?.name||'';
    page.classList.toggle('ktv-screen-view',screenView);
    el('edit').setAttribute('aria-label',video?'更换视频':'上传视频');el('edit').title=video?'更换视频':'上传视频';
    el('scene').setAttribute('aria-label',`三维 KTV${video?'，已上传视频 '+video.name:'，还没有视频'}。点击屏幕正面观看视频，点击吉他拨弦。`);
    updateVideoTime();
  }
  function enterScreenView(){
    if(!opened||modalOpen()||screenView)return;
    screenView=true;playing=false;view?.setScreenView(true);page.classList.add('ktv-screen-view');sync();
    el('video-play').focus({preventScroll:true});
    if(!config().video)toast('还没有视频，点右上角“上传视频”添加。');
  }
  function leaveScreenView(){
    if(!screenView)return;
    view?.pauseVideo();view?.setScreenView(false);screenView=false;playing=false;stopVideoTicker();page.classList.remove('ktv-screen-view');sync();
    el('edit').focus({preventScroll:true});
  }
  async function playVideo(){
    if(!screenView||!config().video)return;
    const success=await view?.playVideo();
    if(!success){toast('视频暂时无法播放，请换一个 MP4 或 WebM 文件。');playing=false;sync();return;}
    playing=true;sync();startVideoTicker();
  }
  function pauseVideo(){view?.pauseVideo();playing=false;stopVideoTicker();sync();}
  function toggleVideo(){playing?pauseVideo():playVideo();}
  function probeVideo(src){
    return new Promise((resolve,reject)=>{
      const test=document.createElement('video');test.preload='metadata';test.muted=true;let settled=false;
      const finish=(error,duration=0)=>{if(settled)return;settled=true;clearTimeout(timer);test.onloadedmetadata=test.onerror=null;test.removeAttribute('src');test.load();error?reject(error):resolve(duration);};
      const timer=setTimeout(()=>finish(new Error('读取视频超时，请换一个 MP4 或 WebM 文件。')),20000);
      test.onloadedmetadata=()=>finish(null,Number.isFinite(test.duration)?test.duration:0);
      test.onerror=()=>finish(new Error('无法读取这个视频，请换一个 MP4、WebM 或 OGG 文件。'));
      test.src=src;
    });
  }
  async function readVideo(file){
    const ext=file.name.split('.').pop().toLowerCase(),type=(file.type||VIDEO_EXTENSIONS[ext]||'').split(';')[0].trim();
    if(!type.startsWith('video/'))throw new Error('请选择视频文件（MP4 / WebM / OGG / MOV）。');
    const src=await new Promise((resolve,reject)=>{
      const reader=new FileReader();
      reader.onprogress=event=>{if(event.lengthComputable)el('upload-status').textContent=`正在读取视频… ${Math.round(event.loaded/event.total*100)}%`;};
      reader.onload=()=>resolve(String(reader.result));
      reader.onerror=()=>reject(new Error('无法读取这个视频文件。'));
      reader.readAsDataURL(file);
    });
    const duration=await probeVideo(src);
    return {name:file.name.slice(0,180),type,size:file.size,src,...(duration>0?{duration}:{})};
  }
  function renderDraft(){
    const box=el('video-draft'),video=draft?.video,upload=el('upload');
    box.replaceChildren();el('upload-status').textContent='';
    upload.textContent=video?'更换视频':'选择视频';
    if(!video){const empty=document.createElement('p');empty.className='ktv-video-empty';empty.textContent='还没有视频';box.append(empty);return;}
    const name=document.createElement('strong');name.textContent=video.name;
    const meta=document.createElement('small');meta.textContent=[video.type.replace('video/','').toUpperCase(),video.size?`${(video.size/1024/1024).toFixed(1)} MB`:'',video.duration?timeLabel(video.duration):''].filter(Boolean).join(' · ');
    const remove=document.createElement('button');remove.type='button';remove.className='close-button';remove.setAttribute('aria-label','移除视频');remove.textContent='×';remove.onclick=()=>{draft.video=null;dirty=true;renderDraft();};
    const copy=document.createElement('div');copy.append(name,meta);box.append(copy,remove);
  }
  function openEditor(){
    if(!loaded||saving){toast('本地存储尚未就绪。');return;}
    if(processing)return;
    view?.pauseVideo();playing=false;stopVideoTicker();generation++;
    draft={video:config().video?{...config().video}:null};dirty=false;processing=false;
    el('form').inert=false;el('save').disabled=false;el('form-error').hidden=true;
    renderDraft();editor.showModal();el('upload').focus();
  }
  async function closeEditor(){if(saving)return false;if(dirty&&!await confirmAction('放弃修改？','未保存的内容会丢失。'))return false;editor.close();return true;}
  editor.addEventListener('cancel',event=>{event.preventDefault();closeEditor();});
  editor.addEventListener('close',()=>{generation++;draft=null;dirty=false;processing=false;el('files').value='';el('upload-status').textContent='';sync();});
  el('editor-close').onclick=el('cancel').onclick=closeEditor;
  function error(message){el('form-error').textContent=message;el('form-error').hidden=false;}
  el('upload').onclick=()=>el('files').click();
  el('files').onchange=async()=>{
    const file=el('files').files[0];if(!file||!draft||processing)return;
    const token=++generation;dirty=true;processing=true;el('form').inert=true;el('save').disabled=true;el('form-error').hidden=true;el('upload-status').textContent='正在读取视频…';
    try{const video=await readVideo(file);if(token!==generation)return;draft.video=video;renderDraft();toast('视频已添加，记得保存。');}
    catch(reason){if(token===generation)error(reason.message||'视频读取失败，请重试。');}
    finally{if(token===generation){processing=false;el('form').inert=false;el('save').disabled=false;el('files').value='';el('upload-status').textContent='';}}
  };
  el('form').onsubmit=async event=>{
    event.preventDefault();if(saving||processing||!draft)return;saving=true;el('form').inert=true;el('save').disabled=true;
    try{const next=validKtv({id:'ktv-playlist',video:draft.video,updatedAt:new Date().toISOString()});await write(next);record=next;dirty=false;editor.close();view?.pauseVideo();playing=false;await view?.setVideo(next.video?.src||null);view?.setVideoMuted(videoMuted);sync();toast(next.video?'视频已保存':'已移除视频');}
    catch(reason){error(reason.name==='QuotaExceededError'?'存储空间不足，请先导出备份并整理视频。':reason.message||'保存失败，请重试。');}
    finally{saving=false;el('form').inert=false;el('save').disabled=false;sync();}
  };
  async function open(updateURL=true){
    if(updateURL){location.hash='#ktv';return;}if(opened)return;
    const token=++openVersion;opened=true;arrived=false;screenView=false;playing=false;page.hidden=false;onOpen();await ready;if(!opened||token!==openVersion)return;
    try{
      view||=createKtvScene(el('scene'),select);view.setActive(true);
      el('loading').hidden=false;el('loading').textContent='正在准备包间…';
      const success=await view.setVideo(config().video?.src||null);
      if(!success&&config().video)toast('视频暂时无法显示，请重新上传。');
      view.setVideoMuted(videoMuted);el('loading').hidden=true;sync();
      if(opened&&token===openVersion)el('edit').focus({preventScroll:true});
    }catch(reason){console.error(reason);el('loading').hidden=false;el('loading').textContent='无法显示 3D KTV，请开启硬件加速后刷新。';}
  }
  async function close(updateURL=true){
    if(!opened)return true;if(editor.open&&!await closeEditor())return false;
    openVersion++;opened=false;arrived=false;screenView=false;playing=false;stopVideoTicker();view?.pauseVideo();view?.stopVideo();strummer.stop();
    page.classList.remove('ktv-screen-view');page.hidden=true;view?.setActive(false);
    if(updateURL)history.replaceState(null,'',location.pathname+location.search);onClose();return true;
  }
  function select(id){
    if(page.inert||!opened||modalOpen())return;
    if(id==='screen'){enterScreenView();return;}
    if(id==='guitar'){view?.pluck();el('scene').dataset.chord=strummer.strum();}
  }
  el('back').onclick=()=>close();el('edit').onclick=openEditor;el('screen-back').onclick=leaveScreenView;el('video-play').onclick=toggleVideo;
  el('video-mute').onclick=()=>{videoMuted=!videoMuted;view?.setVideoMuted(videoMuted);try{localStorage.setItem('little-us-ktv-video-muted',String(videoMuted));}catch{}sync();};
  el('backup').onclick=onExport;el('import').onclick=onImport;
  el('light').onclick=()=>{const warm=view?.toggleLight();el('light').setAttribute('aria-pressed',String(!warm));};
  el('zoom-in').onclick=()=>view?.zoom(1.15);el('zoom-out').onclick=()=>view?.zoom(1/1.15);el('reset').onclick=()=>view?.reset();
  document.addEventListener('keydown',event=>{
    if(!opened||page.inert||event.altKey||event.ctrlKey||event.metaKey)return;
    if(modalOpen())return;
    if(event.key==='Escape'){if(screenView){event.preventDefault();leaveScreenView();}else close();return;}
    if(event.code==='Space'&&screenView&&!['BUTTON','INPUT','TEXTAREA'].includes(event.target.tagName)){event.preventDefault();toggleVideo();}
  });
  document.addEventListener('visibilitychange',()=>{if(document.hidden){view?.pauseVideo();playing=false;stopVideoTicker();strummer.stop();sync();}});
  window.addEventListener('beforeunload',event=>{if(dirty||saving){event.preventDefault();event.returnValue='';}});
  const ready=ktvLoad().then(value=>{record=value;loaded=true;sync();}).catch(reason=>{console.error(reason);toast('浏览器存储不可用，KTV 内容暂时无法保存。');});sync();
  return {
    open,close,ready,toast,fit:()=>view?.fit(),isOpen:()=>opened,isReady:()=>loaded,isWorking:()=>processing||saving,getRecord:()=>record,
    guitarBounds:()=>view?.guitarBounds(),arrivalProgress:p=>{view?.entranceProgress(p);if(p===1)arrived=true;},
    prepareImport:async()=>{if(editor.open&&!await closeEditor())return false;view?.pauseVideo();playing=false;stopVideoTicker();await writeQueue;return true;},
    checkVideo:async value=>{if(value?.video)await probeVideo(value.video.src);},
    replaceRecord:async value=>{view?.pauseVideo();playing=false;stopVideoTicker();record=validKtv(value);if(opened){await view?.setVideo(record?.video?.src||null);view?.setVideoMuted(videoMuted);}sync();}
  };
}
