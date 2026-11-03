import * as THREE from 'three';

// Eight separate cupped petals leave a clear gap around the yellow dome.
export function createDaisyHead(){
  const head=new THREE.Group();head.name='White chamomile';
  const positions=[],indices=[],rows=10,cols=4;
  for(let petal=0;petal<8;petal++){
    const angle=petal*Math.PI/4,offset=positions.length/3;
    for(let j=0;j<=rows;j++)for(let k=0;k<=cols;k++){
      const t=j/rows,r=.028+.055*t,w=.0105*Math.sin(Math.PI*t)*(k/cols*2-1);
      positions.push(Math.sin(angle)*r+Math.cos(angle)*w,.006-.015*Math.sin(Math.PI*t)+.007*t*t,Math.cos(angle)*r-Math.sin(angle)*w);
    }
    for(let j=0;j<rows;j++)for(let k=0;k<cols;k++){const a=offset+j*(cols+1)+k,b=a+cols+1;indices.push(a,b,a+1,b,b+1,a+1);}
  }
  const petals=new THREE.BufferGeometry();petals.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));petals.setIndex(indices);petals.computeVertexNormals();
  const white=new THREE.Mesh(petals,new THREE.MeshStandardMaterial({color:'#f6f3df',roughness:.95,side:THREE.DoubleSide}));white.name='Separated chamomile petals';
  const center=new THREE.Mesh(new THREE.SphereGeometry(1,20,14),new THREE.MeshStandardMaterial({color:'#cfb343',roughness:.85}));center.position.y=.018;center.scale.set(.0255,.017,.0255);center.name='Chamomile yellow dome';
  head.add(white,center);head.traverse(node=>{if(node.isMesh){node.castShadow=true;node.receiveShadow=true;}});return head;
}

// Piecewise straight segments cannot sag through the soundboard like a spline.
export function guitarStringPath(x){
  const points=[[x,.28,.247],[x,1.075,.247],[x,1.145,.187],[x,1.88,.187],[x,2.04,.169]],path=new THREE.CurvePath();
  for(let i=1;i<points.length;i++)path.add(new THREE.LineCurve3(new THREE.Vector3(...points[i-1]),new THREE.Vector3(...points[i])));
  return path;
}
export function createGuitarStrings(){
  const strings=new THREE.Group();strings.name='Six continuous guitar strings';
  const material=new THREE.MeshStandardMaterial({color:'#eee0b8',roughness:.65});
  for(let i=0;i<6;i++){
    const string=new THREE.Mesh(new THREE.TubeGeometry(guitarStringPath(-.047+i*.019),96,.0038,6,false),material);string.name='Continuous guitar string '+(i+1);strings.add(string);
  }
  return strings;
}
