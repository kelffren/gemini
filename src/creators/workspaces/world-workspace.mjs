/* KELO-INDEX
 * area: CREATORS / WORLD WORKSPACE
 * owner: World workspace manifest only
 * owns: descriptor and lazy routing into existing live Studio controller
 * does-not-own: World editor, commands, drafts, authority, terrain, collisions or PropertySystem
 * reuse: existing openKeloStudioLive() remains implementation; Map Forge handoff imports through Studio adapter + KELO_WORLD_EDIT
 */
import { waitForWorldEditAuthority } from '../adapters/world-creator-adapter.mjs';

export function createWorldWorkspaceManifest({loader=()=>import('../../studio/integration/live-studio-controller.mjs'),mapForgeImporter=()=>import('../../studio/adapters/map-forge-draft-importer.mjs')}={}){
  return Object.freeze({
    id:'world',
    label:'World',
    category:'build',
    projectTypes:['WORLD'],
    capability:'world.edit',
    availability:'active',
    async open({root=globalThis,mapDefinition=null}={}){
      await waitForWorldEditAuthority(root);
      let prepared=null;
      if(mapDefinition){
        const bridge=await mapForgeImporter();
        if(typeof bridge.importMapForgeIntoWorldDraft!=='function')throw new Error('MAP_FORGE_STUDIO_IMPORTER_MISSING');
        prepared=await bridge.importMapForgeIntoWorldDraft({root,mapDefinition});
      }
      const mod=await loader();
      if(typeof mod.openKeloStudioLive!=='function')throw new Error('CREATOR_WORLD_STUDIO_ENTRY_MISSING');
      const session=await mod.openKeloStudioLive({root});
      if(prepared?.documentMetadata&&session?.studio?.kernel?.setDocument){
        const current=session.studio.kernel.document;
        session.studio.kernel.setDocument({...current,metadata:prepared.documentMetadata});
      }
      return session;
    }
  });
}
export function registerWorldWorkspace(registry,options={}){return registry.register(createWorldWorkspaceManifest(options));}
