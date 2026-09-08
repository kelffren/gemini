/* KELO-INDEX
 * area: ABILITIES / INVENTORY BRIDGE
 * owner: KeloStones for stone semantics; KeloInventory for portable storage
 * purpose: migra piedras sin destruir items no-stone y conserva grant único de Swap Sword
 * public-api: wrapped KeloStones.migrateState
 * consumes: KeloStones, KeloInventory, legacy STATE
 * state-owned: playerGrants grant marker; no posee inventory
 * extension-points: stone candidate partition + one-time grants
 * reuse: cualquier migración stone debe trabajar en shadow state y publicar inventory por KeloInventory
 * legacy: adapta KeloStones.migrateState que históricamente asumía inventory solo de piedras
 * do-not: NO asignar STATE.inventory directamente ni filtrar solo equipment
 */
(function(){
'use strict';
const original=window.KeloStones;
const inventoryOwner=window.KeloInventory;
if(!original||typeof original.migrateState!=='function')return;
if(!inventoryOwner)throw new Error('KeloInventory unavailable before stone-backpack-bridge');
const VERSION='stone-backpack-bridge-v1.2.0';
const SWAP_GRANT_ID='swap-sword-inventory-20260907';
const SWAP_ABILITY_KEY='swap_sword';

function isStoneCandidate(item){
  if(!item||typeof item!=='object')return false;
  if(item.kind==='ability')return !!original.normalizeAbilityKey(item.abilityKey||item.typeId||item.abilityId);
  if(item.abilityKey||item.abilityId)return !!original.normalizeAbilityKey(item.abilityKey||item.abilityId);
  if(item.typeId&&item.tier&&!item.kind)return !!original.normalizeAbilityKey(item.typeId);
  return false;
}

function migrateStatePreservingPortableItems(state){
  if(!state||typeof state!=='object')return original.migrateState(state);
  const rawInventory=Array.isArray(state.inventory)?state.inventory:[];
  const stoneCandidates=[],portable=[];
  rawInventory.forEach(function(item){(isStoneCandidate(item)?stoneCandidates:portable).push(item);});
  const shadow=Object.assign({},state,{
    inventory:stoneCandidates.slice(),
    equipped:Array.isArray(state.equipped)?state.equipped.slice():[],
    stoneQuarantine:Array.isArray(state.stoneQuarantine)?state.stoneQuarantine.slice():[]
  });
  const report=original.migrateState(shadow);
  const nextInventory=(Array.isArray(shadow.inventory)?shadow.inventory:[]).concat(portable);
  if(typeof STATE!=='undefined'&&state===STATE){
    const replaced=inventoryOwner.replaceItems('backpack',nextInventory,{persist:false});
    if(!replaced.ok)throw new Error('STONE_INVENTORY_RESTORE:'+replaced.error);
  }else state.inventory=nextInventory;
  state.equipped=shadow.equipped;
  state.stoneSchemaVersion=shadow.stoneSchemaVersion;
  state.stoneQuarantine=shadow.stoneQuarantine;
  if(report&&typeof report==='object'){
    report.preservedPortable=portable.length;
    report.stoneCandidates=stoneCandidates.length;
  }
  return report;
}

function grantSwapSwordOnce(){
  if(typeof STATE==='undefined'||typeof original.createAbilityStone!=='function')return false;
  inventoryOwner.ensure();
  STATE.equipped=Array.isArray(STATE.equipped)?STATE.equipped:[];
  STATE.playerGrants=Array.isArray(STATE.playerGrants)?STATE.playerGrants:[];
  const inventory=inventoryOwner.getItems('backpack');
  const ownsSwap=inventory.concat(STATE.equipped).some(function(item){
    return item&&(item.abilityKey===SWAP_ABILITY_KEY||item.typeId===SWAP_ABILITY_KEY);
  });
  const alreadyGranted=STATE.playerGrants.indexOf(SWAP_GRANT_ID)>=0;
  if(ownsSwap||alreadyGranted)return false;
  const added=inventoryOwner.addItem('backpack',original.createAbilityStone(SWAP_ABILITY_KEY,'Common',{source:'kelo-player-grant',bound:false}),{persist:false});
  if(!added.ok)return false;
  STATE.playerGrants.push(SWAP_GRANT_ID);
  inventoryOwner.persist();
  return true;
}

window.KeloStones=Object.freeze(Object.assign({},original,{migrateState:migrateStatePreservingPortableItems}));
const swapGranted=grantSwapSwordOnce();
window.KELO_STONE_BACKPACK_BRIDGE_AUDIT=Object.freeze({
  version:VERSION,
  mode:'shadow-stone-migration-preserve-all-portable-v2',
  inventoryOwner:'KeloInventory',
  preservedKinds:'all-non-stone-portable-items',
  directInventoryWrites:false,
  changesStoneSemantics:false,
  swapGrantId:SWAP_GRANT_ID,
  swapGranted:swapGranted
});
})();
