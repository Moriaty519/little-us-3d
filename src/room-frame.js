// A perspective lens with one framing distance for the entire rotation range.
export function roomFrame(width,height,{compact=false,mobile=false}={}){
  const fov=38,radius=6.65;
  const top=compact?8:mobile?90:88,bottom=compact?height-8:height-(mobile?145:82);
  const safeWidth=Math.max(1,width-(compact?12:40)),safeHeight=Math.max(1,bottom-top);
  const tangent=Math.tan(fov*Math.PI/360);
  const halfAngle=Math.atan(tangent*Math.min(safeWidth/height,safeHeight/height));
  return {fov,aspect:width/height,distance:radius/Math.sin(halfAngle)*1.025,offsetY:(top+bottom)/2-height/2};
}

// Start directly above the letter; orbit gently as its full paper footprint opens.
export function openingFrame(width,height,turn,exit,{mobile=false,spread=turn}={}){
  const normal=roomFrame(width,height,{mobile}),q=Math.max(0,Math.min(1,turn));
  const polar=Math.acos(8.9/Math.hypot(12,8.9,14))*q,azimuth=Math.atan2(12,14)*q;
  const direction=[Math.sin(polar)*Math.sin(azimuth),Math.cos(polar),Math.max(.000001,Math.sin(polar)*Math.cos(azimuth))];
  const closedDistance=Math.max(13.8,15.8/normal.aspect)/(2*Math.tan(normal.fov*Math.PI/360))+1;
  const openDistance=Math.max(18.7,25/normal.aspect)/(2*Math.tan(normal.fov*Math.PI/360))+3.5;
  const distance=closedDistance+(openDistance-closedDistance)*Math.max(q,spread);
  return {...normal,direction,targetY:2.1*q,distance:distance+(normal.distance-distance)*exit,offsetY:normal.offsetY*exit};
}
