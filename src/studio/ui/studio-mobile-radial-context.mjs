/* KELO-INDEX
 * area: STUDIO / MOBILE RADIAL CONTEXT
 * owner: presentation layer only
 * owns: optional long-press radial shortcuts while Studio is in select mode
 * does-not-own: world input, editor commands, selection, paint, camera, assets or persistence
 * public-api: installStudioMobileRadialContext()
 */

const KEY='__KELO_STUDIO_MOBILE_RADIAL_CONTEXT_V1__';
const STYLE_ID='kelo-studio-mobile-radial-context-v1';
const MOBILE_QUERY='(max-width:760px)';
const LONG_PRESS_MS=520;
const MOVE_TOLERANCE_PX=12;
const NATIVE_CONTEXT_SUPPRESS_MS=900;

const CONTEXT_ACTIONS=Object.freeze({
  canvas:Object.freeze([
    {label:'GROUND',kind:'mode',value:'terrain',slot:'top'},
    {label:'ROAD',kind:'mode',value:'path',slot:'right'},
    {label:'EDIT',kind:'act',value:'edit-assets',slot:'left'},
    {label:'MÁS',special:'more',slot:'bottom'},
  ]),
  selection:Object.freeze([
    {label:'ROTAR',kind:'act',value:'rotate',slot:'top'},
    {label:'DUPLICAR',kind:'act',value:'duplicate',slot:'right'},
    {label:'MÁS',special:'more',slot:'left'},
    {label:'BORRAR',kind:'act',value:'delete',slot:'bottom',danger:true},
  ]),
});

const CSS=`
#kelo-studio-live .ks-radial-layer{display:none}
@media(max-width:760px){
  #kelo-studio-live .ks-radial-layer[data-open="1"]{
    display:block;position:fixed;inset:0;z-index:2147482310;pointer-events:auto;
    background:rgba(1,6,8,.14);touch-action:none
  }
  #kelo-studio-live .ks-radial-menu{
    position:fixed;left:var(--ks-radial-x);top:var(--ks-radial-y);width:1px;height:1px;
    filter:drop-shadow(0 15px 26px rgba(0,0,0,.5))
  }
  #kelo-studio-live .ks-radial-menu button{
    position:absolute;width:72px!important;min-width:72px!important;height:54px!important;min-height:54px!important;
    padding:0 5px!important;border:1px solid rgba(231,197,106,.5)!important;border-radius:16px!important;
    background:linear-gradient(180deg,rgba(29,58,48,.985),rgba(12,31,28,.99))!important;
    color:#fff0b2!important;font-size:6.6px!important;font-weight:950!important;letter-spacing:.035em!important;
    box-shadow:inset 0 1px 0 rgba(255,255,255,.06)!important;touch-action:manipulation
  }
  #kelo-studio-live .ks-radial-menu button[data-slot="top"]{left:-36px;top:-112px}
  #kelo-studio-live .ks-radial-menu button[data-slot="right"]{left:42px;top:-27px}
  #kelo-studio-live .ks-radial-menu button[data-slot="bottom"]{left:-36px;top:58px}
  #kelo-studio-live .ks-radial-menu button[data-slot="left"]{left:-114px;top:-27px}
  #kelo-studio-live .ks-radial-menu button[data-kelo-danger="1"]{
    border-color:rgba(255,122,112,.66)!important;background:rgba(75,25,25,.96)!important;color:#ffd4cf!important
  }
  #kelo-studio-live .ks-radial-center{
    position:absolute;left:-25px;top:-25px;width:50px;height:50px;border-radius:999px;
    display:grid;place-items:center;border:1px solid rgba(231,197,106,.42);
    background:rgba(7,18,20,.99);color:#e7c56a;font-size:18px;font-weight:900
  }
  #kelo-studio-live .ks-radial-caption{
    position:absolute;left:-76px;top:98px;width:152px;text-align:center;color:#a5bbb2;
    font-size:6px;font-weight:850;letter-spacing:.09em;pointer-events:none
  }
}
@media(prefers-reduced-motion:no-preference){
  #kelo-studio-live .ks-radial-layer[data-open="1"] .ks-radial-menu{animation:ksRadialIn .13s ease-out}
  @keyframes ksRadialIn{from{opacity:0;transform:scale(.84)}to{opacity:1;transform:scale(1)}}
}
@media(prefers-reduced-motion:reduce){
  #kelo-studio-live .ks-radial-layer,#kelo-studio-live .ks-radial-menu{animation:none!important;transition:none!important}
}
`;

function isMobile(root){
  if(typeof root?.matchMedia==='function')return root.matchMedia(MOBILE_QUERY).matches;
  return Number(root?.innerWidth||0)<=760;
}

