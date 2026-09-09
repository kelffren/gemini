import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const mountData=require('../src/mounts/mount-ability-data.js');globalThis.KELO_MOUNT_ABILITY_DATA=mountData;
const Catalog=require('../src/mounts/mount-catalog.js');
assert.equal(Catalog.count,2);assert.equal(Catalog.get('mount.training_horse').abilityIds.length,3);assert.ok(Catalog.getMovement('movement.horse.standard').maxSpeed>320,'starter mount must be faster than walking baseline');
const base=Catalog.get('mount.training_horse');
for(let i=0;i<20000;i++)Catalog.register({...base,id:`mount.audit.${i}`,displayName:`Audit Mount ${i}`,assetBundleId:`mount.asset.audit.${i}`,tags:['audit',i%2?'odd':'even']});
assert.equal(Catalog.count,20002);assert.equal(Catalog.get('mount.audit.19999').displayName,'Audit Mount 19999');assert.equal(Catalog.query({tag:'audit'}).length,20000);assert.equal(JSON.parse(JSON.stringify(Catalog.get('mount.audit.7'))).id,'mount.audit.7');
assert.equal(Catalog.validate({...base,id:'mount.audit.bad',abilityIds:['mount_horse_gallop']}).ok,false);

const assetDefs=new Map(),ready=new Set();let preloadCalls=0;
globalThis.KeloAssetRegistry={register(def){assetDefs.set(def.id,def);return def;},async preload(ids){preloadCalls++;ids.forEach(id=>ready.add(id));return ids;},isReady:id=>ready.has(id),resource:id=>ready.has(id)?{id}:null};
globalThis.KeloMountCatalog=Catalog;globalThis.KeloMountAssets=undefined;
require('../src/mounts/mount-asset-adapter.js');
const Assets=globalThis.KeloMountAssets;
Assets.registerBundle({id:'mount.asset.training_horse',assets:[{id:'asset.mount.training_horse.sheet',type:'image',src:'assets/mounts/training-horse.png'}]});
const loadResult=await Assets.ensureLoaded('mount.training_horse');
assert.equal(loadResult.ok,true);assert.equal(preloadCalls,1);assert.equal(Assets.isReady('mount.training_horse'),true);assert.equal(globalThis.KELO_MOUNT_ASSET_AUDIT.reusesKeloAssetRegistry,true);assert.equal(globalThis.KELO_MOUNT_ASSET_AUDIT.secondLoader,false);
assert.equal((await Assets.ensureLoaded('mount.shadow_wolf')).error,'MOUNT_ASSET_BUNDLE_UNREGISTERED');

let recalcCalls=0,registeredSource=null,dirtyCalls=0;
globalThis.STATE={mounts:{schemaVersion:1,owned:{'mount.training_horse':{id:'mount.training_horse'}},equippedMountId:'mount.training_horse',mounted:true,equipmentByMountId:{},appearanceByMountId:{},equipmentInventory:[],revision:4}};
globalThis.localPlayer={};globalThis.KeloMountEquipmentCatalog={get(){return null;}};globalThis.KeloStatModifiers={registerSource(id,fn){registeredSource={id,fn};return()=>{};},markDirty(){dirtyCalls++;},resolve(_target,baseStats){return{stats:{...baseStats},revision:dirtyCalls};}};globalThis.KeloPlayerStats={get(){return 0;},snapshot(){return Object.freeze({});}};globalThis.KeloAppearance=undefined;globalThis.KeloEquipment={recalculate(){recalcCalls++;}};globalThis.KeloMovement=undefined;globalThis.KeloEvents={emit(){}};globalThis.KeloMounts=undefined;
require('../src/mounts/mount-system.js');
assert.notEqual(globalThis.KeloPlayerStats,globalThis.KeloStatModifiers,'progress counters and attribute modifiers must remain separate owners');
assert.equal(registeredSource.id,'mount-equipment');assert.equal(recalcCalls,1,'persisted mount modifiers must be rehydrated once after source registration');assert.equal(globalThis.KELO_MOUNT_AUDIT.rehydratesPersistedStats,true);assert.equal(globalThis.KELO_MOUNT_AUDIT.usesKeloStatModifiers,true);assert.equal(globalThis.KELO_MOUNT_AUDIT.secondLoop,false);

const stone0={stoneUid:'stone-real',abilityKey:'fireball',cooldown:0};const stoneSlots=[stone0,{stoneUid:'stone-2'},null,null,null];let casts=0;
globalThis.KeloMounts={isMounted:()=>true,getEquippedMountId:()=> 'mount.training_horse',getAbilityLoadout:()=>({mounted:true,mountId:'mount.training_horse',fingerprint:'mount.training_horse|1',slots:base.abilityIds.map((abilityKey,slotIndex)=>({sourceType:'mount',sourceId:'mount.training_horse',slotIndex,abilityKey}))})};
globalThis.KeloAbilities={hotbar:{slots:stoneSlots},engine:{cast(req){casts++;assert.equal(req.slotIndex,0);assert.equal(globalThis.KeloAbilities.hotbar.slots[0].sourceType,'mount');assert.equal(globalThis.KeloAbilities.hotbar.slots[0].stoneUid,null);return{valid:true,abilityId:globalThis.KeloAbilities.hotbar.slots[0].abilityId};}}};
globalThis.KeloMountAbilityChannel=undefined;
require('../src/mounts/mount-ability-channel.js');
const Channel=globalThis.KeloMountAbilityChannel;assert.equal(Channel.slotCount,3);Channel.sync(true);assert.equal(Channel.getSnapshot().slots.length,3);const result=Channel.cast({slotIndex:0,direction:{x:1,y:0}});assert.equal(result.valid,true);assert.equal(result.sourceType,'mount');assert.equal(casts,1);assert.equal(globalThis.KeloAbilities.hotbar.slots[0],stone0,'temporary bridge must restore original stone slot object');assert.equal(stoneSlots.length,5,'stone hotbar remains five slots');
console.log(JSON.stringify({ok:true,catalogVersion:Catalog.version,mountCount:Catalog.count,twentyK:true,exactMountAbilitySlots:3,stoneSlotsUntouched:stoneSlots.length,reusesAbilityEngine:true,reusesAssetRegistry:true,secondAssetLoader:false,persistedStatsRehydrated:true,statOwner:'KeloStatModifiers',progressOwnerSeparated:true},null,2));
