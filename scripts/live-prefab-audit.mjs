import fs from 'node:fs';
import { chromium } from 'playwright';
const base=process.env.AUDIT_URL||'https://kelffren.github.io/gemini/';
const expectedTitle=process.env.EXPECTED_TITLE||'Kelo World — V6.24';
fs.mkdirSync('artifacts',{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
const page=await context.newPage();
const consoleErrors=[],failedRequests=[],httpErrors=[];
page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text())});
page.on('pageerror',e=>consoleErrors.push(`PAGEERROR: ${e.stack||e.message}`));
page.on('requestfailed',r=>failedRequests.push({url:r.url(),error:r.failure()?.errorText||'failed'}));
page.on('response',r=>{if(r.status()>=400)httpErrors.push({status:r.status(),url:r.url()})});

const probe=()=>page.evaluate(()=>({
  title:document.title,contract:window.KELO_PREFAB_CONTRACT||null,audit:window.KELO_PREFAB_AUDIT||null,
  renderer:window.KELO_PREFAB_RENDERER?{version:window.KELO_PREFAB_RENDERER.version,mode:window.KELO_PREFAB_RENDERER.mode,ready:window.KELO_PREFAB_RENDERER.ready,failed:window.KELO_PREFAB_RENDERER.failed}:null,
  architecture:window.KELO_ARCHITECTURE_RENDERER?{version:window.KELO_ARCHITECTURE_RENDERER.version,mode:window.KELO_ARCHITECTURE_RENDERER.mode,ready:window.KELO_ARCHITECTURE_RENDERER.ready,backLayerRegistered:window.KELO_ARCHITECTURE_RENDERER.backLayerRegistered,frontLayerRegistered:window.KELO_ARCHITECTURE_RENDERER.frontLayerRegistered}:null,
  luxe:window.KELO_LUXE_KIOSK?{version:window.KELO_LUXE_KIOSK.version,source:window.KELO_LUXE_KIOSK.source,ready:window.KELO_LUXE_KIOSK.ready,failed:window.KELO_LUXE_KIOSK.failed,prefabId:window.KELO_LUXE_KIOSK.prefabId}:null,
  layers:(window.KELO_ENVIRONMENT_LAYERS?.layers||[]).filter(x=>String(x.id).includes('architecture-prefabs')).map(x=>({id:x.id,phase:x.phase,priority:x.priority,ownership:x.ownership,ready:typeof x.ready==='function'?x.ready():true})),
  canvas:(()=>{const c=document.getElementById('game-canvas');return c?{width:c.width,height:c.height,cssWidth:c.clientWidth,cssHeight:c.clientHeight}:null})()
}));
function valid(s){return s.title===expectedTitle&&s.contract?.version==='1.0.0'&&s.contract?.mode==='data-driven-building-prefabs-v1'&&s.contract?.prefabs?.length===1&&s.audit?.version==='generic-prefabs-v1'&&s.audit?.rendererMode==='data-driven-prefabs-v1'&&s.audit?.ready===true&&s.audit?.failed===false&&s.audit?.registeredColliderCount===1&&s.renderer?.ready===true&&s.renderer?.failed===false&&s.architecture?.mode==='generic-prefab-contract-v1'&&s.architecture?.ready===true&&s.architecture?.backLayerRegistered===true&&s.architecture?.frontLayerRegistered===true&&s.luxe?.source==='generic-prefab-contract'&&s.luxe?.ready===true&&s.luxe?.failed===false&&s.layers?.some(x=>x.id==='architecture-prefabs-back'&&x.phase==='props_back'&&x.ready)&&s.layers?.some(x=>x.id==='architecture-prefabs-front'&&x.phase==='props_front'&&x.ready);}
let state=null;
for(let attempt=1;attempt<=30;attempt++){
  consoleErrors.length=0;failedRequests.length=0;httpErrors.length=0;
  try{await page.goto(`${base}?prefab-live=${Date.now()}-${attempt}`,{waitUntil:'networkidle',timeout:45000});await page.waitForTimeout(1200);state=await probe();if(valid(state)&&!consoleErrors.length&&!failedRequests.length&&!httpErrors.length)break;}catch(e){console.log(`attempt ${attempt}: ${e.message}`)}
  await page.waitForTimeout(8000);
}
if(!state||!valid(state))throw new Error(`LIVE generic prefab contract unavailable: ${JSON.stringify(state)}`);
if(consoleErrors.length||failedRequests.length||httpErrors.length)throw new Error(`LIVE browser errors: ${JSON.stringify({consoleErrors,failedRequests,httpErrors})}`);
await page.evaluate(()=>{if(typeof localPlayer!=='undefined'&&localPlayer){localPlayer.x=1208;localPlayer.y=1575;}if(typeof camera!=='undefined'&&camera){camera.x=1208;camera.y=1510;camera.targetX=1208;camera.targetY=1510;}if(typeof render==='function')render();});
await page.waitForTimeout(500);
await page.screenshot({path:'artifacts/live-prefab-mobile.png',fullPage:true});
state=await probe();
fs.writeFileSync('artifacts/prefab-live-report.json',JSON.stringify({state,consoleErrors,failedRequests,httpErrors},null,2));
console.log(JSON.stringify({state,consoleErrors,failedRequests,httpErrors},null,2));
await browser.close();
if(state.canvas?.cssWidth!==390||state.canvas?.cssHeight!==844||state.canvas?.width!==780||state.canvas?.height!==1688)throw new Error(`Unexpected mobile canvas: ${JSON.stringify(state.canvas)}`);