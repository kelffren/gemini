/* KELO-INDEX
 * area: PVE / WORLD PRESSURE
 * owner: KeloPvERegionalThreat
 * purpose: resolver presión PvE regional y consecuencias económicas declarativas
 * public-api: create/apply/derive
 * consumes: camp/event summaries; KeloRegionalEconomy consumes derived effects
 * state-owned: none; authority persists snapshots
 * do-not: NO direct economy writes, NO timers
 */
(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.KeloPvERegionalThreat=Object.freeze(api);})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
const V='pve-regional-threat-v1.0.0',clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function create(regionId){return{regionId:String(regionId),pressure:0,camps:0,routeIncidents:0,lastRevision:0};}
function apply(state,event){const s=Object.assign({},state),e=event||{};if(e.type==='CAMP_ACTIVE'){s.camps++;s.pressure+=Number(e.amount)||5;}if(e.type==='CAMP_CLEARED'){s.camps=Math.max(0,s.camps-1);s.pressure-=Number(e.amount)||12;}if(e.type==='ROUTE_ATTACKED'){s.routeIncidents++;s.pressure+=Number(e.amount)||4;}if(e.type==='ENCOUNTER_RESOLVED')s.pressure-=Number(e.amount)||2;if(e.type==='RECOVERY')s.pressure-=Number(e.amount)||3;s.pressure=clamp(s.pressure,0,100);s.lastRevision++;return s;}
function derive(s){const p=clamp(Number(s&&s.pressure)||0,0,100);let band='CALM';if(p>=75)band='CRISIS';else if(p>=50)band='DANGEROUS';else if(p>=25)band='UNSTABLE';return{band,pressure:p,routeRiskBonus:+(p*.002).toFixed(3),productionMultiplier:+Math.max(.65,1-p*.0035).toFixed(3),guardDemand:p>=25,escortDemand:p>=35,clearCampDemand:(s&&s.camps||0)>0,worldBossEligible:p>=75};}
return Object.freeze({version:V,create,apply,derive});});