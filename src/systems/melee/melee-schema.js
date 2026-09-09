/* KELO-INDEX
 * area: MELEE
 * owner: KeloMeleeSchema
 * keys: SCHEMA WEAPON ATTACK PROFILE HIT SHAPE WINDUP ACTIVE RECOVERY MOVEMENT
 * purpose: vocabulario reusable de perfiles melee action-combat
 * state-owned: ninguno
 * online: los perfiles validados usan el mismo contrato client/server
 */
(function(root){
  'use strict';
  const VERSION='melee-schema-v2.0.0-action-combat';
  const WEAPON_CLASSES=Object.freeze(['unarmed','sword','katana','axe','dagger','club','hammer','spear']);
  const ATTACK_PROFILES=Object.freeze(['light_slash','heavy_slash','thrust','spin','overhead']);
  const HIT_SHAPES=Object.freeze(['range','circle','sector','arc','cone','capsule','rectangle','oriented_rect']);
  function finiteNonNegative(value,optional){return optional&&value==null?true:Number.isFinite(Number(value))&&Number(value)>=0;}
  function validProfile(def){
    if(!(def&&def.id&&WEAPON_CLASSES.indexOf(String(def.weaponClass||''))>=0&&ATTACK_PROFILES.indexOf(String(def.attackProfile||''))>=0))return false;
    if(!finiteNonNegative(def.range)||!finiteNonNegative(def.cooldown)||!finiteNonNegative(def.damage))return false;
    if(def.hitShape!=null&&HIT_SHAPES.indexOf(String(def.hitShape))<0)return false;
    for(const key of ['arcDegrees','forwardOffset','hitRadius','hitWidth','windup','active','recovery','knockback','stagger','charges','rechargeTime','cancelWindow'])if(!finiteNonNegative(def[key],true))return false;
    if(def.movementScale!=null&&(!Number.isFinite(Number(def.movementScale))||Number(def.movementScale)<0||Number(def.movementScale)>1))return false;
    return true;
  }
  root.KELO_MELEE_SCHEMA_AUDIT={version:VERSION,ready:true,weaponClasses:WEAPON_CLASSES.length,attackProfiles:ATTACK_PROFILES.length,hitShapes:HIT_SHAPES.length,actionPhases:true};
  root.KeloMeleeSchema=Object.freeze({version:VERSION,weaponClasses:WEAPON_CLASSES,attackProfiles:ATTACK_PROFILES,hitShapes:HIT_SHAPES,validProfile});
})(typeof globalThis!=='undefined'?globalThis:window);
