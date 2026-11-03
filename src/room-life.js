// The bird's quiet hopping uses an active-view clock; hidden tabs never catch up.
const lifeClamp=value=>Math.max(0,Math.min(1,value));
const lifeEase=value=>{const p=lifeClamp(value);return p*p*p*(p*(p*6-15)+10);};
const lifeRange=(value,start,end)=>lifeEase((value-start)/(end-start));

export function roomBirdPose(seconds){
  const t=((seconds%28)+28)%28,perch=.251,roof=1.047;
  let y=perch,z=.646,tilt=0,squash=0,moving=false;
  if(t>=4.8&&t<6){
    const p=(t-4.8)/1.2;
    y=perch+(roof-perch)*lifeEase(p)+.52*Math.sin(Math.PI*p);
    // Clear the front of the roof before moving back onto its ridge.
    z=.646+.23*lifeRange(p,0,.18)+(.22-.876)*lifeRange(p,.46,.88);
    tilt=-.045*Math.sin(Math.PI*p);moving=true;
  }else if(t>=6&&t<10.8){y=roof;z=.22;}
  else if(t>=10.8&&t<11.85){
    const p=(t-10.8)/1.05;
    y=roof+(perch-roof)*lifeEase(p)+.30*Math.sin(Math.PI*p);
    // Move beyond the roof edge before dropping to the original perch.
    z=.22+(.876-.22)*lifeRange(p,0,.42)+(.646-.876)*lifeRange(p,.84,1);
    tilt=.035*Math.sin(Math.PI*p);moving=true;
  }
  for(const landing of [6,11.85])if(t>=landing&&t<landing+.42){
    squash=Math.sin(Math.PI*(t-landing)/.42)*.065;moving=true;
  }
  return {position:[0,y,z],rotation:[0,.65,tilt],scale:[.16*(1+squash*.5),.16*(1-squash),.16*(1+squash*.5)],moving};
}

export function createRoomLife({bird}){
  const rest={position:bird.position.clone(),rotation:bird.rotation.clone(),scale:bird.scale.clone()};
  let seconds=0,last=null;
  const differs=(values,target)=>values.some((value,i)=>Math.abs(value-target.getComponent(i))>1e-12);
  function reset(){
    seconds=0;last=null;
    bird.position.copy(rest.position);bird.rotation.copy(rest.rotation);bird.scale.copy(rest.scale);
  }
  function update(now,enabled,birdEnabled=true){
    if(!enabled||!birdEnabled){last=null;return {changed:false,shadow:false};}
    if(last===null){last=now;return {changed:false,shadow:false};}
    const delta=Math.min(.08,Math.max(0,(now-last)/1000));seconds+=delta;last=now;
    const pose=roomBirdPose(seconds);
    const changed=differs(pose.position,bird.position)||differs(pose.scale,bird.scale)
      ||pose.rotation.some((value,i)=>Math.abs(value-[bird.rotation.x,bird.rotation.y,bird.rotation.z][i])>1e-12);
    if(changed){bird.position.fromArray(pose.position);bird.rotation.set(...pose.rotation);bird.scale.fromArray(pose.scale);}
    // A changed pose and its shadow must be rendered together, including landing.
    return {changed,shadow:changed};
  }
  return {update,reset,pause:()=>{last=null;}};
}
