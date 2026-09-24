/* KELO-INDEX
 * area: STUDIO / MOBILE UI POLISH
 * owner: presentation layer only
 * owns: touch target sizing, mobile hierarchy, safe-area spacing, visual density and contextual mobile shortcuts
 * does-not-own: tools, commands, selection, camera, paint, assets or persistence
 * public-api: installStudioMobileUiPolish()
 */

const KEY='__KELO_STUDIO_MOBILE_UI_POLISH_V3__';
const STYLE_ID='kelo-studio-mobile-ui-polish-v3';
const MOBILE_QUERY='(max-width:760px)';

const CSS=`
#kelo-studio-live[data-kelo-mobile-polish="3"]{--ks-mobile-hit:44px}
#kelo-studio-live[data-kelo-mobile-polish="3"] button{touch-action:manipulation}
#kelo-studio-live[data-kelo-mobile-polish="3"] button:focus-visible,
#kelo-studio-live[data-kelo-mobile-polish="3"] input:focus-visible,
#kelo-studio-live[data-kelo-mobile-polish="3"] select:focus-visible{
  outline:2px solid var(--ks-gold,#e7c56a);outline-offset:2px
}
.ks-mobile-context-actions{display:none}

@media(pointer:coarse),(max-width:760px){
  #kelo-studio-live[data-kelo-mobile-polish="3"] button,
  #kelo-studio-live[data-kelo-mobile-polish="3"] select,
  #kelo-studio-live[data-kelo-mobile-polish="3"] input:not([type="range"]){min-height:var(--ks-mobile-hit)!important}
  #kelo-studio-live[data-kelo-mobile-polish="3"] .ks-scale-hud button{width:44px!important;height:44px!important;min-width:44px!important}
}

@media(max-width:760px){
  #kelo-studio-live[data-kelo-mobile-polish="3"] .ks-top{
    left:8px!important;right:8px!important;top:max(8px,env(safe-area-inset-top))!important;
    min-height:60px!important;padding:8px!important;gap:6px!important;border-radius:17px!important;
    box-shadow:0 14px 34px rgba(0,0,0,.38),inset 0 1px 0 rgba(255,255,255,.04)!important
  }
  #kelo-studio-live[data-kelo-mobile-polish="3"] .ks-top button{min-height:44px!important;border-radius:12px!important}
  #kelo-studio-live[data-kelo-mobile-polish="3"] .ks-top [data-act="save"]{min-width:64px!important;border-color:rgba(231,197,106,.64)!important}
  #kelo-studio-live[data-kelo-mobile-polish="3"] .ks-x{width:44px!important;min-width:44px!important}
  #kelo-studio-live[data-kelo-mobile-polish="3"] .ks-bottom{
    left:8px!important;right:8px!important;width:auto!important;transform:none!important;
    bottom:max(8px,env(safe-area-inset-bottom))!important;max-height:min(43dvh,360px)!important;
    padding:8px!important;border-radius:18px!important;border-color:rgba(231,197,106,.38)!important;
    box-shadow:0 18px 52px rgba(0,0,0,.52),inset 0 1px 0 rgba(255,255,255,.04)!important
  }
  #kelo-studio-live[data-kelo-mobile-polish="3"] .ks-deck-head{min-height:50px!important;gap:8px!important}
  #kelo-studio-live[data-kelo-mobile-polish="3"] .ks-deck-emblem{width:38px!important;height:38px!important;flex-basis:38px!important}
  #kelo-studio-live[data-kelo-mobile-polish="3"] .ks-active-tool{
    min-height:40px!important;max-width:52%!important;border-color:rgba(231,197,106,.32)!important;background:rgba(16,31,31,.9)!important
  }

  #kelo-studio-live[data-kelo-mobile-polish="3"][data-compact="full"] .ks-mobile-context-actions{
    display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:6px;padding:8px 0 0
  }
  #kelo-studio-live[data-kelo-mobile-polish="3"] .ks-mobile-context-actions button{
    min-width:0!important;min-height:48px!important;padding:0 4px!important;border-radius:12px!important;
    font-size:6.2px!important;line-height:1.1!important;white-space:nowrap!important;overflow:hidden;text-overflow:ellipsis
  }
  #kelo-studio-live[data-kelo-mobile-polish="3"] .ks-mobile-context-actions button[data-kelo-danger="1"]{
    border-color:rgba(255,122,112,.48)!important;color:#ffd4cf!important;background:rgba(65,24,24,.42)!important
  }
  #kelo-studio-live[data-kelo-mobile-polish="3"] .ks-mobile-context-actions .ks-mobile-more{
    border-color:rgba(231,197,106,.55)!important;color:#ffeaa0!important;background:linear-gradient(180deg,#24463a,#17332b)!important
  }
  #kelo-studio-live[data-kelo-mobile-polish="3"][data-compact="full"] .ks-deck-body{display:none!important}
  #kelo-studio-live[data-kelo-mobile-polish="3"][data-compact="full"][data-mobile-advanced="1"] .ks-deck-body{
    display:grid!important;margin-top:7px;padding-top:7px!important;border-top:1px solid rgba(231,197,106,.14)
  }

  #kelo-studio-live[data-kelo-mobile-polish="3"] .ks-deck-body{gap:7px!important}
  #kelo-studio-live[data-kelo-mobile-polish="3"] .ks-deck-section{
    padding:7px!important;border-radius:13px!important;background:linear-gradient(180deg,rgba(13,28,29,.94),rgba(8,18,20,.94))!important
  }
  #kelo-studio-live[data-kelo-mobile-polish="3"] .ks-deck button,
  #kelo-studio-live[data-kelo-mobile-polish="3"] .ks-mini,
  #kelo-studio-live[data-kelo-mobile-polish="3"] .ks-tabs button{min-height:44px!important;border-radius:11px!important}
  #kelo-studio-live[data-kelo-mobile-polish="3"] .ks-edit-primary,
  #kelo-studio-live[data-kelo-mobile-polish="3"] .ks-history-actions,
  #kelo-studio-live[data-kelo-mobile-polish="3"] .ks-mode-actions{
    gap:6px!important;scrollbar-width:none;scroll-snap-type:x proximity
  }
  #kelo-studio-live[data-kelo-mobile-polish="3"] .ks-edit-primary::-webkit-scrollbar,
  #kelo-studio-live[data-kelo-mobile-polish="3"] .ks-history-actions::-webkit-scrollbar,
  #kelo-studio-live[data-kelo-mobile-polish="3"] .ks-mode-actions::-webkit-scrollbar{display:none}
  #kelo-studio-live[data-kelo-mobile-polish="3"] .ks-edit-primary button,
  #kelo-studio-live[data-kelo-mobile-polish="3"] .ks-history-actions button,
  #kelo-studio-live[data-kelo-mobile-polish="3"] .ks-mode-actions button{scroll-snap-align:start}
  #kelo-studio-live[data-kelo-mobile-polish="3"] .ks-tabs{gap:6px!important;margin-top:7px!important}
  #kelo-studio-live[data-kelo-mobile-polish="3"] .ks-mobile-sheet{border-radius:14px!important;max-height:34dvh!important}
  #kelo-studio-live[data-kelo-mobile-polish="3"] .ks-mobile-pane.assets-pane{height:29dvh!important}
  #kelo-studio-live[data-kelo-mobile-polish="3"] .ks-mobile-pane .ks-search{
    min-height:44px!important;margin:7px!important;border-radius:11px!important;font-size:12px!important
  }
  #kelo-studio-live[data-kelo-mobile-polish="3"] .ks-row{min-height:68px!important}
  #kelo-studio-live[data-kelo-mobile-polish="3"] .ks-tree-row{min-height:46px!important}
  #kelo-studio-live[data-kelo-mobile-polish="3"] .ks-scale-hud{
    bottom:max(82px,calc(env(safe-area-inset-bottom) + 76px))!important;padding:6px!important;border-radius:15px!important
  }
  #kelo-studio-live[data-kelo-mobile-polish="3"] .ks-bottom.ks-compact{padding:7px!important}
  #kelo-studio-live[data-kelo-mobile-polish="3"] .ks-bottom.ks-compact>.ks-compact-bar{gap:5px!important}
  #kelo-studio-live[data-kelo-mobile-polish="3"] .ks-bottom.ks-compact .ks-compact-bar button{min-height:48px!important;border-radius:12px!important}
}

@media(max-width:430px){
  #kelo-studio-live[data-kelo-mobile-polish="3"] .ks-brand-copy .ks-subtitle{display:none!important}
  #kelo-studio-live[data-kelo-mobile-polish="3"] .ks-title{font-size:10px!important}
  #kelo-studio-live[data-kelo-mobile-polish="3"] .ks-top [data-act="play"]{min-width:52px!important}
  #kelo-studio-live[data-kelo-mobile-polish="3"] .ks-top [data-act="save"]{min-width:58px!important}
  #kelo-studio-live[data-kelo-mobile-polish="3"] .ks-active-tool{max-width:48%!important}
  #kelo-studio-live[data-kelo-mobile-polish="3"] .ks-mobile-context-actions{gap:4px!important}
  #kelo-studio-live[data-kelo-mobile-polish="3"] .ks-mobile-context-actions button{font-size:5.7px!important;padding:0 2px!important}
  #kelo-studio-live[data-kelo-mobile-polish="3"] .ks-bottom.ks-compact>.ks-compact-bar{
    grid-template-columns:minmax(76px,1.4fr) repeat(5,minmax(44px,1fr))!important;gap:4px!important;
    overflow-x:auto!important;scrollbar-width:none
  }
  #kelo-studio-live[data-kelo-mobile-polish="3"] .ks-bottom.ks-compact>.ks-compact-bar::-webkit-scrollbar{display:none}
  #kelo-studio-live[data-kelo-mobile-polish="3"] .ks-bottom.ks-compact .ks-compact-bar button{min-width:44px!important;font-size:6px!important}
}

@media(prefers-reduced-motion:reduce){
  #kelo-studio-live[data-kelo-mobile-polish="3"] *{animation:none!important;transition:none!important;scroll-behavior:auto!important}
}
`;

