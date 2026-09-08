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
  platform=Object.freeze({version:'kelo-creators-core-v1.0.0',permission,projects,workspaces,dependencies,openWorkspace:(id,context={})=>workspaces.open(id,{root,...context}),close(){platform=null;}});
  return platform;
}
export function getKeloCreatorsPlatform(){return platform;}
