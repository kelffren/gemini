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

const VERSION='kelo-hub-overlay-v1.0.0';
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
    ['creators','Creators','Herramientas de creación','external:lx-create-studio'],
    ['sprite','Sprite Factory','Sprites · preview · QA','external:lx-create-sprite-factory'],
    ['admin','Administrador','Cuentas · permisos · sanciones','external:lx-admin-control']
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

function hideNative(key,el){
  if(!el||el.closest?.('#kelo-hub-sections')||el.id==='lx-side-menu'||el.id==='lx-menu-close')return;
  if(!native.has(key))native.set(key,el);
  el.dataset.keloHubNative='1';
  el.style.setProperty('display','none','important');
  el.setAttribute('aria-hidden','true');
}
function captureNative(){
  hideNative('boutique',$('lx-shop'));
  hideNative('pvp',$('lx-side-pvp'));
  hideNative('logistics',$('kelo-logistics-admin-fab'));
  document.querySelectorAll('button,[role="button"]').forEach(el=>{
    if(el.closest?.('#kelo-hub-sections')||el.id==='lx-side-menu'||el.id==='lx-menu-close'||el.id==='lx-chat-tab')return;
    const text=norm(el.textContent);
    if(!text)return;
    for(const [key,labels] of Object.entries(LABELS)){
      if(labels.includes(text)){hideNative(key,el);break;}
    }
  });
}
function nativeFor(key){captureNative();const el=native.get(key);return el?.isConnected?el:null;}
function sourceTool(id){
  root.KELO_LUXE?.renderMenu?.();
  return document.querySelector(`#lx-menu-grid [data-tool="${CSS.escape(id)}"]`);
}
function itemAvailable(item){
  const [, , ,kind]=item;
  if(kind==='nativeOptional')return !!nativeFor(item[0]);
  if(kind==='toolOptional')return !!sourceTool(item[0]);
  if(kind.startsWith('external:'))return !!$(kind.slice(9));
  return true;
}
function invoke(item){
  const [id,,,kind]=item;
  root.KELO_LUXE?.closeMenu?.();
  if(kind==='tool'||kind==='toolOptional'){
    const el=sourceTool(id);
    if(el){el.click();return;}
  }else if(kind==='native'||kind==='nativeOptional'){
    const el=nativeFor(id);
    if(el){el.click();return;}
  }else if(kind.startsWith('external:')){
    const el=$(kind.slice(9));
    if(el){el.click();return;}
  }
  toast('Esta opción todavía no está disponible');
}

