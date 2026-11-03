import { validKtv } from './ktv-storage.js';
import { memoryDatabase, memoryTransaction, validBackup } from './storage.js';
import { validAlbums } from './album-storage.js';
import { CHINA_CITIES } from './cities.js';
import { validCinema } from './cinema-storage.js';

export const CITY_BY_ID=new Map(CHINA_CITIES.map(city=>[city.id,city]));
export function cityName(city){return city.name.replace(/(?:白族|傣族|傈僳族|藏族|哈尼族|彝族|壮族|苗族|侗族|布依族|羌族|土家族|朝鲜族|景颇族|哈萨克|回族|蒙古族|蒙古|柯尔克孜|撒拉族|土族)+自治州$/,'').replace(/(?:市|特别行政区)$/,'');}
export function findCities(query){
  const q=query.trim().replace(/\s+/g,'').toLowerCase();
  if(!q)return [];
  return CHINA_CITIES.filter(c=>(c.province+c.name).includes(q)||c.name.includes(q))
    .sort((a,b)=>(cityName(a)===q?-1:0)-(cityName(b)===q?-1:0)||a.name.localeCompare(b.name,'zh-CN')).slice(0,30);
}
export async function journeyLoad(){return await memoryTransaction('readonly',s=>s.getAll(),'journeys');}
export async function journeySave(record){await memoryTransaction('readwrite',s=>s.put(record),'journeys');}
export async function journeyRemove(id){await memoryTransaction('readwrite',s=>s.delete(id),'journeys');}
export function validJourneys(records){
  if(!Array.isArray(records))throw new Error('足迹备份格式不正确。');
  if(records.length>2000)throw new Error('足迹最多保存 2000 段，尚未导入任何记录。');
  const ids=new Set();
  return records.map(r=>{
    if(!r||typeof r.id!=='string'||!r.id||r.id.length>120||ids.has(r.id)||!CITY_BY_ID.has(r.cityId)||typeof r.title!=='string'||r.title.length>60||typeof r.note!=='string'||r.note.length>4000||typeof r.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(r.date)||!Number.isFinite(Date.parse(r.date))||new Date(r.date).toISOString().slice(0,10)!==r.date||typeof r.createdAt!=='string'||!Number.isFinite(Date.parse(r.createdAt))||typeof r.updatedAt!=='string'||!Number.isFinite(Date.parse(r.updatedAt)))throw new Error('足迹内容不完整，尚未导入任何记录。');
    if(!Array.isArray(r.photos)||r.photos.length>12||r.photos.some(p=>typeof p!=='string'||p.length>6_000_000||!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(p)))throw new Error('足迹照片格式不正确，每段记录最多 12 张。');
    ids.add(r.id);
    return {id:r.id,cityId:r.cityId,title:r.title,date:r.date,note:r.note,photos:[...r.photos],createdAt:r.createdAt,updatedAt:r.updatedAt};
  });
}
export function validFullBackup(data){
  if(data?.format!=='little-us-backup'||![1,2,3,4,5,6].includes(data.version))throw new Error('这不是有效的小屋备份文件。');
  const memories=validBackup({...data,version:1});
  const journeys=data.version===1?[]:validJourneys(data.journeys);
  const albums=data.version<3?[]:validAlbums(data.albums);
  return {memories,journeys,albums,...(data.version>=4?{cinema:validCinema(data.cinema)}:{}),...(data.version>=5?{ktv:validKtv(data.ktv)}:{})};
}
export function mergeRecords(existing,incoming){
  const merged=new Map(existing.map(r=>[r.id,r]));
  for(const r of incoming){const old=merged.get(r.id);if(!old||Date.parse(r.updatedAt)>Date.parse(old.updatedAt))merged.set(r.id,r);}
  return [...merged.values()];
}
export async function saveFullBackup(memories,journeys,albums=[],cinema=undefined,ktv=undefined){
  validBackup({format:'little-us-backup',version:1,memories});
  validJourneys(journeys);
  validAlbums(albums);
  if(cinema!==undefined)validCinema(cinema);
  if(ktv!==undefined)validKtv(ktv);
  const db=await memoryDatabase();
  await new Promise((resolve,reject)=>{
    const tx=db.transaction(['memories','journeys','albums',...((cinema||ktv)?['settings']:[])],'readwrite');
    for(const r of memories)tx.objectStore('memories').put(r);
    for(const r of journeys)tx.objectStore('journeys').put(r);
    for(const r of albums)tx.objectStore('albums').put(r);
    if(cinema)tx.objectStore('settings').put(cinema);
    if(ktv)tx.objectStore('settings').put(ktv);
    tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('导入中断，请重试。'));
  });
}
