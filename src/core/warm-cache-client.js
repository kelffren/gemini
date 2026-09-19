/* KELO-INDEX
 * area: CORE / MOBILE BOOT
 * owner: warm-cache-client
 * purpose: warm the next launch after first playable frame without competing with initial 4G/5G boot
 */
(function(){
  'use strict';
  if(!('serviceWorker' in navigator)) return;

  var CORE=[
    'index.html',
    'src/ui/responsive-foundation.css?v=1',
    'src/core/events/event-bus.js?v=1',
    'src/core/input-lock-system.js?v=1',
    'src/core/movement-profile.js?v=1',
    'src/core/kelo-runtime-bootstrap.js?v=3-player-vitals',
    'src/physics/collision-utils.js?v=2',
    'engine-a.js?v=151',
    'src/core/player-state-system.js?v=1',
    'src/core/player-position-system.js?v=1-transition-owner',
    'src/core/input-system.js?v=2-zero-copy',
    'src/core/movement-system.js?v=3-zero-garbage',
    'engine-b.js?v=95-boot-ready',
    'engine-c.js?v=232-position-owner',
    'src/core/camera-follow-shadow.js?v=1',
    'src/core/camera-system.js?v=1',
    'src/core/viewport-system.js?v=1',
    'src/core/avatar-render-system.js?v=2-base-zoo-authority'
  ];
  var PLAZA=[
    'src/core/render-extension-system.js?v=4-render-owner',
    'src/core/simulation-extension-system.js?v=4-sim-owner',
    'engine-d.js?v=95','engine-e.js?v=94','engine-f.js?v=95','engine-g.js?v=96',
    'src/environment/mobile-performance-contract.js?v=2-cache-working-set',
    'engine-h.js?v=151','engine-i.js?v=95-minimap-off-20260916','engine-j.js?v=94','engine-k.js?v=94',
    'src/environment/rural-nature-atlas.js?v=200',
    'src/environment/gardens-atlas.js?v=2',
    'src/environment/tile-registry.js?v=237',
    'src/environment/atlas-contract.js?v=4',
    'src/environment/world-map.js?v=terrain-191',
    'src/environment/environment-layer-stack.js?v=5-dirty-audit',
    'src/environment/surface-ground.js?v=1',
    'src/environment/prop-contract.js?v=7-map-probe',
    'src/environment/generic-props.js?v=9',
    'engine-l.js?v=223',
    'src/ui/luxe-shell.js?v=231',
    'src/ui/mobile-orientation.js?v=6',
    'src/ui/luxe-player-hud.js?v=5-minimap-off-20260916',
    'src/systems/performance-governor.js?v=6'
  ];

  function profile(){
    var c=navigator.connection||navigator.mozConnection||navigator.webkitConnection;
    if(c&&c.saveData) return 'save';
    var type=c&&String(c.effectiveType||'').toLowerCase();
    if(type==='slow-2g'||type==='2g') return 'slow';
    if(type==='3g') return 'medium';
    return 'fast';
  }
  function post(urls){
    navigator.serviceWorker.ready.then(function(reg){
      var worker=reg.active||navigator.serviceWorker.controller;
      if(worker) worker.postMessage({type:'KELO_WARM_CACHE',urls:urls});
    }).catch(function(){});
  }
  function warm(){
    var p=profile();
    if(p==='save'||p==='slow') return;
    post(CORE);
    if(p==='fast') setTimeout(function(){post(PLAZA);},3500);
  }
  function schedule(){
    if('requestIdleCallback' in window) requestIdleCallback(warm,{timeout:4500});
    else setTimeout(warm,2200);
  }

  navigator.serviceWorker.register('./sw.js').then(function(){ schedule(); }).catch(function(){});
})();