/* KELO-INDEX
 * area: CORE / OPTIONAL UI
 * owner: KeloSettingsLazyGate
 * keys: SETTINGS DOWNLOAD CENTER GUARDIAN LAZY FIRST-USE MOBILE SAFARI
 * purpose: mantiene Ajustes visible con una puerta mínima; Download Center y Guardian no se evalúan hasta el primer toque
 * public-api: KeloSettingsUI.open/close + KeloSettingsLazyGate.load
 * do-not: NO download center/Guardian import on normal boot, NO polling, NO second loop
 */
(function(root){
'use strict';
if(root.KeloSettingsLazyGate)return;
const VERSION='kelo-settings-lazy-gate-v1.1-guardian';
let loading=null,guardianLoading=null;
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
async function open(){
  try{
    const center=await load();if(!center||typeof center.open!=='function')throw new Error('DOWNLOAD_CENTER_UNAVAILABLE');
    center.open();
    loadGuardian().then(function(guardian){try{guardian?.mountInSettings?.();}catch(error){console.error('[Kelo Guardian mount]',error);}});
    return true;
  }
  catch(error){console.error('[Kelo Settings lazy gate]',error);if(typeof root.showToast==='function')root.showToast('No se pudo abrir Ajustes');return false;}
}
function close(){try{root.KeloDownloadCenter?.close?.();}catch(_){} }
const api=Object.freeze({version:VERSION,load,loadGuardian,open,close,get loaded(){return !!root.KeloDownloadCenter;},get guardianLoaded(){return !!root.KeloGuardianDeviceHost;}});
root.KeloSettingsLazyGate=api;
root.KeloSettingsUI=Object.freeze({open,close});
try{root.KELO_LUXE?.renderMenu?.();}catch(_){}
})(typeof globalThis!=='undefined'?globalThis:window);
