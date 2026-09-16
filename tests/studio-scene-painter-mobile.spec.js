/* KELO-INDEX
 * area: TEST / STUDIO / SCENE PAINTER MOBILE
 * owner: Kelo Studio Paint Copies regression gate
 * purpose: exercise the real mobile World boot and Scene Painter Grid/Undo path
 * do-not: Chromium phone emulation is not physical iPhone/Safari evidence
 */
const { test, expect, devices } = require('@playwright/test');
const fs = require('fs');
const iphone = devices['iPhone 13'];
const BASE_URL = process.env.KELO_PAGES || 'http://127.0.0.1:4173/';
const WORLD_BRIDGE_BUILD = 'world-bridge-20260915-22';

test.use({baseURL:BASE_URL,userAgent:iphone.userAgent,viewport:{width:390,height:844},screen:{width:390,height:844},deviceScaleFactor:iphone.deviceScaleFactor,isMobile:true,hasTouch:true});

test('Scene Painter survives mobile lazy boot, Grid 3x2, one Undo and shell mutation stress', async ({page})=>{
  test.setTimeout(150000);
  fs.mkdirSync('test-results',{recursive:true});
  const pageErrors=[],consoleErrors=[];
  page.on('pageerror',e=>pageErrors.push(String(e?.stack||e)));
  page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});
  await page.addInitScript(()=>{try{localStorage.setItem('kelo.worldSurgery.config.v1',JSON.stringify({basicTools:true,paintCopies:true}));}catch{}});

  const response=await page.goto('./?guest=1&mapEditor=1&scenePainterGate=1',{waitUntil:'domcontentloaded',timeout:30000});
  expect(response&&response.status()).toBeLessThan(400);
  let hub=page.locator('#kelo-creators-hub').last();
  if(!await hub.isVisible({timeout:3500}).catch(()=>false)){
    await page.evaluate(async()=>{const {openCreatorHub}=await import('./src/creators/ui/creator-hub.mjs');await openCreatorHub({root:window});});
    hub=page.locator('#kelo-creators-hub').last();
  }
  await expect(hub).toBeVisible({timeout:10000});
  await page.waitForFunction(()=>!!window.KELO_ADMIN_KEYS?.can?.('world.edit'),null,{timeout:10000});

  // Install the reader BEFORE launch. This imports the exact same stable bridge URL
  // that World Workspace uses, so the test observes that module instance rather than
  // an unversioned duplicate with its own null controller cache.
  await page.evaluate(build=>{
    window.__keloScenePainterGateStudio=async()=>{
      for(const tag of [build,`${build}-retry`]){
        try{const mod=await import(`./src/studio/integration/world-studio-bridge.mjs?v=${tag}`);const s=mod.getKeloStudioLive?.()?.studio;if(s)return s;}catch{}
      }
      return null;
    };
  },WORLD_BRIDGE_BUILD);

  await hub.locator('[data-workspace="world"]').click();
  const studio=page.locator('#kelo-studio-live');
  await expect(studio).toBeVisible({timeout:20000});

  const ready=await page.waitForFunction(async()=>{
    const s=await window.__keloScenePainterGateStudio?.();
    return !!(s?.tools?.paintCopies&&window.KELO_WORLD_SURGERY?.enabled?.('paintCopies'));
  },null,{timeout:45000,polling:250}).then(()=>true).catch(()=>false);
  if(!ready){
    const diag=await page.evaluate(async()=>{
      const shell=document.getElementById('kelo-studio-live');
      const s=await window.__keloScenePainterGateStudio?.();
      const storage={};
      try{for(let i=0;i<sessionStorage.length;i++){const k=sessionStorage.key(i);if(/BUG-0003|bug|world|studio/i.test(k||''))storage[k]=sessionStorage.getItem(k);}}catch{}
      return {
        shell:{exists:!!shell,loading:shell?.dataset?.keloWorldLoading||null,interactive:shell?.dataset?.keloStudioInteractive||null,status:shell?.querySelector?.('.ks-status')?.textContent||null},
        worldEdit:{exists:!!window.KELO_WORLD_EDIT,ready:!!window.KELO_WORLD_EDIT?.ready,hasWhenReady:typeof window.KELO_WORLD_EDIT?.whenReady==='function'},
        launchAborted:!!window.KELO_WORLD_LAUNCH_ABORTED,
        surgery:{basicTools:window.KELO_WORLD_SURGERY?.enabled?.('basicTools'),paintCopies:window.KELO_WORLD_SURGERY?.enabled?.('paintCopies')},
        session:{exists:!!s,toolLoaded:!!s?.tools?.paintCopies},
        resources:(performance.getEntriesByType?.('resource')||[]).map(x=>String(x.name||'')).filter(x=>/world-studio-bridge|live-studio-controller|studio-boot-pace|world-edit-authority|world-draft-store|world-revision-system|studio-live-shell/.test(x)),
        storage
      };
    });
    throw new Error(`SCENE_PAINTER_WORLD_BOOT_NOT_READY ${JSON.stringify(diag)}`);
  }
  await expect(studio).not.toHaveAttribute('data-kelo-world-loading','1',{timeout:5000});

  const sourceState=await page.evaluate(async()=>{
    const {createPlaceEntityCommand}=await import('./src/studio/document/document-commands.mjs');
    const s=await window.__keloScenePainterGateStudio?.();if(!s)throw new Error('SCENE_PAINTER_LIVE_STUDIO_SESSION_MISSING');
    const id='test:scene-painter-source';
    if(!s.kernel.document.entities.some(e=>String(e.id)===id))await s.kernel.execute(createPlaceEntityCommand({id,prefabId:'test-scene-source',transform:{x:128,y:128,rotation:0,scale:1},bounds:{w:32,h:32}}));
    s.kernel.selection.set(id);
    return {entityCount:s.kernel.document.entities.length,undoDepth:s.kernel.history.undoDepth,toolLoaded:!!s.tools.paintCopies};
  });
  expect(sourceState.toolLoaded).toBe(true);

  const button=studio.locator('[data-ext-paint-copies]');
  await expect(button).toHaveCount(1,{timeout:65000});await expect(button).toBeEnabled();await button.click();
  const panel=studio.locator('.ks-scene-painter');await expect(panel).toBeVisible({timeout:5000});await panel.locator('[data-pattern="grid"]').click();
  for(const [key,value] of [['columns','3'],['rows','2']]){const input=panel.locator(`[data-setting="${key}"]`);await input.fill(value);await input.dispatchEvent('change');}
  await panel.locator('[data-ksp="toggle"]').click();await expect(button).toHaveClass(/on/);

  const batch=await page.evaluate(async()=>{
    const s=await window.__keloScenePainterGateStudio?.();const tool=s.tools.paintCopies;
    const before={entities:s.kernel.document.entities.length,undoDepth:s.kernel.history.undoDepth};
    tool.beginAt(320,320,{snap:1});const preview=tool.getPreviews();const commit=await tool.commit();
    return {pattern:tool.state().pattern,previewCount:preview.length,committed:commit.rows.length,before,after:{entities:s.kernel.document.entities.length,undoDepth:s.kernel.history.undoDepth}};
  });
  expect(batch.pattern).toBe('grid');expect(batch.previewCount).toBe(6);expect(batch.committed).toBe(6);expect(batch.after.entities-batch.before.entities).toBe(6);expect(batch.after.undoDepth-batch.before.undoDepth).toBe(1);

  const undo=await page.evaluate(async expected=>{const s=await window.__keloScenePainterGateStudio?.();await s.kernel.undo();return {entities:s.kernel.document.entities.length,buttons:document.querySelectorAll('#kelo-studio-live [data-ext-paint-copies]').length,panels:document.querySelectorAll('#kelo-studio-live .ks-scene-painter').length,expected};},sourceState.entityCount);
  expect(undo.entities).toBe(sourceState.entityCount);expect(undo.buttons).toBe(1);expect(undo.panels).toBe(1);

  const stress=await page.evaluate(async()=>{const shell=document.getElementById('kelo-studio-live'),started=performance.now();for(let i=0;i<400;i++){const n=document.createElement('i');n.dataset.paintCopiesStress=String(i);shell.appendChild(n);n.remove();}await new Promise(r=>requestAnimationFrame(r));return {ms:performance.now()-started,buttons:shell.querySelectorAll('[data-ext-paint-copies]').length,panels:shell.querySelectorAll('.ks-scene-painter').length};});
  expect(stress.ms).toBeLessThan(1500);expect(stress.buttons).toBe(1);expect(stress.panels).toBe(1);

  await page.waitForTimeout(5000);const ping=Date.now();const alive=await page.evaluate(async()=>{const s=await window.__keloScenePainterGateStudio?.();return {studio:!!document.getElementById('kelo-studio-live'),toolLoaded:!!s?.tools?.paintCopies,pattern:s?.tools?.paintCopies?.state?.().pattern||null,buttonCount:document.querySelectorAll('#kelo-studio-live [data-ext-paint-copies]').length};});
  expect(Date.now()-ping).toBeLessThanOrEqual(400);expect(alive).toEqual({studio:true,toolLoaded:true,pattern:'grid',buttonCount:1});expect(pageErrors).toEqual([]);expect(consoleErrors.filter(x=>/STUDIO_PAINT_COPIES|CREATOR_WORLD_STUDIO_MOUNT_FAILED|WORLD_EDIT_NOT_READY/.test(x))).toEqual([]);
  await page.screenshot({path:'test-results/studio-scene-painter-mobile-pass.png',fullPage:true});
});
