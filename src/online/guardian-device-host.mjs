/* KELO-INDEX
 * area: ONLINE / GUARDIAN
 * owner: Kelo Guardian device host client
 * keys: DEVICE HOST DONOR IPHONE DESKTOP HEARTBEAT LEASE ADMIN SHA256 WEBRTC SETTINGS
 * purpose: convierte navegador iPhone/desktop en nodo Guardian opt-in, administra lease master admin y preferencias de donacion
 * authority: el server central conserva identidad/economia/PvP; este cliente nunca acuña KC ni acepta estado autoritativo desde peers
 * boot: lazy; solo se importa al abrir Ajustes para no tocar el arranque normal del juego
 */
import { createKeloSupabaseBrowserSession } from './kelo-supabase-browser-session.mjs';

const VERSION='guardian-device-host-v1.0.0';
const NODE_KEY='kelo.guardian.node-id.v1';
const PREF_KEY='kelo.guardian.preferences.v1';
const AUTO_KEY='kelo.guardian.auto-donor.v1';
const HEARTBEAT_MS=10000;
const REQUEST_TIMEOUT_MS=9000;
const ASSET_CACHE='kelo-guardian-verified-assets-v1';
const root=globalThis;
const session=createKeloSupabaseBrowserSession({root});
let timer=null,inflight=null,lastPayload=null,lastError=null,mounted=false,donorEnabled=false,masterRequested=false,battery=null,batteryCleanup=null;
const listeners=new Set();

const DEFAULT_PREFS=Object.freeze({idleDonation:true,wifiOnly:true,chargingOnly:false,allowAssets:true,allowRelay:true,allowCompute:false,maxUploadMbps:10,storageMb:512});
function clamp(v,min,max,fallback){v=Number(v);return Number.isFinite(v)?Math.max(min,Math.min(max,v)):fallback;}
function safeJson(raw,fallback){try{return JSON.parse(raw);}catch{return fallback;}}
function loadPrefs(){try{return Object.assign({},DEFAULT_PREFS,safeJson(localStorage.getItem(PREF_KEY),{}));}catch{return {...DEFAULT_PREFS};}}
let prefs=loadPrefs();
function savePrefs(){try{localStorage.setItem(PREF_KEY,JSON.stringify(prefs));}catch{} }
function autoDonor(){try{return localStorage.getItem(AUTO_KEY)==='1';}catch{return false;}}
function setAutoDonor(value){try{localStorage.setItem(AUTO_KEY,value?'1':'0');}catch{} }
function uuidPart(){try{return crypto.randomUUID().replace(/-/g,'').slice(0,18);}catch{return Math.random().toString(36).slice(2)+Date.now().toString(36);}}
function nodeId(){
  try{const old=localStorage.getItem(NODE_KEY);if(old&&/^[A-Za-z0-9:_-]{8,96}$/.test(old))return old;const id='guardian_'+uuidPart();localStorage.setItem(NODE_KEY,id);return id;}
  catch{return 'guardian_'+uuidPart();}
}
const NODE_ID=nodeId();

