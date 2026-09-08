/* KELO-INDEX
 * area: EFFECTS
 * keys: SCHEMA DAMAGE HEAL SHIELD STATUS BUFF DEBUFF
 * hace: vocabulario canónico de efectos reutilizables; no ejecuta habilidades ni presentation
 */
(function(root){
  'use strict';
  const VERSION='effect-schema-v1.0.0';
  const TYPES=Object.freeze(['damage','heal','shield','status','burn','slow','poison','stun','knockback','root','silence','buff','debuff','lifesteal']);
  function supports(type){return TYPES.indexOf(String(type||''))>=0;}
  root.KELO_EFFECT_SCHEMA_AUDIT={version:VERSION,ready:true,typeCount:TYPES.length};
  root.KeloEffectSchema=Object.freeze({version:VERSION,types:TYPES,supports:supports});
})(typeof globalThis!=='undefined'?globalThis:window);
