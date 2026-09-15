/* KELO-INDEX
 * area: STUDIO / ENTRY
 * owns: lazy Studio boot and integration composition only
 * does-not-own: automatic game startup or legacy builder replacement
 * public-api: bootKeloStudio()
 * online: authority remains KELO_WORLD_EDIT
 * mobile: ZERO static Studio imports; iPhone serializes kernel/tools/services between paints, skips overlay renderer + worker, and waits 8s/15s for palette/extras
 */

async function loadStudioCore(root,phoneBoot){
  const {yieldStudioBoot,setWorldLaunchStatus}=await import('./integration/studio-boot-pace.mjs');
  const wait=async()=>{await yieldStudioBoot(root);if(phoneBoot)await new Promise(resolve=>(root.setTimeout||setTimeout)(resolve,32));};
  const abort=()=>{if(root?.KELO_WORLD_LAUNCH_ABORTED)throw new Error('WORLD_EDITOR_OPEN_TIMEOUT');};
  setWorldLaunchStatus(root,'Cargando núcleo…');
  const kernelMod=await import('./core/studio-kernel.mjs');await wait();abort();
  const documentMod=await import('./document/world-document.mjs');await wait();abort();
  const adapterMod=await import('./adapters/kelo-runtime-adapter.mjs');await wait();abort();
  setWorldLaunchStatus(root,'Cargando herramientas…');
  const toolsMod=await import('./tools/register-core-tools.mjs');await wait();abort();
  const seederMod=await import('./adapters/catalog-prefab-seeder.mjs');await wait();abort();
  const componentsMod=await import('./components/kelo-components.mjs');await wait();abort();
  const importerMod=await import('./adapters/current-world-importer.mjs');await wait();abort();
  setWorldLaunchStatus(root,'Cargando servicios…');
  const previewMod=await import('./render/studio-asset-preview-service.mjs');await wait();abort();
  const storeMod=await import('./storage/indexeddb-studio-store.mjs');await wait();abort();
  const profilerMod=await import('./performance/studio-profiler.mjs');await wait();abort();
  const compilerMod=await import('./compiler/world-compiler.mjs');await wait();abort();
  let overlayMod=null,workerMod=null,touchMod=null,rangeMod=null;
  if(!phoneBoot){
    overlayMod=await import('./render/studio-overlay-renderer.mjs');await wait();abort();
    workerMod=await import('./compiler/worker-client.mjs');await wait();abort();
  }
  touchMod=await import('./input/studio-placement-touch-controller.mjs');await wait();abort();
  rangeMod=await import('./input/studio-explorer-range-selection-controller.mjs');await wait();abort();
  return {
    createStudioKernel:kernelMod.createStudioKernel,
    createWorldDocument:documentMod.createWorldDocument,
    createKeloRuntimeAdapter:adapterMod.createKeloRuntimeAdapter,
    registerCoreTools:toolsMod.registerCoreTools,
    seedCatalogPrefabs:seederMod.seedCatalogPrefabs,
    registerKeloComponents:componentsMod.registerKeloComponents,
    importCurrentKeloWorld:importerMod.importCurrentKeloWorld,
    createStudioAssetPreviewService:previewMod.createStudioAssetPreviewService,
    createStudioStore:storeMod.createStudioStore,
    createStudioProfiler:profilerMod.createStudioProfiler,
    createWorldCompiler:compilerMod.createWorldCompiler,
    createStudioOverlayRenderer:overlayMod?.createStudioOverlayRenderer||null,
    createStudioWorkerClient:workerMod?.createStudioWorkerClient||null,
    createStudioPlacementTouchController:touchMod.createStudioPlacementTouchController,
    createStudioExplorerRangeSelectionController:rangeMod.createStudioExplorerRangeSelectionController
  };
}

const NOOP_ASSET_PALETTE=Object.freeze({
  attach:()=>false,open:()=>false,close:()=>false,toggle:()=>false,refresh:()=>false,choose:()=>false,destroy:()=>{},
  get openState(){return false;},get category(){return 'all';},get query(){return '';},get recent(){return [];}
});
const NOOP_ASSET_FAVORITES=Object.freeze({refresh:()=>{},destroy:()=>{},toggle:()=>false,get ids(){return [];}});
const NOOP_CTRL=Object.freeze({destroy(){},refresh(){}});
const PHONE_OPTIONAL_BOOT_DELAY_MS=8000;
const PHONE_PRODUCTIVITY_BOOT_DELAY_MS=15000;

