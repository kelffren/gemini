import fs from 'node:fs';
import { chromium } from 'playwright';

const base=process.env.AUDIT_URL||'https://kelffren.github.io/gemini/';
const expectedWorld=process.env.EXPECTED_WORLD||'world-v1.2';
const expectedRegistry=process.env.EXPECTED_REGISTRY||'1.10.3';
fs.mkdirSync('artifacts',{recursive:true});

const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
const page=await context.newPage();
const consoleErrors=[],failedRequests=[],httpErrors=[];
page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text())});
page.on('pageerror',e=>consoleErrors.push(`PAGEERROR: ${e.stack||e.message}`));
page.on('requestfailed',r=>failedRequests.push({url:r.url(),error:r.failure()?.errorText||'failed'}));
page.on('response',r=>{if(r.status()>=400)httpErrors.push({status:r.status(),url:r.url()})});

let loaded=false,title='';
for(let attempt=1;attempt<=24;attempt++){
  try{
    await page.goto(`${base}?world-audit=${Date.now()}-${attempt}`,{waitUntil:'networkidle',timeout:45000});
    title=await page.title();
    const d=await page.evaluate(()=>({world:window.KELO_WORLD_AUDIT||null,registry:window.KELO_TILE_REGISTRY?.version||null,compose:window.KELO_LUXE_COMPOSE||null,kiosk:window.KELO_LUXE_KIOSK||null}));
    if(d.world?.ready&&d.world?.version===expectedWorld&&d.world?.assetLoaded&&d.world?.transitionAssetLoaded&&d.world?.roadTransitionMode==='authored-road-edge-overlay-v1'&&d.registry===expectedRegistry&&d.kiosk?.ready&&d.kiosk?.depthWrapped&&d.kiosk?.depthOcclusion&&d.kiosk?.depthMode==='building-base-y-occlusion-v1'&&d.kiosk?.source==='tile-registry-architecture-prefab'&&d.kiosk?.prefabId==='luxe-boutique-central'&&(!d.compose||d.compose.disabled===true)){loaded=true;break}
    console.log(`attempt ${attempt}: world=${d.world?.version||'missing'} registry=${d.registry||'missing'} kiosk=${d.kiosk?.version||'missing'} source=${d.kiosk?.source||'missing'} depth=${d.kiosk?.depthMode||'missing'}`);
  }catch(err){console.log(`attempt ${attempt}: ${err.message}`)}
  await page.waitForTimeout(10000);
}

consoleErrors.length=0;failedRequests.length=0;httpErrors.length=0;
await page.goto(`${base}?world-audit=final-${Date.now()}`,{waitUntil:'networkidle',timeout:45000});
await page.waitForTimeout(3500);
const state=await page.evaluate(()=>({
  title:document.title,
  world:window.KELO_WORLD_AUDIT||null,
  registryVersion:window.KELO_TILE_REGISTRY?.version||null,
  architecture:window.KELO_TILE_REGISTRY?.styles?.architecture||null,
  rural:window.KELO_RURAL_GROUND_AUDIT||null,
  landmarks:window.KELO_RURAL_LANDMARK_AUDIT||null,
  kiosk:window.KELO_LUXE_KIOSK||null,
  compose:window.KELO_LUXE_COMPOSE||null,
  canvas:(()=>{const c=document.getElementById('game-canvas');return c?{width:c.width,height:c.height,cssWidth:c.clientWidth,cssHeight:c.clientHeight}:null})()
}));
await page.screenshot({path:'artifacts/live-mobile.png',fullPage:false});
const architectureFrame=await page.evaluate(()=>{
  if(typeof camera==='undefined'||typeof localPlayer==='undefined'||typeof render!=='function')return null;
  const c=document.getElementById('game-canvas');if(!c)return null;
  localPlayer.x=1440;localPlayer.y=1300;camera.x=1440;camera.y=1300;camera.targetX=1440;camera.targetY=1300;render();
  return {dataUrl:c.toDataURL('image/png'),occluding:!!window.KELO_LUXE_KIOSK?.isOccluding?.(localPlayer)};
});
if(architectureFrame?.dataUrl?.startsWith('data:image/png;base64,'))fs.writeFileSync('artifacts/live-architecture.png',Buffer.from(architectureFrame.dataUrl.split(',')[1],'base64'));
fs.writeFileSync('artifacts/report.json',JSON.stringify({loaded,title,expectedWorld,expectedRegistry,state,architectureOccluding:architectureFrame?.occluding||false,consoleErrors,failedRequests,httpErrors},null,2));
console.log(JSON.stringify({loaded,title,expectedWorld,expectedRegistry,state,architectureOccluding:architectureFrame?.occluding||false,consoleErrors,failedRequests,httpErrors},null,2));
await browser.close();

if(!loaded)throw new Error(`LIVE never reached ${expectedWorld} / registry ${expectedRegistry} with architecture depth`);
if(!state.world?.ready||state.world?.version!==expectedWorld||!state.world?.assetLoaded||!state.world?.transitionAssetLoaded)throw new Error('World renderer or authored transition atlas not ready');
if(state.world?.roadTransitionMode!=='authored-road-edge-overlay-v1')throw new Error(`Unexpected road transition mode: ${state.world?.roadTransitionMode}`);
if(state.world?.chunkSize!==512||state.world?.districtCount<5||state.world?.ruralRoadMode!=='farm-bypass-v1')throw new Error('World geometry contract regressed');
if(state.registryVersion!==expectedRegistry)throw new Error(`Registry mismatch ${state.registryVersion} !== ${expectedRegistry}`);
if(state.architecture?.mode!=='authored-layered-raster-v1'||state.architecture?.depthMode!=='building-base-y-occlusion-v1'||state.architecture?.prefabContract!=='registry-asset-placement-collision-v1')throw new Error('Architecture registry contract missing');
if(!state.kiosk?.ready||state.kiosk?.failed||!state.kiosk?.rendererWrapped||!state.kiosk?.depthWrapped||!state.kiosk?.depthOcclusion||state.kiosk?.source!=='tile-registry-architecture-prefab'||state.kiosk?.prefabId!=='luxe-boutique-central')throw new Error('Authored boutique architecture prefab layer invalid');
if(!architectureFrame?.dataUrl?.startsWith('data:image/png;base64,')||!architectureFrame?.occluding)throw new Error('Architecture depth screenshot capture failed');
if(state.compose&&state.compose.disabled!==true)throw new Error('Rejected procedural environment art is active');
if(httpErrors.length)throw new Error(`HTTP errors: ${JSON.stringify(httpErrors)}`);
if(failedRequests.length)throw new Error(`Failed requests: ${JSON.stringify(failedRequests)}`);
if(consoleErrors.length)throw new Error(`Console/page errors: ${JSON.stringify(consoleErrors)}`);
