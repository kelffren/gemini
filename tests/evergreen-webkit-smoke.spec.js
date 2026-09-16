/* KELO-INDEX
 * area: QA / MOBILE WEBKIT
 * owner: Evergreen branch smoke
 * purpose: prueba el commit de la rama con WebKit móvil local sin confundirlo con BrowserStack real-device
 */
const { test, expect } = require('@playwright/test');

test('V6.69 evergreen branch boots plaza without uncaught errors', async ({ page }) => {
  const pageErrors=[];
  const consoleErrors=[];
  page.on('pageerror',error=>pageErrors.push(String(error&&error.message||error)));
  page.on('console',msg=>{if(msg.type()==='error')consoleErrors.push(msg.text());});

  await page.goto('/?guest=1',{waitUntil:'domcontentloaded'});
  await expect(page.locator('#game-canvas')).toBeVisible();
  await page.waitForFunction(()=>window.__keloBootReady===true,{timeout:15000});

  const snapshot=await page.evaluate(()=>({
    bootReady:window.__keloBootReady===true,
    stateStore:window.KeloStateStore&&window.KeloStateStore.snapshot&&window.KeloStateStore.snapshot(),
    transitionBridge:window.KeloLegacyTransitionBridge&&window.KeloLegacyTransitionBridge.snapshot&&window.KeloLegacyTransitionBridge.snapshot(),
    abilityAim:window.KeloAbilityAim&&window.KeloAbilityAim.snapshot&&window.KeloAbilityAim.snapshot(),
    abilityDirection:window.KeloAbilityDirection&&window.KeloAbilityDirection.snapshot&&window.KeloAbilityDirection.snapshot(),
    abilityTriggerBridge:window.KeloLegacyAbilityTrigger&&window.KeloLegacyAbilityTrigger.snapshot&&window.KeloLegacyAbilityTrigger.snapshot(),
    abilityDashMax:window.KeloAbilityAim&&window.KeloAbilityAim.maxRange&&window.KeloAbilityAim.maxRange('dash'),
    abilityBegin:!!(window.KeloAbilityAim&&window.KeloAbilityAim.begin),
    abilityEnd:!!(window.KeloAbilityAim&&window.KeloAbilityAim.end),
    camera:!!window.KeloCamera,
    position:!!window.KeloPlayerPosition,
    collision:!!window.KELO_COLLISION,
    moduleLoader:window.KELO_MODULE_LOADER&&window.KELO_MODULE_LOADER.diagnostics&&window.KELO_MODULE_LOADER.diagnostics(),
    assetKnown:window.KELO_ASSET_REGISTRY&&window.KELO_ASSET_REGISTRY.known,
    scripts:Array.from(document.scripts).map(script=>String(script.getAttribute('src')||''))
  }));

  expect(snapshot.bootReady).toBe(true);
  expect(snapshot.stateStore).toBeTruthy();
  expect(snapshot.stateStore.schemaVersion).toBe(3);
  expect(snapshot.transitionBridge).toBeTruthy();
  expect(snapshot.transitionBridge.ownersReady).toBe(true);
  expect(snapshot.abilityAim).toBeTruthy();
  expect(snapshot.abilityAim.version).toMatch(/^kelo-ability-aim-v\d+\.\d+\.\d+-/);
  expect(snapshot.abilityAim.pointerLifecycle).toBeTruthy();
  expect(snapshot.abilityAim.pointerLifecycle.owner).toBe('KeloAbilityAim');
  expect(snapshot.abilityAim.pointerLifecycle.attached).toBe(true);
  expect(snapshot.abilityAim.castMiddlewareCount).toBeGreaterThanOrEqual(1);
  expect(snapshot.abilityAim.castMiddlewareOwners).toContain('engine-l:plaza-cast-presentation');
  expect(snapshot.abilityAim.castMiddlewareOwners).not.toContain('engine-m:skill-shots');
  expect(snapshot.abilityBegin).toBe(true);
  expect(snapshot.abilityEnd).toBe(true);
  expect(snapshot.abilityDirection).toBeTruthy();
  expect(snapshot.abilityDirection.version).toMatch(/^kelo-ability-direction-/);
  expect(snapshot.abilityTriggerBridge).toBeTruthy();
  expect(snapshot.abilityTriggerBridge.version).toMatch(/^kelo-legacy-ability-trigger-/);
  expect(snapshot.abilityDashMax).toBe(170);
  expect(snapshot.scripts.some(src=>src.includes('legacy-ability-aim-system.js'))).toBe(true);
  expect(snapshot.scripts.some(src=>src.includes('engine-m.js'))).toBe(false);
  expect(snapshot.scripts.some(src=>/engine-(?:j|k)\.js/.test(src))).toBe(false);
  expect(snapshot.camera).toBe(true);
  expect(snapshot.position).toBe(true);
  expect(snapshot.collision).toBe(true);
  expect(snapshot.moduleLoader).toBeTruthy();
  expect(snapshot.moduleLoader.afterPaint).toEqual(expect.arrayContaining(['controlPlane','observability']));
  expect(snapshot.assetKnown).not.toContain('controlPlane');
  expect(snapshot.assetKnown).not.toContain('observability');

  await page.waitForFunction(()=>window.KELO_MODULE_LOADER?.isReady?.('controlPlane')&&window.KELO_MODULE_LOADER?.isReady?.('observability'),{timeout:10000});
  const afterPaint=await page.evaluate(()=>({
    controlPlane:window.KELO_MODULE_LOADER.isReady('controlPlane'),
    observability:window.KELO_MODULE_LOADER.isReady('observability'),
    positionShadow:!!window.KeloPlayerPositionShadow,
    farmShadow:!!window.KELO_SIMULATION_FARM_SHADOW,
    failures:window.KELO_MODULE_LOADER.diagnostics().failures
  }));
  expect(afterPaint.controlPlane).toBe(true);
  expect(afterPaint.observability).toBe(true);
  expect(afterPaint.positionShadow).toBe(true);
  expect(afterPaint.farmShadow).toBe(true);
  expect(afterPaint.failures).toEqual({});

  const worldLoaded=await page.evaluate(async()=>window.KELO_MODULE_LOADER.ensure('world'));
  expect(worldLoaded).toBe(true);
  await page.waitForFunction(()=>window.KELO_MODULE_LOADER?.isReady?.('world'),{timeout:15000});
  const worldSnapshot=await page.evaluate(()=>({
    ready:window.KELO_MODULE_LOADER.isReady('world'),
    abilityAim:window.KeloAbilityAim.snapshot(),
    failures:window.KELO_MODULE_LOADER.diagnostics().failures,
    scripts:Array.from(document.scripts).map(script=>String(script.getAttribute('src')||''))
  }));
  expect(worldSnapshot.ready).toBe(true);
  expect(worldSnapshot.abilityAim.castMiddlewareCount).toBeGreaterThanOrEqual(2);
  expect(worldSnapshot.abilityAim.castMiddlewareOwners).toEqual(expect.arrayContaining([
    'engine-l:plaza-cast-presentation',
    'engine-m:skill-shots'
  ]));
  expect(worldSnapshot.scripts.some(src=>src.includes('engine-m.js'))).toBe(true);
  expect(worldSnapshot.failures).toEqual({});

  await page.waitForTimeout(250);
  expect(pageErrors).toEqual([]);
  expect(consoleErrors.filter(text=>!/favicon/i.test(text))).toEqual([]);
});

