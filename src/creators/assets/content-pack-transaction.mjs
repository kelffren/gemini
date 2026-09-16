/* KELO-INDEX
 * area: CREATORS / CONTENT PACK TRANSACTIONS
 * owner: Kelo Universal Content Bridge
 * keys: PACK TRANSACTION STAGING ATOMIC COMMIT CAS SHA256 RECOVERY ROLLBACK TOMBSTONE MOBILE
 * purpose: Stage pack content outside the active vault and atomically switch all asset pointers only after every member validates.
 */
import {integrateContentBlob} from './content-integration-router.mjs';
import {normalizeAssetMeta,licenseDecision,getAsset,getBlob,getBlobByDigest,getBlobPointer,releaseObjectURL} from './personal-asset-vault.mjs';

const STAGE_DB_NAME='kelo_content_pack_staging_v1',STAGE_DB_VERSION=1,STAGE_STORE='stages';
const VAULT_DB_NAME='kelo_personal_asset_vault_v1';
const META_STORE='assets',BLOB_STORE='blobs',MANIFEST_STORE='manifests',CAS_STORE='casBlobs';
const ALLOWED_MIME=new Set(['image/png','image/webp','image/jpeg','image/gif','audio/mpeg','audio/mp3','audio/ogg','audio/wav','audio/x-wav','audio/webm','audio/mp4','application/json','text/json','text/plain']);
let stageDbPromise=null,vaultDbPromise=null;
const now=()=>new Date().toISOString();
const copy=v=>v==null?v:JSON.parse(JSON.stringify(v));
const clean=v=>String(v??'').trim();
const keyFor=(transactionId,assetId)=>`${clean(transactionId)}::${clean(assetId)}`;
function normalizeDigest(value){const text=clean(value).toLowerCase();if(!text)return null;return text.startsWith('sha256:')?text:`sha256:${text}`;}
async function sha256Blob(blob){if(!globalThis.crypto?.subtle)throw new Error('WEB_CRYPTO_UNAVAILABLE');const digest=await globalThis.crypto.subtle.digest('SHA-256',await blob.arrayBuffer());return `sha256:${[...new Uint8Array(digest)].map(v=>v.toString(16).padStart(2,'0')).join('')}`;}
function emit(type,detail){try{globalThis.dispatchEvent?.(new CustomEvent(type,{detail:copy(detail)}));}catch{}}

function openStageDb(){
  if(stageDbPromise)return stageDbPromise;
  stageDbPromise=new Promise((resolve,reject)=>{
    if(!('indexedDB'in globalThis))return reject(new Error('INDEXEDDB_UNAVAILABLE'));
    const req=indexedDB.open(STAGE_DB_NAME,STAGE_DB_VERSION);
    req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(STAGE_STORE)){const store=db.createObjectStore(STAGE_STORE,{keyPath:'id'});store.createIndex('transactionId','transactionId',{unique:false});store.createIndex('assetId','assetId',{unique:false});}};
    req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error||new Error('PACK_STAGE_DB_OPEN_FAILED'));
  }).catch(error=>{stageDbPromise=null;throw error;});
  return stageDbPromise;
}
function openVaultDb(){
  if(vaultDbPromise)return vaultDbPromise;
  vaultDbPromise=new Promise((resolve,reject)=>{
    if(!('indexedDB'in globalThis))return reject(new Error('INDEXEDDB_UNAVAILABLE'));
    const req=indexedDB.open(VAULT_DB_NAME);
    req.onsuccess=()=>{
      const db=req.result;
      for(const name of [META_STORE,BLOB_STORE,MANIFEST_STORE,CAS_STORE])if(!db.objectStoreNames.contains(name)){db.close();vaultDbPromise=null;return reject(new Error('VAULT_TRANSACTION_STORE_MISSING:'+name));}
      db.onversionchange=()=>{db.close();vaultDbPromise=null;};
      resolve(db);
    };
    req.onerror=()=>reject(req.error||new Error('VAULT_TRANSACTION_DB_OPEN_FAILED'));
  }).catch(error=>{vaultDbPromise=null;throw error;});
  return vaultDbPromise;
}
async function stagePut(value){const db=await openStageDb();return new Promise((resolve,reject)=>{const tx=db.transaction(STAGE_STORE,'readwrite');tx.objectStore(STAGE_STORE).put(value);tx.oncomplete=()=>resolve(copy({...value,blob:undefined}));tx.onerror=()=>reject(tx.error);});}
async function stageAll(){const db=await openStageDb();return new Promise((resolve,reject)=>{const req=db.transaction(STAGE_STORE,'readonly').objectStore(STAGE_STORE).getAll();req.onsuccess=()=>resolve(req.result||[]);req.onerror=()=>reject(req.error);});}
async function stageDeleteIds(ids){if(!ids.length)return 0;const db=await openStageDb();return new Promise((resolve,reject)=>{const tx=db.transaction(STAGE_STORE,'readwrite'),store=tx.objectStore(STAGE_STORE);for(const id of ids)store.delete(id);tx.oncomplete=()=>resolve(ids.length);tx.onerror=()=>reject(tx.error);});}

