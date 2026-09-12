import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const TARGET = process.env.TARGET_URL || 'https://kelffren.github.io/gemini/';
const OUT = process.env.AUDIT_OUT || 'ui-blackbox-artifacts';
const MAX_ACTIONS = Number(process.env.MAX_ACTIONS || 90);
const SAFE_TIMEOUT = 10000;
const wait = ms => new Promise(r => setTimeout(r, ms));
const slug = s => String(s || 'item').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,70) || 'item';
const hash = x => crypto.createHash('sha1').update(String(x)).digest('hex').slice(0,10);
const profiles = [
  { name:'desktop-1440', viewport:{width:1440,height:900}, isMobile:false, hasTouch:false, deviceScaleFactor:1 },
  { name:'iphone-390', viewport:{width:390,height:844}, isMobile:true, hasTouch:true, deviceScaleFactor:3 },
  { name:'iphone-landscape', viewport:{width:844,height:390}, isMobile:true, hasTouch:true, deviceScaleFactor:3 },
];

await fs.rm(OUT,{recursive:true,force:true});
await fs.mkdir(path.join(OUT,'screens'),{recursive:true});

const findings = [];
const observations = [];
let findingSeq = 0;
function addFinding(profile, severity, type, title, detail={}, evidence={}) {
  const key = `${profile}|${type}|${title}|${JSON.stringify(detail)}`;
  if (findings.some(f=>f.key===key)) return;
  findings.push({ id:`BUG-${String(++findingSeq).padStart(3,'0')}`, key, profile, severity, type, title, detail, evidence });
}

async function snap(page, profile, label) {
  const file = path.join(OUT,'screens',`${profile}-${slug(label)}-${Date.now()}.png`);
  try { await page.screenshot({path:file, fullPage:false}); return file; } catch { return null; }
}

function attachTelemetry(page, profile, bucket) {
  page.on('pageerror', err => {
    bucket.pageErrors.push(String(err?.stack || err));
    addFinding(profile,'high','javascript','Uncaught JavaScript error',{message:String(err?.message||err)});
  });
  page.on('console', msg => {
    const type = msg.type();
    const text = msg.text();
    if (type==='error') {
      bucket.consoleErrors.push(text);
      if (!/favicon/i.test(text)) addFinding(profile,'medium','console','Console error visible during UI use',{text});
    } else if (type==='warning') bucket.consoleWarnings.push(text);
  });
  page.on('requestfailed', req => {
    const url=req.url(); const failure=req.failure()?.errorText||'request failed';
    bucket.failedRequests.push({url,failure});
    addFinding(profile,'medium','network','Request failed during interface use',{url,failure});
  });
  page.on('response', res => {
    const st=res.status(); const url=res.url();
    if (st>=400 && !/favicon\.ico/i.test(url)) {
      bucket.badResponses.push({status:st,url});
      addFinding(profile, st>=500?'high':'medium','network',`HTTP ${st} returned while using UI`,{url,status:st});
    }
  });
}

