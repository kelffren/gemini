/* KELO-INDEX
 * area: CORE / SIMULATION
 * owner: KeloSimulation
 * keys: SIMULATION UPDATE HOOK BEFORE AFTER EXTENSION FOUNDATION
 * purpose: único bridge de extensión alrededor de updateSimulation tras engine-c mientras el core legacy siga global
 * public-api: KeloSimulation.before/after/unregister/snapshot
 * consumes: updateSimulation legacy final de engine-c
 * state-owned: registro ordenado de extensiones simulation
 * extension-points: before/after con prioridad explícita
 * reuse: timers gameplay existentes, interpolación net y updates de sistemas sin envolver updateSimulation
 * legacy: bridge temporal; la simulación base sigue viviendo en engine-a/engine-c
 * do-not: NO crear otro game loop, NO renderizar, NO meter UI
 */
(function(root){
  'use strict';
  if(root.KeloSimulation)return;
  const VERSION='kelo-simulation-extensions-v1.1.0';
  if(typeof updateSimulation!=='function'){
    root.KELO_SIMULATION_EXTENSION_AUDIT=Object.freeze({version:VERSION,installed:false,reason:'updateSimulation-missing'});
    return;
  }
  const originalUpdateSimulation=updateSimulation;
  const hooks={before:[],after:[]};
  let sequence=1;
  function add(phase,owner,fn,priority){
    if(typeof fn!=='function')throw new TypeError('simulation hook must be a function');
    const entry={id:'sim-hook-'+sequence++,owner:String(owner||'anonymous'),fn:fn,priority:Number(priority)||0};
    hooks[phase].push(entry);hooks[phase].sort(function(a,b){return a.priority-b.priority||a.id.localeCompare(b.id);});return entry.id;
  }
  function unregister(id){let removed=false;['before','after'].forEach(function(phase){const i=hooks[phase].findIndex(function(h){return h.id===id;});if(i>=0){hooks[phase].splice(i,1);removed=true;}});return removed;}
  function runPhase(phase,ctx){const list=(hooks[phase]||[]).slice();for(let i=0;i<list.length;i++)list[i].fn(ctx);}
  function publicList(phase){return Object.freeze(hooks[phase].map(function(h){return Object.freeze({id:h.id,owner:h.owner,priority:h.priority});}));}
  function snapshot(){return Object.freeze({version:VERSION,before:publicList('before'),after:publicList('after')});}

  // FOUNDATION-ALLOW: único bridge autorizado alrededor de updateSimulation tras engine-c.
  updateSimulation=function(dt){
    const context={dt:Number(dt)||0,player:typeof localPlayer!=='undefined'?localPlayer:null,state:typeof STATE!=='undefined'?STATE:null};
    runPhase('before',context);
    const out=originalUpdateSimulation.apply(this,arguments);
    runPhase('after',context);
    return out;
  };

  root.KeloSimulation=Object.freeze({version:VERSION,before:function(owner,fn,priority){return add('before',owner,fn,priority);},after:function(owner,fn,priority){return add('after',owner,fn,priority);},unregister:unregister,snapshot:snapshot});
  root.KELO_SIMULATION_EXTENSION_AUDIT=Object.freeze({version:VERSION,installed:true,singleLegacyWrapper:true,beforeAfter:true,timers:0,renderAuthority:false,legacyTarget:'updateSimulation'});
})(typeof globalThis!=='undefined'?globalThis:window);
