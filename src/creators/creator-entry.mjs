/* KELO-INDEX
 * area: CREATORS / ENTRY
 * owner: Kelo Creators composition root
 * owns: lazy composition of generic Creator infrastructure and workspace registration
 * does-not-own: Studio core, workspace implementations, gameplay or network transport
 * reuse: every Creator workspace registers one manifest; Hub never owns editor logic
 */
import { createCreatorWorkspaceRegistry } from './core/workspace-registry.mjs';
import { createCreatorDependencyGraph } from './core/dependency-graph.mjs';
import { createCreatorPermissionAdapter } from './adapters/creator-permission-adapter.mjs';
import { createWorldCreatorAdapter } from './adapters/world-creator-adapter.mjs';
import { createLocalCreatorProjectRepository } from './repository/local-creator-project-repository.mjs';
import { createIndexedDbCreatorStateAdapter } from './repository/indexeddb-creator-state-adapter.mjs';
import { createIndexedDbCreatorAssetRepository } from './assets/indexeddb-creator-asset-repository.mjs';
import { createCreatorAssetLibrary } from './assets/creator-asset-library.mjs';
import { registerWorldWorkspace } from './workspaces/world-workspace.mjs';
import { registerMapForgeWorkspace } from './workspaces/map-forge-workspace.mjs';
import { registerAssetLibraryWorkspace } from './workspaces/asset-library-workspace.mjs';
import { registerMountWorkspace } from './workspaces/mount-workspace.mjs';
import { registerAppearanceWorkspace } from './workspaces/appearance-workspace.mjs';
import { registerAnimationWorkspace } from './workspaces/animation-workspace.mjs';
import { registerVfxWorkspace } from './workspaces/vfx-workspace.mjs';
import { registerAbilityWorkspace } from './workspaces/ability-workspace.mjs';
let platform=null;
export async function bootKeloCreators({root=globalThis,stateAdapter=null,assetRepository=null}={}){
  if(platform)return platform;
  const permission=createCreatorPermissionAdapter(root),world=createWorldCreatorAdapter({root,permission}),localState=stateAdapter||createIndexedDbCreatorStateAdapter({indexedDBFactory:root.indexedDB}),projects=createLocalCreatorProjectRepository({domainAdapters:[world],stateAdapter:localState}),workspaces=createCreatorWorkspaceRegistry(),dependencies=createCreatorDependencyGraph();
  const assetsRepo=assetRepository||createIndexedDbCreatorAssetRepository({indexedDBFactory:root.indexedDB}),assetLibrary=createCreatorAssetLibrary({root,repository:assetsRepo,permission});
  registerWorldWorkspace(workspaces);registerMapForgeWorkspace(workspaces);registerAssetLibraryWorkspace(workspaces);registerMountWorkspace(workspaces);registerAppearanceWorkspace(workspaces);registerAnimationWorkspace(workspaces);registerVfxWorkspace(workspaces);registerAbilityWorkspace(workspaces);
  try{await assetLibrary.hydrateRuntimeCatalog();}catch(error){console.warn('[Kelo Creators] asset catalog hydration deferred',error?.message||error);}
  async function openWorkspace(id,context={}){
    const manifest=workspaces.resolve(id);if(!manifest)throw new Error(`CREATOR_WORKSPACE_NOT_FOUND:${id}`);
    if(manifest.capability)permission.require(manifest.capability,permission.actorId(),context.projectId||null);
    return workspaces.open(id,{root,projects,permission,dependencies,assetLibrary,openWorkspace,...context});
  }
  platform=Object.freeze({version:'kelo-creators-core-v1.5.0',permission,projects,assetLibrary,workspaces,dependencies,openWorkspace,async close(){try{await assetLibrary.close?.();}catch{}try{await localState.close?.();}catch{}platform=null;}});
  return platform;
}
export function getKeloCreatorsPlatform(){return platform;}
