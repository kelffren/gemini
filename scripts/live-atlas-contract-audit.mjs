import fs from 'node:fs';
import { chromium } from 'playwright';

const base=process.env.AUDIT_URL||'https://kelffren.github.io/gemini/';
const contractUrl=new URL('src/environment/atlas-contract.js',base).toString();
fs.mkdirSync('artifacts',{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
const page=await context.newPage();
const consoleErrors=[],failedRequests=[],httpErrors=[];
page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text())});
page.on('pageerror',e=>consoleErrors.push(`PAGEERROR: ${e.stack||e.message}`));
page.on('requestfailed',r=>failedRequests.push({url:r.url(),error:r.failure()?.errorText||'failed'}));
page.on('response',r=>{if(r.status()>=400)httpErrors.push({status:r.status(),url:r.url()})});

let converged=false;
for(let attempt=1;attempt<=18;attempt++){
  try{
    const res=await page.request.get(`${contractUrl}?audit-bust=${Date.now()}-${attempt}`);
    if(res.ok()){
      const body=await res.text();
      if(body.includes("id:'kelo-atlas-contract-v1'")&&body.includes("version:'1.1.1'")){
        consoleErrors.length=0;failedRequests.length=0;httpErrors.length=0;
        await page.goto(`${base}?atlas-contract-audit=${Date.now()}-${attempt}`,{waitUntil:'domcontentloaded',timeout:45000});
        await page.waitForFunction(()=>window.KELO_ATLAS_AUDIT?.policyId==='kelo-atlas-contract-v1',{timeout:15000});
        await page.waitForFunction(()=>window.KELO_WORLD_AUDIT?.ready===true,{timeout:30000});
        converged=true;break;
      }
    }
  }catch(e){console.log(`deployment attempt ${attempt}: ${e.message}`)}
  await page.waitForTimeout(10000);
}
if(!converged)throw new Error('LIVE Pages never converged to atlas contract v1.1.1');
await page.waitForTimeout(1500);
const state=await page.evaluate(()=>{const c=document.getElementById('game-canvas'),a=window.KELO_ATLAS_AUDIT,p=window.KELO_ATLAS_CONTRACT?.policy;return{canvas:c?{width:c.width,height:c.height,cssWidth:c.clientWidth,cssHeight:c.clientHeight}:null,registry:window.KELO_TILE_REGISTRY?.version||null,world:window.KELO_WORLD_AUDIT?.version||null,atlas:a||null,policy:p?{id:p.id,version:p.version,maxDimension:p.maxDimension,preferredDimensions:p.preferredDimensions,loading:p.loading,unloading:p.unloading}:null};});
await page.screenshot({path:'artifacts/live-atlas-contract-mobile.png',fullPage:false});
const report={state,consoleErrors,failedRequests,httpErrors};
fs.writeFileSync('artifacts/atlas-contract-report.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
await browser.close();
if(state.canvas?.cssWidth!==390||state.canvas?.cssHeight!==844)throw new Error(`Unexpected CSS canvas ${JSON.stringify(state.canvas)}`);
if(state.canvas?.width!==780||state.canvas?.height!==1688)throw new Error(`Unexpected backing canvas ${JSON.stringify(state.canvas)}`);
if(state.atlas?.violations?.length)throw new Error(`Atlas violations: ${JSON.stringify(state.atlas.violations)}`);
if((state.atlas?.atlasCount||0)<8)throw new Error(`Unexpected atlas count ${state.atlas?.atlasCount}`);
if(consoleErrors.length)throw new Error(`Console/page errors: ${JSON.stringify(consoleErrors)}`);
if(failedRequests.length)throw new Error(`Failed requests: ${JSON.stringify(failedRequests)}`);
if(httpErrors.length)throw new Error(`HTTP errors: ${JSON.stringify(httpErrors)}`);