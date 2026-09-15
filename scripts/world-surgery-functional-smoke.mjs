import { chromium } from 'playwright';

const BASE=(process.env.AUDIT_URL||'http://127.0.0.1:8000/').replace(/\?+$/,'');
const executablePath=process.env.CHROME_BIN||undefined;
const browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{})});
const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,serviceWorkers:'block'});
const page=await context.newPage();
const pageErrors=[];
page.on('pageerror',error=>pageErrors.push(String(error?.stack||error?.message||error)));

const fail=async message=>{await browser.close();throw new Error(message);};
const isKnownBaseSocialError=row=>/closeSocialModal[\s\S]*checkSocialTouch/.test(String(row||''));

async function openCreators(){
  await page.evaluate(async()=>{
    const {openCreatorHub}=await import('./src/creators/ui/creator-hub.mjs');
    await openCreatorHub({root:window});
  });
  await page.waitForSelector('#kelo-creators-hub',{state:'visible',timeout:15000});
  await page.waitForFunction(()=>!!(
    window.KeloInputLocks?.acquire&&
    window.KELO_ADMIN_KEYS?.can?.('world.edit')
  ),{timeout:15000});
}

try{
  // Match the repository's official World mobile QA bootstrap: guest mode keeps
  // the auth wall out of this diagnostic path, and Creators owns KeloInputLocks.
  await page.goto(`${BASE}?guest=1&mapEditor=1&world-surgery-smoke=${Date.now()}`,{waitUntil:'domcontentloaded',timeout:30000});
  await openCreators();

  const surgeryButton=page.locator('[data-world-surgery="1"]');
  await surgeryButton.waitFor({state:'visible',timeout:10000});
  await surgeryButton.click();
  await page.waitForSelector('#kelo-world-surgery-control',{state:'visible',timeout:10000});

  const initial=await page.evaluate(()=>({
    hasApi:!!window.KELO_WORLD_SURGERY,
    defaultPreset:window.KELO_WORLD_SURGERY?.getConfig?.().preset,
    paintCopies:window.KELO_WORLD_SURGERY?.enabled?.('paintCopies')
  }));
  if(!initial.hasApi)await fail('SURGERY_API_MISSING');
  if(initial.paintCopies!==true)await fail('SURGERY_DEFAULT_NOT_ALL_CURRENT');

  await page.getByRole('button',{name:'NO_PAINT_COPIES'}).click();
  const switched=await page.evaluate(()=>({
    preset:window.KELO_WORLD_SURGERY?.getConfig?.().preset,
    paintCopies:window.KELO_WORLD_SURGERY?.enabled?.('paintCopies')
  }));
  if(switched.preset!=='NO_PAINT_COPIES'||switched.paintCopies!==false)await fail(`SURGERY_PRESET_FAILED:${JSON.stringify(switched)}`);

  await page.reload({waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForFunction(()=>!!window.KELO_WORLD_SURGERY?.enabled,{timeout:15000});
  const persisted=await page.evaluate(()=>({preset:window.KELO_WORLD_SURGERY.getConfig().preset,paintCopies:window.KELO_WORLD_SURGERY.enabled('paintCopies')}));
  if(persisted.paintCopies!==false)await fail(`SURGERY_PERSISTENCE_FAILED:${JSON.stringify(persisted)}`);

  // Recreate the Creator-owned input/permission contracts after reload before
  // asking World to mount. This mirrors tests/world-editor-ios-reopen.spec.js.
  await openCreators();
  await page.locator('[data-workspace="world"]').first().click();
  await page.waitForFunction(()=>{
    const live=document.getElementById('kelo-studio-live');
    return !!live?.isConnected&&live.dataset?.keloWorldLoading!=='1'&&!!live.querySelector('.ks-status');
  },{timeout:45000});

  const mounted=await page.evaluate(()=>{
    const live=document.getElementById('kelo-studio-live');
    return {
      connected:!!live?.isConnected,
      loading:live?.dataset?.keloWorldLoading||'',
      status:String(live?.querySelector('.ks-status')?.textContent||''),
      paintCopies:window.KELO_WORLD_SURGERY?.enabled?.('paintCopies'),
      evidence:window.KELO_WORLD_SURGERY?.evidence?.()||null,
      pageResponsive:document.visibilityState==='visible'
    };
  });
  if(!mounted.connected||mounted.paintCopies!==false||!mounted.pageResponsive)await fail(`WORLD_SURGERY_MOUNT_FAILED:${JSON.stringify(mounted)}`);
  await page.waitForTimeout(2500);
  const responsive=await page.evaluate(()=>({now:performance.now(),status:String(document.querySelector('#kelo-studio-live .ks-status')?.textContent||''),connected:!!document.getElementById('kelo-studio-live')?.isConnected}));
  if(!responsive.connected)await fail('WORLD_SURGERY_POST_MOUNT_DISCONNECTED');

  // This legacy global error exists in the base game when a touch tries to close
  // a social modal that is absent. Record it, but do not misclassify it as a
  // Surgery/World regression. Every other pageerror remains fatal here.
  const ignoredBasePageErrors=pageErrors.filter(isKnownBaseSocialError);
  const relevantPageErrors=pageErrors.filter(row=>!isKnownBaseSocialError(row));
  if(relevantPageErrors.length)await fail(`WORLD_SURGERY_PAGE_ERRORS:${JSON.stringify(relevantPageErrors.slice(0,5))}`);

  console.log(JSON.stringify({ok:true,classification:'MOBILE EMULATION PASS',initial,switched,persisted,mounted,responsive,ignoredBasePageErrors},null,2));
} finally {
  await browser.close().catch(()=>{});
}
