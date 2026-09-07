/* KELO-INDEX
 * area: UI
 * keys: BUILDER INPUT SINGLE OWNER POINTER
 * hace: registra el pointer DESPUÉS del World Builder para ganar capture
 * online: llama paintAt/objectAt; no persiste
 */
(function(){
  'use strict';
  if(window.KELO_BUILDER_INPUT)return;
  window.KELO_BUILDER_OWN_INPUT=true;
  let painting=false,bound=false;
  function ui(){return window.KELO_WORLD_BUILDER_UI;}
  function host(){return document.getElementById('kelo-world-builder');}
  function fab(){return document.getElementById('kelo-world-builder-fab');}
  function open(){return !!(ui()?.guideState?.()?.open||ui()?.isOpen);}
  function layer(){return ui()?.guideState?.()?.layer||ui()?.layer||'terrain';}
  function world(e){
    if(typeof ui()?.toWorld==='function')return ui().toWorld(e.clientX,e.clientY);
    if(typeof screenToWorld==='function')return screenToWorld(e.clientX,e.clientY);
    const z=(typeof CONFIG!=='undefined'&&CONFIG.zoom)||1;
    return{x:camera.x+(e.clientX-screenW/2)/z,y:camera.y+(e.clientY-screenH/2)/z};
  }
  function onDown(e){
    const UX=window.KELO_BUILDER_UX;
    if(!open()||ui()?.previewing)return;
    if(host()?.contains(e.target)||fab()?.contains(e.target))return;
    const w=world(e),lyr=layer();
    e.preventDefault();e.stopImmediatePropagation();
    if(typeof window.input!=='undefined')window.input.touchActive=false;
    if(lyr==='objects'){
      painting=false;
      if(UX?.holding){UX.drop?.(w);return;}
      ui().objectAt?.(w);
      return;
    }
    painting=true;
    if(lyr==='terrain'||lyr==='path')ui().paintAt?.(w);
    else ui().collisionAtWorld?.(w);
  }
  function onMove(e){
    if(!open()||!painting)return;
    if(host()?.contains(e.target))return;
    const lyr=layer();
    if(lyr==='terrain'||lyr==='path'){
      e.stopImmediatePropagation();
      ui().paintAt?.(world(e));
    }
  }
  function onUp(){painting=false;ui()?.pointerUp?.();}
  function bind(){
    if(bound||!ui())return;
    document.addEventListener('pointerdown',onDown,true);
    document.addEventListener('pointermove',onMove,true);
    document.addEventListener('pointerup',onUp,true);
    document.addEventListener('pointercancel',onUp,true);
    bound=true;
  }
  const t=setInterval(bind,120);
  setTimeout(()=>clearInterval(t),8000);
  window.KELO_BUILDER_INPUT=Object.freeze({version:'builder-input-v1.1.0',owned:true});
})();
