(function () {
  const REGISTRY=window.KELO_TILE_REGISTRY;
  const ATLAS=REGISTRY?.atlases?.ruralSoil;
  const PROP_ATLAS=REGISTRY?.atlases?.ruralProps;
  const R=REGISTRY?.ruralTiles;
  const P=REGISTRY?.ruralPropTiles;
  const originalRenderFarm=window.renderFarm;
  if(!ATLAS||!PROP_ATLAS||!R||!P||typeof originalRenderFarm!=='function'){
    console.error('[Kelo rural] registry atlases or farm renderer missing'); return;
  }

  const TILE=REGISTRY.worldTileSize||32;
  const PLOT=96;
  const GRID=Object.freeze([R.TOP_LEFT,R.TOP,R.TOP_RIGHT,R.LEFT,R.CENTER,R.RIGHT,R.BOTTOM_LEFT,R.BOTTOM,R.BOTTOM_RIGHT]);
  const sheet=new Image(); sheet.decoding='async';
  const props=new Image(); props.decoding='async';
  let soilReady=false, propsReady=false;

  function origin(id,atlas){ return {x:(id%atlas.columns)*TILE,y:Math.floor(id/atlas.columns)*TILE}; }
  function tile(g,img,atlas,id,x,y){ const p=origin(id,atlas); g.drawImage(img,p.x,p.y,TILE,TILE,x,y,TILE,TILE); }
  function plot(g,x,y,index){
    for(let row=0;row<3;row++) for(let col=0;col<3;col++){
      let id=GRID[row*3+col];
      if(row===1&&col===1) id=[R.CENTER,R.CENTER_ALT_A,R.CENTER_ALT_B,R.CENTER_ALT_C][index%4];
      tile(g,sheet,ATLAS,id,x+col*TILE,y+row*TILE);
    }
  }
  function crop(g,c,x,y,now,index){
    if(!c.type) return;
    const meta=CROP_TYPES[c.type];
    const progress=Math.max(0,Math.min(1,(now-c.plantedAt)/(meta.growTime*1000)));
    const anchors=[[16,18],[48,18],[80,18],[16,50],[48,50],[80,50]];
    anchors.forEach((a,i)=>{
      const sway=((index+i)&1);
      const px=x+a[0], py=y+a[1];
      g.fillStyle='#285f2e'; g.fillRect(px-1+sway,py+4,3,9);
      g.fillStyle=progress>=1?'#e5bd45':'#70c94f';
      g.fillRect(px-5,py+2,5,3); g.fillRect(px+2,py,5,3);
      if(progress>.55){ g.fillStyle=c.type==='carrot'?'#f18b35':'#f2cf62'; g.fillRect(px-3,py-3,7,4); }
    });
  }

  function propTile(g,id,x,y){ tile(g,props,PROP_ATLAS,id,x,y); }
  function drawBoundary(g,farm){
    const left=farm.x-16, right=farm.x+farm.w+16, top=farm.y-16, bottom=farm.y+farm.h+16;
    const gateX=Math.round((farm.x+farm.w/2)/TILE)*TILE-TILE/2;
    for(let i=0;i<3;i++) propTile(g,P.DIRT_VERTICAL,gateX,bottom+i*TILE);
    propTile(g,P.DIRT_CROSS,gateX,bottom+3*TILE);
    for(let x=left+TILE;x<=right-TILE;x+=TILE){
      propTile(g,P.FENCE_H,x,top);
      if(Math.abs(x-gateX)>TILE/2) propTile(g,P.FENCE_H,x,bottom);
    }
    for(let y=top+TILE;y<=bottom-TILE;y+=TILE){
      propTile(g,P.FENCE_V,left,y);
      propTile(g,P.FENCE_V,right,y);
    }
    propTile(g,P.CORNER_LEFT,left,top);
    propTile(g,P.CORNER_RIGHT,right-TILE,top);
    propTile(g,P.CORNER_LEFT,left,bottom);
    propTile(g,P.CORNER_RIGHT,right-TILE,bottom);
    propTile(g,P.GATE_OPEN,gateX,bottom);
    propTile(g,P.FIELD_SIGN,left+TILE,top+TILE);
    propTile(g,P.WEED_A,left-TILE,top+2*TILE);
    propTile(g,P.STONE_A,right+6,top+5*TILE);
    propTile(g,P.WEED_B,right+4,bottom-2*TILE);
  }

  window.renderFarm=function(farm){
    if(!soilReady){ originalRenderFarm(farm); return; }
    const now=Date.now();
    ctx.save(); ctx.imageSmoothingEnabled=false;
    if(propsReady) drawBoundary(ctx,farm);
    ctx.fillStyle='rgba(22,80,49,.13)'; ctx.fillRect(farm.x-8,farm.y-8,farm.w+16,farm.h+16);
    farm.crops.forEach((c,index)=>{
      const x=farm.x+20+(index%2)*110;
      const y=farm.y+30+Math.floor(index/2)*110;
      plot(ctx,x,y,index); crop(ctx,c,x,y,now,index);
    });
    ctx.restore();
  };

  window.KELO_RURAL_GROUND_AUDIT={
    version:'rural-v2', ready:false, assetLoaded:false, propsLoaded:false, fallbackActive:true,
    atlas:ATLAS.src, propAtlas:PROP_ATLAS.src, atlasWidth:ATLAS.width, atlasHeight:ATLAS.height,
    propAtlasWidth:PROP_ATLAS.width, propAtlasHeight:PROP_ATLAS.height,
    tileSize:TILE, modularTiles:true, renderingMode:'authored-nine-slice-v1', plotSize:PLOT,
    boundaryMode:'modular-fence-gate-v1', dirtApproachTiles:3
  };

  function syncReady(){
    const a=window.KELO_RURAL_GROUND_AUDIT;
    a.assetLoaded=soilReady&&propsReady; a.propsLoaded=propsReady;
    a.ready=soilReady&&propsReady; a.fallbackActive=!soilReady;
  }
  sheet.onload=function(){
    if(sheet.naturalWidth!==ATLAS.width||sheet.naturalHeight!==ATLAS.height){
      console.error('[Kelo rural] invalid soil atlas dimensions',sheet.naturalWidth,sheet.naturalHeight); return;
    }
    soilReady=true; syncReady();
  };
  sheet.onerror=function(){ console.error('[Kelo rural] soil atlas load failed'); };
  props.onload=function(){
    if(props.naturalWidth!==PROP_ATLAS.width||props.naturalHeight!==PROP_ATLAS.height){
      console.error('[Kelo rural] invalid props atlas dimensions',props.naturalWidth,props.naturalHeight); return;
    }
    propsReady=true; syncReady();
  };
  props.onerror=function(){ console.error('[Kelo rural] props atlas load failed'); };
  sheet.src=ATLAS.src+'&rural=170';
  props.src=PROP_ATLAS.src+'&rural=170';
})();