import * as THREE from 'three';
import { QINGDAO_CARDS } from './qingdao-assets.js';

export const QINGDAO_ID='370200';
export const QINGDAO_LONLAT=[120.355173,36.082982];

const COLORS={
  sand:'#efd39a',sandDark:'#e0bd7d',sea:'#7dbbc6',foam:'#fbf6e6',
  cream:'#f6ead0',brown:'#8a6547',white:'#fffdf4'
};

function material(color,options={}){return new THREE.MeshStandardMaterial({color,roughness:.8,metalness:0,...options});}
function mesh(parent,geometry,materialValue,x=0,y=0,z=0){
  const m=new THREE.Mesh(geometry,typeof materialValue==='string'?material(materialValue):materialValue);
  m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
}
function box(parent,w,h,d,materialValue,x=0,y=0,z=0){
  const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),typeof materialValue==='string'?material(materialValue):materialValue);
  m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
}
function cylinder(parent,rt,rb,height,materialValue,x=0,y=0,z=0,segments=24){
  const m=new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,height,segments),typeof materialValue==='string'?material(materialValue):materialValue);
  m.rotation.x=Math.PI/2;m.position.set(x,y,z+height/2);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
}
function ring(parent,radius,tube,materialValue,x=0,y=0,z=0,arc=Math.PI*2,rotation=0){
  const m=new THREE.Mesh(new THREE.TorusGeometry(radius,tube,8,48,arc),typeof materialValue==='string'?material(materialValue):materialValue);
  m.position.set(x,y,z);m.rotation.z=rotation;m.castShadow=false;m.receiveShadow=true;parent.add(m);return m;
}
function sphere(parent,rx,ry,rz,materialValue,x=0,y=0,z=0,segments=18){
  const m=new THREE.Mesh(new THREE.SphereGeometry(1,segments,Math.max(8,Math.round(segments*.7))),typeof materialValue==='string'?material(materialValue):materialValue);
  m.scale.set(rx,ry,rz);m.position.set(x,y,z);m.castShadow=false;m.receiveShadow=false;parent.add(m);return m;
}
function strut(parent,a,b,r,materialValue){
  const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),direction=end.clone().sub(start);
  const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,direction.length(),6),typeof materialValue==='string'?material(materialValue):materialValue);
  m.position.copy(start).add(end).multiplyScalar(.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize());m.castShadow=false;parent.add(m);return m;
}

function cutoutTexture(src){
  const texture=new THREE.TextureLoader().load(src);
  texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;texture.minFilter=THREE.LinearFilter;
  return texture;
}
function cardTexture(src){
  const canvas=document.createElement('canvas');canvas.width=240;canvas.height=300;
  const ctx=canvas.getContext('2d');ctx.fillStyle='#fffdf4';ctx.fillRect(0,0,240,300);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  const image=new Image();
  image.onload=()=>{
    const scale=Math.min(220/image.width,278/image.height),w=image.width*scale,h=image.height*scale;
    ctx.fillStyle='#fffdf4';ctx.fillRect(0,0,240,300);ctx.drawImage(image,(240-w)/2,(300-h)/2,w,h);
    ctx.strokeStyle='#e7dcc5';ctx.lineWidth=5;ctx.strokeRect(2.5,2.5,235,295);texture.needsUpdate=true;
  };
  image.src=src;return texture;
}

function buildStandee(parent,data,standees){
  const group=new THREE.Group();group.position.set(data.x,data.y,.001);parent.add(group);
  const aspect=data.card.width/data.card.height,width=data.height*aspect;
  const pivot=new THREE.Group();pivot.rotation.x=-Math.PI/2;group.add(pivot);
  const card=new THREE.Mesh(
    new THREE.PlaneGeometry(width,data.height),
    new THREE.MeshBasicMaterial({map:cutoutTexture(data.card.src),transparent:true,alphaTest:.06,side:THREE.DoubleSide,toneMapped:false,depthWrite:true})
  );
  card.rotation.x=Math.PI/2;card.position.z=data.height/2;card.castShadow=false;pivot.add(card);
  const shadow=new THREE.Mesh(new THREE.CircleGeometry(.15,24),new THREE.MeshBasicMaterial({color:'#7a6844',transparent:true,opacity:.1,depthWrite:false,toneMapped:false}));
  shadow.scale.y=.4;shadow.position.z=.002;group.add(shadow);
  group.userData.pivot=pivot;standees.push(group);return group;
}

