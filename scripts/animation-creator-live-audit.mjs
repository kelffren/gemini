import fs from 'node:fs';
import { chromium } from 'playwright';

const BASE=(process.env.AUDIT_URL||'http://127.0.0.1:8000/').replace(/\?+$/,'');
const executablePath=process.env.CHROME_BIN||undefined,sleep=ms=>new Promise(r=>setTimeout(r,ms));
fs.mkdirSync('artifacts',{recursive:true});
const browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{})});
const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,serviceWorkers:'block'});
let page=await context.newPage(),pageErrors=[];page.on('pageerror',e=>pageErrors.push(String(e?.stack||e?.message||e)));
async function boot(){
  await page.goto(`${BASE}?mapEditor=1&animation-creator-audit=${Date.now()}`,{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForFunction(()=>window.KELO_CREATORS_LAUNCHER&&window.KELO_ADMIN_KEYS?.can?.('animation.edit',window.KELO_ADMIN_KEYS.playerId())===true&&window.KeloAnimation?.previewLocal&&window.KeloInputLocks,{timeout:15000});
  const resources=await page.evaluate(()=>performance.getEntriesByType('resource').map(x=>x.name));
  if(resources.some(x=>/\/src\/(?:creators|studio)\//.test(x)))throw new Error('ANIMATION_CREATOR_LAZY_BOOT_VIOLATION');
  return resources;
}
const bootResources=await boot();
await page.evaluate(()=>window.KELO_CREATORS_LAUNCHER.open());
await page.waitForSelector('#kelo-creators-hub',{state:'visible',timeout:10000});
const hubResources=await page.evaluate(()=>performance.getEntriesByType('resource').map(x=>x.name));
if(!hubResources.some(x=>/\/src\/creators\//.test(x)))throw new Error('ANIMATION_CREATOR_HUB_NOT_LAZY_LOADED');
if(hubResources.some(x=>/\/src\/studio\//.test(x)))throw new Error('ANIMATION_CREATOR_STUDIO_LOADED_BEFORE_WORKSPACE');
const animationButton=page.getByRole('button',{name:'Abrir Animation'});if(!await animationButton.isEnabled())throw new Error('ANIMATION_CREATOR_NOT_ACTIVE');await animationButton.click();
await page.waitForSelector('#kelo-studio-workspace',{state:'visible',timeout:10000});
const opened=await page.evaluate(async()=>{const mod=await import('./src/creators/animation/animation-live-controller.mjs'),session=mod.getAnimationCreator(),resources=performance.getEntriesByType('resource').map(x=>x.name);return{projectId:session?.projectId||null,domain:session?.kernel?.domain,documentType:session?.kernel?.document?.documentType,undoDepth:session?.kernel?.history?.undoDepth,lockOwners:window.KeloInputLocks?.snapshot?.().owners||[],studioResources:resources.filter(x=>/\/src\/studio\//.test(x)),worldControllerLoaded:resources.some(x=>/\/src\/studio\/integration\/live-studio-controller\.mjs/.test(x))};});
if(!opened.projectId||opened.domain!=='animation'||opened.documentType!=='ANIMATION')throw new Error(`ANIMATION_CREATOR_SHARED_KERNEL_MISSING:${JSON.stringify(opened)}`);
if(!opened.lockOwners.includes('kelo-animation-creator'))throw new Error('ANIMATION_CREATOR_LOCK_NOT_ACQUIRED');
if(!opened.studioResources.length)throw new Error('ANIMATION_CREATOR_SHARED_STUDIO_NOT_LOADED');
if(opened.worldControllerLoaded)throw new Error('ANIMATION_CREATOR_LOADED_WORLD_STUDIO_CONTROLLER');

await page.getByRole('button',{name:'CLIP'}).click();
const durationField=page.locator('.ksw-left .ksw-field').filter({hasText:'Duration'}).locator('input');await durationField.evaluate(el=>{el.value='0.80';el.dispatchEvent(new Event('change',{bubbles:true}));});
await page.waitForFunction(async()=>{const m=await import('./src/creators/animation/animation-live-controller.mjs'),s=m.getAnimationCreator();return s?.kernel?.document?.clip?.duration===0.8&&s.kernel.history.undoDepth>=1;},null,{timeout:5000});
await page.locator('.ksw-top [data-act="undo"]').click();await page.waitForFunction(async()=>{const s=(await import('./src/creators/animation/animation-live-controller.mjs')).getAnimationCreator();return Math.abs(s.kernel.document.clip.duration-.42)<.001;});
await page.locator('.ksw-top [data-act="redo"]').click();await page.waitForFunction(async()=>{const s=(await import('./src/creators/animation/animation-live-controller.mjs')).getAnimationCreator();return s.kernel.document.clip.duration===.8;});

await page.getByRole('button',{name:'EVENTS'}).click();
await page.getByRole('button',{name:'+ MARKER @ PLAYHEAD'}).click();
await page.getByRole('button',{name:'+ EVENT @ PLAYHEAD'}).click();
await page.waitForFunction(async()=>{const s=(await import('./src/creators/animation/animation-live-controller.mjs')).getAnimationCreator();return Object.hasOwn(s.kernel.document.clip.markers,'release')&&s.kernel.document.tracks.hitbox.length===1;},null,{timeout:5000});

await page.getByRole('button',{name:'CLIP'}).click();await page.getByRole('button',{name:'▶ PLAY'}).click();
await page.waitForFunction(()=>window.KeloAnimation?.metrics?.().active>0,null,{timeout:5000});const previewActive=await page.evaluate(()=>window.KeloAnimation.metrics().active);await page.getByRole('button',{name:'■ STOP'}).click();
await page.locator('.ksw-top [data-act="save"]').click();await sleep(250);
const beforeClose=await page.evaluate(async()=>{const s=(await import('./src/creators/animation/animation-live-controller.mjs')).getAnimationCreator();return{projectId:s.projectId,duration:s.kernel.document.clip.duration,markers:Object.keys(s.kernel.document.clip.markers),hitboxes:s.kernel.document.tracks.hitbox.length,undoDepth:s.kernel.history.undoDepth};});
await page.locator('.ksw-top [data-act="close"]').click();await page.waitForFunction(()=>!document.getElementById('kelo-studio-workspace')&&!document.body.classList.contains('kelo-animation-creator-active'),null,{timeout:5000});
const locksAfterClose=await page.evaluate(()=>window.KeloInputLocks.snapshot().owners||[]);if(locksAfterClose.includes('kelo-animation-creator'))throw new Error('ANIMATION_CREATOR_LOCK_LEAK');

// Destroy the in-memory platform, reload the page and prove the private project/draft came back from the repository state adapter.
await page.evaluate(async()=>{const mod=await import('./src/creators/creator-entry.mjs');mod.getKeloCreatorsPlatform()?.close?.();});await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.KELO_CREATORS_LAUNCHER&&window.KELO_ADMIN_KEYS?.can?.('animation.edit',window.KELO_ADMIN_KEYS.playerId())===true,{timeout:15000});
await page.evaluate(()=>window.KELO_CREATORS_LAUNCHER.open());await page.waitForSelector('#kelo-creators-hub',{state:'visible',timeout:10000});await page.getByRole('button',{name:'MY PROJECTS'}).click();const projectRow=page.locator('.kc-project').filter({hasText:'Animation 1'});await projectRow.waitFor({state:'visible',timeout:5000});await projectRow.getByRole('button',{name:'OPEN'}).click();await page.waitForSelector('#kelo-studio-workspace',{state:'visible',timeout:10000});
const recovered=await page.evaluate(async()=>{const s=(await import('./src/creators/animation/animation-live-controller.mjs')).getAnimationCreator();return{projectId:s.projectId,duration:s.kernel.document.clip.duration,markers:Object.keys(s.kernel.document.clip.markers),hitboxes:s.kernel.document.tracks.hitbox.length,domain:s.kernel.domain,lockOwners:window.KeloInputLocks.snapshot().owners||[]};});
if(recovered.projectId!==beforeClose.projectId||recovered.duration!==.8||!recovered.markers.includes('release')||recovered.hitboxes!==1||recovered.domain!=='animation')throw new Error(`ANIMATION_CREATOR_RECOVERY_FAILED:${JSON.stringify(recovered)}`);
await page.locator('.ksw-top [data-act="close"]').click();await page.waitForFunction(()=>!document.getElementById('kelo-studio-workspace'),null,{timeout:5000});
if((await page.evaluate(()=>window.KeloInputLocks.snapshot().owners||[])).includes('kelo-animation-creator'))throw new Error('ANIMATION_CREATOR_RECOVERY_LOCK_LEAK');
if(pageErrors.length)throw new Error(`ANIMATION_CREATOR_PAGE_ERRORS:${pageErrors.join(' | ')}`);
const report={ok:true,url:BASE,viewport:{width:390,height:844,dpr:2},lazyBoot:true,lazyHubBeforeStudio:true,opened,previewActive,beforeClose,recovered,locksAfterClose,pageErrors};fs.writeFileSync('artifacts/animation-creator-live.json',JSON.stringify(report,null,2));await page.screenshot({path:'artifacts/animation-creator-live.png',fullPage:true});console.log(JSON.stringify(report,null,2));await browser.close();
