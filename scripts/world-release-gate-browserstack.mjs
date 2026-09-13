/* KELO-INDEX
 * area: CI / WORLD RELEASE GATE / REAL IOS
 * purpose: isolate the exact Studio phase that blocks physical iPhone Safari
 */
import { webkit } from 'playwright';

const required=['BROWSERSTACK_USERNAME','BROWSERSTACK_ACCESS_KEY','KELO_PAGES'];
for(const key of required)if(!process.env[key])throw new Error(`Missing ${key}`);
const localIdentifier=process.env.BROWSERSTACK_LOCAL_IDENTIFIER||'';
const isLocal=process.env.KELO_RELEASE_STAGE==='PR_CANDIDATE_REAL_IPHONE';
if(isLocal&&!localIdentifier)throw new Error('Missing BROWSERSTACK_LOCAL_IDENTIFIER');
const caps={browserName:'safari',osVersion:'26',deviceName:'iPhone 14 Pro',realMobile:'true',name:`KELO World phase probe ${(process.env.KELO_CANDIDATE_SHA||'').slice(0,12)}`,build:process.env.BROWSERSTACK_BUILD_NAME||'KeloWorld-phase-probe',project:process.env.BROWSERSTACK_PROJECT_NAME||'KeloWorld','browserstack.username':process.env.BROWSERSTACK_USERNAME,'browserstack.accessKey':process.env.BROWSERSTACK_ACCESS_KEY,'browserstack.local':isLocal?'true':'false'};
if(isLocal)caps['browserstack.localIdentifier']=localIdentifier;
const wsEndpoint=`wss://cdp.browserstack.com/playwright?caps=${encodeURIComponent(JSON.stringify(caps))}`;
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const log=(name,detail=null)=>console.log(`[KELO phase] ${name}${detail?`: ${JSON.stringify(detail)}`:''}`);

let browser,context,page;
async function wait(check,timeout=15000){const end=Date.now()+timeout;while(Date.now()<end){if(await check())return true;await delay(250);}throw new Error('phase wait timeout');}
async function phase(name,fn){log(`${name}:start`);const started=Date.now();const result=await page.evaluate(fn);log(`${name}:ready`,{ms:Date.now()-started,...(result||{})});return result;}

