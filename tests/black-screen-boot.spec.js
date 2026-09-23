const { test, expect } = require('@playwright/test');

const BASE_URL=process.env.KELO_PAGES||'http://127.0.0.1:4173/';

test('normal guest boot renders a non-black world with terrain atlases',async({browser})=>{
  const page=await browser.newPage({
    baseURL:BASE_URL,
    viewport:{width:390,height:844},
    deviceScaleFactor:2,
    isMobile:true,
    hasTouch:true,
    userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
  });
  const pageErrors=[];
  page.on('pageerror',e=>pageErrors.push(String(e&&e.stack||e)));

  const response=await page.goto('./?guest=1&blackScreenSmoke=1',{waitUntil:'domcontentloaded',timeout:45000});
  expect(response).not.toBeNull();
  expect(response.status()).toBeLessThan(400);

  await page.waitForFunction(()=>window.__keloBootReady===true && window.KELO_WORLD_DECORATION_RESET===false && window.KELO_WORLD_AUDIT?.terrainAtlasesReady===true,null,{timeout:30000});
  await expect(page.locator('#game-canvas')).toBeVisible();

  await page.waitForTimeout(1200);
  const visual=await page.evaluate(()=>{
    const c=document.getElementById('game-canvas');
    const g=c.getContext('2d');
    const w=c.width,h=c.height;
    const step=Math.max(1,Math.floor(Math.sqrt((w*h)/6000)));
    const d=g.getImageData(0,0,w,h).data;
    let sampled=0,nonDark=0,opaque=0;
    const colors=new Set();
    for(let y=0;y<h;y+=step){
      for(let x=0;x<w;x+=step){
        const i=(y*w+x)*4,r=d[i],gg=d[i+1],b=d[i+2],a=d[i+3];
        sampled++;
        if(a>20)opaque++;
        if(a>20 && Math.max(r,gg,b)>36)nonDark++;
        colors.add((r>>4)+','+(gg>>4)+','+(b>>4)+','+(a>>6));
      }
    }
    return {
      width:w,height:h,sampled,
      opaqueRatio:sampled?opaque/sampled:0,
      nonDarkRatio:sampled?nonDark/sampled:0,
      quantizedColors:colors.size,
      reset:window.KELO_WORLD_DECORATION_RESET,
      worldReady:window.KELO_WORLD_AUDIT?.ready===true,
      terrainAtlasesReady:window.KELO_WORLD_AUDIT?.terrainAtlasesReady===true,
      plazaReady:window.KELO_PLAZA_AUDIT?.ready===true
    };
  });

  expect(visual.reset).toBe(false);
  expect(visual.worldReady).toBe(true);
  expect(visual.terrainAtlasesReady).toBe(true);
  expect(visual.opaqueRatio).toBeGreaterThan(.95);
  expect(visual.nonDarkRatio).toBeGreaterThan(.12);
  expect(visual.quantizedColors).toBeGreaterThan(12);
  expect(pageErrors).toEqual([]);

  console.log('BLACK_SCREEN_VISUAL',JSON.stringify(visual));
  await page.screenshot({path:'test-results/black-screen-world-pass.png',fullPage:true});
  await page.close();
});
