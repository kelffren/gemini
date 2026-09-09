/* KELO-INDEX
 * area: COMBAT
 * owner: KeloCombatEngine
 * keys: ENGINE ATTACK HIT DAMAGE EVENTS AUTHORITY CARAVAN ACTION POLICY
 * purpose: orquesta validación geométrica, daño y eventos semánticos; respeta restricciones de acción publicadas por owners gameplay
 * public-api: KeloCombatEngine.attack
 * consumes: KeloCombatSchema, KeloHitResolver, KeloDamageResolver, KeloEvents, KeloCaravans opcional
 * state-owned: secuencia local de attackId
 * extension-points: authority resolver y políticas de acción explícitas de owners existentes
 * reuse: melee/basic attacks pasan por este owner
 * legacy: none
 * do-not: NO conocer renderer/UI/assets ni mutar carretas; solo consulta su API pública
 */
(function(root){
  'use strict';
  const VERSION='combat-engine-v1.1.0';
  let seq=1;

  function idOf(entity,fallback){return String(entity&&(entity.id||entity.playerKey)||fallback||'entity');}
  function direction(attacker,target){const dx=(Number(target&&target.x)||0)-(Number(attacker&&attacker.x)||0),dy=(Number(target&&target.y)||0)-(Number(attacker&&attacker.y)||0),len=Math.hypot(dx,dy)||1;return{x:dx/len,y:dy/len};}
  function basePayload(options,hit){
    const o=options||{},attacker=o.attacker,target=o.target,profile=o.profile||{},dir=direction(attacker,target);
    return{
      attackId:String(o.attackId||('attack_'+(seq++).toString(36))),kind:String(o.kind||'melee'),profileId:o.profileId==null?null:String(o.profileId),weaponClass:o.weaponClass==null?null:String(o.weaponClass),attackProfile:o.attackProfile==null?null:String(o.attackProfile),actor:attacker,actorId:idOf(attacker,'attacker'),targetActor:target,targetActorId:idOf(target,'target'),origin:{x:Number(attacker&&attacker.x)||0,y:Number(attacker&&attacker.y)||0},target:{x:Number(target&&target.x)||0,y:Number(target&&target.y)||0},direction:dir,confirmedHit:hit===true,visualStartedAt:Number(o.startedAt)||((root.performance&&root.performance.now)?root.performance.now():Date.now()),source:o.source||'combat-engine',gameplay:{range:Math.max(0,Number(profile.range)||0),cooldown:Math.max(0,Number(profile.cooldown)||0),damage:hit===true?Math.max(0,Number(profile.damage)||0):0,damageType:String(profile.damageType||'physical')},visual:o.visual&&typeof o.visual==='object'?Object.assign({},o.visual):{scale:1,seed:Date.now()&65535}
    };
  }
  function emit(name,payload){if(root.KeloEvents&&typeof root.KeloEvents.emit==='function')root.KeloEvents.emit(name,payload);}
  function actionAllowed(attacker){return !(root.KeloCaravans&&typeof root.KeloCaravans.canActorAttack==='function')||root.KeloCaravans.canActorAttack(idOf(attacker,'attacker'));}
  function attack(options){
    const o=options||{},attacker=o.attacker,target=o.target,profile=o.profile||{},events=root.KeloCombatSchema&&root.KeloCombatSchema.events;
    if(!events||!root.KeloHitResolver||!root.KeloDamageResolver)return Object.freeze({ok:false,reason:'COMBAT_FOUNDATION_UNAVAILABLE'});
    if(!attacker||!target||(target.hp!=null&&Number(target.hp)<=0))return Object.freeze({ok:false,reason:'INVALID_TARGET'});
    if(!actionAllowed(attacker))return Object.freeze({ok:false,reason:'ACTION_BLOCKED_BY_CART'});
    if(Math.max(0,Number(o.cooldownRemaining)||0)>0)return Object.freeze({ok:false,reason:'COOLDOWN'});
    const hit=root.KeloHitResolver.withinRange(attacker,target,profile.range),payload=basePayload(o,hit.hit);emit(events.ATTACK_STARTED,payload);
    if(!hit.hit){const miss=Object.assign({},payload,{ok:false,reason:'OUT_OF_RANGE',distance:hit.distance,confirmedHit:false});emit(events.ATTACK_RESOLVED,miss);return Object.freeze({ok:false,reason:'OUT_OF_RANGE',attackId:payload.attackId,distance:hit.distance,range:hit.range,cooldown:0,payload:payload});}
    emit(events.HIT_CONFIRMED,payload);const damage=root.KeloDamageResolver.apply(target,profile.damage),damagePayload=Object.assign({},payload,{damage:damage,amount:damage.amount,hp:damage.hp,absorbed:damage.absorbed,killed:damage.killed});emit(events.DAMAGE_APPLIED,damagePayload);if(damage.killed)emit(events.ENTITY_KILLED,damagePayload);emit(events.ATTACK_RESOLVED,Object.assign({},damagePayload,{ok:true}));return Object.freeze({ok:true,type:'DAMAGE',attackId:payload.attackId,targetId:idOf(target,'target'),amount:damage.amount,requested:damage.requested,absorbed:damage.absorbed,hp:damage.hp,killed:damage.killed,cooldown:Math.max(0,Number(profile.cooldown)||0),payload:payload});
  }

  root.KELO_COMBAT_ENGINE_AUDIT={version:VERSION,ready:true,presentationFree:true,uiFree:true,assetFree:true,specificContent:false,caravanActionPolicy:true};
  root.KeloCombatEngine=Object.freeze({version:VERSION,attack:attack});
})(typeof globalThis!=='undefined'?globalThis:window);
