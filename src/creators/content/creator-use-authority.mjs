/* KELO-INDEX
 * area: CREATORS / CONTENT USE AUTHORITY
 * owner: Kelo Creator Use Authority
 * keys: CREATOR USE EQUIP APPEARANCE WEAPON MOUNT PROPERTY SERVER AUTHORITY ENTITLEMENT EXACT REVISION
 * owns: thin client orchestration for server-authorized Creator use bindings + non-authoritative hydrated selection cache
 * does-not-own: entitlement truth, rendering, gameplay stats, parcel geometry, inventory, publication, KC or auth UI
 * rule: activate exact revision -> server mutation -> existing domain owner; no local ownership flag can authorize use
 */
const F=Object.freeze;
const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const text=v=>String(v==null?'':v).trim();
const copy=v=>v==null?v:JSON.parse(JSON.stringify(v));
const CHARACTER_KEY='kelo.active.character.v1';

function creatorRevisionFromMount(root,mountId){
  const catalog=root.KeloMountCatalog,row=catalog?.getRaw?.(mountId)||catalog?.get?.(mountId)||null;
  return text(row?.metadata?.creatorRevisionId);
}
function creatorRevisionFromProperty(root,assetId){
  const catalog=root.KELO_PROPERTY_CATALOG,row=catalog?.getRaw?.(assetId)||catalog?.get?.(assetId)||null;
  if(row?.source!=='creator-content')return'';
  return text(row?.sourceId||row?.metadata?.creatorRevisionId);
}

