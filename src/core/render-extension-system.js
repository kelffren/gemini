/* KELO-INDEX
 * area: CORE / RENDER
 * owner: KeloRender
 * keys: RENDER HOOK BEFORE FRAME AFTER FRAME EXTENSION FOUNDATION
 * purpose: único bridge de extensión alrededor del render orquestado por engine-c mientras el core legacy siga global
 * public-api: KeloRender.beforeFrame/afterFrame/unregister/snapshot
 * consumes: render legacy final de engine-c
 * state-owned: registro ordenado de extensiones render
 * extension-points: beforeFrame/afterFrame con prioridad explícita
 * reuse: minimapa, overlays, indicadores, compatibilidad visual y preparación de contexto
 * legacy: bridge temporal; engine-c sigue siendo el orquestador físico del frame
 * do-not: NO crear otro render loop, NO decidir gameplay, NO mutar física
 */
(function(root){
  'use strict';
  if(root.KeloRender)return;
  const VERSION='kelo-render-extensions-v1.1.0';
  if(typeof render!=='function'){
    root.KELO_RENDER_EXTENSION_AUDIT=Object.freeze({version:VERSION,installed:false,reason:'render-missing'});
    return;
  }
  const originalRender=render;
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

  // FOUNDATION-ALLOW: único bridge autorizado alrededor del render final de engine-c.
  render=function(){
    const context={ctx:typeof ctx!=='undefined'?ctx:null,screenW:typeof screenW!=='undefined'?screenW:0,screenH:typeof screenH!=='undefined'?screenH:0,camera:typeof camera!=='undefined'?camera:null,config:typeof CONFIG!=='undefined'?CONFIG:null};
    runPhase('beforeFrame',context);
    const out=originalRender.apply(this,arguments);
    runPhase('afterFrame',context);
    return out;
  };

  root.KeloRender=Object.freeze({
    version:VERSION,
    beforeFrame:function(owner,fn,priority){return add('beforeFrame',owner,fn,priority);},
    afterFrame:function(owner,fn,priority){return add('afterFrame',owner,fn,priority);},
    unregister:unregister,
    snapshot:snapshot
  });
  root.KELO_RENDER_EXTENSION_AUDIT=Object.freeze({version:VERSION,installed:true,singleLegacyWrapper:true,beforeAfterFrame:true,timers:0,gameplayAuthority:false,legacyTarget:'render'});
})(typeof globalThis!=='undefined'?globalThis:window);
