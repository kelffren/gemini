import fs from 'node:fs';
import { chromium } from 'playwright';
const base=process.env.AUDIT_URL||'https://kelffren.github.io/gemini/';
const expectedTitle=process.env.EXPECTED_TITLE||'Kelo World — V6.10';
const expectedWorldVersion=process.env.EXPECTED_WORLD_VERSION||'world-v1.9';
const expectedGardensPathMode=process.env.EXPECTED_GARDENS_PATH_MODE||'fountain-connected-promenade-v2';
const expectedGardensFramingMode=process.env.EXPECTED_GARDENS_FRAMING_MODE||'asymmetric-garden-framing-v1';
fs.mkdirSync('artifacts',{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
const page=await context.newPage();
const consoleErrors=[],failedRequests=[],httpErrors=[];
page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text())});
page.on('pageerror',e=>consoleErrors.push(`PAGEERROR: ${e.stack||e.message}`));
page.on('requestfailed',r=>failedRequests.push({url:r.url(),error:r.failure()?.errorText||'failed'}));
page.on('response',r=>{if(r.status()>=400)httpErrors.push({status:r.status(),url:r.url()})});
let loaded=false;
for(let attempt=1;attempt<=24;attempt++){
  try{
    await page.goto(`${base}?gardens-audit=${Date.now()}-${attempt}`,{waitUntil:'networkidle',timeout:45000});
    const s=await page.evaluate(()=>({title:document.title,world:window.KELO_WORLD_AUDIT||null,garden:window.KELO_GARDEN_LANDMARK_AUDIT||null}));
    if(s.title===expectedTitle&&s.world?.ready&&s.world?.version===expectedWorldVersion&&s.world?.gardensPathMode===expectedGardensPathMode&&s.world?.gardensFramingMode===expectedGardensFramingMode&&s.world?.gardensLandmarkClearance==='east-fountain-footprint-v1'&&s.world?.gardensAssetLoaded&&s.garden?.ready&&s.garden?.assetLoaded&&!s.garden?.failed&&s.garden?.atlasWidth===320&&s.garden?.atlasHeight===128&&s.garden?.prefabCount===1&&s.garden?.renderMode==='final-composite-back-actor-front-v1'){loaded=true;break;}
  }catch(e){console.log(`attempt ${attempt}: ${e.message}`)}
  await page.waitForTimeout(10000);
}
consoleErrors.length=0;failedRequests.length=0;httpErrors.length=0;
await page.goto(`${base}?gardens-audit=final-${Date.now()}`,{waitUntil:'networkidle',timeout:45000});
await page.waitForTimeout(1800);
const shot=await page.evaluate(()=>{
  const c=document.getElementById('game-canvas');if(!c||typeof camera==='undefined'||typeof localPlayer==='undefined'||typeof render!=='function')return null;
  localPlayer.x=1776;localPlayer.y=2492;camera.x=1776;camera.y=2500;camera.targetX=1776;camera.targetY=2500;render();
  const px=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let cyan=0,ivory=0,gold=0,green=0;
  for(let i=0;i<px.length;i+=4){const r=px[i],g=px[i+1],b=px[i+2],a=px[i+3];if(a<200)continue;if(b>190&&g>150&&r<140)cyan++;if(r>195&&g>185&&b>145)ivory++;if(r>175&&g>125&&g<205&&b<105)gold++;if(g>110&&g>r*1.35&&g>b*1.15)green++;}
  return{dataUrl:c.toDataURL('image/png'),audit:window.KELO_GARDEN_LANDMARK_AUDIT||null,world:window.KELO_WORLD_AUDIT||null,canvas:{width:c.width,height:c.height,cssWidth:c.clientWidth,cssHeight:c.clientHeight},cyan,ivory,gold,green};
});
if(shot?.dataUrl?.startsWith('data:image/png;base64,'))fs.writeFileSync('artifacts/live-gardens-landmark.png',Buffer.from(shot.dataUrl.split(',')[1],'base64'));
const report={loaded,title:await page.title(),expectedWorldVersion,expectedGardensPathMode,expectedGardensFramingMode,shot:shot?{audit:shot.audit,world:shot.world,canvas:shot.canvas,cyan:shot.cyan,ivory:shot.ivory,gold:shot.gold,green:shot.green}:null,consoleErrors,failedRequests,httpErrors};
fs.writeFileSync('artifacts/gardens-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
await browser.close();
if(!loaded)throw new Error(`LIVE never reached Gardens contract ${expectedWorldVersion} / ${expectedGardensPathMode} / ${expectedGardensFramingMode}`);
if(report.title!==expectedTitle)throw new Error(`Title mismatch ${report.title} !== ${expectedTitle}`);
if(!shot?.dataUrl?.startsWith('data:image/png;base64,'))throw new Error('Gardens screenshot missing');
if(shot.world?.version!==expectedWorldVersion||shot.world?.gardensPathMode!==expectedGardensPathMode||shot.world?.gardensFramingMode!==expectedGardensFramingMode||shot.world?.gardensLandmarkClearance!=='east-fountain-footprint-v1')throw new Error(`Stale Gardens world in final capture: ${JSON.stringify(shot.world)}`);
if(!shot.audit?.ready||shot.audit?.failed||shot.audit?.atlasMode!=='layered-prefab-atlas-v1'||shot.audit?.renderMode!=='final-composite-back-actor-front-v1'||shot.audit?.frontOcclusionActive!==true)throw new Error(`Gardens layered landmark invalid: ${JSON.stringify(shot.audit)}`);
if(shot.canvas?.cssWidth!==390||shot.canvas?.cssHeight!==844||shot.canvas?.width!==780||shot.canvas?.height!==1688)throw new Error(`Mobile canvas mismatch: ${JSON.stringify(shot.canvas)}`);
if(shot.cyan<150||shot.ivory<1000||shot.gold<20||shot.green<5000)throw new Error(`Garden landmark palette evidence weak: ${JSON.stringify({cyan:shot.cyan,ivory:shot.ivory,gold:shot.gold,green:shot.green})}`);
if(consoleErrors.length)throw new Error(`Console/page errors: ${JSON.stringify(consoleErrors)}`);
if(failedRequests.length)throw new Error(`Failed requests: ${JSON.stringify(failedRequests)}`);
if(httpErrors.length)throw new Error(`HTTP errors: ${JSON.stringify(httpErrors)}`);
