/* KELO-INDEX
 * area: CORE
 * keys: BOOTSTRAP MODULE ORDER COMBAT EFFECTS MELEE
 * hace: carga foundations arquitectónicos en orden estable sin meter reglas de dominio en UI/index
 */
(function(root){
  'use strict';
  const VERSION='kelo-runtime-bootstrap-v1.0.0';
  const MODULES=Object.freeze([
    'src/core/events/event-bus.js?v=1',
    'src/systems/combat/combat-schema.js?v=1',
    'src/systems/combat/hit-resolver.js?v=1',
    'src/systems/combat/damage-resolver.js?v=1',
    'src/systems/effects/effect-schema.js?v=1',
    'src/systems/effects/effect-engine.js?v=1',
    'src/systems/combat/combat-engine.js?v=1',
    'src/systems/melee/melee-schema.js?v=1',
    'src/systems/melee/melee-weapon-profiles.js?v=1',
    'src/systems/melee/melee-engine.js?v=1',
    'src/visuals/combat-presentation-bridge.js?v=1'
  ]);
  const audit=root.KELO_RUNTIME_BOOTSTRAP_AUDIT={version:VERSION,ready:false,loaded:0,total:MODULES.length,failed:[]};

  function exists(src){const base=src.split('?')[0];return Array.from(document.scripts).some(function(s){return (s.getAttribute('src')||'').split('?')[0]===base;});}
  function load(index){
    if(index>=MODULES.length){audit.ready=true;try{root.dispatchEvent(new CustomEvent('kelo:runtime-foundations-ready'));}catch(e){}return;}
    const src=MODULES[index];
    if(exists(src)){audit.loaded+=1;load(index+1);return;}
    const script=document.createElement('script');script.src=src;script.async=false;script.dataset.keloRuntimeFoundation='1';
    script.onload=function(){audit.loaded+=1;load(index+1);};
    script.onerror=function(){audit.failed.push(src);console.error('[Kelo runtime bootstrap] failed',src);load(index+1);};
    document.body.appendChild(script);
  }
  load(0);
  root.KeloRuntimeBootstrap=Object.freeze({version:VERSION,modules:MODULES.slice()});
})(typeof globalThis!=='undefined'?globalThis:window);