function inlineBlob(asset){if(!asset.inlineManifest)return null;return new Blob([JSON.stringify(asset.inlineManifest)],{type:'application/json'});}
async function acquireBlob(asset,{useExistingBlob=false,sourceDigest=null}={}){
  const digest=normalizeDigest(sourceDigest);
  if(digest){const blob=await getBlobByDigest(digest);if(!blob)throw new Error('PACK_STAGE_CAS_BLOB_MISSING:'+asset.id+':'+digest);return{blob,network:false,sourceDigest:digest};}
  if(useExistingBlob){const blob=await getBlob(asset.id);if(!blob)throw new Error('PACK_STAGE_EXISTING_BLOB_MISSING:'+asset.id);return{blob,network:false,sourceDigest:null};}
  let blob=inlineBlob(asset);
  if(!blob){if(!asset.downloadUrl)throw new Error('PACK_STAGE_DOWNLOAD_URL_MISSING:'+asset.id);const response=await fetch(asset.downloadUrl,{mode:'cors',cache:'force-cache'});if(!response.ok)throw new Error('PACK_STAGE_DOWNLOAD_'+response.status+':'+asset.id);blob=await response.blob();}
  return{blob,network:true,sourceDigest:null};
}

export async function stagePackMember(input,{transactionId,integrate=true,useExistingBlob=false,sourceDigest=null}={}){
  transactionId=clean(transactionId);if(!transactionId)throw new Error('PACK_TRANSACTION_ID_REQUIRED');
  const asset=normalizeAssetMeta(input),decision=licenseDecision(asset);if(!decision.allowed)throw new Error('ASSET_LICENSE_REVIEW_REQUIRED:'+asset.license);
  const acquired=await acquireBlob(asset,{useExistingBlob,sourceDigest}),blob=acquired.blob;
  const mime=(blob.type||asset.mime||'').toLowerCase();if(mime&&!ALLOWED_MIME.has(mime))throw new Error('ASSET_UNSUPPORTED_MIME:'+mime);if(!blob.size)throw new Error('ASSET_EMPTY_DOWNLOAD');
  const digest=await sha256Blob(blob),expected=normalizeDigest(asset.expectedSha256);if(expected&&digest!==expected)throw new Error('ASSET_INTEGRITY_MISMATCH:'+asset.id);
  if(acquired.sourceDigest&&digest!==acquired.sourceDigest)throw new Error('PACK_STAGE_CAS_DIGEST_MISMATCH:'+asset.id);
  const pointer=await getBlobPointer(asset.id),baseDigest=normalizeDigest(pointer?.digest);
  let result=null;if(integrate)result=await integrateContentBlob(asset,blob);
  const row={id:keyFor(transactionId,asset.id),transactionId,assetId:asset.id,remove:false,baseDigest,digest,bytes:blob.size,mime:mime||null,blob,asset:{...asset,contentKind:result?.kind||asset.contentKind,downloaded:true,integrated:!!result,bytes:blob.size,mime:mime||asset.mime,sha256:digest,compiler:result?.compiler||null},manifest:result?.manifest||null,contentKind:result?.kind||asset.contentKind,compiler:result?.compiler||null,integrated:!!result,network:acquired.network,sourceDigest:acquired.sourceDigest,stagedAt:now()};
  await stagePut(row);const summary={transactionId,assetId:asset.id,remove:false,baseDigest,digest,bytes:blob.size,mime:mime||null,integrated:!!result,contentKind:row.contentKind,compiler:row.compiler,network:acquired.network,sourceDigest:acquired.sourceDigest};emit('kelo:pack-member-staged',summary);return summary;
}

