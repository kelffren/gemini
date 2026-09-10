/* KELO-INDEX
 * area: QA / CREATORS / SPRITE ABILITY E2E
 * owner: strict Sprite Ability autonomous acceptance agent
 * keys: MOBILE UPLOAD AUTOFIT SHEET ABILITY DUMMY MINIMIZE EXPAND GENERATE RUNTIME AVATAR OPEN ABILITY HARD FAIL
 * purpose: prove current Combat Lab + runtime extension can complete the full Sprite Ability authoring flow
 * policy: binary PASS only; no score, no partial acceptance, no gameplay authority mutation
 */
import fs from 'node:fs';
import {chromium} from 'playwright';

const BASE=(process.env.AUDIT_URL||'http://127.0.0.1:8000/').replace(/\?+$/,'');
const OUT='artifacts/sprite-ability-e2e';
const executablePath=process.env.CHROME_BIN||undefined;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
fs.mkdirSync(OUT,{recursive:true});
const browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{})});
const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,serviceWorkers:'block'});
const page=await context.newPage(),pageErrors=[],consoleErrors=[];
page.on('pageerror',e=>pageErrors.push(String(e?.stack||e?.message||e)));
page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});
const fail=(ok,msg)=>{if(!ok)throw new Error(`HARD_FAIL:${msg}`);};

async function state(){
  return page.evaluate(async()=>{
    const s=(await import('./src/creators/sprite-ability/sprite-ability-runtime-extension.mjs')).getSpriteAbilityBuilder();
    return s?{version:s.version,coreVersion:s.coreVersion||s.version,projectId:s.projectId,draft:s.draft,runtimeTest:s.runtimeTest||null}:null;
  });
}
async function waitState(test,label,timeout=14000){
  const start=Date.now();let s=null;
  while(Date.now()-start<timeout){s=await state();if(test(s))return s;await sleep(80);}
  throw new Error(`HARD_FAIL:${label}:${JSON.stringify(s)}`);
}
async function field(panel,label,value){
  const el=page.locator(`${panel} .ksw-field`).filter({hasText:label}).locator('input');
  await el.waitFor({state:'visible',timeout:5000});
  await el.evaluate((node,v)=>{node.value=String(v);node.dispatchEvent(new Event('change',{bubbles:true}));},value);
}
const canvas=()=>page.locator('canvas[data-sprite-ability-preview="1"]');
const hash=()=>canvas().evaluate(c=>c.toDataURL());

