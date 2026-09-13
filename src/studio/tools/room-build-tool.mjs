/* KELO-INDEX
 * area: STUDIO / QUICK BUILD ROOM
 * owns: rectangular room planning, semantic room identity, intentional drag gating, live quantized measurement, desktop square lock and batch commit through placement
 * does-not-own: document mutation, CommandBus, authority, asset rendering
 * public-api: createRoomBuildTool(), resolveRoomDragThreshold()
 * online: persistent mutation delegates to placement.commitBatch() -> CommandBus -> authority
 */

const CONTEXT='studio-quick-build-room';
const MOUSE_DRAG_PX=6;
const TOUCH_DRAG_PX=16;
const MIN_EFFECTIVE_ZOOM=.25;
const copy=v=>v==null?v:(typeof structuredClone==='function'?structuredClone(v):JSON.parse(JSON.stringify(v)));
const snap=(v,g)=>Math.round((Number(v)||0)/g)*g;
const newRoomId=()=>`room:${globalThis.crypto?.randomUUID?.()||`${Date.now().toString(36)}:${Math.random().toString(36).slice(2,9)}`}`;

export function resolveRoomDragThreshold(pointerType='mouse',{root=globalThis}={}){
  const type=String(pointerType||'mouse').toLowerCase();
  const coarse=type==='touch'||type==='pen'||(type!=='mouse'&&!!root?.matchMedia?.('(pointer: coarse)')?.matches);
  const px=coarse?TOUCH_DRAG_PX:MOUSE_DRAG_PX;
  const zoom=Math.max(MIN_EFFECTIVE_ZOOM,Number(root?.KeloCamera?.snapshot?.()?.effectiveZoom)||1);
  return px/zoom;
}

