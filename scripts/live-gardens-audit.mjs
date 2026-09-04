import fs from 'node:fs';
import { chromium } from 'playwright';

const base=process.env.AUDIT_URL||'https://kelffren.github.io/gemini/';
const expectedTitle=process.env.EXPECTED_TITLE||'Kelo World — V6.19';
const expectedWorldVersion=process.env.EXPECTED_WORLD_VERSION||'world-v1.16';
const expectedRegistryVersion=process.env.EXPECTED_REGISTRY||'1.11.1';
const expectedCompositionMode=process.env.EXPECTED_GARDENS_COMPOSITION_MODE||'registry-authored-garden-compositions-v13';
const expectedJoinMode=process.env.EXPECTED_GARDENS_JOIN_MODE||'authored-garden-endcaps-mid-variants-v3';
const expectedGardensMode=process.env.EXPECTED_GARDENS_MODE||'authored-organic-garden-overlay-atlas-v2';
fs.mkdirSync('artifacts',{recursive:true});

const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
const page=await context.newPage();
const consoleErrors=[],failedRequests=[],httpErrors=[];
page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text())});
page.on('pageerror',e=>consoleErrors.push(`PAGEERROR: ${e.stack||e.message}`));
page.on('requestfailed',r=>failedRequests.push({url:r.url(),error:r.failure()?.errorText||'failed'}));
page.on('response',r=>{if(r.status()>=400)httpErrors.push({status:r.status(),url:r.url()})});

function valid(s){
  const joins=s.joins, comp=s.composition, world=s.world;
  const atlasShape=joins&&joins.width===joins.columns*joins.tileWidth&&joins.height===joins.tileHeight&&joins.columns>=6;
  return s.title===expectedTitle&&
    s.registry?.version===expectedRegistryVersion&&
    atlasShape&&joins.mode===expectedJoinMode&&
    comp?.ready&&comp.mode===expectedCompositionMode&&comp.joinMode===expectedJoinMode&&
    comp.compositionCount>=10&&comp.fixedPlacementCount===10&&comp.declaredCellCount===41&&
    comp.navigationConflictFixCount>=13&&comp.relocatedSteppingStoneAnchor?.[0]===9&&comp.relocatedSteppingStoneAnchor?.[1]===16&&
    world?.ready&&world.version===expectedWorldVersion&&world.gardensMode===expectedGardensMode&&
    world.gardensJoinMode===expectedJoinMode&&world.gardensCompositionMode===expectedCompositionMode&&
    world.gardensCompositionCount>=10&&world.gardensFixedPlacementCount===10&&
    world.gardensLandmarkClearance==='east-fountain-footprint-v1';
}

let loaded=false,lastState=null;
for(let attempt=1;attempt<=24;attempt++){
  try{
    await page.goto(`${base}?gardens-audit=${Date.now()}-${attempt}`,{waitUntil:'networkidle',timeout:45000});
    lastState=await page.evaluate(()=>({
      title:document.title,
      registry:window.KELO_TILE_REGISTRY||null,
      joins:window.KELO_GARDENS_JOINS||null,
      composition:window.KELO_GARDENS_COMPOSITION_AUDIT||null,
      world:window.KELO_WORLD_AUDIT||null
    }));
    if(valid(lastState)){loaded=true;break;}
  }catch(e){console.log(`attempt ${attempt}: ${e.message}`)}
  await page.waitForTimeout(10000);
}
if(!loaded){
  fs.writeFileSync('artifacts/gardens-report.json',JSON.stringify({loaded,lastState,consoleErrors,failedRequests,httpErrors},null,2));
  await browser.close();
  throw new Error(`LIVE never reached current Gardens contract: ${JSON.stringify(lastState)}`);
}

consoleErrors.length=0;failedRequests.length=0;httpErrors.length=0;
await page.goto(`${base}?gardens-audit=final-${Date.now()}`,{waitUntil:'networkidle',timeout:45000});
await page.waitForTimeout(1400);
const shot=await page.evaluate(()=>{
  const c=document.getElementById('game-canvas');
  if(!c||typeof camera==='undefined'||typeof localPlayer==='undefined'||typeof render!=='function')return null;
  localPlayer.x=1510;localPlayer.y=2500;camera.x=1510;camera.y=2500;camera.targetX=1510;camera.targetY=2500;render();
  return{
    dataUrl:c.toDataURL('image/png'),
    canvas:{width:c.width,height:c.height,cssWidth:c.clientWidth,cssHeight:c.clientHeight},
    registry:window.KELO_TILE_REGISTRY||null,
    joins:window.KELO_GARDENS_JOINS||null,
    composition:window.KELO_GARDENS_COMPOSITION_AUDIT||null,
    world:window.KELO_WORLD_AUDIT||null,
    landmark:window.KELO_GARDEN_LANDMARK_AUDIT||null
  };
});
if(shot?.dataUrl?.startsWith('data:image/png;base64,'))fs.writeFileSync('artifacts/live-gardens-marble.png',Buffer.from(shot.dataUrl.split(',')[1],'base64'));
const finalState={title:await page.title(),registry:shot?.registry,joins:shot?.joins,composition:shot?.composition,world:shot?.world};
const report={loaded,finalState,canvas:shot?.canvas,landmark:shot?.landmark,consoleErrors,failedRequests,httpErrors};
fs.writeFileSync('artifacts/gardens-report.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
await browser.close();

if(!shot?.dataUrl?.startsWith('data:image/png;base64,'))throw new Error('Gardens screenshot missing');
if(!valid(finalState))throw new Error(`Final Gardens contract invalid: ${JSON.stringify(finalState)}`);
if(shot.canvas?.cssWidth!==390||shot.canvas?.cssHeight!==844||shot.canvas?.width!==780||shot.canvas?.height!==1688)throw new Error(`Mobile canvas mismatch: ${JSON.stringify(shot.canvas)}`);
if(!shot.landmark?.ready||shot.landmark?.failed)throw new Error(`Gardens landmark invalid: ${JSON.stringify(shot.landmark)}`);
if(consoleErrors.length)throw new Error(`Console/page errors: ${JSON.stringify(consoleErrors)}`);
if(failedRequests.length)throw new Error(`Failed requests: ${JSON.stringify(failedRequests)}`);
if(httpErrors.length)throw new Error(`HTTP errors: ${JSON.stringify(httpErrors)}`);
