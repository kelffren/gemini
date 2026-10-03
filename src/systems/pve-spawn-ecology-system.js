/* KELO-INDEX
 * area: PVE / SPAWN ECOLOGY
 * owner: KeloPvESpawnEcology
 * purpose: deterministic regional spawn budgets without loops/timers
 * public-api: getRegion/planSpawn
 * state-owned: none; authority owns live actors/cooldowns
 */
(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.KeloPvESpawnEcology=Object.freeze(api);})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';const V='pve-spawn-ecology-v1.0.0';
const REGIONS=Object.freeze({verdantia:{budget:16,zones:{farm_edge:{budget:5,pool:[['verdant_wolf',1]]},forest:{budget:6,pool:[['verdant_wolf',1]]},road:{budget:6,pool:[['bandit_raider',2],['bandit_archer',2]]},bandit_camp:{budget:10,pool:[['bandit_raider',2],['bandit_archer',2],['bandit_captain',6]]}}}});
const clone=x=>x?JSON.parse(JSON.stringify(x)):null;function getRegion(id){return clone(REGIONS[String(id)]);}
function rnd(seed){let h=2166136261;for(const c of String(seed))h=Math.imul(h^c.charCodeAt(0),16777619);return()=>((h=Math.imul(h^h>>>16,2246822507))>>>0)/4294967296;}
function planSpawn(regionId,zoneId,seed,ctx){const r=REGIONS[regionId],z=r&&r.zones[zoneId];if(!z)return{ok:false,error:'SPAWN_ZONE_NOT_FOUND',actors:[]};const c=ctx||{},occupied=Math.max(0,Number(c.occupiedCost)||0),pressure=Math.max(0,Math.min(100,Number(c.threatPressure)||0)),cap=Math.min(r.budget,z.budget+Math.floor(pressure/35)),available=Math.max(0,cap-occupied),random=rnd(seed),actors=[];let left=available,guard=0;while(left>0&&guard++<32){const v=z.pool.filter(x=>x[1]<=left);if(!v.length)break;const p=v[Math.floor(random()*v.length)];actors.push(p[0]);left-=p[1];}return{ok:true,regionId,zoneId,actors,budget:cap,budgetUnused:left};}
return Object.freeze({version:V,getRegion,planSpawn});});