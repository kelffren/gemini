/* KELO-INDEX
 * area: CORE / OPTIONAL UI
 * owner: KeloSettingsLazyGate
 * keys: SETTINGS DOWNLOAD CENTER UPDATE INTELLIGENCE LAZY FIRST-USE MOBILE SAFARI MANUAL UPDATE BUTTON CACHE REVALIDATE
 * purpose: mantiene Ajustes visible con una puerta mínima y añade un botón Actualizar que reutiliza el updater verificado existente
 * public-api: KeloSettingsUI.open/close + KeloSettingsLazyGate.load + KeloManualUpdate.run
 * do-not: NO settings payload on normal boot, NO polling, NO second updater, NO Service Worker
 */
(function(root){
'use strict';
if(root.KeloSettingsLazyGate)return;
const VERSION='kelo-settings-lazy-gate-v4-manual-update-button';
const BUTTON_ID='lx-manual-update';
let loading=null;
let updateRunning=false;

function toast(message){
  if(typeof root.showToast==='function')root.showToast(message);
  else console.info('[Kelo Update]',message);
}

function loadScript(src,marker){
  return new Promise(function(resolve,reject){
    const base=src.split('?')[0];
    const existing=Array.from(document.scripts).find(function(s){
      return String(s.getAttribute('src')||'').split('?')[0]===base;
    });
    if(existing){resolve();return;}
    const s=document.createElement('script');
    s.src=src;
    s.async=false;
    s.dataset.keloSettingsFirstUse=marker||'1';
    s.onload=resolve;
    s.onerror=function(){reject(new Error('SETTINGS_SCRIPT_LOAD_FAILED:'+src));};
    document.head.appendChild(s);
  });
}

function load(){
  if(root.KeloDownloadCenter&&root.KeloUpdateIntelligenceUI)return Promise.resolve(root.KeloDownloadCenter);
  if(loading)return loading;
  loading=loadScript('src/core/download-center.js?v=2-safe','download-center')
    .then(function(){return loadScript('src/core/update-intelligence-ui.js?v=2-fast-forward-health','update-intelligence');})
    .then(function(){return root.KeloDownloadCenter||null;})
    .finally(function(){loading=null;});
  return loading;
}

async function open(){
  try{
    const center=await load();
    if(!center||typeof center.open!=='function')throw new Error('DOWNLOAD_CENTER_UNAVAILABLE');
    center.open();
    try{root.KeloUpdateIntelligenceUI?.render?.();}catch(_){}
    return true;
  }catch(error){
    console.error('[Kelo Settings lazy gate]',error);
    toast('No se pudo abrir Ajustes');
    return false;
  }
}

function close(){
  try{root.KeloDownloadCenter?.close?.();}catch(_){}
}

function runtimeResourceUrls(){
  const out=new Set();
  const base=new URL('./',document.baseURI);
  const allowed=/\.(?:js|mjs|css|json|webmanifest|png|jpe?g|webp|gif|svg|woff2?|ttf|otf)(?:[?#].*)?$/i;
  function add(raw){
    if(!raw)return;
    try{
      const u=new URL(raw,base);
      if(u.origin!==base.origin||!u.pathname.startsWith(base.pathname))return;
      if(!allowed.test(u.href))return;
      u.hash='';
      out.add(u.href);
    }catch(_){}
  }
  add(new URL('index.html',base).href);
  add(new URL('version.json',base).href);
  document.querySelectorAll('script[src],link[href],img[src],source[src]').forEach(function(node){
    add(node.getAttribute('src')||node.getAttribute('href'));
  });
  try{
    performance.getEntriesByType('resource').forEach(function(entry){add(entry&&entry.name);});
  }catch(_){}
  return Array.from(out);
}

async function revalidateRuntime(onProgress){
  const urls=runtimeResourceUrls();
  let completed=0;
  const concurrency=Math.min(6,Math.max(1,urls.length));
  let cursor=0;
  async function worker(){
    while(cursor<urls.length){
      const index=cursor++;
      const raw=urls[index];
      try{
        const u=new URL(raw);
        u.searchParams.set('_kelo_manual_refresh',Date.now().toString(36)+'_'+index.toString(36));
        await fetch(u.href,{cache:'reload',credentials:'same-origin'});
      }catch(_){}
      completed++;
      if(typeof onProgress==='function')onProgress(completed,urls.length);
    }
  }
  await Promise.all(Array.from({length:concurrency},worker));
  return {completed:completed,total:urls.length};
}

function buttonCopy(button,title,sub){
  if(!button)return;
  const titleNode=button.querySelector('.lx-menu-copy b');
  const subNode=button.querySelector('.lx-menu-copy small');
  if(titleNode)titleNode.textContent=title;
  if(subNode)subNode.textContent=sub;
}

function currentButtonState(button){
  if(updateRunning){buttonCopy(button,'Actualizando…','Preparando versión nueva');return;}
  try{
    const gate=root.KeloUpdateGate?.getState?.();
    if(gate&&gate.deployedBuild&&gate.installedBuild&&gate.deployedBuild!==gate.installedBuild){
      buttonCopy(button,'Actualizar','Nueva versión disponible');
      return;
    }
  }catch(_){}
  buttonCopy(button,'Actualizar','Carga la versión más nueva · sin caché vieja');
}

async function runManualUpdate(button){
  if(updateRunning)return;
  updateRunning=true;
  if(button)button.disabled=true;
  buttonCopy(button,'Actualizando…','Buscando la versión publicada');
  try{
    if(navigator.onLine===false)throw new Error('offline');
    try{root.KELO_LUXE?.closeMenu?.();}catch(_){}

    const gate=root.KeloUpdateGate;
    if(gate&&typeof gate.checkNow==='function'){
      try{await gate.checkNow();}catch(_){}
    }
    if(!root.KeloUpdater&&gate&&typeof gate.wakeHeavy==='function'){
      await gate.wakeHeavy('manual-update-button');
    }

    const updater=root.KeloUpdater;
    if(updater&&typeof updater.check==='function'){
      buttonCopy(button,'Actualizando…','Comparando archivos');
      await updater.check({force:true});
      const state=updater.getState?.()||{};
      if(state.status==='blocked')throw new Error('blocked_build');
      if(state.availableBuild||state.status==='available'||state.status==='ready'){
        buttonCopy(button,'Actualizando…','Descargando y verificando cambios');
        if(typeof updater.prepareUpdate==='function'){
          await updater.prepareUpdate(state.availableBuild||state.deployedBuild,{foreground:true});
        }
        buttonCopy(button,'Actualizando…','Aplicando versión nueva');
        await updater.applyUpdate();
        return;
      }
    }

    buttonCopy(button,'Actualizando…','Revalidando archivos activos');
    await revalidateRuntime(function(done,total){
      buttonCopy(button,'Actualizando…','Archivos '+done+'/'+total);
    });
    toast('Juego actualizado');
    const next=new URL(root.location.href);
    next.searchParams.delete('kelo_update');
    next.searchParams.delete('kelo_update_nonce');
    next.searchParams.set('_kelo_refresh',Date.now().toString(36));
    root.location.replace(next.href);
  }catch(error){
    console.error('[Kelo Manual Update]',error);
    const message=String(error&&error.message||error);
    if(message==='offline')toast('Sin conexión: no se puede actualizar');
    else if(message==='blocked_build')toast('La versión publicada fue bloqueada por el escudo de salud');
    else if(message.includes('update_blocked_gameplay'))toast('Cierra combate o movimiento y toca Actualizar otra vez');
    else toast('No se pudo actualizar. Inténtalo otra vez');
    updateRunning=false;
    if(button)button.disabled=false;
    currentButtonState(button);
  }
}

function ensureUpdateButton(){
  const grid=document.getElementById('lx-menu-grid');
  if(!grid)return null;
  let button=document.getElementById(BUTTON_ID);
  if(button){currentButtonState(button);return button;}
  button=document.createElement('button');
  button.type='button';
  button.id=BUTTON_ID;
  button.className='lx-menu-item';
  button.dataset.accent='true';
  button.setAttribute('aria-label','Actualizar juego');
  button.innerHTML='<span class="lx-menu-icon" aria-hidden="true">↻</span><span class="lx-menu-copy"><b>Actualizar</b><small>Carga la versión más nueva · sin caché vieja</small></span>';
  button.addEventListener('click',function(event){
    event.preventDefault();
    event.stopPropagation();
    void runManualUpdate(button);
  });
  grid.appendChild(button);
  currentButtonState(button);
  return button;
}

function installUpdateButton(){
  const grid=document.getElementById('lx-menu-grid');
  if(!grid)return;
  ensureUpdateButton();
  if(typeof MutationObserver==='function'){
    const observer=new MutationObserver(function(){
      if(!document.getElementById(BUTTON_ID))ensureUpdateButton();
    });
    observer.observe(grid,{childList:true});
  }
  root.addEventListener('kelo:update-gate:available',function(){currentButtonState(document.getElementById(BUTTON_ID));});
  root.addEventListener('kelo:update-gate:current',function(){currentButtonState(document.getElementById(BUTTON_ID));});
  root.addEventListener('kelo:update:available',function(){currentButtonState(document.getElementById(BUTTON_ID));});
  root.addEventListener('kelo:update:current',function(){currentButtonState(document.getElementById(BUTTON_ID));});
}

const api=Object.freeze({
  version:VERSION,
  load:load,
  open:open,
  close:close,
  get loaded(){return !!(root.KeloDownloadCenter&&root.KeloUpdateIntelligenceUI);}
});
root.KeloSettingsLazyGate=api;
root.KeloSettingsUI=Object.freeze({open:open,close:close});
root.KeloManualUpdate=Object.freeze({
  version:VERSION,
  run:function(){return runManualUpdate(document.getElementById(BUTTON_ID));},
  revalidateRuntime:revalidateRuntime
});
try{root.KELO_LUXE?.renderMenu?.();}catch(_){}
installUpdateButton();
})(typeof globalThis!=='undefined'?globalThis:window);
