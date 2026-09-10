/* KELO-INDEX
 * area: STUDIO / MULTI ALIGN
 * owns: compact multi-selection alignment UI and reversible group alignment commands
 * does-not-own: selection semantics, document persistence, authority transport or history storage
 * public-api: createStudioMultiAlign(), computeAlignedPositions()
 * online: mutations execute through Studio kernel CommandBus as one composite reversible action
 */

import { createMoveEntityCommand } from '../document/document-commands.mjs';
import { createCompositeCommand } from '../document/composite-command.mjs';

const STYLE_ID='kelo-studio-multi-align-style';
const scaleOf=e=>Math.max(.1,Math.min(8,Number(e?.transform?.scale)||1));
const rectOf=e=>({id:String(e.id),x:Number(e?.transform?.x)||0,y:Number(e?.transform?.y)||0,w:Math.max(1,(Number(e?.bounds?.w)||1)*scaleOf(e)),h:Math.max(1,(Number(e?.bounds?.h)||1)*scaleOf(e))});

export function computeAlignedPositions(entities=[],mode='left'){
  const rows=(Array.isArray(entities)?entities:[]).filter(Boolean).map(rectOf);
  if(rows.length<2)return [];
  const minX=Math.min(...rows.map(r=>r.x)),maxX=Math.max(...rows.map(r=>r.x+r.w));
  const minY=Math.min(...rows.map(r=>r.y)),maxY=Math.max(...rows.map(r=>r.y+r.h));
  const cx=(minX+maxX)/2,cy=(minY+maxY)/2;
  return rows.map(r=>{
    let x=r.x,y=r.y;
    if(mode==='left')x=minX;
    else if(mode==='hcenter')x=cx-r.w/2;
    else if(mode==='right')x=maxX-r.w;
    else if(mode==='top')y=minY;
    else if(mode==='vcenter')y=cy-r.h/2;
    else if(mode==='bottom')y=maxY-r.h;
    return {id:r.id,x:Math.round(x*100)/100,y:Math.round(y*100)/100};
  });
}

function ensureStyle(document){
  if(!document?.head||document.getElementById?.(STYLE_ID))return;
  const style=document.createElement('style');style.id=STYLE_ID;style.dataset.keloStudioUi='1';
  style.textContent=`
    #kelo-studio-live .ks-multi-align{position:fixed;left:50%;bottom:max(76px,calc(env(safe-area-inset-bottom) + 66px));transform:translateX(-50%);z-index:324;display:none;align-items:center;gap:4px;padding:5px;border:1px solid rgba(231,197,106,.34);border-radius:12px;background:rgba(7,17,19,.965);box-shadow:0 12px 34px rgba(0,0,0,.42);backdrop-filter:blur(14px);pointer-events:auto}
    #kelo-studio-live .ks-multi-align.on{display:flex}
    #kelo-studio-live .ks-multi-align-count{padding:0 7px;color:#8ea89e;font-size:6px;font-weight:900;letter-spacing:.08em;white-space:nowrap}
    #kelo-studio-live .ks-multi-align-sep{width:1px;height:23px;background:rgba(255,255,255,.08);margin:0 1px}
    #kelo-studio-live .ks-multi-align button{width:32px;height:31px;border:1px solid rgba(255,255,255,.07);border-radius:8px;background:#0f1b1d;color:#e7eee9;font-size:12px;font-weight:900;padding:0}
    #kelo-studio-live .ks-multi-align button:hover,#kelo-studio-live .ks-multi-align button:focus-visible{border-color:rgba(231,197,106,.48);color:#f3dda0;outline:none}
    @media(max-width:760px){#kelo-studio-live .ks-multi-align{bottom:max(72px,calc(env(safe-area-inset-bottom) + 64px));max-width:calc(100vw - 16px);gap:3px;padding:4px}#kelo-studio-live .ks-multi-align-count{display:none}#kelo-studio-live .ks-multi-align button{width:38px;height:36px;font-size:14px}}
  `;document.head.appendChild(style);
}

