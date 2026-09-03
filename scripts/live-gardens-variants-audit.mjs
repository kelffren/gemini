import fs from 'node:fs';
import { chromium } from 'playwright';

const base=process.env.AUDIT_URL||'https://kelffren.github.io/gemini/';
const expectedJoinMode='authored-garden-endcaps-mid-variants-v2';
const expectedCompositionMode='registry-authored-garden-compositions-v3';
fs.mkdirSync('artifacts',{recursive:true});

const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
const page=await context.newPage();
await page.route(/\/src\/environment\/(world-map|tile-registry|gardens-atlas|gardens-joins|gardens-compositions|gardens-landmark)\.js/,route=>{
  const u=new URL(route.request().url());u.searchParams.set('live-audit-bust',`${Date.now()}-${Math.random()}`);route.continue({url:u.toString()});
});

const consoleErrors=[],failedRequests=[],httpErrors=[];
page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text())});
page.on('pageerror',e=>consoleErrors.push(`PAGEERROR: ${e.stack||e.message}`));
page.on('requestfailed',r=>failedRequests.push({url:r.url(),error:r.failure()?.errorText||'failed'}));
page.on('response',r=>{if(r.status()>=400)httpErrors.push({status:r.status(),url:r.url()})});

let state=null;
for(let attempt=1;attempt<=24;attempt++){
  try{
    await page.goto(`${base}?gardens-variant-audit=${Date.now()}-${attempt}`,{waitUntil:'networkidle',timeout:45000});
    state=await page.evaluate(()=>({
      world:window.KELO_WORLD_AUDIT||null,
      joins:window.KELO_GARDENS_JOINS||null,
      composition:window.KELO_GARDENS_COMPOSITION_AUDIT||null,
      landmark:window.KELO_GARDEN_LANDMARK_AUDIT||null
    }));
    if(state.joins?.mode===expectedJoinMode&&state.joins?.id==='gardens-joins-v2'&&state.joins?.width===256&&state.joins?.height===32&&state.joins?.columns===8&&state.joins?.tiles?.HEDGE_MID_ALT===6&&state.joins?.tiles?.FLOWER_MID_ALT===7&&state.composition?.ready&&state.composition?.mode===expectedCompositionMode&&state.composition?.centerVariationMode==='authored-mid-variant-selection-v1'&&state.composition?.altCenterTileCount===2&&state.world?.ready&&state.world?.version==='world-v1.14'&&state.world?.gardensJoinAssetLoaded&&state.landmark?.ready&&!state.landmark?.failed)break;
  }catch(e){console.log(`attempt ${attempt}: ${e.message}`)}
  await page.waitForTimeout(10000);
}

consoleErrors.length=0;failedRequests.length=0;httpErrors.length=0;
await page.goto(`${base}?gardens-variant-audit=final-${Date.now()}`,{waitUntil:'networkidle',timeout:45000});
await page.waitForTimeout(1800);
const shot=await page.evaluate(()=>{
  const c=document.getElementById('game-canvas');
  if(!c||typeof camera==='undefined'||typeof localPlayer==='undefined'||typeof render!=='function')return null;
  localPlayer.x=1510;localPlayer.y=2356;camera.x=1510;camera.y=2356;camera.targetX=1510;camera.targetY=2356;render();
  const px=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let green=0,ivory=0;
  for(let i=0;i<px.length;i+=4){const r=px[i],g=px[i+1],b=px[i+2],a=px[i+3];if(a<200)continue;if(g>110&&g>r*1.35&&g>b*1.15)green++;if(r>195&&g>185&&b>145)ivory++;}
  return{
    dataUrl:c.toDataURL('image/png'),
    world:window.KELO_WORLD_AUDIT||null,
    joins:window.KELO_GARDENS_JOINS||null,
    composition:window.KELO_GARDENS_COMPOSITION_AUDIT||null,
    landmark:window.KELO_GARDEN_LANDMARK_AUDIT||null,
    canvas:{width:c.width,height:c.height,cssWidth:c.clientWidth,cssHeight:c.clientHeight},
    green,ivory
  };
});
if(shot?.dataUrl?.startsWith('data:image/png;base64,'))fs.writeFileSync('artifacts/live-gardens-variants.png',Buffer.from(shot.dataUrl.split(',')[1],'base64'));
const report={shot:shot?{world:shot.world,joins:{id:shot.joins?.id,mode:shot.joins?.mode,width:shot.joins?.width,height:shot.joins?.height,columns:shot.joins?.columns,tiles:shot.joins?.tiles},composition:shot.composition,landmark:shot.landmark,canvas:shot.canvas,green:shot.green,ivory:shot.ivory}:null,consoleErrors,failedRequests,httpErrors};
fs.writeFileSync('artifacts/gardens-variants-report.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
await browser.close();

if(!shot?.dataUrl?.startsWith('data:image/png;base64,'))throw new Error('Gardens variant screenshot missing');
if(shot.joins?.mode!==expectedJoinMode||shot.joins?.id!=='gardens-joins-v2'||shot.joins?.width!==256||shot.joins?.height!==32||shot.joins?.columns!==8||shot.joins?.tiles?.HEDGE_MID_ALT!==6||shot.joins?.tiles?.FLOWER_MID_ALT!==7)throw new Error(`Join atlas contract invalid: ${JSON.stringify(shot.joins)}`);
if(!shot.composition?.ready||shot.composition?.mode!==expectedCompositionMode||shot.composition?.centerVariationMode!=='authored-mid-variant-selection-v1'||shot.composition?.altCenterTileCount!==2)throw new Error(`Composition contract invalid: ${JSON.stringify(shot.composition)}`);
if(!shot.world?.ready||shot.world?.version!=='world-v1.14'||!shot.world?.gardensJoinAssetLoaded)throw new Error(`World contract invalid: ${JSON.stringify(shot.world)}`);
if(!shot.landmark?.ready||shot.landmark?.failed)throw new Error(`Landmark contract invalid: ${JSON.stringify(shot.landmark)}`);
if(shot.canvas?.cssWidth!==390||shot.canvas?.cssHeight!==844||shot.canvas?.width!==780||shot.canvas?.height!==1688)throw new Error(`Mobile canvas mismatch: ${JSON.stringify(shot.canvas)}`);
if(shot.ivory<1000||shot.green<5000)throw new Error(`Garden palette evidence weak: ${JSON.stringify({ivory:shot.ivory,green:shot.green})}`);
if(consoleErrors.length)throw new Error(`Console/page errors: ${JSON.stringify(consoleErrors)}`);
if(failedRequests.length)throw new Error(`Failed requests: ${JSON.stringify(failedRequests)}`);
if(httpErrors.length)throw new Error(`HTTP errors: ${JSON.stringify(httpErrors)}`);