function buildBalloon(data){
  const group=new THREE.Group();group.position.set(data.x,data.y,data.z);group.userData={baseZ:data.z,phase:data.phase};
  const body=sphere(group,.13,.17,.13,data.color,0,0,.3,20);
  ring(group,.115,.005,COLORS.cream,0,0,.3,Math.PI*2);
  ring(group,.085,.004,COLORS.cream,0,0,.29,Math.PI*2);
  cylinder(group,.07,.03,.07,data.color,0,0,.12,14);
  box(group,.12,.1,.1,COLORS.brown,0,0,0);
  for(const [sx,sy] of [[-.05,-.04],[.05,-.04],[-.05,.04],[.05,.04]])strut(group,[sx,sy,-.015],[sx*.5,sy*.5,.14],.005,COLORS.brown);
  const card=new THREE.Group();card.position.set(0,0,-.3);group.add(card);
  box(card,.2,.25,.016,COLORS.white,0,0,0);
  const picture=new THREE.Mesh(new THREE.PlaneGeometry(.18,.23),new THREE.MeshBasicMaterial({map:cardTexture(data.card.src),toneMapped:false,side:THREE.DoubleSide}));
  picture.position.z=.01;card.add(picture);
  for(const sx of [-.07,.07])strut(group,[sx,0,-.025],[sx,.12,-.26],.0035,COLORS.brown);
  group.userData.card=card;return group;
}

export function createQingdaoDiorama({scale=.2}={}){
  const root=new THREE.Group();root.name='Qingdao miniature standee diorama';root.visible=false;root.scale.setScalar(scale);
  const standees=[];
  buildStandee(root,{x:-.2,y:.12,height:.38,card:QINGDAO_CARDS[0]},standees);
  buildStandee(root,{x:.02,y:-.18,height:.44,card:QINGDAO_CARDS[2]},standees);
  buildStandee(root,{x:.22,y:.02,height:.42,card:QINGDAO_CARDS[1]},standees);
  const balloons=[];
  for(let i=0;i<QINGDAO_CARDS.length;i++){
    const data={x:(i-1)*.3,y:i===1?.18:.15,z:.78+i*.012,phase:i*2.1,color:['#dd9382','#94a47e','#dfc080'][i],card:QINGDAO_CARDS[i]};
    const balloon=buildBalloon(data);root.add(balloon);balloons.push(balloon);
  }
  const light=new THREE.PointLight('#ffe1b0',1.1,5,2);light.position.set(0,0,1.8);root.add(light);
  function setRise(progress){
    const p=Math.max(0,Math.min(1,progress));
    standees.forEach((standee,index)=>{
      const local=Math.max(0,Math.min(1,(p-index*.12)/(1-(standees.length-1)*.12)));
      const eased=local*local*(3-2*local);
      standee.userData.pivot.rotation.x=-Math.PI/2*(1-eased);
    });
  }
  function update(time,camera){
    if(!root.visible)return;
    const cameraLocal=root.worldToLocal(camera.position.clone());
    for(const standee of standees){
      standee.rotation.z=Math.atan2(cameraLocal.x-standee.position.x,-(cameraLocal.y-standee.position.y));
    }
    for(const balloon of balloons){
      const {baseZ,phase,card}=balloon.userData;
      balloon.position.z=baseZ+Math.sin(time*.00115+phase)*.045;
      balloon.rotation.y=Math.sin(time*.0007+phase)*.08;
      if(card)card.lookAt(camera.position);
    }
  }
  setRise(0);
  return {root,setRise,update,scale};
}
