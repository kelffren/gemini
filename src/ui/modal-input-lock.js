(function(){
'use strict';
const VERSION='modal-input-lock-v1.0.0';
if(typeof processInput!=='function')return;
const original=processInput;
processInput=function(){
  if(window.KELO_MODAL_INPUT_LOCK){
    if(typeof input!=='undefined'){
      input.normX=0;input.normY=0;input.touchActive=false;input.touchId=null;
      Object.keys(input.keys||{}).forEach(function(k){input.keys[k]=false;});
    }
    if(typeof localPlayer!=='undefined'){localPlayer.vx=0;localPlayer.vy=0;}
    return;
  }
  return original.apply(this,arguments);
};
window.KELO_MODAL_INPUT_AUDIT=Object.freeze({version:VERSION,reusable:true,lockFlag:'KELO_MODAL_INPUT_LOCK',movementBlocked:true,authorityImpact:'none-ui-only'});
})();