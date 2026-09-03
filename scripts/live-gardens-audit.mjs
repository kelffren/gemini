import fs from 'node:fs';
import { chromium } from 'playwright';
const base=process.env.AUDIT_URL||'https://kelffren.github.io/gemini/';
const expectedTitle=process.env.EXPECTED_TITLE||'Kelo World — V6.15';
const expectedWorldVersion=process.env.EXPECTED_WORLD_VERSION||'world-v1.14';
const expectedRegistryVersion=process.env.EXPECTED_REGISTRY||'1.11.1';
const expectedGardensMode=process.env.EXPECTED_GARDENS_MODE||'authored-organic-garden-overlay-atlas-v2';
const expectedGardensJoinMode=process.env.EXPECTED_GARDENS_JOIN_MODE||'authored-garden-endcaps-v1';
const expectedGardensPathMode=process.env.EXPECTED_GARDENS_PATH_MODE||'fountain-connected-promenade-v3';
const expectedGardensFramingMode=process.env.EXPECTED_GARDENS_FRAMING_MODE||'registry-authored-modular-framing-v3';
const expectedGardensCompositionMode=process.env.EXPECTED_GARDENS_COMPOSITION_MODE||'registry-authored-garden-compositions-v2';
const expectedGardensTransitionMode=process.env.EXPECTED_GARDENS_TRANSITION_MODE||'authored-chamfered-path-topology-v1';
const expectedGardensMarbleMode=process.env.EXPECTED_GARDENS_MARBLE_MODE||'authored-eight-variant-overlay-v1';
const expectedGardensGrassRhythmMode=process.env.EXPECTED_GARDENS_GRASS_RHYTHM_MODE||'registry-profile-meadow-clusters-v1';
fs.mkdirSync('artifacts',{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
const page=await context.newPage();
await page.route(/\/src\/environment\/(world-map|tile-registry|district-decals-registry|gardens-atlas|gardens-joins|gardens-compositions)\.js/,route=>{
  const u=new URL(route.request().url());u.searchParams.set('live-audit-bust',`${Date.now()}-${Math.random()}`);route.continue({url:u.toString()});
});
const consoleErrors=[],failedRequests=[],httpErrors=[];
page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text())});
page.on('pageerror',e=>consoleErrors.push(`PAGEERROR: ${e.stack||e.message}`));
page.on('requestfailed',r=>failedRequests.push({url:r.url(),error:r.failure()?.errorText||'failed'}));
page.on('response',r=>{if(r.status()>=400)httpErrors.push({status:r.status(),url:r.url()})});
let loaded=false;
for(let attempt=1;attempt<=24;attempt++){
  try{
    await page.goto(`${base}?gardens-audit=${Date.now()}-${attempt}`,{waitUntil:'networkidle',timeout:45000});
    const s=await page.evaluate(()=>({title:document.title,world:window.KELO_WORLD_AUDIT||null,garden:window.KELO_GARDEN_LANDMARK_AUDIT||null,registry:window.KELO_TILE_REGISTRY||null,composition:window.KELO_GARDENS_COMPOSITION_AUDIT||null,joins:window.KELO_GARDENS_JOINS||null}));
    if(s.title===expectedTitle&&s.registry?.version===expectedRegistryVersion&&s.joins?.mode===expectedGardensJoinMode&&s.joins?.width===192&&s.joins?.height===32&&s.composition?.ready&&s.composition?.mode===expectedGardensCompositionMode&&s.composition?.compositionCount>=10&&s.composition?.joinMode===expectedGardensJoinMode&&s.world?.ready&&s.world?.version===expectedWorldVersion&&s.world?.gardensMode===expectedGardensMode&&s.world?.gardensJoinMode===expectedGardensJoinMode&&s.world?.gardensJoinAssetLoaded&&s.world?.marbleVariationAssetLoaded&&s.world?.marbleVariationCount===8&&s.world?.gardensMarbleMode===expectedGardensMarbleMode&&s.world?.gardensGrassRhythmMode===expectedGardensGrassRhythmMode&&s.world?.gardensPathMode===expectedGardensPathMode&&s.world?.gardensTransitionMode===expectedGardensTransitionMode&&s.world?.gardensFramingMode===expectedGardensFramingMode&&s.world?.gardensCompositionMode===expectedGardensCompositionMode&&s.world?.gardensCompositionCount>=10&&s.world?.gardensLandmarkClearance==='east-fountain-footprint-v1'&&s.world?.gardensAssetLoaded&&s.garden?.ready&&s.garden?.assetLoaded&&!s.garden?.failed&&s.garden?.atlasWidth===320&&s.garden?.atlasHeight===128&&s.garden?.prefabCount===1&&s.garden?.renderMode==='final-composite-back-actor-front-v1'){loaded=true;break;}
  }catch(e){console.log(`attempt ${attempt}: ${e.message}`)}
  await page.waitForTimeout(10000);
}
consoleErrors.length=0;failedRequests.length=0;httpErrors.length=0;
await page.goto(`${base}?gardens-audit=final-${Date.now()}`,{waitUntil:'networkidle',timeout:45000});
await page.waitForTimeout(1800);
const depthAudit=await page.evaluate(()=>{
  if(typeof camera==='undefined'||typeof localPlayer==='undefined'||typeof render!=='function')return null;
  localPlayer.x=1776;localPlayer.y=2492;camera.x=1776;camera.y=2500;camera.targetX=1776;camera.targetY=2500;render();
  return window.KELO_GARDEN_LANDMARK_AUDIT||null;
});
const shot=await page.evaluate(()=>{
  const c=document.getElementById('game-canvas');if(!c||typeof camera==='undefined'||typeof localPlayer==='undefined'||typeof render!=='function')return null;
  localPlayer.x=1510;localPlayer.y=2356;camera.x=1510;camera.y=2356;camera.targetX=1510;camera.targetY=2356;render();
  const px=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let cyan=0,ivory=0,gold=0,green=0;
  for(let i=0;i<px.length;i+=4){const r=px[i],g=px[i+1],b=px[i+2],a=px[i+3];if(a<200)continue;if(b>190&&g>150&&r<140)cyan++;if(r>195&&g>185&&b>145)ivory++;if(r>175&&g>125&&g<205&&b<105)gold++;if(g>110&&g>r*1.35&&g>b*1.15)green++;}
  return{dataUrl:c.toDataURL('image/png'),audit:window.KELO_GARDEN_LANDMARK_AUDIT||null,world:window.KELO_WORLD_AUDIT||null,composition:window.KELO_GARDENS_COMPOSITION_AUDIT||null,joins:window.KELO_GARDENS_JOINS||null,registry:window.KELO_TILE_REGISTRY||null,canvas:{width:c.width,height:c.height,cssWidth:c.clientWidth,cssHeight:c.clientHeight},cyan,ivory,gold,green};
});
if(shot?.dataUrl?.startsWith('data:image/png;base64,'))fs.writeFileSync('artifacts/live-gardens-marble.png',Buffer.from(shot.dataUrl.split(',')[1],'base64'));
const report={loaded,title:await page.title(),expectedWorldVersion,expectedRegistryVersion,expectedGardensMode,expectedGardensJoinMode,expectedGardensPathMode,expectedGardensFramingMode,expectedGardensCompositionMode,expectedGardensTransitionMode,expectedGardensMarbleMode,expectedGardensGrassRhythmMode,depthAudit,shot:shot?{audit:shot.audit,world:shot.world,composition:shot.composition,joinMode:shot.joins?.mode,registryVersion:shot.registry?.version,canvas:shot.canvas,cyan:shot.cyan,ivory:shot.ivory,gold:shot.gold,green:shot.green}:null,consoleErrors,failedRequests,httpErrors};
fs.writeFileSync('artifacts/gardens-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
await browser.close();
if(!loaded)throw new Error(`LIVE never reached Gardens contract ${expectedWorldVersion} / ${expectedGardensMode} / ${expectedGardensCompositionMode}`);
if(report.title!==expectedTitle)throw new Error(`Title mismatch ${report.title} !== ${expectedTitle}`);
if(!shot?.dataUrl?.startsWith('data:image/png;base64,'))throw new Error('Gardens screenshot missing');
if(shot.registry?.version!==expectedRegistryVersion||shot.joins?.mode!==expectedGardensJoinMode||shot.world?.version!==expectedWorldVersion||shot.world?.gardensMode!==expectedGardensMode||shot.world?.gardensJoinMode!==expectedGardensJoinMode||!shot.world?.gardensJoinAssetLoaded||!shot.world?.marbleVariationAssetLoaded||shot.world?.marbleVariationCount!==8||shot.world?.gardensMarbleMode!==expectedGardensMarbleMode||shot.world?.gardensGrassRhythmMode!==expectedGardensGrassRhythmMode||shot.world?.gardensPathMode!==expectedGardensPathMode||shot.world?.gardensTransitionMode!==expectedGardensTransitionMode||shot.world?.gardensFramingMode!==expectedGardensFramingMode||shot.world?.gardensCompositionMode!==expectedGardensCompositionMode||shot.world?.gardensCompositionCount<10||shot.world?.gardensLandmarkClearance!=='east-fountain-footprint-v1')throw new Error(`Stale Gardens world in final capture: ${JSON.stringify(shot.world)}`);
if(!shot.composition?.ready||shot.composition?.mode!==expectedGardensCompositionMode||shot.composition?.compositionCount<10||shot.composition?.joinMode!==expectedGardensJoinMode)throw new Error(`Gardens composition registry invalid: ${JSON.stringify(shot.composition)}`);
if(!depthAudit?.ready||depthAudit?.failed||depthAudit?.atlasMode!=='layered-prefab-atlas-v1'||depthAudit?.renderMode!=='final-composite-back-actor-front-v1'||depthAudit?.frontOcclusionActive!==true)throw new Error(`Gardens layered landmark invalid: ${JSON.stringify(depthAudit)}`);
if(shot.canvas?.cssWidth!==390||shot.canvas?.cssHeight!==844||shot.canvas?.width!==780||shot.canvas?.height!==1688)throw new Error(`Mobile canvas mismatch: ${JSON.stringify(shot.canvas)}`);
if(shot.ivory<1000||shot.green<5000)throw new Error(`Garden palette evidence weak: ${JSON.stringify({ivory:shot.ivory,green:shot.green})}`);
if(consoleErrors.length)throw new Error(`Console/page errors: ${JSON.stringify(consoleErrors)}`);
if(failedRequests.length)throw new Error(`Failed requests: ${JSON.stringify(failedRequests)}`);
if(httpErrors.length)throw new Error(`HTTP errors: ${JSON.stringify(httpErrors)}`);