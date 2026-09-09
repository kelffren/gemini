/* KELO-INDEX
 * area: PVP / PERFORMANCE LIFECYCLE
 * owner: KeloPvPWorld
 * keys: PVP COMBAT LAZY BOOTSTRAP MELEE EFFECTS FIRST-USE PERFORMANCE
 * purpose: carga las foundations de combat/effects/melee solo al primer intento explícito de entrar en PvP y delega después al owner KeloPvPWorld existente
 * public-api: KeloPvPWorld.ensureCombatReady + enterPvPWorld lazy facade
 * consumes: KeloPvPWorld + src/core/kelo-runtime-bootstrap.js
 * state-owned: únicamente promesas de carga/entrada first-use; no gameplay
 * extension-points: KeloRuntimeBootstrap; no loaders paralelos por feature
 * reuse: el bootstrap arquitectónico existente conserva el orden real de Combat/Effects/Melee
 * online: no cambia autoridad ni mensajes; solo lifecycle de código cliente
 * do-not: NO resolver daño, NO crear game loop, NO polling, NO cargar combat al boot social
 */
(function(root){
  'use strict';
  const VERSION='pvp-combat-runtime-loader-v1.0.0';
  const BOOTSTRAP_SRC='src/core/kelo-runtime-bootstrap.js?v=1';
  const original=root.KeloPvPWorld;
  if(!original||typeof original.enter!=='function'){
    console.error('[Kelo PvP loader] KeloPvPWorld unavailable');
    return;
  }
  if(root.KELO_PVP_COMBAT_LOADER_AUDIT&&root.KELO_PVP_COMBAT_LOADER_AUDIT.ready)return;

  let loadPromise=null;
  let enterPromise=null;
  let firstRequestedAt=0;
  let loadedAt=0;
  let failures=0;

  function combatReady(){
    return !!(root.KeloMeleeEngine&&root.KeloCombatEngine&&root.KeloHitResolver&&root.KeloCombatSchema&&root.KeloEvents);
  }
  function toast(message){
    if(typeof root.showToast==='function')root.showToast(message);
    else console.info('[Kelo PvP]',message);
  }
  function existingBootstrapScript(){
    return Array.from(document.scripts).find(function(script){
      return ((script.getAttribute('src')||'').split('?')[0])==='src/core/kelo-runtime-bootstrap.js';
    })||null;
  }
  function ensureCombatReady(){
    if(combatReady())return Promise.resolve(true);
    if(loadPromise)return loadPromise;
    if(!firstRequestedAt)firstRequestedAt=Date.now();

    loadPromise=new Promise(function(resolve,reject){
      let settled=false;
      const timeoutId=setTimeout(function(){finish(new Error('COMBAT_BOOT_TIMEOUT'));},15000);
      function cleanup(){
        clearTimeout(timeoutId);
        root.removeEventListener('kelo:runtime-foundations-ready',onReady);
      }
      function finish(error){
        if(settled)return;
        settled=true;
        cleanup();
        if(!error&&combatReady()){
          loadedAt=Date.now();
          resolve(true);
          return;
        }
        failures+=1;
        loadPromise=null;
        reject(error||new Error('COMBAT_FOUNDATIONS_INCOMPLETE'));
      }
      function onReady(){finish(combatReady()?null:new Error('COMBAT_FOUNDATIONS_INCOMPLETE'));}
      root.addEventListener('kelo:runtime-foundations-ready',onReady,{once:true});

      if(root.KELO_RUNTIME_BOOTSTRAP_AUDIT&&root.KELO_RUNTIME_BOOTSTRAP_AUDIT.ready){
        finish(combatReady()?null:new Error('COMBAT_FOUNDATIONS_INCOMPLETE'));
        return;
      }

      const existing=existingBootstrapScript();
      if(existing){
        if(combatReady())finish();
        return;
      }

      const script=document.createElement('script');
      script.src=BOOTSTRAP_SRC;
      script.async=false;
      script.dataset.keloPvpCombatBootstrap='1';
      script.onerror=function(){finish(new Error('COMBAT_BOOTSTRAP_LOAD_FAILED'));};
      document.body.appendChild(script);
    });
    return loadPromise;
  }

  function enter(){
    const args=arguments;
    if(combatReady())return original.enter.apply(original,args);
    if(enterPromise)return enterPromise;
    toast('Cargando combate PvP…');
    enterPromise=ensureCombatReady()
      .then(function(){return original.enter.apply(original,args);})
      .catch(function(error){
        console.error('[Kelo PvP loader] combat foundations failed',error);
        toast('No se pudo cargar el combate. Inténtalo de nuevo.');
        return false;
      })
      .finally(function(){enterPromise=null;});
    return enterPromise;
  }

  const descriptors=Object.getOwnPropertyDescriptors(original);
  descriptors.enter={value:enter,enumerable:true,configurable:false,writable:false};
  descriptors.ensureCombatReady={value:ensureCombatReady,enumerable:true,configurable:false,writable:false};
  const facade={};
  Object.defineProperties(facade,descriptors);
  root.KeloPvPWorld=Object.freeze(facade);
  root.enterPvPWorld=enter;

  root.KELO_PVP_COMBAT_LOADER_AUDIT={
    version:VERSION,
    ready:true,
    owner:'KeloPvPWorld',
    lazy:true,
    bootstrap:BOOTSTRAP_SRC.split('?')[0],
    get combatReady(){return combatReady();},
    get loading(){return !!loadPromise&&!combatReady();},
    get entering(){return !!enterPromise;},
    get firstRequestedAt(){return firstRequestedAt;},
    get loadedAt(){return loadedAt;},
    get failures(){return failures;}
  };
})(typeof globalThis!=='undefined'?globalThis:window);
