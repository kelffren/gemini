import assert from 'node:assert/strict';import {createGreenwildRun} from '../src/pve/greenwild-vertical-slice.mjs';
const run=createGreenwildRun({seed:'audit',partySize:2});assert.equal(run.dungeon.nodes.at(-1).type,'boss');
const encounter=run.startEncounter('wolf-pack');assert.ok(encounter.snapshot().length>4);
const boss=run.createBoss();assert.equal(boss.snapshot()[0].id,'boss:ancient-golem');
boss.damage('boss:ancient-golem',999999,{sourceId:'player',seed:'audit'});assert.equal(boss.cleared,true);
const reward=run.completeBoss({playerId:'player',killCount:0});assert.equal(reward.firstKill,true);assert.ok(reward.progression.unlocks.includes('biome:duskfen'));assert.equal(reward.stoneReward.authorityCommitRequired,true);
console.log('greenwild-pve-audit: ok');
