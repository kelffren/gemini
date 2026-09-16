/* KELO-INDEX
 * area: STUDIO / QUICK EDIT
 * owns: contextual editing of selected Quick Build pieces and handoff back into Quick Build / Edit Grid
 * does-not-own: selection hit testing, document mutation internals, authority, rendering or generic transforms
 * public-api: createQuickEditTool()
 * online: rotate/duplicate/replace delegate to CreatorActions -> CommandBus -> authority
 * mobile: contextual touch toolbar; no render loop and only a bounded body child observer
 */

import { createCreatorActions } from './creator-actions.mjs';
import { defaultSnapPointsForPiece } from './snap-resolver.mjs';

const copy=value=>value==null?value:(typeof structuredClone==='function'?structuredClone(value):JSON.parse(JSON.stringify(value)));
const norm=value=>String(value||'').trim().toLowerCase();
const clampRotation=value=>((Number(value)||0)%360+360)%360;

export function createQuickEditTool(kernel,{quickBuild=null,root=globalThis}={}){
  if(!kernel)throw new Error('STUDIO_QUICK_EDIT_KERNEL_REQUIRED');
  quickBuild=quickBuild||kernel.tools?.get?.('quickBuild');
  if(!quickBuild?.pieces||!quickBuild?.activate||!quickBuild?.resolveMove)throw new Error('STUDIO_QUICK_EDIT_QUICK_BUILD_REQUIRED');

  const actions=createCreatorActions(kernel),document=root?.document;
  let destroyed=false,bar=null,style=null,observer=null,selectionOff=null,commandsOff=null,busy=false;

  const find=id=>kernel.document.entities.find(row=>String(row.id)===String(id))||kernel.spatial.get?.(id)?.data||null;
  const pieceForType=type=>quickBuild.pieces.find(piece=>piece.type===String(type))||null;
  const prefabFor=piece=>piece?kernel.prefabs.resolve?.(piece.prefabId)||kernel.prefabs.get?.(piece.prefabId):null;

  function selectedEntity(){
    const ids=kernel.selection.get();
    if(ids.length!==1)return null;
    return find(ids[0]);
  }

  function selectedEditable(){
    const row=selectedEntity(),meta=row?.components?.buildingPiece;
    if(!row||!meta?.type)return null;
    if(meta.roomGenerated===true||meta.openingGenerated===true)return null;
    if(!pieceForType(meta.type))return null;
    return row;
  }

  function semanticFor(piece,bounds,source={}){
    return{
      ...copy(source),
      type:piece.type,
      system:'quick-build',
      version:Math.max(5,Number(source?.version)||0),
      slot:piece.slot,
      snapPoints:defaultSnapPointsForPiece(piece.type,bounds)
    };
  }

  async function rotateSelected(){
    if(busy||!selectedEditable())return null;
    busy=true;try{return await actions.rotateSelection(90);}finally{busy=false;syncUi();}
  }

  async function duplicateSelected(){
    if(busy||!selectedEditable())return null;
    busy=true;try{return await actions.duplicateSelection({armGrab:false});}finally{busy=false;syncUi();}
  }

  async function replaceSelected(type){
    if(busy)return null;
    const row=selectedEditable(),piece=pieceForType(type);if(!row||!piece)return null;
    if(row.components?.buildingPiece?.type===piece.type)return row;
    const prefab=prefabFor(piece);if(!prefab)return null;
    const bounds={w:Math.max(1,Number(prefab.bounds?.w)||32),h:Math.max(1,Number(prefab.bounds?.h)||32)};
    const nextMeta=semanticFor(piece,bounds,row.components?.buildingPiece||{});
    delete nextMeta.editGrid;delete nextMeta.variant;delete nextMeta.variantPrefabId;
    const components={...(copy(row.components)||{}),buildingPiece:nextMeta};
    busy=true;
    try{return await actions.patchPrimary({prefabId:piece.prefabId,bounds,components});}
    finally{busy=false;syncUi();}
  }

  function nextBuildPoint(row){
    const type=norm(row?.components?.buildingPiece?.type),rotation=clampRotation(row?.transform?.rotation),vertical=rotation===90||rotation===270;
    const grid=Math.max(1,Number(kernel.document?.settings?.tileSize)||32),w=Math.max(1,Number(row?.bounds?.w)||grid),h=Math.max(1,Number(row?.bounds?.h)||grid);
    const module=(type==='wall'||type==='ramp'||type==='fence')?w:(vertical?h:w);
    const distance=Math.max(grid,Math.round(module/grid)*grid),direction=rotation===180||rotation===270?-1:1;
    return{x:(Number(row?.transform?.x)||0)+(vertical?0:distance*direction),y:(Number(row?.transform?.y)||0)+(vertical?distance*direction:0),rotation};
  }

  function continueBuild(){
    const row=selectedEditable();if(!row)return false;
    const type=row.components.buildingPiece.type,piece=pieceForType(type);if(!piece)return false;
    const next=nextBuildPoint(row);
    if(!quickBuild.activate(type))return false;
    quickBuild.resolveMove(next.x,next.y);
    syncUi();return true;
  }

  function openEditGrid(){
    const row=selectedEditable();if(!row||row.components?.buildingPiece?.type!=='wall')return false;
    const tool=kernel.tools.get?.('buildEditGrid');
    return !!tool?.activate?.();
  }

  function ensureUi(){
    if(destroyed||!document)return null;
    const shell=document.getElementById?.('kelo-studio-live');if(!shell)return null;
    if(!style){
      style=document.createElement('style');style.dataset.keloQuickEdit='1';style.textContent=`
        #kelo-studio-live .ks-qe-bar{position:absolute;left:50%;bottom:138px;transform:translateX(-50%);z-index:13;display:flex;align-items:center;gap:5px;max-width:calc(100vw - 16px);padding:6px;border:1px solid rgba(130,175,255,.42);border-radius:15px;background:#07101bf2;box-shadow:0 12px 30px rgba(0,0,0,.32)}
        #kelo-studio-live .ks-qe-bar[hidden]{display:none}
        #kelo-studio-live:has(.ks-qb-palette:not([hidden])) .ks-qe-bar,#kelo-studio-live:has(.ks-beg:not([hidden])) .ks-qe-bar{display:none}
        #kelo-studio-live .ks-qe-title{font-size:7px;font-weight:950;letter-spacing:.08em;color:#9dbdff;white-space:nowrap;padding:0 3px}
        #kelo-studio-live .ks-qe-action,#kelo-studio-live .ks-qe-piece{min-height:42px;border:1px solid #334b72;border-radius:10px;background:#102139;color:#e7f0ff;font-size:8px;font-weight:900;padding:0 9px;touch-action:manipulation}
        #kelo-studio-live .ks-qe-piece{min-width:42px;padding:0 7px}.ks-qe-piece.on{border-color:#8fb4ff;background:#1b3152}.ks-qe-action.primary{border-color:#568a70;background:#123026;color:#c9f8da}.ks-qe-action.grid{border-color:#6c5c91;background:#241d3d;color:#e5dbff}.ks-qe-action:disabled,.ks-qe-piece:disabled{opacity:.4}
        @media(max-width:760px){#kelo-studio-live .ks-qe-bar{left:8px;right:8px;bottom:calc(132px + env(safe-area-inset-bottom));transform:none;overflow-x:auto;justify-content:flex-start;scrollbar-width:none}.ks-qe-title{position:sticky;left:0;background:#07101bf2}.ks-qe-action,.ks-qe-piece{flex:0 0 auto;min-height:46px}}
      `;document.head?.appendChild(style);
    }
    if(!bar?.isConnected){
      bar=document.createElement('div');bar.className='ks-qe-bar';bar.dataset.keloStudioUi='1';bar.hidden=true;
      bar.innerHTML=`<span class="ks-qe-title">EDIT</span><button type="button" class="ks-qe-action" data-qe-rotate="1">↻ ROTATE</button><button type="button" class="ks-qe-action" data-qe-duplicate="1">⧉ DUP</button><button type="button" class="ks-qe-action grid" data-qe-grid="1">▦ GRID</button><button type="button" class="ks-qe-action primary" data-qe-build="1">➜ BUILD</button>${quickBuild.pieces.map(piece=>`<button type="button" class="ks-qe-piece" data-qe-type="${piece.type}" title="Replace with ${piece.label}">${piece.slot} ${piece.glyph}</button>`).join('')}`;
      bar.addEventListener('click',event=>{
        const target=event.target?.closest?.('button');if(!target)return;
        event.preventDefault?.();event.stopPropagation?.();
        if(target.dataset.qeRotate)void rotateSelected().catch(error=>console.warn('[Kelo Studio] Quick Edit rotate failed',error));
        else if(target.dataset.qeDuplicate)void duplicateSelected().catch(error=>console.warn('[Kelo Studio] Quick Edit duplicate failed',error));
        else if(target.dataset.qeGrid)openEditGrid();
        else if(target.dataset.qeBuild)continueBuild();
        else if(target.dataset.qeType)void replaceSelected(target.dataset.qeType).catch(error=>console.warn('[Kelo Studio] Quick Edit replace failed',error));
      });
      shell.appendChild(bar);
    }
    syncUi();return bar;
  }

  function syncUi(){
    if(!bar)return;
    const row=selectedEditable(),type=row?.components?.buildingPiece?.type||null;
    bar.hidden=!row;
    bar.querySelectorAll?.('button')?.forEach(button=>button.disabled=busy||!row);
    const grid=bar.querySelector?.('[data-qe-grid]');if(grid)grid.disabled=busy||!row||type!=='wall';
    bar.querySelectorAll?.('[data-qe-type]')?.forEach(button=>button.classList.toggle('on',button.dataset.qeType===type));
    const title=bar.querySelector?.('.ks-qe-title');if(title)title.textContent=row?`EDIT · ${String(type).toUpperCase()}`:'EDIT';
  }

  function destroy(){
    if(destroyed)return;destroyed=true;
    selectionOff?.();commandsOff?.();observer?.disconnect?.();bar?.remove();style?.remove();bar=null;style=null;
  }

  selectionOff=kernel.selection.onChange(()=>{ensureUi();syncUi();});
  commandsOff=kernel.commands.on(()=>syncUi());
  if(document?.body&&root?.MutationObserver){observer=new root.MutationObserver(()=>ensureUi());observer.observe(document.body,{childList:true});}
  ensureUi();

  return Object.freeze({
    id:'quickEdit',version:'studio-quick-edit-v1.1.0-edit-grid-handoff',
    canEdit:()=>!!selectedEditable(),getSelected:()=>copy(selectedEditable()),
    rotateSelected,duplicateSelected,replaceSelected,continueBuild,openEditGrid,destroy
  });
}
