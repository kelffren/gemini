/* KELO-INDEX
 * area: PVE / VERTICAL SLICE
 * owner: KeloVerdantiaCrisis
 * purpose: composición declarativa del primer loop PvE+economía
 * public-api: definition/buildQuestSet
 * consumes: KeloGathering/KeloProductionChain/KeloPvEContracts/KeloQuestAuthority
 * state-owned: none
 */
(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.KeloVerdantiaCrisis=Object.freeze(api);})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';const V='verdantia-crisis-v1.0.0';
const DEF=Object.freeze({id:'verdantia_crisis',regionId:'verdantia',resources:['wheat','olive'],products:['flour','bread','olive_oil'],threats:['verdant_wolf_patrol','verdant_bandit_camp'],success:['camp_cleared','caravan_delivered','food_reserves_recovered'],effects:['route_risk','production_loss','bread_shortage','oil_shortage']});
function buildQuestSet(){return[
{id:'verdantia:farm-relief',type:'SUPPLY',regionId:'verdantia',objectives:[{event:'RESOURCE_DELIVERED',targetId:'wheat',count:20},{event:'RESOURCE_DELIVERED',targetId:'olive',count:12}]},
{id:'verdantia:break-blockade',type:'COMBAT',regionId:'verdantia',objectives:[{event:'CAMP_CLEARED',count:1}]},
{id:'verdantia:restore-route',type:'ESCORT',regionId:'verdantia',objectives:[{event:'CARAVAN_DELIVERED',count:1}]}
];}return Object.freeze({version:V,definition:DEF,buildQuestSet});});