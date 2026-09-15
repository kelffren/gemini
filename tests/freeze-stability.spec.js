/* KELO-INDEX
 * area: QA / RUNTIME
 * owner: stability regression tests
 * keys: FREEZE MOVE WAIT TEN SECONDS RESUME CRASH NETWORK MOBILE
 * purpose: valida movimiento sostenido, reposo de 10s y reanudación con errores fatales
 * online: prueba presentación/input local; no afirma autoridad multijugador
 */
const {test,expect}=require('@playwright/test');
const expectedOwners={
 chat:['KeloChatUI','KeloChatIntegrationBridge'],
 abilities:['KeloAbilities','KeloStones','KeloEffectEngine'],
 mounts:['KeloMounts','KeloMountPanel','KeloMountAbilityChannel','KeloStats','KeloMountEquipmentCatalog'],
 bag:['KeloBackpack','KeloBackpackUI','KeloEquipment','KeloContainers'],
 market:['KeloMarketEscrow','KeloMarketUI','KeloContainers'],
 titles:['KeloTitles','KeloTitleCatalog','KeloPlayerStats'],
 appearance:['KeloCharacterCustomization','KeloCharacterCustomizer','KeloCharacterSlotSchema','KeloCharacterVisualStack'],
 properties:['KELO_PROPERTY_SYSTEM','KELO_HOUSE_UI','KELO_HOUSES','KELO_INSTANCES','KELO_FOREST_PLAZA_CATALOG_AUDIT'],
 social:['KeloNobility','KeloSelfInteractionUI'],
 pvp:['KeloPvPWorld','KeloAbilities','KeloCombatEngine']
};
const panels={
 abilities:['#kelo-builder','#kelo-close-stones'],
 bag:['#kelo-bag','.kb-close'],
 mounts:['#kelo-mount-panel','button'],
 market:['#kelo-market-v1','button'],
 appearance:['#kelo-character-customizer','.kc-close'],
 properties:['#kelo-house-panel','.hi-close'],
 social:['#kelo-nobility','[data-nob-close]']
};

async function exercisePanel(page,feature,errors){
 const config=panels[feature];if(!config)return;
 try{
  await page.locator('#kw-quick-actions-toggle').click();
  await page.locator('#lx-side-menu').click();
  await page.locator('[data-tool="'+(feature==='social'?'nobility':feature)+'"]').click();
  const panel=page.locator(config[0]);await expect(panel).toBeVisible({timeout:15000});
  if(feature==='bag')await panel.locator('.kb-sort').click();
  await panel.locator(config[1]).first().click();
  await expect(panel).toBeHidden();
 }catch(error){errors.push('PANEL_WORKFLOW_FAILED '+feature+' '+String(error));}
}

async function walk(page,milliseconds,label,testInfo){
 const canvas=page.locator('#game-canvas');const box=await canvas.boundingBox();
 const sx=box.x+box.width*.2,sy=box.y+box.height*.7;
 const pointer=async(type,x)=>page.evaluate(({type,x,y})=>{
  document.getElementById('game-canvas').dispatchEvent(new PointerEvent(type,{pointerId:9,pointerType:'touch',isPrimary:true,clientX:x,clientY:y,buttons:type==='pointerup'?0:1,pressure:type==='pointerup'?0:.5,bubbles:true}));
 },{type,x,y:sy});
 let previous=await page.evaluate(()=>({x:localPlayer.x,y:localPlayer.y}));
 let distance=0;const durations=[];const start=Date.now();
 await pointer('pointerdown',sx);
 try{
  while(Date.now()-start<milliseconds){
   // Reverse along the same path to avoid mistaking a world boundary for freeze.
   await pointer('pointermove',sx+(Math.floor((Date.now()-start)/2000)%2?-80:80));
   await page.waitForTimeout(100);
   const t=Date.now();
   const current=await Promise.race([page.evaluate(()=>({x:localPlayer.x,y:localPlayer.y})),new Promise((_,reject)=>setTimeout(()=>reject(Error('FREEZE: evaluation exceeded 2 seconds')),2000))]);
   durations.push(Date.now()-t);distance+=Math.hypot(current.x-previous.x,current.y-previous.y);previous=current;
  }
 }finally{await pointer('pointerup',sx);}
 await testInfo.attach(label,{body:JSON.stringify({distance,durations}),contentType:'application/json'});
 expect(distance,label+' must move').toBeGreaterThan(40);
 expect(Math.max(...durations),label+' must remain responsive').toBeLessThanOrEqual(400);
}

