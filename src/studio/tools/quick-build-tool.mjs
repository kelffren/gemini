/* KELO-INDEX
 * area: STUDIO / QUICK BUILD
 * owns: semantic piece selection, fast build slots, continuous/drag placement input, snap/orientation orchestration and compact chrome
 * does-not-own: document mutation, CommandBus, authority, world rendering or camera transforms
 * public-api: createQuickBuildTool(), resolveQuickBuildPieces(), resolveQuickBuildDragThreshold()
 * online: commits delegate to placement -> Kernel CommandBus -> authority mirror
 * mobile: one bounded body observer; no permanent document subtree observer or extra render loop
 */
import { createSnapResolver, defaultSnapPointsForPiece } from './snap-resolver.mjs';

const CONTEXT='studio-quick-build',EDITABLE='input,textarea,select,[contenteditable="true"],[contenteditable=""]';
const MOUSE_DRAG_PX=6,TOUCH_DRAG_PX=16,MIN_EFFECTIVE_ZOOM=.25;
const PIECES=Object.freeze([
  Object.freeze({slot:1,type:'wall',label:'WALL',glyph:'▥',keywords:['wall','muro','pared','fence','barrier']}),
  Object.freeze({slot:2,type:'floor',label:'FLOOR',glyph:'▦',keywords:['floor','tile','ground','piso','suelo']}),
  Object.freeze({slot:3,type:'ramp',label:'RAMP',glyph:'╱',keywords:['ramp','stairs','stair','staircase','rampa','escalera']}),
  Object.freeze({slot:4,type:'roof',label:'ROOF',glyph:'⌂',keywords:['roof','cone','pyramid','techo','tejado']})
]);
const norm=v=>String(v||'').trim().toLowerCase(),copy=v=>v==null?v:(typeof structuredClone==='function'?structuredClone(v):JSON.parse(JSON.stringify(v)));
const clampRotation=value=>((Number(value)||0)%360+360)%360;
const rotationDelta=(a,b)=>clampRotation(b)-clampRotation(a);

