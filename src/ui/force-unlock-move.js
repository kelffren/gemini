/* KELO-INDEX
 * area: UI / INPUT COMPAT
 * owner: NONE — HOTFIX TEMPORAL, no es autoridad de movimiento
 * keys: INPUT UNLOCK JOYSTICK MODAL BUILDMODE HOTFIX FOUNDATION
 * purpose: evita que locks huérfanos de UI/build dejen al personaje inmóvil mientras se repara ownership
 * public-api: ninguna
 * consumes: KELO_MODAL_INPUT_LOCK, isBuildMode, processInput
 * state-owned: ninguno
 * extension-points: ninguno
 * reuse: NO REUTILIZAR este patrón
 * legacy: retirar solo tras validar ownership acquire/release de todos los locks
 * do-not: NO añadir más flags, timers ni comportamiento gameplay aquí
 */
(function(){
  'use strict';
  function unlock(){
    window.KELO_MODAL_INPUT_LOCK=null;
    try{if(typeof isBuildMode!=='undefined')isBuildMode=false;}catch(e){}
  }
  unlock();
  setInterval(unlock,200);
  if(typeof processInput==='function'){
    const prev=processInput;
    processInput=function(){
      unlock();
      return prev.apply(this,arguments);
    };
  }
})();
