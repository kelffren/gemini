/* KELO-INDEX
 * area: STUDIO / CREATOR ACTIONS
 * owns: reusable multi-selection productivity and clipboard actions
 * does-not-own: UI, authority transport, rendering
 * public-api: createCreatorActions(), smartDuplicateOffset(), findClearDuplicateOffset()
 * online: all persistent changes flow through CommandBus as one reversible batch
 */

import { createPlaceEntityCommand, createRemoveEntityCommand, createPatchEntityCommand } from '../document/document-commands.mjs';
import { createCompositeCommand } from '../document/composite-command.mjs';

const copy = value => value == null ? value : (typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value)));
function newId() { const uuid = globalThis.crypto?.randomUUID?.(); return `entity:${uuid || `${Date.now().toString(36)}:${Math.random().toString(36).slice(2,10)}`}`; }
const scaleOf=value=>{const n=Number(value);return Math.max(.1,Math.min(8,Number.isFinite(n)?Math.round(n*100)/100:1));};
const snapUp=(value,step)=>Math.max(step,Math.ceil(Math.max(1,Number(value)||1)/step)*step);
const entityRect=(row,tile)=>{
  const t=row?.transform||{},scale=scaleOf(t.scale),x=Number(t.x)||0,y=Number(t.y)||0;
  const w=Math.max(1,Number(row?.bounds?.w)||tile)*scale,h=Math.max(1,Number(row?.bounds?.h)||tile)*scale;
  return{x,y,x2:x+w,y2:y+h};
};
const rectsOverlap=(a,b)=>a.x<b.x2&&a.x2>b.x&&a.y<b.y2&&a.y2>b.y;

export function smartDuplicateOffset(rows=[],tileSize=32){
  const tile=Math.max(1,Number(tileSize)||32),items=(Array.isArray(rows)?rows:[]).filter(Boolean);
  if(!items.length)return{dx:tile,dy:0};
  const extents=items.map(row=>entityRect(row,tile));
  const minX=Math.min(...extents.map(r=>r.x)),maxX=Math.max(...extents.map(r=>r.x2));
  return{dx:snapUp(maxX-minX,tile),dy:0};
}

export function findClearDuplicateOffset(rows=[],occupiedRows=[],tileSize=32,{maxRings=8}={}){
  const tile=Math.max(1,Number(tileSize)||32),items=(Array.isArray(rows)?rows:[]).filter(Boolean);
  if(!items.length)return{dx:tile,dy:0};
  const sourceRects=items.map(row=>entityRect(row,tile));
  const occupied=(Array.isArray(occupiedRows)?occupiedRows:[]).filter(Boolean).map(row=>entityRect(row,tile));
  const minX=Math.min(...sourceRects.map(r=>r.x)),maxX=Math.max(...sourceRects.map(r=>r.x2));
  const minY=Math.min(...sourceRects.map(r=>r.y)),maxY=Math.max(...sourceRects.map(r=>r.y2));
  const stepX=snapUp(maxX-minX,tile),stepY=snapUp(maxY-minY,tile);
  const clear=(dx,dy)=>sourceRects.every(rect=>{
    const shifted={x:rect.x+dx,y:rect.y+dy,x2:rect.x2+dx,y2:rect.y2+dy};
    return occupied.every(blocker=>!rectsOverlap(shifted,blocker));
  });
  const rings=Math.max(1,Math.min(32,Math.floor(Number(maxRings)||8)));
  for(let ring=1;ring<=rings;ring++){
    const candidates=[
      [stepX*ring,0],[0,stepY*ring],[-stepX*ring,0],[0,-stepY*ring],
      [stepX*ring,stepY*ring],[-stepX*ring,stepY*ring],[-stepX*ring,-stepY*ring],[stepX*ring,-stepY*ring]
    ];
    for(const [dx,dy] of candidates)if(clear(dx,dy))return{dx,dy};
  }
  return smartDuplicateOffset(items,tile);
}

