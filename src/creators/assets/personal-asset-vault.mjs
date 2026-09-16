/* KELO-INDEX
 * area: CREATORS / PERSONAL UNIVERSAL CONTENT VAULT
 * owner: Kelo Universal Content Bridge
 * keys: CONTENT VAULT INDEXEDDB CAS SHA256 DEDUPE ROLLBACK GC DOWNLOAD OWNED INTEGRATED LAZY IMAGE AUDIO ABILITY SCENE
 * purpose: Store only content explicitly downloaded by this device, deduplicate binaries by SHA-256, preserve rollback history, and integrate each type through its canonical Kelo contract.
 */
import {integrateContentBlob,inferContentKind} from './content-integration-router.mjs';

const DB_NAME='kelo_personal_asset_vault_v1';
const DB_VERSION=2;
const META_STORE='assets',BLOB_STORE='blobs',MANIFEST_STORE='manifests',CAS_STORE='casBlobs';
const ALLOWED_MIME=new Set(['image/png','image/webp','image/jpeg','image/gif','audio/mpeg','audio/mp3','audio/ogg','audio/wav','audio/x-wav','audio/webm','audio/mp4','application/json','text/json','text/plain']);
const AUTO_LICENSES=new Set(['CC0','CC0-1.0','CC-BY-3.0','CC-BY-4.0','OGA-BY-3.0','KELO-NATIVE']);
const DEFAULT_GC_GRACE_MS=7*24*60*60*1000;
let dbPromise=null;const objectUrls=new Map();
const now=()=>new Date().toISOString();
const clone=value=>value==null?value:JSON.parse(JSON.stringify(value));
const tick=()=>new Promise(resolve=>(globalThis.setTimeout||setTimeout)(resolve,0));
function emit(type,detail){try{window.dispatchEvent(new CustomEvent(type,{detail}));}catch{}}
function normalizeDigest(value){const text=String(value||'').trim().toLowerCase();if(!text)return null;return text.startsWith('sha256:')?text:`sha256:${text}`;}
async function sha256Blob(blob){if(!globalThis.crypto?.subtle)throw new Error('WEB_CRYPTO_UNAVAILABLE');const digest=await globalThis.crypto.subtle.digest('SHA-256',await blob.arrayBuffer());return `sha256:${[...new Uint8Array(digest)].map(v=>v.toString(16).padStart(2,'0')).join('')}`;}

export function openVault(){
  if(dbPromise)return dbPromise;
  dbPromise=new Promise((resolve,reject)=>{
    if(!('indexedDB' in globalThis))return reject(new Error('INDEXEDDB_UNAVAILABLE'));
    const req=indexedDB.open(DB_NAME,DB_VERSION);
    req.onupgradeneeded=()=>{
      const db=req.result;
      if(!db.objectStoreNames.contains(META_STORE)){const store=db.createObjectStore(META_STORE,{keyPath:'id'});store.createIndex('provider','provider',{unique:false});store.createIndex('updatedAt','updatedAt',{unique:false});}
      if(!db.objectStoreNames.contains(BLOB_STORE))db.createObjectStore(BLOB_STORE,{keyPath:'id'});
      if(!db.objectStoreNames.contains(MANIFEST_STORE))db.createObjectStore(MANIFEST_STORE,{keyPath:'id'});
      if(!db.objectStoreNames.contains(CAS_STORE))db.createObjectStore(CAS_STORE,{keyPath:'digest'});
    };
    req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error||new Error('INDEXEDDB_OPEN_FAILED'));
  }).catch(error=>{dbPromise=null;throw error;});return dbPromise;
}
async function storeGet(storeName,id){const db=await openVault();return new Promise((resolve,reject)=>{const req=db.transaction(storeName,'readonly').objectStore(storeName).get(id);req.onsuccess=()=>resolve(req.result||null);req.onerror=()=>reject(req.error);});}
async function storePut(storeName,value){const db=await openVault();return new Promise((resolve,reject)=>{const tx=db.transaction(storeName,'readwrite');tx.objectStore(storeName).put(value);tx.oncomplete=()=>resolve(value);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('VAULT_WRITE_ABORTED'));});}
async function storeDelete(storeName,id){const db=await openVault();return new Promise((resolve,reject)=>{const tx=db.transaction(storeName,'readwrite');tx.objectStore(storeName).delete(id);tx.oncomplete=()=>resolve(true);tx.onerror=()=>reject(tx.error);});}
async function storeAll(storeName){const db=await openVault();return new Promise((resolve,reject)=>{const req=db.transaction(storeName,'readonly').objectStore(storeName).getAll();req.onsuccess=()=>resolve(req.result||[]);req.onerror=()=>reject(req.error);});}

