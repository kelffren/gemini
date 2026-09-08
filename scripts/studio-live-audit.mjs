/* KELO-INDEX
 * area: QA / STUDIO LIVE
 * owner: Studio LIVE CI
 * purpose: valida en GitHub Pages el vertical slice CREATE -> Studio -> authority/history -> close
 * public-api: CLI `node scripts/studio-live-audit.mjs`
 * consumes: deployed Kelo World, KELO_ADMIN_KEYS, KELO_STUDIO_LAUNCHER, KeloInputLocks
 * state-owned: ninguno; usa un browser context efímero con localStorage aislado
 * extension-points: ampliar solo con comportamientos creator estables
 * reuse: workflow studio-live-audit.yml
 * do-not: no publicar Drafts ni depender de estado persistente del usuario
 */
import fs from 'node:fs';
import { chromium } from 'playwright';

const BASE=(process.env.AUDIT_URL||'https://kelffren.github.io/gemini/').replace(/\?+$/,'');
const executablePath=process.env.CHROME_BIN||undefined;
fs.mkdirSync('artifacts',{recursive:true});
const browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{})});
const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
const page=await context.newPage();
const pageErrors=[];
page.on('pageerror',e=>pageErrors.push(String(e?.stack||e?.message||e)));

let ready=false,lastError=null;
for(let attempt=0;attempt<20;attempt++){
  try{
    await page.goto(`${BASE}?mapEditor=1&studio-live-audit=${Date.now()}`,{waitUntil:'domcontentloaded',timeout:30000});
    await page.waitForTimeout(1200);
    ready=await page.evaluate(()=>{
      const src=[...document.scripts].map(s=>s.getAttribute('src')||'');
      const actor=window.KELO_ADMIN_KEYS?.playerId?.();
      return src.some(x=>x.includes('src/ui/studio-launcher.js?v=2')) &&
        !!window.KELO_STUDIO_LAUNCHER &&
        !!actor && window.KELO_ADMIN_KEYS?.can?.('world.edit',actor)===true &&
        !!window.KeloInputLocks && !!window.KELO_WORLD_EDIT?.ready;
    });
    if(ready)break;
  }catch(e){lastError=e;}
  await page.waitForTimeout(3500);
}
if(!ready){await browser.close();throw new Error(`STUDIO_LIVE_DEPLOY_NOT_READY:${String(lastError||'launcher/admin/authority not ready')}`);}

const resourcesBefore=await page.evaluate(()=>performance.getEntriesByType('resource').map(x=>x.name));
if(resourcesBefore.some(x=>/\/src\/studio\//.test(x))) { await browser.close(); throw new Error('STUDIO_LAZY_BOOT_VIOLATION'); }

await page.evaluate(()=>window.KELO_STUDIO_LAUNCHER.open());
await page.waitForFunction(()=>document.body.classList.contains('kelo-studio-active')&&!!document.getElementById('kelo-studio-live'),null,{timeout:15000});
const opened=await page.evaluate(()=>({
  shell:!!document.getElementById('kelo-studio-live'),
  lockOwners:(window.KeloInputLocks?.snapshot?.().locks||[]).map(x=>x.owner),
  studioResources:performance.getEntriesByType('resource').map(x=>x.name).filter(x=>/\/src\/studio\//.test(x)),
  status:document.querySelector('#kelo-studio-live .ks-status')?.textContent||''
}));
if(!opened.shell)throw new Error('STUDIO_SHELL_NOT_OPEN');
if(!opened.lockOwners.includes('kelo-studio'))throw new Error('STUDIO_FOUNDATION_LOCK_NOT_ACQUIRED');
if(!opened.studioResources.length)throw new Error('STUDIO_DYNAMIC_IMPORT_NOT_OBSERVED');

const rows=page.locator('#kelo-studio-live [data-asset]');
if(await rows.count()<1)throw new Error('STUDIO_ASSET_BROWSER_EMPTY');
const beforePlacements=await page.evaluate(()=>window.KELO_PROPERTY_SYSTEM?.getPlacements?.('parcel:world:editor')?.length||0);
await rows.first().click();
const canvas=page.locator('#game-canvas'),box=await canvas.boundingBox();
if(!box)throw new Error('STUDIO_GAME_CANVAS_MISSING');
const x=Math.round(box.x+box.width*0.52),y=Math.round(box.y+Math.min(box.height*0.24,190));
await page.mouse.click(x,y);
await page.waitForFunction(()=>document.querySelector('#kelo-studio-live [data-act="undo"]')?.disabled===false,null,{timeout:10000});
const afterPlace=await page.evaluate(()=>({
  placements:window.KELO_PROPERTY_SYSTEM?.getPlacements?.('parcel:world:editor')?.length||0,
  status:document.querySelector('#kelo-studio-live .ks-status')?.textContent||''
}));
if(afterPlace.placements<=beforePlacements)throw new Error(`STUDIO_PLACE_DID_NOT_COMMIT:${beforePlacements}->${afterPlace.placements}`);

await page.locator('#kelo-studio-live [data-mode="move"]').click();
await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+64,y+64,{steps:4});await page.mouse.up();
await page.waitForFunction(()=>/·\s*2\s+undo/.test(document.querySelector('#kelo-studio-live .ks-status')?.textContent||''),null,{timeout:10000});
await page.locator('#kelo-studio-live [data-act="undo"]').click();
await page.waitForFunction(()=>/·\s*1\s+undo/.test(document.querySelector('#kelo-studio-live .ks-status')?.textContent||''),null,{timeout:10000});
await page.locator('#kelo-studio-live [data-act="redo"]').click();
await page.waitForFunction(()=>/·\s*2\s+undo/.test(document.querySelector('#kelo-studio-live .ks-status')?.textContent||''),null,{timeout:10000});

await page.screenshot({path:'artifacts/studio-live-open.png',fullPage:true});
await page.locator('#kelo-studio-live [data-act="close"]').click();
await page.waitForFunction(()=>!document.body.classList.contains('kelo-studio-active')&&!document.getElementById('kelo-studio-live'),null,{timeout:10000});
const closed=await page.evaluate(()=>({
  lockOwners:(window.KeloInputLocks?.snapshot?.().locks||[]).map(x=>x.owner),
  view:window.KELO_WORLD_EDIT?.getViewState?.()||null
}));
if(closed.lockOwners.includes('kelo-studio'))throw new Error('STUDIO_FOUNDATION_LOCK_LEAK');
if(pageErrors.length)throw new Error(`STUDIO_PAGE_ERRORS:${pageErrors.join(' | ')}`);

const report={ok:true,url:BASE,viewport:{width:390,height:844,dpr:2},lazyBeforeOpen:true,opened,placementDelta:afterPlace.placements-beforePlacements,afterPlace,closed,pageErrors};
fs.writeFileSync('artifacts/studio-live.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
await browser.close();
