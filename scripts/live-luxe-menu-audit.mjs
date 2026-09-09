/* KELO-INDEX
 * area: TEST / UI / LIVE
 * owner: Premium menu + player HUD browser audit
 * keys: MENU HUD PLAYER MOBILE PORTRAIT LANDSCAPE RESPONSIVE ROUTES INPUT PVP FULLSCREEN COMMERCE TITLES CONSOLE SCREENSHOT
 * purpose: valida Luxe real, HUD único, owners consumidos, responsive, locks, Mercado autoritativo y smoke de movimiento/PvP/fullscreen
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
const report={ok:false,url:URL,hud:null,hudWidths:[],portrait:null,landscape:null,routes:{},movement:null,pvp:null,fullscreen:null,pageErrors,consoleErrors,httpErrors};
const assert=(condition,message)=>{if(!condition)throw new Error(message);};

async function waitRuntime(){
  await page.waitForFunction(()=>window.KELO_LUXE&&window.KELO_LUXE_PLAYER_HUD&&window.KeloInputLocks&&window.KeloBackpackUI&&window.KeloAbilities&&window.KeloMarketUI&&window.KeloMarketWorld&&window.KeloCommerceUI&&window.KELO_HOUSE_UI&&window.KeloNobility&&window.KeloTitles&&window.KeloSelfInteractionUI&&window.KeloCharacterCustomizer&&window.KELO_ORIENTATION,null,{timeout:20000});
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
async function routeMarket(){
  await clickRoute('market');
  await page.waitForFunction(()=>window.KeloMarketWorld?.isActive?.()===true&&document.getElementById('kelo-commerce-dock')?.classList.contains('show'),null,{timeout:8000});
  const entered=await page.evaluate(()=>({
    active:window.KeloMarketWorld?.isActive?.()===true,
    dockVisible:document.getElementById('kelo-commerce-dock')?.classList.contains('show')===true,
    menuOpen:window.KELO_LUXE?.isMenuOpen?.()===true,
    menuLocked:window.KeloInputLocks.has('luxe-main-menu'),
    commerceAudit:window.KELO_COMMERCE_UI_AUDIT||null
  }));
  assert(entered.active&&entered.dockVisible,'Mercado route did not enter authoritative market instance');
  assert(!entered.menuOpen&&!entered.menuLocked,'Main menu stayed open/locked after market travel');
  assert(entered.commerceAudit?.authorityOnly===true&&entered.commerceAudit?.marketInstanceEntry===true,'Commerce authority boundary audit missing');
  report.routes.market=true;
  await page.evaluate(async()=>{window.KeloCommerceUI?.close?.();await window.KeloCommerceUI?.leaveMarket?.();});
  await page.waitForFunction(()=>window.KeloMarketWorld?.isActive?.()===false&&!document.getElementById('kelo-commerce-dock')?.classList.contains('show'),null,{timeout:8000});
  assert(await page.evaluate(()=>!window.KeloInputLocks.has('commerce-ui')&&!window.KeloInputLocks.has('luxe-main-menu')),'Market route leaked an input lock');
}
async function inspectHud(){
  return page.evaluate(()=>{
    const hud=document.getElementById('kw-player-hud-wrap'),card=hud?.querySelector('.kw-player-hud'),guide=document.getElementById('kw-player-guide'),rail=document.querySelector('.lx-rail');
    const hr=hud?.getBoundingClientRect(),cr=card?.getBoundingClientRect(),gr=guide?.getBoundingClientRect(),rr=rail?.getBoundingClientRect();
    const snap=window.KELO_LUXE_PLAYER_HUD?.snapshot?.();
    const text=id=>document.getElementById(id)?.textContent?.trim()||'';
    return {
      width:innerWidth,height:innerHeight,count:document.querySelectorAll('#kw-player-hud-wrap').length,
      legacyTelemetry:!!document.getElementById('telemetry-bar'),legacyGuide:!!document.getElementById('kelo-guide-link'),
      luxeGoldNodes:document.querySelectorAll('.lx-gold').length,luxePresenceNodes:document.querySelectorAll('.lx-presence').length,
      hud:hr?{left:hr.left,top:hr.top,right:hr.right,bottom:hr.bottom,width:hr.width,height:hr.height}:null,
      card:cr?{left:cr.left,top:cr.top,right:cr.right,bottom:cr.bottom,width:cr.width,height:cr.height}:null,
      guide:gr?{left:gr.left,top:gr.top,right:gr.right,bottom:gr.bottom,width:gr.width,height:gr.height}:null,
      rail:rr?{left:rr.left,top:rr.top,right:rr.right,bottom:rr.bottom,width:rr.width,height:rr.height}:null,
      name:text('kw-hud-name'),id:text('kw-hud-id'),clan:text('kw-hud-clan'),nobility:text('kw-hud-nobility'),title:text('kw-hud-title'),hp:text('kw-hud-hp-text'),mana:text('kw-hud-mana-text'),gold:text('lx-gold'),
      snap,overflowX:document.documentElement.scrollWidth>innerWidth+1
    };
  });
}
function assertHud(h,label){
  assert(h.count===1,label+': expected exactly one player HUD');
  assert(!h.legacyTelemetry,label+': legacy telemetry-bar still mounted');
  assert(!h.legacyGuide,label+': legacy guide link still mounted');
  assert(h.luxeGoldNodes===0&&h.luxePresenceNodes===0,label+': old standalone Luxe top-left nodes still mounted');
  assert(h.hud&&h.hud.left>=0&&h.hud.right<=h.width+1&&h.hud.top>=0&&h.hud.bottom<=h.height+1,label+': player HUD escapes viewport');
  assert(h.card&&h.guide&&h.guide.top>=h.card.bottom-1,label+': GUÍA is not directly below player card');
  assert(h.guide.height>=35,label+': GUÍA touch target collapsed');
  if(h.height>520)assert(h.guide.height>=43,label+': GUÍA should preserve ~44px touch target');
  assert(h.rail&&h.hud.right<=h.rail.left+1,label+': player HUD overlaps right-side Menu/PvP rail');
  assert(!h.overflowX,label+': document has horizontal overflow');
  assert(h.name&&h.id&&h.clan&&h.nobility&&h.title&&h.hp&&h.mana&&h.gold,label+': required HUD text is missing');
  assert(h.snap?.name&&h.snap?.id,label+': HUD snapshot lacks player identity');
}

try{
  await page.goto(URL,{waitUntil:'domcontentloaded',timeout:30000});
  await waitRuntime();
  const baseline=await page.evaluate(()=>({
    luxe:window.KELO_LUXE_AUDIT,
    playerHud:window.KELO_LUXE_PLAYER_HUD,
    input:window.KeloInputLocks.snapshot('audit-baseline'),
    missionsOwner:!!(window.KeloMissionsUI&&typeof window.KeloMissionsUI.open==='function'),
    settingsOwner:!!(window.KeloSettingsUI&&typeof window.KeloSettingsUI.open==='function'),
    creatorsAllowed:!!window.KELO_CREATORS_LAUNCHER?.allowed,
    fullscreenButton:!!document.getElementById('kelo-orientation-btn')
  }));
  assert(baseline.luxe?.version==='luxe-shell-v4.0.3-title-book','Premium Luxe runtime version missing');
  assert(baseline.luxe?.tokenLocks===true,'Premium menu token-lock audit missing');
  assert(baseline.playerHud?.version==='luxe-player-hud-v1.0.0','Premium player HUD runtime version missing');
  assert(baseline.playerHud?.polling===false,'Player HUD must advertise polling=false');
  assert(baseline.fullscreenButton===true,'Fullscreen button missing from Luxe rail');

  report.hud=await inspectHud();
  assertHud(report.hud,'390x844');
  assert(Number.isFinite(report.hud.snap?.hp)&&report.hud.hp!=='— / —','HUD HP did not read the live player');
  await page.screenshot({path:path.join(OUT,'premium-player-hud-390.png'),fullPage:false});

  // Required responsive widths: compact iPhones, large phones, tablet and desktop.
  const sizes=[
    {width:320,height:568},{width:360,height:780},{width:375,height:812},{width:390,height:844},
    {width:414,height:896},{width:430,height:932},{width:768,height:1024},{width:1280,height:800}
  ];
  for(const size of sizes){
    await page.setViewportSize(size);await page.waitForTimeout(60);
    const h=await inspectHud();assertHud(h,`${size.width}x${size.height}`);report.hudWidths.push({size,hud:h.hud,guide:h.guide,rail:h.rail});
  }
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(60);

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
  for(const label of ['Mochila','Habilidades','Apariencia','Perfil','Mercado','Chat','Propiedades','Nobleza','Libro de títulos','Burlas'])assert(portrait.labels.includes(label),'Missing visible menu entry: '+label);
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
  await route('titles','titles','#kelo-title-book',()=>window.KeloTitles.closeBook());
  assert(await page.evaluate(()=>!window.KeloInputLocks.has('titles-book')),'Title Book input lock leaked');
  await route('emotes','emotes','#kelo-emotes-panel',()=>window.KeloSelfInteractionUI.closeEmotes());
  await route('backpack','bag','#kelo-bag',()=>window.KeloBackpackUI.close());
  await routeMarket();
  await route('properties','properties','#kelo-house-panel',()=>window.KELO_HOUSE_UI.hide());
  await route('profile','profile','#inspect-sheet',()=>{if(typeof closeInspect==='function')closeInspect();});
  await route('abilities','abilities','#kelo-builder',()=>{const p=document.getElementById('kelo-builder');if(p)p.style.display='none';});

  await clickRoute('chat');
  await page.waitForFunction(()=>document.getElementById('lx-chat-drawer')?.classList.contains('open'));
  assert(await page.evaluate(()=>window.KeloInputLocks.has('luxe-chat')),'Chat did not acquire input lock');
  await page.locator('#lx-chat-close').click();
  assert(await page.evaluate(()=>!window.KeloInputLocks.has('luxe-chat')),'Chat input lock leaked');
  report.routes.chat=true;

  // Fullscreen real: el botón debe activar native fullscreen o el fallback inmersivo y después poder salir.
  const fsButton=page.locator('#kelo-orientation-btn');
  await fsButton.click();
  await page.waitForFunction(()=>window.KELO_ORIENTATION?.fullscreen?.active?.()===true,null,{timeout:5000});
  const fsEntered=await page.evaluate(()=>({active:window.KELO_ORIENTATION.fullscreen.active(),mode:window.KELO_ORIENTATION.fullscreen.mode(),pressed:document.getElementById('kelo-orientation-btn')?.getAttribute('aria-pressed')}));
  assert(fsEntered.active===true&&fsEntered.pressed==='true','Fullscreen button did not enter active/native-or-fallback mode');
  await fsButton.click();
  await page.waitForFunction(()=>window.KELO_ORIENTATION?.fullscreen?.active?.()===false,null,{timeout:5000});
  report.fullscreen={entered:true,mode:fsEntered.mode,left:true};

  await page.setViewportSize({width:844,height:390});
  await page.waitForTimeout(250);
  const hudLandscape=await inspectHud();assertHud(hudLandscape,'844x390');
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