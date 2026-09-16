/* KELO-INDEX
 * area: CREATORS / PIXELORAMA PERSISTENCE
 * owner: Kelo Creators repository boundary
 * keys: PIXELORAMA PXO INDEXEDDB STORAGE QUOTA PERSIST REVISION MEMORY
 * purpose: guarda proyectos .pxo dentro del navegador con revisiones acotadas y reporta cuota sin mantener buffers residentes
 * public-api: createPixeloramaProjectStore/requestCreatorPersistentStorage
 * consumes: IndexedDB + StorageManager
 * state-owned: blobs .pxo locales de authoring; no assets publicados ni economía
 * extension-points: backend futuro puede reemplazar este repository sin cambiar el bridge/UI
 * online: local draft fallback; publicación remota futura pasa por autoridad separada
 * do-not: NO guardar secretos, NO mantener ArrayBuffer global, NO crecimiento de revisiones sin límite
 */

const DB_NAME='kelo-pixelorama-projects-v1';
const DB_VERSION=1;
const STORE='revisions';
const MAX_REVISIONS_DEFAULT=5;
const MAX_PROJECT_BYTES=64*1024*1024;

function openDb(root){
  return new Promise((resolve,reject)=>{
    if(!root.indexedDB)return reject(new Error('INDEXEDDB_UNAVAILABLE'));
    const req=root.indexedDB.open(DB_NAME,DB_VERSION);
    req.onupgradeneeded=()=>{
      const db=req.result;
      if(db.objectStoreNames.contains(STORE))return;
      const store=db.createObjectStore(STORE,{keyPath:'key'});
      store.createIndex('assetId','assetId',{unique:false});
      store.createIndex('updatedAt','updatedAt',{unique:false});
    };
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error||new Error('PIXELORAMA_STORE_OPEN_FAILED'));
  });
}
function txDone(tx){return new Promise((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error||new Error('PIXELORAMA_STORE_TX_FAILED'));tx.onabort=()=>reject(tx.error||new Error('PIXELORAMA_STORE_TX_ABORTED'));});}
function requestResult(req){return new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error||new Error('PIXELORAMA_STORE_REQUEST_FAILED'));});}

export async function requestCreatorPersistentStorage(root=globalThis){
  const storage=root.navigator?.storage;
  let persisted=null,granted=null,estimate=null;
  try{persisted=typeof storage?.persisted==='function'?await storage.persisted():null;}catch{}
  if(persisted===false&&typeof storage?.persist==='function'){try{granted=await storage.persist();persisted=granted===true;}catch{}}
  try{estimate=typeof storage?.estimate==='function'?await storage.estimate():null;}catch{}
  return Object.freeze({persisted,granted,usage:Number(estimate?.usage)||0,quota:Number(estimate?.quota)||0});
}

export function createPixeloramaProjectStore({root=globalThis,maxRevisions=MAX_REVISIONS_DEFAULT}={}){
  const limit=Math.max(1,Math.min(20,Math.floor(Number(maxRevisions)||MAX_REVISIONS_DEFAULT)));
  let dbPromise=null;
  const db=()=>dbPromise||(dbPromise=openDb(root));

  async function list(assetId){
    const target=String(assetId||'').trim();if(!target)return [];
    const database=await db();
    const rows=await requestResult(database.transaction(STORE,'readonly').objectStore(STORE).index('assetId').getAll(target));
    return rows.sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt)));
  }
  async function trim(assetId){
    const rows=await list(assetId);if(rows.length<=limit)return 0;
    const database=await db(),tx=database.transaction(STORE,'readwrite'),store=tx.objectStore(STORE);
    for(const row of rows.slice(limit))store.delete(row.key);
    await txDone(tx);return rows.length-limit;
  }
  async function save({assetId='untitled',name='project.pxo',blob,metadata=null}={}){
    if(!(blob instanceof Blob))throw new TypeError('PIXELORAMA_PROJECT_BLOB_REQUIRED');
    if(blob.size>MAX_PROJECT_BYTES)throw new Error('PIXELORAMA_PROJECT_TOO_LARGE');
    const id=String(assetId||'untitled'),updatedAt=new Date().toISOString(),key=`${id}:${updatedAt}:${Math.random().toString(36).slice(2,7)}`;
    const record={key,assetId:id,name:String(name||'project.pxo'),blob,bytes:blob.size,updatedAt,metadata:metadata&&typeof metadata==='object'?{...metadata}:null};
    const database=await db(),tx=database.transaction(STORE,'readwrite');tx.objectStore(STORE).put(record);await txDone(tx);await trim(id);return Object.freeze({...record,blob:undefined});
  }
  async function latest(assetId){const rows=await list(assetId);return rows[0]||null;}
  async function removeAsset(assetId){
    const rows=await list(assetId);if(!rows.length)return 0;
    const database=await db(),tx=database.transaction(STORE,'readwrite'),store=tx.objectStore(STORE);for(const row of rows)store.delete(row.key);await txDone(tx);return rows.length;
  }
  function close(){if(!dbPromise)return;dbPromise.then(database=>database.close()).catch(()=>{});dbPromise=null;}
  return Object.freeze({save,list,latest,removeAsset,close,maxRevisions:limit,maxProjectBytes:MAX_PROJECT_BYTES});
}