export function normalizeAssetMeta(input={}){
  if(!input.id)throw new Error('ASSET_ID_REQUIRED');
  const contentKind=inferContentKind(input,input.mime||'');
  return {id:String(input.id),provider:String(input.provider||'unknown'),externalId:String(input.externalId||input.id),name:String(input.name||input.id),category:String(input.category||'other'),contentKind,tags:Array.isArray(input.tags)?input.tags.slice(0,40):[],previewUrl:input.previewUrl||null,previewKind:input.previewKind||(/^(sfx|music|ambience)$/.test(contentKind)?'audio':/^(ability|scene|prefab)$/.test(contentKind)?'manifest':'image'),downloadUrl:input.downloadUrl||null,sourceUrl:input.sourceUrl||null,license:String(input.license||'UNKNOWN'),author:input.author||null,authors:Array.isArray(input.authors)?input.authors.slice(0,20):[],licenses:Array.isArray(input.licenses)?input.licenses.slice(0,20):[],creditUrls:Array.isArray(input.creditUrls)?input.creditUrls.slice(0,20):[],creditNotes:input.creditNotes||null,attributionRequired:!!input.attributionRequired,ownership:input.ownership||'discovered',downloaded:!!input.downloaded,integrated:!!input.integrated,bytes:Number(input.bytes||0),mime:input.mime||null,sha256:normalizeDigest(input.sha256),expectedSha256:normalizeDigest(input.expectedSha256),loop:input.loop===true,durationHint:Number(input.durationHint||0)||null,downloadedAt:input.downloadedAt||null,integratedAt:input.integratedAt||null,updatedAt:input.updatedAt||now(),compiler:input.compiler||null,inlineManifest:input.inlineManifest||null,pinnedCommit:input.pinnedCommit||null,definitionUrl:input.definitionUrl||null,repositoryUrl:input.repositoryUrl||null,verified:input.verified===true,rollbackActive:input.rollbackActive===true};
}
export async function rememberAsset(input){const previous=await storeGet(META_STORE,String(input.id));const next=normalizeAssetMeta({...previous,...input,updatedAt:now()});await storePut(META_STORE,next);return clone(next);}
export async function getAsset(id){return clone(await storeGet(META_STORE,String(id)));}
export async function listAssets(){return(await storeAll(META_STORE)).map(clone).sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt)));}
export async function listOwnedAssets(){return(await listAssets()).filter(a=>['free','purchased','owned'].includes(a.ownership));}
export function licenseDecision(asset){const license=String(asset?.license||'UNKNOWN').toUpperCase();return AUTO_LICENSES.has(license)?{allowed:true,review:false,reason:'compatible'}:{allowed:false,review:true,reason:'license-review-required'};}

function inlineBlob(asset){if(!asset.inlineManifest)return null;return new Blob([JSON.stringify(asset.inlineManifest)],{type:'application/json'});}
async function putCasBlob(blob,digest,mime){const existing=await storeGet(CAS_STORE,digest);if(existing?.blob){if(existing.orphanedAt)await storePut(CAS_STORE,{...existing,orphanedAt:null,updatedAt:now()});return{row:existing,reused:true};}const row={digest,blob,bytes:blob.size,mime:mime||blob.type||null,createdAt:now(),updatedAt:now(),orphanedAt:null};await storePut(CAS_STORE,row);return{row,reused:false};}
async function pointerBlob(row){if(!row)return null;if(row.blob)return row.blob;if(!row.digest)return null;const cas=await storeGet(CAS_STORE,row.digest);return cas?.blob||null;}

