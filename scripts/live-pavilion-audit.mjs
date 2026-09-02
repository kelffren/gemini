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
let loaded=false;
for(let attempt=1;attempt<=24;attempt++){
  try{
    await page.goto(`${base}?pavilion-audit=${Date.now()}-${attempt}`,{waitUntil:'networkidle',timeout:45000});
    const s=await page.evaluate(()=>({p:window.KELO_MARKET_PAVILION||null,world:window.KELO_WORLD_AUDIT||null}));
    if(s.world?.ready&&s.p?.ready&&s.p?.rendererWrapped&&s.p?.depthWrapped&&s.p?.legacyHidden&&!s.p?.failed){loaded=true;break}
  }catch(e){console.log(`attempt ${attempt}: ${e.message}`)}
  await page.waitForTimeout(10000);
}
consoleErrors.length=0;failedRequests.length=0;httpErrors.length=0;
await page.goto(`${base}?pavilion-audit=final-${Date.now()}`,{waitUntil:'networkidle',timeout:45000});
await page.waitForTimeout(3500);
const capture=await page.evaluate(()=>{
  if(typeof camera==='undefined'||typeof localPlayer==='undefined'||typeof render!=='function')return null;
  const c=document.getElementById('game-canvas');if(!c)return null;
  localPlayer.x=1400;localPlayer.y=1860;camera.x=1400;camera.y=1870;camera.targetX=1400;camera.targetY=1870;render();
  const px=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
  let stone=0,roof=0,gold=0,glass=0;
  for(let i=0;i<px.length;i+=4){const r=px[i],g=px[i+1],b=px[i+2],a=px[i+3];if(a<200)continue;if((r===225&&g===214&&b===184)||(r===241&&g===232&&b===205))stone++;if((r===45&&g===84&&b===78)||(r===61&&g===111&&b===100))roof++;if(r===210&&g===165&&b===72)gold++;if((r===90&&g===176&&b===178)||(r===151&&g===220&&b===210))glass++;}
  return{dataUrl:c.toDataURL('image/png'),occluding:!!window.KELO_MARKET_PAVILION?.isOccluding?.(localPlayer),state:window.KELO_MARKET_PAVILION||null,stone,roof,gold,glass};
});
if(capture?.dataUrl?.startsWith('data:image/png;base64,'))fs.writeFileSync('artifacts/live-market-pavilion.png',Buffer.from(capture.dataUrl.split(',')[1],'base64'));
const report={loaded,capture: capture?{occluding:capture.occluding,state:capture.state,stone:capture.stone,roof:capture.roof,gold:capture.gold,glass:capture.glass}:null,consoleErrors,failedRequests,httpErrors};
fs.writeFileSync('artifacts/pavilion-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
await browser.close();
if(!loaded)throw new Error('Market pavilion did not become ready on LIVE');
if(!capture?.dataUrl?.startsWith('data:image/png;base64,')||!capture.occluding)throw new Error('Pavilion depth capture failed');
if(!capture.state?.legacyHidden||!capture.state?.rendererWrapped||!capture.state?.depthWrapped||capture.state?.failed)throw new Error('Pavilion runtime contract invalid');
if(capture.stone<200||capture.roof<100||capture.gold<30||capture.glass<40)throw new Error(`Pavilion authored pixels missing: ${JSON.stringify({stone:capture.stone,roof:capture.roof,gold:capture.gold,glass:capture.glass})}`);
if(consoleErrors.length)throw new Error(`Console/page errors: ${JSON.stringify(consoleErrors)}`);
if(failedRequests.length)throw new Error(`Failed requests: ${JSON.stringify(failedRequests)}`);
if(httpErrors.length)throw new Error(`HTTP errors: ${JSON.stringify(httpErrors)}`);
