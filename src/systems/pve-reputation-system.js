/* KELO-INDEX
 * area: PVE / REPUTATION
 * owner: KeloPvEReputation
 * purpose: pure regional reputation progression from semantic PvE events
 * public-api: create/applyEvent/tier
 * state-owned: none; server persists profile
 */
(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.KeloPvEReputation=Object.freeze(api);})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';const V='pve-reputation-v1.0.0',PTS={CAMP_CLEARED:35,CARAVAN_DELIVERED:20,REGIONAL_CRISIS_RESOLVED:100,RESOURCE_DELIVERED:2,ELITE_KILLED:15};
function create(playerId,regionId){return{playerId:String(playerId),regionId:String(regionId),points:0,revision:0};}function tier(p){const n=Number(p&&p.points)||0;return n>=500?'CHAMPION':n>=250?'ALLY':n>=100?'TRUSTED':n>=25?'KNOWN':'NEUTRAL';}
function applyEvent(p,e){const n=Object.assign({},p),x=e||{},base=PTS[x.type]||0,mult=x.type==='RESOURCE_DELIVERED'?Math.max(1,Number(x.count)||1):1;n.points=Math.max(0,n.points+base*mult);n.revision++;return n;}return Object.freeze({version:V,create,applyEvent,tier});});