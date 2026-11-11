import * as THREE from 'three';
import { renderAlbumPage,albumCoverOptions } from './album-pages.js';
import { ALBUM_FOLD_WIDTH,ALBUM_FOLD_HEIGHT,albumFoldColumns,albumTurnColumns,albumTurnUV,albumBookPose,albumFoldLayout,albumFoldWindow,albumJumpPath,albumJumpTiming,albumJumpProgress } from './album-fold.js';

export function createAlbumScene(container,{onPhoto,onState,onLayout}){
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setClearColor(0,0);renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  const canvas=renderer.domElement;canvas.setAttribute('aria-label','相册。底部按钮逐页翻阅，点击月份快速翻页，点击照片放大。');container.prepend(canvas);
  const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-7,7,4,-4,.1,50);camera.position.set(0,-.4,18);camera.lookAt(0,0,0);
  scene.add(new THREE.HemisphereLight('#fffaf0','#d8d0bb',1.7));
  const sun=new THREE.DirectionalLight('#fff9ed',2);sun.position.set(-3,4,25);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-9;sun.shadow.camera.right=9;sun.shadow.camera.top=8;sun.shadow.camera.bottom=-8;sun.shadow.camera.far=40;sun.shadow.normalBias=.018;sun.shadow.bias=-.0002;sun.shadow.radius=5;scene.add(sun);
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(80,60),new THREE.ShadowMaterial({opacity:.065}));ground.position.z=-.55;ground.receiveShadow=true;scene.add(ground);
  const shadowCanvas=document.createElement('canvas');shadowCanvas.width=512;shadowCanvas.height=384;
  const shadowContext=shadowCanvas.getContext('2d');shadowContext.translate(256,192);shadowContext.scale(1,.74);
  const shade=shadowContext.createRadialGradient(0,0,70,0,0,255);shade.addColorStop(0,'rgba(69,59,37,.12)');shade.addColorStop(.68,'rgba(69,59,37,.07)');shade.addColorStop(1,'rgba(69,59,37,0)');shadowContext.fillStyle=shade;shadowContext.fillRect(-256,-260,512,520);
  const shadowTexture=new THREE.CanvasTexture(shadowCanvas),contact=new THREE.Mesh(new THREE.PlaneGeometry(10.8,8.3),new THREE.MeshBasicMaterial({map:shadowTexture,transparent:true,depthWrite:false}));contact.position.set(.05,-.12,-.57);scene.add(contact);
  const closedStack=new THREE.Group(),stackShape=new THREE.Shape();
  stackShape.moveTo(0,-3.11);stackShape.lineTo(4.08,-3.11);stackShape.quadraticCurveTo(4.3,-3.11,4.3,-2.89);stackShape.lineTo(4.3,2.89);stackShape.quadraticCurveTo(4.3,3.11,4.08,3.11);stackShape.lineTo(0,3.11);stackShape.closePath();
  const stackGeometry=new THREE.ShapeGeometry(stackShape);
  for(let i=1;i<=4;i++){const edge=new THREE.Mesh(stackGeometry,new THREE.MeshBasicMaterial({color:i%2?'#f5efdd':'#e8e0cd',side:THREE.DoubleSide}));edge.position.set(i*.012,-i*.012,.10-i*.045);closedStack.add(edge);}scene.add(closedStack);
  const width=ALBUM_FOLD_WIDTH,height=ALBUM_FOLD_HEIGHT,segments=64,entries=new Map();
  let active=false,dirty=true,disposed=false,version=0,loading=false,pages=[],current=0,editing=false,mobile=false,transition=null,down=null,last=0,aspect=1;
  const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
  function deform(item,p=0){
    const columns=item.kind==='turn'?albumTurnColumns(p,32):albumFoldColumns(0,segments),position=item.geometry.attributes.position;
    for(let vertex=0;vertex<position.count;vertex++){
      const u=item.logical[vertex],column=Math.round(u*(item.kind==='turn'?32:segments));
      position.setXYZ(vertex,columns[column][0],item.baseY[vertex],columns[column][1]);
    }
    position.needsUpdate=true;item.geometry.computeVertexNormals();item.geometry.computeBoundingSphere();dirty=true;
  }
  const pageShapeCanvas=document.createElement('canvas');pageShapeCanvas.width=860;pageShapeCanvas.height=622;
  const pageShapeCtx=pageShapeCanvas.getContext('2d');pageShapeCtx.fillStyle='#fff';pageShapeCtx.beginPath();pageShapeCtx.roundRect(0,0,860,622,21);pageShapeCtx.fill();
  const pageShapeTexture=new THREE.CanvasTexture(pageShapeCanvas);pageShapeTexture.colorSpace=THREE.SRGBColorSpace;
  function sheet(rendered,texture=null,kind='full',backTexture=null){
    const half=kind!=='full',geometry=new THREE.PlaneGeometry(half?width/2:width,height,half?32:segments,16),logical=[],baseY=[];
    const uv=geometry.attributes.uv,position=geometry.attributes.position;
    for(let i=0;i<position.count;i++){
      const u=uv.getX(i);logical.push(kind==='left'?u/2:kind==='right'?.5+u/2:u);baseY.push(position.getY(i));
      uv.setX(i,kind==='turn'?albumTurnUV(u):kind==='left'?u/2:kind==='right'?.5+u/2:u);
    }
    const ownsTexture=!texture;if(!texture){texture=new THREE.CanvasTexture(rendered.canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());}
    const material=new THREE.MeshBasicMaterial({map:texture,transparent:true,alphaTest:.02,side:THREE.FrontSide});
    const reverse=new THREE.MeshBasicMaterial({map:backTexture||pageShapeTexture,color:backTexture?'#ffffff':'#eee7d6',transparent:true,alphaTest:.02,side:THREE.BackSide});
    const backGeometry=kind==='turn'?geometry.clone():geometry;
    if(kind==='turn'){const buv=backGeometry.attributes.uv;for(let i=0;i<buv.count;i++)buv.setX(i,albumTurnUV(logical[i],true));}
    const group=new THREE.Group(),mesh=new THREE.Mesh(geometry,material),back=new THREE.Mesh(backGeometry,reverse);mesh.castShadow=back.castShadow=true;group.add(mesh,back);scene.add(group);
    const item={group,mesh,back,geometry,backGeometry,logical,baseY,kind,texture,ownsTexture,material,reverse,rendered};deform(item);
    if(kind==='turn')syncBack(item);return item;
  }
  function syncBack(item){item.backGeometry.attributes.position.array.set(item.geometry.attributes.position.array);item.backGeometry.attributes.position.needsUpdate=true;item.backGeometry.computeVertexNormals();item.backGeometry.computeBoundingSphere();}
  function dispose(item){scene.remove(item.group);item.geometry.dispose();if(item.backGeometry!==item.geometry)item.backGeometry.dispose();if(item.ownsTexture)item.texture.dispose();item.material.dispose();item.reverse.dispose();}
  function clear(){for(const item of entries.values())dispose(item);entries.clear();}
  function place(item,a,b=a,t=0){item.group.position.set(THREE.MathUtils.lerp(a.x,b.x,t),THREE.MathUtils.lerp(a.y,b.y,t),THREE.MathUtils.lerp(a.z,b.z,t));item.group.scale.setScalar(THREE.MathUtils.lerp(a.scale,b.scale,t));item.group.rotation.z=THREE.MathUtils.lerp(a.rotation,b.rotation,t);}
  function positionAt(i,at){return albumFoldLayout(i-at,{mobile,preview:editing});}
  const isCover=()=>!editing&&!!pages[current]?.cover;
  function frame(open=isCover()?0:1){
    const horizontal=editing?10.4:THREE.MathUtils.lerp(mobile?5.8:7,mobile?9.55:10.7,open),v=Math.max(editing?8.5:7.65,horizontal/aspect);
    camera.left=-v*aspect/2;camera.right=v*aspect/2;camera.top=v/2;camera.bottom=-v/2;camera.updateProjectionMatrix();
    const pose=albumBookPose(open);contact.scale.x=pose.shadowScale;closedStack.position.x=pose.hingeX;
    if(onLayout&&!editing){
      camera.updateMatrixWorld(true);const rect=container.getBoundingClientRect(),bottom=new THREE.Vector3(0,-height/2,.14).project(camera);
      onLayout({bottom:rect.top+(1-bottom.y)*rect.height/2});
    }
  }
  function layout(){
    const closed=isCover();closedStack.visible=closed;frame();
    for(const [i,item] of entries){place(item,positionAt(i,current));item.group.visible=i===current;item.material.color.set(i===current?'#ffffff':'#eee8da');item.group.rotation.y=pages[i]?.cover&&!closed?-Math.PI:0;if(pages[i]?.cover&&closed)item.group.position.x=albumBookPose(0).hingeX;}
    dirty=true;
  }
  function fit(){const w=container.clientWidth,h=container.clientHeight;if(!w||!h)return;mobile=matchMedia('(max-width:700px)').matches;renderer.setSize(w,h);aspect=w/h;if(transition)updateTransition(transition.p);else layout();dirty=true;}
  const observer=new ResizeObserver(fit);observer.observe(container);fit();
  function updateTransition(p){
    const tr=transition;if(!tr)return;tr.p=p;
    if(tr.leaves){updateJump(tr,p);return;}
    for(const [i,item] of entries){place(item,positionAt(i,tr.from),positionAt(i,tr.to),p);item.group.visible=!tr.cover&&i!==tr.from&&i!==tr.to;item.material.color.set('#eee8da');}
    if(tr.cover){const open=tr.direction>0?p:1-p,pose=albumBookPose(open);frame(open);closedStack.visible=true;tr.right.group.position.x=tr.fly.group.position.x=pose.hingeX;}
    deform(tr.fly,tr.direction>0?p:1-p);syncBack(tr.fly);const tone=1-.09*Math.sin(Math.PI*p);tr.fly.material.color.setRGB(tone,tone,tone);tr.fly.reverse.color.setRGB(tone,tone,tone);dirty=true;
  }
  function updateJump(tr,p){
    for(const item of entries.values())item.group.visible=false;
    const coverLeaf=tr.leaves.find(leaf=>leaf.cover),coverProgress=coverLeaf?albumJumpProgress(p,coverLeaf.order,tr.leaves.length):null;
    const open=coverLeaf?(tr.direction>0?coverProgress:1-coverProgress):1,pose=albumBookPose(open);
    frame(open);closedStack.visible=open<1;
    for(const item of [tr.left,tr.right].filter(Boolean))item.group.position.x=pose.hingeX;
    for(const leaf of tr.leaves){
      const progress=albumJumpProgress(p,leaf.order,tr.leaves.length),fold=tr.direction>0?progress:1-progress;
      leaf.item.group.position.set(pose.hingeX,0,.024+.024*THREE.MathUtils.lerp(tr.leaves.length-1-leaf.order,leaf.order,progress));
      deform(leaf.item,fold);syncBack(leaf.item);
      const tone=1-.09*Math.sin(Math.PI*progress);leaf.item.material.color.setRGB(tone,tone,tone);leaf.item.reverse.color.setRGB(tone,tone,tone);
    }
    dirty=true;
  }
  function startJump(path){
    if(transition||path.length<2||path.some(at=>!entries.has(at)))return false;
    const from=path[0],to=path[path.length-1],direction=Math.sign(to-from),first=entries.get(Math.min(from,to)),last=entries.get(Math.max(from,to));
    const left=pages[Math.min(from,to)]?.cover?null:sheet(first.rendered,first.texture,'left'),right=sheet(last.rendered,last.texture,'right');
    const leaves=path.slice(1).map((at,order)=>{
      const before=path[order],earlier=Math.min(before,at),later=Math.max(before,at),front=entries.get(earlier),back=entries.get(later);
      return {item:sheet(front.rendered,front.texture,'turn',back.texture),order,cover:!!pages[earlier]?.cover};
    });
    transition={from,to,direction,left,right,leaves,p:0,tween:null,resolve:null};onState?.(true);canvas.style.cursor='default';updateTransition(0);return true;
  }
  function startTransition(to){
    if(transition||!entries.has(to)||Math.abs(to-current)!==1)return false;
    const direction=to>current?1:-1,first=entries.get(direction>0?current:to),second=entries.get(direction>0?to:current);
    const cover=!!pages[Math.min(current,to)]?.cover,left=cover?null:sheet(first.rendered,first.texture,'left'),right=sheet(second.rendered,second.texture,'right'),fly=sheet(first.rendered,first.texture,'turn',second.texture);
    fly.group.position.z=.018;transition={from:current,to,direction,cover,left,right,fly,p:0,tween:null,resolve:null};onState?.(true);canvas.style.cursor='default';updateTransition(0);return true;
  }
  function finishTransition(commit){
    const tr=transition;if(!tr)return;transition=null;[tr.left,tr.right,tr.fly,...(tr.leaves||[]).map(leaf=>leaf.item)].filter(Boolean).forEach(dispose);current=commit?tr.to:tr.from;layout();canvas.style.cursor='default';onState?.(loading);tr.resolve?.(commit);
  }
  function settle(commit){
    if(!transition)return Promise.resolve(true);const tr=transition,target=commit?1:0;
    if(reduced()||!active){updateTransition(target);finishTransition(commit);return Promise.resolve(true);}
    tr.tween={from:tr.p,to:target,start:null,duration:tr.leaves?albumJumpTiming(tr.leaves.length).duration:Math.max(180,540*Math.abs(target-tr.p)),commit};return new Promise(resolve=>tr.resolve=resolve);
  }
  async function show(list,at,{animate=0,jump=false,preview=false}={}){
    if(disposed)return false;if(transition)finishTransition(false);
    const gen=++version,old=current,same=pages===list&&editing===preview;loading=true;onState?.(true);down=null;canvas.style.cursor='default';
    if(!same){clear();pages=list;editing=preview;current=at;}fit();
    const radius=preview?0:2,canAnimate=same&&!preview&&active&&!reduced(),jumpPath=canAnimate&&jump&&at!==old?albumJumpPath(old,at):null;
    const animateAdjacent=canAnimate&&animate&&Math.abs(at-old)===1&&!jumpPath,windowIndices=[...new Set([...albumFoldWindow(at,list.length,radius,animateAdjacent?old:at),...(jumpPath||[])])];
    if(!animateAdjacent&&!jumpPath){current=at;for(const [i,item] of entries)if(!windowIndices.includes(i)){dispose(item);entries.delete(i);}}
    try{
      const coverOptions=albumCoverOptions(list);
      const missing=windowIndices.filter(i=>!entries.has(i)),drawn=await Promise.all(missing.map(i=>renderAlbumPage(list[i],{cover:!!list[i].cover,pageNumber:i,...coverOptions,placeholder:preview})));
      if(gen!==version||disposed)return false;missing.forEach((i,j)=>entries.set(i,sheet(drawn[j],null,list[i].cover?'right':'full')));
      if(jumpPath||animateAdjacent){current=old;layout();const started=jumpPath?startJump(jumpPath):startTransition(at);if(!started||!await settle(true)||gen!==version||disposed)return false;}else{current=at;layout();}
      for(const [i,item] of entries)if(Math.abs(i-current)>radius){dispose(item);entries.delete(i);}return true;
    }catch(error){console.error(error);return false;}finally{if(gen===version){loading=false;onState?.(false);}}
  }
  const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
  function picked(event,all=false){const r=canvas.getBoundingClientRect();pointer.set((event.clientX-r.left)/r.width*2-1,-(event.clientY-r.top)/r.height*2+1);raycaster.setFromCamera(pointer,camera);scene.updateMatrixWorld(true);const meshes=all?[...entries.values()].filter(item=>item.group.visible).map(item=>item.mesh):[entries.get(current)?.mesh].filter(Boolean);return raycaster.intersectObjects(meshes)[0]||null;}
  function photoAt(event){
    if(editing||loading||transition||pages[current]?.cover)return null;
    const hit=picked(event,true),item=entries.get(current);if(!hit||hit.object!==item?.mesh)return null;
    const x=hit.uv.x*860,y=(1-hit.uv.y)*622;
    return item.rendered.hits.find(photo=>x>=photo.rect[0]&&x<=photo.rect[0]+photo.rect[2]&&y>=photo.rect[1]&&y<=photo.rect[1]+photo.rect[3])||null;
  }
  canvas.addEventListener('pointerdown',event=>{if(down){down=null;return;}if(event.button!==0||event.isPrimary===false)return;const photo=photoAt(event);if(!photo)return;down={id:event.pointerId,x:event.clientX,y:event.clientY,photo:photo.index,moved:false};canvas.setPointerCapture(event.pointerId);});
  canvas.addEventListener('pointermove',event=>{
    if(down&&down.id===event.pointerId&&Math.hypot(event.clientX-down.x,event.clientY-down.y)>10)down.moved=true;
    canvas.style.cursor=photoAt(event)?'zoom-in':'default';
  });
  canvas.addEventListener('pointerup',event=>{
    if(!down||down.id!==event.pointerId)return;const began=down;down=null;
    if(began.moved||Math.hypot(event.clientX-began.x,event.clientY-began.y)>10)return;
    const photo=photoAt(event);if(photo&&photo.index===began.photo)onPhoto?.(photo.index);
  });
  canvas.addEventListener('pointercancel',()=>{down=null;});
  canvas.addEventListener('lostpointercapture',()=>{down=null;});
  canvas.addEventListener('pointerleave',()=>{canvas.style.cursor='default';});
  function render(time){
    if(disposed)return;requestAnimationFrame(render);if(!active||document.hidden||time-last<16)return;last=time;
    const tween=transition?.tween;if(tween){if(tween.start===null)tween.start=time;const t=Math.min(1,(time-tween.start)/tween.duration),e=transition.leaves?t:t*t*(3-2*t);updateTransition(THREE.MathUtils.lerp(tween.from,tween.to,e));if(t===1)finishTransition(tween.commit);}
    if(dirty){renderer.render(scene,camera);dirty=false;}
  }
  requestAnimationFrame(render);
  function coverBounds(){
    const item=entries.get(current);if(!item||!isCover())return null;scene.updateMatrixWorld(true);camera.updateMatrixWorld(true);const bounds=container.getBoundingClientRect(),positions=item.geometry.attributes.position;
    let left=Infinity,right=-Infinity,top=Infinity,bottom=-Infinity;
    for(let i=0;i<positions.count;i++){const point=new THREE.Vector3().fromBufferAttribute(positions,i).applyMatrix4(item.group.matrixWorld).project(camera),x=bounds.left+(point.x+1)*bounds.width/2,y=bounds.top+(1-point.y)*bounds.height/2;left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
    return {left,top,width:right-left,height:bottom-top};
  }
  return {show,fit,coverBounds,pageCorner:()=>{const item=entries.get(current);if(!item)return null;const point=new THREE.Vector3(width/2,height/2,0);item.group.localToWorld(point);point.project(camera);const rect=container.getBoundingClientRect();return {x:rect.left+(point.x+1)*rect.width/2,y:rect.top+(1-point.y)*rect.height/2};},isBusy:()=>loading||!!transition,setActive:value=>{active=value;if(!value){version++;loading=false;down=null;if(transition)finishTransition(false);}else{fit();dirty=true;}},dispose:()=>{disposed=true;version++;if(transition)finishTransition(false);observer.disconnect();clear();stackGeometry.dispose();closedStack.children.forEach(edge=>edge.material.dispose());contact.geometry.dispose();contact.material.dispose();shadowTexture.dispose();ground.geometry.dispose();ground.material.dispose();renderer.dispose();}};
}
