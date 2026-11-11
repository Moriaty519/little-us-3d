import { memoryTransaction } from './storage.js';

export const ALBUM_TEMPLATES={
  daily:{name:'日常拼接',capacity:3,noteWidth:335,noteSize:19,noteLines:4},
  travel:{name:'旅行图文',capacity:2,noteWidth:345,noteSize:20,noteLines:8},
  anniversary:{name:'纪念日',capacity:2,noteWidth:335,noteSize:23,noteLines:4},
  six:{name:'六张照片',capacity:6,noteWidth:330,noteSize:18,noteLines:1},
  film:{name:'六张照片',capacity:6,noteWidth:330,noteSize:18,noteLines:1},
  letter:{name:'一封短信',capacity:1,noteWidth:340,noteSize:21,noteLines:13},
  large:{name:'一张大图',capacity:1,noteWidth:330,noteSize:22,noteLines:8},
  quad:{name:'四张照片',capacity:4,noteWidth:330,noteSize:20,noteLines:1},
  five:{name:'五张照片',capacity:5,noteWidth:330,noteSize:20,noteLines:1}
};
// Public choices are restricted; older stored layouts remain readable and importable.
export const ALBUM_TEMPLATE_CHOICES=['letter','anniversary','daily','quad','five','six'];
export async function albumLoad(){return await memoryTransaction('readonly',s=>s.getAll(),'albums');}
export async function albumSave(record){await memoryTransaction('readwrite',s=>s.put(record),'albums');}
export async function albumRemove(id){await memoryTransaction('readwrite',s=>s.delete(id),'albums');}
export async function albumSamplesHidden(){return !!(await memoryTransaction('readonly',s=>s.get('album-hide-samples'),'settings'))?.value;}
export async function hideAlbumSamples(value){await memoryTransaction('readwrite',s=>s.put({id:'album-hide-samples',value:!!value}),'settings');}
export function validAlbums(records){
  if(!Array.isArray(records)||records.length>1000)throw new Error('相册最多保存 1000 个故事，尚未导入任何内容。');
  const ids=new Set();
  return records.map(r=>{
    if(!r||typeof r.id!=='string'||!r.id||r.id.length>120||ids.has(r.id)||!Object.hasOwn(ALBUM_TEMPLATES,r.template)||typeof r.title!=='string'||r.title.length>60||typeof r.note!=='string'||r.note.length>4000||typeof r.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(r.date)||!Number.isFinite(Date.parse(r.date))||new Date(r.date).toISOString().slice(0,10)!==r.date||typeof r.createdAt!=='string'||!Number.isFinite(Date.parse(r.createdAt))||typeof r.updatedAt!=='string'||!Number.isFinite(Date.parse(r.updatedAt)))throw new Error('相册故事格式不完整，尚未导入任何内容。');
    if(!Array.isArray(r.photos)||r.photos.length>24)throw new Error('每个相册故事最多 24 张照片。');
    const photos=r.photos.map(p=>{
      if(!p||typeof p.src!=='string'||p.src.length>6_000_000||!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(p.src)||!p.crop||!Number.isFinite(p.crop.x)||p.crop.x<0||p.crop.x>1||!Number.isFinite(p.crop.y)||p.crop.y<0||p.crop.y>1||!Number.isFinite(p.crop.zoom)||p.crop.zoom<1||p.crop.zoom>3)throw new Error('相册照片或裁切参数不正确，尚未导入任何内容。');
      return {src:p.src,crop:{x:p.crop.x,y:p.crop.y,zoom:p.crop.zoom}};
    });ids.add(r.id);
    return {id:r.id,date:r.date,title:r.title,note:r.note,template:r.template,photos,createdAt:r.createdAt,updatedAt:r.updatedAt};
  });
}
