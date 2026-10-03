import assert from 'node:assert/strict';import {createSpawnPlan,createEncounterRuntime} from '../src/pve/pve-runtime.mjs';import {bindPveCombat} from '../src/pve/pve-combat-adapter.mjs';
const plan=createSpawnPlan({encounterId:'combat',count:1,center:{x:20,y:0},radius:0,seed:'x'});
const encounter=createEncounterRuntime(plan,{lootTable:[{id:'hide',guaranteed:true}]});
const fakeEngine={attack({target,profile}){target.hp-=profile.damage;return{ok:true,hp:target.hp,killed:target.hp<=0}}};
const bridge=bindPveCombat({encounter,combatEngine:fakeEngine,eventBus:null});
const target=bridge.targets[0],before=target.hp;const hit=bridge.melee({attacker:{id:'p',x:0,y:0},targetId:target.id,profile:{damage:before+1}});
assert.equal(hit.killed,true);assert.equal(target.hp,0);encounter.finalizeDeath(target.id,{seed:'x'});assert.equal(encounter.cleared,true);assert.equal(encounter.actor(target.id).snapshot.events.some(e=>e.type==='enemy-defeated'),true);
console.log('pve-combat-adapter-audit: ok');
