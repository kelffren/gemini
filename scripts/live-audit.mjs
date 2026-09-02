import fs from 'node:fs';
import { chromium } from 'playwright';

const base = process.env.AUDIT_URL || 'https://kelffren.github.io/gemini/';
const expected = process.env.EXPECTED_BUILD || 'V5.52';
const expectedRegistry = process.env.EXPECTED_REGISTRY || '1.9.0';
const expectedLandmarks = process.env.EXPECTED_LANDMARKS || 'rural-landmarks-v1.2';
fs.mkdirSync('artifacts', { recursive: true });
if (fs.existsSync('assets/tileset-vclean.png')) fs.copyFileSync('assets/tileset-vclean.png', 'artifacts/repo-tileset.png');
else if (fs.existsSync('assets/tileset.png')) fs.copyFileSync('assets/tileset.png', 'artifacts/repo-tileset.png');
if (fs.existsSync('assets/plaza-transitions-v1.png')) fs.copyFileSync('assets/plaza-transitions-v1.png', 'artifacts/repo-transitions.png');
if (fs.existsSync('assets/rural-soil-v1.png')) fs.copyFileSync('assets/rural-soil-v1.png', 'artifacts/repo-rural-soil.png');
if (fs.existsSync('assets/rural-props-v1.png')) fs.copyFileSync('assets/rural-props-v1.png', 'artifacts/repo-rural-props.png');
if (fs.existsSync('assets/rural-landmarks-v1.png')) fs.copyFileSync('assets/rural-landmarks-v1.png', 'artifacts/repo-rural-landmarks.png');

const browser = await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
const context = await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
const page = await context.newPage();
const consoleErrors=[], failedRequests=[], httpErrors=[];
page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});
page.on('pageerror',e=>consoleErrors.push(`PAGEERROR: ${e.stack||e.message}`));
page.on('requestfailed',r=>failedRequests.push({url:r.url(),error:r.failure()?.errorText||'failed'}));
page.on('response',r=>{if(r.status()>=400)httpErrors.push({status:r.status(),url:r.url()});});

let title='',loaded=false;
for(let attempt=1;attempt<=24;attempt++){
  try{
    await page.goto(`${base}?audit=${Date.now()}-${attempt}`,{waitUntil:'networkidle',timeout:45000});
    title=await page.title();
    const d=await page.evaluate(()=>({
      version:window.KELO_PLAZA_AUDIT?.version||null,registryVersion:window.KELO_PLAZA_AUDIT?.registryVersion||null,
      authoredTransitions:!!window.KELO_PLAZA_AUDIT?.authoredTransitions,depthOcclusion:!!window.KELO_PLAZA_AUDIT?.depthOcclusion,depthOccluderCount:window.KELO_PLAZA_AUDIT?.depthOccluderCount||0,
      worldReady:!!window.KELO_WORLD_AUDIT?.ready,worldVersion:window.KELO_WORLD_AUDIT?.version||null,ruralRoadMode:window.KELO_WORLD_AUDIT?.ruralRoadMode||null,districtCount:window.KELO_WORLD_AUDIT?.districtCount||0,districtStyleMode:window.KELO_WORLD_AUDIT?.districtStyleMode||null,styledDistrictCount:window.KELO_WORLD_AUDIT?.styledDistrictCount||0,chunkSize:window.KELO_WORLD_AUDIT?.chunkSize||0,
      ruralReady:!!window.KELO_RURAL_GROUND_AUDIT?.ready,ruralMode:window.KELO_RURAL_GROUND_AUDIT?.renderingMode||null,gateSide:window.KELO_RURAL_GROUND_AUDIT?.gateSide||null,
      landmarkReady:!!window.KELO_RURAL_LANDMARK_AUDIT?.ready,landmarkMode:window.KELO_RURAL_LANDMARK_AUDIT?.renderingMode||null,landmarkVersion:window.KELO_RURAL_LANDMARK_AUDIT?.version||null,
      natureReady:!!window.KELO_RURAL_LANDMARK_AUDIT?.natureAssetLoaded,treeCount:window.KELO_RURAL_LANDMARK_AUDIT?.treeCount||0,hedgeCount:window.KELO_RURAL_LANDMARK_AUDIT?.hedgeCount||0
    }));
    if(d.version===expected&&d.registryVersion===expectedRegistry&&d.authoredTransitions&&d.depthOcclusion&&d.depthOccluderCount>=8&&d.worldReady&&d.worldVersion==='world-v1.1'&&d.ruralRoadMode==='farm-bypass-v1'&&d.districtCount>=5&&d.districtStyleMode==='district-profile-v1'&&d.styledDistrictCount>=5&&d.chunkSize===512&&d.ruralReady&&d.ruralMode==='authored-nine-slice-v1'&&d.gateSide==='north'&&d.landmarkReady&&d.landmarkMode==='layered-rural-landmarks-v1'&&d.landmarkVersion===expectedLandmarks&&d.natureReady&&d.treeCount>=5&&d.hedgeCount>=8){loaded=true;break;}
    console.log(`attempt ${attempt}: build ${d.version||'missing'} / registry ${d.registryVersion||'missing'} / landmarks=${d.landmarkVersion||'missing'} / trees=${d.treeCount} / hedges=${d.hedgeCount}, waiting for ${expected} / ${expectedLandmarks}`);
  }catch(err){console.log(`attempt ${attempt}: ${err.message}`);}
  await page.waitForTimeout(10000);
}

