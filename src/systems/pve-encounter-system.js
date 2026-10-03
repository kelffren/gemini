/* KELO-INDEX
 * area: PVE / ENCOUNTERS
 * owner: KeloEncounterDirector
 * purpose: composición y lifecycle puro de encuentros por presupuesto
 * public-api: getDefinition/build/startState/applyEvent
 * consumes: KeloPvEActors definitions externally
 * state-owned: none; live state authority owns
 */
(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.KeloEncounterDirector=Object.freeze(api);})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
const VERSION='pve-encounters-v1.0.0';
const DEFS=Object.freeze({
verdant_wolf_patrol:{type:'patrol',budget:3,pool:[['verdant_wolf',1]],objective:'clear',rewardProfile:'local_safety_small'},
verdant_bandit_ambush:{type:'ambush',budget:5,pool:[['bandit_raider',2],['bandit_archer',2]],objective:'clear',rewardProfile:'route_safety_small'},
verdant_bandit_camp:{type:'camp',budget:10,pool:[['bandit_raider',2],['bandit_archer',2],['bandit_captain',6]],objective:'clear_leader',rewardProfile:'route_safety_large'}
});
const clone=x=>x?JSON.parse(JSON.stringify(x)):null;function getDefinition(id){return clone(DEFS[String(id)]);}
function seeded(seed){let h=0;for(const c of String(seed||''))h=(Math.imul(h,31)+c.charCodeAt(0))|0;return()=>((h=Math.imul(h^h>>>15,1|h)+0x6D2B79F5|0)>>>0)/4294967296;}
function build(id,seed){const d=DEFS[String(id)];if(!d)return{ok:false,error:'ENCOUNTER_NOT_FOUND'};const r=seeded(seed),actors=[],pool=d.pool.slice();let budget=d.budget,guard=0;while(budget>0&&guard++<64){const viable=pool.filter(x=>x[1]<=budget);if(!viable.length)break;const pick=viable[Math.floor(r()*viable.length)];actors.push(pick[0]);budget-=pick[1];}if(d.type==='camp'&&!actors.includes('bandit_captain')){const cost=6;while(actors.length&&budget<cost){const x=actors.pop();budget+=pool.find(p=>p[0]===x)[1];}if(budget>=cost){actors.push('bandit_captain');budget-=cost;}}return{ok:true,encounterId:String(id),seed:String(seed),actors,budgetUnused:budget,objective:d.objective,rewardProfile:d.rewardProfile};}
function startState(plan){if(!plan||!plan.ok)return null;return{encounterId:plan.encounterId,state:'active',remaining:plan.actors.length,kills:0,leaderKilled:false,startedAt:0};}
function applyEvent(state,event){const s=Object.assign({},state),e=event||{};if(s.state!=='active')return s;if(e.type==='ACTOR_KILLED'){s.kills++;s.remaining=Math.max(0,s.remaining-1);if(e.definitionId==='bandit_captain')s.leaderKilled=true;}const d=DEFS[s.encounterId];if(d&&((d.objective==='clear'&&s.remaining===0)||(d.objective==='clear_leader'&&s.leaderKilled)))s.state='complete';return s;}
return Object.freeze({version:VERSION,getDefinition,build,startState,applyEvent});});