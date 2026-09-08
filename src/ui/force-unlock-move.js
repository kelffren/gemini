/* KELO-INDEX
 * area: UI
 * keys: INPUT UNLOCK JOYSTICK MODAL BUILDMODE
 * hace: fuerza el joy encendido y apaga locks que dejan al personaje quieto
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
