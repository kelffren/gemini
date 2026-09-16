/* KELO-INDEX
 * area: CHARACTERS / CREATOR STATE BRIDGE
 * owner-adjacent: KeloCharacterCustomization + Kelo Creator Use Authority + server presentation snapshots
 * keys: CREATOR CHARACTER APPEARANCE LOADOUT BRIDGE AUTHORITY EXACT REVISION OVERLAY REMOTE REPLICATION LAZY AUTHORING CONTRACT
 * purpose: proyecta bindings Creator autoritativos sobre el estado visual local y snapshots publicados sobre peers usando el mismo descriptor que el authoring preview
 * public-api: KeloCreatorCharacterBridge.sync/clear/ingestRemote/clearRemote/state/diagnostics
 * consumes: KeloCreatorUse, KeloCreatorDelivery, KeloCreatorEntitlements, KeloCreatorCharacterVisualContract, server avatar presentation envelope, KeloCharacterCustomization, KeloCharacterVisualStack
 * state-owned: overlays efímeros slot->runtime item; nunca ownership, inventario, stats ni estado base del personaje
 * online: local usa entitlement + Delivery exacta; remote usa únicamente el envelope publicado/sanitizado por el servidor
 * do-not: NO localStorage, NO IndexedDB, NO segundo renderer, NO stats, NO inventar entitlement remoto, NO polling
 */
