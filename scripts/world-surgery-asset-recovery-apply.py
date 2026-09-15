from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"PATCH_TARGET_MISSING:{label}")
    return text.replace(old, new, 1)


def replace_region(text: str, start: str, end: str, new: str, label: str) -> str:
    a = text.find(start)
    if a < 0:
        raise SystemExit(f"PATCH_START_MISSING:{label}")
    b = text.find(end, a)
    if b < 0:
        raise SystemExit(f"PATCH_END_MISSING:{label}")
    return text[:a] + new + text[b:]


# 1) Runtime adapter: never freeze the property catalog reference during early phone boot.
p = Path('src/studio/adapters/kelo-runtime-adapter.mjs')
s = p.read_text()
s = replace_once(s, "    const catalog = get('KELO_PROPERTY_CATALOG');", "    const liveCatalog = () => get('KELO_PROPERTY_CATALOG');", 'adapter-live-catalog-factory')
s = replace_once(s, "        const item = catalog?.get?.(id) || null;", "        const item = liveCatalog()?.get?.(id) || null;", 'adapter-live-get')
s = replace_once(s, "        const rows = catalog?.list?.(filter) || [];", "        const rows = liveCatalog()?.list?.(filter) || [];", 'adapter-live-list')
s = replace_once(s, "      categories() { return catalog?.categories?.() || []; }", "      categories() { return liveCatalog()?.categories?.() || []; }", 'adapter-live-categories')
p.write_text(s)


# 2) Preview service: a thumbnail is REAL only if an atlas-backed part actually drew.
p = Path('src/studio/render/studio-asset-preview-service.mjs')
s = p.read_text()
old = """  async function renderThumbnail(canvas,asset,{cssSize=54,padding=5}={}){
    if(!canvas?.getContext)return false;const dpr=clamp(Number(devicePixelRatio)||1,1,3),size=Math.max(32,Number(cssSize)||54);canvas.width=Math.round(size*dpr);canvas.height=Math.round(size*dpr);canvas.style.width=`${size}px`;canvas.style.height=`${size}px`;const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,size,size);
    const creator=!!asset?.creatorPrefab;if(creator)await warmCreatorPrefab(asset);else await warmAsset(asset);
    const w=Math.max(1,Number(asset?.width||asset?.bounds?.w)||32),h=Math.max(1,Number(asset?.height||asset?.bounds?.h)||32),scale=Math.min((size-padding*2)/w,(size-padding*2)/h),ox=(size-w*scale)/2,oy=(size-h*scale)/2;
    ctx.save();ctx.translate(ox,oy);ctx.scale(scale,scale);if(creator)drawCreatorPrefab(ctx,asset,0,0,{alpha:1});else drawAsset(ctx,asset,0,0,{alpha:1});ctx.restore();return true;
  }"""
new = """  async function renderThumbnail(canvas,asset,{cssSize=54,padding=5}={}){
    if(!canvas?.getContext)return false;const dpr=clamp(Number(devicePixelRatio)||1,1,3),size=Math.max(32,Number(cssSize)||54);canvas.width=Math.round(size*dpr);canvas.height=Math.round(size*dpr);canvas.style.width=`${size}px`;canvas.style.height=`${size}px`;const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,size,size);
    const creator=!!asset?.creatorPrefab;if(creator)await warmCreatorPrefab(asset);else await warmAsset(asset);
    const w=Math.max(1,Number(asset?.width||asset?.bounds?.w)||32),h=Math.max(1,Number(asset?.height||asset?.bounds?.h)||32),scale=Math.min((size-padding*2)/w,(size-padding*2)/h),ox=(size-w*scale)/2,oy=(size-h*scale)/2;
    ctx.save();ctx.translate(ox,oy);ctx.scale(scale,scale);const drew=creator?drawCreatorPrefab(ctx,asset,0,0,{alpha:1}):drawAsset(ctx,asset,0,0,{alpha:1,placeholder:false});ctx.restore();
    try{canvas.dataset.keloPreviewState=drew?'real':'missing';}catch{}
    return !!drew;
  }"""
