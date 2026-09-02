(function () {
  const REGISTRY=window.KELO_TILE_REGISTRY;
  const ATLAS=REGISTRY?.atlases?.ruralLandmarks;
  const NATURE_ATLAS=REGISTRY?.atlases?.plaza;
  const T=REGISTRY?.ruralLandmarkTiles;
  const N=REGISTRY?.tiles;
  const SPRITES=REGISTRY?.ruralLandmarkSprites;
  const STYLE=REGISTRY?.styles?.ruralLandmarks;
  const VEG=STYLE?.edgeVegetation;
  const originalRenderFarm=window.renderFarm;
  if(!ATLAS||!NATURE_ATLAS||!T||!N||!SPRITES||!STYLE||!VEG||typeof originalRenderFarm!=='function'||typeof window.render!=='function'){
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
  function vegetation(farm){
    const tree=(x,y)=>Object.freeze({x,y,w:64,h:96,baseY:96,kind:'tree',source:'nature'});
    return Object.freeze({
      trees:Object.freeze([
        tree(farm.x-124,farm.y-8),
        tree(farm.x-116,farm.y+138),
        tree(farm.x-128,farm.y+316),
        tree(farm.x+104,farm.y+360),
        tree(farm.x+300,farm.y+360)
      ]),
      hedges:Object.freeze([
        Object.freeze({id:N.BUSH_A,x:farm.x-56,y:farm.y+18}),
        Object.freeze({id:N.BUSH_B,x:farm.x-56,y:farm.y+70}),
        Object.freeze({id:N.BUSH_FLOWERS,x:farm.x-56,y:farm.y+208}),
        Object.freeze({id:N.BUSH_A,x:farm.x-56,y:farm.y+260}),
        Object.freeze({id:N.BUSH_B,x:farm.x+20,y:farm.y+382}),
        Object.freeze({id:N.BUSH_A,x:farm.x+52,y:farm.y+382}),
        Object.freeze({id:N.BUSH_FLOWERS_B,x:farm.x+196,y:farm.y+382}),
        Object.freeze({id:N.BUSH_B,x:farm.x+228,y:farm.y+382}),
        Object.freeze({id:N.BUSH_A,x:farm.x+396,y:farm.y+382}),
        Object.freeze({id:N.BUSH_FLOWERS,x:farm.x+428,y:farm.y+382})
      ])
    });
  }

  function origin(id,atlas){return{x:(id%atlas.columns)*TILE,y:Math.floor(id/atlas.columns)*TILE};}
  function landmarkTile(g,id,x,y){const p=origin(id,ATLAS);g.drawImage(sheet,p.x,p.y,TILE,TILE,x,y,TILE,TILE);}
  function natureTile(g,id,x,y){const p=origin(id,NATURE_ATLAS);g.drawImage(natureSheet,p.x,p.y,TILE,TILE,x,y,TILE,TILE);}
  function landmarkSprite(g,entry){g.drawImage(sheet,entry.sx,entry.sy,entry.w,entry.h,entry.x,entry.y,entry.w,entry.h);}
  function treeSprite(g,entry){
    for(let r=0;r<3;r++)for(let c=0;c<2;c++){
      const id=N.TREE[r*2+c],p=origin(id,NATURE_ATLAS);
      g.drawImage(natureSheet,p.x,p.y,TILE,TILE,entry.x+c*TILE,entry.y+r*TILE,TILE,TILE);
    }
  }

  function drawScene(g,farm){
    const L=layout(farm),V=vegetation(farm);
    landmarkSprite(g,L.barn); landmarkSprite(g,L.silo);
    landmarkTile(g,T.HAY,farm.x+248,farm.y+204);
    landmarkTile(g,T.CRATE,farm.x+280,farm.y+212);
    landmarkTile(g,T.BUSH,farm.x+440,farm.y+208);
    landmarkTile(g,T.FLOWERS,farm.x+408,farm.y+284);
    V.trees.forEach(entry=>treeSprite(g,entry));
    V.hedges.forEach(entry=>natureTile(g,entry.id,entry.x,entry.y));
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
    active.sort((a,b)=>(a.y+a.baseY)-(b.y+b.baseY)).forEach(entry=>entry.source==='nature'?treeSprite(ctx,entry):landmarkSprite(ctx,entry));
    ctx.restore();
  }

  const previousRender=window.render;
  window.render=function(){previousRender();drawFrontScene();};

  window.KELO_RURAL_LANDMARK_AUDIT={
    version:'rural-landmarks-v1.2',ready:false,assetLoaded:false,natureAssetLoaded:false,fallbackActive:true,
    atlas:ATLAS.src,natureAtlas:NATURE_ATLAS.src,atlasWidth:ATLAS.width,atlasHeight:ATLAS.height,tileSize:TILE,
    renderingMode:STYLE.mode,landmarkCount:2,detailCount:4,treeCount:5,hedgeCount:10,
    vegetationMode:VEG.mode,centerClear:VEG.centerClear,roadClearance:VEG.roadClearance,
    depthOcclusion:true,gameplayFootprint:STYLE.gameplayFootprint,cropClearance:38,gateClearance:16,stateMutation:false,
    bypassClearance:64,composition:'farmstead-l-cluster-with-edge-vegetation-v1'
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
    if(natureSheet.naturalWidth!==NATURE_ATLAS.width||natureSheet.naturalHeight!==NATURE_ATLAS.height){console.error('[Kelo rural vegetation] invalid nature atlas dimensions');return;}
    natureReady=true;markReady();
  };
  sheet.onerror=function(){console.error('[Kelo rural landmarks] atlas load failed');};
  natureSheet.onerror=function(){console.error('[Kelo rural vegetation] nature atlas load failed');};
  sheet.src=ATLAS.src+'&ruralLandmarks=182';
  natureSheet.src=NATURE_ATLAS.src+'&ruralNature=182';
})();
