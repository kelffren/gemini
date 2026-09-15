/* KELO-INDEX
 * area: ONLINE / GUARDIAN WORKLOAD RUNTIME
 * owner: Kelo Guardian device workload runtime
 * keys: WORKLOAD ACK RESULT ABANDON FAILOVER ASSET SHA256 WITNESS NO EVAL NO POLLING
 * purpose: ejecuta workloads Guardian deterministas usando el heartbeat existente; no crea segundo loop
 * authority: resultados de cliente son no confiables hasta verificacion server-side; nunca modifica economia/PvP/KC
 * do-not: NO eval/new Function, NO codigo remoto, NO timer de polling, NO asset fuera de /assets/
 */
import { createKeloSupabaseBrowserSession } from './kelo-supabase-browser-session.mjs';

const VERSION='guardian-workload-runtime-v1.0.0';
const root=globalThis;
const session=createKeloSupabaseBrowserSession({root});
const running=new Map();
let detach=null,lastError=null,completedLocal=0,abandonedLocal=0;
const listeners=new Set();

function emit(){const s=getState();listeners.forEach(fn=>{try{fn(s);}catch{}});}
function asHttpBase(value){let s=String(value||'').trim();if(!s)return'';s=s.replace(/^wss:/i,'https:').replace(/^ws:/i,'http:').replace(/\/+$/,'');try{const u=new URL(s,location.href);return u.origin+(u.pathname==='/'?'':u.pathname.replace(/\/+$/,''));}catch{return'';}}
function resolveApiBase(host){const state=host?.getState?.()||{};const candidates=[state.apiBase,root.KELO_GUARDIAN_API_BASE,root.KELO_SERVER_HTTP_URL,root.KELO_SERVER_URL,location.origin];for(const c of candidates){const b=asHttpBase(c);if(b)return b;}return location.origin;}
async function token(){const fresh=await session.ensureFresh();return fresh?.access_token||session.accessToken||null;}
async function post(host,path,body){const accessToken=await token();if(!accessToken)throw new Error('GUARDIAN_LOGIN_REQUIRED');const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),9000);try{const r=await fetch(resolveApiBase(host)+path,{method:'POST',headers:{Authorization:'Bearer '+accessToken,'Content-Type':'application/json'},body:JSON.stringify(body||{}),signal:controller.signal,cache:'no-store'});const text=await r.text();let data={};try{data=text?JSON.parse(text):{};}catch{data={ok:false,error:'GUARDIAN_BAD_RESPONSE'};}if(!r.ok||data?.ok===false)throw new Error(String(data?.error||'GUARDIAN_HTTP_'+r.status));return data;}finally{clearTimeout(timeout);}}
function safeReason(error){return String(error?.message||error||'workload-failed').replace(/[^A-Za-z0-9._:-]/g,'').slice(0,64)||'workload-failed';}
function schedule(fn){if(root.scheduler?.postTask)return root.scheduler.postTask(fn,{priority:'background'});return new Promise(resolve=>setTimeout(resolve,0)).then(fn);}
async function sha256Hex(value){const bytes=value instanceof ArrayBuffer?value:new TextEncoder().encode(String(value));const digest=await crypto.subtle.digest('SHA-256',bytes);return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');}
function assertAssetTask(task){const path=String(task?.path||'');const sha=String(task?.sha256||'').toLowerCase();if(!/^\/assets\/[A-Za-z0-9_./-]{1,480}$/.test(path)||path.includes('..')||!/^[a-f0-9]{64}$/.test(sha))throw new Error('GUARDIAN_ASSET_TASK_INVALID');return{path,sha};}
async function execute(host,assignment){
  const task=assignment?.task||{},started=performance.now();
  if(task.kind==='witness'){
    const digest=await sha256Hex(String(task.nonce||'')+':'+assignment.id+':'+assignment.epoch);
    return{status:'completed',digest,bytes:0,durationMs:Math.round(performance.now()-started),detail:'witness'};
  }
  if(task.kind==='asset-cache'){
    const {path,sha}=assertAssetTask(task),url=new URL(path,location.origin);
    if(url.origin!==location.origin)throw new Error('GUARDIAN_ASSET_ORIGIN_DENIED');
    const result=await host.cacheVerifiedAsset(url.href,sha);
    return{status:'completed',digest:result?.verified?.actual||sha,bytes:Number(result?.bytes||0),durationMs:Math.round(performance.now()-started),detail:result?.cached?'asset-cached':'asset-verified'};
  }
  if(task.kind==='sha256'){
    if(host.getState?.().preferences?.allowCompute!==true)throw new Error('GUARDIAN_COMPUTE_NOT_ALLOWED');
    const digest=await sha256Hex(String(task.text||'').slice(0,8192));
    return{status:'completed',digest,bytes:new TextEncoder().encode(String(task.text||'').slice(0,8192)).byteLength,durationMs:Math.round(performance.now()-started),detail:'sha256'};
  }
  throw new Error('GUARDIAN_WORKLOAD_UNSUPPORTED');
}
async function abandon(host,assignment,error){try{await post(host,'/api/guardian/workload/abandon',{nodeId:host.getState().nodeId,workloadId:assignment.id,reason:safeReason(error)});}finally{abandonedLocal++;}}
async function runOne(host,assignment){
  if(!assignment?.id||running.has(assignment.id)||assignment.state==='reported')return;
  const job=schedule(async()=>{
    try{
      await post(host,'/api/guardian/workload/ack',{nodeId:host.getState().nodeId,workloadId:assignment.id});
      const result=await execute(host,assignment);
      await post(host,'/api/guardian/workload/result',{nodeId:host.getState().nodeId,workloadId:assignment.id,result});
      completedLocal++;lastError=null;
    }catch(error){lastError=String(error?.message||error);try{await abandon(host,assignment,error);}catch(abandonError){lastError=String(abandonError?.message||abandonError);}}
    finally{running.delete(assignment.id);emit();}
  });
  running.set(assignment.id,job);emit();
}
function processState(host,state){if(!state?.donorEnabled||document.visibilityState!=='visible')return;const assignments=Array.isArray(state?.node?.assignments)?state.node.assignments:[];for(const assignment of assignments){if(assignment?.state==='reported')continue;runOne(host,assignment);}}
function attach(host=root.KeloGuardianDeviceHost){if(!host||typeof host.onChange!=='function')return false;if(detach)return true;detach=host.onChange(state=>processState(host,state));processState(host,host.getState?.());emit();return true;}
function stop(){try{detach?.();}catch{}detach=null;emit();}
function getState(){return Object.freeze({version:VERSION,attached:!!detach,running:Object.freeze([...running.keys()]),completedLocal,abandonedLocal,lastError,noPolling:true,arbitraryCodeExecution:false,clientResultTrusted:false});}

export const GuardianWorkloadRuntime=Object.freeze({version:VERSION,attach,stop,getState,onChange(fn){if(typeof fn==='function')listeners.add(fn);return()=>listeners.delete(fn);}});
root.KeloGuardianWorkloadRuntime=GuardianWorkloadRuntime;
if(root.KeloGuardianDeviceHost)attach(root.KeloGuardianDeviceHost);
