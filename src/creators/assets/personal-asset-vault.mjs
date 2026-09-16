/* KELO-INDEX
 * area: CREATORS / PERSONAL UNIVERSAL CONTENT VAULT
 * owner: Kelo Universal Content Bridge
 * keys: CONTENT VAULT INDEXEDDB DOWNLOAD OWNED INTEGRATED LAZY IMAGE AUDIO ABILITY SCENE
 * purpose: Store only content explicitly downloaded by this device and integrate each type through its canonical Kelo contract.
 */
import {integrateContentBlob,inferContentKind} from './content-integration-router.mjs';

const DB_NAME='kelo_personal_asset_vault_v1';
const DB_VERSION=1;
const META_STORE='assets',BLOB_STORE='blobs',MANIFEST_STORE='manifests';
const ALLOWED_MIME=new Set(['image/png','image/webp','image/jpeg','image/gif','audio/mpeg','audio/mp3','audio/ogg','audio/wav','audio/x-wav','audio/webm','audio/mp4','application/json','text/json','text/plain']);
const AUTO_LICENSES=new Set(['CC0','CC0-1.0','CC-BY-3.0','CC-BY-4.0','OGA-BY-3.0','KELO-NATIVE']);
let dbPromise=null;const objectUrls=new Map();
const now=()=>new Date().toISOString();
const clone=value=>value==null?value:JSON.parse(JSON.stringify(value));
function emit(type,detail){try{window.dispatchEvent(new CustomEvent(type,{detail}));}catch{}}

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
  return {id:String(input.id),provider:String(input.provider||'unknown'),externalId:String(input.externalId||input.id),name:String(input.name||input.id),category:String(input.category||'other'),contentKind,tags:Array.isArray(input.tags)?input.tags.slice(0,40):[],previewUrl:input.previewUrl||null,previewKind:input.previewKind||(/^(sfx|music|ambience)$/.test(contentKind)?'audio':/^(ability|scene|prefab)$/.test(contentKind)?'manifest':'image'),downloadUrl:input.downloadUrl||null,sourceUrl:input.sourceUrl||null,license:String(input.license||'UNKNOWN'),author:input.author||null,attributionRequired:!!input.attributionRequired,ownership:input.ownership||'discovered',downloaded:!!input.downloaded,integrated:!!input.integrated,bytes:Number(input.bytes||0),mime:input.mime||null,loop:input.loop===true,durationHint:Number(input.durationHint||0)||null,downloadedAt:input.downloadedAt||null,integratedAt:input.integratedAt||null,updatedAt:input.updatedAt||now(),compiler:input.compiler||null,inlineManifest:input.inlineManifest||null};
}
export async function rememberAsset(input){const previous=await storeGet(META_STORE,String(input.id));const next=normalizeAssetMeta({...previous,...input,updatedAt:now()});await storePut(META_STORE,next);return clone(next);}
export async function getAsset(id){return clone(await storeGet(META_STORE,String(id)));}
export async function listAssets(){return(await storeAll(META_STORE)).map(clone).sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt)));}
export async function listOwnedAssets(){return(await listAssets()).filter(a=>['free','purchased','owned'].includes(a.ownership));}
export function licenseDecision(asset){const license=String(asset?.license||'UNKNOWN').toUpperCase();return AUTO_LICENSES.has(license)?{allowed:true,review:false,reason:'compatible'}:{allowed:false,review:true,reason:'license-review-required'};}

function inlineBlob(asset){if(!asset.inlineManifest)return null;return new Blob([JSON.stringify(asset.inlineManifest)],{type:'application/json'});}
export async function downloadAsset(input){
  const asset=await rememberAsset(input),decision=licenseDecision(asset);if(!decision.allowed)throw new Error('ASSET_LICENSE_REVIEW_REQUIRED:'+asset.license);
  let blob=inlineBlob(asset);
  if(!blob){if(!asset.downloadUrl)throw new Error('ASSET_DOWNLOAD_URL_MISSING');const response=await fetch(asset.downloadUrl,{mode:'cors',cache:'force-cache'});if(!response.ok)throw new Error('ASSET_DOWNLOAD_'+response.status);blob=await response.blob();}
  const mime=(blob.type||asset.mime||'').toLowerCase();if(mime&&!ALLOWED_MIME.has(mime))throw new Error('ASSET_UNSUPPORTED_MIME:'+mime);if(!blob.size)throw new Error('ASSET_EMPTY_DOWNLOAD');
  await storePut(BLOB_STORE,{id:asset.id,blob,bytes:blob.size,mime:mime||null,updatedAt:now()});
  const next=await rememberAsset({...asset,ownership:asset.ownership==='purchased'?'purchased':'free',downloaded:true,bytes:blob.size,mime:mime||asset.mime,downloadedAt:now()});
  emit('kelo:personal-content-downloaded',{asset:next});emit('kelo:personal-asset-downloaded',{asset:next});return next;
}
export const downloadContent=downloadAsset;

export async function getBlob(id){const row=await storeGet(BLOB_STORE,String(id));return row?.blob||null;}
export async function getManifest(id){const row=await storeGet(MANIFEST_STORE,String(id));return row?.manifest||null;}
export async function getObjectURL(id){id=String(id);if(objectUrls.has(id))return objectUrls.get(id);const blob=await getBlob(id);if(!blob)return null;const url=URL.createObjectURL(blob);objectUrls.set(id,url);return url;}
export function releaseObjectURL(id){id=String(id);const url=objectUrls.get(id);if(!url)return;URL.revokeObjectURL(url);objectUrls.delete(id);}

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

export async function removeLocal(id){id=String(id);releaseObjectURL(id);await Promise.all([storeDelete(BLOB_STORE,id),storeDelete(MANIFEST_STORE,id)]);const asset=await getAsset(id);if(!asset)return null;const next=await rememberAsset({...asset,downloaded:false,integrated:false,bytes:0,mime:null,downloadedAt:null,integratedAt:null,compiler:null});emit('kelo:personal-content-local-removed',{asset:next});emit('kelo:personal-asset-local-removed',{asset:next});return next;}
export async function getVaultStats(){const rows=await listAssets(),byKind={};for(const row of rows){const k=row.contentKind||'other';byKind[k]=(byKind[k]||0)+1;}return{items:rows.length,owned:rows.filter(a=>['free','owned','purchased'].includes(a.ownership)).length,downloaded:rows.filter(a=>a.downloaded).length,integrated:rows.filter(a=>a.integrated).length,bytes:rows.reduce((n,a)=>n+(a.downloaded?Number(a.bytes||0):0),0),byKind};}

export const PERSONAL_ASSET_VAULT=Object.freeze({openVault,rememberAsset,getAsset,listAssets,listOwnedAssets,downloadAsset,downloadContent,getBlob,getManifest,getObjectURL,releaseObjectURL,integrateAsset,integrateContent,removeLocal,getVaultStats,licenseDecision});
export const PERSONAL_CONTENT_VAULT=PERSONAL_ASSET_VAULT;
if(typeof window!=='undefined'){window.KELO_PERSONAL_ASSET_VAULT=PERSONAL_ASSET_VAULT;window.KELO_PERSONAL_CONTENT_VAULT=PERSONAL_CONTENT_VAULT;}
