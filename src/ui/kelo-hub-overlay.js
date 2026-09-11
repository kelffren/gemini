/* KELO-INDEX
 * area: UI / HUB OVERLAY
 * owner: Kelo Hub presentation layer
 * keys: HUB APPS SUBMENUS CHAT MINIMIZE MOBILE
 * purpose: concentra el chrome social en un solo Hub sin romper los IDs/handlers LIVE de Luxe
 * online: presentación solamente; todas las acciones delegan a los owners existentes
 * do-not: NO gameplay state, NO segundo sistema de autoridad, NO polling
 */
(function(root){
'use strict';
if(root.KeloHubOverlay)return;

const VERSION='kelo-hub-overlay-v1.1.0';
const native=new Map();
let activeCategory='game';
const $=id=>document.getElementById(id);
const norm=value=>String(value||'').trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ');
const toast=message=>typeof root.showToast==='function'?root.showToast(message):console.info('[Kelo Hub]',message);

const GROUPS=Object.freeze([
  {id:'game',label:'Juego',icon:'⚔',items:[
    ['pvp','PvP','Entrar al combate','native'],
    ['abilities','Habilidades','Poder y piedras','tool'],
    ['emotes','Burlas','Emotes y gestos','tool'],
    ['guide','Guía','Ayuda y controles','native'],
    ['fullscreen','Pantalla completa','Más espacio de juego','native']
  ]},
  {id:'economy',label:'Economía',icon:'◆',items:[
    ['bag','Mochila','Inventario','tool'],
    ['market','Mercado','Compra y vende','tool'],
    ['properties','Propiedades','Tierra y edificios','tool'],
    ['boutique','Boutique','Tienda','native'],
    ['logistics','Logística','Economía y rutas','nativeOptional']
  ]},
  {id:'character',label:'Personaje',icon:'♛',items:[
    ['appearance','Apariencia','Personaliza tu personaje','tool'],
    ['mounts','Monturas','Equipa y monta','tool'],
    ['profile','Perfil','Tu información','tool'],
    ['nobility','Nobleza','Caballero · Rey','tool'],
    ['titles','Títulos','Prestigio y logros','tool']
  ]},
  {id:'create',label:'Creadores',icon:'✦',items:[
    ['creators','Creators','Herramientas de creación','creators'],
    ['sprite','Sprite Factory','Sprites · preview · QA','sprite'],
    ['admin','Administrador','Cuentas · permisos · sanciones','admin']
  ]},
  {id:'system',label:'Sistema',icon:'⚙',items:[
    ['missions','Misiones','Aventuras y desafíos','toolOptional'],
    ['settings','Ajustes','Configura tu experiencia','toolOptional']
  ]}
]);

const LABELS=Object.freeze({
  boutique:['BOUTIQUE'],
  pvp:['PVP'],
  guide:['GUIA'],
  fullscreen:['PANTALLA COMPLETA','FULLSCREEN'],
  logistics:['LOGISTICA']
});

function ignored(el){
  return !el||el.closest?.('#kelo-hub-sections')||el.id==='lx-side-menu'||el.id==='lx-menu-close'||el.id==='lx-chat-tab'||el.id==='kelo-hub-launcher';
}
function hideNative(key,el){
  if(ignored(el))return;
  if(!native.has(key))native.set(key,el);
  el.dataset.keloHubNative='1';
  el.style.setProperty('display','none','important');
  el.setAttribute('aria-hidden','true');
}
function captureNative(){
  hideNative('boutique',$('lx-shop'));
  hideNative('pvp',$('lx-side-pvp'));
  hideNative('logistics',$('kelo-logistics-admin-fab'));
  hideNative('fullscreen',$('kelo-orientation-btn'));
  document.querySelectorAll('button,[role="button"],[onclick],a').forEach(el=>{
    if(ignored(el))return;
    const text=norm(el.textContent);if(!text)return;
    for(const [key,labels] of Object.entries(LABELS)){
      if(labels.includes(text)){hideNative(key,el);break;}
    }
  });
}
function nativeFor(key){
  let el=native.get(key);
  if(!el?.isConnected){native.delete(key);captureNative();el=native.get(key);}
  return el?.isConnected?el:null;
}
function sourceTool(id){return Array.from(document.querySelectorAll('#lx-menu-grid [data-tool]')).find(el=>el.dataset.tool===id)||null;}
function creatorAllowed(){return !!root.KELO_CREATORS_LAUNCHER?.allowed;}
function adminAllowed(){const p=root.KeloAccountPermissions||root.KeloPermissions;return !!(p?.hasRole?.('admin')||p?.can?.('admin.panel'));}
function itemAvailable(item){
  const [id,,,kind]=item;
  if(kind==='nativeOptional')return !!nativeFor(id);
  if(kind==='toolOptional')return !!sourceTool(id);
  if(kind==='creators'||kind==='sprite')return creatorAllowed();
  if(kind==='admin')return adminAllowed();
  return true;
}
function invoke(item){
  const [id,,,kind]=item;
  root.KELO_LUXE?.closeMenu?.();
  syncHubLauncher();
  if(kind==='tool'||kind==='toolOptional'){
    root.KELO_LUXE?.renderMenu?.();const el=sourceTool(id);if(el){el.click();return;}
  }else if(kind==='native'||kind==='nativeOptional'){
    const el=nativeFor(id);if(el){el.click();return;}
  }else if(kind==='creators'){
    if(root.KELO_CREATORS_LAUNCHER?.open){void root.KELO_CREATORS_LAUNCHER.open();return;}
  }else if(kind==='sprite'){
    if(root.KELO_CREATORS_LAUNCHER?.openSpriteFactory){void root.KELO_CREATORS_LAUNCHER.openSpriteFactory();return;}
  }else if(kind==='admin'){
    if(root.KeloAccountAdminPanel?.open){void root.KeloAccountAdminPanel.open();return;}
  }
  toast('Esta opción todavía no está disponible');
}

function ensureStyle(){
  if($('kelo-hub-overlay-style'))return;
  const style=document.createElement('style');
  style.id='kelo-hub-overlay-style';
  style.textContent=`
#lx-shop,#lx-side-pvp,#kelo-logistics-admin-fab,#kelo-orientation-btn,[data-kelo-hub-native="1"]{display:none!important}
.lx-top,.lx-rail{display:none!important}
#kelo-hub-launcher{position:fixed;z-index:488;top:max(10px,env(safe-area-inset-top));right:max(10px,env(safe-area-inset-right));width:62px;height:46px;padding:4px;border:1px solid rgba(231,197,106,.58);border-radius:15px;background:linear-gradient(145deg,rgba(23,48,41,.96),rgba(7,16,19,.98));color:#fff4d6;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;box-shadow:0 10px 28px rgba(0,0,0,.38),inset 0 0 0 1px rgba(255,255,255,.04);pointer-events:auto;touch-action:manipulation;-webkit-tap-highlight-color:transparent;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
#kelo-hub-launcher b{color:#e7c56a;font:900 15px/14px Georgia,serif}#kelo-hub-launcher span{font-size:7px;font-weight:950;letter-spacing:.14em}#kelo-hub-launcher[aria-expanded="true"]{border-color:#e7c56a;box-shadow:0 10px 30px rgba(0,0,0,.42),0 0 18px rgba(231,197,106,.15)}#kelo-hub-launcher:active{transform:scale(.96)}
#lx-menu-panel{top:max(64px,calc(env(safe-area-inset-top) + 54px))!important;left:max(8px,env(safe-area-inset-left))!important;right:max(8px,env(safe-area-inset-right))!important;bottom:max(8px,env(safe-area-inset-bottom))!important;max-height:none!important;padding:12px!important;border-radius:22px!important}
#lx-menu-title{font-size:0}#lx-menu-title:after{content:'KELO HUB';font-size:20px;letter-spacing:.1em}
#lx-menu-grid{display:none!important}
#kelo-hub-sections{display:flex;flex-direction:column;gap:7px;padding:1px;min-height:0}
.kh-group{border:1px solid rgba(255,255,255,.06);border-radius:14px;overflow:hidden;background:rgba(10,23,26,.72)}
.kh-group-head{width:100%;min-height:49px;padding:8px 10px;border:0;background:linear-gradient(90deg,rgba(28,55,47,.5),rgba(8,20,23,.75));color:#fff4d6;display:flex;align-items:center;gap:9px;text-align:left;font-weight:900}
.kh-group-head i{width:29px;height:29px;display:grid;place-items:center;border:1px solid rgba(231,197,106,.25);border-radius:9px;background:#091719;color:#e7c56a;font-style:normal;font-family:Georgia,serif}
.kh-group-head span{flex:1;font-family:Georgia,serif;font-size:12px}.kh-group-head b{color:#d0ae52;font-size:17px;transition:transform .14s ease}.kh-group.open .kh-group-head b{transform:rotate(90deg)}
.kh-group-items{display:none;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;padding:6px;border-top:1px solid rgba(255,255,255,.05)}.kh-group.open .kh-group-items{display:grid}
.kh-app{min-height:59px;padding:8px 9px;border:1px solid rgba(231,197,106,.18);border-radius:11px;background:rgba(7,17,20,.9);color:#eef5ef;text-align:left}.kh-app strong{display:block;color:#fff4d6;font-size:10px}.kh-app small{display:block;margin-top:4px;color:#81978f;font-size:7.5px;line-height:1.25}.kh-app:active{transform:scale(.975);border-color:rgba(231,197,106,.55)}
#lx-chat-tab{position:fixed;z-index:487;left:max(0px,env(safe-area-inset-left));bottom:max(76px,calc(env(safe-area-inset-bottom) + 68px));width:38px;height:48px;padding:3px 2px;border:1px solid rgba(231,197,106,.32);border-left:0;border-radius:0 13px 13px 0;background:rgba(7,17,20,.78);color:rgba(231,197,106,.9);pointer-events:auto;opacity:.62;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;touch-action:manipulation;-webkit-tap-highlight-color:transparent;box-shadow:0 8px 22px rgba(0,0,0,.24);transition:opacity .15s ease,width .15s ease,background .15s ease}
#lx-chat-tab span{font-size:12px;line-height:11px}#lx-chat-tab small{font:900 6px/8px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;letter-spacing:.08em}#lx-chat-tab:focus-visible,#lx-chat-tab:hover{opacity:.95;width:44px}#lx-chat-tab.unread{opacity:1;width:44px;background:rgba(24,45,39,.96);box-shadow:0 0 18px rgba(231,197,106,.24)}#lx-chat-tab.hidden{display:none!important}
#lx-chat-drawer{left:max(8px,env(safe-area-inset-left))!important;right:max(8px,env(safe-area-inset-right))!important;bottom:max(8px,env(safe-area-inset-bottom))!important;max-height:min(55vh,460px)!important;border-radius:20px!important}
#lx-chat-drawer.open{display:flex!important;flex-direction:column!important}#lx-chat-drawer .lx-log{height:min(220px,32vh)!important;min-height:96px!important}
@media(min-width:760px){#lx-menu-panel{left:auto!important;width:min(430px,calc(100vw - 18px))!important}.kh-group-items{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:340px){#kelo-hub-launcher{width:56px;height:44px}.kh-group-items{grid-template-columns:1fr}.kh-app{min-height:50px}}
@media(max-height:520px) and (orientation:landscape){#kelo-hub-launcher{top:max(6px,env(safe-area-inset-top));right:max(6px,env(safe-area-inset-right));width:56px;height:40px}#lx-menu-panel{top:max(52px,calc(env(safe-area-inset-top) + 44px))!important;left:auto!important;width:min(430px,62vw)!important}.kh-group-head{min-height:40px}.kh-app{min-height:46px}#lx-chat-tab{bottom:max(8px,env(safe-area-inset-bottom))}}
`;
  document.head.appendChild(style);
}

function ensureHubHost(){
  const scroll=document.querySelector('#lx-menu-panel .lx-menu-scroll');if(!scroll)return null;
  let host=$('kelo-hub-sections');
  if(!host){host=document.createElement('div');host.id='kelo-hub-sections';scroll.appendChild(host);}
  return host;
}
function renderHub(){
  captureNative();const host=ensureHubHost();if(!host)return false;const blocks=[];
  for(const group of GROUPS){
    const items=group.items.filter(itemAvailable);if(!items.length)continue;
    blocks.push(`<section class="kh-group ${activeCategory===group.id?'open':''}" data-kh-group="${group.id}"><button type="button" class="kh-group-head" data-kh-toggle="${group.id}"><i>${group.icon}</i><span>${group.label}</span><b>›</b></button><div class="kh-group-items">${items.map(item=>`<button type="button" class="kh-app" data-kh-app="${item[0]}" data-kh-group-id="${group.id}"><strong>${item[1]}</strong><small>${item[2]}</small></button>`).join('')}</div></section>`);
  }
  host.innerHTML=blocks.join('');return true;
}
function findItem(groupId,itemId){return GROUPS.find(g=>g.id===groupId)?.items.find(i=>i[0]===itemId)||null;}

function syncHubLauncher(){
  const btn=$('kelo-hub-launcher');if(!btn)return;
  const open=!!root.KELO_LUXE?.isMenuOpen?.();
  btn.setAttribute('aria-expanded',String(open));
}
function toggleHub(force){
  bind();
  const luxe=root.KELO_LUXE;
  if(luxe?.toggleMenu){
    const desired=typeof force==='boolean'?force:!luxe.isMenuOpen?.();
    const result=luxe.toggleMenu(desired);
    if(desired)renderHub();
    syncHubLauncher();
    return result;
  }
  const fallback=$('lx-side-menu');
  if(fallback){fallback.click();syncHubLauncher();return true;}
  toast('El Hub todavía está cargando');return false;
}
function ensureHubLauncher(){
  let btn=$('kelo-hub-launcher');
  if(!btn){
    btn=document.createElement('button');btn.id='kelo-hub-launcher';btn.type='button';btn.setAttribute('aria-label','Abrir Kelo Hub');btn.setAttribute('aria-expanded','false');btn.innerHTML='<b>◆</b><span>HUB</span>';
    btn.addEventListener('pointerdown',event=>event.stopPropagation());
    btn.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();toggleHub();});
    document.body.appendChild(btn);
  }else if(btn.parentElement!==document.body){document.body.appendChild(btn);}
  syncHubLauncher();return true;
}