export function createRoomBuildTool(kernel,{placement=null,quickBuild=null,root=globalThis}={}){
  if(!kernel)throw new Error('STUDIO_ROOM_BUILD_KERNEL_REQUIRED');
  placement=placement||kernel.tools?.get?.('placement');
  quickBuild=quickBuild||kernel.tools?.get?.('quickBuild');
  if(!placement?.commitBatch||!quickBuild)throw new Error('STUDIO_ROOM_BUILD_DEPENDENCIES_REQUIRED');
  let active=false,drag=null,previews=[],destroyed=false,button=null,observer=null,busy=false,plannedRoomId=null,measurement=null,planSignature=null;
  const plannerStats={requests:0,rebuilds:0,reuses:0};
  const document=root?.document;
  const wallPiece=()=>quickBuild.pieces?.find?.(row=>row.type==='wall')||null;
  const grid=()=>Math.max(1,Number(document?.getElementById?.('kelo-studio-live')?.querySelector?.('[data-ext="snap"]')?.value)||Number(kernel.document?.settings?.tileSize)||32);
  const wallPrefab=()=>{const piece=wallPiece();return piece?kernel.prefabs.resolve?.(piece.prefabId)||kernel.prefabs.get?.(piece.prefabId):null;};
  const wallBounds=()=>{const g=grid(),b=wallPrefab()?.bounds||{w:g,h:g};return{w:Math.max(1,Number(b.w)||g),h:Math.max(1,Number(b.h)||g)};};
  const semantic=(roomId,edge,index)=>{const piece=wallPiece(),bounds=wallBounds();return{buildingPiece:{type:'wall',system:'quick-build',version:3,snapPoints:[{id:'start',type:'wall',x:0,y:bounds.h/2,direction:'start'},{id:'end',type:'wall',x:bounds.w,y:bounds.h/2,direction:'end'}],roomGenerated:true,roomId,roomEdge:edge,roomIndex:index,prefabId:piece?.prefabId||null}};};
  const wallLength=()=>{const g=grid(),w=wallBounds().w;return Math.max(g,Math.round(w/g)*g);};
  function clearTransient({keepDrag=false}={}){previews=[];plannedRoomId=null;measurement=null;planSignature=null;if(!keepDrag)drag=null;syncButton();}
  function wallRowFromSegmentStart(x,y,rotation,roomId,edge,index){const piece=wallPiece(),bounds=wallBounds();let tx=x,ty=y-bounds.h/2;if(rotation===90){tx=x-bounds.w/2;ty=y-bounds.h/2+bounds.w/2;}return{prefabId:piece.prefabId,transform:{x:tx,y:ty,rotation},bounds:{...bounds},components:semantic(roomId,edge,index)};}
  function planRect(ax,ay,bx,by,{square=false}={}){
    plannerStats.requests++;
    const g=grid(),length=wallLength(),roomId=plannedRoomId||(plannedRoomId=newRoomId());
    const startX=snap(ax,g),startY=snap(ay,g),pointerX=snap(bx,g),pointerY=snap(by,g);
    const requestedWidth=Math.abs(pointerX-startX),requestedHeight=Math.abs(pointerY-startY);
    let countX,countY,endX,endY;
    if(square){
      const requestedSpan=Math.max(requestedWidth,requestedHeight),count=Math.max(1,Math.round(Math.max(length,requestedSpan)/length));
      countX=countY=count;
      endX=startX+(pointerX<startX?-1:1)*count*length;
      endY=startY+(pointerY<startY?-1:1)*count*length;
    }else{
      countX=Math.max(1,Math.round(Math.max(length,requestedWidth)/length));
      countY=Math.max(1,Math.round(Math.max(length,requestedHeight)/length));
      endX=startX+(pointerX<startX?-1:1)*countX*length;
      endY=startY+(pointerY<startY?-1:1)*countY*length;
    }
    const x0=Math.min(startX,endX),x1=Math.max(startX,endX),y0=Math.min(startY,endY),y1=Math.max(startY,endY);
    const signature=`${roomId}|${x0}|${y0}|${x1}|${y1}|${countX}|${countY}|${square?1:0}|${length}`;
    const nextMeasurement={x:x0,y:y0,width:x1-x0,height:y1-y0,requestedWidth,requestedHeight,deltaWidth:(x1-x0)-requestedWidth,deltaHeight:(y1-y0)-requestedHeight,modulesX:countX,modulesY:countY,wallLength:length,totalWalls:2*(countX+countY),squareLocked:!!square};
    if(signature===planSignature&&previews.length){plannerStats.reuses++;measurement=nextMeasurement;syncButton();return copy(previews);}
    plannerStats.rebuilds++;
    const rows=[];
    for(let i=0;i<countX;i++){const x=x0+i*length;rows.push(wallRowFromSegmentStart(x,y0,0,roomId,'top',i),wallRowFromSegmentStart(x,y1,0,roomId,'bottom',i));}
    for(let i=0;i<countY;i++){const y=y0+i*length;rows.push(wallRowFromSegmentStart(x0,y,90,roomId,'left',i),wallRowFromSegmentStart(x1,y,90,roomId,'right',i));}
    previews=rows;planSignature=signature;measurement={...nextMeasurement,totalWalls:rows.length};
    syncButton();return copy(previews);
  }
  function activate(){if(active)return true;if(!wallPiece())return false;quickBuild.activate?.('wall');active=true;clearTransient();kernel.input.push(CONTEXT);syncButton();return true;}
  function deactivate(){if(!active)return false;active=false;clearTransient();kernel.input.pop(CONTEXT);syncButton();return true;}
  async function commitRoom(){if(!active||busy||previews.length<4)return null;busy=true;try{const rows=previews.map(copy),roomId=plannedRoomId;const committed=await placement.commitBatch(rows,{label:`Build room (${rows.length} walls)`});clearTransient();return Object.assign(committed,{roomId});}finally{busy=false;}}
  function dragDistance(e){return drag?Math.hypot((Number(e.worldX)||0)-drag.rawX,(Number(e.worldY)||0)-drag.rawY):0;}
  function maybePlanDrag(e){if(!drag)return false;if(!drag.started){if(dragDistance(e)<drag.threshold)return false;drag.started=true;plannedRoomId=newRoomId();}planRect(drag.x,drag.y,e.worldX,e.worldY,{square:!!e.shiftKey});return true;}
  const handlers={
    pointerdown:e=>{if(!active)return false;const g=grid(),pointerType=e.pointerType||'mouse';clearTransient();drag={x:snap(e.worldX,g),y:snap(e.worldY,g),rawX:Number(e.worldX)||0,rawY:Number(e.worldY)||0,pointerType,threshold:resolveRoomDragThreshold(pointerType,{root}),started:false};return true;},
    pointermove:e=>{if(!active||!drag)return!!active;maybePlanDrag(e);return true;},
    pointerup:e=>{if(!active||!drag)return!!active;const started=maybePlanDrag(e);if(!started){clearTransient();return true;}const enough=previews.length>=4;drag=null;if(enough)void commitRoom().catch(err=>console.warn('[Kelo Studio] Room Build commit failed',err));else clearTransient();return true;},
    pointercancel:()=>{clearTransient();return!!active;}
  };
  const unregister=kernel.input.register(CONTEXT,handlers,2300);
  function ensureButton(){if(destroyed||!document)return;const palette=document.querySelector?.('.ks-qb-palette');if(!palette)return;if(button?.isConnected)return;button=document.createElement('button');button.type='button';button.className='ks-qb-piece';button.dataset.qbRoom='1';button.setAttribute('aria-pressed','false');button.addEventListener('click',event=>{event.preventDefault?.();event.stopPropagation?.();active?deactivate():activate();});const cancel=palette.querySelector?.('[data-qb-cancel]');palette.insertBefore(button,cancel||null);syncButton();}
  function syncButton(){if(!button)return;button.classList.toggle('on',active);button.setAttribute('aria-pressed',active?'true':'false');button.textContent=active?(measurement?`▣ ${measurement.squareLocked?'□ ':''}${Math.round(measurement.width)}×${Math.round(measurement.height)}`:'▣ ROOM ON'):'▣ ROOM';}
  function destroy(){if(destroyed)return;destroyed=true;active=false;clearTransient();kernel.input.pop(CONTEXT);unregister?.();observer?.disconnect?.();button?.remove();button=null;}
  if(document?.documentElement&&root?.MutationObserver){observer=new root.MutationObserver(()=>{ensureButton();syncButton();});observer.observe(document.documentElement,{childList:true,subtree:true});}
  ensureButton();
  return Object.freeze({id:'roomBuild',version:'studio-room-build-v1.5.0-plan-cache',activate,deactivate,planRect,commitRoom,getPreviews:()=>copy(previews),getMeasurement:()=>copy(measurement),getPlannerStats:()=>({...plannerStats}),get active(){return active;},destroy});
}
