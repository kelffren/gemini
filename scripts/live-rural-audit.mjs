import fs from 'node:fs';
import { chromium } from 'playwright';

const base=process.env.AUDIT_URL||'https://kelffren.github.io/gemini/';
fs.mkdirSync('artifacts',{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
const page=await context.newPage();
const consoleErrors=[],failedRequests=[],httpErrors=[];
page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text())});
page.on('pageerror',e=>consoleErrors.push(`PAGEERROR: ${e.stack||e.message}`));
page.on('requestfailed',r=>failedRequests.push({url:r.url(),error:r.failure()?.errorText||'failed'}));
page.on('response',r=>{if(r.status()>=400)httpErrors.push({status:r.status(),url:r.url()})});

await page.goto(`${base}?rural-edge-audit=${Date.now()}`,{waitUntil:'networkidle',timeout:45000});
await page.waitForFunction(()=>window.KELO_RURAL_LANDMARK_AUDIT?.ready===true&&window.KELO_RURAL_GROUND_AUDIT?.ready===true&&window.KELO_WORLD_AUDIT?.ready===true,null,{timeout:45000});
await page.waitForTimeout(800);
const rural=await page.evaluate(()=>{
  const c=document.getElementById('game-canvas');
  if(!c||typeof camera==='undefined'||typeof localPlayer==='undefined'||typeof render!=='function'||typeof STATE==='undefined'||!STATE.farm)return null;
  const farm=STATE.farm;
  const focusX=farm.x+farm.w/2, focusY=farm.y+farm.h/2;
  localPlayer.x=focusX;localPlayer.y=focusY;
  camera.x=focusX;camera.y=focusY;camera.targetX=focusX;camera.targetY=focusY;
  render();
  const px=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
  let ruralMaterialPixels=0;
  for(let i=0;i<px.length;i+=4){
    const r=px[i],g=px[i+1],b=px[i+2],a=px[i+3];
    if(a>200&&r>=45&&r<=190&&g>=20&&g<=140&&b<=100)ruralMaterialPixels++;
  }
  return{
    dataUrl:c.toDataURL('image/png'),
    landmark:window.KELO_RURAL_LANDMARK_AUDIT||null,
    ground:window.KELO_RURAL_GROUND_AUDIT||null,
    world:window.KELO_WORLD_AUDIT||null,
    farm:{x:farm.x,y:farm.y,w:farm.w,h:farm.h,cropCount:Array.isArray(farm.crops)?farm.crops.length:0,focusX,focusY},
    ruralMaterialPixels,
    canvas:{width:c.width,height:c.height,cssWidth:c.clientWidth,cssHeight:c.clientHeight}
  };
});
if(rural?.dataUrl?.startsWith('data:image/png;base64,'))fs.writeFileSync('artifacts/live-rural-edge.png',Buffer.from(rural.dataUrl.split(',')[1],'base64'));
const report={rural:rural?{landmark:rural.landmark,ground:rural.ground,world:rural.world,farm:rural.farm,ruralMaterialPixels:rural.ruralMaterialPixels,canvas:rural.canvas}:null,consoleErrors,failedRequests,httpErrors};
fs.writeFileSync('artifacts/rural-edge-report.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
await browser.close();
if(!rural?.dataUrl?.startsWith('data:image/png;base64,'))throw new Error('Rural screenshot evidence missing');
if(!rural.landmark?.ready||!rural.landmark?.assetLoaded||rural.landmark?.failed)throw new Error(`Rural edge layer failed: ${JSON.stringify(rural.landmark)}`);
if(rural.landmark?.mode!=='authored-low-profile-edge-clusters-v1'||rural.landmark?.clusterTileCount!==17||rural.landmark?.centerClear!==true||rural.landmark?.northRoadClear!==true)throw new Error(`Rural edge contract invalid: ${JSON.stringify(rural.landmark)}`);
if(!rural.ground?.ready||rural.ground?.fallbackActive)throw new Error('Rural ground fallback active');
if(!rural.farm||rural.farm.cropCount<4)throw new Error(`Farm state missing from visual evidence: ${JSON.stringify(rural.farm)}`);
if(rural.ruralMaterialPixels<15000)throw new Error(`Farm/edge materials are not visibly present in screenshot (${rural.ruralMaterialPixels} pixels)`);
if(consoleErrors.length)throw new Error(`Console/page errors: ${JSON.stringify(consoleErrors)}`);
if(failedRequests.length)throw new Error(`Failed requests: ${JSON.stringify(failedRequests)}`);
if(httpErrors.length)throw new Error(`HTTP errors: ${JSON.stringify(httpErrors)}`);
