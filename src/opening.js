// A hinged 3D letter carries the live room, then the same canvas enters home.
export function createOpening({room,roomContainer,onComplete}){
  const el=id=>document.getElementById(id),root=el('opening-page'),slot=el('opening-room-slot'),flight=el('opening-flight');
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
  let phase='sealed',sequence=0;
  function layout(){
    if(!room)return;
    const point=room.openingAnchor(),box=slot.getBoundingClientRect();
    el('opening-seal').style.left=box.left+point.x+'px';el('opening-seal').style.top=box.top+point.y+'px';
  }
  function animate(duration,draw,token){
    return new Promise(resolve=>{
      if(reduced.matches||!duration){if(token!==sequence){resolve(false);return;}draw(1);resolve(true);return;}
      let start=null;
      const frame=time=>{if(token!==sequence){resolve(false);return;}start??=time;const p=Math.min(1,(time-start)/duration);draw(p);if(p<1)requestAnimationFrame(frame);else resolve(true);};
      requestAnimationFrame(frame);
    });
  }
  function finish(){
    sequence++;phase='closed';root.hidden=true;root.classList.remove('opening-open','opening-unfolding','opening-entering');flight.hidden=true;
    room?.endOpening();room?.present(roomContainer,false);room?.setActive(true);el('app').inert=false;onComplete();
    el('app').classList.add('room-arriving');
    if(!el('app').hidden)el('opening-replay').focus({preventScroll:true});
  }
  async function openLetter(){
    if(phase!=='sealed')return;phase='opening';const token=++sequence;el('opening-seal').disabled=true;root.classList.add('opening-unfolding');
    const done=await animate(4600,p=>{room?.unfold(p);if(p>.78){root.classList.add('opening-open');el('opening-letter').setAttribute('aria-hidden','false');}},token);
    if(done)await enter(token);
  }
  async function enter(token){
    if(phase!=='opening'||token!==sequence)return;phase='entering';flight.hidden=false;
    room?.present(flight,true);root.classList.add('opening-entering');
    const done=await animate(1250,p=>room?.openingTransition(p*p*(3-2*p)),token);
    if(done)finish();
  }
  function skip(){if(phase==='closed')return;finish();}
  function start(){
    if(phase==='opening'||phase==='entering')return;
    sequence++;phase='sealed';root.hidden=false;flight.hidden=true;root.classList.remove('opening-open','opening-unfolding','opening-entering');el('opening-seal').disabled=false;el('opening-letter').setAttribute('aria-hidden','true');el('app').inert=true;el('app').classList.remove('room-arriving');
    room?.reset();room?.present(slot,true);room?.beginOpening();room?.setActive(true);layout();el('opening-seal').focus({preventScroll:true});
  }
  slot.onclick=openLetter;el('opening-seal').onclick=openLetter;
  document.addEventListener('keydown',event=>{
    if(phase==='closed')return;
    if(event.key==='Escape'){event.preventDefault();skip();return;}
    if(event.key==='Tab'){
      const buttons=[...root.querySelectorAll('button:not(:disabled)')].filter(button=>button.getClientRects().length&&getComputedStyle(button).visibility!=='hidden');
      const first=buttons[0],last=buttons.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
    }
  });
  window.addEventListener('resize',()=>{if(phase==='sealed')requestAnimationFrame(layout);});
  el('opening-room-fallback').hidden=!!room;root.classList.toggle('opening-fallback',!room);start();
  return {start,skip,isActive:()=>phase!=='closed',isAnimating:()=>phase==='opening'||phase==='entering'};
}
