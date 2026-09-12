/* KELO-INDEX
 * area: STUDIO / ENTRY
 * owns: lazy Studio boot and integration composition only
 * does-not-own: automatic game startup or legacy builder replacement
 * public-api: bootKeloStudio()
 * online: authority remains KELO_WORLD_EDIT
 */

import { createStudioKernel } from './core/studio-kernel.mjs';
import { createWorldDocument } from './document/world-document.mjs';
import { createWorldCompiler } from './compiler/world-compiler.mjs';
import { createStudioWorkerClient } from './compiler/worker-client.mjs';
import { createKeloRuntimeAdapter } from './adapters/kelo-runtime-adapter.mjs';
import { importCurrentKeloWorld } from './adapters/current-world-importer.mjs';
import { seedCatalogPrefabs } from './adapters/catalog-prefab-seeder.mjs';
import { registerKeloComponents } from './components/kelo-components.mjs';
import { createStudioStore } from './storage/indexeddb-studio-store.mjs';
import { createStudioProfiler } from './performance/studio-profiler.mjs';
import { registerBasicTools } from './tools/register-basic-tools.mjs';
import { createStudioOverlayRenderer } from './render/studio-overlay-renderer.mjs';
import { createStudioAssetPreviewService } from './render/studio-asset-preview-service.mjs';
import { createStudioNudgeController } from './input/studio-nudge-controller.mjs';
import { createStudioPlacementTouchController } from './input/studio-placement-touch-controller.mjs';
import { createStudioOverlapCycleController } from './input/studio-overlap-cycle-controller.mjs';
import { createStudioAssetKeyboardController } from './input/studio-asset-keyboard-controller.mjs';
import { createStudioPrecisionSnapController } from './input/studio-precision-snap-controller.mjs';
import { createStudioSelectionHistoryController } from './input/studio-selection-history-controller.mjs';
import { createStudioFocusShortcutController } from './input/studio-focus-shortcut-controller.mjs';
import { createStudioQuickActionsController } from './input/studio-quick-actions-controller.mjs';
import { createStudioKeyboardDeleteController } from './input/studio-keyboard-delete-controller.mjs';
import { createStudioKeyboardDuplicateController } from './input/studio-keyboard-duplicate-controller.mjs';
import { createStudioKeyboardHistoryController } from './input/studio-keyboard-history-controller.mjs';
import { createStudioKeyboardClipboardController } from './input/studio-keyboard-clipboard-controller.mjs';
import { createStudioSelectAllController } from './input/studio-select-all-controller.mjs';
import { createStudioExplorerRevealController } from './input/studio-explorer-reveal-controller.mjs';
import { createStudioExplorerRangeSelectionController } from './input/studio-explorer-range-selection-controller.mjs';
import { createStudioPropertyCommitController } from './input/studio-property-commit-controller.mjs';
import { createStudioSnapCycleController } from './input/studio-snap-cycle-controller.mjs';
import { createStudioMenuMinimizer } from './ui/studio-menu-minimizer.mjs';
import { createStudioCleanWorkspace } from './ui/studio-clean-workspace.mjs';
import { createStudioContextInspector } from './ui/studio-context-inspector.mjs';
import { createStudioContextSnapChip } from './ui/studio-context-snap-chip.mjs';
import { createStudioAssetFavorites } from './ui/studio-asset-favorites.mjs';
import { createStudioMultiAlign } from './ui/studio-multi-align.mjs';
import { createStudioHistoryHints } from './ui/studio-history-hints.mjs';
import { createStudioTransformPresets } from './ui/studio-transform-presets.mjs';
import { createStudioAssetRepairer } from './ui/studio-asset-repairer.mjs';

const NOOP_ASSET_PALETTE=Object.freeze({
  attach:()=>false,open:()=>false,close:()=>false,toggle:()=>false,refresh:()=>false,choose:()=>false,destroy:()=>{},
  get openState(){return false;},get category(){return 'all';},get query(){return '';},get recent(){return [];}
});
const NOOP_ASSET_FAVORITES=Object.freeze({refresh:()=>{},destroy:()=>{},toggle:()=>false,get ids(){return [];}});

