/* KELO-INDEX
 * area: PVE / GREENWILD LIVE BOOT
 * purpose: mount visible wolf + bandit encounters through canonical PvE owners
 */
(async function(root){
 if(root.__KELO_GREENWILD_LIVE__)return;
 const [{ensurePveLiveDependencies},{createGreenwildRun},{mountPveWorld},{mountGreenwildPresentation},{deliver},{mount:mountPlayerCombat}]=await Promise.all([
  import('./pve-live-dependencies.mjs'),import('./greenwild-vertical-slice.mjs'),import('./pve-world-integration.mjs'),import('./pve-presentation.mjs'),import('./pve-loot-delivery.mjs'),import('./pve-player-combat-adapter.mjs')
 ]);
 await ensurePveLiveDependencies();
 const run=createGreenwildRun({seed:'greenwild-live-v4',partySize:1}),player=(typeof localPlayer!=='undefined'?localPlayer:null);
 async function mountEncounter(id,offsetX,offsetY,lootTableId){
  const encounter=run.startEncounter(id);
  if(player)encounter.snapshot().forEach((row,i)=>encounter.actor(row.id)?.setPosition(player.x+offsetX+(i%3)*54,player.y+offsetY+Math.floor(i/3)*62));
  const rawWorld=mountPveWorld({encounter,getTarget:()=>typeof localPlayer!=='undefined'?localPlayer:null,canonical:true});
  const world=Object.freeze({...rawWorld,playerHit(enemyId,amount,meta){const out=rawWorld.playerHit(enemyId,amount,Object.assign({encounterId:id,lootTableId},meta||{}));if(out?.dead&&out.drops?.length)out.delivery=deliver(out.drops,{source:id});return out;}});
  const presentation=await mountGreenwildPresentation({encounter,ctx:typeof ctx!=='undefined'?ctx:null,camera:typeof camera!=='undefined'?camera:null});
  const combat=mountPlayerCombat({world,encounter,getPlayer:()=>typeof localPlayer!=='undefined'?localPlayer:null});
  return Object.freeze({id,encounter,world,presentation,combat});
 }
 const wolves=await mountEncounter('wolf-pack',150,-70,'wolf_basic');
 const bandits=await mountEncounter('bandit-road',360,80,'bandit_basic');
 root.__KELO_GREENWILD_LIVE__=Object.freeze({run,wolves,bandits,encounter:wolves.encounter,world:wolves.world,presentation:wolves.presentation,playerHit:wolves.world.playerHit});
 root.KeloEvents?.emit?.('kelo:pve:greenwild-live',{encounters:['wolf-pack','bandit-road'],canonical:true,inventory:true,playerCombat:true});
})(globalThis).catch(error=>console.error('[KeloPvE] Greenwild live mount failed',error));
