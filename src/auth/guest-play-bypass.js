/* KELO-INDEX
 * area: AUTH / GUEST PLAY
 * owner-adjacent: KeloAccountAuthUI
 * keys: GUEST AI TEST PLAYWRIGHT AUTH BYPASS ANONYMOUS
 * purpose: make guest play one-step after anonymous auth and expose an explicit ?guest=1 test route that never blocks automated gameplay behind the auth modal
 * online: explicit test guest does not mint credentials or bypass server authorization; authenticated anonymous sessions keep using KeloOnlineAuth/Supabase normally
 * do-not: NO fake JWT, NO server privilege bypass, NO service_role/secret, NO gameplay authority
 */
(function(){
'use strict';
const VERSION='kelo-guest-play-bypass-v1';
const params=new URLSearchParams(location.search||'');
const explicitGuest=params.get('guest')==='1'||params.get('aiGuest')==='1';
let lastReason='boot';

function authState(){
  try{return window.KeloOnlineAuth&&typeof window.KeloOnlineAuth.state==='function'?window.KeloOnlineAuth.state():null}catch(_){return null}
}
function closeGate(reason){
  const state=authState();
  const anonymous=!!state?.isAnonymous;
  if(!explicitGuest&&!anonymous)return false;
  lastReason=reason|| (explicitGuest?'explicit-guest':'anonymous-session');
  if(explicitGuest)document.documentElement.dataset.keloAuthGate='off';
  try{window.KeloAccountAuthUI?.close?.()}catch(_){}
  const gate=document.getElementById('kelo-account-auth');
  if(gate)gate.hidden=true;
  try{window.dispatchEvent(new CustomEvent('kelo:guest-play-ready',{detail:{version:VERSION,explicitGuest,anonymous,reason:lastReason}}))}catch(_){}
  return true;
}
function schedule(reason){setTimeout(()=>closeGate(reason),0)}

window.addEventListener('kelo:online-auth-state',()=>schedule('auth-state'),true);
window.addEventListener('kelo:online-auth-ready',()=>schedule('auth-ready'),true);
window.addEventListener('kelo:guest-created',()=>schedule('guest-created'),true);
window.addEventListener('kelo:online-auth-required',()=>schedule('auth-required'),true);
window.addEventListener('DOMContentLoaded',()=>schedule('dom-ready'),{once:true});
setTimeout(()=>closeGate('boot'),0);
setTimeout(()=>closeGate('boot-late'),250);

window.KeloGuestPlay=Object.freeze({
  version:VERSION,
  isExplicit:()=>explicitGuest,
  active:()=>explicitGuest||!!authState()?.isAnonymous,
  state:()=>Object.freeze({version:VERSION,explicitGuest,anonymous:!!authState()?.isAnonymous,lastReason}),
  closeGate:()=>closeGate('api')
});
})();
