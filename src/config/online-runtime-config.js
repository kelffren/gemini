/* KELO-INDEX
 * area: NET
 * owner: KeloNetAuthority runtime endpoint configuration
 * keys: ONLINE ENDPOINT WSS CONFIG QA OFFLINE
 * purpose: define el endpoint WSS de producción sin meter URLs dentro de features gameplay
 * online: prepara `net` antes de que engine-net.js lea location.search; `?net=` conserva override QA y `?offline=1` fuerza fallback local
 * do-not: NO guardar secretos aquí, NO crear transporte paralelo, NO activar auth server-side desde cliente
 */
(function(){
'use strict';
const DEFAULT_WS_URL='wss://kelo-world-server.onrender.com';
const params=new URLSearchParams(location.search);
const explicitNet=params.get('net');
const forceOffline=params.get('offline')==='1';
const localHost=/^(localhost|127\.0\.0\.1|0\.0\.0\.0)$/i.test(location.hostname||'');
let mode='local';
if(!forceOffline&&!explicitNet&&!localHost&&location.protocol==='https:'){
  params.set('net',DEFAULT_WS_URL);
  const next=location.pathname+'?'+params.toString()+location.hash;
  history.replaceState(history.state,'',next);
  mode='production-default';
}else if(explicitNet){mode='query-override';}
else if(forceOffline){mode='forced-offline';}
window.KELO_ONLINE_RUNTIME_CONFIG=Object.freeze({
  version:'kelo-online-runtime-config-v1',
  defaultWsUrl:DEFAULT_WS_URL,
  mode,
  forceOffline,
  effectiveNet:new URLSearchParams(location.search).get('net')||null
});
})();