test('modern ability runtime owns the first-use hotbar without restoring engine-g UI', async ({ page }) => {
  await page.goto('/?guest=1',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__keloBootReady===true&&!!window.KeloAbilityAim&&!!window.KELO_MODULE_LOADER,{timeout:15000});

  const before=await page.evaluate(()=>({
    legacySlot:!!document.getElementById('action-slot-0'),
    modernSlots:document.querySelectorAll('#action-bar-container .stone-slot[data-slot]').length,
    abilityRuntimeReady:window.KELO_MODULE_LOADER.isReady('abilityRuntime'),
    abilityLoader:!!window.KeloAbilitiesLoader,
    abilities:!!window.KeloAbilities,
    aim:window.KeloAbilityAim.snapshot(),
    scripts:Array.from(document.scripts).map(script=>String(script.getAttribute('src')||''))
  }));
  expect(before.legacySlot).toBe(false);
  expect(before.modernSlots).toBe(0);
  expect(before.abilityRuntimeReady).toBe(false);
  expect(before.abilityLoader).toBe(false);
  expect(before.abilities).toBe(false);
  expect(before.scripts.some(src=>src.includes('kelo-ability-boot.js'))).toBe(false);
  expect(before.aim.pointerLifecycle.attached).toBe(true);

  const loaded=await page.evaluate(async()=>{
    const featureLoaded=await window.KELO_MODULE_LOADER.ensure('abilityRuntime');
    if(!featureLoaded||!window.KeloAbilitiesLoader)throw new Error('ability runtime feature failed to expose loader');
    await window.KeloAbilitiesLoader.ensure();
    return {
      featureLoaded,
      featureReady:window.KELO_MODULE_LOADER.isReady('abilityRuntime'),
      loaderReady:window.KeloAbilitiesLoader.isReady(),
      abilities:!!window.KeloAbilities,
      legacySlot:!!document.getElementById('action-slot-0'),
      modernSlots:document.querySelectorAll('#action-bar-container .stone-slot[data-slot]').length,
      modernMarker:document.getElementById('action-bar-container')?.dataset?.keloStoneV4||'',
      renderAdapter:typeof window.renderActionBar==='function',
      hotbarSize:window.KeloAbilities?.hotbar?.slots?.length||0,
      perf:window.KeloAbilities?.performanceSnapshot?.(),
      aim:window.KeloAbilityAim.snapshot(),
      failures:window.KELO_MODULE_LOADER.diagnostics().failures,
      scripts:Array.from(document.scripts).map(script=>String(script.getAttribute('src')||''))
    };
  });

  expect(loaded.featureLoaded).toBe(true);
  expect(loaded.featureReady).toBe(true);
  expect(loaded.loaderReady).toBe(true);
  expect(loaded.abilities).toBe(true);
  expect(loaded.legacySlot).toBe(false);
  expect(loaded.modernSlots).toBe(5);
  expect(loaded.modernMarker).toBe('1');
  expect(loaded.renderAdapter).toBe(true);
  expect(loaded.hotbarSize).toBe(5);
  expect(loaded.perf).toBeTruthy();
  expect(loaded.aim.pointerLifecycle.attached).toBe(true);
  expect(loaded.scripts.some(src=>src.includes('abilityData.js'))).toBe(true);
  expect(loaded.scripts.some(src=>src.includes('stone-system.js'))).toBe(true);
  expect(loaded.scripts.some(src=>src.includes('kelo-ability-boot.js'))).toBe(true);
  expect(loaded.failures).toEqual({});
});

