/* KELO-INDEX
 * area: CORE / AUTH / UI
 * owner: KeloGameTuning
 * keys: ADMIN TUNING CAMERA SPRITE SCALE PREVIEW DRAFT PUBLISH UPDATE AUTHORITY
 * purpose: mantiene configuración visual global versionada, aplica preview por APIs owner y solicita publicación autoritativa sin escribir gameplay desde UI
 * public-api: KeloGameTuning.loadPublished/preview/saveDraft/discard/publish/getState/schema
 * consumes: KeloCamera, KeloAvatar, KeloNetAuthority, KeloUpdater y game-tuning.json
 * state-owned: configuración publicada/draft/preview de presentación; no posee cámara/avatar internals ni gameplay
 * extension-points: schema declarativo + authority publish; nuevos campos deben mapear a APIs públicas de sus owners
 * reuse: panel admin y futuros presets de presentación
 * legacy: N/A
 * do-not: NO escribir CONFIG.zoom/camera/avatar internals directos; NO guardar secretos; NO tratar localStorage como autoridad de producción
 */
(function(root){
  'use strict';
  if(root.KeloGameTuning)return;

  const VERSION='kelo-game-tuning-v1.0.0';
  const SCHEMA_VERSION=1;
  const DRAFT_KEY='kelo.game.tuning.draft.v1';
  const CONFIG_URL=new URL('game-tuning.json',document.baseURI);
  const listeners=new Set();

  const FIELD_SCHEMA=Object.freeze({
    camera:Object.freeze({
      baseZoom:Object.freeze({min:.45,max:1.5,step:.01,label:'Profundidad / zoom'}),
      dampX:Object.freeze({min:.25,max:30,step:.05,label:'Suavidad horizontal'}),
      dampY:Object.freeze({min:.25,max:30,step:.05,label:'Suavidad vertical'}),
      deadXRatio:Object.freeze({min:0,max:.8,step:.01,label:'Zona muerta horizontal'}),
      deadYRatio:Object.freeze({min:0,max:.8,step:.01,label:'Zona muerta vertical'}),
      lookAheadDist:Object.freeze({min:0,max:500,step:1,label:'Anticipación de cámara'}),
      lookAheadDecay:Object.freeze({min:.1,max:30,step:.1,label:'Retorno de anticipación'}),
      dprCap:Object.freeze({min:1,max:3,step:.25,label:'Calidad / DPR máximo'})
    }),
    sprites:Object.freeze({
      localPlayerScale:Object.freeze({min:.5,max:2.5,step:.05,label:'Tamaño de tu sprite'}),
      remotePlayerScale:Object.freeze({min:.5,max:2.5,step:.05,label:'Tamaño de otros jugadores'})
    })
  });

  let published=null;
  let draft=null;
  let previewActive=false;
  let status='booting';
  let lastError=null;

  function clone(value){return JSON.parse(JSON.stringify(value));}
  function finite(value){const n=Number(value);return Number.isFinite(n)?n:null;}
  function clamp(value,min,max){return Math.max(min,Math.min(max,value));}
  function safeReadDraft(){try{const raw=localStorage.getItem(DRAFT_KEY);return raw?JSON.parse(raw):null;}catch(_){return null;}}
  function safeWriteDraft(value){try{if(value)localStorage.setItem(DRAFT_KEY,JSON.stringify(value));else localStorage.removeItem(DRAFT_KEY);}catch(_){}}
  function emit(reason,extra){const detail=Object.assign({reason,state:getState()},extra||{});listeners.forEach(fn=>{try{fn(detail);}catch(_){}});try{root.dispatchEvent(new CustomEvent('kelo:game-tuning:'+reason,{detail}));}catch(_){}}

  function ownerDefaults(){
    const camera=root.KeloCamera?.snapshot?.()||{};
    const follow=root.KeloCamera?.getFollowTuning?.()||camera.follow||{};
    const avatar=root.KeloAvatar?.getPresentationTuning?.()||{};
    return {
      schema:SCHEMA_VERSION,
      revision:0,
      publishedAt:null,
      publishedBy:'runtime-defaults',
      camera:{
        baseZoom:finite(camera.baseZoom)??.82,
        dampX:finite(follow.dampX),
        dampY:finite(follow.dampY),
        deadXRatio:finite(follow.deadXRatio),
        deadYRatio:finite(follow.deadYRatio),
        lookAheadDist:finite(follow.lookAheadDist),
        lookAheadDecay:finite(follow.lookAheadDecay),
        dprCap:finite(camera.dprCap)??3
      },
      sprites:{
        localPlayerScale:finite(avatar.localScale)??1,
        remotePlayerScale:finite(avatar.remoteScale)??1
      }
    };
  }

  function sanitize(raw,base){
    const source=raw&&typeof raw==='object'?raw:{};
    const fallback=base&&typeof base==='object'?base:ownerDefaults();
    const out={
      schema:SCHEMA_VERSION,
      revision:Math.max(0,Math.floor(finite(source.revision)??finite(fallback.revision)??0)),
      publishedAt:source.publishedAt==null?(fallback.publishedAt||null):String(source.publishedAt).slice(0,80),
      publishedBy:source.publishedBy==null?(fallback.publishedBy||null):String(source.publishedBy).slice(0,120),
      camera:{},sprites:{}
    };
    for(const group of ['camera','sprites']){
      for(const [key,def] of Object.entries(FIELD_SCHEMA[group])){
        const candidate=finite(source[group]?.[key]);
        const inherited=finite(fallback[group]?.[key]);
        out[group][key]=candidate==null?(inherited==null?null:clamp(inherited,def.min,def.max)):clamp(candidate,def.min,def.max);
      }
    }
    return out;
  }

  function apply(config,source){
    const value=sanitize(config,published||ownerDefaults());
    const camera=value.camera;
    if(root.KeloCamera){
      if(finite(camera.baseZoom)!=null)root.KeloCamera.setBaseZoom(camera.baseZoom,source||'game-tuning');
      const follow={};
      ['dampX','dampY','deadXRatio','deadYRatio','lookAheadDist','lookAheadDecay'].forEach(key=>{if(finite(camera[key])!=null)follow[key]=camera[key];});
      if(Object.keys(follow).length)root.KeloCamera.setFollowTuning(follow);
      if(finite(camera.dprCap)!=null){root.KeloCamera.configureViewport({dprCap:camera.dprCap});root.KeloCamera.scheduleViewportSync(source||'game-tuning');}
    }
    if(root.KeloAvatar?.setPresentationTuning)root.KeloAvatar.setPresentationTuning({localScale:value.sprites.localPlayerScale,remoteScale:value.sprites.remotePlayerScale},source||'game-tuning');
    return value;
  }

  function getState(){
    return Object.freeze({
      version:VERSION,
      status,
      previewActive,
      published:published?clone(published):null,
      draft:draft?clone(draft):null,
      effective:clone(previewActive&&draft?draft:(published||ownerDefaults())),
      lastError
    });
  }

  function setDraft(next,options){
    const opts=options||{};
    draft=sanitize(next,published||ownerDefaults());
    if(opts.persist)safeWriteDraft(draft);
    return draft;
  }

  function preview(next){
    const nextDraft=setDraft(next||draft||published||ownerDefaults(),{persist:false});
    previewActive=true;
    status='preview';
    apply(nextDraft,'game-tuning-preview');
    emit('preview');
    return getState();
  }

  function saveDraft(next){
    if(next)setDraft(next,{persist:false});
    if(!draft)draft=sanitize(published||ownerDefaults(),published||ownerDefaults());
    safeWriteDraft(draft);
    emit('draft-saved');
    return getState();
  }

  function discard(){
    previewActive=false;
    draft=null;
    safeWriteDraft(null);
    apply(published||ownerDefaults(),'game-tuning-discard');
    status=published?'ready':'local-defaults';
    emit('discarded');
    return getState();
  }

  async function loadPublished(options){
    const opts=options||{};
    status='loading';lastError=null;emit('loading');
    try{
      let value=null;
      if(opts.authority!==false&&root.KeloNetAuthority?.isOnline?.()&&root.KeloNetAuthority.getGameTuning){
        try{value=await root.KeloNetAuthority.getGameTuning();}catch(_){value=null;}
      }
      if(!value){
        const url=new URL(CONFIG_URL.href);url.searchParams.set('_kelo_tuning',Date.now().toString(36));
        const res=await fetch(url.href,{cache:'no-store',credentials:'same-origin'});
        if(!res.ok)throw new Error('GAME_TUNING_HTTP_'+res.status);
        value=await res.json();
      }
      published=sanitize(value,ownerDefaults());
      const saved=safeReadDraft();
      draft=saved?sanitize(saved,published):clone(published);
      previewActive=false;
      apply(published,'game-tuning-published');
      status='ready';
      emit('loaded');
    }catch(error){
      published=sanitize(ownerDefaults(),ownerDefaults());
      draft=sanitize(safeReadDraft()||published,published);
      previewActive=false;
      apply(published,'game-tuning-fallback');
      status='local-defaults';lastError=String(error&&error.message||error);emit('error');
    }
    return getState();
  }

  async function publish(next){
    if(next)setDraft(next,{persist:false});
    if(!draft)draft=sanitize(published||ownerDefaults(),published||ownerDefaults());
    if(!root.KeloNetAuthority?.publishGameTuning)throw new Error('GAME_TUNING_AUTHORITY_UNAVAILABLE');
    status='publishing';lastError=null;emit('publishing');
    try{
      const result=await root.KeloNetAuthority.publishGameTuning(draft);
      published=sanitize(result?.config||draft,published||ownerDefaults());
      draft=clone(published);previewActive=false;safeWriteDraft(null);
      apply(published,'game-tuning-publish-confirmed');
      status='published';emit('published',{result});
      try{root.KeloUpdater?.check?.({force:true});}catch(_){ }
      return Object.freeze({state:getState(),result});
    }catch(error){
      status='preview';previewActive=true;lastError=String(error&&error.message||error);emit('publish-error');throw error;
    }
  }

  root.KeloGameTuning=Object.freeze({
    version:VERSION,
    schema:FIELD_SCHEMA,
    loadPublished,
    preview,
    saveDraft,
    discard,
    publish,
    getState,
    onChange(fn){if(typeof fn!=='function')return()=>{};listeners.add(fn);return()=>listeners.delete(fn);}
  });
  root.KELO_GAME_TUNING_AUDIT=Object.freeze({version:VERSION,owner:'KeloGameTuning',ownerApisOnly:true,preview:true,draft:true,serverPublishBoundary:true,clientSecrets:false,updateBridge:true});

  loadPublished({authority:false}).catch(()=>{});
})(typeof globalThis!=='undefined'?globalThis:window);
