/* KELO-INDEX
 * area: CREATORS / PERSONAL ASSET VAULT
 * owner: Kelo Creator Asset Bridge
 * keys: ASSET VAULT INDEXEDDB DOWNLOAD OWNED INTEGRATED LAZY
 * purpose: Store only assets explicitly downloaded by this device and hand them to the canonical compiler on explicit integration.
 */
import { compileCanvasAsset, buildAssetSheetManifest } from './asset-sheet-compiler.mjs';

const DB_NAME='kelo_personal_asset_vault_v1';
const DB_VERSION=1;
const META_STORE='assets';
const BLOB_STORE='blobs';
const MANIFEST_STORE='manifests';
const ALLOWED_MIME=new Set(['image/png','image/webp','image/jpeg','image/gif']);
const AUTO_LICENSES=new Set(['CC0','CC0-1.0','CC-BY-3.0','CC-BY-4.0','OGA-BY-3.0']);
let dbPromise=null;
const objectUrls=new Map();

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
      if(!db.objectStoreNames.contains(META_STORE)){
        const store=db.createObjectStore(META_STORE,{keyPath:'id'});
        store.createIndex('provider','provider',{unique:false});
        store.createIndex('updatedAt','updatedAt',{unique:false});
      }
      if(!db.objectStoreNames.contains(BLOB_STORE))db.createObjectStore(BLOB_STORE,{keyPath:'id'});
      if(!db.objectStoreNames.contains(MANIFEST_STORE))db.createObjectStore(MANIFEST_STORE,{keyPath:'id'});
    };
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error||new Error('INDEXEDDB_OPEN_FAILED'));
  }).catch(error=>{dbPromise=null;throw error;});
  return dbPromise;
}

async function storeGet(storeName,id){const db=await openVault();return new Promise((resolve,reject)=>{const req=db.transaction(storeName,'readonly').objectStore(storeName).get(id);req.onsuccess=()=>resolve(req.result||null);req.onerror=()=>reject(req.error);});}
async function storePut(storeName,value){const db=await openVault();return new Promise((resolve,reject)=>{const tx=db.transaction(storeName,'readwrite');tx.objectStore(storeName).put(value);tx.oncomplete=()=>resolve(value);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('VAULT_WRITE_ABORTED'));});}
async function storeDelete(storeName,id){const db=await openVault();return new Promise((resolve,reject)=>{const tx=db.transaction(storeName,'readwrite');tx.objectStore(storeName).delete(id);tx.oncomplete=()=>resolve(true);tx.onerror=()=>reject(tx.error);});}
async function storeAll(storeName){const db=await openVault();return new Promise((resolve,reject)=>{const req=db.transaction(storeName,'readonly').objectStore(storeName).getAll();req.onsuccess=()=>resolve(req.result||[]);req.onerror=()=>reject(req.error);});}

export function normalizeAssetMeta(input={}){
  if(!input.id)throw new Error('ASSET_ID_REQUIRED');
  return {id:String(input.id),provider:String(input.provider||'unknown'),externalId:String(input.externalId||input.id),name:String(input.name||input.id),category:String(input.category||'other'),tags:Array.isArray(input.tags)?input.tags.slice(0,40):[],previewUrl:input.previewUrl||null,downloadUrl:input.downloadUrl||null,sourceUrl:input.sourceUrl||null,license:String(input.license||'UNKNOWN'),author:input.author||null,attributionRequired:!!input.attributionRequired,ownership:input.ownership||'discovered',downloaded:!!input.downloaded,integrated:!!input.integrated,bytes:Number(input.bytes||0),mime:input.mime||null,downloadedAt:input.downloadedAt||null,integratedAt:input.integratedAt||null,updatedAt:input.updatedAt||now(),compiler:input.compiler||null};
}
export async function rememberAsset(input){const previous=await storeGet(META_STORE,String(input.id));const next=normalizeAssetMeta({...previous,...input,updatedAt:now()});await storePut(META_STORE,next);return clone(next);}
export async function getAsset(id){return clone(await storeGet(META_STORE,String(id)));}
export async function listAssets(){return(await storeAll(META_STORE)).map(clone).sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt)));}
export async function listOwnedAssets(){return(await listAssets()).filter(a=>a.ownership==='free'||a.ownership==='purchased'||a.ownership==='owned');}

export function licenseDecision(asset){const license=String(asset?.license||'UNKNOWN').toUpperCase();return AUTO_LICENSES.has(license)?{allowed:true,review:false,reason:'compatible'}:{allowed:false,review:true,reason:'license-review-required'};}

