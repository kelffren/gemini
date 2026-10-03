/* KELO-INDEX
 * area: PVE / PLAYER COMBAT ADAPTER
 * owner: KeloPvEPlayerCombatAdapter
 * purpose: consume canonical combat attack requests and route valid player hits to visible PvE encounter
 * public-api: mount
 * do-not: NO button/input owner, NO loop, NO direct inventory
 */
const F=Object.freeze;
function dist(a,b){return Math.hypot((a?.x||0)-(b?.x||0),(a?.y||0)-(b?.y||0))}
export function mount({world,encounter,events=globalThis.KeloEvents,getPlayer=()=>globalThis.localPlayer,range=72,damage=24}={}){
 if(!world||!encounter||!events?.on)throw new Error('PVE_PLAYER_COMBAT_ADAPTER_FOUNDATION');
 const stop=events.on('combat:attack_requested',req=>{
  const p=getPlayer?.();if(!p)return;const r=Math.max(24,Number(req?.profile?.range||req?.range)||range);
  const rows=encounter.snapshot().filter(e=>!e.dead&&dist(p,e)<=r).sort((a,b)=>dist(p,a)-dist(p,b));if(!rows.length)return;
  const target=rows[0],amount=Math.max(1,Number(req?.profile?.damage||req?.damage)||damage);
  const result=world.playerHit(target.id,amount,{playerId:p.id||p.playerKey||'local-player',attackId:req?.attackId||null});
  events.emit('kelo:pve:player-hit',{enemyId:target.id,amount,result});
 });
 return F({unmount:()=>stop(),nearest:()=>{const p=getPlayer?.();return p?encounter.snapshot().filter(e=>!e.dead).sort((a,b)=>dist(p,a)-dist(p,b))[0]||null:null}});
}
