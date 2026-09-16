/* KELO-INDEX
 * area: STUDIO / MOBILE ADAPTIVE TOOLBAR
 * owner: presentation layer only
 * owns: quick-toolbar ranking, recent-tool learning and pinned favorites
 * does-not-own: editor commands, selection, undo stack, paint, camera, assets or persistence of world data
 * public-api: installStudioMobileAdaptiveToolbar()
 */

const KEY='__KELO_STUDIO_MOBILE_ADAPTIVE_TOOLBAR_V1__';
const STYLE_ID='kelo-studio-mobile-adaptive-toolbar-v1';
const MOBILE_QUERY='(max-width:760px)';
const FAVORITES_KEY='kelo.studio.mobileToolbar.favorites';
const RECENTS_KEY='kelo.studio.mobileToolbar.recents';
const LONG_PRESS_MS=560;

const TOOLS=Object.freeze({
  'act:edit-assets':{label:'EDIT',kind:'act',value:'edit-assets',contexts:['canvas','selection']},
  'act:undo':{label:'UNDO',kind:'act',value:'undo',contexts:['canvas','selection']},
  'act:redo':{label:'REDO',kind:'act',value:'redo',contexts:['canvas','selection']},
  'mode:terrain':{label:'GROUND',kind:'mode',value:'terrain',contexts:['canvas']},
  'mode:path':{label:'ROAD',kind:'mode',value:'path',contexts:['canvas']},
  'mode:collision':{label:'COLLISION',kind:'mode',value:'collision',contexts:['canvas']},
  'mode:move':{label:'MOVE',kind:'mode',value:'move',contexts:['canvas','selection']},
  'act:rotate':{label:'ROTAR',kind:'act',value:'rotate',contexts:['selection']},
  'act:duplicate':{label:'DUPLICAR',kind:'act',value:'duplicate',contexts:['selection']},
  'act:scale-down':{label:'ESCALA−',kind:'act',value:'scale-down',contexts:['selection']},
  'act:scale-reset':{label:'100%',kind:'act',value:'scale-reset',contexts:['selection']},
  'act:scale-up':{label:'ESCALA+',kind:'act',value:'scale-up',contexts:['selection']},
});

const DEFAULTS=Object.freeze({
  canvas:Object.freeze(['act:edit-assets','act:undo','mode:terrain']),
  selection:Object.freeze(['act:rotate','act:duplicate']),
});

