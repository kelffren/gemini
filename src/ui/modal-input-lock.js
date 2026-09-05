(function(){
'use strict';
const VERSION='modal-input-lock-v1.1.0';
if(typeof processInput==='function'){
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
}
if(!document.querySelector('script[data-kelo-inventory-hotfix]')){
  const script=document.createElement('script');
  script.src='src/ui/inventory-interaction-hotfix.js?v=1';
  script.dataset.keloInventoryHotfix='1';
  document.head.appendChild(script);
}
window.KELO_MODAL_INPUT_AUDIT=Object.freeze({version:VERSION,reusable:true,lockFlag:'KELO_MODAL_INPUT_LOCK',movementBlocked:true,authorityImpact:'none-ui-only',inventoryInteractionHotfix:true});
})();