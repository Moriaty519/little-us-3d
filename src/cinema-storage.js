import { detectHomeMode, homeGet, homePut, isHomeMode, isMediaRef, memoryTransaction } from './storage.js';

export const CINEMA_PHOTO_LIMIT=60;
const CINEMA_AUDIO_TYPES=['audio/mpeg','audio/mp4','audio/x-m4a','audio/wav','audio/x-wav','audio/ogg'];
export function validCinema(record){
  if(record===null)return null;
  if(!record||record.id!=='cinema-playlist'||typeof record.updatedAt!=='string'||!Number.isFinite(Date.parse(record.updatedAt))||!Array.isArray(record.photos)||record.photos.length>CINEMA_PHOTO_LIMIT||!Array.isArray(record.sampleIds)||record.sampleIds.length>6||record.sampleIds.some(i=>!Number.isInteger(i)||i<0||i>5)||new Set(record.sampleIds).size!==record.sampleIds.length)throw new Error('放映清单格式不正确，尚未导入任何内容。');
  const ids=new Set();let bytes=0;
  const photos=record.photos.map(p=>{
    if(!p||typeof p.id!=='string'||!p.id||p.id.length>120||ids.has(p.id)||!isMediaRef(p.src,'image'))throw new Error('影院照片格式不正确。');
    ids.add(p.id);bytes+=p.src.startsWith('/media/')?0:p.src.length;return {id:p.id,src:p.src};
  });
  let music=null;
  if(record.music!==null){
    const m=record.music;
    const okHome=m&&typeof m.name==='string'&&m.name&&m.name.length<=180&&CINEMA_AUDIO_TYPES.includes(m.type)&&isMediaRef(m.src,'audio');
    const okLegacy=okHome&&(m.src.startsWith('/media/')||(m.src.startsWith('data:'+m.type+';base64,')&&m.src.length<=43_000_000));
    if(!okLegacy)throw new Error('影院音乐格式不正确。');
    music={name:m.name,type:m.type,src:m.src};bytes+=m.src.startsWith('/media/')?0:m.src.length;
  }
  if(bytes>140*1024*1024)throw new Error('放映清单过大，请减少照片或音乐文件大小。');
  return {id:'cinema-playlist',photos,music,sampleIds:[...record.sampleIds],updatedAt:record.updatedAt};
}
export async function cinemaLoad(){await detectHomeMode();const record=isHomeMode()?await homeGet('settings','cinema-playlist'):await memoryTransaction('readonly',s=>s.get('cinema-playlist'),'settings');return record?validCinema(record):null;}
export async function cinemaSave(record){await detectHomeMode();const value=validCinema(record);if(isHomeMode()){await homePut('settings',value);return;}await memoryTransaction('readwrite',s=>s.put(value),'settings');}
export function mergeCinema(current,incoming){if(!incoming)return current;if(!current||Date.parse(incoming.updatedAt)>Date.parse(current.updatedAt))return incoming;return current;}