(function(root){
'use strict';
if(root.KeloCreatorCharacterBridge)return;
const VERSION='creator-character-state-bridge-v1.2.0-authoring-contract';
const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const text=v=>String(v==null?'':v).trim();
const copy=v=>v==null?v:JSON.parse(JSON.stringify(v));
const overlay=new Map();
const remoteOverlays=new WeakMap();
const remoteFingerprints=new WeakMap();
const registered=new Map();
let baseCustomization=null,facade=null,revision=1,accountId='',characterId='',syncPromise=null,lastSync=null,lastError=null,remoteIngests=0,remoteClears=0,remoteFailures=0;

function authState(){try{return root.KeloOnlineAuth?.state?.()||null;}catch{return null;}}
function actorId(actor){return text(actor&&(actor.id||actor.playerKey));}
function localActor(){try{return typeof localPlayer!=='undefined'?localPlayer:null;}catch{return null;}}
function isLocalActor(actor){const local=localActor();if(!actor||actor===local)return true;const a=actorId(actor),b=actorId(local);return !!a&&!!b&&a===b;}
function bump(reason,detail){revision+=1;try{root.KeloCharacterVisualStack?.invalidate?.();}catch{}try{root.dispatchEvent?.(new CustomEvent('kelo:creator-character-bridge-changed',{detail:Object.freeze({reason:String(reason||'change'),revision,characterId:characterId||null,slots:Object.freeze([...overlay.keys()]),...(detail||{})})}));}catch{}}
function remoteEnvelope(actor){const raw=actor&&actor.avatarManifest&&actor.avatarManifest.creatorAppearance||actor&&actor.creatorAppearance||null;return raw&&raw.source==='server-authoritative-published'&&Array.isArray(raw.loadout)?raw:null;}
function remoteFingerprint(snapshot){if(!snapshot)return'';return text(snapshot.revisionKey)||snapshot.loadout.map(row=>`${text(row?.slotKey)}:${text(row?.revisionId)}`).sort().join('|');}
function resolveState(actor){
  const base=baseCustomization?.stateForActor?.(actor)||baseCustomization?.getState?.();if(!base)return base;
  let active=overlay;
  if(!isLocalActor(actor)){ensureRemoteOverlay(actor);active=remoteOverlays.get(actor)||null;}
  if(!active||!active.size)return base;
  const slots={...(base.slots||{})};for(const [slot,itemId] of active)slots[slot]=itemId;
  return Object.freeze({...base,slots:Object.freeze(slots),revision:(Math.max(1,Number(base.revision)||1)*1000000)+revision});
}
function installFacade(){
  if(facade&&root.KeloCharacterCustomization===facade)return true;
  const current=root.KeloCharacterCustomization;if(!current?.stateForActor||!current?.registerItem)return false;
  const base=current.__creatorCharacterBase||current;baseCustomization=base;
  facade=Object.freeze(Object.assign({},current,{
    __creatorCharacterBridge:VERSION,
    __creatorCharacterBase:base,
    stateForActor(actor){return resolveState(actor);},
    getResolvedState(actor){return resolveState(actor||localActor());}
  }));
  root.KeloCharacterCustomization=facade;bump('install-facade');return true;
}
function primaryAsset(row){return row?.assets?.find?.(a=>a?.role==='primary')||row?.assets?.[0]||null;}
function versionedUrl(url,hash){const raw=text(url);if(!raw||raw.startsWith('data:')||raw.startsWith('blob:'))return raw;const token=text(hash||'1').slice(0,12);return raw.includes('?')?`${raw}&v=${encodeURIComponent(token)}`:`${raw}?v=${encodeURIComponent(token)}`;}
function visualDescriptor(row,binding){
  const payload=row?.payload||{},asset=primaryAsset(row);if(!asset?.runtimeUrl)throw new Error('CREATOR_CHARACTER_RUNTIME_URL_REQUIRED');
  const slot=text(binding.slotKey||payload.slotId),C=root.KeloCreatorCharacterVisualContract;if(!C?.buildDescriptor)throw new Error('CREATOR_CHARACTER_VISUAL_CONTRACT_REQUIRED');
  const check=C.validate({payload,asset,slot});if(!check.ok)throw new Error('CREATOR_CHARACTER_VISUAL_INVALID:'+check.errors.join(','));
  return C.buildDescriptor({source:versionedUrl(asset.runtimeUrl,asset.contentHash||row.contentHash),payload,asset,slot,presets:root.KeloCharacterVisualPresets});
}
function itemId(row,binding,scope){return `creator.visual.${scope==='remote'?'remote':'local'}.${text(row.revisionId).replace(/-/g,'_')}.${text(binding.slotKey)}`;}
function registerBinding(binding,row,scope){
  if(!installFacade())throw new Error('CHARACTER_CUSTOMIZATION_REQUIRED');const Schema=root.KeloCharacterSlotSchema,slot=text(binding?.slotKey);if(!Schema?.isSlot?.(slot))throw new Error('CREATOR_CHARACTER_SLOT_INVALID');
  const payload=row?.payload||{},serverSlot=text(payload.slotId||payload.slot);if(serverSlot&&serverSlot!==slot)throw new Error('CREATOR_CHARACTER_SLOT_MISMATCH');const target=text(payload.targetType||'character').toLowerCase();if(target&&target!=='character'&&target!=='player')throw new Error('CREATOR_CHARACTER_TARGET_INVALID');if(!['appearance','equipment'].includes(text(row?.contentType)))throw new Error('CREATOR_CHARACTER_TYPE_INVALID');
  const mode=scope==='remote'?'remote':'local',id=itemId(row,binding,mode);if(!baseCustomization.getItem(id))baseCustomization.registerItem({id,slot,name:text(row.displayName||id),group:Schema.groupOf(slot)||'equipment',rarity:text(payload.rarity||'common'),visual:visualDescriptor(row,binding),tags:['creator-content',mode==='remote'?'remote-public':'server-bound',...(row.tags||[])],locked:true,hidden:true});
  registered.set(`${mode}:${text(binding.revisionId)}:${slot}`,Object.freeze({scope:mode,revisionId:text(binding.revisionId),slot,itemId:id,contentId:text(row.contentId)}));return id;
}
function manifestRecord(active,revisionId){
  const m=active?.manifest,id=text(revisionId);if(!m||text(m.revisionId)!==id)throw new Error('CREATOR_CHARACTER_DELIVERY_REVISION_MISMATCH');const access=root.KeloCreatorEntitlements?.checkRecord?.({source:'creator-content',revisionId:id});if(!access?.ok)throw new Error(access?.reason||'CREATOR_CHARACTER_ENTITLEMENT_REQUIRED');
  return Object.freeze({revisionId:id,contentId:text(m.contentId),stableKey:text(m.stableKey||m.contentId),revision:Number(m.revision)||1,contentType:text(m.contentType),displayName:text(m.displayName||m.contentId),tags:Object.freeze((m.tags||[]).map(String)),payload:Object.freeze(copy(m.payload||{})),assets:Object.freeze((m.assets||[]).map(a=>Object.freeze(copy(a)))),contentHash:text(m.contentHash),source:'creator-content'});
}
function remoteRecord(binding){
  const id=text(binding?.revisionId),slot=text(binding?.slotKey),asset=primaryAsset(binding);if(!UUID_RE.test(id))throw new Error('REMOTE_CREATOR_REVISION_INVALID');if(!asset?.runtimeUrl)throw new Error('REMOTE_CREATOR_PUBLIC_ASSET_REQUIRED');
  return Object.freeze({revisionId:id,contentId:text(binding.contentId),stableKey:text(binding.stableKey||binding.contentId),revision:Number(binding.revision)||1,contentType:text(binding.contentType||binding.bindingKind),displayName:text(binding.displayName||binding.contentId),tags:Object.freeze((binding.tags||[]).map(String)),payload:Object.freeze(copy(binding.payload||{slotId:slot,targetType:'character'})),assets:Object.freeze((binding.assets||[]).map(a=>Object.freeze(copy(a)))),contentHash:text(binding.contentHash),source:'server-authoritative-published'});
}
async function activateBinding(binding){const revisionId=text(binding?.revisionId);if(!UUID_RE.test(revisionId))throw new Error('CREATOR_CHARACTER_REVISION_INVALID');if(!root.KeloCreatorDelivery?.useRevision)throw new Error('CREATOR_DELIVERY_FACADE_REQUIRED');const active=await root.KeloCreatorDelivery.useRevision(revisionId),row=manifestRecord(active,revisionId);return{binding,row,itemId:registerBinding(binding,row,'local')};}
function applyOverlay(characterState,activated){overlay.clear();for(const entry of activated)if(entry?.binding?.slotKey&&entry?.itemId)overlay.set(String(entry.binding.slotKey),String(entry.itemId));accountId=text(authState()?.accountId);characterId=text(characterState?.characterId);lastSync=Object.freeze({at:Date.now(),accountId:accountId||null,characterId:characterId||null,bindings:activated.length,failures:(characterState?.__failures||[]).length});bump('server-sync');return state();}
async function sync(options){
  const o=options||{};if(syncPromise)return syncPromise;
  syncPromise=(async()=>{if(!installFacade())throw new Error('CHARACTER_CUSTOMIZATION_REQUIRED');const auth=authState();if(!auth?.authenticated||!UUID_RE.test(text(auth.characterId))){clear('signed-out');return state();}const serverState=o.state&&text(o.state.characterId)===text(auth.characterId)?o.state:await root.KeloCreatorUse?.state?.({characterId:auth.characterId,hydrateRuntime:false});if(!serverState||text(serverState.characterId)!==text(auth.characterId))throw new Error('CREATOR_CHARACTER_STATE_IDENTITY_MISMATCH');const bindings=Array.isArray(serverState.loadout)?serverState.loadout.filter(row=>row&&UUID_RE.test(text(row.revisionId))):[],activated=[],failures=[];for(const binding of bindings){try{activated.push(await activateBinding(binding));}catch(error){failures.push({slotKey:text(binding.slotKey),revisionId:text(binding.revisionId),error:String(error?.message||error)});}}lastError=failures.length?failures.map(x=>x.error).join(' | '):null;const decorated={...serverState,__failures:failures};applyOverlay(decorated,activated);try{root.dispatchEvent?.(new CustomEvent('kelo:creator-character-bridge-synced',{detail:Object.freeze({characterId,bindings:activated.length,failures:Object.freeze(failures.map(copy))})}));}catch{}return state();})().catch(error=>{lastError=String(error?.message||error);throw error;}).finally(()=>{syncPromise=null;});return syncPromise;
}
function ingestRemote(actor,snapshot){
  if(!actor||isLocalActor(actor))return{ok:false,error:'REMOTE_ACTOR_REQUIRED'};if(!snapshot||snapshot.source!=='server-authoritative-published'||!Array.isArray(snapshot.loadout)){clearRemote(actor,'remote-empty');return{ok:true,bindings:0};}
  const fingerprint=remoteFingerprint(snapshot);if(remoteFingerprints.get(actor)===fingerprint)return{ok:true,bindings:(remoteOverlays.get(actor)||new Map()).size,cached:true};const next=new Map(),failures=[];
  for(const binding of snapshot.loadout.slice(0,24)){try{const row=remoteRecord(binding),item=registerBinding(binding,row,'remote');next.set(text(binding.slotKey),item);}catch(error){failures.push({slotKey:text(binding?.slotKey),revisionId:text(binding?.revisionId),error:String(error?.message||error)});}}
  remoteOverlays.set(actor,next);remoteFingerprints.set(actor,fingerprint);remoteIngests+=1;remoteFailures+=failures.length;bump('remote-sync',{remoteActorId:actorId(actor),remoteBindings:next.size});return{ok:true,bindings:next.size,failures:Object.freeze(failures)};
}
function clearRemote(actor,reason){if(!actor||isLocalActor(actor))return false;const had=remoteOverlays.has(actor)||remoteFingerprints.has(actor);remoteOverlays.delete(actor);remoteFingerprints.delete(actor);if(had){remoteClears+=1;bump(reason||'remote-clear',{remoteActorId:actorId(actor)});}return had;}
function ensureRemoteOverlay(actor){if(!actor||isLocalActor(actor))return;const snapshot=remoteEnvelope(actor);if(!snapshot){if(remoteOverlays.has(actor))clearRemote(actor,'remote-envelope-removed');return;}const fingerprint=remoteFingerprint(snapshot);if(remoteFingerprints.get(actor)!==fingerprint)ingestRemote(actor,snapshot);}
function clear(reason){const had=overlay.size||accountId||characterId;overlay.clear();for(const [key,row] of registered)if(row.scope==='local')registered.delete(key);accountId='';characterId='';lastSync=null;lastError=null;if(had)bump(reason||'clear');return state();}
function state(){return Object.freeze({version:VERSION,accountId:accountId||null,characterId:characterId||null,revision,slots:Object.freeze(Object.fromEntries(overlay)),registered:Object.freeze([...registered.values()]),lastSync,lastError});}
function diagnostics(){return Object.freeze({version:VERSION,installed:!!facade,baseVersion:baseCustomization?.version||null,overlaySlots:overlay.size,registeredItems:registered.size,syncing:!!syncPromise,accountId:accountId||null,characterId:characterId||null,lastSync,lastError,remoteIngests,remoteClears,remoteFailures,remoteWeakState:true,persistentStore:false,polling:false,exactManifest:true,remotePublishedEnvelope:true,sharedVisualContract:root.KeloCreatorCharacterVisualContract?.version||null,secondRenderer:false});}
function onAuth(event){const d=event?.detail||authState();if(!d?.authenticated){clear('auth-ended');return;}if(characterId&&text(d.characterId)!==characterId)clear('character-changed');}
function onEntitlementsChanged(){if(characterId)void sync({force:true}).catch(()=>{});}

installFacade();
root.addEventListener?.('kelo:online-auth-state',onAuth,{passive:true});
root.addEventListener?.('kelo:online-auth-session-ended',()=>clear('session-ended'),{passive:true});
root.addEventListener?.('kelo:creator-entitlements-changed',onEntitlementsChanged,{passive:true});
root.KeloCreatorCharacterBridge=Object.freeze({version:VERSION,sync,clear,ingestRemote,clearRemote,state,diagnostics,getResolvedState:actor=>resolveState(actor||localActor())});
const boot=root.__KELO_CREATOR_CHARACTER_BOOT_STATE__;try{delete root.__KELO_CREATOR_CHARACTER_BOOT_STATE__;}catch{}
if(boot&&Array.isArray(boot.loadout))void sync({state:boot,force:true}).catch(()=>{});
root.KELO_CREATOR_CHARACTER_BRIDGE_AUDIT=Object.freeze({version:VERSION,ephemeralOverlay:true,remoteWeakOverlay:true,hiddenLockedItems:true,serverStateOnly:true,remoteServerPublishedOnly:true,noPersistence:true,noPolling:true,singleFlight:true,exactManifest:true,sharedVisualContract:true,secondRenderer:false});
})(typeof globalThis!=='undefined'?globalThis:window);
