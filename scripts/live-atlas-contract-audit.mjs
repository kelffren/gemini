import fs from 'node:fs';
import { chromium } from 'playwright';

const base=process.env.AUDIT_URL||'https://kelffren.github.io/gemini/';
const urls={
  atlas:new URL('src/environment/atlas-contract.js',base).toString(),
  props:new URL('src/environment/generic-props.js',base).toString(),
  prefabs:new URL('src/environment/generic-prefabs.js',base).toString()
};
fs.mkdirSync('artifacts',{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
const page=await context.newPage();
const consoleErrors=[],failedRequests=[],httpErrors=[];
page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text())});
page.on('pageerror',e=>consoleErrors.push(`PAGEERROR: ${e.stack||e.message}`));
page.on('requestfailed',r=>failedRequests.push({url:r.url(),error:r.failure()?.errorText||'failed'}));
page.on('response',r=>{if(r.status()>=400)httpErrors.push({status:r.status(),url:r.url()})});

async function bodyHas(url,tokens,attempt){
  const res=await page.request.get(`${url}?audit-bust=${Date.now()}-${attempt}`);
  if(!res.ok())return false;
  const body=await res.text();
  return tokens.every(t=>body.includes(t));
}
let converged=false;
for(let attempt=1;attempt<=18;attempt++){
  try{
    const [atlasOk,propsOk,prefabsOk]=await Promise.all([
      bodyHas(urls.atlas,["id:'kelo-atlas-contract-v1'","version:'1.1.1'"],attempt),
      bodyHas(urls.props,["generic-props-v1.5","atlas-contract-managed-v1"],attempt),
      bodyHas(urls.prefabs,["generic-prefabs-v1.3","atlas-contract-managed-v1"],attempt)
    ]);
    if(atlasOk&&propsOk&&prefabsOk){
      consoleErrors.length=0;failedRequests.length=0;httpErrors.length=0;
      await page.goto(`${base}?atlas-contract-audit=${Date.now()}-${attempt}`,{waitUntil:'domcontentloaded',timeout:45000});
      await page.waitForFunction(()=>window.KELO_ATLAS_AUDIT?.policyId==='kelo-atlas-contract-v1',{timeout:15000});
      await page.waitForFunction(()=>window.KELO_WORLD_AUDIT?.ready===true&&window.KELO_GENERIC_PROP_AUDIT?.ready===true&&window.KELO_PREFAB_AUDIT?.ready===true,{timeout:30000});
      converged=true;break;
    }
  }catch(e){console.log(`deployment attempt ${attempt}: ${e.message}`)}
  await page.waitForTimeout(10000);
}
if(!converged)throw new Error('LIVE Pages never converged to atlas contract + managed prop/prefab consumers');
await page.waitForTimeout(1500);
const state=await page.evaluate(()=>{
  const c=document.getElementById('game-canvas'),a=window.KELO_ATLAS_AUDIT,p=window.KELO_ATLAS_CONTRACT?.policy;
  return{
    canvas:c?{width:c.width,height:c.height,cssWidth:c.clientWidth,cssHeight:c.clientHeight}:null,
    registry:window.KELO_TILE_REGISTRY?.version||null,world:window.KELO_WORLD_AUDIT?.version||null,
    atlas:a||null,
    policy:p?{id:p.id,version:p.version,maxDimension:p.maxDimension,preferredDimensions:p.preferredDimensions,loading:p.loading,unloading:p.unloading}:null,
    props:{version:window.KELO_GENERIC_PROP_AUDIT?.version||null,ready:window.KELO_GENERIC_PROP_AUDIT?.ready===true,resourceMode:window.KELO_GENERIC_PROP_AUDIT?.resourceMode||null},
    prefabs:{version:window.KELO_PREFAB_AUDIT?.version||null,ready:window.KELO_PREFAB_AUDIT?.ready===true,resourceMode:window.KELO_PREFAB_AUDIT?.resourceMode||null}
  };
});
await page.screenshot({path:'artifacts/live-atlas-contract-mobile.png',fullPage:false});
const report={state,consoleErrors,failedRequests,httpErrors};
fs.writeFileSync('artifacts/atlas-contract-report.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
await browser.close();
if(state.canvas?.cssWidth!==390||state.canvas?.cssHeight!==844)throw new Error(`Unexpected CSS canvas ${JSON.stringify(state.canvas)}`);
if(state.canvas?.width!==780||state.canvas?.height!==1688)throw new Error(`Unexpected backing canvas ${JSON.stringify(state.canvas)}`);
if(state.atlas?.violations?.length)throw new Error(`Atlas violations: ${JSON.stringify(state.atlas.violations)}`);
if((state.atlas?.atlasCount||0)<17)throw new Error(`Unexpected atlas count ${state.atlas?.atlasCount}`);
for(const key of ['plazaNature','ruralProps','plazaFountainBack','plazaFountainFront','luxeBoutique'])if(!state.atlas?.loaded?.includes(key))throw new Error(`Managed asset not loaded through atlas contract: ${key}`);
if(state.props.resourceMode!=='atlas-contract-managed-v1')throw new Error(`Props are not atlas-contract managed: ${JSON.stringify(state.props)}`);
if(state.prefabs.resourceMode!=='atlas-contract-managed-v1')throw new Error(`Prefabs are not atlas-contract managed: ${JSON.stringify(state.prefabs)}`);
if(consoleErrors.length)throw new Error(`Console/page errors: ${JSON.stringify(consoleErrors)}`);
if(failedRequests.length)throw new Error(`Failed requests: ${JSON.stringify(failedRequests)}`);
if(httpErrors.length)throw new Error(`HTTP errors: ${JSON.stringify(httpErrors)}`);