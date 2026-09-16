/* KELO-INDEX
 * area: CORE / OPTIONAL UI
 * owner: KeloAdminControlLazyGate
 * keys: ADMIN APPROVALREQUEST LAZY MOBILE SAFARI NOTIFICATIONS BUILD SHA
 * purpose: lazy entries for Administrator + ApprovalRequest using one stable installed-build module identity
 * do-not: NO service_role, NO direct publish, NO polling, NO random cache nonce, NO Studio dependency
 */
(function(root){
'use strict';
if(root.KeloAdminControlLazyGate)return;
const VERSION='kelo-admin-control-lazy-gate-v5-runtime-build';
const VERSIONER_SRC='src/core/runtime-version.js?v=runtime-version-1';
let adminLoading=null,approvalLoading=null,notificationBoot=null,versionerLoading=null,approvalUnread=0,approvalUnreadHooked=false;
const actor=()=>String(root.KELO_ADMIN_KEYS?.playerId?.()||root.keloNet?.playerKey||root.localPlayer?.id||'local_pioneer');
const online=()=>root.KeloAccountPermissions||root.KeloPermissions;
function locallyAdminEligible(){const keys=root.KELO_ADMIN_KEYS,who=actor(),p=online();return !!(p?.hasRole?.('admin')||p?.can?.('admin.panel')||keys?.can?.('admin.panel',who)||keys?.can?.('accounts.roles',who)||keys?.can?.('world.edit',who));}
function locallyApprovalEligible(){const keys=root.KELO_ADMIN_KEYS,who=actor(),p=online();return !!(p?.hasRole?.('admin')||p?.can?.('approval.view')||p?.can?.('approval.review')||keys?.can?.('admin.panel',who)||keys?.can?.('accounts.roles',who));}
function toast(msg){if(typeof root.showToast==='function')root.showToast(msg);else console.info('[Kelo Admin gate]',msg);}
function paintAdmin(btn,busy){if(!btn)return;btn.innerHTML='<span class="lx-menu-icon" aria-hidden="true">⚙</span><span class="lx-menu-copy"><b>'+(busy?'Abriendo…':'Administrador')+'</b><small>'+(busy?'Autorizando':'Usuarios · economía · GM LIVE')+'</small></span>';btn.disabled=!!busy;}
function paintApproval(btn,busy){if(!btn)return;const badge=approvalUnread>0?'<em style="margin-left:auto;min-width:20px;height:20px;padding:0 6px;border-radius:999px;display:inline-grid;place-items:center;background:#c93f4f;color:#fff;font:900 10px/1 -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">'+(approvalUnread>99?'99+':approvalUnread)+'</em>':'';btn.innerHTML='<span class="lx-menu-icon" aria-hidden="true">✓</span><span class="lx-menu-copy"><b>'+(busy?'Abriendo…':'ApprovalRequest')+'</b><small>'+(busy?'Autorizando':'Solicitudes de editores · assets · contenido')+'</small></span>'+badge;btn.disabled=!!busy;}
function sync(){
  const grid=document.querySelector('#lx-menu-panel .lx-menu-grid');if(!grid)return false;
  let adminBtn=document.getElementById('lx-admin-control');if(!locallyAdminEligible())adminBtn?.remove();else{if(!adminBtn){adminBtn=document.createElement('button');adminBtn.id='lx-admin-control';adminBtn.type='button';adminBtn.className='lx-menu-item';adminBtn.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();void openAdmin();});grid.appendChild(adminBtn);}paintAdmin(adminBtn,!!adminLoading);}
  let approvalBtn=document.getElementById('lx-approval-request');if(!locallyApprovalEligible())approvalBtn?.remove();else{if(!approvalBtn){approvalBtn=document.createElement('button');approvalBtn.id='lx-approval-request';approvalBtn.type='button';approvalBtn.className='lx-menu-item';approvalBtn.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();void openApproval();});grid.appendChild(approvalBtn);}paintApproval(approvalBtn,!!approvalLoading);}return true;
}
function ensureVersioner(){
  if(root.KeloRuntimeVersion)return Promise.resolve(root.KeloRuntimeVersion);if(versionerLoading)return versionerLoading;
  versionerLoading=new Promise((resolve,reject)=>{const existing=document.querySelector('script[data-kelo-runtime-version="1"]');if(existing){existing.addEventListener('load',()=>resolve(root.KeloRuntimeVersion),{once:true});existing.addEventListener('error',()=>reject(new Error('RUNTIME_VERSION_LOAD_FAILED')),{once:true});return;}const s=document.createElement('script');s.src=VERSIONER_SRC;s.async=false;s.dataset.keloRuntimeVersion='1';s.onload=()=>root.KeloRuntimeVersion?resolve(root.KeloRuntimeVersion):reject(new Error('RUNTIME_VERSION_MISSING'));s.onerror=()=>reject(new Error('RUNTIME_VERSION_LOAD_FAILED'));document.head.appendChild(s);}).finally(()=>{versionerLoading=null;});return versionerLoading;
}
async function importRuntime(path){const r=await ensureVersioner();await r.ready();return r.importModule(path);}
async function loadPermissions(){if(root.KeloAccountPermissions)return root.KeloAccountPermissions;const mod=await importRuntime('src/auth/account-permissions-runtime.mjs');return mod.installAccountPermissions({root});}
async function loadAdmin(){if(root.KeloAccountAdminPanel)return root.KeloAccountAdminPanel;if(adminLoading)return adminLoading;adminLoading=(async()=>{const p=await loadPermissions();if(!(p?.hasRole?.('admin')||p?.can?.('admin.panel')))throw new Error('ADMIN_PERMISSION_DENIED');const mod=await importRuntime('src/ui/account-admin-panel.mjs');return mod.installAccountAdminPanel({root});})().finally(()=>{adminLoading=null;sync();});return adminLoading;}
async function loadApproval(){if(root.KeloApprovalRequestPanel)return root.KeloApprovalRequestPanel;if(approvalLoading)return approvalLoading;approvalLoading=(async()=>{const p=await loadPermissions();if(!(p?.hasRole?.('admin')||p?.can?.('approval.view')||p?.can?.('approval.review')))throw new Error('APPROVAL_VIEW_DENIED');const mod=await importRuntime('src/ui/approval-request-panel.mjs');return mod.installApprovalRequestPanel({root});})().finally(()=>{approvalLoading=null;sync();});return approvalLoading;}
async function openAdmin(){const btn=document.getElementById('lx-admin-control');paintAdmin(btn,true);try{const panel=await loadAdmin();if(!panel?.open)throw new Error('ADMIN_PANEL_UNAVAILABLE');await panel.open();return true;}catch(error){console.warn('[Kelo Admin lazy gate]',error);toast(String(error?.message||error).includes('ADMIN_PERMISSION_DENIED')?'Tu cuenta no tiene permiso de administrador':'No se pudo abrir Administrador');return false;}finally{paintAdmin(document.getElementById('lx-admin-control'),false);}}
async function openApproval(){const btn=document.getElementById('lx-approval-request');paintApproval(btn,true);try{const panel=await loadApproval();if(!panel?.open)throw new Error('APPROVAL_PANEL_UNAVAILABLE');await panel.open();approvalUnread=0;sync();return true;}catch(error){console.warn('[Kelo Approval lazy gate]',error);toast(String(error?.message||error).includes('APPROVAL_VIEW_DENIED')?'Tu cuenta no tiene permiso para ApprovalRequest':'No se pudo abrir ApprovalRequest');return false;}finally{paintApproval(document.getElementById('lx-approval-request'),false);}}
async function bootApprovalNotifications(){
  if(notificationBoot)return notificationBoot;notificationBoot=(async()=>{const p=await loadPermissions();if(!(p?.hasRole?.('admin')||p?.can?.('approval.notifications')))return false;const mod=await importRuntime('src/core/approval-request-runtime.mjs');const runtime=await mod.installApprovalRequestRuntime({root});if(!approvalUnreadHooked){root.addEventListener('kelo:approval-unread',event=>{approvalUnread=Math.max(0,Number(event?.detail?.count)||0);sync();});approvalUnreadHooked=true;}await runtime.startNotifications();approvalUnread=runtime.unread||0;sync();return true;})().catch(error=>{console.warn('[Kelo Approval notification boot]',error);return false;}).finally(()=>{notificationBoot=null;});return notificationBoot;
}
const api=Object.freeze({version:VERSION,open:openAdmin,openAdmin,openApproval,sync,get eligible(){return locallyAdminEligible();},get approvalEligible(){return locallyApprovalEligible();}});root.KeloAdminControlLazyGate=api;
try{root.KELO_ADMIN_KEYS?.onChange?.(sync);}catch(_){}
root.addEventListener('kelo:permissions-changed',()=>{sync();void bootApprovalNotifications();});['kelo:online-auth-ready','kelo:account-signed-in','kelo:profile-complete','kelo:account-created'].forEach(name=>root.addEventListener(name,()=>void bootApprovalNotifications()));
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',sync,{once:true});else sync();if(root.KeloOnlineAuth)queueMicrotask(()=>void bootApprovalNotifications());
})(typeof globalThis!=='undefined'?globalThis:window);
