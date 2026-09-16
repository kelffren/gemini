/* KELO-INDEX
 * area: LIVEOPS / WORLD CONTENT HOT
 * owner: KeloLiveOpsWorldContent
 * keys: NPC MISSION EVENT HOT DATA CONTENT CATALOG TRANSACTION ROLLBACK MOBILE
 * purpose: hot-update declarative NPC presentation plus future mission/event templates without mutating active player/world state
 * public-api: KeloLiveOpsWorldContent.getState/getCatalog/getNpc/listNpcs/pinMission/listMissions/pinEvent/listEvents
 * state-owned: one immutable content pointer only; NO player progress, reward history, active mission/event state, spawns, timers or storage
 * do-not: NO executable callbacks/scripts, NO reward/economy payloads, NO active objective rewrite, NO event auto-fire, NO NPC spawning, NO polling
 */
(function(root){
'use strict';
if(root.KeloLiveOpsWorldContent)return;
const VERSION='kelo-liveops-world-content-hot-v1';
const PATH='src/systems/liveops-world-content.json';
const ID_RE=/^[a-z0-9][a-z0-9_-]{1,63}$/;
const prepared=new WeakMap();
let active=deepFreeze({schemaVersion:1,revision:'bootstrap-default',npcs:[],missions:[],events:[]});
let epoch=0,applies=0,rollbacks=0,lastError=null,lastSource='bootstrap-default',mutationSeq=0;
function clone(value){return value==null?value:JSON.parse(JSON.stringify(value));}
function deepFreeze(value){if(!value||typeof value!=='object'||Object.isFrozen(value))return value;Object.keys(value).forEach(key=>deepFreeze(value[key]));return Object.freeze(value);}
function emit(type,detail){try{root.dispatchEvent(new CustomEvent('kelo:liveops-world-content:'+type,{detail:Object.assign(getState(),detail||{})}));}catch(_){} }
function assertObject(value,label){if(!value||typeof value!=='object'||Array.isArray(value))throw new Error(label+'_object_required');return value;}
function exactKeys(value,allowed,label){for(const key of Object.keys(value))if(!allowed.has(key))throw new Error(label+'_unknown_field:'+key);}
function id(value,label){const out=String(value||'');if(!ID_RE.test(out))throw new Error(label+'_invalid_id');return out;}
function text(value,label,max,required){const out=String(value==null?'':value).trim();if(required&&!out)throw new Error(label+'_required');if(out.length>max)throw new Error(label+'_too_long');if(/[<>\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(out))throw new Error(label+'_unsafe_text');return out;}
function bool(value,label){if(typeof value!=='boolean')throw new Error(label+'_boolean_required');return value;}
function revision(value,label){return text(value,label,48,true);}
function uniqueIds(items,label){const seen=new Set();for(const item of items){if(seen.has(item.id))throw new Error(label+'_duplicate_id:'+item.id);seen.add(item.id);}return seen;}
function normalizeTags(value,label){if(value==null)return [];if(!Array.isArray(value)||value.length>12)throw new Error(label+'_tags_invalid');const out=value.map((v,i)=>text(v,label+'_tag_'+i,32,true).toLowerCase());if(new Set(out).size!==out.length)throw new Error(label+'_duplicate_tag');return out;}
function normalizeDialogue(value,npcId){if(value==null)return [];if(!Array.isArray(value)||value.length>40)throw new Error('liveops_npc_dialogue_invalid:'+npcId);const rows=value.map((row,index)=>{assertObject(row,'liveops_npc_dialogue_'+npcId+'_'+index);exactKeys(row,new Set(['id','text']),'liveops_npc_dialogue_'+npcId+'_'+index);return {id:id(row.id,'liveops_npc_dialogue_'+npcId+'_'+index),text:text(row.text,'liveops_npc_dialogue_text_'+npcId+'_'+index,280,true)};});uniqueIds(rows,'liveops_npc_dialogue_'+npcId);return rows;}
function normalizeNpc(raw,index){assertObject(raw,'liveops_npc_'+index);exactKeys(raw,new Set(['id','revision','enabled','name','role','summary','tags','dialogue']),'liveops_npc_'+index);const npcId=id(raw.id,'liveops_npc_'+index);return {id:npcId,revision:revision(raw.revision,'liveops_npc_revision_'+npcId),enabled:bool(raw.enabled,'liveops_npc_enabled_'+npcId),name:text(raw.name,'liveops_npc_name_'+npcId,64,true),role:text(raw.role,'liveops_npc_role_'+npcId,48,true),summary:text(raw.summary,'liveops_npc_summary_'+npcId,280,false),tags:normalizeTags(raw.tags,'liveops_npc_'+npcId),dialogue:normalizeDialogue(raw.dialogue,npcId)};}
function normalizeObjectives(value,missionId){if(!Array.isArray(value)||value.length<1||value.length>16)throw new Error('liveops_mission_objectives_invalid:'+missionId);const rows=value.map((row,index)=>{assertObject(row,'liveops_mission_objective_'+missionId+'_'+index);exactKeys(row,new Set(['id','label']),'liveops_mission_objective_'+missionId+'_'+index);return {id:id(row.id,'liveops_mission_objective_'+missionId+'_'+index),label:text(row.label,'liveops_mission_objective_label_'+missionId+'_'+index,160,true)};});uniqueIds(rows,'liveops_mission_objective_'+missionId);return rows;}
function normalizeMission(raw,index){assertObject(raw,'liveops_mission_'+index);exactKeys(raw,new Set(['id','revision','enabled','title','summary','category','giverNpcId','objectives']),'liveops_mission_'+index);const missionId=id(raw.id,'liveops_mission_'+index);const giver=raw.giverNpcId==null?'':id(raw.giverNpcId,'liveops_mission_giver_'+missionId);return {id:missionId,revision:revision(raw.revision,'liveops_mission_revision_'+missionId),enabled:bool(raw.enabled,'liveops_mission_enabled_'+missionId),title:text(raw.title,'liveops_mission_title_'+missionId,96,true),summary:text(raw.summary,'liveops_mission_summary_'+missionId,320,false),category:text(raw.category,'liveops_mission_category_'+missionId,40,true).toLowerCase(),giverNpcId:giver,objectives:normalizeObjectives(raw.objectives,missionId)};}
function integer(value,label,min,max){const n=Number(value);if(!Number.isInteger(n)||n<min||n>max)throw new Error(label+'_out_of_range');return n;}
function normalizeEvent(raw,index){assertObject(raw,'liveops_event_'+index);exactKeys(raw,new Set(['id','revision','enabled','title','summary','kind','locationId','minPlayers','recommendedPlayers']),'liveops_event_'+index);const eventId=id(raw.id,'liveops_event_'+index);const minPlayers=integer(raw.minPlayers,'liveops_event_min_players_'+eventId,1,200),recommendedPlayers=integer(raw.recommendedPlayers,'liveops_event_recommended_players_'+eventId,minPlayers,200);return {id:eventId,revision:revision(raw.revision,'liveops_event_revision_'+eventId),enabled:bool(raw.enabled,'liveops_event_enabled_'+eventId),title:text(raw.title,'liveops_event_title_'+eventId,96,true),summary:text(raw.summary,'liveops_event_summary_'+eventId,320,false),kind:text(raw.kind,'liveops_event_kind_'+eventId,40,true).toLowerCase(),locationId:text(raw.locationId,'liveops_event_location_'+eventId,64,true),minPlayers,recommendedPlayers};}
function normalize(raw){
  assertObject(raw,'liveops_world_content');
  exactKeys(raw,new Set(['schemaVersion','revision','npcs','missions','events']),'liveops_world_content');
  if(Number(raw.schemaVersion)!==1)throw new Error('liveops_world_content_schema_unsupported');
  if(!Array.isArray(raw.npcs)||raw.npcs.length>500)throw new Error('liveops_world_content_npcs_invalid');
  if(!Array.isArray(raw.missions)||raw.missions.length>500)throw new Error('liveops_world_content_missions_invalid');
  if(!Array.isArray(raw.events)||raw.events.length>250)throw new Error('liveops_world_content_events_invalid');
  const npcs=raw.npcs.map(normalizeNpc),missions=raw.missions.map(normalizeMission),events=raw.events.map(normalizeEvent);
  const npcIds=uniqueIds(npcs,'liveops_npcs');uniqueIds(missions,'liveops_missions');uniqueIds(events,'liveops_events');
  for(const mission of missions)if(mission.giverNpcId&&!npcIds.has(mission.giverNpcId))throw new Error('liveops_mission_unknown_giver:'+mission.id+':'+mission.giverNpcId);
  return deepFreeze({schemaVersion:1,revision:revision(raw.revision,'liveops_world_content_revision'),npcs,missions,events});
}
function byId(list,value){const key=String(value||'');return list.find(row=>row.id===key)||null;}
function pinned(value){return value?deepFreeze(clone(value)):null;}
function getCatalog(){return active;}
function getNpc(value){return byId(active.npcs,value);}
function listNpcs(options){const enabledOnly=options?.enabledOnly!==false;return Object.freeze(active.npcs.filter(row=>!enabledOnly||row.enabled));}
function pinMission(value){const row=byId(active.missions,value);return row&&row.enabled?pinned(row):null;}
function listMissions(options){const enabledOnly=options?.enabledOnly!==false;return Object.freeze(active.missions.filter(row=>!enabledOnly||row.enabled));}
function pinEvent(value){const row=byId(active.events,value);return row&&row.enabled?pinned(row):null;}
function listEvents(options){const enabledOnly=options?.enabledOnly!==false;return Object.freeze(active.events.filter(row=>!enabledOnly||row.enabled));}
function validate(raw){try{const normalized=normalize(raw);prepared.set(raw,normalized);return true;}catch(error){lastError=String(error&&error.message||error);throw error;}}
function snapshot(){return active;}
function setActive(next,source){active=next;epoch++;lastSource=String(source||'unknown');lastError=null;emit('changed',{source:lastSource,revision:active.revision});}
function apply(raw,context){const next=prepared.get(raw)||normalize(raw);mutationSeq++;applies++;setActive(next,'hot:'+String(context&&context.build||'unknown'));return true;}
function rollback(previous,context){mutationSeq++;rollbacks++;setActive(previous&&previous.schemaVersion===1?previous:deepFreeze({schemaVersion:1,revision:'rollback-default',npcs:[],missions:[],events:[]}),'rollback:'+String(context&&context.build||'unknown'));return true;}
function getState(){return Object.freeze({version:VERSION,path:PATH,schemaVersion:1,revision:active.revision,epoch,applies,rollbacks,lastError,lastSource,registered:!!root.KeloHotDataRegistry?.isRegistered?.(PATH),npcDefinitions:active.npcs.length,missionDefinitions:active.missions.length,eventDefinitions:active.events.length,activeProgressMutations:0,rewardMutations:0,economyMutations:0,spawnMutations:0,eventAutoFires:0,persistenceWrites:0,timers:0,intervals:0,raf:0,gameLoop:false});}
async function loadInitial(){const seq=mutationSeq;try{const u=new URL(PATH,document.baseURI);u.searchParams.set('kelo_liveops_boot',Date.now().toString(36));const response=await fetch(u.href,{cache:'no-cache',credentials:'same-origin',priority:'low'});if(!response.ok)throw new Error('liveops_world_content_http_'+response.status);const raw=await response.json(),next=normalize(raw);if(seq!==mutationSeq)return;setActive(next,'initial');}catch(error){lastError=String(error&&error.message||error);emit('initial-error',{error:lastError});}}
function register(){const registry=root.KeloHotDataRegistry;if(!registry||typeof registry.register!=='function')throw new Error('liveops_world_content_hot_registry_missing');registry.register({path:PATH,owner:'KeloLiveOpsWorldContent',version:VERSION,validate,snapshot,apply,rollback});}
root.KeloLiveOpsWorldContent=Object.freeze({version:VERSION,path:PATH,getState,getCatalog,getNpc,listNpcs,pinMission,listMissions,pinEvent,listEvents});
root.KELO_LIVEOPS_WORLD_CONTENT_AUDIT=Object.freeze({version:VERSION,registeredPath:PATH,transactional:true,contentOnly:true,npcSpawning:false,missionFutureAcceptanceOnly:true,eventFutureInstancesOnly:true,activeProgressMutation:false,rewardMutation:false,economyMutation:false,eventAutoFire:false,executablePayloads:false,polling:false,timers:0,intervals:0,raf:0,gameLoop:false,storageWrites:0});
try{register();}catch(error){lastError=String(error&&error.message||error);emit('register-error',{error:lastError});}
void loadInitial();
})(typeof globalThis!=='undefined'?globalThis:window);
