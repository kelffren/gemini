/* KELO-INDEX
 * area: UI
 * keys: MOBILE ORIENTATION FULLSCREEN IMMERSIVE BUTTON PORTRAIT LANDSCAPE VIEWPORT CAMERA ZOOM FOV
 * hace: detecta orientación, sincroniza viewport/cámara y reutiliza el control lateral móvil como pantalla completa inmersiva
 * online: UI/cámara local; no contiene estado valioso ni autoridad compartida
 */
(function(){
'use strict';
if(window.KELO_ORIENTATION)return;

const VERSION='mobile-orientation-v1.3.2';
const ZOOM_PRESETS=Object.freeze([0.7,0.82,1]);
let lastOrientation=null;
let preferredOrientation=null;
let syncing=false;
let portraitBaseZoom=null;
let lastEffectiveZoom=null;
let immersiveFallback=false;

function isTouchDevice(){
  return (navigator.maxTouchPoints||0)>0 || !!window.matchMedia?.('(pointer: coarse)').matches;
}
function isIOSFamily(){
  const ua=navigator.userAgent||'';
  return /iPhone|iPad|iPod/i.test(ua) || (navigator.platform==='MacIntel' && (navigator.maxTouchPoints||0)>1);
}
function isChromeIOS(){
  return isIOSFamily() && /CriOS/i.test(navigator.userAgent||'');
}
function isFirefoxIOS(){
  return isIOSFamily() && /FxiOS/i.test(navigator.userAgent||'');
}
function standaloneActive(){
  return navigator.standalone===true || !!window.matchMedia?.('(display-mode: standalone)').matches || !!window.matchMedia?.('(display-mode: fullscreen)').matches;
}
function orientationFromViewport(){
  return window.innerWidth>=window.innerHeight?'landscape':'portrait';
}
function physicalOrientation(){
  const type=screen.orientation?.type||'';
  if(type.startsWith('landscape'))return'landscape';
  if(type.startsWith('portrait'))return'portrait';
  return orientationFromViewport();
}
function labelFor(value){return value==='landscape'?'horizontal':'vertical';}
function toast(msg){
  if(typeof window.showToast==='function')window.showToast(msg);
  else console.info('[KeloOrientation]',msg);
}
function haptic(){try{navigator.vibrate?.(12);}catch(e){}}
function button(){return document.getElementById('kelo-orientation-btn');}
function nativeFullscreenSupported(){
  return typeof document.documentElement?.requestFullscreen==='function';
}
function nativeFullscreenActive(){return !!document.fullscreenElement;}
function fullscreenActive(){return nativeFullscreenActive()||immersiveFallback||standaloneActive();}
function fullscreenMode(){
  if(nativeFullscreenActive())return'native';
  if(standaloneActive())return'standalone';
  if(immersiveFallback)return'immersive';
  return'windowed';
}
function updateButton(current){
  const el=button(); if(!el)return;
  const active=fullscreenActive();
  const orientation=current||physicalOrientation();
  el.dataset.orientation=orientation;
  el.dataset.fullscreen=active?'active':'windowed';
  el.dataset.fullscreenMode=fullscreenMode();
  el.setAttribute('aria-pressed',String(active));
  el.setAttribute('aria-label',active?'Salir de pantalla completa':'Entrar en pantalla completa');
  el.setAttribute('title',active?'Salir de pantalla completa':'Pantalla completa');
  const primary=el.querySelector('[data-fullscreen-primary]');
  const secondary=el.querySelector('[data-fullscreen-secondary]');
  if(primary)primary.textContent=active?'SALIR':'PANTALLA';
  if(secondary)secondary.textContent=active?'PANTALLA':'COMPLETA';
}
function syncViewportCss(){
  const root=document.documentElement;
  root.style.setProperty('--kelo-vw',`${window.innerWidth}px`);
  root.style.setProperty('--kelo-vh',`${window.innerHeight}px`);
}
function readRuntimeZoom(){
  try{return typeof CONFIG!=='undefined'&&Number.isFinite(Number(CONFIG.zoom))?Number(CONFIG.zoom):null;}catch(e){return null;}
}
function writeRuntimeZoom(value){
  try{if(typeof CONFIG!=='undefined')CONFIG.zoom=value;}catch(e){}
}
function ensurePortraitBaseZoom(){
  if(Number.isFinite(portraitBaseZoom)&&portraitBaseZoom>0)return portraitBaseZoom;
  const runtime=readRuntimeZoom();
  portraitBaseZoom=Number.isFinite(runtime)&&runtime>0?runtime:0.82;
  return portraitBaseZoom;
}
function landscapeZoomFactor(){
  const w=Math.max(1,window.innerWidth),h=Math.max(1,window.innerHeight);
  if(w<=h)return 1;
  return h/w;
}
function effectiveZoomFor(base,orientation){
  return orientation==='landscape'?base*landscapeZoomFactor():base;
}
function applyCameraZoom(source){
  const base=ensurePortraitBaseZoom();
  const orientation=physicalOrientation();
  const effective=effectiveZoomFor(base,orientation);
  writeRuntimeZoom(effective);
  const changed=!Number.isFinite(lastEffectiveZoom)||Math.abs(lastEffectiveZoom-effective)>0.0001;
  lastEffectiveZoom=effective;
  document.documentElement.style.setProperty('--kelo-camera-zoom',String(effective));
  if(changed){
    window.dispatchEvent(new CustomEvent('kelo:camerazoomchange',{detail:{
      source:source||'orientation',orientation,baseZoom:base,effectiveZoom:effective,
      verticalWorldSpan:window.innerHeight/effective,
      portraitReferenceWorldSpan:Math.max(window.innerWidth,window.innerHeight)/base
    }}));
  }
  return effective;
}
function setBaseZoom(value,source){
  const next=Number(value);
  if(!Number.isFinite(next)||next<=0)return applyCameraZoom(source||'invalid-base');
  portraitBaseZoom=next;
  return applyCameraZoom(source||'set-base');
}
function nearestPresetIndex(value){
  let best=0,dist=Infinity;
  ZOOM_PRESETS.forEach((z,i)=>{const d=Math.abs(z-value);if(d<dist){dist=d;best=i;}});
  return best;
}
function installZoomBridge(){
  const previous=window.cycleZoom;
  if(typeof previous!=='function'||previous._keloEquivalentZoomBridge)return;
  const bridged=function(){
    const base=ensurePortraitBaseZoom();
    const i=nearestPresetIndex(base);
    const next=ZOOM_PRESETS[(i+1)%ZOOM_PRESETS.length];
    setBaseZoom(next,'cycle');
    toast('Zoom '+next+(physicalOrientation()==='landscape'?' · cámara adaptada':''));
    if(typeof window.closeMenu==='function')window.closeMenu();
  };
  bridged._keloEquivalentZoomBridge=true;
  bridged._previous=previous;
  window.cycleZoom=bridged;
}
function applyOrientation(source){
  syncViewportCss();
  const current=physicalOrientation();
  document.documentElement.dataset.keloOrientation=current;
  document.body?.classList.toggle('kelo-orientation-portrait',current==='portrait');
  document.body?.classList.toggle('kelo-orientation-landscape',current==='landscape');
  updateButton(current);
  applyCameraZoom(source||'orientation');
  if(current!==lastOrientation){
    const previous=lastOrientation;
    lastOrientation=current;
    window.dispatchEvent(new CustomEvent('kelo:orientationchange',{detail:{orientation:current,previous,source:source||'sync',width:window.innerWidth,height:window.innerHeight,baseZoom:ensurePortraitBaseZoom(),effectiveZoom:readRuntimeZoom()}}));
  }
  return current;
}
function scheduleSync(source){
  if(syncing)return;
  syncing=true;
  requestAnimationFrame(()=>{
    syncing=false;
    applyOrientation(source);
  });
}
function emitFullscreenChange(source){
  const active=fullscreenActive();
  const mode=fullscreenMode();
  document.documentElement.dataset.keloFullscreen=mode;
  document.body?.classList.toggle('kelo-fullscreen-active',active);
  document.body?.classList.toggle('kelo-immersive-fallback',immersiveFallback);
  updateButton();
  syncViewportCss();
  scheduleSync(source||'fullscreen');
  window.dispatchEvent(new CustomEvent('kelo:fullscreenchange',{detail:{
    active,
    nativeActive:nativeFullscreenActive(),
    supported:nativeFullscreenSupported(),
    mode,
    standalone:standaloneActive(),
    source:source||'fullscreen',
    width:window.innerWidth,
    height:window.innerHeight,
    orientation:physicalOrientation()
  }}));
  return active;
}
function closeFullscreenHelp(){
  document.getElementById('kelo-fullscreen-help')?.remove();
}
function installHelpCopy(){
  if(isChromeIOS())return{
    browser:'Chrome',
    intro:'iPhone no permite que un juego HTML ocupe fullscreen real desde Chrome. Kelo World activó el máximo espacio disponible.',
    steps:['1. Toca ••• abajo a la derecha.','2. Toca Compartir.','3. Elige “Añadir a pantalla de inicio”.','4. Abre Kelo World desde su icono.']
  };
  if(isFirefoxIOS())return{
    browser:'Firefox',
    intro:'iPhone no permite que un juego HTML ocupe fullscreen real desde Firefox. Kelo World activó el máximo espacio disponible.',
    steps:['1. Abre el menú del navegador.','2. Toca Compartir.','3. Elige “Añadir a pantalla de inicio”.','4. Abre Kelo World desde su icono.']
  };
  return{
    browser:'Safari',
    intro:'iPhone no permite que un juego HTML ocupe fullscreen real desde Safari. Kelo World activó el máximo espacio disponible.',
    steps:['1. Toca el botón Compartir de Safari.','2. Baja hasta “Añadir a pantalla de inicio”.','3. Toca Añadir.','4. Abre Kelo World desde su icono.']
  };
}
function showFullscreenHelp(){
  if(document.getElementById('kelo-fullscreen-help'))return;
  const info=installHelpCopy();
  const overlay=document.createElement('div');
  overlay.id='kelo-fullscreen-help';
  overlay.innerHTML=`<div class="kelo-fullscreen-help-card" role="dialog" aria-modal="true" aria-labelledby="kelo-fullscreen-help-title">
    <div class="kelo-fullscreen-help-mark">⛶</div>
    <div id="kelo-fullscreen-help-title" class="kelo-fullscreen-help-title">ABRIR KELO WORLD COMO APP</div>
    <div class="kelo-fullscreen-help-copy">${info.intro}</div>
    <div class="kelo-fullscreen-help-steps"><b>En ${info.browser}:</b>${info.steps.map(step=>`<span>${step}</span>`).join('')}</div>
    <button type="button" data-kelo-fullscreen-help-close>ENTENDIDO</button>
  </div>`;
  overlay.addEventListener('click',(e)=>{if(e.target===overlay||e.target.closest('[data-kelo-fullscreen-help-close]'))closeFullscreenHelp();});
  document.body.appendChild(overlay);
}
function enterImmersiveFallback(source){
  immersiveFallback=true;
  emitFullscreenChange(source||'immersive-fallback');
  if(isIOSFamily()&&!standaloneActive())showFullscreenHelp();
  else toast('Modo inmersivo activado');
  return true;
}
function exitImmersiveFallback(source){
  immersiveFallback=false;
  closeFullscreenHelp();
  emitFullscreenChange(source||'immersive-exit');
  return true;
}
async function requestFullscreenIfUseful(){
  if(fullscreenActive())return true;
  const root=document.documentElement;
  if(!nativeFullscreenSupported())return enterImmersiveFallback('fullscreen-unsupported');
  try{
    await root.requestFullscreen({navigationUI:'hide'});
    return true;
  }catch(e){
    return enterImmersiveFallback('fullscreen-denied');
  }
}
async function exitFullscreen(){
  if(nativeFullscreenActive()){
    if(typeof document.exitFullscreen!=='function')return false;
    try{await document.exitFullscreen();return true;}catch(e){return false;}
  }
  if(immersiveFallback)return exitImmersiveFallback('immersive-button-exit');
  if(standaloneActive()){
    toast('Kelo World está abierto como app. Sal con el gesto del sistema.');
    return false;
  }
  return true;
}
async function toggleFullscreen(){
  const el=button();
  if(el?.dataset.busy==='true')return false;
  if(el)el.dataset.busy='true';
  try{
    haptic();
    return fullscreenActive()?await exitFullscreen():await requestFullscreenIfUseful();
  }finally{
    if(el)el.dataset.busy='false';
    updateButton();
  }
}
async function requestOrientation(target){
  target=target==='landscape'?'landscape':'portrait';
  preferredOrientation=target;
  const locker=screen.orientation&&typeof screen.orientation.lock==='function';
  if(locker){
    try{
      await requestFullscreenIfUseful();
      await screen.orientation.lock(target);
      setTimeout(()=>{syncViewportCss();window.dispatchEvent(new Event('resize'));applyOrientation('lock');},120);
      toast(`Orientación ${labelFor(target)} activada`);
      return{ok:true,mode:'screen-orientation-lock',target};
    }catch(e){
      // iOS/WebKit y algunos navegadores no permiten forzar la orientación desde web.
    }
  }
  toast(`Gira el teléfono a ${labelFor(target)}. Kelo World se ajustará automáticamente.`);
  return{ok:false,mode:'physical-rotation-required',target};
}
async function toggle(){
  const current=physicalOrientation();
  return requestOrientation(current==='portrait'?'landscape':'portrait');
}
function unlock(){
  preferredOrientation=null;
  try{screen.orientation?.unlock?.();}catch(e){}
  applyOrientation('unlock');
}
function ensureButton(){
  if(button()||!isTouchDevice())return button();
  const style=document.createElement('style');
  style.id='kelo-orientation-style';
  style.textContent=`
    html,body{width:var(--kelo-vw,100vw)!important;height:var(--kelo-vh,100vh)!important;max-width:var(--kelo-vw,100vw)!important;max-height:var(--kelo-vh,100vh)!important;overflow:hidden!important}
    #game-canvas,#ui-layer,#kelo-luxe{width:var(--kelo-vw,100vw)!important;height:var(--kelo-vh,100vh)!important;max-width:var(--kelo-vw,100vw)!important;max-height:var(--kelo-vh,100vh)!important}
    #kelo-orientation-btn{position:relative;isolation:isolate;width:54px;min-height:54px;padding:5px 4px;border-radius:16px;border:1px solid color-mix(in srgb,var(--lx-gold,#e7c56a) 48%,transparent);background:linear-gradient(145deg,color-mix(in srgb,var(--lx-forest,#173f36) 48%,#0e1819),#091112);color:var(--lx-ivory,#fff4d6);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;box-shadow:0 9px 24px rgba(0,0,0,.30),inset 0 0 0 1px rgba(255,255,255,.035);font:800 7px/1.05 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;letter-spacing:.08em;pointer-events:auto;touch-action:manipulation;overflow:hidden;transition:transform .18s ease,border-color .22s ease,box-shadow .22s ease,background .22s ease}
    #kelo-orientation-btn::before{content:"";position:absolute;inset:-28%;z-index:-1;background:radial-gradient(circle,color-mix(in srgb,var(--lx-gold,#e7c56a) 20%,transparent),transparent 62%);opacity:0;transform:scale(.72);transition:opacity .24s ease,transform .24s ease}
    #kelo-orientation-btn .kelo-fullscreen-icon{width:24px;height:24px;color:var(--lx-gold,#e7c56a);filter:drop-shadow(0 0 8px color-mix(in srgb,var(--lx-gold,#e7c56a) 22%,transparent));transition:transform .22s ease,filter .22s ease}
    #kelo-orientation-btn .kelo-fullscreen-icon path{fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
    #kelo-orientation-btn [data-fullscreen-primary]{font-size:6.4px;color:var(--lx-ivory,#fff4d6);letter-spacing:.07em}
    #kelo-orientation-btn [data-fullscreen-secondary]{font-size:5.7px;color:var(--lx-muted,#aab7ae);letter-spacing:.055em}
    #kelo-orientation-btn:active{transform:scale(.94);border-color:color-mix(in srgb,var(--lx-gold,#e7c56a) 92%,transparent)}
    #kelo-orientation-btn:active .kelo-fullscreen-icon{transform:scale(1.08)}
    #kelo-orientation-btn[data-busy="true"]{pointer-events:none;opacity:.82}
    #kelo-orientation-btn[data-fullscreen="active"]{border-color:color-mix(in srgb,var(--lx-gold,#e7c56a) 80%,transparent);box-shadow:0 10px 28px rgba(0,0,0,.34),0 0 18px color-mix(in srgb,var(--lx-gold,#e7c56a) 10%,transparent),inset 0 0 0 1px rgba(255,255,255,.05)}
    #kelo-orientation-btn[data-fullscreen="active"]::before{opacity:1;transform:scale(1)}
    #kelo-orientation-btn[data-fullscreen="active"] .kelo-fullscreen-icon{transform:scale(.92);filter:drop-shadow(0 0 11px color-mix(in srgb,var(--lx-gold,#e7c56a) 34%,transparent))}
    .kelo-orientation-fallback{position:fixed;z-index:79;right:max(8px,env(safe-area-inset-right));top:max(190px,calc(env(safe-area-inset-top) + 182px));pointer-events:auto}
    body.kelo-immersive-fallback{position:fixed!important;inset:0!important;width:var(--kelo-vw,100vw)!important;height:var(--kelo-vh,100dvh)!important;overscroll-behavior:none!important;background:#05070a}
    :fullscreen{background:#05070a}
    :fullscreen #game-canvas,:fullscreen #ui-layer,:fullscreen #kelo-luxe{width:100vw!important;height:100vh!important;max-width:100vw!important;max-height:100vh!important}
    #kelo-fullscreen-help{position:fixed;inset:0;z-index:1000;display:grid;place-items:center;padding:max(18px,env(safe-area-inset-top)) max(18px,env(safe-area-inset-right)) max(18px,env(safe-area-inset-bottom)) max(18px,env(safe-area-inset-left));background:rgba(3,8,10,.68);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);pointer-events:auto}
    .kelo-fullscreen-help-card{width:min(340px,92vw);padding:22px 18px 18px;border-radius:24px;border:1px solid color-mix(in srgb,var(--lx-gold,#e7c56a) 48%,transparent);background:linear-gradient(155deg,rgba(21,48,43,.98),rgba(8,16,19,.99));box-shadow:0 24px 70px rgba(0,0,0,.48),inset 0 0 0 1px rgba(255,255,255,.035);color:var(--lx-ivory,#fff4d6);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;text-align:center}
    .kelo-fullscreen-help-mark{font-size:34px;line-height:1;color:var(--lx-gold,#e7c56a);text-shadow:0 0 18px color-mix(in srgb,var(--lx-gold,#e7c56a) 30%,transparent)}
    .kelo-fullscreen-help-title{margin-top:10px;font-size:12px;font-weight:900;letter-spacing:.12em;color:var(--lx-gold,#e7c56a)}
    .kelo-fullscreen-help-copy{margin-top:10px;font-size:12px;line-height:1.45;color:#e9efe9}
    .kelo-fullscreen-help-steps{margin-top:14px;padding:12px;border-radius:14px;background:rgba(0,0,0,.18);display:flex;flex-direction:column;gap:6px;text-align:left;font-size:11px;line-height:1.35;color:var(--lx-muted,#aab7ae)}
    .kelo-fullscreen-help-steps b{color:var(--lx-ivory,#fff4d6)}
    .kelo-fullscreen-help-card button{margin-top:15px;width:100%;height:42px;border-radius:13px;border:1px solid color-mix(in srgb,var(--lx-gold,#e7c56a) 58%,transparent);background:var(--lx-forest,#173f36);color:var(--lx-gold,#e7c56a);font:900 11px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;letter-spacing:.12em}
    @media (orientation:landscape){.kelo-orientation-fallback{top:max(154px,calc(env(safe-area-inset-top) + 146px))}}
    @media (max-height:430px) and (orientation:landscape){#kelo-orientation-btn{width:48px;min-height:48px;border-radius:14px}.kelo-orientation-fallback{top:max(128px,calc(env(safe-area-inset-top) + 120px))}.kelo-fullscreen-help-card{width:min(520px,82vw);padding:14px 16px}.kelo-fullscreen-help-copy{margin-top:7px}.kelo-fullscreen-help-steps{margin-top:8px;display:grid;grid-template-columns:1fr 1fr;gap:7px}.kelo-fullscreen-help-card button{margin-top:10px}}
    @media (prefers-reduced-motion:reduce){#kelo-orientation-btn,#kelo-orientation-btn::before,#kelo-orientation-btn .kelo-fullscreen-icon{transition:none!important}}
  `;
  document.head.appendChild(style);

  const el=document.createElement('button');
  el.id='kelo-orientation-btn';
  el.type='button';
  el.dataset.busy='false';
  el.innerHTML='<svg class="kelo-fullscreen-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4H5a1 1 0 0 0-1 1v3M16 4h3a1 1 0 0 1 1 1v3M8 20H5a1 1 0 0 1-1-1v-3M16 20h3a1 1 0 0 0 1-1v-3"/></svg><span data-fullscreen-primary>PANTALLA</span><span data-fullscreen-secondary>COMPLETA</span>';
  el.addEventListener('click',toggleFullscreen);
  const rail=document.querySelector('.lx-rail');
  if(rail)rail.appendChild(el);
  else{const wrap=document.createElement('div');wrap.className='kelo-orientation-fallback';wrap.appendChild(el);document.body.appendChild(wrap);}
  updateButton(physicalOrientation());
  return el;
}

function boot(){
  ensurePortraitBaseZoom();
  installZoomBridge();
  syncViewportCss();
  ensureButton();
  applyOrientation('boot');
  emitFullscreenChange('boot');
  window.addEventListener('resize',()=>scheduleSync('resize'),{passive:true});
  window.addEventListener('orientationchange',()=>{setTimeout(()=>{syncViewportCss();window.dispatchEvent(new Event('resize'));applyOrientation('orientationchange');},120);},{passive:true});
  window.visualViewport?.addEventListener('resize',()=>scheduleSync('visualViewport'),{passive:true});
  document.addEventListener('fullscreenchange',()=>emitFullscreenChange('native-fullscreen'));
  document.addEventListener('fullscreenerror',()=>{if(!nativeFullscreenActive())enterImmersiveFallback('fullscreenerror');});
  try{screen.orientation?.addEventListener?.('change',()=>scheduleSync('screen.orientation'));}catch(e){}
}

const fullscreenApi=Object.freeze({
  active:fullscreenActive,
  nativeActive:nativeFullscreenActive,
  mode:fullscreenMode,
  supported:nativeFullscreenSupported,
  standalone:standaloneActive,
  enter:requestFullscreenIfUseful,
  exit:exitFullscreen,
  toggle:toggleFullscreen
});

window.KELO_ORIENTATION=Object.freeze({
  version:VERSION,
  current:physicalOrientation,
  preferred:()=>preferredOrientation,
  request:requestOrientation,
  toggle,
  unlock,
  sync:()=>applyOrientation('api'),
  fullscreen:fullscreenApi,
  baseZoom:()=>ensurePortraitBaseZoom(),
  effectiveZoom:()=>readRuntimeZoom(),
  setBaseZoom:(value)=>setBaseZoom(value,'api'),
  verticalWorldSpan:()=>{const z=readRuntimeZoom()||1;return window.innerHeight/z;},
  portraitReferenceWorldSpan:()=>Math.max(window.innerWidth,window.innerHeight)/ensurePortraitBaseZoom(),
  supported:()=>({touch:isTouchDevice(),orientationLock:!!(screen.orientation&&typeof screen.orientation.lock==='function'),fullscreen:nativeFullscreenSupported(),standalone:standaloneActive(),ios:isIOSFamily(),chromeIOS:isChromeIOS(),firefoxIOS:isFirefoxIOS()})
});
window.KELO_ORIENTATION_AUDIT=Object.freeze({version:VERSION,autoDetect:true,viewportSync:true,fullscreenButton:true,fullscreenToggle:true,fullscreenEvent:true,fullscreenImmersiveFallback:true,iosFullscreenGuidance:true,iosBrowserAwareInstallGuidance:true,portrait:true,landscape:true,equivalentPortraitZoom:true,verticalFovLock:true,orientationLockProgressive:true,iosSafeFallback:true,reusesLuxeRail:true,reusesLuxeTokens:true});

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
