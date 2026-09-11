/* KELO-INDEX
 * area: UI / HUB + CHAT
 * owner: Kelo Hub Shell
 * keys: HUB MENU APPS SUBMENUS CHAT MINIMIZE MOBILE
 * purpose: concentra navegación visible en un único Kelo Hub y deja el chat como pestaña mínima desplegable
 * online: presentación únicamente; delega acciones a owners/rutas existentes
 * do-not: NO gameplay state, NO autoridad duplicada, NO polling
 */
(function(){
'use strict';
if(window.KeloHubShell)return;

const VERSION='kelo-hub-shell-v1.0.0';
const HUB_ID='kelo-hub-shell';
const nativeButtons=new Map();
let hubLockToken=null;
let openCategory='game';

const CATEGORIES=Object.freeze([
  {id:'game',label:'Juego',icon:'⚔',items:[
    {id:'pvp',label:'PvP',sub:'Entrar al combate',kind:'native'},
    {id:'abilities',label:'Habilidades',sub:'Poder y piedras',kind:'tool'},
    {id:'emotes',label:'Burlas',sub:'Emotes y gestos',kind:'tool'},
    {id:'guide',label:'Guía',sub:'Ayuda y controles',kind:'native'},
    {id:'fullscreen',label:'Pantalla completa',sub:'Más espacio de juego',kind:'native'}
  ]},
  {id:'inventory',label:'Economía',icon:'◆',items:[
    {id:'bag',label:'Mochila',sub:'Inventario',kind:'tool'},
    {id:'market',label:'Mercado',sub:'Compra y vende',kind:'tool'},
    {id:'properties',label:'Propiedades',sub:'Tierra y edificios',kind:'tool'},
    {id:'boutique',label:'Boutique',sub:'Tienda',kind:'native'},
    {id:'logistics',label:'Logística',sub:'Economía y rutas',kind:'native',optional:true}
  ]},
  {id:'character',label:'Personaje',icon:'♛',items:[
    {id:'appearance',label:'Apariencia',sub:'Personaliza tu personaje',kind:'tool'},
    {id:'mounts',label:'Monturas',sub:'Equipa y monta',kind:'tool'},
    {id:'profile',label:'Perfil',sub:'Tu información',kind:'tool'},
    {id:'nobility',label:'Nobleza',sub:'Caballero · Rey',kind:'tool'},
    {id:'titles',label:'Títulos',sub:'Prestigio y logros',kind:'tool'}
  ]},
  {id:'create',label:'Creadores',icon:'✦',items:[
    {id:'creators',label:'Creators',sub:'Herramientas de creación',kind:'id',target:'lx-create-studio',optional:true},
    {id:'sprite',label:'Sprite Factory',sub:'Sprites · preview · QA',kind:'id',target:'lx-create-sprite-factory',optional:true},
    {id:'admin',label:'Administrador',sub:'Cuentas · permisos · sanciones',kind:'id',target:'lx-admin-control',optional:true}
  ]},
  {id:'system',label:'Sistema',icon:'⚙',items:[
    {id:'settings',label:'Ajustes',sub:'Configura tu experiencia',kind:'tool',optional:true},
    {id:'missions',label:'Misiones',sub:'Aventuras y desafíos',kind:'tool',optional:true}
  ]}
]);

const aliases=Object.freeze({
  boutique:['BOUTIQUE'],
  pvp:['PVP'],
  guide:['GUIA','GUÍA'],
  fullscreen:['PANTALLA COMPLETA','FULLSCREEN'],
  logistics:['LOGISTICA','LOGÍSTICA']
});

function norm(value){return String(value||'').trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ');}
function toast(message){if(typeof window.showToast==='function')window.showToast(message);else console.info('[Kelo Hub]',message);}
function locks(){return window.KeloInputLocks;}
function acquire(){if(hubLockToken)return;hubLockToken=locks()?.acquire?.('kelo-hub',{surface:'hub'})||null;}
function release(){if(!hubLockToken)return;locks()?.release?.(hubLockToken);hubLockToken=null;}
function isHubNode(el){return !!el?.closest?.('#'+HUB_ID);}
function hiddenByHub(el){return el?.dataset?.keloHubNative==='1';}

function captureNativeButton(el){
  if(!el||isHubNode(el)||hiddenByHub(el))return;
  if(!(el instanceof HTMLElement))return;
  const text=norm(el.textContent);
  if(!text)return;
  for(const [key,list] of Object.entries(aliases)){
    if(list.some(label=>norm(label)===text)){
      if(!nativeButtons.has(key))nativeButtons.set(key,el);
      el.dataset.keloHubNative='1';
      el.style.setProperty('display','none','important');
      el.setAttribute('aria-hidden','true');
      return;
    }
  }
}
function captureKnown(){
  ['lx-shop','lx-side-menu','lx-side-pvp','kelo-logistics-admin-fab'].forEach(id=>{
    const el=document.getElementById(id);
    if(!el)return;
    const key=id==='lx-shop'?'boutique':id==='lx-side-pvp'?'pvp':id==='kelo-logistics-admin-fab'?'logistics':null;
    if(key&&!nativeButtons.has(key))nativeButtons.set(key,el);
    if(id!=='lx-side-menu'){
      el.dataset.keloHubNative='1';
      el.style.setProperty('display','none','important');
      el.setAttribute('aria-hidden','true');
    } else {
      el.style.setProperty('display','none','important');
      el.setAttribute('aria-hidden','true');
    }
  });
  document.querySelectorAll('button,[role="button"]').forEach(captureNativeButton);
}
function findNative(key){
  const known=nativeButtons.get(key);
  if(known?.isConnected)return known;
  captureKnown();
  return nativeButtons.get(key)||null;
}

function invokeCoreTool(tool){
  window.KELO_LUXE?.renderMenu?.();
  const button=document.querySelector(`#lx-menu-grid [data-tool="${CSS.escape(tool)}"]`);
  if(button){button.click();return true;}
  return false;
}
function invoke(item){
  closeHub();
  if(item.kind==='tool'){
    if(invokeCoreTool(item.id))return;
    toast('Esta sección todavía no está disponible');
    return;
  }
  if(item.kind==='id'){
    const el=document.getElementById(item.target);
    if(el){el.click();return;}
    toast('Esta herramienta no está habilitada para tu cuenta');
    return;
  }
  const native=findNative(item.id);
  if(native){native.click();return;}
  toast('Esta opción todavía no está disponible');
}

function toolAvailable(item){
  if(!item.optional)return true;
  if(item.kind==='id')return !!document.getElementById(item.target);
  if(item.kind==='native')return !!findNative(item.id);
  if(item.kind==='tool'){
    window.KELO_LUXE?.renderMenu?.();
    return !!document.querySelector(`#lx-menu-grid [data-tool="${CSS.escape(item.id)}"]`);
  }
  return true;
}

function ensureStyle(){
  if(document.getElementById('kelo-hub-style'))return;
  const style=document.createElement('style');
  style.id='kelo-hub-style';
  style.textContent=`
#${HUB_ID}{position:absolute;inset:0;z-index:470;pointer-events:none;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#fff4d6}
#${HUB_ID} *{box-sizing:border-box}
.kh-trigger{position:absolute;right:max(9px,env(safe-area-inset-right));top:max(9px,env(safe-area-inset-top));pointer-events:auto;height:42px;min-width:72px;padding:0 12px;border:1px solid rgba(231,197,106,.58);border-radius:15px;background:linear-gradient(145deg,rgba(20,38,34,.95),rgba(6,14,17,.97));color:#f2d57f;box-shadow:0 8px 24px rgba(0,0,0,.34);font:900 10px/1 Georgia,serif;letter-spacing:.08em}
.kh-trigger b{font-size:16px;margin-right:6px}.kh-trigger:active{transform:scale(.96)}
.kh-panel{position:absolute;right:max(9px,env(safe-area-inset-right));top:max(58px,calc(env(safe-area-inset-top) + 52px));bottom:max(10px,env(safe-area-inset-bottom));width:min(390px,calc(100vw - 18px));display:none;flex-direction:column;pointer-events:auto;overflow:hidden;border:1px solid rgba(231,197,106,.58);border-radius:22px;background:linear-gradient(180deg,rgba(7,17,20,.985),rgba(3,8,12,.992));box-shadow:0 28px 90px rgba(0,0,0,.66),inset 0 0 0 1px rgba(255,255,255,.025);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px)}
.kh-panel.open{display:flex;animation:khIn .16s ease-out}@keyframes khIn{from{opacity:0;transform:translateY(-5px) scale(.985)}to{opacity:1;transform:none}}
.kh-head{display:flex;align-items:center;gap:9px;padding:13px 14px 11px;border-bottom:1px solid rgba(231,197,106,.14)}.kh-title{flex:1;font-family:Georgia,serif;font-size:18px;font-weight:900;letter-spacing:.08em;color:#efd277}.kh-title small{display:block;margin-top:3px;font:700 8px/1.2 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;letter-spacing:.03em;color:#80968f}.kh-close{width:38px;height:38px;border:1px solid rgba(231,197,106,.32);border-radius:12px;background:#0f1b20;color:#f5df9e;font-size:20px}
.kh-scroll{min-height:0;overflow:auto;padding:9px;overscroll-behavior:contain;-webkit-overflow-scrolling:touch}
.kh-section{margin-bottom:7px;border:1px solid rgba(255,255,255,.055);border-radius:15px;overflow:hidden;background:rgba(12,24,28,.68)}.kh-cat{width:100%;min-height:52px;padding:9px 11px;border:0;background:linear-gradient(90deg,rgba(27,53,46,.48),rgba(8,20,23,.7));color:#f8edd0;display:flex;align-items:center;gap:9px;text-align:left;font-weight:900}.kh-cat i{width:30px;height:30px;display:grid;place-items:center;border:1px solid rgba(231,197,106,.25);border-radius:10px;color:#e7c56a;background:#0a1719;font-style:normal;font-family:Georgia,serif}.kh-cat span{flex:1}.kh-cat b{font-size:16px;color:#c9a84e;transition:transform .15s ease}.kh-section.open .kh-cat b{transform:rotate(90deg)}.kh-items{display:none;padding:6px;border-top:1px solid rgba(255,255,255,.05);grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}.kh-section.open .kh-items{display:grid}.kh-item{min-height:62px;padding:8px 9px;border:1px solid rgba(231,197,106,.18);border-radius:11px;background:rgba(7,17,20,.86);color:#eef5ef;text-align:left}.kh-item strong{display:block;color:#fff4d6;font-size:10px}.kh-item small{display:block;margin-top:4px;color:#7f978f;font-size:7.5px;line-height:1.25}.kh-item:active{transform:scale(.975);border-color:rgba(231,197,106,.55)}
.kh-chat-tab{position:absolute;left:max(0px,env(safe-area-inset-left));bottom:max(90px,calc(env(safe-area-inset-bottom) + 82px));pointer-events:auto;width:27px;height:48px;border:1px solid rgba(231,197,106,.25);border-left:0;border-radius:0 13px 13px 0;background:rgba(8,18,21,.62);color:rgba(231,197,106,.72);display:grid;place-items:center;font-size:13px;opacity:.42;transition:opacity .15s ease,width .15s ease,background .15s ease}.kh-chat-tab:hover,.kh-chat-tab:focus-visible{opacity:.95;width:36px}.kh-chat-tab.unread{opacity:.95;width:34px;background:rgba(24,45,39,.95);box-shadow:0 0 18px rgba(231,197,106,.22)}.kh-chat-tab.hidden{display:none}
#lx-chat-drawer{left:max(8px,env(safe-area-inset-left))!important;right:max(8px,env(safe-area-inset-right))!important;bottom:max(8px,env(safe-area-inset-bottom))!important;max-height:min(58vh,460px)!important;border-radius:20px!important}
#lx-chat-drawer.open{display:flex!important;flex-direction:column!important}
#lx-chat-drawer .lx-log{height:min(220px,34vh)!important;min-height:96px!important}
#lx-shop,#lx-side-menu,#lx-side-pvp,#kelo-logistics-admin-fab{display:none!important}
@media(max-width:520px){.kh-panel{left:max(8px,env(safe-area-inset-left));right:max(8px,env(safe-area-inset-right));width:auto}.kh-items{grid-template-columns:repeat(2,minmax(0,1fr))}.kh-trigger{min-width:64px;padding:0 10px}.kh-chat-tab{bottom:max(72px,calc(env(safe-area-inset-bottom) + 66px))}}
@media(max-width:340px){.kh-items{grid-template-columns:1fr}.kh-item{min-height:52px}}
@media(max-height:520px) and (orientation:landscape){.kh-panel{top:max(48px,calc(env(safe-area-inset-top) + 42px));width:min(430px,58vw)}.kh-head{padding:8px 10px}.kh-scroll{padding:6px}.kh-cat{min-height:42px}.kh-item{min-height:48px}.kh-chat-tab{bottom:max(10px,env(safe-area-inset-bottom))}}
`;
  document.head.appendChild(style);
}

function renderHub(){
  const host=document.getElementById('kh-sections');
  if(!host)return;
  host.innerHTML=CATEGORIES.map(category=>{
    const items=category.items.filter(toolAvailable);
    if(!items.length)return '';
    const open=category.id===openCategory;
    return `<section class="kh-section ${open?'open':''}" data-category="${category.id}">
      <button type="button" class="kh-cat" data-category-toggle="${category.id}">
        <i>${category.icon}</i><span>${category.label}</span><b>›</b>
      </button>
      <div class="kh-items">${items.map(item=>`<button type="button" class="kh-item" data-kh-item="${item.id}" data-kh-category="${category.id}"><strong>${item.label}</strong><small>${item.sub}</small></button>`).join('')}</div>
    </section>`;
  }).join('');
}

function ensureDom(){
  if(document.getElementById(HUB_ID))return;
  ensureStyle();
  const root=document.createElement('div');
  root.id=HUB_ID;
  root.innerHTML=`<button type="button" class="kh-trigger" id="kh-trigger" aria-expanded="false"><b>◆</b> HUB</button>
    <section class="kh-panel" id="kh-panel" role="dialog" aria-label="Kelo Hub" aria-hidden="true">
      <div class="kh-head"><div class="kh-title">KELO HUB<small>Aplicaciones y sistemas</small></div><button type="button" class="kh-close" id="kh-close" aria-label="Cerrar">×</button></div>
      <div class="kh-scroll" id="kh-sections"></div>
    </section>
    <button type="button" class="kh-chat-tab" id="kh-chat-tab" aria-label="Abrir chat" title="Chat">●</button>`;
  document.body.appendChild(root);
  document.getElementById('kh-trigger').onclick=()=>toggleHub();
  document.getElementById('kh-close').onclick=closeHub;
  document.getElementById('kh-panel').addEventListener('pointerdown',e=>e.stopPropagation());
  document.getElementById('kh-panel').addEventListener('click',e=>{
    const toggle=e.target.closest('[data-category-toggle]');
    if(toggle){
      openCategory=openCategory===toggle.dataset.categoryToggle?'':toggle.dataset.categoryToggle;
      renderHub();
      return;
    }
    const button=e.target.closest('[data-kh-item]');
    if(!button)return;
    const category=CATEGORIES.find(c=>c.id===button.dataset.khCategory);
    const item=category?.items.find(i=>i.id===button.dataset.khItem);
    if(item)invoke(item);
  });
  document.getElementById('kh-chat-tab').onclick=openChat;
  renderHub();
}

function openHub(){
  ensureDom();
  window.KELO_LUXE?.closeChat?.();
  captureKnown();
  renderHub();
  const panel=document.getElementById('kh-panel');
  panel?.classList.add('open');
  panel?.setAttribute('aria-hidden','false');
  document.getElementById('kh-trigger')?.setAttribute('aria-expanded','true');
  acquire();
}
function closeHub(){
  const panel=document.getElementById('kh-panel');
  panel?.classList.remove('open');
  panel?.setAttribute('aria-hidden','true');
  document.getElementById('kh-trigger')?.setAttribute('aria-expanded','false');
  release();
}
function toggleHub(){document.getElementById('kh-panel')?.classList.contains('open')?closeHub():openHub();}

function openChat(){
  closeHub();
  window.KELO_LUXE?.renderMenu?.();
  const chat=document.querySelector('#lx-menu-grid [data-tool="chat"]');
  if(chat){chat.click();syncChatTab();clearUnread();return;}
  toast('El chat todavía no está disponible');
}
function clearUnread(){document.getElementById('kh-chat-tab')?.classList.remove('unread');}
function syncChatTab(){
  const tab=document.getElementById('kh-chat-tab'),drawer=document.getElementById('lx-chat-drawer');
  if(!tab)return;
  tab.classList.toggle('hidden',!!drawer?.classList.contains('open'));
}
function installChatObservers(){
  const drawer=document.getElementById('lx-chat-drawer');
  const log=document.getElementById('lx-log');
  if(drawer&&!drawer.dataset.keloHubObserved){
    drawer.dataset.keloHubObserved='1';
    new MutationObserver(()=>{syncChatTab();if(drawer.classList.contains('open'))clearUnread();}).observe(drawer,{attributes:true,attributeFilter:['class']});
  }
  if(log&&!log.dataset.keloHubObserved){
    log.dataset.keloHubObserved='1';
    new MutationObserver(()=>{
      if(!drawer?.classList.contains('open'))document.getElementById('kh-chat-tab')?.classList.add('unread');
    }).observe(log,{childList:true});
  }
  syncChatTab();
}

function boot(){
  ensureDom();
  captureKnown();
  installChatObservers();
  const observer=new MutationObserver(mutations=>{
    let shouldRender=false;
    for(const mutation of mutations){
      for(const node of mutation.addedNodes){
        if(!(node instanceof HTMLElement))continue;
        captureNativeButton(node);
        node.querySelectorAll?.('button,[role="button"]').forEach(captureNativeButton);
        if(node.id==='lx-create-studio'||node.id==='lx-create-sprite-factory'||node.id==='lx-admin-control'||node.id==='kelo-logistics-admin-fab'||node.querySelector?.('#lx-create-studio,#lx-create-sprite-factory,#lx-admin-control,#kelo-logistics-admin-fab'))shouldRender=true;
      }
    }
    if(shouldRender)renderHub();
    installChatObservers();
  });
  observer.observe(document.body,{childList:true,subtree:true});
  window.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.getElementById('kh-panel')?.classList.contains('open')){e.preventDefault();closeHub();}});
  window.addEventListener('kelo:online-auth-ready',()=>{captureKnown();renderHub();});
}

window.KeloHubShell=Object.freeze({version:VERSION,open:openHub,close:closeHub,toggle:toggleHub,openChat,refresh(){captureKnown();renderHub();installChatObservers();},audit:Object.freeze({singleVisibleHub:true,accordionSubmenus:true,minimizedChat:true,noPolling:true,mobileFirst:true})});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();