function scorePrefab(prefab,piece){
  const id=norm(prefab?.id),label=norm(prefab?.label),category=norm(prefab?.category),text=`${id} ${label} ${category}`;
  let score=0;
  for(const word of piece.keywords){if(id===word)score+=14;if(label===word)score+=12;if(text.includes(word))score+=4;}
  if(score>0&&(text.includes('building')||text.includes('structure')))score++;
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

export function resolveQuickBuildDragThreshold(pointerType='mouse',{root=globalThis}={}){
  const type=String(pointerType||'mouse').toLowerCase();
  const coarse=type==='touch'||type==='pen'||(type!=='mouse'&&!!root?.matchMedia?.('(pointer: coarse)')?.matches);
  const px=coarse?TOUCH_DRAG_PX:MOUSE_DRAG_PX;
  const zoom=Math.max(MIN_EFFECTIVE_ZOOM,Number(root?.KeloCamera?.snapshot?.()?.effectiveZoom)||1);
  return px/zoom;
}

export function createQuickBuildTool(kernel,{placement=null,root=globalThis}={}){
  if(!kernel)throw new Error('STUDIO_QUICK_BUILD_KERNEL_REQUIRED');
  placement=placement||kernel.tools?.get?.('placement');
  if(!placement?.start||!placement?.move||!placement?.commit||!placement?.commitBatch||!placement?.cancel)throw new Error('STUDIO_QUICK_BUILD_PLACEMENT_REQUIRED');

  const document=root?.document;
  let destroyed=false,active=null,busy=false,manualRotationOverride=false,launcher=null,palette=null,style=null,observer=null,previewUnsub=null,seenShell=false,drag=null,dragPreviews=[];
  let snapState=Object.freeze({state:'none',candidateCount:0,checkedPairs:0,connection:null});
  const pieces=resolveQuickBuildPieces({prefabs:kernel.prefabs.list?.()||[],overrides:root?.KELO_QUICK_BUILD_CATALOG||{}});
  const snapResolver=createSnapResolver({spatial:kernel.spatial,radius:Math.max(32,Number(kernel.document?.settings?.tileSize)||32)*1.35});

  const pieceBounds=piece=>kernel.prefabs.resolve?.(piece.prefabId)?.bounds||kernel.prefabs.get?.(piece.prefabId)?.bounds||{w:32,h:32};
  const semanticComponents=piece=>({buildingPiece:{type:piece.type,system:'quick-build',version:3,slot:piece.slot,snapPoints:defaultSnapPointsForPiece(piece.type,pieceBounds(piece))}});
  const activeOverrides=piece=>({components:semanticComponents(piece)});
  const gridSnap=()=>Math.max(1,Number(document?.getElementById?.('kelo-studio-live')?.querySelector?.('[data-ext="snap"]')?.value)||Number(kernel.document?.settings?.tileSize)||32);
  const snapRadius=()=>Math.max(gridSnap()*.85,24);

  function currentPosition(){const p=placement.getPreview?.();return{x:Number(p?.transform?.x)||0,y:Number(p?.transform?.y)||0,rotation:Number(p?.transform?.rotation)||0};}
  function setSnapState(next){snapState=Object.freeze(next||{state:'none',candidateCount:0,checkedPairs:0,connection:null});syncUi();return snapState;}
  function startPreview(piece,{x=0,y=0,rotation=0}={}){placement.cancel();placement.start(piece.prefabId,{rotation,overrides:activeOverrides(piece)});placement.move(x,y,{snap:1});setSnapState({state:'valid',candidateCount:0,checkedPairs:0,connection:null});return placement.getPreview?.();}

  // Walls and ramps are longitudinal modules: their local width remains the chain length after 90/270° rotation.
  function moduleSize(piece,rotation=0){
    const b=pieceBounds(piece),type=norm(piece?.type);
    if(type==='wall'||type==='ramp'||type==='fence')return Math.max(1,Number(b.w)||1);
    const r=clampRotation(rotation);
    return(r===90||r===270)?Math.max(1,Number(b.h)||1):Math.max(1,Number(b.w)||1);
  }
  function advancePosition(piece,preview){
    const grid=gridSnap(),rotation=clampRotation(preview?.transform?.rotation),vertical=rotation===90||rotation===270;
    const distance=Math.max(grid,Math.round(moduleSize(piece,rotation)/grid)*grid),direction=rotation===180||rotation===270?-1:1;
    return{x:(Number(preview?.transform?.x)||0)+(vertical?0:distance*direction),y:(Number(preview?.transform?.y)||0)+(vertical?distance*direction:0),rotation};
  }
  function resolveMove(x,y){
    if(!active)return null;
    placement.move(x,y,{snap:gridSnap()});
    let preview=placement.getPreview?.();
    if(!preview){setSnapState({state:'invalid',reason:'preview-missing',candidateCount:0,checkedPairs:0,connection:null});return null;}
    const result=snapResolver.resolve(preview,{radius:snapRadius(),rotations:manualRotationOverride?[preview.transform.rotation]:null});
    if(result.state==='snapped'){
      const delta=rotationDelta(preview.transform.rotation,result.rotation);
      if(delta)placement.rotate?.(delta);
      placement.move(result.x,result.y,{snap:1});
      preview=placement.getPreview?.();
    }
    setSnapState({...result,manualRotationOverride});
    return preview;
  }

  function activate(type){
    const piece=pieces.find(row=>row.type===String(type));if(!piece)return false;
    const previous=currentPosition(),wasActive=!!active;
    active=piece;manualRotationOverride=false;drag=null;dragPreviews=[];
    if(!wasActive)kernel.input.push(CONTEXT);
    startPreview(piece,previous);syncUi();return true;
  }
  function selectSlot(slot){const piece=pieces.find(row=>Number(row.slot)===Number(slot));return piece?activate(piece.type):false;}
  function cycle(direction=1){
    if(!pieces.length)return false;
    const step=Number(direction)<0?-1:1,current=active?pieces.findIndex(row=>row.type===active.type):-1;
    const index=current<0?(step>0?0:pieces.length-1):(current+step+pieces.length)%pieces.length;
    return activate(pieces[index].type);
  }
  function deactivate({cancel=true}={}){if(!active)return false;active=null;drag=null;dragPreviews=[];manualRotationOverride=false;kernel.input.pop(CONTEXT);if(cancel)placement.cancel();setSnapState({state:'none',candidateCount:0,checkedPairs:0,connection:null});syncUi();return true;}
  function rotate(){if(!active)return false;manualRotationOverride=true;drag=null;dragPreviews=[];placement.rotate?.(90);const p=placement.getPreview?.();if(p)resolveMove(p.transform.x,p.transform.y);return true;}

  function planDrag(x,y){
    if(!active||!drag)return[];
    const base=drag.start,dx=Number(x)-base.x,dy=Number(y)-base.y,axis=Math.abs(dx)>=Math.abs(dy)?'x':'y',sign=(axis==='x'?dx:dy)>=0?1:-1;
    const rotation=axis==='x'?(sign>0?0:180):(sign>0?90:270),length=Math.abs(axis==='x'?dx:dy);
    const step=Math.max(gridSnap(),Math.round(moduleSize(active,rotation)/gridSnap())*gridSnap()),count=Math.max(1,Math.floor(length/step)+1),bounds=pieceBounds(active),components=semanticComponents(active);
    dragPreviews=Array.from({length:count},(_,i)=>({id:`drag-preview:${i}`,prefabId:active.prefabId,transform:{x:base.x+(axis==='x'?i*step*sign:0),y:base.y+(axis==='y'?i*step*sign:0),rotation},bounds:{...bounds},components:copy(components)}));
    if(dragPreviews.length>1)placement.cancel();syncUi();return dragPreviews;
  }
  async function commitDrag(){
    if(!active||busy||dragPreviews.length<2)return null;
    busy=true;const piece=active,rows=dragPreviews.map(({id,...row})=>row),last=rows.at(-1);
    try{const committed=await placement.commitBatch(rows,{label:`Build ${rows.length} ${piece.type}s`});drag=null;dragPreviews=[];if(active===piece&&!destroyed){manualRotationOverride=false;const next=advancePosition(piece,last);startPreview(piece,next);resolveMove(next.x,next.y);}return committed;}finally{busy=false;syncUi();}
  }
  async function commitAt(x,y){
    if(!active||busy)return null;
    busy=true;const piece=active;
    try{resolveMove(x,y);const before=placement.getPreview?.();if(!before)return null;const row=await placement.commit();if(active===piece&&!destroyed){const next=advancePosition(piece,before);manualRotationOverride=false;startPreview(piece,next);resolveMove(next.x,next.y);}return row;}finally{busy=false;}
  }

  const handlers={
    pointerdown:e=>{if(!active)return false;const p=resolveMove(e.worldX,e.worldY);drag={start:{x:Number(p?.transform?.x)||0,y:Number(p?.transform?.y)||0},pointerType:e.pointerType||'mouse'};dragPreviews=[];return true;},
    pointermove:e=>{if(!active)return false;if(drag){const d=Math.hypot(Number(e.worldX)-drag.start.x,Number(e.worldY)-drag.start.y);if(d>=resolveQuickBuildDragThreshold(drag.pointerType,{root})){planDrag(e.worldX,e.worldY);return true;}}resolveMove(e.worldX,e.worldY);return true;},
    pointerup:e=>{if(!active)return false;const multi=dragPreviews.length>1;void (multi?commitDrag():commitAt(e.worldX,e.worldY)).catch(error=>console.warn('[Kelo Studio] Quick Build commit failed',error));drag=null;if(!multi)dragPreviews=[];return true;},
    pointercancel:()=>{drag=null;dragPreviews=[];syncUi();return!!active;}
  };
  const unregisterInput=kernel.input.register(CONTEXT,handlers,2200);

  function ensureUi(){
    if(destroyed||!document)return null;
    const shell=document.getElementById?.('kelo-studio-live');if(!shell)return null;seenShell=true;
    if(!style){style=document.createElement('style');style.dataset.keloQuickBuild='1';style.textContent=`
      #kelo-studio-live .ks-qb-launch{min-height:38px;border:1px solid #568a70;border-radius:10px;background:#123026;color:#bff7d4;font-size:8px;font-weight:950;padding:0 11px;letter-spacing:.04em;touch-action:manipulation}.ks-qb-launch.on{background:#1a4938}
      #kelo-studio-live .ks-qb-palette{position:absolute;left:50%;bottom:80px;transform:translateX(-50%);z-index:14;display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:5px;max-width:calc(100vw - 16px);padding:6px;border:1px solid #568a70;border-radius:15px;background:#050e10f5;box-shadow:0 12px 34px rgba(0,0,0,.36)}.ks-qb-palette[hidden]{display:none}
      #kelo-studio-live .ks-qb-piece,#kelo-studio-live .ks-qb-cancel{position:relative;min-width:58px;min-height:48px;border:1px solid #406757;border-radius:11px;background:#10231d;color:#e7fff0;font-size:8px;font-weight:900;touch-action:manipulation}.ks-qb-piece.on{background:#1a4938;border-color:#8cf0b4;box-shadow:0 0 0 1px rgba(140,240,180,.2) inset}.ks-qb-piece .slot{position:absolute;top:3px;left:5px;font-size:7px;color:#8cf0b4;opacity:.8}.ks-qb-piece .glyph{display:block;font-size:16px;line-height:16px;color:#dfffea;margin:3px 0 2px}.ks-qb-cancel{min-width:44px;color:#ffd3cf;border-color:rgba(255,122,112,.42)}
      #kelo-studio-live .ks-qb-snap{min-width:64px;font-size:7px;font-weight:950;text-align:center;color:#9cb0aa}.ks-qb-snap[data-state="snapped"]{color:#8cf0b4}
      @media(max-width:760px){#kelo-studio-live .ks-qb-palette{left:8px;right:8px;bottom:calc(72px + env(safe-area-inset-bottom));transform:none}.ks-qb-piece{flex:1 1 56px;max-width:78px}.ks-qb-snap{flex-basis:100%;order:10}.ks-qb-cancel{order:11}}
    `;document.head?.appendChild(style);}
    if(!launcher?.isConnected){launcher=document.createElement('button');launcher.type='button';launcher.className='ks-qb-launch';launcher.textContent='⚒ BUILD';launcher.title='Quick Build · B · slots 1–4';launcher.addEventListener('click',()=>active?deactivate():pieces[0]&&activate(pieces[0].type));(shell.querySelector?.('.ks-mode-actions')||shell).appendChild(launcher);}
    if(!palette?.isConnected){
      palette=document.createElement('div');palette.className='ks-qb-palette';palette.dataset.keloStudioUi='1';palette.hidden=true;
      palette.innerHTML=`${pieces.map(p=>`<button type="button" class="ks-qb-piece" data-qb-piece="${p.type}" data-qb-slot="${p.slot}" aria-label="${p.label} slot ${p.slot}"><span class="slot">${p.slot}</span><span class="glyph">${p.glyph}</span>${p.label}</button>`).join('')}<span class="ks-qb-snap" data-qb-snap="1">FREE</span><button type="button" class="ks-qb-cancel" data-qb-cancel="1" aria-label="Exit Quick Build">×</button>`;
      palette.addEventListener('click',e=>{const b=e.target?.closest?.('[data-qb-piece]');if(b)activate(b.dataset.qbPiece);else if(e.target?.closest?.('[data-qb-cancel]'))deactivate();});shell.appendChild(palette);
    }
    syncUi();return palette;
  }
  function syncUi(){
    if(launcher){launcher.classList.toggle('on',!!active);launcher.textContent=active?`⚒ ${active.slot} · ${active.label}`:'⚒ BUILD';}
    if(palette){palette.hidden=!active;palette.querySelectorAll?.('[data-qb-piece]')?.forEach(b=>b.classList.toggle('on',b.dataset.qbPiece===active?.type));const s=palette.querySelector?.('[data-qb-snap]');if(s){s.dataset.state=snapState.state||'none';s.textContent=busy?'BUILDING…':dragPreviews.length>1?`TURBO ×${dragPreviews.length}`:snapState.state==='snapped'?(snapState.autoRotated?`SNAP ${Math.round(Number(snapState.rotation)||0)}°`:'SNAPPED'):'FREE · Q/E CYCLE';}}
  }
  function destroy(){if(destroyed)return;destroyed=true;active=null;drag=null;dragPreviews=[];kernel.input.pop(CONTEXT);unregisterInput?.();previewUnsub?.();observer?.disconnect?.();document?.removeEventListener?.('keydown',keydown,true);launcher?.remove();palette?.remove();style?.remove();}
  function keydown(e){
    if(e.defaultPrevented||e.repeat||e.target?.closest?.(EDITABLE))return;
    const key=norm(e.key);
    if(/^[1-4]$/.test(key)){if(selectSlot(Number(key))){e.preventDefault?.();return;}}
    if(key==='b'){e.preventDefault?.();if(active)deactivate();else if(pieces[0])activate(pieces[0].type);return;}
    if(!active)return;
    if(key==='escape'){e.preventDefault?.();deactivate();}
    else if(key==='r'){e.preventDefault?.();rotate();}
    else if(key==='q'){e.preventDefault?.();cycle(-1);}
    else if(key==='e'){e.preventDefault?.();cycle(1);}
  }

  document?.addEventListener?.('keydown',keydown,true);
  if(document?.body&&root?.MutationObserver){observer=new root.MutationObserver(()=>{const shell=document.getElementById?.('kelo-studio-live');if(!shell&&seenShell){destroy();return;}ensureUi();});observer.observe(document.body,{childList:true});}
  ensureUi();
  if(placement.onPreview)previewUnsub=placement.onPreview(next=>{if(!active||next||busy)return;root.setTimeout?.(()=>{if(active&&!placement.getPreview?.()&&!busy&&!dragPreviews.length)deactivate({cancel:false});},0);});

  return Object.freeze({id:'quickBuild',version:'studio-quick-build-v2.0.0-four-piece-turbo',pieces:pieces.map(copy),activate,selectSlot,cycle,deactivate,rotate,commitAt,commitDrag,resolveMove,planDrag,getDragPreviews:()=>copy(dragPreviews),getSnapState:()=>copy(snapState),get active(){return active?{...active}:null;},destroy});
}
