import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE=(process.env.AUDIT_URL||'http://127.0.0.1:8000/').replace(/\?+$/,'');
const executablePath=process.env.CHROME_BIN||undefined;
const OUT='test-results/world-surgery-proof';
fs.mkdirSync(OUT,{recursive:true});

const browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{})});
const context=await browser.newContext({
  viewport:{width:390,height:844},
  screen:{width:390,height:844},
  deviceScaleFactor:2,
  isMobile:true,
  hasTouch:true,
  serviceWorkers:'block',
  userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
});
const page=await context.newPage();
const pageErrors=[];
const consoleErrors=[];
const report={classification:'MOBILE EMULATION',steps:{}};
page.on('pageerror',error=>pageErrors.push(String(error?.stack||error?.message||error)));
page.on('console',msg=>{if(msg.type()==='error')consoleErrors.push(msg.text());});

const fail=message=>{throw new Error(message);};
const isKnownBaseSocialError=row=>/closeSocialModal[\s\S]*checkSocialTouch/.test(String(row||''));
const objectCountFromStatus=status=>Number(String(status||'').match(/(\d+)\s+objects?/i)?.[1]||0);
const shot=async name=>page.screenshot({path:`${OUT}/${name}.png`,fullPage:true,timeout:10000});
const live=()=>page.locator('#kelo-studio-live');

async function openCreatorsProgrammatically(){
  await page.evaluate(async()=>{
    const {openCreatorHub}=await import('./src/creators/ui/creator-hub.mjs');
    await openCreatorHub({root:window});
  });
  await page.waitForSelector('#kelo-creators-hub',{state:'visible',timeout:15000});
  await page.waitForFunction(()=>!!(
    window.KeloInputLocks?.acquire&&
    window.KELO_ADMIN_KEYS?.can?.('world.edit')
  ),{timeout:15000});
}

async function waitWorldMounted(){
  await page.waitForFunction(()=>{
    const root=document.getElementById('kelo-studio-live');
    return !!root?.isConnected&&root.dataset?.keloWorldLoading!=='1'&&!!root.querySelector('.ks-status');
  },{timeout:45000});
  return page.evaluate(()=>{
    const root=document.getElementById('kelo-studio-live');
    const status=String(root?.querySelector('.ks-status')?.textContent||'');
    const canvas=document.getElementById('game-canvas');
    const rect=canvas?.getBoundingClientRect?.();
    return {
      connected:!!root?.isConnected,
      loading:root?.dataset?.keloWorldLoading||'',
      status,
      objects:Number(status.match(/(\d+)\s+objects?/i)?.[1]||0),
      canvas:{width:rect?.width||0,height:rect?.height||0},
      paintCopies:window.KELO_WORLD_SURGERY?.enabled?.('paintCopies'),
      pageResponsive:document.visibilityState==='visible'
    };
  });
}

