import {chromium} from 'playwright';
import fs from 'node:fs';

const BASE=(process.env.AUDIT_URL||'http://127.0.0.1:8000/').replace(/\?+$/,'');
const executablePath=process.env.CHROME_BIN||undefined;
const OUT='test-results/world-surgery-asset-proof';
fs.mkdirSync(OUT,{recursive:true});
const browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{})});
const context=await browser.newContext({viewport:{width:390,height:844},screen:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,serviceWorkers:'block',userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'});
const page=await context.newPage(),pageErrors=[],consoleErrors=[];
page.on('pageerror',e=>pageErrors.push(String(e?.stack||e?.message||e)));
page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});
const report={classification:'MOBILE EMULATION',steps:{}};
const fail=m=>{throw new Error(m);};
const shot=n=>page.screenshot({path:`${OUT}/${n}.png`,fullPage:true,timeout:10000});
const studio=()=>page.locator('#kelo-studio-live');
const entityCount=()=>page.evaluate(()=>Number(document.getElementById('kelo-studio-live')?.dataset?.keloEntityCount||0));

async function openCreators(){
  await page.evaluate(async()=>{const {openCreatorHub}=await import('./src/creators/ui/creator-hub.mjs');await openCreatorHub({root:window});});
  await page.waitForSelector('#kelo-creators-hub',{state:'visible',timeout:20000});
  await page.waitForFunction(()=>!!window.KELO_ADMIN_KEYS?.can?.('world.edit'),{timeout:15000});
}
async function openWorld(){
  await page.locator('#kelo-creators-hub [data-workspace="world"]').first().tap();
  await page.waitForFunction(()=>{const r=document.getElementById('kelo-studio-live');return !!r?.isConnected&&r.dataset.keloWorldLoading!=='1'&&r.dataset.keloStudioInteractive==='1';},{timeout:50000});
}
function knownBaseError(row){return /closeSocialModal[\s\S]*checkSocialTouch/.test(String(row||''));}