let session = null;
export async function bootKeloStudio({ mode = 'world', actorId = null, document = null, root = globalThis } = {}) {
  if (session) return session;
  if(mode==='asset-repair'||mode==='asset-repairer'){
    const assetRepairer=createStudioAssetRepairer({root});
    const actions=assetRepairer.element?.querySelector?.('.kar-actions');
    if(actions&&!actions.querySelector('[data-repair-close]')){
      const close=root.document?.createElement?.('button');
      if(close){close.type='button';close.className='kar-btn';close.dataset.repairClose='1';close.textContent='CLOSE';close.onclick=()=>{assetRepairer.destroy();session=null;};actions.prepend(close);}
    }
    session=Object.freeze({
      version:'kelo-studio-asset-repairer-v1.0.0',mode:'asset-repair',actorId,assetRepairer,
      close(){assetRepairer.destroy();session=null;}
    });
    return session;
  }
  const adapter = createKeloRuntimeAdapter(root);
  const initial = document || createWorldDocument({ worldId: mode === 'parcel' ? `parcel:${actorId || 'local'}` : 'world:kelo-main', metadata: { name: mode === 'parcel' ? 'My Parcel' : 'Kelo World', description: '', tags: [mode] }, settings: { tileSize: root.KELO_TILE_REGISTRY?.worldTileSize || 32, chunkSize: root.KELO_WORLD_RENDERER?.chunkSize || 512 } });
  const kernel = createStudioKernel({ document: initial, adapter });
  registerKeloComponents(kernel.components); seedCatalogPrefabs({ prefabRegistry: kernel.prefabs, assetCatalog: adapter.assetCatalog });
  const tools = registerBasicTools(kernel);
  const assetPreview=createStudioAssetPreviewService({assetCatalog:adapter.assetCatalog,atlasContract:root.KELO_ATLAS_CONTRACT});
  const overlayRenderer = createStudioOverlayRenderer({ kernel, tools, assetPreview });
  const paletteAssets=()=>{
    const personal=(tools.prefabStamp?.list?.()||[]).map(def=>({
      id:String(def.id),label:String(def.label||def.id),category:'My Prefabs',
      width:Math.max(1,Number(def.bounds?.w)||32),height:Math.max(1,Number(def.bounds?.h)||32),
      creatorPrefab:true,previewChildren:Array.isArray(def.children)?def.children:[]
    }));
    const catalog=adapter.assetCatalog.list?.()||[];
    const seen=new Set();
    return [...personal,...catalog].filter(asset=>{const id=String(asset?.id||'');if(!id||seen.has(id))return false;seen.add(id);return true;});
  };
  let assetPalette=NOOP_ASSET_PALETTE;
  try{
    const paletteUi=await import('./ui/studio-asset-palette.mjs');
    if(typeof paletteUi.createStudioAssetPalette==='function'){
      assetPalette=paletteUi.createStudioAssetPalette({root,getAssets:paletteAssets,renderAssetPreview:(canvas,asset)=>assetPreview.renderThumbnail(canvas,asset)});
    }
  }catch(error){
    console.warn('[Kelo Studio] optional asset palette unavailable; continuing without it',error);
  }
  let assetFavorites=NOOP_ASSET_FAVORITES;
  try{
    assetFavorites=createStudioAssetFavorites({root,paletteApi:assetPalette,getAssets:paletteAssets});
  }catch(error){
    console.warn('[Kelo Studio] optional asset favorites unavailable; continuing without it',error);
  }
  const assetKeyboardController=createStudioAssetKeyboardController({root,assetPalette});
  const menuMinimizer=createStudioMenuMinimizer({root});
  const cleanWorkspace=createStudioCleanWorkspace({root,kernel});
  const contextInspector=createStudioContextInspector({root,kernel,tools});
  const contextSnapChip=createStudioContextSnapChip({root});
  const multiAlign=createStudioMultiAlign({root,kernel});
  const historyHints=createStudioHistoryHints({root,kernel});
  const transformPresets=createStudioTransformPresets({root,kernel});
  const nudgeController=createStudioNudgeController({root,kernel});
  const placementTouchController=createStudioPlacementTouchController({root,placement:tools.placement});
  const overlapCycleController=createStudioOverlapCycleController({root,kernel});
  const precisionSnapController=createStudioPrecisionSnapController({root});
  const selectionHistoryController=createStudioSelectionHistoryController({root,kernel});
  const focusShortcutController=createStudioFocusShortcutController({root});
  const quickActionsController=createStudioQuickActionsController({root,kernel,assetPalette});
  const keyboardDeleteController=createStudioKeyboardDeleteController({root,kernel});
  const keyboardDuplicateController=createStudioKeyboardDuplicateController({root,kernel});
  const keyboardHistoryController=createStudioKeyboardHistoryController({root});
  const keyboardClipboardController=createStudioKeyboardClipboardController({root});
  const selectAllController=createStudioSelectAllController({root,kernel});
  const explorerRevealController=createStudioExplorerRevealController({root,kernel});
  const explorerRangeSelectionController=createStudioExplorerRangeSelectionController({root,kernel});
  const propertyCommitController=createStudioPropertyCommitController({root});
  const snapCycleController=createStudioSnapCycleController({root});
  const resolvePrefab = id => kernel.prefabs.resolve(id) || adapter.assetCatalog.get(id) || { id };
  const compiler = createWorldCompiler({ resolvePrefab });
  const worker = createStudioWorkerClient({ resolvePrefab, prefabSnapshot: () => Object.fromEntries(kernel.prefabs.list().map(p => [p.id, kernel.prefabs.resolve(p.id)])) });
  const store = createStudioStore(), profiler = createStudioProfiler();
  const unsubscribeJournal = kernel.commands.on(event => { store.appendCommand(kernel.document.worldId, { action: event.type, command: event.command }).catch(() => {}); });
  session = Object.freeze({ version: 'kelo-studio-foundation-v1.33.0-escape-clear-selection', mode, actorId, kernel, tools, overlayRenderer, assetPreview, assetPalette, assetFavorites, assetKeyboardController, menuMinimizer, cleanWorkspace, contextInspector, contextSnapChip, multiAlign, historyHints, transformPresets, nudgeController, placementTouchController, overlapCycleController, precisionSnapController, selectionHistoryController, focusShortcutController, quickActionsController, keyboardDeleteController, keyboardDuplicateController, keyboardHistoryController, keyboardClipboardController, selectAllController, explorerRevealController, explorerRangeSelectionController, propertyCommitController, snapCycleController, compiler, worker, store, profiler, adapter,
    compile: options => profiler.measure('compile.sync', () => compiler.compile(kernel.document, options)), compileAsync: options => profiler.measure('compile.worker', () => worker.compile(kernel.document, options)),
    async importCurrent(options={}) { const next=await profiler.measure('import.current',()=>importCurrentKeloWorld({adapter,mode,actorId,...options})); kernel.setDocument(next); seedCatalogPrefabs({prefabRegistry:kernel.prefabs,assetCatalog:adapter.assetCatalog}); try{assetPalette.refresh();assetFavorites.refresh();multiAlign.refresh();historyHints.refresh();}catch{} return next; },
    checkpoint: () => store.saveCheckpoint(kernel.document.worldId,kernel.document), recover: () => store.loadRecovery(kernel.document.worldId),
    close(){unsubscribeJournal();snapCycleController.destroy();propertyCommitController.destroy();explorerRangeSelectionController.destroy();explorerRevealController.destroy();selectAllController.destroy();keyboardClipboardController.destroy();keyboardHistoryController.destroy();keyboardDuplicateController.destroy();keyboardDeleteController.destroy();quickActionsController.destroy();focusShortcutController.destroy();selectionHistoryController.destroy();precisionSnapController.destroy();overlapCycleController.destroy();placementTouchController.destroy();nudgeController.destroy();transformPresets.destroy();historyHints.destroy();multiAlign.destroy();contextSnapChip.destroy();contextInspector.destroy();cleanWorkspace.destroy();menuMinimizer.destroy();assetKeyboardController.destroy();try{assetFavorites.destroy();}catch{}try{assetPalette.destroy();}catch{}worker.close();profiler.close();assetPreview.close();store.close().catch(()=>{});session=null;}
  });
  return session;
}
export function getKeloStudioSession(){return session;}
if(typeof window!=='undefined')window.KELO_STUDIO_LAZY_BOOT=bootKeloStudio;