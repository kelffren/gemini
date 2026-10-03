/* KELO-INDEX
 * area: PVE / WORLD EVENTS
 * owner: KeloPvEWorldEvents
 * purpose: lifecycle puro de crisis regionales
 * public-api: create/apply/derive
 * state-owned: none; authority persists
 * do-not: NO timers, NO economy writes
 */
(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.KeloPvEWorldEvents=Object.freeze(api);})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
const V='pve-world-events-v1.0.0';
function create(id,type,regionId){return{id:String(id),type:String(type),regionId:String(regionId),state:'DORMANT',progress:0,failPressure:0,revision:0};}
function apply(s,e){const n=Object.assign({},s),x=e||{};if(x.type==='ACTIVATE'&&n.state==='DORMANT')n.state='WARNING';else if(x.type==='BEGIN'&&n.state==='WARNING')n.state='ACTIVE';else if(x.type==='CONTRIBUTION'&&['ACTIVE','ESCALATED'].includes(n.state)){n.progress=Math.min(100,n.progress+(Number(x.amount)||0));if(n.progress>=100)n.state='RESOLVED';}else if(x.type==='PRESSURE'&&['ACTIVE','ESCALATED'].includes(n.state)){n.failPressure=Math.min(100,n.failPressure+(Number(x.amount)||0));if(n.failPressure>=70)n.state='ESCALATED';if(n.failPressure>=100)n.state='FAILED';}else if(x.type==='RECOVER'&&['RESOLVED','FAILED'].includes(n.state))n.state='RECOVERY';n.revision++;return n;}
function derive(s){const active=['WARNING','ACTIVE','ESCALATED'].includes(s.state);return{active,state:s.state,productionPenalty:s.state==='ESCALATED'?.2:s.state==='ACTIVE'?.1:0,routeRiskBonus:s.state==='ESCALATED'?.15:s.state==='ACTIVE'?.07:0,contractPriority:s.state==='ESCALATED'?3:active?2:0};}
return Object.freeze({version:V,create,apply,derive});});