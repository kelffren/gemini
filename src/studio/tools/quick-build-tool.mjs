/* KELO-INDEX
 * area: STUDIO / QUICK BUILD
 * owns: semantic piece selection, continuous placement input context, snap orchestration and compact Quick Build chrome
 * does-not-own: document mutation, CommandBus, authority, world rendering or camera transforms
 * public-api: createQuickBuildTool(), resolveQuickBuildPieces()
 * online: commits delegate to placement.commit() -> Kernel CommandBus -> authority mirror
 */

import { createSnapResolver, defaultSnapPointsForPiece } from './snap-resolver.mjs';

const CONTEXT='studio-quick-build';
const EDITABLE='input,textarea,select,[contenteditable="true"],[contenteditable=""]';
const PIECES=Object.freeze([
  Object.freeze({type:'wall',label:'WALL',glyph:'▥',keywords:['wall','muro','pared','fence','barrier']}),
  Object.freeze({type:'floor',label:'FLOOR',glyph:'▦',keywords:['floor','tile','ground','piso']})
]);
const norm=value=>String(value||'').trim().toLowerCase();
const copy=value=>value==null?value:(typeof structuredClone==='function'?structuredClone(value):JSON.parse(JSON.stringify(value)));

function scorePrefab(prefab,piece){
  const id=norm(prefab?.id),label=norm(prefab?.label),category=norm(prefab?.category),text=`${id} ${label} ${category}`;
  let score=0;
  for(const word of piece.keywords){if(id===word)score+=14;if(label===word)score+=12;if(text.includes(word))score+=4;}
  if(text.includes('building')||text.includes('structure'))score+=1;
  return score;
}

export function resolveQuickBuildPieces({prefabs=[],overrides={}}={}){
  const result=[];
  for(const piece of PIECES){
    const forced=overrides?.[piece.type];
    if(forced){result.push({...piece,prefabId:String(forced),source:'override'});continue;}
    let best=null,bestScore=0;
    for(const prefab of prefabs||[]){const score=scorePrefab(prefab,piece);if(score>bestScore){best=prefab;bestScore=score;}}
    if(best)result.push({...piece,prefabId:String(best.id),source:'catalog'});
  }
  return result;
}

