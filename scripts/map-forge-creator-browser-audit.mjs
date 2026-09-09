/* KELO-INDEX
 * area: QA / MAP FORGE / CREATORS
 * owner: Map Forge Creator UI browser audit
 * purpose: prove automatic city generation works in a real browser/mobile surface with Worker parity and lock cleanup
 * public-api: CLI
 */
import { chromium } from 'playwright';
import fs from 'node:fs';

const URL=process.env.AUDIT_URL||'http://127.0.0.1:4173/';
const OUT=process.env.AUDIT_OUT||'artifacts';fs.mkdirSync(OUT,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
const report={ok:false,workerParity:null,ui:null,error:null};
try{
  await page.goto(URL,{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForFunction(()=>window.KeloInputLocks?.acquire&&window.KeloInputLocks?.release,null,{timeout:20000});
  report.workerParity=await page.evaluate(async()=>{
    const [{createMapForgeWorkerClient},{MAP_FORGE_RECIPES},{generateBestOf}]=await Promise.all([
      import('/src/world/map-forge/map-forge-worker-client.mjs'),
      import('/src/world/map-forge/map-forge-recipes.mjs'),
      import('/src/world/map-forge/map-forge-core.mjs')
    ]);
    const client=createMapForgeWorkerClient({root:window,timeoutMs:15000}),options={seed:424242,count:4,assetCatalogVersion:'browser-audit',style:{...MAP_FORGE_RECIPES.KELO_ROYAL_CAPITAL_V1.style}};
    const asyncResult=await client.generate('KELO_ROYAL_CAPITAL_V1',options),syncResult=generateBestOf(MAP_FORGE_RECIPES.KELO_ROYAL_CAPITAL_V1,options),out={mode:client.mode,asyncHash:asyncResult.best?.metadata?.layoutHash,syncHash:syncResult.best?.metadata?.layoutHash,valid:asyncResult.validCount};client.close();return out;
  });
  if(report.workerParity.mode!=='worker')throw new Error(`Map Forge did not use Worker: ${report.workerParity.mode}`);
  if(report.workerParity.asyncHash!==report.workerParity.syncHash)throw new Error('Map Forge Worker parity failed');
  if(report.workerParity.valid!==4)throw new Error('Map Forge worker did not return four valid candidates');

  await page.evaluate(async()=>{const mod=await import('/src/creators/ui/map-forge-workspace.mjs');await mod.openMapForgeWorkspace({root:window});});
  await page.waitForFunction(()=>window.document.querySelectorAll('.kmf-candidate').length===8&&window.document.querySelector('.kmf-score')?.textContent?.includes('/100'),null,{timeout:20000});
  report.ui=await page.evaluate(()=>{
    const shell=document.getElementById('kelo-map-forge'),canvas=document.querySelector('.kmf-canvas'),r=shell?.getBoundingClientRect(),c=canvas?.getBoundingClientRect(),cards=[...document.querySelectorAll('.kmf-candidate')];
    return{shell:{left:r?.left,top:r?.top,right:r?.right,bottom:r?.bottom,width:r?.width,height:r?.height},canvas:{width:c?.width,height:c?.height,pixels:[canvas?.width,canvas?.height]},candidates:cards.length,selected:cards.filter(x=>x.classList.contains('on')).length,score:document.querySelector('.kmf-score')?.textContent,valid:[...document.querySelectorAll('.kmf-chip')].some(x=>x.textContent.includes('VÁLIDO')),lock:window.KeloInputLocks.has('kelo-map-forge'),overflowX:document.documentElement.scrollWidth>innerWidth+1};
  });
  if(report.ui.candidates!==8||report.ui.selected!==1||!report.ui.valid)throw new Error('Map Forge initial candidate UI invalid');
  if(!report.ui.lock)throw new Error('Map Forge did not acquire input lock');
  if(report.ui.shell.left<0||report.ui.shell.top<0||report.ui.shell.right>390.5||report.ui.shell.bottom>844.5)throw new Error('Map Forge mobile shell escapes viewport');
  if(report.ui.canvas.width<250||report.ui.canvas.height<300||report.ui.pixels[0]<250||report.ui.pixels[1]<300)throw new Error('Map Forge preview canvas collapsed');
  if(report.ui.overflowX)throw new Error('Map Forge introduced horizontal overflow');

  await page.selectOption('.kmf-select','KELO_VILLAGE_V1');
  await page.waitForFunction(()=>document.querySelector('.kmf-chip.gold')?.textContent==='KELO_VILLAGE_V1',null,{timeout:20000});
  await page.selectOption('select.kmf-select:nth-of-type(1)',{label:'Best of 4'}).catch(()=>{});
  await page.screenshot({path:`${OUT}/map-forge-mobile.png`,fullPage:false});
  await page.evaluate(async()=>{const mod=await import('/src/creators/ui/map-forge-workspace.mjs');mod.closeMapForgeWorkspace();});
  await page.waitForFunction(()=>!document.getElementById('kelo-map-forge'));
  if(await page.evaluate(()=>window.KeloInputLocks.has('kelo-map-forge')))throw new Error('Map Forge input lock leaked after close');
  report.ok=true;
}catch(error){report.error=String(error?.stack||error);try{await page.screenshot({path:`${OUT}/map-forge-failure.png`,fullPage:false});}catch{}}
finally{fs.writeFileSync(`${OUT}/map-forge-creator-report.json`,JSON.stringify(report,null,2));await browser.close();}
console.log(JSON.stringify(report,null,2));if(!report.ok)process.exit(1);
