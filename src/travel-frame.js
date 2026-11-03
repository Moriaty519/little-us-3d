import { WALL_DECOR_LAYOUT } from './wall-layout.js';

// Center the framed map in the left column and align it with the adjacent card.
export function travelCardMaxHeight(width){
  const {map,view}=WALL_DECOR_LAYOUT;
  return Math.max(90,(width-32)*map.height/(view.right-view.left));
}

export function travelFrame(width,height,area,{mobile=false,fitWidth=width}={}){
  const {map,view}=WALL_DECOR_LAYOUT;
  const availableHeight=Math.max(1,area.bottom-area.top);
  const boardHeight=mobile?Math.min(availableHeight,travelCardMaxHeight(fitWidth)):availableHeight;
  const viewHeight=map.height*view.scale*height/boardHeight;
  return {
    viewHeight,
    aspect:width/height,
    targetX:0,
    offsetX:(fitWidth-width)/2,
    offsetY:(area.top+area.bottom)/2-height/2
  };
}
