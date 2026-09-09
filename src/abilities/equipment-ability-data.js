/* KELO-INDEX
 * area: ABILITIES / EQUIPMENT CONTENT
 * owner: equipment ability content only; KeloAbilities remains runtime owner
 * keys: EQUIPMENT WEAPON FAMILY Q W E ABILITY DATA
 * purpose: define familias de arma y sus tres técnicas Q/W/E sin contaminar KeloStones
 * public-api: KELO_EQUIPMENT_ABILITY_DATA + CommonJS export
 * consumes: delivery/effect primitives soportados por KeloAbilities
 * state-owned: ninguno
 * extension-points: añadir AbilityDefinition + WeaponProfile + template binding
 * online: IDs/keys/profile IDs estables para validar arma equipada y cast en servidor
 * do-not: no crear WeaponAbilityEngine, no añadir estas definitions a STATE.equipped ni KeloStones
 */
(function(root,factory){const data=factory();if(root)root.KELO_EQUIPMENT_ABILITY_DATA=data;if(typeof module==='object'&&module.exports)module.exports=data;})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
const abilities=Object.freeze([
 Object.freeze({id:2001,key:'weapon_vanguard_cut',name:'Corte de Vanguardia',icon:'⚔️',sourceType:'equipment',slotType:'weapon',role:'damage',targeting:Object.freeze({type:'self'}),resource:Object.freeze({type:'mana',cost:4}),cooldown:2.2,delivery:Object.freeze({type:'self_aoe',radius:72}),effects:Object.freeze([Object.freeze({type:'damage',damageType:'physical',amount:14})]),visuals:Object.freeze({color:'#e7c56a',fx:'weapon_vanguard_cut'})}),
 Object.freeze({id:2002,key:'weapon_duelist_step',name:'Paso del Duelista',icon:'💨',sourceType:'equipment',slotType:'weapon',role:'mobility',targeting:Object.freeze({type:'direction',range:125}),resource:Object.freeze({type:'mana',cost:5}),cooldown:6,delivery:Object.freeze({type:'dash',distance:125,duration:.16}),effects:Object.freeze([]),visuals:Object.freeze({color:'#f1d58a',fx:'weapon_duelist_step'})}),
 Object.freeze({id:2003,key:'weapon_royal_break',name:'Ruptura Real',icon:'💥',sourceType:'equipment',slotType:'weapon',role:'control',targeting:Object.freeze({type:'self'}),resource:Object.freeze({type:'mana',cost:10}),cooldown:11,delivery:Object.freeze({type:'self_aoe',radius:96}),effects:Object.freeze([Object.freeze({type:'damage',damageType:'physical',amount:24}),Object.freeze({type:'status',status:'slow',duration:1.4,magnitude:.3})]),visuals:Object.freeze({color:'#d6b45f',fx:'weapon_royal_break'})}),
 Object.freeze({id:2011,key:'weapon_arcane_bolt',name:'Proyectil Arcano',icon:'✦',sourceType:'equipment',slotType:'weapon',role:'damage',targeting:Object.freeze({type:'direction',range:420}),resource:Object.freeze({type:'mana',cost:5}),cooldown:2.4,delivery:Object.freeze({type:'projectile',speed:650,maxDistance:420,radius:7,maxTargets:1}),effects:Object.freeze([Object.freeze({type:'damage',damageType:'arcane',amount:13})]),visuals:Object.freeze({color:'#9c8cff',fx:'weapon_arcane_bolt'})}),
 Object.freeze({id:2012,key:'weapon_arcane_shift',name:'Salto Arcano',icon:'◇',sourceType:'equipment',slotType:'weapon',role:'mobility',targeting:Object.freeze({type:'direction',range:145}),resource:Object.freeze({type:'mana',cost:8}),cooldown:8,delivery:Object.freeze({type:'blink',distance:145}),effects:Object.freeze([]),visuals:Object.freeze({color:'#7c65df',fx:'weapon_arcane_shift'})}),
 Object.freeze({id:2013,key:'weapon_arcane_tempest',name:'Tempestad Arcana',icon:'✹',sourceType:'equipment',slotType:'weapon',role:'pressure',targeting:Object.freeze({type:'position',range:330}),resource:Object.freeze({type:'mana',cost:15}),cooldown:14,delivery:Object.freeze({type:'persistent_area',radius:105,duration:3,tickInterval:.75}),effects:Object.freeze([Object.freeze({type:'damage',damageType:'arcane',amount:8,perTick:true})]),visuals:Object.freeze({color:'#7059d9',fx:'weapon_arcane_tempest'})})
]);
const profiles=Object.freeze([
 Object.freeze({id:'weapon.vanguard_blade',family:'sword',displayName:'Hoja de Vanguardia',abilityKeys:Object.freeze(['weapon_vanguard_cut','weapon_duelist_step','weapon_royal_break']),tags:Object.freeze(['melee','starter'])}),
 Object.freeze({id:'weapon.arcane_staff',family:'staff',displayName:'Bastón Arcano',abilityKeys:Object.freeze(['weapon_arcane_bolt','weapon_arcane_shift','weapon_arcane_tempest']),tags:Object.freeze(['ranged','magic'])})
]);
const templateBindings=Object.freeze({'starter_weapon':'weapon.vanguard_blade','arcane_staff':'weapon.arcane_staff'});
const byKey=new Map(abilities.map(def=>[def.key,def])),byId=new Map(abilities.map(def=>[def.id,def])),profileById=new Map(profiles.map(profile=>[profile.id,profile]));
function getAbility(keyOrId){return Number.isFinite(Number(keyOrId))&&byId.has(Number(keyOrId))?byId.get(Number(keyOrId)):byKey.get(String(keyOrId||''))||null;}
function getProfile(id){return profileById.get(String(id||''))||null;}
function resolveProfileForItem(item){if(!item||item.slot!=='weapon')return null;const explicit=item.weaponProfileId||item.combatProfileId||null,profileId=explicit||templateBindings[String(item.templateId||'')];return getProfile(profileId);}
function validateProfile(profile){if(!profile||!profile.id||!profile.family||!Array.isArray(profile.abilityKeys)||profile.abilityKeys.length!==3)return{ok:false,reason:'INVALID_PROFILE'};if(profile.abilityKeys.some(key=>!byKey.has(key)))return{ok:false,reason:'UNKNOWN_ABILITY'};return{ok:true};}
return Object.freeze({version:1,abilities,profiles,templateBindings,getAbility,getProfile,resolveProfileForItem,validateProfile});});
