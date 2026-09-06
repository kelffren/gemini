const fs=require('fs');
const {chromium}=require('playwright');

(async()=>{
  const browser=await chromium.launch({
    headless:true,
    executablePath:process.env.CHROME_BIN,
    args:['--no-sandbox','--disable-dev-shm-usage']
  });
  const context=await browser.newContext({
    viewport:{width:390,height:844},
    deviceScaleFactor:2,
    isMobile:true,
    hasTouch:true
  });
  const page=await context.newPage();
  const errors=[], failed=[], http=[];
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
  page.on('pageerror',e=>errors.push(`PAGEERROR: ${e.message}`));
  page.on('requestfailed',r=>failed.push(r.url()));
  page.on('response',r=>{if(r.status()>=400)http.push([r.status(),r.url()])});

  await page.goto(`https://kelffren.github.io/gemini/?visualLab=1&realthrow2=${Date.now()}`,{
    waitUntil:'domcontentloaded',timeout:45000
  });
  await page.waitForFunction(
    ()=>window.KELO_VISUAL_AUDIT?.integrationReady===true &&
       window.KeloPvPWorld &&
       window.KeloAbilities &&
       window.KeloStones &&
       window.KeloProjectileVisuals?.version==='projectile-visual-runtime-v1.1.1' &&
       window.KeloAbilityVisuals?.version==='ability-visual-resolver-v1.2.0',
    null,{timeout:25000}
  );
  await page.evaluate(async()=>{
    await KeloAssetRegistry.load('sword_swap_katana_throw_asset');
    if(window.KeloVisualLab?.minimize) KeloVisualLab.minimize();
    const lab=document.getElementById('kelo-visual-lab');
    if(lab) lab.style.display='none';
    const stone=KeloStones.createAbilityStone('swap_sword','Rare',{source:'real-throw-live-visual'});
    STATE.equipped=[stone];
    STATE.inventory=[];
    if(typeof saveState==='function') saveState();
    KeloAbilities.syncFromWorldState(true);
  });

  await page.evaluate(()=>enterPvPWorld());
  await page.waitForFunction(()=>KeloPvPWorld.state.mode==='pvp'&&KeloPvPWorld.state.combatEnabled===true,null,{timeout:5000});

  const before=await page.evaluate(()=>({
    p:{x:localPlayer.x,y:localPlayer.y,radius:localPlayer.radius},
    slot:KeloAbilities.hotbar.slots[0]?.definition?.key,
    active:KeloProjectileVisuals.metrics().active,
    pvp:KeloPvPWorld.state,
    abilityVersion:KeloAbilityVisuals.version,
    projectileVersion:KeloProjectileVisuals.version
  }));
  if(before.slot!=='swap_sword') throw new Error('swap_sword not equipped '+JSON.stringify(before));

  const result=await page.evaluate(()=>{
    const p=localPlayer;
    return KeloPvPWorld.authority.execute(
      KeloPvPWorld.command('THROW_SWAP_SWORD',{slot:0,position:{x:p.x+240,y:p.y}})
    );
  });
  if(!result.ok) throw new Error('real throw rejected '+JSON.stringify(result));

  await page.waitForTimeout(120);
  const during=await page.evaluate(()=>({
    p:{x:localPlayer.x,y:localPlayer.y,radius:localPlayer.radius},
    metrics:KeloProjectileVisuals.metrics(),
    pvp:KeloPvPWorld.state,
    missing:KELO_VISUAL_AUDIT.missingAssets.slice(),
    labHidden:getComputedStyle(document.getElementById('kelo-visual-lab')).display==='none'
  }));

  if(during.pvp.swapSword?.phase!=='flying') throw new Error('sword not flying '+JSON.stringify(during));
  if(during.metrics.active<1) throw new Error('authored katana visual not active '+JSON.stringify(during));
  if(JSON.stringify(during.p)!==JSON.stringify(before.p)) throw new Error('throw visual changed player gameplay '+JSON.stringify({before:before.p,during:during.p}));
  if(during.missing.length) throw new Error('missing assets '+JSON.stringify(during.missing));

  await page.screenshot({path:'artifacts/sword-swap-real-throw-visible-mobile.png',fullPage:false,scale:'device'});

  await page.waitForTimeout(500);
  const after=await page.evaluate(()=>({
    pvp:KeloPvPWorld.state,
    metrics:KeloProjectileVisuals.metrics(),
    missing:KELO_VISUAL_AUDIT.missingAssets.slice()
  }));
  if(after.pvp.swapSword?.phase!=='planted') throw new Error('sword did not land '+JSON.stringify(after));
  if(after.metrics.active!==0) throw new Error('throw visual did not stop on landing '+JSON.stringify(after));
  if(after.missing.length) throw new Error('missing after landing '+JSON.stringify(after));
  if(errors.length||failed.length||http.length) throw new Error('browser errors '+JSON.stringify({errors,failed,http}));

  fs.writeFileSync('artifacts/sword-swap-real-throw-visible.json',JSON.stringify({before,result,during,after,errors,failed,http},null,2));
  console.log('SWORD_SWAP_REAL_THROW_VISIBLE_PASS '+JSON.stringify({
    activeDuring:during.metrics.active,
    phaseDuring:during.pvp.swapSword.phase,
    phaseAfter:after.pvp.swapSword.phase,
    activeAfter:after.metrics.active,
    labHidden:during.labHidden
  }));
  await context.close();
  await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
