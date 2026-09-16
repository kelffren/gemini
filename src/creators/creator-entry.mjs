/* KELO-INDEX
 * area: CREATORS / ENTRY
 * owner: Kelo Creators composition root
 * keys: CREATOR LIBRARY IMAGE LAB MARKETPLACE ENTITLEMENT DELIVERY USE AUTHORITY WORKSPACE REGISTRY LAZY ONLINE
 * owns: lazy composition of generic Creator infrastructure and workspace registration
 * does-not-own: Studio core, workspace implementations, gameplay, payment settlement or network transport
 * public-api: bootKeloCreators, getKeloCreatorsPlatform
 * extension-points: register one documented workspace manifest; Creator Library routes to owners but never replaces them
 * reuse: every Creator workspace registers one manifest; shared online services are composed here once per Creator session
 * do-not: no heavy Creator module in normal boot, no duplicate editor/runtime/market/use authority owners
 */
import '../systems/creator-entitlement-system.js';
import { createCreatorWorkspaceRegistry } from './core/workspace-registry.mjs';
import { createCreatorDependencyGraph } from './core/dependency-graph.mjs';
import { createCreatorPermissionAdapter } from './adapters/creator-permission-adapter.mjs';
import { createWorldCreatorAdapter } from './adapters/world-creator-adapter.mjs';
import { createLocalCreatorProjectRepository } from './repository/local-creator-project-repository.mjs';
import { createIndexedDbCreatorStateAdapter } from './repository/indexeddb-creator-state-adapter.mjs';
import { createRuntimeContentRegistry } from './content/runtime-content-registry.mjs';
import { getOrCreateCreatorContentDelivery } from './content/creator-content-delivery.mjs';
import { getOrCreateCreatorUseAuthority } from './content/creator-use-authority.mjs';
import { createSupabaseCreatorContentRepository } from './content/supabase-content-repository.mjs';
import { createUniversalContentService } from './content/universal-content-service.mjs';
import { createCreatorMarketplaceService } from './marketplace/creator-marketplace-service.mjs';
import { createAvatarQuickImportService } from './avatar/avatar-quick-import-service.mjs';
import { installCreatorAvatarRuntime } from '../characters/creator-avatar-runtime.mjs';
import { createKeloSupabaseBrowserSession } from '../online/kelo-supabase-browser-session.mjs';
import { KELO_SUPABASE_PUBLIC_CONFIG } from '../online/kelo-supabase-public-config.mjs';
import { registerWorldWorkspace } from './workspaces/world-workspace.mjs?v=world-bridge-20260915-22';
import { registerMapForgeWorkspace } from './workspaces/map-forge-workspace.mjs?v=map-forge-launch-recovery-20260912-1';
import { registerMountWorkspace } from './workspaces/mount-workspace.mjs';
import { registerAppearanceWorkspace } from './workspaces/appearance-workspace.mjs';
import { registerAnimationWorkspace } from './workspaces/animation-workspace.mjs';
import { registerVfxWorkspace } from './workspaces/vfx-workspace.mjs';
import { registerAbilityWorkspace } from './workspaces/ability-workspace.mjs';
import { registerSpriteAbilityWorkspace } from './workspaces/sprite-ability-workspace.mjs';
import { registerContentStudioWorkspace } from './workspaces/content-studio-workspace.mjs';
import { registerAssetSheetWorkspace } from './workspaces/asset-sheet-workspace.mjs';
import { registerAssetForgeWorkspace } from './workspaces/asset-forge-workspace.mjs';
import { registerImageLabWorkspace } from './workspaces/image-lab-workspace.mjs';
import { registerCreatorLibraryWorkspace } from './workspaces/creator-library-workspace.mjs';
import { registerAvatarWorkspace } from './workspaces/avatar-workspace.mjs';
import { registerDefinitionWorkspaces } from './workspaces/definition-workspaces.mjs';
let platform=null;
function ensureCreatorInputLocks(root){
  if(root?.KeloInputLocks?.acquire&&root?.KeloInputLocks?.release)return()=>{};
  const held=new Set();let seq=0;
  const fallback={
    __keloCreatorFallback:true,
    acquire(owner='creator-workspace',meta=null){const token=Object.freeze({id:`creator-lock-${++seq}`,owner:String(owner),meta});held.add(token);return token;},
    release(token){return held.delete(token);},
    isLocked(){return held.size>0;},
    has(token){return held.has(token);},
    clear(){held.clear();},
    get size(){return held.size;}
  };
  try{root.KeloInputLocks=fallback;}catch{}
  return()=>{held.clear();try{if(root.KeloInputLocks===fallback)delete root.KeloInputLocks;}catch{}};
}
export async function bootKeloCreators({root=globalThis,stateAdapter=null}={}){
  if(platform)return platform;
  const inputLocksDispose=ensureCreatorInputLocks(root);
  let visualUiDispose=()=>{},eventLabDispose=()=>{},easyUiDispose=()=>{},manualCutterDispose=()=>{},repairStudioDispose=()=>{},repairTouchDispose=()=>{},irregularImportDispose=()=>{},looseImportDispose=()=>{},sessionDispose=()=>{};
  let spriteAbilityExtensionsPromise=null;
  async function ensureSpriteAbilityExtensions(){
    if(spriteAbilityExtensionsPromise)return spriteAbilityExtensionsPromise;
    spriteAbilityExtensionsPromise=(async()=>{
      try{const visualUi=await import('./sprite-ability/sprite-ability-visual-ui.mjs');if(typeof visualUi.installSpriteAbilityVisualUI==='function')visualUiDispose=visualUi.installSpriteAbilityVisualUI({root});}catch(error){console.warn('[Creators] Sprite Ability visual UI unavailable',error);}
      try{const manualCutter=await import('./sprite-ability/sprite-ability-manual-cutter.mjs');if(typeof manualCutter.installSpriteAbilityManualCutter==='function')manualCutterDispose=manualCutter.installSpriteAbilityManualCutter({root});}catch(error){console.warn('[Creators] Sprite Ability manual cutter unavailable',error);}
      try{const repairStudio=await import('./sprite-ability/sprite-ability-repair-studio.mjs');if(typeof repairStudio.installSpriteAbilityRepairStudio==='function')repairStudioDispose=repairStudio.installSpriteAbilityRepairStudio({root});}catch(error){console.warn('[Creators] Sprite Ability repair studio unavailable',error);}
      try{const repairTouch=await import('./sprite-ability/sprite-ability-repair-touch.mjs');if(typeof repairTouch.installSpriteAbilityRepairTouch==='function')repairTouchDispose=repairTouch.installSpriteAbilityRepairTouch({root});}catch(error){console.warn('[Creators] Sprite Ability repair touch unavailable',error);}
      try{const irregularImport=await import('./sprite-ability/sprite-ability-irregular-import.mjs');if(typeof irregularImport.installSpriteAbilityIrregularImport==='function')irregularImportDispose=irregularImport.installSpriteAbilityIrregularImport({root});}catch(error){console.warn('[Creators] Sprite Ability irregular import unavailable',error);}
      try{const looseImport=await import('./sprite-ability/sprite-ability-loose-import.mjs');if(typeof looseImport.installSpriteAbilityLooseImport==='function')looseImportDispose=looseImport.installSpriteAbilityLooseImport({root});}catch(error){console.warn('[Creators] Sprite Ability loose import unavailable',error);}
      try{const eventLab=await import('./sprite-ability/sprite-ability-event-lab.mjs');if(typeof eventLab.installSpriteAbilityEventLab==='function')eventLabDispose=eventLab.installSpriteAbilityEventLab({root});}catch(error){console.warn('[Creators] Sprite Ability event lab unavailable',error);}
      try{const easyUi=await import('./sprite-ability/sprite-ability-easy-ui.mjs');if(typeof easyUi.installSpriteAbilityEasyUI==='function')easyUiDispose=easyUi.installSpriteAbilityEasyUI({root});}catch(error){console.warn('[Creators] Sprite Ability easy UI unavailable',error);}
      return true;
    })();
    return spriteAbilityExtensionsPromise;
  }
  const permission=createCreatorPermissionAdapter(root),world=createWorldCreatorAdapter({root,permission}),localState=stateAdapter||createIndexedDbCreatorStateAdapter({indexedDBFactory:root.indexedDB}),projects=createLocalCreatorProjectRepository({domainAdapters:[world],stateAdapter:localState}),workspaces=createCreatorWorkspaceRegistry(),dependencies=createCreatorDependencyGraph();
  const fetchImpl=root.fetch?.bind?.(root)||globalThis.fetch?.bind?.(globalThis),contentSession=createKeloSupabaseBrowserSession({root,fetchImpl,config:KELO_SUPABASE_PUBLIC_CONFIG}),avatarRuntime=installCreatorAvatarRuntime({root}),runtimeContent=createRuntimeContentRegistry({root}),contentRepository=createSupabaseCreatorContentRepository({url:KELO_SUPABASE_PUBLIC_CONFIG.url,publishableKey:KELO_SUPABASE_PUBLIC_CONFIG.publishableKey,getAccessToken:()=>contentSession.accessToken,fetchImpl}),contentService=createUniversalContentService({repository:contentRepository,runtimeRegistry:runtimeContent,root}),marketplace=createCreatorMarketplaceService({contentSession,contentRepository,root}),delivery=getOrCreateCreatorContentDelivery({root,runtimeRegistry:runtimeContent}),useAuthority=getOrCreateCreatorUseAuthority({root,delivery}),avatarQuick=createAvatarQuickImportService({contentSession,contentRepository,contentService,root});
  try{
    root.KeloCreatorEntitlements?.bindProvider?.({
      name:'creator-content-repository',
      accountId:()=>contentRepository.userId(),
      listAccess:()=>contentRepository.listMyCreatorContentAccess(),
      checkAccess:id=>contentRepository.checkCreatorContentAccess(id)
    });
    delivery.bindProvider({name:'creator-content-repository',accountId:()=>contentRepository.userId(),getManifest:id=>contentRepository.getCreatorContentDelivery(id)});
    useAuthority.bindProvider({name:'creator-content-repository',accountId:()=>contentRepository.userId(),rpc:(name,payload)=>contentRepository.rpc(name,payload),listCharacters:()=>contentRepository.listMyCharacters()});
    useAuthority.attachRuntimeGuards();
    sessionDispose=contentSession.onChange?.(()=>{delivery.invalidateIdentity();useAuthority.invalidateIdentity();useAuthority.attachRuntimeGuards();})||(()=>{});
  }catch(error){console.warn('[Creators] content access/use provider unavailable',error);}
  try{root.KELO_CREATOR_CONTENT_REGISTRY=runtimeContent;root.KELO_CREATOR_MARKETPLACE=marketplace;root.KELO_CREATOR_CONTENT_DELIVERY=delivery;root.KELO_CREATOR_USE_AUTHORITY=useAuthority;void root.KeloCreatorEntitlements?.refresh?.();}catch{}
  registerWorldWorkspace(workspaces);registerMapForgeWorkspace(workspaces);registerMountWorkspace(workspaces);registerAppearanceWorkspace(workspaces);registerAnimationWorkspace(workspaces);registerVfxWorkspace(workspaces);registerAbilityWorkspace(workspaces);registerSpriteAbilityWorkspace(workspaces);registerContentStudioWorkspace(workspaces);registerAssetSheetWorkspace(workspaces);registerAssetForgeWorkspace(workspaces);registerImageLabWorkspace(workspaces);registerAvatarWorkspace(workspaces);registerDefinitionWorkspaces(workspaces);registerCreatorLibraryWorkspace(workspaces);
  async function openWorkspace(id,context={}){
    const manifest=workspaces.resolve(id);if(!manifest)throw new Error(`CREATOR_WORKSPACE_NOT_FOUND:${id}`);
    if(manifest.capability)permission.require(manifest.capability,permission.actorId(),context.projectId||null);
    if(id==='sprite-ability')await ensureSpriteAbilityExtensions();
    return workspaces.open(id,{root,projects,permission,workspaces,dependencies,contentSession,contentRepository,contentService,marketplace,delivery,useAuthority,runtimeContent,avatarRuntime,avatarQuick,openWorkspace,...context});
  }
  platform=Object.freeze({version:'kelo-creators-core-v1.29.0-use-authority',permission,projects,workspaces,dependencies,contentSession,contentRepository,contentService,marketplace,delivery,useAuthority,entitlements:root.KeloCreatorEntitlements||null,runtimeContent,avatarRuntime,avatarQuick,openWorkspace,close(){try{sessionDispose?.();}catch{}try{looseImportDispose?.();}catch{}try{irregularImportDispose?.();}catch{}try{repairTouchDispose?.();}catch{}try{repairStudioDispose?.();}catch{}try{manualCutterDispose?.();}catch{}try{easyUiDispose?.();}catch{}try{eventLabDispose?.();}catch{}try{visualUiDispose?.();}catch{}try{localState.close?.();}catch{}try{inputLocksDispose?.();}catch{}try{if(root.KELO_CREATOR_MARKETPLACE===marketplace)delete root.KELO_CREATOR_MARKETPLACE;}catch{}platform=null;}});
  return platform;
}
export function getKeloCreatorsPlatform(){return platform;}
