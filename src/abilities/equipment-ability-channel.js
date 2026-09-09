/* KELO-INDEX
 * area: ABILITIES / EQUIPMENT CHANNEL
 * owner: KeloEquipment owns equipped weapon state; KeloAbilities owns cast runtime; this file is support projection
 * keys: EQUIPMENT WEAPON FAMILY Q W E ABILITY SOURCE CAST LOADOUT
 * purpose: proyecta el arma equipada a tres técnicas Q/W/E sin tocar los cinco Stone slots
 * public-api: KeloEquipmentAbilityChannel.sync/getSlots/getSnapshot/cast/on/getRemainingCooldown
 * consumes: KeloEquipment, KELO_EQUIPMENT_ABILITY_DATA, KeloAbilitySourceCast, KeloMounts optional
 * state-owned: cooldown readyAt + proyección runtime de 3 slots; NO inventory/equipment state
 * extension-points: WeaponProfile data-driven; exactamente 3 abilityKeys por perfil
 * online: sourceType=equipment + weaponId/profile/fingerprint permiten validar el cast contra equipo autoritativo
 * legacy: usa KeloAbilitySourceCast hasta que KeloAbilities soporte cast source-native
 * do-not: no escribir STATE.equipmentSlots, no crear delivery/effect handlers, no segundo loop
 */
(function(root){'use strict';if(root.KeloEquipmentAbilityChannel)return;
const VERSION='equipment-ability-channel-v1.0.0',COUNT=3,LABELS=Object.freeze(['Q','W','E']),listeners=new Map(),slots=Array(COUNT).fill(null);let fingerprint='none',weaponId=null,profileId=null,weaponFamily=null;
function emit(name,payload){const set=listeners.get(name);if(set)for(const fn of [...set])try{fn(payload);}catch(e){console.error(e);}try{root.KeloEvents?.emit?.(name,payload);}catch(_e){}}
function on(name,fn){if(typeof fn!=='function')return()=>{};if(!listeners.has(name))listeners.set(name,new Set());listeners.get(name).add(fn);return()=>listeners.get(name)?.delete(fn);}
function equippedWeapon(){const items=root.KeloEquipment?.getEquipped?.()||[];return items.find(item=>item&&item.slot==='weapon')||null;}
function sourceFingerprint(weapon,profile){return weapon&&profile?[String(weapon.id||''),String(weapon.templateId||''),String(weapon.itemLevel||1),String(weapon.quality||1),String(weapon.grade||1),profile.id,...profile.abilityKeys].join('|'):'none';}
function remaining(instance){return instance?Math.max(0,(Number(instance.readyAt)||0)-Date.now())/1000:0;}
function snapshot(){return{version:VERSION,fingerprint,weaponId,profileId,weaponFamily,mounted:root.KeloMounts?.isMounted?.()===true,slots:slots.map((s,i)=>s?{sourceType:'equipment',sourceId:s.sourceId,sourceSlot:LABELS[i],slotIndex:i,profileId:s.profileId,weaponFamily:s.weaponFamily,abilityId:s.abilityId,abilityKey:s.abilityKey,cooldown:remaining(s)}:null)};}
function sync(force){
 const data=root.KELO_EQUIPMENT_ABILITY_DATA,weapon=equippedWeapon(),profile=data?.resolveProfileForItem?.(weapon)||null,nextFingerprint=sourceFingerprint(weapon,profile);
 if(!force&&nextFingerprint===fingerprint)return snapshot();
 const old=new Map(slots.filter(Boolean).map(s=>[s.sourceId+':'+s.abilityKey,s]));
 weaponId=weapon?.id?String(weapon.id):null;profileId=profile?.id||null;weaponFamily=profile?.family||null;
 for(let i=0;i<COUNT;i++){const abilityKey=profile?.abilityKeys?.[i],def=abilityKey?data?.getAbility?.(abilityKey):null;if(!weapon||!profile||!def){slots[i]=null;continue;}const key=String(weapon.id)+':'+def.key,prev=old.get(key);slots[i]={sourceType:'equipment',sourceId:String(weapon.id),sourceSlot:LABELS[i],slotIndex:i,profileId:profile.id,weaponFamily:profile.family,abilityId:def.id,abilityKey:def.key,definition:def,readyAt:prev?.readyAt||0};}
 fingerprint=nextFingerprint;const snap=snapshot();emit('EQUIPMENT_ABILITY_LOADOUT_CHANGED',snap);return snap;
}
function cast(request){
 sync(false);const slotIndex=Number(request?.slotIndex);if(!Number.isInteger(slotIndex)||slotIndex<0||slotIndex>=COUNT)return{valid:false,reason:'INVALID_EQUIPMENT_SLOT'};
 if(root.KeloMounts?.isMounted?.()===true)return{valid:false,reason:'WEAPON_SKILLS_DISABLED_WHILE_MOUNTED'};
 const instance=slots[slotIndex];if(!instance)return{valid:false,reason:'EMPTY_SLOT'};const left=remaining(instance);if(left>0)return{valid:false,reason:'COOLDOWN',cooldown:left};
 const sourceCast=root.KeloAbilitySourceCast;if(!sourceCast?.cast)return{valid:false,reason:'ABILITY_SOURCE_CAST_UNAVAILABLE'};
 const result=sourceCast.cast({sourceType:'equipment',sourceId:instance.sourceId,sourceSlot:instance.sourceSlot,sourceFingerprint:fingerprint,definition:instance.definition,request});
 if(result?.valid){instance.readyAt=Date.now()+Number(instance.definition.cooldown||0)*1000;const semantic=Object.assign({},result,{sourceType:'equipment',sourceId:instance.sourceId,sourceSlot:instance.sourceSlot,slotIndex,profileId:instance.profileId,weaponFamily:instance.weaponFamily,cooldown:Number(instance.definition.cooldown)||0});emit('EQUIPMENT_ABILITY_CAST',semantic);return semantic;}
 return result||{valid:false,reason:'CAST_FAILED'};
}
root.KeloEquipmentAbilityChannel=Object.freeze({version:VERSION,slotCount:COUNT,labels:LABELS.slice(),sync,getSlots:()=>slots.slice(),getSnapshot:snapshot,cast,on,getRemainingCooldown:slot=>remaining(slots[Number(slot)])});
root.KELO_EQUIPMENT_ABILITY_AUDIT=Object.freeze({version:VERSION,slotCount:COUNT,stoneStateWrites:0,equipmentStateWrites:0,reusesKeloAbilitiesEngine:true,duplicateDeliveryHandlers:0,simulationHooks:0,mountMutualExclusion:true,dataDrivenProfiles:true});
})(typeof globalThis!=='undefined'?globalThis:window);
