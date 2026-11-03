import * as THREE from 'three';
import { cinemaContain } from './cinema-frame.js';

// One local video, drawn into the KTV screen texture. The video element also
// owns the audio, so play/pause stays in sync with what the screen shows.
export function createKtvVideo(renderer,onChange){
  const canvas=document.createElement('canvas');canvas.width=1280;canvas.height=660;
  const W=canvas.width,H=canvas.height,ctx=canvas.getContext('2d');
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  texture.anisotropy=renderer.capabilities.getMaxAnisotropy();
  const video=document.createElement('video');
  video.playsInline=true;video.setAttribute('playsinline','');video.preload='auto';video.loop=false;
  let source=null,ready=false,raf=0,generation=0;
  function changed(){texture.needsUpdate=true;onChange?.();}
  function placeholder(){
    ctx.fillStyle='#e8e1cf';ctx.fillRect(0,0,W,H);
    const gradient=ctx.createRadialGradient(W/2,H/2,12,W/2,H/2,W*.62);
    gradient.addColorStop(0,'#f3eddd');gradient.addColorStop(1,'#ddd4bd');ctx.fillStyle=gradient;ctx.fillRect(0,0,W,H);
    ctx.fillStyle='#9aa98a';ctx.beginPath();
    const s=42;ctx.moveTo(W/2-s*.42,H/2-s*.62);ctx.lineTo(W/2+s*.62,H/2);ctx.lineTo(W/2-s*.42,H/2+s*.62);ctx.closePath();ctx.fill();
    changed();
  }
  function paint(){
    ctx.clearRect(0,0,W,H);
    if(!ready||!video.videoWidth){placeholder();return;}
    ctx.fillStyle='#20271e';ctx.fillRect(0,0,W,H);
    const cover=Math.max(W/video.videoWidth,H/video.videoHeight);
    ctx.save();ctx.filter='blur(30px)';ctx.globalAlpha=.3;
    ctx.drawImage(video,(W-video.videoWidth*cover)/2,(H-video.videoHeight*cover)/2,video.videoWidth*cover,video.videoHeight*cover);ctx.restore();
    ctx.fillStyle='#1b221a6b';ctx.fillRect(0,0,W,H);
    const r=cinemaContain(video.videoWidth,video.videoHeight,W,H);ctx.drawImage(video,r.x,r.y,r.width,r.height);
    changed();
  }
  function stopPainting(){cancelAnimationFrame(raf);raf=0;}
  function loop(){
    stopPainting();
    const tick=()=>{if(video.paused||video.ended){raf=0;return;}paint();raf=requestAnimationFrame(tick);};
    raf=requestAnimationFrame(tick);
  }
  function detach(){stopPainting();video.pause();video.removeAttribute('src');video.load();ready=false;source=null;}
  async function setVideo(src){
    const token=++generation;detach();
    if(!src){paint();return true;}
    source=src;video.src=src;video.load();
    try{
      await new Promise((resolve,reject)=>{
        let settled=false,timer=0;
        const cleanup=()=>{clearTimeout(timer);video.removeEventListener('loadeddata',done);video.removeEventListener('error',fail);};
        const done=()=>{if(settled)return;settled=true;cleanup();resolve();};
        const fail=()=>{if(settled)return;settled=true;cleanup();reject(new Error('无法读取这个视频。'));};
        if(video.readyState>=2)done();else{video.addEventListener('loadeddata',done,{once:true});video.addEventListener('error',fail,{once:true});}
        timer=setTimeout(fail,15000);
      });
      if(token!==generation)return false;
      ready=true;
      try{video.currentTime=0;}catch{}
      paint();
      return true;
    }catch{
      if(token===generation){ready=false;source=null;paint();}
      return false;
    }
  }
  async function play(){
    if(!ready||!source)return false;
    if(video.ended)video.currentTime=0;
    try{await video.play();loop();return true;}catch{return false;}
  }
  function pause(){video.pause();stopPainting();if(ready)paint();}
  function stop(){pause();}
  function setMuted(value){video.muted=!!value;}
  function getTime(){return {current:Number.isFinite(video.currentTime)?video.currentTime:0,duration:Number.isFinite(video.duration)?video.duration:0};}
  paint();
  return {texture,setVideo,play,pause,stop,setMuted,getTime,isPlaying:()=>!video.paused&&!video.ended,hasVideo:()=>!!source&&ready,getSource:()=>source,video};
}
