/* KELO-INDEX
 * area: AUTH
 * keys: ADMIN KEY WORLD EDIT CREATOR PERMISSION BACKPACK WORLD BUILDER OFFLINE ONLINE READY PREVIEW
 * hace: modela Llave Admin como entitlement/objeto bound, decide capacidades y arranca las herramientas de autor del mundo
 * online: request() e installRemoteAdapter() permiten sustituir la autoridad local por servidor sin cambiar UI
 */
(function(){
'use strict';

const VERSION='admin-key-v1.2.1';
const SCHEMA=1;
const STORAGE='kelo_admin_keys_v1';
const TEMPLATE_ID='admin-key';
const DEFAULT_CREATOR_SCOPES=Object.freeze(['world.edit','world.export','world.import']);
const ROOT_SCOPES=Object.freeze(['world.edit','world.export','world.import','world.publish','admin.issue','admin.revoke']);
let remoteAdapter=null;
let seq=1;
const listeners=new Set();
const clone=v=>JSON.parse(JSON.stringify(v));
const now=()=>Date.now();
const playerId=()=>String(window.keloNet?.playerKey||window.localPlayer?.id||'local_pioneer');
function fresh(){return{schema:SCHEMA,revision:0,keys:{}};}
function load(){try{const v=JSON.parse(localStorage.getItem(STORAGE)||'null');return v&&v.schema===SCHEMA&&v.keys?v:fresh();}catch(e){return fresh();}}
let state=load();
function persist(){try{localStorage.setItem(STORAGE,JSON.stringify(state));}catch(e){};syncInventory();listeners.forEach(fn=>{try{fn(snapshot());}catch(e){}});}
function bump(){state.revision=(Number(state.revision)||0)+1;persist();}
function snapshot(){return clone(state);}
function newId(){return `admin-key:${Date.now().toString(36)}:${(seq++).toString(36)}`;}
function activeKeys(ownerId){ownerId=String(ownerId||playerId());return Object.values(state.keys).filter(k=>k&&k.active!==false&&k.ownerId===ownerId);}
function hasScope(scope,ownerId){return activeKeys(ownerId).some(k=>Array.isArray(k.scopes)&&k.scopes.includes(scope));}
function can(scope,ownerId){return hasScope(String(scope||''),ownerId);}
function publicKey(k){return k?clone(k):null;}
function keyInventoryRow(k){return{
  id:k.keyId,
  uid:k.keyId,
  templateId:TEMPLATE_ID,
  kind:'admin_key',
  name:k.label||'Llave Admin',
  icon:'🗝',
  rarity:'ADMIN',
  quantity:1,
  maxStack:1,
  bound:true,
  adminKeyId:k.keyId,
  scopes:clone(k.scopes||[]),
  description:'Permiso especial para construir en el mundo principal de Kelo World.'
};}
function syncInventory(){
  if(typeof STATE==='undefined'||!Array.isArray(STATE.inventory))return false;
  const me=playerId();
  const valid=new Map(activeKeys(me).map(k=>[k.keyId,k]));
  let changed=false;
  for(let i=STATE.inventory.length-1;i>=0;i--){const item=STATE.inventory[i];if(item?.kind==='admin_key'&&item?.templateId===TEMPLATE_ID&&!valid.has(String(item.adminKeyId||item.id||''))){STATE.inventory.splice(i,1);changed=true;}}
  for(const [keyId,k] of valid){const existing=STATE.inventory.find(x=>x?.kind==='admin_key'&&String(x.adminKeyId||x.id||'')===keyId);if(existing){existing.scopes=clone(k.scopes||[]);existing.bound=true;existing.name=k.label||'Llave Admin';}else{STATE.inventory.push(keyInventoryRow(k));changed=true;}}
  if(changed){try{window.KeloBackpack?.ensure?.();}catch(e){};try{if(typeof saveState==='function')saveState();}catch(e){}}
  return true;
}
function syncWhenReady(){
  if(syncInventory())return;
  let tries=0;
  const timer=setInterval(()=>{tries++;if(syncInventory()||tries>=20)clearInterval(timer);},50);
}
function requireScope(scope,actorId){if(!can(scope,actorId))throw new Error('ADMIN_KEY_PERMISSION_DENIED');}
async function localRequest(op,payload){
  const data=payload||{},actorId=String(data.actorId||playerId());
  if(op==='admin-key:status')return{ownerId:actorId,hasKey:activeKeys(actorId).length>0,scopes:Array.from(new Set(activeKeys(actorId).flatMap(k=>k.scopes||[]))),keys:activeKeys(actorId).map(publicKey),revision:state.revision};
  if(op==='admin-key:list'){requireScope('admin.issue',actorId);return Object.values(state.keys).map(publicKey);}
  if(op==='admin-key:issue'){
    requireScope('admin.issue',actorId);
    const ownerId=String(data.ownerId||'').trim();if(!ownerId)throw new Error('ADMIN_KEY_OWNER_REQUIRED');
    const scopes=Array.from(new Set((Array.isArray(data.scopes)&&data.scopes.length?data.scopes:DEFAULT_CREATOR_SCOPES).map(String)));
    const keyId=newId();state.keys[keyId]={schema:1,keyId,templateId:TEMPLATE_ID,ownerId,label:String(data.label||'Llave Admin · Creador'),scopes,active:true,issuedBy:actorId,createdAt:now(),revokedAt:null};bump();return publicKey(state.keys[keyId]);
  }
  if(op==='admin-key:revoke'){
    requireScope('admin.revoke',actorId);const keyId=String(data.keyId||'');const k=state.keys[keyId];if(!k)throw new Error('ADMIN_KEY_NOT_FOUND');k.active=false;k.revokedAt=now();k.revokedBy=actorId;bump();return publicKey(k);
  }
  if(op==='admin-key:bootstrap-local-root'){
    if(!data.developer||!new URLSearchParams(location.search).has('mapEditor'))throw new Error('LOCAL_BOOTSTRAP_DISABLED');
    const ownerId=String(data.ownerId||actorId);let k=activeKeys(ownerId).find(x=>(x.scopes||[]).includes('admin.issue'));
    if(!k){const keyId=newId();state.keys[keyId]={schema:1,keyId,templateId:TEMPLATE_ID,ownerId,label:'Llave Admin · Propietario',scopes:Array.from(ROOT_SCOPES),active:true,issuedBy:'offline-bootstrap',createdAt:now(),revokedAt:null};bump();k=state.keys[keyId];}return publicKey(k);
  }
  throw new Error('UNKNOWN_ADMIN_KEY_OPERATION');
}
async function request(op,payload){if(remoteAdapter&&typeof remoteAdapter.request==='function')return remoteAdapter.request(op,payload||{});return localRequest(op,payload||{});}
function installRemoteAdapter(adapter){if(adapter&&typeof adapter.request!=='function')throw new Error('INVALID_ADMIN_KEY_ADAPTER');remoteAdapter=adapter||null;}
function assert(scope,ownerId){requireScope(scope,String(ownerId||playerId()));return true;}
function loadPreviewFix(){
  if(document.getElementById('kelo-world-builder-preview-hotfix-loader'))return;
  const preview=document.createElement('script');preview.id='kelo-world-builder-preview-hotfix-loader';preview.src='src/ui/world-builder-preview-hotfix.js?v=1';document.head.appendChild(preview);
}
function loadAuthorTools(){
  if(document.getElementById('kelo-world-builder-system-loader'))return;
  const system=document.createElement('script');system.id='kelo-world-builder-system-loader';system.src='src/environment/world-builder-system.js?v=2';
  system.onload=()=>{
    const renderer=document.createElement('script');renderer.id='kelo-world-builder-property-renderer-loader';renderer.src='src/environment/world-builder-property-renderer.js?v=1';
    renderer.onload=()=>{
      if(document.getElementById('kelo-world-builder-ui-loader')){loadPreviewFix();return;}
      const ui=document.createElement('script');ui.id='kelo-world-builder-ui-loader';ui.src='src/ui/world-builder-ui.js?v=1';ui.onload=loadPreviewFix;document.head.appendChild(ui);
    };
    document.head.appendChild(renderer);
  };
  document.head.appendChild(system);
}

window.KELO_ADMIN_KEYS=Object.freeze({
  version:VERSION,
  templateId:TEMPLATE_ID,
  scopes:Object.freeze({creator:DEFAULT_CREATOR_SCOPES,root:ROOT_SCOPES}),
  request,
  installRemoteAdapter,
  can,
  assert,
  hasKey:(ownerId)=>activeKeys(ownerId).length>0,
  getActiveKeys:(ownerId)=>activeKeys(ownerId).map(publicKey),
  syncInventory,
  playerId,
  onChange(fn){if(typeof fn!=='function')return()=>{};listeners.add(fn);return()=>listeners.delete(fn);},
  authoritySource:()=>remoteAdapter?'remote-adapter':'local-prototype'
});
window.KELO_ADMIN_KEY_AUDIT=Object.freeze({version:VERSION,itemIdentity:true,bound:true,scopedPermissions:true,serverReplaceable:true,uiTrustOnlyOffline:true,worldBuilderBoot:true,worldBuilderPropertyRenderer:true,worldBuilderPreviewFix:true});

const params=new URLSearchParams(location.search);
if(params.get('mapEditor')==='1')request('admin-key:bootstrap-local-root',{actorId:playerId(),ownerId:playerId(),developer:true}).then(syncWhenReady).catch(console.error);else syncWhenReady();
window.addEventListener('load',syncWhenReady,{once:true});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',loadAuthorTools,{once:true});else loadAuthorTools();
})();