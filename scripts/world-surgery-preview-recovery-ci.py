from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"PATCH_TARGET_MISSING:{label}")
    return text.replace(old, new, 1)


# Runtime candidate: keep the phone boot light, but restore real catalog rows and a tiny ghost overlay.
p = Path('src/studio/integration/live-studio-controller.mjs')
s = p.read_text()

replacements = [
    (
        "overlayMod={createStudioOverlayCanvas:()=>({canvas:null,ctx:null,resize:()=>({}),clear(){},destroy(){},dpr:1})};\n    gridMod={createCreatorGridOverlay:()=>({draw(){},configure(){}})};",
        "overlayMod=await import('../render/studio-overlay-canvas.mjs');await wait();abortIfNeeded();\n    gridMod={createCreatorGridOverlay:()=>({draw(){},configure(){}})};",
        'mobile-overlay-import',
    ),
    (
        "const baseAssets=studio.adapter.assetCatalog.list()||[],allAssets=()=>[...baseAssets,...prefabLibrary.assets()];",
        "const allAssets=()=>[...(studio.adapter.assetCatalog.list()||[]),...prefabLibrary.assets()];",
        'dynamic-catalog',
    ),
    (
        "components:{visual:{source:'phone-seed',parts:[]}},\n        dependencies:[]",
        "components:{visual:{source:'phone-seed',parts:Array.isArray(asset.parts)?asset.parts:[]}},\n        dependencies:[...new Set((asset.parts||[]).map(part=>part.assetKey).filter(Boolean))]",
        'phone-prefab-visual-parts',
    ),
    (
        "function beginPlacement(assetId){if(playing)return;try{cameraController?.setPanMode(false);studio.tools.terrain.cancel();studio.tools.collision.setVisible(false);studio.tools.placement.cancel();studio.tools.prefabStamp.cancel();if(prefabLibrary.get(assetId)){studio.tools.prefabStamp.start(assetId);mode='prefab';}else{studio.tools.placement.start(assetId);studio.assetPreview.warmAsset(assetId).catch(()=>{});mode='placement';}updateShell();}catch(e){toast(root,e.message);}}",
        "function beginPlacement(assetId){if(playing)return;try{cameraController?.setPanMode(false);studio.tools.terrain.cancel();studio.tools.collision.setVisible(false);studio.tools.placement.cancel();studio.tools.prefabStamp.cancel();const liveAsset=studio.adapter.assetCatalog.get(assetId);if(liveAsset)ensurePhonePlacementPrefabs(studio,[liveAsset]);if(prefabLibrary.get(assetId)){studio.tools.prefabStamp.start(assetId);mode='prefab';}else{studio.tools.placement.start(assetId);studio.assetPreview.warmAsset(assetId).catch(()=>{});mode='placement';}updateShell();}catch(e){toast(root,e.message);}}",
        'late-asset-on-demand-prefab',
    ),
    (
        "if(!running||shell.root.dataset.keloAssetsReady==='1')return;\n        shell.root.dataset.keloAssetsReady='1';\n        try{\n          phonePreview?.reset?.();\n          const list=allAssets();\n          ensurePhonePlacementPrefabs(studio,list.slice(0,80));\n          shell.setAssets(list);",
        "if(!running||shell.root.dataset.keloAssetsReady==='1')return;\n        try{\n          const list=allAssets();\n          if(!list.length)return;\n          shell.root.dataset.keloAssetsReady='1';\n          phonePreview?.reset?.();\n          shell.setAssets(list);",
        'full-assets-live-catalog',
    ),
    (
        "const n=(allAssets()||[]).length;\n        if(n>4)paintSeed('refresh',{openSheet:true});",
        "const n=(allAssets()||[]).length;\n        if(n>0)loadFullAssets();",
        'full-assets-after-catalog-ready',
    ),
    (
        "if(phoneOverlay||surgery?.enabled?.('overlay')===false||typeof createStudioOverlayCanvas!=='function'){surgery?.markStatus?.('overlay','DISABLED',{phase:'live-overlay'});return;}",
        "if(surgery?.enabled?.('overlay')===false||typeof createStudioOverlayCanvas!=='function'){surgery?.markStatus?.('overlay','DISABLED',{phase:'live-overlay'});return;}",
        'allow-mobile-overlay',
    ),
    (
        "studio.overlayRenderer.draw(ctx);\n        ctx.restore();",
        "studio.overlayRenderer.draw(ctx);\n        if(phoneOverlay){const preview=studio.tools.placement.getPreview?.();if(preview)studio.assetPreview.drawAsset(ctx,preview.prefabId,Number(preview.transform?.x)||0,Number(preview.transform?.y)||0,{rotation:Number(preview.transform?.rotation)||0,alpha:.82,placeholder:true});}\n        ctx.restore();",
        'draw-mobile-placement-ghost',
    ),
    (
        "if(phoneOverlay){\n        try{shell?.setStatus?.(`${mode.toUpperCase()} · listo · coloca assets`);}catch{}\n        updateShell();\n        return;\n      }",
        "if(phoneOverlay){\n        try{shell?.setStatus?.(`${mode.toUpperCase()} · listo · coloca assets`);}catch{}\n        updateShell();\n        startStudioOverlayDraw();\n        return;\n      }",
        'start-mobile-overlay',
    ),
]

