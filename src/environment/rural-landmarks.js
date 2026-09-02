(function () {
  const REGISTRY=window.KELO_TILE_REGISTRY;
  const ATLAS=REGISTRY?.atlases?.ruralLandmarks;
  const T=REGISTRY?.ruralLandmarkTiles;
  const SPRITES=REGISTRY?.ruralLandmarkSprites;
  const STYLE=REGISTRY?.styles?.ruralLandmarks;
  const originalRenderFarm=window.renderFarm;
  if(!ATLAS||!T||!SPRITES||!STYLE||typeof originalRenderFarm!=='function'||typeof window.render!=='function'){
    console.error('[Kelo rural landmarks] registry or renderer missing'); return;
  }

  const TILE=REGISTRY.worldTileSize||32;
  const sheet=new Image(); sheet.decoding='async';
  let ready=false;

  function layout(farm){
    return Object.freeze({
      barn:Object.freeze({x:farm.x+264,y:farm.y+36,...SPRITES.barn,kind:'barn'}),
      silo:Object.freeze({x:farm.x+424,y:farm.y+36,...SPRITES.silo,kind:'silo'})
    });
  }
  function origin(id){return{x:(id%ATLAS.columns)*TILE,y:Math.floor(id/ATLAS.columns)*TILE};}
  function tile(g,id,x,y){const p=origin(id);g.drawImage(sheet,p.x,p.y,TILE,TILE,x,y,TILE,TILE);}
  function sprite(g,entry){g.drawImage(sheet,entry.sx,entry.sy,entry.w,entry.h,entry.x,entry.y,entry.w,entry.h);}

  function drawLandmarks(g,farm){
    const L=layout(farm);
    sprite(g,L.barn); sprite(g,L.silo);
    tile(g,T.HAY,farm.x+248,farm.y+204);
    tile(g,T.CRATE,farm.x+280,farm.y+212);
    tile(g,T.BUSH,farm.x+440,farm.y+208);
    tile(g,T.FLOWERS,farm.x+408,farm.y+240);
  }

  window.renderFarm=function(farm){
    originalRenderFarm(farm);
    if(!ready)return;
    ctx.save();ctx.imageSmoothingEnabled=false;drawLandmarks(ctx,farm);ctx.restore();
  };

  function actorBehind(entry,actor){
    return !!actor&&actor.x>=entry.x-12&&actor.x<=entry.x+entry.w+12&&actor.y>=entry.y+18&&actor.y<entry.y+entry.baseY;
  }
  function drawFrontLandmarks(){
    if(!ready||typeof STATE==='undefined'||!STATE.farm||typeof localPlayer==='undefined')return;
    const L=layout(STATE.farm),entries=[L.barn,L.silo];
    const actors=[localPlayer].concat(typeof simulatedPlayers==='undefined'?[]:simulatedPlayers);
    const active=entries.filter(entry=>actors.some(actor=>actorBehind(entry,actor)));
    if(!active.length)return;
    const z=CONFIG.zoom||1;
    ctx.save();ctx.translate(screenW/2,screenH/2);ctx.scale(z,z);ctx.translate(-camera.x,-camera.y);
    ctx.imageSmoothingEnabled=false;
    active.sort((a,b)=>(a.y+a.baseY)-(b.y+b.baseY)).forEach(entry=>sprite(ctx,entry));
    ctx.restore();
  }

  const previousRender=window.render;
  window.render=function(){previousRender();drawFrontLandmarks();};

  window.KELO_RURAL_LANDMARK_AUDIT={
    version:'rural-landmarks-v1',ready:false,assetLoaded:false,fallbackActive:true,
    atlas:ATLAS.src,atlasWidth:ATLAS.width,atlasHeight:ATLAS.height,tileSize:TILE,
    renderingMode:STYLE.mode,landmarkCount:2,detailCount:4,depthOcclusion:true,
    gameplayFootprint:STYLE.gameplayFootprint,cropClearance:38,gateClearance:16,stateMutation:false
  };
  sheet.onload=function(){
    if(sheet.naturalWidth!==ATLAS.width||sheet.naturalHeight!==ATLAS.height){
      console.error('[Kelo rural landmarks] invalid atlas dimensions',sheet.naturalWidth,sheet.naturalHeight);return;
    }
    ready=true;
    window.KELO_RURAL_LANDMARK_AUDIT.ready=true;
    window.KELO_RURAL_LANDMARK_AUDIT.assetLoaded=true;
    window.KELO_RURAL_LANDMARK_AUDIT.fallbackActive=false;
  };
  sheet.onerror=function(){console.error('[Kelo rural landmarks] atlas load failed');};
  sheet.src=ATLAS.src+'&ruralLandmarks=180';
})();
