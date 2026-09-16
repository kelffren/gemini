/* KELO-INDEX
 * area: CORE / HOT DATA
 * owner: KeloHotDataRegistry
 * keys: HOT DATA JSON REGISTER VALIDATE SNAPSHOT APPLY ROLLBACK TRANSACTION MOBILE
 * purpose: allow explicit owners to opt declarative JSON into zero-reload updates with validate-before-mutate transactional rollback
 * public-api: KeloHotDataRegistry.register/unregister/isRegistered/inspect/applyPaths/getState
 * state-owned: in-memory owner registrations + lightweight diagnostics only
 * performance: event-driven only; NO timer, NO interval, NO RAF, NO game loop, NO storage writes
 * do-not: NO arbitrary JSON hot reload, NO arbitrary JS execution, NO implicit globals, NO polling
 */
(function(root){
'use strict';
if(root.KeloHotDataRegistry)return;
const VERSION='kelo-hot-data-registry-v1-transactional';
const baseUrl=new URL('./',document.baseURI);
const registrations=new Map();
let applying=false,registered=0,unregistered=0,transactions=0,rollbacks=0,lastPaths=[],lastBuild=null,lastError=null,lastResult=null;
function emit(type,detail){try{root.dispatchEvent(new CustomEvent('kelo:hot-data:'+type,{detail:Object.assign(getState(),detail||{})}));}catch(_){} }
function normalizePath(value){
  const raw=String(value||'').trim().replace(/^\.\//,'').replace(/^\/+/, '');
  if(!raw||raw.includes('..')||raw.includes('\\')||/[?#]/.test(raw)||!/.+\.json$/i.test(raw))return null;
  try{const u=new URL(raw,baseUrl);if(u.origin!==baseUrl.origin||!u.pathname.startsWith(baseUrl.pathname))return null;}catch(_){return null;}
  return raw;
}
function freezeInfo(entry){return Object.freeze({path:entry.path,owner:entry.owner,version:entry.version||null});}
function register(spec){
  if(!spec||typeof spec!=='object')throw new TypeError('hot_data_spec_required');
  const path=normalizePath(spec.path);if(!path)throw new Error('hot_data_path_must_be_same_origin_json');
  if(typeof spec.validate!=='function'||typeof spec.snapshot!=='function'||typeof spec.apply!=='function'||typeof spec.rollback!=='function')throw new Error('hot_data_transaction_callbacks_required');
  const entry=Object.freeze({path,owner:String(spec.owner||'anonymous-owner'),version:spec.version?String(spec.version):null,parse:typeof spec.parse==='function'?spec.parse:JSON.parse,validate:spec.validate,snapshot:spec.snapshot,apply:spec.apply,rollback:spec.rollback});
  registrations.set(path,entry);registered++;lastError=null;emit('registered',{registration:freezeInfo(entry)});return freezeInfo(entry);
}
function unregister(value){const path=normalizePath(value),entry=path&&registrations.get(path);if(!entry)return false;registrations.delete(path);unregistered++;emit('unregistered',{registration:freezeInfo(entry)});return true;}
function isRegistered(value){const path=normalizePath(value);return !!(path&&registrations.has(path));}
function inspect(paths){const normalized=[],missing=[];for(const value of Array.isArray(paths)?paths:[]){const path=normalizePath(value);if(!path||!registrations.has(path))missing.push(String(value||''));else normalized.push(path);}return Object.freeze({ok:missing.length===0&&normalized.length>0,paths:Object.freeze(normalized),missing:Object.freeze(missing)});}
async function fetchCandidate(path,build,entry){const u=new URL(path,baseUrl);u.searchParams.set('kelo_hot_data',String(build||Date.now()).slice(0,64));const response=await fetch(u.href,{cache:'no-cache',credentials:'same-origin',priority:'low'});if(!response.ok)throw new Error('hot_data_http_'+response.status+':'+path);const text=await response.text();let data;try{data=await entry.parse(text,{path,build,response});}catch(error){throw new Error('hot_data_parse_failed:'+path+':'+String(error&&error.message||error));}return {path,entry,data};}
async function applyPaths(paths,build){
  if(applying)throw new Error('hot_data_transaction_busy');
  const report=inspect(paths);if(!report.ok)throw new Error('hot_data_unregistered:'+report.missing.join(','));
  applying=true;transactions++;lastPaths=report.paths.slice();lastBuild=build?String(build):null;lastError=null;lastResult=null;emit('checking',{paths:lastPaths,build:lastBuild});
  const candidates=[],snapshots=new Map(),applied=[];
  try{
    for(const path of report.paths){const entry=registrations.get(path);candidates.push(await fetchCandidate(path,build,entry));}
    for(const candidate of candidates){const verdict=await candidate.entry.validate(candidate.data,{path:candidate.path,build:lastBuild});if(verdict===false)throw new Error('hot_data_validation_rejected:'+candidate.path);}
    for(const candidate of candidates)snapshots.set(candidate.path,await candidate.entry.snapshot({path:candidate.path,build:lastBuild}));
    for(const candidate of candidates){await candidate.entry.apply(candidate.data,{path:candidate.path,build:lastBuild});applied.push(candidate);}
    lastResult={ok:true,paths:report.paths.slice(),build:lastBuild,applied:applied.length,at:Date.now()};emit('applied',lastResult);return Object.freeze(Object.assign({},lastResult));
  }catch(error){
    const rollbackErrors=[];
    for(let i=applied.length-1;i>=0;i--){const candidate=applied[i];try{await candidate.entry.rollback(snapshots.get(candidate.path),{path:candidate.path,build:lastBuild,cause:error});}catch(rollbackError){rollbackErrors.push({path:candidate.path,error:String(rollbackError&&rollbackError.message||rollbackError)});}}
    if(applied.length){rollbacks++;emit('rollback',{paths:applied.map(x=>x.path),rollbackErrors});}
    lastError=String(error&&error.message||error);lastResult={ok:false,paths:report.paths.slice(),build:lastBuild,applied:applied.length,rollbackErrors,at:Date.now(),error:lastError};emit('error',lastResult);throw error;
  }finally{applying=false;}
}
function getState(){return Object.freeze({version:VERSION,applying,registrations:registrations.size,registered,unregistered,transactions,rollbacks,lastPaths:Object.freeze(lastPaths.slice()),lastBuild,lastError,lastResult,timers:0,intervals:0,raf:0,gameLoop:false,storageWrites:0,implicitRegistrations:0});}
root.KeloHotDataRegistry=Object.freeze({version:VERSION,register,unregister,isRegistered,inspect,applyPaths,getState});
root.KELO_HOT_DATA_AUDIT=Object.freeze({version:VERSION,installed:true,transactional:true,validateBeforeMutate:true,rollback:true,explicitOnly:true,arbitraryJson:false,arbitraryJs:false,timers:0,intervals:0,raf:0,gameLoop:false,storageWrites:0});
})(typeof globalThis!=='undefined'?globalThis:window);
