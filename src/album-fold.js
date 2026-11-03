export const ALBUM_FOLD_WIDTH=8.6,ALBUM_FOLD_HEIGHT=6.22;
// Each leaf keeps its arc length and turns around the fixed binding.
export function albumTurnColumns(progress=0,segments=32){
  const p=Math.max(0,Math.min(1,progress)),step=ALBUM_FOLD_WIDTH/2/segments,points=[[0,.14]];
  let x=0,z=.14;
  for(let i=1;i<=segments;i++){
    const u=(i-.5)/segments,angle=-Math.PI*p-.045+.09*p+.68*Math.sin(Math.PI*p)*(u-.5);
    x+=Math.cos(angle)*step;z-=Math.sin(angle)*step;points.push([x,z]);
  }
  return points;
}
export function albumFoldColumns(progress=0,segments=64){
  const right=albumTurnColumns(0,segments/2);
  return [...right.slice(1).reverse().map(([x,z])=>[-x,z]),...right];
}
export function albumTurnUV(u,back=false){return back?.5*(1-u):.5+.5*u;}
export function albumFoldLayout(distance,{mobile=false,preview=false}={}){
  const depth=Math.abs(distance),scale=preview?1:Math.max(.92,1-depth*.025);
  return {x:preview?0:distance*(mobile?.23:.29),y:-depth*.035,z:-depth*.075,scale,rotation:-distance*.009};
}
export function albumDragProgress(delta,pixels){return Math.max(0,Math.min(1,delta/Math.max(1,pixels)));}
export function albumFoldWindow(index,count,radius=3,previous=index){
  if(Math.abs(previous-index)!==1)previous=index;
  const low=Math.max(0,Math.min(index,previous)-radius),high=Math.min(count-1,Math.max(index,previous)+radius);
  return Array.from({length:Math.max(0,high-low+1)},(_,i)=>low+i);
}

// Distant jumps sample a bounded stack; nearby jumps show every intervening leaf.
export function albumJumpPath(from,to,maxLeaves=7){
  const distance=Math.abs(to-from);if(!distance)return [from];
  const direction=Math.sign(to-from),limit=Math.max(2,Math.floor(maxLeaves));
  const opens=from===0&&to>1,closes=to===0&&from>1;
  const start=opens?1:from,end=closes?1:to,steps=Math.min(Math.abs(end-start),limit-(opens||closes?1:0));
  const path=opens?[0,start]:[start];
  for(let i=1;i<=steps;i++)path.push(start+direction*Math.round(Math.abs(end-start)*i/steps));
  if(closes)path.push(0);return path;
}
export function albumJumpTiming(count){return {leaf:count===1?420:580,stagger:75,duration:(count===1?420:580)+75*Math.max(0,count-1)};}
export function albumJumpProgress(progress,index,count){
  const {leaf,stagger,duration}=albumJumpTiming(count),t=Math.max(0,Math.min(1,(progress*duration-index*stagger)/leaf));
  return t*t*(3-2*t);
}

export function albumBookPose(openness=1){
  const open=Math.max(0,Math.min(1,openness));
  return {hingeX:ALBUM_FOLD_WIDTH/4*(open-1),shadowScale:.56+.44*open};
}
