import fs from 'node:fs';
import { chromium } from 'playwright';

const base=process.env.AUDIT_URL||'http://127.0.0.1:8000/';
const chrome=process.env.CHROME_BIN||'/usr/bin/google-chrome';
fs.mkdirSync('artifacts',{recursive:true});

async function boot(context,url){
  const page=await context.newPage();
  const errors=[],failed=[];
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  page.on('pageerror',e=>errors.push(`PAGEERROR: ${e.stack||e.message}`));
  page.on('requestfailed',r=>failed.push({url:r.url(),error:r.failure()?.errorText||'failed'}));
  await page.goto(url,{waitUntil:'networkidle',timeout:45000});
  await page.waitForFunction(()=>window.KELO_PROPERTY_SYSTEM&&window.KELO_PROPERTY_EDITOR&&window.KELO_PROPERTY_CATALOG,{timeout:15000});
  return{page,errors,failed};
}

const browser=await chromium.launch({headless:true,executablePath:chrome,args:['--no-sandbox','--disable-dev-shm-usage']});
const report={mobile:null,desktop:null,regularUser:null};

try{
  const mobileCtx=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
  const m=await boot(mobileCtx,`${base}?mapEditor=1&audit=${Date.now()}`);
  const {page}=m;
  await page.evaluate(()=>window.KELO_PROPERTY_EDITOR.open('world'));
  await page.waitForSelector('#kelo-property-editor',{state:'visible'});
  await page.waitForSelector('.pe-card');
  const layout=await page.locator('#kelo-property-editor').boundingBox();
  if(!layout||layout.x<0||layout.y<0||layout.x+layout.width>390.5||layout.y+layout.height>844.5)throw new Error(`Mobile editor overflows viewport: ${JSON.stringify(layout)}`);
  const audit=await page.evaluate(()=>({editor:window.KELO_PROPERTY_EDITOR_AUDIT,extras:window.KELO_PROPERTY_EDITOR_EXTRAS,system:window.KELO_PROPERTY_AUDIT,catalog:window.KELO_PROPERTY_CATALOG.list().length}));
  if(!audit.editor?.mobile||!audit.editor?.worldEditor||!audit.editor?.unitAware)throw new Error('Editor audit flags missing');
  if(!audit.extras?.thumbnails||!audit.extras?.moveWithoutConsumingUnits)throw new Error('Editor extras missing');
  if(audit.catalog<1)throw new Error('Property catalog empty');
  await page.waitForFunction(()=>document.querySelectorAll('.pe-thumb').length>0,{timeout:10000});
  await page.locator('.pe-card').first().click();
  const beforeWorld=await page.evaluate(()=>window.KELO_PROPERTY_SYSTEM.getPlacements(window.KELO_PROPERTY_EDITOR.parcelId).length);
  await page.mouse.click(195,150);
  await page.waitForFunction(n=>window.KELO_PROPERTY_SYSTEM.getPlacements(window.KELO_PROPERTY_EDITOR.parcelId).length>n,beforeWorld,{timeout:5000});
  const afterWorld=await page.evaluate(()=>window.KELO_PROPERTY_SYSTEM.getPlacements(window.KELO_PROPERTY_EDITOR.parcelId).length);
  if(afterWorld!==beforeWorld+1)throw new Error('World placement did not add exactly one object');
  await page.screenshot({path:'artifacts/property-editor-mobile-world.png',fullPage:false});

  await page.evaluate(()=>window.KELO_PROPERTY_EDITOR.open('parcel'));
  await page.waitForTimeout(300);
  await page.waitForSelector('.pe-card');
  const firstAsset=await page.evaluate(()=>window.KELO_PROPERTY_CATALOG.list()[0].id);
  await page.evaluate(async aid=>{await window.KELO_PROPERTY_SYSTEM.request('grantUnits',{ownerId:window.KELO_PROPERTY_SYSTEM.playerId(),assetId:aid,quantity:2,developer:true});},firstAsset);
  await page.locator('.pe-card').first().click();
  const parcelId=await page.evaluate(()=>window.KELO_PROPERTY_EDITOR.parcelId);
  const beforeParcel=await page.evaluate(pid=>window.KELO_PROPERTY_SYSTEM.getPlacements(pid).length,parcelId);
  await page.mouse.click(195,165);
  await page.waitForFunction(({pid,n})=>window.KELO_PROPERTY_SYSTEM.getPlacements(pid).length>n,{pid:parcelId,n:beforeParcel},{timeout:5000});
  const placement=await page.evaluate(pid=>window.KELO_PROPERTY_SYSTEM.getPlacements(pid).at(-1),parcelId);
  const unitsBeforeMove=await page.evaluate(aid=>({owned:window.KELO_PROPERTY_SYSTEM.getOwnedUnits(aid),available:window.KELO_PROPERTY_SYSTEM.getAvailableUnits(aid),deployed:window.KELO_PROPERTY_SYSTEM.getDeployedUnits(aid)}),firstAsset);
  await page.evaluate(({pid,id})=>{const r=window.KELO_PROPERTY_SYSTEM.getPlacements(pid).find(x=>x.placementId===id);const b=window.KELO_PROPERTY_SYSTEM.placementBounds(r);const z=CONFIG.zoom||1;const sx=screenW/2+(b.x+b.w/2-camera.x)*z;const sy=screenH/2+(b.y+b.h/2-camera.y)*z;window.dispatchEvent(new PointerEvent('pointerdown',{clientX:sx,clientY:sy,bubbles:true,pointerId:77}));},{pid:parcelId,id:placement.placementId});
  await page.waitForTimeout(150);
  await page.locator('#pe-move').click();
  const posBefore=await page.evaluate(({pid,id})=>{const r=window.KELO_PROPERTY_SYSTEM.getPlacements(pid).find(x=>x.placementId===id);return{x:r.x,y:r.y};},{pid:parcelId,id:placement.placementId});
  await page.mouse.click(235,145);
  await page.waitForTimeout(250);
  const moved=await page.evaluate(({pid,id})=>window.KELO_PROPERTY_SYSTEM.getPlacements(pid).find(x=>x.placementId===id),{pid:parcelId,id:placement.placementId});
  if(moved.x===posBefore.x&&moved.y===posBefore.y)throw new Error('Move button did not move selected placement');
  const unitsAfterMove=await page.evaluate(aid=>({owned:window.KELO_PROPERTY_SYSTEM.getOwnedUnits(aid),available:window.KELO_PROPERTY_SYSTEM.getAvailableUnits(aid),deployed:window.KELO_PROPERTY_SYSTEM.getDeployedUnits(aid)}),firstAsset);
  if(JSON.stringify(unitsBeforeMove)!==JSON.stringify(unitsAfterMove))throw new Error(`Moving changed units: ${JSON.stringify({unitsBeforeMove,unitsAfterMove})}`);
  await page.locator('#pe-rotate').click();
  await page.waitForTimeout(120);
  const rotated=await page.evaluate(({pid,id})=>window.KELO_PROPERTY_SYSTEM.getPlacements(pid).find(x=>x.placementId===id),{pid:parcelId,id:placement.placementId});
  if(rotated.rotation===moved.rotation)throw new Error('Rotate button did not change rotation');
  await page.screenshot({path:'artifacts/property-editor-mobile-parcel.png',fullPage:false});
  report.mobile={layout,audit,beforeWorld,afterWorld,parcelId,unitsBeforeMove,unitsAfterMove,moved:{from:posBefore,to:{x:moved.x,y:moved.y}},rotation:rotated.rotation,errors:m.errors,failed:m.failed};
  if(m.errors.some(x=>/Kelo property|PAGEERROR/i.test(x)))throw new Error(`Property console errors: ${m.errors.join(' | ')}`);
  await mobileCtx.close();

  const desktopCtx=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1});
  const d=await boot(desktopCtx,`${base}?mapEditor=1&desktop-audit=${Date.now()}`);
  await d.page.evaluate(()=>window.KELO_PROPERTY_EDITOR.open('world'));
  await d.page.waitForSelector('#kelo-property-editor',{state:'visible'});
  const desktopBox=await d.page.locator('#kelo-property-editor').boundingBox();
  if(!desktopBox||desktopBox.width>400||desktopBox.height>900||desktopBox.x<0||desktopBox.y<0)throw new Error(`Desktop editor layout invalid: ${JSON.stringify(desktopBox)}`);
  await d.page.waitForFunction(()=>document.querySelectorAll('.pe-thumb').length>0,{timeout:10000});
  await d.page.screenshot({path:'artifacts/property-editor-desktop.png',fullPage:false});
  report.desktop={layout:desktopBox,thumbs:await d.page.locator('.pe-thumb').count(),errors:d.errors,failed:d.failed};
  await desktopCtx.close();

  const userCtx=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
  const u=await boot(userCtx,`${base}?user-audit=${Date.now()}`);
  await u.page.evaluate(()=>openSocialTool('properties'));
  await u.page.waitForSelector('#kelo-property-editor',{state:'visible'});
  const regular=await u.page.evaluate(()=>({mode:window.KELO_PROPERTY_EDITOR.mode,tabsHidden:document.getElementById('pe-tabs')?.classList.contains('pe-hidden'),fab:!!document.getElementById('pe-fab'),parcelId:window.KELO_PROPERTY_EDITOR.parcelId}));
  if(regular.mode!=='parcel'||!regular.tabsHidden||regular.fab)throw new Error(`Regular user exposed developer editor: ${JSON.stringify(regular)}`);
  await u.page.screenshot({path:'artifacts/property-editor-regular-user.png',fullPage:false});
  report.regularUser={...regular,errors:u.errors,failed:u.failed};
  await userCtx.close();

  fs.writeFileSync('artifacts/property-editor-browser-report.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
} finally {
  await browser.close();
}
