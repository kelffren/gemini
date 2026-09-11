/* KELO-INDEX
 * area: STUDIO / UI / HISTORY HINTS
 * owns: contextual labels for undo/redo controls
 * does-not-own: history mutation, commands, authority or shell structure
 * public-api: createStudioHistoryHints()
 * online: no; reads local history metadata only
 */

function nextLabels(history){
  const state=history?.inspect?.()||{undo:[],redo:[]};
  return{
    undo:state.undo?.length?String(state.undo[state.undo.length-1]):'',
    redo:state.redo?.length?String(state.redo[state.redo.length-1]):''
  };
}

function labelButton(button,kind,label){
  if(!button)return;
  const base=kind==='undo'?'Deshacer':'Rehacer';
  const text=label?`${base}: ${label}`:base;
  button.title=text;
  button.setAttribute('aria-label',text);
  button.dataset.historyHint=label||'';
}

export function createStudioHistoryHints({root=globalThis,kernel}={}){
  const document=root?.document;
  const history=kernel?.history;
  if(!document||!history)return Object.freeze({refresh(){return false;},destroy(){}});
  let destroyed=false;

  const refresh=()=>{
    if(destroyed)return false;
    const labels=nextLabels(history);
    document.querySelectorAll?.('[data-act="undo"]').forEach(button=>labelButton(button,'undo',labels.undo));
    document.querySelectorAll?.('[data-act="redo"]').forEach(button=>labelButton(button,'redo',labels.redo));
    return true;
  };

  const unsubscribe=kernel.commands?.on?.(()=>queueMicrotask(refresh))||(()=>{});
  const observer=typeof root.MutationObserver==='function'?new root.MutationObserver(()=>refresh()):null;
  observer?.observe?.(document.documentElement||document.body,{childList:true,subtree:true});
  refresh();

  return Object.freeze({
    version:'studio-history-hints-v1.0.0',
    refresh,
    get next(){return nextLabels(history);},
    destroy(){if(destroyed)return;destroyed=true;unsubscribe?.();observer?.disconnect?.();}
  });
}
