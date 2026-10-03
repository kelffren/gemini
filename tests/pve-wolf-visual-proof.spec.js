const {test,expect}=require('@playwright/test');
test('external library wolf is normalized and visibly placed',async({page})=>{
 await page.setViewportSize({width:1170,height:800});await page.goto('http://127.0.0.1:4173/?pve=greenwild',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>globalThis.__KELO_GREENWILD_LIVE__?.encounter?.snapshot?.().length>=4,null,{timeout:20000});await page.waitForTimeout(1800);
 const p=await page.evaluate(()=>{const b=__KELO_GREENWILD_LIVE__.presentation.spriteBank.beast;return{asset:b.asset?.id,image:!!b.image,src:b.image?.src,width:b.image?.naturalWidth,height:b.image?.naturalHeight,frameWidth:b.frameWidth,frameHeight:b.frameHeight,animations:b.animations}});
 expect(p.asset).toMatch(/lpc-wolf-animation-brown$/);expect(p.image).toBeTruthy();expect(p.src).toContain('wolfsheet3.png');expect(p.width).toBe(640);expect(p.height).toBe(384);expect(p.frameWidth).toBe(64);expect(p.frameHeight).toBe(64);expect(p.animations?.walk?.startColumn).toBe(5);
 await page.locator('#game-canvas').screenshot({path:'test-results/pve-wolf-proof.png'});
});