try{
  browser=await webkit.connect({wsEndpoint});log('connected');
  context=await browser.newContext({baseURL:process.env.KELO_PAGES});page=await context.newPage();
  page.on('console',msg=>{const t=msg.text();if(t.includes('[Kelo World open]')||t.includes('[Kelo Studio]'))console.log(`[browser] ${t}`);});
  page.on('pageerror',err=>console.log(`[pageerror] ${String(err)}`));
  const response=await page.goto('./?mapEditor=1&world-ios-reopen=1',{waitUntil:'domcontentloaded',timeout:30000});
  log('page',{status:response?.status()});
  await wait(()=>page.evaluate(()=>!!(window.KeloInputLocks?.acquire&&window.KELO_ADMIN_KEYS?.can?.('world.edit')&&window.KELO_WORLD_EDIT?.ready)),20000);
  log('authorized');

  await phase('legacy-close',async()=>{const t=performance.now();try{await window.KELO_WORLD_BUILDER_UI?.close?.(false);}catch(e){}return{innerMs:Math.round(performance.now()-t)};});

  await phase('boot-studio',async()=>{const t=performance.now();const {bootKeloStudio}=await import('./src/studio/studio-entry.mjs');const actorId=String(window.KELO_ADMIN_KEYS?.playerId?.()||'local_pioneer');const studio=await bootKeloStudio({mode:'world',actorId,root:window});window.__KELO_PHASE={studio,actorId};return{innerMs:Math.round(performance.now()-t),assets:studio.adapter.assetCatalog.list().length};});

  await phase('ensure-draft',async()=>{const g=window.__KELO_PHASE,E=window.KELO_WORLD_EDIT;let res=await E.getCurrentDraft(),d=res?.draft;if(!d||!['DRAFT','REJECTED'].includes(String(d.status||''))){res=await E.request('world:draft:create',{actorId:g.actorId,forceNew:true});d=res?.draft;}else{res=await E.request('world:draft:get',{actorId:g.actorId,draftId:d.draftId});d=res?.draft||d;}g.draft=d;return{draftId:d?.draftId||null};});

  await phase('import-draft',async()=>{const g=window.__KELO_PHASE,t=performance.now();await g.studio.importCurrent({view:'draft',draftId:g.draft.draftId});return{innerMs:Math.round(performance.now()-t),entities:g.studio.kernel.document.entities.length};});

  await phase('prefab-library',async()=>{const g=window.__KELO_PHASE,t=performance.now();const {createCreatorPrefabLibrary}=await import('./src/studio/prefabs/creator-prefab-library.mjs');g.prefabLibrary=createCreatorPrefabLibrary({kernel:g.studio.kernel,store:g.studio.store,tool:g.studio.tools.prefabStamp,ownerId:g.actorId});await g.prefabLibrary.load();return{innerMs:Math.round(performance.now()-t),prefabs:g.prefabLibrary.assets().length};});

  await phase('creator-actions',async()=>{const g=window.__KELO_PHASE;const {createCreatorActions}=await import('./src/studio/tools/creator-actions.mjs');g.creator=createCreatorActions(g.studio.kernel);return{ok:true};});

  await phase('authority-mirror',async()=>{const g=window.__KELO_PHASE;const {installStudioAuthorityMirror}=await import('./src/studio/integration/authority-command-mirror.mjs');g.mirror=installStudioAuthorityMirror({adapter:g.studio.adapter,actorId:g.actorId,getDraftId:()=>g.draft.draftId});for(const e of g.studio.kernel.document.entities)g.mirror.seed(e.id,e.source?.authorityPlacementId||e.id);for(const c of Object.values(g.studio.kernel.document.navigation?.collisions||{}))g.mirror.seedCollision(c.collisionId,c.collisionId);return{ok:true};});

  await phase('input-lock',async()=>{const g=window.__KELO_PHASE;g.inputToken=window.KeloInputLocks.acquire('kelo-studio-phase',{kind:'creator-session',draftId:g.draft.draftId});return{token:!!g.inputToken};});

  await phase('overlay',async()=>{const g=window.__KELO_PHASE,t=performance.now();const {createStudioOverlayCanvas}=await import('./src/studio/render/studio-overlay-canvas.mjs');g.overlay=createStudioOverlayCanvas({host:document.body});return{innerMs:Math.round(performance.now()-t),w:g.overlay.canvas.width,h:g.overlay.canvas.height};});

  await phase('camera',async()=>{const g=window.__KELO_PHASE,t=performance.now();const {createStudioCameraController}=await import('./src/studio/input/studio-camera-controller.mjs');g.camera=createStudioCameraController({root:window,isUi:()=>false,onNavigateStart:()=>{},onPinchStart:()=>false,onPinchMove:()=>{},onPinchEnd:()=>{}});return{innerMs:Math.round(performance.now()-t),zoom:g.camera.zoom};});

  await phase('input-router',async()=>{const g=window.__KELO_PHASE;const handlers={pointerdown:()=>false,pointermove:()=>false,pointerup:()=>false,pointercancel:()=>false};g.unregister=g.studio.kernel.input.register('studio-phase',handlers,1000);g.studio.kernel.input.push('studio-phase');const {attachStudioPointerInput}=await import('./src/studio/input/pointer-input-adapter.mjs');g.detach=attachStudioPointerInput({element:document,router:g.studio.kernel.input,toWorld:(x,y)=>g.camera.toWorld(x,y),capture:true,stopPropagation:true,shouldHandle:()=>false});return{ok:true};});

  await phase('shell-real-preview',async()=>{const g=window.__KELO_PHASE,t=performance.now();const {createStudioLiveShell}=await import('./src/studio/ui/studio-live-shell.mjs');const assets=[...(g.studio.adapter.assetCatalog.list()||[]),...(g.prefabLibrary.assets()||[])];g.shell=createStudioLiveShell({host:document.body,assets,onMode:()=>{},onAsset:()=>{},onUndo:()=>{},onRedo:()=>{},onRotate:()=>{},onScale:()=>{},onErase:()=>{},onSave:()=>{},onClose:()=>{},onSelectEntity:()=>{},onDuplicate:()=>{},onDelete:()=>{},onPropertyChange:()=>{},onPlay:()=>{},onBrushSize:()=>{},onFocus:()=>{},renderAssetPreview:(canvas,asset)=>g.studio.assetPreview.renderThumbnail(canvas,asset)});return{innerMs:Math.round(performance.now()-t),mounted:!!document.getElementById('kelo-studio-live'),assets:assets.length};});

  await phase('productivity',async()=>{const g=window.__KELO_PHASE,t=performance.now();const {createCreatorProductivityPanel}=await import('./src/studio/ui/creator-productivity-panel.mjs');g.productivity=createCreatorProductivityPanel({shell:g.shell,onCopy:()=>0,onPaste:()=>{},onSavePrefab:()=>{},onValidate:()=>({ok:true}),onSnapChange:()=>{},onGridToggle:()=>{},onCameraToggle:()=>false,onZoomIn:()=>1,onZoomOut:()=>1,onZoomReset:()=>1});g.productivity.setSnap(32);return{innerMs:Math.round(performance.now()-t)};});

  await phase('shell-update',async()=>{const g=window.__KELO_PHASE,t=performance.now();g.shell.setHistory({canUndo:g.studio.kernel.history.canUndo,canRedo:g.studio.kernel.history.canRedo});g.shell.setScene({entities:g.studio.kernel.document.entities,selection:g.studio.kernel.selection.get()});g.shell.setStatus(`SELECT · ${g.studio.kernel.document.entities.length} objects`);return{innerMs:Math.round(performance.now()-t)};});

  await phase('first-draw',async()=>{const g=window.__KELO_PHASE,t=performance.now();const {createCreatorGridOverlay}=await import('./src/studio/render/creator-grid-overlay.mjs');g.grid=createCreatorGridOverlay({size:32,visible:true});g.overlay.resize();g.overlay.clear();const ctx=g.overlay.ctx,w=g.overlay.canvas.clientWidth||innerWidth||1,h=g.overlay.canvas.clientHeight||innerHeight||1,z=g.camera.effectiveZoom||1,c=window.camera||{x:0,y:0};ctx.save();ctx.translate(w/2,h/2);ctx.scale(z,z);ctx.translate(-c.x,-c.y);g.grid.draw(ctx,{camera:c,viewWidth:w,viewHeight:h,zoom:z});g.studio.overlayRenderer.draw(ctx);ctx.restore();return{innerMs:Math.round(performance.now()-t),w,h,z};});

  await phase('raf-loop-start',async()=>{const g=window.__KELO_PHASE;g.rafCount=0;const tick=()=>{g.rafCount++;g.overlay.resize();g.overlay.clear();if(g.rafCount<120)requestAnimationFrame(tick);};requestAnimationFrame(tick);return{scheduled:true};});
  await delay(2500);
  const rafCount=await page.evaluate(()=>window.__KELO_PHASE?.rafCount||0);log('raf-loop-responsive',{rafCount});
  if(rafCount<2)throw new Error(`RAF_STALLED:${rafCount}`);

  await phase('cleanup',async()=>{const g=window.__KELO_PHASE;try{g.detach?.();}catch{}try{g.studio.kernel.input.pop('studio-phase');}catch{}try{g.unregister?.();}catch{}try{g.camera?.destroy?.();}catch{}try{g.productivity?.destroy?.();}catch{}try{g.shell?.destroy?.();}catch{}try{g.overlay?.destroy?.();}catch{}try{g.mirror?.uninstall?.();}catch{}try{window.KeloInputLocks.release(g.inputToken);}catch{}return{ok:true};});
  console.log('VERIFIED PHASE PROBE: every Studio open phase stayed responsive on real iPhone');
}finally{
  await context?.close().catch(()=>{});await browser?.close().catch(()=>{});
}
