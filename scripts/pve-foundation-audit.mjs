import assert from 'node:assert/strict';
import {createEnemy,rollAffixes,scaleEncounter,rollLoot,createBossProgression,createPveDirector} from '../src/pve/pve-foundation.mjs';

const solo=createEnemy({id:'wolf',hp:100,damage:10},{tier:1,partySize:1});
const party=createEnemy({id:'wolf',hp:100,damage:10},{tier:1,partySize:4});
assert.ok(party.hp>solo.hp);
assert.ok(party.damage>solo.damage);
assert.deepEqual(rollAffixes({enemyId:'alpha',slots:2,seed:'x'}),rollAffixes({enemyId:'alpha',slots:2,seed:'x'}));
assert.ok(scaleEncounter({baseCount:4,partySize:4,tier:3}).enemyCount>4);
assert.deepEqual(rollLoot([{id:'core',guaranteed:true,min:1,max:1}],{seed:'x'}),[{id:'core',quantity:1,kind:'material'}]);
const boss=createBossProgression({id:'golem',firstKillUnlocks:['tier-2'],loot:[{id:'earth-core',guaranteed:true}]});
assert.deepEqual(boss.resolveKill({killCount:0}).unlocks,['tier-2']);
assert.deepEqual(boss.resolveKill({killCount:1}).unlocks,[]);
const director=createPveDirector({worldTier:2,night:true});
assert.equal(director.encounter({baseCount:4}).night,true);
assert.equal(director.encounter({baseCount:4}).rareBonus,0.15);
console.log('pve-foundation-audit: ok');