export async function downloadAsset(input){
  const asset=await rememberAsset(input),decision=licenseDecision(asset);if(!decision.allowed)throw new Error('ASSET_LICENSE_REVIEW_REQUIRED:'+asset.license);
  let blob=inlineBlob(asset);
  if(!blob){if(!asset.downloadUrl)throw new Error('ASSET_DOWNLOAD_URL_MISSING');const response=await fetch(asset.downloadUrl,{mode:'cors',cache:'force-cache'});if(!response.ok)throw new Error('ASSET_DOWNLOAD_'+response.status);blob=await response.blob();}
  const mime=(blob.type||asset.mime||'').toLowerCase();if(mime&&!ALLOWED_MIME.has(mime))throw new Error('ASSET_UNSUPPORTED_MIME:'+mime);if(!blob.size)throw new Error('ASSET_EMPTY_DOWNLOAD');
  const digest=await sha256Blob(blob),expected=normalizeDigest(asset.expectedSha256);if(expected&&digest!==expected)throw new Error('ASSET_INTEGRITY_MISMATCH:'+asset.id);
  const oldPointer=await storeGet(BLOB_STORE,asset.id),cas=await putCasBlob(blob,digest,mime);
  const previousDigest=oldPointer?.digest&&oldPointer.digest!==digest?oldPointer.digest:(oldPointer?.previousDigest||null);
  await storePut(BLOB_STORE,{id:asset.id,digest,previousDigest,bytes:blob.size,mime:mime||null,storage:'cas-v2',updatedAt:now()});
  const next=await rememberAsset({...asset,ownership:asset.ownership==='purchased'?'purchased':'free',downloaded:true,bytes:blob.size,mime:mime||asset.mime,sha256:digest,rollbackActive:false,downloadedAt:now()});
  emit('kelo:personal-content-downloaded',{asset:next,digest,casReused:cas.reused,rollbackAvailable:!!previousDigest});emit('kelo:personal-asset-downloaded',{asset:next,digest,casReused:cas.reused});return next;
}
export const downloadContent=downloadAsset;

export async function getBlob(id){const row=await storeGet(BLOB_STORE,String(id));return pointerBlob(row);}
export async function getBlobPointer(id){const row=await storeGet(BLOB_STORE,String(id));return row?clone({...row,blob:undefined}):null;}
export async function getBlobByDigest(digest){const row=await storeGet(CAS_STORE,normalizeDigest(digest));return row?.blob||null;}
export async function getManifest(id){const row=await storeGet(MANIFEST_STORE,String(id));return row?.manifest||null;}
export async function getObjectURL(id){id=String(id);if(objectUrls.has(id))return objectUrls.get(id);const blob=await getBlob(id);if(!blob)return null;const url=URL.createObjectURL(blob);objectUrls.set(id,url);return url;}
export function releaseObjectURL(id){id=String(id);const url=objectUrls.get(id);if(!url)return;URL.revokeObjectURL(url);objectUrls.delete(id);}

export async function migrateAssetToCas(id){
  id=String(id);const pointer=await storeGet(BLOB_STORE,id);if(!pointer)return{migrated:false,reason:'missing'};if(pointer.digest&&!pointer.blob)return{migrated:false,reason:'already-cas',digest:pointer.digest};if(!pointer.blob)return{migrated:false,reason:'no-blob'};
  const digest=await sha256Blob(pointer.blob),cas=await putCasBlob(pointer.blob,digest,pointer.mime||pointer.blob.type||null);
  await storePut(BLOB_STORE,{id,digest,previousDigest:null,bytes:pointer.bytes||pointer.blob.size,mime:pointer.mime||pointer.blob.type||null,storage:'cas-v2',updatedAt:now()});
  const asset=await getAsset(id);if(asset)await rememberAsset({...asset,sha256:digest,bytes:pointer.bytes||pointer.blob.size,rollbackActive:false});
  return{migrated:true,digest,reused:cas.reused,bytes:pointer.bytes||pointer.blob.size};
}
export async function migrateVaultToCas({limit=Infinity,onProgress=null}={}){
  const rows=await storeAll(BLOB_STORE);let migrated=0,reused=0,bytes=0,scanned=0;
  for(const row of rows){if(scanned>=limit)break;scanned++;if(row?.blob&&!row?.digest){const result=await migrateAssetToCas(row.id);if(result.migrated){migrated++;if(result.reused)reused++;bytes+=Number(result.bytes||0);}}try{onProgress?.({scanned,total:rows.length,migrated,reused,bytes});}catch{}await tick();}
  const report={scanned,total:rows.length,migrated,reused,bytes};emit('kelo:personal-vault-cas-migrated',report);return report;
}

