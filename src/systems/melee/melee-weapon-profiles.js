/* KELO-INDEX
 * area: MELEE
 * owner: KeloMeleeProfiles
 * keys: CONTENT PROFILES SWORD DATA ACTION WINDUP ACTIVE RECOVERY ARC
 * purpose: catálogo declarativo de perfiles melee; agregar armas no modifica engines
 * gameplay: basic conserva 18 daño / 150 rango / 0.7 cooldown y añade action-combat data
 * online: servidor puede cargar el mismo perfil por ID estable
 */
(function(root){
  'use strict';
  const VERSION='melee-weapon-profiles-v2.0.0-action-combat';
  const registry=new Map();
  function register(def){
    if(!root.KeloMeleeSchema||!root.KeloMeleeSchema.validProfile(def))throw new Error('INVALID_MELEE_PROFILE');
    const item=Object.freeze({
      id:String(def.id),weaponClass:String(def.weaponClass),attackProfile:String(def.attackProfile),damage:Number(def.damage),range:Number(def.range),cooldown:Number(def.cooldown),damageType:String(def.damageType||'physical'),
      hitShape:String(def.hitShape||'range'),arcDegrees:Number(def.arcDegrees)||0,forwardOffset:Number(def.forwardOffset)||0,hitRadius:Number(def.hitRadius)||0,hitWidth:Number(def.hitWidth)||0,
      windup:Number(def.windup)||0,active:Number(def.active)||0,recovery:Number(def.recovery)||0,movementScale:def.movementScale==null?1:Number(def.movementScale),
      knockback:Number(def.knockback)||0,stagger:Number(def.stagger)||0,charges:Math.max(1,Math.floor(Number(def.charges)||1)),rechargeTime:Number(def.rechargeTime)||0,cancelWindow:Number(def.cancelWindow)||0,
      visualProfileId:def.visualProfileId==null?null:String(def.visualProfileId)
    });
    registry.set(item.id,item);return item;
  }
  function get(id){return registry.get(String(id||''))||null;}
  function list(){return Array.from(registry.values());}

  register({id:'sword_light_basic',weaponClass:'sword',attackProfile:'light_slash',damage:18,range:150,cooldown:0.7,damageType:'physical',hitShape:'sector',arcDegrees:100,forwardOffset:16,windup:0.09,active:0.08,recovery:0.23,movementScale:0.72,knockback:18,stagger:0.09,charges:2,rechargeTime:0.55,cancelWindow:0.055,visualProfileId:'melee_sword_light_v2'});

  root.KELO_MELEE_PROFILE_AUDIT={version:VERSION,ready:true,profiles:function(){return registry.size;},basicProfile:'sword_light_basic',basicDamage:18,basicRange:150,basicCooldown:0.7,basicHitShape:'sector',basicArcDegrees:100};
  root.KeloMeleeProfiles=Object.freeze({version:VERSION,register,get,list});
})(typeof globalThis!=='undefined'?globalThis:window);
