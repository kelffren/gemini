/* KELO-INDEX
 * area: CORE / X-FOUNDATION / FAILURE
 * owner: KeloFailureBoundary
 * keys: CIRCUIT BREAKER BULKHEAD CLOSED OPEN HALF-OPEN FAILURE ISOLATION RETRY
 * purpose: isolate repeated optional-feature failures so one broken dependency cannot thrash the rest of the runtime
 * public-api: KeloFailureBoundary.configure/isBlocked/success/failure/reset/get/snapshot
 * consumes: existing module-loader completion/error events
 * state-owned: per-feature circuit state/counters only
 * online: client reliability only; no gameplay/economic authority
 * do-not: NO timer scheduler, NO polling, NO retry loop, NO global kill switch, NO gameplay writes
 */
(function(root){
'use strict';
if(root.KeloFailureBoundary)return;
const VERSION='kelo-failure-boundary-v1.0.0';
const DEFAULTS=Object.freeze({threshold:3,cooldownMs:12000});
const circuits=new Map();
function idOf(value){const id=String(value||'').trim();if(!id)throw new TypeError('failure boundary id required');return id;}
function ensure(id){id=idOf(id);if(!circuits.has(id))circuits.set(id,{id,state:'closed',failures:0,successes:0,openedAt:0,lastFailureAt:0,lastSuccessAt:0,lastError:null,threshold:DEFAULTS.threshold,cooldownMs:DEFAULTS.cooldownMs,trips:0});return circuits.get(id);}
function publicCircuit(c){const now=Date.now(),blocked=c.state==='open'&&now-c.openedAt<c.cooldownMs;return Object.freeze({id:c.id,state:c.state,blocked,failures:c.failures,successes:c.successes,trips:c.trips,openedAt:c.openedAt,lastFailureAt:c.lastFailureAt,lastSuccessAt:c.lastSuccessAt,lastError:c.lastError,threshold:c.threshold,cooldownMs:c.cooldownMs,retryAfterMs:blocked?Math.max(0,c.cooldownMs-(now-c.openedAt)):0});}
function emit(c,reason){try{root.dispatchEvent(new CustomEvent('kelo:failure-boundary',{detail:Object.freeze({reason:reason||null,circuit:publicCircuit(c)})}));}catch(_){}}
function configure(id,options){const c=ensure(id),o=options&&typeof options==='object'?options:{};if(Number.isFinite(Number(o.threshold)))c.threshold=Math.max(1,Math.floor(Number(o.threshold)));if(Number.isFinite(Number(o.cooldownMs)))c.cooldownMs=Math.max(0,Math.floor(Number(o.cooldownMs)));return publicCircuit(c);}
function isBlocked(id,at){const c=ensure(id),now=Number.isFinite(Number(at))?Number(at):Date.now();if(c.state!=='open')return false;if(now-c.openedAt<c.cooldownMs)return true;c.state='half-open';emit(c,'cooldown-elapsed');return false;}
function success(id){const c=ensure(id),was=c.state;c.state='closed';c.failures=0;c.successes+=1;c.lastSuccessAt=Date.now();c.lastError=null;if(was!=='closed')emit(c,'recovered');return publicCircuit(c);}
function failure(id,error){const c=ensure(id),now=Date.now();c.failures+=1;c.lastFailureAt=now;c.lastError=String(error&&error.message||error||'FAILURE');if(c.state==='half-open'||c.failures>=c.threshold){c.state='open';c.openedAt=now;c.trips+=1;emit(c,'trip');}else emit(c,'failure');return publicCircuit(c);}
function reset(id){const c=ensure(id);c.state='closed';c.failures=0;c.successes=0;c.openedAt=0;c.lastFailureAt=0;c.lastSuccessAt=0;c.lastError=null;emit(c,'reset');return publicCircuit(c);}
function get(id){return publicCircuit(ensure(id));}
function snapshot(){const out={};for(const [id,c] of circuits)out[id]=publicCircuit(c);return Object.freeze({version:VERSION,defaults:DEFAULTS,circuits:Object.freeze(out),count:circuits.size});}
function feature(detail){return String(detail&&detail.feature||'').trim();}
function onComplete(event){const d=event&&event.detail||{},id=feature(d);if(!id)return;if(d.ok===false)failure(id,'MODULE_FEATURE_FAILED');else success(id);}
function onError(event){const d=event&&event.detail||{},id=feature(d);if(!id)return;failure(id,d.error||'MODULE_LOAD_ERROR');}
try{root.addEventListener('kelo:module-feature-complete',onComplete);root.addEventListener('kelo:module-load-error',onError);}catch(_){}
root.KeloFailureBoundary=Object.freeze({version:VERSION,configure,isBlocked,success,failure,reset,get,snapshot});
root.KELO_FAILURE_BOUNDARY_AUDIT=Object.freeze({version:VERSION,owner:'KeloFailureBoundary',bulkhead:'per-feature',states:Object.freeze(['closed','open','half-open']),timers:0,polling:false,retryLoop:false,gameplayAuthority:false});
})(typeof globalThis!=='undefined'?globalThis:window);
