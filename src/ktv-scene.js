import * as THREE from 'three';
import { OrbitControls } from './assets/OrbitControls.js';
import { RoundedBoxGeometry } from './assets/RoundedBoxGeometry.js';
import { createGuitarModel } from './guitar-model.js';
import { createKtvVideo } from './ktv-video.js';
import { createTapTracker } from './ui.js';
import { roomFrame } from './room-frame.js';

export function createKtvScene(container,onSelect){
  const scene=new THREE.Scene(),renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;container.append(renderer.domElement);
  const camera=new THREE.PerspectiveCamera(38,1,.12,180),controls=new OrbitControls(camera,renderer.domElement);
  controls.enableDamping=true;controls.dampingFactor=.075;controls.enablePan=false;
  controls.minPolarAngle=.12;controls.maxPolarAngle=1.3;controls.minAzimuthAngle=-.1;controls.maxAzimuthAngle=1.25;
  controls.target.set(0,1.8,0);camera.position.set(11,9,14);controls.update();controls.enabled=false;
  let dirty=true,active=false,entrance=0,zoomRatio=1,baseDistance=24,warm=true,screenMode=false,screenAnimating=false,screenStart=0,screenFrom=null,screenTo=null,roomPose=null;
  const room=new THREE.Group();scene.add(room);const materials=new Map();
  function material(color){if(!materials.has(color))materials.set(color,new THREE.MeshStandardMaterial({color,roughness:.85}));return materials.get(color);}
  function mesh(geo,mat,parent,x=0,y=0,z=0){const m=new THREE.Mesh(geo,typeof mat==='string'?material(mat):mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
  function box(parent,x,y,z,w,h,d,color,r=.04){return mesh(new RoundedBoxGeometry(w,h,d,2,Math.min(r,w/3,h/3,d/3)),color,parent,x,y,z);}
  function cyl(parent,x,y,z,rt,rb,h,color,sides=24){return mesh(new THREE.CylinderGeometry(rt,rb,h,sides),color,parent,x,y,z);}
  function sphere(parent,x,y,z,rx,ry,rz,color){const m=mesh(new THREE.SphereGeometry(1,24,16),color,parent,x,y,z);m.scale.set(rx,ry,rz);return m;}
  function group(parent,x=0,y=0,z=0,id){const g=new THREE.Group();g.position.set(x,y,z);if(id)g.userData.objectId=id;parent.add(g);return g;}
  function tube(parent,points,color,r=.012){return mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),32,r,6,false),color,parent);}
  function texture(draw,w=512,h=256){const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;}
  const daylight=new THREE.HemisphereLight('#fff4d9','#89927b',1.65);scene.add(daylight);
  const sun=new THREE.DirectionalLight('#fff0cf',2.6);sun.position.set(-4,9,7);sun.castShadow=true;
  sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-8;sun.shadow.camera.right=8;sun.shadow.camera.top=8;sun.shadow.camera.bottom=-8;
  sun.shadow.normalBias=.035;sun.shadow.bias=-.0003;scene.add(sun);
  const fill=new THREE.DirectionalLight('#e5f0df',.6);fill.position.set(6,5,-2);scene.add(fill);
  const glowMaterial=new THREE.MeshStandardMaterial({color:'#ffebbd',emissive:'#ffcb77',emissiveIntensity:.65,roughness:.5});
  const roomGlow=new THREE.PointLight('#ffda9d',3,9,2);roomGlow.position.set(0,3.65,-2.3);scene.add(roomGlow);
  const ground=mesh(new THREE.PlaneGeometry(200,200),new THREE.ShadowMaterial({opacity:.13,depthWrite:false}),scene,0,-.29,0);ground.rotation.x=-Math.PI/2;ground.castShadow=false;
  // Thick parquet base, softly upholstered walls and a continuous brass light rail.
  box(room,0,-.02,0,8.6,.45,6.8,'#bf9768',.16);box(room,0,.12,0,8.45,.2,6.65,'#dcc09a',.08);
  const floor=.24,wood=['#d9bb92','#e4cba6','#ceb086','#ddc29c','#d3b58b'];
  for(let row=0;row<13;row++)for(let col=0;col<10;col++){
    const left=Math.max(-4.12,-4.12+col*.9-(row%2)*.45),right=Math.min(4.12,-4.12+(col+1)*.9-(row%2)*.45);
    if(right>left){const plank=mesh(new THREE.BoxGeometry(right-left-.012,.045,.482),wood[(row*7+col*3)%5],room,(left+right)/2,.216,-3.25+(row+.5)*.5);plank.castShadow=false;}
  }
  box(room,0,2.32,-3.3,8.4,4.2,.16,'#f0e8da',.018);
  box(room,-4.17,2.32,0,.16,4.2,6.7,'#efe8dc',.018);
  box(room,0,.84,-3.19,8.26,1.19,.08,'#cdb692',.014);
  for(let i=0;i<55;i++)box(room,-4.04+i*.15,.82,-3.134,.044,1.13,.035,'#baa281',.007);
  for(let row=0;row<3;row++)for(let col=0;col<8;col++)box(room,-3.6+col*1.02,1.85+row*.82,-3.185,.975,.77,.12,(col+row)%2?'#a9c6dd':'#b7d0e2',.11);
  for(let i=0;i<7;i++)box(room,-4.066,2.54,-2.88+i*.88,.095,2.9,.83,i%2?'#e5ded1':'#ebe5d9',.12);
  box(room,0,.39,-3.17,8.3,.25,.14,'#f0ebdb',.016);box(room,-4.04,.39,0,.13,.25,6.5,'#f0ebdb',.016);
  box(room,0,4.48,-3.29,8.5,.12,.23,'#f2e8d0',.03);box(room,-4.18,4.48,0,.23,.12,6.8,'#f2e8d0',.03);
  box(room,0,4.35,-3.12,8.22,.035,.04,glowMaterial,.012);box(room,-4.025,4.35,0,.04,.035,6.48,glowMaterial,.012);
  // A clear stage runs along the left wall; the compact front bench stays below it.
  box(room,.12,.255,.35,4.86,.028,4.45,'#a9c6dd',.065);box(room,.12,.272,.35,4.69,.012,4.27,'#b7d0e2',.025);
  for(let i=0;i<14;i++){box(room,-2.11+i*.34,.282,-1.83,.1,.006,.15,'#efeadc',.004);box(room,-2.11+i*.34,.282,2.53,.1,.006,.15,'#efeadc',.004);}
  const stage=group(room,-3.28,floor,.12);stage.name='ktv-stage';
  box(stage,0,.155,0,1.48,.31,4.84,'#c0a784',.075);box(stage,0,.32,0,1.48,.07,4.84,'#8fb0cb',.055);
  box(stage,.745,.23,0,.014,.022,4.61,glowMaterial,.005);
  const bench=group(room,.42,floor,2.16);bench.name='ktv-bench';
  box(bench,0,.4,0,3.02,.35,1.1,'#b79175',.1);box(bench,0,.67,0,3.06,.31,1.1,'#a9c6dd',.13);
  box(bench,0,.97,.43,3.08,.85,.3,'#b7d0e2',.13);
  for(const x of [-.74,.74])box(bench,x,.679,-.045,1.44,.3,.93,'#a9c6dd',.12);
  for(const x of [-1.18,1.18])for(const z of [-.3,.3])cyl(bench,x,.15,z,.04,.05,.3,'#a98759',12);
  // Wall-mounted photo display, speaker cones and a low timber equipment cabinet.
  const screen=group(room,.42,2.77,-3.02,'screen');screen.name='ktv-screen';
  box(screen,0,0,0,4.62,2.57,.18,'#f0eadb',.09);box(screen,0,0,.105,4.43,2.39,.04,'#4f677b',.055);
  const player=createKtvVideo(renderer,()=>dirty=true);
  const screenMat=new THREE.MeshBasicMaterial({map:player.texture,toneMapped:false});
  const screenImage=mesh(new THREE.PlaneGeometry(4.28,2.205),screenMat,screen,0,0,.134);screenImage.castShadow=false;
  sphere(screen,2.11,-1.17,.144,.018,.018,.008,glowMaterial);
  const plaque=texture((ctx,W,H)=>{ctx.clearRect(0,0,W,H);ctx.fillStyle='#f6eed5';ctx.font='500 100px Georgia';ctx.textAlign='center';ctx.fillText('K T V',W/2,104);},512,128);
  const sign=mesh(new THREE.PlaneGeometry(.78,.195),new THREE.MeshBasicMaterial({map:plaque,transparent:true,toneMapped:false,depthWrite:false}),room,.42,4.18,-3.07);sign.castShadow=false;
  for(const x of [-2.52,3.36]){
    const speaker=group(room,x,2.74,-3.015);box(speaker,0,0,0,.55,1.76,.32,'#4f677b',.06);box(speaker,0,0,.174,.44,1.61,.045,'#5f7a90',.025);
    for(const [y,r] of [[.5,.1],[-.04,.165],[-.53,.165]]){
      const ring=mesh(new THREE.TorusGeometry(r,.013,8,36),'#9cb8cc',speaker,0,y,.205);
      const cone=cyl(speaker,0,y,.208,r*.88,r*.88,.025,'#3d5265');cone.rotation.x=Math.PI/2;sphere(speaker,0,y,.229,r*.36,r*.36,.03,'#8fa9ba');
    }
    box(speaker,0,-.76,.21,.09,.02,.006,'#e1d5bb',.005);
  }
  const console=group(room,.43,floor,-2.69);console.name='ktv-console';
  box(console,0,.36,0,4.65,.61,.72,'#ceb893',.055);box(console,0,.72,0,4.78,.1,.81,'#ead7b4',.025);
  for(const x of [-1.52,0,1.52]){box(console,x,.38,.377,1.43,.43,.035,'#dfccaa',.012);box(console,x,.47,.406,.21,.023,.035,'#b49c79',.009);}
  // The set-top box sits flush on the cabinet and is centred under the screen.
  const amplifier=group(console,0,.89,0);amplifier.name='ktv-set-top';box(amplifier,0,0,0,.92,.24,.42,'#4f677b',.035);
  for(let i=0;i<3;i++){const knob=cyl(amplifier,-.17+i*.17,0,.229,.042,.042,.03,'#e2dbc8');knob.rotation.x=Math.PI/2;}
  box(amplifier,-.33,0,.225,.22,.075,.012,glowMaterial,.01);
  box(console,0,.09,.27,4.36,.023,.04,glowMaterial,.009);
  // Rounded coffee table, two handheld microphones, glasses and a record sleeve.
  const table=group(room,-.08,floor,.36);box(table,0,.84,0,2.56,.14,1.44,'#ead7b4',.18);
  for(const x of [-.95,.95])for(const z of [-.47,.47])cyl(table,x,.4,z,.06,.085,.8,'#bca47f',16);
  function microphone(parent,x,y,z,angle,color){const mic=group(parent,x,y,z);mic.rotation.z=angle;mic.rotation.x=Math.PI/2;
    cyl(mic,0,.19,0,.047,.053,.39,color);box(mic,0,.18,.05,.021,.055,.009,'#dfd8c4',.004);
    sphere(mic,0,.43,0,.085,.09,.085,'#b1b89f');cyl(mic,0,.355,0,.06,.06,.043,'#5f6e58');
    for(let i=0;i<5;i++){const ring=mesh(new THREE.TorusGeometry(.078,.003,4,24),'#798770',mic,0,.4+i*.013,0);ring.rotation.x=Math.PI/2;}
    return mic;
  }
  microphone(table,-.54,.963,.2,.45,'#617259');microphone(table,.42,.963,.05,-.25,'#b69b7f');
  const stand=group(stage,-.15,.355,-1.7);stand.name='ktv-stand-mic';
  cyl(stand,0,.027,0,.21,.25,.054,'#67755e');cyl(stand,0,.745,0,.022,.029,1.43,'#c2b295');
  cyl(stand,0,.9,0,.043,.043,.11,'#617259');sphere(stand,0,1.47,0,.055,.055,.055,'#617259');
  tube(stand,[[0,1.47,0],[.25,1.62,0]],'#c2b295',.019);
  const standMic=microphone(stand,.25,1.62,0,-1.05,'#617259');standMic.rotation.x=0;
  for(const x of [-.78,.78]){cyl(table,x,.938,-.38,.14,.14,.026,'#bca583');const glass=cyl(table,x,1.064,-.38,.09,.07,.22,'#f0eadb');cyl(table,x,1.179,-.38,.075,.075,.009,'#cdb293');}
  box(table,.76,.946,.42,.48,.025,.29,'#a9c6dd',.022);box(table,.76,.962,.42,.43,.006,.24,'#eeebdd',.014);
  // A touchscreen on a real pedestal is the music entry, rather than a text card.
  const tablet=group(room,3.46,floor,-2.66);tablet.name='ktv-song-console';
  cyl(tablet,0,.045,0,.3,.34,.09,'#dac6a0');cyl(tablet,0,.55,0,.035,.047,1.02,'#b9a27f');
  const tabletHead=group(tablet,0,1.27,0);tabletHead.rotation.x=-.32;tabletHead.rotation.y=.2;
  box(tabletHead,0,0,0,.95,.67,.08,'#d1c2a6',.055);box(tabletHead,0,0,.049,.84,.56,.025,'#b7d0e2',.025);
  const tabletTex=texture((ctx,W,H)=>{ctx.fillStyle='#cfe2f0';ctx.fillRect(0,0,W,H);for(let i=0;i<4;i++){ctx.fillStyle=i%2?'#eaf4fb':'#dcebf6';ctx.fillRect(34,35+i*44,38,21);ctx.fillRect(91,38+i*44,350-i*44,12);}ctx.fillStyle='#8fb0cb';for(let i=0;i<11;i++)ctx.fillRect(44+i*40,H-45,16,10+Math.sin(i)*12);},512,300);
  const tabletImage=mesh(new THREE.PlaneGeometry(.81,.48),new THREE.MeshBasicMaterial({map:tabletTex,toneMapped:false}),tabletHead,0,0,.065);tabletImage.castShadow=false;
  // Reuse the homepage guitar; its exact geometry is the transition anchor.
  const guitar=group(room,2.76,floor,1.8,'guitar');guitar.scale.setScalar(1.16);guitar.rotation.y=-.08;
  const {portal:guitarPortal}=createGuitarModel(guitar,{group,mesh,box,cyl,sphere});
  for(const side of [-1,1])tube(guitar,[[side*.3,.02,.12],[side*.15,.12,-.12],[side*.12,.58,-.17]],'#5e6957',.024);
  // Five wall spots wash the stage in soft KTV colour without a ceiling fixture.
  box(room,-4.015,4.03,0,.09,.075,5.06,'#b8a687',.02);
  const spotColors=['#ff5d96','#ffc359','#53e8bb','#559cff','#bb72ef'],stageSpots=[];
  const poolTexture=texture((ctx,W,H)=>{const gradient=ctx.createRadialGradient(W/2,H/2,0,W/2,H/2,W/2);gradient.addColorStop(0,'rgba(255,255,255,.65)');gradient.addColorStop(.5,'rgba(255,255,255,.3)');gradient.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,W,H);},128,128);
  spotColors.forEach((color,i)=>{
    const z=-2.04+i*1.02,fixture=group(room,-3.98,4.02,z);fixture.name='ktv-wall-spot';
    cyl(fixture,0,0,0,.085,.085,.075,'#bfac8e');const head=group(fixture,.07,-.025,0);head.name='ktv-spot-head';head.rotation.z=-2.34;
    cyl(head,0,.1,0,.11,.1,.22,'#61705b');cyl(head,0,.23,0,.114,.114,.035,'#d1c2a6');
    const lens=new THREE.MeshBasicMaterial({color,toneMapped:false});cyl(head,0,.251,0,.09,.09,.012,lens);
    const position=new THREE.Vector3(-3.73,3.88,z),target=new THREE.Vector3(-3.05,.6,z+.15);
    const light=new THREE.SpotLight(color,4.2,6,.38,.85,2);light.position.copy(position);light.target.position.copy(target);scene.add(light,light.target);stageSpots.push(light);
    const beam=mesh(new THREE.ConeGeometry(.63,3.32,32,1,true),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.045,depthWrite:false,toneMapped:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending}),room);
    beam.position.copy(position).add(target).multiplyScalar(.5);beam.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),position.clone().sub(target).normalize());beam.castShadow=beam.receiveShadow=false;
    const pool=mesh(new THREE.PlaneGeometry(1.2,.68),new THREE.MeshBasicMaterial({color,map:poolTexture,transparent:true,opacity:.7,depthWrite:false,toneMapped:false}),stage,.21,.359,z+.03);pool.rotation.x=-Math.PI/2;pool.castShadow=pool.receiveShadow=false;
  });
  renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;
  const defaultDirection=new THREE.Vector3(11,9,14).normalize(),normalTarget=new THREE.Vector3(0,1.8,0);
  function focusedPose(){scene.updateMatrixWorld(true);const center=guitarPortal.getWorldPosition(new THREE.Vector3()),q=guitarPortal.getWorldQuaternion(new THREE.Quaternion());
    const distance=2.18*1.16/(2*Math.tan(38*Math.PI/360)*Math.min(.82,camera.aspect*1.7));
    return {target:center,position:center.clone().addScaledVector(new THREE.Vector3(0,0,1).applyQuaternion(q),distance),up:new THREE.Vector3(0,1,0).applyQuaternion(q)};
  }
  function drawEntrance(p){entrance=Math.max(0,Math.min(1,p));const from=focusedPose(),target=normalTarget,position=target.clone().addScaledVector(defaultDirection,baseDistance);
    camera.fov=38;camera.position.lerpVectors(from.position,position,entrance);controls.target.lerpVectors(from.target,target,entrance);
    camera.up.lerpVectors(from.up,new THREE.Vector3(0,1,0),entrance).normalize();
    const frame=roomFrame(container.clientWidth,container.clientHeight,{mobile:window.innerWidth<=700});
    camera.setViewOffset(container.clientWidth,container.clientHeight,0,-frame.offsetY*entrance,container.clientWidth,container.clientHeight);
    camera.lookAt(controls.target);camera.updateProjectionMatrix();controls.enabled=active&&entrance===1&&!screenMode;dirty=true;
  }
  // Match the KTV screen the way the living-room camera matches the curtain.
  function screenFrontPose(){
    screenImage.updateWorldMatrix(true,false);
    const center=screenImage.getWorldPosition(new THREE.Vector3());
    const w=container.clientWidth,h=container.clientHeight,aspect=w/h,fov=38;
    const vTan=Math.tan(fov*Math.PI/360),hTan=vTan*aspect;
    const distance=Math.max(2.205/(2*vTan*.72),4.28/(2*hTan*.86));
    return {position:center.clone().add(new THREE.Vector3(0,0,distance)),target:center,fov,offsetX:0,offsetY:Math.min(24,h*.03)};
  }
  function capturePose(){return {position:camera.position.clone(),target:controls.target.clone(),fov:camera.fov,offsetX:camera.view?.offsetX||0,offsetY:camera.view?.offsetY||0};}
  function applyPose(pose,w,h){camera.position.copy(pose.position);controls.target.copy(pose.target);camera.fov=pose.fov;
    camera.setViewOffset(w,h,pose.offsetX||0,pose.offsetY||0,w,h);camera.updateProjectionMatrix();camera.lookAt(controls.target);dirty=true;}
  function lerpPose(a,b,p){const ease=p*p*p*(p*(p*6-15)+10);return {position:a.position.clone().lerp(b.position,ease),target:a.target.clone().lerp(b.target,ease),fov:THREE.MathUtils.lerp(a.fov,b.fov,ease),offsetX:THREE.MathUtils.lerp(a.offsetX||0,b.offsetX||0,ease),offsetY:THREE.MathUtils.lerp(a.offsetY||0,b.offsetY||0,ease)};}
  function startScreen(value){
    if(value===screenMode&&!screenAnimating)return;
    const w=container.clientWidth,h=container.clientHeight;
    if(value&&!screenMode)roomPose=capturePose();
    screenFrom=capturePose();
    if(value)screenTo=screenFrontPose();
    else screenTo=roomPose||{position:normalTarget.clone().addScaledVector(defaultDirection,baseDistance*zoomRatio),target:normalTarget.clone(),fov:38,offsetX:0,offsetY:-roomFrame(w,h,{mobile:window.innerWidth<=700}).offsetY};
    screenMode=value;controls.enabled=false;dirty=true;renderer.domElement.style.cursor=value?'default':'grab';renderer.domElement.title='';
    if(window.matchMedia('(prefers-reduced-motion: reduce)').matches){screenAnimating=false;applyPose(screenTo,w,h);controls.enabled=active&&entrance===1&&!screenMode;if(!screenMode)controls.update();return;}
    screenAnimating=true;screenStart=performance.now();
  }
  function fit(){const w=container.clientWidth,h=container.clientHeight;if(!w||!h)return;renderer.setSize(w,h);camera.aspect=w/h;
    const frame=roomFrame(w,h,{mobile:window.innerWidth<=700});baseDistance=frame.distance*.92;
    controls.minDistance=baseDistance/1.75;controls.maxDistance=baseDistance*1.35;
    if(screenMode||screenAnimating){if(screenMode&&!screenAnimating)applyPose(screenFrontPose(),w,h);return;}
    if(entrance<1)drawEntrance(entrance);else{camera.fov=38;camera.position.sub(controls.target).setLength(baseDistance*zoomRatio).add(controls.target);camera.setViewOffset(w,h,0,-frame.offsetY,w,h);camera.updateProjectionMatrix();camera.lookAt(controls.target);dirty=true;}
  }
  controls.addEventListener('change',()=>{dirty=true;if(entrance===1&&baseDistance)zoomRatio=camera.position.distanceTo(controls.target)/baseDistance;});
  const tap=createTapTracker({distance:7}),raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
  function hit(e){const rect=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);camera.updateMatrixWorld();raycaster.setFromCamera(pointer,camera);
    for(const result of raycaster.intersectObjects(room.children,true)){let node=result.object;while(node&&node!==room){if(node.userData.objectId)return node.userData.objectId;node=node.parent;}if(!result.object.material.transparent)return null;}return null;}
  renderer.domElement.addEventListener('pointerdown',e=>{if(controls.enabled)tap.begin(e);});
  renderer.domElement.addEventListener('pointermove',e=>{tap.move(e);if(controls.enabled&&!e.buttons){const id=hit(e);renderer.domElement.style.cursor=id?'pointer':'grab';renderer.domElement.title={screen:'观看屏幕',guitar:'拨弦'}[id]||'';}});
  renderer.domElement.addEventListener('pointerup',e=>{if(controls.enabled&&tap.end(e)){const id=hit(e);if(id)onSelect(id);}});
  renderer.domElement.addEventListener('pointercancel',e=>tap.cancel(e));renderer.domElement.style.cursor='grab';
  let pluckFrame=0;
  function pluck(){if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;cancelAnimationFrame(pluckFrame);const rest=-.08,start=performance.now();function frame(now){const p=Math.min(1,(now-start)/650);guitar.rotation.y=rest+Math.sin(p*Math.PI*6)*.025*(1-p);dirty=true;if(p<1)pluckFrame=requestAnimationFrame(frame);else guitar.rotation.y=rest;}pluckFrame=requestAnimationFrame(frame);}
  fit();window.addEventListener('resize',fit);const observer=new ResizeObserver(fit);observer.observe(container);
  let renderFrame=0;function render(){renderFrame=requestAnimationFrame(render);if(!active||document.hidden)return;
    if(screenAnimating){const w=container.clientWidth,h=container.clientHeight,p=Math.min(1,(performance.now()-screenStart)/1000);applyPose(lerpPose(screenFrom,screenTo,p),w,h);if(p>=1){screenAnimating=false;controls.enabled=active&&entrance===1&&!screenMode;if(!screenMode)controls.update();}}
    else if(entrance===1&&!screenMode)controls.update();
    if(dirty){renderer.render(scene,camera);dirty=false;}}render();
  return {
    setVideo:player.setVideo,playVideo:player.play,pauseVideo:player.pause,stopVideo:player.stop,setVideoMuted:player.setMuted,videoPlaying:player.isPlaying,videoTime:player.getTime,fit,
    screenViewActive:()=>screenMode,setScreenView:startScreen,
    setActive(value){active=value;controls.enabled=value&&entrance===1&&!screenMode;if(value){screenMode=false;screenAnimating=false;roomPose=null;entrance=0;zoomRatio=1;fit();}else{screenMode=false;screenAnimating=false;tap.reset();player.stop();cancelAnimationFrame(pluckFrame);guitar.rotation.y=-.08;}},
    entranceProgress:drawEntrance,
    guitarBounds(){camera.updateMatrixWorld();const points=[[-.455,-1.09],[.455,1.09]].map(([x,y])=>guitarPortal.localToWorld(new THREE.Vector3(x,y,0)).project(camera));return {left:(points[0].x+1)*container.clientWidth/2,top:(1-points[1].y)*container.clientHeight/2,width:(points[1].x-points[0].x)*container.clientWidth/2,height:(points[1].y-points[0].y)*container.clientHeight/2};},
    zoom(factor){if(screenMode)return;camera.position.sub(controls.target).setLength(THREE.MathUtils.clamp(camera.position.distanceTo(controls.target)/factor,controls.minDistance,controls.maxDistance)).add(controls.target);controls.update();dirty=true;},
    reset(){zoomRatio=1;if(screenMode){startScreen(false);return;}drawEntrance(1);controls.update();},pluck,
    toggleLight(){warm=!warm;glowMaterial.color.set(warm?'#ffebbd':'#f3dfd8');glowMaterial.emissive.set(warm?'#ffcb77':'#dfa18e');roomGlow.color.set(warm?'#ffda9d':'#eecdc1');sun.color.set(warm?'#fff0cf':'#ffe0cf');sun.intensity=warm?2.6:1.65;daylight.intensity=warm?1.65:1.15;stageSpots.forEach(light=>light.intensity=warm?4.2:5.6);dirty=true;return warm;},
    debug:()=>({calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,entrance,screenMode,video:player.getSource()})
  };
}
