/* KELO-INDEX
 * area: PVE / GREENWILD LIVE BOOT
 * purpose: mount visible wolf + bandit encounters through canonical PvE owners
 */
(async function(root){
 if(root.__KELO_GREENWILD_LIVE__)return;
 const [{ensurePveLiveDependencies},{createGreenwildRun},{mountPveWorld},{mountGreenwildPresentation},{deliver},{mount:mountPlayerCombat},{mount:mountAbilityCombat},{mount:mountOliveOil},{mount:mountOliveWorld}]=await Promise.all([
  import('./pve-live-dependencies.mjs'),import('./greenwild-vertical-slice.mjs'),import('./pve-world-integration.mjs'),import('./pve-presentation.mjs'),import('./pve-loot-delivery.mjs'),import('./pve-player-combat-adapter.mjs'),import('./pve-ability-combat-bridge.mjs'),import('./olive-oil-live.mjs'),import('./olive-oil-world-stations.mjs')
 ]);
 await ensurePveLiveDependencies();
 if(root.KeloAbilitiesLoader?.ensure)await root.KeloAbilitiesLoader.ensure();
 const run=createGreenwildRun({seed:'greenwild-live-v5',partySize:1}),player=(typeof localPlayer!=='undefined'?localPlayer:null);
 async function mountEncounter(id,offsetX,offsetY,lootTableId){
  const encounter=run.startEncounter(id);
  if(player)encounter.snapshot().forEach((row,i)=>{const cols=2,spacingX=id==='wolf-pack'?92:72,spacingY=id==='wolf-pack'?84:72;encounter.actor(row.id)?.setPosition(player.x+offsetX+(i%cols)*spacingX,player.y+offsetY+Math.floor(i/cols)*spacingY)});
  const rawWorld=mountPveWorld({encounter,getTarget:()=>typeof localPlayer!=='undefined'?localPlayer:null,canonical:true});
  const world=Object.freeze({...rawWorld,playerHit(enemyId,amount,meta){const out=rawWorld.playerHit(enemyId,amount,Object.assign({encounterId:id,lootTableId},meta||{}));if(out?.dead&&out.drops?.length)out.delivery=deliver(out.drops,{source:id});return out;}});
  const presentation=await mountGreenwildPresentation({encounter,ctx:typeof ctx!=='undefined'?ctx:null,camera:typeof camera!=='undefined'?camera:null});
  const combat=mountPlayerCombat({world,encounter,getPlayer:()=>typeof localPlayer!=='undefined'?localPlayer:null});
  return Object.freeze({id,encounter,world,presentation,combat});
 }
 const wolves=await mountEncounter('wolf-pack',150,-70,'wolf_basic'),bandits=await mountEncounter('bandit-road',360,80,'bandit_basic');
 let abilityCombat=null;try{abilityCombat=mountAbilityCombat({encounters:[wolves,bandits],getPlayer:()=>typeof localPlayer!=='undefined'?localPlayer:null});}catch(error){console.warn('[KeloPvE] ability bridge pending',error);}
 const oliveOil=mountOliveOil({getPlayer:()=>typeof localPlayer!=='undefined'?localPlayer:null});
 const oliveWorld=mountOliveWorld({oil:oliveOil});
 root.__KELO_GREENWILD_LIVE__=Object.freeze({run,wolves,bandits,abilityCombat,oliveOil,oliveWorld,encounter:wolves.encounter,world:wolves.world,presentation:wolves.presentation,playerHit:wolves.world.playerHit});
 root.KeloEvents?.emit?.('kelo:pve:greenwild-live',{encounters:['wolf-pack','bandit-road'],canonical:true,inventory:true,playerCombat:true,abilityCombat:!!abilityCombat,oliveOil:true});
})(globalThis).catch(error=>console.error('[KeloPvE] Greenwild live mount failed',error));
