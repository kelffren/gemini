const {test,expect}=require('@playwright/test');
const {spawn}=require('node:child_process');
let server;
test.beforeAll(async()=>{server=spawn('python3',['-m','http.server','4173','--bind','127.0.0.1'],{stdio:'ignore'});await new Promise(r=>setTimeout(r,1200));});
test.afterAll(()=>server?.kill());
test('live Greenwild renders external wolf pack',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.setViewportSize({width:1170,height:800});
  await page.goto('http://127.0.0.1:4173/?pve=greenwild',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>globalThis.__KELO_GREENWILD_LIVE__?.encounter?.snapshot?.().length>=4,null,{timeout:20000});
  await page.waitForTimeout(2500);
  const proof=await page.evaluate(()=>({count:globalThis.__KELO_GREENWILD_LIVE__.encounter.snapshot().length,asset:globalThis.__KELO_GREENWILD_LIVE__.presentation.spriteBank.beast.asset?.id||null,image:!!globalThis.__KELO_GREENWILD_LIVE__.presentation.spriteBank.beast.image}));
  await page.locator('#game-canvas').screenshot({path:'test-results/pve-wolf-proof.png'});
  expect(proof.count).toBeGreaterThanOrEqual(4);
  expect(proof.asset).toMatch(/wolf-pack-32x32$/);
  expect(proof.image).toBeTruthy();
  expect(errors.filter(x=>/KeloPvE|greenwild/i.test(x))).toEqual([]);
});
