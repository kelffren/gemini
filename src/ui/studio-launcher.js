/* KELO-INDEX
 * area: UI / CREATORS LAUNCHER
 * owner: Kelo Studio Launcher (compat name retained)
 * keys: CREATORS MENU PREMIUM LAZY ADMIN
 * purpose: añade CREATORS al menú Luxe existente y carga solo Creator Hub tras acción explícita
 * public-api: KELO_STUDIO_LAUNCHER + KELO_CREATORS_LAUNCHER alias
 * consumes: KELO_ADMIN_KEYS, KELO_LUXE, menú Luxe existente
 * state-owned: solo estado efímero de carga
 * extension-points: Creator Hub / WorkspaceRegistry; no domain logic here
 * reuse: entrada única a herramientas creator
 * do-not: NO mutar mundo, NO duplicar menú, NO cargar src/studio ni src/creators durante boot normal, NO polling
 */
(function(){
  'use strict';
  if(window.KELO_STUDIO_LAUNCHER)return;
  let loading=false;
  const actor=()=>String(window.KELO_ADMIN_KEYS?.playerId?.()||window.keloNet?.playerKey||window.localPlayer?.id||'local_pioneer');
  const allowed=()=>!!window.KELO_ADMIN_KEYS?.can?.('world.edit',actor());
  const toast=m=>{if(typeof window.showToast==='function')window.showToast(m);else console.info('[Kelo Creators]',m);};
  function friendlyError(error){const code=String(error?.message||error||'');return code||'No se pudo abrir Kelo Creators';}
  function paint(button,busy){
    if(!button)return;
    button.innerHTML='<span class="lx-menu-icon" aria-hidden="true">♟</span><span class="lx-menu-copy"><b>'+(busy?'Abriendo…':'Creators')+'</b><small>'+(busy?'Cargando herramientas':'Herramientas de creación')+'</small></span>';
    button.disabled=!!busy;
    if(busy)button.setAttribute('aria-busy','true');else button.removeAttribute('aria-busy');
  }
  async function open(){
    if(loading)return;
    if(!allowed())return toast('Necesitas acceso a Kelo Creators');
    loading=true;
    const btn=document.getElementById('lx-create-studio');paint(btn,true);
    try{
      window.KELO_LUXE?.closeMenu?.();
      const mod=await import('./../creators/ui/creator-hub.mjs');
      await mod.openCreatorHub({root:window});
    }catch(e){
      console.error('[Kelo Creators launcher]',e);toast(friendlyError(e));
    }finally{
      loading=false;if(btn?.isConnected)paint(btn,false);
    }
  }
  function sync(){
    const grid=document.querySelector('#lx-menu-panel .lx-menu-grid');
    if(!grid)return false;
    let btn=document.getElementById('lx-create-studio');
    if(!allowed()){btn?.remove();return true;}
    if(!btn){btn=document.createElement('button');btn.id='lx-create-studio';btn.type='button';btn.className='lx-menu-item';btn.onclick=e=>{e.preventDefault();e.stopPropagation();void open();};grid.appendChild(btn);}
    btn.setAttribute('aria-label','Abrir Kelo Creators');paint(btn,loading);return true;
  }
  function boot(){sync();}
  window.KELO_ADMIN_KEYS?.onChange?.(sync);
  const api=Object.freeze({version:'studio-launcher-v1.5.1-premium-menu',open,sync,get allowed(){return allowed();}});
  window.KELO_STUDIO_LAUNCHER=api;
  window.KELO_CREATORS_LAUNCHER=api;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();