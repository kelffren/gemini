/* KELO-INDEX
 * area: EFFECTS
 * keys: ENGINE REGISTRY DAMAGE HEAL SHIELD STATUS REUSABLE
 * hace: despacha efectos por tipo mediante handlers registrables; no conoce habilidades concretas ni visuals
 * online: puede ejecutarse detrás de authority adapters sin cambiar definitions
 */
(function(root){
  'use strict';
  const VERSION='effect-engine-v1.0.0';
  const handlers=new Map();
  let applied=0;

  function register(type,handler){
    const key=String(type||'');
    if(!key||typeof handler!=='function')throw new Error('INVALID_EFFECT_HANDLER');
    handlers.set(key,handler);return key;
  }
  function apply(effect,context){
    const e=effect&&typeof effect==='object'?effect:{};
    const type=String(e.type||'');
    if(!root.KeloEffectSchema||!root.KeloEffectSchema.supports(type))return Object.freeze({ok:false,reason:'UNKNOWN_EFFECT_TYPE',type:type});
    const handler=handlers.get(type);
    if(!handler)return Object.freeze({ok:false,reason:'EFFECT_RUNTIME_NOT_REGISTERED',type:type});
    const result=handler(e,context||{})||{};applied+=1;
    return Object.freeze(Object.assign({ok:result.ok!==false,type:type},result));
  }
  function applyAll(effects,context){return (Array.isArray(effects)?effects:[]).map(function(effect){return apply(effect,context);});}

  register('damage',function(effect,ctx){
    if(!root.KeloDamageResolver)return{ok:false,reason:'DAMAGE_RESOLVER_UNAVAILABLE'};
    return root.KeloDamageResolver.apply(ctx.target,Math.max(0,Number(effect.amount)||0));
  });
  register('heal',function(effect,ctx){
    const target=ctx.target;if(!target)return{ok:false,reason:'INVALID_TARGET'};
    const max=Math.max(0,Number(target.maxHp)||100),before=target.hp==null?max:Math.max(0,Number(target.hp)||0);
    const hp=Math.min(max,before+Math.max(0,Number(effect.amount)||0));target.hp=hp;
    return{amount:hp-before,hpBefore:before,hp:hp};
  });
  register('shield',function(effect,ctx){
    const target=ctx.target;if(!target)return{ok:false,reason:'INVALID_TARGET'};
    const amount=Math.max(0,Number(effect.amount)||0);target.keloShield=Math.max(0,Number(target.keloShield)||0)+amount;
    if(Number(effect.duration)>0)target.keloShieldT=Number(effect.duration);
    return{amount:amount,shield:target.keloShield,duration:Number(effect.duration)||0};
  });
  register('status',function(effect,ctx){
    if(!root.KeloStatusEffects||typeof root.KeloStatusEffects.apply!=='function')return{ok:false,reason:'STATUS_ENGINE_UNAVAILABLE'};
    return root.KeloStatusEffects.apply(ctx.target,effect,ctx);
  });

  root.KELO_EFFECT_ENGINE_AUDIT={version:VERSION,ready:true,registeredHandlers:function(){return handlers.size;},abilitySpecificLogic:false,presentationFree:true};
  root.KeloEffectEngine=Object.freeze({version:VERSION,register:register,apply:apply,applyAll:applyAll,has:function(type){return handlers.has(String(type||''));},metrics:function(){return Object.freeze({handlers:handlers.size,applied:applied});}});
})(typeof globalThis!=='undefined'?globalThis:window);