try{
  await page.goto(`${BASE}?guest=1&mapEditor=1&asset-proof=${Date.now()}`,{waitUntil:'domcontentloaded',timeout:30000});
  await openCreators();
  await page.waitForFunction(()=>!!window.KELO_WORLD_SURGERY?.applyPreset,{timeout:15000});
  await page.evaluate(()=>window.KELO_WORLD_SURGERY.applyPreset('NO_PAINT_COPIES'));
  await openWorld();

  await page.waitForFunction(()=>Number(document.getElementById('kelo-studio-live')?.dataset?.keloCatalogCount||0)>0,{timeout:20000});
  const catalog=await page.evaluate(()=>{
    const rows=window.KELO_PROPERTY_CATALOG?.list?.()||[];
    const tree=rows.find(a=>Array.isArray(a?.parts)&&a.parts.length&&/tree|arbol|árbol|oak|pine|willow|birch|roble|pino|flor/i.test(`${a?.id||''} ${a?.label||''} ${a?.category||''}`));
    return {count:rows.length,tree:tree?{id:String(tree.id),label:String(tree.label||tree.id),parts:tree.parts.length}:null};
  });
  report.steps.catalog=catalog;
  if(catalog.count<=4)fail(`CATALOG_STILL_PARTIAL:${catalog.count}`);
  if(!catalog.tree)fail(`REAL_TREE_NOT_FOUND:${JSON.stringify(catalog)}`);

  const edit=studio().locator('[data-act="edit-assets"]:visible').first();
  await edit.waitFor({state:'visible',timeout:10000});await edit.tap();
  await page.waitForSelector('#kelo-studio-live [data-pane="assets"] [data-asset]',{state:'visible',timeout:15000});

  const discovered=new Set();
  const scroller=studio().locator('[data-pane="assets"] .ks-assets').first();
  for(let i=0;i<8;i++){
    const ids=await page.evaluate(()=>[...document.querySelectorAll('#kelo-studio-live [data-pane="assets"] [data-asset]')].map(el=>String(el.dataset.asset||'')).filter(Boolean));
    ids.forEach(id=>discovered.add(id));
    await scroller.evaluate((el,i)=>{el.scrollTop=Math.min(el.scrollHeight,Math.round((i+1)*el.clientHeight*.8));},i).catch(()=>{});
    await page.waitForTimeout(120);
  }
  report.steps.catalog.uiDiscovered=[...discovered];
  if(discovered.size<=4)fail(`ASSET_BROWSER_STILL_TRUNCATED:${discovered.size}`);

  const search=studio().locator('[data-pane="assets"] .ks-search').first();
  if(await search.count())await search.fill(catalog.tree.id);
  const row=studio().locator(`[data-pane="assets"] [data-asset="${catalog.tree.id.replaceAll('"','\\"')}"]:visible`).first();
  await row.waitFor({state:'visible',timeout:15000});
  await page.waitForFunction(id=>document.querySelector(`#kelo-studio-live [data-pane="assets"] [data-asset="${CSS.escape(id)}"] canvas`)?.dataset?.keloPreviewState==='real',catalog.tree.id,{timeout:15000});
  const thumb=await row.locator('canvas').evaluate(c=>({state:c.dataset.keloPreviewState||'',width:c.width,height:c.height}));
  report.steps.thumbnail=thumb;if(thumb.state!=='real')fail(`THUMBNAIL_NOT_REAL:${JSON.stringify(thumb)}`);
  await shot('01-real-assets-browser');

  await row.tap();
  await page.waitForFunction(id=>document.querySelector('canvas[data-kelo-placement-ghost="1"]')?.dataset?.keloGhostAsset===id,catalog.tree.id,{timeout:10000});
  await page.waitForFunction(()=>document.querySelector('canvas[data-kelo-placement-ghost="1"]')?.dataset?.keloGhostState==='real',{timeout:15000});
  const ghost=await page.evaluate(()=>{const c=document.querySelector('canvas[data-kelo-placement-ghost="1"]');let alpha=0;try{const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;for(let i=3;i<d.length;i+=4)if(d[i]>12)alpha++;}catch{}return{state:c?.dataset?.keloGhostState||'',asset:c?.dataset?.keloGhostAsset||'',alpha};});
  report.steps.ghost=ghost;if(ghost.state!=='real'||ghost.alpha<20)fail(`GHOST_NOT_REAL:${JSON.stringify(ghost)}`);
  await shot('02-real-tree-ghost');

  const before=await entityCount();
  const place=page.getByRole('button',{name:/COLOCAR AQUÍ/i});await place.waitFor({state:'visible',timeout:10000});await place.tap();
  await page.waitForFunction(n=>Number(document.getElementById('kelo-studio-live')?.dataset?.keloEntityCount||0)>n,before,{timeout:15000});
  const after=await entityCount();report.steps.placement={before,after};if(after<=before)fail(`PLACEMENT_NO_INCREMENT:${before}->${after}`);
  await shot('03-tree-placed');

  await studio().locator('[data-mode="select"]:visible').first().tap();
  const game=page.locator('#game-canvas'),box=await game.boundingBox();if(!box)fail('NO_GAME_CANVAS');
  await game.tap({position:{x:Math.round(box.width/2),y:Math.round(box.height/2)}});
  await page.waitForFunction(()=>Number(document.getElementById('kelo-studio-live')?.dataset?.selectionCount||0)>0,{timeout:8000});
  const beforeScale=await studio().locator('.ks-scale-value').textContent().catch(()=>null);
  const scaleUp=studio().locator('[data-act="scale-up"]:visible').first();await scaleUp.waitFor({state:'visible',timeout:8000});await scaleUp.tap();
  await page.waitForFunction(prev=>{const v=document.querySelector('#kelo-studio-live .ks-scale-value')?.textContent||'';return !!v&&v!==prev;},beforeScale,{timeout:8000});
  const afterScale=await studio().locator('.ks-scale-value').textContent();report.steps.scale={before:beforeScale,after:afterScale};
  await shot('04-tree-scaled');

  const save=studio().locator('[data-act="save"]:visible').first();if(await save.count()){await save.tap();await page.waitForTimeout(900);}
  await studio().locator('[data-act="close"]:visible').first().tap();
  await page.waitForSelector('#kelo-studio-live',{state:'detached',timeout:15000});
  await shot('05-world-after-close');

  const beforeWalk=await page.evaluate(()=>typeof localPlayer!=='undefined'&&localPlayer?{x:Number(localPlayer.x)||0,y:Number(localPlayer.y)||0}:null);if(!beforeWalk)fail('PLAYER_MISSING');
  const gbox=await game.boundingBox();if(!gbox)fail('NO_GAME_CANVAS_AFTER_CLOSE');
  const sx=gbox.width*.2,sy=gbox.height*.72;
  for(const [type,x] of [['pointerdown',sx],...Array.from({length:18},(_,i)=>['pointermove',sx+(i+1)*4]),['pointerup',sx+72]]){
    await page.evaluate(({type,x,y})=>{const c=document.getElementById('game-canvas');c.dispatchEvent(new PointerEvent(type,{pointerId:77,pointerType:'touch',isPrimary:true,clientX:x,clientY:y,buttons:type==='pointerup'?0:1,pressure:type==='pointerup'?0:.5,bubbles:true}));},{type,x,y:sy});
    await page.waitForTimeout(type==='pointermove'?90:40);
  }
  const afterWalk=await page.evaluate(()=>typeof localPlayer!=='undefined'&&localPlayer?{x:Number(localPlayer.x)||0,y:Number(localPlayer.y)||0}:null),distance=afterWalk?Math.hypot(afterWalk.x-beforeWalk.x,afterWalk.y-beforeWalk.y):0;
  report.steps.walk={before:beforeWalk,after:afterWalk,distance};if(distance<8)fail(`PLAYER_DID_NOT_WALK:${distance}`);
  await shot('06-world-after-walk');

  await openCreators();await openWorld();
  report.steps.reopen={connected:await studio().count(),status:await studio().locator('.ks-status').textContent().catch(()=>''),catalogCount:await studio().evaluate(el=>Number(el.dataset.keloCatalogCount||0))};
  await shot('07-editor-reopened');

  const relevant=pageErrors.filter(x=>!knownBaseError(x));report.pageErrors=relevant;report.consoleErrors=consoleErrors;
  if(relevant.length)fail(`PAGE_ERRORS:${JSON.stringify(relevant.slice(0,5))}`);
  report.ok=true;report.classification='MOBILE EMULATION PASS';
  fs.writeFileSync(`${OUT}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}catch(error){report.ok=false;report.error=String(error?.stack||error);report.pageErrors=pageErrors;report.consoleErrors=consoleErrors;try{await shot('99-failure');}catch{}fs.writeFileSync(`${OUT}/report.json`,JSON.stringify(report,null,2));throw error;}finally{await browser.close().catch(()=>{});}
