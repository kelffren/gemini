/* KELO-INDEX
 * area: CREATORS / ASSET FORGE WORKSPACE
 * owner: Kelo Asset Forge workspace manifest only
 * owns: lazy route from Creator Hub into Asset Forge
 * does-not-own: drawing algorithms, persistence, marketplace settlement, moderation or runtime rendering
 */
export function createAssetForgeWorkspaceManifest({loader=()=>import('../ui/asset-forge-workspace.mjs'),templateLoader=()=>import('../ui/asset-forge-template-controls.mjs')}={}){
  return Object.freeze({
    id:'asset-forge',label:'Asset Forge',category:'visual',projectTypes:[],capability:null,availability:'active',
    async open(context={}){
      const module=await loader();
      if(typeof module.openAssetForgeWorkspace!=='function')throw new Error('CREATOR_ASSET_FORGE_ENTRY_MISSING');
      const session=await module.openAssetForgeWorkspace(context);
      try{
        const templates=await templateLoader();
        if(typeof templates.installAssetForgeTemplateControls==='function')templates.installAssetForgeTemplateControls({...context,session});
      }catch(error){console.warn('[Creators] Asset Forge template controls unavailable',error);}
      return session;
    },
    isSessionAlive(session){return !!session?.shell?.isConnected;}
  });
}
export function registerAssetForgeWorkspace(registry,options={}){return registry.register(createAssetForgeWorkspaceManifest(options));}
