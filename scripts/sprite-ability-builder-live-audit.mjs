/* KELO-INDEX
 * area: QA / CREATORS / SPRITE ABILITY
 * keys: MOBILE LIVE UPLOAD SPRITESHEET PREVIEW DUMMY GENERATE ANIMATION ABILITY
 * purpose: abre el Builder exacto a 390x844, sube un PNG real, ajusta parámetros y verifica generación de drafts
 */
import fs from 'node:fs';
import { chromium } from 'playwright';
const BASE=(process.env.AUDIT_URL||'http://127.0.0.1:8000/').replace(/\?+$/,'');
const executablePath=process.env.CHROME_BIN||undefined;
fs.mkdirSync('artifacts/sprite-ability-builder',{recursive:true});
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAAGklEQVR4nGNkYNjy34aBgQGGWRhsGFAAYQEAr5ADKYxx1NgAAAAASUVORK5CYII=','base64');
const browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{})});
const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,serviceWorkers:'block'});
const page=await context.newPage(),pageErrors=[];page.on('pageerror',e=>pageErrors.push(String(e?.stack||e?.message||e)));
try{
  await page.goto(`${BASE}?offline=1&mapEditor=1&sprite-ability-audit=${Date.now()}`,{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForFunction(()=>window.KELO_CREATORS_LAUNCHER&&window.KELO_ADMIN_KEYS?.can?.('ability.edit',window.KELO_ADMIN_KEYS.playerId())===true&&window.KeloInputLocks,{timeout:20000});
  // Account/auth is a separate surface. Hide its gate explicitly so pointer tests are scoped only to the Builder.
  await page.evaluate(()=>{document.documentElement.dataset.keloAuthGate='off';});
  await page.evaluate(()=>window.KELO_CREATORS_LAUNCHER.open());
  await page.waitForSelector('#kelo-creators-hub',{state:'visible',timeout:10000});
  const spriteButton=page.getByRole('button',{name:'Abrir Sprite Ability'});if(!await spriteButton.isEnabled())throw new Error('SPRITE_ABILITY_CARD_NOT_ACTIVE');
  await spriteButton.click();await page.waitForSelector('#kelo-studio-workspace',{state:'visible',timeout:10000});
  const initial=await page.evaluate(async()=>{const m=await import('./src/creators/sprite-ability/sprite-ability-live-controller.mjs'),s=m.getSpriteAbilityBuilder();return{version:s?.version,projectId:s?.projectId,lockOwners:window.KeloInputLocks.snapshot().owners||[]};});
  if(initial.version!=='sprite-ability-builder-v1.0.1'||!initial.projectId||!initial.lockOwners.includes('kelo-sprite-ability-builder'))throw new Error(`SPRITE_ABILITY_BOOT_FAILED:${JSON.stringify(initial)}`);
  await page.getByRole('button',{name:'CLIP'}).click();
  const upload=page.locator('.ksw-left input[type=file]');await upload.setInputFiles({name:'test-sword.png',mimeType:'image/png',buffer:png});
  await page.waitForFunction(async()=>{const s=(await import('./src/creators/sprite-ability/sprite-ability-live-controller.mjs')).getSpriteAbilityBuilder();return s?.draft?.sheet?.fileName==='test-sword.png'&&s.draft.sheet.imageWidth===4&&s.draft.sheet.imageHeight===4;},null,{timeout:5000});
  const fps=page.locator('.ksw-left .ksw-field').filter({hasText:'FPS'}).locator('input');await fps.evaluate(el=>{el.value='20';el.dispatchEvent(new Event('change',{bubbles:true}));});
  await page.getByRole('button',{name:'EVENTS'}).click();
  const impact=page.locator('.ksw-right .ksw-field').filter({hasText:'Impact Frame'}).locator('input');await impact.evaluate(el=>{el.value='3';el.dispatchEvent(new Event('change',{bubbles:true}));});
  const damage=page.locator('.ksw-right .ksw-field').filter({hasText:'Damage'}).locator('input');await damage.evaluate(el=>{el.value='37';el.dispatchEvent(new Event('change',{bubbles:true}));});
  const knockback=page.locator('.ksw-right .ksw-field').filter({hasText:'Knockback'}).locator('input');await knockback.evaluate(el=>{el.value='29';el.dispatchEvent(new Event('change',{bubbles:true}));});
  await page.getByRole('button',{name:'DUMMY'}).click();await page.waitForTimeout(180);await page.screenshot({path:'artifacts/sprite-ability-builder/dummy-preview.png',fullPage:true});
  const beforeGenerate=await page.evaluate(async()=>{const s=(await import('./src/creators/sprite-ability/sprite-ability-live-controller.mjs')).getSpriteAbilityBuilder();return{fps:s.draft.sheet.fps,impact:s.draft.combat.impactFrame,damage:s.draft.combat.damage,knockback:s.draft.combat.knockback,mode:s.draft.preview.mode};});
  if(beforeGenerate.fps!==20||beforeGenerate.impact!==3||beforeGenerate.damage!==37||beforeGenerate.knockback!==29||beforeGenerate.mode!=='dummy')throw new Error(`SPRITE_ABILITY_EDIT_FAILED:${JSON.stringify(beforeGenerate)}`);
  await page.getByRole('button',{name:'⚡ GENERATE'}).click();
  await page.waitForFunction(async()=>{const s=(await import('./src/creators/sprite-ability/sprite-ability-live-controller.mjs')).getSpriteAbilityBuilder();return !!(s?.draft?.generated?.animationProjectId&&s?.draft?.generated?.abilityProjectId);},null,{timeout:8000});
  const generated=await page.evaluate(async()=>{const s=(await import('./src/creators/sprite-ability/sprite-ability-live-controller.mjs')).getSpriteAbilityBuilder(),platform=(await import('./src/creators/creator-entry.mjs')).getKeloCreatorsPlatform(),ids=s.draft.generated,animation=await platform.projects.loadDraft(ids.animationProjectId),ability=await platform.projects.loadDraft(ids.abilityProjectId);return{ids,animation:{type:animation?.documentType,asset:animation?.assetSource?.dataUrl?.slice(0,22),fps:animation?.clip?.fps,impact:animation?.clip?.markers?.impact},ability:{type:ability?.documentType,animationProjectId:ability?.links?.animationProjectId,damage:ability?.definition?.effects?.find(x=>x.type==='damage')?.amount}};});
  if(generated.animation.type!=='ANIMATION'||!generated.animation.asset?.startsWith('data:image/png;base64,')||generated.animation.fps!==20||generated.ability.type!=='ABILITY'||generated.ability.animationProjectId!==generated.ids.animationProjectId||generated.ability.damage!==37)throw new Error(`SPRITE_ABILITY_GENERATION_FAILED:${JSON.stringify(generated)}`);
  await page.screenshot({path:'artifacts/sprite-ability-builder/generated.png',fullPage:true});
  await page.locator('.ksw-top [data-act="close"]').click();await page.waitForFunction(()=>!document.getElementById('kelo-studio-workspace'),null,{timeout:5000});
  const locks=await page.evaluate(()=>window.KeloInputLocks.snapshot().owners||[]);if(locks.includes('kelo-sprite-ability-builder'))throw new Error('SPRITE_ABILITY_LOCK_LEAK');
  if(pageErrors.length)throw new Error(`SPRITE_ABILITY_PAGE_ERRORS:${pageErrors.join(' | ')}`);
  const report={ok:true,viewport:'390x844',initial,beforeGenerate,generated,locksAfterClose:locks,pageErrors};fs.writeFileSync('artifacts/sprite-ability-builder/report.json',JSON.stringify(report,null,2));console.log('KELO SPRITE ABILITY BUILDER MOBILE AUDIT: PASS');console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}
