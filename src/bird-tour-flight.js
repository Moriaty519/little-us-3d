import * as THREE from 'three';

// The tour temporarily takes ownership of the existing bird, then returns it
// to the exact house-local pose. Its clock advances only on visible frames.
export function createBirdTourFlight({room,bird,camera,controls,targets,invalidate}){
  let rest=null,flight=null,last=null;
  const ease=p=>p*p*(3-2*p);
  function begin(){
    if(rest)return false;
    const damping=controls.enableDamping;controls.enableDamping=false;controls.update();controls.enableDamping=damping;
    rest={parent:bird.parent,position:bird.position.clone(),quaternion:bird.quaternion.clone(),scale:bird.scale.clone(),enabled:controls.enabled};
    room.updateWorldMatrix(true,true);room.attach(bird);controls.enabled=false;last=null;
    invalidate();return true;
  }
  function fly(id,arrive){
    if(!rest||flight||!targets[id])return false;
    room.updateWorldMatrix(true,true);
    if(bird.parent!==room)room.attach(bird);
    const to=id==='home'?room.worldToLocal(rest.parent.localToWorld(rest.position.clone())):targets[id].point();
    const from=bird.position.clone(),middle=from.clone().lerp(to,.5);
    middle.y=Math.max(from.y,to.y)+Math.min(1.6,.65+from.distanceTo(to)*.16);
    // Stay in front of the recording desk when crossing the back wall.
    middle.z=Math.max(middle.z,-1.25);
    flight={id,from,to,middle,fromRotation:bird.quaternion.clone(),fromScale:bird.scale.clone(),toScale:rest.scale.clone().multiplyScalar(id==='home'?1:1.3),elapsed:0,duration:Math.min(2300,1050+from.distanceTo(to)*130),arrive};
    last=null;invalidate();return true;
  }
  function update(time,reduced=false){
    if(!flight){last=null;return false;}
    const f=flight;
    if(last!==null)f.elapsed+=Math.min(80,Math.max(0,time-last));last=time;
    const p=reduced?1:Math.min(1,f.elapsed/f.duration),s=ease(p);
    bird.position.copy(f.from).multiplyScalar((1-s)*(1-s)).addScaledVector(f.middle,2*s*(1-s)).addScaledVector(f.to,s*s);
    const tangent=f.middle.clone().sub(f.from).multiplyScalar(1-s).addScaledVector(f.to.clone().sub(f.middle),s);
    const yaw=Math.atan2(tangent.x,tangent.z),pitch=THREE.MathUtils.clamp(-Math.atan2(tangent.y,Math.hypot(tangent.x,tangent.z)),-.35,.35);
    const flyingRotation=new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch,yaw,0,'YXZ'));
    bird.quaternion.slerpQuaternions(f.fromRotation,flyingRotation,ease(Math.min(1,f.elapsed/160)));
    if(p<1&&!reduced){
      const flap=Math.sin(p*Math.PI*14)*Math.sin(Math.PI*p);
      bird.rotateZ(flap*.06);
    }
    bird.scale.lerpVectors(f.fromScale,f.toScale,s);
    // Turn to greet the viewer after arriving, without drifting sideways.
    const turn=reduced?1:THREE.MathUtils.clamp((f.elapsed-f.duration)/320,0,1);
    if(p===1){
      const viewer=room.worldToLocal(camera.getWorldPosition(new THREE.Vector3()));
      const facing=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),Math.atan2(viewer.x-f.to.x,viewer.z-f.to.z));
      bird.quaternion.slerpQuaternions(flyingRotation,facing,ease(turn));
      if(turn===1){
        if(f.id==='home')rest.parent.attach(bird);
        flight=null;last=null;f.arrive?.();
      }
    }
    invalidate();return true;
  }
  function end(){
    if(!rest)return;
    const saved=rest;rest=null;flight=null;last=null;
    saved.parent.add(bird);bird.position.copy(saved.position);bird.quaternion.copy(saved.quaternion);bird.scale.copy(saved.scale);
    controls.enabled=saved.enabled;invalidate();
  }
  function project(point,width,height){
    const p=point.project(camera);return {x:(p.x+1)*width/2,y:(1-p.y)*height/2,visible:p.z>-1&&p.z<1};
  }
  function anchor(id,width,height){
    room.updateWorldMatrix(true,true);camera.updateMatrixWorld(true);
    const point=bird.localToWorld(new THREE.Vector3(0,1.55,0));
    const result={bird:project(point,width,height)};
    const target=targets[id]?.object;
    if(target){
      const bounds=new THREE.Box3().setFromObject(target),points=[];
      for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z])points.push(project(new THREE.Vector3(x,y,z),width,height));
      result.target={left:Math.min(...points.map(p=>p.x)),top:Math.min(...points.map(p=>p.y)),right:Math.max(...points.map(p=>p.x)),bottom:Math.max(...points.map(p=>p.y))};
    }
    return result;
  }
  return {begin,fly,update,end,anchor,pause:()=>{last=null;},isActive:()=>!!rest,isFlying:()=>!!flight};
}
