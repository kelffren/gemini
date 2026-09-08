/* KELO-INDEX
 * area: VISUAL
 * keys: COMBAT BRIDGE EVENTS MELEE PRESENTATION
 * hace: traduce eventos de gameplay a eventos del pipeline visual; es la única frontera combat -> presentation
 * gameplay: nunca decide hit, daño, rango o cooldown
 */
(function(root){
  'use strict';
  const VERSION='combat-presentation-bridge-v1.0.0';
  let bound=false,stops=[];
  const audit=root.KELO_COMBAT_PRESENTATION_BRIDGE_AUDIT={version:VERSION,ready:false,bound:false,attackEvents:0,hitEvents:0,gameplayMutation:false};

  function visualEmit(name,payload){if(root.KeloVisualEventBus&&typeof root.KeloVisualEventBus.emit==='function')root.KeloVisualEventBus.emit(name,payload);}
  function bind(){
    if(bound)return true;
    const bus=root.KeloEvents,schema=root.KeloCombatSchema;
    if(!bus||!schema||!root.KeloVisualEventBus)return false;
    const events=schema.events;
    stops.push(bus.on(events.ATTACK_STARTED,function(payload){if(!payload||payload.kind!=='melee')return;audit.attackEvents+=1;visualEmit('MELEE_ATTACK_STARTED',payload);}));
    stops.push(bus.on(events.HIT_CONFIRMED,function(payload){if(!payload||payload.kind!=='melee')return;audit.hitEvents+=1;visualEmit('MELEE_HIT_CONFIRMED',payload);}));
    bound=true;audit.ready=true;audit.bound=true;return true;
  }
  function unbind(){stops.forEach(function(stop){try{stop();}catch(e){}});stops=[];bound=false;audit.bound=false;}
  if(!bind()){
    let attempts=0;const timer=setInterval(function(){attempts+=1;if(bind()||attempts>=80)clearInterval(timer);},50);
  }
  root.KeloCombatPresentationBridge=Object.freeze({version:VERSION,bind:bind,unbind:unbind,get bound(){return bound;}});
})(typeof globalThis!=='undefined'?globalThis:window);