export async function stagePackRemoval(assetId,{transactionId}={}){
  transactionId=clean(transactionId);assetId=clean(assetId);if(!transactionId)throw new Error('PACK_TRANSACTION_ID_REQUIRED');if(!assetId)throw new Error('PACK_TRANSACTION_ASSET_ID_REQUIRED');
  const [asset,pointer]=await Promise.all([getAsset(assetId),getBlobPointer(assetId)]),baseDigest=normalizeDigest(pointer?.digest);
  const row={id:keyFor(transactionId,assetId),transactionId,assetId,remove:true,baseDigest,digest:null,bytes:0,mime:null,blob:null,asset:asset||{id:assetId},manifest:null,contentKind:asset?.contentKind||'other',compiler:null,integrated:false,network:false,stagedAt:now()};
  await stagePut(row);const summary={transactionId,assetId,remove:true,baseDigest,digest:null,bytes:0,network:false};emit('kelo:pack-member-staged',summary);return summary;
}

export async function listStagedPackMembers(transactionId){
  transactionId=clean(transactionId);const rows=(await stageAll()).filter(row=>row.transactionId===transactionId);
  return rows.map(row=>copy({...row,blob:undefined,manifest:row.manifest||null}));
}
async function rawStagedPackMembers(transactionId){transactionId=clean(transactionId);return(await stageAll()).filter(row=>row.transactionId===transactionId);}

export async function abortStagedPack(transactionId){
  const rows=await rawStagedPackMembers(transactionId),deleted=await stageDeleteIds(rows.map(row=>row.id));
  const report={transactionId:clean(transactionId),deleted,abortedAt:now()};emit('kelo:pack-transaction-aborted',report);return report;
}

