/* KELO-INDEX
 * area: CORE / AVATAR
 * owner: KeloAvatar
 * keys: AVATAR RENDER BASE MIDDLEWARE FALLBACK FOUNDATION
 * purpose: owner único de la composición renderAvatar durante la migración Foundation
 * public-api: KeloAvatar.setBase/use/unregister/snapshot
 * consumes: renderAvatar vigente de engine-c como base inicial
 * state-owned: renderer base actual + middleware ordenado
 * extension-points: setBase para reemplazos históricos; use para fallbacks/overrides condicionales
 * reuse: renderer hero, apariencias y futuras capas de composición de actor
 * legacy: engine-c mantiene el primer renderer físico mientras migran consumidores
 * do-not: NO envolver renderAvatar fuera de este archivo; NO decidir gameplay
 */
(function(root){
  'use strict';
  if(root.KeloAvatar)return;
  const VERSION='kelo-avatar-render-v1.0.0';
  if(typeof renderAvatar!=='function'){
    root.KELO_AVATAR_RENDER_AUDIT=Object.freeze({version:VERSION,installed:false,reason:'renderAvatar-missing'});
    return;
  }

  let baseRenderer=renderAvatar;
  let baseOwner='engine-c:legacy-base';
  let baseRevision=0;
  let sequence=1;
  const middleware=[];

  function normalizeOwner(owner){return String(owner||'anonymous');}

  function setBase(owner,fn){
    if(typeof fn!=='function')throw new TypeError('avatar base renderer must be a function');
    baseRenderer=fn;
    baseOwner=normalizeOwner(owner);
    baseRevision+=1;
    return baseRevision;
  }

  function use(owner,fn,priority){
    if(typeof fn!=='function')throw new TypeError('avatar middleware must be a function');
    const entry={id:'avatar-mw-'+sequence++,owner:normalizeOwner(owner),fn:fn,priority:Number(priority)||0};
    middleware.push(entry);
    // Mayor prioridad = capa más externa, reproduciendo el orden histórico de wrappers tardíos.
    middleware.sort(function(a,b){return b.priority-a.priority||a.id.localeCompare(b.id);});
    return entry.id;
  }

  function unregister(id){
    const i=middleware.findIndex(function(entry){return entry.id===id;});
    if(i<0)return false;
    middleware.splice(i,1);
    return true;
  }

  function dispatch(index,actor,isSelf){
    if(index>=middleware.length)return baseRenderer(actor,isSelf);
    const entry=middleware[index];
    let called=false;
    let result;
    function next(nextActor,nextIsSelf){
      if(called)return result;
      called=true;
      result=dispatch(
        index+1,
        nextActor===undefined?actor:nextActor,
        nextIsSelf===undefined?isSelf:!!nextIsSelf
      );
      return result;
    }
    return entry.fn(actor,isSelf,next,Object.freeze({owner:entry.owner,priority:entry.priority,baseOwner:baseOwner}));
  }

  function snapshot(){
    return Object.freeze({
      version:VERSION,
      baseOwner:baseOwner,
      baseRevision:baseRevision,
      middleware:Object.freeze(middleware.map(function(entry){
        return Object.freeze({id:entry.id,owner:entry.owner,priority:entry.priority});
      }))
    });
  }

  // FOUNDATION-ALLOW: único wrapper autorizado de renderAvatar después de engine-c.
  renderAvatar=function(actor,isSelf){
    return dispatch(0,actor,!!isSelf);
  };

  root.KeloAvatar=Object.freeze({
    version:VERSION,
    setBase:setBase,
    use:use,
    unregister:unregister,
    snapshot:snapshot
  });
  root.KELO_AVATAR_RENDER_AUDIT=Object.freeze({
    version:VERSION,
    installed:true,
    singleLegacyWrapper:true,
    baseReplacement:true,
    middlewareFallback:true,
    middlewareOrder:'priority-desc',
    gameplayAuthority:false,
    legacyTarget:'renderAvatar'
  });
})(typeof globalThis!=='undefined'?globalThis:window);