function ensureStyle(doc){
  let style=doc.getElementById(STYLE_ID);
  if(style)return style;
  style=doc.createElement('style');style.id=STYLE_ID;style.textContent=CSS;doc.head.append(style);return style;
}

function externalCanvasFromEvent(event,shell){
  const path=typeof event?.composedPath==='function'?event.composedPath():[event?.target];
  for(const node of path){
    if(node?.tagName==='CANVAS'&&!shell.contains(node))return node;
  }
  return null;
}

function selectModeActive(shell){
  return !!shell.querySelector('.ks-deck [data-mode="select"].on');
}

function sourceFor(shell,action){
  if(action.special==='more')return shell.querySelector('.ks-mobile-more');
  const attr=action.kind==='mode'?'data-mode':'data-act';
  return shell.querySelector(`.ks-deck [${attr}="${action.value}"]`);
}

function clampPoint(root,x,y){
  const width=Math.max(320,Number(root?.innerWidth||390));
  const height=Math.max(480,Number(root?.innerHeight||844));
  return {
    x:Math.min(width-126,Math.max(126,Number(x)||width/2)),
    y:Math.min(height-174,Math.max(132,Number(y)||height/2)),
  };
}

function createController(shell,root){
  const doc=shell.ownerDocument;
  let layer=shell.querySelector(':scope > .ks-radial-layer');
  if(!layer){
    layer=doc.createElement('div');
    layer.className='ks-radial-layer';layer.dataset.open='0';
    layer.innerHTML='<div class="ks-radial-menu" role="menu" aria-label="Acciones rápidas del editor"><button type="button" class="ks-radial-center" aria-label="Cerrar menú rápido">×</button><div class="ks-radial-caption"></div></div>';
    shell.append(layer);
  }
  const menu=layer.querySelector('.ks-radial-menu');
  const center=layer.querySelector('.ks-radial-center');
  const caption=layer.querySelector('.ks-radial-caption');
  let timer=0,pointerId=null,startX=0,startY=0,openedAt=0,previousFocus=null,destroyed=false;

  const clearHold=()=>{if(timer){root.clearTimeout?.(timer);timer=0;}pointerId=null;};
  const close=({restoreFocus=true}={})=>{
    clearHold();layer.dataset.open='0';menu.querySelectorAll('[data-radial-action]').forEach(node=>node.remove());
    if(restoreFocus&&previousFocus?.isConnected&&typeof previousFocus.focus==='function')previousFocus.focus({preventScroll:true});
    previousFocus=null;
  };

  const execute=action=>{
    const source=sourceFor(shell,action);
    if(!source||source.disabled)return false;
    close({restoreFocus:false});
    source.click();
    return true;
  };

  const openAt=(x,y,{origin='longpress'}={})=>{
    if(destroyed||!isMobile(root)||!selectModeActive(shell))return false;
    const context=Math.max(0,Number(shell.dataset.selectionCount||0))>0?'selection':'canvas';
    const actions=CONTEXT_ACTIONS[context].filter(action=>{
      const source=sourceFor(shell,action);return !!source&&!source.disabled;
    });
    if(!actions.length)return false;
    const point=clampPoint(root,x,y);
    menu.style.setProperty('--ks-radial-x',`${point.x}px`);
    menu.style.setProperty('--ks-radial-y',`${point.y}px`);
    previousFocus=doc.activeElement;
    menu.querySelectorAll('[data-radial-action]').forEach(node=>node.remove());
    actions.forEach(action=>{
      const button=doc.createElement('button');
      button.type='button';button.textContent=action.label;button.dataset.radialAction=action.special||`${action.kind}:${action.value}`;button.dataset.slot=action.slot;
      button.setAttribute('role','menuitem');
      if(action.danger)button.dataset.keloDanger='1';
      button.setAttribute('aria-label',sourceFor(shell,action)?.getAttribute?.('aria-label')||action.label);
      button.addEventListener('click',()=>execute(action));
      menu.append(button);
    });
    caption.textContent=context==='selection'
      ?`${Math.max(1,Number(shell.dataset.selectionCount||1))} OBJETO${Number(shell.dataset.selectionCount||1)>1?'S':''} · MENÚ RÁPIDO`
      :'CANVAS · MENÚ RÁPIDO';
    menu.setAttribute('aria-label',context==='selection'?'Acciones rápidas para la selección':'Acciones rápidas del canvas');
    layer.dataset.open='1';layer.dataset.origin=origin;openedAt=Date.now();
    queueMicrotask(()=>menu.querySelector('[data-radial-action]')?.focus?.({preventScroll:true}));
    return true;
  };

  center.addEventListener('click',()=>close());
  layer.addEventListener('pointerdown',event=>{if(event.target===layer){event.preventDefault();close();}});
  layer.addEventListener('contextmenu',event=>event.preventDefault());

  const onKeyDown=event=>{
    if(layer.dataset.open!=='1')return;
    if(event.key==='Escape'){event.preventDefault();close();return;}
    if(event.key==='Tab'){
      const focusables=[...menu.querySelectorAll('button:not(:disabled)')];
      if(!focusables.length)return;
      const current=focusables.indexOf(doc.activeElement);
      const next=event.shiftKey?(current<=0?focusables.length-1:current-1):(current<0||current===focusables.length-1?0:current+1);
      event.preventDefault();focusables[next]?.focus?.();
    }
  };
  doc.addEventListener('keydown',onKeyDown,true);

  const onPointerDown=event=>{
    if(!isMobile(root)||layer.dataset.open==='1'||!selectModeActive(shell))return;
    if(event.isPrimary===false||!['touch','pen'].includes(event.pointerType))return;
    if(!externalCanvasFromEvent(event,shell))return;
    clearHold();pointerId=event.pointerId;startX=event.clientX;startY=event.clientY;
    timer=root.setTimeout?.(()=>{
      timer=0;
      if(pointerId===null)return;
      openAt(startX,startY,{origin:'longpress'});
    },LONG_PRESS_MS)||0;
  };
  const onPointerMove=event=>{
    if(pointerId===null||event.pointerId!==pointerId)return;
    if(Math.hypot(event.clientX-startX,event.clientY-startY)>MOVE_TOLERANCE_PX)clearHold();
  };
  const onPointerEnd=event=>{if(pointerId!==null&&event.pointerId===pointerId)clearHold();};
  const onContextMenu=event=>{
    if(!isMobile(root)||!selectModeActive(shell)||!externalCanvasFromEvent(event,shell))return;
    if(Date.now()-openedAt<NATIVE_CONTEXT_SUPPRESS_MS){event.preventDefault();return;}
    event.preventDefault();openAt(event.clientX,event.clientY,{origin:'contextmenu'});
  };
  doc.addEventListener('pointerdown',onPointerDown,true);
  doc.addEventListener('pointermove',onPointerMove,true);
  doc.addEventListener('pointerup',onPointerEnd,true);
  doc.addEventListener('pointercancel',onPointerEnd,true);
  doc.addEventListener('contextmenu',onContextMenu,true);

  return Object.freeze({
    openAt,close,
    destroy(){
      if(destroyed)return;destroyed=true;clearHold();close({restoreFocus:false});
      doc.removeEventListener('keydown',onKeyDown,true);
      doc.removeEventListener('pointerdown',onPointerDown,true);
      doc.removeEventListener('pointermove',onPointerMove,true);
      doc.removeEventListener('pointerup',onPointerEnd,true);
      doc.removeEventListener('pointercancel',onPointerEnd,true);
      doc.removeEventListener('contextmenu',onContextMenu,true);
      layer.remove();
    }
  });
}

