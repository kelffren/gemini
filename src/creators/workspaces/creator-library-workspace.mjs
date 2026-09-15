/* KELO-INDEX
 * area: CREATORS / LIBRARY WORKSPACE
 * owner: Kelo Creators workspace registry adapter
 * keys: CREATOR LIBRARY UNIVERSAL CONTENT ROUTING LAZY
 * purpose: route into the universal Creator Library shell that reuses existing specialized Creator workspaces
 * public-api: createCreatorLibraryWorkspaceManifest, registerCreatorLibraryWorkspace
 * consumes: creator workspace registry + src/creators/ui/creator-library-workspace.mjs
 * state-owned: none
 * extension-points: content types live in creator-content-types.mjs; specialized editors remain their own owners
 * reuse: direct Luxe entry and Kelo Creator Hub
 * online: authoring router only; valuable publish/economy operations remain behind authority layers
 * do-not: no second asset catalog, no duplicated editor logic, no eager normal-game boot
 */
export function createCreatorLibraryWorkspaceManifest({loader=()=>import('../ui/creator-library-workspace.mjs')}={}){
  return Object.freeze({
    id:'creator-library',label:'Creator Library',category:'content',projectTypes:[],capability:null,availability:'active',
    async open(context={}){
      const mod=await loader();
      if(typeof mod.openCreatorLibraryWorkspace!=='function')throw new Error('CREATOR_LIBRARY_ENTRY_MISSING');
      return mod.openCreatorLibraryWorkspace(context);
    }
  });
}
export function registerCreatorLibraryWorkspace(registry,options={}){return registry.register(createCreatorLibraryWorkspaceManifest(options));}
