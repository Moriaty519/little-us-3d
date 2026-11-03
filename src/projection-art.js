import * as THREE from 'three';
import { cinemaContain,cinemaFilmOffsets } from './cinema-frame.js';

// Both views use the same projection surface, including portrait-photo fill.
export function createProjectionPlayer(renderer,onChange){
  const canvas=document.createElement('canvas');canvas.width=1640;canvas.height=845;
  const W=canvas.width,H=canvas.height;
  const ctx=canvas.getContext('2d'),texture=new THREE.CanvasTexture(canvas);
  texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=renderer.capabilities.getMaxAnisotropy();
  const cache=new Map(),reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
  let sequence=0,current=null,currentSource=null,animation=null,frameId=0;
  function imageFor(src){
    if(!src)return Promise.resolve(null);if(cache.has(src))return cache.get(src);
    const task=new Promise(resolve=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>{cache.delete(src);resolve(null);};image.src=src;});
    cache.set(src,task);if(cache.size>6)cache.delete(cache.keys().next().value);return task;
  }
  function drawImage(image,offset=0){
    ctx.save();ctx.translate(offset,0);ctx.fillStyle='#f1ebd8';ctx.fillRect(0,0,W,H);
    if(image){
      const cover=Math.max(W/image.width,H/image.height);
      ctx.save();ctx.filter='blur(32px)';ctx.globalAlpha=.35;
      ctx.drawImage(image,(W-image.width*cover)/2,(H-image.height*cover)/2,image.width*cover,image.height*cover);ctx.restore();
      ctx.fillStyle='#f1ebd850';ctx.fillRect(0,0,W,H);
      const r=cinemaContain(image.width,image.height,W,H);ctx.drawImage(image,r.x,r.y,r.width,r.height);
    }
    ctx.restore();
  }
  function changed(){texture.needsUpdate=true;onChange();}
  function paint(image){drawImage(image);changed();}
  function stop(){
    sequence++;cancelAnimationFrame(frameId);
    if(animation){current=animation.next;currentSource=animation.src;paint(current);animation.resolve(true);animation=null;}
  }
  async function setPhoto(src,{animate=false,direction=1}={}){
    stop();const token=sequence,next=await imageFor(src);if(token!==sequence)return null;if(src&&!next)return false;
    if(!src||!animate||!current||reduced.matches){current=next;currentSource=src;paint(current);return true;}
    return new Promise(resolve=>{
      const previous=current;animation={next,src,resolve};let started=null;
      const frame=time=>{
        if(token!==sequence)return;started??=time;const progress=Math.min(1,(time-started)/180),offsets=cinemaFilmOffsets(progress,W,direction);
        ctx.clearRect(0,0,W,H);drawImage(previous,offsets.previous);drawImage(next,offsets.next);
        if(progress<1){
          // A clean wipe between two photos: no top/bottom film rail or sprocket holes.
          ctx.fillStyle='#26301e';ctx.fillRect(offsets.seam-10,0,20,H);
        }
        changed();
        if(progress<1)frameId=requestAnimationFrame(frame);else{current=next;currentSource=src;animation=null;paint(current);resolve(true);}
      };frameId=requestAnimationFrame(frame);
    });
  }
  paint(null);
  return {texture,setPhoto,stop,preload:src=>imageFor(src),getSource:()=>currentSource};
}
