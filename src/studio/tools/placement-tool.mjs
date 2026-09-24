/* KELO-INDEX
 * area: STUDIO / PLACEMENT TOOL
 * owns: local ghost preview and placement commits
 * does-not-own: pointer listeners, authority, asset rendering
 * public-api: createPlacementTool()
 * online: previews are local; commits become CommandBus commands
 */

import { createPlaceEntityCommand, createCompositeCommand } from '../document/document-commands.mjs';

function id() {const uuid=globalThis.crypto?.randomUUID?.();return `entity:${uuid||`${Date.now().toString(36)}:${Math.random().toString(36).slice(2,9)}`}`;}
const clamp=(v,a,b)=>Math.max(a,Math.min(b,Number.isFinite(Number(v))?Number(v):a));

export function createPlacementTool(kernel) {
  if (!kernel) throw new Error('STUDIO_PLACEMENT_KERNEL_REQUIRED');
  let preview=null;const listeners=new Set();
  const clonePreview=()=>preview?{...preview,transform:{...preview.transform},bounds:{...preview.bounds},components:{...preview.components}}:null;
  const emit=()=>{const state=clonePreview();for(const fn of listeners){try{fn(state);}catch{}}};

  function start(prefabId,{rotation=0,scale=1,overrides={}}={}){
    const prefab=kernel.prefabs.resolve(prefabId);if(!prefab)throw new Error(`STUDIO_PREFAB_UNKNOWN:${prefabId}`);
    preview={id:id(),prefabId:String(prefabId),transform:{x:0,y:0,rotation:Number(rotation)||0,scale:clamp(scale,.1,8)},bounds:{...prefab.bounds},components:{...(overrides.components||{})}};emit();return clonePreview();
  }
  function move(x,y,{snap=32}={}){if(!preview)return null;const s=Math.max(1,Number(snap)||1),nextX=Math.round((Number(x)||0)/s)*s,nextY=Math.round((Number(y)||0)/s)*s;if(preview.transform.x===nextX&&preview.transform.y===nextY)return clonePreview();preview.transform.x=nextX;preview.transform.y=nextY;emit();return clonePreview();}
  function rotate(delta=90){if(!preview)return null;preview.transform.rotation=((Number(preview.transform.rotation)||0)+Number(delta||0))%360;emit();return preview.transform.rotation;}
  function setScale(value=1){if(!preview)return null;preview.transform.scale=clamp(value,.1,8);emit();return preview.transform.scale;}
  function scaleBy(factor=1){if(!preview)return null;return setScale((Number(preview.transform.scale)||1)*(Number(factor)||1));}
  function cancel(){preview=null;emit();}
  async function commit(){if(!preview)throw new Error('STUDIO_PLACEMENT_NOT_ACTIVE');const row=clonePreview();await kernel.execute(createPlaceEntityCommand(row));kernel.selection.set(row.id);preview=null;emit();return row;}
  async function commitBatch(rows,{label='Place build segment'}={}){const list=(rows||[]).map(row=>({...row,id:String(row?.id||id()),transform:{...(row?.transform||{})},bounds:{...(row?.bounds||{})},components:{...(row?.components||{})}}));if(!list.length)return[];const commands=list.map(createPlaceEntityCommand);await kernel.execute(createCompositeCommand(commands,{type:'entity.place.batch',label}));kernel.selection.set(list.map(row=>row.id));preview=null;emit();return list;}

  return Object.freeze({id:'placement',start,move,rotate,setScale,scaleBy,cancel,commit,commitBatch,getPreview:clonePreview,onPreview(fn){if(typeof fn!=='function')return()=>{};listeners.add(fn);return()=>listeners.delete(fn);}});
}
