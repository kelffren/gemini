/* KELO-INDEX
 * area: TEST / STUDIO / MOBILE RADIAL CONTEXT
 * owner: Kelo Studio presentation regression
 * purpose: keep long-press shortcuts contextual, recoverable and isolated from non-select editor modes
 */
const { test, expect } = require('@playwright/test');

async function installFixture(page,{selectionCount=0}={}){
  await page.goto('./',{waitUntil:'domcontentloaded',timeout:30000});
  await page.setViewportSize({width:390,height:844});
  await page.evaluate(async count=>{
    document.getElementById('kelo-studio-live')?.remove();
    document.getElementById('radial-test-canvas')?.remove();
    window.__radialHits=Object.create(null);
    const canvas=document.createElement('canvas');canvas.id='radial-test-canvas';canvas.width=390;canvas.height=844;
    canvas.style.cssText='position:fixed;inset:0;width:100vw;height:100vh';document.body.prepend(canvas);
    const shell=document.createElement('section');shell.id='kelo-studio-live';shell.dataset.selectionCount=String(count);
    shell.innerHTML=`
      <div class="ks-deck">
        <button class="on" data-mode="select">SELECT</button>
        <button data-mode="terrain">GROUND</button><button data-mode="path">ROAD</button>
        <button data-act="edit-assets">EDIT</button><button data-act="rotate">ROTAR</button>
        <button data-act="duplicate">DUPLICAR</button><button data-act="delete">BORRAR</button>
        <button data-act="undo">UNDO</button>
      </div>
      <button class="ks-mobile-more" aria-label="Mostrar herramientas avanzadas">MÁS</button>`;
    shell.querySelectorAll('[data-act],[data-mode]').forEach(control=>control.addEventListener('click',()=>{
      const key=control.dataset.act||control.dataset.mode;window.__radialHits[key]=(window.__radialHits[key]||0)+1;
    }));
    shell.querySelector('.ks-mobile-more').addEventListener('click',()=>{window.__radialHits.more=(window.__radialHits.more||0)+1;});
    document.body.append(shell);
    const mod=await import('./src/studio/ui/studio-mobile-radial-context.mjs?v=radial-context-test-1');
    window.__radialContext=mod.installStudioMobileRadialContext({root:window});
    window.__radialContext.refresh();
  },selectionCount);
}

async function longPressCanvas(page,{x=190,y=360,pointerId=51}={}){
  const canvas=page.locator('#radial-test-canvas');
  await canvas.dispatchEvent('pointerdown',{pointerId,pointerType:'touch',isPrimary:true,button:0,clientX:x,clientY:y});
  await page.waitForTimeout(560);
}

test('long press in SELECT mode opens canvas shortcuts with large touch targets',async({page})=>{
  await installFixture(page);
  await longPressCanvas(page);
  const layer=page.locator('.ks-radial-layer');
  await expect(layer).toHaveAttribute('data-open','1');
  const actions=layer.locator('[data-radial-action]');
  await expect(actions).toHaveText(['GROUND','ROAD','EDIT','MÁS']);
  const sizes=await actions.evaluateAll(nodes=>nodes.map(node=>({w:node.getBoundingClientRect().width,h:node.getBoundingClientRect().height})));
  expect(sizes.every(({w,h})=>w>=44&&h>=44)).toBe(true);
});

test('selection context exposes transform actions and delegates to original command',async({page})=>{
  await installFixture(page,{selectionCount:2});
  await longPressCanvas(page);
  const layer=page.locator('.ks-radial-layer');
  await expect(layer.locator('[data-radial-action]')).toHaveText(['ROTAR','DUPLICAR','MÁS','BORRAR']);
  await expect(layer.locator('.ks-radial-caption')).toHaveText('2 OBJETOS · MENÚ RÁPIDO');
  const duplicate=layer.getByRole('menuitem',{name:'DUPLICAR'});
  await duplicate.click();
  expect(await page.evaluate(()=>window.__radialHits.duplicate||0)).toBe(1);
  await expect(layer).toHaveAttribute('data-open','0');
});

test('MÁS is only a shortcut to the existing mobile tools entry point',async({page})=>{
  await installFixture(page,{selectionCount:1});
  await longPressCanvas(page);
  await page.locator('.ks-radial-layer').getByRole('menuitem',{name:'MÁS'}).click();
  expect(await page.evaluate(()=>window.__radialHits.more||0)).toBe(1);
});

test('moving beyond tolerance cancels long press before the radial menu appears',async({page})=>{
  await installFixture(page);
  const canvas=page.locator('#radial-test-canvas');
  await canvas.dispatchEvent('pointerdown',{pointerId:71,pointerType:'touch',isPrimary:true,button:0,clientX:120,clientY:320});
  await canvas.dispatchEvent('pointermove',{pointerId:71,pointerType:'touch',isPrimary:true,buttons:1,clientX:150,clientY:350});
  await page.waitForTimeout(560);
  await expect(page.locator('.ks-radial-layer')).toHaveAttribute('data-open','0');
});

test('terrain and other non-select modes never activate long-press radial shortcuts',async({page})=>{
  await installFixture(page);
  await page.locator('.ks-deck [data-mode="select"]').evaluate(node=>node.classList.remove('on'));
  await page.locator('.ks-deck [data-mode="terrain"]').evaluate(node=>node.classList.add('on'));
  await longPressCanvas(page);
  await expect(page.locator('.ks-radial-layer')).toHaveAttribute('data-open','0');
});

test('Escape closes the radial menu without executing a command',async({page})=>{
  await installFixture(page,{selectionCount:1});
  await longPressCanvas(page);
  const layer=page.locator('.ks-radial-layer');
  await expect(layer).toHaveAttribute('data-open','1');
  await page.keyboard.press('Escape');
  await expect(layer).toHaveAttribute('data-open','0');
  expect(await page.evaluate(()=>Object.values(window.__radialHits).reduce((a,b)=>a+b,0))).toBe(0);
});
