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

let state=null;
for(let attempt=1;attempt<=18;attempt++){
  await page.goto(`${base}?blank-world-audit=${Date.now()}-${attempt}`,{waitUntil:'networkidle',timeout:45000});
  await page.waitForTimeout(900);
  state=await page.evaluate(()=>({
    reset:window.KELO_WORLD_DECORATION_RESET===true,
    rendererReset:window.KELO_WORLD_RENDERER?.decorationReset===true,
    layerAudit:window.KELO_ENVIRONMENT_LAYER_AUDIT||null,
    propAudit:window.KELO_GENERIC_PROP_AUDIT||null,
    prefabAudit:window.KELO_PREFAB_AUDIT||null
  }));
  if(state.reset&&state.rendererReset&&state.layerAudit?.decorationReset===true&&state.propAudit?.decorationReset===true&&state.prefabAudit?.decorationReset===true)break;
  await page.waitForTimeout(8000);
}

const shot=await page.evaluate(()=>{
  const c=document.getElementById('game-canvas');
  if(!c||typeof camera==='undefined'||typeof localPlayer==='undefined'||typeof render!=='function')return null;
  localPlayer.x=1800;localPlayer.y=1600;camera.x=1800;camera.y=1600;camera.targetX=1800;camera.targetY=1600;render();
  const ctx=c.getContext('2d');
  const points=[[40,80],[c.width-40,80],[40,c.height-100],[c.width-40,c.height-100],[Math.floor(c.width/2),Math.floor(c.height/2)-260]];
  const samples=points.map(([x,y])=>({x,y,rgba:Array.from(ctx.getImageData(x,y,1,1).data)}));
  return {dataUrl:c.toDataURL('image/png'),canvas:{width:c.width,height:c.height,cssWidth:c.clientWidth,cssHeight:c.clientHeight},samples,state:{reset:window.KELO_WORLD_DECORATION_RESET===true,rendererReset:window.KELO_WORLD_RENDERER?.decorationReset===true,layerAudit:window.KELO_ENVIRONMENT_LAYER_AUDIT||null,propAudit:window.KELO_GENERIC_PROP_AUDIT||null,prefabAudit:window.KELO_PREFAB_AUDIT||null}};
});
if(shot?.dataUrl?.startsWith('data:image/png;base64,'))fs.writeFileSync('artifacts/live-blank-world-390x844.png',Buffer.from(shot.dataUrl.split(',')[1],'base64'));
const report={state:shot?.state||state,canvas:shot?.canvas,samples:shot?.samples,consoleErrors,failedRequests,httpErrors};
fs.writeFileSync('artifacts/blank-world-report.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
await browser.close();

const s=shot?.state||state;
if(!shot?.dataUrl?.startsWith('data:image/png;base64,'))throw new Error('Blank-world mobile screenshot missing');
if(!s?.reset||!s?.rendererReset)throw new Error(`Blank-world reset flags missing: ${JSON.stringify(s)}`);
if(s.layerAudit?.mode!=='blank-world-decoration-reset-v1'||s.layerAudit?.decorationReset!==true)throw new Error(`Layer reset audit invalid: ${JSON.stringify(s.layerAudit)}`);
if(s.propAudit?.decorationReset!==true||s.propAudit?.registeredColliderCount!==0)throw new Error(`Decorative prop colliders still active: ${JSON.stringify(s.propAudit)}`);
if(s.prefabAudit?.decorationReset!==true||s.prefabAudit?.registeredColliderCount!==0)throw new Error(`Decorative prefab colliders still active: ${JSON.stringify(s.prefabAudit)}`);
if(shot.canvas?.cssWidth!==390||shot.canvas?.cssHeight!==844||shot.canvas?.width!==780||shot.canvas?.height!==1688)throw new Error(`Mobile canvas mismatch: ${JSON.stringify(shot.canvas)}`);
const whiteSamples=(shot.samples||[]).filter(p=>p.rgba[0]>=248&&p.rgba[1]>=248&&p.rgba[2]>=248&&p.rgba[3]>=250).length;
if(whiteSamples<4)throw new Error(`World is not predominantly blank white at safe sample points: ${JSON.stringify(shot.samples)}`);
if(consoleErrors.length)throw new Error(`Console/page errors: ${JSON.stringify(consoleErrors)}`);
if(failedRequests.length)throw new Error(`Failed requests: ${JSON.stringify(failedRequests)}`);
if(httpErrors.length)throw new Error(`HTTP errors: ${JSON.stringify(httpErrors)}`);
console.log('BLANK_WORLD_LIVE_OK');