/* KELO-INDEX
 * area: MELEE
 * keys: SCHEMA WEAPON CLASS ATTACK PROFILE
 * hace: vocabulario melee reusable; no contiene daño específico de contenido salvo contratos de campos
 */
(function(root){
  'use strict';
  const VERSION='melee-schema-v1.0.0';
  const WEAPON_CLASSES=Object.freeze(['unarmed','sword','katana','axe','dagger','club','hammer','spear']);
  const ATTACK_PROFILES=Object.freeze(['light_slash','heavy_slash','thrust','spin','overhead']);
  function validProfile(def){return !!(def&&def.id&&WEAPON_CLASSES.indexOf(String(def.weaponClass||''))>=0&&ATTACK_PROFILES.indexOf(String(def.attackProfile||''))>=0&&Number(def.range)>=0&&Number(def.cooldown)>=0&&Number(def.damage)>=0);}
  root.KELO_MELEE_SCHEMA_AUDIT={version:VERSION,ready:true,weaponClasses:WEAPON_CLASSES.length,attackProfiles:ATTACK_PROFILES.length};
  root.KeloMeleeSchema=Object.freeze({version:VERSION,weaponClasses:WEAPON_CLASSES,attackProfiles:ATTACK_PROFILES,validProfile:validProfile});
})(typeof globalThis!=='undefined'?globalThis:window);
