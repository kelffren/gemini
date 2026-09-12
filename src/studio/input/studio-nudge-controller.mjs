/* KELO-INDEX
 * area: STUDIO / NUDGE INPUT
 * owns: precise keyboard + mobile touch nudging for selected objects
 * does-not-own: selection, authority transport, rendering or document persistence
 * public-api: createStudioNudgeController(), resolveStudioNudgeStep()
 * online: persistent moves flow through Kernel CommandBus as one reversible batch
 */

import { createMoveEntityCommand } from '../document/document-commands.mjs';
import { createCompositeCommand } from '../document/composite-command.mjs';

const ARROWS=Object.freeze({
  ArrowLeft:{x:-1,y:0},ArrowRight:{x:1,y:0},ArrowUp:{x:0,y:-1},ArrowDown:{x:0,y:1}
});
const COARSE_MULTIPLIER=4;
const MOBILE_MODES=Object.freeze(['snap','fine','coarse']);

export function resolveStudioNudgeStep({root=globalThis,kernel,shiftKey=false,altKey=false,mode=null}={}){
  if(mode==='fine'||shiftKey)return 1;
  const select=root?.document?.querySelector?.('#kelo-studio-live [data-ext="snap"]');
  const live=Number(select?.value);
  const base=Number.isFinite(live)&&live>0?live:Math.max(1,Number(kernel?.document?.settings?.tileSize)||32);
  return mode==='coarse'||altKey?base*COARSE_MULTIPLIER:base;
}

