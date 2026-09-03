import fs from 'node:fs';
import { chromium } from 'playwright';

const base=process.env.AUDIT_URL||'https://kelffren.github.io/gemini/';
const expectedTitle=process.env.EXPECTED_TITLE||'';
const expectedFountain=process.env.EXPECTED_FOUNTAIN||'plaza-fountain-v1.4';
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
    await page.goto(`${base}?fountain-audit=${Date.now()}-${attempt}`,{waitUntil:'networkidle',timeout:45000});
    const d=await page.evaluate(()=>({title:document.title,fountain:window.KELO_PLAZA_FOUNTAIN_AUDIT||null,plaza:window.KELO_PLAZA_AUDIT||null}));
    if((!expectedTitle||d.title===expectedTitle)&&d.fountain?.ready&&!d.fountain?.failed&&d.fountain?.version===expectedFountain&&d.fountain?.assetMode==='authored-png-layer-pair-v1'&&d.fountain?.renderWrapped&&d.plaza?.fountainReady){loaded=true;break;}
  }catch(e){console.log(`attempt ${attempt}: ${e.message}`)}
  await page.waitForTimeout(10000);
}

consoleErrors.length=0;failedRequests.length=0;httpErrors.length=0;
await page.goto(`${base}?fountain-audit=final-${Date.now()}`,{waitUntil:'networkidle',timeout:45000});
await page.waitForTimeout(2500);

async function capture(name,y){
  const result=await page.evaluate(({y})=>{
    const c=document.getElementById('game-canvas');
    localPlayer.x=1440;localPlayer.y=y;camera.x=1440;camera.y=1520;camera.targetX=1440;camera.targetY=1520;render();
    const g=c.getContext('2d');
    const z=CONFIG.zoom||1,dpr=c.width/c.clientWidth;
    const f=window.KELO_PLAZA_FOUNTAIN_AUDIT;
    const x0=Math.max(0,Math.floor((screenW/2+(f.x-camera.x)*z-8)*dpr));
    const y0=Math.max(0,Math.floor((screenH/2+(f.y-camera.y)*z-8)*dpr));
    const x1=Math.min(c.width,Math.ceil((screenW/2+(f.x+f.width-camera.x)*z+8)*dpr));
    const y1=Math.min(c.height,Math.ceil((screenH/2+(f.y+f.height-camera.y)*z+8)*dpr));
    const img=g.getImageData(x0,y0,x1-x0,y1-y0),px=img.data;
    let water=0,gold=0,ivory=0;
    for(let i=0;i<px.length;i+=4){const r=px[i],gg=px[i+1],b=px[i+2],a=px[i+3];if(a<200)continue;if(r<95&&gg>135&&b>145&&b>r*1.5)water++;if(r>175&&gg>100&&gg<215&&b<105)gold++;if(r>210&&gg>195&&b>155)ivory++;}
    return{dataUrl:c.toDataURL('image/png'),audit:{...f},roi:{x0,y0,x1,y1,width:x1-x0,height:y1-y0},water,gold,ivory};
  },{y});
  fs.writeFileSync(`artifacts/${name}.png`,Buffer.from(result.dataUrl.split(',')[1],'base64'));
  delete result.dataUrl;return result;
}

const behind=await capture('live-fountain-behind',1520);
const front=await capture('live-fountain-front',1600);
const state=await page.evaluate(()=>({title:document.title,fountain:{...window.KELO_PLAZA_FOUNTAIN_AUDIT},plaza:window.KELO_PLAZA_AUDIT||null,canvas:(()=>{const c=document.getElementById('game-canvas');return{width:c.width,height:c.height,cssWidth:c.clientWidth,cssHeight:c.clientHeight}})()}));
const report={loaded,state,behind,front,consoleErrors,failedRequests,httpErrors};
fs.writeFileSync('artifacts/fountain-report.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
await browser.close();

if(!loaded)throw new Error('LIVE never reached layered PNG fountain contract');
if(expectedTitle&&state.title!==expectedTitle)throw new Error(`Title mismatch ${state.title} !== ${expectedTitle}`);
if(state.fountain?.version!==expectedFountain)throw new Error(`Fountain version mismatch ${state.fountain?.version} !== ${expectedFountain}`);
if(!state.fountain?.ready||state.fountain?.failed||!state.fountain?.backLoaded||!state.fountain?.frontLoaded||!state.fountain?.renderWrapped)throw new Error('Fountain assets/depth compositor not ready');
if(state.fountain?.assetMode!=='authored-png-layer-pair-v1')throw new Error(`Fountain asset mode invalid: ${state.fountain?.assetMode}`);
if(state.fountain?.sourceWidth!==1499||state.fountain?.sourceHeight!==1049)throw new Error('Fountain PNG source dimensions invalid');
if(!String(state.fountain?.backAsset||'').includes('plaza-fountain-back.PNG')||!String(state.fountain?.frontAsset||'').includes('plaza-fountain-front.PNG'))throw new Error('Fountain is not using requested uppercase PNG assets');
if(state.fountain?.width!==200||state.fountain?.height!==140||state.fountain?.baseY!==1555||state.fountain?.depthMode!=='final-composite-back-actor-front-v2')throw new Error('Fountain geometry/depth contract invalid');
if(behind.audit?.lastLocalDepth!=='behind-front-layer'||behind.audit?.lastActorRedraws<1)throw new Error(`Behind depth failed: ${JSON.stringify(behind.audit)}`);
if(front.audit?.lastLocalDepth!=='in-front-of-front-layer'||front.audit?.lastFrontActorRedraws<1)throw new Error(`Front depth failed: ${JSON.stringify(front.audit)}`);
if(behind.audit?.backDrawCount<1||behind.audit?.frontDrawCount<1||front.audit?.backDrawCount<1||front.audit?.frontDrawCount<1)throw new Error('Fountain draw counters did not advance');
if(behind.water<900||front.water<900||behind.gold<500||front.gold<500)throw new Error(`Fountain pixels not visible in fountain ROI: ${JSON.stringify({behind,front})}`);
if(consoleErrors.length)throw new Error(`Console/page errors: ${JSON.stringify(consoleErrors)}`);
if(failedRequests.length)throw new Error(`Failed requests: ${JSON.stringify(failedRequests)}`);
if(httpErrors.length)throw new Error(`HTTP errors: ${JSON.stringify(httpErrors)}`);
