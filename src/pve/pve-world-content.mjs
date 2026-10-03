/* KELO-INDEX
 * area: PVE / WORLD CONTENT
 * owner: Kelo PvE
 * purpose: biomes, POIs, dungeon graphs, invasions, boss pity and PvE->stone reward intents
 * rule: produces deterministic content/reward intents; inventory/network authority commits elsewhere
 */
const F=Object.freeze;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const hash=s=>{let h=2166136261;for(const c of String(s)){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0};
const rngFrom=seed=>{let x=hash(seed)||1;return()=>((x=(Math.imul(x,1664525)+1013904223)>>>0)/4294967296)};
const pick=(rows,rng)=>rows[Math.floor(rng()*rows.length)];

export const BIOMES=F({
  greenwild:F({id:'greenwild',tier:1,families:F(['beast','bandit']),elements:F(['earth','wind']),hazards:F([])}),
  duskfen:F({id:'duskfen',tier:2,families:F(['beast','undead']),elements:F(['poison','shadow']),hazards:F(['toxic-pools'])}),
  emberreach:F({id:'emberreach',tier:3,families:F(['elemental','bandit']),elements:F(['fire','earth']),hazards:F(['lava-bursts'])}),
  frostveil:F({id:'frostveil',tier:4,families:F(['undead','elemental']),elements:F(['ice','light']),hazards:F(['whiteout'])}),
  voidscar:F({id:'voidscar',tier:5,families:F(['undead','elemental']),elements:F(['shadow','lightning']),hazards:F(['void-rifts'])})
});

export const POI_TYPES=F(['camp','ruin','cave','altar','caravan','mine','tower','portal','micro-dungeon','world-event']);

export function generatePoiDeck({biomeId='greenwild',seed='world',count=8}={}){
  const biome=BIOMES[biomeId]||BIOMES.greenwild,rng=rngFrom(seed+':'+biome.id),out=[];
  for(let i=0;i<Math.max(1,count);i++)out.push(F({id:biome.id+'-poi-'+i,type:pick(POI_TYPES,rng),family:pick(biome.families,rng),tier:biome.tier}));
  return F(out);
}

const ROOM_TYPES=F(['combat','combat','event','treasure','elite','puzzle']);
export function generateDungeon({id='dungeon',tier=1,seed='world',rooms=7}={}){
  const rng=rngFrom(seed+':'+id),count=clamp(Math.floor(rooms),4,20),nodes=[F({id:'entrance',type:'entrance',depth:0})];
  for(let i=1;i<count-1;i++)nodes.push(F({id:'room-'+i,type:pick(ROOM_TYPES,rng),depth:i}));
  nodes.push(F({id:'boss',type:'boss',depth:count-1}));
  const edges=[];for(let i=0;i<nodes.length-1;i++)edges.push(F({from:nodes[i].id,to:nodes[i+1].id}));
  if(count>=7&&rng()>.35)edges.push(F({from:'room-2',to:'room-'+Math.min(count-2,4),optional:true}));
  return F({id:String(id),tier:clamp(Number(tier)||1,1,5),nodes:F(nodes),edges:F(edges)});
}

export function createBossPity({rareEvery=8,legendaryEvery=25}={}){
  const rare=Math.max(2,Math.floor(rareEvery)),legendary=Math.max(rare,Math.floor(legendaryEvery));
  return F({
    resolve({killsSinceRare=0,killsSinceLegendary=0}={}){
      const nextRare=Math.max(0,Math.floor(killsSinceRare))+1,nextLegendary=Math.max(0,Math.floor(killsSinceLegendary))+1;
      return F({forceRare:nextRare>=rare,forceLegendary:nextLegendary>=legendary,rareCounter:nextRare,legendaryCounter:nextLegendary});
    }
  });
}

const STONE_TIERS=F(['Common','Rare','Epic','Legendary','Mythic','Divine']);
export function createStoneRewardIntent({biomeId='greenwild',worldTier=1,source='pve',seed='world',boss=false,pity=null}={}){
  const biome=BIOMES[biomeId]||BIOMES.greenwild,rng=rngFrom(seed+':stone:'+biome.id),tier=clamp(Number(worldTier)||1,1,5);
  const element=pick(biome.elements,rng);
  const forms=['projectile','nova','chain','dash','shield','vortex','wall','trap','aura'];
  let rarity=Math.min(STONE_TIERS.length-1,Math.max(0,tier-1+(boss&&rng()>.55?1:0)));
  if(pity?.forceRare)rarity=Math.max(rarity,1);
  if(pity?.forceLegendary)rarity=Math.max(rarity,3);
  return F({kind:'stone-reward-intent',source:String(source),element,form:pick(forms,rng),tier:STONE_TIERS[rarity],bound:false,authorityCommitRequired:true});
}

export function createInvasion({id='invasion',tier=1,partySize=1,seed='world'}={}){
  const t=clamp(Number(tier)||1,1,5),p=Math.max(1,Number(partySize)||1),rng=rngFrom(seed+':'+id);
  const waves=3+Math.floor(t/2)+Math.min(2,Math.floor((p-1)/2));
  const rows=[];
  for(let i=1;i<=waves;i++)rows.push(F({wave:i,count:Math.round((4+t*2)*(1+(p-1)*.55)),eliteChance:Number((.06+t*.035+i*.012).toFixed(3)),boss:i===waves}));
  return F({id:String(id),tier:t,prepSeconds:300,waves:F(rows),victory:F({cityBuffMinutes:30,merchantChance:Number((.2+rng()*.25).toFixed(3)),temporaryDungeon:true}),defeat:F({occupationMinutes:10+t*5,npcServicePenalty:Number((.05+t*.02).toFixed(2))})});
}

export function createWorldProgression(){
  const defeated=new Set(),unlocks=new Set(['biome:greenwild','tier:1']);
  return F({
    defeatBoss({bossId,unlocks:rows=[]}){defeated.add(String(bossId));for(const row of rows)unlocks.add(String(row));return this.snapshot()},
    has(value){return unlocks.has(String(value))},
    snapshot(){return F({defeatedBosses:F([...defeated].sort()),unlocks:F([...unlocks].sort())})}
  });
}
