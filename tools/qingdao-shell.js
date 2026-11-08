  const stage=document.getElementById('qingdao-stage');
  const errorBox=document.getElementById('qingdao-error');
  try{
    const island=createQingdaoIsland(stage);
    window.__qingdaoIsland=island;
    document.getElementById('qingdao-replay').addEventListener('click',()=>island.enter());
    island.enter();
  }catch(error){
    console.error('Qingdao standalone failed',error);
    if(errorBox)errorBox.hidden=false;
  }