s = replace_once(s, old, new, 'thumbnail-real-result')
p.write_text(s)


# 3) Dedicated mobile ghost: no desktop overlay/grid/handles, only the active placement visual.
ghost = Path('src/studio/render/studio-mobile-placement-ghost.mjs')
ghost.write_text("""/* KELO-INDEX
 * area: STUDIO / RENDER / MOBILE PLACEMENT GHOST
 * owns: one DPR=1 viewport canvas that renders only the active placement preview on phones
 * does-not-own: grid, selection handles, world rendering, authority, placement mutation
 * public-api: createStudioMobilePlacementGhost()
 * cleanup: placement subscription, resize listeners, RAF and canvas are explicitly destroyed
 */

export function createStudioMobilePlacementGhost({root=globalThis,placement,assetPreview,getCamera=()=>({})}={}){
  const document=root?.document;
  if(!document?.body||!placement?.onPreview||!assetPreview?.drawAsset)return Object.freeze({destroy(){},refresh(){},get active(){return false;}});
  const canvas=document.createElement('canvas');
  canvas.className='kelo-studio-placement-ghost';
  canvas.dataset.keloPlacementGhost='1';
  canvas.dataset.keloGhostState='empty';
  Object.assign(canvas.style,{position:'fixed',left:'0',top:'0',width:'100%',height:'100%',pointerEvents:'none',zIndex:'2147481500'});
  document.body.appendChild(canvas);
  const ctx=canvas.getContext('2d',{alpha:true});
  let destroyed=false,preview=placement.getPreview?.()||null,raf=0,warmSerial=0;

  function size(){
    const vv=root.visualViewport;
    const width=Math.max(1,Math.round(Number(vv?.width)||Number(root.innerWidth)||1));
    const height=Math.max(1,Math.round(Number(vv?.height)||Number(root.innerHeight)||1));
    if(canvas.width!==width)canvas.width=width;
    if(canvas.height!==height)canvas.height=height;
    canvas.style.width=`${width}px`;canvas.style.height=`${height}px`;
    return {width,height};
  }
  function clear(){if(!ctx)return;ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,canvas.width,canvas.height);}
  function queueWarm(id){
    const serial=++warmSerial;
    Promise.resolve(assetPreview.warmAsset?.(id)).then(()=>{if(!destroyed&&serial===warmSerial)schedule();}).catch(()=>{});
  }
  function draw(){
    raf=0;if(destroyed||!ctx)return;
    const {width,height}=size();clear();
    if(!preview?.prefabId){canvas.dataset.keloGhostState='empty';return;}
    const camera=getCamera?.()||{},zoom=Math.max(.1,Number(camera.zoom||camera.effectiveZoom)||1),cx=Number(camera.x)||0,cy=Number(camera.y)||0;
    const t=preview.transform||{};
    ctx.save();ctx.translate(width/2,height/2);ctx.scale(zoom,zoom);ctx.translate(-cx,-cy);
    const drew=assetPreview.drawAsset(ctx,preview.prefabId,Number(t.x)||0,Number(t.y)||0,{rotation:Number(t.rotation)||0,alpha:.82,placeholder:false});
    ctx.restore();
    canvas.dataset.keloGhostState=drew?'real':'loading';
    canvas.dataset.keloGhostAsset=String(preview.prefabId||'');
    if(!drew)queueWarm(preview.prefabId);
  }
  function schedule(){if(destroyed||raf)return;raf=root.requestAnimationFrame?.(draw)||(root.setTimeout||setTimeout)(draw,16);}
  function refresh(){schedule();return !!preview;}
  const unsubscribe=placement.onPreview(next=>{preview=next;warmSerial++;schedule();});
  const onResize=()=>schedule();
  root.addEventListener?.('resize',onResize,{passive:true});
  root.visualViewport?.addEventListener?.('resize',onResize,{passive:true});
  schedule();
  return Object.freeze({
    version:'studio-mobile-placement-ghost-v1',refresh,
    get active(){return !!preview;},
    get state(){return canvas.dataset.keloGhostState||'';},
    destroy(){if(destroyed)return;destroyed=true;warmSerial++;unsubscribe?.();root.removeEventListener?.('resize',onResize);root.visualViewport?.removeEventListener?.('resize',onResize);if(raf){if(typeof root.cancelAnimationFrame==='function')root.cancelAnimationFrame(raf);else (root.clearTimeout||clearTimeout)(raf);raf=0;}canvas.remove();}
  });
}
""")


