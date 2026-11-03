let actionPending=null;
export function confirmAction(title,note,accept='放弃修改',cancel='继续编辑'){
  if(actionPending)return Promise.resolve(false);
  const dialog=document.getElementById('action-confirm');
  document.getElementById('action-confirm-title').textContent=title;
  document.getElementById('action-confirm-note').textContent=note;
  document.getElementById('action-confirm-accept').textContent=accept;
  document.getElementById('action-confirm-cancel').textContent=cancel;
  dialog.returnValue='cancel';
  actionPending=new Promise(resolve=>dialog.addEventListener('close',()=>{actionPending=null;resolve(dialog.returnValue==='accept');},{once:true}));
  dialog.showModal();return actionPending;
}
export function modalOpen(){return !!document.querySelector('dialog[open]');}
export function createTapTracker({distance=7,delay=650}={}){
  let down=null;const pointers=new Set();
  return {
    begin(event){pointers.add(event.pointerId);if(pointers.size>1){if(down)down.moved=true;return;}down=event.button===0?{id:event.pointerId,x:event.clientX,y:event.clientY,time:event.timeStamp,moved:false}:null;},
    move(event){if(down?.id===event.pointerId&&Math.hypot(event.clientX-down.x,event.clientY-down.y)>=distance)down.moved=true;},
    end(event){pointers.delete(event.pointerId);if(down?.id!==event.pointerId)return false;const start=down;down=null;return !start.moved&&Math.hypot(event.clientX-start.x,event.clientY-start.y)<distance&&event.timeStamp-start.time<delay;},
    cancel(event){pointers.delete(event.pointerId);down=null;},
    reset(){pointers.clear();down=null;}
  };
}
