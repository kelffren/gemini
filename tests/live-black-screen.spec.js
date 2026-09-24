/* KELO-INDEX
 * area: TEST / LIVE / BLACK SCREEN
 * owner: Live Black Screen Audit
 * purpose: reproduce the published game exactly as a clean mobile user and capture screenshot/console/network evidence
 * do-not: do not infer from source; observe the deployed UI/runtime only
 */
const { test, expect } = require('@playwright/test');
const fs=require('fs');

test('published Kelo World live boot',async({browser})=>{
  const context=await browser.newContext({
    viewport:{width:390,height:844},
    deviceScaleFactor:3,
    isMobile:true,
    hasTouch:true,
    userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
  });
  const page=await context.newPage();
  const telemetry={console:[],pageErrors:[],failed:[],responses:[],state:null,visual:null,url:null};
  page.on('console',m=>telemetry.console.push({type:m.type(),text:m.text()}));
  page.on('pageerror',e=>telemetry.pageErrors.push(String(e&&e.stack||e)));
  page.on('requestfailed',r=>telemetry.failed.push({url:r.url(),failure:r.failure()?.errorText||null}));
  page.on('response',r=>{if(r.status()>=400)telemetry.responses.push({url:r.url(),status:r.status()});});
  const url='https://kelffren.github.io/gemini/?guest=1&liveBlackScreenAudit='+Date.now();
  const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000});
  telemetry.url=page.url();
  telemetry.httpStatus=response?.status()||null;
  await page.waitForTimeout(12000);
  telemetry.state=await page.evaluate(()=>({
    boot:window.__keloBootReady===true,
    reset:window.KELO_WORLD_DECORATION_RESET,
    gameLoopStarted:window.__keloGameLoopStarted===true,
    worldAudit:window.KELO_WORLD_AUDIT||null,
    plazaAudit:window.KELO_PLAZA_AUDIT||null,
    rendererReady:window.KELO_WORLD_RENDERER?.ready===true,
    canvas:{w:document.getElementById('game-canvas')?.width||0,h:document.getElementById('game-canvas')?.height||0},
    bodyText:(document.body?.innerText||'').slice(0,4000)
  }));
  telemetry.visual=await page.evaluate(()=>{
    const c=document.getElementById('game-canvas');
    if(!c)return {missing:true};
    const g=c.getContext('2d');
    const d=g.getImageData(0,0,c.width,c.height).data;
    let sampled=0,opaque=0,nonDark=0;
    const colors=new Set();
    const step=Math.max(1,Math.floor(Math.sqrt((c.width*c.height)/8000)));
    for(let y=0;y<c.height;y+=step)for(let x=0;x<c.width;x+=step){
      const i=(y*c.width+x)*4,r=d[i],gg=d[i+1],b=d[i+2],a=d[i+3];
      sampled++;if(a>20)opaque++;if(a>20&&Math.max(r,gg,b)>36)nonDark++;
      colors.add((r>>4)+','+(gg>>4)+','+(b>>4)+','+(a>>6));
    }
    return {sampled,opaqueRatio:opaque/sampled,nonDarkRatio:nonDark/sampled,quantizedColors:colors.size};
  });
  fs.mkdirSync('test-results/live-black-screen',{recursive:true});
  fs.writeFileSync('test-results/live-black-screen/telemetry.json',JSON.stringify(telemetry,null,2));
  await page.screenshot({path:'test-results/live-black-screen/live.png',fullPage:true});
  console.log('LIVE_BLACK_SCREEN_TELEMETRY',JSON.stringify(telemetry));
  expect(telemetry.httpStatus).toBeLessThan(400);
  await context.close();
});
