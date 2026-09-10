/* KELO-INDEX
 * area: CREATORS / ABILITY WORKSPACE
 * owner: Ability workspace manifest only
 * owns: descriptor and lazy routing into Ability Creator controller
 * does-not-own: Studio core, ability runtime, projects, permissions, assets or combat
 * reuse: existing Kelo Creators WorkspaceRegistry
 */
export function createAbilityWorkspaceManifest({loader=()=>import('../ability/ability-live-controller.mjs')}={}){
  return Object.freeze({id:'ability',label:'Ability',category:'gameplay',projectTypes:['ABILITY'],capability:'ability.edit',availability:'active',async open(context={}){const mod=await loader();if(typeof mod.openAbilityCreator!=='function')throw new Error('CREATOR_ABILITY_ENTRY_MISSING');const session=await mod.openAbilityCreator(context);try{const tuner=await import('../ability/ability-touch-tuner.mjs');tuner.installAbilityTouchTuner?.(session,{root:context.root||globalThis});}catch(error){console.warn('[Ability Workspace] touch tuner unavailable',error);}return session;}});
}
export function registerAbilityWorkspace(registry,options={}){return registry.register(createAbilityWorkspaceManifest(options));}
