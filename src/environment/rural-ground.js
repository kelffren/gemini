(function () {
  const REGISTRY=window.KELO_TILE_REGISTRY;
  const ATLAS=REGISTRY?.atlases?.ruralSoil;
  const R=REGISTRY?.ruralTiles;
  const originalRenderFarm=window.renderFarm;
  if(!ATLAS||!R||typeof originalRenderFarm!=='function'){
    console.error('[Kelo rural] registry atlas or farm renderer missing'); return;
  }

  const TILE=REGISTRY.worldTileSize||32;
  const PLOT=96;
  const GRID=Object.freeze([R.TOP_LEFT,R.TOP,R.TOP_RIGHT,R.LEFT,R.CENTER,R.RIGHT,R.BOTTOM_LEFT,R.BOTTOM,R.BOTTOM_RIGHT]);
  const sheet=new Image(); sheet.decoding='async';
  let ready=false;

  function origin(id){ return {x:(id%ATLAS.columns)*TILE,y:Math.floor(id/ATLAS.columns)*TILE}; }
  function tile(g,id,x,y){ const p=origin(id); g.drawImage(sheet,p.x,p.y,TILE,TILE,x,y,TILE,TILE); }
  function plot(g,x,y,index){
    for(let row=0;row<3;row++) for(let col=0;col<3;col++){
      let id=GRID[row*3+col];
      if(row===1&&col===1) id=[R.CENTER,R.CENTER_ALT_A,R.CENTER_ALT_B,R.CENTER_ALT_C][index%4];
      tile(g,id,x+col*TILE,y+row*TILE);
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

  window.renderFarm=function(farm){
    if(!ready){ originalRenderFarm(farm); return; }
    const now=Date.now();
    ctx.save(); ctx.imageSmoothingEnabled=false;
    ctx.fillStyle='rgba(22,80,49,.13)'; ctx.fillRect(farm.x-8,farm.y-8,farm.w+16,farm.h+16);
    ctx.strokeStyle='rgba(220,187,91,.55)'; ctx.lineWidth=2; ctx.setLineDash([12,8]); ctx.strokeRect(farm.x-8,farm.y-8,farm.w+16,farm.h+16); ctx.setLineDash([]);
    farm.crops.forEach((c,index)=>{
      const x=farm.x+20+(index%2)*110;
      const y=farm.y+30+Math.floor(index/2)*110;
      plot(ctx,x,y,index); crop(ctx,c,x,y,now,index);
    });
    ctx.restore();
  };

  window.KELO_RURAL_GROUND_AUDIT={
    version:'rural-v1', ready:false, assetLoaded:false, fallbackActive:true,
    atlas:ATLAS.src, atlasWidth:ATLAS.width, atlasHeight:ATLAS.height,
    tileSize:TILE, modularTiles:true, renderingMode:'authored-nine-slice-v1', plotSize:PLOT
  };

  sheet.onload=function(){
    if(sheet.naturalWidth!==ATLAS.width||sheet.naturalHeight!==ATLAS.height){
      console.error('[Kelo rural] invalid atlas dimensions',sheet.naturalWidth,sheet.naturalHeight); return;
    }
    ready=true; window.KELO_RURAL_GROUND_AUDIT.ready=true; window.KELO_RURAL_GROUND_AUDIT.assetLoaded=true; window.KELO_RURAL_GROUND_AUDIT.fallbackActive=false;
  };
  sheet.onerror=function(){ console.error('[Kelo rural] atlas load failed'); };
  sheet.src=ATLAS.src+'&rural=160';
})();
