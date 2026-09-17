/* KELO-INDEX
 * area: CORE / X-FOUNDATION / LIFECYCLE
 * owner: KeloLifecycleSupervisor
 * keys: LIFECYCLE STATE MACHINE FEATURE READY ERROR DEGRADED MOUNT DISPOSE BULKHEAD
 * purpose: canonical lifecycle state for optional features without becoming a loader, scheduler, renderer or gameplay owner
 * public-api: KeloLifecycleSupervisor.transition/get/snapshot/reset/states
 * consumes: existing KeloModuleLoader events only
 * state-owned: bounded lifecycle metadata per feature
 * online: client diagnostics/orchestration only; no authority
 * do-not: NO timers, NO polling, NO dynamic loading, NO gameplay writes, NO second scheduler
 */
(function(root){
'use strict';
if(root.KeloLifecycleSupervisor)return;
const VERSION='kelo-lifecycle-supervisor-v1.0.0';
const STATES=Object.freeze(['idle','loading-dependencies','mounting','connecting','ready','degraded','error','unmounting','disposed']);
const ALLOWED=Object.freeze({
  idle:['loading-dependencies','mounting','disposed','error'],
  'loading-dependencies':['mounting','connecting','ready','degraded','error','disposed'],
  mounting:['connecting','ready','degraded','error','unmounting'],
  connecting:['ready','degraded','error','unmounting'],
  ready:['degraded','error','unmounting'],
  degraded:['loading-dependencies','mounting','connecting','ready','error','unmounting','disposed'],
  error:['loading-dependencies','mounting','degraded','unmounting','disposed'],
  unmounting:['idle','disposed','error'],
  disposed:['idle']
});
const records=new Map();
function idOf(value){const id=String(value||'').trim();if(!id)throw new TypeError('lifecycle id required');return id;}
function cloneMeta(meta){if(!meta||typeof meta!=='object')return null;const out={};for(const [k,v] of Object.entries(meta)){if(v==null||['string','number','boolean'].includes(typeof v))out[k]=v;}return Object.freeze(out);}
function ensure(id){id=idOf(id);if(!records.has(id))records.set(id,{id,state:'idle',previous:null,changedAt:Date.now(),transitions:0,lastMeta:null,lastError:null,history:[]});return records.get(id);}
function publicRecord(record){return Object.freeze({id:record.id,state:record.state,previous:record.previous,changedAt:record.changedAt,transitions:record.transitions,lastMeta:record.lastMeta,lastError:record.lastError,history:Object.freeze(record.history.map(row=>Object.freeze({...row})))});}
function emit(record,from,to,meta){try{root.dispatchEvent(new CustomEvent('kelo:lifecycle-transition',{detail:Object.freeze({id:record.id,from,to,meta,state:publicRecord(record)})}));}catch(_){}}
function transition(id,next,meta){
  const record=ensure(id),target=String(next||'').trim();
  if(!STATES.includes(target))throw new TypeError('unknown lifecycle state: '+target);
  if(record.state===target){record.lastMeta=cloneMeta(meta);return publicRecord(record);}
  const allowed=ALLOWED[record.state]||[];
  if(!allowed.includes(target))throw new Error('ILLEGAL_LIFECYCLE_TRANSITION:'+record.id+':'+record.state+'->'+target);
  const from=record.state,now=Date.now(),safeMeta=cloneMeta(meta);
  record.previous=from;record.state=target;record.changedAt=now;record.transitions+=1;record.lastMeta=safeMeta;
  if(target==='error')record.lastError=safeMeta&&safeMeta.error?String(safeMeta.error):'unknown';
  else if(target==='ready')record.lastError=null;
  record.history.push({from,to:target,at:now,reason:safeMeta&&safeMeta.reason||null});
  while(record.history.length>12)record.history.shift();
  emit(record,from,target,safeMeta);
  return publicRecord(record);
}
function safeTransition(id,next,meta){try{return transition(id,next,meta);}catch(error){try{root.dispatchEvent(new CustomEvent('kelo:lifecycle-invalid-transition',{detail:Object.freeze({id:String(id||''),next:String(next||''),error:String(error&&error.message||error)})}));}catch(_){}return null;}}
function get(id){return publicRecord(ensure(id));}
function reset(id,meta){const record=ensure(id);if(record.state==='idle')return publicRecord(record);if(record.state!=='disposed'&&record.state!=='unmounting')safeTransition(id,'unmounting',{reason:'reset'});if(record.state==='unmounting')safeTransition(id,'idle',meta||{reason:'reset'});else if(record.state==='disposed')safeTransition(id,'idle',meta||{reason:'reset'});return publicRecord(record);}
function snapshot(){const out={};for(const [id,record] of records)out[id]=publicRecord(record);return Object.freeze({version:VERSION,states:STATES,features:Object.freeze(out),count:records.size});}
function feature(detail){return String(detail&&detail.feature||'').trim();}
function onStart(event){const d=event&&event.detail||{},id=feature(d);if(!id)return;const current=ensure(id);if(['idle','error','degraded','disposed'].includes(current.state))safeTransition(id,'mounting',{reason:'module-load-start',src:d.src||null});}
function onEnd(event){const d=event&&event.detail||{},id=feature(d);if(!id)return;if(d.ok===false)safeTransition(id,'degraded',{reason:'module-file-error',error:d.error||'MODULE_LOAD_ERROR',src:d.src||null});}
function onComplete(event){const d=event&&event.detail||{},id=feature(d);if(!id)return;if(d.ok===false)safeTransition(id,'error',{reason:'module-feature-complete',error:'MODULE_FEATURE_FAILED'});else{const current=ensure(id);if(current.state==='idle')safeTransition(id,'mounting',{reason:'cached-feature'});if(ensure(id).state!=='ready')safeTransition(id,'ready',{reason:'module-feature-complete'});}}
function onBlocked(event){const d=event&&event.detail||{},id=feature(d);if(!id)return;const current=ensure(id);if(current.state==='idle')safeTransition(id,'mounting',{reason:'attempted'});safeTransition(id,'degraded',{reason:d.error||'MODULE_BLOCKED'});}
try{root.addEventListener('kelo:module-load-start',onStart);root.addEventListener('kelo:module-load-end',onEnd);root.addEventListener('kelo:module-feature-complete',onComplete);root.addEventListener('kelo:module-blocked',onBlocked);root.addEventListener('kelo:module-quarantined',onBlocked);}catch(_){}
root.KeloLifecycleSupervisor=Object.freeze({version:VERSION,states:STATES,transition,get,snapshot,reset});
root.KELO_LIFECYCLE_SUPERVISOR_AUDIT=Object.freeze({version:VERSION,owner:'KeloLifecycleSupervisor',eventDriven:true,timers:0,loaderAuthority:false,gameplayAuthority:false,boundedHistory:12});
})(typeof globalThis!=='undefined'?globalThis:window);