export function createStudioNudgeController({root=globalThis,kernel}={}){
  const document=root?.document;
  if(!document||!kernel)return Object.freeze({destroy(){},nudge:async()=>[]});
  let destroyed=false,busy=false,pad=null,style=null,observer=null,mobileMode='snap';

  const selectedEntities=()=>kernel.selection.get().map(id=>kernel.document.entities.find(row=>String(row.id)===String(id))).filter(Boolean);

  async function nudge(dx,dy,{step=1}={}){
    if(destroyed||busy)return [];
    const rows=selectedEntities();if(!rows.length)return [];
    const sx=(Number(dx)||0)*Math.max(1,Number(step)||1),sy=(Number(dy)||0)*Math.max(1,Number(step)||1);
    if(!sx&&!sy)return rows;
    const commands=rows.map(row=>createMoveEntityCommand(row.id,{
      x:(Number(row.transform?.x)||0)+sx,
      y:(Number(row.transform?.y)||0)+sy
    }));
    busy=true;
    try{
      const command=commands.length===1?commands[0]:createCompositeCommand(commands,{type:'entity.batch.nudge',label:`Nudge ${rows.length} object${rows.length===1?'':'s'}`});
      await kernel.execute(command);
      return selectedEntities();
    }finally{busy=false;syncPad();}
  }

  function editableTarget(target){return !!target?.closest?.('input,textarea,select,[contenteditable="true"]');}
  function shell(){return document.getElementById('kelo-studio-live');}
  function canTouchNudge(){const host=shell();if(!host||host.dataset.sheetOpen==='1'||host.dataset.creatorMinimized==='1')return false;if(!['select','move'].includes(String(host.dataset.activeTool||'select')))return false;return kernel.selection.get().length>0;}
  function mobileStep(){return resolveStudioNudgeStep({root,kernel,mode:mobileMode});}
  function cycleMobileMode(){mobileMode=MOBILE_MODES[(MOBILE_MODES.indexOf(mobileMode)+1)%MOBILE_MODES.length];syncPad();return mobileMode;}
  function syncPad(){if(!pad)return;const visible=(root.innerWidth||9999)<=760&&canTouchNudge();pad.hidden=!visible;const modeButton=pad.querySelector('[data-nudge-mode]');if(modeButton){const step=mobileStep();modeButton.dataset.mode=mobileMode;modeButton.dataset.step=String(step);modeButton.textContent=`${step} PX`;modeButton.setAttribute('aria-label',`Nudge ${mobileMode}: ${step} pixels`);}pad.querySelectorAll('[data-nudge-dir]').forEach(button=>button.disabled=busy||!visible);}
  function onPadClick(event){const button=event.target?.closest?.('button');if(!button)return;if(button.dataset.nudgeMode!==undefined){cycleMobileMode();try{root.navigator?.vibrate?.(8);}catch{}return;}const dir=button.dataset.nudgeDir;if(!dir||!canTouchNudge())return;const vector=dir==='left'?[-1,0]:dir==='right'?[1,0]:dir==='up'?[0,-1]:[0,1];try{root.navigator?.vibrate?.(6);}catch{}void nudge(vector[0],vector[1],{step:mobileStep()}).catch(error=>console.warn('[Kelo Studio] mobile nudge failed',error));}
  function mountPad(){if(destroyed)return;const host=shell();if(!host)return;if(!style){style=document.createElement('style');style.dataset.keloStudioNudgePad='1';style.textContent=`
#kelo-studio-live .ks-nudge-pad{display:none}
@media(max-width:760px){#kelo-studio-live .ks-nudge-pad{position:absolute;right:10px;bottom:calc(max(8px,env(safe-area-inset-bottom)) + 126px);z-index:10;display:grid;grid-template-columns:46px 46px 46px;grid-template-rows:46px 46px 46px;gap:4px;padding:6px;border:1px solid rgba(231,197,106,.38);border-radius:16px;background:rgba(5,14,16,.94);box-shadow:0 12px 34px rgba(0,0,0,.48);backdrop-filter:blur(12px);pointer-events:auto}.ks-nudge-pad[hidden]{display:none!important}.ks-nudge-pad button{min-width:46px;min-height:46px;border:1px solid rgba(231,197,106,.24);border-radius:11px;background:#102022;color:#fff0b2;font-weight:900;font-size:18px;touch-action:manipulation;-webkit-tap-highlight-color:transparent}.ks-nudge-pad button:disabled{opacity:.35}.ks-nudge-pad [data-nudge-mode]{font-size:9px;letter-spacing:.04em;color:#e7c56a}.ks-nudge-pad [data-nudge-dir="up"]{grid-column:2;grid-row:1}.ks-nudge-pad [data-nudge-dir="left"]{grid-column:1;grid-row:2}.ks-nudge-pad [data-nudge-mode]{grid-column:2;grid-row:2}.ks-nudge-pad [data-nudge-dir="right"]{grid-column:3;grid-row:2}.ks-nudge-pad [data-nudge-dir="down"]{grid-column:2;grid-row:3}}
`;document.head.appendChild(style);}if(!pad?.isConnected){pad=document.createElement('div');pad.className='ks-nudge-pad';pad.setAttribute('aria-label','Mover selección con precisión');pad.innerHTML='<button type="button" data-nudge-dir="up" aria-label="Mover arriba">↑</button><button type="button" data-nudge-dir="left" aria-label="Mover izquierda">←</button><button type="button" data-nudge-mode="" aria-label="Nudge snap">SNAP</button><button type="button" data-nudge-dir="right" aria-label="Mover derecha">→</button><button type="button" data-nudge-dir="down" aria-label="Mover abajo">↓</button>';pad.addEventListener('click',onPadClick);host.appendChild(pad);}syncPad();}

  function onKey(event){
    const dir=ARROWS[event.key];if(!dir||event.metaKey||event.ctrlKey||editableTarget(event.target))return;
    const host=shell();if(!host)return;
    if(host.dataset.sheetOpen==='1'||host.dataset.creatorMinimized==='1')return;
    if(!['select','move'].includes(String(host.dataset.activeTool||'select')))return;
    if(!kernel.selection.get().length)return;
    event.preventDefault();event.stopImmediatePropagation?.();
    if(event.repeat)return;
    const step=resolveStudioNudgeStep({root,kernel,shiftKey:event.shiftKey,altKey:event.altKey});
    void nudge(dir.x,dir.y,{step}).catch(error=>console.warn('[Kelo Studio] nudge failed',error));
  }

  document.addEventListener('keydown',onKey,true);
  root.addEventListener?.('resize',syncPad,{passive:true});
  observer=new MutationObserver(()=>{mountPad();syncPad();});observer.observe(document.documentElement||document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['data-active-tool','data-sheet-open','data-creator-minimized']});
  mountPad();
  return Object.freeze({
    nudge,cycleMobileMode,syncPad,
    get mobileMode(){return mobileMode;},
    destroy(){destroyed=true;document.removeEventListener('keydown',onKey,true);root.removeEventListener?.('resize',syncPad);observer?.disconnect();pad?.remove();style?.remove();pad=style=null;},
    get busy(){return busy;}
  });
}
