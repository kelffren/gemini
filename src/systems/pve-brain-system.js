/* KELO-INDEX
 * area: PVE / AI
 * owner: KeloPvEBrain
 * purpose: decisiones PvE puras/data-driven; movement/combat owners ejecutan intents
 * public-api: getProfile/decide
 * consumes: actor/player snapshots only
 * state-owned: none
 * do-not: NO movement writes, NO attacks, NO timers, NO render
 */
(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.KeloPvEBrain=Object.freeze(api);})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
const VERSION='pve-brain-v1.0.0';
const PROFILES=Object.freeze({
pack_melee:{aggro:220,attack:48,leash:420,retreatHp:0.12,tactic:'melee'},
melee_guard:{aggro:190,attack:52,leash:360,retreatHp:0.08,tactic:'melee'},
ranged_kite:{aggro:260,attack:180,minRange:90,leash:430,retreatHp:0.1,tactic:'ranged'},
captain:{aggro:240,attack:60,leash:400,retreatHp:0,tactic:'captain'}
});
const clone=x=>x?JSON.parse(JSON.stringify(x)):null;function getProfile(id){return clone(PROFILES[String(id)]);}
function decide(actor,world){if(!actor||Number(actor.hp)<=0)return{type:'DEAD'};const p=PROFILES[actor.brainProfile];if(!p)return{type:'IDLE'};const w=world||{},target=w.target;if(!target)return{type:'IDLE'};const spawn=w.spawn||{x:actor.x,y:actor.y},dist=Math.hypot((target.x||0)-actor.x,(target.y||0)-actor.y),home=Math.hypot(actor.x-(spawn.x||0),actor.y-(spawn.y||0)),hp=actor.maxHp?actor.hp/actor.maxHp:1;if(home>p.leash)return{type:'RETURN_HOME',x:spawn.x,y:spawn.y};if(hp<=p.retreatHp)return{type:'RETREAT',fromId:target.id||null};if(dist>p.aggro)return{type:'IDLE'};if(p.tactic==='ranged'&&dist<p.minRange)return{type:'REPOSITION',fromId:target.id||null};if(dist<=p.attack)return{type:'ATTACK',targetId:target.id||null};return{type:'CHASE',targetId:target.id||null};}
return Object.freeze({version:VERSION,getProfile,decide});});