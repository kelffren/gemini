const {test,expect}=require('@playwright/test');
const QA=process.env.SPRITE_QA_URL||'http://127.0.0.1:4173/tests/fixtures/sprite-tactile-editor.html';
async function ready(page){await page.goto(QA);await page.waitForFunction(()=>window.__SPRITE_QA__?.ready);await page.evaluate(()=>window.__SPRITE_QA__.reset());}
async function shot(page,testInfo,name){await page.screenshot({path:testInfo.outputPath(`${name}.png`),fullPage:true});}

test('4x4 project persists individual frames and isolated replacement',async({page},testInfo)=>{
  await ready(page);await page.evaluate(()=>window.__SPRITE_QA__.seed([0,1,2,3]));await page.evaluate(()=>window.__SPRITE_QA__.open());
  await expect(page.locator('.kfb-progress')).toContainText('4/16 FRAMES');await expect(page.locator('.kfb-slot')).toHaveCount(16);await shot(page,testInfo,'01-grid-partial-4-of-16');
  const before=await page.evaluate(async()=>{const p=await window.__SPRITE_QA__.project();return p.slots.map(s=>s.sourceKey);});
  await page.evaluate(()=>window.__SPRITE_QA__.close());await page.evaluate(()=>window.__SPRITE_QA__.open());await expect(page.locator('.kfb-progress')).toContainText('4/16 FRAMES');
  await page.evaluate(()=>window.__SPRITE_QA__.close());await page.evaluate(()=>window.__SPRITE_QA__.seed([2]));const after=await page.evaluate(async()=>{const p=await window.__SPRITE_QA__.project();return p.slots.map(s=>s.sourceKey);});
  expect(after[0]).toBe(before[0]);expect(after[1]).toBe(before[1]);expect(after[2]).not.toBe(before[2]);expect(after[3]).toBe(before[3]);
  await page.evaluate(()=>window.__SPRITE_QA__.open());await expect(page.locator('.kfb-progress')).toContainText('4/16 FRAMES');
});

test('mobile frame editor ghosts, auto-matches, masks, patches and exports clean atlas',async({page},testInfo)=>{
  await ready(page);await page.evaluate(()=>window.__SPRITE_QA__.seed([0,1,2,3,12,13,14,15],{largeRow:true,garbageIndex:0}));await page.evaluate(()=>window.__SPRITE_QA__.open());
  await page.locator('.kfb-slot').nth(0).click();await expect(page.locator('.kfe')).toBeVisible();await shot(page,testInfo,'02-editor-frame');
  await page.getByRole('button',{name:/GHOST/}).click();await expect(page.getByRole('button',{name:/GHOST/})).toHaveClass(/on/);await shot(page,testInfo,'03-editor-ghost');
  await page.getByRole('button',{name:'+'}).click();await page.getByRole('button',{name:'+'}).click();await page.getByRole('button',{name:'GUARDAR'}).click();
  let p=await page.evaluate(()=>window.__SPRITE_QA__.project());expect(p.slots[0].patch.scale).toBeGreaterThan(1);

  await page.locator('.kfb-slot').nth(12).click();page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'AUTO MATCH'}).click();await page.waitForTimeout(120);await shot(page,testInfo,'04-back-auto-match');await page.getByRole('button',{name:'GUARDAR'}).click();p=await page.evaluate(()=>window.__SPRITE_QA__.project());expect(p.slots[12].patch.scale).toBeLessThan(1.01);

  await page.locator('.kfb-slot').nth(0).click();await page.getByRole('button',{name:'✨ MAGIC'}).click();const canvas=page.locator('.kfe-canvas'),box=await canvas.boundingBox();expect(box).toBeTruthy();const x=box.x+box.width*(430/620),y=box.y+box.height*(126/620);await page.mouse.click(x,y);await page.waitForTimeout(180);await page.getByRole('button',{name:'UNDO'}).click();await page.getByRole('button',{name:'REDO'}).click();await shot(page,testInfo,'05-magic-eraser');
  await page.getByRole('button',{name:'+ PATCH'}).click();await expect(page.locator('.kfe-pop')).toBeVisible();const sourceCanvas=page.locator('.kfe-pop canvas'),sb=await sourceCanvas.boundingBox();await page.mouse.move(sb.x+sb.width*.35,sb.y+sb.height*.12);await page.mouse.down();await page.mouse.move(sb.x+sb.width*.65,sb.y+sb.height*.32,{steps:4});await page.mouse.up();await page.getByRole('button',{name:'AÑADIR PATCH'}).click();await shot(page,testInfo,'06-patch-layer');await page.getByRole('button',{name:'GUARDAR'}).click();
  p=await page.evaluate(()=>window.__SPRITE_QA__.project());expect(p.slots[0].patch.eraseMask).toBeTruthy();expect(p.slots[0].patch.patchLayers.length).toBe(1);
  const atlas=await page.evaluate(()=>window.__SPRITE_QA__.atlas());expect(atlas.width).toBe(512);expect(atlas.height).toBe(512);expect(atlas.frames.length).toBe(16);await page.getByRole('button',{name:'PREVIEW ATLAS'}).click();await shot(page,testInfo,'07-atlas-preview-no-overlays');
});
