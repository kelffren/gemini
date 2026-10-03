/* KELO-INDEX
 * area: PVE / VERTICAL SLICE
 * owner: Kelo PvE
 * purpose: first playable content contract: Greenwild -> cave -> Ancient Golem -> Duskfen
 */
import {scaleEncounter,createBossProgression} from './pve-foundation.mjs';
import {createSpawnPlan,createEncounterRuntime} from './pve-runtime.mjs';
import {generateDungeon,createStoneRewardIntent,createWorldProgression} from './pve-world-content.mjs';

const F=Object.freeze;
export const GREENWILD_SLICE=F({
  id:'greenwild-v1',biome:'greenwild',tier:1,
  encounters:F([
    F({id:'wolf-pack',family:'beast',baseCount:4,loot:F([{id:'wolf-hide',kind:'material',chance:.55,min:1,max:2}])}),
    F({id:'bandit-road',family:'bandit',baseCount:5,loot:F([{id:'iron-scrap',kind:'material',chance:.45,min:1,max:2}])})
  ]),
  dungeon:F({id:'greenwild-old-cave',rooms:7,boss:'ancient-golem'}),
  boss:F({id:'ancient-golem',family:'elemental',hp:900,damage:24,firstKillUnlocks:F(['tier:2','biome:duskfen','recipe:earth-core']),loot:F([{id:'earth-core',kind:'boss-material',guaranteed:true,min:1,max:1}])})
});

export function createGreenwildRun({seed='greenwild',partySize=1}={}){
  const progression=createWorldProgression(),runs=new Map();
  function encounter(content){
    const scaled=scaleEncounter({baseCount:content.baseCount,partySize,tier:1});
    const plan=createSpawnPlan({encounterId:content.id,count:scaled.enemyCount,seed:seed+':'+content.id,family:content.family,tier:1,partySize,eliteChance:scaled.eliteChance,championChance:scaled.championChance});
    const runtime=createEncounterRuntime(plan,{lootTable:content.loot});
    runs.set(content.id,runtime);return runtime;
  }
  const bossProgress=createBossProgression(GREENWILD_SLICE.boss);
  return F({
    slice:GREENWILD_SLICE,
    dungeon:generateDungeon({id:GREENWILD_SLICE.dungeon.id,tier:1,seed,rooms:GREENWILD_SLICE.dungeon.rooms}),
    startEncounter(id){const content=GREENWILD_SLICE.encounters.find(x=>x.id===id);if(!content)throw new Error('GREENWILD_ENCOUNTER_UNKNOWN:'+id);return encounter(content)},
    createBoss(){const spec={...GREENWILD_SLICE.boss,spawnId:'boss:ancient-golem',x:0,y:0,rank:'mythic',tier:1,lootMultiplier:5,telegraphMs:850,recoveryMs:700};return createEncounterRuntime([spec],{lootTable:GREENWILD_SLICE.boss.loot})},
    completeBoss({playerId='player',killCount=0}={}){const result=bossProgress.resolveKill({playerId,killCount,seed});if(result.firstKill)progression.defeatBoss({bossId:result.bossId,unlocks:result.unlocks});return F({...result,stoneReward:createStoneRewardIntent({biomeId:'greenwild',worldTier:1,source:'ancient-golem',seed:seed+':boss',boss:true}),progression:progression.snapshot()})},
    progression
  });
}
