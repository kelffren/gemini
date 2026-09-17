/* KELO-INDEX
 * area: PVP / PERFORMANCE
 * owner: KeloPvPAutoReducer (orquestador); calidad -> KELO_PERF, simulacion -> KeloSimulation, red -> KeloNetAuthority
 * keys: PVP PING RTT LATENCY JITTER QUALITY HOT REDUCE COUNTDOWN HYSTERESIS COOLDOWN NOTICE MOBILE
 * purpose: protege la fluidez del PvP detectando degradacion sostenida de la ruta input->ack y solicita calidad temporal sin reload ni pausa
 * public-api: KeloPvPAutoReducer.snapshot/acknowledge/setEnabled
 * consumes: KeloPvPWorld, KeloNetAuthority.getPvpPendingCount/getLastPvpAck, KELO_PERF.setManualQuality/getSnapshot, KeloSimulation
 * state-owned: baseline/EMA de latencia estimada, warning/cooldown y restauracion de calidad; no posee gameplay ni red
 * extension-points: sustituir estimator por RTT server-native manteniendo sample contract; quality aplica solo por API de KELO_PERF
 * online: diagnostico/presentacion client-only; nunca decide daño, posicion, cooldown, HP ni resultado competitivo
 * do-not: NO reload, NO segundo loop, NO modal, NO bloquear input, NO cambiar verdad server
 */
