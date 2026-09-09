/* KELO-INDEX
 * area: CREATORS / MAP FORGE WORKSPACE
 * owner: Map Forge workspace manifest only
 * owns: descriptor + lazy routing to Map Forge UI + World workspace handoff callback
 * does-not-own: generator core, draft import, World Studio, renderer, collision or gameplay
 * public-api: createMapForgeWorkspaceManifest(), registerMapForgeWorkspace()
 * reuse: handoff returns through registered World workspace via openWorkspace(); asset IDs come from injected shared Asset Library
 */
export function createMapForgeWorkspaceManifest({loader=()=>import('../ui/map-forge-workspace.mjs')}={}){return Object.freeze({id:'map-forge',label:'Map Forge',category:'build',projectTypes:['WORLD'],capability:'world.edit',availability:'active',async open({root=globalThis,openWorkspace=null,assetLibrary=null}={}){await assetLibrary?.hydrateRuntimeCatalog?.();const mod=await loader();if(typeof mod.openMapForgeWorkspace!=='function')throw new Error('CREATOR_MAP_FORGE_ENTRY_MISSING');return mod.openMapForgeWorkspace({root,assetLibrary,onOpenWorld:typeof openWorkspace==='function'?(map,options={})=>openWorkspace('world',{...options,mapDefinition:map,source:'map-forge'}):null});}});}
export function registerMapForgeWorkspace(registry,options={}){return registry.register(createMapForgeWorkspaceManifest(options));}
