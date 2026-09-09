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
import { registerWorldWorkspace } from './workspaces/world-workspace.mjs';
import { registerMapForgeWorkspace } from './workspaces/map-forge-workspace.mjs';
import { registerMountWorkspace } from './workspaces/mount-workspace.mjs';
import { registerAppearanceWorkspace } from './workspaces/appearance-workspace.mjs';
import { registerAnimationWorkspace } from './workspaces/animation-workspace.mjs';
let platform=null;
export async function bootKeloCreators({root=globalThis,stateAdapter=null}={}){
  if(platform)return platform;
  const permission=createCreatorPermissionAdapter(root),world=createWorldCreatorAdapter({root,permission}),localState=stateAdapter||createIndexedDbCreatorStateAdapter({indexedDBFactory:root.indexedDB}),projects=createLocalCreatorProjectRepository({domainAdapters:[world],stateAdapter:localState}),workspaces=createCreatorWorkspaceRegistry(),dependencies=createCreatorDependencyGraph();
  registerWorldWorkspace(workspaces);registerMapForgeWorkspace(workspaces);registerMountWorkspace(workspaces);registerAppearanceWorkspace(workspaces);registerAnimationWorkspace(workspaces);
  async function openWorkspace(id,context={}){
    const manifest=workspaces.resolve(id);if(!manifest)throw new Error(`CREATOR_WORKSPACE_NOT_FOUND:${id}`);
    if(manifest.capability)permission.require(manifest.capability,permission.actorId(),context.projectId||null);
    return workspaces.open(id,{root,projects,permission,dependencies,openWorkspace,...context});
  }
  platform=Object.freeze({version:'kelo-creators-core-v1.2.0',permission,projects,workspaces,dependencies,openWorkspace,close(){try{localState.close?.();}catch{}platform=null;}});
  return platform;
}
export function getKeloCreatorsPlatform(){return platform;}
