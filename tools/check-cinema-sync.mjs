// Exercise saved playlist changes through the actual app, without browser data.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const source=(await fs.readFile(new URL('../src/cinema-app.js',import.meta.url),'utf8')).replace(/^import .*;\s*$/gm,'').replace('export function createCinemaApp','function createCinemaApp');
class Element{
  constructor(){this.children=[];this.attributes={};this.dataset={};this.style={};this.listeners={};this.hidden=true;this.open=false;this.classList={toggle(){},add(){},remove(){}};}
  append(...nodes){this.children.push(...nodes);}replaceChildren(...nodes){this.children=nodes;}
  setAttribute(name,value){this.attributes[name]=value;}addEventListener(name,fn){this.listeners[name]=fn;}
  focus(){}showModal(){this.open=true;}close(){this.open=false;this.listeners.close?.();}
}
const elements=new Map(),element=id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id);};
const document={getElementById:element,createElement:()=>new Element(),addEventListener(){}};
const samples=Array.from({length:4},(_,i)=>({photos:Array.from({length:3},(_,j)=>({src:`sample-${i}-${j}`}))}));
let stored={id:'cinema-playlist',photos:[],sampleIds:[2,0,1],music:null},covers=[],shown=[],roomPhotos=[],albumPages=[],pendingRoom=null;
const view={setPhoto:async src=>{shown.push(src);return true;},preload(){},setPhotos:async photos=>{roomPhotos=photos;},setAlbumPages:async pages=>{albumPages=pages;},setActive(){},stop(){},fit(){}};
const dependencies={document,window:{addEventListener(){}},createCinemaScene:()=>view,cinemaLoad:async()=>stored,cinemaSave:async value=>stored=value,validCinema:value=>value,CINEMA_PHOTO_LIMIT:60,albumSampleRecords:()=>samples,confirmAction:async()=>true,modalOpen:()=>false,createCinemaSorter:()=>({reset(){}}),swapCinemaPhotos:()=>{},setTimeout:()=>1,clearTimeout(){}};
const create=new Function(...Object.keys(dependencies),source+'\nreturn createCinemaApp;')(...Object.values(dependencies));
const app=create({compressPhoto(){},onOpen(){},onClose(){},onCoverChange:src=>covers.push(src),getRoomPhotos:()=>pendingRoom||Promise.resolve([{photo:'room-memory'}]),getAlbumPages:async()=>[{key:'cover'}]});
await app.ready;assert.equal(covers.at(-1),'sample-3-0','load must honor the saved sample order');
await app.open(false);assert.equal(shown.at(-1),covers.at(-1));assert.equal(element('cinema-count').textContent,'1 / 3');assert.deepEqual(roomPhotos,[{photo:'room-memory'}]);assert.deepEqual(albumPages,[{key:'cover'}]);
await app.close(false);
await app.open(false);assert.equal(element('cinema-count').textContent,'1 / 3','re-entry starts at the first photo');
// Removing the first sample and saving changes both the home cover and playback.
element('cinema-edit').onclick();element('cinema-photo-drafts').children[0].children[0].children[2].onclick();
await element('cinema-form').onsubmit({preventDefault(){}});
assert.deepEqual(stored.sampleIds,[0,1]);assert.equal(covers.at(-1),'sample-0-0');assert.equal(shown.at(-1),covers.at(-1));
// Imported/merged custom photos supersede samples; empty imports clear the cover.
await app.replaceRecord({...stored,photos:[{id:'b',src:'custom-b'},{id:'a',src:'custom-a'}]});
assert.equal(covers.at(-1),'custom-b');assert.equal(shown.at(-1),'custom-b');
await app.close(false);const count=shown.length;
await app.replaceRecord({...stored,photos:[],sampleIds:[]});assert.equal(covers.at(-1),null);assert.equal(shown.length,count);
await app.open(false);assert.equal(shown.at(-1),null);assert.equal(element('cinema-play').disabled,true);assert.equal(element('cinema-count').textContent,'0 / 0');
// A closed, slow entry cannot overwrite a later visit's room contents.
await app.close(false);let resolveRoom;pendingRoom=new Promise(resolve=>resolveRoom=resolve);
const stale=app.open(false);for(let i=0;i<8;i++)await Promise.resolve();await app.close(false);pendingRoom=null;
await app.open(false);resolveRoom([{photo:'stale'}]);await stale;assert.deepEqual(roomPhotos,[{photo:'room-memory'}]);
console.log('PASS: saved sample order, first-photo entry, shared room/book contents, saved removal, imported order, closed-page updates, empty playlists and stale-entry cancellation.');
// The KTV uses the same editor but its own namespace, record, audio and slower cadence.
Element.prototype.pause=function(){this.paused=true;};Element.prototype.load=function(){};Element.prototype.play=function(){this.paused=false;return Promise.resolve();};Element.prototype.removeAttribute=function(name){delete this.attributes[name];};
let ktvStored=null;const ktv=create({compressPhoto:async()=> 'data:image/jpeg;base64,AA==',onOpen(){},onClose(){},namespace:'ktv',pageHash:'#ktv',playlistId:'ktv-playlist',allowSamples:false,musicOnly:true,photoInterval:4500,loadRecord:async()=>ktvStored,saveRecord:async value=>ktvStored=value,validateRecord:value=>value,sceneFactory:()=>view});
await ktv.ready;await ktv.open(false);assert.equal(element('ktv-count').textContent,'0 / 0');assert.equal(element('ktv-play').disabled,true);assert.equal(element('cinema-count').textContent,'0 / 0');
ktv.openEditor();element('ktv-files').files=[{name:'photo.jpg'}];await element('ktv-files').onchange();await element('ktv-form').onsubmit({preventDefault(){}});
assert.equal(ktvStored.id,'ktv-playlist');assert.equal(ktvStored.photos.length,1);assert.deepEqual(ktvStored.sampleIds,[]);assert.equal(stored.id,'cinema-playlist');assert.equal(element('ktv-count').textContent,'1 / 1');assert.equal(element('cinema-count').textContent,'0 / 0');
await ktv.replaceRecord({...ktvStored,photos:[],music:{name:'song.wav',type:'audio/wav',src:'data:audio/wav;base64,AA=='}});assert.equal(element('ktv-play').disabled,false);ktv.togglePlay();assert.equal(element('ktv-play').attributes['aria-pressed'],'true');assert.equal(element('ktv-audio').paused,false);await ktv.close(false);assert.equal(element('ktv-audio').paused,true);
console.log('PASS: independent KTV namespace/storage, empty start, upload/save, no sample injection, music-only playback and audio pause on exit.');
