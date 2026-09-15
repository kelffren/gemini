/* KELO-INDEX
 * area: CORE / BOOT
 * owner: KeloModuleLoader
 * keys: DYNAMIC LOAD IDLE FIRST-USE CACHE VERSION PING MOBILE SAFARI
 * purpose: un solo hilo de descarga. Plaza ya está viva; el resto entra solo al tocar un tool del menú. Pausa si el player camina.
 * public-api: KELO_MODULE_LOADER.start/ensure/needs/isReady
 * do-not: NO tileset 556KB, NO studio, NO supabase, NO segundo gameLoop, NO SW
 */
(function(root){
'use strict';
if(root.KELO_MODULE_LOADER)return;
const VERSION='kelo-module-loader-v7-first-use-owners';
const FEATURES={
  social:[
    {src:'src/ui/player-nameplate.js?v=2',name:'placas'},
    {src:'src/systems/nobility.js?v=4',name:'títulos'},
    {src:'src/environment/plaza-depth.js?v=219',name:'plaza'},
    {src:'src/ui/profile-panel-close.js?v=4.1',name:'perfil'},
    {src:'src/ui/self-interaction-ui.js?v=1',name:'perfil'}
  ],
  world:[
    {src:'engine-m.js?v=94',name:'mundo'},
    {src:'engine-n.js?v=230',name:'mundo'},
    {src:'engine-o.js?v=96',name:'mundo'},
    {src:'engine-p.js?v=96',name:'mundo'},
    {src:'engine-q.js?v=94',name:'mundo'},
    {src:'engine-s.js?v=96',name:'mundo'},
    {src:'engine-ah.js?v=95',name:'mundo'},
    {src:'engine-ai.js?v=95',name:'mundo'},
    {src:'src/systems/illumination.js?v=2',name:'luz'}
  ],
  bag:[
    {src:'src/systems/backpack-system.js?v=2',name:'mochila'},
    {src:'src/ui/backpack-ui.js?v=4',name:'mochila'}
  ],
  mounts:[
    {src:'src/mounts/mount-catalog.js?v=2',name:'monturas'},
    {src:'src/mounts/mount-system.js?v=2',name:'monturas'},
    {src:'src/ui/mount-panel.js?v=2',name:'monturas'}
  ],
  market:[
    {src:'src/systems/market-escrow-system.js?v=1',name:'mercado'},
    {src:'src/ui/market-ui.js?v=2',name:'mercado'}
  ],
  titles:[
    {src:'src/systems/title-catalog.js?v=1',name:'títulos'},
    {src:'src/systems/player-stats.js?v=1',name:'títulos'},
    {src:'src/systems/title-system.js?v=1',name:'títulos'}
  ],
  appearance:[
    {src:'src/ui/profile-panel-close.js?v=4.1',name:'apariencia'}
  ],
  abilities:[
    {src:'src/abilities/abilityData.js?v=2',name:'habilidades'},
    {src:'src/abilities/stone-system.js?v=2',name:'habilidades'},
    {src:'src/abilities/kelo-ability-boot.js?v=2',name:'habilidades'}
  ],
  pvp:[
    {src:'src/systems/pvp-world.js?v=2',name:'PvP'},
    {src:'src/systems/pvp-combat-runtime-loader.js?v=4',name:'PvP'}
  ],
  properties:[
    {src:'src/property/property-system.js?v=4',name:'propiedades'},
    {src:'src/ui/house-instance-ui.js?v=1',name:'propiedades'}
  ]
};
const loaded=Object.create(null);
const inflight=Object.create(null);
let build='V6.64';
let shown=false;
function busy(){
  try{
    if(typeof input!=='undefined'&&input&&(Math.abs(input.normX)>0.02||Math.abs(input.normY)>0.02||input.active)) return true;
  }catch(_){}
  return false;
}
function box(){return document.getElementById('kelo-module-loader');}
function textEl(){return document.getElementById('kelo-ml-text');}
function barEl(){return document.getElementById('kelo-ml-bar');}
function show(msg,pct){
  const el=box(); if(!el)return;
  el.hidden=false; shown=true;
  const t=textEl(); if(t) t.textContent=msg;
  const b=barEl(); if(b) b.style.width=Math.max(0,Math.min(100,pct||0))+'%';
}
function hideChip(msg){
  const el=box(); if(!el)return;
  if(shown){ show(msg||'Listo',100); setTimeout(function(){ el.hidden=true; },800); }
  else el.hidden=true;
}
function hasScript(src){
  const base=src.split('?')[0];
  return Array.from(document.scripts).some(function(s){return (s.getAttribute('src')||'').split('?')[0]===base;});
}
function loadOne(item){
  return new Promise(function(resolve,reject){
    if(hasScript(item.src)){ resolve(0); return; }
    const t0=performance.now();
    const s=document.createElement('script');
    s.src=item.src;
    s.onload=function(){resolve(performance.now()-t0);};
    s.onerror=function(){reject(new Error('KELO_MODULE_LOAD_FAILED:'+item.src));};
    document.head.appendChild(s);
  });
}
function loadFeature(name,opts){
  const files=FEATURES[name];
  if(!files) return Promise.resolve(true);
  if(loaded[name]) return Promise.resolve(true);
  if(inflight[name]) return inflight[name];
  const interactive=!!(opts&&opts.interactive);
  inflight[name]=new Promise(function(resolve,reject){
    let i=0;
    function step(){
      if(i>=files.length){
        loaded[name]=true; delete inflight[name];
        try{ localStorage.setItem('kelo_modpack_'+name, build); }catch(_){}
        resolve(true); return;
      }
      if(!interactive&&busy()){
        if(shown) show('En pausa · caminando', (i/files.length)*100);
        setTimeout(step,450); return;
      }
      const item=files[i];
      loadOne(item).then(function(dt){
        if(dt>=50) show('Descargando '+item.name+'  '+(i+1)+'/'+files.length, ((i+1)/files.length)*100);
        i+=1;
        setTimeout(step, dt<50?40:120);
      }).catch(function(error){delete inflight[name];reject(error);});
    }
    step();
  });
  return inflight[name];
}
function ensureRuntime(){
  if(root.KeloRuntimeBootstrap&&typeof root.KeloRuntimeBootstrap.ensure==='function') return root.KeloRuntimeBootstrap.ensure();
  return Promise.reject(new Error('KELO_RUNTIME_BOOTSTRAP_MISSING'));
}
function ensureFeature(name){
  show('Cargando '+name+'…',8);
  return loadFeature(name,{interactive:true});
}
async function ensureAbilities(wake){
  await ensureRuntime();
  await ensureFeature('abilities');
  if(!root.KeloAbilitiesLoader) throw new Error('KELO_ABILITIES_LOADER_MISSING');
  if(wake&&typeof root.KeloAbilitiesLoader.load==='function') await root.KeloAbilitiesLoader.load();
  return true;
}
async function ensurePvp(){
  show('Cargando PvP…',8);
  await ensureAbilities(false);
  await ensureFeature('pvp');
  if(!root.KeloPvPWorld||typeof root.enterPvPWorld!=='function'||!root.KELO_PVP_COMBAT_LOADER_AUDIT?.ready) throw new Error('KELO_PVP_OWNER_MISSING');
  return true;
}
function ensure(name){
  if(name==='chat'||name==='profile') return Promise.resolve(true);
  if(name==='nobility'||name==='emotes') name='social';
  let task;
  if(name==='pvp') task=ensurePvp();
  else if(name==='abilities') task=ensureAbilities(true);
  else if(!FEATURES[name]) return Promise.resolve(true);
  else task=ensureFeature(name);
  return Promise.resolve(task).then(function(ok){hideChip('Listo');return ok;}).catch(function(error){hideChip('Error');throw error;});
}
function needs(name){
  if(name==='chat'||name==='profile') return false;
  if(name==='nobility'||name==='emotes') name='social';
  if(name==='pvp') return !(root.KeloPvPWorld&&typeof root.enterPvPWorld==='function'&&root.KELO_PVP_COMBAT_LOADER_AUDIT?.ready);
  if(name==='abilities') return !(root.KeloAbilitiesLoader&&root.KeloAbilities);
  if(name==='appearance') return !(root.KeloCharacterCustomizer&&root.KELO_PROFILE_LAUNCHER);
  if(!FEATURES[name]) return false;
  return !loaded[name];
}
function start(opts){
  if(opts&&opts.build) build=String(opts.build);
  const el=box(); if(el) el.hidden=true;
  // First-use only. Compiling extra JS while gameLoop runs freezes Safari.
}
root.KELO_MODULE_LOADER=Object.freeze({version:VERSION,start,ensure,needs,isReady:function(n){return !!loaded[n];},features:Object.keys(FEATURES)});
})(typeof globalThis!=='undefined'?globalThis:window);