(function(root){
'use strict';
if(root.KeloPvPAutoReducer)return;

const VERSION='pvp-auto-reducer-v1.0.0';
const CONFIG=Object.freeze({
  inputHz:30,
  sampleEveryMs:250,
  badHoldMs:2500,
  graceMs:10000,
  recoverHoldMs:12000,
  warningCooldownMs:90000,
  baselineWindow:40,
  minBadMs:180,
  baselineMultiplier:1.75,
  criticalMs:340,
  emergencyHoldMs:3500,
  ackStallMs:850
});
const state={
  enabled:true,phase:'idle',lastSampleAt:0,lastAck:null,lastAckChangedAt:0,
  baselineSamples:[],baselineMs:0,emaMs:0,jitterMs:0,lastLatencyMs:0,
  badSince:0,warningStartedAt:0,recoverSince:0,lastWarningAt:-Infinity,
  reduced:false,emergency:false,savedManualQuality:null,notice:null,acknowledged:false,
  reductions:0,restores:0,warnings:0,lastReason:null
};

function now(){return root.performance&&typeof root.performance.now==='function'?root.performance.now():Date.now();}
function pvpCombatActive(){try{return !!(root.KeloPvPWorld&&root.KeloPvPWorld.state&&root.KeloPvPWorld.state.combatEnabled);}catch(_){return false;}}
function online(){try{return !!(root.KeloNetAuthority&&root.KeloNetAuthority.isOnline&&root.KeloNetAuthority.isOnline());}catch(_){return false;}}
function pending(){try{return Math.max(0,Number(root.KeloNetAuthority&&root.KeloNetAuthority.getPvpPendingCount&&root.KeloNetAuthority.getPvpPendingCount())||0);}catch(_){return 0;}}
function ack(){try{return Number(root.KeloNetAuthority&&root.KeloNetAuthority.getLastPvpAck&&root.KeloNetAuthority.getLastPvpAck())||0;}catch(_){return 0;}}
function perf(){return root.KELO_PERF||root.KELO_PERFORMANCE_GOVERNOR||null;}
function latencyEstimateMs(){return pending()*(1000/CONFIG.inputHz);}
function median(values){if(!values.length)return 0;const a=values.slice().sort((x,y)=>x-y),i=Math.floor(a.length/2);return a.length%2?a[i]:(a[i-1]+a[i])/2;}
function baselineLimit(){return Math.max(CONFIG.minBadMs,(state.baselineMs||CONFIG.minBadMs)*CONFIG.baselineMultiplier);}
function networkBad(t){const stall=state.lastAckChangedAt&&t-state.lastAckChangedAt>=CONFIG.ackStallMs;return state.emaMs>=baselineLimit()||state.jitterMs>=85||stall;}
function networkCritical(t){const stall=state.lastAckChangedAt&&t-state.lastAckChangedAt>=CONFIG.ackStallMs*1.8;return state.emaMs>=CONFIG.criticalMs||state.jitterMs>=130||stall;}

function ensureNotice(){
  if(state.notice&&state.notice.isConnected)return state.notice;
  const host=document.createElement('div');host.id='kelo-pvp-network-warning';host.setAttribute('role','status');host.setAttribute('aria-live','polite');
  host.style.cssText='position:fixed;left:50%;top:max(76px,calc(env(safe-area-inset-top) + 62px));transform:translateX(-50%);z-index:2147483000;width:min(360px,calc(100vw - 28px));pointer-events:none;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif';
  host.innerHTML='<div data-card style="pointer-events:none;background:rgba(7,10,14,.94);border:1px solid rgba(231,197,106,.42);box-shadow:0 10px 34px rgba(0,0,0,.38);border-radius:16px;padding:11px 12px;color:#f1f4f2;display:flex;align-items:center;gap:10px"><div style="flex:1;min-width:0"><div data-title style="font-size:12px;font-weight:850;color:#f0d48a">Conexión inestable</div><div data-copy style="font-size:11px;line-height:1.35;color:#cbd3cf;margin-top:2px"></div></div><button data-ack type="button" style="pointer-events:auto;flex:0 0 auto;border:1px solid rgba(231,197,106,.48);background:rgba(231,197,106,.12);color:#f0d48a;border-radius:10px;min-height:34px;padding:0 10px;font:800 11px -apple-system,sans-serif">Aceptar</button></div>';
  host.querySelector('[data-ack]').addEventListener('pointerdown',function(ev){ev.stopPropagation();});
  host.querySelector('[data-ack]').addEventListener('click',function(ev){ev.stopPropagation();acknowledge();});
  document.body.appendChild(host);state.notice=host;return host;
}
function hideNotice(){if(state.notice&&state.notice.isConnected)state.notice.remove();state.notice=null;}
function paintWarning(t){
  if(state.acknowledged){hideNotice();return;}
  const host=ensureNotice(),left=Math.max(0,Math.ceil((CONFIG.graceMs-(t-state.warningStartedAt))/1000));
  const copy=host.querySelector('[data-copy]');if(copy)copy.textContent='Tu ping está muy alto. Si no se normaliza en '+left+' s, bajaremos temporalmente la calidad para proteger el combate.';
}
function flash(message){
  if(typeof root.showToast==='function'){root.showToast(message);return;}
  try{root.dispatchEvent(new CustomEvent('kelo:pvp-network-notice',{detail:{message}}));}catch(_){}
}
function acknowledge(){state.acknowledged=true;hideNotice();return true;}

function applyQuality(id,reason){
  const owner=perf();if(!owner||typeof owner.setManualQuality!=='function')return false;
  if(!state.reduced){const snap=typeof owner.getSnapshot==='function'?owner.getSnapshot():null;state.savedManualQuality=snap&&snap.manualQuality!=null?snap.manualQuality:null;}
  owner.setManualQuality(id);state.reduced=true;state.emergency=id==='performance';state.lastReason=reason||'network';
  document.documentElement.dataset.keloPvpNetworkQuality=id;
  try{root.dispatchEvent(new CustomEvent('kelo:pvp-network-quality',{detail:{quality:id,reason:state.lastReason,hot:true}}));}catch(_){}
  return true;
}
function restoreQuality(){
  if(!state.reduced)return false;const owner=perf();
  if(owner&&typeof owner.setManualQuality==='function')owner.setManualQuality(state.savedManualQuality||'auto');
  state.reduced=false;state.emergency=false;state.savedManualQuality=null;state.restores+=1;state.lastReason='recovered';delete document.documentElement.dataset.keloPvpNetworkQuality;
  try{root.dispatchEvent(new CustomEvent('kelo:pvp-network-quality',{detail:{quality:'restored',reason:'recovered',hot:true}}));}catch(_){}
  flash('Conexión estabilizada · calidad restaurada');return true;
}
function beginWarning(t){
  state.phase='warning';state.warningStartedAt=t;state.lastWarningAt=t;state.acknowledged=false;state.warnings+=1;paintWarning(t);
}
function cancelWarning(){state.phase='monitoring';state.warningStartedAt=0;state.badSince=0;state.acknowledged=false;hideNotice();}
function degrade(reason){
  hideNotice();state.phase='reduced';state.acknowledged=false;state.recoverSince=0;
  if(applyQuality('medium',reason)){state.reductions+=1;flash('Modo PvP estable activado · calidad ajustada sin salir del combate');}
}
function clearEpisode(){hideNotice();state.phase='idle';state.badSince=0;state.warningStartedAt=0;state.recoverSince=0;state.acknowledged=false;state.baselineSamples.length=0;state.baselineMs=0;state.emaMs=0;state.jitterMs=0;state.lastLatencyMs=0;state.lastAck=null;state.lastAckChangedAt=0;}

function sample(t){
  const currentAck=ack();if(state.lastAck===null||currentAck!==state.lastAck){state.lastAck=currentAck;state.lastAckChangedAt=t;}
  const latency=latencyEstimateMs(),previous=state.emaMs||latency;state.lastLatencyMs=latency;state.emaMs=state.emaMs?state.emaMs*.78+latency*.22:latency;state.jitterMs=state.jitterMs*.75+Math.abs(latency-previous)*.25;
  if(!networkBad(t)&&latency>0&&state.baselineSamples.length<CONFIG.baselineWindow){state.baselineSamples.push(latency);state.baselineMs=median(state.baselineSamples);}
}
function tick(context){
  const t=now();if(!state.enabled){if(state.reduced)restoreQuality();clearEpisode();return;}
  if(!pvpCombatActive()||!online()){if(state.reduced)restoreQuality();clearEpisode();return;}
  if(state.phase==='idle')state.phase='monitoring';
  if(t-state.lastSampleAt>=CONFIG.sampleEveryMs){state.lastSampleAt=t;sample(t);}
  const bad=networkBad(t),critical=networkCritical(t);
  if(state.phase==='monitoring'){
    if(bad){if(!state.badSince)state.badSince=t;if(t-state.badSince>=CONFIG.badHoldMs&&t-state.lastWarningAt>=CONFIG.warningCooldownMs)beginWarning(t);}else state.badSince=0;
  }else if(state.phase==='warning'){
    if(!bad){cancelWarning();return;}paintWarning(t);
    if(t-state.warningStartedAt>=CONFIG.graceMs)degrade('sustained-high-latency');
  }else if(state.phase==='reduced'){
    if(critical){if(!state.badSince)state.badSince=t;if(!state.emergency&&t-state.badSince>=CONFIG.emergencyHoldMs){applyQuality('performance','critical-latency');flash('Conexión crítica · prioridad máxima a la fluidez PvP');}}else state.badSince=0;
    if(!bad){if(!state.recoverSince)state.recoverSince=t;if(t-state.recoverSince>=CONFIG.recoverHoldMs){restoreQuality();state.phase='monitoring';state.badSince=0;state.recoverSince=0;}}else state.recoverSince=0;
  }
}
function snapshot(){return Object.freeze({version:VERSION,enabled:state.enabled,phase:state.phase,combatActive:pvpCombatActive(),online:online(),latencyMs:Math.round(state.emaMs),jitterMs:Math.round(state.jitterMs),baselineMs:Math.round(state.baselineMs),badThresholdMs:Math.round(baselineLimit()),reduced:state.reduced,emergency:state.emergency,warnings:state.warnings,reductions:state.reductions,restores:state.restores,lastReason:state.lastReason,warningCooldownMs:CONFIG.warningCooldownMs,graceMs:CONFIG.graceMs,recoverHoldMs:CONFIG.recoverHoldMs});}
function setEnabled(value){state.enabled=value!==false;if(!state.enabled){if(state.reduced)restoreQuality();clearEpisode();}return state.enabled;}

if(!root.KeloSimulation||typeof root.KeloSimulation.after!=='function'){console.error('[Kelo PvP AutoReducer] KeloSimulation unavailable');return;}
root.KeloSimulation.after('pvp-auto-reducer:network-quality',tick,360);
root.KeloPvPAutoReducer=Object.freeze({version:VERSION,snapshot,acknowledge,setEnabled});
root.KELO_PVP_AUTO_REDUCER_AUDIT=Object.freeze({version:VERSION,installed:true,hot:true,reload:false,modal:false,inputBlocking:false,usesExistingSimulation:true,usesExistingQualityOwner:true,networkEstimator:'pvp-pending-input-ack-depth',graceMs:CONFIG.graceMs,warningCooldownMs:CONFIG.warningCooldownMs,recoverHoldMs:CONFIG.recoverHoldMs});
})(typeof globalThis!=='undefined'?globalThis:window);
