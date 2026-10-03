/* KELO-INDEX
 * area: TEST / STUDIO / APPROVAL
 * keys: MOBILE APPROVAL LIBRARY OVERLAP RESIZE COLLAPSE
 * owner: Playwright regression test
 * purpose: real Studio shell, palette and approval owner must keep separate hit regions
 * online: repository RPC is stubbed; this test exercises presentation only
 */
const {test,expect}=require('@playwright/test');
const iphone='Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
test('Approval stays above Library when collapsed, expanded and rotated',async({browser})=>{
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,userAgent:iphone});
  // A same-origin blank fixture avoids unrelated game/auth loops while exercising real UI owners.
  await page.goto(new URL('./__kelo_world_approval_layout_fixture__',process.env.KELO_PAGES||'http://127.0.0.1:4173/').href);
  await page.evaluate(async()=>{
    // Exercise real UI owners independently of gameplay/auth/network latency.
    document.body.innerHTML='';
    const {createStudioLiveShell}=await import('./src/studio/ui/studio-live-shell.mjs');
    const {createStudioAssetPalette}=await import('./src/studio/ui/studio-asset-palette.mjs');
    const {installCreatorApprovalDock}=await import('./src/creators/approval/creator-approval-dock.mjs');
    const {installStudioMobileUiPolish}=await import('./src/studio/ui/studio-mobile-ui-polish.mjs');
    window.shell=createStudioLiveShell({assets:[]});
    installStudioMobileUiPolish({root:window});
    window.palette=createStudioAssetPalette({root:window,getAssets:()=>Array.from({length:30},(_,i)=>({id:'tree-'+i,name:'Árbol '+i,category:'nature_trees_rocks'}))});
    window.approval=await installCreatorApprovalDock({root:window,workspace:'world',session:{shell:window.shell.root},repository:{rpc:async()=>({status:'draft'}),userId:()=> 'test'}});
    window.palette.open();
  });
  const dock=page.locator('.kcad');
  const toggle=dock.locator('.kcad-toggle');
  for(const viewport of [{width:390,height:844},{width:430,height:932},{width:844,height:390},{width:390,height:844}]){
    await page.setViewportSize(viewport);
    for(const expanded of [false,true]){
      if(await toggle.getAttribute('aria-expanded')!==String(expanded))await toggle.click();
      await expect(toggle).toBeVisible();
      await page.evaluate(()=>window.palette.open());
      await expect.poll(async()=>{
        const a=await dock.boundingBox(),b=await page.locator('.ks-asset-palette').boundingBox();
        return a.y+a.height<=b.y;
      }).toBe(true);
      const library=page.locator('[data-asset-palette-library]');
      await library.scrollIntoViewIfNeeded();
      await expect(library).toBeVisible();
      expect(await library.evaluate(el=>{const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));})).toBe(true);
    }
  }
  await page.locator('[data-asset-palette-library]').click();
  await expect(page.locator('.ks-asset-palette')).toBeHidden();
  await page.evaluate(()=>window.approval.destroy());
  await expect(dock).toHaveCount(0);
  expect(await page.locator('#kelo-studio-live').evaluate(el=>el.classList.contains('kcad-reserved'))).toBe(false);
  await page.close();
});