function isPhoneStudioBoot(root){
  const ua=String(root?.navigator?.userAgent||'');
  const short=Math.min(Number(root?.innerWidth)||999,Number(root?.innerHeight)||999);
  return /iPhone|iPad|iPod|Android/i.test(ua)||short<=500;
}
function deferStudioOptional(root,fn,delay){
  if(delay<=0){fn();return 0;}
  return (root.setTimeout||setTimeout)(fn,delay);
}

let session = null;

async function installStudioProductivityExtras({root,kernel,tools,assetPalette,getAssets}){
  const extras=await import('./studio-boot-extras.mjs');
  const {
    createStudioNudgeController,createStudioOverlapCycleController,createStudioAssetKeyboardController,
    createStudioPrecisionSnapController,createStudioSelectionHistoryController,createStudioFocusShortcutController,
    createStudioQuickActionsController,createStudioKeyboardDeleteController,createStudioKeyboardDuplicateController,
    createStudioKeyboardHistoryController,createStudioKeyboardClipboardController,createStudioSelectAllController,
    createStudioExplorerRevealController,createStudioPropertyCommitController,createStudioSnapCycleController,
    createStudioMenuMinimizer,createStudioCleanWorkspace,createStudioContextInspector,createStudioContextSnapChip,
    createStudioAssetFavorites,createStudioMultiAlign,createStudioHistoryHints,createStudioTransformPresets
  }=extras;
  let assetFavorites=NOOP_ASSET_FAVORITES;
  try{
    assetFavorites=createStudioAssetFavorites({root,paletteApi:assetPalette,getAssets});
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
  const propertyCommitController=createStudioPropertyCommitController({root});
  const snapCycleController=createStudioSnapCycleController({root});
  return {
    assetFavorites,assetKeyboardController,menuMinimizer,cleanWorkspace,contextInspector,contextSnapChip,
    multiAlign,historyHints,transformPresets,nudgeController,overlapCycleController,precisionSnapController,
    selectionHistoryController,focusShortcutController,quickActionsController,keyboardDeleteController,
    keyboardDuplicateController,keyboardHistoryController,keyboardClipboardController,selectAllController,
    explorerRevealController,propertyCommitController,snapCycleController
  };
}

export async function bootKeloStudio({ mode = 'world', actorId = null, document = null, root = globalThis } = {}) {
  if (session) return session;
  if(mode==='asset-repair'||mode==='asset-repairer'){
    const {createStudioAssetRepairer}=await import('./ui/studio-asset-repairer.mjs');
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
  const phoneBoot=isPhoneStudioBoot(root);
  let optionalToolsTimer=0,optionalPaletteTimer=0,extrasTimer=0,closed=false;
  const core=await loadStudioCore(root,phoneBoot);
  const {
    createStudioKernel,createWorldDocument,createKeloRuntimeAdapter,registerCoreTools,
    seedCatalogPrefabs,registerKeloComponents,importCurrentKeloWorld,createStudioAssetPreviewService,
    createStudioStore,createStudioProfiler,createWorldCompiler,createStudioOverlayRenderer,
    createStudioWorkerClient,createStudioPlacementTouchController,createStudioExplorerRangeSelectionController
  }=core;
  const adapter = createKeloRuntimeAdapter(root);
  const initial = document || createWorldDocument({ worldId: mode === 'parcel' ? `parcel:${actorId || 'local'}` : 'world:kelo-main', metadata: { name: mode === 'parcel' ? 'My Parcel' : 'Kelo World', description: '', tags: [mode] }, settings: { tileSize: root.KELO_TILE_REGISTRY?.worldTileSize || 32, chunkSize: root.KELO_WORLD_RENDERER?.chunkSize || 512 } });
  const kernel = createStudioKernel({ document: initial, adapter });
  registerKeloComponents(kernel.components); seedCatalogPrefabs({ prefabRegistry: kernel.prefabs, assetCatalog: adapter.assetCatalog });
  const tools = registerCoreTools(kernel);
  const loadBasicTools=()=>{
    if(closed)return;
    void import('./tools/register-basic-tools.mjs').then(mod=>{
      if(closed||typeof mod.registerBasicTools!=='function')return;
      try{Object.assign(tools,mod.registerBasicTools(kernel));}catch(error){
        console.warn('[Kelo Studio] optional build tools unavailable; World editor stays usable',error);
      }
    }).catch(error=>{
      console.warn('[Kelo Studio] optional build tools unavailable; World editor stays usable',error);
    });
  };
  optionalToolsTimer=deferStudioOptional(root,()=>{optionalToolsTimer=0;loadBasicTools();},phoneBoot?PHONE_OPTIONAL_BOOT_DELAY_MS:0);
  const assetPreview=createStudioAssetPreviewService({assetCatalog:adapter.assetCatalog,atlasContract:root.KELO_ATLAS_CONTRACT,devicePixelRatio:phoneBoot?1:(globalThis.devicePixelRatio||1)});
  const overlayRenderer = createStudioOverlayRenderer?createStudioOverlayRenderer({ kernel, tools, assetPreview }):{draw(){}};
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
  const loadAssetPalette=()=>{
    if(closed)return;
    void import('./ui/studio-asset-palette.mjs').then(paletteUi=>{
      if(closed||typeof paletteUi.createStudioAssetPalette!=='function')return;
      assetPalette=paletteUi.createStudioAssetPalette({root,getAssets:paletteAssets,renderAssetPreview:(canvas,asset)=>assetPreview.renderThumbnail(canvas,asset)});
      try{assetPalette.refresh();}catch{}
    }).catch(error=>{
      console.warn('[Kelo Studio] optional asset palette unavailable; continuing without it',error);
    });
  };
  optionalPaletteTimer=deferStudioOptional(root,()=>{optionalPaletteTimer=0;loadAssetPalette();},phoneBoot?PHONE_OPTIONAL_BOOT_DELAY_MS:0);
  const placementTouchController=createStudioPlacementTouchController({root,placement:tools.placement});
  const explorerRangeSelectionController=createStudioExplorerRangeSelectionController({root,kernel});
  let assetFavorites=NOOP_ASSET_FAVORITES;
  let assetKeyboardController=NOOP_CTRL;
  let menuMinimizer=NOOP_CTRL;
  let cleanWorkspace=NOOP_CTRL;
  let contextInspector=NOOP_CTRL;
  let contextSnapChip=NOOP_CTRL;
  let multiAlign=NOOP_CTRL;
  let historyHints=NOOP_CTRL;
  let transformPresets=NOOP_CTRL;
  let nudgeController=NOOP_CTRL;
  let overlapCycleController=NOOP_CTRL;
  let precisionSnapController=NOOP_CTRL;
  let selectionHistoryController=NOOP_CTRL;
  let focusShortcutController=NOOP_CTRL;
  let quickActionsController=NOOP_CTRL;
  let keyboardDeleteController=NOOP_CTRL;
  let keyboardDuplicateController=NOOP_CTRL;
  let keyboardHistoryController=NOOP_CTRL;
  let keyboardClipboardController=NOOP_CTRL;
  let selectAllController=NOOP_CTRL;
  let explorerRevealController=NOOP_CTRL;
  let propertyCommitController=NOOP_CTRL;
  let snapCycleController=NOOP_CTRL;
  const resolvePrefab = id => kernel.prefabs.resolve(id) || adapter.assetCatalog.get(id) || { id };
  const compiler = createWorldCompiler({ resolvePrefab });
  const worker = createStudioWorkerClient?createStudioWorkerClient({ resolvePrefab, prefabSnapshot: () => Object.fromEntries(kernel.prefabs.list().map(p => [p.id, kernel.prefabs.resolve(p.id)])) }):{compile:(doc,options)=>Promise.resolve(compiler.compile(doc,options)),close(){},get active(){return false;}};
  const store = createStudioStore(), profiler = createStudioProfiler();
  const unsubscribeJournal = kernel.commands.on(event => { store.appendCommand(kernel.document.worldId, { action: event.type, command: event.command }).catch(() => {}); });
  session = Object.freeze({ version: 'kelo-studio-foundation-v1.35.0-world-bridge-boot', mode, actorId, kernel, tools, overlayRenderer, assetPreview,
    get assetPalette(){return assetPalette;},
    get assetFavorites(){return assetFavorites;},
    get assetKeyboardController(){return assetKeyboardController;},
    get menuMinimizer(){return menuMinimizer;},
    get cleanWorkspace(){return cleanWorkspace;},
    get contextInspector(){return contextInspector;},
    get contextSnapChip(){return contextSnapChip;},
    get multiAlign(){return multiAlign;},
    get historyHints(){return historyHints;},
    get transformPresets(){return transformPresets;},
    get nudgeController(){return nudgeController;},
    placementTouchController,
    get overlapCycleController(){return overlapCycleController;},
    get precisionSnapController(){return precisionSnapController;},
    get selectionHistoryController(){return selectionHistoryController;},
    get focusShortcutController(){return focusShortcutController;},
    get quickActionsController(){return quickActionsController;},
    get keyboardDeleteController(){return keyboardDeleteController;},
    get keyboardDuplicateController(){return keyboardDuplicateController;},
    get keyboardHistoryController(){return keyboardHistoryController;},
    get keyboardClipboardController(){return keyboardClipboardController;},
    get selectAllController(){return selectAllController;},
    get explorerRevealController(){return explorerRevealController;},
    explorerRangeSelectionController, propertyCommitController,
    get propertyCommitController(){return propertyCommitController;},
    get snapCycleController(){return snapCycleController;},
    compiler, worker, store, profiler, adapter,
    compile: options => profiler.measure('compile.sync', () => compiler.compile(kernel.document, options)), compileAsync: options => profiler.measure('compile.worker', () => worker.compile(kernel.document, options)),
    async importCurrent(options={}) { const next=await profiler.measure('import.current',()=>importCurrentKeloWorld({adapter,mode,actorId,...options})); kernel.setDocument(next); seedCatalogPrefabs({prefabRegistry:kernel.prefabs,assetCatalog:adapter.assetCatalog}); try{assetPalette.refresh();assetFavorites.refresh();multiAlign.refresh();historyHints.refresh();}catch{} return next; },
    checkpoint: () => store.saveCheckpoint(kernel.document.worldId,kernel.document), recover: () => store.loadRecovery(kernel.document.worldId),
    close(){
      closed=true;
      for(const timer of [optionalToolsTimer,optionalPaletteTimer,extrasTimer])if(timer)(root.clearTimeout||clearTimeout)(timer);
      optionalToolsTimer=0;optionalPaletteTimer=0;extrasTimer=0;
      unsubscribeJournal();snapCycleController.destroy();propertyCommitController.destroy();explorerRangeSelectionController.destroy();explorerRevealController.destroy();selectAllController.destroy();keyboardClipboardController.destroy();keyboardHistoryController.destroy();keyboardDuplicateController.destroy();keyboardDeleteController.destroy();quickActionsController.destroy();focusShortcutController.destroy();selectionHistoryController.destroy();precisionSnapController.destroy();overlapCycleController.destroy();placementTouchController.destroy();nudgeController.destroy();transformPresets.destroy();historyHints.destroy();multiAlign.destroy();contextSnapChip.destroy();contextInspector.destroy();cleanWorkspace.destroy();menuMinimizer.destroy();assetKeyboardController.destroy();try{assetFavorites.destroy();}catch{}try{assetPalette.destroy();}catch{}worker.close();profiler.close();assetPreview.close();store.close().catch(()=>{});session=null;
    }
  });
  const applyStudioExtras=next=>{
    if(!session||closed){
      for(const extra of Object.values(next||{}))try{extra?.destroy?.();}catch{}
      return;
    }
    assetFavorites=next.assetFavorites;
    assetKeyboardController=next.assetKeyboardController;
    menuMinimizer=next.menuMinimizer;
    cleanWorkspace=next.cleanWorkspace;
    contextInspector=next.contextInspector;
    contextSnapChip=next.contextSnapChip;
    multiAlign=next.multiAlign;
    historyHints=next.historyHints;
    transformPresets=next.transformPresets;
    nudgeController=next.nudgeController;
    overlapCycleController=next.overlapCycleController;
    precisionSnapController=next.precisionSnapController;
    selectionHistoryController=next.selectionHistoryController;
    focusShortcutController=next.focusShortcutController;
    quickActionsController=next.quickActionsController;
    keyboardDeleteController=next.keyboardDeleteController;
    keyboardDuplicateController=next.keyboardDuplicateController;
    keyboardHistoryController=next.keyboardHistoryController;
    keyboardClipboardController=next.keyboardClipboardController;
    selectAllController=next.selectAllController;
    explorerRevealController=next.explorerRevealController;
    propertyCommitController=next.propertyCommitController;
    snapCycleController=next.snapCycleController;
    try{assetPalette.refresh();assetFavorites.refresh();multiAlign.refresh();historyHints.refresh();}catch{}
  };
  extrasTimer=deferStudioOptional(root,()=>{
    extrasTimer=0;
    if(closed)return;
    void installStudioProductivityExtras({root,kernel,tools,assetPalette,getAssets:paletteAssets}).then(applyStudioExtras).catch(error=>{
      console.warn('[Kelo Studio] optional productivity extras unavailable; World editor stays usable',error);
    });
  }, phoneBoot?PHONE_PRODUCTIVITY_BOOT_DELAY_MS:0);
  return session;
}
export function getKeloStudioSession(){return session;}
if(typeof window!=='undefined')window.KELO_STUDIO_LAZY_BOOT=bootKeloStudio;
