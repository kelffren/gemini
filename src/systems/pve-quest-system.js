/* KELO-INDEX
 * area: PVE / QUESTS
 * owner: KeloQuestAuthority
 * purpose: objetivos PvE event-driven sin polling
 * public-api: create/applyEvent/isComplete
 * consumes: semantic KeloEvents snapshots
 * state-owned: none; server authority persists/rewards
 */
(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.KeloQuestAuthority=Object.freeze(api);})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';const V='pve-quests-v1.0.0';
function create(def){const d=def||{};return{id:String(d.id),type:String(d.type||'WORLD'),regionId:String(d.regionId||''),objectives:(d.objectives||[]).map((o,i)=>({id:o.id||'o'+i,event:String(o.event),targetId:o.targetId||null,required:Math.max(1,Number(o.count)||1),current:0})),state:'ACTIVE',revision:0};}
function applyEvent(q,e){const n=JSON.parse(JSON.stringify(q)),x=e||{};if(n.state!=='ACTIVE')return n;for(const o of n.objectives){if(o.event!==x.type)continue;if(o.targetId&&o.targetId!==x.targetId)continue;o.current=Math.min(o.required,o.current+(Number(x.count)||1));}if(n.objectives.length&&n.objectives.every(o=>o.current>=o.required))n.state='COMPLETE';n.revision++;return n;}function isComplete(q){return!!q&&q.state==='COMPLETE';}
return Object.freeze({version:V,create,applyEvent,isComplete});});