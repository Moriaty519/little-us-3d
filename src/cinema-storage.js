import { memoryTransaction } from './storage.js';

export const CINEMA_PHOTO_LIMIT=60;
const CINEMA_AUDIO_TYPES=['audio/mpeg','audio/mp4','audio/x-m4a','audio/wav','audio/x-wav','audio/ogg'];
export function validCinema(record){
  if(record===null)return null;
  if(!record||record.id!=='cinema-playlist'||typeof record.updatedAt!=='string'||!Number.isFinite(Date.parse(record.updatedAt))||!Array.isArray(record.photos)||record.photos.length>CINEMA_PHOTO_LIMIT||!Array.isArray(record.sampleIds)||record.sampleIds.length>6||record.sampleIds.some(i=>!Number.isInteger(i)||i<0||i>5)||new Set(record.sampleIds).size!==record.sampleIds.length)throw new Error('放映清单格式不正确，尚未导入任何内容。');
  const ids=new Set();let bytes=0;
  const photos=record.photos.map(p=>{
    if(!p||typeof p.id!=='string'||!p.id||p.id.length>120||ids.has(p.id)||typeof p.src!=='string'||p.src.length>6_000_000||!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(p.src))throw new Error('影院照片格式不正确。');
    ids.add(p.id);bytes+=p.src.length;return {id:p.id,src:p.src};
  });
  let music=null;
  if(record.music!==null){const m=record.music;if(!m||typeof m.name!=='string'||!m.name||m.name.length>180||!CINEMA_AUDIO_TYPES.includes(m.type)||typeof m.src!=='string'||m.src.length>43_000_000||!m.src.startsWith('data:'+m.type+';base64,')||!/^data:audio\/[a-z0-9-]+;base64,[A-Za-z0-9+/=]+$/.test(m.src))throw new Error('影院音乐格式不正确。');music={name:m.name,type:m.type,src:m.src};bytes+=m.src.length;}
  if(bytes>140*1024*1024)throw new Error('放映清单过大，请减少照片或音乐文件大小。');
  return {id:'cinema-playlist',photos,music,sampleIds:[...record.sampleIds],updatedAt:record.updatedAt};
}
export async function cinemaLoad(){const record=await memoryTransaction('readonly',s=>s.get('cinema-playlist'),'settings');return record?validCinema(record):null;}
export async function cinemaSave(record){await memoryTransaction('readwrite',s=>s.put(validCinema(record)),'settings');}
export function mergeCinema(current,incoming){if(!incoming)return current;if(!current||Date.parse(incoming.updatedAt)>Date.parse(current.updatedAt))return incoming;return current;}
