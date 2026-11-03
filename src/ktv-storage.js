import { memoryTransaction } from './storage.js';

const VIDEO_TYPE=/^video\/[a-z0-9.+-]+$/;
const VIDEO_DATA=/^data:video\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=]+$/;

// The KTV keeps exactly one local video. The data URL lives in the existing
// settings record so the unified JSON backup still carries it.
export function validKtv(record){
  if(record===null)return null;
  if(!record||record.id!=='ktv-playlist'||typeof record.updatedAt!=='string'||!Number.isFinite(Date.parse(record.updatedAt)))throw new Error('KTV 内容格式不正确。');
  let video=null;
  if(record.video!==undefined&&record.video!==null){
    const item=record.video,type=String(item.type||'');
    if(typeof item.name!=='string'||!item.name.trim()||item.name.length>180||!VIDEO_TYPE.test(type))throw new Error('KTV 视频格式不正确。');
    if(typeof item.src!=='string'||!item.src.startsWith('data:'+type+';base64,')||!VIDEO_DATA.test(item.src))throw new Error('KTV 视频内容不完整。');
    video={name:item.name.trim().slice(0,180),type,src:item.src};
    if(Number.isFinite(item.size)&&item.size>0)video.size=item.size;
    if(Number.isFinite(item.duration)&&item.duration>0)video.duration=item.duration;
  }else if(record.video===undefined){
    // Version 5/6 records held photos and music. They are accepted so an older
    // backup still imports, but the room now shows an empty video screen.
    if(!Array.isArray(record.photos)&&!Array.isArray(record.tracks)&&!('music' in record))throw new Error('KTV 内容格式不完整。');
  }
  return {id:'ktv-playlist',video,updatedAt:record.updatedAt};
}
export async function ktvLoad(){const record=await memoryTransaction('readonly',s=>s.get('ktv-playlist'),'settings');return record?validKtv(record):null;}
export async function ktvSave(record){await memoryTransaction('readwrite',s=>s.put(validKtv(record)),'settings');}
