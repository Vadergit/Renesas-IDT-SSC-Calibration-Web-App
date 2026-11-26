import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('all literal app and hardware DOM references exist, including event registrations',()=>{
 const html=read('index.html'),ids=new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]));
 const missing=[];
 for(const file of ['app.mjs','hardware-ui.mjs','native-wizard.mjs']){
  for(const m of read(file).matchAll(/(?:\$\(\s*['"]([^'"]+)['"]\s*\)|\bon\(\s*['"]([^'"]+)['"]\s*,)/g)){const id=m[1]||m[2];if(!ids.has(id))missing.push(file+': '+id)}
 }
 assert.deepEqual([...new Set(missing)],[]);
});
