/* KELO-INDEX
 * area: TEST / UI / LIVE
 * owner: Premium menu browser audit
 * keys: MENU MOBILE PORTRAIT LANDSCAPE ROUTES INPUT PVP CONSOLE SCREENSHOT
 * purpose: valida el menú Luxe real, owners recuperados, locks, responsive y smoke de movimiento/PvP
 * online: prueba presentación/rutas; no altera reglas autoritativas
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const URL=process.env.AUDIT_URL||'http://127.0.0.1:4173/';
const OUT=process.env.AUDIT_OUT||'artifacts';
fs.mkdirSync(OUT,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN||undefined,args:['--no-sandbox']});
const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});
const page=await context.newPage();
const pageErrors=[],consoleErrors=[],httpErrors=[];
page.on('pageerror',e=>pageErrors.push(String(e?.stack||e)));
page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});
page.on('response',r=>{if(r.status()>=400)httpErrors.push({status:r.status(),url:r.url()});});
const report={ok:false,url:URL,portrait:null,landscape:null,routes:{},movement:null,pvp:null,pageErrors,consoleErrors,httpErrors};
const assert=(condition,message)=>{if(!condition)throw new Error(message);};

async function waitRuntime(){
  await page.waitForFunction(()=>window.KELO_LUXE&&window.KeloInputLocks&&window.KeloBackpackUI&&window.KeloAbilities&&window.KeloMarketUI&&window.KELO_HOUSE_UI&&window.KeloNobility&&window.KeloSelfInteractionUI&&window.KeloCharacterCustomizer,null,{timeout:20000});
}
async function openMenu(){
  await page.locator('#lx-side-menu').click();
  await page.waitForFunction(()=>window.KELO_LUXE?.isMenuOpen?.()===true);
}
async function closeMenu(){if(await page.evaluate(()=>window.KELO_LUXE?.isMenuOpen?.()))await page.locator('#lx-menu-close').click();}
async function clickRoute(tool){await openMenu();const button=page.locator(`#lx-menu-panel [data-tool="${tool}"]`);await button.waitFor({state:'visible'});await button.click();}
async function route(name,tool,selector,closeExpression){
  await clickRoute(tool);await page.waitForFunction(sel=>{const el=document.querySelector(sel);if(!el)return false;const s=getComputedStyle(el),r=el.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0;},selector,{timeout:6000});
  report.routes[name]=true;
  if(closeExpression)await page.evaluate(closeExpression);
}

try{
  await page.goto(URL,{waitUntil:'domcontentloaded',timeout:30000});
  await waitRuntime();
  const baseline=await page.evaluate(()=>({
    luxe:window.KELO_LUXE_AUDIT,
    input:window.KeloInputLocks.snapshot('audit-baseline'),
    missionsOwner:!!(window.KeloMissionsUI&&typeof window.KeloMissionsUI.open==='function'),
    settingsOwner:!!(window.KeloSettingsUI&&typeof window.KeloSettingsUI.open==='function'),
    creatorsAllowed:!!window.KELO_CREATORS_LAUNCHER?.allowed
  }));
  assert(baseline.luxe?.version==='luxe-shell-v4.0.2-premium-menu','Premium Luxe runtime version missing');
  assert(baseline.luxe?.tokenLocks===true,'Premium menu token-lock audit missing');

  await openMenu();
  const portrait=await page.evaluate(()=>{
    const panel=document.getElementById('lx-menu-panel'),grid=document.getElementById('lx-menu-grid');
    const pr=panel.getBoundingClientRect(),gr=getComputedStyle(grid),titles=Array.from(grid.querySelectorAll('.lx-menu-copy b'));
    return {
      width:innerWidth,height:innerHeight,
      panel:{left:pr.left,top:pr.top,right:pr.right,bottom:pr.bottom,width:pr.width,height:pr.height},
      columns:gr.gridTemplateColumns.split(' ').filter(Boolean).length,
      labels:titles.map(x=>x.textContent.trim()),
      clippedTitles:titles.filter(x=>x.scrollWidth>x.clientWidth+1).map(x=>x.textContent.trim()),
      tools:Array.from(grid.querySelectorAll('[data-tool]')).map(x=>x.dataset.tool),
      mainLock:window.KeloInputLocks.has('luxe-main-menu'),
      overflowX:document.documentElement.scrollWidth>innerWidth+1,
      overflowY:document.documentElement.scrollHeight>innerHeight+1
    };
  });
  for(const label of ['Mochila','Habilidades','Apariencia','Perfil','Mercado','Chat','Propiedades','Nobleza','Burlas'])assert(portrait.labels.includes(label),'Missing visible menu entry: '+label);
  assert(portrait.columns===2,'Portrait menu is not two columns');
  assert(portrait.clippedTitles.length===0,'Portrait menu clips title text: '+portrait.clippedTitles.join(', '));
  assert(portrait.mainLock===true,'Main menu did not acquire KeloInputLocks token');
  assert(portrait.panel.left>=0&&portrait.panel.right<=portrait.width+1&&portrait.panel.top>=0&&portrait.panel.bottom<=portrait.height+1,'Portrait menu escapes viewport');
  assert(!portrait.overflowX,'Portrait document has horizontal overflow');
  assert(!baseline.missionsOwner&&!portrait.tools.includes('missions'),'Missions placeholder must not be exposed without owner');
  assert(!baseline.settingsOwner&&!portrait.tools.includes('settings'),'Settings placeholder must not be exposed without owner');
  report.portrait=portrait;
  await page.screenshot({path:path.join(OUT,'premium-menu-portrait.png'),fullPage:false});
  await closeMenu();
  assert(await page.evaluate(()=>!window.KeloInputLocks.has('luxe-main-menu')),'Main menu lock leaked after close');

  await route('appearance','appearance','#kelo-character-customizer',()=>window.KeloCharacterCustomizer.close());
  await route('nobility','nobility','#kelo-nobility',()=>window.KeloNobility.close());
  await route('emotes','emotes','#kelo-emotes-panel',()=>window.KeloSelfInteractionUI.closeEmotes());
  await route('backpack','bag','#kelo-bag',()=>window.KeloBackpackUI.close());
  await route('market','market','#kelo-market-v1',()=>window.KeloMarketUI.close());
  await route('properties','properties','#kelo-house-panel',()=>window.KELO_HOUSE_UI.hide());
  await route('profile','profile','#inspect-sheet',()=>{if(typeof closeInspect==='function')closeInspect();});
  await route('abilities','abilities','#kelo-builder',()=>{const p=document.getElementById('kelo-builder');if(p)p.style.display='none';});

  await clickRoute('chat');
  await page.waitForFunction(()=>document.getElementById('lx-chat-drawer')?.classList.contains('open'));
  assert(await page.evaluate(()=>window.KeloInputLocks.has('luxe-chat')),'Chat did not acquire input lock');
  await page.locator('#lx-chat-close').click();
  assert(await page.evaluate(()=>!window.KeloInputLocks.has('luxe-chat')),'Chat input lock leaked');
  report.routes.chat=true;

  await page.setViewportSize({width:844,height:390});
  await page.waitForTimeout(250);
  await openMenu();
  const landscape=await page.evaluate(()=>{
    const panel=document.getElementById('lx-menu-panel'),grid=document.getElementById('lx-menu-grid'),r=panel.getBoundingClientRect(),titles=Array.from(grid.querySelectorAll('.lx-menu-copy b'));
    return {width:innerWidth,height:innerHeight,panel:{left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height},columns:getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length,clippedTitles:titles.filter(x=>x.scrollWidth>x.clientWidth+1).map(x=>x.textContent.trim()),scrollHeight:panel.querySelector('.lx-menu-scroll').scrollHeight,clientHeight:panel.querySelector('.lx-menu-scroll').clientHeight,overflowX:document.documentElement.scrollWidth>innerWidth+1};
  });
  assert(landscape.columns===2,'Landscape menu is not two columns');
  assert(landscape.clippedTitles.length===0,'Landscape menu clips title text: '+landscape.clippedTitles.join(', '));
  assert(landscape.panel.left>=0&&landscape.panel.right<=landscape.width+1&&landscape.panel.top>=0&&landscape.panel.bottom<=landscape.height+1,'Landscape menu escapes viewport');
  assert(!landscape.overflowX,'Landscape has horizontal overflow');
  report.landscape=landscape;
  await page.screenshot({path:path.join(OUT,'premium-menu-landscape.png'),fullPage:false});
  await closeMenu();

  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(200);
  const movement=await page.evaluate(async()=>{
    const before={x:localPlayer.x,y:localPlayer.y};
    const canvas=document.getElementById('game-canvas');
    const fire=(type,x,y)=>canvas.dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,pointerId:991,pointerType:'touch',isPrimary:true,clientX:x,clientY:y,buttons:type==='pointerup'?0:1}));
    fire('pointerdown',70,650);fire('pointermove',135,650);await new Promise(r=>setTimeout(r,500));fire('pointerup',135,650);await new Promise(r=>setTimeout(r,80));
    return {before,after:{x:localPlayer.x,y:localPlayer.y},locked:window.KeloInputLocks.isLocked()};
  });
  movement.distance=Math.hypot(movement.after.x-movement.before.x,movement.after.y-movement.before.y);
  assert(movement.locked===false,'Input remained locked before movement smoke');
  assert(movement.distance>1,'Movement smoke did not move local player');
  report.movement=movement;

  await page.locator('#lx-side-pvp').click();
  await page.waitForFunction(()=>!document.body.classList.contains('social-mode')&&window.KELO_COMBAT_ENABLED===true,null,{timeout:5000});
  const pvpEntered=await page.evaluate(()=>({social:document.body.classList.contains('social-mode'),combat:window.KELO_COMBAT_ENABLED}));
  assert(pvpEntered.combat===true&&!pvpEntered.social,'PvP did not enter');
  await page.evaluate(()=>{if(typeof leavePvPWorld==='function')leavePvPWorld();});
  await page.waitForFunction(()=>document.body.classList.contains('social-mode')&&window.KELO_COMBAT_ENABLED===false,null,{timeout:5000});
  report.pvp={entered:true,left:true};

  await page.waitForTimeout(200);
  assert(pageErrors.length===0,'Page errors: '+pageErrors.join(' | '));
  const relevantConsole=consoleErrors.filter(x=>!/favicon|Failed to load resource.*404/i.test(x));
  assert(relevantConsole.length===0,'Console errors: '+relevantConsole.join(' | '));
  report.ok=true;
}catch(error){
  report.error=String(error?.stack||error);
  try{await page.screenshot({path:path.join(OUT,'premium-menu-failure.png'),fullPage:false});}catch{}
}finally{
  fs.writeFileSync(path.join(OUT,'premium-menu-report.json'),JSON.stringify(report,null,2));
  await browser.close();
}

console.log(JSON.stringify(report,null,2));
if(!report.ok)process.exit(1);