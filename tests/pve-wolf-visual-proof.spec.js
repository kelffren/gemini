const {test,expect}=require('@playwright/test');
test('external library wolf is normalized and visibly placed',async({page})=>{
 await page.setViewportSize({width:1170,height:800});await page.goto('http://127.0.0.1:4173/?pve=greenwild',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>globalThis.__KELO_GREENWILD_LIVE__?.encounter?.snapshot?.().length>=4,null,{timeout:20000});await page.waitForTimeout(1800);
 const p=await page.evaluate(()=>({asset:__KELO_GREENWILD_LIVE__.presentation.spriteBank.beast.asset?.id,image:!!__KELO_GREENWILD_LIVE__.presentation.spriteBank.beast.image,src:__KELO_GREENWILD_LIVE__.presentation.spriteBank.beast.image?.src}));
 expect(p.asset).toMatch(/wolf-pack-32x32$/);expect(p.image).toBeTruthy();expect(p.src).toContain('wolf-pack-32x32-normalized.png');
 await page.locator('#game-canvas').screenshot({path:'test-results/pve-wolf-proof.png'});
});