export function createCreatorActions(kernel) {
  if (!kernel) throw new Error('STUDIO_CREATOR_ACTIONS_KERNEL_REQUIRED');
  let clipboard = [], pasteCount = 0;
  const selectedEntities = () => kernel.selection.get().map(id => kernel.document.entities.find(e => e.id === id)).filter(Boolean);
  const sanitizeClone = row => { const clone=copy(row); clone.id=newId(); if(clone.source)clone.source={...clone.source,authorityPlacementId:undefined}; return clone; };

  async function removeSelection() {
    const rows = selectedEntities(); if (!rows.length) return [];
    await kernel.execute(createCompositeCommand(rows.map(row => createRemoveEntityCommand(row.id)), { type: 'entity.batch.remove', label: `Delete ${rows.length} object${rows.length === 1 ? '' : 's'}` }));
    kernel.selection.clear(); return rows.map(row => row.id);
  }

  async function duplicateSelection({ offsetX, offsetY, armGrab = true } = {}) {
    const rows = selectedEntities(); if (!rows.length) return [];
    const tile = Math.max(1, Number(kernel.document.settings?.tileSize) || 32),smart=findClearDuplicateOffset(rows,kernel.document.entities,tile);
    const dx = Number.isFinite(Number(offsetX)) ? Number(offsetX) : smart.dx, dy = Number.isFinite(Number(offsetY)) ? Number(offsetY) : smart.dy;
    const clones = rows.map(row => { const clone=sanitizeClone(row); clone.transform={...(clone.transform||{}),x:(Number(clone.transform?.x)||0)+dx,y:(Number(clone.transform?.y)||0)+dy}; return clone; });
    await kernel.execute(createCompositeCommand(clones.map(row => createPlaceEntityCommand(row)), { type: 'entity.batch.duplicate', label: `Duplicate ${clones.length} object${clones.length === 1 ? '' : 's'}` }));
    const ids=clones.map(row => row.id);kernel.selection.set(ids);
    if(armGrab)kernel.tools.get?.('select')?.armGrab?.(ids);
    return clones;
  }

  function copySelection() {
    const rows=selectedEntities(); clipboard=rows.map(copy); pasteCount=0; return clipboard.length;
  }

  async function pasteClipboard({ offsetX, offsetY } = {}) {
    if(!clipboard.length)return [];
    const tile=Math.max(1,Number(kernel.document.settings?.tileSize)||32);pasteCount++;
    const dx=Number.isFinite(Number(offsetX))?Number(offsetX):tile*pasteCount,dy=Number.isFinite(Number(offsetY))?Number(offsetY):tile*pasteCount;
    const clones=clipboard.map(row=>{const clone=sanitizeClone(row);clone.transform={...(clone.transform||{}),x:(Number(clone.transform?.x)||0)+dx,y:(Number(clone.transform?.y)||0)+dy};return clone;});
    await kernel.execute(createCompositeCommand(clones.map(row=>createPlaceEntityCommand(row)),{type:'entity.batch.paste',label:`Paste ${clones.length} object${clones.length===1?'':'s'}`}));
    kernel.selection.set(clones.map(row=>row.id));return clones;
  }

  async function rotateSelection(delta = 90) {
    const rows = selectedEntities(); if (!rows.length) return [];
    const commands = rows.map(row => {
      const rotation = ((Number(row.transform?.rotation) || 0) + Number(delta || 0)) % 360;
      return createPatchEntityCommand(row.id, { transform: { ...(row.transform || {}), rotation } });
    });
    await kernel.execute(createCompositeCommand(commands, { type: 'entity.batch.rotate', label: `Rotate ${rows.length} object${rows.length === 1 ? '' : 's'}` }));
    return selectedEntities();
  }

  async function scaleSelection({delta=0,value=null}={}) {
    const rows=selectedEntities(); if(!rows.length)return [];
    const commands=[];
    for(const row of rows){const current=scaleOf(row.transform?.scale),next=scaleOf(value==null?current+(Number(delta)||0):value);if(next===current)continue;commands.push(createPatchEntityCommand(row.id,{transform:{...(row.transform||{}),scale:next}}));}
    if(!commands.length)return rows;
    await kernel.execute(createCompositeCommand(commands,{type:'entity.batch.scale',label:`Scale ${rows.length} object${rows.length===1?'':'s'}`}));
    return selectedEntities();
  }

  async function patchPrimary(patch) {
    const id = kernel.selection.get()[0]; if (!id) return null;
    await kernel.execute(createPatchEntityCommand(id, patch));
    return kernel.document.entities.find(e => e.id === id) || null;
  }

  return Object.freeze({ selectedEntities, removeSelection, duplicateSelection, copySelection, pasteClipboard, rotateSelection, scaleSelection, patchPrimary, get clipboardSize(){return clipboard.length;} });
}
