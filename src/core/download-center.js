/* KELO-INDEX
 * area: CORE / SETTINGS
 * owner: KeloDownloadCenter
 * keys: DOWNLOAD CENTER PRELOAD MODULE CACHE MOBILE SAFARI NO-FREEZE MANUAL
 * purpose: manual, one-file-at-a-time module byte preloading without executing modules in background
 * public-api: KeloDownloadCenter.open/preload/pause/resume/cancel/remove/getState/catalog
 * state-owned: preload queue + Cache Storage kelo-module-preload-v1; never gameplay state
 * do-not: NO auto preload, NO background JS execution, NO parallel downloads, NO second game loop
 */
(function(root){
'use strict';
if(root.KeloDownloadCenter)return;
const VERSION='kelo-download-center-v1.0.0-safe';
const CACHE_NAME='kelo-module-preload-v1';
const STEP_DELAY_MS=220;
const BUSY_RETRY_MS=700;
const FRAME_LIMIT_MS=28;
const FRAME_COOLDOWN_MS=1600;
const CATALOG=Object.freeze({
  social:{label:'Social',files:['src/ui/player-nameplate.js?v=2','src/systems/nobility.js?v=4','src/environment/plaza-depth.js?v=219','src/ui/profile-panel-close.js?v=2','src/ui/self-interaction-ui.js?v=1']},
  world:{label:'Mundo',files:['engine-m.js?v=94','engine-n.js?v=230','engine-o.js?v=96','engine-p.js?v=96','engine-q.js?v=94','engine-s.js?v=96','engine-ah.js?v=95','engine-ai.js?v=95','src/systems/illumination.js?v=2']},
  bag:{label:'Mochila',files:['src/systems/backpack-system.js?v=2','src/ui/backpack-ui.js?v=4']},
  mounts:{label:'Monturas',files:['src/mounts/mount-catalog.js?v=2','src/mounts/mount-system.js?v=2','src/ui/mount-panel.js?v=2']},
  market:{label:'Mercado',files:['src/systems/market-escrow-system.js?v=1','src/ui/market-ui.js?v=2']},
  titles:{label:'Títulos',files:['src/systems/title-catalog.js?v=1','src/systems/player-stats.js?v=1','src/systems/title-system.js?v=1']},
  appearance:{label:'Apariencia',files:['src/characters/character-customization.js?v=1','src/ui/character-customizer-ui.js?v=1']},
  properties:{label:'Propiedades',files:['src/property/property-system.js?v=4','src/ui/house-instance-ui.js?v=1']}
});
let queue=[];
let active=false;
let paused=false;
let cancelled=false;
let current=null;
let currentController=null;
let lastFrameCost=0;
let lastHeavyFrameAt=0;
let panel=null;
let panelLockToken=null;
const moduleState=Object.create(null);

function now(){return Date.now();}
function abs(src){return new URL(src,document.baseURI).href;}
function emit(type,detail){try{root.dispatchEvent(new CustomEvent('kelo:download-center:'+type,{detail:Object.assign({version:VERSION},detail||{})}));}catch(_){}}
function sleep(ms){return new Promise(function(r){root.setTimeout(r,Math.max(0,ms||0));});}
function moduleFiles(name){
  if(name==='pvp'&&root.KeloRuntimeBootstrap&&Array.isArray(root.KeloRuntimeBootstrap.modules))return root.KeloRuntimeBootstrap.modules.slice();
  return CATALOG[name]?CATALOG[name].files.slice():[];
}
function moduleLabel(name){if(name==='pvp')return 'Arena PVP';return CATALOG[name]?CATALOG[name].label:name;}
function moduleNames(){return Object.keys(CATALOG).concat(['pvp']);}
function gameplayBusy(){
  try{const u=root.KeloUpdater&&root.KeloUpdater.getState&&root.KeloUpdater.getState();if(u&&u.gameplayBusy)return true;}catch(_){}
  if(root.KELO_COMBAT_ENABLED===true)return true;
  try{if(root.KeloArena&&typeof root.KeloArena.isActive==='function'&&root.KeloArena.isActive())return true;}catch(_){}
  try{if(typeof input!=='undefined'&&input&&(Math.abs(input.normX)>0.02||Math.abs(input.normY)>0.02||input.active))return true;}catch(_){}
  try{const d=root.KELO_MODULE_LOADER&&root.KELO_MODULE_LOADER.diagnostics&&root.KELO_MODULE_LOADER.diagnostics();if(d&&Array.isArray(d.inflight)&&d.inflight.length)return true;}catch(_){}
  if(document.visibilityState!=='visible')return true;
  return false;
}
function frameHot(){return lastFrameCost>FRAME_LIMIT_MS&&(now()-lastHeavyFrameAt)<FRAME_COOLDOWN_MS;}
(function frameGuard(){
  let prev=performance.now();
  function tick(t){
    const dt=t-prev;prev=t;lastFrameCost=dt;
    if(dt>FRAME_LIMIT_MS)lastHeavyFrameAt=now();
    root.requestAnimationFrame(tick);
  }
  root.requestAnimationFrame(tick);
})();
function safeToWork(){return navigator.onLine!==false&&!paused&&!cancelled&&!gameplayBusy()&&!frameHot();}
async function cache(){if(!('caches'in root))throw new Error('cache_storage_unavailable');return caches.open(CACHE_NAME);}
async function isCached(src){try{return !!(await (await cache()).match(abs(src)));}catch(_){return false;}}
async function cachedCount(name){const files=moduleFiles(name);let count=0;for(let i=0;i<files.length;i++){if(await isCached(files[i]))count++;}return count;}
async function waitForSafeWindow(){while(!safeToWork()){if(cancelled)throw new Error('cancelled');await sleep(BUSY_RETRY_MS);}}
async function fetchOne(task){
  await waitForSafeWindow();
  if(await isCached(task.src))return {cached:true,bytes:0};
  currentController=new AbortController();
  const response=await fetch(abs(task.src),{cache:'force-cache',credentials:'same-origin',signal:currentController.signal,priority:'low'});
  if(!response.ok)throw new Error('http_'+response.status);
  const copy=response.clone();
  const bytes=(await response.arrayBuffer()).byteLength;
  await (await cache()).put(abs(task.src),copy);
  currentController=null;
  return {cached:false,bytes:bytes};
}
async function pump(){
  if(active)return;
  active=true;cancelled=false;render();
  try{
    while(queue.length){
      if(cancelled)break;
      const task=queue.shift();current=task;
      const s=moduleState[task.module]||(moduleState[task.module]={done:0,total:moduleFiles(task.module).length,bytes:0,status:'queued',error:null});
      s.status='downloading';render();emit('file-start',{module:task.module,src:task.src});
      try{
        const result=await fetchOne(task);
        s.done+=1;s.bytes+=result.bytes||0;s.error=null;
        emit('file-end',{module:task.module,src:task.src,cached:!!result.cached,bytes:result.bytes||0});
      }catch(error){
        if(cancelled||String(error&&error.name)==='AbortError')break;
        s.error=String(error&&error.message||error);s.status='error';emit('error',{module:task.module,src:task.src,error:s.error});
      }
      const pending=queue.some(function(q){return q.module===task.module;});
      if(!pending&&s.status!=='error')s.status='ready';
      current=null;render();
      await sleep(STEP_DELAY_MS);
    }
  }finally{
    current=null;currentController=null;active=false;
    if(cancelled){queue=[];cancelled=false;}
    render();emit('idle',{});
  }
}
async function preload(name){
  const files=moduleFiles(name);if(!files.length)return false;
  if(!moduleState[name])moduleState[name]={done:0,total:files.length,bytes:0,status:'queued',error:null};
  const already=new Set(queue.filter(function(q){return q.module===name;}).map(function(q){return q.src;}));
  for(let i=0;i<files.length;i++){if(!already.has(files[i])&&!(await isCached(files[i])))queue.push({module:name,src:files[i]});}
  const cached=await cachedCount(name);moduleState[name].done=cached;moduleState[name].total=files.length;moduleState[name].status=cached===files.length?'ready':'queued';
  emit('queued',{module:name,total:files.length,cached:cached});render();pump();return true;
}
function pause(){paused=true;if(currentController){try{currentController.abort();}catch(_){}}currentController=null;emit('paused',{});render();}
function resume(){paused=false;emit('resumed',{});render();pump();}
function cancel(){cancelled=true;paused=false;queue=[];if(currentController){try{currentController.abort();}catch(_){}}currentController=null;emit('cancelled',{});render();}
async function remove(name){
  const files=moduleFiles(name);try{const c=await cache();for(let i=0;i<files.length;i++)await c.delete(abs(files[i]));}catch(_){}
  delete moduleState[name];render();emit('removed',{module:name});return true;
}
function getState(){return Object.freeze({version:VERSION,active:active,paused:paused,current:current?Object.assign({},current):null,queued:queue.length,frameMs:Math.round(lastFrameCost),safe:!gameplayBusy()&&!frameHot(),modules:JSON.parse(JSON.stringify(moduleState))});}
function catalog(){const out={};moduleNames().forEach(function(name){out[name]={label:moduleLabel(name),files:moduleFiles(name)};});return Object.freeze(out);}
function acquireLock(){try{if(root.KeloInputLocks&&typeof root.KeloInputLocks.acquire==='function'&&!panelLockToken)panelLockToken=root.KeloInputLocks.acquire('download-center',{surface:'settings-download-center'});}catch(_){} }
function releaseLock(){try{if(panelLockToken&&root.KeloInputLocks&&typeof root.KeloInputLocks.release==='function')root.KeloInputLocks.release(panelLockToken);}catch(_){}panelLockToken=null;}
function ensureUI(){
  if(panel)return panel;
  const style=document.createElement('style');style.id='kelo-download-center-style';style.textContent=`
#kelo-download-center{position:fixed;inset:0;z-index:2147483550;display:none;align-items:flex-end;justify-content:center;background:rgba(0,0,0,.48);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#fff;pointer-events:auto}#kelo-download-center.open{display:flex}.kdc-sheet{width:min(100%,620px);max-height:88dvh;overflow:auto;border-radius:24px 24px 0 0;background:#0a1518;border:1px solid rgba(231,197,106,.42);padding:16px 14px max(18px,env(safe-area-inset-bottom));box-shadow:0 -20px 60px rgba(0,0,0,.45)}.kdc-head{display:flex;align-items:center;gap:10px;margin-bottom:10px}.kdc-head h2{flex:1;font:800 20px/1.1 Georgia,serif;color:#f0d27d}.kdc-head button,.kdc-actions button,.kdc-row button{min-height:42px;border-radius:12px;border:1px solid rgba(231,197,106,.38);background:#132529;color:#f2d57f;font-weight:800;padding:0 12px}.kdc-note{font-size:11px;line-height:1.35;color:#9fb1aa;margin:0 0 12px}.kdc-safety{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;font-size:10px}.kdc-pill{padding:6px 9px;border-radius:999px;background:#102024;border:1px solid rgba(255,255,255,.08)}.kdc-list{display:grid;gap:8px}.kdc-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center;padding:11px;border-radius:15px;background:#0e1d20;border:1px solid rgba(255,255,255,.07)}.kdc-row b{display:block;font-size:13px}.kdc-row small{display:block;color:#8fa39b;font-size:10px;margin-top:3px}.kdc-actions{display:flex;gap:8px;margin-top:12px;position:sticky;bottom:0;padding-top:10px;background:linear-gradient(transparent,#0a1518 28%)}.kdc-actions button{flex:1}.kdc-danger{color:#f1b1a8!important}`;document.head.appendChild(style);
  panel=document.createElement('div');panel.id='kelo-download-center';panel.innerHTML='<section class="kdc-sheet" role="dialog" aria-modal="true" aria-label="Centro de descargas"><div class="kdc-head"><h2>Centro de Descargas</h2><button type="button" data-kdc="close">×</button></div><p class="kdc-note">Precarga archivos sin ejecutar módulos. Una descarga a la vez; se pausa sola si caminas, entras en PVP o el frame se pone pesado.</p><div class="kdc-safety"><span class="kdc-pill" id="kdc-safe">Seguro</span><span class="kdc-pill" id="kdc-queue">Cola 0</span><span class="kdc-pill" id="kdc-frame">Frame --</span></div><div class="kdc-list" id="kdc-list"></div><div class="kdc-actions"><button type="button" data-kdc="pause">Pausar</button><button type="button" data-kdc="resume">Continuar</button><button type="button" class="kdc-danger" data-kdc="cancel">Cancelar cola</button></div></section>';
  document.body.appendChild(panel);
  panel.addEventListener('click',function(e){
    const action=e.target&&e.target.getAttribute&&e.target.getAttribute('data-kdc');if(!action)return;
    const mod=e.target.getAttribute('data-module');
    if(action==='close')close();else if(action==='pause')pause();else if(action==='resume')resume();else if(action==='cancel')cancel();else if(action==='preload'&&mod)preload(mod);else if(action==='remove'&&mod)remove(mod);
  });
  return panel;
}
async function render(){
  if(!panel)return;
  const safe=document.getElementById('kdc-safe'),q=document.getElementById('kdc-queue'),f=document.getElementById('kdc-frame'),list=document.getElementById('kdc-list');
  if(safe)safe.textContent=paused?'Pausado':(gameplayBusy()?'Gameplay: pausa':(frameHot()?'Frame: pausa':'Seguro'));
  if(q)q.textContent='Cola '+queue.length;
  if(f)f.textContent='Frame '+Math.round(lastFrameCost)+' ms';
  if(!list)return;
  const rows=[];const names=moduleNames();
  for(let i=0;i<names.length;i++){
    const name=names[i],files=moduleFiles(name),count=await cachedCount(name),s=moduleState[name];
    const status=count===files.length&&files.length?'Precargado':(s&&s.status==='downloading'?'Descargando '+Math.min(s.done+1,files.length)+'/'+files.length:(s&&s.status==='error'?'Error':count+'/'+files.length+' archivos'));
    rows.push('<div class="kdc-row"><div><b>'+moduleLabel(name)+'</b><small>'+status+'</small></div><div><button type="button" data-kdc="preload" data-module="'+name+'">Precargar</button> '+(count?'<button type="button" data-kdc="remove" data-module="'+name+'">Quitar</button>':'')+'</div></div>');
  }
  list.innerHTML=rows.join('');
}
function open(){ensureUI();panel.classList.add('open');acquireLock();render();emit('open',{});}
function close(){if(panel)panel.classList.remove('open');releaseLock();emit('close',{});}
root.KeloDownloadCenter=Object.freeze({version:VERSION,open,close,preload,pause,resume,cancel,remove,getState,catalog});
root.KeloSettingsUI=Object.freeze({open:open,close:close});
root.addEventListener('kelo:open-download-center',open);
emit('ready',{modules:moduleNames()});
})(typeof globalThis!=='undefined'?globalThis:window);
