/* KELO-INDEX
 * area: TEST / CREATORS / PIXELORAMA PRO / REAL IOS
 * owner: Kelo creator-runtime mobile gate
 * purpose: prove the matched Kelo Pixelorama Web export boots with its native bridge on WebKit/real Safari, hibernates gameplay while open, opens the transferred asset, heartbeats, and releases every exclusive-runtime claim on close
 * do-not: NO emulated-iPhone certification claim, NO stock-fallback acceptance, NO external editor navigation, NO opaque READY timeout
 */
const { test, expect } = require('@playwright/test');

async function exclusiveSnapshot(page){
  return page.evaluate(async()=>{
    const runtime=await import('./src/creators/core/creator-exclusive-runtime.mjs');
    return runtime.getCreatorExclusiveSnapshot();
  });
}

async function pixeloramaEvidence(page){
  return page.evaluate(()=>{
    const messages=window.__KELO_PIXELORAMA_TEST_MESSAGES__||[];
    return {
      ready:messages.find(message=>message.type==='ready')?.payload||null,
      fallback:messages.find(message=>message.type==='custom-pack-fallback')||null,
      errors:messages.filter(message=>message.type==='error').map(message=>message.payload),
      opened:messages.find(message=>message.type==='asset-opened')?.payload||null,
      stages:messages.filter(message=>message.type==='boot-stage').map(message=>message.payload),
      fetches:messages.filter(message=>message.type==='runtime-fetch').map(message=>message.payload),
      fetchFallbacks:messages.filter(message=>message.type==='runtime-fetch-fallback').map(message=>message.payload),
      messageTypes:messages.map(message=>message.type)
    };
  });
}

