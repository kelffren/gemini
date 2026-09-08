/* KELO-INDEX
 * area: STUDIO / LIVE CONTROLLER
 * owner: Kelo Studio Live Controller
 * owns: explicit creator session lifecycle, draft import, Studio pointer context and overlay composition
 * does-not-own: gameplay input locks, authority, gameplay systems, legacy Builder internals
 * public-api: openKeloStudioLive(), closeKeloStudioLive()
 * consumes: KeloInputLocks, KELO_WORLD_EDIT, Studio Kernel/Tools
 * online: confirmed Commands mirror through KELO_WORLD_EDIT; previews stay local
 */

import { bootKeloStudio } from '../studio-entry.mjs';
import { createStudioOverlayCanvas } from '../render/studio-overlay-canvas.mjs';
import { attachStudioPointerInput } from '../input/pointer-input-adapter.mjs';
import { installStudioAuthorityMirror } from './authority-command-mirror.mjs';
import { createStudioLiveShell } from '../ui/studio-live-shell.mjs';

let active = null;
const mutable = status => ['DRAFT','REJECTED'].includes(String(status||''));
function actor(root){return String(root.KELO_ADMIN_KEYS?.playerId?.()||root.keloNet?.playerKey||root.localPlayer?.id||'local_pioneer');}
function toast(root,msg){if(typeof root.showToast==='function')root.showToast(msg);else console.info('[Kelo Studio]',msg);}
async function ensureDraft(root, actorId){const E=root.KELO_WORLD_EDIT;if(!E?.ready)throw new Error('WORLD_EDIT_NOT_READY');let res=await E.getCurrentDraft();let d=res?.draft;if(!d||!mutable(d.status)){res=await E.request('world:draft:create',{actorId,forceNew:true});d=res.draft;}else{res=await E.request('world:draft:get',{actorId,draftId:d.draftId});d=res.draft;}return d;}

