/* KELO-INDEX
 * area: CREATORS / MAP FORGE WORKSPACE
 * owner: Map Forge workspace manifest only
 * owns: descriptor + lazy routing to Map Forge UI + World workspace handoff callback
 * does-not-own: generator core, draft import, World Studio, renderer, collision or gameplay
 * public-api: createMapForgeWorkspaceManifest(), registerMapForgeWorkspace()
 * reuse: handoff returns through registered World workspace via openWorkspace()
 */
const MAP_FORGE_UI_BUILD='safari-touch-recovery-20260912-1';

function freshMapForgeUiLoader(){
  // iOS Safari can keep a successfully-loaded ES module alive even after the file behind the
  // same URL changed. A stale module is especially bad here because the card still receives the
  // tap but routes through old launch code. Give every explicit Map Forge launch a fresh module
  // URL so the editor entrypoint cannot be trapped behind Safari's module cache.
  const nonce=`${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
  return import(`../ui/map-forge-workspace.mjs?v=${MAP_FORGE_UI_BUILD}-${nonce}`);
}

export function createMapForgeWorkspaceManifest({loader=freshMapForgeUiLoader}={}){
  return Object.freeze({
    id:'map-forge',
    label:'Map Forge',
    category:'build',
    projectTypes:['WORLD'],
    capability:'world.edit',
    availability:'active',
    async open({root=globalThis,openWorkspace=null}={}){
      const mod=await loader();
      if(typeof mod.openMapForgeWorkspace!=='function')throw new Error('CREATOR_MAP_FORGE_ENTRY_MISSING');
      const pending=Promise.resolve(mod.openMapForgeWorkspace({
        root,
        onOpenWorld:typeof openWorkspace==='function'
          ?(map,options={})=>openWorkspace('world',{...options,mapDefinition:map,source:'map-forge'})
          :null
      }));

      // openMapForgeWorkspace mounts its shell before awaiting the first best-of generation.
      // The Creator Hub must hand control to that mounted editor immediately instead of
      // waiting up to the worker timeout; generation readiness is editor state, not routing state.
      const mounted=typeof mod.getMapForgeWorkspace==='function'?mod.getMapForgeWorkspace():null;
      if(mounted?.shell?.isConnected){
        pending.catch(error=>{
          console.error('[Kelo Creators → Map Forge background bootstrap]',error);
          root.showToast?.(error?.message||'Map Forge generation bootstrap failed');
        });
        return mounted;
      }

      return pending;
    }
  });
}
export function registerMapForgeWorkspace(registry,options={}){return registry.register(createMapForgeWorkspaceManifest(options));}