test('Pixelorama Pro matched runtime boots natively and fully restores Kelo after close', async ({ page }) => {
  test.setTimeout(180000);

  const response=await page.goto('./?pixeloramaRealIOS=1',{waitUntil:'domcontentloaded',timeout:45000});
  expect(response.status()).toBeLessThan(400);

  await page.waitForFunction(()=>!!(
    window.KeloInputLocks?.acquire &&
    window.KeloMovement?.intercept &&
    window.KeloRender?.intercept &&
    window.KeloSimulation?.suspend
  ),null,{timeout:20000});

  await page.evaluate(()=>{
    window.__KELO_PIXELORAMA_TEST_MESSAGES__=[];
    window.__KELO_PIXELORAMA_TEST_LISTENER__=event=>{
      const message=event.data||{};
      if(message.protocol!=='kelo.pixelorama.v1')return;
      window.__KELO_PIXELORAMA_TEST_MESSAGES__.push({type:message.type,payload:message.payload||{},at:Date.now()});
    };
    window.addEventListener('message',window.__KELO_PIXELORAMA_TEST_LISTENER__);
  });

  await page.evaluate(async()=>{
    document.getElementById('kelo-asset-forge')?.remove();
    const assetForge=await import('./src/creators/ui/asset-forge-workspace.mjs');
    const pixelorama=await import('./src/creators/ui/pixelorama-pro-bridge.mjs');
    const session=await assetForge.openAssetForgeWorkspace({root:window});
    window.__KELO_PIXELORAMA_TEST_DISPOSE__=pixelorama.installPixeloramaProBridge({root:window,session});
  });

  const forge=page.locator('#kelo-asset-forge');
  await expect(forge).toBeVisible({timeout:10000});

  const before=await exclusiveSnapshot(page);
  expect(before.active).toBe(false);
  expect(before.claims).toHaveLength(0);

  await forge.getByRole('button',{name:'Abrir Pixelorama Pro dentro de Kelo World'}).click();
  const overlay=page.locator('#kelo-pixelorama-pro-overlay');
  await expect(overlay).toBeVisible({timeout:10000});

  await page.waitForFunction(()=>document.documentElement.getAttribute('data-kelo-creator-exclusive')==='true',null,{timeout:5000});
  const during=await exclusiveSnapshot(page);
  expect(during.active).toBe(true);
  expect(during.owners).toContain('pixelorama-pro');
  expect(during.inputLocked).toBe(true);
  expect(during.movementIntercepted).toBe(true);
  expect(during.renderIntercepted).toBe(true);
  expect(during.simulationSuspended).toBe(true);

  let bootTimedOut=false;
  try{
    await page.waitForFunction(()=>{
      const messages=window.__KELO_PIXELORAMA_TEST_MESSAGES__||[];
      return messages.some(message=>
        message.type==='ready' &&
        message.payload?.mode==='kelo-custom-pck' &&
        message.payload?.packSource==='kelo-matched-runtime' &&
        message.payload?.nativeBridge===true &&
        message.payload?.runtimeCommit==='5d2a3b99180ebeb1705cee865e7f6927df2352b5' &&
        message.payload?.bridgeVersion==='kelo.pixelorama.session-doctor.v3-matched-runtime'
      ) || messages.some(message=>message.type==='custom-pack-fallback'||message.type==='error');
    },null,{timeout:120000});
  }catch{bootTimedOut=true;}

  const bootEvidence=await pixeloramaEvidence(page);
  expect(bootTimedOut,`Pixelorama boot timed out. Evidence: ${JSON.stringify(bootEvidence)}`).toBe(false);
  expect(bootEvidence.fallback,`Matched runtime fell back. Evidence: ${JSON.stringify(bootEvidence)}`).toBeNull();
  expect(bootEvidence.errors,`Pixelorama emitted runtime errors. Evidence: ${JSON.stringify(bootEvidence)}`).toEqual([]);
  expect(bootEvidence.ready,`Matched runtime never reached READY. Evidence: ${JSON.stringify(bootEvidence)}`).toMatchObject({
    mode:'kelo-custom-pck',
    packSource:'kelo-matched-runtime',
    nativeBridge:true,
    threads:false,
    runtimeCommit:'5d2a3b99180ebeb1705cee865e7f6927df2352b5',
    bridgeVersion:'kelo.pixelorama.session-doctor.v3-matched-runtime'
  });
  expect(['github-raw','github-api-raw']).toContain(bootEvidence.ready.runtimeTransport);
  expect(bootEvidence.fetches.some(item=>item.name==='index.js')).toBe(true);
  expect(bootEvidence.fetches.some(item=>item.name==='index.wasm')).toBe(true);
  expect(bootEvidence.fetches.some(item=>item.name==='index.pck')).toBe(true);

  await page.waitForFunction(()=>window.__KELO_PIXELORAMA_TEST_MESSAGES__?.some(message=>
    message.type==='pong' &&
    message.payload?.nativeBridge===true &&
    message.payload?.packSource==='kelo-matched-runtime'
  ),null,{timeout:15000});

  await page.waitForFunction(()=>window.__KELO_PIXELORAMA_TEST_MESSAGES__?.some(message=>
    message.type==='asset-opened' && message.payload?.mode==='native'
  ),null,{timeout:15000});

  const runtimeEvidence=await pixeloramaEvidence(page);
  expect(runtimeEvidence.opened,`Asset was not opened by native bridge. Evidence: ${JSON.stringify(runtimeEvidence)}`).toMatchObject({mode:'native'});

  await overlay.getByRole('button',{name:'BACK TO KELO'}).click();
  await expect(overlay).toHaveCount(0,{timeout:10000});
  await page.waitForFunction(()=>document.documentElement.getAttribute('data-kelo-creator-exclusive')!== 'true',null,{timeout:5000});

  const after=await exclusiveSnapshot(page);
  expect(after.active).toBe(false);
  expect(after.claims).toHaveLength(0);
  expect(after.inputLocked).toBe(false);
  expect(after.movementIntercepted).toBe(false);
  expect(after.renderIntercepted).toBe(false);
  expect(after.simulationSuspended).toBe(false);
  await expect(forge).toBeVisible();
  await expect(page.locator('#kelo-pixelorama-pro-overlay iframe')).toHaveCount(0);

  await forge.getByRole('button',{name:'Cerrar Asset Forge'}).click();
  await expect(forge).toHaveCount(0,{timeout:5000});

  await page.evaluate(()=>{
    if(window.__KELO_PIXELORAMA_TEST_LISTENER__)window.removeEventListener('message',window.__KELO_PIXELORAMA_TEST_LISTENER__);
    window.__KELO_PIXELORAMA_TEST_DISPOSE__?.();
    delete window.__KELO_PIXELORAMA_TEST_LISTENER__;
    delete window.__KELO_PIXELORAMA_TEST_DISPOSE__;
  });
});
