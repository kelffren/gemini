/* KELO-INDEX
 * area: PVE
 * owner: Kelo PvE
 * purpose: data-driven PvE foundation: families, tiers, elites, encounters, bosses and deterministic loot
 * integrates: KeloEvents when present; transport/render/AI agnostic
 */
const F=Object.freeze;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const hash=s=>{let h=2166136261;for(const c of String(s)){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0};
const rngFrom=seed=>{let x=hash(seed)||1;return()=>((x=(Math.imul(x,1664525)+1013904223)>>>0)/4294967296)};

export const PVE_TIERS=F({
  1:F({id:1,label:'Frontier',power:1,hp:1,damage:1,loot:1}),
  2:F({id:2,label:'Veteran',power:1.45,hp:1.55,damage:1.3,loot:1.35}),
  3:F({id:3,label:'Corrupted',power:2.05,hp:2.3,damage:1.75,loot:1.8}),
  4:F({id:4,label:'Mythic',power:3,hp:3.5,damage:2.35,loot:2.5}),
  5:F({id:5,label:'Ascendant',power:4.4,hp:5.1,damage:3.2,loot:3.5})
});

export const CREATURE_FAMILIES=F({
  beast:F({id:'beast',roles:F(['chaser','ambusher','alpha']),resist:'physical'}),
  undead:F({id:'undead',roles:F(['walker','archer','mage','knight','summoner']),resist:'shadow'}),
  bandit:F({id:'bandit',roles:F(['rogue','archer','bruiser','mage','captain']),resist:'none'}),
  elemental:F({id:'elemental',roles:F(['fire','ice','stone','storm','shadow']),resist:'elemental'})
});

export const ELITE_AFFIXES=F({
  burning:F({id:'burning',tags:F(['fire','dot'])}),
  frozen:F({id:'frozen',tags:F(['ice','control'])}),
  storm:F({id:'storm',tags:F(['lightning','burst'])}),
  poison:F({id:'poison',tags:F(['poison','dot'])}),
  phantom:F({id:'phantom',tags:F(['shadow','mobility'])}),
  vampiric:F({id:'vampiric',tags:F(['lifesteal'])}),
  explosive:F({id:'explosive',tags:F(['death-burst'])}),
  armored:F({id:'armored',tags:F(['defense'])}),
  summoner:F({id:'summoner',tags:F(['adds'])})
});

export const ENEMY_RANKS=F({
  normal:F({hp:1,damage:1,loot:1,affixes:0}),
  veteran:F({hp:1.45,damage:1.15,loot:1.25,affixes:0}),
  elite:F({hp:2.2,damage:1.45,loot:1.8,affixes:1}),
  champion:F({hp:3.6,damage:1.85,loot:2.6,affixes:2}),
  corrupted:F({hp:5,damage:2.25,loot:3.5,affixes:2}),
  mythic:F({hp:8,damage:3,loot:5,affixes:3})
});

export function createEnemy(def={},ctx={}){
  const tier=PVE_TIERS[clamp(Number(ctx.tier)||1,1,5)];
  const rank=ENEMY_RANKS[String(ctx.rank||'normal')]||ENEMY_RANKS.normal;
  const party=Math.max(1,Number(ctx.partySize)||1);
  const partyHp=1+Math.max(0,party-1)*0.55;
  const partyDamage=1+Math.max(0,party-1)*0.08;
  const baseHp=Math.max(1,Number(def.hp)||100),baseDamage=Math.max(0,Number(def.damage)||10);
  return F({
    id:String(def.id||'enemy'),family:String(def.family||'beast'),role:String(def.role||'chaser'),
    tier:tier.id,rank:String(ctx.rank||'normal'),
    hp:Math.round(baseHp*tier.hp*rank.hp*partyHp),
    damage:Number((baseDamage*tier.damage*rank.damage*partyDamage).toFixed(2)),
    telegraphMs:Math.max(100,Number(def.telegraphMs)||500),
    recoveryMs:Math.max(0,Number(def.recoveryMs)||350),
    affixSlots:rank.affixes,lootMultiplier:Number((tier.loot*rank.loot).toFixed(3))
  });
}

export function rollAffixes({enemyId='enemy',slots=1,seed='world'}={}){
  const pool=Object.keys(ELITE_AFFIXES),rng=rngFrom(seed+':'+enemyId),out=[];
  while(out.length<Math.min(slots,pool.length)){const i=Math.floor(rng()*pool.length);out.push(pool.splice(i,1)[0])}
  return F(out);
}

export function scaleEncounter({baseCount=4,partySize=1,tier=1}={}){
  const p=Math.max(1,Number(partySize)||1),t=clamp(Number(tier)||1,1,5);
  return F({
    enemyCount:Math.max(1,Math.round(baseCount*(1+(p-1)*0.65))),
    eliteChance:Number(clamp(0.05+(t-1)*0.04+(p-1)*0.025,0,0.45).toFixed(3)),
    championChance:Number(clamp((t-1)*0.015+(p-1)*0.01,0,0.18).toFixed(3))
  });
}

export function rollLoot(table=[],{seed='world',multiplier=1}={}){
  const rng=rngFrom(seed),m=Math.max(0,Number(multiplier)||0),drops=[];
  for(const row of table){
    if(!row||!row.id)continue;
    const guaranteed=row.guaranteed===true;
    const chance=clamp(Number(row.chance)||0,0,1);
    if(guaranteed||rng()<clamp(chance*m,0,1)){
      const min=Math.max(1,Math.floor(Number(row.min)||1)),max=Math.max(min,Math.floor(Number(row.max)||min));
      drops.push(F({id:String(row.id),quantity:min+Math.floor(rng()*(max-min+1)),kind:String(row.kind||'material')}));
    }
  }
  return F(drops);
}

export function createBossProgression(def={}){
  const bossId=String(def.id||'boss');
  const unlocks=F([...(def.firstKillUnlocks||[])].map(String));
  const loot=F([...(def.loot||[])]);
  return F({
    bossId,requiredTier:clamp(Number(def.requiredTier)||1,1,5),firstKillUnlocks:unlocks,
    resolveKill({playerId='player',killCount=0,seed='world'}={}){
      const firstKill=Number(killCount)===0;
      const drops=rollLoot(loot,{seed:seed+':'+bossId+':'+playerId+':'+killCount,multiplier:1});
      const result=F({bossId,playerId:String(playerId),firstKill,unlocks:firstKill?unlocks:F([]),drops});
      globalThis.KeloEvents?.emit?.('kelo:pve:boss-defeated',result);
      return result;
    }
  });
}

export function createPveDirector({worldTier=1,night=false}={}){
  let tier=clamp(Number(worldTier)||1,1,5),isNight=night===true;
  return F({
    get worldTier(){return tier},get night(){return isNight},
    setWorldTier(next){tier=clamp(Number(next)||1,1,5);globalThis.KeloEvents?.emit?.('kelo:pve:tier-changed',{tier});return tier},
    setNight(value){isNight=value===true;globalThis.KeloEvents?.emit?.('kelo:pve:day-cycle',{night:isNight});return isNight},
    encounter(input={}){const base=scaleEncounter({...input,tier});return F({...base,night:isNight,rareBonus:isNight?0.15:0})}
  });
}