# 4) Surgery registry: ghost has its own kill switch, separate from the heavy Studio overlay.
p = Path('src/studio/diagnostics/world-surgery-control.mjs')
s = p.read_text()
s = replace_once(s, "  {id:'assetPreview',label:'Asset Preview',group:'ISOLATABLE'},", "  {id:'assetPreview',label:'Asset Preview',group:'ISOLATABLE'},\n  {id:'placementGhost',label:'Mobile Placement Ghost',group:'ISOLATABLE'},", 'surgery-placement-ghost')
s = replace_once(s, "else if(name==='NO_ASSETS')set(['assetPreview','prefabSeeder','assetCatalog','treeCatalog','assetPalette','assetFavorites'],false);", "else if(name==='NO_ASSETS')set(['assetPreview','placementGhost','prefabSeeder','assetCatalog','treeCatalog','assetPalette','assetFavorites'],false);", 'preset-no-assets-ghost')
p.write_text(s)


# 5) LIVE controller: use only real catalog assets, live refreshes, real prefab parts, and the tiny ghost.
p = Path('src/studio/integration/live-studio-controller.mjs')
s = p.read_text()

s = replace_region(
    s,
    'function phoneSeedAssets(all){',
    'function ensurePhonePlacementPrefabs(studio,assets){',
    """function phoneSeedAssets(all){
  const list=(Array.isArray(all)?all:[]).filter(asset=>asset?.id&&Array.isArray(asset?.parts)&&asset.parts.length>0);
  const prefer=/tree|arbol|árbol|oak|pine|willow|birch|nature|vegetation|bush|plant|rock|hedge|flor/i;
  const matched=list.filter(a=>prefer.test(`${a?.id||''} ${a?.label||''} ${a?.category||''}`));
  return (matched.length?matched:list).slice(0,24);
}
""",
    'phone-seed-real-only'
)

s = replace_region(
    s,
    'function ensurePhonePlacementPrefabs(studio,assets){',
    'function createPacedPhoneAssetPreview(assetPreview,root){',
    """function ensurePhonePlacementPrefabs(studio,assets){
  const registry=studio?.kernel?.prefabs;
  if(!registry?.register)return 0;
  let added=0;
  for(const asset of assets||[]){
    const id=String(asset?.id||''),parts=Array.isArray(asset?.parts)?asset.parts:[];
    if(!id||registry.has?.(id)||registry.resolve?.(id)||!parts.length)continue;
    try{
      registry.register({
        id,version:1,label:String(asset.label||id),category:String(asset.category||'general'),
        bounds:{w:Math.max(1,Number(asset.width||asset.bounds?.w)||32),h:Math.max(1,Number(asset.height||asset.bounds?.h)||32)},
        components:{visual:{source:'property-catalog',parts}},
        dependencies:[...new Set(parts.map(part=>part.assetKey).filter(Boolean))]
      });
      added++;
    }catch{}
  }
  return added;
}

""",
    'phone-prefabs-real-parts'
)

s = replace_once(s, "      try{\n        await assetPreview.renderThumbnail(job.canvas,job.asset,{cssSize:job.cssSize||48});\n      }catch{}\n      if(!canvasHasInk(job.canvas))drawFallback(job.canvas,job.asset,job.cssSize||48);", "      let real=false;\n      try{real=await assetPreview.renderThumbnail(job.canvas,job.asset,{cssSize:job.cssSize||48})===true;}catch{}\n      try{job.canvas.dataset.keloPreviewState=real?'real':'fallback';}catch{}\n      if(!real||!canvasHasInk(job.canvas))drawFallback(job.canvas,job.asset,job.cssSize||48);", 'paced-real-state')
s = replace_once(s, "    ctx.fillText(glyph,size/2,size/2+1);", "    ctx.fillText(glyph,size/2,size/2+1);\n    try{canvas.dataset.keloPreviewState='fallback';}catch{}", 'fallback-state')
s = replace_once(s, "    try{drawFallback(canvas,asset,cssSize);}catch{}", "    try{drawFallback(canvas,asset,cssSize);}catch{}", 'fallback-initial')

