'use strict';
const fs=require('fs');
const vm=require('vm');
const assert=require('assert');

const context={
  console,
  Date,
  Math,
  Map,
  Set,
  Object,
  Array,
  Number,
  String,
  JSON,
  Promise,
  setTimeout,
  clearTimeout,
  STATE:{inventory:[],equipmentSlots:{}},
  localPlayer:{},
  saveCalls:0,
  saveState(){this.saveCalls++;},
  window:{}
};
context.window=context;
vm.createContext(context);
vm.runInContext(fs.readFileSync('src/systems/equipment-system.js','utf8'),context,{filename:'equipment-system.js'});
vm.runInContext(fs.readFileSync('src/systems/backpack-system.js','utf8'),context,{filename:'backpack-system.js'});

const E=context.KeloEquipment;
const B=context.KeloBackpack;
assert(E&&B,'systems must boot');
assert.equal(E.version,'equipment-v1.1.0');
assert.equal(B.version,'backpack-v1.1.0');
assert.equal(B.getStats().capacity,20);
assert.equal(E.getEquipped().length,9,'starter equipment begins equipped');

let result=E.unequipItem('weapon');
assert(result.ok);
assert.strictEqual(context.STATE.equipmentSlots.weapon,null,'unequip must encode explicit empty slot as null');
E.getEquipped();
assert.strictEqual(context.STATE.equipmentSlots.weapon,null,'ensure/getEquipped must not auto-refill explicit empty slot');
result=E.equipItem('eq_weapon');
assert(result.ok);
assert.equal(context.STATE.equipmentSlots.weapon,'eq_weapon');

const potionA={id:'pot_a',templateId:'potion_small',name:'Poción',kind:'consumable',quantity:7,maxStack:10,bound:false};
const potionB={id:'pot_b',templateId:'potion_small',name:'Poción',kind:'consumable',quantity:6,maxStack:10,bound:false};
const bound={id:'quest_token',templateId:'quest_token',name:'Sello',kind:'material',quantity:1,maxStack:1,bound:true};
context.STATE.inventory.push(potionA,potionB,bound);
B.ensure();
let slots=B.getSlots();
let a=slots.find(s=>s.item===potionA).index;
let b=slots.find(s=>s.item===potionB).index;
result=B.moveSlot(a,b);
assert(result.ok&&result.merged,'moving compatible stacks should merge');
assert.equal(potionB.quantity,10);
assert.equal(potionA.quantity,3);

slots=B.getSlots();
a=slots.find(s=>s.item===potionA).index;
const free=slots.find(s=>!s.item).index;
result=B.splitStack(a,free,2);
assert(result.ok,'split should succeed into empty slot');
assert.equal(potionA.quantity,1);
assert.equal(result.newItem.quantity,2);
assert.notEqual(result.newItem.id,potionA.id,'split stack must get unique identity');

result=B.sortSlots();
assert(result.ok);
const inventoryOrder=context.STATE.inventory.map(x=>x.id);
const beforeMove=inventoryOrder.slice();
slots=B.getSlots();
a=slots.find(s=>s.item===potionB).index;
const emptyAfterSort=slots.find(s=>!s.item).index;
result=B.moveSlot(a,emptyAfterSort);
assert(result.ok);
assert.deepStrictEqual(context.STATE.inventory.map(x=>x.id),beforeMove,'slot move must not reorder legacy inventory');

slots=B.getSlots();
const boundIndex=slots.find(s=>s.item===bound).index;
result=B.discardSlot(boundIndex);
assert.equal(result.error,'BOUND_ITEM_PROTECTED');
const equipmentIndex=slots.find(s=>s.item&&s.item.kind==='equipment').index;
result=B.discardSlot(equipmentIndex);
assert.equal(result.error,'EQUIPMENT_PROTECTED');

slots=B.getSlots();
const splitItem=slots.find(s=>s.item===result.newItem);
// result variable now points to protected discard, so resolve the split clone directly.
const clone=context.STATE.inventory.find(x=>x&&x.splitFrom==='pot_a');
const cloneIndex=B.getSlots().find(s=>s.item===clone).index;
result=B.discardSlot(cloneIndex,1);
assert(result.ok&&result.remaining===1,'partial discard should decrement quantity');
result=B.discardSlot(cloneIndex,1);
assert(result.ok&&result.remaining===0,'final discard should remove stack instance');
assert(!context.STATE.inventory.includes(clone));

const expanded=B.expandCapacity(5);
assert(expanded.ok&&expanded.capacity===25,'capacity primitive should expand by one row');
assert.equal(B.getStats().capacity,25);

console.log('PASS backpack-system-audit',JSON.stringify({
  equipmentVersion:E.version,
  backpackVersion:B.version,
  capacity:B.getStats().capacity,
  used:B.getStats().used,
  explicitEmptySlots:true,
  stackMerge:true,
  stackSplit:true,
  sort:true,
  discardProtection:true
}));