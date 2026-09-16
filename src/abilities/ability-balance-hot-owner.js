/* KELO-INDEX
 * area: ABILITIES / HOT BALANCE
 * owner: KeloAbilityHotBalance
 * keys: ABILITY BALANCE HOT DATA MULTIPLIER TRANSACTION ROLLBACK MOBILE
 * purpose: apply strictly validated scalar ability balance changes to future casts without touching in-flight gameplay objects
 * public-api: KeloAbilityHotBalance.getState/getConfig/resolve/applyRuntime
 * state-owned: one immutable balance pointer + event subscriptions; NO game loop/timer/storage
 * do-not: NO handlers/recipes/status IDs/topology hot swap, NO mutation of in-flight defs, NO polling
 */
(function(root){
'use strict';
if(root.KeloAbilityHotBalance)return;
const VERSION='kelo-ability-hot-balance-v1';
const PATH='src/abilities/ability-balance.json';
const BASE_KEYS=Object.freeze(['fireball','ice_nova','chain_lightning','wind_dash','stone_shield','fire_tornado','ice_wall','shadow_step','poison_trap','light_aura','swap_sword']);
const KEY_SET=new Set(BASE_KEYS);
const FIELDS=Object.freeze(['cooldown','resourceCost','damage','heal','shield','range','speed','area']);
const FIELD_SET=new Set(FIELDS);
const prepared=new WeakMap();
let active=deepFreeze({schemaVersion:1,abilities:{}}),epoch=0,applies=0,rollbacks=0,lastError=null,lastSource='bootstrap-default',runtimeBindings=0,loadoutUnsubscribe=null,registryWrapped=false,mutationSeq=0;
function clone(value){return value==null?value:JSON.parse(JSON.stringify(value));}
function deepFreeze(value){if(!value||typeof value!=='object'||Object.isFrozen(value))return value;Object.keys(value).forEach(k=>deepFreeze(value[k]));return Object.freeze(value);}
function round(value){return Number(Number(value).toFixed(6));}
function emit(type,detail){try{root.dispatchEvent(new CustomEvent('kelo:ability-balance:'+type,{detail:Object.assign(getState(),detail||{})}));}catch(_){}}
function normalizeMultiplier(value,field,key){const n=Number(value);if(!Number.isFinite(n)||n<0.25||n>4)throw new Error('ability_balance_out_of_range:'+key+':'+field);return round(n);}
function normalize(raw){
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error('ability_balance_object_required');
  if(Number(raw.schemaVersion)!==1)throw new Error('ability_balance_schema_unsupported');
  const source=raw.abilities;if(!source||typeof source!=='object'||Array.isArray(source))throw new Error('ability_balance_abilities_object_required');
  const abilities={};
  for(const key of Object.keys(source)){
    if(!KEY_SET.has(key))throw new Error('ability_balance_unknown_ability:'+key);
    const spec=source[key];if(!spec||typeof spec!=='object'||Array.isArray(spec))throw new Error('ability_balance_entry_object_required:'+key);
    const out={};
    for(const field of Object.keys(spec)){
      if(!FIELD_SET.has(field))throw new Error('ability_balance_unknown_field:'+key+':'+field);
      out[field]=normalizeMultiplier(spec[field],field,key);
    }
    abilities[key]=out;
  }
  return deepFreeze({schemaVersion:1,abilities});
}
function scaleNumber(object,key,factor){if(object&&Number.isFinite(Number(object[key])))object[key]=round(Number(object[key])*factor);}
function applySpec(def){
  if(!def||!KEY_SET.has(String(def.key||'')))return def;
  const out=clone(def),key=String(def.key),spec=active.abilities[key]||{};
  scaleNumber(out,'cooldown',spec.cooldown||1);
  if(out.resource)scaleNumber(out.resource,'cost',spec.resourceCost||1);
  const damage=spec.damage||1,heal=spec.heal||1,shield=spec.shield||1;
  if(Array.isArray(out.effects))out.effects.forEach(effect=>{if(!effect)return;if(effect.type==='damage')scaleNumber(effect,'amount',damage);else if(effect.type==='heal')scaleNumber(effect,'amount',heal);else if(effect.type==='shield')scaleNumber(effect,'amount',shield);});
  const range=spec.range||1;if(range!==1){if(out.targeting)scaleNumber(out.targeting,'range',range);if(out.telegraph)scaleNumber(out.telegraph,'range',range);if(out.delivery){scaleNumber(out.delivery,'maxDistance',range);scaleNumber(out.delivery,'distance',range);scaleNumber(out.delivery,'jumpRange',range);}}
  const speed=spec.speed||1;if(speed!==1&&out.delivery)scaleNumber(out.delivery,'speed',speed);
  const area=spec.area||1;if(area!==1){if(out.telegraph){scaleNumber(out.telegraph,'radius',area);scaleNumber(out.telegraph,'width',area);}if(out.delivery){scaleNumber(out.delivery,'radius',area);scaleNumber(out.delivery,'activationRadius',area);scaleNumber(out.delivery,'width',area);scaleNumber(out.delivery,'selectRadius',area);}}
  return deepFreeze(out);
}
function wrapRegistry(){
  const current=root.KeloAbilities;if(!current)return false;if(current.__hotBalanceWrapped===true){registryWrapped=true;return true;}
  const original=current.registry;if(!original)return false;
  const wrappedRegistry=Object.freeze({getById:id=>applySpec(original.getById(id)),getByKey:key=>applySpec(original.getByKey(key)),getAll:()=>(original.getAll()||[]).map(applySpec)});
  root.KeloAbilities=Object.freeze(Object.assign({},current,{registry:wrappedRegistry,__hotBalanceWrapped:true,__baseRegistry:original}));registryWrapped=true;return true;
}
function equippedStoneFor(slot){try{const state=(root.STATE&&typeof root.STATE==='object')?root.STATE:(typeof STATE!=='undefined'&&STATE&&typeof STATE==='object'?STATE:null);if(!state||!Array.isArray(state.equipped))return null;return state.equipped.find(s=>s&&s.uid===slot.stoneUid)||null;}catch(_){return null;}}
function patchHotbar(){
  const abilities=root.KeloAbilities;if(!abilities||!abilities.hotbar||!Array.isArray(abilities.hotbar.slots)||!abilities.stones)return 0;
  let changed=0;
  abilities.hotbar.slots.forEach(slot=>{if(!slot)return;const stone=equippedStoneFor(slot);if(!stone)return;const fresh=abilities.stones.resolveAbility(stone);if(!fresh)return;slot.definition=applySpec(fresh);changed++;});
  return changed;
}
function bindRuntime(){
  if(!root.KeloAbilities)return false;wrapRegistry();const abilities=root.KeloAbilities;
  if(!loadoutUnsubscribe&&abilities.bus&&typeof abilities.bus.on==='function'){loadoutUnsubscribe=abilities.bus.on('LOADOUT_CHANGED',()=>{try{patchHotbar();emit('runtime-refresh',{reason:'loadout-change'});}catch(error){lastError=String(error&&error.message||error);}});runtimeBindings++;}
  patchHotbar();return true;
}
function applyRuntime(reason){try{const ready=bindRuntime();emit('runtime-refresh',{reason:String(reason||'manual'),ready});return ready;}catch(error){lastError=String(error&&error.message||error);emit('runtime-error',{error:lastError});return false;}}
function setActive(next,source){active=next;epoch++;lastSource=String(source||'unknown');lastError=null;applyRuntime(lastSource);emit('changed',{source:lastSource});}
function validate(raw){try{const normalized=normalize(raw);prepared.set(raw,normalized);return true;}catch(error){lastError=String(error&&error.message||error);throw error;}}
function snapshot(){return active;}
function apply(raw,context){const next=prepared.get(raw)||normalize(raw);mutationSeq++;applies++;setActive(next,'hot:'+String(context&&context.build||'unknown'));return true;}
function rollback(previous,context){mutationSeq++;rollbacks++;setActive(previous&&previous.schemaVersion===1?previous:deepFreeze({schemaVersion:1,abilities:{}}),'rollback:'+String(context&&context.build||'unknown'));return true;}
function getConfig(){return active;}
function getState(){return Object.freeze({version:VERSION,path:PATH,schemaVersion:1,epoch,applies,rollbacks,lastError,lastSource,registered:!!root.KeloHotDataRegistry?.isRegistered?.(PATH),runtimeReady:!!root.KeloAbilities,runtimeBindings,registryWrapped,abilityCount:Object.keys(active.abilities).length,allowedAbilities:BASE_KEYS.length,allowedFields:FIELDS.slice(),timers:0,intervals:0,raf:0,gameLoop:false,storageWrites:0});}
async function loadInitial(){const seq=mutationSeq;try{const u=new URL(PATH,document.baseURI);u.searchParams.set('kelo_balance_boot',Date.now().toString(36));const response=await fetch(u.href,{cache:'no-cache',credentials:'same-origin',priority:'low'});if(!response.ok)throw new Error('ability_balance_http_'+response.status);const raw=await response.json(),next=normalize(raw);if(seq!==mutationSeq)return;setActive(next,'initial');}catch(error){lastError=String(error&&error.message||error);emit('initial-error',{error:lastError});}}
function register(){const registry=root.KeloHotDataRegistry;if(!registry||typeof registry.register!=='function')throw new Error('ability_balance_hot_registry_missing');registry.register({path:PATH,owner:'KeloAbilityHotBalance',version:VERSION,validate,snapshot,apply,rollback});}
root.KeloAbilityHotBalance=Object.freeze({version:VERSION,path:PATH,getState,getConfig,resolve:applySpec,applyRuntime});
root.KELO_ABILITY_HOT_BALANCE_AUDIT=Object.freeze({version:VERSION,registeredPath:PATH,scalarOnly:true,transactional:true,inFlightImmutable:true,recipeHotSwap:false,handlerHotSwap:false,statusTopologyHotSwap:false,polling:false,timers:0,intervals:0,raf:0,gameLoop:false});
try{register();}catch(error){lastError=String(error&&error.message||error);emit('register-error',{error:lastError});}
applyRuntime('owner-install');
root.addEventListener('KELO_MOUNTED',()=>{try{const loader=root.KeloAbilitiesLoader;if(loader&&typeof loader.ensure==='function')loader.ensure().then(()=>applyRuntime('mounted')).catch(()=>{});else applyRuntime('mounted');}catch(_){}},{passive:true});
root.addEventListener('kelo:runtime-foundations-ready',()=>{try{queueMicrotask(()=>applyRuntime('foundations-ready'));}catch(_){applyRuntime('foundations-ready');}},{passive:true});
void loadInitial();
})(typeof globalThis!=='undefined'?globalThis:window);