function openChat(){
  root.KELO_LUXE?.closeMenu?.();syncHubLauncher();root.KELO_LUXE?.renderMenu?.();
  const chat=sourceTool('chat');
  if(chat){chat.click();syncChatTab();return true;}
  toast('El chat todavía está cargando');return false;
}
function syncChatTab(){
  const drawer=$('lx-chat-drawer'),tab=$('lx-chat-tab');if(!tab)return;
  const open=!!drawer?.classList.contains('open');tab.classList.toggle('hidden',open);if(open)tab.classList.remove('unread');
}
function ensureChatTab(){
  let tab=$('lx-chat-tab');
  if(!tab){
    tab=document.createElement('button');tab.id='lx-chat-tab';tab.type='button';tab.setAttribute('aria-label','Abrir chat');tab.title='Chat';tab.innerHTML='<span>●</span><small>CHAT</small>';
    tab.addEventListener('pointerdown',event=>event.stopPropagation());
    tab.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();openChat();});
    document.body.appendChild(tab);
  }else if(tab.parentElement!==document.body){document.body.appendChild(tab);}
  const drawer=$('lx-chat-drawer');
  if(drawer&&!drawer.dataset.keloHubWatch){
    drawer.dataset.keloHubWatch='1';new MutationObserver(()=>{syncChatTab();syncHubLauncher();}).observe(drawer,{attributes:true,attributeFilter:['class']});
  }
  const log=$('lx-log');
  if(log&&!log.dataset.keloHubWatch){
    log.dataset.keloHubWatch='1';new MutationObserver(()=>{if(!drawer?.classList.contains('open'))tab.classList.add('unread');}).observe(log,{childList:true});
  }
  syncChatTab();return true;
}
function bind(){
  ensureHubLauncher();ensureChatTab();
  const menu=$('lx-side-menu'),panel=$('lx-menu-panel'),host=ensureHubHost();
  if(menu){menu.innerHTML='<b>◆</b><span>HUB</span>';menu.setAttribute('aria-label','Abrir Kelo Hub');}
  if(!panel||!host)return false;
  if(!host.dataset.keloHubBound){
    host.dataset.keloHubBound='1';host.addEventListener('click',event=>{
      const toggle=event.target.closest('[data-kh-toggle]');
      if(toggle){event.preventDefault();event.stopPropagation();activeCategory=activeCategory===toggle.dataset.khToggle?'':toggle.dataset.khToggle;renderHub();return;}
      const app=event.target.closest('[data-kh-app]');if(!app)return;
      event.preventDefault();event.stopPropagation();const item=findItem(app.dataset.khGroupId,app.dataset.khApp);if(item)invoke(item);
    });
  }
  if(!panel.dataset.keloHubWatch){panel.dataset.keloHubWatch='1';new MutationObserver(syncHubLauncher).observe(panel,{attributes:true,attributeFilter:['class']});}
  const title=$('lx-menu-title');if(title)title.setAttribute('aria-label','Kelo Hub');
  renderHub();syncHubLauncher();return true;
}

