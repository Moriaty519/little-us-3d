import * as THREE from 'three';
import { createChinaMapModel } from './wall-decor.js';
import { WALL_DECOR_LAYOUT } from './wall-layout.js';
import { CITY_BY_ID, cityName } from './travel-storage.js';
import { createTapTracker } from './ui.js';
import { layoutTravelLabels } from './travel-labels.js';
import { createQingdaoIsland, QINGDAO_ID, QINGDAO_LONLAT } from './qingdao-island.js';

const MAP_SCALE=WALL_DECOR_LAYOUT.view.scale;
const MAP_WIDTH=WALL_DECOR_LAYOUT.map.width*MAP_SCALE;
const MAP_HEIGHT=WALL_DECOR_LAYOUT.map.height*MAP_SCALE;
const MAP_CENTER_Y=2.08;
const FOCUS_DURATION=1700;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const smooth=p=>{const value=clamp(p,0,1);return value*value*(3-2*value);};

export function createTravelScene(container,onSelect,onFocusChange=()=>{}){
  const scene=new THREE.Scene();
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setClearColor(0,0);
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.domElement.setAttribute('aria-label','挂在墙上的中国足迹地图，点击青岛进入微缩场景');
  container.prepend(renderer.domElement);
  const labels=document.createElement('div');labels.className='travel-labels';container.append(labels);
  const leaders=document.createElementNS('http://www.w3.org/2000/svg','svg');leaders.classList.add('travel-label-leaders');leaders.setAttribute('aria-hidden','true');labels.append(leaders);

  const camera=new THREE.OrthographicCamera(-1,1,1,-1,.1,200);camera.up.set(0,1,0);
  scene.add(new THREE.HemisphereLight('#fff6de','#a6a78c',1.72));
  const sun=new THREE.DirectionalLight('#fff1cf',2.5);sun.position.set(-5,15,11);sun.castShadow=true;
  sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-14;sun.shadow.camera.right=14;sun.shadow.camera.top=14;sun.shadow.camera.bottom=-14;
  sun.shadow.normalBias=.03;sun.shadow.bias=-.0003;scene.add(sun);
  const fill=new THREE.DirectionalLight('#e7f1df',.55);fill.position.set(6,8,-4);scene.add(fill);

  // A soft vertical wall sits behind the framed map. It fades away when the
  // map lies down and the wall map becomes a tabletop diorama.
  const backdrop=new THREE.Group();scene.add(backdrop);
  const wallMaterial=new THREE.MeshStandardMaterial({color:'#ece4d4',roughness:.92,transparent:true,opacity:1});
  const wallPlane=new THREE.Mesh(new THREE.PlaneGeometry(28,18),wallMaterial);wallPlane.position.set(0,MAP_CENTER_Y,-1.15);wallPlane.receiveShadow=true;backdrop.add(wallPlane);
  const lineMaterial=new THREE.MeshStandardMaterial({color:'#dccfbc',roughness:.9,transparent:true,opacity:.55});
  for(let x=-14;x<=14;x+=.55){const line=new THREE.Mesh(new THREE.BoxGeometry(.012,18,.015),lineMaterial);line.position.set(x,MAP_CENTER_Y,-1.13);backdrop.add(line);}
  wallMaterial.userData.baseOpacity=1;lineMaterial.userData.baseOpacity=.55;

  const mapRoot=new THREE.Group();mapRoot.position.set(0,MAP_CENTER_Y,0);mapRoot.scale.setScalar(MAP_SCALE);scene.add(mapRoot);
  const model=createChinaMapModel({focusMode:true});model.group.position.set(0,0,-.2548);mapRoot.add(model.group);
  const qingdaoLocal=model.point(QINGDAO_LONLAT[0],QINGDAO_LONLAT[1],.066);
  const island=createQingdaoIsland(container);
  const travelPage=container.closest('#travel-page');
  renderer.domElement.style.transition='opacity .6s ease';

  const markers=new THREE.Group();model.group.add(markers);
  const markerScale=.7*.13;
  const globeGeo=new THREE.SphereGeometry(.085,16,12),stemGeo=new THREE.CylinderGeometry(.018,.025,.27,10),baseGeo=new THREE.CylinderGeometry(.09,.105,.024,16);
  const lightMat=new THREE.MeshStandardMaterial({color:'#f3dda0',emissive:'#d2ab4c',emissiveIntensity:.6,roughness:.45});
  const landmarkMat=new THREE.MeshStandardMaterial({color:'#e7a66b',emissive:'#c7783e',emissiveIntensity:.35,roughness:.4});
  const glowCanvas=document.createElement('canvas');glowCanvas.width=glowCanvas.height=64;
  const ctx=glowCanvas.getContext('2d'),gradient=ctx.createRadialGradient(32,32,0,32,32,32);gradient.addColorStop(0,'rgba(248,218,135,.65)');gradient.addColorStop(.4,'rgba(240,207,118,.24)');gradient.addColorStop(1,'rgba(240,207,118,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,64,64);
  const glowGeo=new THREE.PlaneGeometry(.6*.13,.6*.13),glowMat=new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(glowCanvas),transparent:true,depthWrite:false,toneMapped:false});
  const ringMarker=makeRing(model.group);ringMarker.visible=false;
  let counts=new Map(),selected=null,preview=null,hovered=null,focused=null,labelEntries=[],active=true,last=0,labelsDirty=true,measureLabels=true,sceneDirty=true;
  let userZoom=1,panX=0,panY=0,focusProgress=0,focusFrom=0,focusTarget=0,focusAnimating=false,focusStart=0,focusMode=false,focusAzimuth=0,focusElevation=.42,focusZoom=1,islandVisible=false;
  let panning=null,pinch=null,orbit=null;const pointers=new Map();

  function makeRing(parent){const mesh=new THREE.Mesh(new THREE.TorusGeometry(.20*.13,.011*.13,6,48),new THREE.MeshBasicMaterial({color:'#cbae65',toneMapped:false}));mesh.castShadow=false;parent.add(mesh);return mesh;}
  function marker(parent,x,y,color){const g=new THREE.Group();g.position.set(x,y,0);parent.add(g);const pin=new THREE.Group();pin.scale.setScalar(markerScale);pin.rotation.x=Math.PI/2;g.add(pin);addMesh(pin,baseGeo,'#b69d5d',0,.015,0);addMesh(pin,stemGeo,'#b09b64',0,.15,0);addMesh(pin,globeGeo,color,0,.335,0);const glow=addMesh(g,glowGeo,glowMat,0,0,.001);glow.castShadow=false;return g;}
  function addMesh(parent,geometry,material,x=0,y=0,z=0){const mesh=new THREE.Mesh(geometry,typeof material==='string'?new THREE.MeshStandardMaterial({color:material,roughness:.88}):material);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;}

  function rebuild(){
    sceneDirty=true;labelsDirty=true;measureLabels=true;hovered=null;markers.clear();labels.replaceChildren(leaders);leaders.replaceChildren();labelEntries=[];
    const displayed=new Map(counts);if(!displayed.has(QINGDAO_ID))displayed.set(QINGDAO_ID,0);if(preview&&!displayed.has(preview))displayed.set(preview,0);
    for(const [id,count] of displayed){
      const city=CITY_BY_ID.get(id);if(!city)continue;
      const landmark=id===QINGDAO_ID;
      const g=marker(markers,0,0,landmark?landmarkMat:lightMat);g.userData.cityId=id;
      const local=model.point(city.lon,city.lat);g.position.set(local.x,local.y,local.z);
      const button=document.createElement('button');button.className='travel-city-label';button.textContent=cityName(city)+(landmark||count?'':' · 待保存');
      button.setAttribute('aria-label',landmark?(count?`${cityName(city)}，${count} 段回忆，点击进入微缩场景`:`${cityName(city)}，微缩场景`):(count?`${cityName(city)}，${count} 段回忆`:`${cityName(city)}，待保存地点`));
      button.disabled=!count&&!landmark;button.onclick=()=>onSelect(id);labels.append(button);button.dataset.cityId=id;
      button.onfocus=()=>{focused=id;labelsDirty=true;};button.onblur=()=>{focused=null;labelsDirty=true;};
      const line=document.createElementNS('http://www.w3.org/2000/svg','line');leaders.append(line);
      labelEntries.push({id,count,landmark,button,line,local,world:model.group.localToWorld(local.clone())});
    }
    select(selected);renderer.shadowMap.needsUpdate=true;
  }
  function select(id){sceneDirty=true;selected=id;const city=CITY_BY_ID.get(id);ringMarker.visible=!!city&&focusProgress<.02;if(city)ringMarker.position.copy(model.point(city.lon,city.lat,.007));for(const entry of labelEntries)entry.button.classList.toggle('selected',entry.id===id);}
  function setRecords(records){counts=new Map();for(const r of records)counts.set(r.cityId,(counts.get(r.cityId)||0)+1);rebuild();}
  function setPreview(id){preview=id;rebuild();select(id);}

  function wallViewHeight(w,h){
    const aspect=w/h,safeHeight=Math.max(220,h-170);
    // Keep the whole wall map visible, clear of the topbar/footer and never
    // cropped on portrait or short landscape screens.
    return Math.max(MAP_HEIGHT*1.28,MAP_WIDTH/aspect*1.08,MAP_HEIGHT*h/safeHeight);
  }
  function focusViewHeight(w,h){
    const aspect=w/h;
    // Push in noticeably closer over the Qingdao pin before the map lies flat.
    return Math.max(1.55,1.05/aspect);
  }
  function qingdaoWorld(){return new THREE.Vector3(qingdaoLocal.x*MAP_SCALE,MAP_CENTER_Y+(qingdaoLocal.z+model.group.position.z)*MAP_SCALE,-qingdaoLocal.y*MAP_SCALE);}
  function worldFor(lonlat){const p=model.point(lonlat[0],lonlat[1],.066);return new THREE.Vector3(p.x*MAP_SCALE,MAP_CENTER_Y+(p.z+model.group.position.z)*MAP_SCALE,-p.y*MAP_SCALE);}
  let focusWorld=qingdaoWorld(),pendingFocusDone=null;
  function applyCamera(w=container.clientWidth,h=container.clientHeight){
    if(!w||!h)return;
    const aspect=w/h,p=smooth(focusProgress);
    const wallHeight=wallViewHeight(w,h),focusHeight=focusViewHeight(w,h),viewHeight=THREE.MathUtils.lerp(wallHeight,focusHeight,p);
    camera.top=viewHeight/2;camera.bottom=-camera.top;camera.right=camera.top*aspect;camera.left=-camera.right;
    const wallTarget=new THREE.Vector3(panX,MAP_CENTER_Y+panY,0),wallPosition=new THREE.Vector3(panX,MAP_CENTER_Y+panY,22);
    const focusTargetPoint=focusWorld;
    const direction=new THREE.Vector3(Math.sin(focusAzimuth)*Math.cos(focusElevation),Math.sin(focusElevation),Math.cos(focusAzimuth)*Math.cos(focusElevation));
    const focusPosition=focusTargetPoint.clone().addScaledVector(direction,20);
    camera.position.lerpVectors(wallPosition,focusPosition,p);
    const target=wallTarget.clone().lerp(focusTargetPoint,p);
    camera.zoom=THREE.MathUtils.lerp(userZoom,focusZoom,p);
    camera.lookAt(target);camera.updateProjectionMatrix();
    // Hold the wall map upright while the camera pushes in, then lay it flat.
    const tilt=smooth(clamp((p-.5)/.5,0,1));
    mapRoot.rotation.x=-Math.PI/2*tilt;
    mapRoot.updateMatrixWorld(true);
    const fade=1-smooth(Math.min(1,p*1.45));
    backdrop.visible=fade>.001;
    wallMaterial.opacity=wallMaterial.userData.baseOpacity*fade;
    lineMaterial.opacity=lineMaterial.userData.baseOpacity*fade;
    model.setFocusMode(p>.16);
    if(focusTarget===1){markers.visible=false;ringMarker.visible=false;}
    else{markers.visible=p<.035;ringMarker.visible=ringMarker.visible&&p<.035;}
    if(p>.001)labelsDirty=false;
  }

  function fit(){
    const w=container.clientWidth,h=container.clientHeight;if(!w||!h)return;
    renderer.setSize(w,h);camera.aspect=w/h;applyCamera(w,h);sceneDirty=true;labelsDirty=true;island.fit();
  }

  const tap=createTapTracker({distance:7}),raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
  function hit(event){
    camera.updateMatrixWorld();const rect=renderer.domElement.getBoundingClientRect();
    const x=event.clientX-rect.left,y=event.clientY-rect.top;let nearest=null,distance=event.pointerType==='touch'?18:11;
    for(const entry of labelEntries){if(!entry.count&&!entry.landmark)continue;const p=entry.world.clone().project(camera),px=(p.x+1)*rect.width/2,py=(1-p.y)*rect.height/2,d=Math.hypot(px-x,py-y);if(p.z>=-1&&p.z<=1&&d<distance){nearest=entry.id;distance=d;}}
    return nearest;
  }
  function clampPan(){panX=clamp(panX,-MAP_WIDTH*.45,MAP_WIDTH*.45);panY=clamp(panY,-MAP_HEIGHT*.45,MAP_HEIGHT*.45);}
  function startPan(event){panning={id:event.pointerId,x:event.clientX,y:event.clientY,baseX:panX,baseY:panY,moved:false};}
  function movePan(event){
    if(!panning||panning.id!==event.pointerId||focusProgress>.01)return;
    const dx=event.clientX-panning.x,dy=event.clientY-panning.y;
    if(!panning.moved&&Math.hypot(dx,dy)<5)return;
    panning.moved=true;
    const scale=(wallViewHeight(container.clientWidth,container.clientHeight)/camera.zoom)/container.clientHeight;
    panX=panning.baseX-dx*scale;panY=panning.baseY+dy*scale;clampPan();applyCamera();sceneDirty=true;labelsDirty=true;renderer.domElement.style.cursor='grabbing';
  }
  function endPan(event){if(panning?.id!==event.pointerId)return false;const moved=panning.moved;panning=null;renderer.domElement.style.cursor=focusProgress>.01?'default':'grab';return moved;}
  function pinchDistance(){const values=[...pointers.values()];return values.length<2?0:Math.hypot(values[0].x-values[1].x,values[0].y-values[1].y);}

  renderer.domElement.addEventListener('pointerdown',e=>{
    pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(pointers.size===2){tap.cancel(e);panning=null;orbit=null;pinch={distance:Math.max(1,pinchDistance()),zoom:focusProgress>.01?focusZoom:userZoom,focus:focusProgress>.01};return;}
    if(focusProgress>.01){if(e.button===0){orbit={id:e.pointerId,x:e.clientX,y:e.clientY,azimuth:focusAzimuth,elevation:focusElevation};renderer.domElement.setPointerCapture?.(e.pointerId);renderer.domElement.style.cursor='grabbing';}return;}
    tap.begin(e);if(e.button===0)startPan(e);renderer.domElement.setPointerCapture?.(e.pointerId);
  });
  renderer.domElement.addEventListener('pointermove',e=>{
    if(pointers.has(e.pointerId))pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(pointers.size>=2&&pinch){const d=Math.max(1,pinchDistance());if(pinch.focus)focusZoom=clamp(pinch.zoom*d/pinch.distance,.68,2.4);else userZoom=clamp(pinch.zoom*d/pinch.distance,.65,2.5);applyCamera();sceneDirty=true;labelsDirty=true;return;}
    if(focusProgress>.01){
      if(orbit?.id===e.pointerId){const dx=e.clientX-orbit.x,dy=e.clientY-orbit.y;focusAzimuth=orbit.azimuth-dx*.0075;focusElevation=clamp(orbit.elevation-dy*.0055,.2,.9);applyCamera();sceneDirty=true;}
      renderer.domElement.style.cursor=orbit?'grabbing':'grab';return;
    }
    tap.move(e);movePan(e);
    if(e.buttons||e.pointerType==='touch')return;
    const id=e.target.closest?.('.travel-city-label')?.dataset.cityId||(e.target===renderer.domElement?hit(e):null);
    if(id!==hovered){hovered=id;labelsDirty=true;}renderer.domElement.style.cursor=panning?.moved?'grabbing':id?'pointer':'grab';
  });
  renderer.domElement.addEventListener('pointerup',e=>{
    pointers.delete(e.pointerId);if(pointers.size<2)pinch=null;if(orbit?.id===e.pointerId)orbit=null;
    const click=tap.end(e),moved=endPan(e);
    if(click&&!moved&&active&&focusProgress<.01)onSelect(hit(e));
  });
  renderer.domElement.addEventListener('pointercancel',e=>{pointers.delete(e.pointerId);if(pointers.size<2)pinch=null;if(orbit?.id===e.pointerId)orbit=null;tap.cancel(e);endPan(e);});
  renderer.domElement.addEventListener('pointerleave',()=>{if(hovered){hovered=null;labelsDirty=true;}});
  renderer.domElement.addEventListener('wheel',event=>{
    event.preventDefault();
    if(focusProgress>.01){focusZoom=clamp(focusZoom*(event.deltaY>0?1/1.1:1.1),.68,2.4);applyCamera();sceneDirty=true;return;}
    const factor=event.deltaY>0?1/1.12:1.12;userZoom=clamp(userZoom*factor,.65,2.5);applyCamera();sceneDirty=true;labelsDirty=true;
  },{passive:false});
  renderer.domElement.style.cursor='grab';

  const resize=new ResizeObserver(fit);resize.observe(container);window.addEventListener('resize',fit);fit();
  renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;
  function showIsland(){
    if(islandVisible)return;
    islandVisible=true;
    travelPage?.classList.add('travel-island-scene');
    renderer.domElement.style.opacity='0';
    island.enter();
  }
  function hideIsland(){
    if(!islandVisible)return;
    islandVisible=false;
    travelPage?.classList.remove('travel-island-scene');
    renderer.domElement.style.opacity='1';
    island.exit();
  }

  function render(time){
    requestAnimationFrame(render);
    if(!active||document.hidden)return;
    if(focusAnimating){
      const p=Math.min(1,(time-focusStart)/FOCUS_DURATION),eased=p*p*(3-2*p);
      focusProgress=focusFrom+(focusTarget-focusFrom)*eased;
      if(p>=1){
        focusAnimating=false;focusProgress=focusTarget;
        if(focusTarget===1){
          if(pendingFocusDone){const done=pendingFocusDone;pendingFocusDone=null;done();}
          else{showIsland();}
        }
        else{focusMode=false;onFocusChange(false);labelsDirty=true;measureLabels=true;markers.visible=true;ringMarker.visible=!!selected;labels.style.visibility='';labels.style.opacity='';}
      }
      applyCamera();sceneDirty=true;renderer.shadowMap.needsUpdate=true;
    }
    if(time-last<30)return;last=time;
    if(sceneDirty){renderer.render(scene,camera);sceneDirty=false;}
    if(labelsDirty&&focusProgress<.01){layoutLabels();labelsDirty=false;}
  }
  requestAnimationFrame(render);

  function layoutLabels(){

    const w=container.clientWidth,h=container.clientHeight;if(!w||!h)return;
    camera.updateMatrixWorld(true);
    if(measureLabels){for(const e of labelEntries){e.button.hidden=false;e.button.style.visibility='hidden';}for(const e of labelEntries){e.width=e.button.offsetWidth;e.height=e.button.offsetHeight;}measureLabels=false;}
    model.face.updateWorldMatrix(true,false);
    const points=[[-WALL_DECOR_LAYOUT.map.faceWidth/2,-WALL_DECOR_LAYOUT.map.faceHeight/2],[WALL_DECOR_LAYOUT.map.faceWidth/2,WALL_DECOR_LAYOUT.map.faceHeight/2]].map(([x,y])=>model.face.localToWorld(new THREE.Vector3(x,y,0)).project(camera));
    const xs=points.map(p=>(p.x+1)*w/2),ys=points.map(p=>(1-p.y)*h/2);
    const x=Math.max(12,Math.min(...xs)+5),y=Math.max(12,Math.min(...ys)+5);
    const bounds={x,y,width:Math.max(0,Math.min(w-12,Math.max(...xs)-5)-x),height:Math.max(0,Math.min(h-12,Math.max(...ys)-5)-y)};
    const stage=container.getBoundingClientRect(),page=container.closest('#travel-page');
    const obstacleElements=[...page.querySelectorAll('.travel-topbar,.travel-footer,.travel-drawer-toggle')];
    if(page.classList.contains('drawer-open'))obstacleElements.push(page.querySelector('.travel-sidebar'));
    const obstacles=obstacleElements.map(el=>{const r=el.getBoundingClientRect();return {x:r.left-stage.left-6,y:r.top-stage.top-6,width:r.width+12,height:r.height+12};});
    const items=labelEntries.map(e=>{
      e.world=model.group.localToWorld(e.local.clone());
      const p=e.world.clone().project(camera);e.x=(p.x+1)*w/2;e.y=(1-p.y)*h/2;
      e.button.dataset.pinX=e.x.toFixed(2);e.button.dataset.pinY=e.y.toFixed(2);
      return {...e,x:p.z>=-1&&p.z<=1?e.x:NaN,preferred:e.placement?{x:e.x+e.placement.x,y:e.y+e.placement.y}:null,priority:e.id===focused||e.id===hovered?3:e.id===preview?2:e.id===selected?1:0};
    });
    const placements=new Map(layoutTravelLabels(items,{bounds,obstacles,maxOffset:w<=700?24:44}).map(p=>[p.id,p]));
    for(const e of labelEntries){
      const p=placements.get(e.id);e.button.hidden=!p;e.button.style.visibility='';e.line.style.display=p?.leader?'':'none';
      e.button.classList.toggle('highlighted',e.id===hovered||e.id===focused);
      e.placement=p?{x:p.x-e.x,y:p.y-e.y}:null;
      if(!p)continue;e.button.style.left=p.x+'px';e.button.style.top=p.y+'px';
      for(const [key,value] of Object.entries({x1:p.start.x,y1:p.start.y,x2:p.end.x,y2:p.end.y}))e.line.setAttribute(key,value);
    }
  }

  function mapBounds(){
    const oldRotation=mapRoot.rotation.x;mapRoot.rotation.x=0;mapRoot.updateMatrixWorld(true);
    const oldProgress=focusProgress;focusProgress=0;applyCamera();camera.updateMatrixWorld(true);model.face.updateWorldMatrix(true,false);
    const {width,height}=model.face.geometry.parameters,w=container.clientWidth,h=container.clientHeight;
    const points=[[-width/2,-height/2],[width/2,height/2]].map(([x,y])=>model.face.localToWorld(new THREE.Vector3(x,y,0)).project(camera));
    const xs=points.map(p=>(p.x+1)*w/2),ys=points.map(p=>(1-p.y)*h/2);
    renderer.render(scene,camera);
    mapRoot.rotation.x=oldRotation;focusProgress=oldProgress;applyCamera();mapRoot.updateMatrixWorld(true);
    return {left:Math.min(...xs),top:Math.min(...ys),width:Math.abs(xs[1]-xs[0]),height:Math.abs(ys[1]-ys[0])};
  }
  function focusCity(lonlat,onDone){
    focusWorld=worldFor(lonlat);pendingFocusDone=onDone||null;
    if(focusTarget===1&&!focusAnimating){
      const done=pendingFocusDone;pendingFocusDone=null;if(done)done();return;
    }
    focusDiorama();
  }
  function focusDiorama(){
    if(focusTarget===1&&!focusAnimating)return;
    if(focusProgress<.01){
      hideIsland();
      travelPage?.classList.remove('travel-island-scene');
      renderer.domElement.style.opacity='1';
    }
    focusAzimuth=0;focusElevation=.42;focusZoom=1;orbit=null;
    markers.visible=false;ringMarker.visible=false;labels.style.visibility='hidden';labels.style.opacity='0';
    focusFrom=focusProgress;focusTarget=1;focusStart=performance.now();focusAnimating=true;focusMode=true;onFocusChange(true);
    renderer.shadowMap.needsUpdate=true;sceneDirty=true;
  }
  function exitDiorama(){
    if(focusTarget===0&&!focusAnimating)return;
    hideIsland();
    focusFrom=focusProgress;focusTarget=0;focusStart=performance.now();focusAnimating=true;focusMode=false;orbit=null;
    renderer.shadowMap.needsUpdate=true;sceneDirty=true;
  }
  function zoom(factor){if(focusProgress>.01){island.zoom(factor);return;}userZoom=clamp(userZoom*factor,.65,2.5);applyCamera();sceneDirty=true;labelsDirty=true;}
  function reset(){if(focusProgress>.01){island.resetView();return;}userZoom=1;panX=panY=0;applyCamera();sceneDirty=true;labelsDirty=true;}
  function setActive(value){
    active=value;
    if(value){
      focusProgress=0;focusFrom=0;focusTarget=0;focusAnimating=false;focusMode=false;focusAzimuth=0;focusElevation=.42;focusZoom=1;orbit=null;
      mapRoot.rotation.x=0;backdrop.visible=true;wallMaterial.opacity=1;lineMaterial.opacity=.55;model.setFocusMode(false);markers.visible=true;ringMarker.visible=!!selected;labels.style.visibility='';labels.style.opacity='';
      userZoom=1;panX=panY=0;
      islandVisible=false;island.setActive(false);travelPage?.classList.remove('travel-island-scene');renderer.domElement.style.opacity='1';
      fit();onFocusChange(false);sceneDirty=true;labelsDirty=true;measureLabels=true;
    }else{
      hideIsland();island.setActive(false);travelPage?.classList.remove('travel-island-scene');renderer.domElement.style.opacity='1';
      tap.reset();panning=null;orbit=null;pointers.clear();pinch=null;onFocusChange(false);
    }
  }
  return {setRecords,setPreview,select,setActive,fit,reset,zoom,mapBounds,focusCity,focusDiorama,exitDiorama,isFocused:()=>focusProgress>.01||focusMode,debug:()=>({focusProgress,focusTarget,zoom:userZoom,panX,panY,focusAzimuth,focusElevation,focusZoom})};

}
