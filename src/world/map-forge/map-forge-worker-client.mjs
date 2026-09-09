/* KELO-INDEX
 * area: WORLD / MAP FORGE / WORKER CLIENT
 * owner: KeloMapForge worker client
 * purpose: async best-of-N generation with Worker first, deterministic sync fallback and shared catalog asset binding
 * public-api: createMapForgeWorkerClient()
 * consumes: map-forge-worker.mjs + pure core fallback + KELO_PROPERTY_CATALOG snapshot through asset-binding adapter
 * state-owned: pending request promises only
 * do-not: no world mutation, renderer, collision or gameplay ownership
 */
import { MAP_FORGE_RECIPES } from './map-forge-recipes.mjs';
import { generateBestOf } from './map-forge-core.mjs';
import { hashString } from './map-forge-prng.mjs';
import { bindMapForgeAssets,buildMapForgeCatalogSnapshot } from './map-forge-asset-binding.mjs';

function catalogContext(root){
  const catalog=buildMapForgeCatalogSnapshot(root.KELO_PROPERTY_CATALOG),base=String(root.KELO_PROPERTY_CATALOG?.version||'property-catalog');
  const version=`${base}+${catalog.length}-${hashString(catalog.map(row=>row.id).join('|')).slice(0,12)}`;
  return{catalog,version};
}
function bindRun(raw,root,catalog,version){
  if(!raw||!catalog.length)return raw;
  const cache=new Map(),bind=map=>{
    if(!map)return null;const key=String(map.metadata?.layoutHash||'');
    if(cache.has(key))return cache.get(key);
    const next=bindMapForgeAssets(map,catalog,{catalogVersion:version});cache.set(key,next);return next;
  };
  const selections=Object.fromEntries(Object.entries(raw.selections||{}).map(([key,map])=>[key,bind(map)]));
  return Object.freeze({...raw,best:bind(raw.best),candidates:Object.freeze((raw.candidates||[]).map(bind)),selections:Object.freeze(selections)});
}

export function createMapForgeWorkerClient({root=globalThis,timeoutMs=15000}={}){
  let worker=null,seq=0,closed=false;const pending=new Map();
  try{if(typeof root.Worker==='function')worker=new root.Worker(new URL('./map-forge-worker.mjs',import.meta.url),{type:'module',name:'kelo-map-forge'});}catch{worker=null;}
  if(worker){
    worker.onmessage=event=>{const m=event?.data||{},row=pending.get(String(m.id||''));if(!row)return;pending.delete(String(m.id));clearTimeout(row.timer);m.ok?row.resolve(bindRun(m.result,root,row.catalog,row.catalogVersion)):row.reject(new Error(m.error||'MAP_FORGE_WORKER_FAILED'));};
    worker.onerror=event=>{const e=new Error(event?.message||'MAP_FORGE_WORKER_CRASHED');for(const row of pending.values()){clearTimeout(row.timer);row.reject(e);}pending.clear();try{worker.terminate();}catch{}worker=null;};
  }
  async function generate(recipeId,options={}){
    if(closed)throw new Error('MAP_FORGE_WORKER_CLIENT_CLOSED');
    const recipe=MAP_FORGE_RECIPES[String(recipeId||'')];if(!recipe)throw new Error(`MAP_FORGE_RECIPE_NOT_FOUND:${recipeId||''}`);
    const {catalog,version:catalogVersion}=catalogContext(root),resolvedOptions={...options,assetCatalogVersion:catalogVersion};
    if(!worker)return bindRun(generateBestOf(recipe,resolvedOptions),root,catalog,catalogVersion);
    const id=`mf:${++seq}`;
    return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(id);reject(new Error('MAP_FORGE_WORKER_TIMEOUT'));},timeoutMs);pending.set(id,{resolve,reject,timer,catalog,catalogVersion});worker.postMessage({id,type:'generate',recipeId:recipe.id,options:resolvedOptions});});
  }
  function close(){if(closed)return;closed=true;for(const row of pending.values()){clearTimeout(row.timer);row.reject(new Error('MAP_FORGE_WORKER_CLIENT_CLOSED'));}pending.clear();try{worker?.terminate();}catch{}worker=null;}
  return Object.freeze({version:'map-forge-worker-client-v1.1.0',generate,close,get mode(){return worker?'worker':'sync-fallback';}});
}
