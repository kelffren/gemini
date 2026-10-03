/* KELO-INDEX
 * area: PVE / SETTLEMENTS
 * owner: KeloPvESettlementImpact
 * purpose: derivar consecuencias PvE sobre reservas/seguridad/producción sin duplicar economía
 * public-api: create/applySnapshot
 * consumes: threat + world-event effects
 * state-owned: none
 */
(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.KeloPvESettlementImpact=Object.freeze(api);})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';const V='pve-settlement-impact-v1.0.0',clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function create(id){return{id:String(id),security:75,prosperity:60,foodReserve:60,productionCapacity:1,threatPressure:0,status:'STABLE'};}
function applySnapshot(s,input){const n=Object.assign({},s),x=input||{},p=clamp(Number(x.threatPressure)||0,0,100),pen=clamp(Number(x.productionPenalty)||0,0,.5);n.threatPressure=p;n.security=clamp(Math.round(85-p*.55),0,100);n.productionCapacity=+(Math.max(.5,1-p*.0035-pen)).toFixed(3);n.foodReserve=clamp(Number(n.foodReserve)+(Number(x.foodDelta)||0),0,100);n.prosperity=clamp(Math.round(70-p*.25-(1-n.productionCapacity)*30),0,100);n.status=p>=75?'CRISIS':p>=50?'THREATENED':p>=25?'STRAINED':'STABLE';return n;}
return Object.freeze({version:V,create,applySnapshot});});