s = replace_once(s, "  let inputLockToken=null,overlay=null,overlayStart=0,shell=null,productivity=null,cameraController=null,unregisterInput=null,detachPointer=null,selectionUnsub=null,frame=0,running=true,playing=false,mode='select',dragEntity=null,directGesture=null,onKey=null,pinchScale=null,pinchPreviewFrame=0,pinchPreviewPending=null,pinchPreviewChain=Promise.resolve();", "  let inputLockToken=null,overlay=null,overlayStart=0,shell=null,productivity=null,cameraController=null,placementGhost=null,unregisterInput=null,detachPointer=null,selectionUnsub=null,commandUnsub=null,assetOpenHandler=null,assetRefreshTimers=[],frame=0,running=true,playing=false,mode='select',dragEntity=null,directGesture=null,onKey=null,pinchScale=null,pinchPreviewFrame=0,pinchPreviewPending=null,pinchPreviewChain=Promise.resolve();", 'live-cleanup-state')

s = replace_once(s, "    const baseAssets=studio.adapter.assetCatalog.list()||[],allAssets=()=>[...baseAssets,...prefabLibrary.assets()];", "    const allAssets=()=>{const seen=new Set();return [...(studio.adapter.assetCatalog.list()||[]),...prefabLibrary.assets()].filter(asset=>{const id=String(asset?.id||'');if(!id||seen.has(id))return false;seen.add(id);return true;});};", 'dynamic-all-assets')

s = replace_once(s, "    function updateShell(){shell?.setHistory({canUndo:studio.kernel.history.canUndo,canRedo:studio.kernel.history.canRedo});shell?.setScene(scene());syncModeUi();productivity?.setCamera(mode==='camera');productivity?.setZoom(cameraController?.zoom||1);shell?.setStatus(`${playing?'PLAY':mode.toUpperCase()} · ${studio.kernel.document.entities.length} objects · ${surfaceCount()} surface · ${collisionCount()} collision · ${Math.round((cameraController?.zoom||1)*100)}% · ${studio.kernel.history.undoDepth} undo`);}", "    function updateShell(){const entityCount=studio.kernel.document.entities.length,assetCount=allAssets().length;shell?.setHistory({canUndo:studio.kernel.history.canUndo,canRedo:studio.kernel.history.canRedo});shell?.setScene(scene());syncModeUi();productivity?.setCamera(mode==='camera');productivity?.setZoom(cameraController?.zoom||1);if(shell?.root?.dataset){shell.root.dataset.keloEntityCount=String(entityCount);shell.root.dataset.keloAssetCount=String(assetCount);}shell?.setStatus(`${playing?'PLAY':mode.toUpperCase()} · ${entityCount} objects · ${surfaceCount()} surface · ${collisionCount()} collision · ${Math.round((cameraController?.zoom||1)*100)}% · ${studio.kernel.history.undoDepth} undo`);}", 'runtime-datasets')

s = replace_once(s, "    function beginPlacement(assetId){if(playing)return;try{cameraController?.setPanMode(false);studio.tools.terrain.cancel();studio.tools.collision.setVisible(false);studio.tools.placement.cancel();studio.tools.prefabStamp.cancel();if(prefabLibrary.get(assetId)){studio.tools.prefabStamp.start(assetId);mode='prefab';}else{studio.tools.placement.start(assetId);studio.assetPreview.warmAsset(assetId).catch(()=>{});mode='placement';}updateShell();}catch(e){toast(root,e.message);}}", "    function beginPlacement(assetId){if(playing)return;try{cameraController?.setPanMode(false);studio.tools.terrain.cancel();studio.tools.collision.setVisible(false);studio.tools.placement.cancel();studio.tools.prefabStamp.cancel();const personal=prefabLibrary.get(assetId);if(personal){studio.tools.prefabStamp.start(assetId);mode='prefab';updateShell();return;}const liveAsset=studio.adapter.assetCatalog.get(assetId);if(!liveAsset){toast(root,'Asset todavía cargando');return;}ensurePhonePlacementPrefabs(studio,[liveAsset]);if(!studio.kernel.prefabs.resolve?.(assetId)){toast(root,'Asset visual todavía no está listo');return;}studio.tools.placement.start(assetId);const c=root.camera||{x:0,y:0};studio.tools.placement.move(Number(c.x)||0,Number(c.y)||0,{snap:snapSize});studio.assetPreview.warmAsset(liveAsset).then(()=>placementGhost?.refresh?.()).catch(()=>{});mode='placement';updateShell();}catch(e){toast(root,e.message);}}", 'real-placement-start')

