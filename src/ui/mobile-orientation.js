/* KELO-INDEX
 * area: UI
 * keys: MOBILE ORIENTATION ROTATE BUTTON PORTRAIT LANDSCAPE FULLSCREEN
 * hace: detecta la orientación real del teléfono, marca el layout y ofrece un botón para solicitar la orientación contraria
 * online: UI local; no contiene estado valioso ni autoridad compartida
 */
(function(){
'use strict';
if(window.KELO_ORIENTATION)return;

const VERSION='mobile-orientation-v1.0.0';
let lastOrientation=null;
let preferredOrientation=null;
let syncing=false;

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
function applyOrientation(source){
  const current=physicalOrientation();
  document.documentElement.dataset.keloOrientation=current;
  document.body?.classList.toggle('kelo-orientation-portrait',current==='portrait');
  document.body?.classList.toggle('kelo-orientation-landscape',current==='landscape');
  document.documentElement.style.setProperty('--kelo-vw',`${window.innerWidth}px`);
  document.documentElement.style.setProperty('--kelo-vh',`${window.innerHeight}px`);
  updateButton(current);
  if(current!==lastOrientation){
    const previous=lastOrientation;
    lastOrientation=current;
    window.dispatchEvent(new CustomEvent('kelo:orientationchange',{detail:{orientation:current,previous,source:source||'sync',width:window.innerWidth,height:window.innerHeight}}));
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
      setTimeout(()=>{window.dispatchEvent(new Event('resize'));applyOrientation('lock');},120);
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
  ensureButton();
  applyOrientation('boot');
  window.addEventListener('resize',()=>scheduleSync('resize'),{passive:true});
  window.addEventListener('orientationchange',()=>{setTimeout(()=>{window.dispatchEvent(new Event('resize'));applyOrientation('orientationchange');},120);},{passive:true});
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
  supported:()=>({touch:isTouchDevice(),orientationLock:!!(screen.orientation&&typeof screen.orientation.lock==='function'),fullscreen:!!document.fullscreenEnabled})
});
window.KELO_ORIENTATION_AUDIT=Object.freeze({version:VERSION,autoDetect:true,rotateButton:true,portrait:true,landscape:true,orientationLockProgressive:true,iosSafeFallback:true});

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