function asHttpBase(value){
  let s=String(value||'').trim();if(!s)return'';
  s=s.replace(/^wss:/i,'https:').replace(/^ws:/i,'http:').replace(/\/+$/,'');
  try{const u=new URL(s,location.href);return u.origin+(u.pathname==='/'?'':u.pathname.replace(/\/+$/,''));}catch{return'';}
}
function resolveApiBase(){
  const candidates=[root.KELO_GUARDIAN_API_BASE,root.KELO_SERVER_HTTP_URL,root.KELO_SERVER_URL,root.KeloNetConfig?.httpBase,root.KeloNetConfig?.serverUrl,root.keloNet?.httpBase,root.keloNet?.serverUrl,location.origin];
  for(const candidate of candidates){const base=asHttpBase(candidate);if(base)return base;}
  return location.origin;
}
function platformInfo(){
  const ua=navigator.userAgent||'',touch=(navigator.maxTouchPoints||0)>0;
  const ipad=/iPad/i.test(ua)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  const ios=/iPhone|iPod/i.test(ua)||ipad;
  const android=/Android/i.test(ua);
  const phone=ios&&!ipad||android&&/Mobile/i.test(ua);
  return{platform:ios?'ios':android?'android':touch?'web':'desktop',deviceClass:ipad?'tablet':phone?'phone':touch&&Math.min(screen.width,screen.height)<900?'tablet':'desktop',touch};
}
async function initBattery(){
  if(battery||typeof navigator.getBattery!=='function')return battery;
  try{
    battery=await navigator.getBattery();
    const fn=()=>{if(donorEnabled||lastPayload?.node)heartbeat().catch(()=>{});};
    battery.addEventListener?.('levelchange',fn);battery.addEventListener?.('chargingchange',fn);
    batteryCleanup=()=>{battery?.removeEventListener?.('levelchange',fn);battery?.removeEventListener?.('chargingchange',fn);};
  }catch{}
  return battery;
}
function capabilities(){
  const p=platformInfo(),conn=navigator.connection||navigator.mozConnection||navigator.webkitConnection||{};
  return{
    platform:p.platform,deviceClass:p.deviceClass,visibility:document.visibilityState||'unknown',effectiveType:conn.effectiveType||'unknown',online:navigator.onLine!==false,
    webrtc:typeof RTCPeerConnection==='function',serviceWorker:'serviceWorker'in navigator,saveData:!!conn.saveData,touch:p.touch,
    cores:clamp(navigator.hardwareConcurrency,1,64,1),memoryGb:clamp(navigator.deviceMemory,0,128,0),
    batteryLevel:battery?clamp(battery.level,0,1,null):null,charging:battery?!!battery.charging:null,
    networkType:conn.type||'unknown',screenClass:Math.min(screen.width||0,screen.height||0)<600?'compact':Math.min(screen.width||0,screen.height||0)<1000?'medium':'large'
  };
}
function normalizedPrefs(){return{idleDonation:prefs.idleDonation!==false,wifiOnly:prefs.wifiOnly!==false,chargingOnly:prefs.chargingOnly===true,allowAssets:prefs.allowAssets!==false,allowRelay:prefs.allowRelay!==false,allowCompute:prefs.allowCompute===true,maxUploadMbps:clamp(prefs.maxUploadMbps,1,200,10),storageMb:Math.round(clamp(prefs.storageMb,64,102400,512))};}
async function token(){const fresh=await session.ensureFresh();return fresh?.access_token||session.accessToken||null;}
async function request(path,{method='GET',body=null,keepalive=false}={}){
  const accessToken=await token();if(!accessToken)throw new Error('GUARDIAN_LOGIN_REQUIRED');
  const controller=keepalive?null:new AbortController();let timeout=null;
  if(controller)timeout=setTimeout(()=>controller.abort(),REQUEST_TIMEOUT_MS);
  try{
    const response=await fetch(resolveApiBase()+path,{method,headers:{'Authorization':'Bearer '+accessToken,'Content-Type':'application/json'},body:body==null?undefined:JSON.stringify(body),signal:controller?.signal,keepalive,cache:'no-store'});
    const text=await response.text();let data={};try{data=text?JSON.parse(text):{};}catch{data={ok:false,error:'GUARDIAN_BAD_RESPONSE'};}
    if(!response.ok||data?.ok===false)throw Object.assign(new Error(String(data?.error||'GUARDIAN_HTTP_'+response.status)),{status:response.status,data});
    lastPayload=data;lastError=null;emit();return data;
  }finally{if(timeout)clearTimeout(timeout);}
}
function emit(){listeners.forEach(fn=>{try{fn(getState());}catch{}});render();}
function recordError(error){lastError=String(error?.message||error||'GUARDIAN_ERROR');emit();return error;}
function payload(){return{nodeId:NODE_ID,capabilities:capabilities(),preferences:normalizedPrefs()};}
async function status(){try{return await request('/api/guardian/status?nodeId='+encodeURIComponent(NODE_ID));}catch(e){recordError(e);throw e;}}
async function enableDonor({remember=true}={}){
  await initBattery();
  try{const data=await request('/api/guardian/enable',{method:'POST',body:payload()});donorEnabled=true;if(remember){setAutoDonor(true);}startHeartbeat();emit();return data;}
  catch(e){recordError(e);throw e;}
}
async function disableDonor({remember=true}={}){
  try{if(lastPayload?.node?.role==='master-host')await stopMaster();}catch{}
  try{const data=await request('/api/guardian/disable',{method:'POST',body:{nodeId:NODE_ID}});donorEnabled=false;masterRequested=false;if(remember)setAutoDonor(false);stopHeartbeat();emit();return data;}
  catch(e){recordError(e);throw e;}
}
async function startMaster(){
  await initBattery();
  try{
    if(document.visibilityState!=='visible')throw new Error('GUARDIAN_FOREGROUND_REQUIRED');
    const data=await request('/api/guardian/master/start',{method:'POST',body:payload()});
    donorEnabled=true;masterRequested=true;startHeartbeat();emit();return data;
  }catch(e){recordError(e);throw e;}
}
async function stopMaster(){
  try{const data=await request('/api/guardian/master/stop',{method:'POST',body:{nodeId:NODE_ID}});masterRequested=false;emit();return data;}
  catch(e){recordError(e);throw e;}
}
async function heartbeat(){
  if(inflight)return inflight;
  if(!donorEnabled&&!lastPayload?.node)return null;
  inflight=(async()=>{
    try{
      const data=await request('/api/guardian/heartbeat',{method:'POST',body:payload()});
      donorEnabled=!!data?.node;
      if(data?.node?.role!=='master-host')masterRequested=false;
      return data;
    }catch(e){recordError(e);if(String(e?.message)==='GUARDIAN_NODE_NOT_ENABLED'){donorEnabled=false;masterRequested=false;stopHeartbeat();}throw e;}
    finally{inflight=null;}
  })();
  return inflight;
}
function startHeartbeat(){if(timer)return;timer=setInterval(()=>{heartbeat().catch(()=>{});},HEARTBEAT_MS);}
function stopHeartbeat(){if(timer){clearInterval(timer);timer=null;}}
function updatePreferences(next={}){prefs=Object.assign({},prefs,next);savePrefs();if(donorEnabled)heartbeat().catch(()=>{});emit();return normalizedPrefs();}

