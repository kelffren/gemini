/* KELO-INDEX
 * area: QA / STUDIO LIVE / MOBILE REFERENCE
 * owner: Studio LIVE CI
 * purpose: valida el flujo real del editor World en telefono y su chrome phone-first
 * public-api: CLI `node scripts/studio-mobile-reference-live-audit.mjs`
 * consumes: deployed Kelo World, KELO_ADMIN_KEYS, KELO_STUDIO_LAUNCHER, Creator Hub, KeloInputLocks, KeloCamera, KELO_WORLD_BUILDER
 * state-owned: ninguno; browser context efimero
 * extension-points: ampliar solo con comportamientos creator visibles y estables
 * reuse: workflow studio-live-audit.yml
 * do-not: no publicar Drafts, no depender de estado persistente, no mutar fuera de owners Studio
 */
import fs from 'node:fs';
import { chromium } from 'playwright';

const BASE=(process.env.AUDIT_URL||'https://kelffren.github.io/gemini/').replace(/\?+$/,'');
const executablePath=process.env.CHROME_BIN||undefined;
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
fs.mkdirSync('artifacts',{recursive:true});
const browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{})});
const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,serviceWorkers:'block'});
const page=await context.newPage();
const pageErrors=[];
page.on('pageerror',e=>pageErrors.push(String(e?.stack||e?.message||e)));

async function deployed(path,markers){
  const url=new URL(path,BASE).href;
  try{
    const response=await context.request.get(`${url}?studio-phone-probe=${Date.now()}`,{headers:{'cache-control':'no-cache','pragma':'no-cache'}});
    const text=response.ok()?await response.text():'';
    return response.ok()&&markers.every(marker=>text.includes(marker));
  }catch{return false;}
}

let deployReady=false;
for(let attempt=0;attempt<60;attempt++){
  const checks=await Promise.all([
    deployed('src/ui/studio-launcher.js',["creators/ui/creator-hub.mjs",'KELO_CREATORS_LAUNCHER']),
    deployed('src/creators/ui/creator-hub.mjs',['openCreatorHub','Abrir ${label}']),
    deployed('src/creators/workspaces/world-workspace.mjs',['live-studio-controller.mjs']),
    deployed('src/studio/ui/creator-productivity-panel.mjs',['ks-mobile-rail','ks-mobile-zoom','ks-mobile-history','WORLD TOOLS'])
  ]);
  if(checks.every(Boolean)){deployReady=true;break;}
  await sleep(2000);
}
if(!deployReady){await browser.close();throw new Error('STUDIO_MOBILE_REFERENCE_DEPLOY_NOT_READY');}

let ready=false,lastError=null;
for(let attempt=0;attempt<20;attempt++){
  try{
    await page.goto(`${BASE}?mapEditor=1&studio-mobile-reference=${Date.now()}`,{waitUntil:'domcontentloaded',timeout:30000});
    await page.waitForTimeout(1000);
    ready=await page.evaluate(()=>{
      const actor=window.KELO_ADMIN_KEYS?.playerId?.();
      const launcher=window.KELO_STUDIO_LAUNCHER;
      return typeof launcher?.open==='function'&&launcher.allowed===true&&!!actor&&
        window.KELO_ADMIN_KEYS?.can?.('world.edit',actor)===true&&!!window.KeloInputLocks&&
        !!window.KeloCamera&&!!window.KELO_WORLD_EDIT?.ready&&!!window.KELO_WORLD_BUILDER;
    });
    if(ready)break;
  }catch(e){lastError=e;}
  await page.waitForTimeout(2000);
}
if(!ready){await browser.close();throw new Error(`STUDIO_MOBILE_BOOT_NOT_READY:${String(lastError||'launcher/admin/authority/world-builder')}`);}

