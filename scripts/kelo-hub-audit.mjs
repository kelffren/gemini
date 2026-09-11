import fs from 'node:fs';
import { chromium } from 'playwright';

const url = process.env.AUDIT_URL || 'http://127.0.0.1:4173/?offline=1&qa-live-audit=1';
const chrome = process.env.CHROME_BIN || '/usr/bin/google-chrome';
fs.mkdirSync('artifacts', { recursive: true });

const browser = await chromium.launch({
  headless: true,
  executablePath: chrome,
  args: ['--no-sandbox', '--disable-dev-shm-usage']
});
const context = await browser.newContext({ viewport:{width:390,height:844}, isMobile:true, hasTouch:true });
const page = await context.newPage();
const pageErrors=[];
page.on('pageerror',e=>pageErrors.push(String(e?.stack||e?.message||e)));

const norm=value=>String(value||'').trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ');

try{
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForFunction(()=>!!(window.KeloHubOverlay&&document.getElementById('lx-side-menu')&&document.getElementById('lx-chat-tab')),null,{timeout:20000});
  await page.waitForTimeout(350);

  const closed=await page.evaluate(()=>{
    const labels=new Set(['BOUTIQUE','PVP','GUIA','PANTALLA COMPLETA','LOGISTICA']);
    const normalize=value=>String(value||'').trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ');
    const visibleLegacy=[];
    document.querySelectorAll('button,[role="button"],[onclick],a,div,span').forEach(el=>{
      if(el.closest('#kelo-hub-sections'))return;
      if(!labels.has(normalize(el.textContent)))return;
      const r=el.getBoundingClientRect(),s=getComputedStyle(el);
      if(r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity||1)>0)visibleLegacy.push({tag:el.tagName,id:el.id||null,text:normalize(el.textContent),w:Math.round(r.width),h:Math.round(r.height)});
    });
    const hub=document.getElementById('lx-side-menu'),tab=document.getElementById('lx-chat-tab'),tabStyle=tab?getComputedStyle(tab):null,tabRect=tab?.getBoundingClientRect();
    return{
      hubText:normalize(hub?.textContent),hubVisible:!!hub&&hub.getBoundingClientRect().width>0,
      visibleLegacy,
      chatTabVisible:!!tab&&tabRect.width>0&&tabRect.height>0&&tabStyle.display!=='none',
      chatTabOpacity:tabStyle?Number(tabStyle.opacity):null,
      overlayVersion:window.KeloHubOverlay?.version||null
    };
  });
  if(!closed.hubVisible||!closed.hubText.includes('HUB'))throw new Error(`Hub launcher missing: ${JSON.stringify(closed)}`);
  if(closed.visibleLegacy.length)throw new Error(`Legacy social chrome still visible: ${JSON.stringify(closed.visibleLegacy)}`);
  if(!closed.chatTabVisible||closed.chatTabOpacity>0.4)throw new Error(`Minimized chat is not discreet: ${JSON.stringify(closed)}`);
  await page.screenshot({path:'artifacts/kelo-hub-closed-mobile.png',fullPage:false});

  await page.locator('#lx-side-menu').click();
  await page.waitForFunction(()=>document.getElementById('lx-menu-panel')?.classList.contains('open')===true);
  await page.waitForTimeout(120);
  const open=await page.evaluate(()=>({
    title:document.getElementById('lx-menu-title')?.getAttribute('aria-label')||document.getElementById('lx-menu-title')?.textContent||'',
    groups:document.querySelectorAll('#kelo-hub-sections .kh-group').length,
    openGroups:document.querySelectorAll('#kelo-hub-sections .kh-group.open').length,
    visibleApps:Array.from(document.querySelectorAll('#kelo-hub-sections .kh-group.open .kh-app')).filter(el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0;}).length
  }));
  if(open.groups<4||open.openGroups<1||open.visibleApps<2)throw new Error(`Hub submenu contract failed: ${JSON.stringify(open)}`);
  await page.screenshot({path:'artifacts/kelo-hub-open-mobile.png',fullPage:false});

  await page.locator('#lx-menu-close').click();
  await page.waitForFunction(()=>document.getElementById('lx-menu-panel')?.classList.contains('open')===false);
  const openedChat=await page.evaluate(()=>window.KeloHubOverlay.openChat());
  if(!openedChat)throw new Error('KeloHubOverlay.openChat returned false');
  await page.waitForFunction(()=>document.getElementById('lx-chat-drawer')?.classList.contains('open')===true);
  const chatOpen=await page.evaluate(()=>({
    drawerOpen:document.getElementById('lx-chat-drawer')?.classList.contains('open')===true,
    tabHidden:document.getElementById('lx-chat-tab')?.classList.contains('hidden')===true,
    input:!!document.getElementById('lx-in')
  }));
  if(!chatOpen.drawerOpen||!chatOpen.tabHidden||!chatOpen.input)throw new Error(`Chat open contract failed: ${JSON.stringify(chatOpen)}`);
  await page.screenshot({path:'artifacts/kelo-chat-open-mobile.png',fullPage:false});

  await page.locator('#lx-chat-close').click();
  await page.waitForFunction(()=>document.getElementById('lx-chat-drawer')?.classList.contains('open')===false);
  const chatClosed=await page.evaluate(()=>{
    const tab=document.getElementById('lx-chat-tab'),r=tab?.getBoundingClientRect(),s=tab?getComputedStyle(tab):null;
    return{drawerOpen:document.getElementById('lx-chat-drawer')?.classList.contains('open')===true,tabVisible:!!tab&&r.width>0&&r.height>0&&s.display!=='none',opacity:s?Number(s.opacity):null};
  });
  if(chatClosed.drawerOpen||!chatClosed.tabVisible||chatClosed.opacity>0.4)throw new Error(`Chat minimize contract failed: ${JSON.stringify(chatClosed)}`);
  if(pageErrors.length)throw new Error(`Page errors: ${pageErrors.join('\n')}`);

  const report={status:'PASS',closed,open,chatOpen,chatClosed};
  fs.writeFileSync('artifacts/kelo-hub-audit.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
}finally{
  await browser.close();
}
