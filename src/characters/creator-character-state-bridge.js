/* KELO-INDEX
 * area: CHARACTERS / CREATOR STATE BRIDGE
 * owner-adjacent: KeloCharacterCustomization + Kelo Creator Use Authority
 * keys: CREATOR CHARACTER APPEARANCE LOADOUT BRIDGE AUTHORITY EXACT REVISION OVERLAY LAZY
 * purpose: proyecta bindings Creator autoritativos sobre el estado visual local sin persistir ownership ni crear otro renderer
 * public-api: KeloCreatorCharacterBridge.sync/clear/state/diagnostics
 * consumes: KeloCreatorUse, KeloCreatorDelivery, KeloCreatorEntitlements, KeloCharacterCustomization, KeloCharacterVisualStack
 * state-owned: overlay efímero slot->runtime item; nunca ownership, inventario, stats ni estado base del personaje
 * online: servidor decide bindings; este bridge usa el manifest exacto entregado y registra piezas hidden+locked para el renderer existente
 * do-not: NO localStorage, NO IndexedDB, NO segundo renderer, NO stats, NO inventar entitlement, NO polling
 */
(function(root){
'use strict';
if(root.KeloCreatorCharacterBridge)return;
const VERSION='creator-character-state-bridge-v1.0.3';
const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FACE_KEYS=['down','left','right','up'];
const text=v=>String(v==null?'':v).trim();
const copy=v=>v==null?v:JSON.parse(JSON.stringify(v));
const overlay=new Map();
const registered=new Map();
let baseCustomization=null,facade=null,revision=1,accountId='',characterId='',syncPromise=null,lastSync=null,lastError=null;

function authState(){try{return root.KeloOnlineAuth?.state?.()||null;}catch{return null;}}
function actorId(actor){return text(actor&&(actor.id||actor.playerKey));}
function localActor(){try{return typeof localPlayer!=='undefined'?localPlayer:null;}catch{return null;}}
function isLocalActor(actor){const local=localActor();if(!actor||actor===local)return true;const a=actorId(actor),b=actorId(local);return !!a&&!!b&&a===b;}
function bump(reason){revision+=1;try{root.KeloCharacterVisualStack?.invalidate?.();}catch{}try{root.dispatchEvent?.(new CustomEvent('kelo:creator-character-bridge-changed',{detail:Object.freeze({reason:String(reason||'change'),revision,characterId:characterId||null,slots:Object.freeze([...overlay.keys()])})}));}catch{}}
function resolveState(actor){
  const base=baseCustomization?.stateForActor?.(actor)||baseCustomization?.getState?.();if(!base||!isLocalActor(actor)||!overlay.size)return base;
  const slots={...(base.slots||{})};for(const [slot,itemId] of overlay)slots[slot]=itemId;
  return Object.freeze({...base,slots:Object.freeze(slots),revision:(Math.max(1,Number(base.revision)||1)*1000000)+revision});
}
function installFacade(){
  if(facade&&root.KeloCharacterCustomization===facade)return true;
  const current=root.KeloCharacterCustomization;if(!current?.stateForActor||!current?.registerItem)return false;
  if(current.__creatorCharacterBridge===VERSION){facade=current;baseCustomization=current.__creatorCharacterBase||current;return true;}
  baseCustomization=current;
  facade=Object.freeze(Object.assign({},current,{
    __creatorCharacterBridge:VERSION,
    __creatorCharacterBase:current,
    stateForActor(actor){return resolveState(actor);},
    getResolvedState(actor){return resolveState(actor||localActor());}
  }));
  root.KeloCharacterCustomization=facade;bump('install-facade');return true;
}
function primaryAsset(row){return row?.assets?.find?.(a=>a?.role==='primary')||row?.assets?.[0]||null;}
function versionedUrl(url,hash){const raw=text(url);if(!raw||raw.startsWith('data:')||raw.startsWith('blob:'))return raw;const token=text(hash||'1').slice(0,12);return raw.includes('?')?`${raw}&v=${encodeURIComponent(token)}`:`${raw}?v=${encodeURIComponent(token)}`;}
function scaleOf(t){const sx=Number.isFinite(Number(t?.scaleX))?Number(t.scaleX):1,sy=Number.isFinite(Number(t?.scaleY))?Number(t.scaleY):1;if(Math.abs(sx-sy)<0.001)return sx;return Math.sqrt(Math.max(.0001,Math.abs(sx*sy)));}
function directionalOffsets(payload){
  const src=payload?.transforms||{},fallback=src.default||{},out={};
  for(const face of FACE_KEYS){const t=src[face]||fallback;out[face]={x:Number(t?.x)||0,y:Number(t?.y)||0,rotation:Number(t?.rotation)||0,scale:scaleOf(t)};}
  return out;
}
function hasTransforms(payload){return !!payload?.transforms&&Object.keys(payload.transforms).length>0;}
function inferredSheet(asset,visual){
  if(visual?.mode==='sheet')return true;if(visual?.mode==='socket')return false;
  const cols=Math.max(1,Number(visual?.columns)||4),rows=Math.max(1,Number(visual?.rows)||4),w=Number(asset?.pixelWidth)||0,h=Number(asset?.pixelHeight)||0;
  if(!w||!h||w%cols||h%rows)return false;const ratio=(w/cols)/(h/rows);return Math.abs(ratio-(2/3))<=0.08;
}
function rawSheet(source,payload,asset,visual){return{mode:'sheet',source,columns:Math.max(1,Number(visual.columns)||4),rows:Math.max(1,Number(visual.rows)||4),faceRows:{down:0,left:1,right:2,up:3,...copy(visual.faceRows||{})},anchor:{x:.5,y:1,...copy(visual.anchor||{})},heightScale:Number(visual.heightScale)||1,rotation:Number(visual.rotation)||0,offsets:directionalOffsets(payload),layer:text(visual.layer||'front'),preview:{kind:'actor-sheet'}};}
function rawSocket(source,payload,asset,visual,slot){
  const weapon=slot==='weaponMain'||slot==='weaponSecondary',w=Math.max(8,Number(visual.width)||Math.min(weapon?72:96,Number(asset?.pixelWidth)||(weapon?58:28))),h=Math.max(8,Number(visual.height)||Math.min(weapon?72:96,Number(asset?.pixelHeight)||(weapon?58:28)));
  return{mode:'socket',source,socket:text(visual.socket||(weapon?'weapon':'center')),layer:text(visual.layer||(slot==='back'?'back':'front')),width:w,height:h,anchor:{x:.5,y:(weapon?0.88:1),...copy(visual.anchor||{})},rotation:Number(visual.rotation)||0,offsets:directionalOffsets(payload),preview:{kind:'socket'}};
}
function visualDescriptor(row,binding){
  const payload=row?.payload||{},asset=primaryAsset(row),visual=payload.characterVisual&&typeof payload.characterVisual==='object'?payload.characterVisual:{};if(!asset?.runtimeUrl)throw new Error('CREATOR_CHARACTER_RUNTIME_URL_REQUIRED');
  const source=versionedUrl(asset.runtimeUrl,asset.contentHash||row.contentHash),slot=text(binding.slotKey||payload.slotId),V=root.KeloCharacterVisualPresets;
  if(inferredSheet(asset,visual)){
    const raw=rawSheet(source,payload,asset,visual);return V?.sheet?V.sheet(source,raw):raw;
  }
  const raw=rawSocket(source,payload,asset,visual,slot),isWeapon=slot==='weaponMain'||slot==='weaponSecondary';
  if(V&&isWeapon&&typeof V.weapon==='function'){
    const opts={...raw};if(!hasTransforms(payload))delete opts.offsets;return V.weapon(source,opts);
  }
  if(V?.socket)return V.socket(source,raw.socket,raw);return raw;
}
function itemId(row,binding){return `creator.visual.${text(row.revisionId).replace(/-/g,'_')}.${text(binding.slotKey)}`;}
function registerBinding(binding,row){
  if(!installFacade())throw new Error('CHARACTER_CUSTOMIZATION_REQUIRED');const Schema=root.KeloCharacterSlotSchema,slot=text(binding?.slotKey);if(!Schema?.isSlot?.(slot))throw new Error('CREATOR_CHARACTER_SLOT_INVALID');
  const payload=row?.payload||{},serverSlot=text(payload.slotId||payload.slot);if(serverSlot&&serverSlot!==slot)throw new Error('CREATOR_CHARACTER_SLOT_MISMATCH');const target=text(payload.targetType||'character').toLowerCase();if(target&&target!=='character'&&target!=='player')throw new Error('CREATOR_CHARACTER_TARGET_INVALID');
  if(!['appearance','equipment'].includes(text(row?.contentType)))throw new Error('CREATOR_CHARACTER_TYPE_INVALID');
  const id=itemId(row,binding);if(!baseCustomization.getItem(id))baseCustomization.registerItem({id,slot,name:text(row.displayName||id),group:Schema.groupOf(slot)||'equipment',rarity:text(payload.rarity||'common'),visual:visualDescriptor(row,binding),tags:['creator-content','server-bound',...(row.tags||[])],locked:true,hidden:true});
  registered.set(text(binding.revisionId),Object.freeze({revisionId:text(binding.revisionId),slot,itemId:id,contentId:text(row.contentId)}));return id;
}
function manifestRecord(active,revisionId){
  const m=active?.manifest,id=text(revisionId);if(!m||text(m.revisionId)!==id)throw new Error('CREATOR_CHARACTER_DELIVERY_REVISION_MISMATCH');
  const access=root.KeloCreatorEntitlements?.checkRecord?.({source:'creator-content',revisionId:id});if(!access?.ok)throw new Error(access?.reason||'CREATOR_CHARACTER_ENTITLEMENT_REQUIRED');
  return Object.freeze({revisionId:id,contentId:text(m.contentId),stableKey:text(m.stableKey||m.contentId),revision:Number(m.revision)||1,contentType:text(m.contentType),displayName:text(m.displayName||m.contentId),tags:Object.freeze((m.tags||[]).map(String)),payload:Object.freeze(copy(m.payload||{})),assets:Object.freeze((m.assets||[]).map(a=>Object.freeze(copy(a)))),contentHash:text(m.contentHash),source:'creator-content'});
}
async function activateBinding(binding){
  const revisionId=text(binding?.revisionId);if(!UUID_RE.test(revisionId))throw new Error('CREATOR_CHARACTER_REVISION_INVALID');
  if(!root.KeloCreatorDelivery?.useRevision)throw new Error('CREATOR_DELIVERY_FACADE_REQUIRED');const active=await root.KeloCreatorDelivery.useRevision(revisionId),row=manifestRecord(active,revisionId);return{binding,row,itemId:registerBinding(binding,row)};
}
function applyOverlay(characterState,activated){
  overlay.clear();for(const entry of activated)if(entry?.binding?.slotKey&&entry?.itemId)overlay.set(String(entry.binding.slotKey),String(entry.itemId));accountId=text(authState()?.accountId);characterId=text(characterState?.characterId);lastSync=Object.freeze({at:Date.now(),accountId:accountId||null,characterId:characterId||null,bindings:activated.length,failures:(characterState?.__failures||[]).length});bump('server-sync');return state();
}
async function sync(options){
  const o=options||{};if(syncPromise)return syncPromise;
  syncPromise=(async()=>{
    if(!installFacade())throw new Error('CHARACTER_CUSTOMIZATION_REQUIRED');const auth=authState();if(!auth?.authenticated||!UUID_RE.test(text(auth.characterId))){clear('signed-out');return state();}
    const serverState=o.state&&text(o.state.characterId)===text(auth.characterId)?o.state:await root.KeloCreatorUse?.state?.({characterId:auth.characterId,hydrateRuntime:false});if(!serverState||text(serverState.characterId)!==text(auth.characterId))throw new Error('CREATOR_CHARACTER_STATE_IDENTITY_MISMATCH');
    const bindings=Array.isArray(serverState.loadout)?serverState.loadout.filter(row=>row&&UUID_RE.test(text(row.revisionId))):[],activated=[],failures=[];
    for(const binding of bindings){try{activated.push(await activateBinding(binding));}catch(error){failures.push({slotKey:text(binding.slotKey),revisionId:text(binding.revisionId),error:String(error?.message||error)});}}
    lastError=failures.length?failures.map(x=>x.error).join(' | '):null;const decorated={...serverState,__failures:failures};applyOverlay(decorated,activated);try{root.dispatchEvent?.(new CustomEvent('kelo:creator-character-bridge-synced',{detail:Object.freeze({characterId,bindings:activated.length,failures:Object.freeze(failures.map(copy))})}));}catch{}return state();
  })().catch(error=>{lastError=String(error?.message||error);throw error;}).finally(()=>{syncPromise=null;});return syncPromise;
}
function clear(reason){const had=overlay.size||accountId||characterId;overlay.clear();registered.clear();accountId='';characterId='';lastSync=null;lastError=null;if(had)bump(reason||'clear');return state();}
function state(){return Object.freeze({version:VERSION,accountId:accountId||null,characterId:characterId||null,revision,slots:Object.freeze(Object.fromEntries(overlay)),registered:Object.freeze([...registered.values()]),lastSync,lastError});}
function diagnostics(){return Object.freeze({version:VERSION,installed:!!facade,baseVersion:baseCustomization?.version||null,overlaySlots:overlay.size,registeredItems:registered.size,syncing:!!syncPromise,accountId:accountId||null,characterId:characterId||null,lastSync,lastError,persistentStore:false,polling:false,exactManifest:true,secondRenderer:false});}
function onAuth(event){const d=event?.detail||authState();if(!d?.authenticated){clear('auth-ended');return;}if(characterId&&text(d.characterId)!==characterId)clear('character-changed');}
function onEntitlementsChanged(){if(characterId)void sync({force:true}).catch(()=>{});}

installFacade();
root.addEventListener?.('kelo:online-auth-state',onAuth,{passive:true});
root.addEventListener?.('kelo:online-auth-session-ended',()=>clear('session-ended'),{passive:true});
root.addEventListener?.('kelo:creator-entitlements-changed',onEntitlementsChanged,{passive:true});
root.KeloCreatorCharacterBridge=Object.freeze({version:VERSION,sync,clear,state,diagnostics,getResolvedState:actor=>resolveState(actor||localActor())});
const boot=root.__KELO_CREATOR_CHARACTER_BOOT_STATE__;try{delete root.__KELO_CREATOR_CHARACTER_BOOT_STATE__;}catch{}
if(boot&&Array.isArray(boot.loadout))void sync({state:boot,force:true}).catch(()=>{});
root.KELO_CREATOR_CHARACTER_BRIDGE_AUDIT=Object.freeze({version:VERSION,ephemeralOverlay:true,hiddenLockedItems:true,serverStateOnly:true,noPersistence:true,noPolling:true,singleFlight:true,exactManifest:true,secondRenderer:false});
})(typeof globalThis!=='undefined'?globalThis:window);