export async function downloadAsset(input){
  const asset=await rememberAsset(input);
  if(!asset.downloadUrl)throw new Error('ASSET_DOWNLOAD_URL_MISSING');
  const decision=licenseDecision(asset);if(!decision.allowed)throw new Error('ASSET_LICENSE_REVIEW_REQUIRED:'+asset.license);
  const response=await fetch(asset.downloadUrl,{mode:'cors',cache:'force-cache'});if(!response.ok)throw new Error('ASSET_DOWNLOAD_'+response.status);
  const blob=await response.blob();const mime=(blob.type||'').toLowerCase();
  if(mime&&!ALLOWED_MIME.has(mime))throw new Error('ASSET_UNSUPPORTED_MIME:'+mime);
  if(!blob.size)throw new Error('ASSET_EMPTY_DOWNLOAD');
  await storePut(BLOB_STORE,{id:asset.id,blob,bytes:blob.size,mime:mime||null,updatedAt:now()});
  const next=await rememberAsset({...asset,ownership:asset.ownership==='purchased'?'purchased':'free',downloaded:true,bytes:blob.size,mime:mime||asset.mime,downloadedAt:now()});
  emit('kelo:personal-asset-downloaded',{asset:next});return next;
}

export async function getBlob(id){const row=await storeGet(BLOB_STORE,String(id));return row?.blob||null;}
export async function getManifest(id){const row=await storeGet(MANIFEST_STORE,String(id));return row?.manifest||null;}
export async function getObjectURL(id){id=String(id);if(objectUrls.has(id))return objectUrls.get(id);const blob=await getBlob(id);if(!blob)return null;const url=URL.createObjectURL(blob);objectUrls.set(id,url);return url;}
export function releaseObjectURL(id){id=String(id);const url=objectUrls.get(id);if(!url)return;URL.revokeObjectURL(url);objectUrls.delete(id);}

async function blobToCanvas(blob){
  let bitmap=null,width=0,height=0,cleanup=()=>{};
  if('createImageBitmap' in globalThis){bitmap=await createImageBitmap(blob);width=bitmap.width;height=bitmap.height;cleanup=()=>bitmap.close?.();}
  else{const url=URL.createObjectURL(blob);const img=new Image();img.decoding='async';await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(new Error('ASSET_IMAGE_DECODE_FAILED'));img.src=url;});bitmap=img;width=img.naturalWidth;height=img.naturalHeight;cleanup=()=>URL.revokeObjectURL(url);}
  if(!width||!height){cleanup();throw new Error('ASSET_ZERO_DIMENSIONS');}
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx){cleanup();throw new Error('ASSET_CANVAS_UNAVAILABLE');}
  ctx.clearRect(0,0,width,height);ctx.drawImage(bitmap,0,0);cleanup();return canvas;
}

export async function integrateAsset(id){
  const asset=await getAsset(id);if(!asset)throw new Error('ASSET_NOT_IN_VAULT');if(!asset.downloaded)throw new Error('ASSET_NOT_DOWNLOADED');
  const decision=licenseDecision(asset);if(!decision.allowed)throw new Error('ASSET_LICENSE_REVIEW_REQUIRED:'+asset.license);
  const blob=await getBlob(id);if(!blob)throw new Error('ASSET_BINARY_MISSING');
  const canvas=await blobToCanvas(blob);const analysis=compileCanvasAsset(canvas,{name:asset.name,source:asset.sourceUrl||asset.downloadUrl,provider:asset.provider,license:asset.license});
  if(!analysis?.version||!Array.isArray(analysis.assets))throw new Error('ASSET_COMPILER_REJECTED');
  const atlasId=`personal-${asset.provider}-${asset.externalId}`.toLowerCase().replace(/[^a-z0-9_-]+/g,'-');
  const manifest=buildAssetSheetManifest(analysis,{sourceName:asset.name,sourcePath:asset.sourceUrl||asset.downloadUrl,atlasId});
  manifest.external=Object.freeze({provider:asset.provider,externalAssetId:asset.externalId,license:asset.license,author:asset.author||null,sourceUrl:asset.sourceUrl||null});
  await storePut(MANIFEST_STORE,{id:asset.id,manifest,updatedAt:now()});
  const next=await rememberAsset({...asset,integrated:true,integratedAt:now(),compiler:manifest?.compiler||'asset-sheet-compiler'});
  emit('kelo:personal-asset-integrated',{asset:next,manifest});return{asset:next,manifest};
}

export async function removeLocal(id){id=String(id);releaseObjectURL(id);await Promise.all([storeDelete(BLOB_STORE,id),storeDelete(MANIFEST_STORE,id)]);const asset=await getAsset(id);if(!asset)return null;const next=await rememberAsset({...asset,downloaded:false,integrated:false,bytes:0,mime:null,downloadedAt:null,integratedAt:null});emit('kelo:personal-asset-local-removed',{asset:next});return next;}
export async function getVaultStats(){const rows=await listAssets();return{items:rows.length,owned:rows.filter(a=>['free','owned','purchased'].includes(a.ownership)).length,downloaded:rows.filter(a=>a.downloaded).length,integrated:rows.filter(a=>a.integrated).length,bytes:rows.reduce((n,a)=>n+(a.downloaded?Number(a.bytes||0):0),0)};}

export const PERSONAL_ASSET_VAULT=Object.freeze({openVault,rememberAsset,getAsset,listAssets,listOwnedAssets,downloadAsset,getBlob,getManifest,getObjectURL,releaseObjectURL,integrateAsset,removeLocal,getVaultStats,licenseDecision});
if(typeof window!=='undefined')window.KELO_PERSONAL_ASSET_VAULT=PERSONAL_ASSET_VAULT;
