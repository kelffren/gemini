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
  await page.waitForFunction(()=>window.KELO_MAIN_HERO_SPRITE_AUDIT&&window.KELO_AVATAR_RENDER_AUDIT,null,{timeout:120000});
  await page.waitForFunction(()=>window.KELO_MAIN_HERO_SPRITE_AUDIT.readyCount===8,null,{timeout:120000});
  await page.waitForFunction(()=>window.KELO_MAIN_HERO_SPRITE_AUDIT.drawCount>0,null,{timeout:120000});

  const result=await page.evaluate(()=>{
    const audit=window.KELO_MAIN_HERO_SPRITE_AUDIT;
    const renderAudit=window.KELO_AVATAR_RENDER_AUDIT;
    const player=window.localPlayer||(typeof localPlayer!=='undefined'?localPlayer:null);
    if(!player)throw new Error('real localPlayer unavailable');

    const before={
      drawCount:audit.drawCount,
      lastFace:audit.lastFace,
      vx:player.vx,
      vy:player.vy,
      visualMotion:player._visualMotion?{...player._visualMotion}:null
    };

    try{
      player.vx=90;
      player.vy=90;
      player._visualMotion={...(player._visualMotion||{}),dx:1,dy:1,face:'down-right',frame:0};
      window.renderAvatar(player,true);
    }finally{
      player.vx=before.vx;
      player.vy=before.vy;
      if(before.visualMotion)player._visualMotion=before.visualMotion;
      else delete player._visualMotion;
    }

    return {
      before,
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
      renderSource:renderAudit.mainHeroSpriteSource,
      renderGrid:renderAudit.mainHeroSpriteGrid,
      playerRadius:player.radius
    };
  });

  await page.screenshot({path:'artifacts/base-zoo-main-hero-live.png',fullPage:true});

  const expectedSource='assets/base-zoo/Idle/rotations/';
  const failures=[];
  if(result.avatarVersion!=='kelo-avatar-render-v1.2.0-base-zoo')failures.push('wrong avatar version');
  if(result.source!==expectedSource)failures.push('wrong main hero source');
  if(result.renderSource!==expectedSource)failures.push('wrong render audit source');
  if(result.renderGrid!=='8-direction-files')failures.push('wrong directional mode in render audit');
  if(result.directionMode!==8)failures.push('directionMode is not 8');
  if(result.readyCount!==8||!result.complete||result.failedCount!==0)failures.push('not all eight Base Zoo images loaded');
  if(result.before.drawCount<1)failures.push('Base Zoo never rendered as the real local player');
  if(result.drawCount<=result.before.drawCount)failures.push('real localPlayer render did not pass through Base Zoo renderer');
  if(result.lastFace!=='down-right')failures.push(`real localPlayer diagonal rendered ${result.lastFace}`);
  if(!(result.playerRadius>0))failures.push('real localPlayer collider missing');

  console.log(JSON.stringify({ok:failures.length===0,result,pageErrors:consoleErrors.slice(0,10),failures},null,2));
  if(failures.length)process.exitCode=1;
}finally{
  await browser.close();
}
