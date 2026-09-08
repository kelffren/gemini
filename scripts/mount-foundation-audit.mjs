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
// Three-slot adapter must reuse KeloAbilities synchronously and restore the stone hotbar.
const stone0={stoneUid:'stone-real',abilityKey:'fireball',cooldown:0};const stoneSlots=[stone0,{stoneUid:'stone-2'},null,null,null];let casts=0;
globalThis.KeloMounts={isMounted:()=>true,getEquippedMountId:()=> 'mount.training_horse',getAbilityLoadout:()=>({mounted:true,mountId:'mount.training_horse',fingerprint:'mount.training_horse|1',slots:base.abilityIds.map((abilityKey,slotIndex)=>({sourceType:'mount',sourceId:'mount.training_horse',slotIndex,abilityKey}))})};
globalThis.KeloAbilities={hotbar:{slots:stoneSlots},engine:{cast(req){casts++;const inst=this&&null;assert.equal(req.slotIndex,0);assert.equal(globalThis.KeloAbilities.hotbar.slots[0].sourceType,'mount');assert.equal(globalThis.KeloAbilities.hotbar.slots[0].stoneUid,null);return{valid:true,abilityId:globalThis.KeloAbilities.hotbar.slots[0].abilityId};}}};
globalThis.KeloEvents={emit(){}};globalThis.KeloMountAbilityChannel=undefined;
require('../src/mounts/mount-ability-channel.js');
const Channel=globalThis.KeloMountAbilityChannel;assert.equal(Channel.slotCount,3);Channel.sync(true);assert.equal(Channel.getSnapshot().slots.length,3);const result=Channel.cast({slotIndex:0,direction:{x:1,y:0}});assert.equal(result.valid,true);assert.equal(result.sourceType,'mount');assert.equal(casts,1);assert.equal(globalThis.KeloAbilities.hotbar.slots[0],stone0,'temporary bridge must restore original stone slot object');assert.equal(stoneSlots.length,5,'stone hotbar remains five slots');
console.log(JSON.stringify({ok:true,catalogVersion:Catalog.version,mountCount:Catalog.count,twentyK:true,exactMountAbilitySlots:3,stoneSlotsUntouched:stoneSlots.length,reusesAbilityEngine:true},null,2));