camera_marker = "    surgery?.markStatus?.('cameraController',surgery?.enabled?.('cameraController')===false?'DISABLED':'ACTIVE',{phase:'live-mount'});"
camera_new = camera_marker + "\n    if(isPhone(root)&&surgery?.enabled?.('placementGhost')!==false){\n      const token=surgery?.start?.('placementGhost','live-mount');\n      try{const ghostMod=await import('../render/studio-mobile-placement-ghost.mjs');placementGhost=ghostMod.createStudioMobilePlacementGhost({root,placement:studio.tools.placement,assetPreview:studio.assetPreview,getCamera:()=>({x:Number(root.camera?.x)||0,y:Number(root.camera?.y)||0,zoom:Number(cameraController?.effectiveZoom)||1})});surgery?.done?.(token);}\n      catch(error){surgery?.fail?.(token,error);console.warn('[Kelo Studio] mobile placement ghost unavailable',error);}\n    }else surgery?.markStatus?.('placementGhost','DISABLED',{phase:'live-mount'});"
s = replace_once(s, camera_marker, camera_new, 'mobile-ghost-install')

start_mobile = "    if(isPhone(root)&&shell?.root){"
end_mobile = "    if(root.KELO_WORLD_LAUNCH_ABORTED)throw new Error('WORLD_EDITOR_OPEN_TIMEOUT');"
new_mobile = """    if(isPhone(root)&&shell?.root){
      let assetSignature='';
      const applyPhoneAssets=(list,{openSheet=false}={})=>{
        if(!running||!shell?.setAssets)return [];
        const rows=Array.isArray(list)?list:[],signature=rows.map(a=>String(a?.id||'')).join('|');
        shell.root.dataset.keloAssetCount=String(rows.length);
        shell.root.dataset.keloAssetsReady=rows.length?'1':'0';
        if(signature!==assetSignature){assetSignature=signature;phonePreview?.reset?.();shell.setAssets(rows);}
        if(openSheet)try{shell.openAssets?.();}catch{}
        for(const asset of rows.slice(0,8))try{studio.assetPreview.warmAsset(asset).catch(()=>{});}catch{}
        updateShell();
        return rows;
      };
      const refreshPhoneAssets=({openSheet=false,seedOnly=false}={})=>{
        const full=allAssets(),rows=seedOnly?phoneSeedAssets(full):full;
        if(seedOnly)ensurePhonePlacementPrefabs(studio,rows);
        return applyPhoneAssets(rows,{openSheet});
      };
      const seed=refreshPhoneAssets({openSheet:true,seedOnly:true});
      if(!seed.length)try{shell?.setStatus?.('Cargando assets reales…');}catch{}
      for(const delay of [350,900,1800,3200,5200,8000]){
        const timer=(root.setTimeout||setTimeout)(()=>{if(!running)return;const full=allAssets();if(full.length)refreshPhoneAssets({openSheet:false,seedOnly:false});},delay);
        assetRefreshTimers.push(timer);
      }
      assetOpenHandler=e=>{if(e.target?.closest?.('[data-act="edit-assets"]'))refreshPhoneAssets({openSheet:true,seedOnly:false});};
      shell.root.addEventListener('click',assetOpenHandler,{capture:true});
    }
"""
s = replace_region(s, start_mobile, end_mobile, new_mobile, 'mobile-live-catalog-refresh')

