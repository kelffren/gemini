import { chromium } from 'playwright';

const base = process.env.AUDIT_URL || 'https://kelffren.github.io/gemini/';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function waitForDeploy(){
  const targets=[
    ['src/ui/studio-launcher.js','studio-launcher-v1.3.0'],
    ['src/world/world-edit-authority.js','world-edit-authority-v1.1.0'],
    ['src/studio/ui/studio-live-shell.mjs','studio-live-shell-v1.4.0'],
    ['src/studio/input/studio-camera-controller.mjs','STUDIO_CAMERA_OWNER_REQUIRED']
  ];
  for(let attempt=1;attempt<=90;attempt++){
    let ready=true;
    for(const [path,marker] of targets){
      try{
        const u=new URL(path,base);u.searchParams.set('auditDeploy',`${Date.now()}-${attempt}`);
        const text=await fetch(u,{cache:'no-store'}).then(r=>r.ok?r.text():'');
        if(!text.includes(marker)){ready=false;break;}
      }catch{ready=false;break;}
    }
    if(ready)return attempt;
    await sleep(1000);
  }
  throw new Error('STUDIO_CLICK_AUDIT_DEPLOY_TIMEOUT');
}

const objectCount=async page=>{
  const text=await page.locator('#kelo-studio-live .ks-status').textContent().catch(()=>null);
  return Number(String(text||'').match(/·\s*(\d+)\s+objects/)?.[1]||0);
};
const deployAttempt=await waitForDeploy();
const url = new URL(base);
url.searchParams.set('mapEditor','1');
url.searchParams.set('studioClickAudit',String(Date.now()));
const browser = await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'});
const page=await context.newPage();
const pageErrors=[];const consoleErrors=[];
page.on('pageerror',e=>pageErrors.push(String(e?.stack||e)));
page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});
let report={ok:false,url:String(url),deployAttempt,createVisible:false,studioVisible:false,permission:false,lockAcquired:false,visualAssets:false,assetCompact:false,editReopens:false,persistentPaint:false,pageErrors,consoleErrors,toasts:[]};
try{
  await page.goto(String(url),{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForFunction(()=>window.KELO_ADMIN_KEYS?.can?.('world.edit',window.KELO_ADMIN_KEYS?.playerId?.()),null,{timeout:12000});
  report.permission=true;
  await page.waitForSelector('#lx-side-menu',{state:'visible',timeout:8000});
  await page.click('#lx-side-menu');
  await page.waitForSelector('#lx-create-studio',{state:'visible',timeout:8000});
  report.createVisible=true;
  await page.click('#lx-create-studio');
  await page.waitForSelector('#kelo-studio-live',{state:'visible',timeout:15000});
  report.studioVisible=true;
  report.lockAcquired=await page.waitForFunction(()=>window.KeloInputLocks?.snapshot?.().owners?.some?.(o=>o.owner==='kelo-studio'||o.id==='kelo-studio'||String(o).includes('kelo-studio')),null,{timeout:5000}).then(()=>true).catch(()=>false);
  report.visualAssets=await page.waitForFunction(()=>!!document.querySelector('#kelo-studio-live [data-asset] canvas'),null,{timeout:8000}).then(()=>true).catch(()=>false);
  if(!report.lockAcquired)throw new Error(`STUDIO_LOCK_NOT_ACQUIRED: ${JSON.stringify(report)}`);
  if(!report.visualAssets)throw new Error(`STUDIO_VISUAL_ASSETS_MISSING: ${JSON.stringify(report)}`);

  const before=await objectCount(page);
  const firstAsset=page.locator('#kelo-studio-live [data-pane="assets"] [data-asset]').first();
  await firstAsset.click();
  await page.waitForFunction(()=>{const r=document.querySelector('#kelo-studio-live');return r?.dataset.compact==='asset'&&!!r.dataset.activeAsset&&!!r.querySelector('.ks-bottom.ks-compact [data-act="edit-assets"]');},null,{timeout:8000});
  report.assetCompact=true;
  report.activeAsset=await page.locator('#kelo-studio-live').getAttribute('data-active-asset');
  report.modeAfterAsset=await page.locator('#kelo-studio-live .ks-status').textContent();
  if(!/^(PLACEMENT|PREFAB)/.test(String(report.modeAfterAsset||'')))throw new Error(`STUDIO_ASSET_NOT_ACTIVE:${report.modeAfterAsset}`);

  await page.mouse.click(88,210);
  await page.waitForFunction(count=>Number(document.querySelector('#kelo-studio-live .ks-status')?.textContent?.match(/·\s*(\d+)\s+objects/)?.[1]||0)>count,before,{timeout:8000});
  const afterOne=await objectCount(page);
  await page.mouse.click(302,585);
  await page.waitForFunction(count=>Number(document.querySelector('#kelo-studio-live .ks-status')?.textContent?.match(/·\s*(\d+)\s+objects/)?.[1]||0)>count,afterOne,{timeout:8000});
  const activeAfterTwo=await page.locator('#kelo-studio-live').getAttribute('data-active-asset');
  const modeAfterTwo=await page.locator('#kelo-studio-live .ks-status').textContent();
  report.persistentPaint=activeAfterTwo===report.activeAsset&&/^(PLACEMENT|PREFAB)/.test(String(modeAfterTwo||''));
  report.placedCount=(await objectCount(page))-before;
  if(!report.persistentPaint||report.placedCount<2)throw new Error(`STUDIO_PERSISTENT_PAINT_FAILED:${JSON.stringify({activeAfterTwo,modeAfterTwo,placedCount:report.placedCount})}`);

  await page.click('#kelo-studio-live .ks-bottom.ks-compact [data-act="edit-assets"]');
  await page.waitForFunction(active=>{const r=document.querySelector('#kelo-studio-live');return r?.dataset.compact==='full'&&r.dataset.activeAsset===active&&r.querySelector('[data-pane="assets"]')?.classList.contains('on');},report.activeAsset,{timeout:5000});
  report.editReopens=true;
  const visibleAssetCount=await page.locator('#kelo-studio-live [data-pane="assets"] [data-asset]').count();
  if(visibleAssetCount>1){
    await page.locator('#kelo-studio-live [data-pane="assets"] [data-asset]').nth(1).click();
    await page.waitForFunction(old=>{const r=document.querySelector('#kelo-studio-live');return r?.dataset.compact==='asset'&&!!r.dataset.activeAsset&&r.dataset.activeAsset!==old;},report.activeAsset,{timeout:5000});
    report.changedAsset=true;
  }

  report.toasts=await page.locator('#toast-container > *').allTextContents().catch(()=>[]);
  report.session=await page.evaluate(()=>({
    launcher:window.KELO_STUDIO_LAUNCHER?.version||null,
    worldEdit:window.KELO_WORLD_EDIT?.version||null,
    worldEditReady:window.KELO_WORLD_EDIT?.ready??null,
    allowed:window.KELO_STUDIO_LAUNCHER?.allowed??null,
    inputLocks:window.KeloInputLocks?.snapshot?.()||null,
    cameraOwner:window.KeloCamera?.version||null,
    shellVersion:document.querySelector('#kelo-studio-live')?.dataset.shellVersion||null,
    compact:document.querySelector('#kelo-studio-live')?.dataset.compact||null,
    activeAsset:document.querySelector('#kelo-studio-live')?.dataset.activeAsset||null,
    studioNode:!!document.querySelector('#kelo-studio-live')
  }));
  await page.click('#kelo-studio-live [data-act="close"]');
  await page.waitForFunction(()=>!document.querySelector('#kelo-studio-live'),null,{timeout:8000});
  const lockReleased=await page.evaluate(()=>!window.KeloInputLocks?.snapshot?.().owners?.some?.(o=>o.owner==='kelo-studio'||o.id==='kelo-studio'||String(o).includes('kelo-studio')));
  if(!lockReleased)throw new Error('STUDIO_LOCK_LEAK_AFTER_CLOSE');
  if(pageErrors.length)throw new Error(`STUDIO_PAGE_ERRORS:${JSON.stringify(pageErrors)}`);
  report.ok=true;report.lockReleased=true;
  console.log(JSON.stringify(report,null,2));
} catch(error){
  report.toasts=await page.locator('#toast-container > *').allTextContents().catch(()=>report.toasts||[]);
  report.session=await page.evaluate(()=>({launcher:window.KELO_STUDIO_LAUNCHER?.version||null,worldEdit:window.KELO_WORLD_EDIT?.version||null,worldEditReady:window.KELO_WORLD_EDIT?.ready??null,allowed:window.KELO_STUDIO_LAUNCHER?.allowed??null,cameraOwner:window.KeloCamera?.version||null,shellVersion:document.querySelector('#kelo-studio-live')?.dataset.shellVersion||null,compact:document.querySelector('#kelo-studio-live')?.dataset.compact||null,activeAsset:document.querySelector('#kelo-studio-live')?.dataset.activeAsset||null,studioNode:!!document.querySelector('#kelo-studio-live')})).catch(()=>null);
  console.error(JSON.stringify(report,null,2));
  throw error;
} finally {await browser.close();}