try{
  await page.goto(`${BASE}?offline=1&mapEditor=1&sprite-ability-e2e=${Date.now()}`,{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForFunction(()=>window.KELO_CREATORS_LAUNCHER&&window.KeloInputLocks&&window.KeloAnimation&&window.KeloAvatar&&window.KeloAssetRegistry,{timeout:20000});
  await page.evaluate(async()=>{document.documentElement.dataset.keloAuthGate='off';if(window.KeloRuntimeBootstrap?.ensure)await window.KeloRuntimeBootstrap.ensure();});

  const png=Buffer.from(await page.evaluate(()=>{
    const w=1983,h=793,cols=8,rows=4,c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');x.clearRect(0,0,w,h);
    const colors=['#ff4d6d','#ffd166','#06d6a0','#4cc9f0','#4361ee','#9b5de5','#f15bb5','#ffffff'];
    for(let r=0;r<rows;r++)for(let col=0;col<cols;col++){
      const x0=col*w/cols,x1=(col+1)*w/cols,y0=r*h/rows,y1=(r+1)*h/rows,cx=(x0+x1)/2,cy=(y0+y1)/2;
      x.fillStyle=colors[col%colors.length];x.fillRect(cx-(x1-x0)*(.18+.01*col),cy-(y1-y0)*.25,(x1-x0)*(.36+.02*col),(y1-y0)*.5);
      x.fillStyle='rgba(255,255,255,.95)';x.beginPath();x.arc(cx+(col-3.5)*3,cy-(y1-y0)*.28,Math.max(5,(y1-y0)*.07),0,Math.PI*2);x.fill();
    }
    return c.toDataURL('image/png').split(',')[1];
  }),'base64');

  await page.evaluate(()=>window.KELO_CREATORS_LAUNCHER.open());
  await page.waitForSelector('#kelo-creators-hub',{state:'visible',timeout:10000});
  const launcher=page.getByRole('button',{name:'Abrir Sprite Ability'});fail(await launcher.isEnabled(),'SPRITE_ABILITY_WORKSPACE_UNAVAILABLE');await launcher.click();
  await page.waitForSelector('#kelo-studio-workspace',{state:'visible',timeout:10000});
  const initial=await waitState(s=>s?.version==='sprite-ability-runtime-extension-v1.0.0','RUNTIME_EXTENSION_NOT_ACTIVE');
  fail(/^sprite-ability-builder-v1\.2\.0-combat-lab/.test(initial.coreVersion),`COMBAT_LAB_NOT_PRESERVED:${initial.coreVersion}`);
  await page.waitForFunction(()=>document.querySelector('.ksw-mobile-tabs [data-act="preview-mobile"]')?.textContent?.trim()==='MINIMIZE');
  fail(await canvas().count()===1,'PREVIEW_CANVAS_NOT_EXPOSED');

  const upload=page.locator('.ksw-left input[type=file]');await upload.waitFor({state:'visible',timeout:5000});
  await upload.setInputFiles({name:'agent-irregular-1983x793.png',mimeType:'image/png',buffer:png});
  const fitted=await waitState(s=>s?.draft?.sheet?.autoFit?.applied&&s.draft.sheet.columns===8&&s.draft.sheet.rows===4,'AUTOFIT_FAILED',16000);
  fail(fitted.draft.sheet.imageWidth%8===0&&fitted.draft.sheet.imageHeight%4===0,'NORMALIZED_GRID_NOT_EXACT');

  const modes={};
  for(const mode of ['SHEET','ABILITY','DUMMY']){await page.getByRole('button',{name:mode,exact:true}).click();await sleep(150);modes[mode]=await hash();await page.screenshot({path:`${OUT}/${mode.toLowerCase()}.png`,fullPage:true});}
  fail(modes.SHEET!==modes.ABILITY&&modes.ABILITY!==modes.DUMMY,'PREVIEW_MODES_NOT_DISTINCT');

  await page.getByRole('button',{name:'CLIP',exact:true}).click();await field('.ksw-left','Start Frame',0);await field('.ksw-left','End Frame',7);await field('.ksw-left','FPS',12);
  await page.getByRole('button',{name:'EVENTS',exact:true}).click();await field('.ksw-right','Impact Frame',3);await field('.ksw-right','Active Start',2);await field('.ksw-right','Active End',4);await field('.ksw-right','Damage',37);await field('.ksw-right','Knockback',29);await field('.ksw-right','Lunge px',22);
  await waitState(s=>s?.draft?.sheet?.endFrame===7&&s.draft.sheet.fps===12&&s.draft.combat.impactFrame===3&&s.draft.combat.activeStartFrame===2&&s.draft.combat.activeEndFrame===4&&s.draft.combat.damage===37&&s.draft.combat.knockback===29&&s.draft.combat.lunge===22,'PARAMETER_EDIT_FAILED');

  await page.getByRole('button',{name:'DUMMY',exact:true}).click();await sleep(100);const before=await hash();
  await page.locator('.ksw-mobile-tabs [data-act="preview-mobile"]').click();await page.waitForFunction(()=>document.getElementById('kelo-studio-workspace')?.classList.contains('preview-focus'));
  const minimized=await page.evaluate(()=>{const w=document.getElementById('kelo-studio-workspace'),c=w.querySelector('canvas[data-sprite-ability-preview="1"]');return{left:getComputedStyle(w.querySelector('.ksw-left')).display,right:getComputedStyle(w.querySelector('.ksw-right')).display,timeline:getComputedStyle(w.querySelector('.ksw-timeline')).display,width:c.getBoundingClientRect().width,height:c.getBoundingClientRect().height,edit:w.querySelector('[data-act="preview"]')?.textContent?.trim()};});
  fail(minimized.left==='none'&&minimized.right==='none'&&minimized.timeline==='none','MINIMIZE_DID_NOT_COLLAPSE_EDITOR');fail(minimized.width>300&&minimized.height>250,'MINIMIZE_HID_PREVIEW');fail(minimized.edit==='EDIT','EXPAND_CONTROL_MISSING');
  await sleep(180);fail(before!==await hash(),'PREVIEW_STOPPED_WHILE_MINIMIZED');await page.screenshot({path:`${OUT}/minimized-preview.png`,fullPage:true});
  await page.locator('.ksw-top [data-act="preview"]').click();await page.waitForFunction(()=>!document.getElementById('kelo-studio-workspace')?.classList.contains('preview-focus'));

  await page.getByRole('button',{name:'EVENTS',exact:true}).click();await page.getByRole('button',{name:'⚡ GENERATE',exact:true}).click();
  const generated=await waitState(s=>s?.draft?.generated?.animationProjectId&&s.draft.generated.abilityProjectId,'GENERATE_FAILED');
  const linked=await page.evaluate(async ids=>{const p=(await import('./src/creators/creator-entry.mjs')).getKeloCreatorsPlatform(),a=await p.projects.loadDraft(ids.animationProjectId),b=await p.projects.loadDraft(ids.abilityProjectId);return{animationType:a?.documentType,abilityType:b?.documentType,frames:a?.clip?.frameSequence,hitboxes:a?.tracks?.hitbox||[],animationProjectId:b?.links?.animationProjectId,damage:b?.definition?.effects?.find(e=>e.type==='damage')?.amount};},generated.draft.generated);
  fail(linked.animationType==='ANIMATION'&&linked.abilityType==='ABILITY','GENERATED_DRAFT_TYPES_INVALID');fail(linked.animationProjectId===generated.draft.generated.animationProjectId,'ABILITY_ANIMATION_LINK_BROKEN');fail(linked.damage===37,'EDITED_DAMAGE_LOST');fail(JSON.stringify(linked.frames)===JSON.stringify([0,1,2,3,4,5,6,7]),'FRAME_RANGE_LOST');fail(linked.hitboxes.length>0,'ACTIVE_HITBOX_TRACK_LOST');

  const actorBefore=await page.evaluate(()=>{const a=typeof localPlayer!=='undefined'?localPlayer:window.localPlayer;return{x:a?.x,y:a?.y,hp:a?.hp??null};});
  const testButton=page.getByRole('button',{name:'▶ TEST IN GAME',exact:true});await testButton.waitFor({state:'visible',timeout:5000});await testButton.click();
  const live=await waitState(s=>!!s?.runtimeTest?.animationId,'RUNTIME_TEST_NOT_STARTED');await page.waitForFunction(()=>document.getElementById('kelo-studio-workspace')?.classList.contains('sab-runtime-test'));
  await sleep(55);const a=await page.evaluate(()=>{const actor=typeof localPlayer!=='undefined'?localPlayer:window.localPlayer;return{o:window.KeloAnimation.frameOverride(actor),audit:window.KeloSpritesheetAvatarBridge?.getAudit?.(),x:actor?.x,y:actor?.y,hp:actor?.hp??null};});
  await sleep(110);const b=await page.evaluate(()=>{const actor=typeof localPlayer!=='undefined'?localPlayer:window.localPlayer;return{o:window.KeloAnimation.frameOverride(actor),audit:window.KeloSpritesheetAvatarBridge?.getAudit?.(),x:actor?.x,y:actor?.y,hp:actor?.hp??null};});
  fail(a.o&&b.o,'GENERATED_ANIMATION_NOT_ACTIVE');fail(a.o.frame!==b.o.frame||a.o.frameSlot!==b.o.frameSlot,'RUNTIME_FRAMES_DID_NOT_ADVANCE');fail((b.audit?.renders||0)>0&&b.audit?.last?.assetId,'AVATAR_DID_NOT_RENDER_GENERATED_SHEET');fail(b.x===actorBefore.x&&b.y===actorBefore.y&&b.hp===actorBefore.hp,'RUNTIME_PREVIEW_MUTATED_GAMEPLAY');
  await page.screenshot({path:`${OUT}/runtime-frame.png`,fullPage:true});
  await page.getByRole('button',{name:'EDIT BUILDER',exact:true}).click();await page.waitForFunction(()=>!document.getElementById('kelo-studio-workspace')?.classList.contains('sab-runtime-test'));fail(await page.getByRole('button',{name:'EVENTS',exact:true}).isVisible(),'RUNTIME_TEST_COULD_NOT_RETURN_TO_EDITOR');

  await page.getByRole('button',{name:'EVENTS',exact:true}).click();await page.getByRole('button',{name:'OPEN ABILITY',exact:true}).click();
  await page.waitForFunction(()=>/^ABILITY\s*·/i.test(document.querySelector('#kelo-studio-workspace .ksw-title')?.textContent||''),null,{timeout:12000});
  const abilityTitle=await page.locator('#kelo-studio-workspace .ksw-title').textContent();fail(/agent-irregular/i.test(abilityTitle||''),'GENERATED_ABILITY_DID_NOT_OPEN');await page.screenshot({path:`${OUT}/generated-ability-open.png`,fullPage:true});
  fail(pageErrors.length===0,`PAGE_ERRORS:${pageErrors.join(' | ')}`);

  const report={ok:true,verdict:'PASS',hardBlockers:[],viewport:'390x844',extensionVersion:initial.version,builderVersion:initial.coreVersion,autoFit:{source:`${fitted.draft.sheet.autoFit.sourceWidth}x${fitted.draft.sheet.autoFit.sourceHeight}`,detected:`${fitted.draft.sheet.columns}x${fitted.draft.sheet.rows}`,normalized:`${fitted.draft.sheet.imageWidth}x${fitted.draft.sheet.imageHeight}`,confidence:fitted.draft.sheet.autoFit.confidence},previewModesDistinct:true,minimize:{collapsed:true,previewAlive:true,expandRestored:true},generated:generated.draft.generated,linked,runtime:{animationId:live.runtimeTest.animationId,frameA:a.o,frameB:b.o,avatarAudit:b.audit,gameplayStateUnchanged:true},abilityOpened:abilityTitle,pageErrors,consoleErrors};
  fs.writeFileSync(`${OUT}/report.json`,JSON.stringify(report,null,2));console.log('SPRITE ABILITY AUTONOMOUS E2E AGENT: PASS');console.log(JSON.stringify(report,null,2));
}catch(error){const report={ok:false,verdict:'REJECTED',hardBlockers:[String(error?.message||error)],pageErrors,consoleErrors};fs.writeFileSync(`${OUT}/report.json`,JSON.stringify(report,null,2));try{await page.screenshot({path:`${OUT}/failure.png`,fullPage:true});}catch{}console.error('SPRITE ABILITY AUTONOMOUS E2E AGENT: REJECTED');console.error(error?.stack||error);throw error;}finally{await browser.close();}