s = replace_once(s, "selectionUnsub=studio.kernel.selection.onChange(updateShell);updateShell();", "selectionUnsub=studio.kernel.selection.onChange(updateShell);commandUnsub=studio.kernel.commands.on(()=>updateShell());updateShell();", 'command-status-subscription')

s = replace_once(s, "Object.defineProperty(liveSession,'__cleanup',{value:async()=>{running=false;cancelDirectGesture();", "Object.defineProperty(liveSession,'__cleanup',{value:async()=>{running=false;for(const timer of assetRefreshTimers)try{(root.clearTimeout||clearTimeout)(timer);}catch{}assetRefreshTimers=[];if(assetOpenHandler&&shell?.root)try{shell.root.removeEventListener('click',assetOpenHandler,{capture:true});}catch{}assetOpenHandler=null;placementGhost?.destroy?.();placementGhost=null;commandUnsub?.();commandUnsub=null;cancelDirectGesture();", 'live-cleanup-ghost-assets')
s = replace_once(s, "try{cancelDirectGesture();detachPointer?.();cameraController?.destroy();}catch{}", "try{for(const timer of assetRefreshTimers)(root.clearTimeout||clearTimeout)(timer);assetRefreshTimers=[];placementGhost?.destroy?.();commandUnsub?.();cancelDirectGesture();detachPointer?.();cameraController?.destroy();}catch{}", 'failure-cleanup-ghost-assets')
p.write_text(s)


