/* KELO-INDEX
 * area: QA / PVP CAST RECOVERY MOBILITY
 * owner: browser integration judge only
 * keys: FIREBALL RECOVERY CANDIDATE B 088 MOBILE DESKTOP PLAYWRIGHT
 * purpose: ejecuta la misma traza LIVE de Candidate A inyectando solo una policy temporal recovery=.88 en ABILITIES antes de ABILITY_CAST
 * do-not: NO production writes, NO persisted gameplay tuning
 */
import { chromium } from 'playwright';
const base=process.env.AUDIT_URL||'http://127.0.0.1:8000/';
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const viewports=[
  {name:'mobile-landscape',viewport:{width:844,height:390},isMobile:true,hasTouch:true,deviceScaleFactor:2},
  {name:'desktop',viewport:{width:1440,height:900},isMobile:false,hasTouch:false,deviceScaleFactor:1}
];
const results=[];
for(const cfg of viewports){
  const context=await browser.newContext(cfg),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(String(e.message||e)));
  await page.goto(`${base}?offline=1&fireball-recovery-mobility-b=${Date.now()}`,{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForFunction(()=>window.KeloRuntimeBootstrap?.ensure,{timeout:15000});
  await page.evaluate(async()=>{await window.KeloRuntimeBootstrap.ensure();await window.KeloAbilitiesLoader?.ensure?.();});
  await page.waitForFunction(()=>window.KeloPvPWorld&&window.KeloAbilities?.hotbar&&window.KeloInput?.after,{timeout:15000});
  await page.evaluate(async()=>{await window.KeloPvPWorld.ensureCombatReady?.();window.enterPvPWorld();});
  await page.waitForFunction(()=>window.KeloPvPWorld?.state?.combatEnabled===true,{timeout:8000});
  const slot=await page.evaluate(()=>{const a=window.KeloAbilities.hotbar.slots||[];return a.findIndex(x=>x?.definition?.key==='fireball');});
  if(slot<0)throw new Error(`FIREBALL_SLOT_MISSING:${cfg.name}`);
  await page.evaluate(()=>{
    window.ABILITIES=(window.ABILITIES||[]).map(def=>def?.key==='fireball'?Object.freeze({...def,action:Object.freeze({...def.action,movementScale:Object.freeze({windup:.78,active:.78,recovery:.88})})}):def);
    window.__fbRecoveryHook=window.KeloInput.after('fb-recovery-b-judge:left',ctx=>{if(ctx?.input){ctx.input.normX=-1;ctx.input.normY=0;}},9999);
    localPlayer.x=2860;localPlayer.y=700;localPlayer.vx=0;localPlayer.vy=0;
  });
  const cast=await page.evaluate(slot=>({ok:window.KeloPvPWorld.quickCastSlot(slot),x:localPlayer.x,t:performance.now()}),slot);
  await page.waitForFunction(()=>{
    const a=window.KELO_PVP_CAST_MOVEMENT_AUDIT;
    return a?.active===true&&a.phase==='recovery'&&Number(a.movementScale)>=.875&&Number(a.movementScale)<=.885;
  },{timeout:900,polling:'raf'});
  const start=await page.evaluate(()=>({x:localPlayer.x,t:performance.now(),audit:{...window.KELO_PVP_CAST_MOVEMENT_AUDIT},vx:localPlayer.vx}));
  await page.waitForTimeout(100);
  const end=await page.evaluate(()=>({x:localPlayer.x,t:performance.now(),audit:{...window.KELO_PVP_CAST_MOVEMENT_AUDIT},vx:localPlayer.vx}));
  const elapsed=end.t-start.t,dx=start.x-end.x,velocity=elapsed>0?dx/(elapsed/1000):0;
  const ok=cast.ok!==false&&Number(start.audit.movementScale)>=.875&&Number(start.audit.movementScale)<=.885&&dx>15&&dx<18&&velocity>155&&errors.length===0;
  const row={viewport:cfg.name,cast,start,end,elapsedMs:+elapsed.toFixed(2),leftDistancePx:+dx.toFixed(3),observedVelocity:+velocity.toFixed(2),pageErrors:errors,ok};
  results.push(row);
  if(!ok)throw new Error(`FIREBALL_RECOVERY_MOBILITY_B_FAIL:${cfg.name}:${JSON.stringify(row)}`);
  await context.close();
}
await browser.close();
console.log(JSON.stringify({ok:true,candidateBRecoveryScale:.88,results},null,2));
