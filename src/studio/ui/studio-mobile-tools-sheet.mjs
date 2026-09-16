/* KELO-INDEX
 * area: STUDIO / MOBILE TOOLS SHEET
 * owner: presentation layer only
 * owns: mobile advanced-tools bottom sheet, categories, context defaults, focus return, swipe dismissal and command proxies
 * does-not-own: editor commands, tool state, selection, camera, paint, assets or persistence
 * public-api: installStudioMobileToolsSheet()
 */

const KEY='__KELO_STUDIO_MOBILE_TOOLS_SHEET_V2__';
const STYLE_ID='kelo-studio-mobile-tools-sheet-v2';
const MOBILE_QUERY='(max-width:760px)';
const STORAGE_KEY='kelo.studio.mobileTools.lastCategory';
const SWIPE_DISMISS_PX=72;
const SWIPE_DISMISS_VELOCITY=.65;

const CATEGORIES=Object.freeze([
  Object.freeze({
    id:'build',label:'CONSTRUIR',items:Object.freeze([
      {label:'EDITAR ASSETS',kind:'act',value:'edit-assets'},
      {label:'SELECT',kind:'mode',value:'select'},
      {label:'MOVE',kind:'mode',value:'move'},
    ])
  }),
  Object.freeze({
    id:'terrain',label:'TERRENO',items:Object.freeze([
      {label:'GROUND',kind:'mode',value:'terrain'},
      {label:'ROAD',kind:'mode',value:'path'},
      {label:'COLLISION',kind:'mode',value:'collision'},
      {label:'ERASE',kind:'act',value:'erase'},
    ])
  }),
  Object.freeze({
    id:'transform',label:'TRANSFORMAR',items:Object.freeze([
      {label:'UNDO',kind:'act',value:'undo'},
      {label:'REDO',kind:'act',value:'redo'},
      {label:'ROTAR',kind:'act',value:'rotate'},
      {label:'ESCALA −',kind:'act',value:'scale-down'},
      {label:'100%',kind:'act',value:'scale-reset'},
      {label:'ESCALA +',kind:'act',value:'scale-up'},
      {label:'DUPLICAR',kind:'act',value:'duplicate'},
      {label:'BORRAR',kind:'act',value:'delete',danger:true},
    ])
  }),
  Object.freeze({
    id:'view',label:'VISTA',items:Object.freeze([
      {label:'PLAY',kind:'act',value:'play',scope:'shell'},
      {label:'SAVE',kind:'act',value:'save',scope:'shell'},
      {label:'ENFOCAR',kind:'act',value:'focus',scope:'shell',optional:true},
    ])
  }),
]);
const CATEGORY_IDS=new Set(CATEGORIES.map(category=>category.id));

