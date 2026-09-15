/* KELO-INDEX
 * area: CORE / OPTIONAL UI
 * owner: KeloSettingsLazyGate
 * keys: SETTINGS DOWNLOAD CENTER UPDATE INTELLIGENCE GUARDIAN WORKLOAD P2P WEBRTC LAZY FIRST-USE MOBILE SAFARI
 * purpose: mantiene Ajustes visible con una puerta mínima; Update Intelligence y Guardian solo se evalúan tras el primer toque
 * public-api: KeloSettingsUI.open/close + KeloSettingsLazyGate.load
 * do-not: NO settings/Guardian payload on normal boot, NO polling, NO segundo socket/loop
 */
(function(root){
'use strict';
if(root.KeloSettingsLazyGate)return;
const VERSION='kelo-settings-lazy-gate-v2.1-update-intelligence-guardian';
let loading=null,guardianLoading=null,workloadLoading=null,peerLoading=null;
function loadScript(src,marker){return new Promise(function(resolve,reject){const base=src.split('?')[0],existing=Array.from(document.scripts).find(function(s){return String(s.getAttribute('src')||'').split('?')[0]===base;});if(existing){resolve();return;}const s=document.createElement('script');s.src=src;s.async=false;s.dataset.keloSettingsFirstUse=marker||'1';s.onload=resolve;s.onerror=function(){reject(new Error('SETTINGS_SCRIPT_LOAD_FAILED:'+src));};document.head.appendChild(s);});}
function load(){
  if(root.KeloDownloadCenter&&root.KeloUpdateIntelligenceUI)return Promise.resolve(root.KeloDownloadCenter);
  if(loading)return loading;
  loading=loadScript('src/core/download-center.js?v=2-safe','download-center')
    .then(function(){return loadScript('src/core/update-intelligence-ui.js?v=1','update-intelligence');})
    .then(function(){return root.KeloDownloadCenter||null;})
    .finally(function(){loading=null;});
  return loading;
}
function loadGuardian(){
  if(root.KeloGuardianDeviceHost)return Promise.resolve(root.KeloGuardianDeviceHost);
  if(guardianLoading)return guardianLoading;
  guardianLoading=import('../online/guardian-device-host.mjs?v=1').then(function(mod){return mod.GuardianDeviceHost||root.KeloGuardianDeviceHost||null;}).catch(function(error){console.error('[Kelo Guardian lazy gate]',error);return null;}).finally(function(){guardianLoading=null;});
  return guardianLoading;
}
function loadGuardianWorkloads(guardian){
  if(root.KeloGuardianWorkloadRuntime){try{root.KeloGuardianWorkloadRuntime.attach?.(guardian);}catch(_){}return Promise.resolve(root.KeloGuardianWorkloadRuntime);}
  if(workloadLoading)return workloadLoading;
  workloadLoading=import('../online/guardian-workload-runtime.mjs?v=1').then(function(mod){const runtime=mod.GuardianWorkloadRuntime||root.KeloGuardianWorkloadRuntime||null;try{runtime?.attach?.(guardian);}catch(error){console.error('[Kelo Guardian workload attach]',error);}return runtime;}).catch(function(error){console.error('[Kelo Guardian workload lazy gate]',error);return null;}).finally(function(){workloadLoading=null;});
  return workloadLoading;
}
function loadGuardianPeers(guardian){
  if(root.KeloGuardianPeerMesh){try{root.KeloGuardianPeerMesh.attach?.(guardian);}catch(_){}return Promise.resolve(root.KeloGuardianPeerMesh);}
  if(peerLoading)return peerLoading;
  peerLoading=import('../online/guardian-peer-mesh.mjs?v=1').then(function(mod){const mesh=mod.GuardianPeerMesh||root.KeloGuardianPeerMesh||null;try{mesh?.attach?.(guardian);}catch(error){console.error('[Kelo Guardian peer attach]',error);}return mesh;}).catch(function(error){console.error('[Kelo Guardian peer lazy gate]',error);return null;}).finally(function(){peerLoading=null;});
  return peerLoading;
}
async function open(){
  try{
    const center=await load();if(!center||typeof center.open!=='function')throw new Error('DOWNLOAD_CENTER_UNAVAILABLE');
    center.open();try{root.KeloUpdateIntelligenceUI?.render?.();}catch(_){}
    loadGuardian().then(function(guardian){try{guardian?.mountInSettings?.();}catch(error){console.error('[Kelo Guardian mount]',error);}if(guardian){loadGuardianWorkloads(guardian);loadGuardianPeers(guardian);}});
    return true;
  }
  catch(error){console.error('[Kelo Settings lazy gate]',error);if(typeof root.showToast==='function')root.showToast('No se pudo abrir Ajustes');return false;}
}
function close(){try{root.KeloDownloadCenter?.close?.();}catch(_){} }
const api=Object.freeze({version:VERSION,load,loadGuardian,loadGuardianWorkloads,loadGuardianPeers,open,close,get loaded(){return !!(root.KeloDownloadCenter&&root.KeloUpdateIntelligenceUI);},get guardianLoaded(){return !!root.KeloGuardianDeviceHost;},get workloadRuntimeLoaded(){return !!root.KeloGuardianWorkloadRuntime;},get peerMeshLoaded(){return !!root.KeloGuardianPeerMesh;}});
root.KeloSettingsLazyGate=api;
root.KeloSettingsUI=Object.freeze({open,close});
try{root.KELO_LUXE?.renderMenu?.();}catch(_){}
})(typeof globalThis!=='undefined'?globalThis:window);
