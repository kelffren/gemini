import fs from 'node:fs';
import { chromium } from 'playwright';

const base=process.env.AUDIT_URL||'https://kelffren.github.io/gemini/';
fs.mkdirSync('artifacts',{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
const page=await context.newPage();
const consoleErrors=[],failedRequests=[],httpErrors=[];
page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text())});
page.on('pageerror',e=>consoleErrors.push(`PAGEERROR: ${e.message}`));
page.on('requestfailed',r=>failedRequests.push({url:r.url(),error:r.failure()?.errorText||'failed'}));
page.on('response',r=>{if(r.status()>=400)httpErrors.push({status:r.status(),url:r.url()})});
await page.goto(`${base}?irregular-atlas-audit=${Date.now()}`,{waitUntil:'networkidle',timeout:60000});
await page.waitForTimeout(3500);
const state=await page.evaluate(()=>({
  registry:window.KELO_TILE_REGISTRY?.version||null,
  propContract:window.KELO_PROP_CONTRACT?.version||null,
  genericProps:window.KELO_GENERIC_PROPS_AUDIT?.version||null,
  atlas:window.KELO_TILE_REGISTRY?.atlases?.plazaNature||null,
  props:window.KELO_TILE_REGISTRY?.plazaNatureProps||null,
  meta:window.KELO_ARBOL_1_ATLAS_META||null,
  canvas:(()=>{const c=document.getElementById('game-canvas');return c?{width:c.width,height:c.height,cssWidth:c.clientWidth,cssHeight:c.clientHeight}:null})()
}));
const atlasResponse=await page.request.get(`${base}assets/Arboleskelo1.atlas.png?audit=${Date.now()}`);
const metaResponse=await page.request.get(`${base}assets/Arboleskelo1.atlas.json?audit=${Date.now()}`);
await page.screenshot({path:'artifacts/irregular-atlas-live-390x844.png',fullPage:false});
const report={state,atlasStatus:atlasResponse.status(),metaStatus:metaResponse.status(),consoleErrors,failedRequests,httpErrors};
fs.writeFileSync('artifacts/irregular-atlas-live-report.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
if(state.canvas?.cssWidth!==390||state.canvas?.cssHeight!==844) throw new Error(`bad mobile viewport ${JSON.stringify(state.canvas)}`);
if(state.atlas?.frameMode!=='irregular') throw new Error(`LIVE atlas is not irregular: ${JSON.stringify(state.atlas)}`);
if(!state.atlas?.frames?.tree_large) throw new Error('LIVE tree_large frame missing');
const f=state.atlas.frames.tree_large;
if(f.x!==7||f.y!==25||f.w!==438||f.h!==527) throw new Error(`unexpected tree_large ${JSON.stringify(f)}`);
if(!Array.isArray(state.props)||state.props.length<12||state.props.some(p=>p.frame!=='tree_large')) throw new Error('Plaza props not using tree_large named frame');
if(atlasResponse.status()!==200||metaResponse.status()!==200) throw new Error('atlas resources unavailable');
if(consoleErrors.length||failedRequests.length||httpErrors.length) throw new Error(`LIVE runtime/network errors ${JSON.stringify({consoleErrors,failedRequests,httpErrors})}`);
await browser.close();
