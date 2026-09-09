import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const mountData=require('../src/mounts/mount-ability-data.js');globalThis.KELO_MOUNT_ABILITY_DATA=mountData;
const Catalog=require('../src/mounts/mount-catalog.js');
assert.equal(Catalog.count,2);assert.equal(Catalog.get('mount.training_horse').abilityIds.length,3);assert.ok(Catalog.getMovement('movement.horse.standard').maxSpeed>320,'starter mount must be faster than walking baseline');
const base=Catalog.get('mount.training_horse');
for(let i=0;i<20000;i++)Catalog.register({...base,id:`mount.audit.${i}`,displayName:`Audit Mount ${i}`,assetBundleId:`mount.asset.audit.${i}`,tags:['audit',i%2?'odd':'even']});
assert.equal(Catalog.count,20002);assert.equal(Catalog.get('mount.audit.19999').displayName,'Audit Mount 19999');assert.equal(Catalog.query({tag:'audit'}).length,20000);assert.equal(JSON.parse(JSON.stringify(Catalog.get('mount.audit.7'))).id,'mount.audit.7');
assert.equal(Catalog.validate({...base,id:'mount.audit.bad',abilityIds:['mount_horse_gallop']}).ok,false);

const mountSystemSource=fs.readFileSync(new URL('../src/mounts/mount-system.js',import.meta.url),'utf8');
assert(!mountSystemSource.includes("s.owned['mount.training_horse']"),'mount core must not hardcode starter mount IDs');
assert(!mountSystemSource.includes("['equipment.mount.war_saddle','equipment.mount.swift_horseshoes']"),'mount core must discover starter equipment from catalog tags');
assert(mountSystemSource.includes("Catalog.query({tag:'starter'})"),'starter mount must be discovered data-first');
assert(mountSystemSource.includes("tags?.includes('starter')"),'starter equipment must be discovered data-first');

const actionBarSource=fs.readFileSync(new URL('../src/ui/mount-action-bar.js',import.meta.url),'utf8');
assert(!actionBarSource.includes('requestAnimationFrame('),'mount HUD must not create its own RAF loop');
assert(!actionBarSource.includes('cancelAnimationFrame('),'mount HUD must not own RAF lifecycle');
assert(actionBarSource.includes('KeloRender?.afterFrame'),'mount HUD must consume KeloRender.afterFrame');
assert(actionBarSource.includes('KeloRender?.unregister'),'mount HUD must unregister its render hook');

// Three-slot adapter must reuse KeloAbilities synchronously and restore the Stone hotbar.
const stone0={stoneUid:'stone-real',abilityKey:'fireball',cooldown:0};const stoneSlots=[stone0,{stoneUid:'stone-2'},null,null,null];let casts=0;
globalThis.KeloMounts={isMounted:()=>true,getEquippedMountId:()=> 'mount.training_horse',getAbilityLoadout:()=>({mounted:true,mountId:'mount.training_horse',fingerprint:'mount.training_horse|1',slots:base.abilityIds.map((abilityKey,slotIndex)=>({sourceType:'mount',sourceId:'mount.training_horse',slotIndex,abilityKey}))})};
globalThis.KeloAbilities={hotbar:{slots:stoneSlots},engine:{cast(req){casts++;assert.equal(req.slotIndex,0);assert.equal(globalThis.KeloAbilities.hotbar.slots[0].sourceType,'mount');assert.equal(globalThis.KeloAbilities.hotbar.slots[0].stoneUid,null);return{valid:true,abilityId:globalThis.KeloAbilities.hotbar.slots[0].abilityId};}}};
globalThis.KeloEvents={emit(){}};globalThis.KeloMountAbilityChannel=undefined;
require('../src/mounts/mount-ability-channel.js');
const Channel=globalThis.KeloMountAbilityChannel;assert.equal(Channel.slotCount,3);Channel.sync(true);assert.equal(Channel.getSnapshot().slots.length,3);const result=Channel.cast({slotIndex:0,direction:{x:1,y:0}});assert.equal(result.valid,true);assert.equal(result.sourceType,'mount');assert.equal(casts,1);assert.equal(globalThis.KeloAbilities.hotbar.slots[0],stone0,'temporary bridge must restore original Stone slot object');assert.equal(stoneSlots.length,5,'Stone hotbar remains exactly five slots');
console.log(JSON.stringify({ok:true,catalogVersion:Catalog.version,mountCount:Catalog.count,twentyK:true,exactMountAbilitySlots:3,stoneSlotsUntouched:stoneSlots.length,reusesAbilityEngine:true,starterIdsInCore:false,secondLoop:false,usesKeloRender:true},null,2));