export function createCreatorUseAuthority({root=globalThis,delivery=null}={}){
  const hydrated=new Map();
  let provider=null,mountGuardDispose=null,propertyGuardDispose=null;
  const getDelivery=()=>delivery||root.KELO_CREATOR_CONTENT_DELIVERY||null;
  function accountId(){if(provider)return text(provider.accountId?.());try{return text(root.KeloOnlineAuth?.state?.()?.accountId);}catch{return'';}}
  function bindProvider(next){
    if(!next||typeof next.accountId!=='function'||typeof next.rpc!=='function')throw new Error('CREATOR_USE_PROVIDER_INVALID');
    provider=F({name:text(next.name||'bound-provider'),accountId:next.accountId,rpc:next.rpc,listCharacters:typeof next.listCharacters==='function'?next.listCharacters:null});
    hydrated.clear();return api;
  }
  async function fallbackRpc(name,payload){
    const credentials=await root.KeloOnlineAuth?.credentials?.();if(!credentials?.accountId)throw new Error('AUTH_REQUIRED');
    const client=root.KeloOnlineAuth?.getClient?.();if(!client?.rpc)throw new Error('CREATOR_USE_AUTH_CLIENT_REQUIRED');
    const result=await client.rpc(name,payload);if(result?.error)throw result.error;return result?.data;
  }
  async function rpc(name,payload){return provider?provider.rpc(name,payload):fallbackRpc(name,payload);}
  async function resolveCharacterId(explicit){
    const direct=text(explicit);if(UUID_RE.test(direct))return direct;
    const live=text(root.keloNet?.playerKey);if(UUID_RE.test(live))return live;
    try{const remembered=text(root.localStorage?.getItem(CHARACTER_KEY));if(UUID_RE.test(remembered))return remembered;}catch{}
    if(provider?.listCharacters){const rows=await provider.listCharacters();const row=Array.isArray(rows)?rows.find(x=>x?.status==='active')||rows[0]:null;if(UUID_RE.test(text(row?.id))){try{root.localStorage?.setItem(CHARACTER_KEY,String(row.id));}catch{}return String(row.id);}}
    throw new Error('ACTIVE_CHARACTER_REQUIRED');
  }
  async function activate(revisionId){
    const id=text(revisionId);if(!UUID_RE.test(id))throw new Error('REVISION_REQUIRED');const d=getDelivery();if(!d?.activateRevision)throw new Error('CREATOR_CONTENT_DELIVERY_REQUIRED');return d.activateRevision(id);
  }
  function rememberBinding(characterId,slotKey,revisionId,runtimeId,bindingKind){
    const current=hydrated.get(characterId)||{characterId,loadout:new Map(),mount:null};
    if(revisionId)current.loadout.set(slotKey,F({slotKey,revisionId,runtimeId:runtimeId||null,bindingKind:bindingKind||'appearance'}));else current.loadout.delete(slotKey);
    hydrated.set(characterId,current);return current;
  }
  function rememberMount(characterId,revisionId,runtimeId){const current=hydrated.get(characterId)||{characterId,loadout:new Map(),mount:null};current.mount=revisionId?F({revisionId,runtimeId:runtimeId||null}):null;hydrated.set(characterId,current);return current;}
  function emit(type,detail){try{root.dispatchEvent?.(new CustomEvent(type,{detail:F({...detail})}));}catch{}}
  async function equipRevision(revisionId,{characterId=null,slotKey=null}={}){
    const active=await activate(revisionId),manifest=active.manifest,type=text(manifest.contentType);
    if(!['appearance','equipment'].includes(type))throw new Error('CREATOR_CONTENT_NOT_EQUIPPABLE');
    const serverSlot=text(manifest.payload?.slotId||manifest.payload?.slot),slot=text(slotKey||serverSlot);if(!slot)throw new Error('CREATOR_CONTENT_SLOT_REQUIRED');if(serverSlot&&serverSlot!==slot)throw new Error('CREATOR_CONTENT_SLOT_MISMATCH');
    const cid=await resolveCharacterId(characterId),result=await rpc('set_character_creator_content',{p_character_id:cid,p_slot_key:slot,p_revision_id:manifest.revisionId});
    const runtimeId=active.row?.activation?.runtimeId||null;rememberBinding(cid,slot,manifest.revisionId,runtimeId,type);emit('kelo:creator-use-changed',{kind:type,characterId:cid,slotKey:slot,revisionId:manifest.revisionId,runtimeId});
    return F({ok:true,characterId:cid,slotKey:slot,revisionId:manifest.revisionId,runtimeId,server:copy(result),manifest,row:active.row});
  }
  async function clearSlot(slotKey,{characterId=null}={}){
    const slot=text(slotKey);if(!slot)throw new Error('SLOT_REQUIRED');const cid=await resolveCharacterId(characterId),result=await rpc('set_character_creator_content',{p_character_id:cid,p_slot_key:slot,p_revision_id:null});rememberBinding(cid,slot,null,null,null);emit('kelo:creator-use-changed',{kind:'clear-slot',characterId:cid,slotKey:slot,revisionId:null});return F({ok:true,characterId:cid,slotKey:slot,server:copy(result)});
  }
  async function selectMount(revisionId,{characterId=null,activateRuntime=true}={}){
    const active=activateRuntime?await activate(revisionId):null,manifest=active?.manifest||await getDelivery()?.getManifest?.(revisionId);if(!manifest||manifest.contentType!=='mount')throw new Error('CREATOR_CONTENT_NOT_MOUNT');
    const cid=await resolveCharacterId(characterId),result=await rpc('set_character_creator_mount',{p_character_id:cid,p_revision_id:manifest.revisionId}),runtimeId=active?.row?.activation?.runtimeId||null;rememberMount(cid,manifest.revisionId,runtimeId);emit('kelo:creator-use-changed',{kind:'mount',characterId:cid,revisionId:manifest.revisionId,runtimeId});return F({ok:true,characterId:cid,revisionId:manifest.revisionId,runtimeId,server:copy(result),manifest,row:active?.row||null});
  }
  async function clearMount({characterId=null}={}){const cid=await resolveCharacterId(characterId),result=await rpc('set_character_creator_mount',{p_character_id:cid,p_revision_id:null});rememberMount(cid,null,null);emit('kelo:creator-use-changed',{kind:'clear-mount',characterId:cid,revisionId:null});return F({ok:true,characterId:cid,server:copy(result)});}
  async function authorizePropertyPlacement(revisionId,{characterId=null,parcelKey,transform={}}={}){
    const active=await activate(revisionId),manifest=active.manifest;if(!['world','tile'].includes(manifest.contentType))throw new Error('CREATOR_CONTENT_NOT_PROPERTY');const cid=await resolveCharacterId(characterId),parcel=text(parcelKey);if(!parcel)throw new Error('PARCEL_KEY_REQUIRED');
    const result=await rpc('authorize_creator_property_placement',{p_character_id:cid,p_revision_id:manifest.revisionId,p_parcel_key:parcel,p_transform:copy(transform||{})});emit('kelo:creator-property-use-authorized',{characterId:cid,revisionId:manifest.revisionId,parcelKey:parcel,authorizationId:result?.authorizationId||null});return F({ok:true,characterId:cid,revisionId:manifest.revisionId,server:copy(result),manifest,row:active.row});
  }
  async function getState({characterId=null,hydrateRuntime=false}={}){
    const cid=await resolveCharacterId(characterId),raw=await rpc('get_my_creator_use_state',{p_character_id:cid}),loadout=Array.isArray(raw?.loadout)?raw.loadout:[],state={characterId:cid,loadout:new Map(),mount:null};
    if(hydrateRuntime){for(const binding of loadout){try{const active=await activate(binding.revisionId);state.loadout.set(String(binding.slotKey),F({...binding,runtimeId:active.row?.activation?.runtimeId||null}));}catch(error){state.loadout.set(String(binding.slotKey),F({...binding,runtimeId:null,error:String(error?.message||error)}));}}if(raw?.mount?.revisionId){try{const active=await activate(raw.mount.revisionId);state.mount=F({...raw.mount,runtimeId:active.row?.activation?.runtimeId||null});}catch(error){state.mount=F({...raw.mount,runtimeId:null,error:String(error?.message||error)});}}}else{for(const binding of loadout)state.loadout.set(String(binding.slotKey),F({...binding,runtimeId:null}));if(raw?.mount)state.mount=F({...raw.mount,runtimeId:null});}
    hydrated.set(cid,state);return snapshot(cid);
  }
  function snapshot(characterId){const id=text(characterId),state=hydrated.get(id);if(!state)return null;return F({characterId:id,loadout:F([...state.loadout.values()].map(copy)),mount:state.mount?F(copy(state.mount)):null});}
  function resolveCharacterAppearance({characterId,profileId='appearance.character.human.standard',direction='down',motion='idle'}={}){const state=hydrated.get(text(characterId));if(!state||!root.KeloAppearance?.resolveLoadout)return{ok:false,error:'CREATOR_USE_STATE_NOT_HYDRATED',layers:[]};const slots={};for(const row of state.loadout.values())if(row.runtimeId)slots[row.slotKey]=row.runtimeId;return root.KeloAppearance.resolveLoadout({profileId,slots,direction,motion});}
  function attachRuntimeGuards(){
    if(!mountGuardDispose&&root.KeloMounts?.useGuard){mountGuardDispose=root.KeloMounts.useGuard(async(op,payload)=>{if(!['mount:equip','mount:mount','mount:unequip'].includes(op))return;let mountId=text(payload?.mountId);if(op==='mount:unequip'&&!mountId)mountId=text(root.KeloMounts?.getEquippedMountId?.());const revisionId=creatorRevisionFromMount(root,mountId);if(!revisionId)return;if(op==='mount:unequip')await clearMount({});else await selectMount(revisionId,{activateRuntime:false});});}
    if(!propertyGuardDispose&&root.KELO_PROPERTY_SYSTEM?.useGuard){propertyGuardDispose=root.KELO_PROPERTY_SYSTEM.useGuard(async(op,payload)=>{if(op!=='place')return;const revisionId=creatorRevisionFromProperty(root,payload?.assetId);if(!revisionId)return;await authorizePropertyPlacement(revisionId,{parcelKey:payload?.parcelId,transform:{x:Number(payload?.x)||0,y:Number(payload?.y)||0,rotation:Number(payload?.rotation)||0,scale:Number(payload?.scale)||1}});});}
    return F({mount:!!mountGuardDispose,property:!!propertyGuardDispose});
  }
  function invalidateIdentity(){hydrated.clear();return diagnostics();}
  function diagnostics(){return F({version:'creator-use-authority-v1.0.0',provider:provider?.name||'KeloOnlineAuth',accountId:accountId()||null,hydratedCharacters:hydrated.size,mountGuard:!!mountGuardDispose,propertyGuard:!!propertyGuardDispose});}
  function dispose(){try{mountGuardDispose?.();}catch{}try{propertyGuardDispose?.();}catch{}mountGuardDispose=propertyGuardDispose=null;hydrated.clear();}
  const api=F({version:'creator-use-authority-v1.0.0',bindProvider,equipRevision,clearSlot,selectMount,clearMount,authorizePropertyPlacement,getState,snapshot,resolveCharacterAppearance,attachRuntimeGuards,invalidateIdentity,diagnostics,dispose});return api;
}

export function getOrCreateCreatorUseAuthority({root=globalThis,delivery=null}={}){if(root.KELO_CREATOR_USE_AUTHORITY)return root.KELO_CREATOR_USE_AUTHORITY;const api=createCreatorUseAuthority({root,delivery});try{root.KELO_CREATOR_USE_AUTHORITY=api;}catch{}return api;}
