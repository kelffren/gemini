/* KELO-INDEX
 * area: COMBAT
 * owner: KeloCombatEngine
 * keys: ENGINE ATTACK SWEEP HIT DAMAGE EVENTS AUTHORITY DIRECTION CARAVAN ACTION POLICY
 * purpose: orquesta ataques single/sweep sobre KeloHitResolver y KeloDamageResolver y respeta restricciones de acción publicadas por owners gameplay
 * public-api: KeloCombatEngine.beginAttack / attack / attackSweep
 * consumes: KeloCombatSchema, KeloHitResolver, KeloDamageResolver, KeloEvents, KeloCaravans opcional
 * state-owned: secuencia efímera de attackId; NO posee actor HP persistente
 * online: el mismo contrato puede ejecutarse server-side; presentation consume eventos semánticos
 * do-not: NO dibujar, NO reproducir assets, NO decidir input, NO mutar carretas
 */
(function(root){
  'use strict';
  const VERSION='combat-engine-v2.0.1-caravan-policy';
  let seq=1;

  function idOf(entity,fallback){return String(entity&&(entity.id||entity.playerKey)||fallback||'entity');}
  function normalizedDirection(attacker,target,explicit){
    const fallback={x:(Number(target&&target.x)||0)-(Number(attacker&&attacker.x)||0),y:(Number(target&&target.y)||0)-(Number(attacker&&attacker.y)||0)};
    if(root.KeloHitResolver&&root.KeloHitResolver.normalize)return root.KeloHitResolver.normalize(explicit,fallback);
    const raw=explicit&&Number.isFinite(Number(explicit.x))&&Number.isFinite(Number(explicit.y))?explicit:fallback,len=Math.hypot(Number(raw.x)||0,Number(raw.y)||0)||1;
    return{x:(Number(raw.x)||0)/len,y:(Number(raw.y)||0)/len};
  }
  function basePayload(options,hit,direction,targetOverride){
    const o=options||{},attacker=o.attacker,target=targetOverride||o.target,profile=o.profile||{},dir=direction||normalizedDirection(attacker,target,o.direction);
    return{
      attackId:String(o.attackId||('attack_'+(seq++).toString(36))),
      kind:String(o.kind||'melee'),
      profileId:o.profileId==null?null:String(o.profileId),
      weaponClass:o.weaponClass==null?null:String(o.weaponClass),
      attackProfile:o.attackProfile==null?null:String(o.attackProfile),
      actor:attacker,actorId:idOf(attacker,'attacker'),targetActor:target||null,targetActorId:target?idOf(target,'target'):null,
      origin:{x:Number(attacker&&attacker.x)||0,y:Number(attacker&&attacker.y)||0},
      target:target?{x:Number(target.x)||0,y:Number(target.y)||0}:{x:(Number(attacker&&attacker.x)||0)+dir.x*(Number(profile.range)||0),y:(Number(attacker&&attacker.y)||0)+dir.y*(Number(profile.range)||0)},
      direction:dir,confirmedHit:hit===true,
      visualStartedAt:Number(o.startedAt)||((root.performance&&root.performance.now)?root.performance.now():Date.now()),
      source:o.source||'combat-engine',
      gameplay:{range:Math.max(0,Number(profile.range)||0),cooldown:Math.max(0,Number(profile.cooldown)||0),damage:hit===true?Math.max(0,Number(profile.damage)||0):0,damageType:String(profile.damageType||'physical'),hitShape:String(profile.hitShape||'range'),arcDegrees:Math.max(0,Number(profile.arcDegrees)||0),windup:Math.max(0,Number(profile.windup)||0),active:Math.max(0,Number(profile.active)||0),recovery:Math.max(0,Number(profile.recovery)||0),movementScale:Number.isFinite(Number(profile.movementScale))?Number(profile.movementScale):1},
      visual:o.visual&&typeof o.visual==='object'?Object.assign({},o.visual):{scale:1,seed:Date.now()&65535}
    };
  }
  function emit(name,payload){if(root.KeloEvents&&typeof root.KeloEvents.emit==='function')root.KeloEvents.emit(name,payload);}
  function foundations(){return root.KeloCombatSchema&&root.KeloCombatSchema.events&&root.KeloHitResolver&&root.KeloDamageResolver;}
  function geometry(attacker,target,dir,profile){return profile&&profile.hitShape&&root.KeloHitResolver.resolveMelee?root.KeloHitResolver.resolveMelee(attacker,target,dir,profile):root.KeloHitResolver.withinRange(attacker,target,profile&&profile.range);}
  function actionAllowed(attacker){
    if(!root.KeloCaravans||typeof root.KeloCaravans.canActorAttack!=='function')return true;
    if(root.KeloCaravans.canActorAttack(idOf(attacker,'attacker'))===false)return false;
    if(typeof localPlayer!=='undefined'&&attacker===localPlayer&&root.KeloCaravans.canActorAttack()===false)return false;
    return true;
  }
  function applyDamageToTarget(target,profile,payload,events){
    emit(events.HIT_CONFIRMED,payload);
    const damage=root.KeloDamageResolver.apply(target,profile.damage);
    const damagePayload=Object.assign({},payload,{damage,amount:damage.amount,hp:damage.hp,absorbed:damage.absorbed,killed:damage.killed});
    emit(events.DAMAGE_APPLIED,damagePayload);
    if(damage.killed)emit(events.ENTITY_KILLED,damagePayload);
    return damagePayload;
  }

  function beginAttack(options){
    const o=options||{},attacker=o.attacker,profile=o.profile||{},events=root.KeloCombatSchema&&root.KeloCombatSchema.events;
    if(!foundations())return Object.freeze({ok:false,reason:'COMBAT_FOUNDATION_UNAVAILABLE'});
    if(!attacker)return Object.freeze({ok:false,reason:'INVALID_ATTACKER'});
    if(!actionAllowed(attacker))return Object.freeze({ok:false,reason:'ACTION_BLOCKED_BY_CART'});
    if(Math.max(0,Number(o.cooldownRemaining)||0)>0)return Object.freeze({ok:false,reason:'COOLDOWN'});
    const dir=normalizedDirection(attacker,null,o.direction),payload=Object.assign({},basePayload(o,false,dir,null),{confirmedHit:null,phase:'windup'});
    emit(events.ATTACK_STARTED,payload);
    return Object.freeze({ok:true,type:'ATTACK_STARTED',attackId:payload.attackId,cooldown:Math.max(0,Number(profile.cooldown)||0),payload});
  }

  function attack(options){
    const o=options||{},attacker=o.attacker,target=o.target,profile=o.profile||{},events=root.KeloCombatSchema&&root.KeloCombatSchema.events;
    if(!foundations())return Object.freeze({ok:false,reason:'COMBAT_FOUNDATION_UNAVAILABLE'});
    if(!attacker||!target||(target.hp!=null&&Number(target.hp)<=0))return Object.freeze({ok:false,reason:'INVALID_TARGET'});
    if(!actionAllowed(attacker))return Object.freeze({ok:false,reason:'ACTION_BLOCKED_BY_CART'});
    if(Math.max(0,Number(o.cooldownRemaining)||0)>0)return Object.freeze({ok:false,reason:'COOLDOWN'});
    const dir=normalizedDirection(attacker,target,o.direction),hit=geometry(attacker,target,dir,profile),payload=basePayload(o,hit.hit,dir,target);
    emit(events.ATTACK_STARTED,payload);
    if(!hit.hit){const miss=Object.assign({},payload,{ok:false,reason:hit.reason||'MISS',distance:hit.distance,confirmedHit:false});emit(events.ATTACK_RESOLVED,miss);return Object.freeze({ok:false,reason:miss.reason,attackId:payload.attackId,distance:hit.distance,range:hit.range,cooldown:Math.max(0,Number(profile.cooldown)||0),payload});}
    const damagePayload=applyDamageToTarget(target,profile,payload,events);
    emit(events.ATTACK_RESOLVED,Object.assign({},damagePayload,{ok:true}));
    return Object.freeze({ok:true,type:'DAMAGE',attackId:payload.attackId,targetId:idOf(target,'target'),amount:damagePayload.amount,requested:damagePayload.damage.requested,absorbed:damagePayload.absorbed,hp:damagePayload.hp,killed:damagePayload.killed,cooldown:Math.max(0,Number(profile.cooldown)||0),payload});
  }

  function attackSweep(options){
    const o=options||{},attacker=o.attacker,profile=o.profile||{},events=root.KeloCombatSchema&&root.KeloCombatSchema.events;
    if(!foundations())return Object.freeze({ok:false,reason:'COMBAT_FOUNDATION_UNAVAILABLE',hits:[]});
    if(!attacker)return Object.freeze({ok:false,reason:'INVALID_ATTACKER',hits:[]});
    if(!actionAllowed(attacker))return Object.freeze({ok:false,reason:'ACTION_BLOCKED_BY_CART',hits:[]});
    if(Math.max(0,Number(o.cooldownRemaining)||0)>0)return Object.freeze({ok:false,reason:'COOLDOWN',hits:[]});
    const dir=normalizedDirection(attacker,null,o.direction),targets=(Array.isArray(o.targets)?o.targets:[]).filter(t=>t&&t!==attacker&&(t.hp==null||Number(t.hp)>0));
    const resolved=targets.map(target=>({target,hit:geometry(attacker,target,dir,profile)})).filter(entry=>entry.hit.hit);
    resolved.sort((a,b)=>(Number(a.hit.distance)||0)-(Number(b.hit.distance)||0));
    const primary=resolved.length?resolved[0].target:null,payload=basePayload(o,resolved.length>0,dir,primary);
    if(o.skipStart!==true)emit(events.ATTACK_STARTED,payload);
    if(!resolved.length){const miss=Object.assign({},payload,{ok:false,reason:'NO_HIT',confirmedHit:false});emit(events.ATTACK_RESOLVED,miss);return Object.freeze({ok:false,reason:'NO_HIT',attackId:payload.attackId,hits:[],cooldown:Math.max(0,Number(profile.cooldown)||0),payload});}
    const hits=[];
    resolved.forEach((entry,index)=>{
      const hitPayload=Object.assign({},payload,{targetActor:entry.target,targetActorId:idOf(entry.target,'target'),target:{x:Number(entry.target.x)||0,y:Number(entry.target.y)||0},confirmedHit:true,hitIndex:index});
      const damagePayload=applyDamageToTarget(entry.target,profile,hitPayload,events);
      hits.push(Object.freeze({target:entry.target,targetId:idOf(entry.target,'target'),amount:damagePayload.amount,requested:damagePayload.damage.requested,absorbed:damagePayload.absorbed,hp:damagePayload.hp,killed:damagePayload.killed,geometry:entry.hit,payload:damagePayload}));
    });
    const resultPayload=Object.assign({},payload,{ok:true,confirmedHit:true,hitCount:hits.length,targetActor:primary,targetActorId:idOf(primary,'target')});
    emit(events.ATTACK_RESOLVED,resultPayload);
    return Object.freeze({ok:true,type:'SWEEP_DAMAGE',attackId:payload.attackId,hits:Object.freeze(hits.slice()),hitCount:hits.length,cooldown:Math.max(0,Number(profile.cooldown)||0),payload});
  }

  root.KELO_COMBAT_ENGINE_AUDIT={version:VERSION,ready:true,presentationFree:true,uiFree:true,assetFree:true,specificContent:false,directional:true,sweep:true,caravanActionPolicy:true};
  root.KeloCombatEngine=Object.freeze({version:VERSION,beginAttack,attack,attackSweep});
})(typeof globalThis!=='undefined'?globalThis:window);
