/* KELO-INDEX
 * area: CREATORS / ASSET FORGE WORKSPACE
 * owner: Kelo Asset Forge workspace manifest only
 * owns: lazy route from Creator Hub into Asset Forge
 * does-not-own: drawing algorithms, persistence, marketplace settlement, moderation or runtime rendering
 */
export function createAssetForgeWorkspaceManifest({loader=()=>import('../ui/asset-forge-workspace.mjs')}={}){
  return Object.freeze({
    id:'asset-forge',label:'Asset Forge',category:'visual',projectTypes:[],capability:null,availability:'active',
    async open(context={}){
      const module=await loader();
      if(typeof module.openAssetForgeWorkspace!=='function')throw new Error('CREATOR_ASSET_FORGE_ENTRY_MISSING');
      return module.openAssetForgeWorkspace(context);
    },
    isSessionAlive(session){return !!session?.shell?.isConnected;}
  });
}
export function registerAssetForgeWorkspace(registry,options={}){return registry.register(createAssetForgeWorkspaceManifest(options));}
