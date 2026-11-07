import { createGuitarModel } from './guitar-model.js';
import { createTapTracker } from './ui.js';
import * as THREE from 'three';
import { OrbitControls } from './assets/OrbitControls.js';
import { RoundedBoxGeometry } from './assets/RoundedBoxGeometry.js';
import { createChinaMapModel, createWindowModel, createSageWallPanel, createHomeLighting } from './wall-decor.js';
import { createPegboardAlbum } from './pegboard-album.js';
import { createAlbumIsolation } from './album-isolation.js';
import { roomFrame, openingFrame } from './room-frame.js';
import { matchedSurfaceFrame } from './feature-frame.js';
import { createPopUp, popUpPose } from './pop-up.js';
import { createDaisyHead } from './room-details.js';
import { createProjectionPlayer } from './projection-art.js';
import { cinemaViewport } from './cinema-frame.js';
import { createBirdCharacter } from './bird-character.js';
import { createRoomLife } from './room-life.js';
import { createBirdTourFlight } from './bird-tour-flight.js';

// All objects are real geometry. Positions and dimensions are in room units.
export function createRoom(container, onSelect, {projection=false}={}) {
  const scene = new THREE.Scene();
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  container.append(renderer.domElement);
  // A closer near plane gives the small layered surfaces enough depth precision.
  const camera = new THREE.PerspectiveCamera(38, 1, projection ? .12 : .5, projection ? 45 : 180);
  camera.position.set(12, 11, 14);
  const controls = new OrbitControls(camera, renderer.domElement);
  let sceneDirty=true,compactPresentation=false,presentationBlend=0,interactive=!projection,baseDistance=0,zoomRatio=1,openingMode=false,openingProgress=0,openingExit=0,featureFocus=null;
  controls.addEventListener('change',()=>{sceneDirty=true;if(interactive&&baseDistance)zoomRatio=camera.position.distanceTo(controls.target)/baseDistance;});
  controls.target.set(0, 2.1, 0);
  controls.enableDamping = true;
  controls.dampingFactor = .075;
  controls.enablePan = false;
  controls.mouseButtons={LEFT:THREE.MOUSE.ROTATE,MIDDLE:THREE.MOUSE.ROTATE,RIGHT:THREE.MOUSE.ROTATE};
  controls.touches={ONE:THREE.TOUCH.ROTATE,TWO:THREE.TOUCH.DOLLY_ROTATE};
  controls.minPolarAngle = 0;
  controls.maxPolarAngle = 1.2;
  controls.minAzimuthAngle = -.25;
  controls.maxAzimuthAngle = 1.5;
  controls.update();
  controls.saveState();
  controls.enabled=!projection;
  const room = new THREE.Group();
  scene.add(room);
  const materials = new Map();
  const objects = [];
  const FLOOR = .23;
  const LIVING_SHIFT=-.38;
  const PROJECTION_X=-.75+LIVING_SHIFT-.33;
  function material(color, roughness = .8) {
    const key = color + ':' + roughness;
    if (!materials.has(key)) materials.set(key, new THREE.MeshStandardMaterial({ color, roughness }));
    return materials.get(key);
  }
  function mesh(geo, mat, parent, x = 0, y = 0, z = 0) {
    const m = new THREE.Mesh(geo, typeof mat === 'string' ? material(mat) : mat);
    m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
    parent.add(m); return m;
  }
  function box(parent, x, y, z, w, h, d, color, radius = .03) {
    return mesh(new RoundedBoxGeometry(w, h, d, 2, Math.min(radius, w / 3, h / 3, d / 3)), color, parent, x, y, z);
  }
  function sphere(parent, x, y, z, rx, ry, rz, color) {
    const m = mesh(new THREE.SphereGeometry(1, 20, 14), color, parent, x, y, z); m.scale.set(rx, ry, rz); return m;
  }
  function cyl(parent, x, y, z, rt, rb, h, color, sides = 32) {
    return mesh(new THREE.CylinderGeometry(rt, rb, h, sides), color, parent, x, y, z);
  }
  function line(parent, points, color, radius = .009) {
    const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
    return mesh(new THREE.TubeGeometry(curve, Math.max(8, points.length * 8), radius, 5, false), color, parent);
  }
  function group(parent, x, y, z, id) {
    const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g);
    if (id) { g.userData.objectId = id; objects.push(g); }
    return g;
  }
  function canvasTexture(draw, w = 512, h = 512) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = renderer.capabilities.getMaxAnisotropy(); return t;
  }
  function contact(parent, x, z, w, d, opacity = .17, y = FLOOR + .005) {
    const tex = canvasTexture((ctx, W, H) => { const g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W / 2); g.addColorStop(0, 'rgba(79,55,25,.7)'); g.addColorStop(.5, 'rgba(79,55,25,.3)'); g.addColorStop(1, 'rgba(79,55,25,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }, 128, 128);
    const m = mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity, depthWrite: false }), parent, x, y, z);
    m.rotation.x = -Math.PI / 2; m.castShadow = false;
    return m;
  }

  const {sky,sun,fill}=createHomeLighting();scene.add(sky);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -9; sun.shadow.camera.right = 9; sun.shadow.camera.top = 9; sun.shadow.camera.bottom = -9;
  sun.shadow.normalBias = .022; sun.shadow.bias = -.0002; sun.shadow.radius = 2.5; scene.add(sun);
  scene.add(fill);
  // The shadow catcher must sit below the entire wooden base, even at low angles.
  const ground = mesh(new THREE.PlaneGeometry(200, 200), new THREE.ShadowMaterial({ opacity: .13, depthWrite: false }), scene, 0, -.28, 0);
  ground.rotation.x = -Math.PI / 2; ground.castShadow = false;
  const baseContact=contact(scene, 0, .1, 11, 8.5, .3, -.265);

  // Thick wooden base, individual parquet planks, and two open dollhouse walls.
  const floorBase=box(room, 0, -.015, 0, 9.35, .45, 7.35, '#c29b6b', .16);
  const floorTop=box(room, 0, .10, 0, 9.18, .20, 7.18, '#e0c798', .09);
  const woodColors = ['#e4cca4', '#ebd6b0', '#dfc59b', '#e9d3ad', '#e2c9a2', '#f1debd'];
  const floorPlanks=group(room,0,0,0);floorPlanks.name='Aligned rectangular floorboards';
  for (let row = 0; row < 14; row++) {
    for (let col = 0; col < 10; col++) {
      const start = -4.5 + col + (row % 2 ? -.5 : 0);
      const end = Math.min(4.5, start + 1);
      const clipped = Math.max(-4.5, start);
      if (end > clipped) {
        const plank=mesh(new THREE.BoxGeometry(end-clipped-.018,.05,.482),
          woodColors[(row*7+col*3)%woodColors.length],floorPlanks,
          (clipped+end)/2,FLOOR-.025,-3.5+(row+.5)*.5);
        plank.castShadow=false;
      }
    }
  }
  const windowZ=projection ? .2 : -1.45;
  const leftArchitecture=createSageWallPanel({windowX:-windowZ});
  leftArchitecture.position.set(-4.5,0,0);leftArchitecture.rotation.y=Math.PI/2;room.add(leftArchitecture);
  const backArchitecture=group(room,0,0,0);
  box(backArchitecture, 0, 2.35, -3.5, 9.05, 4.3, .16, '#f0e8da', .01);
  for (let i = 0; i < 28; i++) box(backArchitecture, -4.3 + i * .318, 2.32, -3.398, .012, 4.17, .018, '#eee8dd', .002);
  box(backArchitecture, 0, .4, -3.38, 9, .3, .1, '#fdf8ee', .012);
  box(backArchitecture, 0, 4.5, -3.5, 9.15, .12, .23, '#fffaf0', .024);

  // Clear glass sits in a real wall opening, with clearance for the curtains.
  const windowGroup=createWindowModel();
  windowGroup.position.set(-4.37,2.9,windowZ);windowGroup.rotation.y=Math.PI/2;room.add(windowGroup);

  // A closed paneled room door, clear of the wall decorations and sofa.
  const door=group(room,-4.335,FLOOR,2.7);door.rotation.y=Math.PI/2;door.name='Paneled room door';
  box(door,0,1.33,0,1.08,2.66,.075,'#faf6ee',.016);
  for(const x of [-.61,.61])box(door,x,1.39,.022,.1,2.8,.135,'#fdf8ee',.012);
  box(door,0,2.78,.022,1.32,.11,.135,'#fdf8ee',.012);
  box(door,0,.035,.025,1.3,.07,.23,'#e6d4b5',.01);
  for(const [y,h]of [[.73,.8],[1.94,1.17]]){
    box(door,0,y,.047,.81,h,.024,'#f1ebdf',.009);
    for(const x of [-.405,.405])box(door,x,y,.066,.035,h,.026,'#fffdf8',.006);
    for(const dy of [-h/2,h/2])box(door,0,y+dy,.066,.845,.035,.026,'#fffdf8',.006);
  }
  const knobPlate=cyl(door,.413,1.25,.102,.044,.044,.023,'#6f90ad',20);knobPlate.rotation.x=Math.PI/2;
  sphere(door,.413,1.25,.148,.049,.049,.036,'#a9c6dd');
  for(const y of [.49,2.16])box(door,-.51,y,.059,.025,.1,.035,'#bfae89',.004);

  // Sofa with curved upholstered cushions and hand-drawn woven pattern.
  const fabricTexture = canvasTexture((ctx, W, H) => { ctx.fillStyle = '#f0eadb'; ctx.fillRect(0, 0, W, H); for(let y=0;y<H;y+=64)for(let x=0;x<W;x+=64){ctx.strokeStyle='#b9bfa4';ctx.lineWidth=1.5;ctx.strokeRect(x+5,y+5,54,54);ctx.strokeStyle='#a4ad8c';ctx.beginPath();ctx.ellipse(x+32,y+32,11,7,0,0,Math.PI*2);ctx.stroke();ctx.fillStyle='#d4c3aa';ctx.beginPath();ctx.arc(x+32,y+32,2.5,0,Math.PI*2);ctx.fill();} }, 512, 512);
  fabricTexture.wrapS = fabricTexture.wrapT = THREE.RepeatWrapping; fabricTexture.repeat.set(2.3, 1.3);
  const fabric = new THREE.MeshStandardMaterial({ map: fabricTexture, roughness: 1 });
  const sofa = group(room, -3.16+LIVING_SHIFT, FLOOR, .32); sofa.rotation.y = Math.PI / 2;
  for (const x of [-1.23, 1.23]) for (const z of [-.42, .42]) cyl(sofa, x, .18, z, .055, .075, .35, '#aa7b58', 12);
  box(sofa, 0, .37, 0, 2.95, .36, 1.2, '#b6886c', .12);
  box(sofa, 0, .72, -.48, 2.9, 1.08, .29, fabric, .11);
  for (const x of [-.91, 0, .91]) { box(sofa, x, .61, .02, .89, .27, .97, fabric, .12); const cushion = box(sofa, x, 1.0, -.26, .89, .63, .3, fabric, .15); cushion.rotation.x = -.11; }
  for (const x of [-1.44, 1.44]) box(sofa, x, .72, .01, .24, .65, 1.14, fabric, .12);
  const throwPillow = box(sofa, -.92, .99, .015, .55, .5, .22, '#a9c6dd', .12); throwPillow.rotation.set(-.16, .08, .12);
  const pillow2 = box(sofa, 1.0, .97, .015, .49, .44, .22, '#dec1ae', .12); pillow2.rotation.set(-.14, -.08, -.1);
  for(let i=0;i<6;i++)box(sofa,1.04,.61,.35+i*.035,.43,.025,.018,'#e4d0b9',.004);
  contact(room, -3.1+LIVING_SHIFT, .32, 2.1, 3.3, .3);

  const rugTex = canvasTexture((ctx, W, H) => {ctx.fillStyle='#a9c6dd';ctx.fillRect(0,0,W,H);ctx.strokeStyle='#f3ead8';ctx.lineWidth=13;ctx.strokeRect(22,22,W-44,H-44);ctx.strokeStyle='#c6d8e6';ctx.lineWidth=4;ctx.strokeRect(40,40,W-80,H-80);for(let y=95;y<H-70;y+=95)for(let x=95;x<W-60;x+=95){ctx.fillStyle='#e8f1f7';ctx.beginPath();ctx.moveTo(x,y-11);ctx.lineTo(x+11,y);ctx.lineTo(x,y+11);ctx.lineTo(x-11,y);ctx.fill();ctx.fillStyle='#5f7f9a';ctx.fillRect(x-3,y-3,6,6);}}, 768, 512);
  const rugBase=mesh(new THREE.BoxGeometry(5.25,.025,3.55),'#7f9fb8',room,-.9,FLOOR+.013,.35);
  rugBase.name='Rectangular rug backing';rugBase.castShadow=false;
  const rug = mesh(new THREE.PlaneGeometry(5.25, 3.55), new THREE.MeshStandardMaterial({ map: rugTex, roughness: 1, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }), room, -.9, FLOOR + .033, .35); rug.rotation.x = -Math.PI/2; rug.castShadow=false; rug.name='Rectangular rug surface';
  const table = group(room, .40, FLOOR + .028, .75);
  table.name='Oval coffee table';table.rotation.y=Math.PI/2;
  for (const x of [-.66, .66]) for (const z of [-.36, .36]) {
    const leg=mesh(new THREE.CapsuleGeometry(.115,.48,8,20),'#f1ebdf',table,x,.355,z);
    leg.name='Rounded upright coffee table leg';
  }
  const top = cyl(table,0,.76,0,1,1,.16,'#fffdf8',64);top.scale.set(1.18,1,.69);
  // White roses, chamomile and silver-green eucalyptus in a stonewashed vase.
  const tableVase=group(table,.19,.845,-.07,'vase');tableVase.name='White rose and eucalyptus arrangement';tableVase.scale.setScalar(.9);
  const vaseProfile=[[0,0],[.19,0],[.27,.045],[.3,.17],[.295,.32],[.25,.48],[.205,.55],[.205,.61],[.22,.62],[.22,.642],[.18,.642],[.18,.54],[.22,.44],[.255,.28],[.25,.1],[.16,.03],[0,.03]];
  const vaseTexture=canvasTexture((ctx,W,H)=>{
    ctx.fillStyle='#a0a39a';ctx.fillRect(0,0,W,H);
    for(let y=0;y<H;y+=4)for(let x=0;x<W;x+=4){const v=Math.round(159+18*Math.sin(x*.67+y*.13)*Math.cos(y*.39-x*.11));ctx.fillStyle=`rgb(${v},${v+3},${v-4})`;ctx.fillRect(x,y,4,4);}
    for(let i=0;i<42;i++){ctx.fillStyle=i%2?'#ebe9e02a':'#656d6620';ctx.beginPath();ctx.ellipse((i*83)%W,(i*47)%H,12+i%19,3+i%7,.15*Math.sin(i),0,Math.PI*2);ctx.fill();}
  },256,256);
  mesh(new THREE.LatheGeometry(vaseProfile.map(([r,y])=>new THREE.Vector2(r,y)),48),new THREE.MeshStandardMaterial({map:vaseTexture,roughness:.94}),tableVase);
  const vaseLip=mesh(new THREE.TorusGeometry(.201,.011,10,40),'#939a90',tableVase,0,.636,0);vaseLip.rotation.x=Math.PI/2;
  function rosePetal(radius,height){
    const vertices=[],indices=[],cols=8,rows=8;
    for(let v=0;v<=rows;v++)for(let u=0;u<=cols;u++){
      const t=v/rows,a=(u/cols-.5)*1.85,r=radius*(.14+.86*Math.sin(t*Math.PI/2));
      vertices.push(Math.sin(a)*r,height*(t-.32*t*t*t)+.009*Math.cos(u/cols*Math.PI*4)*Math.pow(t,6),Math.cos(a)*r);
    }
    for(let v=0;v<rows;v++)for(let u=0;u<cols;u++){const a=v*(cols+1)+u,b=a+cols+1;indices.push(a,b,a+1,b,b+1,a+1);}
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
  }
  const roseRings=[{geometry:rosePetal(.17,.19),n:6,y:0,color:'#f4f3e9'}, {geometry:rosePetal(.125,.19),n:5,y:.045,color:'#efefdf'}, {geometry:rosePetal(.072,.17),n:4,y:.085,color:'#ededde'}];
  const roseMaterials=roseRings.map(({color})=>new THREE.MeshStandardMaterial({color,roughness:.92,side:THREE.DoubleSide}));
  const roses=[[-.28,.89,.17,.93],[-.035,1.12,.035,1.08],[.29,1.0,-.055,.96],[-.23,1.04,-.24,.9],[.23,.87,.245,1],[-.045,.87,.34,.85]];
  roses.forEach(([x,y,z,size],i)=>{
    line(tableVase,[[0,.43,0],[x*.6,y*.78,z*.6],[x,y,z]],'#567453',.012);
    const rose=group(tableVase,x,y,z);rose.name='Layered ivory rose';rose.scale.setScalar(size);rose.rotation.set(.18+.2*(i%2),i*.63,.18*Math.sin(i));
    roseRings.forEach(({geometry,n,y},ring)=>{for(let j=0;j<n;j++){const petal=mesh(geometry,roseMaterials[ring],rose,0,y,0);petal.rotation.y=j*Math.PI*2/n+ring*.42;}});
    sphere(rose,0,.205,0,.028,.035,.028,'#eeeddd');
    for(let j=0;j<3;j++){const leaf=sphere(rose,Math.sin(j*2.1)*.07,-.022,Math.cos(j*2.1)*.07,.033,.012,.07,'#617e56');leaf.rotation.y=j*2.1;}
    const leaf=sphere(tableVase,x*.58+.04,.74,z*.58,.09,.016,.045,'#657d55');leaf.rotation.z=.3*Math.sin(i);leaf.rotation.y=i*.8;
  });
  // Small white daisies sit between the roses and along a few trailing stems.
  for(const [i,x,y,z] of [[0,-.52,.87,.2],[1,.5,.95,.14],[2,.15,1.27,.3],[3,-.5,1.08,-.29],[4,.24,1.02,-.41],[5,-.27,.73,.46],[6,.42,.77,.39],[7,-.52,.7,.16]]){
    line(tableVase,[[0,.47,0],[x*.8,y*.72,z*.8],[x,y,z]],'#6e8a52',.007);
    const daisy=createDaisyHead();daisy.position.set(x,y,z);daisy.rotation.set(.5+i*.11,i*.8,.25*Math.sin(i));tableVase.add(daisy);
  }
  // Paired round eucalyptus leaves extend above and beyond the bouquet.
  for(const [branch,tx,ty,tz] of [[0,-.48,1.66,-.16],[1,.34,1.57,-.3],[2,-.5,.97,.14]]){
    const stem=group(tableVase,0,.5,0);stem.name='Eucalyptus branch';
    line(stem,[[0,0,0],[tx*.5,.48,tz*.5],[tx,ty-.5,tz]],'#596e4e',.009);
    for(let k=0;k<6;k++){
      const t=.28+k*.135,x=tx*t,y=.62+(ty-.62)*t,z=tz*t;
      for(const side of [-1,1]){const leaf=sphere(stem,x+side*(.068-.026*t),y-.5+side*.023,z,.093-.027*t,.015,.079-.016*t,k%2?'#627c6b':'#738979');leaf.rotation.set(.35+branch*.25,branch*.75,side*.48);}
    }
  }
  const coaster=cyl(table,-.64,.86,.2,.2,.2,.022,'#c2a27e');
  const cup=cyl(table,-.64,.945,.2,.11,.087,.14,'#f8efdd');cyl(table,-.64,1.022,.2,.084,.084,.004,'#81664f');
  const handle=mesh(new THREE.TorusGeometry(.075,.019,8,16), '#f8efdd', table,-.51,.96,.2);handle.rotation.y=Math.PI/2;

  // Thick, softly domed cushions take the table's old place and face the screen.
  const floorSeats=[];
  for(const [x,z,color,piping] of [[-2.20,.52,'#a9c6dd','#7f9fba'],[-.98,.52,'#ddc18f','#c0a36f']]){
    const seat=group(room,x,FLOOR+.034,z);seat.name='Soft low projection cushion';floorSeats.push(seat);
    seat.rotation.y=Math.atan2(x-PROJECTION_X,3.232+z);
    const geometry=new THREE.SphereGeometry(1,40,24),positions=geometry.attributes.position;
    for(let i=0;i<positions.count;i++){
      const sx=positions.getX(i),sy=positions.getY(i),sz=positions.getZ(i);
      const px=Math.sign(sx)*Math.pow(Math.abs(sx),.58)*.54,pz=Math.sign(sz)*Math.pow(Math.abs(sz),.58)*.51;
      const tuft=sy>0?.075*sy*sy*Math.exp(-18*(px*px+pz*pz)):0;
      positions.setXYZ(i,px,2*(.17+sy*.17-tuft),pz);
    }
    geometry.computeVertexNormals();mesh(geometry,material(color,.96),seat);
    const seam=Array.from({length:41},(_,i)=>{const a=i/40*Math.PI*2,c=Math.cos(a),s=Math.sin(a);return [Math.sign(c)*Math.pow(Math.abs(c),.58)*.545,.34,Math.sign(s)*Math.pow(Math.abs(s),.58)*.515];});
    line(seat,seam,piping,.005);cyl(seat,0,.536,0,.024,.024,.018,piping,16);
    contact(seat,0,0,1.23,1.16,.15,.004);
  }

  // Projection screen and a little projector; the projection is a true texture.
  const screen = group(room, PROJECTION_X, 2.66, -3.29, 'screen');
  box(screen, 0, .96, 0, 3.65, .13, .19, '#efe9dc', .055);
  box(screen, 0, -.02, .012, 3.42, 1.82, .065, '#e9e5db', .015);
  const projectionPlayer=createProjectionPlayer(renderer,()=>sceneDirty=true);
  const screenMat=new THREE.MeshBasicMaterial({map:projectionPlayer.texture,toneMapped:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-2});
  const screenImage=mesh(new THREE.PlaneGeometry(3.28,1.69),screenMat,screen,0,-.02,.058);screenImage.castShadow=false;
  box(screen,0,-.97,.045,3.54,.08,.12,'#f0eadb');
  line(screen,[[1.7,.9,.02],[1.7,-.8,.02],[1.66,-1.28,.02]],'#e0dbce',.011);
  sphere(screen,1.66,-1.29,.02,.037,.08,.03,'#f1eada');
  const console = group(room, PROJECTION_X, FLOOR, -2.65, 'screen');
  for(const x of [-1.38,1.38])for(const z of [-.29,.29])cyl(console,x,.17,z,.047,.06,.33,'#a98759',12);
  box(console,0,.55,0,3.14,.64,.77,'#c9af85',.055);box(console,0,.9,0,3.29,.08,.86,'#ead6b1',.025);
  for(const x of [-1.05,0,1.05]){box(console,x,.55,.397,.97,.5,.035,'#d9c098',.015);box(console,x,.65,.427,.18,.025,.045,'#b29870',.012);}
  const projector=group(console,.23,1.07,.04);box(projector,0,0,0,.68,.29,.49,'#ede9dc',.08);
  const lens=cyl(projector,0,.01,.26,.083,.083,.046,'#586e68');lens.rotation.x=Math.PI/2;
  const glass=cyl(projector,0,.01,.287,.058,.058,.006,'#b9d5cb');glass.rotation.x=Math.PI/2;
  for(let i=0;i<5;i++)box(projector,-.26+i*.055,.02,.247,.022,.13,.009,'#b0ad9f',.003);
  sphere(projector,.24,.065,.25,.017,.017,.008,'#a5bb88');

  // Acoustic guitar: extruded curved body, sound hole, frets, and six strings.
  const guitar = group(room, .78, FLOOR, -3.08, 'guitar'); guitar.rotation.y=-.08;
  const {portal:guitarPortal}=createGuitarModel(guitar,{group,mesh,box,cyl,sphere});
  for(const side of [-1,1])line(guitar,[[side*.3,.02,.12],[side*.15,.12,-.12],[side*.12,.58,-.17]],'#5e6957',.024);
  contact(room,.78,-3.00,1.2,.9,.22);

  // Recording desk with speakers, audio interface, headphones and microphone.
  const studio=group(room,2.8,FLOOR,-2.36,'studio');
  for(const x of [-.96,.96])for(const z of [-.4,.4])box(studio,x,.67,z,.09,1.32,.1,'#b39b78',.016);
  box(studio,0,1.37,0,2.45,.14,1.11,'#e6d4b5',.042);box(studio,0,.89,.08,2.14,.31,.84,'#ceb692',.025);
  for(const x of [-.54,.54])box(studio,x,.89,.516,.95,.23,.025,'#dbc6a0',.008);
  for(const x of [-.54,.54])box(studio,x,.92,.541,.15,.025,.035,'#b39e77',.006);
  const monitor=group(studio,-.05,2.01,-.28);monitor.name='Raised desktop monitor';box(monitor,0,0,0,.93,.61,.065,'#555f54',.035);
  const dawTex=canvasTexture((ctx,W,H)=>{ctx.fillStyle='#8a9a88';ctx.fillRect(0,0,W,H);ctx.fillStyle='#e3e3d2';ctx.fillRect(0,0,W,26);ctx.fillStyle='#637963';for(let i=0;i<4;i++){ctx.fillRect(12,45+i*42,75,30);ctx.fillStyle=i%2?'#d8c2a5':'#b5c195';ctx.fillRect(102+(i%2)*35,46+i*42,235-i*22,27);ctx.fillStyle='#637963';}ctx.strokeStyle='#eef0d9';ctx.lineWidth=2;for(let i=0;i<4;i++){ctx.beginPath();for(let j=0;j<65;j++){const x=110+j*3.3,y=60+i*42+Math.sin(j*1.8+i)*7*Math.sin(j*.34);j?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.stroke();}ctx.fillStyle='#f2ebd3';ctx.fillRect(224,28,2,H);},384,240);
  const daw=mesh(new THREE.PlaneGeometry(.83,.51),new THREE.MeshBasicMaterial({map:dawTex,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-2}),monitor,0,0,.042);daw.castShadow=false;
  box(studio,-.05,1.605,-.28,.08,.28,.08,'#6d7665');box(studio,-.05,1.455,-.28,.38,.022,.22,'#777f6c');
  for(const x of [-.87,.85]){box(studio,x,1.67,-.29,.34,.47,.32,'#3f5d78',.03);for(const [y,r]of[[1.76,.048],[1.59,.103]]){const speaker=cyl(studio,x,y,-.118,r,r,.024,'#2f475c');speaker.rotation.x=Math.PI/2;const cone=cyl(studio,x,y,-.1,r*.58,r*.58,.009,'#a9c6dd');cone.rotation.x=Math.PI/2;}}
  const audio=box(studio,.72,1.46,.26,.31,.055,.25,'#c1a58c',.012);
  for(const x of [.63,.73,.82])cyl(studio,x,1.5,.28,.027,.027,.017,'#f1e6d4',12);
  // One upright tabletop microphone. Its base and cable stay entirely on the desk.
  const deskMic=group(studio,-.05,1.445,.24);deskMic.name='Centered upright tabletop microphone';
  cyl(deskMic,0,.018,0,.108,.12,.035,'#647260');
  cyl(deskMic,0,.14,0,.018,.021,.23,'#72806a',16);
  cyl(deskMic,0,.365,0,.065,.065,.28,'#aeb59b',24);
  sphere(deskMic,0,.505,0,.065,.059,.065,'#aeb59b');
  cyl(deskMic,0,.24,0,.07,.07,.035,'#6f7c66',24);
  for(let i=0;i<6;i++){const grille=mesh(new THREE.TorusGeometry(.0655,.004,4,24),'#78856f',deskMic,0,.295+i*.032,0);grille.rotation.x=Math.PI/2;}
  line(studio,[[-.05,1.45,.23],[.15,1.45,.13],[.48,1.45,.16],[.61,1.46,.2]],'#7c856f',.008);
  // Headphones hang from a small wall hook beside the recording desk.
  const headphones=group(room,4.03,2.00,-3.22,'studio');headphones.name='Wall-mounted headphones';
  box(headphones,0,.19,-.045,.13,.19,.035,'#cbb594',.016);
  const hook=cyl(headphones,0,.19,.015,.019,.019,.12,'#b8a17f',12);hook.rotation.x=Math.PI/2;
  sphere(headphones,0,.19,.076,.029,.029,.018,'#ceba94');
  mesh(new THREE.TorusGeometry(.19,.025,8,32,Math.PI),'#706b5a',headphones,0,0,.09);
  for(const x of [-.19,.19]){
    box(headphones,x,-.025,.09,.027,.09,.04,'#8fa9ba',.008);
    box(headphones,x,-.11,.09,.09,.18,.12,'#4f677b',.034);
    box(headphones,x*.81,-.11,.09,.038,.145,.095,'#b1b59b',.016);
  }
  // Small rounded studio stool.
  const stool=group(room,2.65,FLOOR,-.81);
  for(const x of [-.22,.22])for(const z of [-.22,.22])cyl(stool,x,.38,z,.03,.045,.72,'#b59d7a',12);
  cyl(stool,0,.8,0,.38,.38,.14,'#a9c6dd');cyl(stool,0,.7,0,.32,.32,.05,'#c0a882');
  contact(room,2.78,-2.23,2.7,1.7,.2);

  // Books, records and small bouquets in narrow-neck ceramic vases.
  for(let i=0;i<4;i++)box(console,-1.21+i*.12,1.14,-.03,.085,.42+i*.025,.35,['#c09683','#7fa3c3','#ddcca7','#9eaaa2'][i],.009);
  function bouquet(parent,x,y,z,size=1){
    const g=group(parent,x,y,z);g.scale.setScalar(size);g.name='Small flower bouquet';
    sphere(g,0,.24,0,.16,.23,.16,'#f2e9d9');
    cyl(g,0,.427,0,.064,.078,.15,'#f2e9d9');cyl(g,0,.506,0,.069,.069,.025,'#e4dbcb');
    const flowers=[[-.17,.88,.02,'#dcbcac'],[.02,1.05,-.07,'#f2ebd9'],[.18,.94,.02,'#e2cdb7'],[-.02,.86,.17,'#f4ead7'],[.07,.92,-.19,'#d3afa3']];
    for(let i=0;i<flowers.length;i++){
      const [fx,fy,fz,color]=flowers[i];line(g,[[0,.43,0],[fx*.55,fy*.76,fz*.55],[fx,fy,fz]],'#86966c',.011);
      const flower=group(g,fx,fy,fz);flower.rotation.set(.22*(i%2?1:-1),i*.9,.18);
      for(let p=0;p<5;p++){const angle=p*Math.PI*2/5;const petal=sphere(flower,Math.cos(angle)*.059,Math.sin(angle)*.059,.012,.051,.048,.027,color);petal.rotation.z=angle;}
      sphere(flower,0,0,.041,.026,.026,.014,'#d4c095');
      if(i<3){const leaf=sphere(g,fx*.45+.045,fy*.65,fz*.45,.08,.025,.035,'#99a57b');leaf.rotation.z=i%2?.48:-.4;}
    }
    return g;
  }
  bouquet(console,1.26,.95,-.05,.55);

  // Keep the original photos id; focus the journal on its projecting shelf.
  const pegboardAlbum=createPegboardAlbum({texture:canvasTexture,onChange:()=>{sceneDirty=true;renderer.shadowMap.needsUpdate=true;}});
  const photoWall=group(room,2.8,2.86,-3.30,'photos');
  photoWall.name='Pegboard photo wall and journal';photoWall.add(pegboardAlbum.group);
  // The map occupies the same window-side wall position in both room views.
  const sharedMap=createChinaMapModel(),map=sharedMap.group,mapPlane=sharedMap.face;
  map.position.set(-4.39,2.82,1.05);map.rotation.y=Math.PI/2;room.add(map);objects.push(map);

  // A little wooden birdhouse; the bird is the tour guide, not a memory entry.
  const bird=group(room,3.65,FLOOR,2.60);bird.rotation.y=-.18;bird.name='Little wooden birdhouse';
  // Wooden pedestal and upright support beneath the house.
  cyl(bird,0,.055,0,.33,.38,.1,'#d9c19b');box(bird,0,.59,0,.075,1.1,.075,'#bea57e',.014);
  const house=group(bird,0,1.13,0);
  box(house,0,.025,0,1.02,.09,.91,'#ddc8a4',.025);
  for(const x of [-.425,.425])box(house,x,.35,0,.06,.65,.75,'#ceb490',.012);
  function houseFront(hasEntrance){const outline=new THREE.Shape();outline.moveTo(-.425,.07);outline.lineTo(.425,.07);outline.lineTo(.425,.68);outline.lineTo(0,.98);outline.lineTo(-.425,.68);outline.closePath();if(hasEntrance){const hole=new THREE.Path();hole.absarc(0,.45,.133,0,Math.PI*2,true);outline.holes.push(hole);}return new THREE.ExtrudeGeometry(outline,{depth:.055,bevelEnabled:true,bevelSegments:2,bevelSize:.008,bevelThickness:.006,curveSegments:48});}
  mesh(houseFront(true),'#dfc9a2',house,0,0,.36);mesh(houseFront(false),'#bca07b',house,0,0,-.415);
  const entranceLip=mesh(new THREE.TorusGeometry(.139,.012,8,48),'#c6aa83',house,0,.45,.423);
  for(const side of [-1,1]){const roof=box(house,side*.238,.829,0,.625,.075,.99,'#a9c6dd',.015);roof.rotation.z=side*-.598;}
  box(house,0,.996,0,.053,.05,1.015,'#7f9fba',.017);
  for(const x of [-.3,-.2,.2,.3])box(house,x,.35,.424,.009,.56,.008,'#ceb592',.002);
  for(const x of [-.447,.447])for(let z=-.27;z<.32;z+=.18)box(house,x,.34,z,.008,.55,.009,'#bea37e',.002);
  const housePerch=cyl(house,0,.23,.535,.028,.031,.245,'#bda478',16);housePerch.rotation.x=Math.PI/2;
  housePerch.name='Original birdhouse perch';
  box(house,0,.1,.49,.31,.045,.22,'#d8bd95',.008);
  const birdCharacter=createBirdCharacter();
  birdCharacter.group.scale.setScalar(.16);
  birdCharacter.group.position.set(0,.251,.646);
  birdCharacter.group.rotation.y=.65;
  house.add(birdCharacter.group);
  contact(room,3.65,2.60,1.4,1.2,.24);

  const roomLife=createRoomLife({bird:birdCharacter.group});
  let tourCue=false;
  const tourPoint=(object,offset)=>()=>room.worldToLocal(object.localToWorld(new THREE.Vector3(...offset)));
  const birdTour=createBirdTourFlight({room,bird:birdCharacter.group,camera,controls,
    invalidate:()=>{sceneDirty=true;renderer.shadowMap.needsUpdate=true;},
    targets:{
      bird:{object:bird,point:tourPoint(house,[-.52,.65,1.0])},
      photos:{object:photoWall,point:tourPoint(photoWall,[-1.02,-.55,1.25])},
      guitar:{object:guitar,point:tourPoint(guitar,[-.55,1.10,1.15])},
      map:{object:map,point:tourPoint(map,[-.55,-.42,1.15])},
      screen:{object:screen,point:tourPoint(screen,[-1.35,-.36,1.15])},
      home:{object:bird}
    }});
  const reducedLife=window.matchMedia('(prefers-reduced-motion: reduce)');
  reducedLife.addEventListener?.('change',()=>{if(reducedLife.matches){if(!birdTour.isActive())roomLife.reset();sceneDirty=true;renderer.shadowMap.needsUpdate=true;}});

  const featureFurniture=[sofa,console,studio,table,guitar,stool,bird,...floorSeats];
  const popUp=createPopUp({scene,room,leftWall:[leftArchitecture,windowGroup,door,map],
    backWall:[backArchitecture,screen,headphones,photoWall],
    furniture:featureFurniture,floor:[floorBase,floorTop],texture:canvasTexture});

  const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();const tap=createTapTracker({distance:6});let hoverId=null;
  function hit(event){camera.updateMatrixWorld();const rect=renderer.domElement.getBoundingClientRect();pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);const hits=raycaster.intersectObjects(room.children,true);for(const h of hits){let obj=h.object;while(obj&&obj!==room){if(obj===birdCharacter.group)return {userData:{objectId:'bird',action:'bird-tour'}};if(obj.userData.objectId)return obj;obj=obj.parent;} // Furniture behind a wall is not clickable.
      if(h.object.material&&h.object.material.transparent!==true)return null;
    }return null;}
  renderer.domElement.addEventListener('pointerdown',e=>{if(interactive)tap.begin(e);});
  renderer.domElement.addEventListener('pointerup',e=>{if(interactive&&tap.end(e)){const obj=hit(e);if(obj){selectObject(obj.userData.objectId);onSelect(obj.userData.objectId,{action:obj.userData.action});}}});
  renderer.domElement.addEventListener('pointercancel',e=>tap.cancel(e));
  renderer.domElement.addEventListener('pointermove',e=>{if(!interactive)return;tap.move(e);if(e.buttons)return;const obj=hit(e);hoverId=obj?.userData.objectId;renderer.domElement.style.cursor=hoverId?'pointer':'grab';});
  renderer.domElement.style.cursor='grab';
  // Keep the selection API used by memory panels, without a floor marker.
  function selectObject(){sceneDirty=true;}
  function fit(){
    const w=container.clientWidth,h=container.clientHeight;if(!w||!h)return;renderer.setSize(w,h);
    if(projection){
      const frame=cinemaViewport(w,h,screenImage.getWorldPosition(new THREE.Vector3()).toArray());camera.aspect=frame.aspect;camera.fov=frame.fov;
      camera.position.fromArray(frame.position);controls.target.fromArray(frame.target);
      camera.setViewOffset(w,h,0,frame.offsetY,w,h);camera.lookAt(controls.target);camera.updateProjectionMatrix();sceneDirty=true;return;
    }
    const aspect=w/h,mobile=window.innerWidth<=700;
    if(featureFocus){camera.aspect=aspect;drawFeatureFocus(featureFocus.progress);return;}
    // During the letter flight, blend toward the final room framing continuously.
    const fullWidth=compactPresentation?window.innerWidth:w,fullHeight=compactPresentation?window.innerHeight:h;
    const normal=roomFrame(fullWidth,fullHeight,{mobile}),compact=roomFrame(w,h,{compact:true});
    if(openingMode){
      const pose=popUpPose(openingProgress),frame=openingFrame(w,h,pose.camera,openingExit,{mobile,spread:Math.max(pose.front,pose.back)});
      baseDistance=frame.distance;camera.fov=frame.fov;camera.aspect=aspect;
      controls.target.set(0,frame.targetY,0);camera.position.fromArray(frame.direction).normalize().multiplyScalar(baseDistance).add(controls.target);
      camera.setViewOffset(w,h,0,-frame.offsetY,w,h);camera.lookAt(controls.target);camera.updateProjectionMatrix();sceneDirty=true;return;
    }
    baseDistance=THREE.MathUtils.lerp(normal.distance,compact.distance,presentationBlend);
    camera.fov=normal.fov;camera.aspect=aspect;
    const offset=normal.offsetY*h/fullHeight*(1-presentationBlend);
    camera.setViewOffset(w,h,0,-offset,w,h);camera.updateProjectionMatrix();
    controls.minDistance=baseDistance/2.4;controls.maxDistance=baseDistance/.7;
    camera.position.sub(controls.target).setLength(baseDistance*(interactive?zoomRatio:1)).add(controls.target);
    camera.lookAt(controls.target);sceneDirty=true;
  }
  fit();window.addEventListener('resize',fit);const sizeObserver=typeof ResizeObserver==='function'?new ResizeObserver(fit):null;sizeObserver?.observe(container);
  async function setPhotos(memories){
    const list=memories.filter(m=>m.photo).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
    await pegboardAlbum.setPhotos(list);
  }
  // Cache shadows while the room is still; refresh every changed bird pose.
  renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;
  function renderMapFocus(){
    if(featureFocus?.id!=='map')return;
    const clear=renderer.autoClear,mask=camera.layers.mask;
    try{renderer.autoClear=false;renderer.clearDepth();camera.layers.set(1);renderer.render(scene,camera);}
    finally{renderer.autoClear=clear;camera.layers.mask=mask;}
  }
  let active=!projection,last=0;
  function render(time){
    requestAnimationFrame(render);if(document.hidden||!active){roomLife.pause();birdTour.pause();return;}if(time-last<(['screen','map','guitar'].includes(featureFocus?.id)?12:28))return;last=time;
    if(!projection&&!openingMode&&!featureFocus)controls.update();
    birdTour.update(time,reducedLife.matches);
    const life=roomLife.update(time,!projection&&!openingMode&&!featureFocus&&interactive&&!reducedLife.matches&&!birdTour.isActive(),!tourCue);
    if(life.changed)sceneDirty=true;if(life.shadow)renderer.shadowMap.needsUpdate=true;
    if(sceneDirty){
      if(!featureFocus?.isolation?.ready)birdCharacter.update(camera);
      if(featureFocus?.isolation?.ready)featureFocus.isolation.render(camera);
      else{renderer.render(scene,camera);}
      sceneDirty=false;
    }
  }
  requestAnimationFrame(render);
  function present(target,compact=false){sizeObserver?.disconnect();container=target;container.append(renderer.domElement);compactPresentation=compact;presentationBlend=compact?1:0;interactive=!compact;controls.enabled=interactive;renderer.domElement.style.pointerEvents=compact?'none':'';renderer.domElement.style.cursor=compact?'pointer':'grab';tap.reset();sizeObserver?.observe(container);fit();}
  function beginOpening(){birdTour.end();tourCue=false;roomLife.reset();openingMode=true;openingProgress=0;openingExit=0;ground.position.y=-.36;ground.material.opacity=0;baseContact.material.opacity=0;popUp.enable(true);popUp.reset();controls.enabled=false;interactive=false;selectObject(null);fit();renderer.shadowMap.needsUpdate=true;}
  function unfold(progress){openingProgress=THREE.MathUtils.clamp(progress,0,1);const pose=popUp.draw(openingProgress);ground.material.opacity=.13*pose.walls;baseContact.material.opacity=.3*pose.walls;fit();renderer.shadowMap.needsUpdate=true;}
  function endOpening(){popUp.enable(false);ground.position.y=-.28;ground.material.opacity=.13;baseContact.material.opacity=.3;openingMode=false;openingExit=0;zoomRatio=1;controls.target.set(0,2.1,0);fit();reset();renderer.shadowMap.needsUpdate=true;}
  function openingAnchor(){camera.updateMatrixWorld(true);const point=popUp.sealPoint().project(camera);return {x:(point.x+1)*container.clientWidth/2,y:(1-point.y)*container.clientHeight/2};}
  function reset(){const damping=controls.enableDamping;controls.enableDamping=false;controls.update();zoomRatio=1;camera.position.set(12,8.9,14).normalize().multiplyScalar(baseDistance).add(controls.target);controls.update();controls.enableDamping=damping;sceneDirty=true;}
  function zoom(delta){const distance=THREE.MathUtils.clamp(camera.position.distanceTo(controls.target)/delta,controls.minDistance,controls.maxDistance);camera.position.sub(controls.target).setLength(distance).add(controls.target);controls.update();sceneDirty=true;}
  function beginFeatureFocus(id){
    birdTour.end();tourCue=false;
    const portal={map:mapPlane,photos:pegboardAlbum.face,screen:screenImage,guitar:guitarPortal}[id];if(!portal||openingMode)return false;
    endFeatureFocus();
    const damping=controls.enableDamping;controls.enableDamping=false;controls.update();controls.enableDamping=damping;
    scene.updateMatrixWorld(true);camera.updateMatrixWorld(true);
    portal.geometry.computeBoundingBox();
    featureFocus={id,portal,localCenter:portal.geometry.boundingBox.getCenter(new THREE.Vector3()),position:camera.position.clone(),up:camera.up.clone(),target:controls.target.clone(),zoomRatio,enabled:controls.enabled,interactive,view:camera.view?{...camera.view}:null,fov:camera.fov,far:camera.far,mapLens:0,progress:0,bounds:null,isolation:null,overlayLayers:[]};
    controls.enabled=false;interactive=false;tap.reset();selectObject(null);if(id==='photos'||id==='guitar'){featureFocus.isolation=createAlbumIsolation(scene,id==='guitar'?guitar:pegboardAlbum.book,renderer);renderer.compile(scene,camera);}drawFeatureFocus(0);return true;
  }
  function drawFeatureFocus(progress){
    if(!featureFocus)return;const focus=featureFocus;
    focus.progress=THREE.MathUtils.clamp(progress,0,1);
    const center=focus.portal.localToWorld(focus.localCenter.clone());
    if(focus.id==='screen'){
      // Match the projection page's lens as well as its eye point. Matching
      // only the picture at another distance makes the rails jump on arrival.
      const w=container.clientWidth,h=container.clientHeight,frame=cinemaViewport(w,h,center.toArray());
      camera.aspect=frame.aspect;
      camera.fov=2*Math.atan(THREE.MathUtils.lerp(Math.tan(focus.fov*Math.PI/360),Math.tan(frame.fov*Math.PI/360),focus.progress))*180/Math.PI;
      camera.position.lerpVectors(focus.position,new THREE.Vector3(...frame.position),focus.progress);
      controls.target.lerpVectors(focus.target,center,focus.progress);
      camera.up.lerpVectors(focus.up,new THREE.Vector3(0,1,0),focus.progress).normalize();
      camera.setViewOffset(w,h,THREE.MathUtils.lerp(focus.view?.offsetX||0,0,focus.progress),THREE.MathUtils.lerp(focus.view?.offsetY||0,frame.offsetY,focus.progress),w,h);
      camera.lookAt(controls.target);camera.updateMatrixWorld(true);sceneDirty=true;return;
    }
    const normal=focus.id==='photos'?new THREE.Vector3().fromBufferAttribute(focus.portal.geometry.attributes.normal,0).transformDirection(focus.portal.matrixWorld):new THREE.Vector3(0,0,1).applyQuaternion(focus.portal.getWorldQuaternion(new THREE.Quaternion()));
    const {width,height}=focus.portal.geometry.parameters;
    const w=container.clientWidth,h=container.clientHeight,original=focus.view,bounds=focus.bounds;
    const scale=focus.portal.getWorldScale(new THREE.Vector3());
    // Finish with a near-orthographic lens so the wood frame also matches depth.
    if(focus.id==='map'&&bounds)camera.fov=THREE.MathUtils.lerp(focus.fov,2,focus.mapLens);
    const matched=matchedSurfaceFrame({surfaceHeight:height*scale.y,fov:camera.fov,width:w,height:h,bounds});
    const distance=matched?.distance??Math.max(width/camera.aspect,height)/(2*Math.tan(camera.fov*Math.PI/360)*.72);
    if(focus.id==='map'&&bounds)camera.far=Math.max(focus.far,distance+20);
    const destination=center.clone().addScaledVector(normal,distance);
    camera.position.lerpVectors(focus.position,destination,focus.progress);
    controls.target.lerpVectors(focus.target,center,focus.progress);
    if(bounds){const up=new THREE.Vector3(0,1,0).applyQuaternion(focus.portal.getWorldQuaternion(new THREE.Quaternion()));camera.up.lerpVectors(focus.up,up,focus.progress).normalize();}
    camera.setViewOffset(w,h,THREE.MathUtils.lerp(original?.offsetX||0,matched?.offsetX??0,focus.progress),THREE.MathUtils.lerp(original?.offsetY||0,matched?.offsetY??0,focus.progress),w,h);
    camera.lookAt(controls.target);camera.updateMatrixWorld(true);sceneDirty=true;
  }
  function mapLensProgress(progress){if(featureFocus?.id==='map'){featureFocus.mapLens=THREE.MathUtils.clamp(progress,0,1);drawFeatureFocus(featureFocus.progress);}}
  function featureFocusBounds(bounds){if(['photos','map','guitar'].includes(featureFocus?.id)&&bounds?.height>0){featureFocus.bounds=bounds;drawFeatureFocus(featureFocus.progress);}}
  function albumFade(progress,book){
    const isolation=featureFocus?.isolation;if(!isolation)return;if(book)isolation.transfer(progress);else isolation.background(progress,camera);sceneDirty=true;
  }
  function endFeatureFocus(){
    if(!featureFocus)return;const focus=featureFocus;featureFocus=null;
    focus.isolation?.dispose();focus.overlayLayers.forEach(({node,mask})=>node.layers.mask=mask);
    camera.far=focus.far;camera.position.copy(focus.position);camera.up.copy(focus.up);controls.target.copy(focus.target);zoomRatio=focus.zoomRatio;
    interactive=focus.interactive;controls.enabled=focus.enabled;
    const damping=controls.enableDamping;controls.enableDamping=false;controls.update();controls.enableDamping=damping;
    fit();sceneDirty=true;
  }
  return {birdTourCue:value=>{tourCue=value;if(value){roomLife.reset();renderer.shadowMap.needsUpdate=true;}sceneDirty=true;},beginBirdTour:()=>{if(projection||openingMode||featureFocus||!interactive||!active||birdTour.isActive())return false;roomLife.reset();return birdTour.begin();},flyBirdTour:birdTour.fly,endBirdTour:()=>{birdTour.end();roomLife.reset();sceneDirty=true;renderer.shadowMap.needsUpdate=true;},birdTourAnchor:birdTour.anchor,
    setPhotos,setAlbumPages:pegboardAlbum.setPages,setProjectionPhoto:projectionPlayer.setPhoto,stopProjection:projectionPlayer.stop,preloadProjection:projectionPlayer.preload,fit,selectObject,present,beginOpening,unfold,endOpening,openingAnchor,beginFeatureFocus,featureFocusProgress:drawFeatureFocus,featureFocusBounds,mapLensProgress,albumIsolationProgress:p=>albumFade(p,false),albumTransferProgress:p=>albumFade(p,true),guitarIsolationProgress:p=>albumFade(p,false),guitarTransferProgress:p=>albumFade(p,true),endFeatureFocus,
    openingTransition:progress=>{openingExit=THREE.MathUtils.clamp(progress,0,1);popUp.exit(openingExit);fit();renderer.shadowMap.needsUpdate=true;},
    presentationProgress:progress=>{presentationBlend=1-THREE.MathUtils.clamp(progress,0,1);fit();},setActive:value=>{active=value;if(value){sceneDirty=true;fit();}else{tap.reset();if(projection)projectionPlayer.stop();}},reset,zoom,debug:()=>({meshes:renderer.info.render.calls,triangles:renderer.info.render.triangles,opening:openingMode,progress:openingProgress,projection:projectionPlayer.getSource()})};
}
