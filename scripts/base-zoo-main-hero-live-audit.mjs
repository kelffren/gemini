import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const url=process.env.AUDIT_URL||'https://kelffren.github.io/gemini/';
const executablePath=process.env.CHROME_BIN||'/usr/bin/google-chrome';
await fs.mkdir('artifacts',{recursive:true});

const browser=await chromium.launch({headless:true,executablePath,args:['--no-sandbox','--disable-dev-shm-usage']});
const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1});
const consoleErrors=[];
page.on('pageerror',error=>consoleErrors.push(String(error&&error.message||error)));

try{
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:120000});
  await page.waitForFunction(()=>window.KELO_MAIN_HERO_SPRITE_AUDIT&&window.KELO_AVATAR_RENDER_AUDIT,{timeout:120000});
  await page.waitForFunction(()=>window.KELO_MAIN_HERO_SPRITE_AUDIT.readyCount===8,{timeout:120000});
  await page.waitForFunction(()=>window.KELO_MAIN_HERO_SPRITE_AUDIT.drawCount>0,{timeout:120000});

  const result=await page.evaluate(()=>{
    const audit=window.KELO_MAIN_HERO_SPRITE_AUDIT;
    const renderAudit=window.KELO_AVATAR_RENDER_AUDIT;
    const actor=window.JUGADOR_MUNDO;
    const before=actor?{
      vx:actor.vx,vy:actor.vy,
      visual:actor._visualMotion?{...actor._visualMotion}:null
    }:null;
    let diagonalFace=null;
    if(actor&&typeof window.renderAvatar==='function'){
      actor.vx=90;
      actor.vy=90;
      actor._visualMotion={...(actor._visualMotion||{}),dx:1,dy:1};
      window.renderAvatar(actor,true);
      diagonalFace=audit.lastFace;
      actor.vx=before.vx;
      actor.vy=before.vy;
      if(before.visual)actor._visualMotion=before.visual;
      else delete actor._visualMotion;
    }
    return {
      avatarVersion:window.KeloAvatar&&window.KeloAvatar.version,
      source:audit.source,
      state:audit.state,
      directionMode:audit.directionMode,
      ready:audit.ready,
      complete:audit.complete,
      readyCount:audit.readyCount,
      failedCount:audit.failedCount,
      drawCount:audit.drawCount,
      lastFace:audit.lastFace,
      diagonalFace,
      renderSource:renderAudit.mainHeroSpriteSource,
      renderGrid:renderAudit.mainHeroSpriteGrid,
      actorFound:!!actor
    };
  });

  const expectedSource='assets/base-zoo/Idle/rotations/';
  const failures=[];
  if(result.avatarVersion!=='kelo-avatar-render-v1.2.0-base-zoo')failures.push('wrong avatar version');
  if(result.source!==expectedSource)failures.push('wrong main hero source');
  if(result.renderSource!==expectedSource)failures.push('wrong render audit source');
  if(result.renderGrid!=='8-direction-files')failures.push('wrong directional mode in render audit');
  if(result.directionMode!==8)failures.push('directionMode is not 8');
  if(result.readyCount!==8||!result.complete||result.failedCount!==0)failures.push('not all eight Base Zoo images loaded');
  if(result.drawCount<1)failures.push('Base Zoo did not render as the local player');
  if(!result.actorFound)failures.push('JUGADOR_MUNDO missing');
  if(result.diagonalFace!=='down-right')failures.push(`diagonal resolver returned ${result.diagonalFace}`);

  await page.screenshot({path:'artifacts/base-zoo-main-hero-live.png',fullPage:true});
  console.log(JSON.stringify({ok:failures.length===0,result,pageErrors:consoleErrors.slice(0,10),failures},null,2));
  if(failures.length)process.exitCode=1;
}finally{
  await browser.close();
}
