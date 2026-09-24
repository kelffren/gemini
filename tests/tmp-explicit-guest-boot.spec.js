const { test, expect, devices } = require('@playwright/test');
const iphone=devices['iPhone 13'];
test.use({userAgent:iphone.userAgent,viewport:{width:390,height:844},screen:{width:390,height:844},deviceScaleFactor:iphone.deviceScaleFactor,isMobile:true,hasTouch:true});

test('explicit guest boot exposes KeloGuestPlay without loading heavy auth',async({page})=>{
  test.setTimeout(90000);
  await page.goto('./?guest=1&guestBootAudit=1',{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForFunction(()=>!!window.KeloGuestPlay?.active?.(),null,{timeout:15000});
  const state=await page.evaluate(()=>({
    guest:window.KeloGuestPlay?.state?.()||null,
    active:!!window.KeloGuestPlay?.active?.(),
    dataset:document.documentElement.dataset.keloGuestPlay||null,
    authOff:document.documentElement.dataset.keloAuthGate||null,
    guestScript:[...document.scripts].find(s=>s.dataset.keloGuestPlayBoot==='1')?.src||null,
    onlineAuth:!!window.KeloOnlineAuth
  }));
  console.log('[GUEST_BOOT_AUDIT]',JSON.stringify(state));
  expect(state.active).toBe(true);
  expect(state.dataset).toBe('1');
  expect(state.authOff).toBe('off');
  expect(state.guestScript).toContain('guest-play-bypass.js');
});