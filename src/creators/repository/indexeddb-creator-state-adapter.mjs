/* KELO-INDEX
 * area: CREATORS / LOCAL STATE ADAPTER
 * owner: local CreatorProject repository persistence primitive
 * owns: one opaque Creator repository state record for offline/prototype persistence
 * does-not-own: project semantics, workspace documents, Studio recovery, publish authority or networking
 * online: replace the repository/state adapter with remote infrastructure; workspaces remain unchanged
 */
const copy=value=>value==null?value:(typeof structuredClone==='function'?structuredClone(value):JSON.parse(JSON.stringify(value)));
export function createIndexedDbCreatorStateAdapter({indexedDBFactory=globalThis.indexedDB,dbName='kelo-creators-v1'}={}){
  let memory={projects:[],drafts:{}},dbPromise=null;
  function open(){
    if(!indexedDBFactory)return Promise.resolve(null);
    if(dbPromise)return dbPromise;
    dbPromise=new Promise((resolve,reject)=>{const request=indexedDBFactory.open(dbName,1);request.onupgradeneeded=()=>{const db=request.result;if(!db.objectStoreNames.contains('state'))db.createObjectStore('state',{keyPath:'key'});};request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error||new Error('CREATOR_INDEXEDDB_OPEN_FAILED'));});
    return dbPromise;
  }
  async function load(){
    const db=await open();if(!db)return copy(memory);
    return new Promise((resolve,reject)=>{const tx=db.transaction('state','readonly'),request=tx.objectStore('state').get('repository');request.onsuccess=()=>{const state=request.result?.value||memory;memory=copy(state);resolve(copy(memory));};request.onerror=()=>reject(request.error||new Error('CREATOR_INDEXEDDB_LOAD_FAILED'));});
  }
  async function save(state){
    memory=copy(state||{projects:[],drafts:{}});const db=await open();if(!db)return copy(memory);
    await new Promise((resolve,reject)=>{const tx=db.transaction('state','readwrite');tx.objectStore('state').put({key:'repository',updatedAt:Date.now(),value:copy(memory)});tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error||new Error('CREATOR_INDEXEDDB_SAVE_FAILED'));});return copy(memory);
  }
  async function close(){const db=await open();db?.close?.();dbPromise=null;}
  return Object.freeze({version:'creator-indexeddb-state-v1.0.0',load,save,close});
}