function ensureStyle(doc){
  let style=doc.getElementById(STYLE_ID);
  if(style)return style;
  style=doc.createElement('style');style.id=STYLE_ID;style.dataset.keloStudioMobilePolish='3';style.textContent=CSS;doc.head.append(style);return style;
}

function isMobile(root){
  if(typeof root?.matchMedia==='function')return root.matchMedia(MOBILE_QUERY).matches;
  return Number(root?.innerWidth||0)<=760;
}

function sourceFor(shell,kind,value){
  const selector=kind==='mode'?`.ks-deck [data-mode="${value}"]`:`.ks-deck [data-act="${value}"]`;
  return shell.querySelector(selector);
}

function shortcutButton(doc,{label,kind,value,danger=false},source,sync){
  const button=doc.createElement('button');
  button.type='button';button.textContent=label;button.dataset.keloProxy=`${kind}:${value}`;
  if(danger)button.dataset.keloDanger='1';
  button.disabled=!!source?.disabled;
  if(source?.classList?.contains('on'))button.classList.add('on');
  button.setAttribute('aria-label',source?.getAttribute?.('aria-label')||label);
  button.addEventListener('click',()=>{
    if(button.disabled||!source)return;
    source.click();
    queueMicrotask(sync);
  });
  return button;
}

function ensureContextBar(shell,root){
  const deck=shell.querySelector('.ks-deck');
  const deckHead=deck?.querySelector('.ks-deck-head');
  if(!deck||!deckHead)return null;
  let bar=deck.querySelector(':scope > .ks-mobile-context-actions');
  if(!bar){
    bar=shell.ownerDocument.createElement('div');
    bar.className='ks-mobile-context-actions';
    bar.setAttribute('aria-label','Acciones rápidas del editor');
    deckHead.insertAdjacentElement('afterend',bar);
  }

  const selected=Math.max(0,Number(shell.dataset.selectionCount||0));
  const signature=selected>0?'selection':'canvas';
  if(bar.dataset.contextSignature!==signature){
    bar.dataset.contextSignature=signature;
    bar.replaceChildren();
    const actions=selected>0
      ?[
        {label:'SELECT',kind:'mode',value:'select'},
        {label:'ROTAR',kind:'act',value:'rotate'},
        {label:'DUPLICAR',kind:'act',value:'duplicate'},
        {label:'BORRAR',kind:'act',value:'delete',danger:true},
      ]
      :[
        {label:'SELECT',kind:'mode',value:'select'},
        {label:'EDIT',kind:'act',value:'edit-assets'},
        {label:'UNDO',kind:'act',value:'undo'},
        {label:'GROUND',kind:'mode',value:'terrain'},
      ];
    const sync=()=>enhance(shell,root);
    for(const action of actions){
      const source=sourceFor(shell,action.kind,action.value);
      if(source)bar.append(shortcutButton(shell.ownerDocument,action,source,sync));
    }
    const more=shell.ownerDocument.createElement('button');
    more.type='button';more.className='ks-mobile-more';more.textContent=shell.dataset.mobileAdvanced==='1'?'MENOS':'MÁS';
    more.setAttribute('aria-label','Mostrar herramientas avanzadas');
    more.setAttribute('aria-expanded',shell.dataset.mobileAdvanced==='1'?'true':'false');
    more.addEventListener('click',()=>{
      const open=shell.dataset.mobileAdvanced!=='1';
      shell.dataset.mobileAdvanced=open?'1':'0';
      more.textContent=open?'MENOS':'MÁS';
      more.setAttribute('aria-expanded',open?'true':'false');
    });
    bar.append(more);
  }else{
    for(const proxy of bar.querySelectorAll('[data-kelo-proxy]')){
      const [kind,value]=String(proxy.dataset.keloProxy||'').split(':');
      const source=sourceFor(shell,kind,value);
      proxy.disabled=!!source?.disabled;
      proxy.classList.toggle('on',!!source?.classList?.contains('on'));
    }
    const more=bar.querySelector('.ks-mobile-more');
    if(more){
      const open=shell.dataset.mobileAdvanced==='1';
      const label=open?'MENOS':'MÁS';
      const expanded=open?'true':'false';
      if(more.textContent!==label)more.textContent=label;
      if(more.getAttribute('aria-expanded')!==expanded)more.setAttribute('aria-expanded',expanded);
    }
  }
  return bar;
}