const CSS=`
#kelo-studio-live .ks-tools-sheet{display:none}
@media(max-width:760px){
  #kelo-studio-live .ks-tools-sheet[open]{
    display:block;position:fixed;inset:auto 8px max(8px,env(safe-area-inset-bottom)) 8px;
    width:auto;max-width:none;max-height:min(72dvh,620px);margin:0;padding:0;
    overflow:hidden;border:1px solid rgba(231,197,106,.48);border-radius:24px;
    background:linear-gradient(180deg,rgba(8,20,21,.995),rgba(4,12,14,.995));
    color:#edf4ef;pointer-events:auto;box-shadow:0 26px 80px rgba(0,0,0,.68),inset 0 1px 0 rgba(255,255,255,.05);
    transform:translate3d(0,var(--ks-sheet-drag-y,0px),0);transition:transform 170ms cubic-bezier(.2,.8,.2,1)
  }
  #kelo-studio-live .ks-tools-sheet[data-dragging="1"]{transition:none!important}
  #kelo-studio-live .ks-tools-sheet::backdrop{background:rgba(1,6,8,.58);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px)}
  #kelo-studio-live .ks-tools-sheet-handle-zone{touch-action:none;cursor:grab;padding:7px 0 1px}
  #kelo-studio-live .ks-tools-sheet[data-dragging="1"] .ks-tools-sheet-handle-zone{cursor:grabbing}
  #kelo-studio-live .ks-tools-sheet-handle{width:42px;height:5px;border-radius:999px;background:rgba(255,255,255,.25);margin:0 auto}
  #kelo-studio-live .ks-tools-sheet-head{display:flex;align-items:center;gap:10px;padding:5px 12px 9px;border-bottom:1px solid rgba(231,197,106,.13)}
  #kelo-studio-live .ks-tools-sheet-title{min-width:0;flex:1}
  #kelo-studio-live .ks-tools-sheet-title small{display:block;font-size:7px;font-weight:900;letter-spacing:.18em;color:#8da59b}
  #kelo-studio-live .ks-tools-sheet-title strong{display:block;margin-top:3px;font:800 15px/1 Georgia,"Times New Roman",serif;color:#f2d982}
  #kelo-studio-live .ks-tools-sheet-context{display:block;margin-top:4px;font-size:6px;font-weight:800;letter-spacing:.07em;color:#819990}
  #kelo-studio-live .ks-tools-sheet-close{width:44px;min-width:44px;height:44px;border-radius:13px!important;font-size:20px!important;padding:0!important}
  #kelo-studio-live .ks-tools-sheet-tabs{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:5px;padding:8px 10px 5px}
  #kelo-studio-live .ks-tools-sheet-tabs button{min-width:0!important;min-height:46px!important;padding:0 3px!important;border-radius:12px!important;font-size:5.9px!important;white-space:nowrap!important}
  #kelo-studio-live .ks-tools-sheet-tabs button[aria-selected="true"]{border-color:var(--ks-gold,#e7c56a)!important;background:linear-gradient(180deg,#2b4d40,#1b392f)!important;color:#fff0b2!important}
  #kelo-studio-live .ks-tools-sheet-body{padding:7px 10px calc(10px + env(safe-area-inset-bottom));overflow:auto;overscroll-behavior:contain;max-height:min(53dvh,470px)}
  #kelo-studio-live .ks-tools-sheet-panel[hidden]{display:none!important}
  #kelo-studio-live .ks-tools-sheet-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}
  #kelo-studio-live .ks-tools-sheet-grid button{min-width:0!important;min-height:50px!important;border-radius:13px!important;font-size:7px!important;padding:0 8px!important}
  #kelo-studio-live .ks-tools-sheet-grid button[data-kelo-danger="1"]{border-color:rgba(255,122,112,.52)!important;color:#ffd4cf!important;background:rgba(70,24,24,.5)!important}
  #kelo-studio-live .ks-tools-sheet-grid button.on{border-color:var(--ks-gold,#e7c56a)!important;background:linear-gradient(180deg,#2b4d40,#1b392f)!important;color:#fff0b2!important}
  #kelo-studio-live .ks-tools-sheet-empty{padding:18px 10px;text-align:center;color:#8da59b;font-size:9px}
}
@media(max-width:390px){
  #kelo-studio-live .ks-tools-sheet{inset-inline:6px!important}
  #kelo-studio-live .ks-tools-sheet-tabs{gap:4px;padding-inline:8px}
  #kelo-studio-live .ks-tools-sheet-tabs button{font-size:5.4px!important}
}
@media(prefers-reduced-motion:reduce){
  #kelo-studio-live .ks-tools-sheet,#kelo-studio-live .ks-tools-sheet *{animation:none!important;transition:none!important}
}
`;

function isMobile(root){
  if(typeof root?.matchMedia==='function')return root.matchMedia(MOBILE_QUERY).matches;
  return Number(root?.innerWidth||0)<=760;
}

function ensureStyle(doc){
  let style=doc.getElementById(STYLE_ID);
  if(style)return style;
  style=doc.createElement('style');
  style.id=STYLE_ID;
  style.dataset.keloStudioMobileToolsSheet='2';
  style.textContent=CSS;
  doc.head.append(style);
  return style;
}

function storageGet(root){
  try{
    const value=root?.sessionStorage?.getItem?.(STORAGE_KEY);
    return CATEGORY_IDS.has(value)?value:null;
  }catch{return null;}
}

function storageSet(root,value){
  if(!CATEGORY_IDS.has(value))return;
  try{root?.sessionStorage?.setItem?.(STORAGE_KEY,value);}catch{}
}

