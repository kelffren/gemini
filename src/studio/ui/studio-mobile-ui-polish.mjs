/* KELO-INDEX
 * area: STUDIO / MOBILE UI POLISH
 * owner: presentation layer only
 * owns: touch target sizing, mobile hierarchy, safe-area spacing and visual density
 * does-not-own: tools, commands, selection, camera, paint, assets or persistence
 * public-api: installStudioMobileUiPolish()
 */

const KEY='__KELO_STUDIO_MOBILE_UI_POLISH_V2__';
const STYLE_ID='kelo-studio-mobile-ui-polish-v2';

const CSS=`
#kelo-studio-live[data-kelo-mobile-polish="2"]{
  --ks-mobile-hit:44px;
}
#kelo-studio-live[data-kelo-mobile-polish="2"] button{
  touch-action:manipulation;
}
#kelo-studio-live[data-kelo-mobile-polish="2"] button:focus-visible,
#kelo-studio-live[data-kelo-mobile-polish="2"] input:focus-visible,
#kelo-studio-live[data-kelo-mobile-polish="2"] select:focus-visible{
  outline:2px solid var(--ks-gold,#e7c56a);
  outline-offset:2px;
}

@media(pointer:coarse),(max-width:760px){
  #kelo-studio-live[data-kelo-mobile-polish="2"] button,
  #kelo-studio-live[data-kelo-mobile-polish="2"] select,
  #kelo-studio-live[data-kelo-mobile-polish="2"] input:not([type="range"]){
    min-height:var(--ks-mobile-hit)!important;
  }
  #kelo-studio-live[data-kelo-mobile-polish="2"] .ks-scale-hud button{
    width:44px!important;height:44px!important;min-width:44px!important;
  }
}

@media(max-width:760px){
  #kelo-studio-live[data-kelo-mobile-polish="2"] .ks-top{
    left:8px!important;right:8px!important;
    top:max(8px,env(safe-area-inset-top))!important;
    min-height:60px!important;
    padding:8px!important;
    gap:6px!important;
    border-radius:17px!important;
    box-shadow:0 14px 34px rgba(0,0,0,.38),inset 0 1px 0 rgba(255,255,255,.04)!important;
  }
  #kelo-studio-live[data-kelo-mobile-polish="2"] .ks-top button{
    min-height:44px!important;
    border-radius:12px!important;
  }
  #kelo-studio-live[data-kelo-mobile-polish="2"] .ks-top [data-act="save"]{
    min-width:64px!important;
    border-color:rgba(231,197,106,.64)!important;
  }
  #kelo-studio-live[data-kelo-mobile-polish="2"] .ks-x{
    width:44px!important;min-width:44px!important;
  }
  #kelo-studio-live[data-kelo-mobile-polish="2"] .ks-bottom{
    left:8px!important;right:8px!important;width:auto!important;transform:none!important;
    bottom:max(8px,env(safe-area-inset-bottom))!important;
    max-height:min(43dvh,360px)!important;
    padding:8px!important;
    border-radius:18px!important;
    border-color:rgba(231,197,106,.38)!important;
    box-shadow:0 18px 52px rgba(0,0,0,.52),inset 0 1px 0 rgba(255,255,255,.04)!important;
  }
  #kelo-studio-live[data-kelo-mobile-polish="2"] .ks-deck-head{
    min-height:50px!important;
    gap:8px!important;
  }
  #kelo-studio-live[data-kelo-mobile-polish="2"] .ks-deck-emblem{
    width:38px!important;height:38px!important;flex-basis:38px!important;
  }
  #kelo-studio-live[data-kelo-mobile-polish="2"] .ks-active-tool{
    min-height:40px!important;max-width:52%!important;
    border-color:rgba(231,197,106,.32)!important;
    background:rgba(16,31,31,.9)!important;
  }
  #kelo-studio-live[data-kelo-mobile-polish="2"] .ks-deck-body{
    gap:7px!important;
  }
  #kelo-studio-live[data-kelo-mobile-polish="2"] .ks-deck-section{
    padding:7px!important;
    border-radius:13px!important;
    background:linear-gradient(180deg,rgba(13,28,29,.94),rgba(8,18,20,.94))!important;
  }
  #kelo-studio-live[data-kelo-mobile-polish="2"] .ks-deck button,
  #kelo-studio-live[data-kelo-mobile-polish="2"] .ks-mini,
  #kelo-studio-live[data-kelo-mobile-polish="2"] .ks-tabs button{
    min-height:44px!important;
    border-radius:11px!important;
  }
  #kelo-studio-live[data-kelo-mobile-polish="2"] .ks-edit-primary,
  #kelo-studio-live[data-kelo-mobile-polish="2"] .ks-history-actions,
  #kelo-studio-live[data-kelo-mobile-polish="2"] .ks-mode-actions{
    gap:6px!important;
    scrollbar-width:none;
    scroll-snap-type:x proximity;
  }
  #kelo-studio-live[data-kelo-mobile-polish="2"] .ks-edit-primary::-webkit-scrollbar,
  #kelo-studio-live[data-kelo-mobile-polish="2"] .ks-history-actions::-webkit-scrollbar,
  #kelo-studio-live[data-kelo-mobile-polish="2"] .ks-mode-actions::-webkit-scrollbar{display:none}
  #kelo-studio-live[data-kelo-mobile-polish="2"] .ks-edit-primary button,
  #kelo-studio-live[data-kelo-mobile-polish="2"] .ks-history-actions button,
  #kelo-studio-live[data-kelo-mobile-polish="2"] .ks-mode-actions button{
    scroll-snap-align:start;
  }
  #kelo-studio-live[data-kelo-mobile-polish="2"] .ks-tabs{
    gap:6px!important;
    margin-top:7px!important;
  }
  #kelo-studio-live[data-kelo-mobile-polish="2"] .ks-tabs button{
    min-height:44px!important;
  }
  #kelo-studio-live[data-kelo-mobile-polish="2"] .ks-mobile-sheet{
    border-radius:14px!important;
    max-height:34dvh!important;
  }
  #kelo-studio-live[data-kelo-mobile-polish="2"] .ks-mobile-pane.assets-pane{
    height:29dvh!important;
  }
  #kelo-studio-live[data-kelo-mobile-polish="2"] .ks-mobile-pane .ks-search{
    min-height:44px!important;
    margin:7px!important;
    border-radius:11px!important;
    font-size:12px!important;
  }
  #kelo-studio-live[data-kelo-mobile-polish="2"] .ks-row{
    min-height:68px!important;
  }
  #kelo-studio-live[data-kelo-mobile-polish="2"] .ks-tree-row{
    min-height:46px!important;
  }
  #kelo-studio-live[data-kelo-mobile-polish="2"] .ks-scale-hud{
    bottom:max(82px,calc(env(safe-area-inset-bottom) + 76px))!important;
    padding:6px!important;
    border-radius:15px!important;
  }
  #kelo-studio-live[data-kelo-mobile-polish="2"] .ks-bottom.ks-compact{
    padding:7px!important;
  }
  #kelo-studio-live[data-kelo-mobile-polish="2"] .ks-bottom.ks-compact>.ks-compact-bar{
    gap:5px!important;
  }
  #kelo-studio-live[data-kelo-mobile-polish="2"] .ks-bottom.ks-compact .ks-compact-bar button{
    min-height:48px!important;
    border-radius:12px!important;
  }
}

@media(max-width:430px){
  #kelo-studio-live[data-kelo-mobile-polish="2"] .ks-brand-copy .ks-subtitle{display:none!important}
  #kelo-studio-live[data-kelo-mobile-polish="2"] .ks-title{font-size:10px!important}
  #kelo-studio-live[data-kelo-mobile-polish="2"] .ks-top [data-act="play"]{
    min-width:52px!important;
  }
  #kelo-studio-live[data-kelo-mobile-polish="2"] .ks-top [data-act="save"]{
    min-width:58px!important;
  }
  #kelo-studio-live[data-kelo-mobile-polish="2"] .ks-active-tool{max-width:48%!important}
  #kelo-studio-live[data-kelo-mobile-polish="2"] .ks-bottom.ks-compact>.ks-compact-bar{
    grid-template-columns:minmax(76px,1.4fr) repeat(5,minmax(44px,1fr))!important;
    gap:4px!important;
    overflow-x:auto!important;
    scrollbar-width:none;
  }
  #kelo-studio-live[data-kelo-mobile-polish="2"] .ks-bottom.ks-compact>.ks-compact-bar::-webkit-scrollbar{display:none}
  #kelo-studio-live[data-kelo-mobile-polish="2"] .ks-bottom.ks-compact .ks-compact-bar button{
    min-width:44px!important;font-size:6px!important;
  }
}

@media(prefers-reduced-motion:reduce){
  #kelo-studio-live[data-kelo-mobile-polish="2"] *{
    animation:none!important;transition:none!important;scroll-behavior:auto!important;
  }
}
`;