async function openAssetsAndInspectPreviews(){
  const studio=live();
  const edit=studio.locator('[data-act="edit-assets"]:visible').first();
  await edit.waitFor({state:'visible',timeout:10000});
  await edit.tap();
  await page.waitForSelector('#kelo-studio-live [data-pane="assets"] [data-asset]',{state:'visible',timeout:15000});
  await page.waitForTimeout(700);
  const rows=await page.evaluate(()=>{
    const visible=el=>{const r=el.getBoundingClientRect();const s=getComputedStyle(el);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden';};
    return [...document.querySelectorAll('#kelo-studio-live [data-pane="assets"] [data-asset]')]
      .filter(visible)
      .slice(0,12)
      .map(row=>{
        const canvas=row.querySelector('canvas');
        let ink=false,alphaPixels=0;
        if(canvas){
          try{
            const data=canvas.getContext('2d')?.getImageData(0,0,canvas.width,canvas.height)?.data||[];
            for(let i=3;i<data.length;i+=4){if(data[i]>10){alphaPixels++;if(alphaPixels>8){ink=true;break;}}}
          }catch{}
        }
        return {id:String(row.dataset.asset||''),text:String(row.innerText||'').trim(),ink,alphaPixels};
      });
  });
  if(!rows.length)fail('ASSET_ROWS_NOT_VISIBLE');
  const tree=rows.find(row=>/tree|arbol|árbol|oak|pine|pino|roble|birch|abedul|flor/i.test(`${row.id} ${row.text}`));
  if(!tree)fail(`TREE_ASSET_NOT_VISIBLE:${JSON.stringify(rows)}`);
  if(!tree.ink)fail(`TREE_ASSET_PREVIEW_EMPTY:${JSON.stringify(tree)}`);
  report.steps.assetPreviews={rows,tree};
  await shot('01-assets-preview');
  await page.locator(`#kelo-studio-live [data-asset="${tree.id.replaceAll('"','\\"')}"]`).first().tap();
  await live().waitFor({state:'visible'});
  await page.waitForFunction(id=>document.getElementById('kelo-studio-live')?.dataset?.activeAsset===id,tree.id,{timeout:5000});
  const compactPreview=await page.evaluate(()=>{
    const canvas=document.querySelector('#kelo-studio-live .ks-active-asset-preview');
    if(!canvas)return {present:false,ink:false};
    let ink=false;
    try{
      const data=canvas.getContext('2d')?.getImageData(0,0,canvas.width,canvas.height)?.data||[];
      for(let i=3;i<data.length;i+=4)if(data[i]>10){ink=true;break;}
    }catch{}
    return {present:true,ink,width:canvas.width,height:canvas.height};
  });
  report.steps.assetPreviews.compactPreview=compactPreview;
  if(!compactPreview.present||!compactPreview.ink)fail(`ACTIVE_TREE_PREVIEW_EMPTY:${JSON.stringify(compactPreview)}`);
  return tree;
}

async function placeTree(tree,beforeObjects){
  const canvas=page.locator('#game-canvas');
  const box=await canvas.boundingBox();
  if(!box)fail('GAME_CANVAS_NO_BOX');
  const point={x:Math.round(box.width*0.56),y:Math.round(box.height*0.42)};
  await canvas.tap({position:point});
  await page.waitForFunction(previous=>{
    const status=document.querySelector('#kelo-studio-live .ks-status')?.textContent||'';
    return Number(status.match(/(\d+)\s+objects?/i)?.[1]||0)>previous;
  },beforeObjects,{timeout:15000});
  const status=await live().locator('.ks-status').textContent();
  const afterObjects=objectCountFromStatus(status);
  report.steps.treePlaced={tree,point,beforeObjects,afterObjects,status};
  await shot('02-tree-placed');
  if(afterObjects<=beforeObjects)fail(`TREE_PLACEMENT_DID_NOT_INCREMENT:${beforeObjects}->${afterObjects}`);
  return {point,afterObjects};
}

async function selectPlacedTreeAndScale(point){
  const studio=live();
  const select=studio.locator('[data-mode="select"]:visible').first();
  await select.waitFor({state:'visible',timeout:10000});
  await select.tap();
  const canvas=page.locator('#game-canvas');
  await canvas.tap({position:point});
  let selectedBy='canvas';
  try{
    await page.waitForFunction(()=>Number(document.getElementById('kelo-studio-live')?.dataset?.selectionCount||0)>0,{timeout:5000});
  }catch{
    const entity=studio.locator('[data-entity]').last();
    if(await entity.count()){await entity.click({force:true});selectedBy='explorer-fallback';}
    await page.waitForFunction(()=>Number(document.getElementById('kelo-studio-live')?.dataset?.selectionCount||0)>0,{timeout:5000});
  }
  const before=await studio.locator('.ks-scale-value').textContent().catch(()=>null);
  const scaleUp=studio.locator('.ks-scale-hud.on [data-act="scale-up"]');
  if(await scaleUp.count())await scaleUp.tap();
  else await studio.locator('[data-act="scale-up"]:visible').first().tap();
  await page.waitForFunction(prev=>{
    const next=document.querySelector('#kelo-studio-live .ks-scale-value')?.textContent||'';
    return !!next&&next!==prev;
  },before,{timeout:5000});
  const scaled=await page.evaluate(()=>({
    selectionCount:Number(document.getElementById('kelo-studio-live')?.dataset?.selectionCount||0),
    scaleHud:String(document.querySelector('#kelo-studio-live .ks-scale-value')?.textContent||''),
    scaleInput:String(document.querySelector('#kelo-studio-live [data-prop="scalePercent"]')?.value||''),
    selectedEntity:String(document.querySelector('#kelo-studio-live [data-entity].on')?.dataset?.entity||'')
  }));
  report.steps.scaled={selectedBy,before,...scaled};
  await shot('03-tree-scaled');
  if(scaled.selectionCount<1)fail('TREE_SELECTION_LOST_BEFORE_SCALE');
  if(!scaled.scaleHud||scaled.scaleHud===before)fail(`TREE_SCALE_DID_NOT_CHANGE:${before}->${scaled.scaleHud}`);
  return scaled;
}

async function saveAndClose(){
  const studio=live();
  const save=studio.locator('[data-act="save"]:visible').first();
  await save.waitFor({state:'visible',timeout:10000});
  await save.tap();
  await page.waitForTimeout(1600);
  const close=studio.locator('[data-act="close"]:visible').first();
  await close.waitFor({state:'visible',timeout:10000});
  await close.tap();
  await page.waitForSelector('#kelo-studio-live',{state:'detached',timeout:15000});
  report.steps.closed={studioPresent:await page.locator('#kelo-studio-live').count()};
  await shot('04-world-after-editor-close');
}

async function walkWorld(){
  const before=await page.evaluate(()=>typeof localPlayer!=='undefined'&&localPlayer?{x:Number(localPlayer.x)||0,y:Number(localPlayer.y)||0}:null);
  if(!before)fail('LOCAL_PLAYER_MISSING_AFTER_EDITOR_CLOSE');
  const box=await page.evaluate(()=>{const c=document.getElementById('game-canvas');const r=c?.getBoundingClientRect?.();return r?{left:r.left,top:r.top,width:r.width,height:r.height}:null;});
  if(!box)fail('GAME_CANVAS_MISSING_FOR_WALK');
  const sx=box.left+box.width*0.20,sy=box.top+box.height*0.70;
  const pointer=async(type,x,y)=>page.evaluate(({type,x,y})=>{
    const c=document.getElementById('game-canvas');
    if(!c)throw new Error('NO_CANVAS');
    c.dispatchEvent(new PointerEvent(type,{pointerId:91,pointerType:'touch',isPrimary:true,clientX:x,clientY:y,buttons:type==='pointerup'?0:1,pressure:type==='pointerup'?0:.5,bubbles:true}));
  },{type,x,y});
  await pointer('pointerdown',sx,sy);
  for(let i=1;i<=22;i++){
    await pointer('pointermove',sx+Math.min(86,i*4),sy);
    await page.waitForTimeout(110);
  }
  await pointer('pointerup',sx+86,sy);
  await page.waitForTimeout(350);
  const after=await page.evaluate(()=>typeof localPlayer!=='undefined'&&localPlayer?{x:Number(localPlayer.x)||0,y:Number(localPlayer.y)||0}:null);
  const distance=after?Math.hypot(after.x-before.x,after.y-before.y):0;
  report.steps.walk={before,after,distance};
  await shot('05-world-after-walk');
  if(distance<10)fail(`PLAYER_DID_NOT_WALK:${JSON.stringify({before,after,distance})}`);
  return {before,after,distance};
}

async function reopenThroughVisibleUi(expectedObjects){
  const menu=page.locator('#lx-side-menu');
  await menu.waitFor({state:'visible',timeout:20000});
  await menu.tap();
  await page.waitForFunction(()=>document.getElementById('lx-menu-panel')?.classList?.contains('open'),{timeout:10000});
  const creators=page.locator('#lx-create-studio');
  await creators.waitFor({state:'visible',timeout:20000});
  await creators.tap();
  await page.waitForSelector('#kelo-creators-hub',{state:'visible',timeout:20000});
  const world=page.locator('#kelo-creators-hub [data-workspace="world"]');
  await world.waitFor({state:'visible',timeout:10000});
  await world.tap();
  const mounted=await waitWorldMounted();
  try{
    await page.waitForFunction(min=>{
      const status=document.querySelector('#kelo-studio-live .ks-status')?.textContent||'';
      return Number(status.match(/(\d+)\s+objects?/i)?.[1]||0)>=min;
    },expectedObjects,{timeout:18000});
  }catch{}
  const final=await page.evaluate(()=>{
    const root=document.getElementById('kelo-studio-live');
    const status=String(root?.querySelector('.ks-status')?.textContent||'');
    const canvas=document.getElementById('game-canvas')?.getBoundingClientRect?.();
    return {
      connected:!!root?.isConnected,
      loading:root?.dataset?.keloWorldLoading||'',
      status,
      objects:Number(status.match(/(\d+)\s+objects?/i)?.[1]||0),
      canvas:{width:canvas?.width||0,height:canvas?.height||0},
      position:root?getComputedStyle(root).position:''
    };
  });
  report.steps.reopened={mounted,final,expectedObjects,treePersisted:final.objects>=expectedObjects};
  await shot('06-editor-reopened');
  if(!final.connected||final.loading==='1'||final.canvas.width<250||final.canvas.height<400)fail(`EDITOR_REOPEN_VISUAL_FAILED:${JSON.stringify(final)}`);
  if(final.objects<expectedObjects)fail(`TREE_NOT_PRESENT_AFTER_REOPEN:${expectedObjects}->${final.objects}`);
  return final;
}

try{
  await page.goto(`${BASE}?guest=1&mapEditor=1&world-surgery-proof=${Date.now()}`,{waitUntil:'domcontentloaded',timeout:30000});
  await openCreatorsProgrammatically();

  const surgeryButton=page.locator('[data-world-surgery="1"]');
  await surgeryButton.waitFor({state:'visible',timeout:10000});
  await surgeryButton.tap();
  await page.waitForSelector('#kelo-world-surgery-control',{state:'visible',timeout:10000});

  const initial=await page.evaluate(()=>({hasApi:!!window.KELO_WORLD_SURGERY,preset:window.KELO_WORLD_SURGERY?.getConfig?.().preset,paintCopies:window.KELO_WORLD_SURGERY?.enabled?.('paintCopies')}));
  if(!initial.hasApi)fail('SURGERY_API_MISSING');
  if(initial.paintCopies!==true)fail('SURGERY_DEFAULT_NOT_ALL_CURRENT');
  await page.getByRole('button',{name:'NO_PAINT_COPIES'}).tap();
  const switched=await page.evaluate(()=>({preset:window.KELO_WORLD_SURGERY?.getConfig?.().preset,paintCopies:window.KELO_WORLD_SURGERY?.enabled?.('paintCopies')}));
  if(switched.preset!=='NO_PAINT_COPIES'||switched.paintCopies!==false)fail(`SURGERY_PRESET_FAILED:${JSON.stringify(switched)}`);

  await page.reload({waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForFunction(()=>!!window.KELO_WORLD_SURGERY?.enabled,{timeout:15000});
  const persisted=await page.evaluate(()=>({preset:window.KELO_WORLD_SURGERY.getConfig().preset,paintCopies:window.KELO_WORLD_SURGERY.enabled('paintCopies')}));
  if(persisted.paintCopies!==false)fail(`SURGERY_PERSISTENCE_FAILED:${JSON.stringify(persisted)}`);
  report.steps.surgery={initial,switched,persisted};

  await openCreatorsProgrammatically();
  await page.locator('#kelo-creators-hub [data-workspace="world"]').first().tap();
  const mounted=await waitWorldMounted();
  report.steps.firstMount=mounted;
  if(!mounted.connected||mounted.paintCopies!==false||!mounted.pageResponsive||mounted.canvas.width<250||mounted.canvas.height<400)fail(`WORLD_SURGERY_MOUNT_FAILED:${JSON.stringify(mounted)}`);

  const tree=await openAssetsAndInspectPreviews();
  const placed=await placeTree(tree,mounted.objects);
  const scaled=await selectPlacedTreeAndScale(placed.point);
  await saveAndClose();
  const walk=await walkWorld();
  const reopened=await reopenThroughVisibleUi(placed.afterObjects);

  const ignoredBasePageErrors=pageErrors.filter(isKnownBaseSocialError);
  const relevantPageErrors=pageErrors.filter(row=>!isKnownBaseSocialError(row));
  report.ok=true;
  report.classification='MOBILE EMULATION PASS';
  report.summary={tree,scaled,walk,reopened,ignoredBasePageErrors,relevantPageErrors,consoleErrors};
  fs.writeFileSync(`${OUT}/report.json`,JSON.stringify(report,null,2));
  if(relevantPageErrors.length)fail(`WORLD_SURGERY_PAGE_ERRORS:${JSON.stringify(relevantPageErrors.slice(0,5))}`);
  console.log(JSON.stringify(report,null,2));
}catch(error){
  report.ok=false;
  report.error=String(error?.stack||error?.message||error);
  report.pageErrors=pageErrors;
  report.consoleErrors=consoleErrors;
  try{await shot('99-failure');}catch{}
  try{fs.writeFileSync(`${OUT}/report.json`,JSON.stringify(report,null,2));}catch{}
  throw error;
}finally{
  await browser.close().catch(()=>{});
}