function commandSource(shell,item){
  const attr=item.kind==='mode'?'data-mode':'data-act';
  const scope=item.scope==='shell'?shell:shell.querySelector('.ks-deck')||shell;
  return scope.querySelector(`[${attr}="${item.value}"]`);
}

function activeMode(shell){
  return shell.querySelector('.ks-deck [data-mode].on')?.dataset?.mode||null;
}

function preferredCategory(shell,root,dialog){
  const selected=Math.max(0,Number(shell.dataset.selectionCount||0));
  if(selected>0)return {id:'transform',reason:'OBJETO SELECCIONADO'};
  const mode=activeMode(shell);
  if(['terrain','path','collision'].includes(mode))return {id:'terrain',reason:'MODO DE TERRENO'};
  const remembered=storageGet(root)||dialog?.dataset?.category;
  if(CATEGORY_IDS.has(remembered))return {id:remembered,reason:'ÚLTIMA CATEGORÍA'};
  return {id:'build',reason:'HERRAMIENTAS PRINCIPALES'};
}

function makeProxy(doc,shell,item,closeSheet){
  const source=commandSource(shell,item);
  if(!source&&item.optional)return null;
  const button=doc.createElement('button');
  button.type='button';
  button.textContent=item.label;
  button.dataset.keloToolProxy=`${item.kind}:${item.value}`;
  if(item.danger)button.dataset.keloDanger='1';
  button.disabled=!source||!!source.disabled;
  button.classList.toggle('on',!!source?.classList?.contains('on'));
  button.setAttribute('aria-label',source?.getAttribute?.('aria-label')||item.label);
  button.addEventListener('click',()=>{
    const current=commandSource(shell,item);
    if(!current||current.disabled)return;
    current.click();
    closeSheet({restoreFocus:false});
  });
  return button;
}

function resetDrag(dialog){
  dialog.dataset.dragging='0';
  dialog.style.setProperty('--ks-sheet-drag-y','0px');
}

function installSwipeDismiss(dialog){
  if(dialog.dataset.swipeBound==='1')return;
  dialog.dataset.swipeBound='1';
  const zone=dialog.querySelector('.ks-tools-sheet-handle-zone');
  if(!zone)return;
  let pointerId=null,startY=0,lastY=0,lastTime=0,velocity=0;

  const finish=(event,cancel=false)=>{
    if(pointerId===null||(!cancel&&event?.pointerId!==pointerId))return;
    const delta=Math.max(0,lastY-startY);
    const shouldClose=!cancel&&(delta>=SWIPE_DISMISS_PX||velocity>=SWIPE_DISMISS_VELOCITY);
    try{zone.releasePointerCapture?.(pointerId);}catch{}
    pointerId=null;
    if(shouldClose){
      dialog.style.setProperty('--ks-sheet-drag-y','110%');
      dialog.dataset.dragging='0';
      const close=()=>{if(dialog.open)dialog.close();resetDrag(dialog);};
      const reduced=dialog.ownerDocument.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
      if(reduced)close();else setTimeout(close,150);
    }else resetDrag(dialog);
  };

  zone.addEventListener('pointerdown',event=>{
    if(pointerId!==null)return;
    pointerId=event.pointerId;startY=lastY=event.clientY;lastTime=performance.now();velocity=0;
    dialog.dataset.dragging='1';
    try{zone.setPointerCapture?.(pointerId);}catch{}
  });
  zone.addEventListener('pointermove',event=>{
    if(event.pointerId!==pointerId)return;
    const now=performance.now();
    const dy=event.clientY-lastY,dt=Math.max(1,now-lastTime);
    velocity=Math.max(0,dy/dt);lastY=event.clientY;lastTime=now;
    const delta=Math.max(0,lastY-startY);
    dialog.style.setProperty('--ks-sheet-drag-y',`${Math.min(delta,220)}px`);
    if(delta>0)event.preventDefault();
  });
  zone.addEventListener('pointerup',event=>finish(event,false));
  zone.addEventListener('pointercancel',event=>finish(event,true));
  zone.addEventListener('lostpointercapture',event=>finish(event,true));
}

