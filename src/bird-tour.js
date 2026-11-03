export const BIRD_TOUR_STOPS=[
  {id:'bird',name:'小木屋',text:'这是我的小木屋。点击它，可以打开这里的回忆，也可以添一段新的故事。'},
  {id:'photos',name:'照片墙',text:'照片墙里藏着我们的相册。点击进入，可以翻看照片、写故事，收藏每个小日常。'},
  {id:'guitar',name:'吉他',text:'点击这把吉他，就能进入 KTV。可以添加照片、点歌听音乐，还能拨一拨吉他。'},
  {id:'map',name:'地图',text:'点击地图，进入我们的足迹。选一座城市，记录去过的地方和旅途中的照片。'},
  {id:'screen',name:'幕布',text:'点击幕布，进入客厅投影。把喜欢的照片放进清单，坐下来慢慢看。'}
];

export function createBirdTour({room,home}){
  const get=id=>document.getElementById(id),cue=get('bird-tour-cue'),panel=get('bird-tour-panel');
  const title=get('bird-tour-title'),copy=get('bird-tour-copy'),progress=get('bird-tour-progress'),next=get('bird-tour-next'),prev=get('bird-tour-prev'),skip=get('bird-tour-skip'),startBtn=get('bird-tour-start'),exploreBtn=get('bird-tour-explore');
  let state='hidden',index=-1,frame=0,token=0,previousFocus=null,direction=1;
  function highlight(id){document.querySelectorAll('[data-object]').forEach(el=>el.classList.toggle('tour-target',el.dataset.object===id));}
  function layout(){
    frame=0;if(state==='hidden'||home.hidden)return;
    if(state==='flying'){frame=requestAnimationFrame(layout);return;}
    const w=home.clientWidth,h=home.clientHeight,stop=BIRD_TOUR_STOPS[index];
    const a=room.birdTourAnchor(state==='stop'?stop?.id:null,w,h);if(!a)return;
    const x=Math.max(22,Math.min(w-22,a.bird.x)),y=Math.max(90,Math.min(h-100,a.bird.y));
    if(state==='cue'){
      const cw=cue.offsetWidth,ch=cue.offsetHeight;cue.style.left=Math.max(12,Math.min(w-cw-12,x-cw/2))+'px';cue.style.top=Math.max(95,y-ch-18)+'px';
    }else{
      const pw=panel.offsetWidth,ph=panel.offsetHeight;
      let px,py;
      if(w<=700){px=(w-pw)/2;py=h-ph-90;}
      else{
        const right=Math.max(x+45,(a.target?.right??x)+32),left=Math.min(x-45,(a.target?.left??x)-32)-pw;
        px=right+pw<=w-28?right:left>=28?left:Math.max(28,Math.min(w-pw-28,x+45));
        py=Math.max(100,Math.min(h-ph-96,y-ph/2));
      }
      panel.style.left=px+'px';panel.style.top=py+'px';
    }
    frame=requestAnimationFrame(layout);
  }
  function animateLayout(){if(!frame)frame=requestAnimationFrame(layout);}
  function setNextLabel(label){next.textContent=label;next.setAttribute('aria-label',label==='完成'?'完成导览':'下一步');}
  function showCue(){if(state!=='hidden'||!room||home.hidden)return;state='cue';cue.hidden=false;home.classList.add('bird-tour-visible');room.birdTourCue(true);animateLayout();}
  function dismissCue(){
    if(state!=='cue')return;
    ++token;state='hidden';index=-1;cancelAnimationFrame(frame);frame=0;
    cue.hidden=true;home.classList.remove('bird-tour-visible');highlight(null);room?.birdTourCue(false);
    get('home').focus({preventScroll:true});
  }
  function cancel({focus=false}={}){
    ++token;state='hidden';index=-1;cancelAnimationFrame(frame);frame=0;
    cue.hidden=true;panel.hidden=true;skip.hidden=true;home.classList.remove('bird-tour-visible','bird-tour-open');highlight(null);setNextLabel('下一步');
    room?.endBirdTour();room?.birdTourCue(false);
    if(focus&&previousFocus?.isConnected&&!previousFocus.closest('[hidden]'))previousFocus.focus({preventScroll:true});
  }
  function travel(destination){
    const current=++token;state='flying';panel.dataset.state=state;panel.hidden=true;highlight(null);next.disabled=true;prev.disabled=true;skip.focus({preventScroll:true});
    const started=room.flyBirdTour(destination,()=>{
      if(current!==token)return;
      panel.hidden=false;next.disabled=false;
      if(destination==='home'){
        state='done';panel.dataset.state=state;title.textContent='小屋交给你啦';copy.textContent='我回到小木屋了。现在可以自由点击家具，探索我们的故事。点完成结束导览，也可以回到上一步。';progress.textContent='导览完成';prev.disabled=false;setNextLabel('完成');
      }else{
        state='stop';panel.dataset.state=state;const stop=BIRD_TOUR_STOPS[index];
        title.textContent=stop.name;copy.textContent=stop.text;progress.textContent=`${index+1} / ${BIRD_TOUR_STOPS.length}`;
        prev.disabled=index===0;highlight(stop.id);setNextLabel('下一步');
      }
      (direction<0&&!prev.disabled?prev:next).focus({preventScroll:true});
    });
    if(!started)cancel();
  }
  function start(){
    if(!['cue','hidden'].includes(state)||home.hidden||home.inert||!room)return false;
    if(!room.beginBirdTour())return false;
    previousFocus=get('home');room.birdTourCue(false);setNextLabel('下一步');
    cue.hidden=true;skip.hidden=false;home.classList.add('bird-tour-open','bird-tour-visible');index=0;direction=1;travel(BIRD_TOUR_STOPS[index].id);animateLayout();return true;
  }
  next.onclick=()=>{if(state==='done'){cancel({focus:true});return;}if(state!=='stop')return;direction=1;index++;travel(index===BIRD_TOUR_STOPS.length?'home':BIRD_TOUR_STOPS[index].id);};
  prev.onclick=()=>{if(!['stop','done'].includes(state)||index<=0)return;direction=-1;index--;travel(BIRD_TOUR_STOPS[index].id);};
  startBtn.onclick=start;exploreBtn.onclick=dismissCue;skip.onclick=()=>cancel({focus:true});
  document.addEventListener('keydown',event=>{if(state==='hidden'||home.hidden||home.inert||document.querySelector('dialog[open]')||!get('memory-drawer').hidden)return;if(event.key==='Escape'){event.preventDefault();cancel({focus:true});}});
  return {start,showCue,cancel,dismissCue,isActive:()=>['flying','stop','done'].includes(state),getState:()=>({state,index,id:BIRD_TOUR_STOPS[index]?.id})};
}
