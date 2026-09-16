/* KELO-INDEX
 * area: SYSTEMS / CREATOR CONTENT ACCESS
 * owner: KeloCreatorEntitlements
 * keys: CREATOR CONTENT ENTITLEMENT OWNERSHIP LICENSE REVISION ACCESS RUNTIME
 * purpose: single lightweight runtime gate for revision-specific Creator content usage
 * consumes: KeloOnlineAuth existing Supabase client + authoritative access RPCs
 * state-owned: in-memory access cache only; database remains authority
 * online: own authored revision OR entitlement grants use; publication alone never grants use
 * do-not: no localStorage ownership, no KC writes, no duplicate auth client, no asset loading
 */
(function(root){
'use strict';
const VERSION='creator-entitlements-v1.0.0';
const creatorSources=new Set(['supabase-creator','creator-content','creator-marketplace']);
let status='idle',accountId=null,lastError=null,lastRefreshAt=0,refreshPromise=null;
const byRevision=new Map(),byContent=new Map(),listeners=new Set();
const text=v=>String(v==null?'':v).trim();
function authState(){try{return root.KeloOnlineAuth?.state?.()||null;}catch(_){return null;}}
function isCreatorRecord(record){if(!record||typeof record!=='object')return false;const source=text(record.source);return creatorSources.has(source)||!!record.revisionId||!!record.ownerUserId||String(record.activation?.owner||'')==='KeloCreatorEntitlements';}
function addRow(row){const revisionId=text(row?.revision_id||row?.revisionId),contentId=text(row?.content_id||row?.contentId);if(!revisionId)return;const clean=Object.freeze({revisionId,contentId,contentType:text(row?.content_type||row?.contentType),displayName:text(row?.display_name||row?.displayName),accessReason:text(row?.access_reason||row?.accessReason||'entitlement'),licenseKey:text(row?.license_key||row?.licenseKey||'standard'),ownerUserId:text(row?.owner_user_id||row?.ownerUserId)});byRevision.set(revisionId,clean);if(contentId){if(!byContent.has(contentId))byContent.set(contentId,new Set());byContent.get(contentId).add(revisionId);}}
function clear(reason){byRevision.clear();byContent.clear();accountId=null;lastRefreshAt=Date.now();status=reason||'signed-out';emit('clear');}
function snapshot(){return Object.freeze({version:VERSION,status,accountId,count:byRevision.size,contentCount:byContent.size,lastRefreshAt,lastError:lastError?String(lastError.message||lastError):null});}
function emit(reason){const snap=snapshot();listeners.forEach(fn=>{try{fn({reason,snapshot:snap});}catch(_){}});try{root.KeloEvents?.emit?.('CREATOR_ENTITLEMENTS_CHANGED',{reason,snapshot:snap});}catch(_){ }try{root.dispatchEvent?.(new CustomEvent('kelo:creator-entitlements-changed',{detail:{reason,snapshot:snap}}));}catch(_){ }return snap;}
function checkRecord(record){
  if(!isCreatorRecord(record))return Object.freeze({ok:true,reason:'NOT_CREATOR_CONTENT'});
  const revisionId=text(record.revisionId||record.contentRevisionId||record.revision_id),contentId=text(record.contentId||record.content_id),owner=text(record.ownerUserId||record.owner_user_id),me=text(authState()?.accountId||accountId);
  if(owner&&me&&owner===me)return Object.freeze({ok:true,reason:'CREATOR_OWNER',revisionId,contentId});
  if(revisionId&&byRevision.has(revisionId)){const row=byRevision.get(revisionId);return Object.freeze({ok:true,reason:row.accessReason.toUpperCase(),revisionId,contentId:row.contentId||contentId,licenseKey:row.licenseKey});}
  if(!me)return Object.freeze({ok:false,reason:'AUTH_REQUIRED',revisionId,contentId});
  if(!revisionId)return Object.freeze({ok:false,reason:'CREATOR_REVISION_ID_REQUIRED',contentId});
  if(status!=='ready')return Object.freeze({ok:false,reason:'ENTITLEMENT_CACHE_NOT_READY',revisionId,contentId});
  return Object.freeze({ok:false,reason:'ENTITLEMENT_REQUIRED',revisionId,contentId});
}
function canUse(record){return checkRecord(record).ok===true;}
async function refresh({force=false}={}){
  if(refreshPromise&&!force)return refreshPromise;
  refreshPromise=(async()=>{
    try{
      status='loading';lastError=null;emit('loading');
      const credentials=await root.KeloOnlineAuth?.credentials?.();
      const me=text(credentials?.accountId||authState()?.accountId);if(!me){clear('signed-out');return snapshot();}
      const client=root.KeloOnlineAuth?.getClient?.();if(!client?.rpc)throw new Error('CREATOR_ENTITLEMENT_AUTH_CLIENT_REQUIRED');
      const result=await client.rpc('list_my_creator_content_access');if(result?.error)throw result.error;
      byRevision.clear();byContent.clear();for(const row of Array.isArray(result?.data)?result.data:[])addRow(row);
      accountId=me;status='ready';lastRefreshAt=Date.now();lastError=null;return emit('refresh');
    }catch(error){lastError=error;status='error';lastRefreshAt=Date.now();emit('error');return snapshot();}
    finally{refreshPromise=null;}
  })();
  return refreshPromise;
}
async function verifyRevision(revisionId){
  const id=text(revisionId);if(!id)throw new Error('REVISION_REQUIRED');
  const credentials=await root.KeloOnlineAuth?.credentials?.();if(!credentials?.accountId)throw new Error('AUTH_REQUIRED');
  const client=root.KeloOnlineAuth?.getClient?.();if(!client?.rpc)throw new Error('CREATOR_ENTITLEMENT_AUTH_CLIENT_REQUIRED');
  const result=await client.rpc('check_creator_content_access',{p_revision_id:id});if(result?.error)throw result.error;const row=Array.isArray(result?.data)?result.data[0]:result?.data;
  if(row?.allowed)addRow({revision_id:id,content_id:row.contentId,content_type:row.contentType,access_reason:String(row.reason||'entitlement').toLowerCase(),license_key:row.licenseKey,owner_user_id:credentials.accountId});
  emit('verify');return Object.freeze(row||{allowed:false,reason:'ACCESS_CHECK_EMPTY',revisionId:id});
}
function onChange(fn){if(typeof fn!=='function')return()=>{};listeners.add(fn);return()=>listeners.delete(fn);}
const api=Object.freeze({version:VERSION,refresh,verifyRevision,checkRecord,canUse,hasRevision:id=>byRevision.has(text(id)),getRevision:id=>byRevision.get(text(id))||null,revisionsForContent:id=>Object.freeze([...(byContent.get(text(id))||[])]),snapshot,onChange});
root.KeloCreatorEntitlements=api;
for(const name of ['kelo:online-auth-ready','kelo:account-signed-in','kelo:account-created','kelo:profile-complete'])root.addEventListener?.(name,()=>void refresh({force:true}));
root.addEventListener?.('kelo:account-signed-out',()=>clear('signed-out'));
queueMicrotask(()=>{if(authState()?.authenticated)void refresh();});
})(typeof globalThis!=='undefined'?globalThis:this);