for(const feature of ['boot','chat','chat-landscape','zoom','mounts','bag','market','titles','appearance','properties','social','abilities','pvp']){
 test(feature+': move 8s, wait 10s, resume 4s',async({page},testInfo)=>{
  const errors=[];
  page.on('crash',()=>errors.push('PAGE_CRASH'));
  page.on('pageerror',e=>errors.push(e.stack||String(e)));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  page.on('requestfailed',r=>errors.push('REQUEST_FAILED '+r.url()+' '+r.failure()?.errorText));
  page.on('response',r=>{if(r.status()>=400)errors.push('HTTP '+r.status()+' '+r.url());});
  await page.goto('/?guest=1',{waitUntil:'load'});
  await expect.poll(()=>page.evaluate(()=>typeof localPlayer!=='undefined'&&!!localPlayer&&!!window.KELO_MODULE_LOADER)).toBe(true);
  if(feature==='zoom')await page.evaluate(()=>KeloCamera.setBaseZoom(.7));
  if(feature==='chat-landscape')await page.setViewportSize({width:844,height:390});
  if(feature!=='boot'&&feature!=='zoom'&&feature!=='chat-landscape'&&!panels[feature]&&feature!=='pvp')await page.evaluate(name=>window.KELO_MODULE_LOADER.ensure(name),feature);
  await exercisePanel(page,feature,errors);
  if(feature==='chat'||feature==='chat-landscape'){
   const tab=page.locator('#lx-chat-tab'),drawer=page.locator('#lx-chat-drawer');
   await expect(tab).toBeVisible();
   await tab.click();
   await expect(drawer).toHaveAttribute('aria-expanded','true');
   await expect.poll(()=>page.evaluate(()=>KeloInputLocks.isLocked())).toBe(true);
   await page.locator('#lx-in').click();
   await expect(page.locator('#kc-keyboard')).toBeVisible();
   for(const key of ['h','o','l','a'])await page.locator('#kc-keyboard [data-key="'+key+'"]').click();
   await page.locator('#kc-keyboard [data-key="espacio"]').click();
   await page.locator('#kc-keyboard [data-key="⌫"]').click();
   await expect(page.locator('#lx-in')).toHaveValue('hola');
   await page.locator('.kc-native-toggle').click();
   await page.locator('#lx-in').fill('');
   await tab.click();
   await expect(drawer).toHaveAttribute('aria-expanded','false');
   await expect.poll(()=>page.evaluate(()=>KeloInputLocks.isLocked())).toBe(false);
   await page.locator('#kw-quick-actions-toggle').click();
   await page.locator('#lx-side-menu').click();
   await page.locator('[data-tool="chat"]').click();
   await expect(drawer).toHaveAttribute('aria-expanded','true');
   await tab.click();
   await expect.poll(()=>page.evaluate(()=>KeloInputLocks.isLocked())).toBe(false);
  }
  if(feature==='pvp'){
   await page.locator('#kw-quick-actions-toggle').click();
   await page.locator('#lx-side-pvp').click();
   await expect.poll(()=>page.evaluate(()=>window.KeloPvPWorld?.state.mode),{timeout:15000}).toBe('pvp');
  }
  const missingOwners=await page.evaluate(names=>names.filter(name=>!window[name]),expectedOwners[feature]||[]);
  await walk(page,8000,'initial movement',testInfo);
  await page.waitForTimeout(2000);
  const cacheSnapshot=()=>page.evaluate(()=>({worldBuilds:KELO_WORLD_AUDIT.chunkBuildCount,worldEvictions:KELO_WORLD_AUDIT.chunkEvictionCount,surfaceBuilds:KELO_SURFACE_GROUND_AUDIT.chunkBuildCount,surfaceEvictions:KELO_SURFACE_GROUND_AUDIT.chunkEvictionCount}));
  const idleBefore=await cacheSnapshot();
  await page.waitForTimeout(8000);
  const idleAfter=await cacheSnapshot();
  await testInfo.attach('idle cache stability',{body:JSON.stringify({before:idleBefore,after:idleAfter}),contentType:'application/json'});
  await walk(page,4000,'movement after 10 second rest',testInfo);
  if(feature!=='pvp')expect(idleAfter,'stationary camera must not rebuild/evict terrain continuously').toEqual(idleBefore);
  const colors=await page.evaluate(()=>{const c=document.getElementById('game-canvas'),g=c.getContext('2d'),data=g.getImageData(0,0,c.width,c.height).data,set=new Set();for(let i=0;i<data.length;i+=400)set.add([data[i],data[i+1],data[i+2]].join(','));return set.size;});
  expect(colors,'game canvas must not be blank/black').toBeGreaterThan(4);
  await testInfo.attach('runtime errors',{body:JSON.stringify(errors),contentType:'application/json'});
  expect(errors,'crashes, page errors and failed loads must fail the test').toEqual([]);
  expect(missingOwners,'loaded feature must expose its actual dependencies and owner').toEqual([]);
  if(feature==='pvp'){
   await page.locator('#kelo-pvp-exit').click();
   await expect.poll(()=>page.evaluate(()=>window.KeloPvPWorld.state.mode)).toBe('social');
  }
 });
}