function buildSheet(shell,root){
  const doc=shell.ownerDocument;
  let dialog=shell.querySelector(':scope > .ks-tools-sheet');
  if(dialog)return dialog;

  dialog=doc.createElement('dialog');
  dialog.className='ks-tools-sheet';
  dialog.setAttribute('aria-labelledby','ks-tools-sheet-title');
  dialog.innerHTML=`
    <div class="ks-tools-sheet-handle-zone" aria-label="Desliza hacia abajo para cerrar">
      <div class="ks-tools-sheet-handle" aria-hidden="true"></div>
    </div>
    <div class="ks-tools-sheet-head">
      <div class="ks-tools-sheet-title" id="ks-tools-sheet-title" tabindex="-1">
        <small>HERRAMIENTAS DEL EDITOR</small><strong>MÁS</strong><span class="ks-tools-sheet-context"></span>
      </div>
      <button type="button" class="ks-tools-sheet-close" aria-label="Cerrar herramientas">×</button>
    </div>
    <div class="ks-tools-sheet-tabs" role="tablist" aria-label="Categorías de herramientas"></div>
    <div class="ks-tools-sheet-body"></div>`;
  shell.append(dialog);
  installSwipeDismiss(dialog);

  const closeButton=dialog.querySelector('.ks-tools-sheet-close');
  closeButton.addEventListener('click',()=>dialog.close());
  dialog.addEventListener('click',event=>{
    if(event.target!==dialog)return;
    const r=dialog.getBoundingClientRect();
    if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();
  });
  dialog.addEventListener('cancel',()=>{shell.dataset.mobileAdvanced='0';resetDrag(dialog);});
  dialog.addEventListener('close',()=>{
    shell.dataset.mobileAdvanced='0';resetDrag(dialog);
    const invoker=shell.querySelector('.ks-mobile-more');
    invoker?.setAttribute('aria-expanded','false');
    invoker?.focus?.({preventScroll:true});
  });
  return dialog;
}

function renderCategory(shell,dialog,categoryId,{root=globalThis,reason=''}={}){
  const doc=shell.ownerDocument;
  const tabs=dialog.querySelector('.ks-tools-sheet-tabs');
  const body=dialog.querySelector('.ks-tools-sheet-body');
  if(!tabs||!body)return;
  tabs.replaceChildren();
  body.replaceChildren();

  const active=CATEGORIES.find(category=>category.id===categoryId)||CATEGORIES[0];
  dialog.dataset.category=active.id;
  storageSet(root,active.id);
  const context=dialog.querySelector('.ks-tools-sheet-context');
  if(context)context.textContent=reason||`CATEGORÍA · ${active.label}`;

  for(const category of CATEGORIES){
    const tab=doc.createElement('button');
    tab.type='button';tab.textContent=category.label;tab.setAttribute('role','tab');
    tab.setAttribute('aria-selected',category.id===active.id?'true':'false');
    tab.dataset.category=category.id;
    tab.addEventListener('click',()=>renderCategory(shell,dialog,category.id,{root,reason:`CATEGORÍA · ${category.label}`}));
    tabs.append(tab);
  }

  const panel=doc.createElement('section');
  panel.className='ks-tools-sheet-panel';
  panel.setAttribute('role','tabpanel');
  panel.setAttribute('aria-label',active.label);
  const grid=doc.createElement('div');
  grid.className='ks-tools-sheet-grid';
  const closeSheet=({restoreFocus=true}={})=>{
    if(dialog.open)dialog.close();
    if(!restoreFocus)shell.querySelector('.ks-mobile-more')?.blur?.();
  };
  for(const item of active.items){
    const proxy=makeProxy(doc,shell,item,closeSheet);
    if(proxy)grid.append(proxy);
  }

  if(active.id==='view'){
    const dynamic=[...shell.querySelectorAll('.ks-productivity-view-slot button')];
    dynamic.forEach((source,index)=>{
      const button=doc.createElement('button');
      button.type='button';button.textContent=source.textContent?.trim()||`VISTA ${index+1}`;
      button.disabled=!!source.disabled;button.classList.toggle('on',source.classList.contains('on'));
      button.setAttribute('aria-label',source.getAttribute('aria-label')||button.textContent);
      button.addEventListener('click',()=>{source.click();closeSheet({restoreFocus:false});});
      grid.append(button);
    });
  }

  if(active.id==='terrain'){
    const source=shell.querySelector('.ks-deck [data-act="brush-size"]');
    if(source){
      const wrapper=doc.createElement('label');
      wrapper.style.cssText='display:grid;grid-template-columns:1fr auto;grid-column:1/-1;align-items:center;gap:8px;min-height:50px;padding:0 10px;border:1px solid rgba(231,197,106,.18);border-radius:13px;background:rgba(12,26,27,.76);font-size:7px;font-weight:900;color:#cbd9d2';
      wrapper.append('BRUSH');
      const select=source.cloneNode(true);
      select.removeAttribute('data-act');select.value=source.value;select.setAttribute('aria-label','Tamaño del brush');
      select.style.cssText='min-width:82px;min-height:44px;border:1px solid rgba(231,197,106,.25);border-radius:10px;background:#0e191b;color:#fff;padding:0 10px';
      select.addEventListener('change',()=>{source.value=select.value;source.dispatchEvent(new Event('change',{bubbles:true}));});
      wrapper.append(select);grid.append(wrapper);
    }
  }

  if(!grid.children.length){
    const empty=doc.createElement('div');empty.className='ks-tools-sheet-empty';empty.textContent='No hay herramientas disponibles en este contexto.';panel.append(empty);
  }else panel.append(grid);
  body.append(panel);
}

