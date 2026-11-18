// When the Python home server is running, all devices share the same
// files under 小屋数据/. Otherwise the old IndexedDB path stays in use.
let homePromise;
let homeMode = false;

export function isHomeMode(){return homeMode;}

export function detectHomeMode(){
  if(homePromise)return homePromise;
  homePromise = fetch('/api/health', {cache:'no-store'})
    .then(async response=>{
      if(!response.ok)return false;
      const data = await response.json().catch(()=>null);
      homeMode = !!(data && data.ok && data.mode === 'home');
      return homeMode;
    })
    .catch(()=>{homeMode=false;return false;});
  return homePromise;
}

async function api(path, options){
  const response = await fetch(path, {cache:'no-store', ...options});
  let data = null;
  try{data = await response.json();}catch{}
  if(!response.ok)throw new Error((data && data.error) || '家庭小屋服务暂时不可用，请确认电脑端已启动。');
  return data;
}

export async function homeList(collection){
  return api(`/api/store/${collection}`);
}

export async function homeGet(collection, id){
  try{
    return await api(`/api/store/${collection}/${encodeURIComponent(id)}`);
  }catch(error){
    if(String(error.message).includes('not found'))return undefined;
    throw error;
  }
}

export async function homePut(collection, record){
  if(!record || typeof record.id !== 'string')throw new Error('记录格式不正确。');
  return api(`/api/store/${collection}/${encodeURIComponent(record.id)}`, {
    method:'PUT',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify(record)
  });
}

export async function homeRemove(collection, id){
  return api(`/api/store/${collection}/${encodeURIComponent(id)}`, {method:'DELETE'});
}

export async function homeUploadDataUrl(dataUrl, kind='photos'){
  const data = await api('/api/media', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({kind, dataUrl})
  });
  if(!data?.url)throw new Error('上传失败，请重试。');
  return data.url;
}

export async function homeUploadFile(file, kind='photos'){
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for(let i=0;i<bytes.length;i+=chunk)binary += String.fromCharCode(...bytes.subarray(i, i+chunk));
  const data = await api('/api/media', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({
      kind,
      filename:file.name||'',
      contentType:file.type||'',
      base64:btoa(binary)
    })
  });
  if(!data?.url)throw new Error('上传失败，请重试。');
  return data.url;
}

export function isMediaRef(value, kind='image'){
  if(typeof value !== 'string' || !value)return false;
  if(value.startsWith('/media/') && value.length < 500)return true;
  if(kind === 'image')return value.length <= 6_000_000 && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(value);
  if(kind === 'audio')return value.length <= 43_000_000 && /^data:audio\/[a-z0-9+-]+;base64,[A-Za-z0-9+/=]+$/.test(value);
  if(kind === 'video')return /^data:video\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=]+$/.test(value);
  return false;
}
