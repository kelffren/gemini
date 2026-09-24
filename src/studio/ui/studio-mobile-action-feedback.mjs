/* KELO-INDEX
 * area: STUDIO / MOBILE ACTION FEEDBACK
 * owner: presentation layer only
 * owns: nonblocking mobile action feedback and delete undo affordance
 * does-not-own: command execution, undo stack, document mutation, selection or persistence
 * public-api: installStudioMobileActionFeedback()
 */

const KEY='__KELO_STUDIO_MOBILE_ACTION_FEEDBACK_V1__';
const STYLE_ID='kelo-studio-mobile-action-feedback-v1';
const MOBILE_QUERY='(max-width:760px)';

const CSS=`
#kelo-studio-live .ks-action-feedback{
  display:none;position:fixed;z-index:2147482295;left:50%;transform:translateX(-50%);
  width:min(430px,calc(100vw - 24px));pointer-events:none
}
#kelo-studio-live .ks-action-feedback button{pointer-events:auto}
@media(max-width:760px){
  #kelo-studio-live .ks-action-feedback[data-visible="1"]{
    display:flex;align-items:center;gap:9px;
    bottom:max(78px,calc(env(safe-area-inset-bottom) + 72px));
    min-height:54px;padding:7px 8px 7px 13px;
    border:1px solid rgba(231,197,106,.38);border-radius:16px;
    background:linear-gradient(180deg,rgba(16,31,31,.985),rgba(7,17,19,.99));
    box-shadow:0 16px 42px rgba(0,0,0,.5),inset 0 1px 0 rgba(255,255,255,.045);
    color:#edf4ef
  }
  #kelo-studio-live .ks-action-feedback-copy{
    min-width:0;flex:1;font-size:10px;font-weight:850;line-height:1.25;letter-spacing:.01em
  }
  #kelo-studio-live .ks-action-feedback-copy small{
    display:block;margin-top:2px;color:#8fa79d;font-size:7px;font-weight:750
  }
  #kelo-studio-live .ks-action-feedback-undo{
    min-width:92px!important;min-height:44px!important;padding:0 12px!important;
    border-radius:12px!important;border-color:rgba(231,197,106,.62)!important;
    color:#ffe99a!important;background:linear-gradient(180deg,#294b3e,#18362e)!important;
    font-size:7px!important;font-weight:950!important;letter-spacing:.06em!important
  }
  #kelo-studio-live .ks-action-feedback-dismiss{
    width:44px!important;min-width:44px!important;height:44px!important;padding:0!important;
    border-radius:12px!important;font-size:17px!important
  }
}
@media(prefers-reduced-motion:no-preference){
  #kelo-studio-live .ks-action-feedback[data-visible="1"]{animation:ksFeedbackIn .16s ease-out}
  @keyframes ksFeedbackIn{from{opacity:0;transform:translate(-50%,8px)}to{opacity:1;transform:translate(-50%,0)}}
}
@media(prefers-reduced-motion:reduce){
  #kelo-studio-live .ks-action-feedback{animation:none!important;transition:none!important}
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
  style.dataset.keloStudioMobileActionFeedback='1';
  style.textContent=CSS;
  doc.head.append(style);
  return style;
}

function undoSource(shell){
  return shell.querySelector('.ks-deck [data-act="undo"]')||shell.querySelector('.ks-compact-bar [data-act="undo"]')||shell.querySelector('[data-act="undo"]');
}

function ensureFeedback(shell){
  let feedback=shell.querySelector(':scope > .ks-action-feedback');
  if(feedback)return feedback;
  feedback=shell.ownerDocument.createElement('div');
  feedback.className='ks-action-feedback';
  feedback.dataset.visible='0';
  feedback.setAttribute('role','status');
  feedback.setAttribute('aria-live','polite');
  feedback.setAttribute('aria-atomic','true');
  feedback.innerHTML=`
    <div class="ks-action-feedback-copy"><strong></strong><small></small></div>
    <button type="button" class="ks-action-feedback-undo">DESHACER</button>
    <button type="button" class="ks-action-feedback-dismiss" aria-label="Cerrar aviso">×</button>`;
  shell.append(feedback);
  return feedback;
}

function createController(shell,root){
  const feedback=ensureFeedback(shell);
  const strong=feedback.querySelector('.ks-action-feedback-copy strong');
  const small=feedback.querySelector('.ks-action-feedback-copy small');
  const undoButton=feedback.querySelector('.ks-action-feedback-undo');
  const dismiss=feedback.querySelector('.ks-action-feedback-dismiss');
  let timer=0,lastDeleteCount=1;

  const clearTimer=()=>{if(timer){root.clearTimeout?.(timer);timer=0;}};
  const hide=()=>{clearTimer();feedback.dataset.visible='0';feedback.dataset.undoable='0';undoButton.hidden=true;};
  const show=(message,{detail='',undoable=false,duration=2400}={})=>{
    if(!isMobile(root))return;
    clearTimer();
    strong.textContent=message;
    small.textContent=detail;
    small.hidden=!detail;
    undoButton.hidden=!undoable;
    feedback.dataset.undoable=undoable?'1':'0';
    feedback.dataset.visible='1';
    timer=root.setTimeout?.(()=>hide(),duration)||0;
  };

  dismiss.addEventListener('click',hide);
  feedback.addEventListener('pointerenter',clearTimer);
  feedback.addEventListener('pointerleave',()=>{
    if(feedback.dataset.visible==='1')timer=root.setTimeout?.(()=>hide(),feedback.dataset.undoable==='1'?5000:1800)||0;
  });
  feedback.addEventListener('focusin',clearTimer);
  feedback.addEventListener('focusout',()=>{
    if(feedback.dataset.visible==='1')timer=root.setTimeout?.(()=>hide(),feedback.dataset.undoable==='1'?5000:1800)||0;
  });

  undoButton.addEventListener('click',()=>{
    const source=undoSource(shell);
    if(!source||source.disabled){show('No se pudo deshacer',{duration:2600});return;}
    shell.dataset.keloFeedbackUndoing='1';
    try{source.click();}finally{delete shell.dataset.keloFeedbackUndoing;}
    show(lastDeleteCount>1?`${lastDeleteCount} objetos restaurados`:'Objeto restaurado',{detail:'Cambio deshecho',duration:2600});
  });

  const onClick=event=>{
    if(!isMobile(root))return;
    const control=event.target?.closest?.('button[data-act]');
    if(!control||!shell.contains(control)||control.closest('.ks-action-feedback'))return;
    const act=control.dataset.act;
    const selectionCount=Math.max(1,Number(shell.dataset.selectionCount||1));
    if(act==='delete'){
      lastDeleteCount=selectionCount;
      queueMicrotask(()=>show(selectionCount>1?`${selectionCount} objetos eliminados`:'Objeto eliminado',{
        detail:'Puedes recuperar este cambio',undoable:true,duration:6000
      }));
      return;
    }
    if(act==='undo'){
      if(shell.dataset.keloFeedbackUndoing==='1')return;
      queueMicrotask(()=>show('Cambio deshecho',{duration:2000}));
      return;
    }
    if(act==='redo'){
      queueMicrotask(()=>show('Cambio rehecho',{duration:2000}));
      return;
    }
    if(act==='duplicate'){
      queueMicrotask(()=>show(selectionCount>1?`${selectionCount} objetos duplicados`:'Objeto duplicado',{duration:1900}));
      return;
    }
    if(act==='save')queueMicrotask(()=>show('Cambios guardados',{duration:1900}));
  };
  shell.addEventListener('click',onClick,true);

  return Object.freeze({
    feedback,show,hide,
    destroy(){clearTimer();shell.removeEventListener('click',onClick,true);feedback.remove();}
  });
}

export function installStudioMobileActionFeedback({root=globalThis}={}){
  const doc=root?.document;
  if(!doc)return Object.freeze({version:'studio-mobile-action-feedback-v1',refresh:()=>null,destroy:()=>{}});
  const existing=root[KEY];
  if(existing?.refresh){existing.refresh();return existing;}

  const style=ensureStyle(doc);
  const MutationObserverCtor=root.MutationObserver||globalThis.MutationObserver;
  let destroyed=false,observer=null,controller=null,observedShell=null;
  const refresh=()=>{
    if(destroyed)return null;
    const shell=doc.getElementById('kelo-studio-live');
    if(!shell)return null;
    if(shell!==observedShell){
      controller?.destroy?.();
      observedShell=shell;
      controller=createController(shell,root);
    }
    return controller;
  };
  refresh();
  if(MutationObserverCtor){
    observer=new MutationObserverCtor(()=>refresh());
    observer.observe(doc.body||doc.documentElement,{childList:true,subtree:false});
  }

  const api=Object.freeze({
    version:'studio-mobile-action-feedback-v1.0.0',refresh,
    show(message,options){return refresh()?.show?.(message,options);},
    destroy(){
      if(destroyed)return;destroyed=true;observer?.disconnect?.();controller?.destroy?.();controller=null;observedShell=null;style.remove();
      try{if(root[KEY]===api)delete root[KEY];}catch{}
    }
  });
  try{root[KEY]=api;}catch{}
  return api;
}
