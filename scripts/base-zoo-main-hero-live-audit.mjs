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

  // LIVE opens on the auth gate. Enter through the same guest path a player uses,
  // then prove the real movement loop rotates Base Zoo diagonally.
  const guest=page.getByText('Jugar como invitado',{exact:true});
  if(await guest.isVisible().catch(()=>false))await guest.click();
  await page.waitForFunction(()=>!window.KeloInputLocks||!window.KeloInputLocks.isLocked(),{timeout:10000});
  await page.waitForTimeout(300);

  const before=await page.evaluate(()=>({
    drawCount:window.KELO_MAIN_HERO_SPRITE_AUDIT.drawCount,
    lastFace:window.KELO_MAIN_HERO_SPRITE_AUDIT.lastFace,
    inputLocks:window.KeloInputLocks&&window.KeloInputLocks.snapshot?window.KeloInputLocks.snapshot():null
  }));

  await page.keyboard.down('ArrowDown');
  await page.keyboard.down('ArrowRight');
  await page.waitForFunction(()=>window.KELO_MAIN_HERO_SPRITE_AUDIT.lastFace==='down-right',{timeout:5000});
  await page.waitForFunction(previous=>window.KELO_MAIN_HERO_SPRITE_AUDIT.drawCount>previous,{timeout:5000},before.drawCount);
  await page.waitForTimeout(200);
  await page.keyboard.up('ArrowRight');
  await page.keyboard.up('ArrowDown');

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
      inputLocks:window.KeloInputLocks&&window.KeloInputLocks.snapshot?window.KeloInputLocks.snapshot():null
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
  if(result.drawCount<=before.drawCount)failures.push('Base Zoo did not continue rendering while the real player moved');
  if(result.lastFace!=='down-right')failures.push(`real diagonal movement rendered ${result.lastFace}`);
  if(result.inputLocks&&result.inputLocks.locked)failures.push(`input remained locked by ${result.inputLocks.owners.join(',')}`);

  await page.screenshot({path:'artifacts/base-zoo-main-hero-live.png',fullPage:true});
  console.log(JSON.stringify({ok:failures.length===0,before,result,pageErrors:consoleErrors.slice(0,10),failures},null,2));
  if(failures.length)process.exitCode=1;
}finally{
  try{await page.keyboard.up('ArrowRight');await page.keyboard.up('ArrowDown');}catch{}
  await browser.close();
}
