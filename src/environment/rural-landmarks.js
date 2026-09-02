(function () {
  const REGISTRY=window.KELO_TILE_REGISTRY;
  const ATLAS=REGISTRY?.atlases?.ruralLandmarks;
  const NATURE_ATLAS=REGISTRY?.atlases?.ruralNature;
  const T=REGISTRY?.ruralLandmarkTiles;
  const NT=REGISTRY?.ruralNatureTiles;
  const NS=REGISTRY?.ruralNatureSprites;
  const SPRITES=REGISTRY?.ruralLandmarkSprites;
  const STYLE=REGISTRY?.styles?.ruralLandmarks;
  const VEG=STYLE?.edgeVegetation;
  const originalRenderFarm=window.renderFarm;
  if(!ATLAS||!NATURE_ATLAS||!T||!NT||!NS||!SPRITES||!STYLE||!VEG||typeof originalRenderFarm!=='function'||typeof window.render!=='function'){
    console.error('[Kelo rural landmarks] registry or renderer missing'); return;
  }

  const TILE=REGISTRY.worldTileSize||32;
  const sheet=new Image(); sheet.decoding='async';
  const natureSheet=new Image(); natureSheet.decoding='async';
  let landmarkReady=false,natureReady=false,ready=false;

  function layout(farm){
    return Object.freeze({
      barn:Object.freeze({x:farm.x+264,y:farm.y+36,...SPRITES.barn,kind:'barn',source:'landmark'}),
      silo:Object.freeze({x:farm.x+360,y:farm.y+156,...SPRITES.silo,kind:'silo',source:'landmark'})
    });
  }
  function treeEntry(family,x,y){
    const sprite=NS[family];
    return Object.freeze({x,y,...sprite,kind:'tree',family,source:'nature'});
  }
  function vegetation(farm){
    return Object.freeze({
      trees:Object.freeze([
        treeEntry('oak',farm.x-94,farm.y+38),
        treeEntry('fruit',farm.x-78,farm.y+214),
        treeEntry('oak',farm.x+322,farm.y+340)
      ]),
      hedges:Object.freeze([
        Object.freeze({id:NT.HEDGE_A,x:farm.x-48,y:farm.y+132}),
        Object.freeze({id:NT.HEDGE_FLOWERS_A,x:farm.x-42,y:farm.y+172}),
        Object.freeze({id:NT.HEDGE_B,x:farm.x+32,y:farm.y+356}),
        Object.freeze({id:NT.HEDGE_FLOWERS_B,x:farm.x+66,y:farm.y+364}),
        Object.freeze({id:NT.HEDGE_A,x:farm.x+190,y:farm.y+372}),
        Object.freeze({id:NT.HEDGE_FLOWERS_A,x:farm.x+224,y:farm.y+366}),
        Object.freeze({id:NT.HEDGE_B,x:farm.x+362,y:farm.y+354}),
        Object.freeze({id:NT.HEDGE_FLOWERS_B,x:farm.x+398,y:farm.y+362})
      ]),
      details:Object.freeze([
        Object.freeze({id:NT.TALL_GRASS,x:farm.x-18,y:farm.y+286}),
        Object.freeze({id:NT.WILDFLOWERS,x:farm.x+138,y:farm.y+354}),
        Object.freeze({id:NT.STUMP,x:farm.x+286,y:farm.y+354}),
        Object.freeze({id:NT.STONE,x:farm.x+430,y:farm.y+304})
      ])
    });
  }

  function origin(id,atlas){return{x:(id%atlas.columns)*TILE,y:Math.floor(id/atlas.columns)*TILE};}
  function landmarkTile(g,id,x,y){const p=origin(id,ATLAS);g.drawImage(sheet,p.x,p.y,TILE,TILE,x,y,TILE,TILE);}
  function natureTile(g,id,x,y){const p=origin(id,NATURE_ATLAS);g.drawImage(natureSheet,p.x,p.y,TILE,TILE,x,y,TILE,TILE);}
  function landmarkSprite(g,entry){g.drawImage(sheet,entry.sx,entry.sy,entry.w,entry.h,entry.x,entry.y,entry.w,entry.h);}
  function natureSprite(g,entry){g.drawImage(natureSheet,entry.sx,entry.sy,entry.w,entry.h,entry.x,entry.y,entry.w,entry.h);}

  function drawScene(g,farm){
    const L=layout(farm),V=vegetation(farm);
    // Edge nature establishes the rural frame first; focal architecture stays visually dominant.
    V.trees.forEach(entry=>natureSprite(g,entry));
    V.hedges.forEach(entry=>natureTile(g,entry.id,entry.x,entry.y));
    V.details.forEach(entry=>natureTile(g,entry.id,entry.x,entry.y));
    landmarkSprite(g,L.barn); landmarkSprite(g,L.silo);
    landmarkTile(g,T.HAY,farm.x+248,farm.y+204);
    landmarkTile(g,T.CRATE,farm.x+280,farm.y+212);
    landmarkTile(g,T.BUSH,farm.x+440,farm.y+208);
    landmarkTile(g,T.FLOWERS,farm.x+408,farm.y+284);
  }

  window.renderFarm=function(farm){
    originalRenderFarm(farm);
    if(!ready)return;
    ctx.save();ctx.imageSmoothingEnabled=false;drawScene(ctx,farm);ctx.restore();
  };

  function actorBehind(entry,actor){
    return !!actor&&actor.x>=entry.x-12&&actor.x<=entry.x+entry.w+12&&actor.y>=entry.y+18&&actor.y<entry.y+entry.baseY;
  }
  function drawFrontScene(){
    if(!ready||typeof STATE==='undefined'||!STATE.farm||typeof localPlayer==='undefined')return;
    const L=layout(STATE.farm),V=vegetation(STATE.farm),entries=[L.barn,L.silo,...V.trees];
    const actors=[localPlayer].concat(typeof simulatedPlayers==='undefined'?[]:simulatedPlayers);
    const active=entries.filter(entry=>actors.some(actor=>actorBehind(entry,actor)));
    if(!active.length)return;
    const z=CONFIG.zoom||1;
    ctx.save();ctx.translate(screenW/2,screenH/2);ctx.scale(z,z);ctx.translate(-camera.x,-camera.y);ctx.imageSmoothingEnabled=false;
    active.sort((a,b)=>(a.y+a.baseY)-(b.y+b.baseY)).forEach(entry=>entry.source==='nature'?natureSprite(ctx,entry):landmarkSprite(ctx,entry));
    ctx.restore();
  }

  const previousRender=window.render;
  window.render=function(){previousRender();drawFrontScene();};

  window.KELO_RURAL_LANDMARK_AUDIT={
    version:'rural-landmarks-v1.3',ready:false,assetLoaded:false,natureAssetLoaded:false,fallbackActive:true,
    atlas:ATLAS.src,natureAtlas:NATURE_ATLAS.id,atlasWidth:ATLAS.width,atlasHeight:ATLAS.height,
    natureAtlasWidth:NATURE_ATLAS.width,natureAtlasHeight:NATURE_ATLAS.height,tileSize:TILE,
    renderingMode:STYLE.mode,landmarkCount:2,detailCount:4,treeCount:3,treeFamilyCount:2,hedgeCount:8,natureDetailCount:4,
    vegetationMode:VEG.mode,centerClear:VEG.centerClear,roadClearance:VEG.roadClearance,
    depthOcclusion:true,gameplayFootprint:STYLE.gameplayFootprint,cropClearance:38,gateClearance:16,stateMutation:false,
    bypassClearance:64,composition:'farmstead-l-cluster-with-authored-edge-nature-v2'
  };
  function markReady(){
    ready=landmarkReady&&natureReady;
    if(!ready)return;
    window.KELO_RURAL_LANDMARK_AUDIT.ready=true;
    window.KELO_RURAL_LANDMARK_AUDIT.assetLoaded=true;
    window.KELO_RURAL_LANDMARK_AUDIT.natureAssetLoaded=true;
    window.KELO_RURAL_LANDMARK_AUDIT.fallbackActive=false;
  }
  sheet.onload=function(){
    if(sheet.naturalWidth!==ATLAS.width||sheet.naturalHeight!==ATLAS.height){console.error('[Kelo rural landmarks] invalid atlas dimensions');return;}
    landmarkReady=true;markReady();
  };
  natureSheet.onload=function(){
    if(natureSheet.naturalWidth!==NATURE_ATLAS.width||natureSheet.naturalHeight!==NATURE_ATLAS.height){console.error('[Kelo rural vegetation] invalid authored nature atlas dimensions');return;}
    natureReady=true;markReady();
  };
  sheet.onerror=function(){console.error('[Kelo rural landmarks] atlas load failed');};
  natureSheet.onerror=function(){console.error('[Kelo rural vegetation] authored nature atlas load failed');};
  sheet.src=ATLAS.src+'&ruralLandmarks=183';
  natureSheet.src=NATURE_ATLAS.src;
})();
