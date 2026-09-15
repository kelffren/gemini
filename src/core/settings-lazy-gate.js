/* KELO-INDEX
 * area: CORE / OPTIONAL UI
 * owner: KeloSettingsLazyGate
 * keys: SETTINGS DOWNLOAD CENTER LAZY FIRST-USE MOBILE SAFARI
 * purpose: mantiene Ajustes visible con una puerta mínima; Download Center no se evalúa hasta el primer toque
 * public-api: KeloSettingsUI.open/close + KeloSettingsLazyGate.load
 * do-not: NO download center import on normal boot, NO polling, NO second loop
 */
(function(root){
'use strict';
if(root.KeloSettingsLazyGate)return;
const VERSION='kelo-settings-lazy-gate-v1';
let loading=null;
function load(){
  if(root.KeloDownloadCenter)return Promise.resolve(root.KeloDownloadCenter);
  if(loading)return loading;
  loading=new Promise(function(resolve,reject){
    const s=document.createElement('script');s.src='src/core/download-center.js?v=2-safe';s.async=false;s.dataset.keloSettingsFirstUse='1';
    s.onload=function(){resolve(root.KeloDownloadCenter||null);};s.onerror=function(){reject(new Error('DOWNLOAD_CENTER_LOAD_FAILED'));};document.head.appendChild(s);
  }).finally(function(){loading=null;});
  return loading;
}
async function open(){
  try{const center=await load();if(!center||typeof center.open!=='function')throw new Error('DOWNLOAD_CENTER_UNAVAILABLE');center.open();return true;}
  catch(error){console.error('[Kelo Settings lazy gate]',error);if(typeof root.showToast==='function')root.showToast('No se pudo abrir Ajustes');return false;}
}
function close(){try{root.KeloDownloadCenter?.close?.();}catch(_){} }
const api=Object.freeze({version:VERSION,load,open,close,get loaded(){return !!root.KeloDownloadCenter;}});
root.KeloSettingsLazyGate=api;
root.KeloSettingsUI=Object.freeze({open,close});
try{root.KELO_LUXE?.renderMenu?.();}catch(_){}
})(typeof globalThis!=='undefined'?globalThis:window);