const resourcesAtBoot=await page.evaluate(()=>performance.getEntriesByType('resource').map(x=>x.name));
if(resourcesAtBoot.some(x=>/\/src\/(?:studio|creators)\//.test(x))){await browser.close();throw new Error('CREATOR_LAZY_BOOT_VIOLATION');}

await page.evaluate(()=>window.KELO_CREATORS_LAUNCHER.open());
await page.waitForSelector('#kelo-creators-hub',{state:'visible',timeout:10000});
await page.getByRole('button',{name:'Abrir World'}).click();
await page.waitForFunction(()=>document.body.classList.contains('kelo-studio-active')&&!!document.getElementById('kelo-studio-live'),null,{timeout:15000});
await page.waitForSelector('#kelo-studio-live .ks-mobile-rail',{state:'visible',timeout:10000});

const opened=await page.evaluate(()=>{
  const root=document.querySelector('#kelo-studio-live');
  const rect=sel=>{const r=root?.querySelector(sel)?.getBoundingClientRect();return r?{x:r.x,y:r.y,width:r.width,height:r.height}:null;};
  const visible=sel=>{const el=root?.querySelector(sel);if(!el)return false;const s=getComputedStyle(el),r=el.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0;};
  return {
    shell:!!root,
    hub:!!document.querySelector('#kelo-creators-hub'),
    top:rect('.ks-top'),bottom:rect('.ks-bottom'),rail:rect('.ks-mobile-rail'),zoom:rect('.ks-mobile-zoom'),history:rect('.ks-mobile-history'),
    topVisible:visible('.ks-top'),bottomVisible:visible('.ks-bottom'),railVisible:visible('.ks-mobile-rail'),zoomVisible:visible('.ks-mobile-zoom'),historyVisible:visible('.ks-mobile-history'),
    railButtons:root?.querySelectorAll('.ks-mobile-rail button').length||0,
    bottomTabs:root?.querySelectorAll('.ks-tabs [data-tab]').length||0,
    deckDisplay:getComputedStyle(root?.querySelector('.ks-deck')).display,
    activeAssets:root?.querySelector('.ks-mobile-pane[data-pane="assets"]')?.classList.contains('on')||false,
    lockOwners:window.KeloInputLocks?.snapshot?.().owners||[]
  };
});
if(!opened.shell||opened.hub)throw new Error('STUDIO_WORLD_WORKSPACE_NOT_OPEN');
if(!opened.lockOwners.includes('kelo-studio'))throw new Error('STUDIO_FOUNDATION_LOCK_NOT_ACQUIRED');
if(!opened.topVisible||!opened.bottomVisible||!opened.railVisible||!opened.zoomVisible||!opened.historyVisible)throw new Error(`STUDIO_MOBILE_CHROME_MISSING:${JSON.stringify(opened)}`);
if(opened.railButtons!==5||opened.bottomTabs!==4)throw new Error(`STUDIO_MOBILE_NAV_CONTRACT:${opened.railButtons}/${opened.bottomTabs}`);
if(opened.deckDisplay!=='none')throw new Error(`STUDIO_OLD_DECK_STILL_VISIBLE:${opened.deckDisplay}`);
if(!opened.activeAssets)throw new Error('STUDIO_ASSETS_NOT_DEFAULT_MOBILE_PANE');
if(opened.top?.height>72||opened.rail?.width>76||opened.bottom?.height>370)throw new Error(`STUDIO_MOBILE_CHROME_TOO_HEAVY:${JSON.stringify({top:opened.top,rail:opened.rail,bottom:opened.bottom})}`);

const assetsRail=page.locator('#kelo-studio-live .ks-mobile-rail [data-tab="assets"]');
await assetsRail.click();
const rows=page.locator('#kelo-studio-live .ks-mobile-pane[data-pane="assets"] [data-asset]');
if(await rows.count()<1)throw new Error('STUDIO_ASSET_BROWSER_EMPTY');
await rows.first().waitFor({state:'visible',timeout:5000});
const beforePlacements=await page.evaluate(()=>window.KELO_PROPERTY_SYSTEM?.getPlacements?.('parcel:world:editor')?.length||0);
await rows.first().click();
await page.waitForFunction(()=>document.querySelector('#kelo-studio-live')?.dataset.compact==='asset',null,{timeout:5000});
if(!await page.locator('#kelo-studio-live .ks-bottom').isVisible())throw new Error('STUDIO_ASSET_SELECTION_COLLAPSED_REFERENCE_SHEET');

const canvas=page.locator('#game-canvas'),box=await canvas.boundingBox();
if(!box)throw new Error('STUDIO_GAME_CANVAS_MISSING');
const safePoint=(fx,fy)=>({x:Math.round(box.x+box.width*fx),y:Math.round(box.y+Math.min(box.height*fy,470))});
const place=safePoint(.50,.28);
await page.mouse.click(place.x,place.y);
await page.waitForFunction(()=>document.querySelector('#kelo-studio-live .ks-mobile-history [data-act="undo"]')?.disabled===false,null,{timeout:10000});
const afterPlace=await page.evaluate(()=>({placements:window.KELO_PROPERTY_SYSTEM?.getPlacements?.('parcel:world:editor')?.length||0,status:document.querySelector('#kelo-studio-live .ks-status')?.textContent||''}));
if(afterPlace.placements<=beforePlacements)throw new Error(`STUDIO_PLACE_DID_NOT_COMMIT:${beforePlacements}->${afterPlace.placements}`);

await page.locator('#kelo-studio-live .ks-mobile-rail [data-tab="paint"]').click();
await page.locator('#kelo-studio-live .ks-mobile-pane[data-pane="paint"] [data-mode="move"]').click();
await page.mouse.move(place.x,place.y);await page.mouse.down();await page.mouse.move(place.x+48,place.y+48,{steps:4});await page.mouse.up();
await page.waitForFunction(()=>/·\s*2\s+undo/.test(document.querySelector('#kelo-studio-live .ks-status')?.textContent||''),null,{timeout:10000});
await page.locator('#kelo-studio-live .ks-mobile-history [data-act="undo"]').click();
await page.waitForFunction(()=>/·\s*1\s+undo/.test(document.querySelector('#kelo-studio-live .ks-status')?.textContent||''),null,{timeout:10000});
await page.locator('#kelo-studio-live .ks-mobile-history [data-act="redo"]').click();
await page.waitForFunction(()=>/·\s*2\s+undo/.test(document.querySelector('#kelo-studio-live .ks-status')?.textContent||''),null,{timeout:10000});

const surfacePoint=async(clientX,clientY)=>page.evaluate(({clientX,clientY})=>{
  const p=window.KeloCamera?.screenToWorld?.(clientX,clientY)||(typeof window.screenToWorld==='function'?window.screenToWorld(clientX,clientY):{x:clientX,y:clientY});
  const t=Math.max(1,Number(window.KELO_WORLD_BUILDER?.tileSize)||32);
  return{x:Math.floor(Math.max(0,p.x)/t)*t,y:Math.floor(Math.max(0,p.y)/t)*t,t};
},{clientX,clientY});
const groundScreen=safePoint(.62,.34),roadScreen=safePoint(.76,.34),collisionScreen=safePoint(.62,.43);
const groundWorld=await surfacePoint(groundScreen.x,groundScreen.y),roadWorld=await surfacePoint(roadScreen.x,roadScreen.y),collisionWorld=await surfacePoint(collisionScreen.x,collisionScreen.y);

const paintPane='#kelo-studio-live .ks-mobile-pane[data-pane="paint"]';
await page.locator(`${paintPane} [data-mode="terrain"]`).click();
await page.mouse.click(groundScreen.x,groundScreen.y);
await page.waitForFunction(({x,y})=>window.KELO_WORLD_BUILDER?.cells?.().some(c=>c.x===x&&c.y===y&&c.role!=='path'),{x:groundWorld.x,y:groundWorld.y},{timeout:10000});
const afterGround=await page.evaluate(({x,y})=>window.KELO_WORLD_BUILDER.cells().find(c=>c.x===x&&c.y===y)||null,{x:groundWorld.x,y:groundWorld.y});
if(!afterGround)throw new Error('STUDIO_GROUND_DID_NOT_COMMIT');

await page.locator(`${paintPane} [data-mode="path"]`).click();
await page.mouse.click(roadScreen.x,roadScreen.y);
await page.waitForFunction(({x,y})=>window.KELO_WORLD_BUILDER?.cells?.().some(c=>c.x===x&&c.y===y&&c.role==='path'),{x:roadWorld.x,y:roadWorld.y},{timeout:10000});
const afterRoad=await page.evaluate(({x,y})=>window.KELO_WORLD_BUILDER.cells().find(c=>c.x===x&&c.y===y)||null,{x:roadWorld.x,y:roadWorld.y});
if(afterRoad?.role!=='path')throw new Error('STUDIO_ROAD_DID_NOT_COMMIT');

const beforeCollisions=await page.evaluate(()=>window.KELO_WORLD_BUILDER?.collisions?.().length||0);
await page.locator(`${paintPane} [data-mode="collision"]`).click();
await page.mouse.click(collisionScreen.x,collisionScreen.y);
await page.waitForFunction(({x,y,before})=>{const list=window.KELO_WORLD_BUILDER?.collisions?.()||[];return list.length>before&&list.some(c=>c.x===x&&c.y===y);},{x:collisionWorld.x,y:collisionWorld.y,before:beforeCollisions},{timeout:10000});
const afterCollision=await page.evaluate(({x,y})=>window.KELO_WORLD_BUILDER.collisions().find(c=>c.x===x&&c.y===y)||null,{x:collisionWorld.x,y:collisionWorld.y});
if(!afterCollision)throw new Error('STUDIO_COLLISION_DID_NOT_COMMIT');

await page.locator('#kelo-studio-live .ks-mobile-history [data-act="undo"]').click();
await page.waitForFunction(before=>window.KELO_WORLD_BUILDER?.collisions?.().length===before,beforeCollisions,{timeout:10000});

await page.locator(`${paintPane} [data-mode="terrain"]`).click();
await page.locator(`${paintPane} [data-act="erase"]`).click();
await page.mouse.click(groundScreen.x,groundScreen.y);
await page.waitForFunction(({x,y})=>!window.KELO_WORLD_BUILDER?.cells?.().some(c=>c.x===x&&c.y===y),{x:groundWorld.x,y:groundWorld.y},{timeout:10000});

// Exercise phone-specific map controls and prove the snap selector remains tappable.
await page.locator('#kelo-studio-live .ks-mobile-rail [data-tab="map"]').click();
const snap=page.locator('#kelo-studio-live .ks-mobile-pane[data-pane="map"] select[data-ext="snap"]');
await snap.selectOption('16');
if(await snap.inputValue()!=='16')throw new Error('STUDIO_MOBILE_SNAP_NOT_INTERACTIVE');
await page.locator('#kelo-studio-live .ks-mobile-pane[data-pane="map"] button[data-ext="zoom-in"]').click();
await page.waitForFunction(()=>document.querySelector('#kelo-studio-live [data-mobile-zoom-label]')?.textContent!=='100%',null,{timeout:5000});

await page.locator('#kelo-studio-live .ks-top [data-act="save"]').click();
await page.waitForTimeout(250);
if(!await page.locator('#kelo-studio-live').isVisible())throw new Error('STUDIO_SAVE_CLOSED_SESSION');

await page.locator('#kelo-studio-live .ks-mobile-rail [data-tab="assets"]').click();
await page.screenshot({path:'artifacts/studio-mobile-reference-open.png',fullPage:true});

await page.locator('#kelo-studio-live .ks-mobile-rail [data-tab="settings"]').click();
await page.locator('#kelo-studio-live .ks-mobile-pane[data-pane="settings"] [data-act="close"]').click();
await page.waitForFunction(()=>!document.body.classList.contains('kelo-studio-active')&&!document.getElementById('kelo-studio-live'),null,{timeout:10000});
const closed=await page.evaluate(()=>({lockOwners:window.KeloInputLocks?.snapshot?.().owners||[]}));
if(closed.lockOwners.includes('kelo-studio'))throw new Error('STUDIO_FOUNDATION_LOCK_LEAK');
if(pageErrors.length)throw new Error(`STUDIO_PAGE_ERRORS:${pageErrors.join(' | ')}`);

const report={ok:true,url:BASE,viewport:{width:390,height:844,dpr:2},deployReady,opened,placementDelta:afterPlace.placements-beforePlacements,afterPlace,moveUndoRedo:true,ground:{world:groundWorld,afterGround},road:{world:roadWorld,afterRoad},collision:{world:collisionWorld,before:beforeCollisions,afterCollision},snap16:true,phoneReference:true,save:true,closed,pageErrors};
fs.writeFileSync('artifacts/studio-mobile-reference-live.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
await browser.close();
