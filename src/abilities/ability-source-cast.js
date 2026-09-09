/* KELO-INDEX
 * area: ABILITIES / SOURCE CAST
 * owner: KeloAbilities is the source-native delivery/effect runtime owner; this file is compatibility SUPPORT only
 * keys: ABILITY SOURCE CAST EQUIPMENT MOUNT COMPAT AUTHORITY
 * purpose: conserva KeloAbilitySourceCast como boca compatible delegando a KeloAbilities.engine.castSource sin tocar el hotbar Stone
 * public-api: KeloAbilitySourceCast.cast/isAvailable
 * consumes: KeloAbilities.engine.castSource
 * state-owned: ninguno
 * extension-points: sourceType/sourceId/sourceSlot/sourceFingerprint
 * online: identidad estable viaja al owner KeloAbilities; el servidor futuro valida ownership/loadout de la fuente
 * legacy: compatibility shim para consumidores antiguos; código nuevo usa KeloAbilities.engine.castSource directamente
 * do-not: no crear delivery/effect handlers, no tocar hotbar/STATE.equipped, no persistir cooldowns, no mutar HP
 */
(function(root){'use strict';if(root.KeloAbilitySourceCast)return;
const VERSION='ability-source-cast-v2.0.0';
function cast(options){
 const runtime=root.KeloAbilities?.engine;
 if(!runtime?.castSource)return{valid:false,reason:'ABILITY_SOURCE_RUNTIME_UNAVAILABLE'};
 try{return runtime.castSource(options||{});}catch(error){return{valid:false,reason:'CAST_EXCEPTION',error:String(error&&error.message||error)};}
}
root.KeloAbilitySourceCast=Object.freeze({version:VERSION,cast,isAvailable:()=>typeof root.KeloAbilities?.engine?.castSource==='function'});
root.KELO_ABILITY_SOURCE_CAST_AUDIT=Object.freeze({version:VERSION,compatibilityShim:true,nativeRuntime:true,hotbarWrites:0,stoneStateWrites:0,duplicateDeliveryHandlers:0,persistentState:false,legacyBridge:false});
})(typeof globalThis!=='undefined'?globalThis:window);
