/* KELO-INDEX
 * area: TEST / STUDIO / SCENE PAINTER MOBILE
 * owner: Kelo Studio Paint Copies regression gate
 * purpose: real mobile World boot -> Scene Painter Grid 3x2 -> one Undo -> DOM stress
 * do-not: Chromium phone emulation is not physical iPhone/Safari evidence
 */
const {test,expect,devices}=require('@playwright/test');
const fs=require('fs');
const iphone=devices['iPhone 13'];
const BASE_URL=process.env.KELO_PAGES||'http://127.0.0.1:4173/';
const WORLD_BUILD='world-bridge-20260915-22';
test.use({baseURL:BASE_URL,userAgent:iphone.userAgent,viewport:{width:390,height:844},screen:{width:390,height:844},deviceScaleFactor:iphone.deviceScaleFactor,isMobile:true,hasTouch:true});

test('Scene Painter survives mobile lazy boot, Grid 3x2, one Undo and shell mutation stress',async({page})=>{
  test.setTimeout(150000);fs.mkdirSync('test-results',{recursive:true});
  const pageErrors=[],consoleErrors=[];page.on('pageerror',e=>pageErrors.push(String(e?.stack||e)));page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});
  await page.addInitScript(()=>{try{localStorage.setItem('kelo.worldSurgery.config.v1',JSON.stringify({basicTools:true,paintCopies:true}));}catch{}});
  const response=await page.goto('./?guest=1&mapEditor=1&scenePainterGate=1',{waitUntil:'domcontentloaded',timeout:30000});expect(response&&response.status()).toBeLessThan(400);
  let hub=page.locator('#kelo-creators-hub').last();if(!await hub.isVisible({timeout:3500}).catch(()=>false)){await page.evaluate(async()=>{const {openCreatorHub}=await import('./src/creators/ui/creator-hub.mjs');await openCreatorHub({root:window});});hub=page.locator('#kelo-creators-hub').last();}
  await expect(hub).toBeVisible({timeout:10000});await page.waitForFunction(()=>!!window.KELO_ADMIN_KEYS?.can?.('world.edit'),null,{timeout:10000});
  await page.evaluate(build=>{
    window.__scenePainterStudio=async()=>{
      for(const tag of [build,`${build}-retry`]){
        try{
          const mod=await import(`./src/studio/integration/world-studio-bridge.mjs?v=${tag}`);
          const live=mod.getKeloStudioLive?.();
          if(live?.studio){window.__scenePainterLastTag=tag;window.__scenePainterLastSeen=Date.now();return live.studio;}
        }catch(error){(window.__scenePainterBridgeErrors??=[]).push(`${tag}:${error?.message||error}`);}
      }
      return null;
    };
    window.__scenePainterDiag=async()=>{
      const tags=[];
      for(const tag of [build,`${build}-retry`]){
        try{const mod=await import(`./src/studio/integration/world-studio-bridge.mjs?v=${tag}`),live=mod.getKeloStudioLive?.();tags.push({tag,live:!!live,studio:!!live?.studio,tool:!!live?.studio?.tools?.paintCopies});}
        catch(error){tags.push({tag,error:String(error?.message||error)});}
      }
      const shell=document.getElementById('kelo-studio-live'),hub=document.getElementById('kelo-creators-hub'),storage={};
      try{for(let i=0;i<sessionStorage.length;i++){const key=sessionStorage.key(i);if(/BUG-0003|world-open|studio/i.test(key||''))storage[key]=sessionStorage.getItem(key);}}catch{}
      return {lastTag:window.__scenePainterLastTag||null,lastSeen:window.__scenePainterLastSeen||null,bridgeErrors:window.__scenePainterBridgeErrors||[],tags,launchAborted:!!window.KELO_WORLD_LAUNCH_ABORTED,worldEditReady:!!window.KELO_WORLD_EDIT?.ready,shell:{exists:!!shell,connected:!!shell?.isConnected,loading:shell?.dataset?.keloWorldLoading||null,interactive:shell?.dataset?.keloStudioInteractive||null,status:shell?.querySelector?.('.ks-status')?.textContent||null,top:!!shell?.querySelector?.('.ks-top'),bottom:!!shell?.querySelector?.('.ks-bottom')},hub:{exists:!!hub,display:hub?.style?.display||null,launch:hub?.dataset?.keloWorldLaunch||null},bodyClass:document.body.className,resources:(performance.getEntriesByType?.('resource')||[]).map(x=>String(x.name||'')).filter(x=>/world-studio-bridge|live-studio-controller|world-workspace|studio-entry/.test(x)),storage};
    };
  },WORLD_BUILD);
  await hub.locator('[data-workspace="world"]').click();const shell=page.locator('#kelo-studio-live');await expect(shell).toBeVisible({timeout:20000});
  await expect.poll(async()=>page.evaluate(async()=>{const s=await window.__scenePainterStudio?.();return !!(s?.tools?.paintCopies&&window.KELO_WORLD_SURGERY?.enabled?.('paintCopies'));}),{timeout:60000,intervals:[250,250,500,500,1000]}).toBe(true);

  const source=await page.evaluate(async()=>{const {createPlaceEntityCommand}=await import('./src/studio/document/document-commands.mjs');const s=await window.__scenePainterStudio();if(!s){const diag=await window.__scenePainterDiag?.();throw new Error(`SCENE_PAINTER_SESSION_MISSING ${JSON.stringify(diag)}`);}const id='test:scene-painter-source';if(!s.kernel.document.entities.some(e=>String(e.id)===id))await s.kernel.execute(createPlaceEntityCommand({id,prefabId:'test-scene-source',transform:{x:128,y:128,rotation:0,scale:1},bounds:{w:32,h:32}}));s.kernel.selection.set(id);return{entities:s.kernel.document.entities.length,undoDepth:s.kernel.history.undoDepth};});

  const button=shell.locator('[data-ext-paint-copies]');await expect(button).toHaveCount(1,{timeout:30000});await expect(button).toBeEnabled();await button.click();
  const panel=shell.locator('.ks-scene-painter');await expect(panel).toBeVisible({timeout:5000});await panel.locator('[data-pattern="grid"]').click();
  for(const [key,value] of [['columns','3'],['rows','2']]){const input=panel.locator(`[data-setting="${key}"]`);await input.fill(value);await input.dispatchEvent('change');}
  await panel.locator('[data-ksp="toggle"]').click();await expect(button).toHaveClass(/on/);

  const batch=await page.evaluate(async()=>{const s=await window.__scenePainterStudio();const t=s.tools.paintCopies,before={entities:s.kernel.document.entities.length,undoDepth:s.kernel.history.undoDepth};t.beginAt(320,320,{snap:1});const preview=t.getPreviews();const commit=await t.commit();return{pattern:t.state().pattern,preview:preview.length,committed:commit.rows.length,before,after:{entities:s.kernel.document.entities.length,undoDepth:s.kernel.history.undoDepth}};});
  expect(batch.pattern).toBe('grid');expect(batch.preview).toBe(6);expect(batch.committed).toBe(6);expect(batch.after.entities-batch.before.entities).toBe(6);expect(batch.after.undoDepth-batch.before.undoDepth).toBe(1);

  const undo=await page.evaluate(async()=>{const s=await window.__scenePainterStudio();await s.kernel.undo();return{entities:s.kernel.document.entities.length,buttons:document.querySelectorAll('#kelo-studio-live [data-ext-paint-copies]').length,panels:document.querySelectorAll('#kelo-studio-live .ks-scene-painter').length};});expect(undo.entities).toBe(source.entities);expect(undo.buttons).toBe(1);expect(undo.panels).toBe(1);
  const stress=await page.evaluate(async()=>{const root=document.getElementById('kelo-studio-live'),started=performance.now();for(let i=0;i<400;i++){const n=document.createElement('i');n.dataset.paintCopiesStress=String(i);root.appendChild(n);n.remove();}await new Promise(r=>requestAnimationFrame(r));return{ms:performance.now()-started,buttons:root.querySelectorAll('[data-ext-paint-copies]').length,panels:root.querySelectorAll('.ks-scene-painter').length};});expect(stress.ms).toBeLessThan(1500);expect(stress.buttons).toBe(1);expect(stress.panels).toBe(1);
  await page.waitForTimeout(5000);const t0=Date.now();const alive=await page.evaluate(async()=>{const s=await window.__scenePainterStudio();return{studio:!!s,tool:!!s?.tools?.paintCopies,pattern:s?.tools?.paintCopies?.state?.().pattern||null,buttons:document.querySelectorAll('#kelo-studio-live [data-ext-paint-copies]').length};});expect(Date.now()-t0).toBeLessThanOrEqual(400);expect(alive).toEqual({studio:true,tool:true,pattern:'grid',buttons:1});
  expect(pageErrors).toEqual([]);expect(consoleErrors.filter(x=>/STUDIO_PAINT_COPIES|CREATOR_WORLD_STUDIO_MOUNT_FAILED|WORLD_EDIT_NOT_READY/.test(x))).toEqual([]);await page.screenshot({path:'test-results/studio-scene-painter-mobile-pass.png',fullPage:true});
});
