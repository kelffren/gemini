/* KELO-INDEX
 * area: GUARDIAN
 * owner: KeloGuardian
 * keys: GUARDIAN DONATION IDLE IOS HOST HEARTBEAT CAPABILITY RELAY ASSET COMPUTE
 * purpose: posee la preferencia local de donar recursos y sincroniza disponibilidad/capacidades con KeloGuardianAuthority
 * online: el cliente anuncia disponibilidad; el coordinador server asigna roles/lease y conserva autoridad
 * do-not: NO prometer background continuo en iOS; NO calcular recompensas autoritativas; NO segundo loop
 */
(function(root){
'use strict';
if(root.KeloGuardian)return;
const VERSION='kelo-guardian-v1',PREF_KEY='kelo.guardian.preferences.v1',NODE_KEY='kelo.guardian.node.v1',HEARTBEAT_MS=8000;
const defaults=Object.freeze({enabled:false,idleDonation:true,wifiOnly:true,chargingOnly:false,allowAssets:true,allowRelay:true,allowCompute:false,maxUploadMbps:10,storageMb:512});
let prefs=loadPrefs(),serverState=null,lastError=null,lastHeartbeatAt=0,inFlight=false,wasOnline=false;
function uuid(){if(root.crypto&&typeof root.crypto.randomUUID==='function')return root.crypto.randomUUID();return'guardian-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,14);}
function resolveNodeId(){try{let id=localStorage.getItem(NODE_KEY);if(!id){id='g_'+uuid().replace(/[^A-Za-z0-9_-]/g,'').slice(0,80);localStorage.setItem(NODE_KEY,id);}return id;}catch(_){return'g_'+uuid().replace(/[^A-Za-z0-9_-]/g,'').slice(0,80);}}
const LOCAL_NODE_ID=resolveNodeId();
function nodeId(){return LOCAL_NODE_ID;}
function loadPrefs(){try{return Object.assign({},defaults,JSON.parse(localStorage.getItem(PREF_KEY)||'null')||{});}catch(_){return{...defaults};}}
function savePrefs(){try{localStorage.setItem(PREF_KEY,JSON.stringify(prefs));}catch(_){}}
function isIOS(){const ua=String(navigator.userAgent||'');return /iPad|iPhone|iPod/i.test(ua)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);}
function platform(){if(isIOS())return'ios';if(/Android/i.test(String(navigator.userAgent||'')))return'android';if(/Windows|Macintosh|Linux/i.test(String(navigator.userAgent||'')))return'desktop';return'web';}
function deviceClass(){const min=Math.min(screen.width||0,screen.height||0),touch=(navigator.maxTouchPoints||0)>0;if(touch&&min&&min<600)return'phone';if(touch&&min<1000)return'tablet';if(!touch)return'desktop';return'unknown';}
function screenClass(){const w=Math.round(innerWidth||screen.width||0),h=Math.round(innerHeight||screen.height||0);if(!w||!h)return'unknown';const m=Math.min(w,h);return m<600?'small':m<900?'medium':'large';}
function capabilitySnapshot(){const c=navigator.connection||navigator.mozConnection||navigator.webkitConnection||null;return{platform:platform(),deviceClass:deviceClass(),visibility:document.visibilityState||'unknown',online:navigator.onLine!==false,webrtc:typeof root.RTCPeerConnection==='function',serviceWorker:'serviceWorker'in navigator,saveData:!!c?.saveData,touch:(navigator.maxTouchPoints||0)>0,cores:Number(navigator.hardwareConcurrency)||1,memoryGb:Number(navigator.deviceMemory)||0,batteryLevel:null,charging:null,networkType:String(c?.type||'unknown'),effectiveType:String(c?.effectiveType||'unknown'),screenClass:screenClass()};}
async function enrichBattery(snapshot){try{if(typeof navigator.getBattery==='function'){const b=await navigator.getBattery();snapshot.batteryLevel=Number.isFinite(b.level)?b.level:null;snapshot.charging=!!b.charging;}}catch(_){}return snapshot;}
function emit(){const detail=state();try{root.dispatchEvent(new CustomEvent('kelo:guardian-state',{detail}));}catch(_){}return detail;}
function state(){const node=serverState?.node||null,network=serverState?.network||null;return Object.freeze({version:VERSION,nodeId:nodeId(),enabled:!!prefs.enabled,preferences:Object.freeze({...prefs}),platform:platform(),ios:isIOS(),connected:!!node,role:node?.role||'off',recommendedRoles:Object.freeze([...(node?.recommendedRoles||[])]),masterEligible:!!serverState?.masterEligible,masterActive:node?.role==='master-host',masterLeaseExpiresAt:node?.masterLeaseExpiresAt||null,network,lastError,backgroundContinuousGuaranteed:false});}
async function payload(){return{nodeId:nodeId(),capabilities:await enrichBattery(capabilitySnapshot()),preferences:{...prefs}};}
function apply(result){serverState=result||null;lastError=null;emit();return state();}
async function refresh(){if(!root.KeloGuardianAuthority)throw new Error('GUARDIAN_AUTHORITY_UNAVAILABLE');try{return apply(await root.KeloGuardianAuthority.status(nodeId()));}catch(error){lastError=String(error&&error.message||error);emit();throw error;}}
async function activate(){prefs.enabled=true;savePrefs();try{return apply(await root.KeloGuardianAuthority.enable(await payload()));}catch(error){lastError=String(error&&error.message||error);emit();throw error;}}
async function deactivate(){prefs.enabled=false;savePrefs();try{if(root.KeloGuardianAuthority)return apply(await root.KeloGuardianAuthority.disable({nodeId:nodeId()}));}catch(error){lastError=String(error&&error.message||error);}serverState=null;emit();return state();}
async function startMasterHost(){if(!prefs.enabled)await activate();try{return apply(await root.KeloGuardianAuthority.startMaster(await payload()));}catch(error){lastError=String(error&&error.message||error);emit();throw error;}}
async function stopMasterHost(){try{return apply(await root.KeloGuardianAuthority.stopMaster({nodeId:nodeId()}));}catch(error){lastError=String(error&&error.message||error);emit();throw error;}}
async function heartbeat(force){if(!prefs.enabled||inFlight||!root.KeloGuardianAuthority)return state();const now=Date.now();if(!force&&now-lastHeartbeatAt<HEARTBEAT_MS)return state();inFlight=true;try{const result=serverState?.node?await root.KeloGuardianAuthority.heartbeat(await payload()):await root.KeloGuardianAuthority.enable(await payload());lastHeartbeatAt=now;wasOnline=true;return apply(result);}catch(error){lastError=String(error&&error.message||error);wasOnline=false;emit();return state();}finally{inFlight=false;}}
function updatePreferences(next){prefs=Object.assign({},prefs,next||{});savePrefs();emit();if(prefs.enabled)heartbeat(true);return state();}
function tick(){if(!prefs.enabled)return;const online=navigator.onLine!==false;if(online&&!wasOnline){wasOnline=true;heartbeat(true);return;}if(!online){wasOnline=false;return;}heartbeat(false);}
function boot(){emit();if(root.KeloSimulation&&typeof root.KeloSimulation.after==='function')root.KeloSimulation.after('guardian:heartbeat',tick,360);if(prefs.enabled)setTimeout(()=>heartbeat(true),0);else setTimeout(()=>refresh().catch(()=>{}),0);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&prefs.enabled)heartbeat(true);else emit();},{passive:true});root.addEventListener('online',()=>heartbeat(true),{passive:true});root.addEventListener('offline',()=>{wasOnline=false;emit();},{passive:true});}
root.KeloGuardian=Object.freeze({version:VERSION,state,activate,deactivate,toggle:()=>prefs.enabled?deactivate():activate(),refresh,heartbeat:()=>heartbeat(true),startMasterHost,stopMasterHost,updatePreferences,capabilities:capabilitySnapshot});
root.KELO_GUARDIAN_AUDIT=Object.freeze({version:VERSION,owner:'KeloGuardian',authority:'KeloGuardianAuthority',secondLoop:false,simulationHook:true,iosBackgroundClaim:false,serverLease:true,clientRewardAuthority:false});
boot();
})(typeof globalThis!=='undefined'?globalThis:window);