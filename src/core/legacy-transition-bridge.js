/* KELO-INDEX
 * area: CORE / LEGACY TRANSITIONS
 * owner: KeloLegacyTransitionBridge
 * keys: LEGACY TELEPORT POSITION CAMERA STRANGLER MIGRATION
 * purpose: conserva APIs legacy de viaje pero enruta sus writes discontinuos por KeloPlayerPosition y KeloCamera
 * public-api: KeloLegacyTransitionBridge.snapshot
 * consumes: teleportToPlot, teleportToFarm, STATE, KeloPlayerPosition, KeloCamera
 * state-owned: contadores de uso del bridge solamente
 * extension-points: añadir únicamente transiciones legacy demostradas; retirar cada shim al migrar su consumidor
 * reuse: frontera temporal de compatibilidad, no API para features nuevas
 * legacy: TEMPORAL STRANGLER; no añadir gameplay nuevo aquí
 * do-not: NO movimiento continuo, NO timers, NO listeners, NO render, NO writes directos localPlayer.x/y o camera.targetX/Y
 */
(function(root){
  'use strict';
  if(root.KeloLegacyTransitionBridge)return;
  const VERSION='kelo-legacy-transition-bridge-v1.0.0';
  const originalPlot=typeof root.teleportToPlot==='function'?root.teleportToPlot:null;
  const originalFarm=typeof root.teleportToFarm==='function'?root.teleportToFarm:null;
  let plotCalls=0,farmCalls=0,fallbackCalls=0,last=null;

  function ownersReady(){return !!(root.KeloPlayerPosition&&typeof root.KeloPlayerPosition.teleport==='function'&&root.KeloCamera&&typeof root.KeloCamera.setTarget==='function');}
  function state(){try{return typeof STATE!=='undefined'&&STATE?STATE:null;}catch(_){return null;}}
  function transition(x,y,cameraX,cameraY,source,fallback){
    if(!ownersReady()){
      fallbackCalls++;
      if(typeof fallback==='function')return fallback();
      return false;
    }
    root.KeloPlayerPosition.teleport(x,y,{source,stopMotion:true});
    root.KeloCamera.setTarget(cameraX,cameraY,{source});
    last=Object.freeze({source,x,y,cameraX,cameraY,at:Date.now()});
    return true;
  }
  function teleportPlot(){
    plotCalls++;
    const s=state(),plot=s&&s.plot;
    if(!plot)return typeof originalPlot==='function'?originalPlot():false;
    const centerX=Number(plot.x)+Number(plot.w)/2,centerY=Number(plot.y)+Number(plot.h)/2;
    if(!Number.isFinite(centerX)||!Number.isFinite(centerY))return typeof originalPlot==='function'?originalPlot():false;
    return transition(centerX,Number(plot.y)+Number(plot.h)+40,centerX,centerY,'legacy-bridge:plot',originalPlot);
  }
  function teleportFarm(){
    farmCalls++;
    const s=state(),farm=s&&s.farm;
    if(!farm)return typeof originalFarm==='function'?originalFarm():false;
    const centerX=Number(farm.x)+Number(farm.w)/2,centerY=Number(farm.y)+Number(farm.h)/2;
    if(!Number.isFinite(centerX)||!Number.isFinite(centerY))return typeof originalFarm==='function'?originalFarm():false;
    return transition(centerX,Number(farm.y)+Number(farm.h)+40,centerX,centerY,'legacy-bridge:farm',originalFarm);
  }
  function snapshot(){return Object.freeze({version:VERSION,installed:true,ownersReady:ownersReady(),plotCalls,farmCalls,fallbackCalls,last,legacyPlotPresent:!!originalPlot,legacyFarmPresent:!!originalFarm});}

  if(originalPlot)root.teleportToPlot=teleportPlot;
  if(originalFarm)root.teleportToFarm=teleportFarm;
  root.KeloLegacyTransitionBridge=Object.freeze({version:VERSION,snapshot});
  root.KELO_LEGACY_TRANSITION_AUDIT=Object.freeze({version:VERSION,installed:true,temporary:true,positionOwner:'KeloPlayerPosition',cameraOwner:'KeloCamera',timers:0,listeners:0,continuousMovement:false,get plotCalls(){return plotCalls;},get farmCalls(){return farmCalls;},get fallbackCalls(){return fallbackCalls;}});
})(typeof globalThis!=='undefined'?globalThis:window);