async function sha256Hex(value){const bytes=value instanceof ArrayBuffer?value:ArrayBuffer.isView(value)?value.buffer.slice(value.byteOffset,value.byteOffset+value.byteLength):new TextEncoder().encode(String(value));const digest=await crypto.subtle.digest('SHA-256',bytes);return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');}
async function verifySha256(value,expected){const actual=await sha256Hex(value);return{ok:actual===String(expected||'').toLowerCase(),actual,expected:String(expected||'').toLowerCase()};}
async function cacheVerifiedAsset(url,expectedSha256){
  const response=await fetch(url,{cache:'no-store'});if(!response.ok)throw new Error('GUARDIAN_ASSET_HTTP_'+response.status);const bytes=await response.clone().arrayBuffer();const verified=await verifySha256(bytes,expectedSha256);if(!verified.ok)throw Object.assign(new Error('GUARDIAN_ASSET_HASH_MISMATCH'),verified);
  if(!('caches'in root))return{ok:true,verified,cached:false};const cache=await caches.open(ASSET_CACHE);await cache.put(url,response);return{ok:true,verified,cached:true,bytes:bytes.byteLength};
}
function createPeerConnection({iceServers=[{urls:'stun:stun.l.google.com:19302'}],onDataChannel,onIceCandidate}={}){
  if(typeof RTCPeerConnection!=='function')throw new Error('GUARDIAN_WEBRTC_UNAVAILABLE');
  const pc=new RTCPeerConnection({iceServers});
  pc.ondatachannel=e=>{const channel=e.channel;channel.binaryType='arraybuffer';if(typeof onDataChannel==='function')onDataChannel(channel,pc);};
  pc.onicecandidate=e=>{if(e.candidate&&typeof onIceCandidate==='function')onIceCandidate(e.candidate.toJSON?.()||e.candidate,pc);};
  return pc;
}
function getState(){return Object.freeze({version:VERSION,nodeId:NODE_ID,apiBase:resolveApiBase(),authenticated:!!session.accessToken,donorEnabled,masterRequested,masterEligible:!!lastPayload?.masterEligible,node:lastPayload?.node||null,network:lastPayload?.network||null,rewardPolicy:lastPayload?.rewardPolicy||null,preferences:normalizedPrefs(),capabilities:capabilities(),lastError,heartbeatActive:!!timer});}

function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function ensureStyle(){if(document.getElementById('kelo-guardian-panel-style'))return;const s=document.createElement('style');s.id='kelo-guardian-panel-style';s.textContent='.kgd{margin:12px 0;padding:12px;border-radius:16px;background:#0d1d20;border:1px solid rgba(102,208,183,.25);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#eaf7f2}.kgd-head{display:flex;gap:8px;align-items:center}.kgd-head b{flex:1;color:#8fe0c9}.kgd-dot{width:9px;height:9px;border-radius:50%;background:#53645f}.kgd-dot.on{background:#75e3a6;box-shadow:0 0 12px rgba(117,227,166,.45)}.kgd-meta{font-size:10px;color:#8fa9a1;line-height:1.45;margin:6px 0 10px}.kgd-actions{display:grid;gap:7px}.kgd button{min-height:43px;border-radius:12px;border:1px solid rgba(143,224,201,.28);background:#132b2d;color:#c9fff0;font-weight:800;padding:0 10px}.kgd button.primary{background:#0e4f43;border-color:#50c5a7}.kgd button.stop{color:#ffbbb2;border-color:rgba(255,120,110,.3)}.kgd-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:9px}.kgd label{font-size:10px;color:#9ab1aa;display:flex;align-items:center;gap:6px}.kgd input[type=number]{width:70px;min-height:34px;border-radius:9px;border:1px solid rgba(255,255,255,.13);background:#081416;color:#fff;padding:0 7px}.kgd-note{font-size:9px;line-height:1.4;color:#778f88;margin-top:9px}.kgd-error{font-size:10px;color:#ffaaa0;margin-top:7px}.kgd-admin{margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,.08)}';document.head.appendChild(s);}
function mount(container){
  if(!container)return false;ensureStyle();let panel=document.getElementById('kelo-guardian-device-panel');
  if(!panel){panel=document.createElement('section');panel.id='kelo-guardian-device-panel';panel.className='kgd';container.appendChild(panel);panel.addEventListener('click',async e=>{const a=e.target?.dataset?.guardian;if(!a)return;e.target.disabled=true;try{if(a==='donor-on')await enableDonor();else if(a==='donor-off')await disableDonor();else if(a==='master-on')await startMaster();else if(a==='master-off')await stopMaster();else if(a==='refresh')await status();}catch(error){root.showToast?.(String(error?.message||error));}finally{e.target.disabled=false;render();}});panel.addEventListener('change',e=>{const k=e.target?.dataset?.guardianPref;if(!k)return;const value=e.target.type==='checkbox'?e.target.checked:Number(e.target.value);updatePreferences({[k]:value});});}
  mounted=true;render();status().then(data=>{donorEnabled=!!data?.node;if(donorEnabled)startHeartbeat();}).catch(()=>{});if(autoDonor())enableDonor({remember:false}).catch(()=>{});return true;
}
function mountInSettings(){const sheet=document.querySelector('#kelo-download-center .kdc-sheet');return mount(sheet);}
function render(){
  if(!mounted)return;const el=document.getElementById('kelo-guardian-device-panel');if(!el)return;const s=getState(),node=s.node,master=node?.role==='master-host',online=!!node;
  const roles=(node?.recommendedRoles||[]).join(', ')||'sin asignar';const network=s.network;const device=s.capabilities.deviceClass==='desktop'?'PC / desktop':s.capabilities.platform==='ios'?'iPhone / iOS':s.capabilities.deviceClass;
  el.innerHTML='<div class="kgd-head"><span class="kgd-dot '+(online?'on':'')+'"></span><b>Guardian Community Network</b><button type="button" data-guardian="refresh">↻</button></div><div class="kgd-meta">'+esc(device)+' · '+esc(NODE_ID)+'<br>'+(online?'Nodo activo · '+esc(node.role)+' · '+esc(roles):'Nodo apagado')+(network?' · Red '+Number(network.activeNodes||0)+' nodos':'')+'</div><div class="kgd-actions">'+(online?'<button type="button" class="stop" data-guardian="donor-off">Dejar de donar recursos</button>':'<button type="button" class="primary" data-guardian="donor-on">Donar recursos con este dispositivo</button>')+'</div><div class="kgd-grid"><label><input type="checkbox" data-guardian-pref="allowAssets" '+(s.preferences.allowAssets?'checked':'')+'> Assets</label><label><input type="checkbox" data-guardian-pref="allowRelay" '+(s.preferences.allowRelay?'checked':'')+'> Relay</label><label><input type="checkbox" data-guardian-pref="allowCompute" '+(s.preferences.allowCompute?'checked':'')+'> Compute</label><label><input type="checkbox" data-guardian-pref="wifiOnly" '+(s.preferences.wifiOnly?'checked':'')+'> Solo Wi‑Fi</label><label><input type="checkbox" data-guardian-pref="chargingOnly" '+(s.preferences.chargingOnly?'checked':'')+'> Solo cargando</label><label>Mbps <input type="number" min="1" max="200" value="'+s.preferences.maxUploadMbps+'" data-guardian-pref="maxUploadMbps"></label><label>Cache MB <input type="number" min="64" max="102400" value="'+s.preferences.storageMb+'" data-guardian-pref="storageMb"></label></div>'+(s.masterEligible?'<div class="kgd-admin"><div class="kgd-meta">CONTROL ADMIN · El servidor verifica este permiso; ocultar el botón no es la seguridad.</div>'+(master?'<button type="button" class="stop" data-guardian="master-off">Dejar de usar este dispositivo como servidor</button>':'<button type="button" class="primary" data-guardian="master-on">Usar este dispositivo como servidor</button>')+'</div>':'')+(s.capabilities.platform==='ios'?'<div class="kgd-note">iOS puede suspender Safari/app al bloquear pantalla. Guardian deja expirar el lease automáticamente; no queda un host fantasma.</div>':'<div class="kgd-note">Mantén Kelo World abierto para conservar heartbeat/lease. Economía, identidad y PvP siguen bajo autoridad central.</div>')+(s.lastError?'<div class="kgd-error">'+esc(s.lastError)+'</div>':'');
}

function visibilityChanged(){if(donorEnabled||lastPayload?.node)heartbeat().catch(()=>{});}
function onlineChanged(){if(navigator.onLine&&autoDonor()&&!donorEnabled)enableDonor({remember:false}).catch(()=>{});else if(donorEnabled)heartbeat().catch(()=>{});}
document.addEventListener('visibilitychange',visibilityChanged,{passive:true});root.addEventListener('online',onlineChanged,{passive:true});root.addEventListener('offline',onlineChanged,{passive:true});
root.addEventListener('pagehide',()=>{stopHeartbeat();batteryCleanup?.();if(lastPayload?.node){request('/api/guardian/heartbeat',{method:'POST',body:payload(),keepalive:true}).catch(()=>{});}},{passive:true});

export const GuardianDeviceHost=Object.freeze({version:VERSION,mount,mountInSettings,status,enableDonor,disableDonor,startMaster,stopMaster,heartbeat,updatePreferences,getState,sha256Hex,verifySha256,cacheVerifiedAsset,createPeerConnection,onChange(fn){if(typeof fn==='function')listeners.add(fn);return()=>listeners.delete(fn);}});
root.KeloGuardianDeviceHost=GuardianDeviceHost;
