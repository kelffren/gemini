import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);

globalThis.window=globalThis;
const catalog=require('../src/systems/equipment-item-catalog.js');
globalThis.KELO_EQUIPMENT_ITEM_CATALOG=catalog;
const Forge=require('../src/systems/player-forging-system.js');

assert.equal(Forge.version,'player-forging-v1.0.0');
assert.equal(Forge.maxSockets,4);

const made=Forge.forge('starter_weapon',{
  id:'audit_forged_sword_1',
  createdAt:1700000000000,
  creator:{id:'player_kelo',name:'Kelo'},
  name:'Furia de Kelo',
  socketCount:3
});
assert.equal(made.ok,true);
assert.equal(made.item.name,'Furia de Kelo');
assert.equal(made.item.craftedBy,'Kelo');
assert.equal(made.item.craftedById,'player_kelo');
assert.match(made.item.serial,/^KW-[A-Z0-9]{7}$/);
assert.equal(made.summary.socketCount,3);
assert.equal(made.summary.filledSockets,0);
assert.equal(made.summary.tradable,true);

const fire={
  uid:'stone_fire_a',
  abilityKey:'fireball',
  name:'Piedra de Fuego',
  icon:'🔥',
  tier:'Rare',
  level:4,
  affixes:[{id:'damage',value:.12},{id:'cooldown',value:.05}]
};
const guard={
  uid:'stone_guard_b',
  abilityKey:'stone_shield',
  name:'Piedra de Guardia',
  icon:'◆',
  tier:'Epic',
  level:3,
  affixes:[{id:'shield',value:.1}]
};

let r=Forge.socket(made.item,fire,0);
assert.equal(r.ok,true);
assert.equal(r.summary.filledSockets,1);
assert.ok(r.summary.forgePower>0);
assert.ok(r.summary.bonus.attackPct>0);
assert.ok(r.summary.bonus.cooldownPct>0);

r=Forge.socket(made.item,guard,1);
assert.equal(r.ok,true);
assert.equal(r.summary.filledSockets,2);
assert.ok(r.summary.bonus.defensePct>0);
assert.ok(r.summary.bonus.shieldPct>0);
const powerWithTwo=r.summary.forgePower;

r=Forge.socket(made.item,fire,2);
assert.equal(r.ok,false);
assert.equal(r.error,'STONE_ALREADY_SOCKETED');

r=Forge.rename(made.item,'  Espada del Fundador  ');
assert.equal(r.ok,true);
assert.equal(made.item.name,'Espada del Fundador');
assert.equal(made.item.forge.customName,'Espada del Fundador');

const listedClone=JSON.parse(JSON.stringify(made.item));
assert.equal(listedClone.serial,made.item.serial);
assert.equal(listedClone.forge.creator.name,'Kelo');
assert.equal(listedClone.forge.sockets[0].stoneUid,'stone_fire_a');
assert.equal(listedClone.forge.sockets[1].stoneUid,'stone_guard_b');
assert.equal(listedClone.forgePower,powerWithTwo);
assert.equal(Forge.validate(listedClone).ok,true);

r=Forge.unsocket(made.item,1);
assert.equal(r.ok,true);
assert.equal(r.stone.stoneUid,'stone_guard_b');
assert.equal(r.summary.filledSockets,1);
assert.ok(r.summary.forgePower<powerWithTwo);

const other=Forge.forge('starter_bow',{
  id:'audit_forged_bow_1',
  createdAt:1700000000001,
  creator:{id:'player_maya',name:'Maya'},
  name:'Arco de Maya',
  socketCount:2
});
assert.equal(other.ok,true);
assert.notEqual(other.item.serial,made.item.serial);

assert.equal(Forge.forge('missing_template',{creator:{id:'x',name:'x'}}).ok,false);

console.log('KELO_PLAYER_FORGING_AUDIT=PASS');
console.log(JSON.stringify({
  ok:true,
  version:Forge.version,
  uniqueSerials:true,
  customNames:true,
  creatorProvenance:true,
  sockets:true,
  maxSockets:Forge.maxSockets,
  stoneBonuses:true,
  forgedPower:true,
  marketClonePreservesIdentity:true,
  commerceCompatible:true
},null,2));
