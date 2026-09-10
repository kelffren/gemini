/* KELO-INDEX
 * area: PVP / ABILITY MOVEMENT
 * owner: KeloPvPWorld support over KeloAbilities + KeloMovement
 * keys: PVP ABILITY CAST MOVEMENT PREDICTION WINDUP ACTIVE RECOVERY SERVER PARITY
 * purpose: predice localmente el movementScale temporal de abilities usando la primitive compartida sin crear otro movement owner
 * consumes: KeloAbilityActionTimeline, KeloAbilities.bus, KeloPvPWorld.state, KeloMeleeEngine, KeloMovement, KeloSimulation
 * online: replica la composición server min(meleeScale,castScale) antes de status; server conserva autoridad
 * do-not: NO damage, NO delivery, NO cooldown, NO VFX, NO second movement loop
 */
(function(){
'use strict';
const timeline=window.KeloAbilityActionTimeline;
if(!timeline||!window.KeloMovement||!window.KeloSimulation)return;
let cast=null,lastAbilityKey=null;
const audit=window.KELO_PVP_CAST_MOVEMENT_AUDIT={version:'pvp-cast-movement-prediction-v1',ready:true,abilityKey:null,active:false,phase:null,movementScale:1,meleeScale:1};
function pvpActive(){try{return !!(window.KeloPvPWorld&&window.KeloPvPWorld.state&&window.KeloPvPWorld.state.mode!=='social');}catch(_){return false;}}
function definitionOf(key){const defs=window.ABILITIES||[];return defs.find(d=>d&&d.key===key)||null;}
function meleeScale(){
  const a=window.KeloPvPWorld&&window.KeloPvPWorld.state&&window.KeloPvPWorld.state.basicAttack;
  if(!a||!window.KeloMeleeEngine)return 1;
  const p=window.KeloMeleeEngine.getProfile(a.profileId);
  return p?window.KeloMeleeEngine.movementScaleFor(p,a.phase):1;
}
function onCast(payload){
  if(!pvpActive()||!payload||!payload.abilityKey)return;
  const def=definitionOf(payload.abilityKey);if(!def)return;
  cast=timeline.create(def);lastAbilityKey=def.key;
}
function movementHook(ctx){
  if(!cast||cast.done||!pvpActive()||!ctx||!ctx.input)return;
  const c=timeline.movementScaleFor(cast),m=meleeScale(),base=Math.max(0.000001,m),target=Math.min(m,c),factor=target/base;
  ctx.input.normX=(Number(ctx.input.normX)||0)*factor;
  ctx.input.normY=(Number(ctx.input.normY)||0)*factor;
}
function tick(ctx){
  if(!pvpActive()){cast=null;}
  else if(cast&&!cast.done)timeline.advance(cast,Math.max(0,Number(ctx&&ctx.dt)||0));
  if(cast&&cast.done)cast=null;
  audit.abilityKey=lastAbilityKey;audit.active=!!cast;audit.phase=cast&&cast.phase||null;audit.movementScale=cast?timeline.movementScaleFor(cast):1;audit.meleeScale=meleeScale();
}
window.KeloAbilities&&window.KeloAbilities.bus&&window.KeloAbilities.bus.on('ABILITY_CAST',onCast);
window.KeloMovement.before('pvp-world:ability-cast-scale',movementHook,69);
window.KeloSimulation.after('pvp-world:ability-cast-timeline',tick,61);
})();
