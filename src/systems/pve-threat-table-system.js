/* KELO-INDEX
 * area: PVE / AGGRO
 * owner: KeloPvEThreat
 * purpose: pure threat-table targeting/leash/reset decisions
 * public-api: create/add/decay/selectTarget/reset
 * state-owned: actor combat snapshot only when authority applies returned state
 */
(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.KeloPvEThreat=Object.freeze(api);})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';const V='pve-threat-v1.0.0';
function create(actorId){return{actorId:String(actorId),entries:{},revision:0};}function add(t,targetId,amount,reason){const n={actorId:t.actorId,entries:Object.assign({},t.entries),revision:(t.revision||0)+1},id=String(targetId),a=Math.max(0,Number(amount)||0),old=n.entries[id]||{threat:0};n.entries[id]={threat:old.threat+a,lastReason:String(reason||'damage')};return n;}
function decay(t,factor){const n={actorId:t.actorId,entries:{},revision:(t.revision||0)+1},f=Math.max(0,Math.min(1,Number(factor)||.9));for(const [id,e] of Object.entries(t.entries||{})){const v=e.threat*f;if(v>=.5)n.entries[id]={threat:v,lastReason:e.lastReason};}return n;}
function selectTarget(t,validIds,currentId,switchRatio){const valid=new Set((validIds||[]).map(String)),rows=Object.entries(t.entries||{}).filter(([id])=>valid.has(id)).sort((a,b)=>b[1].threat-a[1].threat);if(!rows.length)return null;const best=rows[0],cur=currentId&&t.entries[String(currentId)];const ratio=Math.max(1,Number(switchRatio)||1.15);if(cur&&valid.has(String(currentId))&&best[0]!==String(currentId)&&best[1].threat<cur.threat*ratio)return String(currentId);return best[0];}
function reset(t){return{actorId:t.actorId,entries:{},revision:(t.revision||0)+1};}return Object.freeze({version:V,create,add,decay,selectTarget,reset});});