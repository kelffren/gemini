/* KELO-INDEX
 * area: QA / WORLD
 * keys: ALDEA MAP2 IPHONE WALK COLLISION PORTAL
 * purpose: prueba el mapa authored en el runtime real con joystick sostenido y captura
 */
const {test,expect,devices}=require('@playwright/test');
test.use({userAgent:devices['iPhone 13'].userAgent,viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'});
test('Aldea: mobile walking, water collision, return and real canvas',async({page})=>{
 test.setTimeout(90000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('./?guest=1',{waitUntil:'load'});
 await page.waitForFunction(()=>window.__keloBootReady&&window.KELO_WORLD_ZONES&&typeof localPlayer!=='undefined');
 expect(await page.evaluate(()=>KELO_WORLD_ZONES.enterMap2())).toBe(true);
 await page.waitForFunction(()=>KELO_GENERIC_PROPS.isAssetReady('aldeaFantasy'));
 const state=()=>page.evaluate(()=>({x:localPlayer.x,y:localPlayer.y,zone:KELO_WORLD_ZONES.active}));
 const start=await state();
 const canvas=page.locator('#game-canvas');
 async function joy(dx,dy){await canvas.dispatchEvent('pointerdown',{pointerId:91,pointerType:'touch',isPrimary:true,clientX:80,clientY:640,buttons:1,bubbles:true});await canvas.dispatchEvent('pointermove',{pointerId:91,pointerType:'touch',isPrimary:true,clientX:80+dx,clientY:640+dy,buttons:1,bubbles:true});}
 async function release(){await canvas.dispatchEvent('pointerup',{pointerId:91,pointerType:'touch',isPrimary:true,clientX:80,clientY:640,buttons:0,bubbles:true});}
 await joy(18,0);const samples=[];
 for(let i=0;i<8;i++){await page.waitForTimeout(1000);const t=Date.now();samples.push(await state());expect(Date.now()-t).toBeLessThan(400);}
 await release();expect(samples[7].x-start.x).toBeGreaterThan(80);expect(samples[7].zone).toBe('map2');
 for(let i=1;i<samples.length;i++)expect(samples[i].x).toBeGreaterThan(samples[i-1].x);
 await page.waitForTimeout(500);
 await page.screenshot({path:'test-results/aldea-mobile.png'});
 // Approach the west bank: visible water must block real movement.
 await page.evaluate(()=>KeloPlayerPosition.teleport(KELO_ALDEA_MAP.x+790,610,{source:'qa-water',stopMotion:true}));
 await joy(60,0);await page.waitForTimeout(1200);await release();
 expect((await state()).x).toBeLessThanOrEqual(3233);
 expect((await state()).x).toBeGreaterThan(3210);
 await page.evaluate(()=>{KELO_WORLD_ZONES.enterMap2();KeloPlayerPosition.teleport(2964,760,{source:'qa-overview',stopMotion:true});KeloCamera.setTarget(2996,670,{snap:true,source:'qa-overview'});KeloCamera.setBaseZoom(.8);});
 await page.setViewportSize({width:1440,height:1080});await page.waitForTimeout(1200);
 await page.screenshot({path:'test-results/aldea-overview.png'});
 // Returning exercises the actual proximity hook, not the returnPlaza API.
 await page.evaluate(()=>KeloPlayerPosition.teleport(2516,916,{source:'qa-portal',stopMotion:true}));
 await page.waitForFunction(()=>KELO_WORLD_ZONES.active==='plaza');
 expect(await page.evaluate(()=>KELO_COLLISION.ownerSnapshot('world-zones:map2').count)).toBe(0);
 await page.evaluate(()=>KELO_WORLD_ZONES.enterMap2());
 expect(await page.evaluate(()=>KELO_COLLISION.ownerSnapshot('world-zones:map2').count)).toBeGreaterThan(20);
 expect(errors).toEqual([]);
 console.log('ALDEA_QA',JSON.stringify({start,samples,errors}));
});
