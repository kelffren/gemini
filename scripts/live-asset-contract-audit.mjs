import fs from 'node:fs';
import { chromium } from 'playwright';

const base=process.env.AUDIT_URL||'https://kelffren.github.io/gemini/';
const manifestUrl=new URL('src/environment/art-asset-manifest.json',base).toString();
fs.mkdirSync('artifacts',{recursive:true});

const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
const page=await context.newPage();
const consoleErrors=[],failedRequests=[],httpErrors=[];
page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text())});
page.on('pageerror',e=>consoleErrors.push(`PAGEERROR: ${e.stack||e.message}`));
page.on('requestfailed',r=>failedRequests.push({url:r.url(),error:r.failure()?.errorText||'failed'}));
page.on('response',r=>{if(r.status()>=400)httpErrors.push({status:r.status(),url:r.url()})});

let manifest=null;
for(let attempt=1;attempt<=24;attempt++){
  try{
    const response=await page.request.get(`${manifestUrl}?audit-bust=${Date.now()}-${attempt}`);
    if(response.ok()){
      const candidate=await response.json();
      if(candidate?.contractVersion==='kelo-art-asset-contract-v1'&&candidate?.worldTileSize===32&&candidate?.sampling==='nearest'&&Array.isArray(candidate?.assets)&&candidate.assets.length>=8){manifest=candidate;break;}
    }
  }catch(e){console.log(`manifest attempt ${attempt}: ${e.message}`)}
  await page.waitForTimeout(10000);
}
if(!manifest)throw new Error('LIVE never exposed kelo-art-asset-contract-v1 manifest');

consoleErrors.length=0;failedRequests.length=0;httpErrors.length=0;
await page.goto(`${base}?asset-contract-audit=${Date.now()}`,{waitUntil:'networkidle',timeout:45000});
await page.waitForTimeout(2500);
const state=await page.evaluate(()=>{const c=document.getElementById('game-canvas');return{title:document.title,canvas:c?{width:c.width,height:c.height,cssWidth:c.clientWidth,cssHeight:c.clientHeight}:null,world:window.KELO_WORLD_AUDIT?.version||null,registry:window.KELO_TILE_REGISTRY?.version||null};});
await page.screenshot({path:'artifacts/live-asset-contract-mobile.png',fullPage:false});

const report={
  manifest:{contractVersion:manifest.contractVersion,worldTileSize:manifest.worldTileSize,sampling:manifest.sampling,assetCount:manifest.assets.length,ids:manifest.assets.map(a=>a.id)},
  state,
  consoleErrors,failedRequests,httpErrors
};
fs.writeFileSync('artifacts/asset-contract-report.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
await browser.close();

if(state.canvas?.cssWidth!==390||state.canvas?.cssHeight!==844)throw new Error(`Unexpected mobile CSS viewport/canvas: ${JSON.stringify(state.canvas)}`);
if(state.canvas?.width!==780||state.canvas?.height!==1688)throw new Error(`Unexpected physical canvas: ${JSON.stringify(state.canvas)}`);
if(consoleErrors.length)throw new Error(`Console/page errors: ${JSON.stringify(consoleErrors)}`);
if(failedRequests.length)throw new Error(`Failed requests: ${JSON.stringify(failedRequests)}`);
if(httpErrors.length)throw new Error(`HTTP errors: ${JSON.stringify(httpErrors)}`);
