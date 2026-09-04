(function(){
'use strict';
const original=window.KeloStones;
if(!original||typeof original.migrateState!=='function')return;
const VERSION='stone-backpack-bridge-v1.0.0';

function migrateStatePreservingEquipment(state){
  if(!state||typeof state!=='object')return original.migrateState(state);
  const inventory=Array.isArray(state.inventory)?state.inventory:[];
  const equipment=inventory.filter(function(item){return item&&item.kind==='equipment';});
  if(!equipment.length)return original.migrateState(state);
  state.inventory=inventory.filter(function(item){return !(item&&item.kind==='equipment');});
  let report;
  try{
    report=original.migrateState(state);
  }catch(error){
    state.inventory=inventory;
    throw error;
  }
  const stoneInventory=Array.isArray(state.inventory)?state.inventory:[];
  state.inventory=stoneInventory.concat(equipment);
  if(report&&typeof report==='object')report.preservedEquipment=equipment.length;
  return report;
}

window.KeloStones=Object.freeze(Object.assign({},original,{migrateState:migrateStatePreservingEquipment}));
window.KELO_STONE_BACKPACK_BRIDGE_AUDIT=Object.freeze({
  version:VERSION,
  mode:'preserve-known-equipment-during-stone-migration-v1',
  preservedKind:'equipment',
  changesStoneSemantics:false
});
})();
