/* KELO-INDEX
 * area: NET / GUARDIAN
 * owner: KeloGuardianAuthority
 * keys: GUARDIAN DONATION HOST HTTP AUTH SUPABASE
 * purpose: frontera cliente para registrar/latir/desactivar un nodo Guardian usando el mismo servidor HTTP del runtime online
 * online: usa bearer Supabase y no crea un segundo WebSocket; el coordinador server decide permisos y leases
 * do-not: NO secretos backend; NO autoridad gameplay; NO métricas de recompensa declaradas como verdad
 */
(function(root){
'use strict';
if(root.KeloGuardianAuthority)return;
const VERSION='kelo-guardian-authority-v1',SESSION_KEY='kelo.supabase.session.v1';
let lastError=null,lastSource=null;
function endpointBase(){const ws=root.KELO_ONLINE_RUNTIME_CONFIG?.effectiveNet||root.keloNet?.url||root.KELO_ONLINE_RUNTIME_CONFIG?.defaultWsUrl||'';if(!ws)throw new Error('GUARDIAN_SERVER_UNAVAILABLE');const url=new URL(ws,location.href);url.protocol=url.protocol==='wss:'?'https:':url.protocol==='ws:'?'http:':url.protocol;url.pathname='/';url.search='';url.hash='';return url;}
async function accessToken(){try{if(root.KeloOnlineAuth&&typeof root.KeloOnlineAuth.credentials==='function'){const c=await root.KeloOnlineAuth.credentials();if(c?.accessToken)return String(c.accessToken);}}catch(_){}try{const raw=localStorage.getItem(SESSION_KEY),session=raw?JSON.parse(raw):null;return String(session?.access_token||'');}catch(_){return '';}}
async function request(path,options={}){const base=endpointBase(),url=new URL(path,base),token=await accessToken();if(!token)throw new Error('AUTH_TOKEN_REQUIRED');const headers={Accept:'application/json',Authorization:'Bearer '+token};if(options.body)headers['Content-Type']='application/json';const response=await fetch(url.href,{method:options.method||'GET',headers,body:options.body?JSON.stringify(options.body):undefined,cache:'no-store',credentials:'omit'});let payload=null;try{payload=await response.json();}catch(_){payload=null;}if(!response.ok||!payload?.ok){const error=new Error(String(payload?.error||('GUARDIAN_HTTP_'+response.status)));error.status=response.status;throw error;}lastError=null;lastSource=payload.source||'guardian-coordinator';return payload;}
async function guarded(fn){try{return await fn();}catch(error){lastError=String(error&&error.message||error);throw error;}}
function withNode(path,nodeId){const base=endpointBase(),url=new URL(path,base);url.searchParams.set('nodeId',String(nodeId||''));return url.pathname+url.search;}
function status(){let endpoint=null;try{endpoint=endpointBase().href;}catch(_){}return Object.freeze({version:VERSION,endpoint,lastError,lastSource,authenticated:!!root.KeloOnlineAuth?.state?.().authenticated});}
root.KeloGuardianAuthority=Object.freeze({version:VERSION,status:nodeId=>guarded(()=>request(withNode('/api/guardian/status',nodeId))),enable:payload=>guarded(()=>request('/api/guardian/enable',{method:'POST',body:payload})),heartbeat:payload=>guarded(()=>request('/api/guardian/heartbeat',{method:'POST',body:payload})),disable:payload=>guarded(()=>request('/api/guardian/disable',{method:'POST',body:payload})),startMaster:payload=>guarded(()=>request('/api/guardian/master/start',{method:'POST',body:payload})),stopMaster:payload=>guarded(()=>request('/api/guardian/master/stop',{method:'POST',body:payload})),diagnostics:status});
root.KELO_GUARDIAN_AUTHORITY_AUDIT=Object.freeze({version:VERSION,sameServerHttp:true,secondWebSocket:false,supabaseBearer:true,gameplayAuthority:false});
})(typeof globalThis!=='undefined'?globalThis:window);