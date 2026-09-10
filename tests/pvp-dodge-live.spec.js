/* KELO-INDEX
 * area: TEST / PVP
 * owner: Playwright validation only
 * keys: PVP DODGE DASH COLLISION MOBILE DESKTOP LIVE
 * purpose: mide el desplazamiento real del dodge y registra cualquier collider que corte su segmento
 * online: N/A; valida el runtime local exacto de main sin alterar autoridad
 * do-not: NO gameplay mutation fuera de setup reproducible de prueba
 */
const {test,expect}=require('@playwright/test');

async function runDodge(page,label){
  const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.goto('http://127.0.0.1:4173/index.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.KeloPvPWorld&&window.KeloAbilities&&window.KeloInput&&typeof window.enterPvPWorld==='function',{timeout:20000});
  await page.evaluate(()=>window.enterPvPWorld());
  await page.waitForFunction(()=>window.KeloPvPWorld.state.mode==='pvp'&&window.KeloPvPWorld.state.combatEnabled,{timeout:5000});
  const baseline=await page.evaluate(async()=>{
    localPlayer.x=2790;localPlayer.y=720;localPlayer.vx=localPlayer.vy=0;
    window.KeloPvPWorld.setAimWorld({x:2910,y:720},'audit',1);
    const start={x:localPlayer.x,y:localPlayer.y};
    window.KeloInput.combat.push('DODGE_PRESS',{source:'audit'});
    await new Promise(r=>setTimeout(r,34));
    const dash=localPlayer._dash?{...localPlayer._dash}:null;
    const hits=[];
    if(dash&&window.KELO_COLLISION&&typeof obstacles!=='undefined'){
      for(const box of obstacles){
        if(!box||box.blocksMovement===false)continue;
        const t=window.KELO_COLLISION.segmentAabbHitT(start.x,start.y,dash.tx,dash.ty,box,localPlayer.radius||20);
        if(t!=null)hits.push({t,x:box.x,y:box.y,w:box.w,h:box.h,owner:box._keloCollisionOwner||box.owner||null,id:box.id||null});
      }
      hits.sort((a,b)=>a.t-b.t);
    }
    await new Promise(r=>setTimeout(r,240));
    const end={x:localPlayer.x,y:localPlayer.y};
    return{start,dash,end,distance:Math.hypot(end.x-start.x,end.y-start.y),hits:hits.slice(0,8),collisionOwners:window.KELO_COLLISION&&window.KELO_COLLISION.ownerSnapshot?window.KELO_COLLISION.ownerSnapshot():null,audit:window.KELO_PVP_AUDIT||null};
  });
  console.log('PVP_DODGE_LIVE',JSON.stringify({label,baseline,errors},null,2));
  expect(errors).toEqual([]);
  expect(baseline.dash).not.toBeNull();
  return baseline;
}

test('PvP dodge baseline mobile',async({browser})=>{const p=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});const r=await runDodge(p,'mobile');expect(r.distance).toBeGreaterThan(0);await p.close();});
test('PvP dodge baseline desktop',async({browser})=>{const p=await browser.newPage({viewport:{width:1440,height:900}});const r=await runDodge(p,'desktop');expect(r.distance).toBeGreaterThan(0);await p.close();});