test('direct legacy stone trigger is explicit, measured, and does not impersonate teleport authority', async ({ page }) => {
  await page.goto('/?guest=1',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__keloBootReady===true&&!!window.KeloLegacyAbilityTrigger&&!!window.KeloAbilityDirection,{timeout:15000});

  const result=await page.evaluate(()=>{
    const index=STATE.equipped.findIndex(stone=>stone&&stone.typeId==='dash');
    if(index<0)throw new Error('dash stone missing from baseline equipment');
    STATE.equipped[index].currentCd=0;
    const bridgeBefore=window.KeloLegacyAbilityTrigger.snapshot();
    const positionBefore=window.KeloPlayerPosition.snapshot();
    const from={x:localPlayer.x,y:localPlayer.y};
    triggerStone(index);
    const bridgeAfter=window.KeloLegacyAbilityTrigger.snapshot();
    const positionAfter=window.KeloPlayerPosition.snapshot();
    return {bridgeBefore,bridgeAfter,positionBefore,positionAfter,from,to:{x:localPlayer.x,y:localPlayer.y},cooldown:STATE.equipped[index].currentCd};
  });

  expect(result.bridgeAfter.directDashCasts-result.bridgeBefore.directDashCasts).toBe(1);
  expect(result.bridgeAfter.totalCalls-result.bridgeBefore.totalCalls).toBe(1);
  expect(result.positionAfter.transitions-result.positionBefore.transitions).toBe(0);
  expect(result.cooldown).toBeGreaterThan(0);
  expect(Number.isFinite(result.to.x)&&Number.isFinite(result.to.y)).toBe(true);
});

test('legacy plot/farm travel is routed through modern position/camera owners', async ({ page }) => {
  await page.goto('/?guest=1',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__keloBootReady===true,{timeout:15000});

  const result=await page.evaluate(()=>{
    const before=window.KeloLegacyTransitionBridge.snapshot();
    const positionBefore=window.KeloPlayerPosition.snapshot();
    teleportToFarm();
    teleportToPlot();
    const after=window.KeloLegacyTransitionBridge.snapshot();
    const positionAfter=window.KeloPlayerPosition.snapshot();
    return {before,after,positionBefore,positionAfter};
  });

  expect(result.after.farmCalls-result.before.farmCalls).toBe(1);
  expect(result.after.plotCalls-result.before.plotCalls).toBe(1);
  expect(result.after.fallbackCalls-result.before.fallbackCalls).toBe(0);
  expect(result.positionAfter.transitions-result.positionBefore.transitions).toBe(2);
});