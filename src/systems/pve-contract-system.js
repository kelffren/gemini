/* KELO-INDEX
 * area: PVE / CONTRACTS
 * owner: KeloPvEContracts
 * purpose: traducir problemas reales del mundo en contratos PvE data-driven
 * public-api: propose
 * consumes: regional threat + economy shortage summaries
 * state-owned: none
 * do-not: NO rewards/inventory mutation
 */
(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.KeloPvEContracts=Object.freeze(api);})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
const V='pve-contracts-v1.0.0';
function propose(input){const x=input||{},out=[],region=String(x.regionId||'region'),t=x.threat||{},shortages=Array.isArray(x.shortages)?x.shortages:[];if(t.clearCampDemand)out.push({id:region+':clear-camp',type:'CLEAR_CAMP',regionId:region,objective:{event:'CAMP_CLEARED',count:1},reason:'ACTIVE_HOSTILE_CAMP'});if(t.escortDemand)out.push({id:region+':escort',type:'ESCORT_CARAVAN',regionId:region,objective:{event:'CARAVAN_DELIVERED',count:1},reason:'ROUTE_DANGER'});for(const s of shortages.slice(0,3)){const resourceId=String(s.resourceId||'');if(!resourceId)continue;out.push({id:region+':supply:'+resourceId,type:'SUPPLY',regionId:region,objective:{event:'RESOURCE_DELIVERED',resourceId,count:Math.max(1,Number(s.targetAmount)||10)},reason:'SHORTAGE'});}if(t.worldBossEligible)out.push({id:region+':crisis-hunt',type:'CRISIS_HUNT',regionId:region,objective:{event:'REGIONAL_CRISIS_RESOLVED',count:1},reason:'CRISIS_PRESSURE'});return out;}
return Object.freeze({version:V,propose});});