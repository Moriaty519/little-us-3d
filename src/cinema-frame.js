export function cinemaContain(imageWidth,imageHeight,width,height){
  const scale=Math.min(width/imageWidth,height/imageHeight);
  return {x:(width-imageWidth*scale)/2,y:(height-imageHeight*scale)/2,width:imageWidth*scale,height:imageHeight*scale};
}
export function cinemaFilmOffsets(progress,width,direction=1){
  const p=Math.max(0,Math.min(1,progress)),ease=p*p*(3-2*p);
  return {previous:-direction*ease*width,next:direction*(1-ease)*width,seam:direction>0?(1-ease)*width:ease*width};
}
export function cinemaViewport(width,height,target=[-.75,2.64,-3.232]){
  // Face the existing screen squarely, slightly above the viewport centre.
  const aspect=width/height;
  const position=[target[0],target[1],0],distance=position[2]-target[2];
  // Fit the outer rails too, leaving room for controls in short/wide windows.
  const verticalFill=Math.min(.72,Math.max(.3,1-220/height));
  const tangent=Math.max(1.47/distance,1.85/(distance*aspect*.86),1.06/(distance*verticalFill));
  const fov=2*Math.atan(tangent)*180/Math.PI;
  return {aspect,fov,position,target,offsetY:Math.min(24,height*.03)};
}