const CSS=`
@media(max-width:760px){
  #kelo-studio-live .ks-mobile-context-actions[data-kelo-adaptive="1"] button{position:relative;min-height:48px!important}
  #kelo-studio-live .ks-mobile-context-actions[data-kelo-adaptive="1"] button[data-kelo-pinnable="1"]{
    touch-action:manipulation;-webkit-user-select:none;user-select:none
  }
  #kelo-studio-live .ks-mobile-context-actions[data-kelo-adaptive="1"] button[data-kelo-pinned="1"]{
    border-color:rgba(231,197,106,.66)!important;box-shadow:inset 0 0 0 1px rgba(231,197,106,.12)
  }
  #kelo-studio-live .ks-mobile-context-actions[data-kelo-adaptive="1"] button[data-kelo-pinned="1"]::after{
    content:'★';position:absolute;top:3px;right:4px;font-size:7px;line-height:1;color:#ffe792;pointer-events:none
  }
}
@media(prefers-reduced-motion:reduce){
  #kelo-studio-live .ks-mobile-context-actions[data-kelo-adaptive="1"] *{transition:none!important;animation:none!important}
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

function readList(storage,key){
  try{
    const parsed=JSON.parse(storage?.getItem?.(key)||'[]');
    return Array.isArray(parsed)?parsed.filter(value=>TOOLS[value]):[];
  }catch{return [];}
}

function writeList(storage,key,list){
  try{storage?.setItem?.(key,JSON.stringify(list));}catch{}
}

function favorites(root){return readList(root?.localStorage,FAVORITES_KEY);}
function recents(root){return readList(root?.sessionStorage,RECENTS_KEY);}

function recordRecent(root,key){
  if(!TOOLS[key])return;
  const next=[key,...recents(root).filter(value=>value!==key)].slice(0,8);
  writeList(root?.sessionStorage,RECENTS_KEY,next);
}

function toggleFavorite(root,key){
  if(!TOOLS[key])return false;
  const current=favorites(root);
  const pinned=current.includes(key);
  const next=pinned?current.filter(value=>value!==key):[key,...current.filter(value=>value!==key)].slice(0,6);
  writeList(root?.localStorage,FAVORITES_KEY,next);
  return !pinned;
}

function contextFor(shell){return Math.max(0,Number(shell?.dataset?.selectionCount||0))>0?'selection':'canvas';}

function sourceFor(shell,tool){
  const selector=tool.kind==='mode'?`.ks-deck [data-mode="${tool.value}"]`:`.ks-deck [data-act="${tool.value}"]`;
  return shell.querySelector(selector);
}

function compatible(shell,key,context){
  const tool=TOOLS[key];
  if(!tool||!tool.contexts.includes(context))return false;
  const source=sourceFor(shell,tool);
  return !!source&&!source.disabled;
}

function rankedKeys(shell,root,context){
  const count=context==='selection'?2:3;
  const out=[];
  const add=key=>{if(out.length<count&&!out.includes(key)&&compatible(shell,key,context))out.push(key);};
  favorites(root).forEach(add);
  recents(root).forEach(add);
  DEFAULTS[context].forEach(add);
  Object.keys(TOOLS).forEach(add);
  return out.slice(0,count);
}

function feedback(root,message){
  try{root?.__KELO_STUDIO_MOBILE_ACTION_FEEDBACK_V1__?.show?.(message,{duration:1700});}catch{}
}

function makeProxy(doc,shell,root,key,{pinnable=true,onRefresh}={}){
  const tool=TOOLS[key];
  const source=sourceFor(shell,tool);
  if(!tool||!source)return null;
  const button=doc.createElement('button');
  button.type='button';button.textContent=tool.label;button.dataset.keloProxy=key;
  if(pinnable)button.dataset.keloPinnable='1';
  const isPinned=favorites(root).includes(key);
  button.dataset.keloPinned=isPinned?'1':'0';
  button.disabled=!!source.disabled;
  button.classList.toggle('on',source.classList.contains('on'));
  const pinHint=pinnable?(isPinned?' Fijado; mantén pulsado para desfijar.':' Mantén pulsado para fijar.') : '';
  button.setAttribute('aria-label',(source.getAttribute('aria-label')||tool.label)+pinHint);

  let timer=0,consumed=false,pointerId=null;
  const clear=()=>{if(timer){root.clearTimeout?.(timer);timer=0;}};
  if(pinnable){
    button.addEventListener('pointerdown',event=>{
      if(event.button!=null&&event.button!==0)return;
      pointerId=event.pointerId;consumed=false;clear();
      timer=root.setTimeout?.(()=>{
        timer=0;consumed=true;
        const pinned=toggleFavorite(root,key);
        feedback(root,pinned?`${tool.label} fijado en la barra`:`${tool.label} quitado de favoritos`);
        onRefresh?.({force:true});
      },LONG_PRESS_MS)||0;
    });
    ['pointerup','pointercancel','pointerleave'].forEach(type=>button.addEventListener(type,event=>{
      if(pointerId!=null&&event.pointerId!=null&&event.pointerId!==pointerId)return;
      clear();pointerId=null;
    }));
  }

  button.addEventListener('click',event=>{
    if(consumed){consumed=false;event.preventDefault();event.stopPropagation();return;}
    const current=sourceFor(shell,tool);
    if(!current||current.disabled)return;
    current.click();
    recordRecent(root,key);
    queueMicrotask(()=>onRefresh?.({force:true}));
  });
  return button;
}

function makeFixedButton(doc,shell,{label,kind,value,danger=false}){
  const selector=kind==='mode'?`.ks-deck [data-mode="${value}"]`:`.ks-deck [data-act="${value}"]`;
  const source=shell.querySelector(selector);
  if(!source)return null;
  const button=doc.createElement('button');
  button.type='button';button.textContent=label;button.dataset.keloProxy=`${kind}:${value}`;
  if(danger)button.dataset.keloDanger='1';
  button.disabled=!!source.disabled;button.classList.toggle('on',source.classList.contains('on'));
  button.setAttribute('aria-label',source.getAttribute('aria-label')||label);
  button.addEventListener('click',()=>{const current=shell.querySelector(selector);if(current&&!current.disabled)current.click();});
  return button;
}

function makeMore(doc,shell){
  const more=doc.createElement('button');
  more.type='button';more.className='ks-mobile-more';more.textContent='MÁS';
  more.setAttribute('aria-label','Mostrar herramientas avanzadas');
  more.setAttribute('aria-expanded',shell.querySelector('.ks-tools-sheet')?.open?'true':'false');
  more.addEventListener('click',()=>{
    if(shell.querySelector('.ks-tools-sheet'))return;
    const open=shell.dataset.mobileAdvanced!=='1';shell.dataset.mobileAdvanced=open?'1':'0';
    more.textContent=open?'MENOS':'MÁS';more.setAttribute('aria-expanded',open?'true':'false');
  });
  return more;
}

function render(shell,root,{force=false}={}){
  if(!shell||!isMobile(root))return null;
  const bar=shell.querySelector('.ks-mobile-context-actions');
  if(!bar)return null;
  const context=contextFor(shell);
  const dynamic=rankedKeys(shell,root,context);
  const favSig=favorites(root).join(',');
  const signature=`${context}|${dynamic.join(',')}|${favSig}`;
  if(!force&&bar.dataset.keloAdaptiveSignature===signature)return bar;

  bar.dataset.keloAdaptive='1';
  bar.dataset.keloAdaptiveSignature=signature;
  bar.dataset.contextSignature=context;
  const nodes=[];
  const select=makeFixedButton(shell.ownerDocument,shell,{label:'SELECT',kind:'mode',value:'select'});if(select)nodes.push(select);
  const onRefresh=options=>render(shell,root,options);
  dynamic.forEach(key=>{const button=makeProxy(shell.ownerDocument,shell,root,key,{onRefresh});if(button)nodes.push(button);});
  if(context==='selection'){
    const del=makeFixedButton(shell.ownerDocument,shell,{label:'BORRAR',kind:'act',value:'delete',danger:true});if(del)nodes.push(del);
  }
  nodes.push(makeMore(shell.ownerDocument,shell));
  bar.replaceChildren(...nodes.slice(0,5));
  return bar;
}

function createController(shell,root){
  let queued=false,destroyed=false,observer=null;
  const refresh=({force=false}={})=>{
    if(destroyed)return null;
    return render(shell,root,{force});
  };
  const schedule=({force=false}={})=>{
    if(queued||destroyed)return;queued=true;
    queueMicrotask(()=>{queued=false;refresh({force});});
  };

  const onCommand=event=>{
    if(!isMobile(root))return;
    const control=event.target?.closest?.('.ks-deck button[data-act],.ks-deck button[data-mode]');
    if(!control||!shell.contains(control)||control.closest('.ks-mobile-context-actions'))return;
    const kind=control.dataset.mode?'mode':'act';
    const value=control.dataset.mode||control.dataset.act;
    const key=`${kind}:${value}`;
    if(!TOOLS[key])return;
    recordRecent(root,key);schedule({force:true});
  };
  shell.addEventListener('click',onCommand,true);

  const MutationObserverCtor=root.MutationObserver||globalThis.MutationObserver;
  if(MutationObserverCtor){
    observer=new MutationObserverCtor(()=>schedule({force:false}));
    observer.observe(shell,{childList:true,subtree:true,attributes:true,attributeFilter:['data-selection-count','class','disabled']});
  }
  refresh({force:true});
  return Object.freeze({
    refresh,
    destroy(){destroyed=true;observer?.disconnect?.();shell.removeEventListener('click',onCommand,true);}
  });
}

export function installStudioMobileAdaptiveToolbar({root=globalThis}={}){
  const doc=root?.document;
  if(!doc)return Object.freeze({version:'studio-mobile-adaptive-toolbar-v1',refresh:()=>null,destroy:()=>{}});
  const existing=root[KEY];if(existing?.refresh){existing.refresh();return existing;}
  const style=ensureStyle(doc);
  const MutationObserverCtor=root.MutationObserver||globalThis.MutationObserver;
  let destroyed=false,bodyObserver=null,controller=null,observedShell=null;

  const refresh=()=>{
    if(destroyed)return null;
    const shell=doc.getElementById('kelo-studio-live');
    if(!shell)return null;
    if(shell!==observedShell){controller?.destroy?.();observedShell=shell;controller=createController(shell,root);}
    return controller?.refresh?.()||null;
  };
  refresh();
  if(MutationObserverCtor){bodyObserver=new MutationObserverCtor(()=>refresh());bodyObserver.observe(doc.body||doc.documentElement,{childList:true,subtree:false});}
  const api=Object.freeze({
    version:'studio-mobile-adaptive-toolbar-v1.0.0',refresh,
    favorites(){return favorites(root).slice();},
    recents(){return recents(root).slice();},
    clearFavorites(){writeList(root?.localStorage,FAVORITES_KEY,[]);controller?.refresh?.({force:true});},
    destroy(){
      if(destroyed)return;destroyed=true;bodyObserver?.disconnect?.();controller?.destroy?.();controller=null;observedShell=null;style.remove();
      try{if(root[KEY]===api)delete root[KEY];}catch{}
    }
  });
  try{root[KEY]=api;}catch{}
  return api;
}
