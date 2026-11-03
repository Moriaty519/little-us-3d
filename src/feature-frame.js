// Match a real room surface to the destination's screen rectangle.
export function matchedSurfaceFrame({surfaceHeight,fov,width,height,bounds}){
  if(!bounds||bounds.height<=0)return null;
  return {
    distance:surfaceHeight*height/(2*Math.tan(fov*Math.PI/360)*bounds.height),
    offsetX:width/2-bounds.left-bounds.width/2,
    offsetY:height/2-bounds.top-bounds.height/2
  };
}
