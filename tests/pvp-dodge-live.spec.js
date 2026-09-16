/* KELO-INDEX
 * area: TEST / PVP
 * owner: Playwright validation only
 * keys: PVP BUTTON FIRST-USE QUICK-ACTIONS GUEST DODGE DASH COLLISION MOBILE IPHONE DESKTOP LIVE WINNER
 * purpose: bloquea la ruta visible launcher rápido -> botón PvP -> lazy runtime -> mundo PvP y después valida dodge 112 px real; guest=1 solo elimina Auth de esta prueba PvP
 * online: N/A; valida el runtime local exacto del candidato sin alterar autoridad
 * do-not: NO gameplay mutation fuera de setup reproducible de prueba, NO force click, NO llamada directa a enterPvPWorld
 */
const {test,expect}=require('@playwright/test');

const IPHONE_UA='Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

async function waitForVisibleGameplay(page){
  await page.waitForFunction(()=>!!(
    document.documentElement.dataset.keloGuestPlay==='1' &&
    typeof localPlayer!=='undefined' &&
    document.getElementById('game-canvas') &&
    document.getElementById('kw-quick-actions-toggle') &&
    document.getElementById('lx-side-pvp')
  ),{timeout:20000});
  await expect(page.locator('#kelo-account-auth')).toBeHidden({timeout:15000});
  await expect(page.locator('#game-canvas')).toBeVisible({timeout:15000});
  const quick=page.locator('#kw-quick-actions-toggle');
  await expect(quick).toBeVisible({timeout:20000});
  await quick.click();
  await expect(quick).toHaveAttribute('aria-expanded','true',{timeout:5000});
  await expect(page.locator('#lx-side-pvp')).toBeVisible({timeout:5000});
}

async function enterThroughVisiblePvpButton(page,label){
  await page.waitForFunction(()=>window.KELO_MODULE_LOADER&&document.getElementById('lx-side-pvp'),{timeout:20000});
  await waitForVisibleGameplay(page);
  const before=await page.evaluate(()=>({
    pvpWorld:!!window.KeloPvPWorld,
    enter:typeof window.enterPvPWorld==='function',
    loaderNeeds:window.KELO_MODULE_LOADER.needs('pvp'),
    loaderReady:window.KELO_MODULE_LOADER.isReady('pvp'),
    guest:document.documentElement.dataset.keloGuestPlay||null,
    quickActionsOpen:document.getElementById('kw-quick-actions-toggle')?.getAttribute('aria-expanded')==='true'
  }));
  expect(before.loaderNeeds).toBe(true);
  expect(before.loaderReady).toBe(false);
  expect(before.guest).toBe('1');
  expect(before.quickActionsOpen).toBe(true);

  const button=page.locator('#lx-side-pvp');
  await button.click();
  await page.waitForFunction(()=>window.KELO_MODULE_LOADER&&window.KELO_MODULE_LOADER.isReady('pvp')&&window.KeloPvPWorld&&typeof window.enterPvPWorld==='function'&&window.KELO_PVP_COMBAT_LOADER_AUDIT?.ready===true,{timeout:30000});
  await page.waitForFunction(()=>window.KeloPvPWorld&&window.KeloAbilities&&window.KeloPvPWorld.state.mode==='pvp'&&window.KeloPvPWorld.state.combatEnabled,{timeout:20000});

  const after=await page.evaluate(()=>({
    mode:window.KeloPvPWorld.state.mode,
    combatEnabled:window.KeloPvPWorld.state.combatEnabled,
    loaderNeeds:window.KELO_MODULE_LOADER.needs('pvp'),
    loaderReady:window.KELO_MODULE_LOADER.isReady('pvp'),
    diagnostics:window.KELO_MODULE_LOADER.diagnostics(),
    combatLoader:window.KELO_PVP_COMBAT_LOADER_AUDIT?{
      ready:window.KELO_PVP_COMBAT_LOADER_AUDIT.ready,
      combatReady:window.KELO_PVP_COMBAT_LOADER_AUDIT.combatReady,
      predictionReady:window.KELO_PVP_COMBAT_LOADER_AUDIT.predictionReady
    }:null
  }));
  console.log('PVP_BUTTON_FIRST_USE',JSON.stringify({label,before,after},null,2));
  expect(after.mode).toBe('pvp');
  expect(after.combatEnabled).toBe(true);
  expect(after.loaderNeeds).toBe(false);
  expect(after.loaderReady).toBe(true);
  expect(after.combatLoader&&after.combatLoader.ready).toBe(true);
}

