/* KELO-INDEX
 * area: STUDIO / QUICK BUILD ROOM
 * owns: rectangular room planning and batch commit through placement
 * does-not-own: document mutation, CommandBus, authority, asset rendering
 * public-api: createRoomBuildTool()
 * online: persistent mutation delegates to placement.commitBatch() -> CommandBus -> authority
 */

const CONTEXT='studio-quick-build-room';
const copy=v=>v==null?v:(typeof structuredClone==='function'?structuredClone(v):JSON.parse(JSON.stringify(v)));
const snap=(v,g)=>Math.round((Number(v)||0)/g)*g;

export function createRoomBuildTool(kernel,{placement=null,quickBuild=null,root=globalThis}={}){
  if(!kernel)throw new Error('STUDIO_ROOM_BUILD_KERNEL_REQUIRED');
  placement=placement||kernel.tools?.get?.('placement');
  quickBuild=quickBuild||kernel.tools?.get?.('quickBuild');
  if(!placement?.commitBatch||!quickBuild)throw new Error('STUDIO_ROOM_BUILD_DEPENDENCIES_REQUIRED');
  let active=false,drag=null,previews=[],destroyed=false,button=null,observer=null,busy=false;
  const document=root?.document;
  const wallPiece=()=>quickBuild.pieces?.find?.(row=>row.type==='wall')||null;
  const grid=()=>Math.max(1,Number(document?.getElementById?.('kelo-studio-live')?.querySelector?.('[data-ext="snap"]')?.value)||Number(kernel.document?.settings?.tileSize)||32);
  const wallPrefab=()=>{const piece=wallPiece();return piece?kernel.prefabs.resolve?.(piece.prefabId)||kernel.prefabs.get?.(piece.prefabId):null;};
  const semantic=()=>{const piece=wallPiece(),prefab=wallPrefab(),bounds=prefab?.bounds||{w:grid(),h:grid()};return{buildingPiece:{type:'wall',system:'quick-build',version:2,snapPoints:[{id:'start',type:'wall',x:0,y:bounds.h/2,direction:'start'},{id:'end',type:'wall',x:bounds.w,y:bounds.h/2,direction:'end'}],roomGenerated:true,roomEdge:true,prefabId:piece?.prefabId||null}};};
  function wallStep(rotation){const g=grid(),b=wallPrefab()?.bounds||{w:g,h:g},raw=(rotation===90||rotation===270)?Number(b.h)||g:Number(b.w)||g;return Math.max(g,Math.round(raw/g)*g);}
  function wallRow(x,y,rotation){const piece=wallPiece(),prefab=wallPrefab(),bounds=prefab?.bounds||{w:grid(),h:grid()};return{prefabId:piece.prefabId,transform:{x,y,rotation},bounds:{...bounds},components:semantic()};}
  function planRect(ax,ay,bx,by){
    const g=grid(),x0=snap(Math.min(ax,bx),g),x1=snap(Math.max(ax,bx),g),y0=snap(Math.min(ay,by),g),y1=snap(Math.max(ay,by),g);
    const hStep=wallStep(0),vStep=wallStep(90),rows=[];
    const seen=new Set(),pushUnique=row=>{const key=`${row.transform.x}:${row.transform.y}:${row.transform.rotation}`;if(seen.has(key))return;seen.add(key);rows.push(row);};
    for(let x=x0;x<=x1;x+=hStep){pushUnique(wallRow(x,y0,0));if(y1!==y0)pushUnique(wallRow(x,y1,0));}
    for(let y=y0+vStep;y<y1;y+=vStep){pushUnique(wallRow(x0,y,90));if(x1!==x0)pushUnique(wallRow(x1,y,90));}
    previews=rows;syncButton();return copy(previews);
  }
  function activate(){if(active)return true;if(!wallPiece())return false;quickBuild.activate?.('wall');active=true;drag=null;previews=[];kernel.input.push(CONTEXT);syncButton();return true;}
  function deactivate(){if(!active)return false;active=false;drag=null;previews=[];kernel.input.pop(CONTEXT);syncButton();return true;}
  async function commitRoom(){if(!active||busy||previews.length<4)return null;busy=true;try{const rows=previews.map(copy);const committed=await placement.commitBatch(rows,{label:`Build room (${rows.length} walls)`});drag=null;previews=[];syncButton();return committed;}finally{busy=false;}}
  const handlers={
    pointerdown:e=>{if(!active)return false;const g=grid();drag={x:snap(e.worldX,g),y:snap(e.worldY,g),pointerType:e.pointerType||'mouse'};planRect(drag.x,drag.y,drag.x,drag.y);return true;},
    pointermove:e=>{if(!active||!drag)return !!active;planRect(drag.x,drag.y,e.worldX,e.worldY);return true;},
    pointerup:e=>{if(!active||!drag)return !!active;planRect(drag.x,drag.y,e.worldX,e.worldY);const enough=previews.length>=4;drag=null;if(enough)void commitRoom().catch(err=>console.warn('[Kelo Studio] Room Build commit failed',err));else{previews=[];syncButton();}return true;},
    pointercancel:()=>{drag=null;previews=[];syncButton();return!!active;}
  };
  const unregister=kernel.input.register(CONTEXT,handlers,2300);
  function ensureButton(){if(destroyed||!document)return;const palette=document.querySelector?.('.ks-qb-palette');if(!palette)return;if(button?.isConnected)return;button=document.createElement('button');button.type='button';button.className='ks-qb-piece';button.dataset.qbRoom='1';button.setAttribute('aria-pressed','false');button.addEventListener('click',event=>{event.preventDefault?.();event.stopPropagation?.();active?deactivate():activate();});const cancel=palette.querySelector?.('[data-qb-cancel]');palette.insertBefore(button,cancel||null);syncButton();}
  function syncButton(){if(!button)return;button.classList.toggle('on',active);button.setAttribute('aria-pressed',active?'true':'false');button.textContent=active?(previews.length?`▣ ROOM ×${previews.length}`:'▣ ROOM ON'):'▣ ROOM';}
  function destroy(){if(destroyed)return;destroyed=true;active=false;drag=null;previews=[];kernel.input.pop(CONTEXT);unregister?.();observer?.disconnect?.();button?.remove();button=null;}
  if(document?.documentElement&&root?.MutationObserver){observer=new root.MutationObserver(()=>{ensureButton();syncButton();});observer.observe(document.documentElement,{childList:true,subtree:true});}
  ensureButton();
  return Object.freeze({id:'roomBuild',version:'studio-room-build-v1.0.0',activate,deactivate,planRect,commitRoom,getPreviews:()=>copy(previews),get active(){return active;},destroy});
}
