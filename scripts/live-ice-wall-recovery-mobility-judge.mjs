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
  {name:'mobileLandscape',width:844,height:390,dpr:2,touch:true},
  {name:'desktop',width:1440,height:900,dpr:1,touch:false}
];
const browser=await chromium.launch({headless:true});
const out=[];
try{
  for(const sc of scenarios){
    const context=await browser.newContext({viewport:{width:sc.width,height:sc.height},deviceScaleFactor:sc.dpr,hasTouch:sc.touch});
    const page=await context.newPage(); const errors=[];
    page.on('pageerror',e=>errors.push(String(e.message||e)));
    await page.goto(URL,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>typeof input!=='undefined'&&typeof localPlayer!=='undefined'&&window.KeloPvPCastMovementPrediction&&Array.isArray(window.KeloAbilities),null,{timeout:15000});
    const result=await page.evaluate(async()=>{
      const sleep=ms=>new Promise(r=>setTimeout(r,ms));
      const abilityIndex=window.KeloAbilities.findIndex(a=>a&&a.key==='ice_wall');
      if(abilityIndex<0) throw new Error('ICE_WALL_SLOT_MISSING');
      const slot=abilityIndex+1;
      input.keys.clear(); input.uiPressed.clear();
      input.keys.add('KeyA');
      await sleep(60);
      input.uiPressed.add('ability'+slot);
      await sleep(20);
      input.uiPressed.delete('ability'+slot);
      const deadline=performance.now()+2500;
      while(performance.now()<deadline){
        const p=window.KeloPvPCastMovementPrediction;
        if(p&&p.active&&p.phase==='recovery') break;
        await new Promise(requestAnimationFrame);
      }
      const predictor=window.KeloPvPCastMovementPrediction;
      if(!predictor||predictor.phase!=='recovery') throw new Error('ICE_WALL_RECOVERY_NOT_REACHED');
      const samples=[]; const x0=localPlayer.x; const t0=performance.now();
      while(performance.now()-t0<120){
        await new Promise(requestAnimationFrame);
        samples.push({t:performance.now()-t0,x:localPlayer.x,scale:Number(window.KeloPvPCastMovementPrediction?.movementScale)});
      }
      input.keys.delete('KeyA');
      const motion=Math.abs(localPlayer.x-x0);
      let maxStep=0;
      for(let i=1;i<samples.length;i++) maxStep=Math.max(maxStep,Math.abs(samples[i].x-samples[i-1].x));
      const duration=samples.length?samples.at(-1).t:0;
      const velocity=duration>0?motion/(duration/1000):0;
      const scales=samples.map(s=>s.scale).filter(Number.isFinite);
      const scale=scales.length?scales.reduce((a,b)=>a+b,0)/scales.length:NaN;
      return {slot,motion:+motion.toFixed(3),durationMs:+duration.toFixed(2),velocity:+velocity.toFixed(2),maxStep:+maxStep.toFixed(3),scale:+scale.toFixed(4),sampleCount:samples.length};
    });
    result.scenario=sc.name; result.errors=errors;
    const expectedSpeed=185.28*result.scale;
    result.expectedSpeed=+expectedSpeed.toFixed(2);
    result.speedError=+Math.abs(result.velocity-expectedSpeed).toFixed(2);
    if(errors.length) throw new Error(`${sc.name}:PAGE_ERRORS:${errors.join('|')}`);
    if(!(result.scale>=.55&&result.scale<=.81)) throw new Error(`${sc.name}:BAD_SCALE:${result.scale}`);
    if(!(result.motion>8)) throw new Error(`${sc.name}:NO_MEANINGFUL_MOTION:${result.motion}`);
    if(!(result.maxStep<8)) throw new Error(`${sc.name}:DISCONTINUITY:${result.maxStep}`);
    if(!(result.speedError<28)) throw new Error(`${sc.name}:SPEED_PARITY:${result.velocity}:${expectedSpeed}`);
    out.push(result); await context.close();
  }
} finally {await browser.close();}
fs.mkdirSync('audit-artifacts',{recursive:true});
fs.writeFileSync('audit-artifacts/ice-wall-recovery-live.json',JSON.stringify({ok:true,scenarios:out},null,2));
console.log(JSON.stringify({ok:true,scenarios:out},null,2));
console.log('LIVE_ICE_WALL_RECOVERY_MOBILITY_JUDGE_OK');
