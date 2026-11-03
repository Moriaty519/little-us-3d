// Focused validation of imported data; no browser or third-party packages needed.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const source=await fs.readFile(new URL('../src/storage.js',import.meta.url),'utf8');
const {validBackup}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const record={id:'qa-memory',title:'一首歌',note:'一起唱',objectId:'guitar',date:'2026-10-31',photo:null,createdAt:'2026-10-31T03:00:00.000Z',updatedAt:'2026-10-31T03:00:00.000Z'};
const backup=records=>({format:'little-us-backup',version:1,memories:records});
assert.deepEqual(validBackup(backup([record])),[record]);
assert.throws(()=>validBackup(backup([{...record,date:'2026-02-30'}])));
assert.throws(()=>validBackup(backup([{...record,photo:'data:image/svg+xml;base64,PHN2Zz4='}])));
assert.throws(()=>validBackup(backup([{...record,objectId:'unknown'}])));
assert.throws(()=>validBackup(backup([{...record,title:'   '}])));
assert.throws(()=>validBackup(backup([record,record])));
assert.throws(()=>validBackup(backup([{...record,id:''}])));
assert.throws(()=>validBackup(backup([{...record,date:['2026-10-31']}])));
assert.throws(()=>validBackup({format:'little-us-backup',version:2,memories:[]}));
console.log('PASS: valid backup, calendar dates, photo types, object types, required title, duplicate ids, backup version.');
