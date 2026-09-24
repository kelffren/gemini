/* KELO-INDEX
 * area: TEST / STUDIO / MOBILE ACTION FEEDBACK
 * owner: Kelo Studio presentation regression
 * purpose: keep destructive mobile edits recoverable without modal confirmation
 */
const { test, expect } = require('@playwright/test');

async function installFixture(page,{selectionCount=1}={}){
  await page.goto('./',{waitUntil:'domcontentloaded',timeout:30000});
  await page.setViewportSize({width:390,height:844});
  await page.evaluate(async count=>{
    document.getElementById('kelo-studio-live')?.remove();
    document.getElementById('kelo-luxe')?.remove();
    window.__feedbackHits=Object.create(null);
    const shell=document.createElement('section');
    shell.id='kelo-studio-live';
    shell.dataset.selectionCount=String(count);
    shell.innerHTML=`
      <div class="ks-top"><button data-act="save">SAVE</button></div>
      <div class="ks-bottom">
        <div class="ks-deck">
          <button data-act="delete">BORRAR</button>
          <button data-act="undo">UNDO</button>
          <button data-act="redo">REDO</button>
          <button data-act="duplicate">DUPLICAR</button>
        </div>
      </div>`;
    shell.querySelectorAll('[data-act]').forEach(button=>button.addEventListener('click',()=>{
      const key=button.dataset.act;
      window.__feedbackHits[key]=(window.__feedbackHits[key]||0)+1;
    }));
    document.body.append(shell);
    const mod=await import('./src/studio/ui/studio-mobile-action-feedback.mjs?v=feedback-test-1');
    window.__studioFeedback=mod.installStudioMobileActionFeedback({root:window});
    window.__studioFeedback.refresh();
  },selectionCount);
}

test('delete shows a nonblocking undo affordance and undo delegates to the real command',async({page})=>{
  await installFixture(page);
  await page.locator('[data-act="delete"]').click();

  const feedback=page.locator('.ks-action-feedback');
  await expect(feedback).toBeVisible();
  await expect(feedback.locator('strong')).toHaveText('Objeto eliminado');
  await expect(feedback.getByRole('button',{name:'DESHACER'})).toBeVisible();
  await expect(feedback).toHaveAttribute('role','status');
  await expect(feedback).toHaveAttribute('aria-atomic','true');

  await feedback.getByRole('button',{name:'DESHACER'}).click();
  expect(await page.evaluate(()=>({
    deleteHits:window.__feedbackHits.delete||0,
    undoHits:window.__feedbackHits.undo||0,
  }))).toEqual({deleteHits:1,undoHits:1});
  await expect(feedback.locator('strong')).toHaveText('Objeto restaurado');
  await expect(feedback.getByRole('button',{name:'DESHACER'})).toBeHidden();
});

test('multi-selection delete explains how many objects can be recovered',async({page})=>{
  await installFixture(page,{selectionCount:3});
  await page.locator('[data-act="delete"]').click();
  const feedback=page.locator('.ks-action-feedback');
  await expect(feedback.locator('strong')).toHaveText('3 objetos eliminados');
  await feedback.getByRole('button',{name:'DESHACER'}).click();
  await expect(feedback.locator('strong')).toHaveText('3 objetos restaurados');
});

test('save duplicate undo and redo use passive feedback without stealing focus',async({page})=>{
  await installFixture(page);
  const save=page.locator('[data-act="save"]');
  await save.focus();
  await save.click();
  const feedback=page.locator('.ks-action-feedback');
  await expect(feedback.locator('strong')).toHaveText('Cambios guardados');
  await expect(save).toBeFocused();

  await page.locator('[data-act="duplicate"]').click();
  await expect(feedback.locator('strong')).toHaveText('Objeto duplicado');
  await expect(feedback.getByRole('button',{name:'DESHACER'})).toBeHidden();

  await page.locator('[data-act="undo"]').click();
  await expect(feedback.locator('strong')).toHaveText('Cambio deshecho');
  await page.locator('[data-act="redo"]').click();
  await expect(feedback.locator('strong')).toHaveText('Cambio rehecho');
});