function boot(){
  ensureStyle();ensureHubLauncher();ensureChatTab();captureNative();bind();
  const grid=$('lx-menu-grid');if(grid&&!grid.dataset.keloHubWatch){grid.dataset.keloHubWatch='1';new MutationObserver(()=>renderHub()).observe(grid,{childList:true,subtree:false});}
  const bodyObserver=new MutationObserver(mutations=>{
    let relevant=false;
    for(const mutation of mutations){for(const node of mutation.addedNodes){
      if(!(node instanceof HTMLElement)||node.closest?.('#kelo-hub-sections')||node.id==='kelo-hub-sections'||node.id==='kelo-hub-launcher'||node.id==='lx-chat-tab')continue;
      if(node.matches?.('button,[role="button"],[onclick],a,#kelo-luxe,#kelo-logistics-admin-fab')||node.querySelector?.('button,[role="button"],[onclick],a,#kelo-luxe,#kelo-logistics-admin-fab'))relevant=true;
    }}
    if(relevant){captureNative();bind();renderHub();ensureHubLauncher();ensureChatTab();}
  });
  bodyObserver.observe(document.body,{childList:true,subtree:true});
  root.addEventListener('kelo:online-auth-ready',()=>{captureNative();bind();renderHub();ensureHubLauncher();ensureChatTab();});
  root.addEventListener('kelo:permissions-changed',()=>{renderHub();ensureHubLauncher();});
}

root.KeloHubOverlay=Object.freeze({
  version:VERSION,
  refresh(){captureNative();bind();renderHub();ensureHubLauncher();ensureChatTab();},
  open:()=>toggleHub(true),
  close:()=>toggleHub(false),
  openChat,
  audit:Object.freeze({singleLauncher:true,bodyLevelLauncher:true,preservesLuxeContracts:true,accordionSubmenus:true,minimizedChat:true,bodyLevelChat:true,noPolling:true,mobileFirst:true})
});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})(window);
