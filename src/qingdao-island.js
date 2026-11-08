import * as THREE from 'three';
import { GLTFLoader } from './assets/GLTFLoader.js';
import { QINGDAO_GLB_B64 } from './qingdao-model.js';

export const QINGDAO_ID='370200';
export const QINGDAO_LONLAT=[120.355173,36.082982];

const BUILD_SECONDS=5;
const WAVE_Y=-.115;
const WAVE_AMP=3.0;
const SEA_RADIUS=14.9;
const PLATE_RADIUS=20.4;
const PLATE_TOP=-1.75;
const EDGE_Y=PLATE_TOP+.006;
const BASE_PLATE_COLOR='#ece0c6';
const YACHT_SINK=.22;
const TARGET=new THREE.Vector3(.4,1.4,.2);
const qdClamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const clamp01=value=>qdClamp(value,0,1);
const easeOutCubic=p=>1-Math.pow(1-p,3);
const easeInOut=p=>(p<.5?2*p*p:1-Math.pow(-2*p+2,2)/2);
const smooth01=p=>{const v=clamp01(p);return v*v*(3-2*v);};

function b64ToBuffer(b64){
  const bin=atob(b64),length=bin.length,bytes=new Uint8Array(length);
  for(let i=0;i<length;i++)bytes[i]=bin.charCodeAt(i);
  return bytes.buffer;
}

// Same wave model as the standalone island: flat in the middle, moving sea further out.
function waveAt(x,z,t){
  const r=Math.hypot(x,z);
  const th=Math.atan2(-z,x);
  const a=clamp01((r-7)/9);
  return a*(
    .085*Math.sin(.52*r+.7-t*2)+
    .040*Math.sin(1.35*r-.9+.5*Math.sin(3*th)-t*3.2)+
    .030*Math.sin(2.1*th+1.3+t*1.4)+
    .018*Math.sin(.35*r-t*.9)
  );
}

function defaultElevation(aspect){return aspect<.8?.62:.33;}

/**
 * Full-screen, self-contained Qingdao island scene. The footprint of the
 * model is about 34 x 34 world units, so it gets its own perspective camera,
 * lighting and renderer instead of sharing the orthographic wall-map camera.
 */
