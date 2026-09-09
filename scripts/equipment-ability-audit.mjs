/* KELO-INDEX
 * area: AUDIT / EQUIPMENT ABILITIES
 * keys: AUDIT EQUIPMENT WEAPON Q W E MOUNT STONES SOURCE CAST SLOT CHOICES
 * purpose: protege 5 Stone intactos, Q/W/E data-driven, selección por slot, sustitución por M1-M3 y reutilización de KeloAbilities
 * online: valida identidad semántica sourceType/sourceId/sourceFingerprint; no prueba servidor real
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
globalThis.window=globalThis;
globalThis.KeloEvents={events:[],emit(name,payload){this.events.push({name,payload});}};
const stone0={stoneUid:'stone-real',abilityKey:'fireball',definition:{id:1,key:'fireball'},cooldown:0};
const stoneSlots=[stone0,{stoneUid:'stone-2'},null,null,null];
let casts=0,lastBridge=null;
globalThis.KeloAbilities={hotbar:{slots:stoneSlots},engine:{cast(req){casts++;lastBridge=globalThis.KeloAbilities.hotbar.slots[req.slotIndex];assert.equal(lastBridge.stoneUid,null);assert.ok(lastBridge.sourceType==='equipment'||lastBridge.sourceType==='mount');return{valid:true,abilityId:lastBridge.abilityId,stoneUid:lastBridge.stoneUid};}}};
require('../src/abilities/ability-source-cast.js');
const data=require('../src/abilities/equipment-ability-data.js');globalThis.KELO_EQUIPMENT_ABILITY_DATA=data;
assert.equal(data.version,2);assert.equal(data.slotCount,3);assert.equal(data.abilities.length,20);assert.equal(data.profiles.length,6);
for(const profile of data.profiles){assert.equal(data.validateProfile(profile).ok,true);assert.equal(profile.abilityKeys.length,3);assert.equal(profile.slotChoices.length,3);}
assert.equal(data.resolveProfileForItem({slot:'weapon',templateId:'starter_weapon'}).family,'sword');
assert.equal(data.resolveProfileForItem({slot:'weapon',templateId:'starter_bow'}).family,'bow');
assert.equal(data.resolveProfileForItem({slot:'weapon',templateId:'starter_daggers'}).family,'dagger');
assert.equal(data.resolveProfileForItem({slot:'weapon',templateId:'starter_hammer'}).family,'hammer');
assert.equal(data.resolveProfileForItem({slot:'weapon',templateId:'frost_staff'}).family,'frost_staff');
assert.equal(data.getProfilesByFamily('staff').length,1);
const customSword={slot:'weapon',templateId:'starter_weapon',combatAbilityKeys:['weapon_guard_breaker','weapon_duelist_step','weapon_royal_break']};
let resolved=data.resolveLoadoutForItem(customSword);assert.equal(resolved.customized,true);assert.equal(resolved.selectionStatus,'custom');assert.equal(resolved.abilityKeys[0],'weapon_guard_breaker');
const invalidSword={slot:'weapon',templateId:'starter_weapon',combatAbilityKeys:['weapon_bow_quickshot','weapon_duelist_step','weapon_royal_break']};
resolved=data.resolveLoadoutForItem(invalidSword);assert.equal(resolved.customized,false);assert.equal(resolved.selectionStatus,'invalid_fallback');assert.equal(resolved.abilityKeys[0],'weapon_vanguard_cut');

let weapon={id:'eq_weapon',templateId:'starter_weapon',slot:'weapon',itemLevel:1,quality:1,grade:1};
globalThis.KeloEquipment={getEquipped:()=>[weapon]};
globalThis.KeloMounts={isMounted:()=>false,getEquippedMountId:()=>null};
require('../src/abilities/equipment-ability-channel.js');
const EquipmentChannel=globalThis.KeloEquipmentAbilityChannel;let snap=EquipmentChannel.sync(true);assert.equal(EquipmentChannel.slotCount,3);assert.equal(snap.slots.length,3);assert.equal(snap.profileId,'weapon.vanguard_blade');assert.equal(snap.profileName,'Hoja de Vanguardia');assert.equal(snap.weaponFamily,'sword');assert.equal(snap.selectionStatus,'default');assert.equal(snap.customized,false);assert.deepEqual(EquipmentChannel.labels,['Q','W','E']);
let result=EquipmentChannel.cast({slotIndex:0,direction:{x:1,y:0}});assert.equal(result.valid,true);assert.equal(result.sourceType,'equipment');assert.equal(result.sourceId,'eq_weapon');assert.equal(result.sourceSlot,'Q');assert.equal(lastBridge.sourceType,'equipment');assert.equal(stoneSlots[0],stone0);assert.equal(stoneSlots.length,5);
assert.ok(EquipmentChannel.getRemainingCooldown(0)>0);assert.equal(stone0.cooldown,0);

// Same weapon family can select a permitted Q without creating another runtime/profile owner.
weapon={...weapon,combatAbilityKeys:['weapon_guard_breaker','weapon_duelist_step','weapon_royal_break']};snap=EquipmentChannel.sync(true);assert.equal(snap.customized,true);assert.equal(snap.selectionStatus,'custom');assert.equal(snap.abilityKeys[0],'weapon_guard_breaker');assert.equal(snap.slots[0].abilityKey,'weapon_guard_breaker');result=EquipmentChannel.cast({slotIndex:0,direction:{x:1,y:0}});assert.equal(result.valid,true);assert.equal(lastBridge.abilityKey,'weapon_guard_breaker');assert.equal(stoneSlots[0],stone0);assert.equal(stoneSlots.length,5);

// Switching to another template changes the whole kit by data, not by runtime branches.
weapon={id:'eq_bow',templateId:'starter_bow',slot:'weapon',itemLevel:1,quality:1,grade:1};snap=EquipmentChannel.sync(true);assert.equal(snap.profileId,'weapon.longbow');assert.equal(snap.weaponFamily,'bow');assert.deepEqual(snap.abilityKeys,['weapon_bow_quickshot','weapon_bow_evasive_step','weapon_bow_arrow_rain']);

// Mount mode replaces weapon Q/W/E rather than stacking a second three-slot bar.
globalThis.KeloMounts={isMounted:()=>true,getEquippedMountId:()=> 'mount.training_horse',getAbilityLoadout:()=>({mounted:true,mountId:'mount.training_horse',fingerprint:'mount.training_horse|1',slots:['mount_horse_gallop','mount_horse_guard','mount_horse_trample'].map((abilityKey,slotIndex)=>({sourceType:'mount',sourceId:'mount.training_horse',slotIndex,abilityKey}))})};
result=EquipmentChannel.cast({slotIndex:1,direction:{x:1,y:0}});assert.equal(result.reason,'WEAPON_SKILLS_DISABLED_WHILE_MOUNTED');
const mountData=require('../src/mounts/mount-ability-data.js');globalThis.KELO_MOUNT_ABILITY_DATA=mountData;
require('../src/mounts/mount-ability-channel.js');
const MountChannel=globalThis.KeloMountAbilityChannel;MountChannel.sync(true);assert.equal(MountChannel.slotCount,3);result=MountChannel.cast({slotIndex:0,direction:{x:1,y:0}});assert.equal(result.valid,true);assert.equal(result.sourceType,'mount');assert.equal(result.sourceSlot,'M1');assert.equal(lastBridge.sourceType,'mount');assert.equal(stoneSlots[0],stone0);assert.equal(stoneSlots.length,5);
assert.equal(casts,3);
assert.ok(globalThis.KeloEvents.events.some(e=>e.name==='KELO_ABILITY_SOURCE_CAST'&&e.payload.sourceType==='equipment'));
assert.ok(globalThis.KeloEvents.events.some(e=>e.name==='KELO_ABILITY_SOURCE_CAST'&&e.payload.sourceType==='mount'));
console.log('KELO_EQUIPMENT_ABILITY_AUDIT=PASS');
console.log(JSON.stringify({ok:true,weaponProfiles:data.profiles.length,equipmentAbilities:data.abilities.length,weaponSlots:3,mountSlots:3,stoneSlotsUntouched:stoneSlots.length,reusesAbilityEngine:true,genericSourceBridge:true,mountMutualExclusion:true,sourceEvents:true,perItemSlotChoices:true,families:data.profiles.map(p=>p.family)},null,2));
