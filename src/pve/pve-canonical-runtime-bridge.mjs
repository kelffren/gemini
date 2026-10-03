/* KELO-INDEX
 * area: PVE / CANONICAL RUNTIME BRIDGE
 * owner: KeloPvERuntimeBridge
 * purpose: bridge existing visible PvE runtime into canonical brain/threat/combat/loot owners
 * public-api: createBridge
 * consumes: KeloPvEBrain/KeloPvEThreat/KeloCombatEngine/KeloPvELootClaims/KeloEvents
 * do-not: NO loop, NO render, NO inventory writes
 */
const F=Object.freeze;
export function createBridge({encounter,getPlayer=()=>globalThis.localPlayer,brain=globalThis.KeloPvEBrain,threatApi=globalThis.KeloPvEThreat,combat=globalThis.KeloCombatEngine,lootClaims=globalThis.KeloPvELootClaims}={}){
 if(!encounter)throw new Error('PVE_ENCOUNTER_REQUIRED');
 const threat=new Map(),cooldowns=new Map(),deathSeen=new Set();
 function table(id){if(!threat.has(id)&&threatApi?.create)threat.set(id,threatApi.create(id));return threat.get(id)||null}
 function addThreat(enemyId,targetId,amount,reason='damage'){const t=table(enemyId);if(!t||!threatApi?.add)return null;const n=threatApi.add(t,targetId,amount,reason);threat.set(enemyId,n);return n}
 function update(dtMs){
  const player=getPlayer?.();if(!player)return encounter.snapshot();
  const dt=Math.max(0,Number(dtMs)||0);
  for(const row of encounter.snapshot()){
   if(row.dead){if(!deathSeen.has(row.id)){deathSeen.add(row.id);globalThis.KeloEvents?.emit?.('kelo:pve:canonical-death',{enemyId:row.id});}continue}
   let cd=Math.max(0,(cooldowns.get(row.id)||0)-dt);cooldowns.set(row.id,cd);
   const d=Math.hypot((player.x||0)-(row.x||0),(player.y||0)-(row.y||0));
   const intent=brain?.decide?brain.decide({id:row.id,x:row.x,y:row.y,hp:row.hp,maxHp:row.maxHp,brainId:row.family==='bandit'?'melee_guard':'pack_melee',spawnX:row.spawnX??row.x,spawnY:row.spawnY??row.y},{target:player,distance:d}):null;
   if(intent?.type==='ATTACK'&&cd<=0&&combat?.attack){
    const actor=encounter.actor(row.id)?.snapshot||row;
    const result=combat.attack({attacker:actor,target:player,profile:{range:56,cooldown:900,damage:Number(row.damage)||8,damageType:'physical',hitShape:'range'},source:'KeloPvERuntimeBridge'});
    if(result?.ok)cooldowns.set(row.id,900);
   }
  }
  encounter.update(dt,{target:player});return encounter.snapshot();
 }
 function playerHit(enemyId,amount,meta={}){
  const player=getPlayer?.(),pid=String(meta.playerId||player?.id||player?.playerKey||'local-player');addThreat(enemyId,pid,Math.max(1,Number(amount)||0),'damage');
  const out=encounter.damage(enemyId,amount,{sourceId:pid,seed:meta.seed||'world'});
  if(out.dead){const snap=encounter.actor(enemyId)?.snapshot||{};const claim=lootClaims?.buildClaim?.({encounterId:meta.encounterId||'live',actorId:enemyId,deathRevision:meta.deathRevision??1,claimantId:pid,lootTableId:meta.lootTableId||snap.lootTableId||''});globalThis.KeloEvents?.emit?.('kelo:pve:loot-claim-ready',{enemyId,claim});}
  return out;
 }
 return F({update,playerHit,addThreat,threat:(id)=>table(id),snapshot:()=>encounter.snapshot()});
}
