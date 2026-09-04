import fs from 'node:fs';
import { chromium } from 'playwright';

const base=process.env.AUDIT_URL||'https://kelffren.github.io/gemini/';
const expectedJoinMode='authored-garden-endcaps-mid-variants-v3';
const expectedCompositionMode='registry-authored-garden-compositions-v15';
const expectedWorldVersion='world-v1.16';
const expectedCornerMode='oriented-authored-corner-v1';
const expectedFixedPlacementMode='registry-authored-fixed-accents-v1';
const expectedRelocationMode='authored-road-clear-placements-v8';
const expectedJunctionMode='connected-south-boundaries-v2';
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

function valid(state){
  const water=state.composition?.relocatedWaterAnchors,westPlinth=state.composition?.relocatedWestPlinthAnchor,eastPlinth=state.composition?.relocatedEastPlinthAnchor,step=state.composition?.relocatedSteppingStoneAnchor,seCorner=state.composition?.southeastJunctionCorner,seRun=state.composition?.southeastHorizontalRunAnchor,swCorner=state.composition?.southwestJunctionCorner,swRun=state.composition?.southwestHorizontalRunAnchor,swVertical=state.composition?.southwestVerticalRunAnchor;
  return state.joins?.mode===expectedJoinMode&&state.joins?.id==='gardens-joins-v3'&&state.joins?.width===288&&state.joins?.height===32&&state.joins?.columns===9&&state.joins?.tiles?.HEDGE_MID_ALT===6&&state.joins?.tiles?.FLOWER_MID_ALT===7&&state.joins?.tiles?.HEDGE_V_ALT===8&&
    state.composition?.ready&&state.composition?.mode===expectedCompositionMode&&state.composition?.centerVariationMode==='authored-mid-variant-selection-v2'&&state.composition?.verticalVariationMode==='mirrored-authored-vertical-mid-v1'&&state.composition?.junctionMode===expectedJunctionMode&&state.composition?.connectedJunctionCount===2&&seCorner?.[0]===22&&seCorner?.[1]===17&&seRun?.[0]===18&&seRun?.[1]===17&&swCorner?.[0]===5&&swCorner?.[1]===17&&swRun?.[0]===6&&swRun?.[1]===17&&swVertical?.[0]===5&&swVertical?.[1]===14&&state.composition?.fixedPlacementMode===expectedFixedPlacementMode&&state.composition?.navigationSafeRelocationMode===expectedRelocationMode&&state.composition?.navigationConflictFixCount===13&&
    state.composition?.relocatedEastRunAnchor?.[0]===24&&state.composition?.relocatedEastRunAnchor?.[1]===13&&state.composition?.relocatedFlowerbedNWAnchor?.[0]===8&&state.composition?.relocatedFlowerbedNWAnchor?.[1]===8&&state.composition?.relocatedFlowerbedNEAnchor?.[0]===19&&state.composition?.relocatedFlowerbedNEAnchor?.[1]===13&&state.composition?.relocatedFlowerbedSWAnchor?.[0]===8&&state.composition?.relocatedFlowerbedSWAnchor?.[1]===14&&water?.[0]?.[0]===9&&water?.[0]?.[1]===11&&water?.[1]?.[0]===19&&water?.[1]?.[1]===11&&westPlinth?.[0]===5&&westPlinth?.[1]===11&&eastPlinth?.[0]===25&&eastPlinth?.[1]===11&&step?.[0]===9&&step?.[1]===16&&
    state.composition?.declaredCellCount===41&&state.composition?.fixedPlacementCount===10&&state.composition?.altCenterTileCount===4&&state.composition?.verticalAltUsageCount===2&&state.world?.ready&&state.world?.version===expectedWorldVersion&&state.world?.gardensCornerMode===expectedCornerMode&&state.world?.gardensCornerOrientationCount===4&&state.world?.gardensFixedPlacementMode===expectedFixedPlacementMode&&state.world?.gardensFixedPlacementCount===10&&state.world?.gardensJoinAssetLoaded&&state.landmark?.ready&&!state.landmark?.failed;
}