async function runDodge(page,label){
  const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.goto('http://127.0.0.1:4173/?guest=1&pvpRegression=1',{waitUntil:'domcontentloaded'});
  await enterThroughVisiblePvpButton(page,label);
  const result=await page.evaluate(async()=>{
    localPlayer.x=2790;localPlayer.y=720;localPlayer.vx=localPlayer.vy=0;
    window.KeloPvPWorld.setAimWorld({x:2910,y:720},'audit',1);
    const start={x:localPlayer.x,y:localPlayer.y},expected={x:localPlayer.x+112,y:localPlayer.y};
    const hits=[];
    if(window.KELO_COLLISION&&typeof obstacles!=='undefined'){
      for(const box of obstacles){
        if(!box||box.blocksMovement===false)continue;
        const t=window.KELO_COLLISION.segmentAabbHitT(start.x,start.y,expected.x,expected.y,box,localPlayer.radius||20);
        if(t!=null)hits.push({t,x:box.x,y:box.y,w:box.w,h:box.h,owner:box._keloCollisionOwner||box.owner||null,id:box.id||null});
      }
      hits.sort((a,b)=>a.t-b.t);
    }
    const perfBefore=window.KeloAbilities.performanceSnapshot();
    window.KeloInput.combat.push('DODGE_PRESS',{source:'audit'});
    const samples=[];
    const t0=performance.now();
    while(performance.now()-t0<260){samples.push({ms:performance.now()-t0,x:localPlayer.x,y:localPlayer.y,dash:localPlayer._dash?{sx:localPlayer._dash.sx,sy:localPlayer._dash.sy,tx:localPlayer._dash.tx,ty:localPlayer._dash.ty,time:localPlayer._dash.time,max:localPlayer._dash.max,abilityKey:localPlayer._dash.abilityKey}:null,dodgeActive:window.KeloPvPWorld.state.dodgeActive});await new Promise(r=>setTimeout(r,8));}
    const end={x:localPlayer.x,y:localPlayer.y};
    const firstMove=samples.find(s=>Math.hypot(s.x-start.x,s.y-start.y)>.5)||null;
    const completed=samples.find(s=>!s.dash&&Math.hypot(s.x-expected.x,s.y-expected.y)<.5&&s.ms>10)||null;
    return{start,expected,end,distance:Math.hypot(end.x-start.x,end.y-start.y),firstMoveMs:firstMove&&firstMove.ms,completedMs:completed&&completed.ms,hits:hits.slice(0,8),samples,perfBefore,loaderAudit:window.KELO_PVP_COMBAT_LOADER_AUDIT?{version:window.KELO_PVP_COMBAT_LOADER_AUDIT.version,abilityRuntimeWakeOnPvpEnter:window.KELO_PVP_COMBAT_LOADER_AUDIT.abilityRuntimeWakeOnPvpEnter,wakeCount:window.KELO_PVP_COMBAT_LOADER_AUDIT.wakeCount}:null,collisionOwners:window.KELO_COLLISION&&window.KELO_COLLISION.ownerSnapshot?window.KELO_COLLISION.ownerSnapshot():null,audit:window.KELO_PVP_AUDIT||null};
  });
  console.log('PVP_DODGE_WINNER',JSON.stringify({label,result,errors},null,2));
  expect(errors).toEqual([]);
  expect(result.hits).toEqual([]);
  expect(result.perfBefore.simulationAwake).toBe(true);
  expect(result.loaderAudit&&result.loaderAudit.abilityRuntimeWakeOnPvpEnter).toBe(true);
  expect(result.samples.some(s=>s.dodgeActive)).toBeTruthy();
  expect(result.samples.some(s=>s.dash&&s.dash.time<s.dash.max)).toBeTruthy();
  expect(result.firstMoveMs).not.toBeNull();
  expect(result.firstMoveMs).toBeLessThanOrEqual(40);
  expect(result.completedMs).not.toBeNull();
  expect(result.completedMs).toBeLessThanOrEqual(190);
  expect(result.distance).toBeGreaterThanOrEqual(111.5);
  expect(result.distance).toBeLessThanOrEqual(112.5);
  return result;
}

test('PvP visible button first-use + dodge winner mobile iPhone UA',async({browser})=>{const p=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,userAgent:IPHONE_UA});await runDodge(p,'mobile-iphone');await p.close();});
test('PvP visible button first-use + dodge winner desktop',async({browser})=>{const p=await browser.newPage({viewport:{width:1440,height:900}});await runDodge(p,'desktop');await p.close();});
