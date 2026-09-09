/* KELO-INDEX
 * area: CREATORS / ASSET LIBRARY WORKSPACE
 * owner: Asset Library workspace manifest only
 * purpose: lazy-route authorized creators into the shared manual Asset Library UI
 * public-api: createAssetLibraryWorkspaceManifest(), registerAssetLibraryWorkspace()
 * consumes: Kelo Creators workspace registry + injected assetLibrary service
 * state-owned: none
 * does-not-own: assets, permissions, runtime catalog, reviews or publication
 * online: service/repository authority is injected by Kelo Creators composition root
 */
export function createAssetLibraryWorkspaceManifest({loader=()=>import('../ui/asset-library-workspace.mjs')}={}){
  return Object.freeze({
    id:'asset-library',label:'Asset Library',category:'content',projectTypes:['WORLD'],capability:'creators.access',availability:'active',
    async open({root=globalThis,assetLibrary=null,permission=null}={}){
      if(!assetLibrary)throw new Error('CREATOR_ASSET_LIBRARY_NOT_READY');
      const mod=await loader();
      if(typeof mod.openAssetLibraryWorkspace!=='function')throw new Error('CREATOR_ASSET_LIBRARY_ENTRY_MISSING');
      return mod.openAssetLibraryWorkspace({root,assetLibrary,permission});
    }
  });
}
export function registerAssetLibraryWorkspace(registry,options={}){return registry.register(createAssetLibraryWorkspaceManifest(options));}
