/* KELO-INDEX
 * area: TEST / PVP / APPEARANCE
 * keys: PVP CAST AIM FACING MOVE DIAGONAL MOBILE DESKTOP PLAYWRIGHT
 * hace: mide en Chromium si el sprite conserva aim durante windup/active de una ability mientras el jugador se mueve en diagonal
 * online: N/A; valida presentación local separada de autoridad y usa la timeline predicha compartida
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';

const URL=process.env.AUDIT_URL||'http://127.0.0.1:8000/';
const OUT=process.env.AUDIT_OUT||'artifacts/pvp-cast-facing-live';
const STRICT=process.env.CAST_FACING_STRICT==='1';
fs.mkdirSync(OUT,{recursive:true});
const browser=await chromium.launch({headless:true});
const report={url:URL,strict:STRICT,runs:[],createdAt:new Date().toISOString()};

async function ready(page){
  await page.waitForFunction(()=>window.KeloRuntimeBootstrap&&typeof window.KeloRuntimeBootstrap.ensure==='function',{timeout:30000});
  await page.evaluate(async()=>{await window.KeloRuntimeBootstrap.ensure();});
  await page.waitForFunction(()=>window.KeloPvPWorld&&window.KeloPvPCastMovementPrediction&&window.KeloAbilities&&window.KELO_CHARACTER_APPEARANCE_AUDIT&&typeof window.enterPvPWorld==='function',{timeout:30000});
  await page.evaluate(()=>window.enterPvPWorld());
  await page.waitForFunction(()=>window.KeloPvPWorld&&window.KeloPvPWorld.state.mode==='pvp',{timeout:5000});
}

async function sample(page,label){
  return page.evaluate((label)=>({
    label,
    predictor:{active:!!window.KeloPvPCastMovementPrediction?.active,phase:window.KeloPvPCastMovementPrediction?.phase||null},
    actorFace:localPlayer._face||null,
    movementFace:window.KELO_MOVEMENT_AUDIT?.movementFace||localPlayer._visualMotion?.face||null,
    renderFace:window.KELO_CHARACTER_APPEARANCE_AUDIT?.lastDraw?.face||null,
    faceSource:window.KELO_CHARACTER_APPEARANCE_AUDIT?.lastDraw?.faceSource||null,
    pos:{x:localPlayer.x,y:localPlayer.y},
    visualOn:!!localPlayer._visualMotion?.on
  }),label);
}

async function scenario(label,viewport,hasTouch){
  const context=await browser.newContext({viewport,hasTouch,isMobile:hasTouch,deviceScaleFactor:hasTouch?2:1});
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto(URL+'?cast-facing-audit='+Date.now(),{waitUntil:'domcontentloaded'});
  await ready(page);
  await page.evaluate(()=>{
    localPlayer.x=2790;localPlayer.y=720;
    window.KeloPvPWorld.setAimWorld({x:2790,y:520},'cast-facing-audit',1);
  });
  await page.keyboard.down('d');
  await page.keyboard.down('s');
  await page.waitForTimeout(120);
  const before=await sample(page,'before-cast');
  await page.evaluate(()=>{
    window.KeloPvPWorld.setAimWorld({x:localPlayer.x,y:localPlayer.y-200},'cast-facing-audit',1);
    window.KeloAbilities.bus.emit('ABILITY_CAST',{abilityKey:'fireball',abilityId:1,actor:localPlayer,actorId:String(localPlayer.id||'local'),direction:{x:0,y:-1},predicted:true});
  });
  await page.waitForTimeout(25);
  const windup=await sample(page,'windup');
  await page.waitForTimeout(70);
  const active=await sample(page,'active-or-early-recovery');
  await page.waitForTimeout(85);
  const recovery=await sample(page,'recovery');
  await page.keyboard.up('d');
  await page.keyboard.up('s');
  await page.screenshot({path:path.join(OUT,`${label}-cast-facing.png`),fullPage:true});
  report.runs.push({label,viewport,hasTouch,errors,before,windup,active,recovery});
  await context.close();
}

await scenario('mobile',{width:390,height:844},true);
await scenario('desktop',{width:1440,height:900},false);
await browser.close();
fs.writeFileSync(path.join(OUT,'report.json'),JSON.stringify(report,null,2));

const hardErrors=report.runs.flatMap(r=>r.errors).filter(e=>!/favicon|Failed to load resource/.test(e));
if(hardErrors.length){console.error(hardErrors.join('\n'));process.exit(1);}
for(const run of report.runs){
  if(!run.windup.predictor.active)throw new Error('cast predictor never became active: '+run.label);
  if(STRICT){
    if(run.windup.predictor.phase!=='windup')throw new Error('expected windup phase: '+run.label+' '+JSON.stringify(run.windup));
    if(run.windup.faceSource!=='combat-aim'||run.windup.renderFace!=='up')throw new Error('windup lost combat aim: '+run.label+' '+JSON.stringify(run.windup));
    if(run.recovery.predictor.active&&run.recovery.predictor.phase==='recovery'&&run.recovery.faceSource!=='movement')throw new Error('recovery should return locomotion facing: '+run.label+' '+JSON.stringify(run.recovery));
  }
}
console.log(JSON.stringify(report,null,2));
console.log('PVP_CAST_FACING_JUDGE_OK strict='+STRICT);
