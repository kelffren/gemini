/* KELO-INDEX
 * area: TEST / PVP / CAMERA
 * keys: PVP CAMERA CAST STRAFE REVERSAL RECOVERY MOBILE DESKTOP PLAYWRIGHT INPUT
 * hace: reproduce cast estacionario -> recovery -> strafe contrario y mide cuánto framing residual del cast sobrevive usando el input LIVE que processInput consume
 * online: N/A; valida presentación local sobre owners LIVE sin cambiar autoridad gameplay
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';

const URL=process.env.AUDIT_URL||'http://127.0.0.1:8000/';
const OUT=process.env.AUDIT_OUT||'artifacts/pvp-cast-strafe-camera-live';
const STRICT=process.env.CAST_STRAFE_CAMERA_STRICT==='1';
fs.mkdirSync(OUT,{recursive:true});
const browser=await chromium.launch({headless:true});
const report={url:URL,strict:STRICT,runs:[],createdAt:new Date().toISOString()};

async function ready(page){
  await page.waitForFunction(()=>window.KeloRuntimeBootstrap&&typeof window.KeloRuntimeBootstrap.ensure==='function',{timeout:30000});
  await page.evaluate(async()=>{await window.KeloRuntimeBootstrap.ensure();});
  await page.waitForFunction(()=>window.KeloPvPWorld&&window.KeloPvPCastMovementPrediction&&window.KeloAbilities&&window.KeloCamera&&window.KeloInput&&typeof window.enterPvPWorld==='function',{timeout:30000});
  await page.evaluate(()=>window.enterPvPWorld());
  await page.waitForFunction(()=>window.KeloPvPWorld?.state?.mode==='pvp'&&window.KeloPvPWorld?.state?.combatEnabled===true,{timeout:8000});
}

async function scenario(label,viewport,hasTouch){
  const context=await browser.newContext({viewport,hasTouch,isMobile:hasTouch,deviceScaleFactor:hasTouch?2:1});
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto(URL+'?offline=1&cast-strafe-camera-audit='+Date.now(),{waitUntil:'domcontentloaded'});
  await ready(page);
  await page.evaluate(()=>{
    localPlayer.x=2860; localPlayer.y=700; localPlayer.vx=0; localPlayer.vy=0;
    if(typeof input!=='undefined'&&input){input.normX=0;input.normY=0;input.keys.a=false;input.keys.ArrowLeft=false;}
    window.KeloInput.combat.setAxes({source:'cast-strafe-camera-audit',move:{x:0,y:0,magnitude:0}});
    window.KeloPvPWorld.setAimWorld({x:localPlayer.x+240,y:localPlayer.y},'cast-strafe-camera-audit',1);
    window.KeloAbilities.bus.emit('ABILITY_CAST',{abilityKey:'fireball',abilityId:1,actor:localPlayer,actorId:String(localPlayer.id||'local'),direction:{x:1,y:0},predicted:true});
  });
  await page.waitForFunction(()=>window.KeloPvPCastMovementPrediction?.phase==='active',{timeout:1500});
  await page.waitForTimeout(45);
  const peak=await page.evaluate(()=>window.KeloCamera.snapshot().combatFraming.stationaryActionOffsetScreenX);
  await page.waitForFunction(()=>window.KeloPvPCastMovementPrediction?.phase==='recovery',{timeout:1500});
  const beforeMove=await page.evaluate(()=>({
    t:performance.now(),offset:window.KeloCamera.snapshot().combatFraming.stationaryActionOffsetScreenX,
    x:localPlayer.x,y:localPlayer.y,phase:window.KeloPvPCastMovementPrediction?.phase,
    cameraVersion:window.KeloCamera.version
  }));

  // Use the same key state consumed by legacy processInput -> KeloMovement.
  // Directly assigning input.normX is invalid because processInput rewrites it every simulation frame.
  await page.keyboard.down('ArrowLeft');
  await page.waitForFunction(()=>typeof input!=='undefined'&&input.normX < -0.9,{timeout:500});
  const accepted=await page.evaluate(()=>({t:performance.now(),normX:input.normX,normY:input.normY,x:localPlayer.x,y:localPlayer.y}));

  const samples=[];
  for(let i=0;i<16;i++){
    samples.push(await page.evaluate(()=>({t:performance.now(),offset:window.KeloCamera.snapshot().combatFraming.stationaryActionOffsetScreenX,x:localPlayer.x,y:localPlayer.y,lookX:window.KeloCamera.snapshot().lookOffsetX,intentX:window.KeloCamera.snapshot().combatFraming.intentX,normX:input.normX})));
    await page.waitForTimeout(16);
  }
  await page.keyboard.up('ArrowLeft');
  const startT=samples[0]?.t||accepted.t;
  const settle=samples.find(s=>Math.abs(s.offset)<=4);
  const settleMs=settle?settle.t-startT:null;
  let maxStep=0;
  for(let i=1;i<samples.length;i++)maxStep=Math.max(maxStep,Math.abs(samples[i].offset-samples[i-1].offset));
  const travel=Math.hypot((samples.at(-1)?.x??accepted.x)-accepted.x,(samples.at(-1)?.y??accepted.y)-accepted.y);
  const movedLeft=(samples.at(-1)?.x??accepted.x)<accepted.x;
  await page.screenshot({path:path.join(OUT,`${label}-cast-strafe-camera.png`),fullPage:true});
  report.runs.push({label,viewport,hasTouch,errors,peak,beforeMove,accepted,samples,settleMs,maxStep,travel,movedLeft});
  await context.close();
}

await scenario('mobile-landscape',{width:844,height:390},true);
await scenario('desktop',{width:1440,height:900},false);
await browser.close();
fs.writeFileSync(path.join(OUT,'report.json'),JSON.stringify(report,null,2));

const hardErrors=report.runs.flatMap(r=>r.errors).filter(e=>!/favicon|Failed to load resource/.test(e));
if(hardErrors.length){console.error(hardErrors.join('\n'));process.exit(1);}
for(const run of report.runs){
  if(run.peak<8)throw new Error('stationary cast framing did not reproduce: '+run.label+' peak='+run.peak);
  if(run.beforeMove.phase!=='recovery')throw new Error('strafe did not start from recovery: '+run.label);
  if(!(run.accepted?.normX < -0.9))throw new Error('LEFT input was not accepted by processInput: '+run.label);
  if(!run.movedLeft||run.travel<20)throw new Error('LEFT strafe did not resolve physically: '+run.label+' travel='+run.travel);
  if(run.maxStep>8)throw new Error('camera release snaps: '+run.label+' maxStep='+run.maxStep);
  if(STRICT&&(run.settleMs==null||run.settleMs>75))throw new Error('camera carry survives too long into opposite strafe: '+run.label+' settleMs='+run.settleMs);
}
console.log(JSON.stringify(report,null,2));
console.log('PVP_CAST_STRAFE_CAMERA_JUDGE_OK strict='+STRICT);
