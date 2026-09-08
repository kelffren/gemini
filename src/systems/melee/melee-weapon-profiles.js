/* KELO-INDEX
 * area: MELEE
 * keys: CONTENT PROFILES SWORD REUSABLE DATA
 * hace: catálogo declarativo de perfiles melee; agregar armas no requiere modificar MeleeEngine
 * gameplay: conserva exactamente basic PvP 18 daño / 150 rango / 0.7 cooldown
 */
(function(root){
  'use strict';
  const VERSION='melee-weapon-profiles-v1.0.0';
  const registry=new Map();
  function register(def){
    if(!root.KeloMeleeSchema||!root.KeloMeleeSchema.validProfile(def))throw new Error('INVALID_MELEE_PROFILE');
    const item=Object.freeze({id:String(def.id),weaponClass:String(def.weaponClass),attackProfile:String(def.attackProfile),damage:Number(def.damage),range:Number(def.range),cooldown:Number(def.cooldown),damageType:String(def.damageType||'physical')});
    registry.set(item.id,item);return item;
  }
  function get(id){return registry.get(String(id||''))||null;}
  function list(){return Array.from(registry.values());}

  register({id:'sword_light_basic',weaponClass:'sword',attackProfile:'light_slash',damage:18,range:150,cooldown:0.7,damageType:'physical'});

  root.KELO_MELEE_PROFILE_AUDIT={version:VERSION,ready:true,profiles:function(){return registry.size;},basicProfile:'sword_light_basic',basicDamage:18,basicRange:150,basicCooldown:0.7};
  root.KeloMeleeProfiles=Object.freeze({version:VERSION,register:register,get:get,list:list});
})(typeof globalThis!=='undefined'?globalThis:window);