export function installStudioMobileRadialContext({root=globalThis}={}){
  const doc=root?.document;
  if(!doc)return Object.freeze({version:'studio-mobile-radial-context-v1',refresh:()=>null,destroy:()=>{}});
  const existing=root[KEY];if(existing?.refresh){existing.refresh();return existing;}
  const style=ensureStyle(doc);
  const MutationObserverCtor=root.MutationObserver||globalThis.MutationObserver;
  let destroyed=false,bodyObserver=null,controller=null,observedShell=null;
  const refresh=()=>{
    if(destroyed)return null;
    const shell=doc.getElementById('kelo-studio-live');
    if(!shell)return null;
    if(shell!==observedShell){controller?.destroy?.();observedShell=shell;controller=createController(shell,root);}
    return controller;
  };
  refresh();
  if(MutationObserverCtor){bodyObserver=new MutationObserverCtor(()=>refresh());bodyObserver.observe(doc.body||doc.documentElement,{childList:true,subtree:false});}
  const api=Object.freeze({
    version:'studio-mobile-radial-context-v1.0.0',refresh,
    openAt(x,y){return refresh()?.openAt?.(x,y)||false;},
    close(){return refresh()?.close?.();},
    destroy(){
      if(destroyed)return;destroyed=true;bodyObserver?.disconnect?.();controller?.destroy?.();controller=null;observedShell=null;style.remove();
      try{if(root[KEY]===api)delete root[KEY];}catch{}
    }
  });
  try{root[KEY]=api;}catch{}
  return api;
}
