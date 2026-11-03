export function swapCinemaPhotos(items,from,to){
  const next=[...items];
  if(!Number.isInteger(from)||!Number.isInteger(to)||from<0||from>=items.length||to<0||to>=items.length||from===to)return next;
  [next[from],next[to]]=[next[to],next[from]];return next;
}

export function createCinemaSorter(grid,onMove){
  let drag=null,frame=0;
  const cards=()=>[...grid.querySelectorAll('.cinema-draft-photo')];
  function reset(){
    cancelAnimationFrame(frame);frame=0;
    const current=drag;drag=null;
    current?.ghost?.remove();
    grid.classList.remove('cinema-sorting');
    for(const card of cards())card.classList.remove('cinema-drag-source','cinema-drop-target');
    if(current&&grid.hasPointerCapture(current.id))grid.releasePointerCapture(current.id);
  }
  function target(){
    if(!drag?.active)return;
    const bounds=grid.getBoundingClientRect();let nearest=null,distance=Infinity;
    if(drag.x>=bounds.left&&drag.x<=bounds.right&&drag.y>=bounds.top&&drag.y<=bounds.bottom){
      cards().forEach((card,i)=>{
        const rect=card.getBoundingClientRect(),delta=Math.hypot(drag.x-rect.left-rect.width/2,drag.y-rect.top-rect.height/2);
        if(delta<distance){distance=delta;nearest=i;}
      });
    }
    drag.to=nearest;
    cards().forEach((card,i)=>card.classList.toggle('cinema-drop-target',i===nearest&&i!==drag.from));
  }
  function track(){
    if(!drag?.active)return;
    const bounds=grid.getBoundingClientRect();
    if(drag.x>=bounds.left&&drag.x<=bounds.right&&drag.y>=bounds.top&&drag.y<=bounds.bottom){
      const speed=drag.y<bounds.top+28?-12:drag.y>bounds.bottom-28?12:0;
      const old=grid.scrollTop;grid.scrollTop+=speed;if(old!==grid.scrollTop)target();
    }
    frame=requestAnimationFrame(track);
  }
  grid.addEventListener('pointerdown',event=>{
    if(drag){reset();return;}
    if(!event.isPrimary||event.button!==0||event.target.closest('button')||grid.closest('form')?.inert)return;
    const card=event.target.closest('.cinema-draft-photo');if(!card)return;
    const rect=card.getBoundingClientRect();
    drag={id:event.pointerId,from:cards().indexOf(card),to:null,card,startX:event.clientX,startY:event.clientY,x:event.clientX,y:event.clientY,offsetX:event.clientX-rect.left,offsetY:event.clientY-rect.top,active:false,ghost:null};
    grid.setPointerCapture(event.pointerId);card.focus({preventScroll:true});event.preventDefault();
  });
  grid.addEventListener('pointermove',event=>{
    if(drag?.id!==event.pointerId)return;
    drag.x=event.clientX;drag.y=event.clientY;
    if(!drag.active&&Math.hypot(drag.x-drag.startX,drag.y-drag.startY)>=6){
      drag.active=true;const rect=drag.card.getBoundingClientRect();
      drag.ghost=drag.card.cloneNode(true);drag.ghost.tabIndex=-1;drag.ghost.setAttribute('aria-hidden','true');drag.ghost.classList.add('cinema-drag-ghost');drag.ghost.style.width=rect.width+'px';
      grid.closest('dialog').append(drag.ghost);drag.card.classList.add('cinema-drag-source');grid.classList.add('cinema-sorting');frame=requestAnimationFrame(track);
    }
    if(drag.active){drag.ghost.style.left=drag.x-drag.offsetX+'px';drag.ghost.style.top=drag.y-drag.offsetY+'px';target();event.preventDefault();}
  });
  grid.addEventListener('pointerup',event=>{
    if(drag?.id!==event.pointerId)return;
    drag.x=event.clientX;drag.y=event.clientY;target();
    const {from,to,active}=drag;reset();
    if(active&&to!==null&&from!==to)onMove(from,to);
  });
  grid.addEventListener('pointercancel',reset);
  grid.addEventListener('lostpointercapture',()=>{if(drag)reset();});
  grid.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&drag){event.preventDefault();event.stopPropagation();reset();return;}
    if(drag||event.target.closest('button')||event.altKey||event.ctrlKey||event.metaKey)return;
    const card=event.target.closest('.cinema-draft-photo');if(!card)return;
    const list=cards(),from=list.indexOf(card);
    const columns=Math.max(1,list.filter(item=>Math.abs(item.offsetTop-list[0].offsetTop)<2).length);
    const offsets={ArrowLeft:-1,ArrowRight:1,ArrowUp:-columns,ArrowDown:columns};
    let to;if(event.key in offsets)to=Math.max(0,Math.min(list.length-1,from+offsets[event.key]));else if(event.key==='Home')to=0;else if(event.key==='End')to=list.length-1;else return;
    event.preventDefault();if(from!==to)onMove(from,to,{keyboard:true});
  });
  window.addEventListener('blur',reset);window.addEventListener('resize',reset);
  return {reset};
}
