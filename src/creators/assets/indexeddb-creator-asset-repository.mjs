/* KELO-INDEX
 * area: CREATORS / ASSETS / REPOSITORY
 * owner: local Creator Asset repository adapter
 * purpose: persist immutable manual asset revisions (metadata + Blob) for the offline/prototype Creator library
 * public-api: createIndexedDbCreatorAssetRepository()
 * state-owned: local authoring asset revision records only
 * does-not-own: runtime catalog, world placements, permissions, review policy or online publish authority
 * online: replace this repository adapter with remote storage; Creator Asset Library API and asset IDs remain unchanged
 */

const cloneValue=value=>{
  if(value==null)return value;
  if(typeof structuredClone==='function')return structuredClone(value);
  return value;
};

export function createIndexedDbCreatorAssetRepository({indexedDBFactory=globalThis.indexedDB,dbName='kelo-creator-assets-v1'}={}){
  const memory=new Map();
  let dbPromise=null;

  function open(){
    if(!indexedDBFactory)return Promise.resolve(null);
    if(dbPromise)return dbPromise;
    dbPromise=new Promise((resolve,reject)=>{
      const request=indexedDBFactory.open(dbName,1);
      request.onupgradeneeded=()=>{
        const db=request.result;
        if(!db.objectStoreNames.contains('assets')){
          const store=db.createObjectStore('assets',{keyPath:'assetId'});
          store.createIndex('ownerId','ownerId',{unique:false});
          store.createIndex('status','status',{unique:false});
          store.createIndex('familyId','familyId',{unique:false});
        }
      };
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(request.error||new Error('CREATOR_ASSET_INDEXEDDB_OPEN_FAILED'));
    });
    return dbPromise;
  }

  async function put(record){
    if(!record?.assetId)throw new Error('CREATOR_ASSET_ID_REQUIRED');
    const row=cloneValue(record);
    const db=await open();
    if(!db){memory.set(String(row.assetId),row);return cloneValue(row);}
    await new Promise((resolve,reject)=>{
      const tx=db.transaction('assets','readwrite');
      tx.objectStore('assets').put(row);
      tx.oncomplete=resolve;
      tx.onerror=()=>reject(tx.error||new Error('CREATOR_ASSET_SAVE_FAILED'));
    });
    return cloneValue(row);
  }

  async function get(assetId){
    const id=String(assetId||'');
    const db=await open();
    if(!db)return cloneValue(memory.get(id)||null);
    return new Promise((resolve,reject)=>{
      const tx=db.transaction('assets','readonly');
      const request=tx.objectStore('assets').get(id);
      request.onsuccess=()=>resolve(cloneValue(request.result||null));
      request.onerror=()=>reject(request.error||new Error('CREATOR_ASSET_READ_FAILED'));
    });
  }

  async function list(filter={}){
    const db=await open();
    let rows;
    if(!db)rows=Array.from(memory.values()).map(cloneValue);
    else rows=await new Promise((resolve,reject)=>{
      const tx=db.transaction('assets','readonly');
      const request=tx.objectStore('assets').getAll();
      request.onsuccess=()=>resolve((request.result||[]).map(cloneValue));
      request.onerror=()=>reject(request.error||new Error('CREATOR_ASSET_LIST_FAILED'));
    });
    if(filter.ownerId!=null)rows=rows.filter(row=>String(row.ownerId)===String(filter.ownerId));
    if(filter.status)rows=rows.filter(row=>String(row.status)===String(filter.status));
    if(filter.familyId)rows=rows.filter(row=>String(row.familyId)===String(filter.familyId));
    return rows.sort((a,b)=>(Number(b.createdAt)||0)-(Number(a.createdAt)||0)||String(a.assetId).localeCompare(String(b.assetId)));
  }

  async function remove(assetId){
    const id=String(assetId||'');
    const db=await open();
    if(!db)return memory.delete(id);
    await new Promise((resolve,reject)=>{
      const tx=db.transaction('assets','readwrite');
      tx.objectStore('assets').delete(id);
      tx.oncomplete=resolve;
      tx.onerror=()=>reject(tx.error||new Error('CREATOR_ASSET_DELETE_FAILED'));
    });
    return true;
  }

  async function close(){
    const db=await open();
    db?.close?.();
    dbPromise=null;
  }

  return Object.freeze({version:'creator-asset-repository-v1.0.0',put,get,list,remove,close});
}