function ensureStyle(){
  if($('kelo-hub-overlay-style'))return;
  const style=document.createElement('style');
  style.id='kelo-hub-overlay-style';
  style.textContent=`
/* Keep the legacy trigger contract, but make it the single social-app launcher. */
#lx-shop,#lx-side-pvp,#kelo-logistics-admin-fab{display:none!important}
.lx-top{display:none!important}
.lx-rail{top:max(9px,env(safe-area-inset-top))!important;right:max(9px,env(safe-area-inset-right))!important;gap:0!important}
#lx-side-menu{width:68px!important;height:44px!important;border-radius:15px!important;box-shadow:0 8px 26px rgba(0,0,0,.34)!important;opacity:.9}
#lx-side-menu b{font-size:15px!important;line-height:13px!important}#lx-side-menu span{font-size:7px!important;letter-spacing:.12em!important}
#lx-menu-panel{top:max(58px,calc(env(safe-area-inset-top) + 50px))!important;left:max(8px,env(safe-area-inset-left))!important;right:max(8px,env(safe-area-inset-right))!important;bottom:max(8px,env(safe-area-inset-bottom))!important;max-height:none!important;padding:12px!important;border-radius:22px!important}
#lx-menu-title{font-size:0}#lx-menu-title:after{content:'KELO HUB';font-size:20px;letter-spacing:.1em}
#lx-menu-grid{display:none!important}
#kelo-hub-sections{display:flex;flex-direction:column;gap:7px;padding:1px;min-height:0}
.kh-group{border:1px solid rgba(255,255,255,.06);border-radius:14px;overflow:hidden;background:rgba(10,23,26,.72)}
.kh-group-head{width:100%;min-height:49px;padding:8px 10px;border:0;background:linear-gradient(90deg,rgba(28,55,47,.5),rgba(8,20,23,.75));color:#fff4d6;display:flex;align-items:center;gap:9px;text-align:left;font-weight:900}
.kh-group-head i{width:29px;height:29px;display:grid;place-items:center;border:1px solid rgba(231,197,106,.25);border-radius:9px;background:#091719;color:#e7c56a;font-style:normal;font-family:Georgia,serif}
.kh-group-head span{flex:1;font-family:Georgia,serif;font-size:12px}.kh-group-head b{color:#d0ae52;font-size:17px;transition:transform .14s ease}.kh-group.open .kh-group-head b{transform:rotate(90deg)}
.kh-group-items{display:none;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;padding:6px;border-top:1px solid rgba(255,255,255,.05)}.kh-group.open .kh-group-items{display:grid}
.kh-app{min-height:59px;padding:8px 9px;border:1px solid rgba(231,197,106,.18);border-radius:11px;background:rgba(7,17,20,.9);color:#eef5ef;text-align:left}.kh-app strong{display:block;color:#fff4d6;font-size:10px}.kh-app small{display:block;margin-top:4px;color:#81978f;font-size:7.5px;line-height:1.25}.kh-app:active{transform:scale(.975);border-color:rgba(231,197,106,.55)}
#lx-chat-tab{position:absolute;z-index:89;left:max(0px,env(safe-area-inset-left));bottom:max(76px,calc(env(safe-area-inset-bottom) + 68px));width:26px;height:46px;padding:0;border:1px solid rgba(231,197,106,.22);border-left:0;border-radius:0 13px 13px 0;background:rgba(7,17,20,.55);color:rgba(231,197,106,.7);pointer-events:auto;opacity:.28;font-size:11px;transition:opacity .15s ease,width .15s ease,background .15s ease}
#lx-chat-tab:focus-visible,#lx-chat-tab:hover{opacity:.88;width:34px}#lx-chat-tab.unread{opacity:.95;width:34px;background:rgba(24,45,39,.95);box-shadow:0 0 18px rgba(231,197,106,.22)}#lx-chat-tab.hidden{display:none!important}
#lx-chat-drawer{left:max(8px,env(safe-area-inset-left))!important;right:max(8px,env(safe-area-inset-right))!important;bottom:max(8px,env(safe-area-inset-bottom))!important;max-height:min(55vh,460px)!important;border-radius:20px!important}
#lx-chat-drawer.open{display:flex!important;flex-direction:column!important}#lx-chat-drawer .lx-log{height:min(220px,32vh)!important;min-height:96px!important}
@media(min-width:760px){#lx-menu-panel{left:auto!important;width:min(430px,calc(100vw - 18px))!important}.kh-group-items{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:340px){.kh-group-items{grid-template-columns:1fr}.kh-app{min-height:50px}}
@media(max-height:520px) and (orientation:landscape){#lx-menu-panel{top:max(48px,calc(env(safe-area-inset-top) + 42px))!important;left:auto!important;width:min(430px,62vw)!important}.kh-group-head{min-height:40px}.kh-app{min-height:46px}#lx-chat-tab{bottom:max(8px,env(safe-area-inset-bottom))}}
`;
  document.head.appendChild(style);
}

function ensureHubHost(){
  const scroll=document.querySelector('#lx-menu-panel .lx-menu-scroll');
  if(!scroll)return null;
  let host=$('kelo-hub-sections');
  if(!host){host=document.createElement('div');host.id='kelo-hub-sections';scroll.appendChild(host);}
  return host;
}
function renderHub(){
  captureNative();
  const host=ensureHubHost();if(!host)return false;
  const blocks=[];
  for(const group of GROUPS){
    const items=group.items.filter(itemAvailable);
    if(!items.length)continue;
    blocks.push(`<section class="kh-group ${activeCategory===group.id?'open':''}" data-kh-group="${group.id}"><button type="button" class="kh-group-head" data-kh-toggle="${group.id}"><i>${group.icon}</i><span>${group.label}</span><b>›</b></button><div class="kh-group-items">${items.map(item=>`<button type="button" class="kh-app" data-kh-app="${item[0]}" data-kh-group-id="${group.id}"><strong>${item[1]}</strong><small>${item[2]}</small></button>`).join('')}</div></section>`);
  }
  host.innerHTML=blocks.join('');
  return true;
}
function findItem(groupId,itemId){return GROUPS.find(g=>g.id===groupId)?.items.find(i=>i[0]===itemId)||null;}

