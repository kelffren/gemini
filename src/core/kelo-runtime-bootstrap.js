/* KELO-INDEX
 * area: CORE
 * owner: KeloRuntimeBootstrap
 * keys: BOOTSTRAP MODULE ORDER COMBAT EFFECTS STATUS MELEE ABILITY TIMELINE PVP PREDICTION LAZY FIRST-USE PERFORMANCE PWA
 * purpose: expone un único loader idempotente para foundations Combat/Effects/Status/Melee y soporte compartido de prediction; los módulos pesados cargan solo bajo `ensure()` y se revalidan contra el build LIVE de una PWA instalada.
 * public-api: KeloRuntimeBootstrap.ensure/isReady/modules
 * state-owned: progreso/promesa efímera del late boot
 * online: carga contratos compartidos y soporte cliente sin asumir autoridad
 * extension-points: features llaman ensure(); no crean loaders paralelos
 * do-not: NO gameplay específico, NO auto-load de módulos al evaluar, NO segundo loop, NO polling
 */
(function(root){
  'use strict';
  const VERSION='kelo-runtime-bootstrap-v1.6.0-pwa-live';
  const MODULES=Object.freeze([
    'src/core/events/event-bus.js?v=1',
    'src/abilities/ability-action-timeline.js?v=1',
    'src/systems/combat/combat-schema.js?v=2',
    'src/systems/combat/hit-resolver.js?v=2',
    'src/systems/combat/damage-resolver.js?v=3-player-vitals',
    'src/systems/effects/effect-schema.js?v=2',
    'src/systems/effects/status-engine.js?v=1',
    'src/systems/effects/effect-engine.js?v=2',
    'src/systems/combat/combat-engine.js?v=2',
    'src/systems/melee/melee-schema.js?v=3',
    'src/systems/melee/melee-weapon-profiles.js?v=3',
    'src/systems/melee/melee-engine.js?v=3',
    'src/visuals/combat-presentation-bridge.js?v=2',
    'src/systems/pvp-ability-movement-prediction.js?v=1',
    'src/systems/pvp-visual-competitive-pass.js?v=1'
  ]);
  const audit=root.KELO_RUNTIME_BOOTSTRAP_AUDIT={version:VERSION,ready:false,loading:false,loaded:0,total:MODULES.length,failed:[],requestedAt:0,readyAt:0,liveBuild:null};
  let promise=null;
  function base(src){try{return new URL(String(src||''),document.baseURI).pathname;}catch(_){return String(src||'').split('?')[0];}}
  function liveToken(){return String(root.KeloPWAFreshness?.build||'').slice(0,16);}
  function isStaticFoundation(src){return /\/src\/core\/events\/event-bus\.js$/.test(base(src));}
  function exists(src){
    const target=base(src),token=liveToken(),strict=!!token&&!isStaticFoundation(src);
    return Array.from(document.scripts).some(function(s){return base(s.getAttribute('src'))===target&&(!strict||s.dataset.keloLiveBuild===token);});
  }
  async function freshUrl(src){
    try{if(root.KeloPWAFreshness?.url)return await root.KeloPWAFreshness.url(src);}catch(_){}
    return src;
  }
  function load(index,resolve,reject){
    if(index>=MODULES.length){
      audit.loading=false;
      if(audit.failed.length){promise=null;reject(new Error('KELO_RUNTIME_FOUNDATION_LOAD_FAILED:'+audit.failed.join(',')));return;}
      audit.ready=true;audit.readyAt=Date.now();audit.liveBuild=liveToken()||audit.liveBuild||null;
      try{root.dispatchEvent(new CustomEvent('kelo:runtime-foundations-ready',{detail:{liveBuild:audit.liveBuild}}));}catch(_){}
      resolve(true);return;
    }
    const src=MODULES[index];
    if(exists(src)){audit.loaded+=1;load(index+1,resolve,reject);return;}
    freshUrl(src).then(function(resolvedSrc){
      const script=document.createElement('script');script.src=resolvedSrc;script.async=false;script.dataset.keloRuntimeFoundation='1';
      const token=liveToken();if(token)script.dataset.keloLiveBuild=token;
      script.onload=function(){audit.loaded+=1;load(index+1,resolve,reject);};
      script.onerror=function(){audit.failed.push(src);try{script.remove();}catch(_){}console.error('[Kelo runtime bootstrap] failed',src);load(index+1,resolve,reject);};
      document.body.appendChild(script);
    }).catch(function(error){audit.failed.push(src);console.error('[Kelo runtime bootstrap] fresh URL failed',src,error);load(index+1,resolve,reject);});
  }
  function ensure(){
    const token=liveToken();
    if(audit.ready&&(!token||audit.liveBuild===token))return Promise.resolve(true);
    if(audit.ready&&token&&audit.liveBuild!==token){audit.ready=false;promise=null;audit.loaded=0;audit.failed.length=0;}
    if(promise)return promise;
    audit.loading=true;audit.requestedAt=Date.now();audit.failed.length=0;audit.loaded=0;
    promise=new Promise(function(resolve,reject){load(0,resolve,reject);});
    return promise;
  }
  root.KeloRuntimeBootstrap=Object.freeze({version:VERSION,modules:MODULES.slice(),ensure,isReady:function(){const token=liveToken();return audit.ready===true&&(!token||audit.liveBuild===token);}});
})(typeof globalThis!=='undefined'?globalThis:window);
