/* KELO-INDEX
 * area: CORE / INPUT
 * owner: KeloInput
 * keys: INPUT PIPELINE LOCK HOOK BEFORE AFTER PROCESSINPUT FOUNDATION
 * purpose: único pipeline alrededor del processInput legacy; aplica locks y ofrece hooks deterministas sin wrappers paralelos
 * public-api: KeloInput.before/after/unregister/snapshot/isLocked
 * consumes: processInput legacy, KeloInputLocks, input, localPlayer
 * state-owned: registro de hooks de input; NO posee los claims de lock
 * extension-points: before/after con prioridad explícita
 * reuse: aim derivado, telemetría y adaptación de intención sin envolver processInput
 * legacy: bridge temporal mientras el parser físico de input siga en engine-a.js
 * do-not: NO meter UI, gameplay de habilidades, colisión, cámara ni render aquí
 */
(function(root){
  'use strict';
  if(root.KeloInput)return;
  const VERSION='kelo-input-v1.0.0';
  if(typeof processInput!=='function'){
    root.KELO_INPUT_SYSTEM_AUDIT=Object.freeze({version:VERSION,installed:false,reason:'processInput-missing'});
    return;
  }
  const originalProcessInput=processInput;
  const hooks={before:[],after:[]};
  let sequence=1;

  function add(phase,owner,fn,priority){
    if(typeof fn!=='function')throw new TypeError('input hook must be a function');
    const entry={id:'input-hook-'+sequence++,owner:String(owner||'anonymous'),fn:fn,priority:Number(priority)||0};
    hooks[phase].push(entry);
    hooks[phase].sort(function(a,b){return a.priority-b.priority||a.id.localeCompare(b.id);});
    return entry.id;
  }
  function unregister(id){
    let removed=false;
    ['before','after'].forEach(function(phase){
      const i=hooks[phase].findIndex(function(h){return h.id===id;});
      if(i>=0){hooks[phase].splice(i,1);removed=true;}
    });
    return removed;
  }
  function run(phase,ctx){
    const list=hooks[phase].slice();
    for(let i=0;i<list.length;i++)list[i].fn(ctx);
  }
  function isLocked(){
    const locks=root.KeloInputLocks;
    return !!(locks&&typeof locks.isLocked==='function'&&locks.isLocked());
  }
  function clearIntent(){
    if(typeof input!=='undefined'&&input){
      input.normX=0;input.normY=0;input.touchActive=false;input.touchId=null;
      const keys=input.keys||{};
      Object.keys(keys).forEach(function(key){keys[key]=false;});
    }
    if(typeof localPlayer!=='undefined'&&localPlayer){localPlayer.vx=0;localPlayer.vy=0;}
  }
  function publicList(phase){
    return Object.freeze(hooks[phase].map(function(h){return Object.freeze({id:h.id,owner:h.owner,priority:h.priority});}));
  }
  function snapshot(){return Object.freeze({version:VERSION,locked:isLocked(),before:publicList('before'),after:publicList('after')});}

  // FOUNDATION-ALLOW: único bridge autorizado alrededor del processInput legacy.
  processInput=function(){
    if(isLocked()){
      clearIntent();
      return;
    }
    const ctx={input:typeof input!=='undefined'?input:null,player:typeof localPlayer!=='undefined'?localPlayer:null};
    run('before',ctx);
    const result=originalProcessInput.apply(this,arguments);
    run('after',ctx);
    return result;
  };

  root.KeloInput=Object.freeze({
    version:VERSION,
    before:function(owner,fn,priority){return add('before',owner,fn,priority);},
    after:function(owner,fn,priority){return add('after',owner,fn,priority);},
    unregister:unregister,
    isLocked:isLocked,
    snapshot:snapshot
  });
  root.KELO_INPUT_SYSTEM_AUDIT=Object.freeze({version:VERSION,installed:true,owner:true,singleLegacyWrapper:true,usesKeloInputLocks:true,beforeAfterHooks:true,timers:0,uiRules:false});
  // Compatibility audit name used by older tests/diagnostics. There is no second gate wrapper.
  root.KELO_INPUT_GATE_AUDIT=Object.freeze({version:VERSION,installed:true,retiredInto:'KeloInput',owner:'KeloInput',lockOwner:'KeloInputLocks',bridge:true,processInputWrapperOwner:'KeloInput',timers:0});
})(typeof globalThis!=='undefined'?globalThis:window);
