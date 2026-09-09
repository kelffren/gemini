/* KELO-INDEX
 * area: PVP / PERFORMANCE LIFECYCLE
 * owner: KeloPvPWorld
 * keys: PVP COMBAT LAZY BOOTSTRAP MELEE EFFECTS ABILITIES FIRST-USE PERFORMANCE
 * purpose: solicita las foundations de combate solo al primer intento explícito de entrar en PvP y delega después al owner KeloPvPWorld existente
 * public-api: KeloPvPWorld.ensureCombatReady + enterPvPWorld lazy facade
 * consumes: KeloPvPWorld + KeloRuntimeBootstrap + KeloAbilitiesLoader
 * state-owned: únicamente promesas/telemetría de entrada first-use; no gameplay
 * extension-points: KeloRuntimeBootstrap.ensure(); no loaders paralelos por feature
 * online: no cambia autoridad ni mensajes; solo lifecycle de código cliente
 * do-not: NO resolver daño, NO inyectar scripts de foundations, NO crear game loop, NO polling
 */
(function(root){
  'use strict';
  const VERSION='pvp-combat-runtime-loader-v1.1.0';
  const original=root.KeloPvPWorld;
  if(!original||typeof original.enter!=='function'){console.error('[Kelo PvP loader] KeloPvPWorld unavailable');return;}
  if(root.KELO_PVP_COMBAT_LOADER_AUDIT&&root.KELO_PVP_COMBAT_LOADER_AUDIT.ready)return;

  let loadPromise=null,enterPromise=null,firstRequestedAt=0,loadedAt=0,failures=0;
  function combatReady(){return !!(root.KeloMeleeEngine&&root.KeloCombatEngine&&root.KeloHitResolver&&root.KeloCombatSchema&&root.KeloEvents&&root.KeloAbilities);}
  function toast(message){if(typeof root.showToast==='function')root.showToast(message);else console.info('[Kelo PvP]',message);}
  function ensureCombatReady(){
    if(combatReady())return Promise.resolve(true);
    if(loadPromise)return loadPromise;
    if(!firstRequestedAt)firstRequestedAt=Date.now();
    if(!root.KeloRuntimeBootstrap||typeof root.KeloRuntimeBootstrap.ensure!=='function')return Promise.reject(new Error('KELO_RUNTIME_BOOTSTRAP_UNAVAILABLE'));
    loadPromise=root.KeloRuntimeBootstrap.ensure()
      .then(function(){return root.KeloAbilitiesLoader&&typeof root.KeloAbilitiesLoader.ensure==='function'?root.KeloAbilitiesLoader.ensure():true;})
      .then(function(){if(!combatReady())throw new Error('COMBAT_FOUNDATIONS_INCOMPLETE');loadedAt=Date.now();return true;})
      .catch(function(error){failures+=1;loadPromise=null;throw error;});
    return loadPromise;
  }
  function enter(){
    const args=arguments;
    if(combatReady())return original.enter.apply(original,args);
    if(enterPromise)return enterPromise;
    toast('Cargando combate PvP…');
    enterPromise=ensureCombatReady()
      .then(function(){return original.enter.apply(original,args);})
      .catch(function(error){console.error('[Kelo PvP loader] combat foundations failed',error);toast('No se pudo cargar el combate. Inténtalo de nuevo.');return false;})
      .finally(function(){enterPromise=null;});
    return enterPromise;
  }

  const descriptors=Object.getOwnPropertyDescriptors(original);
  descriptors.enter={value:enter,enumerable:true,configurable:false,writable:false};
  descriptors.ensureCombatReady={value:ensureCombatReady,enumerable:true,configurable:false,writable:false};
  const facade={};Object.defineProperties(facade,descriptors);
  root.KeloPvPWorld=Object.freeze(facade);root.enterPvPWorld=enter;
  root.KELO_PVP_COMBAT_LOADER_AUDIT={version:VERSION,ready:true,owner:'KeloPvPWorld',runtimeOwner:'KeloRuntimeBootstrap',lazy:true,get combatReady(){return combatReady();},get loading(){return !!loadPromise&&!combatReady();},get entering(){return !!enterPromise;},get firstRequestedAt(){return firstRequestedAt;},get loadedAt(){return loadedAt;},get failures(){return failures;}};
})(typeof globalThis!=='undefined'?globalThis:window);
