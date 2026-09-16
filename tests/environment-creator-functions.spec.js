/* KELO-INDEX
 * area: TEST / ENVIRONMENT / CREATOR
 * owner: Playwright browser validation
 * purpose: exercise TEST DRAFT, RESTORE, HISTORY A/B comparison, safe rollback, APPLY WORLD and UNDO WORLD against the real browser modules with a deterministic fake transport
 */
const {test,expect}=require('@playwright/test');

const BASE_URL=process.env.KELO_PAGES||'http://127.0.0.1:4173/';
const IPHONE_UA='Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

async function openFixture(browser){
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,userAgent:IPHONE_UA,serviceWorkers:'block'});
  const page=await context.newPage();
  const pageErrors=[];
  page.on('pageerror',error=>pageErrors.push(String(error?.stack||error?.message||error)));
  const response=await page.goto(new URL('tests/fixtures/environment-creator-playwright.html',BASE_URL).toString(),{waitUntil:'domcontentloaded',timeout:30000});
  expect(response).not.toBeNull();
  expect(response.status()).toBeLessThan(400);
  await page.waitForFunction(()=>window.__ENVIRONMENT_PLAYWRIGHT_READY===true,{timeout:15000});
  return {context,page,pageErrors};
}

async function runDraft(page,fields){
  return page.evaluate(async value=>window.__ENVIRONMENT_CREATOR_BRIDGE.run('ENVIRONMENT',{name:'Playwright Environment',fields:value}),fields);
}

async function snapshot(page){
  return page.evaluate(()=>({
    fixture:window.__ENVIRONMENT_FIXTURE_STATE(),
    runtime:{
      revision:window.KELO_ENVIRONMENT_RUNTIME.revision,
      state:window.KELO_ENVIRONMENT_RUNTIME.state,
      approved:window.KELO_ENVIRONMENT_RUNTIME.approved,
      temporary:window.KELO_ENVIRONMENT_RUNTIME.temporary
    },
    bridge:{
      version:window.__ENVIRONMENT_CREATOR_BRIDGE.version,
      worldRevision:window.__ENVIRONMENT_CREATOR_BRIDGE.worldRevision,
      worldConnected:window.__ENVIRONMENT_CREATOR_BRIDGE.worldConnected,
      active:window.__ENVIRONMENT_CREATOR_BRIDGE.active
    }
  }));
}

test('TEST DRAFT is temporary and RESTORE returns to canonical environment',async({browser})=>{
  const {context,page,pageErrors}=await openFixture(browser);
  await runDraft(page,{biome:'forest',weather:'fog',timeOfDay:'night',ambientDensity:88,musicMood:'magical',accent:'#2f7d55'});

  await expect(page.locator('#kelo-environment-runtime-test-restore')).toBeVisible();
  await expect(page.locator('#kelo-environment-runtime-world-history')).toBeVisible();
  await expect(page.locator('#kelo-environment-runtime-test-apply')).toBeVisible();

  let state=await snapshot(page);
  expect(state.runtime.temporary).toBe(true);
  expect(state.runtime.state.biome).toBe('forest');
  expect(state.runtime.approved.biome).toBe('coast');
  expect(state.fixture.revision).toBe(12);

  await page.locator('#kelo-environment-runtime-test-restore').click();
  state=await snapshot(page);
  expect(state.runtime.temporary).toBe(false);
  expect(state.runtime.state.biome).toBe('coast');
  expect(state.runtime.approved.biome).toBe('coast');
  expect(state.fixture.revision).toBe(12);
  await expect(page.locator('#kelo-environment-runtime-test-apply')).toHaveCount(0);
  expect(pageErrors).toEqual([]);
  await context.close();
});

