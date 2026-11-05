import { CHINA_REGIONS } from './china-map-data.js';

export const MAP_BOARD_COLOR='#d8c092';
export const MAP_REGION_COLORS=['#8e9e7d','#84986f','#99aa86','#8da17b','#82956e','#94a580'];

// Drawing and city pins share the same geographic projection and paper margins.
export function chinaMapLayout(width,height){
  const bounds={west:73,east:135.5,south:17.6,north:54};
  const area={x:width*.065,y:height*.135,w:width*.865,h:height*.748};
  const scale=Math.min(area.w/((bounds.east-bounds.west)*.819),area.h/(bounds.north-bounds.south));
  const offsetX=area.x+(area.w-(bounds.east-bounds.west)*.819*scale)/2;
  const offsetY=area.y+(area.h-(bounds.north-bounds.south)*scale)/2;
  return {area,project:([lon,lat])=>[offsetX+(lon-bounds.west)*.819*scale,offsetY+(bounds.north-lat)*scale]};
}

// Draw geographic contours directly into the room's canvas texture.
// No network requests or external image assets are used by the webpage.
export function drawChinaMap(ctx, width, height, {labels=true}={}) {
  ctx.fillStyle=MAP_BOARD_COLOR;ctx.fillRect(0,0,width,height);
  const {area,project}=chinaMapLayout(width,height);
  function contours(projectPoint, region, fill, stroke, lineWidth) {
    ctx.fillStyle=fill;ctx.strokeStyle=stroke;ctx.lineWidth=lineWidth;
    for(const polygon of region.polygons){
      ctx.beginPath();
      for(const ring of polygon){ring.forEach((coordinate,index)=>{const [x,y]=projectPoint(coordinate);index?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.closePath();}
      ctx.fill('evenodd');ctx.stroke();
    }
  }
  ctx.save();ctx.beginPath();ctx.rect(area.x,area.y,area.w,area.h);ctx.clip();
  CHINA_REGIONS.forEach((region,index)=>contours(project,region,MAP_REGION_COLORS[index%MAP_REGION_COLORS.length],'#e2e5d0',.95));
  if(labels){
    const [beijingX,beijingY]=project([116.4053,39.9049]);
    ctx.fillStyle='#af886a';ctx.beginPath();ctx.arc(beijingX,beijingY,3.3,0,Math.PI*2);ctx.fill();
    ctx.font='16px sans-serif';ctx.fillStyle='#6e7c60';ctx.textAlign='left';ctx.fillText('北京',beijingX+8,beijingY-7);
    for(const [name,lon,lat]of [['台湾',123.1,23.5],['海南',110.5,17.9]]){const [x,y]=project([lon,lat]);ctx.font='13px sans-serif';ctx.fillText(name,x,y);}
  }
  ctx.restore();
  // Keep the southern islands legible without shrinking the mainland map.
  const inset={x:width*.81,y:height*.61,w:width*.135,h:height*.29};
  ctx.fillStyle='#eee9d9';ctx.fillRect(inset.x,inset.y,inset.w,inset.h);
  ctx.strokeStyle='#aeb69a';ctx.lineWidth=1;ctx.strokeRect(inset.x,inset.y,inset.w,inset.h);
  ctx.save();ctx.beginPath();ctx.rect(inset.x+2,inset.y+2,inset.w-4,inset.h-4);ctx.clip();
  const seaProject=([lon,lat])=>[inset.x+6+(lon-105)/20*(inset.w-12),inset.y+7+(25-lat)/25*(inset.h-24)];
  for(const region of CHINA_REGIONS)contours(seaProject,region,'#9ca987','#849571',.7);
  ctx.restore();
  if(labels){
    ctx.font='11px sans-serif';ctx.textAlign='center';ctx.fillStyle='#829073';ctx.fillText('南海诸岛',inset.x+inset.w/2,inset.y+inset.h-7);
    ctx.fillStyle='#7e8065';ctx.font='30px sans-serif';ctx.textAlign='center';ctx.fillText('中国地图',width/2,height*.074);
    ctx.font='12px sans-serif';ctx.fillStyle='#9da187';ctx.fillText('CHINA · LITTLE US',width/2,height*.959);
  }
}