function enhance(shell,root=globalThis){
  if(!shell)return null;
  shell.dataset.keloMobilePolish='3';
  if(shell.dataset.mobileAdvanced!=='1')shell.dataset.mobileAdvanced='0';
  shell.querySelectorAll('button').forEach(button=>{
    if(!button.getAttribute('aria-label')&&button.textContent?.trim())button.setAttribute('aria-label',button.textContent.trim());
  });
  const status=shell.querySelector('.ks-status');
  if(status){status.setAttribute('role','status');status.setAttribute('aria-live','polite');}
  ensureContextBar(shell,root);
  return shell;
}

export function installStudioMobileUiPolish({root=globalThis}={}){
  const doc=root?.document;
  if(!doc)return Object.freeze({version:'studio-mobile-ui-polish-v3',refresh:()=>null,destroy:()=>{}});
  const existing=root[KEY];
  if(existing?.refresh){existing.refresh();return existing;}

  const style=ensureStyle(doc);
  const MutationObserverCtor=root.MutationObserver||globalThis.MutationObserver;
  let destroyed=false,bodyObserver=null,shellObserver=null,observedShell=null,refreshQueued=false;

  const scheduleRefresh=()=>{
    if(refreshQueued||destroyed)return;
    refreshQueued=true;
    queueMicrotask(()=>{refreshQueued=false;refresh();});
  };
  const watch=shell=>{
    if(!MutationObserverCtor||!shell||shell===observedShell)return;
    shellObserver?.disconnect?.();observedShell=shell;
    shellObserver=new MutationObserverCtor(records=>{
      const relevant=records.some(record=>{
        if(record.type==='attributes')return true;
        const target=record.target?.nodeType===1?record.target:record.target?.parentElement;
        return !target?.closest?.('.ks-mobile-context-actions');
      });
      if(relevant)scheduleRefresh();
    });
    shellObserver.observe(shell,{childList:true,subtree:true,attributes:true,attributeFilter:['data-selection-count','data-compact']});
  };
  const refresh=()=>{
    if(destroyed)return null;
    const shell=enhance(doc.getElementById('kelo-studio-live'),root);
    if(shell)watch(shell);
    return shell;
  };

  refresh();
  if(MutationObserverCtor){
    bodyObserver=new MutationObserverCtor(scheduleRefresh);
    bodyObserver.observe(doc.body||doc.documentElement,{childList:true,subtree:false});
  }
  const onViewportChange=()=>refresh();
  let media=null;
  try{media=root.matchMedia?.(MOBILE_QUERY);media?.addEventListener?.('change',onViewportChange);}catch{}

  const api=Object.freeze({
    version:'studio-mobile-ui-polish-v3.0.0',refresh,
    destroy(){
      if(destroyed)return;destroyed=true;
      bodyObserver?.disconnect?.();shellObserver?.disconnect?.();observedShell=null;
      try{media?.removeEventListener?.('change',onViewportChange);}catch{}
      style.remove();
      try{if(root[KEY]===api)delete root[KEY];}catch{}
    }
  });
  try{root[KEY]=api;}catch{}
  return api;
}