export async function commitStagedPack(transactionId){
  transactionId=clean(transactionId);if(!transactionId)throw new Error('PACK_TRANSACTION_ID_REQUIRED');
  const rows=await rawStagedPackMembers(transactionId);if(!rows.length)return{transactionId,committed:0,removed:0,assets:[],committedAt:now()};
  const current=[];
  for(const row of rows){
    const [meta,pointer]=await Promise.all([getAsset(row.assetId),getBlobPointer(row.assetId)]);
    const currentDigest=normalizeDigest(pointer?.digest),baseDigest=normalizeDigest(row.baseDigest);
    if(currentDigest!==baseDigest)throw new Error(`PACK_TRANSACTION_POINTER_DRIFT:${row.assetId}:${currentDigest||'none'}!=${baseDigest||'none'}`);
    current.push({row,meta,pointer});
  }
  const db=await openVaultDb(),committedAt=now(),committedAssets=[];
  await new Promise((resolve,reject)=>{
    const tx=db.transaction([META_STORE,BLOB_STORE,MANIFEST_STORE,CAS_STORE],'readwrite');
    const metas=tx.objectStore(META_STORE),pointers=tx.objectStore(BLOB_STORE),manifests=tx.objectStore(MANIFEST_STORE),cas=tx.objectStore(CAS_STORE);
    tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error||new Error('PACK_TRANSACTION_COMMIT_FAILED'));tx.onabort=()=>reject(tx.error||new Error('PACK_TRANSACTION_COMMIT_ABORTED'));
    try{
      for(const item of current){
        const {row,meta,pointer}=item;
        if(row.remove){
          pointers.delete(row.assetId);manifests.delete(row.assetId);
          const next=meta?normalizeAssetMeta({...meta,downloaded:false,integrated:false,bytes:0,mime:null,sha256:null,downloadedAt:null,integratedAt:null,compiler:null,rollbackActive:false,updatedAt:committedAt}):null;
          if(next)metas.put(next);
          committedAssets.push({asset:next||{id:row.assetId},manifest:null,contentKind:meta?.contentKind||row.contentKind,digest:null,previousDigest:normalizeDigest(pointer?.digest),removed:true});
          continue;
        }
        const previousDigest=pointer?.digest&&normalizeDigest(pointer.digest)!==normalizeDigest(row.digest)?normalizeDigest(pointer.digest):(pointer?.previousDigest||null);
        cas.put({digest:row.digest,blob:row.blob,bytes:row.bytes,mime:row.mime,createdAt:committedAt,updatedAt:committedAt,orphanedAt:null});
        pointers.put({id:row.assetId,digest:row.digest,previousDigest,bytes:row.bytes,mime:row.mime,storage:'cas-v2',updatedAt:committedAt});
        const ownership=meta?.ownership==='purchased'||row.asset?.ownership==='purchased'?'purchased':'free';
        const next=normalizeAssetMeta({...meta,...row.asset,ownership,downloaded:true,integrated:row.integrated,bytes:row.bytes,mime:row.mime,sha256:row.digest,rollbackActive:!!previousDigest,downloadedAt:committedAt,integratedAt:row.integrated?committedAt:null,compiler:row.compiler||null,updatedAt:committedAt});
        metas.put(next);
        if(row.integrated&&row.manifest)manifests.put({id:row.assetId,manifest:row.manifest,updatedAt:committedAt});else manifests.delete(row.assetId);
        committedAssets.push({asset:next,manifest:row.manifest,contentKind:row.contentKind,digest:row.digest,previousDigest,removed:false});
      }
    }catch(error){try{tx.abort();}catch{}reject(error);}
  });
  for(const item of committedAssets){
    releaseObjectURL(item.asset.id);
    if(item.removed){emit('kelo:personal-content-local-removed',{asset:item.asset,transactionId,atomic:true});emit('kelo:personal-asset-local-removed',{asset:item.asset,transactionId,atomic:true});continue;}
    emit('kelo:personal-content-downloaded',{asset:item.asset,digest:item.digest,transactionId,atomic:true});
    if(item.asset.integrated){emit('kelo:personal-content-integrated',{asset:item.asset,manifest:item.manifest,contentKind:item.contentKind,transactionId,atomic:true});if(['image','sprite','tileset','animation','vfx'].includes(item.contentKind))emit('kelo:personal-asset-integrated',{asset:item.asset,manifest:item.manifest,transactionId,atomic:true});}
  }
  await stageDeleteIds(rows.map(row=>row.id));
  const report={transactionId,committed:committedAssets.filter(item=>!item.removed).length,removed:committedAssets.filter(item=>item.removed).length,assets:committedAssets.map(item=>({id:item.asset.id,digest:item.digest,previousDigest:item.previousDigest,bytes:item.asset.bytes||0,integrated:!!item.asset.integrated,removed:item.removed})),committedAt};emit('kelo:pack-transaction-committed',report);return report;
}

export async function inspectStagingStorage(){
  const rows=await stageAll(),transactions=new Map();let bytes=0;
  for(const row of rows){bytes+=Number(row.bytes||row.blob?.size||0);const current=transactions.get(row.transactionId)||{transactionId:row.transactionId,members:0,bytes:0,oldest:row.stagedAt,newest:row.stagedAt};current.members++;current.bytes+=Number(row.bytes||row.blob?.size||0);if(String(row.stagedAt)<String(current.oldest))current.oldest=row.stagedAt;if(String(row.stagedAt)>String(current.newest))current.newest=row.stagedAt;transactions.set(row.transactionId,current);}
  return{members:rows.length,bytes,transactions:[...transactions.values()]};
}
export async function cleanupStaleStaging({olderThanMs=24*60*60*1000,activeTransactionIds=[]}={}){
  const keep=new Set((activeTransactionIds||[]).map(String)),cutoff=Date.now()-Math.max(0,Number(olderThanMs)||0),rows=await stageAll(),stale=rows.filter(row=>!keep.has(String(row.transactionId))&&Date.parse(row.stagedAt||0)<cutoff);
  const deleted=await stageDeleteIds(stale.map(row=>row.id)),report={deleted,bytes:stale.reduce((n,row)=>n+Number(row.bytes||row.blob?.size||0),0),cleanedAt:now()};emit('kelo:pack-staging-cleaned',report);return report;
}

export const CONTENT_PACK_TRANSACTION=Object.freeze({stagePackMember,stagePackRemoval,listStagedPackMembers,abortStagedPack,commitStagedPack,inspectStagingStorage,cleanupStaleStaging});
if(typeof window!=='undefined')window.KELO_CONTENT_PACK_TRANSACTION=CONTENT_PACK_TRANSACTION;
