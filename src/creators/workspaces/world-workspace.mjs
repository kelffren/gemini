/* KELO-INDEX
 * area: CREATORS / WORLD WORKSPACE
 * owner: World workspace manifest only
 * owns: descriptor and lazy routing into existing live Studio controller
 * does-not-own: World editor, commands, drafts, authority, terrain, collisions, PropertySystem or camera
 * reuse: existing openKeloStudioLive() remains implementation; Map Forge handoff imports through Studio adapter + KELO_WORLD_EDIT and focuses through KeloCamera
 */
import { waitForWorldEditAuthority } from '../adapters/world-creator-adapter.mjs';

const actor=root=>String(root.KELO_ADMIN_KEYS?.playerId?.()||root.keloNet?.playerKey||root.localPlayer?.id||'local_pioneer');
const finite=v=>Number.isFinite(Number(v));
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const studioShellMounted=root=>{
  const doc=root?.document;
  if(!doc?.getElementById)return true;
  const shell=doc.getElementById('kelo-studio-live');
  return !!(shell&&shell.isConnected!==false);
};
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
      const mod=await loader();
      if(typeof mod.openKeloStudioLive!=='function')throw new Error('CREATOR_WORLD_STUDIO_ENTRY_MISSING');
      const session=await openMountedStudio(mod,root);
      if(prepared?.documentMetadata&&session?.studio?.kernel?.setDocument){
        const current=session.studio.kernel.document;
        session.studio.kernel.setDocument({...current,metadata:prepared.documentMetadata});
      }
      return session;
    }
  });
}
export function registerWorldWorkspace(registry,options={}){return registry.register(createWorldWorkspaceManifest(options));}