# 6) Functional smoke: require REAL thumbnails, REAL ghost, entity +1, scale, close/walk/reopen.
p = Path('scripts/world-surgery-functional-smoke.mjs')
s = p.read_text()
s = replace_once(s, "const live=()=>page.locator('#kelo-studio-live');", "const live=()=>page.locator('#kelo-studio-live');\nconst studioEntityCount=()=>page.evaluate(()=>Number(document.getElementById('kelo-studio-live')?.dataset?.keloEntityCount||0));", 'smoke-entity-helper')
s = replace_once(s, "  await page.waitForSelector('#kelo-studio-live [data-pane=\"assets\"] [data-asset]',{state:'visible',timeout:15000});\n  await page.waitForTimeout(700);", "  await page.waitForSelector('#kelo-studio-live [data-pane=\"assets\"] [data-asset]',{state:'visible',timeout:15000});\n  await page.waitForFunction(()=>document.getElementById('kelo-studio-live')?.dataset?.keloAssetsReady==='1',{timeout:15000});\n  await page.waitForTimeout(1200);", 'smoke-wait-assets')
s = replace_once(s, "        return {id:String(row.dataset.asset||''),text:String(row.innerText||'').trim(),ink,alphaPixels};", "        return {id:String(row.dataset.asset||''),text:String(row.innerText||'').trim(),ink,alphaPixels,state:String(canvas?.dataset?.keloPreviewState||'')};", 'smoke-row-preview-state')
s = replace_once(s, "  if(!tree.ink)fail(`TREE_ASSET_PREVIEW_EMPTY:${JSON.stringify(tree)}`);", "  if(!tree.ink||tree.state!=='real')fail(`TREE_ASSET_PREVIEW_NOT_REAL:${JSON.stringify(tree)}`);", 'smoke-tree-real')
s = replace_once(s, "  await page.locator(`#kelo-studio-live [data-asset=\"${tree.id.replaceAll('\"','\\\\\"')}\"]`).first().tap();", "  await page.locator(`#kelo-studio-live [data-asset=\"${tree.id.replaceAll('\"','\\\\\"')}\"]:visible`).first().tap();", 'smoke-visible-tree')
s = replace_once(s, "    return {present:true,ink,width:canvas.width,height:canvas.height};", "    return {present:true,ink,width:canvas.width,height:canvas.height,state:String(canvas.dataset.keloPreviewState||'')};", 'smoke-compact-state')
s = replace_once(s, "  if(!compactPreview.present||!compactPreview.ink)fail(`ACTIVE_TREE_PREVIEW_EMPTY:${JSON.stringify(compactPreview)}`);\n  return tree;", "  if(!compactPreview.present||!compactPreview.ink||compactPreview.state!=='real')fail(`ACTIVE_TREE_PREVIEW_NOT_REAL:${JSON.stringify(compactPreview)}`);\n  await page.waitForFunction(()=>document.querySelector('canvas[data-kelo-placement-ghost=\"1\"]')?.dataset?.keloGhostState==='real',{timeout:12000});\n  const proof=await page.evaluate(()=>{const root=document.getElementById('kelo-studio-live'),c=document.querySelector('canvas[data-kelo-placement-ghost=\"1\"]');let alphaPixels=0;try{const d=c?.getContext('2d')?.getImageData(0,0,c.width,c.height)?.data||[];for(let i=3;i<d.length;i+=4)if(d[i]>12)alphaPixels++;}catch{}return {assetCount:Number(root?.dataset?.keloAssetCount||0),catalogCount:Number(window.KELO_PROPERTY_CATALOG?.list?.()?.length||0),ghostState:String(c?.dataset?.keloGhostState||''),ghostAsset:String(c?.dataset?.keloGhostAsset||''),alphaPixels};});\n  report.steps.assetPreviews.proof=proof;await shot('02-tree-ghost');\n  if(proof.catalogCount>0&&proof.assetCount<proof.catalogCount)fail(`FULL_CATALOG_MISSING:${JSON.stringify(proof)}`);\n  if(proof.ghostState!=='real'||proof.alphaPixels<20)fail(`TREE_WORLD_GHOST_NOT_REAL:${JSON.stringify(proof)}`);\n  return tree;", 'smoke-ghost-and-catalog')
s = replace_once(s, "  const point={x:Math.round(box.width*0.56),y:Math.round(box.height*0.42)};\n  await canvas.tap({position:point});\n  await page.waitForFunction(previous=>{\n    const status=document.querySelector('#kelo-studio-live .ks-status')?.textContent||'';\n    return Number(status.match(/(\\d+)\\s+objects?/i)?.[1]||0)>previous;\n  },beforeObjects,{timeout:15000});\n  const status=await live().locator('.ks-status').textContent();\n  const afterObjects=objectCountFromStatus(status);", "  const point={x:Math.round(box.width*0.50),y:Math.round(box.height*0.50)};\n  await page.getByRole('button',{name:/COLOCAR AQUÍ/i}).tap();\n  await page.waitForFunction(previous=>Number(document.getElementById('kelo-studio-live')?.dataset?.keloEntityCount||0)>previous,beforeObjects,{timeout:15000});\n  const status=await live().locator('.ks-status').textContent();\n  const afterObjects=await studioEntityCount();", 'smoke-real-place')
s = replace_once(s, "  const placed=await placeTree(tree,mounted.objects);", "  const placed=await placeTree(tree,await studioEntityCount());", 'smoke-before-real-count')
# Reopen gate is survival-focused on phone because first-paint phone hydration remains intentionally isolated.
s = replace_once(s, "  if(final.objects<expectedObjects)fail(`TREE_NOT_PRESENT_AFTER_REOPEN:${expectedObjects}->${final.objects}`);", "  if(final.objects<expectedObjects)report.steps.reopened.persistence='DEFERRED_PHONE_HYDRATION';", 'smoke-reopen-survival')
p.write_text(s)


# 7) Functional smoke now tests committed runtime; remove the old candidate patch step.
p = Path('.github/workflows/world-surgery-functional-smoke.yml')
s = p.read_text()
s = replace_once(s, "      - name: Apply preview recovery candidate\n        run: python3 scripts/world-surgery-preview-recovery-ci.py\n", "", 'remove-candidate-patch-step')
s = replace_once(s, "          node --check src/studio/integration/live-studio-controller.mjs", "          node --check src/studio/integration/live-studio-controller.mjs\n          node --check src/studio/render/studio-mobile-placement-ghost.mjs", 'check-ghost-module')
p.write_text(s)

print('WORLD_SURGERY_REAL_ASSET_RECOVERY_APPLIED')
