import * as THREE from 'three';

// The approved character, without feet or scenery. Reuse its static geometry
// across the homepage and the shared living-room projection scene.
let birdCharacterTemplate=null;

export function createBirdCharacter() {
  if (!birdCharacterTemplate) birdCharacterTemplate=buildBirdCharacter();
  const group=birdCharacterTemplate.clone(true),faces=[];
  group.traverse(node=>{
    if(node.userData.birdFace)faces.push(node);
    // Down is decorative; body and eyes retain the birdhouse picking ID.
    if(node.isLineSegments)node.raycast=()=>{};
  });
  const cameraPosition=new THREE.Vector3(),point=new THREE.Vector3(),normal=new THREE.Vector3(),rotation=new THREE.Quaternion();
  function update(view) {
    group.updateWorldMatrix(true,true);view.getWorldPosition(cameraPosition);
    for(const node of faces) {
      if(node.userData.birdBeak)point.set(0,1.75,1.1).applyMatrix4(group.matrixWorld);
      else node.getWorldPosition(point);
      node.getWorldQuaternion(rotation);normal.set(0,0,1).applyQuaternion(rotation);
      node.visible=normal.dot(point.sub(cameraPosition).negate().normalize())>(node.userData.birdBeak?-.15:.02);
    }
  }
  return {group,update};
}

