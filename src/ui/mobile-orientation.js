/* KELO-INDEX
 * area: UI
 * keys: MOBILE ORIENTATION ROTATE BUTTON PORTRAIT LANDSCAPE FULLSCREEN VIEWPORT CAMERA ZOOM BALANCED FOV
 * hace: detecta la orientación, sincroniza viewport y usa un zoom horizontal equilibrado para conservar escala visual sin desperdiciar el ancho
 * online: UI/cámara local; no contiene estado valioso ni autoridad compartida
 */
(function(){
'use strict';
if(window.KELO_ORIENTATION)return;

const VERSION='mobile-orientation-v1.3.0';
const ZOOM_PRESETS=Object.freeze([0.7,0.82,1]);
const LANDSCAPE_MIN_SCALE=0.72;
let lastOrientation=null;
let preferredOrientation=null;
let syncing=false;
let portraitBaseZoom=null;
let lastEffectiveZoom=null;

function isTouchDevice(){
  return (navigator.maxTouchPoints||0)>0 || !!window.matchMedia?.('(pointer: coarse)').matches;
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
function button(){return document.getElementById('kelo-orientation-btn');}
function updateButton(current){
  const el=button(); if(!el)return;
  const target=current==='portrait'?'landscape':'portrait';
  el.dataset.orientation=current;
  el.dataset.target=target;
  el.setAttribute('aria-label',`Cambiar a ${labelFor(target)}`);
  el.setAttribute('title',`Cambiar a ${labelFor(target)}`);
  const value=el.querySelector('[data-orientation-label]');
  if(value)value.textContent=current==='portrait'?'VERTICAL':'HORIZONTAL';
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
  const aspectRatio=h/w;
  // Compensación perceptual: mitad de camino en escala logarítmica entre
  // mantener el zoom idéntico y conservar exactamente el FOV vertical.
  // El piso evita que teléfonos muy anchos alejen demasiado al personaje.
  return Math.max(LANDSCAPE_MIN_SCALE,Math.sqrt(aspectRatio));
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
  document.documentElement.style.setProperty('--kelo-landscape-zoom-scale',String(landscapeZoomFactor()));
  if(changed){
    window.dispatchEvent(new CustomEvent('kelo:camerazoomchange',{detail:{
      source:source||'orientation',orientation,baseZoom:base,effectiveZoom:effective,
      landscapeScale:landscapeZoomFactor(),verticalWorldSpan:window.innerHeight/effective,
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
    window.dispatchEvent(new CustomEvent('kelo:orientationchange',{detail:{orientation:current,previous,source:source||'sync',width:window.innerWidth,height:window.innerHeight,baseZoom:ensurePortraitBaseZoom(),effectiveZoom:readRuntimeZoom(),landscapeScale:landscapeZoomFactor()}}));
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
async function requestFullscreenIfUseful(){
  if(document.fullscreenElement||!document.fullscreenEnabled)return false;
  const root=document.documentElement;
  if(typeof root.requestFullscreen!=='function')return false;
  try{await root.requestFullscreen({navigationUI:'hide'});return true;}catch(e){return false;}
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
    #kelo-orientation-btn{width:54px;min-height:50px;padding:5px 4px;border-radius:16px;border:1px solid rgba(231,197,106,.48);background:linear-gradient(145deg,rgba(22,37,35,.97),rgba(9,17,18,.97));color:#fff4d6;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;box-shadow:0 9px 24px rgba(0,0,0,.3);font:800 7px/1.05 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;letter-spacing:.08em;pointer-events:auto;touch-action:manipulation}
    #kelo-orientation-btn .kelo-rotate-icon{font-size:22px;line-height:22px;color:#e7c56a;transition:transform .18s ease}
    #kelo-orientation-btn:active{transform:scale(.96);border-color:rgba(231,197,106,.92)}
    #kelo-orientation-btn:active .kelo-rotate-icon{transform:rotate(35deg)}
    #kelo-orientation-btn [data-orientation-label]{font-size:6px;color:#aab7ae;letter-spacing:.05em;max-width:46px;overflow:hidden;text-overflow:ellipsis}
    .kelo-orientation-fallback{position:fixed;z-index:79;right:max(8px,env(safe-area-inset-right));top:max(190px,calc(env(safe-area-inset-top) + 182px));pointer-events:auto}
    @media (orientation:landscape){.kelo-orientation-fallback{top:max(154px,calc(env(safe-area-inset-top) + 146px))}}
    @media (max-height:430px) and (orientation:landscape){#kelo-orientation-btn{width:48px;min-height:44px;border-radius:14px}.kelo-orientation-fallback{top:max(128px,calc(env(safe-area-inset-top) + 120px))}}
  `;
  document.head.appendChild(style);

  const el=document.createElement('button');
  el.id='kelo-orientation-btn';
  el.type='button';
  el.innerHTML='<span class="kelo-rotate-icon">↻</span><span>GIRAR</span><span data-orientation-label></span>';
  el.addEventListener('click',toggle);
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
  window.addEventListener('resize',()=>scheduleSync('resize'),{passive:true});
  window.addEventListener('orientationchange',()=>{setTimeout(()=>{syncViewportCss();window.dispatchEvent(new Event('resize'));applyOrientation('orientationchange');},120);},{passive:true});
  window.visualViewport?.addEventListener('resize',()=>scheduleSync('visualViewport'),{passive:true});
  try{screen.orientation?.addEventListener?.('change',()=>scheduleSync('screen.orientation'));}catch(e){}
}

window.KELO_ORIENTATION=Object.freeze({
  version:VERSION,
  current:physicalOrientation,
  preferred:()=>preferredOrientation,
  request:requestOrientation,
  toggle,
  unlock,
  sync:()=>applyOrientation('api'),
  baseZoom:()=>ensurePortraitBaseZoom(),
  effectiveZoom:()=>readRuntimeZoom(),
  landscapeScale:()=>landscapeZoomFactor(),
  setBaseZoom:(value)=>setBaseZoom(value,'api'),
  verticalWorldSpan:()=>{const z=readRuntimeZoom()||1;return window.innerHeight/z;},
  portraitReferenceWorldSpan:()=>Math.max(window.innerWidth,window.innerHeight)/ensurePortraitBaseZoom(),
  supported:()=>({touch:isTouchDevice(),orientationLock:!!(screen.orientation&&typeof screen.orientation.lock==='function'),fullscreen:!!document.fullscreenEnabled})
});
window.KELO_ORIENTATION_AUDIT=Object.freeze({version:VERSION,autoDetect:true,viewportSync:true,rotateButton:true,portrait:true,landscape:true,balancedLandscapeZoom:true,minimumLandscapeScale:LANDSCAPE_MIN_SCALE,verticalFovLock:false,orientationLockProgressive:true,iosSafeFallback:true});

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
