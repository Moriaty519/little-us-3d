import * as THREE from 'three';

// Hold the focused room in one background texture; keep the journal live.
export function createAlbumIsolation(scene,book,renderer){
  const backgrounds=[],parts=[],copies=new Map();let ready=false,disposed=false;
  const insideBook=node=>{for(let parent=node;parent;parent=parent.parent)if(parent===book)return true;return false;};
  scene.traverse(node=>{
    if(!node.isMesh&&!node.isLineSegments)return;
    if(!insideBook(node)){backgrounds.push({node,visible:node.visible});return;}
    const original=node.material,materials=Array.isArray(original)?original:[original],clones=materials.map(mat=>{
      if(!copies.has(mat)){const clone=mat.clone();clone.transparent=true;clone.needsUpdate=true;copies.set(mat,clone);}return copies.get(mat);
    });
    parts.push({node,original,visible:node.visible,shadow:node.castShadow,opacity:materials.map(mat=>mat.opacity)});node.material=Array.isArray(original)?clones:clones[0];
  });
  const target=new THREE.WebGLRenderTarget(renderer.domElement.width,renderer.domElement.height,{depthBuffer:true});target.texture.colorSpace=THREE.SRGBColorSpace;
  const previousTarget=renderer.getRenderTarget();try{renderer.setRenderTarget(target);renderer.clear();}finally{renderer.setRenderTarget(previousTarget);}
  const backdrop=new THREE.Scene(),camera=new THREE.OrthographicCamera(-1,1,1,-1,0,2);camera.position.z=1;
  const geometry=new THREE.PlaneGeometry(2,2),material=new THREE.MeshBasicMaterial({map:target.texture,transparent:true,depthWrite:false,toneMapped:false});backdrop.add(new THREE.Mesh(geometry,material));
  renderer.compile(backdrop,camera);
  function capture(view){
    if(ready||disposed)return;const visible=book.visible,previous=renderer.getRenderTarget();
    try{book.visible=false;renderer.setRenderTarget(target);renderer.render(scene,view);}finally{renderer.setRenderTarget(previous);book.visible=visible;}
    backgrounds.forEach(item=>item.node.visible=false);ready=true;
  }
  function transfer(value){
    const p=THREE.MathUtils.clamp(value,0,1);for(const part of parts){part.node.visible=part.visible&&p<1;part.node.castShadow=false;const mats=Array.isArray(part.node.material)?part.node.material:[part.node.material];mats.forEach((mat,i)=>mat.opacity=part.opacity[i]*(1-p));}
  }
  function render(view){
    const clear=renderer.autoClear;try{renderer.autoClear=true;renderer.render(backdrop,camera);renderer.autoClear=false;renderer.clearDepth();renderer.render(scene,view);}finally{renderer.autoClear=clear;}
  }
  function dispose(){
    if(disposed)return;disposed=true;backgrounds.forEach(item=>item.node.visible=item.visible);
    for(const part of parts){part.node.material=part.original;part.node.visible=part.visible;part.node.castShadow=part.shadow;}
    copies.forEach(mat=>mat.dispose());target.dispose();geometry.dispose();material.dispose();renderer.shadowMap.needsUpdate=true;
  }
  return {get ready(){return ready;},background:(p,view)=>{capture(view);material.opacity=1-THREE.MathUtils.clamp(p,0,1);},transfer,render,dispose};
}
