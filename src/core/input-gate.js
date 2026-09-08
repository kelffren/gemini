/* KELO-INDEX
 * area: CORE / INPUT
 * owner: KeloInputLocks (SUPPORT bridge)
 * keys: INPUT GATE MOVEMENT LOCK PROCESSINPUT FOUNDATION COMPAT
 * purpose: conecta el owner KeloInputLocks con el processInput legacy sin meter reglas de UI dentro del core
 * public-api: KELO_INPUT_GATE_AUDIT (observabilidad); no API gameplay
 * consumes: KeloInputLocks, processInput, input, localPlayer
 * state-owned: ninguno
 * extension-points: ninguno; consumidores reclaman input mediante KeloInputLocks
 * reuse: bridge temporal único mientras processInput siga viviendo en engine-a.js
 * legacy: retirar cuando Input sea extraído y consulte KeloInputLocks directamente
 * do-not: NO añadir owners, reglas de panel, PvP, build mode ni timers aquí
 */
(function(root){
  'use strict';
  const VERSION='kelo-input-gate-v1.0.0';
  if(root.KELO_INPUT_GATE_AUDIT&&root.KELO_INPUT_GATE_AUDIT.installed)return;
  if(typeof processInput!=='function'){
    root.KELO_INPUT_GATE_AUDIT=Object.freeze({version:VERSION,installed:false,reason:'processInput-missing'});
    return;
  }

  const previousProcessInput=processInput;

  function clearIntent(){
    if(typeof input!=='undefined'&&input){
      input.normX=0;
      input.normY=0;
      input.touchActive=false;
      input.touchId=null;
      const keys=input.keys||{};
      Object.keys(keys).forEach(function(key){keys[key]=false;});
    }
    if(typeof localPlayer!=='undefined'&&localPlayer){
      localPlayer.vx=0;
      localPlayer.vy=0;
    }
  }

  // FOUNDATION-ALLOW: único bridge temporal autorizado para processInput legacy.
  processInput=function(){
    const locks=root.KeloInputLocks;
    if(locks&&typeof locks.isLocked==='function'&&locks.isLocked()){
      clearIntent();
      return;
    }
    return previousProcessInput.apply(this,arguments);
  };

  root.KELO_INPUT_GATE_AUDIT=Object.freeze({
    version:VERSION,
    installed:true,
    owner:'KeloInputLocks',
    bridge:true,
    timers:0,
    uiRules:false,
    gameplayRules:false,
    legacyTarget:'processInput'
  });
})(typeof globalThis!=='undefined'?globalThis:window);
