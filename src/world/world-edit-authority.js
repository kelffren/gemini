/* KELO-INDEX
 * area: WORLD EDIT
 * keys: AUTHORITY FACADE REQUEST LOCAL REMOTE VIEW PROJECTION PROPERTY RUNTIME
 * hace: única boca pública KELO_WORLD_EDIT; aplica snapshots a renderer/Property y permite cambiar autoridad sin tocar UI
 * online: installAuthority(new RemoteWorldEditAuthority(transport)) cambia backend manteniendo el mismo contrato
 */
(function(){
'use strict';
if(window.KELO_WORLD_EDIT)return;

const VERSION='world-edit-authority-v1.0.0';
const WORLD_PARCEL_ID='parcel:world:editor';
const listeners=new Set();
const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));
let authority=null;
let currentView={kind:'boot',id:null,worldId:'world:kelo-main',revisionVersion:0,publishedRevisionId:null};
let lastError=null;

function propertySystem(){return window.KELO_PROPERTY_SYSTEM||null;}
function worldBuilder(){return window.KELO_WORLD_BUILDER||null;}
function layoutsEqual(a,b){
  const norm=rows=>(Array.isArray(rows)?rows:[]).map(r=>({
    placementId:String(r.placementId||''),assetId:String(r.assetId||''),x:Number(r.x)||0,y:Number(r.y)||0,
    rotation:((Math.floor(Number(r.rotation)||0)%4)+4)%4
  })).sort((x,y)=>x.placementId.localeCompare(y.placementId));
  return JSON.stringify(norm(a))===JSON.stringify(norm(b));
}
async function ensureWorldParcel(){
  const S=propertySystem();if(!S)return null;
  const existing=S.parcel?.(WORLD_PARCEL_ID);if(existing)return existing;
  return S.request('ensureWorldEditorParcel',{ownerId:'developer'});
}
async function projectView(snapshot,meta={},forcePlacements=false){
  if(!snapshot)return;
  const WB=worldBuilder();
  if(WB?.ingestViewSnapshot)WB.ingestViewSnapshot(snapshot,meta||{});
  const S=propertySystem();
  if(S){
    await ensureWorldParcel();
    const target=Array.isArray(snapshot.placements)?snapshot.placements:[];
    const current=S.getPlacements?.(WORLD_PARCEL_ID)||[];
    if(forcePlacements||!layoutsEqual(current,target)){
      await S.request('replaceLayout',{parcelId:WORLD_PARCEL_ID,placements:target,developer:true});
    }
  }
  currentView=Object.assign({},currentView,clone(meta||{}));
}
function emit(event){
  for(const fn of listeners){try{fn(clone(event));}catch(e){}}
}
function normalizeAuthority(adapter){
  if(!adapter||typeof adapter.request!=='function')throw new Error('INVALID_WORLD_EDIT_AUTHORITY');
  return adapter;
}
async function request(op,payload={}){
  if(!authority)throw new Error('WORLD_EDIT_AUTHORITY_NOT_READY');
  try{
    const result=await authority.request(String(op),payload||{});
    if(result?.viewSnapshot){
      await projectView(result.viewSnapshot,result.viewMeta||{},result.projectPlacements===true);
    }
    lastError=null;emit({type:'request',op:String(op),result:clone(result),view:clone(currentView)});
    return result;
  }catch(err){
    lastError=String(err?.message||err);emit({type:'error',op:String(op),error:lastError,view:clone(currentView)});throw err;
  }
}
async function installAuthority(adapter){
  authority=normalizeAuthority(adapter);
  const result=await request('world:published:get',{});
  emit({type:'authority',source:authoritySource(),view:clone(currentView)});
  return result;
}
function authoritySource(){return String(authority?.source||'custom');}
async function boot(){
  if(!window.LocalWorldEditAuthority){setTimeout(boot,40);return;}
  try{
    authority=new window.LocalWorldEditAuthority();
    await request('world:published:get',{});
  }catch(err){
    lastError=String(err?.message||err);
    console.error('[Kelo world edit] boot failed',err);
  }
}

window.KELO_WORLD_EDIT=Object.freeze({
  version:VERSION,
  request,
  installAuthority,
  authoritySource,
  getCurrentDraft:async()=>request('world:draft:current',{}),
  getPublishedRevision:async()=>request('world:published:meta',{}),
  listRevisions:async()=>request('world:revision:list',{}),
  listDrafts:async()=>request('world:draft:list',{}),
  getViewState:()=>clone(currentView),
  get lastError(){return lastError;},
  onChange(fn){if(typeof fn!=='function')return()=>{};listeners.add(fn);return()=>listeners.delete(fn);},
  get ready(){return !!authority;}
});
window.KELO_WORLD_EDIT_AUDIT=Object.freeze({
  version:VERSION,
  singleRequestBoundary:true,
  localRemoteSwitch:true,
  uiStorageFree:true,
  uiTransportFree:true,
  publishedProjectionOnBoot:true,
  propertySourceOfTruth:true
});

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,0),{once:true});else setTimeout(boot,0);
})();
