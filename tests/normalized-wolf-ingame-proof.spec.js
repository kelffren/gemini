const {test,expect}=require('@playwright/test');
test('normalized external wolf renders in live game',async({page})=>{
 await page.setViewportSize({width:1170,height:800});
 await page.goto('http://127.0.0.1:4173/?pve=greenwild',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>globalThis.__KELO_GREENWILD_LIVE__?.encounter?.snapshot?.().length>=4,null,{timeout:20000});
 await page.waitForTimeout(2000);
 const proof=await page.evaluate(()=>{const b=globalThis.__KELO_GREENWILD_LIVE__?.presentation?.spriteBank?.beast;return {src:b?.image?.src||'',loaded:!!b?.image?.complete,w:b?.image?.naturalWidth||0,h:b?.image?.naturalHeight||0}});
 expect(proof.src).toContain('wolf-pack-32x32-normalized.png');expect(proof.loaded).toBeTruthy();expect(proof.w).toBe(32);expect(proof.h).toBe(32);
 await page.locator('#game-canvas').screenshot({path:'test-results/normalized-wolf-ingame.png'});
});
