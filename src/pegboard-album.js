import * as THREE from 'three';
import { PHOTO_WALL_ART,PHOTO_WALL_SLOTS } from './photo-wall-art.js';
import { ALBUM_FOLD_WIDTH,ALBUM_FOLD_HEIGHT,albumTurnColumns } from './album-fold.js';
import { renderAlbumPage,albumCoverOptions } from './album-pages.js';

export const SHELF_ALBUM_WIDTH=.72,SHELF_ALBUM_HEIGHT=ALBUM_FOLD_HEIGHT*SHELF_ALBUM_WIDTH/(ALBUM_FOLD_WIDTH/2);
export function pegboardShape(){
  const shape=new THREE.Shape();shape.moveTo(-1.3,-1.05);shape.lineTo(1.3,-1.05);shape.lineTo(1.3,1.05);shape.lineTo(-1.3,1.05);shape.closePath();
  for(let row=-5;row<=5;row++)for(let column=-6;column<=6;column++){
    const hole=new THREE.Path();hole.absarc(column*.19,row*.18,.024,0,Math.PI*2,true);shape.holes.push(hole);
  }return shape;
}
export function createPegboardAlbum({texture,onChange}){
  const group=new THREE.Group();group.name='Pegboard photo wall with journal shelf';
  const wood=new THREE.MeshStandardMaterial({color:'#c7ac80',roughness:.85}),edge=new THREE.MeshStandardMaterial({color:'#b89a6c',roughness:.87});
  function box(parent,x,y,z,w,h,d,material){const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);mesh.position.set(x,y,z);mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);return mesh;}
  const panel=new THREE.Mesh(new THREE.ExtrudeGeometry(pegboardShape(),{depth:.075,bevelEnabled:false,curveSegments:8}),new THREE.MeshStandardMaterial({color:'#c0c9af',roughness:1}));panel.position.z=-.038;panel.castShadow=panel.receiveShadow=true;group.add(panel);
  for(const x of [-1.325,1.325])box(group,x,0,0,.05,2.16,.095,wood);
  for(const y of [-1.075,1.075])box(group,0,y,0,2.7,.05,.095,wood);
  // Keep the projecting shelf and journal together in the board's upper right.
  const journalShelf=new THREE.Group();journalShelf.name='Upper-right journal shelf';journalShelf.position.set(.69,.65,0);journalShelf.scale.setScalar(.5);group.add(journalShelf);
  const shelf=box(journalShelf,.12,-.69,.45,2.12,.12,.82,wood);shelf.name='Projecting oak journal shelf';
  box(journalShelf,.12,-.682,.865,2.12,.105,.015,edge);
  for(const x of [-.69,.9]){
    box(journalShelf,x,-.86,.085,.065,.38,.085,edge);box(journalShelf,x,-.765,.4,.065,.055,.62,edge);
    const strut=box(journalShelf,x,-.85,.32,.055,.045,.52,edge);strut.rotation.x=-.3;
  }
  const cards=[[-.96,.55,.49,.55,.09],[-.27,.65,.6,.44,-.04],[.34,-.44,.44,.52,-.07],[-1,-.21,.44,.48,-.08],[-.38,-.17,.53,.47,.06],[1.04,-.23,.36,.4,-.04]];
  const images=cards.map(([x,y,w,h,angle],i)=>{
    const card=new THREE.Group();card.position.set(x,y,.067+i*.002);card.rotation.z=angle;group.add(card);
    box(card,0,0,0,w,h,.014,new THREE.MeshStandardMaterial({color:'#fffaf0',roughness:.96}));
    const mat=new THREE.MeshBasicMaterial({map:texture((ctx,W,H)=>{ctx.fillStyle='#e9e1d0';ctx.fillRect(0,0,W,H);},240,240),toneMapped:false});
    const image=new THREE.Mesh(new THREE.PlaneGeometry(w-.036,h-.105),mat);image.position.set(0,.025,.009);card.add(image);
    const pin=new THREE.Mesh(new THREE.CylinderGeometry(.014,.014,.065,10),new THREE.MeshStandardMaterial({color:'#a89163',roughness:.45}));pin.rotation.x=Math.PI/2;pin.position.set(0,h/2+.026,-.012);card.add(pin);
    box(card,0,h/2-.012,.025,.07,.027,.023,new THREE.MeshStandardMaterial({color:'#b9a578',roughness:.6}));return mat;
  });
  const book=new THREE.Group();book.name='The same sage journal as the reading cover';book.position.set(.4,-.63+SHELF_ALBUM_HEIGHT/2,.52);book.rotation.x=-.09;journalShelf.add(book);
  const paper=new THREE.MeshBasicMaterial({color:'#eee8d9'}),coverBack=new THREE.MeshBasicMaterial({color:'#899c77'});
  box(book,0,0,-.025,SHELF_ALBUM_WIDTH,SHELF_ALBUM_HEIGHT,.05,paper);
  box(book,0,0,-.053,SHELF_ALBUM_WIDTH+.012,SHELF_ALBUM_HEIGHT+.012,.014,coverBack);
  box(book,-SHELF_ALBUM_WIDTH/2+.008,0,-.018,.014,SHELF_ALBUM_HEIGHT+.012,.064,coverBack);
  for(let i=0;i<4;i++)box(book,SHELF_ALBUM_WIDTH/2+.003,0,-.042+i*.012,.006,SHELF_ALBUM_HEIGHT-.018,.004,new THREE.MeshBasicMaterial({color:i%2?'#e1d9c6':'#faf4e6'}));
  const geometry=new THREE.PlaneGeometry(SHELF_ALBUM_WIDTH,SHELF_ALBUM_HEIGHT,32,16),positions=geometry.attributes.position,uv=geometry.attributes.uv,columns=albumTurnColumns(0),scale=SHELF_ALBUM_WIDTH/(ALBUM_FOLD_WIDTH/2);
  for(let i=0;i<positions.count;i++){
    const u=uv.getX(i),point=columns[Math.round(u*32)];positions.setXYZ(i,point[0]*scale-SHELF_ALBUM_WIDTH/2,positions.getY(i),point[1]*scale);uv.setX(i,.5+.5*u);
  }geometry.computeVertexNormals();geometry.computeBoundingSphere();
  const cover=new THREE.MeshBasicMaterial({map:texture((ctx,W,H)=>{ctx.fillStyle='#899c77';ctx.fillRect(0,0,W,H);},860,622),transparent:true,alphaTest:.02,toneMapped:false});
  const face=new THREE.Mesh(geometry,cover);face.name='Journal cover focus anchor';book.add(face);
  let photoGeneration=0,coverGeneration=0;
  const artwork=new Image();artwork.src=PHOTO_WALL_ART;
  async function setPhotos(memories){
    const generation=++photoGeneration;await artwork.decode();
    const photos=await Promise.all(memories.slice(0,images.length).map(async record=>{const image=new Image();image.src=record.photo;try{await image.decode();return image;}catch{return null;}}));
    if(generation!==photoGeneration)return;
    images.forEach((mat,i)=>{
      const map=texture((ctx,W,H)=>{
        const image=photos[i];ctx.fillStyle='#eee7d3';ctx.fillRect(0,0,W,H);
        if(image){const fit=Math.min(W/image.width,H/image.height);ctx.drawImage(image,(W-image.width*fit)/2,(H-image.height*fit)/2,image.width*fit,image.height*fit);}
        else{const {x,y,w,h,angle}=PHOTO_WALL_SLOTS[i];ctx.scale(W/(w-38),H/(h-93));ctx.translate(w/2-19,h/2-19);ctx.rotate(angle*Math.PI/180);ctx.translate(-x-w/2,-y-h/2);ctx.drawImage(artwork,0,0);}
      },300,300);mat.map?.dispose();mat.map=map;mat.needsUpdate=true;
    });onChange();
  }
  async function setPages(pages){
    const generation=++coverGeneration,rendered=await renderAlbumPage({cover:true},{cover:true,...albumCoverOptions(pages)});if(generation!==coverGeneration)return;
    const map=new THREE.CanvasTexture(rendered.canvas);map.colorSpace=THREE.SRGBColorSpace;cover.map?.dispose();cover.map=map;cover.needsUpdate=true;onChange();
  }
  setPhotos([]).catch(console.error);setPages([]).catch(console.error);
  return {group,book,face,setPhotos,setPages};
}
