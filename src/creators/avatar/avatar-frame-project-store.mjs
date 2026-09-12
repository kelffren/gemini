/* KELO-INDEX
 * area: CREATORS / AVATAR / FRAME PROJECT STORE
 * owner: local draft persistence for 4x4 frame projects and immutable source blobs
 * keys: SPRITE INDEXEDDB AUTOSAVE DRAFT BLOB
 * online: local authoring cache only; published content still uses Avatar Quick Import service
 */
const F=Object.freeze;
const DB_NAME='kelo-avatar-frame-projects-v1',DB_VERSION=1,PROJECTS='projects',SOURCES='sources';
const memoryByRoot=new WeakMap();
const clone=value=>typeof structuredClone==='function'?structuredClone(value):JSON.parse(JSON.stringify(value));
function memory(root){let state=memoryByRoot.get(root);if(!state){state={projects:new Map(),sources:new Map()};memoryByRoot.set(root,state);}return state;}
function request(request){return new Promise((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error||new Error('FRAME_PROJECT_IDB_REQUEST_FAILED'));});}
function transactionDone(tx){return new Promise((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error||new Error('FRAME_PROJECT_IDB_TX_FAILED'));tx.onabort=()=>reject(tx.error||new Error('FRAME_PROJECT_IDB_TX_ABORTED'));});}
async function openDb(root){
  if(!root?.indexedDB)return null;
  return new Promise((resolve,reject)=>{const req=root.indexedDB.open(DB_NAME,DB_VERSION);req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(PROJECTS))db.createObjectStore(PROJECTS,{keyPath:'id'});if(!db.objectStoreNames.contains(SOURCES))db.createObjectStore(SOURCES,{keyPath:'key'});};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error||new Error('FRAME_PROJECT_IDB_OPEN_FAILED'));});
}

export function createAvatarFrameProjectStore({root=globalThis}={}){
  async function saveProject(project){if(!project?.id)throw new Error('FRAME_PROJECT_ID_REQUIRED');const value=clone(project),db=await openDb(root);if(!db){memory(root).projects.set(project.id,value);return clone(value);}const tx=db.transaction(PROJECTS,'readwrite');tx.objectStore(PROJECTS).put(value);await transactionDone(tx);db.close();return clone(value);}
  async function loadProject(id){const db=await openDb(root);if(!db)return clone(memory(root).projects.get(id)||null);const tx=db.transaction(PROJECTS,'readonly'),value=await request(tx.objectStore(PROJECTS).get(id));await transactionDone(tx);db.close();return value?clone(value):null;}
  async function listProjects(){const db=await openDb(root);if(!db)return [...memory(root).projects.values()].map(clone).sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0));const tx=db.transaction(PROJECTS,'readonly'),values=await request(tx.objectStore(PROJECTS).getAll());await transactionDone(tx);db.close();return values.map(clone).sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0));}
  async function deleteProject(id,{deleteSources=false}={}){const existing=deleteSources?await loadProject(id):null,db=await openDb(root);if(!db){memory(root).projects.delete(id);if(deleteSources)for(const slot of existing?.slots||[])if(slot.sourceKey)memory(root).sources.delete(slot.sourceKey);return;}const tx=db.transaction(deleteSources?[PROJECTS,SOURCES]:[PROJECTS],'readwrite');tx.objectStore(PROJECTS).delete(id);if(deleteSources)for(const slot of existing?.slots||[])if(slot.sourceKey)tx.objectStore(SOURCES).delete(slot.sourceKey);await transactionDone(tx);db.close();}
  async function putSource(key,blob,metadata={}){if(!key||!blob)throw new Error('FRAME_PROJECT_SOURCE_REQUIRED');const value={key:String(key),blob,metadata:{...metadata},updatedAt:Date.now()},db=await openDb(root);if(!db){memory(root).sources.set(value.key,value);return value;}const tx=db.transaction(SOURCES,'readwrite');tx.objectStore(SOURCES).put(value);await transactionDone(tx);db.close();return value;}
  async function getSource(key){const db=await openDb(root);if(!db)return memory(root).sources.get(String(key))||null;const tx=db.transaction(SOURCES,'readonly'),value=await request(tx.objectStore(SOURCES).get(String(key)));await transactionDone(tx);db.close();return value||null;}
  async function removeSource(key){const db=await openDb(root);if(!db){memory(root).sources.delete(String(key));return;}const tx=db.transaction(SOURCES,'readwrite');tx.objectStore(SOURCES).delete(String(key));await transactionDone(tx);db.close();}
  return F({version:'avatar-frame-project-store-v1',saveProject,loadProject,listProjects,deleteProject,putSource,getSource,removeSource});
}
