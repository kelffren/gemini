/* KELO-INDEX
 * area: CORE / RENDER
 * owner: KeloRender
 * keys: RENDER HOOK BEFORE FRAME AFTER FRAME EXTENSION FOUNDATION
 * purpose: registro único de extensiones alrededor del frame orquestado por engine-c sin envolver render
 * public-api: KeloRender.beforeFrame/afterFrame/unregister/snapshot
 * consumes: ninguno; engine-c invoca runPhase internamente
 * state-owned: registro ordenado de extensiones render
 * extension-points: beforeFrame/afterFrame con prioridad explícita
 * reuse: minimapa, overlays, indicadores, compatibilidad visual y preparación de contexto
 * legacy: engine-c sigue siendo el orquestador físico del frame durante la transición
 * do-not: NO crear otro render loop, NO decidir gameplay, NO mutar física
 */
(function(root){
  'use strict';
  if(root.KeloRender)return;
  const VERSION='kelo-render-extensions-v1.0.0';
  const hooks={beforeFrame:[],afterFrame:[]};
  let sequence=1;
  function add(phase,owner,fn,priority){
    if(typeof fn!=='function')throw new TypeError('render hook must be a function');
    const entry={id:'render-hook-'+sequence++,owner:String(owner||'anonymous'),fn:fn,priority:Number(priority)||0};
    hooks[phase].push(entry);
    hooks[phase].sort(function(a,b){return a.priority-b.priority||a.id.localeCompare(b.id);});
    return entry.id;
  }
  function unregister(id){
    let removed=false;
    ['beforeFrame','afterFrame'].forEach(function(phase){
      const i=hooks[phase].findIndex(function(h){return h.id===id;});
      if(i>=0){hooks[phase].splice(i,1);removed=true;}
    });
    return removed;
  }
  function runPhase(phase,ctx){
    const list=(hooks[phase]||[]).slice();
    for(let i=0;i<list.length;i++)list[i].fn(ctx);
  }
  function publicList(phase){return Object.freeze(hooks[phase].map(function(h){return Object.freeze({id:h.id,owner:h.owner,priority:h.priority});}));}
  function snapshot(){return Object.freeze({version:VERSION,beforeFrame:publicList('beforeFrame'),afterFrame:publicList('afterFrame')});}
  root.KeloRender=Object.freeze({
    version:VERSION,
    beforeFrame:function(owner,fn,priority){return add('beforeFrame',owner,fn,priority);},
    afterFrame:function(owner,fn,priority){return add('afterFrame',owner,fn,priority);},
    unregister:unregister,
    snapshot:snapshot,
    _runPhase:runPhase
  });
  root.KELO_RENDER_EXTENSION_AUDIT=Object.freeze({version:VERSION,registryOnly:true,wrapsRender:false,beforeAfterFrame:true,timers:0,gameplayAuthority:false});
})(typeof globalThis!=='undefined'?globalThis:window);
