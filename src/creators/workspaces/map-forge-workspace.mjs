/* KELO-INDEX
 * area: CREATORS / MAP FORGE WORKSPACE
 * owner: Map Forge workspace manifest only
 * owns: descriptor + lazy routing to Map Forge UI + World workspace handoff callback
 * does-not-own: generator core, draft import, World Studio, renderer, collision or gameplay
 * public-api: createMapForgeWorkspaceManifest(), registerMapForgeWorkspace()
 * reuse: handoff returns through registered World workspace via openWorkspace()
 */
const MAP_FORGE_UI_BUILD='safari-touch-recovery-20260913-2';

function freshMapForgeUiLoader(){
  // Keep one module identity for the lifetime of the page so Map Forge's module-level `active`
  // remains the single workspace owner. Cache bust between deployments by bumping BUILD, not on
  // every tap: a per-tap nonce creates a fresh ES-module instance with its own `active` singleton
  // and can mount duplicate #kelo-map-forge dialogs on iOS Safari.
  return import(`../ui/map-forge-workspace.mjs?v=${MAP_FORGE_UI_BUILD}`);
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
