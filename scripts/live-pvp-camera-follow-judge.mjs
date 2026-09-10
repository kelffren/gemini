/* KELO-INDEX
 * area: QA / CAMERA / PVP
 * owner: Camera Foundation CI
 * keys: CAMERA PVP DEADZONE FOLLOW LOOKAHEAD LANDSCAPE DESKTOP PLAYWRIGHT
 * purpose: mide en Chromium cuándo empieza a seguir la cámara durante strafe PvP y expresa la dead-zone efectiva en píxeles de pantalla
 * online: N/A; solo QA de presentación local
 */
import fs from 'node:fs';
import { chromium } from 'playwright';

const url=process.env.AUDIT_URL||'http://127.0.0.1:8000/';
const chrome=process.env.CHROME_BIN||'/usr/bin/google-chrome';
fs.mkdirSync('artifacts',{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:chrome,args:['--no-sandbox']});

async function run(name,viewport,opts={}){
  const context=await browser.newContext({viewport,deviceScaleFactor:opts.dpr||1,hasTouch:!!opts.touch,isMobile:!!opts.mobile});
  const page=await context.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(String(e?.message||e)));
  await page.goto(url+'?pvpCameraFollowAudit=1',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.KeloCamera&&window.KeloPvPWorld&&window.localPlayer&&window.camera&&window.input,{timeout:20000});
  await windowReady(page);
  const result=await page.evaluate(async()=>{
    await KeloPvPWorld.ensureCombatReady();
    KeloPvPWorld.enter();
    const deadline=performance.now()+5000;
    while(KeloPvPWorld.state.mode!=='pvp'&&performance.now()<deadline)await new Promise(r=>setTimeout(r,25));
    if(KeloPvPWorld.state.mode!=='pvp')throw new Error('PVP_ENTER_TIMEOUT');
    localPlayer.x=2900;localPlayer.y=720;localPlayer.vx=0;localPlayer.vy=0;
    input.normX=0;input.normY=0;input.keys.d=false;
    KeloCamera.setTarget(localPlayer.x,localPlayer.y,{snap:true,source:'pvp-camera-follow-audit'});
    await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
    const start={t:performance.now(),playerX:localPlayer.x,cameraX:camera.x,targetX:camera.targetX,zoom:KeloCamera.getEffectiveZoom(),follow:KeloCamera.getFollowTuning(),legacyDeadRatio:Number(CONFIG.deadXRatio)};
    input.keys.d=true;
    const samples=[];
    let onset=null;
    const until=start.t+1800;
    while(performance.now()<until){
      await new Promise(r=>requestAnimationFrame(r));
      const t=performance.now()-start.t;
      const sample={t,playerX:localPlayer.x,cameraX:camera.x,targetX:camera.targetX,lookOffsetX:camera.lookOffsetX,screenOffsetX:(localPlayer.x-camera.x)*KeloCamera.getEffectiveZoom()};
      samples.push(sample);
      if(!onset&&Math.abs(camera.targetX-start.targetX)>.5)onset=sample;
      if(onset&&t>onset.t+220)break;
    }
    input.keys.d=false;input.normX=0;
    const semanticPx=innerWidth*start.follow.deadXRatio;
    const legacyPx=innerWidth*start.legacyDeadRatio*start.zoom;
    return{viewport:{w:innerWidth,h:innerHeight},start,onset,semanticPx,legacyPx,samples:samples.slice(-12)};
  });
  result.errors=errors;
  await page.screenshot({path:`artifacts/pvp-camera-follow-${name}.png`,fullPage:true});
  await context.close();
  return result;
}

async function windowReady(page){await page.waitForTimeout(300);}
const landscape=await run('mobile-landscape',{width:844,height:390},{dpr:2,touch:true,mobile:true});
const desktop=await run('desktop',{width:1440,height:900},{dpr:1});
const report={ok:!landscape.errors.length&&!desktop.errors.length,landscape,desktop};
fs.writeFileSync('artifacts/pvp-camera-follow-report.json',JSON.stringify(report,null,2));
console.log('PVP_CAMERA_FOLLOW_REPORT '+JSON.stringify(report));
await browser.close();
if(!report.ok)process.exit(1);
