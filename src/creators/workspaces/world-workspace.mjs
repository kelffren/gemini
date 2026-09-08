/* KELO-INDEX
 * area: CREATORS / WORLD WORKSPACE
 * owner: World workspace manifest only
 * owns: descriptor and lazy routing into existing live Studio controller
 * does-not-own: World editor, commands, drafts, authority, terrain, collisions or PropertySystem
 * reuse: existing openKeloStudioLive() is the implementation
 */
export function createWorldWorkspaceManifest({loader=()=>import('../../studio/integration/live-studio-controller.mjs')}={}){
  return Object.freeze({id:'world',label:'World',category:'build',projectTypes:['WORLD'],capability:'world.edit',availability:'active',async open({root=globalThis}={}){const mod=await loader();if(typeof mod.openKeloStudioLive!=='function')throw new Error('CREATOR_WORLD_STUDIO_ENTRY_MISSING');return mod.openKeloStudioLive({root});}});
}
export function registerWorldWorkspace(registry,options={}){return registry.register(createWorldWorkspaceManifest(options));}