export async function rollbackAssetBlob(id){
  id=String(id);const pointer=await storeGet(BLOB_STORE,id);if(!pointer?.digest||!pointer?.previousDigest)throw new Error('ASSET_ROLLBACK_UNAVAILABLE:'+id);
  const previous=await storeGet(CAS_STORE,pointer.previousDigest);if(!previous?.blob)throw new Error('ASSET_ROLLBACK_BLOB_MISSING:'+id);
  releaseObjectURL(id);
  await storePut(BLOB_STORE,{...pointer,digest:pointer.previousDigest,previousDigest:pointer.digest,bytes:Number(previous.bytes||previous.blob.size||0),mime:previous.mime||pointer.mime||null,storage:'cas-v2',updatedAt:now()});
  await storeDelete(MANIFEST_STORE,id);
  const asset=await getAsset(id),next=asset?await rememberAsset({...asset,downloaded:true,integrated:false,bytes:Number(previous.bytes||previous.blob.size||0),mime:previous.mime||asset.mime||null,sha256:pointer.previousDigest,rollbackActive:true,integratedAt:null,compiler:null}):null;
  const result={id,digest:pointer.previousDigest,previousDigest:pointer.digest,asset:next};emit('kelo:personal-content-rolled-back',result);return result;
}
export async function discardAssetRollbackHistory(id){
  id=String(id);const pointer=await storeGet(BLOB_STORE,id);if(!pointer?.digest)return false;if(!pointer.previousDigest)return true;await storePut(BLOB_STORE,{...pointer,previousDigest:null,updatedAt:now()});const asset=await getAsset(id);if(asset)await rememberAsset({...asset,rollbackActive:false});return true;
}

function referencedDigests(pointers){const refs=new Set();for(const row of pointers){if(row?.digest)refs.add(row.digest);if(row?.previousDigest)refs.add(row.previousDigest);}return refs;}
export async function garbageCollectCas({graceMs=DEFAULT_GC_GRACE_MS,dryRun=true,maxDeletes=64,onProgress=null}={}){
  const [pointers,casRows]=await Promise.all([storeAll(BLOB_STORE),storeAll(CAS_STORE)]),refs=referencedDigests(pointers),nowMs=Date.now();let marked=0,deleted=0,reclaimedBytes=0,kept=0;
  for(const row of casRows){if(refs.has(row.digest)){kept++;if(row.orphanedAt)await storePut(CAS_STORE,{...row,orphanedAt:null,updatedAt:now()});continue;}
    if(!row.orphanedAt){marked++;if(!dryRun)await storePut(CAS_STORE,{...row,orphanedAt:now(),updatedAt:now()});continue;}
    const age=nowMs-Date.parse(row.orphanedAt||row.updatedAt||row.createdAt||0);if(age<Math.max(0,graceMs)){kept++;continue;}
    if(deleted>=Math.max(0,maxDeletes)){kept++;continue;}
    deleted++;reclaimedBytes+=Number(row.bytes||row.blob?.size||0);if(!dryRun)await storeDelete(CAS_STORE,row.digest);try{onProgress?.({digest:row.digest,deleted,reclaimedBytes});}catch{}await tick();
  }
  const report={dryRun,graceMs,total:casRows.length,referenced:refs.size,marked,deleted,reclaimedBytes,kept};emit('kelo:personal-vault-cas-gc',report);return report;
}