function openSheet(shell,root){
  if(!isMobile(root))return false;
  const dialog=buildSheet(shell,root);
  resetDrag(dialog);
  const preferred=preferredCategory(shell,root,dialog);
  renderCategory(shell,dialog,preferred.id,{root,reason:preferred.reason});
  shell.dataset.mobileAdvanced='0';
  shell.querySelector('.ks-mobile-more')?.setAttribute('aria-expanded','true');
  try{
    if(!dialog.open&&typeof dialog.showModal==='function')dialog.showModal();
    else if(!dialog.open)dialog.setAttribute('open','');
  }catch{dialog.setAttribute('open','');}
  queueMicrotask(()=>dialog.querySelector('.ks-tools-sheet-title')?.focus?.({preventScroll:true}));
  return true;
}

function attach(shell,root){
  if(!shell||shell.dataset.keloToolsSheetBound==='2')return shell;
  shell.dataset.keloToolsSheetBound='2';
  buildSheet(shell,root);
  shell.addEventListener('click',event=>{
    const more=event.target?.closest?.('.ks-mobile-more');
    if(!more||!shell.contains(more)||!isMobile(root))return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    openSheet(shell,root);
  },true);
  return shell;
}

export function installStudioMobileToolsSheet({root=globalThis}={}){
  const doc=root?.document;
  if(!doc)return Object.freeze({version:'studio-mobile-tools-sheet-v2',refresh:()=>null,destroy:()=>{}});
  const existing=root[KEY];
  if(existing?.refresh){existing.refresh();return existing;}

  const style=ensureStyle(doc);
  const MutationObserverCtor=root.MutationObserver||globalThis.MutationObserver;
  let destroyed=false,observer=null;
  const refresh=()=>{
    if(destroyed)return null;
    return attach(doc.getElementById('kelo-studio-live'),root);
  };
  refresh();
  if(MutationObserverCtor){
    observer=new MutationObserverCtor(()=>refresh());
    observer.observe(doc.body||doc.documentElement,{childList:true,subtree:false});
  }

  const api=Object.freeze({
    version:'studio-mobile-tools-sheet-v2.0.0',
    refresh,
    open(){const shell=refresh();return shell?openSheet(shell,root):false;},
    destroy(){
      if(destroyed)return;destroyed=true;observer?.disconnect?.();
      doc.querySelector('#kelo-studio-live > .ks-tools-sheet')?.remove();style.remove();
      try{if(root[KEY]===api)delete root[KEY];}catch{}
    }
  });
  try{root[KEY]=api;}catch{}
  return api;
}
