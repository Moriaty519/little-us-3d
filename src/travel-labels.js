// Place readable names around the real pins in screen space. Dense regions
// keep their pins; a name is shown only when it has room to be read.
export function layoutTravelLabels(items,{bounds,obstacles=[],gap=4,pinRadius=4,maxOffset=64}){
  const right=r=>r.x+r.width,bottom=r=>r.y+r.height;
  const overlaps=(a,b,pad=0)=>a.x<right(b)+pad&&right(a)>b.x-pad&&a.y<bottom(b)+pad&&bottom(a)>b.y-pad;
  const contains=(r,p)=>p.x>=r.x&&p.x<=right(r)&&p.y>=r.y&&p.y<=bottom(r);
  function crossesRect(a,b,r,pad=0){
    let lo=0,hi=1;const dx=b.x-a.x,dy=b.y-a.y;
    for(const [p,q] of [[-dx,a.x-r.x+pad],[dx,right(r)+pad-a.x],[-dy,a.y-r.y+pad],[dy,bottom(r)+pad-a.y]]){
      if(p===0){if(q<0)return false;continue;}
      const t=q/p;if(p<0)lo=Math.max(lo,t);else hi=Math.min(hi,t);if(lo>hi)return false;
    }
    return true;
  }
  const visible=items.filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.width>0&&p.height>0&&contains(bounds,p)&&!obstacles.some(r=>contains(r,p)));
  const ordered=[...visible].sort((a,b)=>(b.priority||0)-(a.priority||0)||(b.count||0)-(a.count||0)||String(a.id).localeCompare(String(b.id)));
  const placed=[];
  for(const p of ordered){
    const distances=[8,24,44,maxOffset];
    if(p.priority>0)distances.push(maxOffset+24,maxOffset+48);
    const candidates=p.priority>0&&p.preferred?[p.preferred]:[];
    for(const d of [...new Set(distances.filter(d=>d<=maxOffset||p.priority>0))]){
      const {x,y,width:w,height:h}=p;
      candidates.push(
        {x:x-w/2,y:y-d-h},{x:x-w/2,y:y+d},
        {x:x+d,y:y-h/2},{x:x-d-w,y:y-h/2},
        {x:x+d,y:y-d-h},{x:x-d-w,y:y-d-h},
        {x:x+d,y:y+d},{x:x-d-w,y:y+d}
      );
    }
    for(const c of candidates){
      const r={...c,width:p.width,height:p.height};
      if(r.x<bounds.x||r.y<bounds.y||right(r)>right(bounds)||bottom(r)>bottom(bounds))continue;
      if(obstacles.some(o=>overlaps(r,o,gap))||placed.some(o=>overlaps(r,o,gap)))continue;
      if(visible.some(pin=>overlaps(r,{x:pin.x-pinRadius,y:pin.y-pinRadius,width:pinRadius*2,height:pinRadius*2})))continue;
      const end={x:Math.max(r.x,Math.min(right(r),p.x)),y:Math.max(r.y,Math.min(bottom(r),p.y))};
      const distance=Math.hypot(end.x-p.x,end.y-p.y);
      const start={x:p.x+(end.x-p.x)*pinRadius/distance,y:p.y+(end.y-p.y)*pinRadius/distance};
      // Leader lines must not run through another name or an interface card.
      if(placed.some(o=>crossesRect(start,end,o,2)||crossesRect(o.start,o.end,r,2)))continue;
      if(obstacles.some(o=>crossesRect(start,end,o,2)))continue;
      placed.push({...r,id:p.id,start,end,leader:distance>10});break;
    }
  }
  return placed;
}
