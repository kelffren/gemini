/* KELO-INDEX
 * area: CREATORS / ENTRY
 * owner: Kelo Creators composition root
 * owns: lazy composition of generic Creator infrastructure and workspace registration
 * does-not-own: Studio core, World implementation, gameplay or network transport
 */
import { createCreatorWorkspaceRegistry } from './core/workspace-registry.mjs';
import { createCreatorDependencyGraph } from './core/dependency-graph.mjs';
import { createCreatorPermissionAdapter } from './adapters/creator-permission-adapter.mjs';
import { createWorldCreatorAdapter } from './adapters/world-creator-adapter.mjs';
import { createLocalCreatorProjectRepository } from './repository/local-creator-project-repository.mjs';
import { registerWorldWorkspace } from './workspaces/world-workspace.mjs';
let platform=null;
export async function bootKeloCreators({root=globalThis,stateAdapter=null}={}){
  if(platform)return platform;
  const permission=createCreatorPermissionAdapter(root),world=createWorldCreatorAdapter({root,permission}),projects=createLocalCreatorProjectRepository({domainAdapters:[world],stateAdapter}),workspaces=createCreatorWorkspaceRegistry(),dependencies=createCreatorDependencyGraph();
  registerWorldWorkspace(workspaces);
  async function openWorkspace(id,context={}){
    const manifest=workspaces.resolve(id);if(!manifest)throw new Error(`CREATOR_WORKSPACE_NOT_FOUND:${id}`);
    if(manifest.capability)permission.require(manifest.capability,permission.actorId(),context.projectId||null);
    return workspaces.open(id,{root,...context});
  }
  platform=Object.freeze({version:'kelo-creators-core-v1.0.1',permission,projects,workspaces,dependencies,openWorkspace,close(){platform=null;}});
  return platform;
}
export function getKeloCreatorsPlatform(){return platform;}
