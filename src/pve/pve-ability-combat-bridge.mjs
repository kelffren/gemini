/* KELO-INDEX
 * area: PVE / ABILITY COMBAT BRIDGE
 * owner: KeloPvEAbilityCombatBridge
 * purpose: translate canonical KeloAbilities ABILITY_CAST into PvE hit requests without owning input/cooldowns/resources
 * public-api: mount
 * do-not: NO HUD, NO mana/cooldown writes, NO loop
 */
const F=Object.freeze;
function distance(a,b){return Math.hypot((a?.x||0)-(b?.x||0),(a?.y||0)-(b?.y||0))}
export function mount({encounters=[],abilities=globalThis.KeloAbilities,events=globalThis.KeloEvents,getPlayer=()=>globalThis.localPlayer}={}){
 if(!abilities?.bus?.on)throw new Error('KELO_ABILITIES_BUS_UNAVAILABLE');
 const stop=abilities.bus.on('ABILITY_CAST',cast=>{
  if(cast?.predicted)return;const p=getPlayer?.();if(!p)return;
  const def=abilities.registry?.get?.(cast.abilityId)||abilities.registry?.get?.(cast.abilityKey)||null;
  const effect=(def?.effects||[]).find(x=>x.type==='damage'),damage=Math.max(1,Number(effect?.amount)||24);
  const range=Math.max(48,Number(def?.targeting?.range||def?.delivery?.radius||def?.delivery?.maxDistance)||96);
  const candidates=[];for(const row of encounters){for(const enemy of row.encounter.snapshot())if(!enemy.dead&&distance(p,enemy)<=range)candidates.push({row,enemy,d:distance(p,enemy)});}
  candidates.sort((a,b)=>a.d-b.d);const hit=candidates[0];if(!hit)return;
  const result=hit.row.world.playerHit(hit.enemy.id,damage,{playerId:p.id||p.playerKey||'local-player',attackId:cast.castId,abilityId:cast.abilityId});
  events?.emit?.('kelo:pve:ability-hit',{enemyId:hit.enemy.id,abilityId:cast.abilityId,damage,result});
 });
 return F({unmount:()=>stop()});
}
