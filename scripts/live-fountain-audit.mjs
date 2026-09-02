import fs from 'node:fs';
import { chromium } from 'playwright';

const base=process.env.AUDIT_URL||'https://kelffren.github.io/gemini/';
const expectedTitle=process.env.EXPECTED_TITLE||'';
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
    if((!expectedTitle||d.title===expectedTitle)&&d.fountain?.ready&&!d.fountain?.failed&&d.fountain?.version==='plaza-fountain-v1.1'&&d.fountain?.worldWrapped&&d.fountain?.renderWrapped&&d.plaza?.fountainReady){loaded=true;break;}
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
    const px=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
    let water=0,gold=0,ivory=0;
    for(let i=0;i<px.length;i+=4){const r=px[i],g=px[i+1],b=px[i+2],a=px[i+3];if(a<200)continue;if(b>130&&g>105&&g>r*1.2)water++;if(r>160&&g>90&&g<210&&b<100)gold++;if(r>205&&g>190&&b>150)ivory++;}
    return{dataUrl:c.toDataURL('image/png'),audit:{...window.KELO_PLAZA_FOUNTAIN_AUDIT},water,gold,ivory};
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

if(!loaded)throw new Error('LIVE never reached layered fountain contract');
if(expectedTitle&&state.title!==expectedTitle)throw new Error(`Title mismatch ${state.title} !== ${expectedTitle}`);
if(!state.fountain?.ready||state.fountain?.failed||!state.fountain?.backLoaded||!state.fountain?.frontLoaded||!state.fountain?.worldWrapped||!state.fountain?.renderWrapped)throw new Error('Fountain assets/depth wrappers not ready');
if(state.fountain?.width!==200||state.fountain?.height!==140||state.fountain?.baseY!==1555)throw new Error('Fountain geometry contract invalid');
if(behind.audit?.lastLocalDepth!=='behind-front-layer')throw new Error(`Behind depth failed: ${behind.audit?.lastLocalDepth}`);
if(front.audit?.lastLocalDepth!=='in-front-of-front-layer'||front.audit?.lastFrontActorRedraws<1)throw new Error(`Front depth failed: ${JSON.stringify(front.audit)}`);
if(behind.water<500||front.water<500||behind.gold<500||front.gold<500)throw new Error(`Fountain pixels not visible: ${JSON.stringify({behind,front})}`);
if(consoleErrors.length)throw new Error(`Console/page errors: ${JSON.stringify(consoleErrors)}`);
if(failedRequests.length)throw new Error(`Failed requests: ${JSON.stringify(failedRequests)}`);
if(httpErrors.length)throw new Error(`HTTP errors: ${JSON.stringify(httpErrors)}`);
