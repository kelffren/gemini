/* KELO-INDEX
 * area: STUDIO / NUDGE INPUT
 * owns: precise keyboard nudging for selected objects
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

export function resolveStudioNudgeStep({root=globalThis,kernel,shiftKey=false,altKey=false}={}){
  if(shiftKey)return 1;
  const select=root?.document?.querySelector?.('#kelo-studio-live [data-ext="snap"]');
  const live=Number(select?.value);
  const base=Number.isFinite(live)&&live>0?live:Math.max(1,Number(kernel?.document?.settings?.tileSize)||32);
  return altKey?base*COARSE_MULTIPLIER:base;
}

export function createStudioNudgeController({root=globalThis,kernel}={}){
  const document=root?.document;
  if(!document||!kernel)return Object.freeze({destroy(){},nudge:async()=>[]});
  let destroyed=false,busy=false;

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
    }finally{busy=false;}
  }

  function editableTarget(target){return !!target?.closest?.('input,textarea,select,[contenteditable="true"]');}
  function onKey(event){
    const dir=ARROWS[event.key];if(!dir||event.metaKey||event.ctrlKey||editableTarget(event.target))return;
    const shell=document.getElementById('kelo-studio-live');if(!shell)return;
    if(shell.dataset.sheetOpen==='1'||shell.dataset.creatorMinimized==='1')return;
    if(!['select','move'].includes(String(shell.dataset.activeTool||'select')))return;
    if(!kernel.selection.get().length)return;
    event.preventDefault();event.stopImmediatePropagation?.();
    if(event.repeat)return;
    const step=resolveStudioNudgeStep({root,kernel,shiftKey:event.shiftKey,altKey:event.altKey});
    void nudge(dir.x,dir.y,{step}).catch(error=>console.warn('[Kelo Studio] nudge failed',error));
  }

  document.addEventListener('keydown',onKey,true);
  return Object.freeze({
    nudge,
    destroy(){destroyed=true;document.removeEventListener('keydown',onKey,true);},
    get busy(){return busy;}
  });
}
