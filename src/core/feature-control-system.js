/* KELO-INDEX
 * area: CORE / RELIABILITY
 * owner: KELO_FUSEBOX
 * keys: FEATURE FLAG KILL-SWITCH CIRCUIT-BREAKER BULKHEAD HEALTH FAILURE ISOLATION HALF-OPEN
 * purpose: aislar fallos de módulos opcionales; reutiliza KELO_FEATURE_REGISTRY para identidad y KELO_ASSET_REGISTRY para el interruptor manual
 * public-api: KELO_FUSEBOX.canRun/beginAttempt/recordSuccess/recordFailure/cancelAttempt/run/explain/getState/resetCircuit/resetAll/setEnabled
 * consumes: KELO_FEATURE_REGISTRY + KELO_ASSET_REGISTRY + sessionStorage
 * state-owned: estado de circuit breaker por feature (CLOSED/OPEN/HALF_OPEN), contadores y última falla de la sesión
 * extension-points: owners opcionales pueden envolver operaciones async con run() o reportar success/failure explícitamente
 * online: el estado automático es local de sesión; setEnabled delega al allow-list actual y puede sustituirse por policy server sin cambiar consumidores
 * do-not: NO duplicar catálogo de features, NO segundo loader, NO polling/setInterval, NO apagar CORE, NO capturar errores globales por heurística
 */
