/* KELO-INDEX
 * area: PVE / GREENWILD LIVE BOOT
 * purpose: mount visible Wolf Pack through canonical PvE owners and canonical inventory delivery
 */
(async function(root){
  if(root.__KELO_GREENWILD_LIVE__)return;
  const [{ensurePveLiveDependencies},{createGreenwildRun},{mountPveWorld},{mountGreenwildPresentation},{deliver}]=await Promise.all([
    import('./pve-live-dependencies.mjs'),import('./greenwild-vertical-slice.mjs'),import('./pve-world-integration.mjs'),import('./pve-presentation.mjs'),import('./pve-loot-delivery.mjs')
  ]);
  await ensurePveLiveDependencies();
  const run=createGreenwildRun({seed:'greenwild-live-v3',partySize:1}),encounter=run.startEncounter('wolf-pack'),player=(typeof localPlayer!=='undefined'?localPlayer:null);
  if(player){const rows=encounter.snapshot();rows.forEach((row,i)=>encounter.actor(row.id)?.setPosition(player.x+150+(i%2)*58,player.y-70+Math.floor(i/2)*68));}
  const world=mountPveWorld({encounter,getTarget:()=>typeof localPlayer!=='undefined'?localPlayer:null,canonical:true});
  const presentation=await mountGreenwildPresentation({encounter,ctx:typeof ctx!=='undefined'?ctx:null,camera:typeof camera!=='undefined'?camera:null});
  function playerHit(id,amount,meta){const out=world.playerHit(id,amount,Object.assign({encounterId:'wolf-pack',lootTableId:'wolf_basic'},meta||{}));if(out?.dead&&out.drops?.length)out.delivery=deliver(out.drops,{source:'wolf-pack'});return out;}
  root.__KELO_GREENWILD_LIVE__=Object.freeze({run,encounter,world,presentation,playerHit});
  root.KeloEvents?.emit?.('kelo:pve:greenwild-live',{encounterId:'wolf-pack',count:encounter.snapshot().length,canonical:true,inventory:true});
})(globalThis).catch(error=>console.error('[KeloPvE] Greenwild live mount failed',error));