function buildBirdCharacter() {
  const T=THREE;
  const palette={body:'#98cb38',wing:'#a9ca46',face:'#f1e3c1',tail:'#37aaa5',pink:'#edbdc4'};
  const color=name=>palette[name];
  const bird=new T.Group(); bird.name='Plump green bird character';
  const cy=1.28, rx=1.14, ry=1.23, rz=1.13;
  const clamp=T.MathUtils.clamp, smooth=(a,b,x)=>T.MathUtils.smoothstep(x,a,b), sq=x=>x*x;
  // A single smooth implicit surface joins the body, wings and tail.
  function ellipsoidDistance(x,y,z,a,b,c) {
    const k0=Math.sqrt(x*x/(a*a)+y*y/(b*b)+z*z/(c*c));
    const k1=Math.sqrt(x*x/(a*a*a*a)+y*y/(b*b*b*b)+z*z/(c*c*c*c));
    return k1>1e-7?k0*(k0-1)/k1:-Math.min(a,b,c);
  }
  function join(a,b,k) {const h=clamp(.5+.5*(b-a)/k,0,1);return T.MathUtils.lerp(b,a,h)-k*h*(1-h);}
  function field(x,y,z) {
    const h=(y-cy)/ry,f=1-.12*h-.025*h*h;
    let d=ellipsoidDistance(x,y-cy,z,rx*f,ry,rz*f);
    d=join(d,ellipsoidDistance(x-1.035,y-1.02,z+.09,.235,.46,.35),.17);
    d=join(d,ellipsoidDistance(x+1.035,y-1.02,z+.09,.235,.46,.35),.17);
    return join(d,ellipsoidDistance(x,y-.56,z+1.04,.29,.17,.39),.22);
  }
  const baseColor=new T.Color(color('body')), lightColor=new T.Color('#b8dd5f');
  const mintColor=new T.Color('#7cbf48'), wingColor=new T.Color(color('wing')),faceColor=new T.Color(color('face'));
  const tailColor=new T.Color(color('tail')); 
  function tint(x,y,z) {
    const c=baseColor.clone();
    c.lerp(lightColor,.20*Math.exp(-sq((y-1.5)/1.0))*smooth(-.25,.9,z));
    c.lerp(mintColor,.2*(1-smooth(.2,1.9,y)));
    const faceWeight=.78*Math.exp(-((x/.66)**4)-sq((y-1.83)/.43))*smooth(.38,.88,z);
    c.lerp(faceColor,faceWeight);
    const wingWeight=.37*Math.exp(-sq((Math.abs(x)-1.14)/.27)-sq((y-.96)/.63)-sq((z+.08)/.61));
    c.lerp(wingColor,wingWeight);
    const tailWeight=smooth(.76,1.35,-z)*Math.exp(-sq((y-.55)/.43)-sq(x/.48));
    c.lerp(tailColor,tailWeight);
    return c;
  }
  const nx=46,ny=42,nz=48,sx=nx+1,sy=ny+1,sz=nz+1;
  const minX=-1.48,minY=-.03,minZ=-1.59,dx=2.96/nx,dy=2.70/ny,dz=2.95/nz;
  const count=sx*sy*sz,values=new Float32Array(count),gx=new Float32Array(count),gy=new Float32Array(count),gz=new Float32Array(count);
  const index=(i,j,k)=>(i*sy+j)*sz+k;
  for(let i=0;i<=nx;i++)for(let j=0;j<=ny;j++)for(let k=0;k<=nz;k++)values[index(i,j,k)]=field(minX+i*dx,minY+j*dy,minZ+k*dz);
  for(let i=1;i<nx;i++)for(let j=1;j<ny;j++)for(let k=1;k<nz;k++) {
    const q=index(i,j,k);
    gx[q]=(values[index(i+1,j,k)]-values[index(i-1,j,k)])/(2*dx);
    gy[q]=(values[index(i,j+1,k)]-values[index(i,j-1,k)])/(2*dy);
    gz[q]=(values[index(i,j,k+1)]-values[index(i,j,k-1)])/(2*dz);
  }
  const verts=[],normals=[],colors=[];
  const corners=[[0,0,0],[1,0,0],[1,1,0],[0,1,0],[0,0,1],[1,0,1],[1,1,1],[0,1,1]];
  const tetrahedra=[[0,5,1,6],[0,1,2,6],[0,2,3,6],[0,3,7,6],[0,7,4,6],[0,4,5,6]];
  function crossing(a,b) {
    const t=a.v/(a.v-b.v), p=a.p.clone().lerp(b.p,t),n=a.n.clone().lerp(b.n,t).normalize();return {p,n};
  }
  function triangle(a,b,c) {
    const cross=b.p.clone().sub(a.p).cross(c.p.clone().sub(a.p));
    if(cross.dot(a.n.clone().add(b.n).add(c.n))<0) [b,c]=[c,b];
    for(const q of [a,b,c]) {verts.push(q.p.x,q.p.y,q.p.z);normals.push(q.n.x,q.n.y,q.n.z);const col=tint(q.p.x,q.p.y,q.p.z);colors.push(col.r,col.g,col.b);}
  }
  for(let i=1;i<nx-1;i++)for(let j=1;j<ny-1;j++)for(let k=1;k<nz-1;k++) {
    const ids=corners.map(([a,b,c])=>index(i+a,j+b,k+c));
    if(ids.every(q=>values[q]>0)||ids.every(q=>values[q]<0))continue;
    const cube=corners.map(([a,b,c],q)=>({v:values[ids[q]],p:new T.Vector3(minX+(i+a)*dx,minY+(j+b)*dy,minZ+(k+c)*dz),n:new T.Vector3(gx[ids[q]],gy[ids[q]],gz[ids[q]])}));
    for(const tetra of tetrahedra) {
      const inside=tetra.map(q=>cube[q]).filter(q=>q.v<0),outside=tetra.map(q=>cube[q]).filter(q=>q.v>=0);
      if(inside.length===1)triangle(...outside.map(q=>crossing(inside[0],q)));
      else if(inside.length===3)triangle(...inside.map(q=>crossing(outside[0],q)));
      else if(inside.length===2) {
        const a=crossing(inside[0],outside[0]),b=crossing(inside[0],outside[1]),c=crossing(inside[1],outside[0]),d=crossing(inside[1],outside[1]);
        triangle(a,b,c);triangle(b,d,c);
      }
    }
  }
  const bodyGeo=new T.BufferGeometry();
  bodyGeo.setAttribute('position',new T.Float32BufferAttribute(verts,3));bodyGeo.setAttribute('normal',new T.Float32BufferAttribute(normals,3));bodyGeo.setAttribute('color',new T.Float32BufferAttribute(colors,3));
  const bodyMat=new T.MeshPhysicalMaterial({vertexColors:true,color:0xffffff,roughness:.88,metalness:0,transmission:.24,transparent:true,opacity:.96,depthWrite:true,thickness:1.05,ior:1.16,specularIntensity:.12,sheen:.85,sheenColor:new T.Color('#d6eab2'),sheenRoughness:.9,attenuationColor:new T.Color('#adcf61'),attenuationDistance:3.3,emissive:new T.Color('#94c555'),emissiveIntensity:.055});
  bodyMat.onBeforeCompile=shader=>{
    shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',
      'float spiritRim = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 2.2);\n'+
      'diffuseColor.a *= mix(1.0, 0.91, spiritRim);\n'+
      'outgoingLight += diffuseColor.rgb * (0.015 + 0.045 * spiritRim);\n'+
      '#include <opaque_fragment>');
  };
  const body=new T.Mesh(bodyGeo,bodyMat);body.name='Soft egg-shaped body';body.castShadow=true;body.receiveShadow=true;bird.add(body);
  // Fine curved fibers add a soft downy nap without changing the round silhouette.
  let seed=81723;
  function random(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
  const fiberPositions=[],fiberColors=[],hairCount=4200;
  for(let i=0;i<hairCount;i++) {
    const q=Math.floor(random()*(verts.length/9))*9;
    const r1=random(),r2=random(),a=1-Math.sqrt(r1),b=Math.sqrt(r1)*(1-r2),c=Math.sqrt(r1)*r2;
    const p=new T.Vector3(verts[q]*a+verts[q+3]*b+verts[q+6]*c,verts[q+1]*a+verts[q+4]*b+verts[q+7]*c,verts[q+2]*a+verts[q+5]*b+verts[q+8]*c);
    const n=new T.Vector3(normals[q]*a+normals[q+3]*b+normals[q+6]*c,normals[q+1]*a+normals[q+4]*b+normals[q+7]*c,normals[q+2]*a+normals[q+5]*b+normals[q+8]*c).normalize();
    const len=.012+random()*.014,rootP=p.clone().addScaledVector(n,.003),mid=p.clone().addScaledVector(n,len*.7),tip=p.clone().addScaledVector(n,len);
    tip.y-=.004;tip.x+=(random()-.5)*.005;
    const col=tint(p.x,p.y,p.z).lerp(new T.Color('#edf4d5'),.14);
    for(const v of [rootP,mid,mid,tip]){fiberPositions.push(v.x,v.y,v.z);fiberColors.push(col.r,col.g,col.b);}
  }
  const fiberGeo=new T.BufferGeometry();fiberGeo.setAttribute('position',new T.Float32BufferAttribute(fiberPositions,3));fiberGeo.setAttribute('color',new T.Float32BufferAttribute(fiberColors,3));
  const fibers=new T.LineSegments(fiberGeo,new T.LineBasicMaterial({vertexColors:true,transparent:true,opacity:.32,depthWrite:false}));fibers.name='Fine short green down';fibers.renderOrder=1;bird.add(fibers);
  const sphereGeo=new T.SphereGeometry(1,32,22);
  const eyeMat=new T.MeshStandardMaterial({color:'#30382b',roughness:.62,metalness:0,transparent:true,opacity:1});
  const glintMat=new T.MeshBasicMaterial({color:'#fff6dd',transparent:true,opacity:.82});
  const faceParts=[];
  [-1,1].forEach(sign => {
    const theta=1.04,phi=sign*.45,h=Math.cos(theta),f=1-.12*h-.025*h*h;
    const p=new T.Vector3(rx*f*Math.sin(theta)*Math.sin(phi),cy+ry*Math.cos(theta),rz*f*Math.sin(theta)*Math.cos(phi));
    const n=new T.Vector3(p.x/(rx*rx),(p.y-cy)/(ry*ry),p.z/(rz*rz)).normalize();
    const rimMat=new T.MeshStandardMaterial({color:tint(p.x,p.y,p.z),roughness:.96});
    const socket=new T.Mesh(sphereGeo,rimMat);socket.position.copy(p).addScaledVector(n,.007);socket.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),n);socket.scale.set(.164,.163,.044);bird.add(socket);faceParts.push({mesh:socket,normal:n});
    const eye=new T.Mesh(sphereGeo,eyeMat);eye.position.copy(p).addScaledVector(n,.028);eye.renderOrder=2;
    eye.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),n);eye.scale.set(.14,.141,.062);bird.add(eye);faceParts.push({mesh:eye,normal:n});
    const dot=new T.Mesh(sphereGeo,glintMat);dot.position.set(-.24,.32,.92);dot.scale.set(.125,.112,.04);eye.add(dot);
  });
  // Rounded parrot beak: a narrow attachment, convex belly and downward hooked tip.
  const bverts=[],bindices=[],bcolors=[],rings=20,segments=24;
  const pinkLight=new T.Color('#f4d4d4'),pinkTip=new T.Color('#e2aeb8');
  for(let j=0;j<=rings;j++) {
    const t=j/rings,s=Math.sin(Math.PI*t),w=.12*Math.pow(1-t,.63)*(.40+.90*s);
    const y=1.855-.25*t,centerZ=1.027+.145*Math.sin(Math.PI*t*.86),depth=.031*(1-t)+.057*Math.pow(Math.max(s,0),.70);
    const col=pinkLight.clone().lerp(pinkTip,smooth(.05,.95,t));
    for(let k=0;k<=segments;k++) {const a=k/segments*Math.PI*2;bverts.push(w*Math.cos(a),y,centerZ+depth*Math.sin(a));bcolors.push(col.r,col.g,col.b);}
  }
  for(let j=0;j<rings;j++)for(let k=0;k<segments;k++) {const a=j*(segments+1)+k,b=a+segments+1;bindices.push(a,b,a+1,a+1,b,b+1);}
  const cap=bverts.length/3;bverts.push(0,1.855,1.027);bcolors.push(pinkLight.r,pinkLight.g,pinkLight.b);for(let k=0;k<segments;k++)bindices.push(cap,k+1,k);
  const beakGeo=new T.BufferGeometry();beakGeo.setAttribute('position',new T.Float32BufferAttribute(bverts,3));beakGeo.setAttribute('color',new T.Float32BufferAttribute(bcolors,3));beakGeo.setIndex(bindices);beakGeo.computeVertexNormals();
  const beakMat=new T.MeshPhysicalMaterial({vertexColors:true,color:0xffffff,roughness:.62,transmission:0,transparent:true,opacity:.97,ior:1.2,specularIntensity:.3,side:T.DoubleSide});
  const beak=new T.Mesh(beakGeo,beakMat);beak.renderOrder=2;bird.add(beak);faceParts.push({mesh:beak,normal:new T.Vector3(0,0,1),beak:true});
  faceParts.forEach(({mesh,beak})=>{mesh.userData.birdFace=true;mesh.userData.birdBeak=!!beak;});
  bird.userData.character='footless-plump-green-bird';
  return bird;
}