function ensureStyle(doc){
  let style=doc.getElementById(STYLE_ID);
  if(style)return style;
  style=doc.createElement('style');
  style.id=STYLE_ID;
  style.dataset.keloStudioMobilePolish='2';
  style.textContent=CSS;
  doc.head.append(style);
  return style;
}

function enhance(shell){
  if(!shell)return null;
  shell.dataset.keloMobilePolish='2';
  shell.querySelectorAll('button').forEach(button=>{
    if(!button.getAttribute('aria-label')&&button.textContent?.trim())button.setAttribute('aria-label',button.textContent.trim());
  });
  const status=shell.querySelector('.ks-status');
  if(status){status.setAttribute('role','status');status.setAttribute('aria-live','polite');}
  return shell;
}

export function installStudioMobileUiPolish({root=globalThis}={}){
  const doc=root?.document;
  if(!doc)return Object.freeze({version:'studio-mobile-ui-polish-v2',refresh:()=>null,destroy:()=>{}});
  const existing=root[KEY];
  if(existing?.refresh){existing.refresh();return existing;}

  const style=ensureStyle(doc);
  const MutationObserverCtor=root.MutationObserver||globalThis.MutationObserver;
  let destroyed=false,bodyObserver=null,shellObserver=null,observedShell=null;

  const watch=shell=>{
    if(!MutationObserverCtor||!shell||shell===observedShell)return;
    shellObserver?.disconnect?.();
    observedShell=shell;
    shellObserver=new MutationObserverCtor(()=>enhance(shell));
    shellObserver.observe(shell,{childList:true,subtree:true});
  };
  const refresh=()=>{
    if(destroyed)return null;
    const shell=enhance(doc.getElementById('kelo-studio-live'));
    if(shell)watch(shell);
    return shell;
  };

  refresh();
  if(MutationObserverCtor){
    bodyObserver=new MutationObserverCtor(()=>refresh());
    bodyObserver.observe(doc.body||doc.documentElement,{childList:true,subtree:false});
  }

  const api=Object.freeze({
    version:'studio-mobile-ui-polish-v2.0.0',refresh,
    destroy(){
      if(destroyed)return;destroyed=true;
      bodyObserver?.disconnect?.();shellObserver?.disconnect?.();observedShell=null;
      style.remove();
      try{if(root[KEY]===api)delete root[KEY];}catch{}
    }
  });
  try{root[KEY]=api;}catch{}
  return api;
}