consoleErrors.length=0;failedRequests.length=0;httpErrors.length=0;
await page.goto(`${base}?audit=final-${Date.now()}`,{waitUntil:'networkidle',timeout:45000});
await page.waitForTimeout(4000);
const state=await page.evaluate(()=>({title:document.title,audit:window.KELO_PLAZA_AUDIT||null,world:window.KELO_WORLD_AUDIT||null,rural:window.KELO_RURAL_GROUND_AUDIT||null,landmarks:window.KELO_RURAL_LANDMARK_AUDIT||null,tileset:window.KELO_PLAZA_TILESET||null,depth:window.KELO_PLAZA_DEPTH||null,canvas:(()=>{const c=document.getElementById('game-canvas');return c?{width:c.width,height:c.height,cssWidth:c.clientWidth,cssHeight:c.clientHeight}:null;})()}));
await page.screenshot({path:'artifacts/live-mobile.png',fullPage:false});
const ruralFrame=await page.evaluate(()=>{
  if(typeof camera==='undefined'||typeof localPlayer==='undefined'||typeof render!=='function')return null;
  const c=document.getElementById('game-canvas');if(!c)return null;
  localPlayer.x=820;localPlayer.y=1744;camera.x=820;camera.y=1660;camera.targetX=820;camera.targetY=1660;render();
  const px=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
  let woodPixels=0,dirtPixels=0,barnPixels=0,roofPixels=0,metalPixels=0,treePixels=0,treeTrunkPixels=0;
  for(let i=0;i<px.length;i+=4){
    const r=px[i],g=px[i+1],b=px[i+2],a=px[i+3];
    if(a>200&&r>=135&&r<=205&&g>=80&&g<=145&&b>=35&&b<=90)woodPixels++;
    if(a>200&&r>=120&&r<=190&&g>=75&&g<=135&&b>=40&&b<=90)dirtPixels++;
    if(a>200&&((r===145&&g===55&&b===49)||(r===91&&g===38&&b===40)||(r===186&&g===74&&b===56)))barnPixels++;
    if(a>200&&((r===27&&g===70&&b===73)||(r===38&&g===91&&b===91)||(r===61&&g===119&&b===108)))roofPixels++;
    if(a>200&&((r===101&&g===130&&b===127)||(r===166&&g===181&&b===163)||(r===51&&g===73&&b===76)))metalPixels++;
    if(a>200&&r===91&&g===219&&b===64)treePixels++;
    if(a>200&&((r===116&&g===70&&b===28)||(r===145&&g===89&&b===34)))treeTrunkPixels++;
  }
  return{dataUrl:c.toDataURL('image/png'),woodPixels,dirtPixels,barnPixels,roofPixels,metalPixels,treePixels,treeTrunkPixels};
});
const ruralCaptureReady=!!ruralFrame?.dataUrl?.startsWith('data:image/png;base64,');
const ruralVisualEvidence=ruralFrame?{woodPixels:ruralFrame.woodPixels,dirtPixels:ruralFrame.dirtPixels,barnPixels:ruralFrame.barnPixels,roofPixels:ruralFrame.roofPixels,metalPixels:ruralFrame.metalPixels,treePixels:ruralFrame.treePixels,treeTrunkPixels:ruralFrame.treeTrunkPixels}:null;
if(ruralCaptureReady)fs.writeFileSync('artifacts/live-rural.png',Buffer.from(ruralFrame.dataUrl.split(',')[1],'base64'));
fs.writeFileSync('artifacts/report.json',JSON.stringify({loaded,title,expected,expectedRegistry,expectedLandmarks,ruralCaptureReady,ruralVisualEvidence,state,consoleErrors,failedRequests,httpErrors},null,2));
console.log(JSON.stringify({loaded,title,expected,expectedRegistry,expectedLandmarks,ruralCaptureReady,ruralVisualEvidence,state,consoleErrors,failedRequests,httpErrors},null,2));
await browser.close();

