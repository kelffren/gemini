/* KELO-INDEX
 * area: PVE / CAMPS
 * owner: KeloPvECamps
 * purpose: state machine pura para crecimiento/alarma/limpieza de camps
 * public-api: create/applyEvent/effect
 * state-owned: none; world-event authority persists
 */
(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.KeloPvECamps=Object.freeze(api);})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
const VERSION='pve-camps-v1.0.0';
function create(id,opts){const o=opts||{};return{id:String(id),regionId:String(o.regionId||'verdantia'),level:Math.max(1,Math.min(3,Number(o.level)||1)),alarm:0,supplies:Math.max(0,Number(o.supplies)||20),leaderAlive:true,state:'active',revision:0};}
function applyEvent(camp,event){const c=Object.assign({},camp),e=event||{};if(c.state!=='active')return c;if(e.type==='PLAYER_SPOTTED')c.alarm=Math.min(100,c.alarm+25);if(e.type==='SUPPLIES_STOLEN')c.supplies=Math.max(0,c.supplies-(Number(e.amount)||5));if(e.type==='LEADER_KILLED')c.leaderAlive=false;if(e.type==='GROWTH_TICK'&&c.supplies>=30)c.level=Math.min(3,c.level+1);if(!c.leaderAlive&&c.supplies<=0)c.state='cleared';c.revision++;return c;}
function effect(c){const level=Math.max(0,Number(c&&c.level)||0),active=c&&c.state==='active';return{routeRisk:active?level*.08:0,regionalThreat:active?level*5:0,contractTags:active?['clear_camp','escort']:[]};}
return Object.freeze({version:VERSION,create,applyEvent,effect});});