export function createQingdaoIsland(container){
  const layer=document.createElement('div');
  layer.className='travel-qingdao-layer';
  layer.setAttribute('aria-hidden','true');
  layer.dataset.state='idle';
  container.append(layer);

  const status=document.createElement('p');
  status.className='travel-qingdao-status';
  status.setAttribute('role','status');
  layer.append(status);

  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));
  renderer.setClearColor(0,0);
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=.7;
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.localClippingEnabled=true;
  renderer.domElement.setAttribute('aria-hidden','true');
  layer.insertBefore(renderer.domElement,status);

  const scene=new THREE.Scene();
  const camera=new THREE.PerspectiveCamera(36,1,.1,500);
  const clip=new THREE.Plane(new THREE.Vector3(0,1,0),.06);
  const rockGroundClip=new THREE.Plane(new THREE.Vector3(0,1,0),.76);
  let clipTarget=.06;

  // The source scene was authored with three r147 (legacy light units);
  // r160 uses physical units, so scale the same light rig by PI.
  scene.add(new THREE.HemisphereLight(0xfff6e8,0x8b7d6b,.5*Math.PI));
  scene.add(new THREE.AmbientLight(0xffffff,.12*Math.PI));
  const key=new THREE.DirectionalLight(0xfff0dd,.95*Math.PI);
  key.position.set(14,26,14);
  key.castShadow=true;
  key.shadow.mapSize.set(2048,2048);
  key.shadow.camera.left=-26;key.shadow.camera.right=26;
  key.shadow.camera.top=26;key.shadow.camera.bottom=-26;
  key.shadow.camera.near=1;key.shadow.camera.far=80;
  key.shadow.bias=-.0006;key.shadow.radius=3;
  scene.add(key);
  const fill=new THREE.DirectionalLight(0xdce8ff,.38*Math.PI);fill.position.set(-16,10,-10);scene.add(fill);
  const rim=new THREE.DirectionalLight(0xffe3c4,.5*Math.PI);rim.position.set(-4,9,-18);scene.add(rim);

  // Plain warm paper-white plinth, with no printed map content. The sea body
  // sits directly on it, echoing the framed map's backing board.
  const basePlate=new THREE.Mesh(
    new THREE.CylinderGeometry(19.99,19.99,.48,96),
    new THREE.MeshStandardMaterial({color:BASE_PLATE_COLOR,roughness:.92,metalness:0})
  );
  basePlate.name='QD_Base';
  basePlate.position.set(0,PLATE_TOP-.24,0);
  basePlate.receiveShadow=false;basePlate.castShadow=false;
  scene.add(basePlate);

  let root=null,water=null,plan=null;
  const ripples=[],rippleGroup=new THREE.Group();rippleGroup.name='QD_Ripples';scene.add(rippleGroup);
  let active=false,loaded=false,loading=false,buildStarted=false,buildDone=false,pendingBuild=false;
  let buildT0=performance.now();
  let azimuth=.37,elevation=.33,zoom=1,currentDistance=48,baseDistance=48;
  let raf=0,lastFrame=0,lastTick=0,hideTimer=0,statusTimer=0;
  let pointers=new Map(),drag=null,pinch=null,press=null;
  const raycaster=new THREE.Raycaster(),waterPlane=new THREE.Plane(new THREE.Vector3(0,1,0),-WAVE_Y);

  function aspect(){const w=container.clientWidth||innerWidth,h=container.clientHeight||innerHeight;return w&&h?w/h:16/9;}
  function frameDistance(w,h){
    const a=w/h,vfov=THREE.MathUtils.degToRad(camera.fov);
    const frameWidth=a<.8?27:a<1.15?34:48;
    const widthDistance=(frameWidth/2)/(Math.tan(vfov/2)*a);
    const heightDistance=5/Math.tan(vfov/2);
    return qdClamp(Math.max(widthDistance,heightDistance)*1.04,26,150);
  }
  function applyCamera(){
    const direction=new THREE.Vector3(
      Math.sin(azimuth)*Math.cos(elevation),
      Math.sin(elevation),
      Math.cos(azimuth)*Math.cos(elevation)
    );
    camera.position.copy(TARGET).addScaledVector(direction,currentDistance/zoom);
    camera.lookAt(TARGET);
    camera.updateMatrixWorld();
  }
  function fit(){
    const w=container.clientWidth||innerWidth,h=container.clientHeight||innerHeight;
    if(!w||!h)return;
    renderer.setSize(w,h,false);
    camera.aspect=w/h;camera.updateProjectionMatrix();
    TARGET.x=w/h<.8?-2.0:.4;
    baseDistance=frameDistance(w,h);
    if(!buildStarted||buildDone)currentDistance=baseDistance;
    applyCamera();
  }

  function prepare(gltf){
    root=gltf.scene;
    const grouped={island:[],rocks:[],smalls:[],boards:[],yacht:[],church:[],beer:[]};
    const rings=[];const shore=[];
    let sea=null,wall=null,bottom=null;
    root.traverse(object=>{
      if(!object.isMesh)return;
      const name=object.name;
      object.castShadow=name.indexOf('QD_Sea')!==0&&name.indexOf('QD_WaveRing')!==0;
      object.receiveShadow=true;
      object.userData.baseY=object.position.y;
      if(name==='QD_Sea'){
        sea=object;
        if(object.morphTargetInfluences)object.morphTargetInfluences.fill(0);
      }else if(name==='QD_Sea_Wall')wall=object;
      else if(name==='QD_Sea_Bottom')bottom=object;
      else if(name.indexOf('QD_WaveRing')===0)rings.push(object);
      else if(name.indexOf('QD_Island')===0||name==='QD_Foam')grouped.island.push(object);
      else if(name.indexOf('QD_Rock_')===0)grouped.rocks.push(object);
      else if(name.indexOf('QD_Shell_')===0||name.indexOf('QD_Starfish_')===0)grouped.smalls.push(object);
      else if(name.indexOf('QD_Board_')===0){if(name.indexOf('_Stripe')<0&&name.indexOf('_Fin')<0)grouped.boards.push(object);}
      else if(name.indexOf('QD_Yacht')===0)grouped.yacht.push(object);
      else if(name.indexOf('QD_Church')===0)grouped.church.push(object);
      else if(name.indexOf('QD_Beer')===0)grouped.beer.push(object);

      const materials=Array.isArray(object.material)?object.material:[object.material];
      for(const material of materials){
        if(!material)continue;
        material.side=THREE.DoubleSide;
        material.shadowSide=THREE.FrontSide;
        const keepVisible=name.indexOf('QD_Sea')===0||name.indexOf('QD_WaveRing')===0||name.indexOf('QD_Island')===0||name==='QD_Foam';
        if(!keepVisible){
          // Yacht and rocks keep their underwater sides. Rocks are still cut
          // below the sand-bottom layer; the build clip only applies to the
          // other rising props.
          if(name.indexOf('QD_Rock_')===0)material.clippingPlanes=[rockGroundClip];
          else if(name.indexOf('QD_Yacht')===0)material.clippingPlanes=[];
          else material.clippingPlanes=[clip];
          material.clipShadows=material.clippingPlanes.length>0;
        }
        material.needsUpdate=true;
      }
    });

    root.traverse(object=>{
      if(!object.isMesh)return;
      const materials=Array.isArray(object.material)?object.material:[object.material];
      for(const material of materials){
        if(!material)continue;
        const name=(material.name||'').toLowerCase();
        if(name.includes('searim')){
          material.transparent=true;material.opacity=.95;material.roughness=.4;material.metalness=0;
          material.emissive=new THREE.Color(0x9fd8d2);material.emissiveIntensity=.45;
          material.needsUpdate=true;
        }else if(name.includes('water')){
          material.transmission=0;material.transparent=true;material.opacity=.48;
          material.depthWrite=false;material.roughness=.32;material.metalness=0;
          material.vertexColors=false;material.color.set('#67c6ea');
          material.side=THREE.DoubleSide;material.depthWrite=false;
          material.emissive=new THREE.Color('#2d94bd');material.emissiveIntensity=.55;
          material.onBeforeCompile=shader=>{
            shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying float vShoreClear;')
              .replace('#include <begin_vertex>','#include <begin_vertex>\nvShoreClear=1.0-smoothstep(.50,.78,length(position.xz)/14.9);');
            shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying float vShoreClear;')
              .replace('#include <dithering_fragment>','#include <dithering_fragment>\ngl_FragColor.a*=mix(1.0,.42,vShoreClear);');
          };
          material.customProgramCacheKey=()=> 'QDWaterEdgeFade';
          material.needsUpdate=true;
        }
      }
    });

    if(sea){
      const scale=SEA_RADIUS/17.3,positions=sea.geometry.attributes.position;
      for(let i=0;i<positions.count;i++){positions.setX(i,positions.getX(i)*scale);positions.setZ(i,positions.getZ(i)*scale);}
      positions.needsUpdate=true;sea.geometry.computeBoundingSphere();
    }
    for(const mesh of grouped.island){
      mesh.userData.base=mesh.geometry.attributes.position.array.slice();
      shore.push(mesh);
    }
    // The source hull is a rounded box. Taper the windshield end into a real
    // pointed bow while leaving the fishing stern untouched.
    for(const object of grouped.yacht){
      if(!object.name.startsWith('QD_Yacht_Hull')&&object.name!=='QD_Yacht_Deck')continue;
      const positions=object.geometry.attributes.position;
      for(let i=0;i<positions.count;i++){
        const x=positions.getX(i),z=positions.getZ(i);
        if(x<=1.0)continue;
        const t=Math.min(1,(x-1.0)/.92);
        positions.setZ(i,z*(1-.98*Math.pow(t,1.25)));
      }
      positions.needsUpdate=true;
      object.geometry.computeVertexNormals();
      object.geometry.computeBoundingSphere();
    }

    for(const ring of rings){
      const base=ring.geometry.attributes.position.array.slice();
      ring.userData.base=base;
      let sum=0;
      for(let i=0;i<ring.geometry.attributes.position.count;i++)sum+=Math.hypot(base[i*3],base[i*3+2]);
      ring.userData.meanR=sum/ring.geometry.attributes.position.count;
      ring.userData.active=false;
      ring.material=ring.material.clone();
      ring.material.transparent=true;ring.material.opacity=0;
      ring.material.color=new THREE.Color(0xffffff);
      ring.material.emissive=new THREE.Color(0xffffff);
      ring.material.emissiveIntensity=.45;
    }
    const byR=rings.slice().sort((a,b)=>a.userData.meanR-b.userData.meanR);
    const activeRings=byR.slice(Math.max(0,byR.length-3));
    activeRings.sort((a,b)=>a.userData.meanR-b.userData.meanR);
    activeRings.forEach((ring,index)=>{ring.userData.active=true;ring.userData.phase=index/activeRings.length;});

    // Five rocks instead of ten: keep a balanced ring around the island and
    // hide the extra back/right stones.
    const hiddenRocks=new Set(['QD_Rock_1','QD_Rock_3','QD_Rock_5','QD_Rock_8','QD_Rock_9']);
    for(const rock of grouped.rocks){
      if(!hiddenRocks.has(rock.name))continue;
      rock.visible=false;rock.castShadow=false;
    }
    grouped.rocks=grouped.rocks.filter(rock=>!hiddenRocks.has(rock.name));
    const seaRocks=new Set(['QD_Rock_0','QD_Rock_6']);
    for(const rock of grouped.rocks){
      if(!seaRocks.has(rock.name))continue;
      rock.position.x*=1.55;rock.position.z*=1.55;
    }

    // Flatten the beer-bottle crown without moving its top off the bottle.
    const cap=root.getObjectByName('QD_Beer_Cap');
    if(cap){
      const positions=cap.geometry.attributes.position;let min=Infinity,max=-Infinity;
      for(let i=0;i<positions.count;i++){const y=positions.getY(i);if(y<min)min=y;if(y>max)max=y;}
      const center=(min+max)/2;
      cap.scale.y=.5;
      cap.position.y=cap.userData.baseY+center*(1-.5);
      cap.userData.baseY=cap.position.y;
    }

    // Hang the life ring on the yacht's side wall, standing perpendicular to
    // the water instead of lying flat on the deck.
    const findNode=prefix=>{let found=null;root.traverse(object=>{if(!found&&object.name.indexOf(prefix)===0)found=object;});return found;};
    const ring=findNode('QD_Yacht_Ring');
    let hullGroup=null;root.traverse(object=>{if(!hullGroup&&!object.isMesh&&object.name.indexOf('QD_Yacht_Hull')===0)hullGroup=object;});
    if(!hullGroup){const hullMesh=findNode('QD_Yacht_Hull');hullGroup=hullMesh?.parent||hullMesh;}
    if(ring&&hullGroup){
      // The hull is a Group with multi-primitive mesh children; use the group,
      // not the child at local origin, so the ring hangs on the real hull side.
      const offset=new THREE.Vector3(-.35,.38,.82).applyQuaternion(hullGroup.quaternion).add(hullGroup.position);
      ring.position.copy(offset);
      ring.quaternion.copy(hullGroup.quaternion);
      ring.rotateX(Math.PI/2);
      ring.userData.baseY=ring.position.y;
    }
    // Keep every yacht part in one rigid group: the hull, deck and cabin must
    // move together when the boat is seated slightly lower in the water.
    const yachtRoot=new THREE.Group();yachtRoot.name='QD_Yacht_Group';root.add(yachtRoot);
    for(const object of grouped.yacht)yachtRoot.attach(object);
    yachtRoot.position.set(2.0,-YACHT_SINK,2.0);

    plan=[
      {items:grouped.rocks,start:.85,dur:.8,off:-2.6,stagger:.06},
      {items:grouped.smalls,start:1.0,dur:.65,off:-2.2,stagger:.04},
      {items:grouped.boards,start:1.15,dur:.8,off:-3.2,stagger:.12},
      {items:grouped.yacht,start:1.4,dur:1.0,off:-3.2},
      {items:grouped.church,start:1.6,dur:2.2,off:-9},
      {items:grouped.beer,start:1.7,dur:2.0,off:-4.5}
    ];

    if(sea){sea.scale.x=1.142;sea.scale.z=1.142;}
    water={sea,wall:null,bottom,rings,shore,seaPos:sea?sea.geometry.attributes.position:null,seaBase:sea?sea.geometry.attributes.position.array.slice():null};
    if(sea){sea.castShadow=false;sea.receiveShadow=false;}
    // The old vertical side wall is removed: the water surface itself now
    // slopes down to the plinth, and the bottom is tucked under that edge so
    // there is no cylinder side. The rim thickness reaches zero.
    if(wall){wall.visible=false;wall.castShadow=false;wall.receiveShadow=false;}
    if(bottom){
      bottom.castShadow=false;bottom.receiveShadow=false;
      bottom.material=new THREE.MeshStandardMaterial({color:'#7fc5d3',roughness:.6,metalness:0,side:THREE.DoubleSide});
      bottom.visible=false;
      const positions=bottom.geometry.attributes.position;
      for(let i=0;i<positions.count;i++){
        const x=positions.getX(i),z=positions.getZ(i),r=Math.hypot(x,z);
        const edge=smooth01((r/SEA_RADIUS-.82)/.18);
        positions.setY(i,-1.7+(EDGE_Y+1.7)*edge);
      }
      positions.needsUpdate=true;
      bottom.geometry.computeVertexNormals();
    }
    scene.add(root);
    loaded=true;loading=false;
    if(pendingBuild){pendingBuild=false;startBuild();}
  }

  function load(){
    if(loaded||loading)return;
    loading=true;
    if(active)status.textContent='小岛模型加载中…';
    const loader=new GLTFLoader();
    try{
      loader.parse(b64ToBuffer(QINGDAO_GLB_B64),'',prepare,error=>{
        loading=false;
        console.error('Qingdao island model failed to load',error);
        layer.dataset.state='error';
        status.textContent='小岛模型加载失败，请返回地图。';
      });
    }catch(error){
      loading=false;
      console.error('Qingdao island model failed to parse',error);
      layer.dataset.state='error';
      status.textContent='小岛模型加载失败，请返回地图。';
    }
  }

  function applyBuild(t){
    if(!plan||!water)return;
    plan.forEach(step=>{
      step.items.forEach((object,index)=>{
        const p=easeOutCubic(clamp01((t-step.start-index*(step.stagger||0))/step.dur));
        object.position.y=object.userData.baseY+step.off*(1-p);
        // Do not cast shadows while the object is still under the water.
        object.castShadow=p>.995;
      });
    });
  }
  function resetBuild(){
    if(plan)plan.forEach(step=>step.items.forEach(object=>{object.position.y=object.userData.baseY+step.off;object.castShadow=false;}));
    if(water)water.rings.forEach(ring=>{ring.material.opacity=0;});
    clip.constant=.06;clipTarget=.06;
  }

  function surfaceHeight(x,z){
    const r=Math.hypot(x,z);
    const edge=smooth01((r/SEA_RADIUS-.5)/.5);
    return WAVE_Y+(EDGE_Y-WAVE_Y)*edge;
  }
  function seaHeight(x,z,t,amp){
    const r=Math.hypot(x,z);
    const edge=smooth01((r/SEA_RADIUS-.5)/.5);
    let y=WAVE_Y+(EDGE_Y-WAVE_Y)*edge+waveAt(x,z,t)*amp*(1-.85*edge);
    for(const ripple of ripples){
      const age=t-ripple.t0;
      if(age<0||age>3.0)continue;
      const d=Math.hypot(x-ripple.x,z-ripple.z);
      const theta=Math.atan2(z-ripple.z,x-ripple.x);
      const front=age*1.0;
      const env=Math.exp(-Math.pow((d-front)/.85,2))*Math.exp(-age*.6);
      y+=Math.sin((d-front)*3.6+theta*3)*env*.15;
    }
    return y;
  }

  function updateWater(t,amp,fade){
    if(!water)return;
    if(water.sea&&water.seaPos){
      const array=water.seaPos.array,base=water.seaBase;
      const normal=water.sea.geometry.attributes.normal;
      const epsilon=.28;
      for(let i=0,n=water.seaPos.count;i<n;i++){
        const x=base[i*3],z=base[i*3+2];
        array[i*3+1]=seaHeight(x,z,t,amp);
        const hx=seaHeight(x+epsilon,z,t,amp)-seaHeight(x-epsilon,z,t,amp);
        const hz=seaHeight(x,z+epsilon,t,amp)-seaHeight(x,z-epsilon,t,amp);
        const nx=-hx/(2*epsilon)*.2,nz=-hz/(2*epsilon)*.2;
        const length=Math.hypot(nx,1,nz)||1;
        normal.setXYZ(i,nx/length,1/length,nz/length);
      }
      water.seaPos.needsUpdate=true;
      normal.needsUpdate=true;
    }
    for(const mesh of water.shore){
      const attribute=mesh.geometry.attributes.position,base=mesh.userData.base;
      const foam=mesh.name==='QD_Foam';
      for(let i=0,n=attribute.count;i<n;i++){
        const x=base[i*3],y0=base[i*3+1],z=base[i*3+2];
        const band=foam?1:Math.max(0,1-Math.abs(y0+.12)/.4);
        if(band<=.001)continue;
        const theta=Math.atan2(-z,x);
        const wave=.016*Math.sin(theta*8+t*1.8)+.010*Math.sin(theta*13-t*2.4);
        attribute.array[i*3+1]=y0+wave*band;
      }
      attribute.needsUpdate=true;
    }
    const cycle=3.4;
    water.rings.forEach(ring=>{
      if(!ring.userData.active){ring.material.opacity=0;return;}
      const attribute=ring.geometry.attributes.position,base=ring.userData.base;
      const phase=((t/cycle)+ring.userData.phase)%1;
      const k=1-.45*phase;
      const meanR=ring.userData.meanR*k;
      const near=clamp01((meanR-9.4)/1.6);
      const edge=Math.min(clamp01(phase/.05),clamp01((1-phase)/.07));
      for(let i=0,n=attribute.count;i<n;i++){
        const bx=base[i*3],bz=base[i*3+2];
        const r0=Math.hypot(bx,bz)||1;
        const direction=r0<ring.userData.meanR?-.085:.085;
        const radius=(r0+direction)*k;
        const x=bx/r0*radius,z=bz/r0*radius;
        attribute.array[i*3]=x;
        attribute.array[i*3+2]=z;
        const edge=smooth01((Math.hypot(x,z)/SEA_RADIUS-.5)/.5);
        attribute.array[i*3+1]=WAVE_Y+(EDGE_Y-WAVE_Y)*edge+waveAt(x,z,t)*amp*(1-.85*edge)+.012;
      }
      attribute.needsUpdate=true;
      ring.material.opacity=fade*near*edge;
    });
  }

  function removeRipple(ripple){
    rippleGroup.remove(ripple.group);
    ripple.group.traverse(object=>{object.geometry?.dispose();object.material?.dispose();});
  }
  function addRipple(x,z){
    if(ripples.length>=4)removeRipple(ripples.shift());
    const group=new THREE.Group();
    group.position.set(x,surfaceHeight(x,z)+.04,z);
    const rings=[];
    for(let i=0;i<2;i++){
      const material=new THREE.MeshBasicMaterial({color:'#eafcff',transparent:true,opacity:.58,side:THREE.DoubleSide,depthWrite:false,toneMapped:false});
      const ring=new THREE.Mesh(new THREE.RingGeometry(1,1.012,96),material);
      ring.rotation.x=-Math.PI/2;
      ring.scale.setScalar(.35);
      group.add(ring);rings.push(ring);
    }
    rippleGroup.add(group);
    ripples.push({x,z,t0:(performance.now()-buildT0)/1000,group,rings});
  }
  function updateRipples(t){
    for(let i=ripples.length-1;i>=0;i--){
      const ripple=ripples[i],age=t-ripple.t0;
      if(age>3.0){removeRipple(ripple);ripples.splice(i,1);continue;}
      if(age<0)continue;
      const fade=clamp01(1-age/3.0);
      ripple.rings.forEach((ring,index)=>{
        ring.scale.setScalar(.35+Math.min(age*.9,2.2)+index*.25);
        ring.material.opacity=fade*(index?.3:.55);
      });
    }
  }
  function rippleAt(event){
    const rect=renderer.domElement.getBoundingClientRect();
    const ndc=new THREE.Vector2(((event.clientX-rect.left)/rect.width)*2-1,-((event.clientY-rect.top)/rect.height)*2+1);
    raycaster.setFromCamera(ndc,camera);
    const point=new THREE.Vector3();
    if(!raycaster.ray.intersectPlane(waterPlane,point))return;
    const r=Math.hypot(point.x,point.z);
    if(r<8.2||r>14.2)return;
    addRipple(point.x,point.z);
  }

  function beginBuild(){
    buildStarted=false;buildDone=false;pendingBuild=true;
    if(!loaded){load();return;}
    pendingBuild=false;
    resetBuild();
    buildT0=performance.now();
    clearTimeout(statusTimer);
    currentDistance=baseDistance*1.14;
    layer.dataset.state='building';
    status.textContent='小岛生成中…';
    status.classList.remove('is-fading');
    renderer.shadowMap.autoUpdate=true;
    renderer.shadowMap.needsUpdate=true;
    buildStarted=true;
  }

  function startBuild(){
    beginBuild();
    if(!raf)schedule();
  }

  function finishBuild(){
    buildDone=true;buildStarted=false;
    currentDistance=baseDistance;
    clipTarget=100;
    renderer.shadowMap.autoUpdate=false;
    renderer.shadowMap.needsUpdate=true;
    layer.dataset.state='ready';
    status.textContent=matchMedia('(pointer:coarse)').matches?'拖动旋转 · 双指缩放':'拖动旋转 · 滚轮缩放';
    clearTimeout(statusTimer);
    statusTimer=setTimeout(()=>status.classList.add('is-fading'),2800);
    renderer.domElement.style.cursor='grab';
  }

  function tick(now){
    raf=0;
    if(!active)return;
    if(document.hidden){schedule();return;}
    if(now-lastFrame<30){schedule();return;}
    const dt=Math.min((now-(lastTick||now))/1000,.05);
    lastFrame=now;lastTick=now;

    const elapsed=(now-buildT0)/1000;
    if(buildStarted&&!buildDone){
      const t=Math.min(elapsed,BUILD_SECONDS);
      applyBuild(t);
      const p=easeInOut(clamp01(t/BUILD_SECONDS));
      currentDistance=baseDistance*(1.14-.14*p);
      if(elapsed>=BUILD_SECONDS)finishBuild();
    }
    if(water){
      const amp=buildStarted&&!buildDone?WAVE_AMP*easeInOut(clamp01((elapsed-.15)/.95)):WAVE_AMP;
      const fade=clamp01((elapsed-.3)/.8);
      updateWater(elapsed,amp,fade);
      updateRipples(elapsed);
    }
    clip.constant+=(clipTarget-clip.constant)*Math.min(1,dt*3.5);
    applyCamera();
    renderer.render(scene,camera);
    schedule();
  }
  function schedule(){if(!raf)raf=requestAnimationFrame(tick);}

  function canControl(){return active&&buildDone;}
  function pointerDistance(){
    const values=[...pointers.values()];
    return values.length<2?0:Math.hypot(values[0].x-values[1].x,values[0].y-values[1].y);
  }
  function zoomBy(factor){zoom=qdClamp(zoom*factor,.65,2.2);applyCamera();}

  renderer.domElement.addEventListener('pointerdown',event=>{
    if(!canControl())return;
    renderer.domElement.setPointerCapture?.(event.pointerId);
    pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
    if(pointers.size===2){
      drag=null;press=null;
      pinch={distance:Math.max(1,pointerDistance()),zoom};
      return;
    }
    drag={id:event.pointerId,x:event.clientX,y:event.clientY,azimuth,elevation};
    press={id:event.pointerId,x:event.clientX,y:event.clientY,moved:false};
    renderer.domElement.style.cursor='grabbing';
  });
  renderer.domElement.addEventListener('pointermove',event=>{
    if(!canControl())return;
    if(pointers.has(event.pointerId))pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
    if(pointers.size>=2&&pinch){
      const distance=Math.max(1,pointerDistance());
      zoom=qdClamp(pinch.zoom*distance/pinch.distance,.65,2.2);
      applyCamera();
      return;
    }
    if(press?.id===event.pointerId&&Math.hypot(event.clientX-press.x,event.clientY-press.y)>7)press.moved=true;
    if(drag?.id!==event.pointerId)return;
    const dx=event.clientX-drag.x,dy=event.clientY-drag.y;
    azimuth=drag.azimuth-dx*.0075;
    elevation=qdClamp(drag.elevation+dy*.0055,.12,1.2);
    applyCamera();
  });
  function endPointer(event){
    if(event.type==='pointerup'&&press?.id===event.pointerId&&!press.moved&&canControl())rippleAt(event);
    press=null;
    pointers.delete(event.pointerId);
    if(pointers.size<2)pinch=null;
    if(drag?.id===event.pointerId)drag=null;
    if(canControl())renderer.domElement.style.cursor='grab';
  }
  renderer.domElement.addEventListener('pointerup',endPointer);
  renderer.domElement.addEventListener('pointercancel',endPointer);
  renderer.domElement.addEventListener('wheel',event=>{
    if(!canControl())return;
    event.preventDefault();
    zoomBy(event.deltaY>0?1/1.1:1.1);
  },{passive:false});
  renderer.domElement.addEventListener('contextmenu',event=>event.preventDefault());

  const resize=new ResizeObserver(fit);
  resize.observe(container);
  window.addEventListener('resize',fit);

  function enter(){
    clearTimeout(hideTimer);clearTimeout(statusTimer);
    active=true;
    layer.classList.add('visible');
    layer.setAttribute('aria-hidden','false');
    status.classList.remove('is-fading');
    azimuth=.37;
    elevation=defaultElevation(aspect());
    zoom=1;
    TARGET.x=aspect()<.8?-2.0:.4;
    lastTick=0;
    fit();
    startBuild();
    schedule();
  }
  function exit(){
    if(!active)return;
    layer.classList.remove('visible');
    layer.setAttribute('aria-hidden','true');
    status.classList.add('is-fading');
    renderer.domElement.style.cursor='default';
    clearTimeout(hideTimer);
    hideTimer=setTimeout(()=>{active=false;cancelAnimationFrame(raf);raf=0;},700);
  }
  function setActive(value){
    if(value)return;
    clearTimeout(hideTimer);clearTimeout(statusTimer);
    active=false;
    cancelAnimationFrame(raf);raf=0;
    layer.classList.remove('visible');
    layer.setAttribute('aria-hidden','true');
    layer.dataset.state='idle';
    renderer.domElement.style.cursor='default';
    status.classList.add('is-fading');
  }
  function resetView(){
    azimuth=.37;
    elevation=defaultElevation(aspect());
    zoom=1;
    applyCamera();
  }

  load();
  fit();
  return {layer,enter,exit,setActive,fit,zoom:zoomBy,resetView,isActive:()=>active,isReady:()=>buildDone};
}
