import * as THREE from 'three';
import { createGuitarStrings } from './room-details.js';

// One guitar, including its silhouette and strings, for both sides of the doorway.
export function createGuitarModel(parent,{group,mesh,box,cyl,sphere}){
  const guitarModel=group(parent,0,.09,0);guitarModel.rotation.z=-.14;guitarModel.rotation.x=-.1;
  const shape=new THREE.Shape();shape.moveTo(0,0);shape.bezierCurveTo(-.42,0,-.54,.22,-.39,.48);shape.bezierCurveTo(-.22,.65,-.41,.72,-.25,.93);shape.bezierCurveTo(-.14,1.07,.14,1.07,.25,.93);shape.bezierCurveTo(.41,.72,.22,.65,.39,.48);shape.bezierCurveTo(.54,.22,.42,0,0,0);
  const bodyGeo=new THREE.ExtrudeGeometry(shape,{depth:.17,bevelEnabled:true,bevelSegments:3,steps:1,bevelSize:.025,bevelThickness:.025,curveSegments:32});
  mesh(bodyGeo,'#ab7543',guitarModel);
  const face=mesh(new THREE.ShapeGeometry(shape,32),'#ddb373',guitarModel,0,0,.198);face.castShadow=false;
  const soundhole=cyl(guitarModel,0,.69,.204,.113,.113,.008,'#59442d');soundhole.rotation.x=Math.PI/2;
  const rosette=mesh(new THREE.TorusGeometry(.127,.012,6,40),'#a88650',guitarModel,0,.69,.215);
  box(guitarModel,0,.28,.222,.28,.052,.032,'#6d4e33',.014);
  const pick=sphere(guitarModel,.15,.49,.213,.09,.14,.006,'#795940');pick.rotation.z=-.3;
  box(guitarModel,0,1.41,.08,.14,.96,.11,'#98714b',.015);box(guitarModel,0,1.4,.15,.135,.94,.025,'#61503c',.005);
  for(let i=0;i<15;i++)box(guitarModel,0,.98+i*.058,.17,.134,.008,.009,'#d3c7a5',.002);
  box(guitarModel,0,1.98,.09,.2,.27,.12,'#b38a58',.03);
  for(const side of [-1,1])for(let i=0;i<3;i++){cyl(guitarModel,side*.13,1.89+i*.08,.08,.024,.024,.03,'#ded8c7',8);sphere(guitarModel,side*.15,1.89+i*.08,.08,.033,.022,.023,'#e2d5b3');}
  guitarModel.add(createGuitarStrings());
  const portal=new THREE.Mesh(new THREE.PlaneGeometry(.91,2.18),new THREE.MeshBasicMaterial());
  portal.position.set(0,1.065,.25);portal.visible=false;guitarModel.add(portal);
  return {model:guitarModel,portal};
}
