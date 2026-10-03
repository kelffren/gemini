/* KELO-INDEX
 * area: PVE / LOOT
 * owner: KeloLootAuthority
 * purpose: tablas y rolls deterministas de loot; autoridad/persistencia externa
 * public-api: getTable/roll/requestAward
 * state-owned: none
 * do-not: NO inventory writes, NO Math.random authority
 */
(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.KeloLootAuthority=Object.freeze(api);})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
const VERSION='pve-loot-v1.0.0';
const TABLES=Object.freeze({
wolf_basic:{guaranteed:[{id:'raw_meat',min:1,max:2}],pools:[{chance:.65,items:[{id:'hide',weight:75},{id:'bone',weight:25}]}]},
bandit_basic:{guaranteed:[{id:'bandit_token',min:1,max:1}],pools:[{chance:.55,items:[{id:'iron_scrap',weight:55},{id:'bread',weight:30},{id:'herb',weight:15}]}]},
bandit_captain:{guaranteed:[{id:'bandit_token',min:3,max:5},{id:'captain_emblem',min:1,max:1}],pools:[{chance:.7,items:[{id:'rare_metal_fragment',weight:65},{id:'weapon_component',weight:35}]}]}
});
const clone=x=>x?JSON.parse(JSON.stringify(x)):null;function getTable(id){return clone(TABLES[String(id)]);}
function hash(seed){let h=2166136261;for(const ch of String(seed||'')){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}function rng(seed){let x=hash(seed)||1;return()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return(x>>>0)/4294967296;};}
function qty(row,r){const a=Math.max(0,row.min|0),b=Math.max(a,row.max|0);return a+Math.floor(r()*(b-a+1));}
function roll(tableId,seed){const t=TABLES[String(tableId)];if(!t)return{ok:false,error:'LOOT_TABLE_NOT_FOUND',items:[]};const r=rng(seed),out=[];(t.guaranteed||[]).forEach(x=>out.push({itemId:x.id,quantity:qty(x,r)}));(t.pools||[]).forEach(p=>{if(r()>Number(p.chance||0))return;const total=p.items.reduce((s,x)=>s+Number(x.weight||0),0);let n=r()*total,pick=p.items[p.items.length-1];for(const x of p.items){n-=Number(x.weight||0);if(n<=0){pick=x;break;}}out.push({itemId:pick.id,quantity:1});});return{ok:true,tableId:String(tableId),seed:String(seed),items:out};}
async function requestAward(command,authority){if(!authority||typeof authority.transact!=='function')return{ok:false,error:'AUTHORITY_ADAPTER_REQUIRED'};return authority.transact({type:'AwardPvELoot',encounterId:String(command.encounterId),actorId:String(command.actorId),lootTableId:String(command.lootTableId),revision:command.revision==null?null:String(command.revision)});}
return Object.freeze({version:VERSION,getTable,roll,requestAward});});