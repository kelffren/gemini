/* KELO-INDEX
 * area: CREATORS / UNIVERSAL CONTENT PACKS
 * owner: Kelo Universal Content Bridge
 * keys: PACK INSTALL UPDATE REMOVE SHA256 LOCK DEPENDENCY LAZY MOBILE
 * purpose: Install groups of vault content on explicit request without adding pack binaries to normal game boot.
 */
import {searchExternalAssets} from './external-asset-providers.mjs';
import {downloadAsset,integrateContent,getAsset,getBlob,removeLocal} from './personal-asset-vault.mjs';

const CATALOG_URL='../../../data/content-pack-catalog.json?v=1';
const DB_NAME='kelo_content_pack_v1',DB_VERSION=1,STORE='packs';
const MAX_MEMBERS=64;
let catalogPromise=null,dbPromise=null;
const copy=v=>v==null?v:JSON.parse(JSON.stringify(v));
const clean=v=>String(v??'').trim();
const now=()=>new Date().toISOString();
const tick=()=>new Promise(resolve=>(globalThis.setTimeout||setTimeout)(resolve,0));

function canonical(value){
  if(Array.isArray(value))return value.map(canonical);
  if(value&&typeof value==='object'){const out={};for(const key of Object.keys(value).sort())out[key]=canonical(value[key]);return out;}
  return value;
}
async function sha256Bytes(bytes){
  if(!globalThis.crypto?.subtle)return null;
  const digest=await globalThis.crypto.subtle.digest('SHA-256',bytes);
  return [...new Uint8Array(digest)].map(v=>v.toString(16).padStart(2,'0')).join('');
}
async function sha256Blob(blob){return sha256Bytes(await blob.arrayBuffer());}
async function manifestHash(pack){const bytes=new TextEncoder().encode(JSON.stringify(canonical(pack)));return sha256Bytes(bytes);}
function normalizeExpectedHash(value){return clean(value).toLowerCase().replace(/^sha256:/,'');}
function semverParts(v){return clean(v).split('.').slice(0,3).map(n=>Math.max(0,parseInt(n,10)||0));}
function compareVersions(a,b){const A=semverParts(a),B=semverParts(b);for(let i=0;i<3;i++){if((A[i]||0)!==(B[i]||0))return(A[i]||0)>(B[i]||0)?1:-1;}return 0;}

function validatePack(pack){
  if(!pack||!clean(pack.id)||!clean(pack.name)||!clean(pack.version))throw new Error('PACK_SCHEMA_INVALID');
  if(!Array.isArray(pack.members)||!pack.members.length||pack.members.length>MAX_MEMBERS)throw new Error('PACK_MEMBERS_INVALID:'+clean(pack.id));
  const seen=new Set();
  for(const [index,member] of pack.members.entries()){
    if(!clean(member?.provider)||!clean(member?.assetId))throw new Error(`PACK_MEMBER_INVALID:${pack.id}:${index}`);
    if(seen.has(member.assetId))throw new Error('PACK_DUPLICATE_MEMBER:'+member.assetId);seen.add(member.assetId);
  }
  return pack;
}

export async function loadPackCatalog(){
  if(catalogPromise)return catalogPromise;
  catalogPromise=fetch(CATALOG_URL,{cache:'no-store'}).then(async response=>{
    if(!response.ok)throw new Error('PACK_CATALOG_'+response.status);
    const json=await response.json();if(json?.schema!=='kelo-content-pack-catalog-v1'||!Array.isArray(json.packs))throw new Error('PACK_CATALOG_INVALID');
    return {...json,packs:json.packs.map(row=>copy(validatePack(row)))};
  }).catch(error=>{catalogPromise=null;throw error;});
  return catalogPromise;
}
export async function listContentPacks(){return copy((await loadPackCatalog()).packs);}
export async function getContentPack(id){return(await listContentPacks()).find(pack=>pack.id===String(id))||null;}
export function clearPackCatalogCache(){catalogPromise=null;}

function openDb(){
  if(dbPromise)return dbPromise;
  dbPromise=new Promise((resolve,reject)=>{
    if(!('indexedDB'in globalThis))return reject(new Error('INDEXEDDB_UNAVAILABLE'));
    const request=indexedDB.open(DB_NAME,DB_VERSION);
    request.onupgradeneeded=()=>{const db=request.result;if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE,{keyPath:'id'});};
    request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error||new Error('PACK_DB_OPEN_FAILED'));
  }).catch(error=>{dbPromise=null;throw error;});return dbPromise;
}
async function stateGet(id){const db=await openDb();return new Promise((resolve,reject)=>{const req=db.transaction(STORE,'readonly').objectStore(STORE).get(String(id));req.onsuccess=()=>resolve(req.result||null);req.onerror=()=>reject(req.error);});}
async function stateAll(){const db=await openDb();return new Promise((resolve,reject)=>{const req=db.transaction(STORE,'readonly').objectStore(STORE).getAll();req.onsuccess=()=>resolve(req.result||[]);req.onerror=()=>reject(req.error);});}
async function statePut(value){const db=await openDb();return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put(value);tx.oncomplete=()=>resolve(copy(value));tx.onerror=()=>reject(tx.error);});}
export async function getPackState(id){return copy(await stateGet(id));}
export async function listPackStates(){return(await stateAll()).map(copy).sort((a,b)=>String(b.updatedAt||'').localeCompare(String(a.updatedAt||'')));}

