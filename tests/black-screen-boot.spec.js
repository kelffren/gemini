/* KELO-INDEX
 * area: TEST / BOOT / BLACK SCREEN
 * owner: Black Screen Boot Smoke
 * purpose: verifica desde Playwright que el arranque guest pinta mundo real y no deja canvas negro
 * do-not: no inspeccionar implementación interna como criterio de éxito; probar pixels/runtime visibles
 */
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
    const renderSnapshot=window.KeloRender?.snapshot?.()||null;
    const cameraSnapshot=window.KeloCamera?.snapshot?.()||null;
    const worldView=window.KeloCamera?.worldView?.()||null;
    const player=typeof localPlayer!=='undefined'?{x:localPlayer.x,y:localPlayer.y,vx:localPlayer.vx,vy:localPlayer.vy}:null;

    const probe=document.createElement('canvas');
    probe.width=innerWidth;probe.height=innerHeight;
    const pg=probe.getContext('2d');
    pg.fillStyle='#07090d';pg.fillRect(0,0,probe.width,probe.height);
    let manualDraw=false;
    try{
      const z=window.KeloCamera?.getEffectiveZoom?.()||1;
      const cam=window.camera||{x:0,y:0};
      pg.save();pg.translate(probe.width/2,probe.height/2);pg.scale(z,z);pg.translate(-cam.x,-cam.y);
      manualDraw=window.KELO_WORLD_RENDERER?.draw?.(pg)===true;
      pg.restore();
    }catch(error){manualDraw=String(error&&error.stack||error)}
    const pd=pg.getImageData(0,0,probe.width,probe.height).data;
    let probeNonDark=0,probeSamples=0;
    for(let y=0;y<probe.height;y+=8)for(let x=0;x<probe.width;x+=8){
      const i=(y*probe.width+x)*4;probeSamples++;
      if(pd[i+3]>20&&Math.max(pd[i],pd[i+1],pd[i+2])>36)probeNonDark++;
    }

    return {
      width:w,height:h,sampled,
      opaqueRatio:sampled?opaque/sampled:0,
      nonDarkRatio:sampled?nonDark/sampled:0,
      quantizedColors:colors.size,
      reset:window.KELO_WORLD_DECORATION_RESET,
      worldReady:window.KELO_WORLD_AUDIT?.ready===true,
      terrainAtlasesReady:window.KELO_WORLD_AUDIT?.terrainAtlasesReady===true,
      plazaReady:window.KELO_PLAZA_AUDIT?.ready===true,
      renderSnapshot,cameraSnapshot,worldView,player,manualDraw,
      manualNonDarkRatio:probeSamples?probeNonDark/probeSamples:0
    };
  });

  console.log('BLACK_SCREEN_VISUAL',JSON.stringify({...visual,pageErrors}));

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
