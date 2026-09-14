/* KELO-INDEX
 * area: CREATORS / WORLD WORKSPACE
 * owner: World workspace manifest only
 * owns: descriptor and lazy routing into existing live Studio controller
 * does-not-own: World editor, commands, drafts, authority, terrain, collisions, PropertySystem or camera
 * reuse: existing openKeloStudioLive() remains implementation; Map Forge handoff imports through Studio adapter + KELO_WORLD_EDIT and focuses through KeloCamera
 * mobile: paint a launch curtain and yield a real frame before importing Studio so the World card cannot freeze the Hub on iPhone
 */
import { waitForWorldEditAuthority } from '../adapters/world-creator-adapter.mjs';

const actor=root=>String(root.KELO_ADMIN_KEYS?.playerId?.()||root.keloNet?.playerKey||root.localPlayer?.id||'local_pioneer');
const finite=v=>Number.isFinite(Number(v));
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const LAUNCH_CURTAIN_ID='kelo-world-launch-curtain';
const STUDIO_OPEN_MS=12000;
const studioOpenBudget=root=>Math.max(250,Number(root?.KELO_WORLD_OPEN_TIMEOUT_MS)||STUDIO_OPEN_MS);
const studioShellMounted=root=>{
  const doc=root?.document;
  if(!doc?.getElementById)return true;
  const shell=doc.getElementById('kelo-studio-live');
  return !!(shell&&shell.isConnected!==false);
};
function paintLaunchCurtain(root,message='Abriendo World Editor…'){
  const doc=root?.document;
  if(!doc?.body||typeof doc.createElement!=='function')return null;
  let el=typeof doc.getElementById==='function'?doc.getElementById(LAUNCH_CURTAIN_ID):null;
  if(!el){
    el=doc.createElement('div');
    el.id=LAUNCH_CURTAIN_ID;
    if(typeof el.setAttribute==='function'){
      el.setAttribute('data-kelo-world-launch','1');
      el.setAttribute('role','status');
      el.setAttribute('aria-live','polite');
    }
    if(el.style)el.style.cssText='position:fixed;inset:0;z-index:2147482200;display:grid;place-items:center;padding:24px;background:rgba(7,8,10,.94);color:#f7e7b4;font:800 15px/1.45 Inter,system-ui,-apple-system,sans-serif;letter-spacing:.12em;text-align:center;pointer-events:auto';
    doc.body.append?.(el);
  }
  el.textContent=message;
  return el;
}
function clearLaunchCurtain(root){
  try{root?.document?.getElementById?.(LAUNCH_CURTAIN_ID)?.remove?.();}catch{}
}
async function yieldFrames(root,count=2){
  const wait=typeof root.setTimeout==='function'?root.setTimeout.bind(root):setTimeout;
  for(let i=0;i<Math.max(1,count);i++){
    await new Promise(resolve=>wait(()=>resolve(),0));
  }
}
async function withTimeout(root,promise,ms,code){
  let timer=null;
  const wait=typeof root.setTimeout==='function'?root.setTimeout.bind(root):setTimeout;
  const cancel=typeof root.clearTimeout==='function'?root.clearTimeout.bind(root):clearTimeout;
  const timeout=new Promise((_,reject)=>{timer=wait(()=>reject(new Error(code)),ms);});
  try{return await Promise.race([promise,timeout]);}
  finally{if(timer!=null)cancel(timer);}
}
async function openMountedStudio(mod,root){
  let session=await mod.openKeloStudioLive({root});
  if(studioShellMounted(root))return session;
  try{await mod.closeKeloStudioLive?.({root});}catch{}
  session=await mod.openKeloStudioLive({root});
  if(!studioShellMounted(root)){
    try{await mod.closeKeloStudioLive?.({root});}catch{}
    throw new Error('CREATOR_WORLD_STUDIO_MOUNT_FAILED');
  }
  return session;
}
async function loadStudioModule(loader,root,{fresh=false}={}){
  if(fresh){
    const src=Function.prototype.toString.call(loader);
    if(src.includes('live-studio-controller.mjs')){
      const nonce=`${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
      return import(`../../studio/integration/live-studio-controller.mjs?v=world-ios-${nonce}`);
    }
  }
  return loader(root);
}
function mapFocusPoint(map){
  const b=map?.worldBounds||{},bx=finite(b.x)?Number(b.x):0,by=finite(b.y)?Number(b.y):0,bw=Math.max(1,finite(b.w)?Number(b.w):1),bh=Math.max(1,finite(b.h)?Number(b.h):1),spawn=(map?.spawnPoints||[]).find(p=>finite(p?.x)&&finite(p?.y));
  const x=spawn?Number(spawn.x):bx+bw/2,y=spawn?Number(spawn.y):by+bh/2;
  return Object.freeze({x:clamp(x,bx,bx+bw),y:clamp(y,by,by+bh)});
}

export function createWorldWorkspaceManifest({loader=()=>import('../../studio/integration/live-studio-controller.mjs'),mapForgeImporter=()=>import('../../studio/adapters/map-forge-draft-importer.mjs')}={}){
  return Object.freeze({
    id:'world',
    label:'World',
    category:'build',
    projectTypes:['WORLD'],
    capability:'world.edit',
    availability:'active',
    async open({root=globalThis,mapDefinition=null,previewOnly=false}={}){
      paintLaunchCurtain(root,previewOnly?'Cargando vista previa…':'Abriendo World Editor…');
      await yieldFrames(root,2);
      try{
        const boot=async()=>{
          const edit=await waitForWorldEditAuthority(root);
          let prepared=null;
          if(mapDefinition){
            const bridge=await mapForgeImporter();
            if(typeof bridge.importMapForgeIntoWorldDraft!=='function')throw new Error('MAP_FORGE_STUDIO_IMPORTER_MISSING');
            prepared=await bridge.importMapForgeIntoWorldDraft({root,mapDefinition});
          }
          if(previewOnly){
            if(!prepared?.draftId)throw new Error('MAP_FORGE_PREVIEW_DRAFT_MISSING');
            const entered=await edit.request('world:preview:enter',{actorId:actor(root),draftId:prepared.draftId});
            if(!entered?.viewSnapshot)throw new Error('MAP_FORGE_PREVIEW_SNAPSHOT_MISSING');
            const runtime=root.KELO_WORLD_BUILDER?.snapshot?.();
            if(!runtime||Object.keys(runtime.cells||{}).length===0)throw new Error('MAP_FORGE_PREVIEW_RUNTIME_PROJECTION_MISSING');
            if(typeof root.KeloCamera?.focus!=='function')throw new Error('MAP_FORGE_CAMERA_OWNER_NOT_READY');
            const focus=mapFocusPoint(mapDefinition);root.KeloCamera.focus(focus,{snap:true,source:'map-forge-exterior-preview'});
            root.showToast?.('Mapa generado cargado en el exterior como vista previa del borrador');
            return Object.freeze({mode:'map-forge-exterior-preview',draftId:prepared.draftId,prepared,focus,viewSnapshot:entered.viewSnapshot});
          }
          let mod=await loadStudioModule(loader,root);
          if(typeof mod.openKeloStudioLive!=='function')throw new Error('CREATOR_WORLD_STUDIO_ENTRY_MISSING');
          let session;
          try{
            session=await openMountedStudio(mod,root);
          }catch(first){
            const code=String(first?.message||first||'');
            if(code==='WORLD_EDITOR_OPEN_TIMEOUT')throw first;
            try{await mod.closeKeloStudioLive?.({root});}catch{}
            paintLaunchCurtain(root,'Reintentando World Editor…');
            await yieldFrames(root,1);
            mod=await loadStudioModule(loader,root,{fresh:true});
            if(typeof mod.openKeloStudioLive!=='function')throw first;
            session=await openMountedStudio(mod,root);
          }
          if(prepared?.documentMetadata&&session?.studio?.kernel?.setDocument){
            const current=session.studio.kernel.document;
            session.studio.kernel.setDocument({...current,metadata:prepared.documentMetadata});
          }
          return session;
        };
        return await withTimeout(root,boot(),studioOpenBudget(root),'WORLD_EDITOR_OPEN_TIMEOUT');
      }finally{
        clearLaunchCurtain(root);
      }
    }
  });
}
export function registerWorldWorkspace(registry,options={}){return registry.register(createWorldWorkspaceManifest(options));}
