/* KELO-INDEX
 * area: STUDIO / ENTRY
 * owns: lazy Studio boot and integration composition only
 * does-not-own: automatic game startup or legacy builder replacement
 * public-api: bootKeloStudio()
 * online: authority remains KELO_WORLD_EDIT
 * mobile: ZERO static Studio imports; iPhone serializes kernel/tools/services between paints, skips overlay renderer + worker, registers core tools serially, loads asset palette early for preview, and idle-slices heavy extras so delayed waves do not freeze
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
  let toolsMod=null;
  if(phoneBoot){
    // A10: never import the static 7-tool barrel on iPhone; serial file has zero static deps.
    const serialMod=await import('./tools/register-core-tools-serial.mjs');
    toolsMod={registerCoreTools:null,registerCoreToolsSerial:serialMod.registerCoreToolsSerial};
  }else{
    toolsMod=await import('./tools/register-core-tools.mjs');
  }
  await wait();abort();
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
  if(!phoneBoot){
    rangeMod=await import('./input/studio-explorer-range-selection-controller.mjs');await wait();abort();
  }
  return {
    createStudioKernel:kernelMod.createStudioKernel,
    createWorldDocument:documentMod.createWorldDocument,
    createKeloRuntimeAdapter:adapterMod.createKeloRuntimeAdapter,
    registerCoreTools:toolsMod.registerCoreTools,
    registerCoreToolsSerial:toolsMod.registerCoreToolsSerial||null,
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
    createStudioExplorerRangeSelectionController:rangeMod?.createStudioExplorerRangeSelectionController||null
  };
}

const NOOP_ASSET_PALETTE=Object.freeze({
  attach:()=>false,open:()=>false,close:()=>false,toggle:()=>false,refresh:()=>false,choose:()=>false,destroy:()=>{},
  get openState(){return false;},get category(){return 'all';},get query(){return '';},get recent(){return [];}
});
const NOOP_ASSET_FAVORITES=Object.freeze({refresh:()=>{},destroy:()=>{},toggle:()=>false,get ids(){return [];}});
const NOOP_CTRL=Object.freeze({destroy(){},refresh(){}});
const NOOP_STORE=Object.freeze({appendCommand:async()=>false,saveCheckpoint:async()=>false,loadRecovery:async()=>null,close:async()=>{}});
const NOOP_ASSET_PREVIEW=Object.freeze({renderThumbnail:async()=>false,warmAsset:async()=>false,close(){}});
// A11: preview/catalog UI early; heavy optional tools + extras later and idle-sliced.
const PHONE_PREVIEW_BOOT_DELAY_MS=1200;
const PHONE_OPTIONAL_BOOT_DELAY_MS=45000;
const PHONE_PRODUCTIVITY_BOOT_DELAY_MS=55000;

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

async function installStudioProductivityExtras({root,kernel,tools,assetPalette,getAssets,phone=false}){
  const surgeryApi=root.KELO_WORLD_SURGERY;
  const extraEnabled=id=>surgeryApi?.enabled?.(id)!==false;
  const trackedCreate=(id,fn,args,fallback=NOOP_CTRL)=>{
    if(!extraEnabled(id)){surgeryApi?.markStatus?.(id,'DISABLED',{phase:'constructor'});return fallback;}
    if(typeof fn!=='function')return fallback;
    const token=surgeryApi?.start?.(id,'constructor');
    try{const value=fn(args);surgeryApi?.done?.(token);return value;}catch(error){surgeryApi?.fail?.(token,error);console.warn(`[Kelo Studio] optional ${id} failed; continuing`,error);return fallback;}
  };
  // Desktop: one barrel. Phone: avoid the barrel eval spike — import small batches with yields.
  if(!phone){
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
    const assetFavorites=trackedCreate('assetFavorites',createStudioAssetFavorites,{root,paletteApi:assetPalette,getAssets},NOOP_ASSET_FAVORITES);
    return {
      assetFavorites,
      assetKeyboardController:trackedCreate('assetKeyboard',createStudioAssetKeyboardController,{root,assetPalette}),
      menuMinimizer:trackedCreate('menuMinimizer',createStudioMenuMinimizer,{root}),
      cleanWorkspace:trackedCreate('cleanWorkspace',createStudioCleanWorkspace,{root,kernel}),
      contextInspector:trackedCreate('contextInspector',createStudioContextInspector,{root,kernel,tools}),
      contextSnapChip:trackedCreate('contextSnapChip',createStudioContextSnapChip,{root}),
      multiAlign:trackedCreate('multiAlign',createStudioMultiAlign,{root,kernel}),
      historyHints:trackedCreate('historyHints',createStudioHistoryHints,{root,kernel}),
      transformPresets:trackedCreate('transformPresets',createStudioTransformPresets,{root,kernel}),
      nudgeController:trackedCreate('nudge',createStudioNudgeController,{root,kernel}),
      overlapCycleController:trackedCreate('overlapCycle',createStudioOverlapCycleController,{root,kernel}),
      precisionSnapController:trackedCreate('precisionSnap',createStudioPrecisionSnapController,{root}),
      selectionHistoryController:trackedCreate('selectionHistory',createStudioSelectionHistoryController,{root,kernel}),
      focusShortcutController:trackedCreate('focusShortcut',createStudioFocusShortcutController,{root}),
      quickActionsController:trackedCreate('quickActions',createStudioQuickActionsController,{root,kernel,assetPalette}),
      keyboardDeleteController:trackedCreate('keyboardDelete',createStudioKeyboardDeleteController,{root,kernel}),
      keyboardDuplicateController:trackedCreate('keyboardDuplicate',createStudioKeyboardDuplicateController,{root,kernel}),
      keyboardHistoryController:trackedCreate('keyboardHistory',createStudioKeyboardHistoryController,{root}),
      keyboardClipboardController:trackedCreate('keyboardClipboard',createStudioKeyboardClipboardController,{root}),
      selectAllController:trackedCreate('selectAll',createStudioSelectAllController,{root,kernel}),
      explorerRevealController:trackedCreate('explorerReveal',createStudioExplorerRevealController,{root,kernel}),
      propertyCommitController:trackedCreate('propertyCommit',createStudioPropertyCommitController,{root}),
      snapCycleController:trackedCreate('snapCycle',createStudioSnapCycleController,{root})
    };
  }
  const {yieldStudioBoot,pauseStudioBoot,whenStudioIdle}=await import('./integration/studio-boot-pace.mjs');
  const wait=async()=>{await whenStudioIdle(root,{timeoutMs:900});await yieldStudioBoot(root);await pauseStudioBoot(root,72);};
  const specs=[
    ['./ui/studio-asset-favorites.mjs','createStudioAssetFavorites','assetFavorites'],
    ['./input/studio-asset-keyboard-controller.mjs','createStudioAssetKeyboardController','assetKeyboard'],
    ['./ui/studio-menu-minimizer.mjs','createStudioMenuMinimizer','menuMinimizer'],
    ['./ui/studio-clean-workspace.mjs','createStudioCleanWorkspace','cleanWorkspace'],
    ['./ui/studio-context-inspector.mjs','createStudioContextInspector','contextInspector'],
    ['./ui/studio-context-snap-chip.mjs','createStudioContextSnapChip','contextSnapChip'],
    ['./ui/studio-multi-align.mjs','createStudioMultiAlign','multiAlign'],
    ['./ui/studio-history-hints.mjs','createStudioHistoryHints','historyHints'],
    ['./ui/studio-transform-presets.mjs','createStudioTransformPresets','transformPresets'],
    ['./input/studio-nudge-controller.mjs','createStudioNudgeController','nudge'],
    ['./input/studio-overlap-cycle-controller.mjs','createStudioOverlapCycleController','overlapCycle'],
    ['./input/studio-precision-snap-controller.mjs','createStudioPrecisionSnapController','precisionSnap'],
    ['./input/studio-selection-history-controller.mjs','createStudioSelectionHistoryController','selectionHistory'],
    ['./input/studio-focus-shortcut-controller.mjs','createStudioFocusShortcutController','focusShortcut'],
    ['./input/studio-quick-actions-controller.mjs','createStudioQuickActionsController','quickActions'],
    ['./input/studio-keyboard-delete-controller.mjs','createStudioKeyboardDeleteController','keyboardDelete'],
    ['./input/studio-keyboard-duplicate-controller.mjs','createStudioKeyboardDuplicateController','keyboardDuplicate'],
    ['./input/studio-keyboard-history-controller.mjs','createStudioKeyboardHistoryController','keyboardHistory'],
    ['./input/studio-keyboard-clipboard-controller.mjs','createStudioKeyboardClipboardController','keyboardClipboard'],
    ['./input/studio-select-all-controller.mjs','createStudioSelectAllController','selectAll'],
    ['./input/studio-explorer-reveal-controller.mjs','createStudioExplorerRevealController','explorerReveal'],
    ['./input/studio-property-commit-controller.mjs','createStudioPropertyCommitController','propertyCommit'],
    ['./input/studio-snap-cycle-controller.mjs','createStudioSnapCycleController','snapCycle']
  ];
  const creators={};
  for(const [modPath,name,flag] of specs){
    if(!extraEnabled(flag)){surgeryApi?.markStatus?.(flag,'DISABLED',{phase:'module-import'});creators[name]=null;await wait();continue;}
    const token=surgeryApi?.start?.(flag,'module-import');
    try{
      const mod=await import(modPath);
      creators[name]=mod[name];
      surgeryApi?.done?.(token);
    }catch(error){
      surgeryApi?.fail?.(token,error);
      console.warn(`[Kelo Studio] optional ${name} unavailable; continuing`,error);
      creators[name]=null;
    }
    await wait();
  }
  const assetFavorites=trackedCreate('assetFavorites',creators.createStudioAssetFavorites,{root,paletteApi:assetPalette,getAssets},NOOP_ASSET_FAVORITES);
  await wait();
  const mk=(name,args,flag)=>trackedCreate(flag,creators[name],args,NOOP_CTRL);
  const assetKeyboardController=mk('createStudioAssetKeyboardController',{root,assetPalette},'assetKeyboard');
  await wait();
  const menuMinimizer=mk('createStudioMenuMinimizer',{root},'menuMinimizer');
  const cleanWorkspace=mk('createStudioCleanWorkspace',{root,kernel},'cleanWorkspace');
  await wait();
  const contextInspector=mk('createStudioContextInspector',{root,kernel,tools},'contextInspector');
  const contextSnapChip=mk('createStudioContextSnapChip',{root},'contextSnapChip');
  await wait();
  const multiAlign=mk('createStudioMultiAlign',{root,kernel},'multiAlign');
  const historyHints=mk('createStudioHistoryHints',{root,kernel},'historyHints');
  const transformPresets=mk('createStudioTransformPresets',{root,kernel},'transformPresets');
  await wait();
  const nudgeController=mk('createStudioNudgeController',{root,kernel},'nudge');
  const overlapCycleController=mk('createStudioOverlapCycleController',{root,kernel},'overlapCycle');
  await wait();
  const precisionSnapController=mk('createStudioPrecisionSnapController',{root},'precisionSnap');
  const selectionHistoryController=mk('createStudioSelectionHistoryController',{root,kernel},'selectionHistory');
  const focusShortcutController=mk('createStudioFocusShortcutController',{root},'focusShortcut');
  await wait();
  const quickActionsController=mk('createStudioQuickActionsController',{root,kernel,assetPalette},'quickActions');
  const keyboardDeleteController=mk('createStudioKeyboardDeleteController',{root,kernel},'keyboardDelete');
  const keyboardDuplicateController=mk('createStudioKeyboardDuplicateController',{root,kernel},'keyboardDuplicate');
  await wait();
  const keyboardHistoryController=mk('createStudioKeyboardHistoryController',{root},'keyboardHistory');
  const keyboardClipboardController=mk('createStudioKeyboardClipboardController',{root},'keyboardClipboard');
  const selectAllController=mk('createStudioSelectAllController',{root,kernel},'selectAll');
  await wait();
  const explorerRevealController=mk('createStudioExplorerRevealController',{root,kernel},'explorerReveal');
  const propertyCommitController=mk('createStudioPropertyCommitController',{root},'propertyCommit');
  const snapCycleController=mk('createStudioSnapCycleController',{root},'snapCycle');
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
  // WORLD SURGERY: install the tiny control plane before optional Studio modules execute.
  const {getWorldSurgery}=await import('./diagnostics/world-surgery-control.mjs');
  const surgery=getWorldSurgery({root});
  surgery.beginBoot(()=>({
    entities:session?.kernel?.document?.entities?.length||0,
    prefabs:session?.kernel?.prefabs?.list?.().length||0,
    assets:session?.adapter?.assetCatalog?.list?.().length||0
  }));
  const phoneBoot=isPhoneStudioBoot(root);
  let optionalToolsTimer=0,optionalPaletteTimer=0,extrasTimer=0,closed=false;
  const core=await loadStudioCore(root,phoneBoot);
  const {
    createStudioKernel,createWorldDocument,createKeloRuntimeAdapter,registerCoreTools,
    registerCoreToolsSerial,seedCatalogPrefabs,registerKeloComponents,importCurrentKeloWorld,createStudioAssetPreviewService,
    createStudioStore,createStudioProfiler,createWorldCompiler,createStudioOverlayRenderer,
    createStudioWorkerClient,createStudioPlacementTouchController,createStudioExplorerRangeSelectionController
  }=core;
  const adapter = createKeloRuntimeAdapter(root);
  const initial = document || createWorldDocument({ worldId: mode === 'parcel' ? `parcel:${actorId || 'local'}` : 'world:kelo-main', metadata: { name: mode === 'parcel' ? 'My Parcel' : 'Kelo World', description: '', tags: [mode] }, settings: { tileSize: root.KELO_TILE_REGISTRY?.worldTileSize || 32, chunkSize: root.KELO_WORLD_RENDERER?.chunkSize || 512 } });
  const kernel = createStudioKernel({ document: initial, adapter });
  registerKeloComponents(kernel.components);
  if(surgery.enabled('prefabSeeder')){
    const token=surgery.start('prefabSeeder','boot');
    seedCatalogPrefabs({ prefabRegistry: kernel.prefabs, assetCatalog: adapter.assetCatalog });
    surgery.done(token,{prefabs:kernel.prefabs.list?.().length||0});
  }else surgery.markStatus('prefabSeeder','DISABLED',{phase:'boot'});
  const {yieldStudioBoot}=await import('./integration/studio-boot-pace.mjs');
  const tools = phoneBoot && typeof registerCoreToolsSerial==='function'
    ? await registerCoreToolsSerial(kernel,{wait:async()=>{await yieldStudioBoot(root);await new Promise(r=>(root.setTimeout||setTimeout)(r,24));}})
    : registerCoreTools(kernel);
  const loadBasicTools=()=>{
    if(closed)return;
    if(!surgery.enabled('basicTools')){surgery.markStatus('basicTools','DISABLED',{phase:'deferred-import'});return;}
    const surgeryToken=surgery.start('basicTools','deferred-import');
    // A11 phone: never import register-basic-tools / register-build-tools barrels (static spikes).
    void (async()=>{
      try{
        if(phoneBoot){
          const pace=await import('./integration/studio-boot-pace.mjs');
          await pace.whenStudioIdle(root,{timeoutMs:800});
          await pace.pauseStudioBoot(root,48);
          if(closed)return;
          const mod=await import('./tools/register-build-tools-serial.mjs');
          if(closed||typeof mod.registerBuildToolsSerial!=='function')return;
          const wait=async()=>{await pace.whenStudioIdle(root,{timeoutMs:400});await pace.pauseStudioBoot(root,36);};
          Object.assign(tools,await mod.registerBuildToolsSerial(kernel,tools,{wait}));
        }else{
          const mod=await import('./tools/register-basic-tools.mjs');
          if(closed||typeof mod.registerBasicTools!=='function')return;
          Object.assign(tools,mod.registerBasicTools(kernel));
        }
        surgery.done(surgeryToken);
      }catch(error){
        surgery.fail(surgeryToken,error);
        console.warn('[Kelo Studio] optional build tools unavailable; World editor stays usable',error);
      }
    })();
  };
  optionalToolsTimer=deferStudioOptional(root,()=>{optionalToolsTimer=0;loadBasicTools();},phoneBoot?PHONE_OPTIONAL_BOOT_DELAY_MS:0);
  const assetPreview=surgery.enabled('assetPreview')
    ? createStudioAssetPreviewService({assetCatalog:adapter.assetCatalog,atlasContract:root.KELO_ATLAS_CONTRACT,devicePixelRatio:phoneBoot?1:(globalThis.devicePixelRatio||1)})
    : NOOP_ASSET_PREVIEW;
  surgery.markStatus('assetPreview',surgery.enabled('assetPreview')?'ACTIVE':'DISABLED',{phase:'boot'});
  const overlayRenderer = createStudioOverlayRenderer&&surgery.enabled('overlay')?createStudioOverlayRenderer({ kernel, tools, assetPreview }):{draw(){}};
  surgery.markStatus('overlay',createStudioOverlayRenderer&&surgery.enabled('overlay')?'ACTIVE':'DISABLED',{phase:'boot'});
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
    if(!surgery.enabled('assetPalette')){surgery.markStatus('assetPalette','DISABLED',{phase:'deferred-import'});return;}
    const paletteToken=surgery.start('assetPalette','deferred-import');
    void import('./ui/studio-asset-palette.mjs').then(paletteUi=>{
      if(closed||typeof paletteUi.createStudioAssetPalette!=='function')return;
      assetPalette=paletteUi.createStudioAssetPalette({root,getAssets:paletteAssets,renderAssetPreview:(canvas,asset)=>assetPreview.renderThumbnail(canvas,asset)});
      try{assetPalette.refresh();}catch{}
      surgery.done(paletteToken);
    }).catch(error=>{
      surgery.fail(paletteToken,error);
      console.warn('[Kelo Studio] optional asset palette unavailable; continuing without it',error);
    });
  };
  optionalPaletteTimer=deferStudioOptional(root,()=>{optionalPaletteTimer=0;loadAssetPalette();},phoneBoot?PHONE_PREVIEW_BOOT_DELAY_MS:0);
  const placementTouchController=surgery.enabled('placementTouch')?createStudioPlacementTouchController({root,placement:tools.placement}):NOOP_CTRL;
  surgery.markStatus('placementTouch',surgery.enabled('placementTouch')?'ACTIVE':'DISABLED',{phase:'boot'});
  // Explorer range is keyboard/desktop-heavy; keep a noop on phone until extras wave.
  let explorerRangeSelectionController=phoneBoot||!surgery.enabled('explorerRange')
    ? {destroy(){},refresh(){}}
    : createStudioExplorerRangeSelectionController({root,kernel});
  if(!surgery.enabled('explorerRange'))surgery.markStatus('explorerRange','DISABLED',{phase:'boot'});
  if(phoneBoot&&surgery.enabled('explorerRange')){
    deferStudioOptional(root,()=>{
      if(closed)return;
      void (async()=>{
        try{
          const pace=await import('./integration/studio-boot-pace.mjs');
          await pace.whenStudioIdle(root,{timeoutMs:600});
          await pace.pauseStudioBoot(root,40);
          if(closed)return;
          const mod=await import('./input/studio-explorer-range-selection-controller.mjs');
          if(closed||typeof mod.createStudioExplorerRangeSelectionController!=='function')return;
          explorerRangeSelectionController=mod.createStudioExplorerRangeSelectionController({root,kernel});
        }catch{}
      })();
    },PHONE_PRODUCTIVITY_BOOT_DELAY_MS);
  }
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
  const worker = createStudioWorkerClient&&surgery.enabled('worker')?createStudioWorkerClient({ resolvePrefab, prefabSnapshot: () => Object.fromEntries(kernel.prefabs.list().map(p => [p.id, kernel.prefabs.resolve(p.id)])) }):{compile:(doc,options)=>Promise.resolve(compiler.compile(doc,options)),close(){},get active(){return false;}};
  surgery.markStatus('worker',createStudioWorkerClient&&surgery.enabled('worker')?'ACTIVE':'DISABLED',{phase:'boot'});
  const store = surgery.enabled('storage')?createStudioStore():NOOP_STORE, profiler = createStudioProfiler();
  surgery.markStatus('storage',surgery.enabled('storage')?'ACTIVE':'DISABLED',{phase:'boot'});
  const unsubscribeJournal = kernel.commands.on(event => { store.appendCommand(kernel.document.worldId, { action: event.type, command: event.command }).catch(() => {}); });
  session = Object.freeze({ version: 'kelo-studio-foundation-v1.36.0-world-bridge-a11', mode, actorId, kernel, tools, overlayRenderer, assetPreview,
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
    async importCurrent(options={}) {
      if(!surgery.enabled('currentWorldImporter')){surgery.markStatus('currentWorldImporter','DISABLED',{phase:'import.current'});return kernel.document;}
      const token=surgery.start('currentWorldImporter','import.current');
      try{
        const next=await profiler.measure('import.current',()=>importCurrentKeloWorld({adapter,mode,actorId,...options}));
        kernel.setDocument(next);
        if(surgery.enabled('prefabSeeder'))seedCatalogPrefabs({prefabRegistry:kernel.prefabs,assetCatalog:adapter.assetCatalog});
        try{assetPalette.refresh();assetFavorites.refresh();multiAlign.refresh();historyHints.refresh();}catch{}
        surgery.done(token,{entities:next?.entities?.length||0});
        return next;
      }catch(error){surgery.fail(token,error);throw error;}
    },
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
    if(!surgery.enabled('productivityExtras')){surgery.markStatus('productivityExtras','DISABLED',{phase:'deferred-import'});return;}
    const extrasToken=surgery.start('productivityExtras','deferred-import');
    void (async()=>{
      try{
        if(phoneBoot){
          const {whenStudioIdle,pauseStudioBoot}=await import('./integration/studio-boot-pace.mjs');
          await whenStudioIdle(root,{timeoutMs:700});
          await pauseStudioBoot(root,48);
          if(closed)return;
        }
        const next=await installStudioProductivityExtras({root,kernel,tools,assetPalette,getAssets:paletteAssets,phone:phoneBoot});
        applyStudioExtras(next);
        surgery.done(extrasToken);
      }catch(error){
        surgery.fail(extrasToken,error);
        console.warn('[Kelo Studio] optional productivity extras unavailable; World editor stays usable',error);
      }
    })();
  }, phoneBoot?PHONE_PRODUCTIVITY_BOOT_DELAY_MS:0);
  return session;
}
export function getKeloStudioSession(){return session;}
if(typeof window!=='undefined')window.KELO_STUDIO_LAZY_BOOT=bootKeloStudio;