export async function openKeloStudioLive({ root = globalThis } = {}) {
  if (active) return active;
  if (!root.document) throw new Error('STUDIO_DOM_REQUIRED');
  const actorId=actor(root);
  if(!root.KELO_ADMIN_KEYS?.can?.('world.edit',actorId))throw new Error('ADMIN_KEY_PERMISSION_DENIED');
  if(root.KELO_WORLD_BUILDER?.isMainWorld&&!root.KELO_WORLD_BUILDER.isMainWorld())throw new Error('STUDIO_MAIN_WORLD_ONLY');
  if(!root.KeloInputLocks?.acquire||!root.KeloInputLocks?.release)throw new Error('STUDIO_INPUT_LOCKS_NOT_READY');
  try{await root.KELO_WORLD_BUILDER_UI?.close?.(false);}catch{}

  const draft=await ensureDraft(root,actorId), studio=await bootKeloStudio({mode:'world',actorId,root});
  await studio.importCurrent({view:'draft',draftId:draft.draftId});
  let draftId=draft.draftId;
  const mirror=installStudioAuthorityMirror({adapter:studio.adapter,actorId,getDraftId:()=>draftId});
  for(const e of studio.kernel.document.entities)mirror.seed(e.id,e.source?.authorityPlacementId||e.id);
  for(const c of Object.values(studio.kernel.document.navigation?.collisions||{}))mirror.seedCollision(c.collisionId,c.collisionId);

  let inputLockToken=null,overlay=null,shell=null,unregisterInput=null,detachPointer=null,frame=0,running=true,mode='select',dragEntity=null,onKey=null;
  try {
    inputLockToken=root.KeloInputLocks.acquire('kelo-studio',{kind:'creator-session',draftId});
    overlay=createStudioOverlayCanvas({host:root.document.body});
    const assets=studio.adapter.assetCatalog.list()||[];
    const materials=Array.from(new Set([...(root.KELO_WORLD_BUILDER?.materials||[]),...Object.keys(root.KELO_TERRAIN_CONTRACT?.materials||{})]));
    const groundMaterial=materials.includes('grass')?'grass':materials[0]||'grass';
    const pathMaterial=materials.includes('marble')?'marble':materials[1]||materials[0]||'grass';
    const surfaceCount=()=>Object.keys(studio.kernel.document.terrain||{}).length;
    const collisionCount=()=>Object.keys(studio.kernel.document.navigation?.collisions||{}).length;
    const updateShell=()=>{shell?.setHistory({canUndo:studio.kernel.history.canUndo,canRedo:studio.kernel.history.canRedo});shell?.setStatus(`${mode.toUpperCase()} · ${studio.kernel.document.entities.length} objects · ${surfaceCount()} surface · ${collisionCount()} collision · ${studio.kernel.history.undoDepth} undo`);};
    async function guarded(fn){try{await fn();updateShell();}catch(e){toast(root,e.message||String(e));}}
    function setMode(next){
      mode=['select','move','placement','terrain','path','collision'].includes(next)?next:'select';dragEntity=null;
      if(mode!=='placement')studio.tools.placement.cancel();
      if(mode!=='terrain'&&mode!=='path')studio.tools.terrain.cancel();
      studio.tools.collision.setVisible(mode==='collision');
      if(mode==='terrain')studio.tools.terrain.configure({role:'terrain',material:groundMaterial,erase:false});
      if(mode==='path')studio.tools.terrain.configure({role:'path',material:pathMaterial,erase:false});
      updateShell();
    }
    function beginPlacement(assetId){try{studio.tools.terrain.cancel();studio.tools.collision.setVisible(false);studio.tools.placement.start(assetId);mode='placement';updateShell();}catch(e){toast(root,e.message);}}

    const handlers={
      pointerdown:e=>{
        if(mode==='placement'){studio.tools.placement.move(e.worldX,e.worldY,{snap:studio.kernel.document.settings.tileSize});return true;}
        if(mode==='terrain'||mode==='path'){studio.tools.terrain.move(e.worldX,e.worldY);return true;}
        if(mode==='collision'){studio.tools.collision.beginAt(e.worldX,e.worldY);return true;}
        const hit=studio.tools.select.selectPoint(e.worldX,e.worldY);if(mode==='move'&&hit){dragEntity=hit.id;studio.tools.transform.begin(hit.id);}updateShell();return true;
      },
      pointermove:e=>{
        if(mode==='placement')studio.tools.placement.move(e.worldX,e.worldY,{snap:studio.kernel.document.settings.tileSize});
        else if(mode==='terrain'||mode==='path')studio.tools.terrain.move(e.worldX,e.worldY);
        else if(mode==='collision'&&studio.tools.collision.getPreview())studio.tools.collision.move(e.worldX,e.worldY);
        else if(mode==='move'&&dragEntity)studio.tools.transform.previewMove(e.worldX,e.worldY,{snap:studio.kernel.document.settings.tileSize});
        return true;
      },
      pointerup:e=>{
        if(mode==='placement'&&studio.tools.placement.getPreview()){const prefab=studio.tools.placement.getPreview().prefabId;void guarded(async()=>{await studio.tools.placement.commit();studio.tools.placement.start(prefab);studio.tools.placement.move(e.worldX,e.worldY,{snap:studio.kernel.document.settings.tileSize});});}
        else if((mode==='terrain'||mode==='path')&&studio.tools.terrain.getPreview()){void guarded(async()=>{await studio.tools.terrain.commit();studio.tools.terrain.move(e.worldX,e.worldY);});}
        else if(mode==='collision'&&studio.tools.collision.getPreview())void guarded(()=>studio.tools.collision.commit());
        else if(mode==='move'&&dragEntity){dragEntity=null;void guarded(()=>studio.tools.transform.commit());}
        return true;
      },
      pointercancel:()=>{if(mode==='move'){dragEntity=null;studio.tools.transform.cancel();}if(mode==='terrain'||mode==='path')studio.tools.terrain.cancel();if(mode==='collision')studio.tools.collision.cancel();return true;}
    };
    unregisterInput=studio.kernel.input.register('studio-live',handlers,1000);studio.kernel.input.push('studio-live');
    const isStudioUi=e=>!!e.target?.closest?.('[data-kelo-studio-ui]');
    detachPointer=attachStudioPointerInput({element:root.document,router:studio.kernel.input,toWorld:(x,y)=>studio.adapter.screenToWorld(x,y),capture:true,stopPropagation:true,shouldHandle:e=>running&&!isStudioUi(e)});
    shell=createStudioLiveShell({
      host:root.document.body,assets,onMode:setMode,onAsset:beginPlacement,
      onUndo:()=>guarded(()=>studio.kernel.undo()),onRedo:()=>guarded(()=>studio.kernel.redo()),
      onRotate:()=>{if(mode==='placement')studio.tools.placement.rotate(90);},
      onErase:erase=>{if(mode==='terrain'||mode==='path'){studio.tools.terrain.configure({erase});updateShell();}},
      onSave:()=>guarded(async()=>{await studio.adapter.worldEditRequest('world:draft:save',{actorId,draftId});await studio.checkpoint();toast(root,'Studio guardado');}),
      onClose:()=>{void closeKeloStudioLive({root});}
    });updateShell();

    function draw(){if(!running)return;overlay.resize();overlay.clear();const ctx=overlay.ctx,w=overlay.canvas.clientWidth||root.innerWidth||1,h=overlay.canvas.clientHeight||root.innerHeight||1,z=Number(root.CONFIG?.zoom)||1,c=root.camera||{x:0,y:0};ctx.save();ctx.translate(w/2,h/2);ctx.scale(z,z);ctx.translate(-c.x,-c.y);studio.overlayRenderer.draw(ctx);ctx.restore();frame=root.requestAnimationFrame?.(draw)||setTimeout(draw,16);}draw();
    onKey=e=>{if(isStudioUi(e))return;const key=e.key.toLowerCase();if((e.metaKey||e.ctrlKey)&&key==='z'){e.preventDefault();void guarded(()=>e.shiftKey?studio.kernel.redo():studio.kernel.undo());}else if(key==='escape'){e.preventDefault();if(mode==='placement'){studio.tools.placement.cancel();setMode('select');}else if(mode==='terrain'||mode==='path'){studio.tools.terrain.cancel();setMode('select');}else if(mode==='collision'){studio.tools.collision.cancel();setMode('select');}else void closeKeloStudioLive({root});}else if(key==='r'&&mode==='placement'){e.preventDefault();studio.tools.placement.rotate(90);}else if(key==='e'&&(mode==='terrain'||mode==='path')){e.preventDefault();const next=!studio.tools.terrain.state().erase;studio.tools.terrain.configure({erase:next});shell?.setErase(next);updateShell();}else if((key==='delete'||key==='backspace')&&mode==='collision'&&studio.tools.collision.selectedId){e.preventDefault();void guarded(()=>studio.tools.collision.removeSelected());}};
    root.document.addEventListener('keydown',onKey,true);

    const liveSession={version:'kelo-studio-live-v1.2.0',studio,get draftId(){return draftId;},get mode(){return mode;},setMode,beginPlacement,close:()=>closeKeloStudioLive({root})};
    Object.defineProperty(liveSession,'__cleanup',{value:async()=>{
      running=false;
      if(typeof root.cancelAnimationFrame==='function')root.cancelAnimationFrame(frame);else clearTimeout(frame);
      if(onKey)root.document.removeEventListener('keydown',onKey,true);
      detachPointer?.();studio.kernel.input.pop('studio-live');unregisterInput?.();mirror.uninstall();shell?.destroy();overlay?.destroy();studio.tools.collision.setVisible(false);
      if(inputLockToken){root.KeloInputLocks.release(inputLockToken);inputLockToken=null;}
      try{await studio.checkpoint();}catch{}
      try{studio.close();}catch{}
      try{await root.KELO_WORLD_EDIT?.request?.('world:view:published',{actorId});}catch{}
    },enumerable:false});
    active=Object.freeze(liveSession);
    root.document.body.classList.add('kelo-studio-active');toast(root,'Kelo Studio activo');return active;
  } catch (error) {
    running=false;
    try{detachPointer?.();}catch{}
    try{studio.kernel.input.pop('studio-live');unregisterInput?.();}catch{}
    try{mirror.uninstall();}catch{}
    try{shell?.destroy();overlay?.destroy();studio.tools.collision.setVisible(false);}catch{}
    if(inputLockToken){try{root.KeloInputLocks.release(inputLockToken);}catch{}inputLockToken=null;}
    try{studio.close();}catch{}
    throw error;
  }
}

export async function closeKeloStudioLive({root=globalThis}={}){if(!active)return;const session=active;active=null;root.document?.body?.classList.remove('kelo-studio-active');await session.__cleanup?.();}
export function getKeloStudioLive(){return active;}
