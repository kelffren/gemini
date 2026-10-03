/* KELO-INDEX
 * area: PVE / LIVE DEPENDENCIES
 * owner: KeloPvELiveDependencies
 * purpose: load canonical PvE owners sequentially before visible encounter mount
 * do-not: NO second loader, NO gameplay loop
 */
const FILES=[
 '../systems/combat/combat-schema.js','../systems/combat/hit-resolver.js','../systems/combat/damage-resolver.js','../systems/combat/combat-engine.js',
 '../systems/backpack-system.js','../systems/container-system.js',
 '../systems/pve-brain-system.js','../systems/pve-threat-table-system.js','../systems/pve-loot-claim-system.js','../systems/pve-reputation-system.js'
];
function loaded(src){const base=new URL(src,import.meta.url).pathname;return [...document.scripts].some(s=>{try{return new URL(s.src,location.href).pathname===base}catch(_){return false}})}
function script(src){return new Promise((resolve,reject)=>{if(loaded(src))return resolve(true);const s=document.createElement('script');s.src=new URL(src,import.meta.url).href;s.async=false;s.onload=()=>resolve(true);s.onerror=()=>reject(new Error('PVE_DEPENDENCY_LOAD_FAILED:'+src));document.head.appendChild(s)})}
export async function ensurePveLiveDependencies(){for(const src of FILES)await script(src);const ready=!!(globalThis.KeloCombatEngine&&globalThis.KeloContainers&&globalThis.KeloPvEBrain&&globalThis.KeloPvEThreat&&globalThis.KeloPvELootClaims);globalThis.KELO_PVE_LIVE_DEPENDENCY_AUDIT=Object.freeze({ready,files:FILES.slice()});if(!ready)throw new Error('PVE_CANONICAL_OWNERS_UNAVAILABLE');return true;}
