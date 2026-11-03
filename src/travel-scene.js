import * as THREE from 'three';
import { OrbitControls } from './assets/OrbitControls.js';
import { createChinaMapModel, createSageWallPanel, createHomeLighting } from './wall-decor.js';
import { WALL_DECOR_LAYOUT } from './wall-layout.js';
import { CITY_BY_ID, cityName } from './travel-storage.js';
import { travelFrame, travelCardMaxHeight } from './travel-frame.js';
import { createTapTracker } from './ui.js';
import { layoutTravelLabels } from './travel-labels.js';

export function createTravelScene(container, onSelect){
  const scene=new THREE.Scene();
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setClearColor(0,0);
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.domElement.setAttribute('aria-label','固定俯视的足迹地图，可上下左右拖动、放大缩小');
  container.prepend(renderer.domElement);
  const labels=document.createElement('div');labels.className='travel-labels';container.append(labels);
  const leaders=document.createElementNS('http://www.w3.org/2000/svg','svg');leaders.classList.add('travel-label-leaders');leaders.setAttribute('aria-hidden','true');labels.append(leaders);
  const camera=new THREE.OrthographicCamera(-1,1,1,-1,.1,180);
  camera.up.set(0,0,-1);camera.position.set(0,30,0);
  const controls=new OrbitControls(camera,renderer.domElement);
  controls.enableRotate=false;controls.enablePan=false;controls.enableDamping=false;controls.enableZoom=true;
  controls.mouseButtons={LEFT:null,MIDDLE:THREE.MOUSE.DOLLY,RIGHT:null};
  controls.touches={ONE:null,TWO:THREE.TOUCH.DOLLY_PAN};
  controls.minZoom=.65;controls.maxZoom=2.5;
  let sceneDirty=true;controls.addEventListener('change',()=>{const x=panX,z=panZ;clampPan();if(x!==panX||z!==panZ){const cx=baseTargetX+panX;controls.target.x=cx;controls.target.z=panZ;camera.position.x=cx;camera.position.z=panZ;}sceneDirty=true;labelsDirty=true;});
  const mats=new Map();
  function mat(color){if(!mats.has(color))mats.set(color,new THREE.MeshStandardMaterial({color,roughness:.88}));return mats.get(color);}
  function add(geometry,material,parent,x=0,y=0,z=0){const mesh=new THREE.Mesh(geometry,typeof material==='string'?mat(material):material);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;}
  scene.add(new THREE.HemisphereLight('#fff6de','#a6a78c',1.8));
  const sun=new THREE.DirectionalLight('#fff3d4',2.6);sun.position.set(-5,20,7);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-25;sun.shadow.camera.right=25;sun.shadow.camera.top=25;sun.shadow.camera.bottom=-25;sun.shadow.normalBias=.025;sun.shadow.bias=-.0004;scene.add(sun);
  const fill=new THREE.DirectionalLight('#e9f3e9',.55);fill.position.set(5,16,-4);scene.add(fill);

  // Present the home's framed map against a continuous wall, without a window.
  const {map:mapLayout,view}=WALL_DECOR_LAYOUT;
  const mapWorldWidth=mapLayout.width*view.scale,mapWorldHeight=mapLayout.height*view.scale;
  const wall=new THREE.Group();wall.rotation.x=-Math.PI/2;wall.scale.setScalar(view.scale);
  wall.position.set(-mapLayout.x*view.scale,-(mapLayout.z+mapLayout.faceZ)*view.scale,mapLayout.y*view.scale);scene.add(wall);
  wall.add(createSageWallPanel({windowOpening:false}));
  const model=createChinaMapModel();model.group.position.set(mapLayout.x,mapLayout.y,mapLayout.z);wall.add(model.group);
  // Re-light only the frame with the home's lights in the map's new orientation.
  model.frame.layers.enable(2);model.backing.layers.enable(2);
  for(const light of Object.values(createHomeLighting())){
    const {x,y,z}=light.position;light.position.set(-z,x,-y);light.layers.set(2);scene.add(light);
  }
  scene.updateMatrixWorld(true);

  const markers=new THREE.Group();model.group.add(markers);
  const markerScale=.7*.13;
  const globeGeo=new THREE.SphereGeometry(.085,16,12),stemGeo=new THREE.CylinderGeometry(.018,.025,.27,10),baseGeo=new THREE.CylinderGeometry(.09,.105,.024,16);
  const lightMat=new THREE.MeshStandardMaterial({color:'#f3dda0',emissive:'#d2ab4c',emissiveIntensity:.6,roughness:.45});
  const glowCanvas=document.createElement('canvas');glowCanvas.width=glowCanvas.height=64;
  const ctx=glowCanvas.getContext('2d'),gradient=ctx.createRadialGradient(32,32,0,32,32,32);gradient.addColorStop(0,'rgba(248,218,135,.65)');gradient.addColorStop(.4,'rgba(240,207,118,.24)');gradient.addColorStop(1,'rgba(240,207,118,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,64,64);
  const glowGeo=new THREE.PlaneGeometry(.6*.13,.6*.13),glowMat=new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(glowCanvas),transparent:true,depthWrite:false,toneMapped:false});
  const ring=add(new THREE.TorusGeometry(.20*.13,.011*.13,6,48),new THREE.MeshBasicMaterial({color:'#cbae65',toneMapped:false}),model.group);ring.visible=false;ring.castShadow=false;
  let counts=new Map(),selected=null,preview=null,hovered=null,focused=null,labelEntries=[],active=true,last=0,labelsDirty=true,measureLabels=true,panX=0,panZ=0,baseTargetX=0,panning=null,columnWidthAtZoom1=1,columnHeightAtZoom1=1;
  function rebuild(){
    sceneDirty=true;labelsDirty=true;measureLabels=true;hovered=null;markers.clear();labels.replaceChildren(leaders);leaders.replaceChildren();labelEntries=[];
    const displayed=new Map(counts);if(preview&&!displayed.has(preview))displayed.set(preview,0);
    for(const [id,count] of displayed){
      const city=CITY_BY_ID.get(id);if(!city)continue;
      const g=new THREE.Group();g.userData.cityId=id;g.position.copy(model.point(city.lon,city.lat));markers.add(g);
      const pin=new THREE.Group();pin.scale.setScalar(markerScale);pin.rotation.x=Math.PI/2;g.add(pin);
      add(baseGeo,'#b69d5d',pin,0,.015,0);add(stemGeo,'#b09b64',pin,0,.15,0);add(globeGeo,lightMat,pin,0,.335,0);
      const glow=add(glowGeo,glowMat,g,0,0,.001);glow.castShadow=false;
      const button=document.createElement('button');button.className='travel-city-label';button.textContent=cityName(city)+(count?'':' · 待保存');button.setAttribute('aria-label',count?`${cityName(city)}，${count} 段回忆`:`${cityName(city)}，待保存地点`);button.disabled=!count;button.onclick=()=>onSelect(id);labels.append(button);
      button.dataset.cityId=id;
      button.onfocus=()=>{focused=id;labelsDirty=true;};button.onblur=()=>{focused=null;labelsDirty=true;};
      const line=document.createElementNS('http://www.w3.org/2000/svg','line');leaders.append(line);
      labelEntries.push({id,count,button,line,world:model.group.localToWorld(model.point(city.lon,city.lat))});
    }
    select(selected);renderer.shadowMap.needsUpdate=true;
  }
  function select(id){sceneDirty=true;selected=id;const city=CITY_BY_ID.get(id);ring.visible=!!city;if(city)ring.position.copy(model.point(city.lon,city.lat,.007));for(const entry of labelEntries)entry.button.classList.toggle('selected',entry.id===id);}
  function setRecords(records){counts=new Map();for(const r of records)counts.set(r.cityId,(counts.get(r.cityId)||0)+1);rebuild();}
  function setPreview(id){preview=id;rebuild();select(id);}
  const tap=createTapTracker();
  function hit(event){
    camera.updateMatrixWorld();const rect=renderer.domElement.getBoundingClientRect();
    const x=event.clientX-rect.left,y=event.clientY-rect.top;let nearest=null,distance=event.pointerType==='touch'?18:11;
    for(const entry of labelEntries){if(!entry.count)continue;const p=entry.world.clone().project(camera),px=(p.x+1)*rect.width/2,py=(1-p.y)*rect.height/2,d=Math.hypot(px-x,py-y);if(p.z>=-1&&p.z<=1&&d<distance){nearest=entry.id;distance=d;}}
    return nearest;
  }
  function clampPan(){
    // Let the map slide inside its column, or reveal its edges once zoomed in,
    // without letting it disappear under the card or off the stage.
    const columnWidth=columnWidthAtZoom1/camera.zoom,columnHeight=columnHeightAtZoom1/camera.zoom;
    const limitX=Math.abs(mapWorldWidth-columnWidth)*.5,limitZ=Math.abs(mapWorldHeight-columnHeight)*.5;
    panX=THREE.MathUtils.clamp(panX,-limitX,limitX);
    panZ=THREE.MathUtils.clamp(panZ,-limitZ,limitZ);
  }
  function placeCamera(){
    clampPan();const x=baseTargetX+panX;
    controls.target.set(x,0,panZ);camera.position.set(x,30,panZ);controls.update();
  }
  function beginPan(event){
    if(event.pointerType==='mouse'&&event.button!==0)return;
    panning={id:event.pointerId,x:event.clientX,y:event.clientY,baseX:panX,baseZ:panZ,moved:false};
  }
  function movePan(event){
    if(!panning||panning.id!==event.pointerId)return;
    const dx=event.clientX-panning.x,dy=event.clientY-panning.y;
    if(!panning.moved&&Math.hypot(dx,dy)<5)return;
    panning.moved=true;
    const scale=(camera.top-camera.bottom)/camera.zoom/container.clientHeight;
    panX=panning.baseX-dx*scale;panZ=panning.baseZ-dy*scale;
    placeCamera();sceneDirty=true;labelsDirty=true;renderer.domElement.style.cursor='grabbing';
  }
  function endPan(event){
    if(panning?.id!==event.pointerId)return false;
    const moved=panning.moved;panning=null;renderer.domElement.style.cursor='grab';return moved;
  }
  renderer.domElement.addEventListener('pointerdown',e=>{
    tap.begin(e);
    if(panning&&panning.id!==e.pointerId){panning=null;return;}
    beginPan(e);renderer.domElement.setPointerCapture?.(e.pointerId);
  });
  renderer.domElement.addEventListener('pointerup',e=>{
    const click=tap.end(e),moved=endPan(e);
    if(click&&!moved&&active)onSelect(hit(e));
  });
  renderer.domElement.addEventListener('pointercancel',e=>{tap.cancel(e);endPan(e);});
  renderer.domElement.addEventListener('pointermove',e=>{tap.move(e);movePan(e);});
  container.addEventListener('pointermove',e=>{
    if(e.buttons||e.pointerType==='touch')return;
    const id=e.target.closest?.('.travel-city-label')?.dataset.cityId||(e.target===renderer.domElement?hit(e):null);
    if(id!==hovered){hovered=id;labelsDirty=true;}renderer.domElement.style.cursor=panning?.moved?'grabbing':id?'pointer':'grab';
  });
  container.addEventListener('pointerleave',()=>{if(hovered){hovered=null;labelsDirty=true;}});
  let layoutKey=null;
  function fit(){
    const w=container.clientWidth,h=container.clientHeight;if(!w||!h)return;
    const rect=container.getBoundingClientRect(),page=container.closest('#travel-page'),sidebar=page.querySelector('.travel-sidebar');
    const mobile=page.clientWidth<=700;
    const fitWidth=Math.max(1,w-(parseFloat(getComputedStyle(container).getPropertyValue('--travel-fit-inset'))||0));
    sidebar.style.maxHeight=mobile?'':travelCardMaxHeight(fitWidth)+'px';
    const card=sidebar.getBoundingClientRect();
    const area=mobile
      ?{top:page.querySelector('.travel-topbar').getBoundingClientRect().bottom-rect.top+18,bottom:card.top-rect.top-14}
      :{top:card.top-rect.top,bottom:card.bottom-rect.top};
    area.bottom=Math.max(area.top+90,area.bottom);
    const key=[w,h,fitWidth,area.top,area.bottom].join(':');if(key===layoutKey)return;layoutKey=key;sceneDirty=true;measureLabels=true;
    const framing=travelFrame(w,h,area,{mobile,fitWidth});
    renderer.setSize(w,h);
    camera.top=framing.viewHeight/2;camera.bottom=-camera.top;camera.right=camera.top*framing.aspect;camera.left=-camera.right;
    camera.setViewOffset(w,h,-framing.offsetX,-framing.offsetY,w,h);
    columnWidthAtZoom1=(camera.right-camera.left)*fitWidth/w;
    columnHeightAtZoom1=(camera.top-camera.bottom)*(area.bottom-area.top)/h;
    baseTargetX=framing.targetX;camera.updateProjectionMatrix();placeCamera();
  }
  const resize=new ResizeObserver(fit);resize.observe(container);resize.observe(container.closest('#travel-page').querySelector('.travel-sidebar'));
  window.addEventListener('resize',fit);fit();renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;
  function render(time){requestAnimationFrame(render);if(!active||document.hidden||time-last<30)return;last=time;controls.update();if(!sceneDirty&&!labelsDirty)return;if(sceneDirty)renderMap();layoutLabels();sceneDirty=false;labelsDirty=false;}
  requestAnimationFrame(render);
  function layoutLabels(){
    const w=container.clientWidth,h=container.clientHeight;if(!w||!h)return;
    camera.updateMatrixWorld(true);
    if(measureLabels){
      for(const e of labelEntries){e.button.hidden=false;e.button.style.visibility='hidden';}
      for(const e of labelEntries){e.width=e.button.offsetWidth;e.height=e.button.offsetHeight;}
      measureLabels=false;
    }
    const points=[[-mapLayout.faceWidth/2,-mapLayout.faceHeight/2],[mapLayout.faceWidth/2,mapLayout.faceHeight/2]].map(([x,y])=>model.face.localToWorld(new THREE.Vector3(x,y,0)).project(camera));
    const xs=points.map(p=>(p.x+1)*w/2),ys=points.map(p=>(1-p.y)*h/2);
    const x=Math.max(12,Math.min(...xs)+5),y=Math.max(12,Math.min(...ys)+5);
    const bounds={x,y,width:Math.max(0,Math.min(w-12,Math.max(...xs)-5)-x),height:Math.max(0,Math.min(h-12,Math.max(...ys)-5)-y)};
    const stage=container.getBoundingClientRect(),page=container.closest('#travel-page');
    const obstacles=[...page.querySelectorAll('.travel-sidebar,.travel-topbar,.travel-controls')].map(el=>{const r=el.getBoundingClientRect();return {x:r.left-stage.left-6,y:r.top-stage.top-6,width:r.width+12,height:r.height+12};});
    const items=labelEntries.map(e=>{
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
  function renderMap(){
    renderer.render(scene,camera);
    const clear=renderer.autoClear,mask=camera.layers.mask;
    try{renderer.autoClear=false;camera.layers.set(2);renderer.render(scene,camera);}
    finally{renderer.autoClear=clear;camera.layers.mask=mask;}
  }
  function mapBounds(){
    fit();camera.updateMatrixWorld(true);model.face.updateWorldMatrix(true,false);
    const {width,height}=model.face.geometry.parameters,w=container.clientWidth,h=container.clientHeight;
    const points=[[-width/2,-height/2],[width/2,height/2]].map(([x,y])=>model.face.localToWorld(new THREE.Vector3(x,y,0)).project(camera));
    const xs=points.map(p=>(p.x+1)*w/2),ys=points.map(p=>(1-p.y)*h/2);
    // Upload the prepared map before the visible handoff begins.
    renderMap();
    return {left:Math.min(...xs),top:Math.min(...ys),width:Math.abs(xs[1]-xs[0]),height:Math.abs(ys[1]-ys[0])};
  }
  function zoom(factor){camera.zoom=THREE.MathUtils.clamp(camera.zoom*factor,controls.minZoom,controls.maxZoom);camera.updateProjectionMatrix();placeCamera();sceneDirty=true;labelsDirty=true;}
  function reset(){panX=0;panZ=0;camera.zoom=1;camera.updateProjectionMatrix();placeCamera();sceneDirty=true;labelsDirty=true;}
  return {setRecords,setPreview,select,setActive:value=>{active=value;if(value){sceneDirty=true;labelsDirty=true;fit();placeCamera();}else{tap.reset();panning=null;}},fit,reset,zoom,mapBounds};
}
