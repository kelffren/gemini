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
  await page.waitForFunction(()=>window.KELO_MAIN_HERO_SPRITE_AUDIT&&window.KELO_AVATAR_RENDER_AUDIT&&window.KELO_CHARACTER_APPEARANCE_AUDIT,null,{timeout:120000});
  await page.waitForFunction(()=>window.KELO_CHARACTER_APPEARANCE_AUDIT.version==='character-appearance-v2.8.0-base-zoo-main',null,{timeout:120000});
  await page.waitForFunction(()=>window.KELO_MAIN_HERO_SPRITE_AUDIT.readyCount===8,null,{timeout:120000});

  // Remove the auth cover when possible so the screenshot shows the game itself.
  const guest=page.getByText('Jugar como invitado',{exact:true});
  if(await guest.isVisible().catch(()=>false)){
    await guest.click({timeout:10000}).catch(()=>{});
    await page.waitForTimeout(600);
  }

  await page.waitForFunction(()=>window.KELO_MAIN_HERO_SPRITE_AUDIT.drawCount>0&&window.KELO_CHARACTER_APPEARANCE_AUDIT.localPlayerDelegates>0,null,{timeout:120000});

  const before=await page.evaluate(()=>({
    drawCount:window.KELO_MAIN_HERO_SPRITE_AUDIT.drawCount,
    delegateCount:window.KELO_CHARACTER_APPEARANCE_AUDIT.localPlayerDelegates
  }));
  await page.waitForTimeout(800);

  const result=await page.evaluate(()=>{
    const audit=window.KELO_MAIN_HERO_SPRITE_AUDIT;
    const renderAudit=window.KELO_AVATAR_RENDER_AUDIT;
    const appearanceAudit=window.KELO_CHARACTER_APPEARANCE_AUDIT;
    const avatar=window.KeloAvatar&&window.KeloAvatar.snapshot?window.KeloAvatar.snapshot():null;
    return {
      avatarVersion:window.KeloAvatar&&window.KeloAvatar.version,
      appearanceVersion:appearanceAudit.version,
      appearanceLocalOwner:appearanceAudit.localPlayerBodyOwner,
      appearanceDelegateCount:appearanceAudit.localPlayerDelegates,
      source:audit.source,
      state:audit.state,
      directionMode:audit.directionMode,
      ready:audit.ready,
      complete:audit.complete,
      readyCount:audit.readyCount,
      failedCount:audit.failedCount,
      drawCount:audit.drawCount,
      lastFace:audit.lastFace,
      middlewareId:audit.middlewareId,
      renderSource:renderAudit.mainHeroSpriteSource,
      renderGrid:renderAudit.mainHeroSpriteGrid,
      middleware:avatar&&avatar.middleware?avatar.middleware:[]
    };
  });

  await page.screenshot({path:'artifacts/base-zoo-main-hero-live.png',fullPage:true});

  const expectedSource='assets/base-zoo/Idle/rotations/';
  const owners=result.middleware.map(item=>item.owner);
  const failures=[];
  if(result.avatarVersion!=='kelo-avatar-render-v1.2.0-base-zoo')failures.push('wrong avatar version');
  if(result.appearanceVersion!=='character-appearance-v2.8.0-base-zoo-main')failures.push('stale character appearance owner');
  if(result.appearanceLocalOwner!=='main-hero:base-zoo')failures.push('character appearance does not delegate local body to Base Zoo');
  if(result.source!==expectedSource)failures.push('wrong main hero source');
  if(result.renderSource!==expectedSource)failures.push('wrong render audit source');
  if(result.renderGrid!=='8-direction-files')failures.push('wrong directional mode in render audit');
  if(result.directionMode!==8)failures.push('directionMode is not 8');
  if(result.readyCount!==8||!result.complete||result.failedCount!==0)failures.push('not all eight Base Zoo images loaded');
  if(!owners.includes('main-hero:base-zoo'))failures.push('Base Zoo is not registered in KeloAvatar middleware');
  if(owners.includes('main-hero-spartan'))failures.push('legacy Spartan full-body owner is still active');
  if(!result.middlewareId)failures.push('Base Zoo middleware id missing');
  if(result.drawCount<=before.drawCount)failures.push('Base Zoo stopped drawing after full boot');
  if(result.appearanceDelegateCount<=before.delegateCount)failures.push('character appearance stopped delegating local body after full boot');

  console.log(JSON.stringify({ok:failures.length===0,before,result,pageErrors:consoleErrors.slice(0,10),failures},null,2));
  if(failures.length)process.exitCode=1;
}finally{
  await browser.close();
}
