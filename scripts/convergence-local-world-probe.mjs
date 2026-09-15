import { chromium } from 'playwright';

const BASE=(process.env.AUDIT_URL||'http://127.0.0.1:4173/').replace(/\?+$/,'');
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,serviceWorkers:'block'});
const page=await context.newPage();
const pageErrors=[];
page.on('pageerror',e=>pageErrors.push(String(e?.stack||e?.message||e)));

const visible=el=>{
  if(!el)return false;
  const r=el.getBoundingClientRect();
  const s=getComputedStyle(el);
  return r.width>1&&r.height>1&&s.display!=='none'&&s.visibility!=='hidden'&&s.opacity!=='0';
};

try{
  await page.goto(`${BASE}?guest=1&offline=1&mapEditor=1&convergence=${Date.now()}`,{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForTimeout(1000);

  await page.evaluate(async()=>{
    try{if(window.KeloRuntimeBootstrap?.ensure)await window.KeloRuntimeBootstrap.ensure();}catch{}
  });

  await page.waitForFunction(()=>{
    const launcher=window.KELO_CREATORS_LAUNCHER||window.KELO_STUDIO_LAUNCHER;
    return typeof launcher?.open==='function';
  },null,{timeout:20000});

  await page.evaluate(()=>{
    const launcher=window.KELO_CREATORS_LAUNCHER||window.KELO_STUDIO_LAUNCHER;
    launcher.open();
  });
  await page.waitForSelector('#kelo-creators-hub',{state:'visible',timeout:12000});

  const worldClicked=await page.evaluate(()=>{
    const hub=document.querySelector('#kelo-creators-hub');
    if(!hub)return false;
    const explicit=hub.querySelector('[data-workspace="world"],[data-area="world"],[data-mode="world"]');
    const text=[...hub.querySelectorAll('button,[role="button"],a')].find(el=>/\bworld\b/i.test(el.textContent||''));
    const target=explicit||text;
    if(!target)return false;
    target.click();
    return true;
  });
  if(!worldClicked)throw new Error('CONVERGENCE_WORLD_ENTRY_NOT_FOUND');

  await page.waitForSelector('#kelo-studio-live',{state:'visible',timeout:20000});
  await page.waitForTimeout(300);

  await page.evaluate(()=>{
    const root=document.querySelector('#kelo-studio-live');
    if(!root)return;
    const hasVisibleAsset=[...root.querySelectorAll('[data-asset]')].some(el=>{
      const r=el.getBoundingClientRect(),s=getComputedStyle(el);return r.width>1&&r.height>1&&s.display!=='none'&&s.visibility!=='hidden';
    });
    if(hasVisibleAsset)return;
    const controls=[...root.querySelectorAll('button,[role="button"]')];
    const target=root.querySelector('[data-act="edit-assets"]')||root.querySelector('[data-pane="assets"]')||controls.find(el=>/asset/i.test(el.textContent||''));
    target?.click?.();
  });

  await page.waitForFunction(()=>{
    const root=document.querySelector('#kelo-studio-live');
    return [...(root?.querySelectorAll?.('[data-asset]')||[])].some(el=>{
      const r=el.getBoundingClientRect(),s=getComputedStyle(el);return r.width>1&&r.height>1&&s.display!=='none'&&s.visibility!=='hidden';
    });
  },null,{timeout:10000});

  const assetInfo=await page.evaluate(()=>{
    const root=document.querySelector('#kelo-studio-live');
    const rows=[...root.querySelectorAll('[data-asset]')];
    const row=rows.find(el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return r.width>1&&r.height>1&&s.display!=='none'&&s.visibility!=='hidden';});
    if(!row)return null;
    const canvas=row.querySelector('canvas');
    let painted=false;
    if(canvas?.width&&canvas?.height){
      try{
        const ctx=canvas.getContext('2d',{willReadFrequently:true});
        const w=Math.min(canvas.width,64),h=Math.min(canvas.height,64),data=ctx.getImageData(0,0,w,h).data;
        for(let i=3;i<data.length;i+=4){if(data[i]>0){painted=true;break;}}
      }catch{}
    }
    return {id:row.dataset.asset||'',painted,hasCanvas:!!canvas,canvasSize:canvas?[canvas.width,canvas.height]:null};
  });
  if(!assetInfo?.id)throw new Error('CONVERGENCE_ASSET_ROW_MISSING');

  // Give async thumbnail acquisition a short chance before requiring real pixels.
  if(!assetInfo.painted){
    await page.waitForTimeout(1200);
  }
  const previewPainted=await page.evaluate(()=>{
    const root=document.querySelector('#kelo-studio-live');
    const row=[...root.querySelectorAll('[data-asset]')].find(el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return r.width>1&&r.height>1&&s.display!=='none'&&s.visibility!=='hidden';});
    const canvas=row?.querySelector('canvas');
    if(!canvas?.width||!canvas?.height)return false;
    try{const d=canvas.getContext('2d',{willReadFrequently:true}).getImageData(0,0,Math.min(canvas.width,64),Math.min(canvas.height,64)).data;for(let i=3;i<d.length;i+=4)if(d[i]>0)return true;}catch{}
    return false;
  });
  if(!previewPainted)throw new Error(`CONVERGENCE_ASSET_PREVIEW_NOT_PAINTED:${JSON.stringify(assetInfo)}`);

  const before=await page.evaluate(()=>({
    property:window.KELO_PROPERTY_SYSTEM?.getPlacements?.('parcel:world:editor')?.length??null,
    status:document.querySelector('#kelo-studio-live .ks-status')?.textContent||''
  }));

  const row=page.locator('#kelo-studio-live [data-asset]').filter({visible:true}).first();
  await row.click();
  const canvas=page.locator('#game-canvas');
  const box=await canvas.boundingBox();
  if(!box)throw new Error('CONVERGENCE_GAME_CANVAS_MISSING');
  const x=Math.round(box.x+box.width*.54),y=Math.round(box.y+Math.min(box.height*.25,190));
  await page.mouse.move(x,y);
  await page.waitForTimeout(120);
  await page.mouse.click(x,y);

  await page.waitForFunction(beforeCount=>{
    const p=window.KELO_PROPERTY_SYSTEM?.getPlacements?.('parcel:world:editor')?.length;
    const status=document.querySelector('#kelo-studio-live .ks-status')?.textContent||'';
    if(Number.isFinite(beforeCount)&&Number.isFinite(p))return p>beforeCount;
    const m=status.match(/(\d+)\s+objects/i);return m&&Number(m[1])>0;
  },before.property,{timeout:12000});

  const after=await page.evaluate(()=>({
    property:window.KELO_PROPERTY_SYSTEM?.getPlacements?.('parcel:world:editor')?.length??null,
    status:document.querySelector('#kelo-studio-live .ks-status')?.textContent||'',
    shell:!!document.getElementById('kelo-studio-live'),
    scaleHud:[...document.querySelectorAll('#kelo-studio-live *')].some(el=>/2\s*DEDOS/i.test(el.textContent||''))
  }));
  if(pageErrors.length)throw new Error(`CONVERGENCE_PAGE_ERRORS:${pageErrors.join(' | ')}`);

  console.log('CONVERGENCE_WORLD_PREVIEW_PLACEMENT_PASS');
  console.log(JSON.stringify({asset:assetInfo.id,previewPainted:true,before,after,pageErrors},null,2));
}finally{
  await browser.close();
}