if(!loaded)throw new Error(`Live page never reached visual build ${expected} / registry ${expectedRegistry} / landmarks ${expectedLandmarks}`);
if(state.audit?.version!==expected)throw new Error(`Visual audit version mismatch: ${state.audit?.version} !== ${expected}`);
if(state.audit?.registryVersion!==expectedRegistry)throw new Error(`Registry version mismatch: ${state.audit?.registryVersion} !== ${expectedRegistry}`);
if(!state.audit?.ready||!state.audit?.assetLoaded||state.audit?.fallbackActive)throw new Error('Plaza visual state invalid');
if(!state.audit?.authoredTransitions||!state.audit?.depthOcclusion||(state.audit?.depthOccluderCount||0)<8)throw new Error('Plaza transition/depth state invalid');
if(!state.world?.ready||!state.world?.assetLoaded||state.world?.version!=='world-v1.1'||state.world?.ruralRoadMode!=='farm-bypass-v1')throw new Error('Rural farm-bypass world renderer is not active');
if(state.world?.districtStyleMode!=='district-profile-v1'||(state.world?.styledDistrictCount||0)<5||state.world?.chunkSize!==512||(state.world?.districtCount||0)<5)throw new Error('World contract regressed');
if((state.world?.worldWidth||0)<3600||(state.world?.worldHeight||0)<3200)throw new Error('World bounds regressed');
if(!ruralCaptureReady)throw new Error('Could not capture Distrito Rural');
if(!state.rural?.ready||!state.rural?.assetLoaded||!state.rural?.modularTiles||!state.rural?.propsLoaded)throw new Error('Modular rural renderers are not active');
if(state.rural?.renderingMode!=='authored-nine-slice-v1'||state.rural?.plotSize!==96||state.rural?.boundaryMode!=='modular-fence-gate-v1'||state.rural?.gateSide!=='north')throw new Error('Unexpected rural boundary contract');
if(!state.landmarks?.ready||!state.landmarks?.assetLoaded||!state.landmarks?.natureAssetLoaded||state.landmarks?.fallbackActive||state.landmarks?.renderingMode!=='layered-rural-landmarks-v1')throw new Error('Layered rural scenery renderer is not active');
if(state.landmarks?.version!==expectedLandmarks)throw new Error(`Rural landmark version mismatch: ${state.landmarks?.version} !== ${expectedLandmarks}`);
if((state.landmarks?.landmarkCount||0)<2||(state.landmarks?.detailCount||0)<4||(state.landmarks?.treeCount||0)<5||(state.landmarks?.hedgeCount||0)<8||state.landmarks?.vegetationMode!=='west-south-edge-clusters-v1'||state.landmarks?.centerClear!==true||(state.landmarks?.roadClearance||0)<32||!state.landmarks?.depthOcclusion||state.landmarks?.gameplayFootprint!=='visual-only-v1'||state.landmarks?.stateMutation!==false||(state.landmarks?.cropClearance||0)<32||(state.landmarks?.gateClearance||0)<16||(state.landmarks?.bypassClearance||0)<32)throw new Error('Rural scenery contract is incomplete');
if((ruralVisualEvidence?.woodPixels||0)<100||(ruralVisualEvidence?.dirtPixels||0)<100)throw new Error(`Rural farm materials not visible: ${JSON.stringify(ruralVisualEvidence)}`);
if((ruralVisualEvidence?.barnPixels||0)<500||(ruralVisualEvidence?.roofPixels||0)<300||(ruralVisualEvidence?.metalPixels||0)<200)throw new Error(`Rural landmarks not visible: ${JSON.stringify(ruralVisualEvidence)}`);
if((ruralVisualEvidence?.treePixels||0)<500||(ruralVisualEvidence?.treeTrunkPixels||0)<100)throw new Error(`Rural edge trees not visible: ${JSON.stringify(ruralVisualEvidence)}`);
if(!state.depth||state.depth.sourceMode!=='y-occlusion-overlay-v1'||!state.tileset?.authoredTransitions||!state.tileset?.transitionAssetPath)throw new Error('Depth/tileset state invalid');
if(httpErrors.length)throw new Error(`HTTP errors detected: ${JSON.stringify(httpErrors)}`);
if(failedRequests.length)throw new Error(`Failed requests detected: ${JSON.stringify(failedRequests)}`);
if(consoleErrors.length)throw new Error(`Console/page errors detected: ${JSON.stringify(consoleErrors)}`);
