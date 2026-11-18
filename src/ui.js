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

function pad2(value){return String(value).padStart(2,'0');}
function daysInMonth(year,month){return new Date(year,month,0).getDate();}
function todayParts(){
  const now=new Date();
  return {year:now.getFullYear(),month:now.getMonth()+1,day:now.getDate()};
}
function parseDateValue(value){
  const match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value||''));
  if(!match)return null;
  const year=+match[1],month=+match[2],day=+match[3];
  if(month<1||month>12||day<1||day>daysInMonth(year,month))return null;
  return {year,month,day};
}

/** Replace a native date input with year/month/day selects; keep the same element id/.value API. */
export function installDateSelect(inputOrId,{startYear=2000,endYear=null}={}){
  const input=typeof inputOrId==='string'?document.getElementById(inputOrId):inputOrId;
  if(!input||input.dataset.dateSelect==='1')return input;
  const maxYear=endYear||todayParts().year+1;
  input.dataset.dateSelect='1';
  input.type='hidden';
  input.removeAttribute('required');
  const wrap=document.createElement('div');
  wrap.className='date-parts';
  wrap.setAttribute('role','group');
  wrap.setAttribute('aria-label',input.getAttribute('aria-label')||'日期');
  const year=document.createElement('select');year.className='date-year';year.setAttribute('aria-label','年');
  const month=document.createElement('select');month.className='date-month';month.setAttribute('aria-label','月');
  const day=document.createElement('select');day.className='date-day';day.setAttribute('aria-label','日');
  for(let y=maxYear;y>=startYear;y--){const option=document.createElement('option');option.value=String(y);option.textContent=y+' 年';year.append(option);}
  for(let m=1;m<=12;m++){const option=document.createElement('option');option.value=pad2(m);option.textContent=m+' 月';month.append(option);}
  input.parentNode.insertBefore(wrap,input);
  wrap.append(year,month,day,input);

  const native=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value');
  function fillDays(keepDay){
    const y=+year.value,m=+month.value,count=daysInMonth(y,m);
    const previous=keepDay!=null?keepDay:+day.value||1;
    day.replaceChildren();
    for(let d=1;d<=count;d++){const option=document.createElement('option');option.value=pad2(d);option.textContent=d+' 日';day.append(option);}
    day.value=pad2(Math.min(previous,count));
  }
  function writeHidden(){
    fillDays(+day.value||1);
    native.set.call(input,`${year.value}-${month.value}-${day.value}`);
    input.dispatchEvent(new Event('input',{bubbles:true}));
    input.dispatchEvent(new Event('change',{bubbles:true}));
  }
  function readHidden(value){
    const parts=parseDateValue(value)||todayParts();
    if(+parts.year<startYear||+parts.year>maxYear){
      const option=document.createElement('option');option.value=String(parts.year);option.textContent=parts.year+' 年';
      if(+parts.year>maxYear)year.prepend(option);else year.append(option);
    }
    year.value=String(parts.year);
    month.value=pad2(parts.month);
    fillDays(parts.day);
    native.set.call(input,`${year.value}-${month.value}-${day.value}`);
  }
  Object.defineProperty(input,'value',{
    configurable:true,
    enumerable:true,
    get(){return native.get.call(this);},
    set(next){readHidden(next);}
  });
  input.focus=()=>year.focus();
  year.addEventListener('change',writeHidden);
  month.addEventListener('change',writeHidden);
  day.addEventListener('change',writeHidden);
  readHidden(native.get.call(input)||'');
  return input;
}
export function installDateSelects(ids=['memory-date','album-date']){
  for(const id of ids)installDateSelect(id);
}
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
