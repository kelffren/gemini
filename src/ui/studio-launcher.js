/* KELO-INDEX
 * area: UI / STUDIO LAUNCHER
 * owner: Kelo Studio Launcher
 * purpose: añade CREATE al menú Luxe existente y carga Kelo Studio solo bajo acción explícita
 * public-api: KELO_STUDIO_LAUNCHER.open/sync/allowed
 * consumes: KELO_ADMIN_KEYS, KELO_LUXE, menú Luxe existente
 * state-owned: solo estado efímero de carga
 * extension-points: ninguna; capacidades nuevas pertenecen a src/studio
 * reuse: entrada única a herramientas creator
 * do-not: NO mutar mundo, NO duplicar menú, NO cargar src/studio durante boot normal
 */
(function(){
  'use strict';
  if(window.KELO_STUDIO_LAUNCHER)return;
  let loading=false;
  const actor=()=>String(window.KELO_ADMIN_KEYS?.playerId?.()||window.keloNet?.playerKey||window.localPlayer?.id||'local_pioneer');
  const allowed=()=>!!window.KELO_ADMIN_KEYS?.can?.('world.edit',actor());
  const toast=m=>{if(typeof window.showToast==='function')window.showToast(m);else console.info('[Kelo Studio]',m);};
  async function open(){
    if(loading)return;
    if(!allowed())return toast('Necesitas permiso world.edit');
    loading=true;
    try{
      window.KELO_LUXE?.closeMenu?.();
      const mod=await import('./../studio/integration/live-studio-controller.mjs');
      await mod.openKeloStudioLive({root:window});
    }catch(e){
      console.error('[Kelo Studio launcher]',e);toast(e?.message||'No se pudo abrir Kelo Studio');
    }finally{loading=false;}
  }
  function sync(){
    const grid=document.querySelector('#lx-menu-panel .lx-menu-grid');
    if(!grid)return false;
    let btn=document.getElementById('lx-create-studio');
    if(!allowed()){btn?.remove();return true;}
    if(!btn){
      btn=document.createElement('button');btn.id='lx-create-studio';btn.className='lx-menu-item';btn.textContent='CREATE';btn.setAttribute('aria-label','Abrir Kelo Studio');
      btn.onclick=e=>{e.preventDefault();e.stopPropagation();void open();};grid.appendChild(btn);
    }
    return true;
  }
  function boot(){if(!sync())setTimeout(boot,120);}
  window.KELO_ADMIN_KEYS?.onChange?.(sync);
  window.KELO_STUDIO_LAUNCHER=Object.freeze({version:'studio-launcher-v1.1.0',open,sync,get allowed(){return allowed();}});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