let state=null,loaded=false;
for(let attempt=1;attempt<=24;attempt++){
  try{
    await page.goto(`${base}?gardens-variant-audit=${Date.now()}-${attempt}`,{waitUntil:'networkidle',timeout:45000});
    state=await page.evaluate(()=>({world:window.KELO_WORLD_AUDIT||null,joins:window.KELO_GARDENS_JOINS||null,composition:window.KELO_GARDENS_COMPOSITION_AUDIT||null,landmark:window.KELO_GARDEN_LANDMARK_AUDIT||null}));
    if(valid(state)){loaded=true;break;}
  }catch(e){console.log(`attempt ${attempt}: ${e.message}`)}
  await page.waitForTimeout(10000);
}
if(!loaded){
  fs.writeFileSync('artifacts/gardens-variants-report.json',JSON.stringify({loaded,state,consoleErrors,failedRequests,httpErrors},null,2));
  await browser.close();
  throw new Error(`LIVE never reached Gardens v15 contract: ${JSON.stringify(state)}`);
}

consoleErrors.length=0;failedRequests.length=0;httpErrors.length=0;
await page.goto(`${base}?gardens-variant-audit=final-${Date.now()}`,{waitUntil:'networkidle',timeout:45000});
await page.waitForTimeout(1800);
const shot=await page.evaluate(()=>{
  const c=document.getElementById('game-canvas');
  if(!c||typeof camera==='undefined'||typeof localPlayer==='undefined'||typeof render!=='function')return null;
  localPlayer.x=1280;localPlayer.y=2680;camera.x=1280;camera.y=2680;camera.targetX=1280;camera.targetY=2680;render();
  const px=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let green=0,ivory=0,cyan=0;
  for(let i=0;i<px.length;i+=4){const r=px[i],g=px[i+1],b=px[i+2],a=px[i+3];if(a<200)continue;if(g>110&&g>r*1.35&&g>b*1.15)green++;if(r>195&&g>185&&b>145)ivory++;if(b>120&&g>95&&b>r*1.25)cyan++;}
  return{dataUrl:c.toDataURL('image/png'),world:window.KELO_WORLD_AUDIT||null,joins:window.KELO_GARDENS_JOINS||null,composition:window.KELO_GARDENS_COMPOSITION_AUDIT||null,landmark:window.KELO_GARDEN_LANDMARK_AUDIT||null,canvas:{width:c.width,height:c.height,cssWidth:c.clientWidth,cssHeight:c.clientHeight},green,ivory,cyan};
});
if(shot?.dataUrl?.startsWith('data:image/png;base64,'))fs.writeFileSync('artifacts/live-gardens-variants.png',Buffer.from(shot.dataUrl.split(',')[1],'base64'));
const finalState={world:shot?.world,joins:shot?.joins,composition:shot?.composition,landmark:shot?.landmark};
const report={shot:shot?{world:shot.world,joins:{id:shot.joins?.id,mode:shot.joins?.mode,width:shot.joins?.width,height:shot.joins?.height,columns:shot.joins?.columns,tiles:shot.joins?.tiles},composition:shot.composition,landmark:shot.landmark,canvas:shot.canvas,green:shot.green,ivory:shot.ivory,cyan:shot.cyan}:null,consoleErrors,failedRequests,httpErrors};
fs.writeFileSync('artifacts/gardens-variants-report.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
await browser.close();

if(!shot?.dataUrl?.startsWith('data:image/png;base64,'))throw new Error('Gardens variant screenshot missing');
if(!valid(finalState))throw new Error(`Final Gardens v15 contract invalid: ${JSON.stringify(finalState)}`);
if(shot.canvas?.cssWidth!==390||shot.canvas?.cssHeight!==844||shot.canvas?.width!==780||shot.canvas?.height!==1688)throw new Error(`Mobile canvas mismatch: ${JSON.stringify(shot.canvas)}`);
if(shot.ivory<1000||shot.green<5000||shot.cyan<100)throw new Error(`Garden palette evidence weak: ${JSON.stringify({ivory:shot.ivory,green:shot.green,cyan:shot.cyan})}`);
if(consoleErrors.length)throw new Error(`Console/page errors: ${JSON.stringify(consoleErrors)}`);
if(failedRequests.length)throw new Error(`Failed requests: ${JSON.stringify(failedRequests)}`);
if(httpErrors.length)throw new Error(`HTTP errors: ${JSON.stringify(httpErrors)}`);
