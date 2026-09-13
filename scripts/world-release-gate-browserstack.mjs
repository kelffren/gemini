/* KELO-INDEX
 * area: CI / WORLD RELEASE GATE / REAL IOS
 * purpose: bisect which pre-shell Studio side effect makes physical iPhone Safari stall
 */
import { webkit } from 'playwright';

const required=['BROWSERSTACK_USERNAME','BROWSERSTACK_ACCESS_KEY','KELO_PAGES'];
for(const key of required)if(!process.env[key])throw new Error(`Missing ${key}`);
const localIdentifier=process.env.BROWSERSTACK_LOCAL_IDENTIFIER||'';
const isLocal=process.env.KELO_RELEASE_STAGE==='PR_CANDIDATE_REAL_IPHONE';
if(isLocal&&!localIdentifier)throw new Error('Missing BROWSERSTACK_LOCAL_IDENTIFIER');
const caps={browserName:'safari',osVersion:'26',deviceName:'iPhone 14 Pro',realMobile:'true',name:`KELO World shell bisect ${(process.env.KELO_CANDIDATE_SHA||'').slice(0,12)}`,build:process.env.BROWSERSTACK_BUILD_NAME||'KeloWorld-shell-bisect',project:process.env.BROWSERSTACK_PROJECT_NAME||'KeloWorld','browserstack.username':process.env.BROWSERSTACK_USERNAME,'browserstack.accessKey':process.env.BROWSERSTACK_ACCESS_KEY,'browserstack.local':isLocal?'true':'false'};
if(isLocal)caps['browserstack.localIdentifier']=localIdentifier;
const wsEndpoint=`wss://cdp.browserstack.com/playwright?caps=${encodeURIComponent(JSON.stringify(caps))}`;
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const log=(name,detail=null)=>console.log(`[KELO bisect] ${name}${detail?`: ${JSON.stringify(detail)}`:''}`);
let browser,context,page;
async function wait(check,timeout=15000){const end=Date.now()+timeout;while(Date.now()<end){if(await check())return true;await delay(250);}throw new Error('wait timeout');}
async function phase(name,fn){log(`${name}:start`);const started=Date.now();const result=await page.evaluate(fn);log(`${name}:ready`,{ms:Date.now()-started,...(result||{})});return result;}

async function shellProbe(name){
  return phase(name,async()=>{
    const g=window.__KELO_BISECT,t=performance.now();
    const {createStudioLiveShell}=await import('./src/studio/ui/studio-live-shell.mjs');
    const assets=g.studio.adapter.assetCatalog.list()||[];
    const shell=createStudioLiveShell({host:document.body,assets,onMode:()=>{},onAsset:()=>{},onUndo:()=>{},onRedo:()=>{},onRotate:()=>{},onScale:()=>{},onErase:()=>{},onSave:()=>{},onClose:()=>{},onSelectEntity:()=>{},onDuplicate:()=>{},onDelete:()=>{},onPropertyChange:()=>{},onPlay:()=>{},onBrushSize:()=>{},onFocus:()=>{},renderAssetPreview:()=>false});
    const mounted=!!document.getElementById('kelo-studio-live');
    shell.destroy();
    return{innerMs:Math.round(performance.now()-t),mounted};
  });
}

try{
  browser=await webkit.connect({wsEndpoint});log('connected');
  context=await browser.newContext({baseURL:process.env.KELO_PAGES});page=await context.newPage();
  page.on('pageerror',err=>console.log(`[pageerror] ${String(err)}`));
  const response=await page.goto('./?mapEditor=1&world-ios-reopen=1',{waitUntil:'domcontentloaded',timeout:30000});log('page',{status:response?.status()});
  await wait(()=>page.evaluate(()=>!!(window.KeloInputLocks?.acquire&&window.KELO_ADMIN_KEYS?.can?.('world.edit')&&window.KELO_WORLD_EDIT?.ready)),20000);log('authorized');

  await phase('boot-import',async()=>{
    const {bootKeloStudio}=await import('./src/studio/studio-entry.mjs');
    const actorId=String(window.KELO_ADMIN_KEYS?.playerId?.()||'local_pioneer'),studio=await bootKeloStudio({mode:'world',actorId,root:window}),E=window.KELO_WORLD_EDIT;
    let res=await E.getCurrentDraft(),draft=res?.draft;if(!draft||!['DRAFT','REJECTED'].includes(String(draft.status||''))){res=await E.request('world:draft:create',{actorId,forceNew:true});draft=res?.draft;}else{res=await E.request('world:draft:get',{actorId,draftId:draft.draftId});draft=res?.draft||draft;}
    await studio.importCurrent({view:'draft',draftId:draft.draftId});window.__KELO_BISECT={studio,actorId,draft};return{assets:studio.adapter.assetCatalog.list().length};
  });
  await shellProbe('shell-baseline');

  await phase('input-lock',async()=>{const g=window.__KELO_BISECT;g.inputToken=window.KeloInputLocks.acquire('kelo-studio-bisect',{kind:'creator-session',draftId:g.draft.draftId});return{token:!!g.inputToken};});
  await shellProbe('shell-after-input-lock');

  await phase('overlay',async()=>{const g=window.__KELO_BISECT;const {createStudioOverlayCanvas}=await import('./src/studio/render/studio-overlay-canvas.mjs');g.overlay=createStudioOverlayCanvas({host:document.body});return{w:g.overlay.canvas.width,h:g.overlay.canvas.height};});
  await shellProbe('shell-after-overlay');

  await phase('camera',async()=>{const g=window.__KELO_BISECT;const {createStudioCameraController}=await import('./src/studio/input/studio-camera-controller.mjs');g.camera=createStudioCameraController({root:window,isUi:()=>false,onNavigateStart:()=>{},onPinchStart:()=>false,onPinchMove:()=>{},onPinchEnd:()=>{}});return{zoom:g.camera.zoom};});
  await shellProbe('shell-after-camera');

  await phase('input-router',async()=>{const g=window.__KELO_BISECT,handlers={pointerdown:()=>false,pointermove:()=>false,pointerup:()=>false,pointercancel:()=>false};g.unregister=g.studio.kernel.input.register('studio-bisect',handlers,1000);g.studio.kernel.input.push('studio-bisect');const {attachStudioPointerInput}=await import('./src/studio/input/pointer-input-adapter.mjs');g.detach=attachStudioPointerInput({element:document,router:g.studio.kernel.input,toWorld:(x,y)=>g.camera.toWorld(x,y),capture:true,stopPropagation:true,shouldHandle:()=>false});return{ok:true};});
  await shellProbe('shell-after-input-router');

  await phase('cleanup',async()=>{const g=window.__KELO_BISECT;try{g.detach?.();}catch{}try{g.studio.kernel.input.pop('studio-bisect');}catch{}try{g.unregister?.();}catch{}try{g.camera?.destroy?.();}catch{}try{g.overlay?.destroy?.();}catch{}try{window.KeloInputLocks.release(g.inputToken);}catch{}return{ok:true};});
  console.log('VERIFIED SHELL BISECT: all pre-shell side effects remained responsive');
}finally{await context?.close().catch(()=>{});await browser?.close().catch(()=>{});}