async function pageState(page) {
  return page.evaluate(() => {
    const vis = e => { const r=e.getBoundingClientRect(); const s=getComputedStyle(e); return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none'&&Number(s.opacity)!==0; };
    const dialogs=[...document.querySelectorAll('dialog,[role="dialog"],[aria-modal="true"]')].filter(vis).length;
    const text=(document.body?.innerText||'').replace(/\s+/g,' ').slice(0,12000);
    const count=[...document.querySelectorAll('button,a,input,select,textarea,[role="button"],[tabindex]')].filter(vis).length;
    return {url:location.href,dialogs,count,textHash:text.slice(0,5000),scrollX:document.documentElement.scrollWidth,clientX:document.documentElement.clientWidth};
  });
}

async function inspectVisibleUI(page, profile, label) {
  const evidence = await snap(page,profile,label);
  const data = await page.evaluate(() => {
    const vis = e => { const r=e.getBoundingClientRect(); const s=getComputedStyle(e); return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none'&&Number(s.opacity)!==0; };
    const selector='button,a,input,select,textarea,[role="button"],[role="link"],[tabindex]';
    const els=[...document.querySelectorAll(selector)].filter(vis);
    const interactive=els.map((e,i)=>{
      const r=e.getBoundingClientRect();
      const label=(e.getAttribute('aria-label')||e.innerText||e.getAttribute('title')||e.getAttribute('placeholder')||e.id||e.className||e.tagName).toString().trim().replace(/\s+/g,' ').slice(0,160);
      const cx=Math.max(0,Math.min(innerWidth-1,r.left+r.width/2)); const cy=Math.max(0,Math.min(innerHeight-1,r.top+r.height/2));
      const top=document.elementFromPoint(cx,cy);
      const obscured=!!top && top!==e && !e.contains(top) && !top.contains(e);
      return {i,tag:e.tagName,label,href:e.href||null,x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom,disabled:!!e.disabled,obscured,topTag:top?.tagName||null,topLabel:(top?.getAttribute?.('aria-label')||top?.innerText||'').toString().trim().slice(0,80)};
    });
    const imgs=[...document.images].filter(vis).map(img=>({src:img.currentSrc||img.src,alt:img.alt,naturalWidth:img.naturalWidth,naturalHeight:img.naturalHeight,w:img.getBoundingClientRect().width,h:img.getBoundingClientRect().height}));
    const canvases=[...document.querySelectorAll('canvas')].filter(vis).map(c=>({w:c.width,h:c.height,cw:c.getBoundingClientRect().width,ch:c.getBoundingClientRect().height}));
    const clipped=[...document.querySelectorAll('*')].filter(e=>{
      if(!vis(e)) return false; const s=getComputedStyle(e); if(!['hidden','clip'].includes(s.overflowX)&&!['hidden','clip'].includes(s.textOverflow)) return false;
      return e.scrollWidth>e.clientWidth+4 && (e.innerText||'').trim().length>2;
    }).slice(0,30).map(e=>({tag:e.tagName,text:(e.innerText||'').trim().replace(/\s+/g,' ').slice(0,100),clientWidth:e.clientWidth,scrollWidth:e.scrollWidth}));
    return {interactive,imgs,canvases,clipped,scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth,scrollHeight:document.documentElement.scrollHeight,clientHeight:document.documentElement.clientHeight,title:document.title,bodyText:(document.body?.innerText||'').trim().slice(0,800)};
  });
  if (data.scrollWidth > data.clientWidth + 3) addFinding(profile,'medium','layout','Horizontal overflow on viewport',{label,scrollWidth:data.scrollWidth,clientWidth:data.clientWidth},{screenshot:evidence});
  for (const img of data.imgs) if (!img.naturalWidth || !img.naturalHeight) addFinding(profile,'high','asset','Visible image failed to load',{src:img.src,alt:img.alt},{screenshot:evidence});
  for (const c of data.canvases) if (c.w===0||c.h===0||c.cw<2||c.ch<2) addFinding(profile,'high','canvas','Visible game/editor canvas has zero or unusable size',{...c,label},{screenshot:evidence});
  for (const e of data.interactive) {
    if (!e.disabled && (e.right<0 || e.bottom<0 || e.x>data.clientWidth || e.y>data.clientHeight)) addFinding(profile,'medium','layout','Visible interactive control is outside viewport',{label:e.label,tag:e.tag,x:e.x,y:e.y,w:e.w,h:e.h},{screenshot:evidence});
    if (profile.startsWith('iphone') && !e.disabled && (e.w<40 || e.h<40) && !['INPUT','SELECT','TEXTAREA'].includes(e.tag)) addFinding(profile,'low','touch','Tap target smaller than 40px',{label:e.label,tag:e.tag,w:Math.round(e.w),h:Math.round(e.h)},{screenshot:evidence});
    if (!e.disabled && e.obscured && e.w>8 && e.h>8) addFinding(profile,'medium','interaction','Interactive control is visually obscured by another element',{label:e.label,topTag:e.topTag,topLabel:e.topLabel},{screenshot:evidence});
  }
  for (const c of data.clipped) addFinding(profile,'low','layout','Text appears clipped',{...c,label},{screenshot:evidence});
  observations.push({profile,label,summary:{title:data.title,interactive:data.interactive.length,images:data.imgs.length,canvases:data.canvases.length,text:data.bodyText.slice(0,300)}});
  return data;
}

async function dismissOrEnter(page) {
  const patterns=[/play/i,/jugar/i,/enter/i,/entrar/i,/continue/i,/continuar/i,/guest/i,/invitado/i,/start/i,/comenzar/i];
  for (const re of patterns) {
    const loc=page.getByRole('button',{name:re}).first();
    if (await loc.count()) {
      try { if(await loc.isVisible() && await loc.isEnabled()){ await loc.click({timeout:2500}); await wait(900); return true; } } catch {}
    }
  }
  return false;
}

async function testKeyboardAndCanvas(page, profile) {
  const canvas=page.locator('canvas').filter({visible:true}).first();
  if (!(await canvas.count())) return;
  const before=await snap(page,profile,'canvas-before-input');
  for (const key of ['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowLeft','ArrowDown','ArrowRight']) {
    try { await page.keyboard.down(key); await wait(180); await page.keyboard.up(key); } catch {}
  }
  try { await canvas.click({position:{x:Math.max(2,Math.min(30,(await canvas.boundingBox())?.width/2||10)),y:Math.max(2,Math.min(30,(await canvas.boundingBox())?.height/2||10))},timeout:3000}); } catch {}
  const after=await snap(page,profile,'canvas-after-input');
  observations.push({profile,label:'game-input-smoke',before,after});
}

async function testTabFocus(page, profile) {
  const seen=[];
  for(let i=0;i<28;i++){
    await page.keyboard.press('Tab');
    const info=await page.evaluate(()=>{const e=document.activeElement;if(!e)return null;const r=e.getBoundingClientRect();return {tag:e.tagName,label:(e.getAttribute('aria-label')||e.innerText||e.getAttribute('placeholder')||e.id||'').trim().replace(/\s+/g,' ').slice(0,120),x:r.x,y:r.y,w:r.width,h:r.height};});
    if(info) seen.push(info);
  }
  const meaningful=seen.filter(x=>x.label||['INPUT','BUTTON','A','SELECT','TEXTAREA'].includes(x.tag));
  if (meaningful.length<2) addFinding(profile,'low','accessibility','Keyboard Tab navigation exposes almost no usable controls',{count:meaningful.length});
}

async function sameOriginLinks(page) {
  return page.evaluate(()=>[...new Set([...document.querySelectorAll('a[href]')].map(a=>a.href).filter(h=>{try{return new URL(h).origin===location.origin}catch{return false}}))].slice(0,80));
}

const destructive=/(delete|remove|erase all|clear all|purchase|buy|pay|checkout|logout|sign out|cerrar sesi[oó]n|borrar cuenta|eliminar cuenta|reset account)/i;
const highValue=/(menu|chat|guide|gu[ií]a|map|mapa|inventory|inventario|settings|ajustes|creator|editor|avatar|sprite|build|builder|ability|habilidad|profile|perfil|shop|tienda|world|mundo|play|jugar|login|sign in|log in|auth|help|ayuda|studio|forge|luxe)/i;

async function collectActionCandidates(page) {
  const loc=page.locator('button,a,[role="button"],[role="link"],summary,input[type="button"],input[type="submit"]');
  const n=Math.min(await loc.count(),160);
  const arr=[];
  for(let i=0;i<n;i++){
    const e=loc.nth(i);
    try{
      if(!await e.isVisible()) continue;
      const label=((await e.getAttribute('aria-label'))||(await e.innerText())||(await e.getAttribute('title'))||(await e.getAttribute('value'))||'').trim().replace(/\s+/g,' ').slice(0,140);
      const tag=await e.evaluate(el=>el.tagName);
      const href=await e.getAttribute('href');
      if(destructive.test(label)) continue;
      arr.push({index:i,label,tag,href,priority:highValue.test(label)?0:1});
    }catch{}
  }
  return arr.sort((a,b)=>a.priority-b.priority).slice(0,MAX_ACTIONS);
}

async function performIsolatedAction(browser, profile, candidate, actionNo) {
  const context=await browser.newContext({viewport:profile.viewport,isMobile:profile.isMobile,hasTouch:profile.hasTouch,deviceScaleFactor:profile.deviceScaleFactor,ignoreHTTPSErrors:true});
  const page=await context.newPage();
  const tele={consoleErrors:[],consoleWarnings:[],pageErrors:[],failedRequests:[],badResponses:[]}; attachTelemetry(page,profile.name,tele);
  try {
    await page.goto(TARGET,{waitUntil:'domcontentloaded',timeout:30000}); await wait(1200); await dismissOrEnter(page); await wait(500);
    const loc=page.locator('button,a,[role="button"],[role="link"],summary,input[type="button"],input[type="submit"]').nth(candidate.index);
    if(!(await loc.count())||!(await loc.isVisible())) return;
    const actualLabel=((await loc.getAttribute('aria-label'))||(await loc.innerText())||(await loc.getAttribute('title'))||(await loc.getAttribute('value'))||'').trim().replace(/\s+/g,' ').slice(0,140);
    if(candidate.label && actualLabel!==candidate.label) return;
    const before=await pageState(page); const beforeShot=await snap(page,profile.name,`action-${actionNo}-before-${actualLabel}`);
    let clickError=null;
    try { await loc.click({timeout:4500}); } catch(e) { clickError=String(e.message||e); }
    await wait(1200);
    const after=await pageState(page); const afterShot=await snap(page,profile.name,`action-${actionNo}-after-${actualLabel}`);
    if(clickError) addFinding(profile.name,'medium','interaction','Visible control could not be clicked',{label:actualLabel,error:clickError.slice(0,350)},{before:beforeShot,after:afterShot});
    else {
      const changed=before.url!==after.url||before.dialogs!==after.dialogs||before.count!==after.count||before.textHash!==after.textHash;
      if(!changed && !tele.failedRequests.length && !tele.badResponses.length && !tele.consoleErrors.length && /button|BUTTON/.test(candidate.tag)) addFinding(profile.name,'low','interaction','Button produced no observable UI response',{label:actualLabel},{before:beforeShot,after:afterShot});
      await inspectVisibleUI(page,profile.name,`action-${actionNo}-${actualLabel}`);
    }
  } catch(e) {
    addFinding(profile.name,'high','navigation','UI action audit crashed or page became unusable',{label:candidate.label,error:String(e.stack||e).slice(0,600)});
  } finally { await context.close(); }
}

const browser=await chromium.launch({headless:true,args:['--disable-dev-shm-usage','--no-sandbox']});
for(const profile of profiles){
  const context=await browser.newContext({viewport:profile.viewport,isMobile:profile.isMobile,hasTouch:profile.hasTouch,deviceScaleFactor:profile.deviceScaleFactor,ignoreHTTPSErrors:true});
  const page=await context.newPage();
  const tele={consoleErrors:[],consoleWarnings:[],pageErrors:[],failedRequests:[],badResponses:[]}; attachTelemetry(page,profile.name,tele);
  try{
    const resp=await page.goto(TARGET,{waitUntil:'domcontentloaded',timeout:30000});
    if(!resp || resp.status()>=400) addFinding(profile.name,'critical','navigation','Published game did not load successfully',{status:resp?.status()||null,url:TARGET});
    await wait(1800);
    await inspectVisibleUI(page,profile.name,'landing');
    await dismissOrEnter(page); await wait(1200);
    await inspectVisibleUI(page,profile.name,'entered');
    await testKeyboardAndCanvas(page,profile.name);
    await testTabFocus(page,profile.name);

    const links=await sameOriginLinks(page);
    for(const href of links.slice(0,35)){
      try{
        const r=await context.request.get(href,{timeout:12000,failOnStatusCode:false});
        if(r.status()>=400) addFinding(profile.name,r.status()>=500?'high':'medium','navigation','Interface contains broken same-origin link',{href,status:r.status()});
      }catch(e){ addFinding(profile.name,'medium','navigation','Interface link could not be reached',{href,error:String(e.message||e)}); }
    }

    const candidates=await collectActionCandidates(page);
    observations.push({profile:profile.name,label:'candidate-controls',count:candidates.length,controls:candidates.map(x=>x.label).filter(Boolean)});
    await context.close();
    let i=0;
    for(const c of candidates){ await performIsolatedAction(browser,profile,c,++i); }
  }catch(e){
    addFinding(profile.name,'critical','navigation','Published game audit could not start',{error:String(e.stack||e).slice(0,800)});
    await context.close().catch(()=>{});
  }
}
await browser.close();

const sevRank={critical:0,high:1,medium:2,low:3};
findings.sort((a,b)=>(sevRank[a.severity]??9)-(sevRank[b.severity]??9)||a.id.localeCompare(b.id));
const summary={target:TARGET,generatedAt:new Date().toISOString(),counts:Object.fromEntries(['critical','high','medium','low'].map(s=>[s,findings.filter(f=>f.severity===s).length])),total:findings.length,profiles:profiles.map(p=>p.name)};
await fs.writeFile(path.join(OUT,'report.json'),JSON.stringify({summary,findings,observations},null,2));
let md=`# KELO WORLD — Black-box UI Playwright Audit\n\nTarget: ${TARGET}\n\nGenerated: ${summary.generatedAt}\n\n## Summary\n\n- Total: ${summary.total}\n- Critical: ${summary.counts.critical}\n- High: ${summary.counts.high}\n- Medium: ${summary.counts.medium}\n- Low: ${summary.counts.low}\n\n## Findings\n\n`;
for(const f of findings){ md+=`### ${f.id} — ${f.severity.toUpperCase()} — ${f.title}\n\n- Profile: ${f.profile}\n- Type: ${f.type}\n- Detail: \`${JSON.stringify(f.detail)}\`\n- Evidence: \`${JSON.stringify(f.evidence)}\`\n\n`; }
md+='## Observed UI surfaces\n\n```json\n'+JSON.stringify(observations,null,2)+'\n```\n';
await fs.writeFile(path.join(OUT,'REPORT.md'),md);
console.log(JSON.stringify(summary,null,2));
console.log(`REPORT=${path.join(OUT,'REPORT.md')}`);
if(summary.counts.critical>0) process.exitCode=2;
