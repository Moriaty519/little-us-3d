import * as THREE from 'three';
import { createGuitarStrings } from './room-details.js';

// One guitar, including its silhouette and strings, for both sides of the doorway.
export function createGuitarModel(parent,{group,mesh,box,cyl,sphere}){
  const guitarModel=group(parent,0,.09,0);guitarModel.rotation.z=-.14;guitarModel.rotation.x=-.1;
  const shape=new THREE.Shape();shape.moveTo(0,0);shape.bezierCurveTo(-.42,0,-.54,.22,-.39,.48);shape.bezierCurveTo(-.22,.65,-.41,.72,-.25,.93);shape.bezierCurveTo(-.14,1.07,.14,1.07,.25,.93);shape.bezierCurveTo(.41,.72,.22,.65,.39,.48);shape.bezierCurveTo(.54,.22,.42,0,0,0);
  const bodyGeo=new THREE.ExtrudeGeometry(shape,{depth:.17,bevelEnabled:true,bevelSegments:3,steps:1,bevelSize:.025,bevelThickness:.025,curveSegments:32});
  mesh(bodyGeo,'#e2bd82',guitarModel);
  const face=mesh(new THREE.ShapeGeometry(shape,32),'#f2d9a4',guitarModel,0,0,.198);face.castShadow=false;
  const soundhole=cyl(guitarModel,0,.69,.204,.113,.113,.008,'#5d4938');soundhole.rotation.x=Math.PI/2;
  const rosette=mesh(new THREE.TorusGeometry(.127,.012,6,40),'#c9a76b',guitarModel,0,.69,.215);
  box(guitarModel,0,.28,.222,.28,.052,.032,'#5d4938',.014);
  const pick=sphere(guitarModel,.15,.49,.213,.09,.14,.006,'#c9a76b');pick.rotation.z=-.3;
  box(guitarModel,0,1.41,.08,.14,.96,.11,'#c49a65',.015);box(guitarModel,0,1.4,.15,.135,.94,.025,'#5d4938',.005);
  for(let i=0;i<15;i++)box(guitarModel,0,.98+i*.058,.17,.134,.008,.009,'#f3ead8',.002);
  box(guitarModel,0,1.98,.09,.2,.27,.12,'#c9a76b',.03);
  for(const side of [-1,1])for(let i=0;i<3;i++){cyl(guitarModel,side*.13,1.89+i*.08,.08,.024,.024,.03,'#f3ead8',8);sphere(guitarModel,side*.15,1.89+i*.08,.08,.033,.022,.023,'#c9b28c');}
  guitarModel.add(createGuitarStrings());
  const portal=new THREE.Mesh(new THREE.PlaneGeometry(.91,2.18),new THREE.MeshBasicMaterial());
  portal.position.set(0,1.065,.25);portal.visible=false;guitarModel.add(portal);
  return {model:guitarModel,portal};
}
