/* KELO-INDEX
 * area: CORE / OPTIONAL UI
 * owner: KeloSettingsLazyGate
 * keys: SETTINGS DOWNLOAD CENTER GUARDIAN LAZY FIRST-USE MOBILE SAFARI WORKLOAD
 * purpose: mantiene Ajustes visible con una puerta mínima; Download Center y Guardian no se evalúan hasta el primer toque
 * public-api: KeloSettingsUI.open/close + KeloSettingsLazyGate.load
 * do-not: NO download center/Guardian import on normal boot, NO polling, NO second loop
 */
(function(root){
'use strict';
if(root.KeloSettingsLazyGate)return;
const VERSION='kelo-settings-lazy-gate-v1.2-guardian-workloads';
let loading=null,guardianLoading=null,workloadLoading=null;
function load(){
  if(root.KeloDownloadCenter)return Promise.resolve(root.KeloDownloadCenter);
  if(loading)return loading;
  loading=new Promise(function(resolve,reject){
    const s=document.createElement('script');s.src='src/core/download-center.js?v=2-safe';s.async=false;s.dataset.keloSettingsFirstUse='1';
    s.onload=function(){resolve(root.KeloDownloadCenter||null);};s.onerror=function(){reject(new Error('DOWNLOAD_CENTER_LOAD_FAILED'));};document.head.appendChild(s);
  }).finally(function(){loading=null;});
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
async function open(){
  try{
    const center=await load();if(!center||typeof center.open!=='function')throw new Error('DOWNLOAD_CENTER_UNAVAILABLE');
    center.open();
    loadGuardian().then(function(guardian){try{guardian?.mountInSettings?.();}catch(error){console.error('[Kelo Guardian mount]',error);}if(guardian)loadGuardianWorkloads(guardian);});
    return true;
  }
  catch(error){console.error('[Kelo Settings lazy gate]',error);if(typeof root.showToast==='function')root.showToast('No se pudo abrir Ajustes');return false;}
}
function close(){try{root.KeloDownloadCenter?.close?.();}catch(_){} }
const api=Object.freeze({version:VERSION,load,loadGuardian,loadGuardianWorkloads,open,close,get loaded(){return !!root.KeloDownloadCenter;},get guardianLoaded(){return !!root.KeloGuardianDeviceHost;},get workloadRuntimeLoaded(){return !!root.KeloGuardianWorkloadRuntime;}});
root.KeloSettingsLazyGate=api;
root.KeloSettingsUI=Object.freeze({open,close});
try{root.KELO_LUXE?.renderMenu?.();}catch(_){}
})(typeof globalThis!=='undefined'?globalThis:window);