export function createQuickBuildTool(kernel,{placement=null,root=globalThis}={}){
  if(!kernel)throw new Error('STUDIO_QUICK_BUILD_KERNEL_REQUIRED');
  placement=placement||kernel.tools?.get?.('placement');
  if(!placement?.start||!placement?.move||!placement?.commit||!placement?.cancel)throw new Error('STUDIO_QUICK_BUILD_PLACEMENT_REQUIRED');
  const document=root?.document;
  let destroyed=false,active=null,busy=false,launcher=null,palette=null,style=null,observer=null,previewUnsub=null,seenShell=false;
  let snapState=Object.freeze({state:'none',candidateCount:0,checkedPairs:0,connection:null});
  const pieces=resolveQuickBuildPieces({prefabs:kernel.prefabs.list?.()||[],overrides:root?.KELO_QUICK_BUILD_CATALOG||{}});
  const snapResolver=createSnapResolver({spatial:kernel.spatial,radius:Math.max(32,Number(kernel.document?.settings?.tileSize)||32)*1.35});

  const pieceBounds=piece=>kernel.prefabs.resolve?.(piece.prefabId)?.bounds||kernel.prefabs.get?.(piece.prefabId)?.bounds||{w:32,h:32};
  const semanticComponents=piece=>({buildingPiece:{type:piece.type,system:'quick-build',version:2,snapPoints:defaultSnapPointsForPiece(piece.type,pieceBounds(piece))}});
  const activeOverrides=piece=>({components:semanticComponents(piece)});
  const gridSnap=()=>Math.max(1,Number(document?.getElementById?.('kelo-studio-live')?.querySelector?.('[data-ext="snap"]')?.value)||Number(kernel.document?.settings?.tileSize)||32);
  const snapRadius=()=>Math.max(gridSnap()*.85,24);

  function currentPosition(){const preview=placement.getPreview?.();return{x:Number(preview?.transform?.x)||0,y:Number(preview?.transform?.y)||0,rotation:Number(preview?.transform?.rotation)||0};}
  function setSnapState(next){snapState=Object.freeze(next||{state:'none',candidateCount:0,checkedPairs:0,connection:null});syncUi();return snapState;}
  function startPreview(piece,{x=0,y=0,rotation=0}={}){placement.cancel();placement.start(piece.prefabId,{rotation,overrides:activeOverrides(piece)});placement.move(x,y,{snap:1});setSnapState({state:'valid',candidateCount:0,checkedPairs:0,connection:null});return placement.getPreview?.();}
  function advancePosition(piece,preview){
    const grid=gridSnap();
    const prefab=kernel.prefabs.get?.(piece.prefabId)||{};
    const width=Math.max(grid,Number(prefab?.bounds?.w)||grid);
    const rotation=((Number(preview?.transform?.rotation)||0)%360+360)%360;
    const vertical=rotation===90||rotation===270;
    const distance=Math.max(grid,Math.round(width/grid)*grid);
    const direction=rotation===180||rotation===270?-1:1;
    return{x:(Number(preview?.transform?.x)||0)+(vertical?0:distance*direction),y:(Number(preview?.transform?.y)||0)+(vertical?distance*direction:0),rotation:Number(preview?.transform?.rotation)||0};
  }
  function resolveMove(x,y){
    if(!active)return null;
    placement.move(x,y,{snap:gridSnap()});
    const preview=placement.getPreview?.();
    if(!preview){setSnapState({state:'invalid',reason:'preview-missing',candidateCount:0,checkedPairs:0,connection:null});return null;}
    const result=snapResolver.resolve(preview,{radius:snapRadius()});
    if(result.state==='snapped')placement.move(result.x,result.y,{snap:1});
    setSnapState(result);return placement.getPreview?.();
  }
  function activate(type){
    const piece=pieces.find(row=>row.type===String(type));if(!piece)return false;
    const previous=currentPosition();active=piece;kernel.input.push(CONTEXT);startPreview(piece,previous);syncUi();return true;
  }
  function deactivate({cancel=true}={}){if(!active)return false;active=null;kernel.input.pop(CONTEXT);if(cancel)placement.cancel();setSnapState({state:'none',candidateCount:0,checkedPairs:0,connection:null});syncUi();return true;}
  function rotate(){if(!active)return false;placement.rotate?.(90);const preview=placement.getPreview?.();if(preview)resolveMove(preview.transform.x,preview.transform.y);return true;}

  async function commitAt(x,y){
    if(!active||busy)return null;busy=true;
    const piece=active;
    try{
      resolveMove(x,y);
      const before=placement.getPreview?.();
      if(!before){setSnapState({state:'invalid',reason:'preview-missing',candidateCount:0,checkedPairs:0,connection:null});return null;}
      const row=await placement.commit();
      if(active===piece&&!destroyed){const next=advancePosition(piece,before);startPreview(piece,next);resolveMove(next.x,next.y);}
      return row;
    }finally{busy=false;}
  }

  const handlers={
    pointerdown:event=>{if(!active)return false;resolveMove(event.worldX,event.worldY);return true;},
    pointermove:event=>{if(!active)return false;resolveMove(event.worldX,event.worldY);return true;},
    pointerup:event=>{if(!active)return false;void commitAt(event.worldX,event.worldY).catch(error=>console.warn('[Kelo Studio] Quick Build commit failed',error));return true;},
    pointercancel:()=>!!active
  };
  const unregisterInput=kernel.input.register(CONTEXT,handlers,2200);

  function ensureUi(){
    if(destroyed||!document)return null;
    const shell=document.getElementById?.('kelo-studio-live');if(!shell)return null;
    seenShell=true;
    if(!style){style=document.createElement('style');style.dataset.keloQuickBuild='1';style.textContent=`
      #kelo-studio-live .ks-qb-launch{min-height:36px;border:1px solid rgba(140,240,180,.34);border-radius:10px;background:#123026;color:#bff7d4;font-size:7px;font-weight:950;padding:0 10px;letter-spacing:.06em}
      #kelo-studio-live .ks-qb-launch.on{border-color:#8cf0b4;background:#1a4938;color:#fff}
      #kelo-studio-live .ks-qb-palette{position:absolute;left:50%;bottom:calc(max(8px,env(safe-area-inset-bottom)) + 72px);transform:translateX(-50%);z-index:14;display:flex;align-items:center;gap:5px;padding:6px;border:1px solid rgba(140,240,180,.42);border-radius:15px;background:rgba(5,14,16,.96);box-shadow:0 14px 38px rgba(0,0,0,.48);pointer-events:auto;backdrop-filter:blur(14px)}
      #kelo-studio-live .ks-qb-palette[hidden]{display:none}.ks-qb-palette .title{color:#8cf0b4;font-size:7px;font-weight:950;letter-spacing:.12em;padding:0 5px}
      #kelo-studio-live .ks-qb-piece,#kelo-studio-live .ks-qb-cancel{min-width:50px;min-height:44px;border:1px solid rgba(140,240,180,.24);border-radius:11px;background:#10231d;color:#e7fff0;font-size:8px;font-weight:900;touch-action:manipulation}
      #kelo-studio-live .ks-qb-piece strong{display:block;font-size:16px;color:#8cf0b4;line-height:15px;margin-bottom:3px}.ks-qb-piece.on{border-color:#8cf0b4;background:#1a4938}.ks-qb-cancel{min-width:44px;color:#ffd3cf;border-color:rgba(255,122,112,.42)}
      #kelo-studio-live .ks-qb-snap{min-width:58px;padding:0 6px;font-size:7px;font-weight:950;letter-spacing:.08em;text-align:center;color:#9cb0aa}.ks-qb-snap[data-state="snapped"]{color:#8cf0b4}.ks-qb-snap[data-state="invalid"]{color:#ff8d84}
      @media(max-width:760px){#kelo-studio-live .ks-qb-palette{left:8px;right:8px;bottom:calc(max(8px,env(safe-area-inset-bottom)) + 70px);transform:none;justify-content:center}.ks-qb-palette .title{display:none}}
    `;document.head?.appendChild(style);}
    if(!launcher?.isConnected){
      launcher=document.createElement('button');launcher.type='button';launcher.className='ks-qb-launch';launcher.dataset.quickBuildLaunch='1';launcher.textContent='⚒ BUILD';launcher.setAttribute('aria-label','Quick Build');
      launcher.addEventListener('click',()=>{if(active)deactivate();else{const first=pieces[0];if(first)activate(first.type);}syncUi();});
      (shell.querySelector?.('.ks-mode-actions')||shell.querySelector?.('.ks-edit-primary')||shell).appendChild(launcher);
    }
    if(!palette?.isConnected){
      palette=document.createElement('div');palette.className='ks-qb-palette';palette.dataset.keloStudioUi='1';palette.hidden=true;palette.innerHTML=`<span class="title">QUICK BUILD</span>${pieces.map(piece=>`<button type="button" class="ks-qb-piece" data-qb-piece="${piece.type}"><strong>${piece.glyph}</strong>${piece.label}</button>`).join('')}<span class="ks-qb-snap" data-qb-snap="1" data-state="valid">FREE</span><button type="button" class="ks-qb-cancel" data-qb-cancel="1" aria-label="Salir de Quick Build">×</button>`;
      palette.addEventListener('click',event=>{const button=event.target?.closest?.('[data-qb-piece]');if(button){activate(button.dataset.qbPiece);return;}if(event.target?.closest?.('[data-qb-cancel]'))deactivate();});shell.appendChild(palette);
    }
    syncUi();return palette;
  }
  function syncUi(){
    if(launcher){launcher.classList.toggle('on',!!active);launcher.textContent=active?`⚒ ${active.label}`:'⚒ BUILD';}
    if(palette){palette.hidden=!active;palette.querySelectorAll?.('[data-qb-piece]')?.forEach(button=>button.classList.toggle('on',button.dataset.qbPiece===active?.type));const status=palette.querySelector?.('[data-qb-snap]');if(status){const state=snapState?.state||'valid';status.dataset.state=state;status.textContent=state==='snapped'?'SNAPPED':state==='invalid'?'INVALID':'FREE';}}
  }

  function destroy(){if(destroyed)return;destroyed=true;active=null;kernel.input.pop(CONTEXT);unregisterInput?.();previewUnsub?.();observer?.disconnect?.();document?.removeEventListener?.('keydown',keydown,true);launcher?.remove();palette?.remove();style?.remove();launcher=palette=style=observer=null;}
  function keydown(event){if(!active||event.defaultPrevented||event.repeat||event.target?.closest?.(EDITABLE))return;const key=norm(event.key);if(key==='escape'){event.preventDefault?.();event.stopImmediatePropagation?.();deactivate();}else if(key==='r'){event.preventDefault?.();event.stopImmediatePropagation?.();rotate();}}
  document?.addEventListener?.('keydown',keydown,true);
  if(document?.documentElement&&root?.MutationObserver){observer=new root.MutationObserver(()=>{const shell=document.getElementById?.('kelo-studio-live');if(!shell&&seenShell){destroy();return;}ensureUi();});observer.observe(document.documentElement,{childList:true,subtree:true});}
  ensureUi();
  if(placement.onPreview){previewUnsub=placement.onPreview(next=>{if(!active||next)return;root.setTimeout?.(()=>{if(active&&!placement.getPreview?.()&&!busy)deactivate({cancel:false});},0);});}

  return Object.freeze({id:'quickBuild',version:'studio-quick-build-v1.2.0-phase2-snap',pieces:pieces.map(copy),activate,deactivate,rotate,commitAt,resolveMove,getSnapState:()=>copy(snapState),get active(){return active?{...active}:null;},destroy});
}
