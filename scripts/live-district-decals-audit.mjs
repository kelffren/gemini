import fs from 'node:fs';
import { chromium } from 'playwright';
const base=process.env.AUDIT_URL||'https://kelffren.github.io/gemini/';
const expectedTitle=process.env.EXPECTED_TITLE||'';
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
    await page.goto(`${base}?district-decals-audit=${Date.now()}-${attempt}`,{waitUntil:'networkidle',timeout:45000});
    const state=await page.evaluate(()=>({title:document.title,registry:window.KELO_TILE_REGISTRY?.version||null,decals:window.KELO_DISTRICT_DECAL_AUDIT||null,world:window.KELO_WORLD_AUDIT||null}));
    if((!expectedTitle||state.title===expectedTitle)&&state.registry==='1.11.0'&&state.decals?.ready&&state.decals?.assetLoaded&&!state.decals?.failed&&state.decals?.placementCount===13&&state.world?.ready){loaded=true;break;}
  }catch(e){console.log(`attempt ${attempt}: ${e.message}`)}
  await page.waitForTimeout(10000);
}
consoleErrors.length=0;failedRequests.length=0;httpErrors.length=0;
await page.goto(`${base}?district-decals-audit=final-${Date.now()}`,{waitUntil:'networkidle',timeout:45000});
await page.waitForTimeout(2000);
const capture=await page.evaluate(()=>{
  const c=document.getElementById('game-canvas');
  if(!c||typeof camera==='undefined'||typeof localPlayer==='undefined'||typeof render!=='function')return null;
  localPlayer.x=1664;localPlayer.y=2440;camera.x=1664;camera.y=2440;camera.targetX=1664;camera.targetY=2440;render();
  const px=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
  let petalPink=0,petalBlue=0,leafGreen=0,brass=0;
  for(let i=0;i<px.length;i+=4){
    const r=px[i],g=px[i+1],b=px[i+2],a=px[i+3];if(a<180)continue;
    if(r>215&&g>95&&g<190&&b>145)petalPink++;
    if(r>105&&r<180&&g>120&&g<190&&b>190)petalBlue++;
    if(r>55&&r<150&&g>135&&g<220&&b<135)leafGreen++;
    if(r>150&&r<225&&g>115&&g<190&&b<125)brass++;
  }
  return{dataUrl:c.toDataURL('image/png'),petalPink,petalBlue,leafGreen,brass,decals:window.KELO_DISTRICT_DECAL_AUDIT||null,registry:window.KELO_TILE_REGISTRY?.version||null};
});
if(capture?.dataUrl?.startsWith('data:image/png;base64,'))fs.writeFileSync('artifacts/live-district-decals.png',Buffer.from(capture.dataUrl.split(',')[1],'base64'));
const report={loaded,capture:capture?{petalPink:capture.petalPink,petalBlue:capture.petalBlue,leafGreen:capture.leafGreen,brass:capture.brass,decals:capture.decals,registry:capture.registry}:null,consoleErrors,failedRequests,httpErrors};
fs.writeFileSync('artifacts/district-decals-report.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
await browser.close();
if(!loaded)throw new Error('LIVE never reached district decal contract');
if(!capture?.dataUrl?.startsWith('data:image/png;base64,'))throw new Error('District decal screenshot missing');
if(capture.registry!=='1.11.0'||!capture.decals?.ready||!capture.decals?.assetLoaded||capture.decals?.failed||capture.decals?.mode!=='authored-placement-layer-v1'||capture.decals?.placementCount!==13)throw new Error(`District decal contract invalid: ${JSON.stringify(capture?.decals)}`);
if(capture.decals.visiblePlacementCount<1)throw new Error('No authored district decals were visible in Gardens capture');
if((capture.petalPink+capture.petalBlue)<3)throw new Error(`Garden petal pixels not visible enough: ${JSON.stringify(capture)}`);
if(consoleErrors.length)throw new Error(`Console/page errors: ${JSON.stringify(consoleErrors)}`);
if(failedRequests.length)throw new Error(`Failed requests: ${JSON.stringify(failedRequests)}`);
if(httpErrors.length)throw new Error(`HTTP errors: ${JSON.stringify(httpErrors)}`);