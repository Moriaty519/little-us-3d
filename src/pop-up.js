import * as THREE from 'three';

const popClamp=value=>Math.max(0,Math.min(1,value));
const popEase=value=>{const p=popClamp(value);return p*p*p*(p*(p*6-15)+10);};
const popRange=(value,start,end)=>popEase((value-start)/(end-start));

// Every pose is derived from one clock, so skipping and replaying are reversible.
export function popUpPose(progress){
  const p=popClamp(progress);
  return {front:popRange(p,.025,.31),sides:popRange(p,.18,.53),back:popRange(p,.29,.65),
    backWall:popRange(p,.47,.64),leftWall:popRange(p,.65,.82),
    walls:popRange(p,.47,.82),furniture:popRange(p,.83,.995),camera:popRange(p,.12,.76),
    seal:1-popRange(p,0,.085),visible:p>0};
}

// The existing room is mounted on the letter. Final hinge transforms are identity;
// all furniture, photos and picking IDs belong to the same live room throughout.
export function createPopUp({scene,room,leftWall,backWall,furniture,floor,texture}){
  const paper=new THREE.Group();paper.name='Unfolding envelope';paper.rotation.y=Math.PI;scene.add(paper);
  const paperMat=color=>new THREE.MeshStandardMaterial({color,roughness:1,side:THREE.DoubleSide});
  const outer=paperMat('#8fb2cf'),inner=paperMat('#dceaf5');
  const crease=paperMat('#6e93b2');
  function sheet(parent,points,mat){
    const shape=new THREE.Shape();points.forEach(([x,z],i)=>i?shape.lineTo(x,-z):shape.moveTo(x,-z));shape.closePath();
    const geo=new THREE.ExtrudeGeometry(shape,{depth:.035,bevelEnabled:false});geo.rotateX(-Math.PI/2);
    const mesh=new THREE.Mesh(geo,mat);parent.add(mesh);return mesh;
  }
  sheet(paper,[[-5.3,-4.25],[5.3,-4.25],[5.3,4.25],[-5.3,4.25]],inner);
  const backShape=new THREE.Shape();[[-5.3,-4.25],[5.3,-4.25],[5.3,4.25],[-5.3,4.25]].forEach(([x,z],i)=>i?backShape.lineTo(x,-z):backShape.moveTo(x,-z));backShape.closePath();
  const backGeo=new THREE.ExtrudeGeometry(backShape,{depth:.11,bevelEnabled:false});backGeo.rotateX(-Math.PI/2);
  const backMesh=new THREE.Mesh(backGeo,outer);backMesh.position.y=-.11;paper.add(backMesh);
  const shadowCanvas=document.createElement('canvas');shadowCanvas.width=shadowCanvas.height=256;
  const sctx=shadowCanvas.getContext('2d');const sgrad=sctx.createRadialGradient(128,128,14,128,128,126);
  sgrad.addColorStop(0,'rgba(46,36,24,.40)');sgrad.addColorStop(.55,'rgba(46,36,24,.16)');sgrad.addColorStop(1,'rgba(46,36,24,0)');
  sctx.fillStyle=sgrad;sctx.fillRect(0,0,256,256);
  const shadowTex=new THREE.CanvasTexture(shadowCanvas);shadowTex.colorSpace=THREE.SRGBColorSpace;
  const shadowPlane=new THREE.Mesh(new THREE.PlaneGeometry(14.6,12.2),new THREE.MeshBasicMaterial({map:shadowTex,transparent:true,depthWrite:false,opacity:.75,toneMapped:false}));
  shadowPlane.rotation.x=-Math.PI/2;shadowPlane.position.set(.16,-.20,.12);paper.add(shadowPlane);
  paper.position.y=-.275;
  function flap(name,x,z,points,mat,y){const hinge=new THREE.Group();hinge.name=name;hinge.position.set(x,y,z);hinge.userData.outline=points;paper.add(hinge);sheet(hinge,points,mat);return hinge;}
  const back=flap('Envelope top crease',0,-4.25,[[-5.3,0],[5.3,0],[0,4.25]],outer,.075);
  const left=flap('Envelope left crease',-5.3,0,[[0,-4.25],[0,4.25],[5.3,0]],outer,.055);
  const right=flap('Envelope right crease',5.3,0,[[0,4.25],[0,-4.25],[-5.3,0]],outer,.035);
  const front=flap('Envelope lower crease',0,4.25,[[5.3,0],[-5.3,0],[0,-4.25]],inner,.015);
  function snowflake(ctx,x,z,size,color='#fbfdff'){
    ctx.save();ctx.translate(x,z);ctx.scale(size,size);ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineWidth=.07;ctx.lineCap='round';
    for(let i=0;i<6;i++){
      ctx.save();ctx.rotate(i*Math.PI/3);
      ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(0,-.78);ctx.stroke();
      for(const [y,reach] of [[-.25,.2],[-.45,.16],[-.63,.11]]){
        ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(-reach,y-reach*.9);ctx.moveTo(0,y);ctx.lineTo(reach,y-reach*.9);ctx.stroke();
      }
      ctx.restore();
    }
    ctx.beginPath();ctx.arc(0,0,.075,0,Math.PI*2);ctx.fill();ctx.restore();
  }
  function decorate(hinge,draw){
    const points=hinge.userData.outline,minX=Math.min(...points.map(p=>p[0])),maxX=Math.max(...points.map(p=>p[0])),minZ=Math.min(...points.map(p=>p[1])),maxZ=Math.max(...points.map(p=>p[1]));
    const shape=new THREE.Shape();points.forEach(([x,z],i)=>i?shape.lineTo(x,-z):shape.moveTo(x,-z));shape.closePath();
    const geometry=new THREE.ShapeGeometry(shape);geometry.rotateX(-Math.PI/2);const positions=geometry.attributes.position,uv=geometry.attributes.uv;
    for(let i=0;i<positions.count;i++)uv.setXY(i,(positions.getX(i)-minX)/(maxX-minX),1-(positions.getZ(i)-minZ)/(maxZ-minZ));
    const map=texture((ctx,W,H)=>{ctx.clearRect(0,0,W,H);ctx.setTransform(W/(maxX-minX),0,0,H/(maxZ-minZ),-minX*W/(maxX-minX),-minZ*H/(maxZ-minZ));draw(ctx);},1024,768);
    const ink=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({map,transparent:true,depthWrite:false,toneMapped:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1}));ink.name='Exterior envelope print';ink.position.y=.042;hinge.add(ink);
  }
  function stitch(ctx,points,color){ctx.strokeStyle=color;ctx.lineWidth=.019;ctx.setLineDash([.07,.07]);ctx.beginPath();points.forEach(([x,z],i)=>i?ctx.lineTo(x,z):ctx.moveTo(x,z));ctx.closePath();ctx.stroke();ctx.setLineDash([]);}
  // Seams are the true flap edges; no inset stitching that reads as a misaligned crease.
  // Fine scored lines remain visible when the letter is fully spread.
  for(const [x,z,w,d] of [[0,-4.25,10.6,.018],[0,4.25,10.6,.018],[-5.3,0,.018,8.5],[5.3,0,.018,8.5]]){
    const line=new THREE.Mesh(new THREE.BoxGeometry(w,.006,d),crease);line.position.set(x,.04,z);paper.add(line);
  }
  function print(parent,text,x,z,w,h,color,font='40px "Songti SC",serif'){
    const map=texture((ctx,W,H)=>{ctx.clearRect(0,0,W,H);ctx.fillStyle=color;ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=font;ctx.letterSpacing='1px';ctx.fillText(text,W/2,H/2);},512,128);
    const ink=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map,transparent:true,depthWrite:false,toneMapped:false,side:THREE.DoubleSide}));
    ink.position.set(x,.046,z);ink.rotation.x=-Math.PI/2;parent.add(ink);
    return ink;
  }
  const address=print(front,'anniversary',0,-1.25,4.2,1.05,'#4f6d8f','italic 58px Baskerville,"Times New Roman",serif');
  address.rotation.z=Math.PI;
  const insideAddress=print(front,'a little place for us',0,-2.25,3,.38,'#93a4b5');
  // Print on both faces of the lower flap rather than mirror the inside lettering.
  insideAddress.rotation.x=Math.PI/2;insideAddress.rotation.z=Math.PI;insideAddress.position.y=-.008;
  const seal=new THREE.Group();seal.position.set(0,1.14,.35);paper.add(seal);
  const wax=new THREE.Mesh(new THREE.CylinderGeometry(.48,.5,.1,48),paperMat('#6088aa'));seal.add(wax);
  const rim=new THREE.Mesh(new THREE.TorusGeometry(.37,.012,6,48),paperMat('#d8e7f2'));rim.rotation.x=-Math.PI/2;rim.position.y=.057;seal.add(rim);
  const sealMap=texture((ctx,W,H)=>{ctx.clearRect(0,0,W,H);ctx.translate(W/2,H/2);ctx.scale(W*.3,H*.3);snowflake(ctx,0,0,1.2,'#fbfdff');},256,256);
  const sealMark=new THREE.Mesh(new THREE.PlaneGeometry(.53,.53),new THREE.MeshBasicMaterial({map:sealMap,transparent:true,depthWrite:false,toneMapped:false}));sealMark.rotation.x=-Math.PI/2;sealMark.rotation.z=Math.PI;sealMark.position.y=.063;seal.add(sealMark);

  function mount(nodes,position,name){
    const hinge=new THREE.Group();hinge.name=name;hinge.position.set(...position);room.add(hinge);
    room.updateMatrixWorld(true);for(const node of nodes)hinge.attach(node);return hinge;
  }
  const leftRig=mount(leftWall,[-4.5,.23,0],'Left wall paper hinge');
  const backRig=mount(backWall,[0,.23,-3.5],'Back wall paper hinge');
  const furnishings=furniture.map((node,index)=>{
    const pos=node.position.clone(),rig=mount([node],[pos.x,.23,pos.z],'Furniture paper hinge '+index);
    room.updateMatrixWorld(true);
    const bounds=new THREE.Box3().setFromObject(node,true).applyMatrix4(rig.matrixWorld.clone().invert());
    const position=rig.position.clone();
    rig.rotation.x=index===0?0:(index===6?-1:1)*Math.PI/2;
    rig.rotation.z=index===0?-Math.PI/2:0;
    rig.scale.set(index===0?.0015:1,1,index===0?1:.0015);rig.updateMatrix();
    const foldedBounds=bounds.clone().applyMatrix4(rig.matrix);
    // The front table and birdhouse fold into the back panel's footprint.
    // Furniture under the left panel already fits within its full depth.
    const stowZ=foldedBounds.max.x>-.20?Math.min(0,.70-foldedBounds.max.z):0;
    rig.rotation.set(0,0,0);rig.scale.setScalar(1);
    return {rig,index,bounds,position,stowZ,restBottom:bounds.min.y+position.y,posedBounds:new THREE.Box3()};
  });
  const floorScale=floor.map(node=>({node,scale:node.scale.y,position:node.position.y}));
  // Only the concealed rear edge needs a clearance allowance. Keep the hinge,
  // window and the rest of the wall stationary while this small edge unfolds.
  room.updateMatrixWorld(true);const rearEdges=[];
  leftRig.traverse(node=>{
    if(!node.isMesh)return;const localToRig=leftRig.matrixWorld.clone().invert().multiply(node.matrixWorld),positions=node.geometry.attributes.position,weights=[];
    for(let i=0;i<positions.count;i++)weights.push(popRange(-new THREE.Vector3().fromBufferAttribute(positions,i).applyMatrix4(localToRig).z,3.05,3.45));
    if(!weights.some(weight=>weight>0))return;
    const inverse=localToRig.clone().invert(),offset=new THREE.Vector3(0,0,1).applyMatrix4(inverse).sub(new THREE.Vector3().applyMatrix4(inverse));
    node.geometry=node.geometry.clone();rearEdges.push({geometry:node.geometry,original:positions.array.slice(),weights,offset});
  });
  let rearClearance=-1;
  function clearRearEdge(value){
    if(value===rearClearance)return;rearClearance=value;
    for(const {geometry,original,weights,offset} of rearEdges){
      const positions=geometry.attributes.position;for(let i=0;i<positions.count;i++){const shift=value*weights[i];positions.setXYZ(i,original[i*3]+offset.x*shift,original[i*3+1]+offset.y*shift,original[i*3+2]+offset.z*shift);}
      positions.needsUpdate=true;geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
    }
  }
  const paperMaterials=new Map();paper.traverse(node=>{if(node.isMesh&&!paperMaterials.has(node.material))paperMaterials.set(node.material,{opacity:node.material.opacity,transparent:node.material.transparent,depthWrite:node.material.depthWrite});});
  let active=false,progress=0;
  function draw(value){
    progress=popClamp(value);const pose=popUpPose(progress);
    back.rotation.x=-Math.PI*pose.back;left.rotation.z=Math.PI*pose.sides;right.rotation.z=-Math.PI*pose.sides;front.rotation.x=Math.PI*pose.front;
    // The visible upper triangle opens first and is stowed above the covers.
    // Lower a hinge only once its flap swings outside the other covers.
    const settle=amount=>1-popRange(amount,.56,1);
    back.position.y=.085+.84*settle(pose.back);left.position.y=.045+.76*settle(pose.sides);
    right.position.y=.065+.80*settle(pose.sides);front.position.y=.025+1.00*settle(pose.front);
    seal.visible=pose.seal>0;seal.scale.setScalar(Math.max(.001,pose.seal));seal.position.y=1.14+(1-pose.seal)*.25;
    address.visible=pose.front<.5;
    room.visible=pose.visible;
    const leftRise=pose.leftWall,backRise=pose.backWall;
    leftRig.rotation.z=-Math.PI/2*(1-leftRise);
    backRig.rotation.x=Math.PI/2*(1-backRise);
    // Two full wall faces used to occupy the same plane when folded. Stow them
    // as thin, separate layers, then restore their original depth as they rise.
    leftRig.scale.x=.035+.965*leftRise;backRig.scale.z=.035+.965*backRise;
    leftRig.position.y=.23+.115*(1-leftRise)+.30*leftRig.scale.x*Math.sin(-leftRig.rotation.z);
    backRig.position.y=.23+.195*(1-backRise)+.27*backRig.scale.z*Math.sin(backRig.rotation.x);
    clearRearEdge(.24*(1-popRange(leftRise,.99,1)));
    furnishings.forEach(({rig,index,bounds,position,stowZ,restBottom,posedBounds})=>{
      const q=popRange(progress,.83+index*.005,.955+index*.005);
      // Fold in the hinge's axes: local furniture axes may already be rotated.
      const flat=.0015+.9985*q;
      rig.rotation.x=index===0?0:(index===6?-1:1)*Math.PI/2*(1-q);
      rig.rotation.z=index===0?-Math.PI/2*(1-q):0;
      rig.scale.set(index===0?flat:1,1,index===0?1:flat);
      rig.position.copy(position);rig.position.z+=stowZ*(1-popRange(progress,.82,.96));rig.updateMatrix();
      posedBounds.copy(bounds).applyMatrix4(rig.matrix);
      // Stow below the wall panels, then clear the floor as each hinge rises.
      const bottom=(.247+index*.004)*(1-q)+restBottom*q;
      rig.position.y+=Math.max(0,bottom-posedBounds.min.y);
    });
    floorScale.forEach(({node,scale,position})=>{node.scale.y=scale*(.12+.88*popRange(progress,.58,.95));node.position.y=position;});
    return pose;
  }
  function enable(value){
    active=value;paper.visible=value;
    if(!value){draw(1);room.visible=true;floorScale.forEach(({node,scale,position})=>{node.scale.y=scale;node.position.y=position;});}
  }
  enable(false);
  return {enable,draw,isActive:()=>active,progress:()=>progress,
    sealPoint:()=>{paper.updateMatrixWorld(true);return seal.getWorldPosition(new THREE.Vector3());},
    exit:progress=>{paper.scale.setScalar(1-.035*progress);paper.position.y=-.275-progress*.35;for(const [mat,original] of paperMaterials){mat.transparent=true;mat.opacity=original.opacity*(1-progress);mat.depthWrite=original.depthWrite&&progress<.95;}},
    reset:()=>{paper.scale.setScalar(1);paper.position.y=-.275;for(const [mat,original] of paperMaterials)Object.assign(mat,original);draw(0);}};
}