export async function getCasStats(){
  const [pointers,casRows]=await Promise.all([storeAll(BLOB_STORE),storeAll(CAS_STORE)]);const casBytes=casRows.reduce((n,row)=>n+Number(row.bytes||0),0),logicalBytes=pointers.reduce((n,row)=>n+Number(row.bytes||row.blob?.size||0),0),legacyPointers=pointers.filter(row=>!!row.blob&&!row.digest).length,casPointers=pointers.filter(row=>!!row.digest).length,rollbackPointers=pointers.filter(row=>!!row.previousDigest).length,orphanedBlobs=casRows.filter(row=>!!row.orphanedAt).length;
  return{casBlobs:casRows.length,casPointers,legacyPointers,rollbackPointers,orphanedBlobs,logicalBytes,physicalCasBytes:casBytes,deduplicatedBytes:Math.max(0,logicalBytes-casBytes),dedupeRatio:logicalBytes?Math.max(0,1-casBytes/logicalBytes):0};
}

export async function integrateContent(id){
  const asset=await getAsset(id);if(!asset)throw new Error('ASSET_NOT_IN_VAULT');if(!asset.downloaded)throw new Error('ASSET_NOT_DOWNLOADED');
  const decision=licenseDecision(asset);if(!decision.allowed)throw new Error('ASSET_LICENSE_REVIEW_REQUIRED:'+asset.license);
  const blob=await getBlob(id);if(!blob)throw new Error('ASSET_BINARY_MISSING');
  const result=await integrateContentBlob(asset,blob),manifest=result.manifest;
  await storePut(MANIFEST_STORE,{id:asset.id,manifest,updatedAt:now()});
  const next=await rememberAsset({...asset,contentKind:result.kind,integrated:true,integratedAt:now(),compiler:result.compiler||manifest?.compiler||'content-integration-router'});
  emit('kelo:personal-content-integrated',{asset:next,manifest,contentKind:result.kind});
  if(['image','sprite','tileset','animation','vfx'].includes(result.kind))emit('kelo:personal-asset-integrated',{asset:next,manifest});
  return{asset:next,manifest};
}
export const integrateAsset=integrateContent;

export async function removeLocal(id){id=String(id);releaseObjectURL(id);await Promise.all([storeDelete(BLOB_STORE,id),storeDelete(MANIFEST_STORE,id)]);const asset=await getAsset(id);if(!asset)return null;const next=await rememberAsset({...asset,downloaded:false,integrated:false,bytes:0,mime:null,downloadedAt:null,integratedAt:null,compiler:null,rollbackActive:false});emit('kelo:personal-content-local-removed',{asset:next});emit('kelo:personal-asset-local-removed',{asset:next});return next;}
export async function getVaultStats(){const rows=await listAssets(),byKind={};for(const row of rows){const k=row.contentKind||'other';byKind[k]=(byKind[k]||0)+1;}const cas=await getCasStats();return{items:rows.length,owned:rows.filter(a=>['free','owned','purchased'].includes(a.ownership)).length,downloaded:rows.filter(a=>a.downloaded).length,integrated:rows.filter(a=>a.integrated).length,bytes:rows.reduce((n,a)=>n+(a.downloaded?Number(a.bytes||0):0),0),byKind,cas};}

export const PERSONAL_ASSET_VAULT=Object.freeze({openVault,rememberAsset,getAsset,listAssets,listOwnedAssets,downloadAsset,downloadContent,getBlob,getBlobPointer,getBlobByDigest,getManifest,getObjectURL,releaseObjectURL,migrateAssetToCas,migrateVaultToCas,rollbackAssetBlob,discardAssetRollbackHistory,garbageCollectCas,getCasStats,integrateAsset,integrateContent,removeLocal,getVaultStats,licenseDecision});
export const PERSONAL_CONTENT_VAULT=PERSONAL_ASSET_VAULT;
if(typeof window!=='undefined'){window.KELO_PERSONAL_ASSET_VAULT=PERSONAL_ASSET_VAULT;window.KELO_PERSONAL_CONTENT_VAULT=PERSONAL_CONTENT_VAULT;}
