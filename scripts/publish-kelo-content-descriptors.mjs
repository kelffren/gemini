#!/usr/bin/env node
import fs from 'node:fs/promises';
import crypto from 'node:crypto';

const SOURCE='data/kelo-content-starter-catalog.json';
const TARGET='data/kelo-content-descriptors.json';
const CHECK=process.argv.includes('--check');
const raw=await fs.readFile(SOURCE,'utf8');
const sourceDigest=`sha256:${crypto.createHash('sha256').update(Buffer.from(raw,'utf8')).digest('hex')}`;
const catalog=JSON.parse(raw);
if(!Array.isArray(catalog?.assets))throw new Error('KELO_CONTENT_INDEX_INVALID');
const seen=new Set();
const descriptors=catalog.assets.map(row=>{
  const id=String(row?.id||'').trim();
  if(!id||!row.inlineManifest)throw new Error(`KELO_DESCRIPTOR_SOURCE_INVALID:${id||'unknown'}`);
  if(seen.has(id))throw new Error(`KELO_DESCRIPTOR_DUPLICATE_ID:${id}`);
  seen.add(id);
  const bytes=Buffer.from(JSON.stringify(row.inlineManifest),'utf8');
  const digest=`sha256:${crypto.createHash('sha256').update(bytes).digest('hex')}`;
  if(bytes.length<=0||!/^sha256:[0-9a-f]{64}$/.test(digest))throw new Error(`KELO_DESCRIPTOR_INVALID:${id}`);
  return{id,mediaType:'application/json',size:bytes.length,digest};
}).sort((a,b)=>a.id.localeCompare(b.id));
if(descriptors.length!==catalog.assets.length)throw new Error('KELO_DESCRIPTOR_COUNT_MISMATCH');
if(!/^sha256:[0-9a-f]{64}$/.test(sourceDigest))throw new Error('KELO_DESCRIPTOR_SOURCE_DIGEST_INVALID');
const output={schema:'kelo-content-descriptors-v1',algorithm:'sha256',source:SOURCE,sourceDigest,sourceVersion:Number.isSafeInteger(Number(catalog.version))?Number(catalog.version):null,descriptors};
const rendered=JSON.stringify(output,null,2)+'\n';
if(CHECK){
  let published='';
  try{published=await fs.readFile(TARGET,'utf8');}catch(error){if(error?.code==='ENOENT')throw new Error('KELO_DESCRIPTORS_MISSING: run node scripts/publish-kelo-content-descriptors.mjs');throw error;}
  if(published!==rendered)throw new Error('KELO_DESCRIPTORS_DRIFT: regenerate data/kelo-content-descriptors.json');
  console.log(`Verified ${descriptors.length} published descriptors are synchronized with ${sourceDigest}.`);
}else{
  const temporary=`${TARGET}.tmp-${process.pid}`;
  try{
    await fs.writeFile(temporary,rendered,{flag:'wx'});
    await fs.rename(temporary,TARGET);
  }catch(error){
    await fs.rm(temporary,{force:true}).catch(()=>{});
    throw error;
  }
  console.log(`Published ${descriptors.length} descriptors -> ${TARGET} (${sourceDigest})`);
}
