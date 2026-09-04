import fs from 'node:fs';
import { chromium } from 'playwright';

const base=process.env.AUDIT_URL||'https://kelffren.github.io/gemini/';
const expectedTitle=process.env.EXPECTED_TITLE||'';
const expectedFountain=process.env.EXPECTED_FOUNTAIN||'plaza-fountain-v1.7';
fs.mkdirSync('artifacts',{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
const page=await context.newPage();
const consoleErrors=[],failedRequests=[],httpErrors=[];
page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text())});
page.on('pageerror',e=>consoleErrors.push(`PAGEERROR: ${e.stack||e.message}`));
page.on('requestfailed',r=>failedRequests.push({url:r.url(),error:r.failure()?.errorText||'failed'}));
page.on('response',r=>{if(r.status()>=400)httpErrors.push({status:r.status(),url:r.url()})});

function contractOk(d){
  const f=d.fountain,l=d.layers;
  const back=l?.layers?.find(x=>x.id==='plaza-fountain-back');
  const front=l?.layers?.find(x=>x.id==='plaza-fountain-front');
  return (!expectedTitle||d.title===expectedTitle)&&f?.ready&&!f?.failed&&f?.version===expectedFountain&&
    f?.assetMode==='authored-png-layer-pair-v1'&&f?.alignmentMode==='scaled-centered-lower-rim-v1'&&
    f?.environmentLayerStack===true&&f?.renderWrapped===false&&f?.depthMode==='formal-back-front-layer-stack-v1'&&
    back?.phase==='props_back'&&back?.timing==='pre_actor'&&front?.phase==='props_front'&&front?.timing==='post_actor'&&
    d.plaza?.fountainReady;
}

let loaded=false;
for(let attempt=1;attempt<=24;attempt++){
  try{
    await page.goto(`${base}?fountain-audit=${Date.now()}-${attempt}`,{waitUntil:'networkidle',timeout:45000});
    const d=await page.evaluate(()=>({title:document.title,fountain:window.KELO_PLAZA_FOUNTAIN_AUDIT||null,plaza:window.KELO_PLAZA_AUDIT||null,layers:window.KELO_ENVIRONMENT_LAYER_AUDIT||null}));
    if(contractOk(d)){loaded=true;break;}
  }catch(e){console.log(`attempt ${attempt}: ${e.message}`)}
  await page.waitForTimeout(10000);
}

consoleErrors.length=0;failedRequests.length=0;httpErrors.length=0;
await page.goto(`${base}?fountain-audit=final-${Date.now()}`,{waitUntil:'networkidle',timeout:45000});
await page.waitForTimeout(2500);

async function capture(name,y){
  const result=await page.evaluate(({y})=>{
    const c=document.getElementById('game-canvas');
    localPlayer.x=1440;localPlayer.y=y;camera.x=1440;camera.y=1535;camera.targetX=1440;camera.targetY=1535;render();
    const g=c.getContext('2d');
    const z=CONFIG.zoom||1,dpr=c.width/c.clientWidth;
    const f=window.KELO_PLAZA_FOUNTAIN_AUDIT;
    const x0=Math.max(0,Math.floor((screenW/2+(f.x-camera.x)*z-8)*dpr));
    const y0=Math.max(0,Math.floor((screenH/2+(f.y-camera.y)*z-8)*dpr));
    const x1=Math.min(c.width,Math.ceil((screenW/2+(f.x+f.width-camera.x)*z+8)*dpr));
    const y1=Math.min(c.height,Math.ceil((screenH/2+(f.y+(f.visualHeight||f.height)-camera.y)*z+8)*dpr));
    const img=g.getImageData(x0,y0,x1-x0,y1-y0),px=img.data;
    let water=0,gold=0,ivory=0;
    for(let i=0;i<px.length;i+=4){const r=px[i],gg=px[i+1],b=px[i+2],a=px[i+3];if(a<200)continue;if(r<95&&gg>135&&b>145&&b>r*1.5)water++;if(r>175&&gg>100&&gg<215&&b<105)gold++;if(r>210&&gg>195&&b>155)ivory++;}
    return{dataUrl:c.toDataURL('image/png'),audit:{...f},roi:{x0,y0,x1,y1,width:x1-x0,height:y1-y0},water,gold,ivory};
  },{y});
  fs.writeFileSync(`artifacts/${name}.png`,Buffer.from(result.dataUrl.split(',')[1],'base64'));
  delete result.dataUrl;return result;
}

const behind=await capture('live-fountain-behind',1540);
const front=await capture('live-fountain-front',1620);
const state=await page.evaluate(()=>({title:document.title,fountain:{...window.KELO_PLAZA_FOUNTAIN_AUDIT},plaza:window.KELO_PLAZA_AUDIT||null,layers:window.KELO_ENVIRONMENT_LAYER_AUDIT||null,canvas:(()=>{const c=document.getElementById('game-canvas');return{width:c.width,height:c.height,cssWidth:c.clientWidth,cssHeight:c.clientHeight}})()}));
const report={loaded,state,behind,front,consoleErrors,failedRequests,httpErrors};
fs.writeFileSync('artifacts/fountain-report.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
await browser.close();

if(!loaded)throw new Error('LIVE never reached formal fountain layer contract');
if(!contractOk(state))throw new Error(`Final fountain layer contract invalid: ${JSON.stringify(state)}`);
if(state.fountain?.sourceWidth!==1254||state.fountain?.sourceHeight!==1254)throw new Error('Fountain PNG source dimensions invalid');
if(state.fountain?.width!==200||state.fountain?.height!==200||state.fountain?.frontWidth!==148||state.fountain?.frontHeight!==148||state.fountain?.frontX!==1366||state.fountain?.frontY!==1508||state.fountain?.frontScale!==0.74||state.fountain?.visualHeight!==236||state.fountain?.baseY!==1592)throw new Error(`Fountain geometry/alignment contract invalid: ${JSON.stringify(state.fountain)}`);
if(behind.audit?.lastLocalDepth!=='behind-front-layer'||behind.audit?.lastDepthCandidates<1)throw new Error(`Behind depth failed: ${JSON.stringify(behind.audit)}`);
if(front.audit?.lastLocalDepth!=='in-front-of-front-layer'||front.audit?.lastFrontActorRedraws<1)throw new Error(`Front depth failed: ${JSON.stringify(front.audit)}`);
if(behind.audit?.backDrawCount<1||behind.audit?.frontDrawCount<1||front.audit?.backDrawCount<1||front.audit?.frontDrawCount<1)throw new Error('Fountain draw counters did not advance');
if(behind.water<900||front.water<900||behind.gold<500||front.gold<500)throw new Error(`Fountain pixels not visible in fountain ROI: ${JSON.stringify({behind,front})}`);
if(consoleErrors.length)throw new Error(`Console/page errors: ${JSON.stringify(consoleErrors)}`);
if(failedRequests.length)throw new Error(`Failed requests: ${JSON.stringify(failedRequests)}`);
if(httpErrors.length)throw new Error(`HTTP errors: ${JSON.stringify(httpErrors)}`);
