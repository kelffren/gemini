#!/usr/bin/env node
import fs from 'node:fs/promises';
import crypto from 'node:crypto';

const SOURCE='data/kelo-content-starter-catalog.json';
const TARGET='data/kelo-content-descriptors.json';
const raw=await fs.readFile(SOURCE,'utf8');
const catalog=JSON.parse(raw);
if(!Array.isArray(catalog?.assets))throw new Error('KELO_CONTENT_INDEX_INVALID');
const descriptors=catalog.assets.map(row=>{
  if(!row?.id||!row.inlineManifest)throw new Error(`KELO_DESCRIPTOR_SOURCE_INVALID:${row?.id||'unknown'}`);
  const bytes=Buffer.from(JSON.stringify(row.inlineManifest),'utf8');
  return{id:String(row.id),mediaType:'application/json',size:bytes.length,digest:`sha256:${crypto.createHash('sha256').update(bytes).digest('hex')}`};
}).sort((a,b)=>a.id.localeCompare(b.id));
const output={schema:'kelo-content-descriptors-v1',algorithm:'sha256',source:SOURCE,descriptors};
await fs.writeFile(TARGET,JSON.stringify(output,null,2)+'\n');
console.log(`Published ${descriptors.length} descriptors -> ${TARGET}`);