(function(root){
'use strict';
if(root.KELO_FUSEBOX)return;

const VERSION='kelo-fusebox-v1.0.0';
const SESSION_KEY='kelo_fusebox_session_v1';
const rawConfig=root.__KELO_FUSEBOX_CONFIG__&&typeof root.__KELO_FUSEBOX_CONFIG__==='object'?root.__KELO_FUSEBOX_CONFIG__:{};
const FAILURE_THRESHOLD=Math.max(1,Math.min(10,Number(rawConfig.failureThreshold)||3));
const COOLDOWN_MS=Math.max(10,Math.min(300000,Number(rawConfig.cooldownMs)||30000));
const circuits=Object.create(null);

function registry(){return root.KELO_FEATURE_REGISTRY||null;}
function assets(){return root.KELO_ASSET_REGISTRY||null;}
function resolve(id){const key=String(id||'');const r=registry();return r&&typeof r.resolve==='function'?r.resolve(key):key;}
function known(id){const key=resolve(id),r=registry();if(r&&typeof r.has==='function')return r.has(key);const list=assets()?.known;return Array.isArray(list)?list.includes(key):false;}
function ids(){const r=registry();if(r&&Array.isArray(r.ids))return r.ids.slice();const list=assets()?.known;return Array.isArray(list)?list.slice():[];}
function blank(id){return {id,mode:'CLOSED',consecutiveFailures:0,totalFailures:0,openedAt:0,retryAt:0,lastFailure:null,lastSuccessAt:0,probeInFlight:false};}
function circuit(id){const key=resolve(id);if(!known(key))return null;return circuits[key]||(circuits[key]=blank(key));}
function safeText(value,max){const text=String(value??'').replace(/[\r\n\t]+/g,' ').trim();return text.slice(0,max||180);}
function errorInfo(error,detail){const code=safeText(detail?.code||error?.code||error?.name||'FEATURE_FAILURE',80)||'FEATURE_FAILURE';const message=safeText(detail?.message||error?.message||error||code,180)||code;return {code,message};}
function manualEnabled(id){const key=resolve(id),a=assets();try{return !a||typeof a.isEnabled!=='function'?true:a.isEnabled(key)!==false;}catch(_){return true;}}
function persist(){try{const out={};for(const id of ids()){const c=circuits[id];if(!c)continue;out[id]={mode:c.mode==='HALF_OPEN'?'OPEN':c.mode,consecutiveFailures:c.consecutiveFailures,totalFailures:c.totalFailures,openedAt:c.openedAt,retryAt:c.retryAt,lastFailure:c.lastFailure,lastSuccessAt:c.lastSuccessAt};}root.sessionStorage?.setItem?.(SESSION_KEY,JSON.stringify({version:1,circuits:out}));}catch(_){}}
function restore(){try{const raw=root.sessionStorage?.getItem?.(SESSION_KEY);if(!raw)return;const parsed=JSON.parse(raw),saved=parsed&&parsed.circuits;if(!saved||typeof saved!=='object')return;for(const id of ids()){const src=saved[id];if(!src||typeof src!=='object')continue;const c=blank(id),mode=String(src.mode||'CLOSED');c.mode=mode==='OPEN'?'OPEN':'CLOSED';c.consecutiveFailures=Math.max(0,Number(src.consecutiveFailures)||0);c.totalFailures=Math.max(0,Number(src.totalFailures)||0);c.openedAt=Math.max(0,Number(src.openedAt)||0);c.retryAt=Math.max(0,Number(src.retryAt)||0);c.lastFailure=src.lastFailure&&typeof src.lastFailure==='object'?{at:Math.max(0,Number(src.lastFailure.at)||0),code:safeText(src.lastFailure.code,80),message:safeText(src.lastFailure.message,180)}:null;c.lastSuccessAt=Math.max(0,Number(src.lastSuccessAt)||0);circuits[id]=c;}}catch(_){}}
function emit(type,id,extra){const c=circuit(id),detail=Object.freeze({feature:resolve(id),...(c?{mode:c.mode,consecutiveFailures:c.consecutiveFailures,totalFailures:c.totalFailures,retryAt:c.retryAt}:{}),...(extra||{})});try{root.dispatchEvent?.(new CustomEvent(type,{detail}));}catch(_){}}
function explain(id){const key=resolve(id);if(!known(key))return Object.freeze({feature:key,managed:false,allowed:true,status:'UNMANAGED',reason:'core-or-unknown'});if(!manualEnabled(key))return Object.freeze({feature:key,managed:true,allowed:false,status:'MANUAL_OFF',reason:'manual-kill-switch'});const c=circuit(key),now=Date.now();if(c.mode==='OPEN'){if(now<c.retryAt)return Object.freeze({feature:key,managed:true,allowed:false,status:'OPEN',reason:'circuit-open',retryAt:c.retryAt,failures:c.consecutiveFailures});return Object.freeze({feature:key,managed:true,allowed:true,status:'HALF_OPEN_READY',reason:'probe-ready',retryAt:c.retryAt,failures:c.consecutiveFailures});}if(c.mode==='HALF_OPEN'&&c.probeInFlight)return Object.freeze({feature:key,managed:true,allowed:false,status:'HALF_OPEN_BUSY',reason:'probe-in-flight',retryAt:c.retryAt,failures:c.consecutiveFailures});if(c.mode==='HALF_OPEN')return Object.freeze({feature:key,managed:true,allowed:true,status:'HALF_OPEN_READY',reason:'probe-ready',retryAt:c.retryAt,failures:c.consecutiveFailures});return Object.freeze({feature:key,managed:true,allowed:true,status:'CLOSED',reason:'healthy',failures:c.consecutiveFailures});}
function canRun(id){return explain(id).allowed!==false;}
function beginAttempt(id){const key=resolve(id);if(!known(key))return true;if(!manualEnabled(key))return false;const c=circuit(key),now=Date.now();if(c.mode==='OPEN'){if(now<c.retryAt)return false;c.mode='HALF_OPEN';c.probeInFlight=true;persist();emit('kelo:fusebox-half-open',key,{reason:'cooldown-elapsed'});return true;}if(c.mode==='HALF_OPEN'){if(c.probeInFlight)return false;c.probeInFlight=true;persist();return true;}return true;}
function recordSuccess(id,detail){const key=resolve(id),c=circuit(key);if(!c)return false;const was=c.mode;c.mode='CLOSED';c.consecutiveFailures=0;c.retryAt=0;c.openedAt=0;c.probeInFlight=false;c.lastSuccessAt=Date.now();persist();emit('kelo:fusebox-success',key,{from:was,operation:safeText(detail?.operation,80)});if(was!=='CLOSED')emit('kelo:fusebox-reset',key,{from:was,reason:'successful-probe'});return true;}
function recordFailure(id,error,detail){const key=resolve(id),c=circuit(key);if(!c)return false;const now=Date.now(),info=errorInfo(error,detail),was=c.mode;c.totalFailures+=1;c.consecutiveFailures+=1;c.lastFailure={at:now,code:info.code,message:info.message};c.probeInFlight=false;const shouldOpen=was==='HALF_OPEN'||c.consecutiveFailures>=FAILURE_THRESHOLD;if(shouldOpen){c.mode='OPEN';c.openedAt=now;c.retryAt=now+COOLDOWN_MS;}else c.mode='CLOSED';persist();emit('kelo:fusebox-failure',key,{code:info.code,message:info.message,opened:shouldOpen});if(shouldOpen)emit('kelo:fusebox-trip',key,{code:info.code,message:info.message,from:was,retryAt:c.retryAt});return shouldOpen;}
function cancelAttempt(id,reason){const key=resolve(id),c=circuit(key);if(!c)return false;if(c.mode==='HALF_OPEN'){c.mode='OPEN';c.probeInFlight=false;c.retryAt=Date.now();persist();emit('kelo:fusebox-state-changed',key,{reason:safeText(reason||'attempt-cancelled',80)});}return true;}
function resetCircuit(id,reason){const key=resolve(id),c=circuit(key);if(!c)return false;const from=c.mode;c.mode='CLOSED';c.consecutiveFailures=0;c.openedAt=0;c.retryAt=0;c.probeInFlight=false;persist();emit('kelo:fusebox-reset',key,{from,reason:safeText(reason||'manual-reset',80)});return true;}
function resetAll(reason){for(const id of ids())resetCircuit(id,reason||'manual-reset-all');return getState();}
function setEnabled(id,value){const key=resolve(id),a=assets();if(!known(key)||!a||typeof a.setEnabled!=='function')return false;a.setEnabled(key,!!value);emit('kelo:fusebox-state-changed',key,{reason:value?'manual-on':'manual-off'});return true;}
async function run(id,operation,options){if(typeof operation!=='function')throw new TypeError('KELO_FUSEBOX.run requires a function');const opts=options&&typeof options==='object'?options:{};if(!beginAttempt(id))return typeof opts.fallback==='function'?opts.fallback(explain(id)):opts.fallback;try{const result=await operation();recordSuccess(id,{operation:opts.operation});return result;}catch(error){recordFailure(id,error,{operation:opts.operation,code:opts.code});if(opts.rethrow===false)return typeof opts.fallback==='function'?opts.fallback(explain(id),error):opts.fallback;throw error;}}
function snapshot(id){const key=resolve(id),c=circuit(key),gate=explain(key);if(!c)return gate;return Object.freeze({...gate,mode:c.mode,consecutiveFailures:c.consecutiveFailures,totalFailures:c.totalFailures,openedAt:c.openedAt,retryAt:c.retryAt,lastFailure:c.lastFailure?Object.freeze({...c.lastFailure}):null,lastSuccessAt:c.lastSuccessAt,probeInFlight:c.probeInFlight});}
function getState(){const features={};for(const id of ids())features[id]=snapshot(id);return Object.freeze({version:VERSION,threshold:FAILURE_THRESHOLD,cooldownMs:COOLDOWN_MS,sessionKey:SESSION_KEY,features:Object.freeze(features)});}
restore();
try{root.addEventListener?.('kelo:asset-selection-changed',event=>{const f=event?.detail?.features||{};for(const id of ids())if(Object.prototype.hasOwnProperty.call(f,id))emit('kelo:fusebox-state-changed',id,{reason:f[id]===false?'manual-off':'manual-on'});});}catch(_){}
root.KELO_FUSEBOX=Object.freeze({version:VERSION,states:Object.freeze({CLOSED:'CLOSED',OPEN:'OPEN',HALF_OPEN:'HALF_OPEN'}),failureThreshold:FAILURE_THRESHOLD,cooldownMs:COOLDOWN_MS,canRun,beginAttempt,recordSuccess,recordFailure,cancelAttempt,run,explain,snapshot,getState,diagnostics:getState,resetCircuit,resetAll,setEnabled,isEnabled:canRun});
})(typeof globalThis!=='undefined'?globalThis:window);
