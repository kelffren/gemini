/* KELO-INDEX
 * area: ABILITIES / SOURCE CAST
 * owner: KeloAbilities remains the delivery/effect runtime owner; this is a support adapter
 * keys: ABILITY SOURCE CAST EQUIPMENT MOUNT HOTBAR BRIDGE AUTHORITY
 * purpose: permite que fuentes no-Stone lancen definitions con KeloAbilities sin escribir STATE.equipped
 * public-api: KeloAbilitySourceCast.cast/isAvailable
 * consumes: KeloAbilities
 * state-owned: ninguno; solo sustituye un slot runtime de forma síncrona y lo restaura en finally
 * extension-points: sourceType/sourceId/sourceSlot/sourceFingerprint
 * online: emite KELO_ABILITY_SOURCE_CAST con identidad estable; el servidor futuro valida ownership/loadout de la fuente
 * legacy: puente transicional hasta que KeloAbilities tenga cast source-native
 * do-not: no crear delivery/effect handlers, no tocar STATE.equipped, no persistir cooldowns, no mutar HP
 */
(function(root){'use strict';if(root.KeloAbilitySourceCast)return;
const VERSION='ability-source-cast-v1.0.0';
function text(value){return value==null?'':String(value);}
function validDefinition(def){return !!(def&&Number.isFinite(Number(def.id))&&text(def.key)&&def.targeting&&def.delivery&&Array.isArray(def.effects));}
function emit(payload){try{root.KeloEvents?.emit?.('KELO_ABILITY_SOURCE_CAST',payload);}catch(_e){}}
function cast(options){
 const opts=options||{},def=opts.definition,sourceType=text(opts.sourceType),sourceId=text(opts.sourceId),sourceSlot=opts.sourceSlot==null?null:text(opts.sourceSlot),sourceFingerprint=opts.sourceFingerprint==null?null:text(opts.sourceFingerprint);
 if(!sourceType||!sourceId)return{valid:false,reason:'INVALID_SOURCE'};
 if(!validDefinition(def))return{valid:false,reason:'INVALID_ABILITY_DEFINITION'};
 const abilities=root.KeloAbilities,slots=abilities?.hotbar?.slots;
 if(!abilities?.engine?.cast||!Array.isArray(slots)||!slots.length)return{valid:false,reason:'ABILITY_RUNTIME_UNAVAILABLE'};
 const bridgeIndex=Number.isInteger(opts.bridgeIndex)&&opts.bridgeIndex>=0&&opts.bridgeIndex<slots.length?opts.bridgeIndex:0;
 const previous=slots[bridgeIndex];
 const bridge={sourceType,sourceId,sourceSlot,sourceFingerprint,stoneUid:null,abilityId:Number(def.id),abilityKey:text(def.key),tier:null,definition:def,cooldown:0};
 slots[bridgeIndex]=bridge;
 let result;
 try{result=abilities.engine.cast(Object.assign({},opts.request||{},{slotIndex:bridgeIndex}));}
 catch(error){result={valid:false,reason:'CAST_EXCEPTION',error:String(error&&error.message||error)};}
 finally{slots[bridgeIndex]=previous;}
 const semantic=Object.assign({},result||{valid:false,reason:'CAST_FAILED'},{sourceType,sourceId,sourceSlot,sourceFingerprint,abilityId:Number(def.id),abilityKey:text(def.key),stoneUid:null});
 if(semantic.valid)emit(semantic);
 return semantic;
}
root.KeloAbilitySourceCast=Object.freeze({version:VERSION,cast,isAvailable:()=>!!(root.KeloAbilities?.engine?.cast&&Array.isArray(root.KeloAbilities?.hotbar?.slots))});
root.KELO_ABILITY_SOURCE_CAST_AUDIT=Object.freeze({version:VERSION,stoneStateWrites:0,duplicateDeliveryHandlers:0,persistentState:false,synchronousRestore:true});
})(typeof globalThis!=='undefined'?globalThis:window);
