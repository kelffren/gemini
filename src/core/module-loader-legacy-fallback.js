/* KELO-INDEX
 * area: CORE / BOOT LEGACY SUPPORT
 * owner: KeloModuleLoader legacy fallback data
 * keys: LEGACY FALLBACK MODULE FEATURE COMPATIBILITY
 * purpose: conserva exactamente los paquetes fallback históricos cuando KELO_FEATURE_REGISTRY no existe; se carga solo bajo demanda
 * public-api: __KELO_MODULE_LOADER_LEGACY_FALLBACK__ (internal compat only)
 * state-owned: definiciones legacy inmutables de módulos opcionales
 * legacy: SUPPORT; el runtime moderno usa KELO_FEATURE_REGISTRY y no descarga este archivo
 * do-not: NO ejecutar features, NO cargar durante first-playable, NO convertirse en segundo registry activo
 */
(function(root){
'use strict';
if(root.__KELO_MODULE_LOADER_LEGACY_FALLBACK__)return;
const pvp=Object.freeze([
  {src:'src/abilities/abilityData.js?v=20260916-pvp-first-use-1',name:'datos habilidades PvP'},
  {src:'src/abilities/stone-system.js?v=20260916-pvp-first-use-1',name:'piedras PvP'},
  {src:'src/abilities/kelo-ability-boot.js?v=20260916-pvp-first-use-1',name:'runtime habilidades PvP'},
  {src:'engine-net.js?v=20260916-pvp-first-use-1',name:'online PvP'},
  {src:'src/systems/pvp-world.js?v=20260916-pvp-first-use-1',name:'mundo PvP'},
  {src:'src/systems/pvp-combat-runtime-loader.js?v=20260916-pvp-first-use-1',name:'lifecycle combate PvP'}
]);
root.__KELO_MODULE_LOADER_LEGACY_FALLBACK__=Object.freeze({
  social:Object.freeze([
    {src:'src/ui/player-nameplate.js?v=2',name:'placas'},
    {src:'src/systems/nobility.js?v=4',name:'títulos'},
    {src:'src/environment/plaza-depth.js?v=219',name:'plaza'},
    {src:'src/ui/profile-panel-close.js?v=2',name:'perfil'},
    {src:'src/ui/self-interaction-ui.js?v=1',name:'perfil'}
  ]),
  world:Object.freeze([
    {src:'engine-m.js?v=94',name:'mundo'},{src:'engine-n.js?v=230',name:'mundo'},{src:'engine-o.js?v=96',name:'mundo'},
    {src:'engine-p.js?v=96',name:'mundo'},{src:'engine-q.js?v=94',name:'mundo'},{src:'engine-s.js?v=96',name:'mundo'},
    {src:'engine-ah.js?v=95',name:'mundo'},{src:'engine-ai.js?v=95',name:'mundo'},{src:'src/systems/illumination.js?v=2',name:'luz'}
  ]),
  pvp,
  bag:Object.freeze([{src:'src/ui/backpack-fantasy-v1.css?v=1',name:'estilo mochila',type:'style'},{src:'src/systems/backpack-system.js?v=2',name:'mochila'},{src:'src/ui/backpack-ui.js?v=4',name:'mochila'}]),
  mounts:Object.freeze([{src:'src/mounts/mount-catalog.js?v=2',name:'monturas'},{src:'src/mounts/mount-system.js?v=2',name:'monturas'},{src:'src/ui/mount-panel.js?v=2',name:'monturas'}]),
  market:Object.freeze([{src:'src/systems/market-escrow-system.js?v=1',name:'mercado'},{src:'src/ui/market-ui.js?v=2',name:'mercado'}]),
  titles:Object.freeze([{src:'src/systems/title-catalog.js?v=1',name:'títulos'},{src:'src/systems/player-stats.js?v=1',name:'títulos'},{src:'src/systems/title-system.js?v=1',name:'títulos'}]),
  appearance:Object.freeze([{src:'src/characters/character-customization.js?v=1',name:'apariencia'},{src:'src/ui/character-customizer-ui.js?v=1',name:'apariencia'}]),
  properties:Object.freeze([{src:'src/property/property-system.js?v=4',name:'propiedades'},{src:'src/ui/house-instance-ui.js?v=1',name:'propiedades'}])
});
})(typeof globalThis!=='undefined'?globalThis:window);
