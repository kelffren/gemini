import assert from 'node:assert/strict';
import {generatePoiDeck,generateDungeon,createBossPity,createStoneRewardIntent,createInvasion,createWorldProgression} from '../src/pve/pve-world-content.mjs';
assert.deepEqual(generatePoiDeck({seed:'a'}),generatePoiDeck({seed:'a'}));
const d=generateDungeon({id:'crypt',tier:2,seed:'x',rooms:8});assert.equal(d.nodes[0].type,'entrance');assert.equal(d.nodes.at(-1).type,'boss');
const pity=createBossPity({rareEvery:3,legendaryEvery:5});assert.equal(pity.resolve({killsSinceRare:2}).forceRare,true);assert.equal(pity.resolve({killsSinceLegendary:4}).forceLegendary,true);
const reward=createStoneRewardIntent({biomeId:'emberreach',worldTier:3,boss:true,seed:'x'});assert.equal(reward.authorityCommitRequired,true);assert.ok(['fire','earth'].includes(reward.element));
const invasion=createInvasion({tier:4,partySize:4,seed:'x'});assert.equal(invasion.waves.at(-1).boss,true);assert.ok(invasion.waves.length>=5);
const progression=createWorldProgression();progression.defeatBoss({bossId:'golem',unlocks:['tier:2','biome:duskfen']});assert.equal(progression.has('tier:2'),true);
console.log('pve-world-content-audit: ok');
