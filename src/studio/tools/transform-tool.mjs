/* KELO-INDEX
 * area: STUDIO / TRANSFORM TOOL
 * owns: local single/group transform preview, magnetic smart guides and commit-on-release semantics
 * does-not-own: pointer transport or renderer
 * public-api: createTransformTool()
 * online: drag preview/guides are local; group commit becomes one CompositeCommand
 */

import { createMoveEntityCommand, createPatchEntityCommand } from '../document/document-commands.mjs';
import { createCompositeCommand } from '../document/composite-command.mjs';

const DEFAULT_MAGNET=10;
const DEFAULT_GUIDE_RANGE=256;

export function createTransformTool(kernel) {
  if (!kernel) throw new Error('STUDIO_TRANSFORM_KERNEL_REQUIRED');
  let state = null;
  const find = id => kernel.document.entities.find(e => e.id === String(id)) || null;
  const n = value => Number(value) || 0;

  function rowRect(row,dx=0,dy=0){
    const spatial=kernel.spatial.get(row.entityId)?.rect,e=find(row.entityId),scale=Math.max(.1,Number(row.from?.scale ?? e?.transform?.scale ?? 1)||1);
    return{x:n(row.from.x)+dx,y:n(row.from.y)+dy,w:Math.max(1,Number(spatial?.w)||((Number(e?.bounds?.w)||1)*scale)),h:Math.max(1,Number(spatial?.h)||((Number(e?.bounds?.h)||1)*scale))};
  }
  function groupRect(rows,dx=0,dy=0){
    const rects=rows.map(row=>rowRect(row,dx,dy));if(!rects.length)return{x:0,y:0,w:1,h:1};
    const x=Math.min(...rects.map(r=>r.x)),y=Math.min(...rects.map(r=>r.y)),x2=Math.max(...rects.map(r=>r.x+r.w)),y2=Math.max(...rects.map(r=>r.y+r.h));return{x,y,w:x2-x,h:y2-y};
  }
  const marks=(rect,axis)=>axis==='x'?[{value:rect.x,kind:'start'},{value:rect.x+rect.w/2,kind:'center'},{value:rect.x+rect.w,kind:'end'}]:[{value:rect.y,kind:'start'},{value:rect.y+rect.h/2,kind:'center'},{value:rect.y+rect.h,kind:'end'}];
  function bestAxisSnap(axis,moving,candidates,threshold){
    let best=null;const own=marks(moving,axis);
    for(const candidate of candidates){for(const source of own){for(const target of marks(candidate.rect,axis)){
      const delta=target.value-source.value,abs=Math.abs(delta);if(abs>threshold)continue;
      const sameKind=source.kind===target.kind?0:1,centerPair=source.kind==='center'&&target.kind==='center'?0:1,score=[abs,centerPair,sameKind];
      if(!best||score[0]<best.score[0]||(score[0]===best.score[0]&&score[1]<best.score[1])||(score[0]===best.score[0]&&score[1]===best.score[1]&&score[2]<best.score[2]))best={axis,delta,position:target.value,sourceKind:source.kind,targetKind:target.kind,candidateId:candidate.id,candidateRect:candidate.rect,score};
    }}}
    return best;
  }
  function nearbyCandidates(moving,range){
    const selected=new Set(state.rows.map(row=>String(row.entityId))),pad=Math.max(DEFAULT_GUIDE_RANGE,Number(range)||DEFAULT_GUIDE_RANGE),area={x:moving.x-pad,y:moving.y-pad,w:moving.w+pad*2,h:moving.h+pad*2};
    return kernel.spatial.queryRect(area,{category:'entity'}).filter(row=>!selected.has(String(row.id))&&row.rect);
  }
  function guideFromSnap(snap,moving){
    if(!snap)return null;const target=snap.candidateRect;
    if(snap.axis==='x')return{axis:'x',position:snap.position,from:Math.min(moving.y,target.y)-18,to:Math.max(moving.y+moving.h,target.y+target.h)+18,kind:snap.sourceKind===snap.targetKind?snap.sourceKind:'edge'};
    return{axis:'y',position:snap.position,from:Math.min(moving.x,target.x)-18,to:Math.max(moving.x+moving.w,target.x+target.w)+18,kind:snap.sourceKind===snap.targetKind?snap.sourceKind:'edge'};
  }

  function begin(entityId,{useSelection=true}={}) {
    const entity=find(entityId);if(!entity)throw new Error('STUDIO_ENTITY_NOT_FOUND');
    const selected=kernel.selection.get(),ids=useSelection&&selected.includes(entity.id)&&selected.length>1?selected.slice():[entity.id];
    const rows=ids.map(id=>{const e=find(id);return e?{entityId:id,from:{...(e.transform||{})},preview:{...(e.transform||{})}}:null;}).filter(Boolean);
    const anchor=rows.find(row=>row.entityId===entity.id)||rows[0];state={entityId:entity.id,anchorFrom:{...anchor.from},rows,snapTarget:null,guides:[]};return snapshot();
  }

  function previewMove(x,y,{snap=1,smart=true,magnet=DEFAULT_MAGNET,guideRange=DEFAULT_GUIDE_RANGE}={}){
    if(!state)return null;
    const s=Math.max(1,Number(snap)||1),tx=n(x),ty=n(y),anchorX=n(state.anchorFrom.x),anchorY=n(state.anchorFrom.y),rawDx=tx-anchorX,rawDy=ty-anchorY;
    const rawGroup=groupRect(state.rows,rawDx,rawDy),threshold=Math.max(0,Number(magnet)||0),candidates=smart&&threshold>0?nearbyCandidates(rawGroup,guideRange):[];
    const xSnap=bestAxisSnap('x',rawGroup,candidates,threshold),ySnap=bestAxisSnap('y',rawGroup,candidates,threshold),finalTx=tx+(xSnap?.delta||0),finalTy=ty+(ySnap?.delta||0),dx=finalTx-anchorX,dy=finalTy-anchorY,previewGroup=groupRect(state.rows,dx,dy);
    state.snapTarget={x:xSnap?finalTx:Math.round(tx/s)*s,y:ySnap?finalTy:Math.round(ty/s)*s,snap:s,magneticX:!!xSnap,magneticY:!!ySnap};
    state.guides=[guideFromSnap(xSnap,previewGroup),guideFromSnap(ySnap,previewGroup)].filter(Boolean);
    for(const row of state.rows){row.preview.x=n(row.from.x)+dx;row.preview.y=n(row.from.y)+dy;}
    return snapshot();
  }

  function previewRotate(rotation){if(!state)return null;const row=state.rows.find(x=>x.entityId===state.entityId)||state.rows[0];row.preview.rotation=Number(rotation)||0;return snapshot();}
  function cancel(){state=null;}
  function snapshot(){if(!state)return null;return{entityId:state.entityId,rows:state.rows.map(row=>({entityId:row.entityId,from:{...row.from},preview:{...row.preview}})),guides:state.guides.map(guide=>({...guide})),snapTarget:state.snapTarget?{...state.snapTarget}:null,...((state.rows.find(x=>x.entityId===state.entityId)||state.rows[0])?.preview||{})};}

  async function commit(){
    if(!state)throw new Error('STUDIO_TRANSFORM_NOT_ACTIVE');const current=state;state=null;const commands=[];
    const snap=current.snapTarget,anchorX=n(current.anchorFrom.x),anchorY=n(current.anchorFrom.y),snapDx=snap?Number(snap.x)-anchorX:null,snapDy=snap?Number(snap.y)-anchorY:null;
    for(const row of current.rows){
      const finalX=snap?n(row.from.x)+snapDx:n(row.preview.x),finalY=snap?n(row.from.y)+snapDy:n(row.preview.y);
      const moved=Number(row.from.x)!==finalX||Number(row.from.y)!==finalY;if(moved)commands.push(createMoveEntityCommand(row.entityId,{x:finalX,y:finalY}));
      const rotated=Number(row.from.rotation||0)!==Number(row.preview.rotation||0);if(rotated){const e=find(row.entityId);commands.push(createPatchEntityCommand(row.entityId,{transform:{...(e?.transform||{}),rotation:row.preview.rotation}}));}
    }
    if(!commands.length)return{entityIds:current.rows.map(x=>x.entityId),commands:0};
    if(commands.length===1)await kernel.execute(commands[0]);else await kernel.execute(createCompositeCommand(commands,{type:'entity.batch.transform',label:`Move ${current.rows.length} object${current.rows.length===1?'':'s'}`}));
    return{entityIds:current.rows.map(x=>x.entityId),commands:commands.length};
  }

  return Object.freeze({id:'transform',begin,previewMove,previewRotate,commit,cancel,getPreview:snapshot,getPreviews:()=>state?state.rows.map(row=>({entityId:row.entityId,...row.preview})):[],getGuides:()=>state?state.guides.map(guide=>({...guide})):[]});
}
