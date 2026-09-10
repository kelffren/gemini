/* KELO-INDEX
 * area: STUDIO / INPUT / SELECTION HISTORY
 * owns: local navigation across recent Studio selections
 * does-not-own: world mutations, command history, authority or entity lifecycle
 * public-api: createStudioSelectionHistoryController(), normalizeSelectionSnapshot(), stepSelectionHistory()
 * online: no; selection-only UI state
 */

const MAX_HISTORY=40;
const EDITABLE_SELECTOR='input,textarea,select,[contenteditable="true"]';

export function normalizeSelectionSnapshot(ids=[]){
  return [...new Set((Array.isArray(ids)?ids:[]).map(id=>String(id||'')).filter(Boolean))];
}

export function stepSelectionHistory(history=[],index=-1,direction=-1){
  const rows=Array.isArray(history)?history:[];
  if(!rows.length)return -1;
  const current=Number.isInteger(index)?index:rows.length-1;
  return Math.max(0,Math.min(rows.length-1,current+(direction<0?-1:1)));
}

export function createStudioSelectionHistoryController({root=globalThis,kernel,maxHistory=MAX_HISTORY}={}){
  const document=root?.document;
  if(!document||!kernel?.selection)return Object.freeze({back:()=>false,forward:()=>false,destroy(){},get size(){return 0;},get index(){return -1;}});

  let history=[];
  let index=-1;
  let replaying=false;
  let destroyed=false;

  const same=(a,b)=>a.length===b.length&&a.every((value,i)=>value===b[i]);
  const existing=snapshot=>{
    const live=new Set((kernel.document?.entities||[]).map(row=>String(row?.id||'')).filter(Boolean));
    return normalizeSelectionSnapshot(snapshot).filter(id=>live.has(id));
  };
  const push=snapshot=>{
    const next=normalizeSelectionSnapshot(snapshot);
    if(index>=0&&same(history[index]||[],next))return false;
    if(index<history.length-1)history=history.slice(0,index+1);
    history.push(next);
    if(history.length>Math.max(2,Number(maxHistory)||MAX_HISTORY))history.shift();
    index=history.length-1;
    return true;
  };
  const apply=nextIndex=>{
    if(nextIndex<0||nextIndex>=history.length||nextIndex===index)return false;
    const snapshot=existing(history[nextIndex]);
    replaying=true;
    try{kernel.selection.set(snapshot);index=nextIndex;}
    finally{replaying=false;}
    return true;
  };
  const back=()=>apply(stepSelectionHistory(history,index,-1));
  const forward=()=>apply(stepSelectionHistory(history,index,1));

  push(kernel.selection.get?.()||[]);
  const unsubscribe=kernel.selection.onChange?.(()=>{
    if(destroyed||replaying)return;
    push(kernel.selection.get?.()||[]);
  });

  const onKeyDown=event=>{
    if(destroyed||event.defaultPrevented||event.metaKey||event.ctrlKey||event.altKey)return;
    if(event.target?.closest?.(EDITABLE_SELECTOR))return;
    const shell=document.getElementById?.('kelo-studio-live');
    if(!shell)return;
    const key=String(event.key||'');
    if(key!=='['&&key!==']')return;
    const moved=key==='['?back():forward();
    if(moved){event.preventDefault();event.stopPropagation();}
  };
  root.addEventListener?.('keydown',onKeyDown,{capture:true});

  return Object.freeze({
    back,forward,
    destroy(){
      if(destroyed)return;
      destroyed=true;
      root.removeEventListener?.('keydown',onKeyDown,{capture:true});
      try{unsubscribe?.();}catch{}
      history=[];index=-1;
    },
    get size(){return history.length;},
    get index(){return index;}
  });
}
