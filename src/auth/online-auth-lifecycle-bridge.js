/* KELO-INDEX
 * area: AUTH / ONLINE IDENTITY
 * owner-adjacent: KeloOnlineAuth lifecycle continuity
 * keys: SUPABASE TOKEN_REFRESHED SIGNED_OUT JWT WEBSOCKET SESSION RECONNECT
 * purpose: keep the existing authoritative network credentials synchronized across Supabase token refresh/sign-out events
 * online: no transport is created; this only refreshes the credentials consumed by KeloNetAuthority
 * do-not: NO second WebSocket, NO refresh token copy, NO service_role/sb_secret, NO gameplay authority
 */
(function(){
'use strict';
const VERSION='kelo-online-auth-lifecycle-v1';
const NET_CHARACTER_STORAGE_KEY='kelo.active.character.v1';
const NET_SESSION_STORAGE_KEY='kelo.supabase.session.v1';
let installed=false,scheduled=false,signOutRepair=false,unsubscribe=null,lastEvent='boot';

function emit(name,detail){try{window.dispatchEvent(new CustomEvent(name,{detail}))}catch(_){}}
function clearNetIdentity(){
  try{localStorage.removeItem(NET_CHARACTER_STORAGE_KEY);localStorage.removeItem(NET_SESSION_STORAGE_KEY)}catch(_){}
}
function publicState(){return Object.freeze({version:VERSION,installed,lastEvent});}

function scheduleCredentialSync(reason){
  if(scheduled)return;
  scheduled=true;
  setTimeout(async()=>{
    scheduled=false;
    const auth=window.KeloOnlineAuth;
    if(!auth||typeof auth.credentials!=='function')return;
    try{
      const credentials=await auth.credentials();
      if(credentials?.accessToken&&credentials?.characterId){
        emit('kelo:online-auth-token-synced',{reason,characterId:credentials.characterId});
      }
    }catch(error){
      emit('kelo:online-auth-token-sync-error',{reason,error:String(error?.message||error)});
    }
  },0);
}

function repairSignedOutState(){
  if(signOutRepair)return;
  signOutRepair=true;
  setTimeout(async()=>{
    try{
      const auth=window.KeloOnlineAuth,state=auth&&typeof auth.state==='function'?auth.state():null;
      if(state?.authenticated&&typeof auth.signOut==='function')await auth.signOut();
    }catch(_){}
    finally{signOutRepair=false;}
  },0);
}

function install(){
  if(installed)return true;
  const auth=window.KeloOnlineAuth;
  if(!auth||typeof auth.getClient!=='function')return false;
  let client=null;
  try{client=auth.getClient();}catch(_){return false;}
  if(!client?.auth||typeof client.auth.onAuthStateChange!=='function')return false;

  const result=client.auth.onAuthStateChange((event)=>{
    const name=String(event||'UNKNOWN');
    lastEvent=name;
    if(name==='TOKEN_REFRESHED'){
      scheduleCredentialSync(name);
      return;
    }
    if(name==='SIGNED_OUT'){
      clearNetIdentity();
      emit('kelo:online-auth-session-ended',{reason:name});
      repairSignedOutState();
    }
  });
  unsubscribe=result?.data?.subscription&&typeof result.data.subscription.unsubscribe==='function'?()=>result.data.subscription.unsubscribe():null;
  installed=true;
  emit('kelo:online-auth-lifecycle-ready',publicState());
  return true;
}

if(!install()){
  const retry=()=>{if(install())window.removeEventListener('kelo:online-auth-state',retry)};
  window.addEventListener('kelo:online-auth-state',retry,{passive:true});
  setTimeout(install,0);
}

window.KeloOnlineAuthLifecycle=Object.freeze({version:VERSION,state:publicState,dispose(){try{unsubscribe?.()}catch(_){}unsubscribe=null;installed=false;}});
})();
