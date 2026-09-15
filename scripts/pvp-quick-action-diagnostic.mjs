import { chromium } from 'playwright';

const base=process.env.AUDIT_URL||'http://127.0.0.1:4173/';
const url=new URL(base);url.searchParams.set('aiGuest','1');
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});
const page=await context.newPage();
const errors=[];
page.on('pageerror',e=>errors.push('page:'+String(e?.message||e)));
page.on('console',m=>{if(m.type()==='error')errors.push('console:'+m.text());});
await page.goto(url.toString(),{waitUntil:'domcontentloaded',timeout:30000});
await page.waitForFunction(()=>window.KELO_LUXE&&window.KELO_LUXE_PLAYER_HUD&&window.KELO_MODULE_LOADER&&document.getElementById('lx-side-pvp')&&document.getElementById('kw-quick-actions-toggle'),null,{timeout:20000});
const cold=await page.evaluate(()=>({pvpLoaded:!!window.KeloPvPWorld,pvpAudit:!!window.KELO_PVP_COMBAT_LOADER_AUDIT,needs:window.KELO_MODULE_LOADER?.needs?.('pvp')}));
if(cold.pvpLoaded||cold.pvpAudit||cold.needs!==true)throw new Error('PVP_COLD_BOOT_CONTRACT_BROKEN:'+JSON.stringify(cold));
const snap=()=>page.evaluate(()=>{
  const btn=document.getElementById('lx-side-pvp');
  const enter=window.enterPvPWorld;
  const ownerEnter=window.KeloPvPWorld?.enter;
  const audit=window.KELO_PVP_COMBAT_LOADER_AUDIT;
  return {
    onclickType:typeof btn?.onclick,
    onclickSource:String(btn?.onclick||'').slice(0,700),
    globalEnterType:typeof enter,
    globalEnterSource:String(enter||'').slice(0,900),
    ownerEnterSource:String(ownerEnter||'').slice(0,900),
    sameGlobalAndOwner:enter===ownerEnter,
    loader:{ready:!!audit?.ready,firstRequestedAt:Number(audit?.firstRequestedAt)||0,loading:!!audit?.loading,entering:!!audit?.entering,combatReady:!!audit?.combatReady,predictionReady:!!audit?.predictionReady},
    state:{mode:window.KeloPvPWorld?.state?.mode||null,combatEnabled:!!window.KeloPvPWorld?.state?.combatEnabled},
    quick:document.getElementById('kw-quick-actions-toggle')?.getAttribute('aria-expanded')||null
  };
});
const report={cold,before:await snap(),afterTap:null,errors};
await page.locator('#kw-quick-actions-toggle').tap();
await page.waitForFunction(()=>document.getElementById('kw-quick-actions-toggle')?.getAttribute('aria-expanded')==='true');
await page.locator('#lx-side-pvp').tap();
await page.waitForFunction(()=>window.KeloPvPWorld&&typeof window.enterPvPWorld==='function'&&window.KELO_PVP_COMBAT_LOADER_AUDIT?.ready===true,null,{timeout:15000});
await page.waitForFunction(()=>window.KeloPvPWorld?.state?.combatEnabled===true&&window.KeloPvPWorld?.state?.mode!=='social',null,{timeout:20000});
report.afterTap=await snap();
if(!(report.afterTap.loader.firstRequestedAt>0))throw new Error('PVP_FIRST_USE_NOT_REQUESTED');
if(!report.afterTap.loader.combatReady)throw new Error('PVP_COMBAT_NOT_READY_AFTER_FIRST_USE');
if(report.afterTap.state.mode==='social'||!report.afterTap.state.combatEnabled)throw new Error('PVP_DID_NOT_ENTER_AFTER_QUICK_ACTION');
if(errors.length)throw new Error('PVP_DIAGNOSTIC_ERRORS:'+errors.join(' | '));
console.log('PVP_QUICK_DIAGNOSTIC='+JSON.stringify(report,null,2));
await browser.close();
