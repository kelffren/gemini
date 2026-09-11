/* KELO-INDEX
 * area: UI / CREATORS LAUNCHER
 * owner: Kelo Studio Launcher (compat name retained)
 * keys: CREATORS MENU PREMIUM LAZY ADMIN ANIMATION CAPABILITY AVATAR SPRITE FACTORY ASSET REPAIRER ONLINE PERMISSIONS HUB
 * purpose: añade CREATORS, Sprite Factory y Asset Repairer al menú Luxe, carga permisos online, panel admin y overlay Kelo Hub
 * public-api: KELO_STUDIO_LAUNCHER + KELO_CREATORS_LAUNCHER alias
 * consumes: KELO_ADMIN_KEYS, KeloAccountPermissions, KELO_LUXE, menú Luxe existente
 * state-owned: solo estado efímero de carga
 * extension-points: Creator Hub / Sprite Factory / Asset Repairer / WorkspaceRegistry / Account Admin / Kelo Hub
 */
(function(){
  'use strict';
  if(window.KELO_STUDIO_LAUNCHER)return;
  let loading=false,factoryLoading=false,repairLoading=false;
  const CREATOR_BUILD='world-recovery-20260911-admin-1';
  const actor=()=>String(window.KELO_ADMIN_KEYS?.playerId?.()||window.keloNet?.playerKey||window.localPlayer?.id||'local_pioneer');
  const allowed=()=>{
    const keys=window.KELO_ADMIN_KEYS,who=actor();
    return !!(keys?.can?.('creators.access',who)||keys?.can?.('world.edit',who)||keys?.can?.('animation.edit',who));
  };
  const toast=m=>{if(typeof window.showToast==='function')window.showToast(m);else console.info('[Kelo Creators]',m);};
  function friendlyError(error){const code=String(error?.message||error||'');return code||'No se pudo abrir Kelo Creators';}
  function paint(button,busy){
    if(!button)return;
    button.innerHTML='<span class="lx-menu-icon" aria-hidden="true">♟</span><span class="lx-menu-copy"><b>'+(busy?'Abriendo…':'Creators')+'</b><small>'+(busy?'Cargando herramientas':'Herramientas de creación')+'</small></span>';
    button.disabled=!!busy;
    if(busy)button.setAttribute('aria-busy','true');else button.removeAttribute('aria-busy');
  }
  function paintFactory(button,busy){
    if(!button)return;
    button.innerHTML='<span class="lx-menu-icon" aria-hidden="true">▦</span><span class="lx-menu-copy"><b>'+(busy?'Abriendo…':'Sprite Factory')+'</b><small>'+(busy?'Preparando pipeline':'Sprites 8D · AI · preview · QA')+'</small></span>';
    button.disabled=!!busy;
    if(busy)button.setAttribute('aria-busy','true');else button.removeAttribute('aria-busy');
  }
  function paintRepair(button,busy){
    if(!button)return;
    button.innerHTML='<span class="lx-menu-icon" aria-hidden="true">✦</span><span class="lx-menu-copy"><b>'+(busy?'Abriendo…':'Asset Repairer')+'</b><small>'+(busy?'Preparando laboratorio':'PNG · alpha · pivot · seams · export')+'</small></span>';
    button.disabled=!!busy;
    if(busy)button.setAttribute('aria-busy','true');else button.removeAttribute('aria-busy');
  }
  async function loadCreatorHub(){
    try{return await import(`./../creators/ui/creator-hub.mjs?v=${CREATOR_BUILD}`);}
    catch(firstError){
      console.warn('[Kelo Creators launcher] retrying fresh Creator Hub',firstError);
      return import(`./../creators/ui/creator-hub.mjs?v=${CREATOR_BUILD}-${Date.now()}`);
    }
  }
  async function open(){
    if(loading)return;
    if(!allowed())return toast('Necesitas acceso a Kelo Creators');
    loading=true;
    const btn=document.getElementById('lx-create-studio');paint(btn,true);
    try{
      window.KELO_LUXE?.closeMenu?.();
      const mod=await loadCreatorHub();
      await mod.openCreatorHub({root:window});
    }catch(e){
      console.error('[Kelo Creators launcher]',e);toast(friendlyError(e));
    }finally{
      loading=false;if(btn?.isConnected)paint(btn,false);
    }
  }
  async function openFactory(){
    if(factoryLoading)return;
    if(!allowed())return toast('Necesitas acceso a Kelo Creators');
    factoryLoading=true;
    const btn=document.getElementById('lx-create-sprite-factory');paintFactory(btn,true);
    try{
      window.KELO_LUXE?.closeMenu?.();
      const mod=await import('./../creators/ui/sprite-factory-online.mjs');
      await mod.openSpriteFactoryOnline({root:window});
    }catch(e){
      console.error('[Kelo Sprite Factory launcher]',e);toast(friendlyError(e));
    }finally{
      factoryLoading=false;if(btn?.isConnected)paintFactory(btn,false);
    }
  }
  async function openRepair(){
    if(repairLoading)return;
    if(!allowed())return toast('Necesitas acceso a Kelo Creators');
    repairLoading=true;
    const btn=document.getElementById('lx-create-asset-repairer');paintRepair(btn,true);
    try{
      window.KELO_LUXE?.closeMenu?.();
      const mod=await import(`./../studio/ui/studio-asset-repairer.mjs?v=${CREATOR_BUILD}`);
      const repairer=mod.createStudioAssetRepairer({root:window});
      window.KELO_ASSET_REPAIRER=repairer;
    }catch(e){
      console.error('[Kelo Asset Repairer launcher]',e);toast(friendlyError(e));
    }finally{
      repairLoading=false;if(btn?.isConnected)paintRepair(btn,false);
    }
  }
  function sync(){
    const grid=document.querySelector('#lx-menu-panel .lx-menu-grid');
    if(!grid)return false;
    let btn=document.getElementById('lx-create-studio'),factoryBtn=document.getElementById('lx-create-sprite-factory'),repairBtn=document.getElementById('lx-create-asset-repairer');
    if(!allowed()){btn?.remove();factoryBtn?.remove();repairBtn?.remove();return true;}
    if(!btn){btn=document.createElement('button');btn.id='lx-create-studio';btn.type='button';btn.className='lx-menu-item';btn.onclick=e=>{e.preventDefault();e.stopPropagation();void open();};grid.appendChild(btn);}
    if(!factoryBtn){factoryBtn=document.createElement('button');factoryBtn.id='lx-create-sprite-factory';factoryBtn.type='button';factoryBtn.className='lx-menu-item';factoryBtn.onclick=e=>{e.preventDefault();e.stopPropagation();void openFactory();};grid.appendChild(factoryBtn);}
    if(!repairBtn){repairBtn=document.createElement('button');repairBtn.id='lx-create-asset-repairer';repairBtn.type='button';repairBtn.className='lx-menu-item';repairBtn.onclick=e=>{e.preventDefault();e.stopPropagation();void openRepair();};grid.appendChild(repairBtn);}
    btn.setAttribute('aria-label','Abrir Kelo Creators');paint(btn,loading);
    factoryBtn.setAttribute('aria-label','Abrir Kelo Sprite Factory');paintFactory(factoryBtn,factoryLoading);
    repairBtn.setAttribute('aria-label','Abrir Kelo Asset Repairer');paintRepair(repairBtn,repairLoading);
    return true;
  }
  async function bootOnlineAuthorization(){
    try{
      const permissionsModule=await import('./../auth/account-permissions-runtime.mjs?v=1');
      await permissionsModule.installAccountPermissions({root:window});
      sync();
      const adminModule=await import('./account-admin-panel.mjs?v=1');
      await adminModule.installAccountAdminPanel({root:window});
      window.KeloHubOverlay?.refresh?.();
    }catch(error){console.warn('[Kelo online authorization boot]',error);}
  }
  function boot(){
    sync();
    void import('./kelo-hub-overlay.js?v=1').then(()=>window.KeloHubOverlay?.refresh?.()).catch(e=>console.warn('[Kelo Hub overlay]',e));
    void bootOnlineAuthorization();
    void import('./../characters/creator-avatar-runtime.mjs').then(m=>m.installCreatorAvatarRuntime({root:window})).catch(e=>console.warn('[Kelo Avatar runtime]',e));
  }
  window.KELO_ADMIN_KEYS?.onChange?.(()=>{sync();window.KeloHubOverlay?.refresh?.();});
  const api=Object.freeze({version:'studio-launcher-v1.10.0-asset-repairer',open,openSpriteFactory:openFactory,openAssetRepairer:openRepair,sync,get allowed(){return allowed();}});
  window.KELO_STUDIO_LAUNCHER=api;
  window.KELO_CREATORS_LAUNCHER=api;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
