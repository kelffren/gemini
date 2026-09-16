/* KELO-INDEX
 * area: PVP / ARENA PROGRESSION HOT BALANCE
 * owner: KeloArenaProgressionHotBalance
 * keys: ARENA PROGRESSION MASTERY XP HOT DATA TRANSACTION ROLLBACK LIVEOPS
 * purpose: hot-update mastery thresholds and future Arena XP awards without rewriting earned XP or touching combat/MMR authority
 * public-api: KeloArenaProgressionHotBalance.getState/getConfig/tiers/adjustXp
 * state-owned: one immutable balance pointer; NO player progression state, timer, polling, game loop or storage
 * do-not: NO earned-XP mutation, NO MMR/rating/winner/HP changes, NO objective unlock mutation, NO persistence writes
 */
(function(root){
'use strict';
if(root.KeloArenaProgressionHotBalance)return;
const VERSION='kelo-arena-progression-hot-v1';
const PATH='src/systems/arena-progression-balance.json';
const TIER_IDS=Object.freeze(['rookie','fighter','duelist','tactician','master','champion','legend']);
const TIER_SET=new Set(TIER_IDS);
const DEFAULT_THRESHOLDS=Object.freeze({rookie:0,fighter:100,duelist:250,tactician:500,master:900,champion:1500,legend:2400});
const prepared=new WeakMap();
let active=deepFreeze({schemaVersion:1,masteryThresholds:Object.assign({},DEFAULT_THRESHOLDS),xp:{globalMultiplier:1,winMultiplier:1,lossMultiplier:1,minAward:4}}),epoch=0,applies=0,rollbacks=0,lastError=null,lastSource='bootstrap-default',mutationSeq=0;
function deepFreeze(value){if(!value||typeof value!=='object'||Object.isFrozen(value))return value;Object.keys(value).forEach(k=>deepFreeze(value[k]));return Object.freeze(value);}
function emit(type,detail){try{root.dispatchEvent(new CustomEvent('kelo:arena-progression-balance:'+type,{detail:Object.assign(getState(),detail||{})}));}catch(_){} }
function finiteMultiplier(value,name){const n=Number(value);if(!Number.isFinite(n)||n<0.25||n>4)throw new Error('arena_progression_multiplier_out_of_range:'+name);return Number(n.toFixed(4));}
function normalize(raw){
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error('arena_progression_balance_object_required');
  if(Number(raw.schemaVersion)!==1)throw new Error('arena_progression_balance_schema_unsupported');
  const thresholds=raw.masteryThresholds;if(!thresholds||typeof thresholds!=='object'||Array.isArray(thresholds))throw new Error('arena_progression_thresholds_object_required');
  const keys=Object.keys(thresholds);if(keys.length!==TIER_IDS.length||keys.some(id=>!TIER_SET.has(id)))throw new Error('arena_progression_threshold_ids_mismatch');
  const normalizedThresholds={};let previous=-1;
  for(const id of TIER_IDS){const n=Number(thresholds[id]);if(!Number.isInteger(n)||n<0||n>1000000)throw new Error('arena_progression_threshold_invalid:'+id);if(id==='rookie'&&n!==0)throw new Error('arena_progression_rookie_must_be_zero');if(n<=previous)throw new Error('arena_progression_thresholds_not_strictly_increasing:'+id);normalizedThresholds[id]=n;previous=n;}
  const xp=raw.xp;if(!xp||typeof xp!=='object'||Array.isArray(xp))throw new Error('arena_progression_xp_object_required');
  const xpKeys=Object.keys(xp),allowed=new Set(['globalMultiplier','winMultiplier','lossMultiplier','minAward']);if(xpKeys.some(k=>!allowed.has(k)))throw new Error('arena_progression_unknown_xp_field');
  const minAward=Number(xp.minAward);if(!Number.isInteger(minAward)||minAward<1||minAward>100)throw new Error('arena_progression_min_award_out_of_range');
  return deepFreeze({schemaVersion:1,masteryThresholds:normalizedThresholds,xp:{globalMultiplier:finiteMultiplier(xp.globalMultiplier,'global'),winMultiplier:finiteMultiplier(xp.winMultiplier,'win'),lossMultiplier:finiteMultiplier(xp.lossMultiplier,'loss'),minAward}});
}
function tiers(baseTiers){
  const source=Array.isArray(baseTiers)?baseTiers:[];
  return Object.freeze(source.map(row=>Object.freeze(Object.assign({},row,{min:Number(active.masteryThresholds[row&&row.id]??row&&row.min)||0}))));
}
function adjustXp(baseXp,result){
  const base=Math.max(0,Math.round(Number(baseXp)||0)),xp=active.xp||{},outcome=result&&result.won===true?Number(xp.winMultiplier)||1:Number(xp.lossMultiplier)||1;
  const scaled=Math.round(base*(Number(xp.globalMultiplier)||1)*outcome);
  return Math.max(Number(xp.minAward)||1,scaled);
}
function validate(raw){try{const normalized=normalize(raw);prepared.set(raw,normalized);return true;}catch(error){lastError=String(error&&error.message||error);throw error;}}
function snapshot(){return active;}
function setActive(next,source){active=next;epoch++;lastSource=String(source||'unknown');lastError=null;emit('changed',{source:lastSource});}
function apply(raw,context){const next=prepared.get(raw)||normalize(raw);mutationSeq++;applies++;setActive(next,'hot:'+String(context&&context.build||'unknown'));return true;}
function rollback(previous,context){mutationSeq++;rollbacks++;setActive(previous&&previous.schemaVersion===1?previous:deepFreeze({schemaVersion:1,masteryThresholds:Object.assign({},DEFAULT_THRESHOLDS),xp:{globalMultiplier:1,winMultiplier:1,lossMultiplier:1,minAward:4}}),'rollback:'+String(context&&context.build||'unknown'));return true;}
function getConfig(){return active;}
function getState(){return Object.freeze({version:VERSION,path:PATH,schemaVersion:1,epoch,applies,rollbacks,lastError,lastSource,registered:!!root.KeloHotDataRegistry?.isRegistered?.(PATH),historicalXpMutation:false,mmrAuthorityTouched:false,combatAuthorityTouched:false,persistenceWrites:0,timers:0,intervals:0,raf:0,gameLoop:false});}
async function loadInitial(){const seq=mutationSeq;try{const u=new URL(PATH,document.baseURI);u.searchParams.set('kelo_arena_progression_boot',Date.now().toString(36));const response=await fetch(u.href,{cache:'no-cache',credentials:'same-origin',priority:'low'});if(!response.ok)throw new Error('arena_progression_balance_http_'+response.status);const raw=await response.json(),next=normalize(raw);if(seq!==mutationSeq)return;setActive(next,'initial');}catch(error){lastError=String(error&&error.message||error);emit('initial-error',{error:lastError});}}
function register(){const registry=root.KeloHotDataRegistry;if(!registry||typeof registry.register!=='function')throw new Error('arena_progression_hot_registry_missing');registry.register({path:PATH,owner:'KeloArenaProgressionHotBalance',version:VERSION,validate,snapshot,apply,rollback});}
root.KeloArenaProgressionHotBalance=Object.freeze({version:VERSION,path:PATH,getState,getConfig,tiers,adjustXp});
root.KELO_ARENA_PROGRESSION_HOT_AUDIT=Object.freeze({version:VERSION,registeredPath:PATH,transactional:true,futureRewardsOnly:true,historicalXpMutation:false,mmrAuthorityTouched:false,combatAuthorityTouched:false,objectiveMutation:false,polling:false,timers:0,intervals:0,raf:0,gameLoop:false,storageWrites:0});
try{register();}catch(error){lastError=String(error&&error.message||error);emit('register-error',{error:lastError});}
void loadInitial();
})(typeof globalThis!=='undefined'?globalThis:window);
