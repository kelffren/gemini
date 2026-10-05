/* KELO-INDEX
 * area: WORLD / TILESETS / AI FANTASY SOURCE
 * owner: Kelo Tile Registry
 * purpose: registra el atlas AI fantasy como tileset colocable de 32px sin sustituir terreno LIVE
 */
(function(){
  const R=window.KELO_TILE_REGISTRY;
  if(!R)return;
  const atlas=Object.freeze({
    id:'kelo-ai-fantasy',
    src:'assets/world/tilesets/kelo-ai-fantasy-source.png?v=20261005a',
    width:1536,height:1024,
    tileWidth:32,tileHeight:32,columns:48,tileCount:1536,
    family:'kelo_ai_fantasy',experimental:true
  });
  window.KELO_AI_FANTASY_TILESET=atlas;
})();
