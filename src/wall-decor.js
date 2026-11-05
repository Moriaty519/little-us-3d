import * as THREE from 'three';
import { RoundedBoxGeometry } from './assets/RoundedBoxGeometry.js';
import { drawChinaMap,chinaMapLayout,MAP_BOARD_COLOR } from './china-map.js';
import { WALL_DECOR_LAYOUT } from './wall-layout.js';

function decorMesh(parent,geometry,material,x=0,y=0,z=0){
  const mesh=new THREE.Mesh(geometry,typeof material==='string'?new THREE.MeshStandardMaterial({color:material,roughness:.88}):material);
  mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
}
function decorBox(parent,x,y,z,w,h,d,color,radius=.02){
  return decorMesh(parent,new RoundedBoxGeometry(w,h,d,2,Math.min(radius,w/3,h/3,d/3)),color,x,y,z);
}

// The interactive home's lighting is also the reference for the map frame.
export function createHomeLighting(){
  const sky=new THREE.HemisphereLight('#fff6de','#a6a78c',1.8);
  const sun=new THREE.DirectionalLight('#fff3d4',2.6);sun.position.set(-3,9,7);
  const fill=new THREE.DirectionalLight('#e9f3e9',.55);fill.position.set(6,5,-5);
  return {sky,sun,fill};
}

export function createChinaMapModel({focusMode=false}={}){
  const dimensions=WALL_DECOR_LAYOUT.map;
  const group=new THREE.Group();group.name='Framed China map';group.userData.objectId='map';
  const frame=decorBox(group,0,0,0,dimensions.width,dimensions.height,.075,'#bd9b67',.016);
  const backing=decorBox(group,0,0,.045,1.54,1.12,.018,MAP_BOARD_COLOR,.008);
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=720;
  drawChinaMap(canvas.getContext('2d'),canvas.width,canvas.height);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  let focusTexture=null;
  if(focusMode){
    const quiet=document.createElement('canvas');quiet.width=canvas.width;quiet.height=canvas.height;
    drawChinaMap(quiet.getContext('2d'),quiet.width,quiet.height,{labels:false});
    focusTexture=new THREE.CanvasTexture(quiet);focusTexture.colorSpace=THREE.SRGBColorSpace;
  }
  // The printed paper keeps exactly the same colors in both lighting setups.
  const faceMaterial=new THREE.MeshBasicMaterial({map:texture,toneMapped:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-2});
  const face=decorMesh(group,new THREE.PlaneGeometry(dimensions.faceWidth,dimensions.faceHeight),faceMaterial,0,0,dimensions.faceZ);
  face.castShadow=false;face.receiveShadow=false;
  function setFocusMode(value){if(!focusTexture)return;const next=value?focusTexture:texture;if(faceMaterial.map!==next){faceMaterial.map=next;faceMaterial.needsUpdate=true;}}
  const layout=chinaMapLayout(canvas.width,canvas.height);
  function point(lon,lat,lift=.004){
    const [x,y]=layout.project([lon,lat]);
    return new THREE.Vector3((x/canvas.width-.5)*dimensions.faceWidth,(.5-y/canvas.height)*dimensions.faceHeight,dimensions.faceZ+lift);
  }
  return {group,face,point,frame,backing,setFocusMode};
}

export function createWindowModel(){
  const group=new THREE.Group();group.name='Transparent linen-curtained window';
  const glass=decorMesh(group,new THREE.PlaneGeometry(1.8,1.65),new THREE.MeshPhysicalMaterial({color:'#ffffff',transparent:true,opacity:.08,roughness:.08,metalness:0,depthWrite:false,side:THREE.DoubleSide}),0,0,.025);
  glass.name='Clear glass';glass.castShadow=false;glass.receiveShadow=false;
  for(const side of [-1,1])decorBox(group,side*.94,0,.05,.12,1.9,.11,'#f7efda');
  decorBox(group,0,.91,.06,1.99,.12,.11,'#f7efda');decorBox(group,0,-.91,.12,2.13,.13,.34,'#f4e9d0');
  decorBox(group,0,0,.07,.046,1.75,.08,'#697865',.004);decorBox(group,0,0,.07,1.8,.046,.08,'#697865',.004);
  const linen=new THREE.MeshStandardMaterial({color:'#f4ecd7',roughness:.88});
  for(const side of [-1,1]){
    for(let j=0;j<5;j++){
      const curtain=decorMesh(group,new THREE.CylinderGeometry(.055,.067,1.87,10),linen,side*(1.03+j*.075),-.04,.16+Math.sin(j*2)*.045);curtain.scale.z=.9;
      curtain.name='Linen curtain fold';
    }
    decorBox(group,side*1.16,-.27,.18,.4,.07,.1,'#cdbd97');
  }
  const rod=decorMesh(group,new THREE.CylinderGeometry(.027,.027,2.9,12),'#ae976a',0,1.04,.19);rod.rotation.z=Math.PI/2;
  for(const side of [-1,1])decorMesh(group,new THREE.SphereGeometry(.075,20,14),'#c5ac78',side*1.5,1.04,.19);
  return group;
}

export function createSageWallPanel({windowX=WALL_DECOR_LAYOUT.window.x,windowOpening=true}={}){
  const dimensions=WALL_DECOR_LAYOUT.wall,window=WALL_DECOR_LAYOUT.window;
  const group=new THREE.Group();group.name=windowOpening?'Sage wall with a real window opening':'Solid sage wall';
  const left=-dimensions.width/2,right=dimensions.width/2,bottom=dimensions.centerY-dimensions.height/2,top=dimensions.centerY+dimensions.height/2;
  const shape=new THREE.Shape();shape.moveTo(left,bottom);shape.lineTo(right,bottom);shape.lineTo(right,top);shape.lineTo(left,top);shape.closePath();
  const hole=new THREE.Path(),x0=windowX-window.width/2,x1=windowX+window.width/2,y0=window.y-window.height/2,y1=window.y+window.height/2;
  hole.moveTo(x0,y0);hole.lineTo(x0,y1);hole.lineTo(x1,y1);hole.lineTo(x1,y0);hole.closePath();if(windowOpening)shape.holes.push(hole);
  const panel=decorMesh(group,new THREE.ExtrudeGeometry(shape,{depth:dimensions.thickness,bevelEnabled:false}),'#798e70',0,0,-dimensions.thickness/2);panel.name=windowOpening?'Wall opening':'Solid wall';
  for(let i=0;i<22;i++){
    const x=3.35-i*.315,segments=windowOpening&&x>x0-.006&&x<x1+.006?[[.235,y0],[y1,4.405]]:[[.235,4.405]];
    for(const [a,b] of segments)if(b>a)decorBox(group,x,(a+b)/2,.099,.012,b-a,.018,'#718769',.002);
  }
  decorBox(group,0,.4,.12,7,.3,.1,'#eee7d2',.012);
  decorBox(group,0,4.5,0,7.14,.12,.23,'#f3ead4',.024);
  return group;
}
