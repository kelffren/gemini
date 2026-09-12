const {test,expect}=require('@playwright/test');
const QA=process.env.SPRITE_QA_URL||'http://127.0.0.1:4173/tests/fixtures/sprite-tactile-editor.html';
async function ready(page){await page.goto(QA);await page.waitForFunction(()=>window.__SPRITE_QA__?.ready);await page.evaluate(()=>window.__SPRITE_QA__.reset());}
async function shot(page,testInfo,name){await page.screenshot({path:testInfo.outputPath(`${name}.png`),fullPage:true});}
async function pointer(page,selector,type,id,rx,ry,{primary=id===1}={}){await page.evaluate(({selector,type,id,rx,ry,primary})=>{const el=document.querySelector(selector),r=el.getBoundingClientRect();el.dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,pointerId:id,pointerType:'touch',isPrimary:primary,buttons:type==='pointerup'||type==='pointercancel'?0:1,clientX:r.left+r.width*rx,clientY:r.top+r.height*ry}));},{selector,type,id,rx,ry,primary});}
async function pinch(page,selector){await pointer(page,selector,'pointerdown',1,.38,.56);await pointer(page,selector,'pointerdown',2,.62,.56,{primary:false});await pointer(page,selector,'pointermove',1,.31,.56);await pointer(page,selector,'pointermove',2,.69,.56,{primary:false});await pointer(page,selector,'pointerup',1,.31,.56);await pointer(page,selector,'pointerup',2,.69,.56,{primary:false});}

test('4x4 project persists individual frames and isolated replacement',async({page},testInfo)=>{
  await ready(page);await page.evaluate(()=>window.__SPRITE_QA__.seed([0,1,2,3]));await page.evaluate(()=>window.__SPRITE_QA__.open());
  await expect(page.locator('.kfb-progress')).toContainText('4/16 FRAMES');await expect(page.locator('.kfb-slot')).toHaveCount(16);await shot(page,testInfo,'01-grid-partial-4-of-16');
  const before=await page.evaluate(async()=>{const p=await window.__SPRITE_QA__.project();return p.slots.map(s=>s.sourceKey);});
  await page.evaluate(()=>window.__SPRITE_QA__.close());await page.evaluate(()=>window.__SPRITE_QA__.open());await expect(page.locator('.kfb-progress')).toContainText('4/16 FRAMES');
  await page.evaluate(()=>window.__SPRITE_QA__.close());await page.evaluate(()=>window.__SPRITE_QA__.seed([2]));const after=await page.evaluate(async()=>{const p=await window.__SPRITE_QA__.project();return p.slots.map(s=>s.sourceKey);});
  expect(after[0]).toBe(before[0]);expect(after[1]).toBe(before[1]);expect(after[2]).not.toBe(before[2]);expect(after[3]).toBe(before[3]);
  await page.evaluate(()=>window.__SPRITE_QA__.open());await expect(page.locator('.kfb-progress')).toContainText('4/16 FRAMES');
});

test('mobile frame editor performs pinch, ghost, auto-match, masks, patches and clean export',async({page},testInfo)=>{
  await ready(page);await page.evaluate(()=>window.__SPRITE_QA__.seed([0,1,2,3,12,13,14,15],{largeRow:true,garbageIndex:0}));await page.evaluate(()=>window.__SPRITE_QA__.open());

  await page.locator('.kfb-slot').nth(1).click();await expect(page.locator('.kfe')).toBeVisible();const beforePinch=await page.evaluate(async()=>{const p=await window.__SPRITE_QA__.project();return p.slots[1].patch;});await pinch(page,'.kfe-canvas');await page.waitForTimeout(100);await shot(page,testInfo,'02-real-two-pointer-pinch');await page.getByRole('button',{name:'GUARDAR',exact:true}).click();let p=await page.evaluate(()=>window.__SPRITE_QA__.project());expect(p.slots[1].patch.scale).toBeGreaterThan(beforePinch.scale*1.25);expect(Math.abs(p.slots[1].patch.x-beforePinch.x)).toBeLessThan(2);expect(Math.abs(p.slots[1].patch.y-beforePinch.y)).toBeLessThan(2);

  await page.locator('.kfb-slot').nth(0).click();await expect(page.locator('.kfe')).toBeVisible();await shot(page,testInfo,'03-editor-frame');await page.getByRole('button',{name:/GHOST/}).click();await expect(page.getByRole('button',{name:/GHOST/})).toHaveClass(/on/);await shot(page,testInfo,'04-editor-ghost');await page.getByRole('button',{name:'CERRAR',exact:true}).click();

  await page.locator('.kfb-slot').nth(12).click();page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'AUTO MATCH',exact:true}).click();await page.waitForTimeout(140);await shot(page,testInfo,'05-back-auto-match');await page.getByRole('button',{name:'GUARDAR',exact:true}).click();p=await page.evaluate(()=>window.__SPRITE_QA__.project());expect(p.slots[12].patch.scale).toBeLessThan(1);

  await page.locator('.kfb-slot').nth(0).click();await page.getByRole('button',{name:'✨ MAGIC',exact:true}).click();await pointer(page,'.kfe-canvas','pointerdown',7,430/620,126/620);await pointer(page,'.kfe-canvas','pointerup',7,430/620,126/620);await page.waitForTimeout(180);await page.getByRole('button',{name:'UNDO',exact:true}).click();await page.getByRole('button',{name:'REDO',exact:true}).click();await shot(page,testInfo,'06-magic-eraser-undo-redo');
  await page.getByRole('button',{name:'+ PATCH',exact:true}).click();await expect(page.locator('.kfe-pop')).toBeVisible();await pointer(page,'.kfe-pop canvas','pointerdown',11,.35,.12);await pointer(page,'.kfe-pop canvas','pointermove',11,.65,.32);await pointer(page,'.kfe-pop canvas','pointerup',11,.65,.32);await page.getByRole('button',{name:'AÑADIR PATCH',exact:true}).click();await shot(page,testInfo,'07-patch-layer');await page.getByRole('button',{name:'GUARDAR',exact:true}).click();
  p=await page.evaluate(()=>window.__SPRITE_QA__.project());expect(p.slots[0].patch.eraseMask).toBeTruthy();expect(p.slots[0].patch.patchLayers.length).toBe(1);
  const atlas=await page.evaluate(()=>window.__SPRITE_QA__.atlas());expect(atlas.width).toBe(512);expect(atlas.height).toBe(512);expect(atlas.frames.length).toBe(16);await page.getByRole('button',{name:'PREVIEW ATLAS',exact:true}).click();await shot(page,testInfo,'08-atlas-preview-no-overlays');
});
