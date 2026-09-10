/* KELO-INDEX
 * area: QA / PVP FEEL LIVE
 * owner: browser judge only
 * keys: ICE WALL RECOVERY MOBILITY MOBILE DESKTOP CHROMIUM
 * purpose: observe real Ice Wall recovery locomotion with identical browser trace across variants
 * do-not: NO gameplay writes
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
const URL=process.env.AUDIT_URL||'http://127.0.0.1:8000/';
const scenarios=[
  {name:'mobileLandscape',viewport:{width:844,height:390},deviceScaleFactor:2,hasTouch:true},
  {name:'desktop',viewport:{width:1440,height:900},deviceScaleFactor:1,hasTouch:false}
];
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const out=[];
try{
  for(const sc of scenarios){
    const context=await browser.newContext(sc); const page=await context.newPage(); const errors=[];
    page.on('pageerror',e=>errors.push(String(e.message||e)));
    await page.goto(`${URL}?offline=1&ice-wall-recovery-judge=${Date.now()}`,{waitUntil:'domcontentloaded',timeout:45000});
    await page.waitForFunction(()=>window.KeloRuntimeBootstrap?.ensure,{timeout:15000});
    await page.evaluate(async()=>{await window.KeloRuntimeBootstrap.ensure();await window.KeloAbilitiesLoader?.ensure?.();});
    await page.waitForFunction(()=>window.KeloPvPWorld&&window.KeloPvPCastMovementPrediction&&window.KeloAbilities?.hotbar,{timeout:15000});
    await page.evaluate(async()=>{await window.KeloPvPWorld.ensureCombatReady?.();window.enterPvPWorld();});
    await page.waitForFunction(()=>window.KeloPvPWorld?.state?.combatEnabled===true,{timeout:8000});
    const result=await page.evaluate(async()=>{
      const slots=window.KeloAbilities.hotbar.slots||[];
      const slot=slots.findIndex(s=>s?.definition?.key==='ice_wall');
      if(slot<0) throw new Error('ICE_WALL_SLOT_MISSING');
      window.__iceWallMoveHook=window.KeloInput.after('ice-wall-recovery:move-left',ctx=>{if(ctx?.input){ctx.input.normX=-1;ctx.input.normY=0;}},9999);
      localPlayer.x=2860;localPlayer.y=700;localPlayer.vx=0;localPlayer.vy=0;
      const ok=window.KeloPvPWorld.quickCastSlot(slot);
      if(ok===false) throw new Error('ICE_WALL_CAST_REJECTED');
      const deadline=performance.now()+2500;
      while(performance.now()<deadline){
        const p=window.KeloPvPCastMovementPrediction;
        if(p?.active&&p.phase==='recovery') break;
        await new Promise(requestAnimationFrame);
      }
      const predictor=window.KeloPvPCastMovementPrediction;
      if(!predictor||predictor.phase!=='recovery') throw new Error('ICE_WALL_RECOVERY_NOT_REACHED');
      const samples=[],x0=localPlayer.x,t0=performance.now();
      while(performance.now()-t0<120){
        await new Promise(requestAnimationFrame);
        samples.push({t:performance.now()-t0,x:localPlayer.x,scale:Number(window.KeloPvPCastMovementPrediction?.movementScale)});
      }
      window.__iceWallMoveHook?.off?.();
      const motion=Math.abs(localPlayer.x-x0); let maxStep=0;
      for(let i=1;i<samples.length;i++)maxStep=Math.max(maxStep,Math.abs(samples[i].x-samples[i-1].x));
      const duration=samples.length?samples.at(-1).t:0,velocity=duration>0?motion/(duration/1000):0;
      const recoveryScales=samples.filter(s=>s.scale<.99).map(s=>s.scale).filter(Number.isFinite);
      const scale=recoveryScales.length?recoveryScales.reduce((a,b)=>a+b,0)/recoveryScales.length:NaN;
      return {slot,motion:+motion.toFixed(3),durationMs:+duration.toFixed(2),velocity:+velocity.toFixed(2),maxStep:+maxStep.toFixed(3),scale:+scale.toFixed(4),sampleCount:samples.length};
    });
    result.scenario=sc.name; result.errors=errors; result.expectedSpeed=+(185.28*result.scale).toFixed(2); result.speedError=+Math.abs(result.velocity-result.expectedSpeed).toFixed(2);
    if(errors.length) throw new Error(`${sc.name}:PAGE_ERRORS:${errors.join('|')}`);
    if(!(result.scale>=.55&&result.scale<=.81)) throw new Error(`${sc.name}:BAD_SCALE:${result.scale}`);
    if(!(result.motion>8)) throw new Error(`${sc.name}:NO_MEANINGFUL_MOTION:${result.motion}`);
    if(!(result.maxStep<8)) throw new Error(`${sc.name}:DISCONTINUITY:${result.maxStep}`);
    if(!(result.speedError<28)) throw new Error(`${sc.name}:SPEED_PARITY:${result.velocity}:${result.expectedSpeed}`);
    out.push(result); await context.close();
  }
} finally {await browser.close();}
fs.mkdirSync('audit-artifacts',{recursive:true});
fs.writeFileSync('audit-artifacts/ice-wall-recovery-live.json',JSON.stringify({ok:true,scenarios:out},null,2));
console.log(JSON.stringify({ok:true,scenarios:out},null,2));
console.log('LIVE_ICE_WALL_RECOVERY_MOBILITY_JUDGE_OK');
