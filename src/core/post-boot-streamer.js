/* KELO-INDEX
 * area: CORE / INSTANT BOOT
 * owner: post-boot-streamer
 * purpose: yield a real playable paint before loading non-critical owners; preserve legacy script order
 * do-not: never move gameplay-critical plaza/input/camera/render files into this list
 */
(function(root){
  'use strict';
  if(root.KELO_POST_BOOT_STREAMER)return;
  const VERSION='kelo-post-boot-streamer-v2-idle-aware';
  const FILES=[
    'src/core/feature-registry.js?v=5',
    'src/core/asset-registry.js?v=2-feature-registry',
    'src/core/module-loader.js?v=10-feature-registry',
    'src/ui/asset-library-launcher.js?v=11-semantic-context',
    'src/core/settings-lazy-gate.js?v=3-update-intel',
    'src/core/hot-data-registry.js?v=1-transactional',
    'src/abilities/ability-balance-hot-owner.js?v=1',
    'src/systems/equipment-market-hot-owner.js?v=1',
    'src/systems/arena-progression-hot-owner.js?v=1',
    'src/systems/liveops-world-content-hot-owner.js?v=1',
    'src/systems/liveops-interaction-runtime.js?v=1',
    'src/systems/liveops-npc-world-runtime.js?v=1',
    'src/core/update-gate.js?v=8-hot-data',
    'src/core/session-continuity-system.js?v=2-update-classes',
    'src/core/session-continuity-retry.js?v=1-event-driven',
    'src/systems/admin-key-system.js?v=1',
    'src/core/admin-control-lazy-gate.js?v=2',
    'src/core/account-live-control-gate.js?v=2',
    'src/core/creators-lazy-gate.js?v=8-ios-open-20260917'
  ];
  const audit=root.KELO_INSTANT_BOOT_AUDIT={version:VERSION,startedAt:0,firstYieldAt:0,loaded:0,total:FILES.length,ready:false,failed:[]};

  function load(src){
    return new Promise(function(resolve){
      const node=document.createElement('script');
      node.src=src; node.async=false; node.dataset.keloPostBoot='1';
      node.onload=function(){
        audit.loaded++;
        if(src.indexOf('module-loader.js')>=0&&root.KELO_MODULE_LOADER){
          try{root.KELO_MODULE_LOADER.start({build:'V6.69'});}catch(_){}
        }
        resolve(true);
      };
      node.onerror=function(){audit.failed.push(src);resolve(false);};
      document.body.appendChild(node);
    });
  }
  function playerBusy(){
    try{var i=root.input;return !!(i&&(i.active||i.touchActive||Math.abs(i.normX||0)>.02||Math.abs(i.normY||0)>.02));}catch(_){return false;}
  }
  function idleTurn(){
    return new Promise(function(resolve){
      if(document.hidden){setTimeout(resolve,700);return;}
      if(playerBusy()){setTimeout(resolve,220);return;}
      if('requestIdleCallback' in root){root.requestIdleCallback(function(){resolve();},{timeout:700});return;}
      setTimeout(resolve,32);
    });
  }
  function yieldFrame(){
    return new Promise(function(resolve){
      requestAnimationFrame(function(){requestAnimationFrame(resolve);});
    });
  }
  async function run(){
    if(audit.startedAt)return;
    audit.startedAt=performance.now();
    await yieldFrame();
    audit.firstYieldAt=performance.now();
    try{root.dispatchEvent(new CustomEvent('kelo:instant-boot-playable',{detail:{at:audit.firstYieldAt,version:VERSION}}));}catch(_){}
    for(let i=0;i<FILES.length;i++){
      await idleTurn();
      while(playerBusy()||document.hidden) await new Promise(function(resolve){setTimeout(resolve,document.hidden?700:180);});
      await load(FILES[i]);
      await yieldFrame();
    }
    audit.ready=true;
    try{root.dispatchEvent(new CustomEvent('kelo:post-boot-ready',{detail:{loaded:audit.loaded,failed:audit.failed.slice(),version:VERSION}}));}catch(_){}
  }
  root.KELO_POST_BOOT_STREAMER=Object.freeze({version:VERSION,audit:audit,start:run});
  if(root.__keloBootReady)run(); else root.addEventListener('kelo:boot-ready',run,{once:true});
})(typeof globalThis!=='undefined'?globalThis:window);