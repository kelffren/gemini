/* KELO-INDEX
 * area: UI / DEV TOOLS
 * owner: Kelo Asset Library Launcher
 * keys: ASSETS LIBRARY MOBILE MENU
 * purpose: expose the separate asset-library page from the main Luxe menu without adding another floating HUD button.
 */
(function(root){
'use strict';
const ID='kelo-asset-library-launcher';
let gridObserver=null;
let bodyObserver=null;

function disabledCount(){
  try{
    const state=root.KELO_ASSET_REGISTRY?.getState?.();
    return state?.disabled?.length||0;
  }catch(_){
    return 0;
  }
}

function refresh(button){
  if(!button)return;
  const off=disabledCount();
  const small=button.querySelector('small');
  if(small)small.textContent=off?'Biblioteca de Assets · '+off+' off':'Biblioteca de Assets';
  button.title=off?off+' paquetes desactivados':'Biblioteca de Assets';
}

function openLibrary(){
  const opened=root.open('asset-library.html','_blank','noopener');
  if(!opened)root.location.href='asset-library.html';
  try{root.KELO_LUXE?.closeMenu?.();}catch(_){}
}

function buildButton(){
  const button=document.createElement('button');
  button.id=ID;
  button.type='button';
  button.className='lx-menu-item';
  button.setAttribute('aria-label','Abrir Biblioteca de Assets');
  button.innerHTML='<span class="lx-menu-icon" aria-hidden="true">🧱</span><span class="lx-menu-copy"><b>Assets</b><small>Biblioteca de Assets</small></span>';
  button.addEventListener('click',openLibrary);
  refresh(button);
  return button;
}

function ensureInMenu(){
  const grid=document.getElementById('lx-menu-grid');
  if(!grid)return false;

  let button=document.getElementById(ID);
  if(!button||button.parentNode!==grid){
    if(button)button.remove();
    button=buildButton();
    grid.appendChild(button);
  }else{
    refresh(button);
  }

  if(!gridObserver){
    gridObserver=new MutationObserver(function(){
      const current=document.getElementById(ID);
      if(!current||current.parentNode!==grid)queueMicrotask(ensureInMenu);
    });
    gridObserver.observe(grid,{childList:true});
  }
  return true;
}

function mount(){
  if(ensureInMenu())return;
  if(bodyObserver)return;
  bodyObserver=new MutationObserver(function(){
    if(ensureInMenu()){
      bodyObserver.disconnect();
      bodyObserver=null;
    }
  });
  bodyObserver.observe(document.body,{childList:true,subtree:true});
}

root.addEventListener('kelo:asset-selection-changed',function(){refresh(document.getElementById(ID));});
root.addEventListener('storage',function(){refresh(document.getElementById(ID));});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})(typeof globalThis!=='undefined'?globalThis:window);
