/* KELO-INDEX
 * area: AUDIT / EQUIPMENT ABILITIES
 * keys: AUDIT EQUIPMENT WEAPON Q W E MOUNT STONES SOURCE CAST
 * purpose: protege 5 Stone intactos, Q/W/E data-driven, sustitución por M1-M3 y reutilización de KeloAbilities
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
assert.equal(data.abilities.length,6);assert.equal(data.profiles.length,2);for(const profile of data.profiles)assert.equal(data.validateProfile(profile).ok,true);assert.equal(data.resolveProfileForItem({slot:'weapon',templateId:'starter_weapon'}).family,'sword');
let weapon={id:'eq_weapon',templateId:'starter_weapon',slot:'weapon',itemLevel:1,quality:1,grade:1};
globalThis.KeloEquipment={getEquipped:()=>[weapon]};
globalThis.KeloMounts={isMounted:()=>false,getEquippedMountId:()=>null};
require('../src/abilities/equipment-ability-channel.js');
const EquipmentChannel=globalThis.KeloEquipmentAbilityChannel;let snap=EquipmentChannel.sync(true);assert.equal(EquipmentChannel.slotCount,3);assert.equal(snap.slots.length,3);assert.equal(snap.profileId,'weapon.vanguard_blade');assert.equal(snap.weaponFamily,'sword');assert.deepEqual(EquipmentChannel.labels,['Q','W','E']);
let result=EquipmentChannel.cast({slotIndex:0,direction:{x:1,y:0}});assert.equal(result.valid,true);assert.equal(result.sourceType,'equipment');assert.equal(result.sourceId,'eq_weapon');assert.equal(result.sourceSlot,'Q');assert.equal(lastBridge.sourceType,'equipment');assert.equal(stoneSlots[0],stone0);assert.equal(stoneSlots.length,5);
// The cooldown is channel-owned, never inserted into Stone state.
assert.ok(EquipmentChannel.getRemainingCooldown(0)>0);assert.equal(stone0.cooldown,0);
// Mount mode replaces weapon Q/W/E rather than stacking a second three-slot bar.
globalThis.KeloMounts={isMounted:()=>true,getEquippedMountId:()=> 'mount.training_horse',getAbilityLoadout:()=>({mounted:true,mountId:'mount.training_horse',fingerprint:'mount.training_horse|1',slots:['mount_horse_gallop','mount_horse_guard','mount_horse_trample'].map((abilityKey,slotIndex)=>({sourceType:'mount',sourceId:'mount.training_horse',slotIndex,abilityKey}))})};
result=EquipmentChannel.cast({slotIndex:1,direction:{x:1,y:0}});assert.equal(result.reason,'WEAPON_SKILLS_DISABLED_WHILE_MOUNTED');
const mountData=require('../src/mounts/mount-ability-data.js');globalThis.KELO_MOUNT_ABILITY_DATA=mountData;
require('../src/mounts/mount-ability-channel.js');
const MountChannel=globalThis.KeloMountAbilityChannel;MountChannel.sync(true);assert.equal(MountChannel.slotCount,3);result=MountChannel.cast({slotIndex:0,direction:{x:1,y:0}});assert.equal(result.valid,true);assert.equal(result.sourceType,'mount');assert.equal(result.sourceSlot,'M1');assert.equal(lastBridge.sourceType,'mount');assert.equal(stoneSlots[0],stone0);assert.equal(stoneSlots.length,5);
assert.equal(casts,2);
assert.ok(globalThis.KeloEvents.events.some(e=>e.name==='KELO_ABILITY_SOURCE_CAST'&&e.payload.sourceType==='equipment'));
assert.ok(globalThis.KeloEvents.events.some(e=>e.name==='KELO_ABILITY_SOURCE_CAST'&&e.payload.sourceType==='mount'));
console.log('KELO_EQUIPMENT_ABILITY_AUDIT=PASS');
console.log(JSON.stringify({ok:true,weaponProfiles:data.profiles.length,equipmentAbilities:data.abilities.length,weaponSlots:3,mountSlots:3,stoneSlotsUntouched:stoneSlots.length,reusesAbilityEngine:true,genericSourceBridge:true,mountMutualExclusion:true,sourceEvents:true},null,2));
