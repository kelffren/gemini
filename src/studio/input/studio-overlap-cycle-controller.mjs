/* KELO-INDEX
 * area: STUDIO / SELECTION
 * owns: editor-only cycling through overlapping entities under a pointer
 * does-not-own: world mutations, render order, command history or authority
 * public-api: createStudioOverlapCycleController(), overlappingEntitiesAtPoint(), nextOverlapSelection()
 * online: local selection only; never mutates authoritative world state
 */

const inside=(r,x,y)=>!!r&&x>=Number(r.x||0)&&x<=Number(r.x||0)+Math.max(0,Number(r.w||0))&&y>=Number(r.y||0)&&y<=Number(r.y||0)+Math.max(0,Number(r.h||0));

export function overlappingEntitiesAtPoint({entities=[],spatial},x,y){
  const rows=Array.isArray(entities)?entities:[];
  const out=[];
  for(let i=rows.length-1;i>=0;i--){
    const entity=rows[i];
    const rect=spatial?.get?.(entity?.id)?.rect;
    if(inside(rect,Number(x)||0,Number(y)||0))out.push(entity);
  }
  return out;
}

export function nextOverlapSelection(candidates=[],currentId=null){
  const rows=Array.isArray(candidates)?candidates.filter(Boolean):[];
  if(!rows.length)return null;
  const current=String(currentId??'');
  const index=rows.findIndex(row=>String(row?.id)===current);
  return rows[index>=0?(index+1)%rows.length:0]||null;
}

export function createStudioOverlapCycleController({root=globalThis,kernel}={}){
  const document=root?.document;
  if(!document||!kernel)return Object.freeze({destroy(){},cycleAt:()=>null});
  let destroyed=false;

  function shell(){return document.getElementById?.('kelo-studio-live')||document.querySelector?.('#kelo-studio-live');}
  function isEditorUi(target){return !!target?.closest?.('[data-kelo-studio-ui],.ks-clean-toolbar,.ks-context-inspector,.ks-asset-palette');}
  function cycleAt(clientX,clientY){
    const camera=root.KeloCamera;
    if(!camera?.screenToWorld)return null;
    const point=camera.screenToWorld(Number(clientX)||0,Number(clientY)||0);
    const candidates=overlappingEntitiesAtPoint({entities:kernel.document?.entities||[],spatial:kernel.spatial},point.x,point.y);
    if(candidates.length<2)return null;
    const current=kernel.selection?.get?.()?.[0]??null;
    const next=nextOverlapSelection(candidates,current);
    if(!next)return null;
    kernel.selection.set([next.id]);
    return Object.freeze({id:next.id,count:candidates.length,index:candidates.findIndex(row=>String(row.id)===String(next.id))});
  }
  function onPointerDown(event){
    if(destroyed||!event.altKey||event.button!==0||event.pointerType==='touch'||isEditorUi(event.target))return;
    const studio=shell();
    if(!studio||studio.dataset.creatorMinimized==='1'||studio.dataset.sheetOpen==='1')return;
    const active=String(studio.dataset.activeTool||'select');
    if(!['select','move'].includes(active))return;
    const result=cycleAt(event.clientX,event.clientY);
    if(!result)return;
    event.preventDefault();event.stopImmediatePropagation?.();event.stopPropagation?.();
  }

  document.addEventListener('pointerdown',onPointerDown,true);
  return Object.freeze({
    cycleAt,
    destroy(){if(destroyed)return;destroyed=true;document.removeEventListener('pointerdown',onPointerDown,true);}
  });
}
