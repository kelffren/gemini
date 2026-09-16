/* KELO-INDEX
 * area: TEST / STUDIO / MOBILE COMMAND SEARCH
 * owner: Kelo Studio presentation regression
 * purpose: keep large mobile toolsets searchable while delegating every result to the original command
 */
const { test, expect } = require('@playwright/test');

async function installFixture(page){
  await page.goto('./',{waitUntil:'domcontentloaded',timeout:30000});
  await page.setViewportSize({width:390,height:844});
  await page.evaluate(async()=>{
    document.getElementById('kelo-studio-live')?.remove();
    window.__commandSearchHits=Object.create(null);
    const shell=document.createElement('section');
    shell.id='kelo-studio-live';shell.dataset.compact='full';shell.dataset.selectionCount='0';
    shell.innerHTML=`
      <div class="ks-top"><button data-act="play">PLAY</button><button data-act="save">SAVE</button></div>
      <div class="ks-bottom"><div class="ks-deck">
        <div class="ks-deck-head"><div class="ks-active-tool">Selección</div></div>
        <div class="ks-mobile-context-actions"><button class="ks-mobile-more" aria-label="Mostrar herramientas avanzadas">MÁS</button></div>
        <div class="ks-deck-body">
          <section class="ks-deck-section"><div class="ks-edit-primary">
            <button data-mode="select">SELECT</button><button data-mode="move">MOVE</button><button data-act="edit-assets">EDIT</button><button data-act="delete">BORRAR</button>
          </div></section>
          <section class="ks-deck-section"><div class="ks-history-actions">
            <button data-act="undo">UNDO</button><button data-act="redo">REDO</button><button data-act="rotate">ROTAR</button><button data-act="duplicate">DUPLICAR</button>
            <button data-act="scale-down">-</button><button data-act="scale-reset">100%</button><button data-act="scale-up">+</button>
          </div></section>
          <section class="ks-deck-section"><div class="ks-mode-actions">
            <button data-mode="terrain">GROUND</button><button data-mode="path">ROAD</button><button data-mode="collision">COLLISION</button><button data-act="erase">ERASE</button>
          </div></section>
        </div>
      </div></div>`;
    shell.querySelectorAll('[data-act],[data-mode]').forEach(control=>control.addEventListener('click',()=>{
      const key=control.dataset.act||control.dataset.mode;window.__commandSearchHits[key]=(window.__commandSearchHits[key]||0)+1;
    }));
    document.body.append(shell);
    const sheet=await import('./src/studio/ui/studio-mobile-tools-sheet.mjs?v=command-search-sheet-test-1');
    window.__commandSearchSheet=sheet.installStudioMobileToolsSheet({root:window});
    window.__commandSearchSheet.refresh();
    const search=await import('./src/studio/ui/studio-mobile-command-search.mjs?v=command-search-test-1');
    window.__commandSearch=search.installStudioMobileCommandSearch({root:window});
    window.__commandSearch.refresh();
  });
}

test('MÁS exposes a 44px mobile command search without replacing category navigation',async({page})=>{
  await installFixture(page);
  await page.getByRole('button',{name:'Mostrar herramientas avanzadas'}).click();
  const dialog=page.locator('.ks-tools-sheet');
  await expect(dialog).toBeVisible();
  const input=dialog.getByRole('combobox',{name:'Buscar herramienta'});
  await expect(input).toBeVisible();
  expect(await input.evaluate(node=>node.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
  await expect(dialog.getByRole('tab')).toHaveText(['CONSTRUIR','TERRENO','TRANSFORMAR','VISTA']);
});

test('Spanish and English aliases find commands and execute the original editor button',async({page})=>{
  await installFixture(page);
  await page.getByRole('button',{name:'Mostrar herramientas avanzadas'}).click();
  const dialog=page.locator('.ks-tools-sheet'),input=dialog.getByRole('combobox',{name:'Buscar herramienta'});
  await input.fill('girar');
  await expect(dialog.getByRole('option')).toHaveCount(1);
  await expect(dialog.getByRole('option').first()).toContainText('ROTAR');
  await input.press('Enter');
  expect(await page.evaluate(()=>window.__commandSearchHits.rotate||0)).toBe(1);
  await expect(dialog).toBeHidden();

  await page.getByRole('button',{name:'Mostrar herramientas avanzadas'}).click();
  await input.fill('colision');
  await expect(dialog.getByRole('option').first()).toContainText('COLLISION');
  await dialog.getByRole('option').first().click();
  expect(await page.evaluate(()=>window.__commandSearchHits.collision||0)).toBe(1);
});

test('search discovers top-level commands such as guardar and marks destructive results',async({page})=>{
  await installFixture(page);
  await page.getByRole('button',{name:'Mostrar herramientas avanzadas'}).click();
  const dialog=page.locator('.ks-tools-sheet'),input=dialog.getByRole('combobox',{name:'Buscar herramienta'});
  await input.fill('guardar');
  await expect(dialog.getByRole('option').first()).toContainText('SAVE');
  await dialog.getByRole('option').first().click();
  expect(await page.evaluate(()=>window.__commandSearchHits.save||0)).toBe(1);

  await page.getByRole('button',{name:'Mostrar herramientas avanzadas'}).click();
  await input.fill('eliminar');
  const deleteResult=dialog.locator('.ks-command-search-result[data-command-key="act:delete"]');
  await expect(deleteResult).toBeVisible();
  await expect(deleteResult).toHaveAttribute('data-danger','1');
});

test('Escape clears search first and restores normal category tools without closing the sheet',async({page})=>{
  await installFixture(page);
  await page.getByRole('button',{name:'Mostrar herramientas avanzadas'}).click();
  const dialog=page.locator('.ks-tools-sheet'),input=dialog.getByRole('combobox',{name:'Buscar herramienta'});
  await input.fill('road');
  await expect(dialog).toHaveAttribute('data-command-search-active','1');
  await expect(dialog.getByRole('tab')).toBeHidden();
  await input.press('Escape');
  await expect(input).toHaveValue('');
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute('data-command-search-active','0');
  await expect(dialog.getByRole('tab')).toBeVisible();
});
