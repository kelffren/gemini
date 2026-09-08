/* KELO-INDEX
 * area: UI / STUDIO LAUNCHER
 * owner: Kelo Studio Launcher
 * purpose: añade CREATE al menú Luxe existente y abre Kelo Studio cuando World Edit esté realmente listo
 * public-api: KELO_STUDIO_LAUNCHER.open/sync/allowed
 * consumes: KELO_ADMIN_KEYS, KELO_LUXE, KELO_WORLD_EDIT.whenReady, menú Luxe existente
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
  async function waitForWorldEdit(){
    const E=window.KELO_WORLD_EDIT;
    if(!E)throw new Error('WORLD_EDIT_OWNER_MISSING');
    if(E.ready)return E;
    if(typeof E.whenReady!=='function')throw new Error('WORLD_EDIT_READY_CONTRACT_MISSING');
    return E.whenReady({timeoutMs:10000});
  }
  function friendlyError(error){
    const code=String(error?.message||error||'');
    if(code.includes('WORLD_EDIT_READY_TIMEOUT')||code.includes('WORLD_EDIT_NOT_READY')||code.includes('WORLD_EDIT_AUTHORITY_NOT_READY'))return 'El editor del mundo todavía está iniciando. Intenta nuevamente.';
    if(code.includes('WORLD_EDIT_OWNER_MISSING')||code.includes('WORLD_EDIT_READY_CONTRACT_MISSING'))return 'El sistema de creación todavía no está listo. Recarga la página.';
    return code||'No se pudo abrir Kelo Studio';
  }
  async function open(){
    if(loading)return;
    if(!allowed())return toast('Necesitas permiso world.edit');
    loading=true;
    const btn=document.getElementById('lx-create-studio'),oldText=btn?.textContent||'CREATE';
    if(btn){btn.disabled=true;btn.textContent='ABRIENDO…';btn.setAttribute('aria-busy','true');}
    try{
      await waitForWorldEdit();
      window.KELO_LUXE?.closeMenu?.();
      const mod=await import('./../studio/integration/live-studio-controller.mjs');
      await mod.openKeloStudioLive({root:window});
    }catch(e){
      console.error('[Kelo Studio launcher]',e);toast(friendlyError(e));
    }finally{
      loading=false;
      if(btn?.isConnected){btn.disabled=false;btn.textContent=oldText;btn.removeAttribute('aria-busy');}
    }
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
  window.KELO_STUDIO_LAUNCHER=Object.freeze({version:'studio-launcher-v1.2.0',open,sync,get allowed(){return allowed();}});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