async function resolveMembers(pack){
  const providers=[...new Set(pack.members.map(m=>m.provider))];
  const resolved=new Map();
  await Promise.all(providers.map(async provider=>{
    const result=await searchExternalAssets('',{providers:[provider],limit:320});
    for(const asset of result.assets||[])resolved.set(asset.id,asset);
  }));
  return pack.members.map(member=>{
    const asset=resolved.get(member.assetId);if(!asset)throw new Error(`PACK_MEMBER_NOT_FOUND:${pack.id}:${member.assetId}`);
    return {...asset,expectedSha256:member.sha256||asset.expectedSha256||null};
  });
}

async function emitProgress(callback,detail){
  try{callback?.(copy(detail));}catch{}
  try{globalThis.dispatchEvent?.(new CustomEvent('kelo:content-pack-progress',{detail:copy(detail)}));}catch{}
}

export async function installContentPack(id,{integrate=true,onProgress=null,_stack=null}={}){
  const pack=await getContentPack(id);if(!pack)throw new Error('PACK_NOT_FOUND:'+id);
  const stack=_stack||new Set();if(stack.has(pack.id))throw new Error('PACK_DEPENDENCY_CYCLE:'+pack.id);stack.add(pack.id);
  for(const dependency of pack.dependencies||[])await installContentPack(dependency,{integrate,onProgress,_stack:stack});
  stack.delete(pack.id);

  const resolved=await resolveMembers(pack),hash=await manifestHash(pack),previous=await getPackState(pack.id);
  const locks=Array.isArray(previous?.members)?previous.members.slice():[];
  let state={id:pack.id,name:pack.name,version:pack.version,catalogHash:hash,status:'installing',ownership:'free',downloaded:false,integrated:false,bytes:0,totalMembers:resolved.length,completedMembers:0,members:locks,installedAt:previous?.installedAt||null,updatedAt:now(),error:null};
  await statePut(state);

  for(let index=0;index<resolved.length;index++){
    const asset=resolved[index];
    await emitProgress(onProgress,{packId:pack.id,phase:'member',index,total:resolved.length,assetId:asset.id,name:asset.name});
    let local=await getAsset(asset.id);
    if(!local?.downloaded)local=await downloadAsset(asset);
    const blob=await getBlob(asset.id);if(!blob)throw new Error('PACK_MEMBER_BINARY_MISSING:'+asset.id);
    const sha256=await sha256Blob(blob),expected=normalizeExpectedHash(asset.expectedSha256);
    if(expected&&sha256&&sha256!==expected)throw new Error('PACK_MEMBER_INTEGRITY_MISMATCH:'+asset.id);
    if(integrate&&!local?.integrated)local=(await integrateContent(asset.id)).asset;
    const lock={id:asset.id,provider:asset.provider,contentKind:local?.contentKind||asset.contentKind||'image',bytes:blob.size,sha256:sha256?`sha256:${sha256}`:null,expectedSha256:expected?`sha256:${expected}`:null,integrated:!!local?.integrated,version:pack.version};
    const existing=state.members.findIndex(row=>row.id===asset.id);if(existing>=0)state.members[existing]=lock;else state.members.push(lock);
    state.completedMembers=index+1;state.bytes=state.members.reduce((sum,row)=>sum+Number(row.bytes||0),0);state.updatedAt=now();await statePut(state);await tick();
  }
  state={...state,status:'installed',downloaded:true,integrated:integrate&&state.members.every(row=>row.integrated),installedAt:state.installedAt||now(),updatedAt:now(),error:null};
  await statePut(state);await emitProgress(onProgress,{packId:pack.id,phase:'done',total:resolved.length,bytes:state.bytes});return copy(state);
}

function memberUsedByOtherPack(memberId,currentId,states){return states.some(state=>state.id!==currentId&&state.downloaded&&state.status!=='removed'&&Array.isArray(state.members)&&state.members.some(row=>row.id===memberId));}
export async function removeContentPack(id,{removeLocalMembers=true,onProgress=null}={}){
  const pack=await getContentPack(id),state=await getPackState(id);if(!state&&!pack)return null;
  const states=await listPackStates(),members=state?.members||[];
  if(removeLocalMembers){
    for(let index=0;index<members.length;index++){
      const member=members[index];await emitProgress(onProgress,{packId:id,phase:'remove-member',index,total:members.length,assetId:member.id});
      if(!memberUsedByOtherPack(member.id,id,states))await removeLocal(member.id);await tick();
    }
  }
  const next={...(state||{id,name:pack?.name||id,version:pack?.version||'0.0.0'}),status:'removed',downloaded:false,integrated:false,bytes:0,completedMembers:0,updatedAt:now(),removedAt:now(),error:null};
  await statePut(next);await emitProgress(onProgress,{packId:id,phase:'removed'});return copy(next);
}

export async function inspectContentPacks(){
  const packs=await listContentPacks(),states=await listPackStates(),byId=new Map(states.map(s=>[s.id,s]));
  const rows=[];
  for(const pack of packs){
    const state=byId.get(pack.id)||null,hash=await manifestHash(pack),updateAvailable=!!state&&compareVersions(pack.version,state.version)>0,catalogChanged=!!state?.catalogHash&&!!hash&&state.catalogHash!==hash;
    rows.push({...pack,state:copy(state),installed:!!state?.downloaded&&state.status==='installed',integrated:!!state?.integrated,updateAvailable,catalogChanged,manifestHash:hash?`sha256:${hash}`:null});
  }
  return rows;
}

export const CONTENT_PACK_MANAGER=Object.freeze({loadPackCatalog,listContentPacks,getContentPack,getPackState,listPackStates,inspectContentPacks,installContentPack,removeContentPack,clearPackCatalogCache});
if(typeof window!=='undefined')window.KELO_CONTENT_PACK_MANAGER=CONTENT_PACK_MANAGER;