export function createStudioMultiAlign({root=globalThis,kernel}={}){
  const document=root?.document;
  if(!document||!kernel)return Object.freeze({align:async()=>false,refresh(){},destroy(){}});
  ensureStyle(document);
  let shell=null,bar=null,observer=null,selectionUnsub=null,destroyed=false;
  const selected=()=>{const ids=new Set((kernel.selection.get?.()||[]).map(String));return kernel.document.entities.filter(e=>ids.has(String(e.id)));};

  async function align(mode){
    const entities=selected();if(entities.length<2)return false;
    const targets=computeAlignedPositions(entities,mode);
    const commands=targets.filter(to=>{
      const e=entities.find(row=>String(row.id)===to.id);if(!e)return false;
      return (Number(e.transform?.x)||0)!==to.x||(Number(e.transform?.y)||0)!==to.y;
    }).map(to=>createMoveEntityCommand(to.id,to));
    if(!commands.length)return false;
    await kernel.execute(createCompositeCommand(commands,{type:'selection.align',label:`Align ${mode} · ${commands.length} objects`}));
    refresh();return true;
  }
  function build(){
    bar=document.createElement('div');bar.className='ks-multi-align';bar.dataset.keloStudioUi='1';bar.setAttribute('aria-label','Alinear selección múltiple');
    bar.innerHTML=`<span class="ks-multi-align-count"></span><span class="ks-multi-align-sep"></span>
      <button type="button" data-align="left" title="Alinear izquierda" aria-label="Alinear izquierda">↤</button>
      <button type="button" data-align="hcenter" title="Centrar horizontal" aria-label="Centrar horizontal">↔</button>
      <button type="button" data-align="right" title="Alinear derecha" aria-label="Alinear derecha">↦</button>
      <span class="ks-multi-align-sep"></span>
      <button type="button" data-align="top" title="Alinear arriba" aria-label="Alinear arriba">↥</button>
      <button type="button" data-align="vcenter" title="Centrar vertical" aria-label="Centrar vertical">↕</button>
      <button type="button" data-align="bottom" title="Alinear abajo" aria-label="Alinear abajo">↧</button>`;
    bar.addEventListener('pointerdown',event=>event.stopPropagation());
    bar.addEventListener('click',event=>{const button=event.target.closest('[data-align]');if(!button)return;event.preventDefault();event.stopPropagation();align(button.dataset.align).catch(error=>console.warn('[Kelo Studio] align failed',error));});
    shell.appendChild(bar);
  }
  function attach(){
    if(destroyed)return false;const next=document.getElementById?.('kelo-studio-live')||document.querySelector?.('#kelo-studio-live');if(!next)return false;
    if(shell===next&&bar?.isConnected)return true;bar?.remove();shell=next;build();refresh();return true;
  }
  function refresh(){
    attach();if(!bar||!shell)return;const count=selected().length;const allowed=count>1&&!['paint','erase'].includes(String(shell.dataset.activeTool||'select'))&&shell.dataset.sheetOpen!=='1'&&shell.dataset.creatorMinimized!=='1';
    bar.classList.toggle('on',allowed);const label=bar.querySelector('.ks-multi-align-count'),nextLabel=`${count} SELECTED`;if(label&&label.textContent!==nextLabel)label.textContent=nextLabel;
  }
  selectionUnsub=kernel.selection.onChange?.(()=>refresh());attach();
  if(typeof root.MutationObserver==='function'&&document.body){observer=new root.MutationObserver(()=>{if(!destroyed)refresh();});observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['data-active-tool','data-sheet-open','data-creator-minimized']});}
  return Object.freeze({align,refresh,destroy(){destroyed=true;selectionUnsub?.();observer?.disconnect?.();bar?.remove();bar=null;shell=null;}});
}