function openChat(){
  root.KELO_LUXE?.closeMenu?.();
  const chat=sourceTool('chat');
  if(chat){chat.click();syncChatTab();return true;}
  toast('El chat todavía no está disponible');return false;
}
function syncChatTab(){
  const drawer=$('lx-chat-drawer'),tab=$('lx-chat-tab');if(!tab)return;
  const open=!!drawer?.classList.contains('open');tab.classList.toggle('hidden',open);if(open)tab.classList.remove('unread');
}
function ensureChatTab(){
  const luxe=$('kelo-luxe');if(!luxe)return false;
  let tab=$('lx-chat-tab');
  if(!tab){tab=document.createElement('button');tab.id='lx-chat-tab';tab.type='button';tab.setAttribute('aria-label','Abrir chat');tab.title='Chat';tab.textContent='●';tab.onclick=openChat;luxe.appendChild(tab);}
  const drawer=$('lx-chat-drawer');
  if(drawer&&!drawer.dataset.keloHubWatch){drawer.dataset.keloHubWatch='1';new MutationObserver(syncChatTab).observe(drawer,{attributes:true,attributeFilter:['class']});}
  const log=$('lx-log');
  if(log&&!log.dataset.keloHubWatch){log.dataset.keloHubWatch='1';new MutationObserver(()=>{if(!drawer?.classList.contains('open'))tab.classList.add('unread');}).observe(log,{childList:true});}
  syncChatTab();return true;
}

function bind(){
  const menu=$('lx-side-menu'),panel=$('lx-menu-panel'),host=ensureHubHost();
  if(!menu||!panel||!host)return false;
  menu.innerHTML='<b>◆</b><span>HUB</span>';
  menu.setAttribute('aria-label','Abrir Kelo Hub');
  if(!host.dataset.keloHubBound){
    host.dataset.keloHubBound='1';
    host.addEventListener('click',event=>{
      const toggle=event.target.closest('[data-kh-toggle]');
      if(toggle){event.preventDefault();event.stopPropagation();activeCategory=activeCategory===toggle.dataset.khToggle?'':toggle.dataset.khToggle;renderHub();return;}
      const app=event.target.closest('[data-kh-app]');
      if(!app)return;
      event.preventDefault();event.stopPropagation();const item=findItem(app.dataset.khGroupId,app.dataset.khApp);if(item)invoke(item);
    });
  }
  const title=$('lx-menu-title');if(title)title.setAttribute('aria-label','Kelo Hub');
  renderHub();ensureChatTab();return true;
}

function boot(){
  ensureStyle();captureNative();bind();
  const grid=$('lx-menu-grid');if(grid)new MutationObserver(()=>renderHub()).observe(grid,{childList:true,subtree:false});
  const bodyObserver=new MutationObserver(mutations=>{
    let changed=false;
    for(const mutation of mutations){for(const node of mutation.addedNodes){if(!(node instanceof HTMLElement))continue;changed=true;if(node.matches?.('button,[role="button"]'))captureNative();node.querySelectorAll?.('button,[role="button"]').forEach(()=>captureNative());}}
    if(changed){captureNative();bind();renderHub();}
  });
  bodyObserver.observe(document.body,{childList:true,subtree:true});
  root.addEventListener('kelo:online-auth-ready',()=>{captureNative();renderHub();});
}

root.KeloHubOverlay=Object.freeze({version:VERSION,refresh(){captureNative();bind();renderHub();ensureChatTab();},openChat,audit:Object.freeze({singleLauncher:true,preservesLuxeContracts:true,accordionSubmenus:true,minimizedChat:true,noPolling:true,mobileFirst:true})});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})(window);
