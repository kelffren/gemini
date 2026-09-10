/* KELO-INDEX
 * area: STUDIO / TRANSFORM TOOL
 * owns: local single/group transform preview and commit-on-release semantics
 * does-not-own: pointer transport or renderer
 * public-api: createTransformTool()
 * online: drag preview is local; group commit becomes one CompositeCommand
 */

import { createMoveEntityCommand, createPatchEntityCommand } from '../document/document-commands.mjs';
import { createCompositeCommand } from '../document/composite-command.mjs';

export function createTransformTool(kernel) {
  if (!kernel) throw new Error('STUDIO_TRANSFORM_KERNEL_REQUIRED');
  let state = null;
  const find = id => kernel.document.entities.find(e => e.id === String(id)) || null;

  function begin(entityId,{useSelection=true}={}) {
    const entity=find(entityId);if(!entity)throw new Error('STUDIO_ENTITY_NOT_FOUND');
    const selected=kernel.selection.get(),ids=useSelection&&selected.includes(entity.id)&&selected.length>1?selected.slice():[entity.id];
    const rows=ids.map(id=>{const e=find(id);return e?{entityId:id,from:{...(e.transform||{})},preview:{...(e.transform||{})}}:null;}).filter(Boolean);
    const anchor=rows.find(row=>row.entityId===entity.id)||rows[0];state={entityId:entity.id,anchorFrom:{...anchor.from},rows,snapTarget:null};return snapshot();
  }

  function previewMove(x,y,{snap=1}={}){
    if(!state)return null;
    const s=Math.max(1,Number(snap)||1),tx=Number(x)||0,ty=Number(y)||0,dx=tx-(Number(state.anchorFrom.x)||0),dy=ty-(Number(state.anchorFrom.y)||0);
    state.snapTarget={x:Math.round(tx/s)*s,y:Math.round(ty/s)*s,snap:s};
    for(const row of state.rows){row.preview.x=(Number(row.from.x)||0)+dx;row.preview.y=(Number(row.from.y)||0)+dy;}
    return snapshot();
  }

  function previewRotate(rotation){if(!state)return null;const row=state.rows.find(x=>x.entityId===state.entityId)||state.rows[0];row.preview.rotation=Number(rotation)||0;return snapshot();}
  function cancel(){state=null;}
  function snapshot(){if(!state)return null;return{entityId:state.entityId,rows:state.rows.map(row=>({entityId:row.entityId,from:{...row.from},preview:{...row.preview}})),...((state.rows.find(x=>x.entityId===state.entityId)||state.rows[0])?.preview||{})};}

  async function commit(){
    if(!state)throw new Error('STUDIO_TRANSFORM_NOT_ACTIVE');const current=state;state=null;const commands=[];
    const snap=current.snapTarget,anchorX=Number(current.anchorFrom.x)||0,anchorY=Number(current.anchorFrom.y)||0,snapDx=snap?Number(snap.x)-anchorX:null,snapDy=snap?Number(snap.y)-anchorY:null;
    for(const row of current.rows){
      const finalX=snap?(Number(row.from.x)||0)+snapDx:Number(row.preview.x)||0,finalY=snap?(Number(row.from.y)||0)+snapDy:Number(row.preview.y)||0;
      const moved=Number(row.from.x)!==finalX||Number(row.from.y)!==finalY;if(moved)commands.push(createMoveEntityCommand(row.entityId,{x:finalX,y:finalY}));
      const rotated=Number(row.from.rotation||0)!==Number(row.preview.rotation||0);if(rotated){const e=find(row.entityId);commands.push(createPatchEntityCommand(row.entityId,{transform:{...(e?.transform||{}),rotation:row.preview.rotation}}));}
    }
    if(!commands.length)return{entityIds:current.rows.map(x=>x.entityId),commands:0};
    if(commands.length===1)await kernel.execute(commands[0]);else await kernel.execute(createCompositeCommand(commands,{type:'entity.batch.transform',label:`Move ${current.rows.length} object${current.rows.length===1?'':'s'}`}));
    return{entityIds:current.rows.map(x=>x.entityId),commands:commands.length};
  }

  return Object.freeze({id:'transform',begin,previewMove,previewRotate,commit,cancel,getPreview:snapshot,getPreviews:()=>state?state.rows.map(row=>({entityId:row.entityId,...row.preview})):[]});
}
