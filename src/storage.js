// IndexedDB keeps compressed photographs out of localStorage's small quota.
let dbPromise;
export function memoryDatabase() {
  if (!dbPromise) dbPromise = new Promise((resolve,reject)=>{
    const request=indexedDB.open('little-us-memories-v1',3);let failed=false;
    request.onupgradeneeded=()=>{for(const name of ['memories','journeys','albums','settings'])if(!request.result.objectStoreNames.contains(name))request.result.createObjectStore(name,{keyPath:'id'});};
    request.onsuccess=()=>{if(failed){request.result.close();return;}request.result.onversionchange=()=>{request.result.close();dbPromise=null;};resolve(request.result);};
    request.onerror=()=>{failed=true;reject(request.error);};
    request.onblocked=()=>{failed=true;reject(new Error('请关闭其他小屋窗口，再刷新页面。'));};
  });
  return dbPromise;
}
export async function memoryTransaction(mode, operation, storeName='memories') {
  const db=await memoryDatabase();
  return new Promise((resolve,reject)=>{
    const transaction=db.transaction(storeName,mode),store=transaction.objectStore(storeName);
    let result; const request=operation(store);
    if(request)request.onsuccess=()=>{result=request.result;};
    transaction.oncomplete=()=>resolve(result);
    transaction.onerror=()=>reject(transaction.error);
    transaction.onabort=()=>reject(transaction.error||new Error('保存中断，请重试。'));
  });
}
export async function memoryLoad(){return await memoryTransaction('readonly',store=>store.getAll());}
export async function memorySave(record){await memoryTransaction('readwrite',store=>store.put(record));}
export async function memoryRemove(id){await memoryTransaction('readwrite',store=>store.delete(id));}
export async function memorySaveBatch(records){await memoryTransaction('readwrite',store=>{for(const record of records)store.put(record);});}
export function validBackup(data){
  if(data?.format!=='little-us-backup'||data.version!==1||!Array.isArray(data.memories)||data.memories.length>1000)throw new Error('这不是有效的小屋备份文件。');
  const ids=new Set();
  const objectIds=['guitar','studio','screen','bird','photos','sofa'];
  const records=data.memories.map(m=>{
    if(!m||typeof m.id!=='string'||!m.id||m.id.length>120||ids.has(m.id)||typeof m.title!=='string'||!m.title.trim()||m.title.length>60||typeof m.note!=='string'||m.note.length>2000||!objectIds.includes(m.objectId)||typeof m.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(m.date)||!Number.isFinite(Date.parse(m.date))||new Date(m.date).toISOString().slice(0,10)!==m.date||typeof m.createdAt!=='string'||!Number.isFinite(Date.parse(m.createdAt))||typeof m.updatedAt!=='string'||!Number.isFinite(Date.parse(m.updatedAt)))throw new Error('备份内容不完整，尚未导入任何回忆。');
    if(m.photo!==null&&(typeof m.photo!=='string'||m.photo.length>6_000_000||!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(m.photo)))throw new Error('备份中的照片格式不正确。');
    ids.add(m.id);return {id:m.id,title:m.title,note:m.note,objectId:m.objectId,date:m.date,photo:m.photo,createdAt:m.createdAt,updatedAt:m.updatedAt};
  });
  return records;
}
