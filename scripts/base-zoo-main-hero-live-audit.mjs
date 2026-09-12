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

  const guest=page.getByText('Jugar como invitado',{exact:true});
  if(await guest.isVisible().catch(()=>false))await guest.click({timeout:10000});
  await page.waitForFunction(()=>!window.KeloInputLocks||!window.KeloInputLocks.isLocked(),null,{timeout:10000});
  await page.waitForTimeout(250);

  const before=await page.evaluate(()=>({
    drawCount:window.KELO_MAIN_HERO_SPRITE_AUDIT.drawCount,
    lastFace:window.KELO_MAIN_HERO_SPRITE_AUDIT.lastFace,
    inputAvailable:typeof input!=='undefined'&&!!input
  }));
  if(!before.inputAvailable)throw new Error('legacy input owner state unavailable');

  // Feed the real legacy input state consumed by KeloInput/processInput instead of
  // relying on browser focus/keyboard delivery. The game loop remains the renderer driver.
  await page.evaluate(()=>{
    input.keys.ArrowDown=true;
    input.keys.ArrowRight=true;
  });
  await page.waitForFunction(()=>window.KELO_MAIN_HERO_SPRITE_AUDIT.lastFace==='down-right',null,{timeout:5000});
  await page.waitForTimeout(180);

  const result=await page.evaluate(()=>{
    const audit=window.KELO_MAIN_HERO_SPRITE_AUDIT;
    const renderAudit=window.KELO_AVATAR_RENDER_AUDIT;
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
      renderSource:renderAudit.mainHeroSpriteSource,
      renderGrid:renderAudit.mainHeroSpriteGrid,
      inputLocks:window.KeloInputLocks&&window.KeloInputLocks.snapshot?window.KeloInputLocks.snapshot():null,
      move:window.KeloInput&&window.KeloInput.snapshot?window.KeloInput.snapshot().combat.move:null
    };
  });

  await page.screenshot({path:'artifacts/base-zoo-main-hero-live.png',fullPage:true});
  await page.evaluate(()=>{
    input.keys.ArrowRight=false;
    input.keys.ArrowDown=false;
  });

  const expectedSource='assets/base-zoo/Idle/rotations/';
  const failures=[];
  if(result.avatarVersion!=='kelo-avatar-render-v1.2.0-base-zoo')failures.push('wrong avatar version');
  if(result.source!==expectedSource)failures.push('wrong main hero source');
  if(result.renderSource!==expectedSource)failures.push('wrong render audit source');
  if(result.renderGrid!=='8-direction-files')failures.push('wrong directional mode in render audit');
  if(result.directionMode!==8)failures.push('directionMode is not 8');
  if(result.readyCount!==8||!result.complete||result.failedCount!==0)failures.push('not all eight Base Zoo images loaded');
  if(before.drawCount<1||result.drawCount<=before.drawCount)failures.push('Base Zoo did not keep rendering through the real game loop');
  if(result.lastFace!=='down-right')failures.push(`real diagonal movement rendered ${result.lastFace}`);
  if(result.inputLocks&&result.inputLocks.locked)failures.push(`input remained locked by ${result.inputLocks.owners.join(',')}`);
  if(!result.move||result.move.x<=0||result.move.y<=0)failures.push('KeloInput did not observe positive diagonal movement');

  console.log(JSON.stringify({ok:failures.length===0,before,result,pageErrors:consoleErrors.slice(0,10),failures},null,2));
  if(failures.length)process.exitCode=1;
}finally{
  try{await page.evaluate(()=>{if(typeof input!=='undefined'&&input){input.keys.ArrowRight=false;input.keys.ArrowDown=false;}});}catch{}
  await browser.close();
}