test('HISTORY compares revisions without mutation, then rolls back only after confirmation and can undo',async({browser})=>{
  const {context,page,pageErrors}=await openFixture(browser);
  await runDraft(page,{biome:'snow',weather:'snow',timeOfDay:'night',ambientDensity:72,musicMood:'calm',accent:'#9fc8dc'});
  await page.locator('#kelo-environment-runtime-world-history').click();
  await expect(page.locator('#kelo-environment-runtime-history-panel')).toBeVisible();
  await expect(page.getByText('WORLD HISTORY',{exact:true})).toBeVisible();
  await expect(page.getByText('CURRENT r12',{exact:true})).toBeVisible();

  const oldRow=page.locator('.kewh-row').filter({hasText:'r9 · PUBLISH'});
  await expect(oldRow).toBeVisible();
  await oldRow.locator('.kewh-action').click();

  await expect(page.getByText('COMPARE r12 ↔ r9',{exact:true})).toBeVisible();
  await expect(page.locator('.kewh-side-label.current')).toHaveText('CURRENT r12');
  await expect(page.locator('.kewh-side-label.old')).toHaveText('r9');
  await expect(page.locator('.kewh-diffs')).toContainText('BIOME');
  await expect(page.locator('.kewh-diffs')).toContainText('WEATHER');
  await expect(page.locator('.kewh-diffs')).toContainText('TIME');

  let state=await snapshot(page);
  expect(state.fixture.revision).toBe(12);
  expect(state.fixture.state.biome).toBe('coast');

  const scrub=page.locator('.kewh-stage > .kewh-scrub');
  await scrub.fill('80');
  await expect.poll(()=>page.locator('.kewh-compare').evaluate(el=>el.style.getPropertyValue('--split'))).toBe('80%');
  await page.screenshot({path:'test-results/environment-history-compare.png',fullPage:true});

  const rollback=page.locator('.kewh-rollback');
  await expect(rollback).toHaveText('ROLLBACK WORLD TO r9');
  await rollback.click();
  await expect(page.locator('.kewh-rollback')).toHaveText('CONFIRM ROLLBACK TO r9');
  state=await snapshot(page);
  expect(state.fixture.revision).toBe(12);

  await page.locator('.kewh-rollback').click();
  await expect(page.locator('#kelo-environment-runtime-world-undo')).toBeVisible({timeout:10000});
  state=await snapshot(page);
  expect(state.fixture.revision).toBe(13);
  expect(state.fixture.state.biome).toBe('forest');
  expect(state.fixture.state.weather).toBe('fog');
  expect(state.runtime.revision).toBe(13);
  expect(state.runtime.approved.biome).toBe('forest');
  expect(state.runtime.temporary).toBe(false);

  await page.locator('#kelo-environment-runtime-world-undo').click();
  await expect(page.locator('#kelo-environment-runtime-world-undo')).toHaveCount(0);
  state=await snapshot(page);
  expect(state.fixture.revision).toBe(14);
  expect(state.fixture.state.biome).toBe('coast');
  expect(state.fixture.state.weather).toBe('rain');
  expect(state.runtime.revision).toBe(14);
  expect(state.runtime.approved.biome).toBe('coast');
  expect(pageErrors).toEqual([]);
  await context.close();
});

test('APPLY WORLD publishes the tested draft and UNDO WORLD restores the previous canonical revision',async({browser})=>{
  const {context,page,pageErrors}=await openFixture(browser);
  await runDraft(page,{biome:'snow',weather:'storm',timeOfDay:'night',ambientDensity:90,musicMood:'tense',accent:'#9fc8dc'});

  let state=await snapshot(page);
  expect(state.runtime.temporary).toBe(true);
  expect(state.fixture.revision).toBe(12);

  await page.locator('#kelo-environment-runtime-test-apply').click();
  await expect(page.locator('#kelo-environment-runtime-world-undo')).toBeVisible({timeout:10000});
  state=await snapshot(page);
  expect(state.fixture.revision).toBe(13);
  expect(state.fixture.state.biome).toBe('snow');
  expect(state.fixture.state.weather).toBe('storm');
  expect(state.runtime.revision).toBe(13);
  expect(state.runtime.approved.biome).toBe('snow');
  expect(state.runtime.temporary).toBe(false);

  await page.screenshot({path:'test-results/environment-apply-world.png',fullPage:true});
  await page.locator('#kelo-environment-runtime-world-undo').click();
  await expect(page.locator('#kelo-environment-runtime-world-undo')).toHaveCount(0);
  state=await snapshot(page);
  expect(state.fixture.revision).toBe(14);
  expect(state.fixture.state.biome).toBe('coast');
  expect(state.fixture.state.weather).toBe('rain');
  expect(state.runtime.approved.biome).toBe('coast');
  expect(pageErrors).toEqual([]);
  await context.close();
});