for old, new, label in replacements:
    s = replace_once(s, old, new, label)
p.write_text(s)


# Playwright candidate: test the real mobile flow and the Studio document, not stale status text.
p = Path('scripts/world-surgery-functional-smoke.mjs')
s = p.read_text()

s = replace_once(
    s,
    'await page.locator(`#kelo-studio-live [data-asset="${tree.id.replaceAll(\'"\',\'\\\\"\')}"]`).first().tap();',
    'await page.locator(`#kelo-studio-live [data-asset="${tree.id.replaceAll(\'"\',\'\\\\"\')}"]:visible`).first().tap();',
    'visible-tree-row',
)
s = replace_once(
    s,
    'await canvas.tap({position:point});',
    "await page.getByRole('button',{name:/COLOCAR AQUÍ/i}).tap();",
    'place-here-button',
)
s = replace_once(
    s,
    "const live=()=>page.locator('#kelo-studio-live');",
    "const live=()=>page.locator('#kelo-studio-live');\nconst studioEntityCount=()=>page.evaluate(async()=>{const m=await import('./src/studio/studio-entry.mjs?v=world-bridge-20260915-22');return Number(m.getKeloStudioSession?.()?.kernel?.document?.entities?.length||0);});",
    'session-count-helper',
)
s = replace_once(
    s,
    "  await page.waitForSelector('#kelo-studio-live [data-pane=\"assets\"] [data-asset]',{state:'visible',timeout:15000});\n  await page.waitForTimeout(700);",
    "  await page.waitForSelector('#kelo-studio-live [data-pane=\"assets\"] [data-asset]',{state:'visible',timeout:15000});\n  await page.waitForFunction(()=>document.getElementById('kelo-studio-live')?.dataset?.keloAssetsReady==='1',{timeout:12000}).catch(()=>{});\n  await page.waitForTimeout(1200);",
    'wait-full-assets',
)
s = replace_once(
    s,
    "  report.steps.assetPreviews.compactPreview=compactPreview;\n  if(!compactPreview.present||!compactPreview.ink)fail(`ACTIVE_TREE_PREVIEW_EMPTY:${JSON.stringify(compactPreview)}`);\n  return tree;",
    "  report.steps.assetPreviews.compactPreview=compactPreview;\n  if(!compactPreview.present||!compactPreview.ink)fail(`ACTIVE_TREE_PREVIEW_EMPTY:${JSON.stringify(compactPreview)}`);\n  await page.waitForTimeout(700);\n  const catalog=await page.evaluate(()=>({total:Number(window.KELO_PROPERTY_CATALOG?.list?.()?.length||0),visibleRows:[...document.querySelectorAll('#kelo-studio-live [data-pane=\\\"assets\\\"] [data-asset]')].filter(el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0;}).length,ready:document.getElementById('kelo-studio-live')?.dataset?.keloAssetsReady||''}));\n  report.steps.assetPreviews.catalog=catalog;\n  const ghost=await page.evaluate(()=>{const c=document.querySelector('canvas.kelo-studio-overlay');if(!c)return {present:false,alphaPixels:0};let alphaPixels=0;try{const d=c.getContext('2d')?.getImageData(0,0,c.width,c.height)?.data||[];for(let i=3;i<d.length;i+=4)if(d[i]>12)alphaPixels++;}catch{}return {present:true,width:c.width,height:c.height,alphaPixels};});\n  report.steps.assetPreviews.ghost=ghost;\n  await shot('02-tree-ghost');\n  if(catalog.total>4&&catalog.ready!=='1')fail(`FULL_ASSET_CATALOG_NOT_READY:${JSON.stringify(catalog)}`);\n  if(!ghost.present||ghost.alphaPixels<20)fail(`TREE_WORLD_GHOST_EMPTY:${JSON.stringify(ghost)}`);\n  return tree;",
    'ghost-and-catalog-proof',
)
s = replace_once(
    s,
    "  await page.waitForFunction(previous=>{\n    const status=document.querySelector('#kelo-studio-live .ks-status')?.textContent||'';\n    return Number(status.match(/(\\d+)\\s+objects?/i)?.[1]||0)>previous;\n  },beforeObjects,{timeout:15000});\n  const status=await live().locator('.ks-status').textContent();\n  const afterObjects=objectCountFromStatus(status);",
    "  await page.waitForFunction(async previous=>{const m=await import('./src/studio/studio-entry.mjs?v=world-bridge-20260915-22');return Number(m.getKeloStudioSession?.()?.kernel?.document?.entities?.length||0)>previous;},beforeObjects,{timeout:15000});\n  const status=await live().locator('.ks-status').textContent();\n  const afterObjects=await studioEntityCount();",
    'real-entity-count',
)
s = replace_once(
    s,
    'const placed=await placeTree(tree,mounted.objects);',
    'const placed=await placeTree(tree,await studioEntityCount());',
    'real-before-count',
)
p.write_text(s)

print('WORLD_SURGERY_PREVIEW_RECOVERY_PATCHED')
