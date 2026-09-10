/* KELO-INDEX
 * area: NET / AUTH BOOT
 * owner: KeloNetAuthority runtime endpoint configuration
 * keys: ONLINE ENDPOINT WSS CONFIG QA OFFLINE SUPABASE AUTH ACCOUNT LOGIN GOOGLE OAUTH BOOT
 * purpose: define endpoint WSS y cargar Auth + puerta de cuenta de forma parser-síncrona justo antes del transporte existente
 * online: `?net=` conserva override QA; `?offline=1` fuerza fallback; Auth enriquece el mismo hello de engine-net.js
 * do-not: NO guardar secrets aquí, NO crear transporte paralelo, NO usar versiones flotantes del SDK
 */
(function(){
'use strict';
const DEFAULT_WS_URL='wss://kelo-world-server.onrender.com';
const SUPABASE_JS_URL='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.116.0';
const AUTH_RUNTIME_URL='src/auth/supabase-auth-runtime.js?v=4';
const ACCOUNT_UI_URL='src/ui/account-auth-ui.js?v=1';
const GOOGLE_AUTH_UI_URL='src/ui/google-auth-button.js?v=1';
const params=new URLSearchParams(location.search),explicitNet=params.get('net'),forceOffline=params.get('offline')==='1',localHost=/^(localhost|127\.0\.0\.1|0\.0\.0\.0)$/i.test(location.hostname||'');
let mode='local';
if(!forceOffline&&!explicitNet&&!localHost&&location.protocol==='https:'){params.set('net',DEFAULT_WS_URL);history.replaceState(history.state,'',location.pathname+'?'+params.toString()+location.hash);mode='production-default';}
else if(explicitNet)mode='query-override';else if(forceOffline)mode='forced-offline';
window.KELO_ONLINE_RUNTIME_CONFIG=Object.freeze({version:'kelo-online-runtime-config-v4',defaultWsUrl:DEFAULT_WS_URL,mode,forceOffline,effectiveNet:new URLSearchParams(location.search).get('net')||null,authBootstrap:'supabase-pinned-2.116.0',accountGate:true,googleAuth:true});
// Este archivo se ejecuta durante el parseo y está colocado inmediatamente antes de engine-net.js.
// document.write mantiene orden estricto: SDK -> Auth -> Account UI -> Google button -> KeloNetAuthority, sin abrir otro socket.
if(!forceOffline&&!window.KeloOnlineAuth&&document.readyState==='loading'){
  document.write('<script src="'+SUPABASE_JS_URL+'"><\\/script><script src="'+AUTH_RUNTIME_URL+'"><\\/script><script src="'+ACCOUNT_UI_URL+'"><\\/script><script src="'+GOOGLE_AUTH_UI_URL+'"><\\/script>');
}
})();