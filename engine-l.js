(function () {
  // LIVE owner: plaza tiles + HiDPI + aimed-skill landing marker.
  // Plaza art metadata is data-driven through KELO_TILE_REGISTRY.
  const PLAZA = { x: 1040, y: 1240, w: 800, h: 560 };
  const REGISTRY = window.KELO_TILE_REGISTRY;
  if (!REGISTRY?.atlases?.plaza || !REGISTRY?.tiles || !REGISTRY?.families) {
    console.error('[Kelo plaza] visual tile registry missing');
    return;
  }
  const ATLAS = REGISTRY.atlases.plaza;
  const TILE = REGISTRY.worldTileSize;
  const COLS = ATLAS.columns;
  const T = REGISTRY.tiles;
  const F = REGISTRY.families;

  window.KELO_PLAZA_AUDIT = {
    version: 'V5.43',
    ready: false,
    assetLoaded: false,
    fallbackActive: true,
    registryVersion: REGISTRY.version,
    atlas: ATLAS.src,
    atlasWidth: ATLAS.width,
    atlasHeight: ATLAS.height,
    tileSize: TILE
  };

  function inPlaza(o) {
    const x=o.x||0, y=o.y||0, w=o.w||o.width||0, h=o.h||o.height||0;
    return x < PLAZA.x+PLAZA.w && x+w > PLAZA.x && y < PLAZA.y+PLAZA.h && y+h > PLAZA.y;
  }
  if (Array.isArray(obstacles)) {
    for (let i=obstacles.length-1;i>=0;i--) if (inPlaza(obstacles[i])) obstacles.splice(i,1);
  }

  function applyHiDPI() {
    const dpr=Math.min(window.devicePixelRatio||1,3);
    screenW=window.innerWidth; screenH=window.innerHeight;
    const needW=Math.floor(screenW*dpr), needH=Math.floor(screenH*dpr);
    if (canvas.width!==needW || canvas.height!==needH) {
      canvas.width=needW; canvas.height=needH;
      canvas.style.width=screenW+'px'; canvas.style.height=screenH+'px';
    }
    ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.imageSmoothingEnabled=false;
  }

  let floorLayer=null, propLayer=null;
  const sheet=new Image();
  sheet.decoding='async';

  function origin(id){ return {x:(id%COLS)*TILE,y:Math.floor(id/COLS)*TILE}; }
  function drawTile(g,id,dx,dy){
    const p=origin(id);
    g.drawImage(sheet,p.x,p.y,TILE,TILE,dx,dy,TILE,TILE);
  }
  function drawSprite(g,ids,gx,gy,w,h){
    for(let r=0;r<h;r++) for(let c=0;c<w;c++) {
      const id=ids[r*w+c]; if(id==null) continue;
      drawTile(g,id,(gx+c)*TILE,(gy+r)*TILE);
    }
  }
  function pick(gx,gy,list){
    const n=Math.abs(((gx+17)*73856093)^((gy+29)*19349663));
    return list[n%list.length];
  }

  function buildFallback() {
    const c=document.createElement('canvas'); c.width=PLAZA.w; c.height=PLAZA.h;
    const g=c.getContext('2d'); g.imageSmoothingEnabled=false;
    const cols=Math.ceil(PLAZA.w/TILE), rows=Math.ceil(PLAZA.h/TILE);
    const cx=Math.floor(cols/2), cy=Math.floor(rows/2);
    for(let gy=0;gy<rows;gy++) for(let gx=0;gx<cols;gx++) {
      const dx=Math.abs(gx-cx), dy=Math.abs(gy-cy);
      const marble=(dx<=5&&dy<=4)||dx<=1||dy<=1;
      g.fillStyle=marble ? (((gx+gy)&1)?'#f4efd9':'#fff9e9') : (((gx*3+gy)&1)?'#55d83c':'#49c934');
      g.fillRect(gx*TILE,gy*TILE,TILE,TILE);
      if(marble){
        g.strokeStyle='rgba(198,184,145,.42)'; g.lineWidth=1;
        g.beginPath(); g.moveTo(gx*TILE+3,gy*TILE+25); g.lineTo(gx*TILE+14,gy*TILE+15); g.lineTo(gx*TILE+27,gy*TILE+7); g.stroke();
      } else if(((gx*11+gy*7)%31)===0){
        g.fillStyle='#fff'; g.fillRect(gx*TILE+10,gy*TILE+11,3,3);
        g.fillStyle='#ffd34d'; g.fillRect(gx*TILE+11,gy*TILE+12,1,1);
      }
    }
    g.strokeStyle='#d9aa35'; g.lineWidth=3;
    g.strokeRect((cx-5)*TILE,(cy-4)*TILE,11*TILE,9*TILE);
    g.fillStyle='#2db8e9'; g.beginPath(); g.arc((cx+.5)*TILE,(cy+.5)*TILE,42,0,Math.PI*2); g.fill();
    g.strokeStyle='#f0c552'; g.lineWidth=5; g.stroke();
    floorLayer=c; propLayer=null;
    window.KELO_PLAZA_AUDIT.ready=true;
  }

  function bakeAtlas() {
    const cols=Math.ceil(PLAZA.w/TILE), rows=Math.ceil(PLAZA.h/TILE);
    const cx=Math.floor(cols/2), cy=Math.floor(rows/2);
    const floor=document.createElement('canvas'); floor.width=PLAZA.w; floor.height=PLAZA.h;
    const fg=floor.getContext('2d'); fg.imageSmoothingEnabled=false;
    for(let gy=0;gy<rows;gy++) for(let gx=0;gx<cols;gx++) {
      const dx=Math.abs(gx-cx), dy=Math.abs(gy-cy);
      const inSquare=dx<=5&&dy<=4;
      const marble=inSquare||dx<=1||dy<=1;
      let id;
      if(marble){
        id=pick(gx,gy,F.marble);
        const edge=inSquare&&((dx===5&&dy<=4)||(dy===4&&dx<=5));
        if(edge&&((gx+gy)%4===0)) id=pick(gx,gy,F.marbleGold);
        if((dx===0&&dy===4)||(dy===0&&dx===5)||(dx===4&&dy===3)) id=T.MARBLE_GREEN_DIAMOND;
      } else {
        id=pick(gx,gy,F.grass);
        if(((gx*11+gy*7)%29)===0) id=pick(gx,gy,F.grassDetail);
      }
      drawTile(fg,id,gx*TILE,gy*TILE);
    }
    drawTile(fg,T.MARBLE_GREEN_CENTER,cx*TILE,cy*TILE);

    const props=document.createElement('canvas'); props.width=PLAZA.w; props.height=PLAZA.h;
    const pg=props.getContext('2d'); pg.imageSmoothingEnabled=false;
    drawSprite(pg,T.FOUNTAIN,cx-1,cy-2,3,3);
    [[cx-5,cy-4],[cx+4,cy-4],[cx-5,cy+2],[cx+4,cy+2]].forEach(p=>drawSprite(pg,T.COLUMN,p[0],p[1],1,2));
    [[1,1],[cols-4,1],[1,rows-4],[cols-4,rows-4]].forEach(p=>drawSprite(pg,T.TREE,p[0],p[1],2,3));
    [[cx-8,cy-5,T.BUSH_FLOWERS],[cx+7,cy-5,T.BUSH_A],[cx-8,cy+4,T.BUSH_A],[cx+7,cy+4,T.BUSH_FLOWERS_B],[cx-7,cy-5,T.PLANTER],[cx+6,cy+4,T.PLANTER_FLOWERS]].forEach(p=>drawTile(pg,p[2],p[0]*TILE,p[1]*TILE));
    drawSprite(pg,T.BENCH,cx-9,cy-1,2,1); drawSprite(pg,T.BENCH,cx+7,cy-1,2,1);
    drawSprite(pg,T.FLOWERBED,cx-8,cy+6,2,1); drawSprite(pg,T.FLOWERBED,cx+6,cy-7,2,1);
    drawSprite(pg,T.LAMP,cx-3,1,1,2); drawSprite(pg,T.LAMP,cx+3,rows-3,1,2);
    floorLayer=floor; propLayer=props;
    window.KELO_PLAZA_AUDIT.ready=true;
    window.KELO_PLAZA_AUDIT.assetLoaded=true;
    window.KELO_PLAZA_AUDIT.fallbackActive=false;
  }

  buildFallback();
  sheet.onload=function(){
    if(sheet.naturalWidth!==ATLAS.width||sheet.naturalHeight!==ATLAS.height){
      console.error('[Kelo plaza] invalid tileset dimensions',sheet.naturalWidth,sheet.naturalHeight,'expected',ATLAS.width,ATLAS.height); return;
    }
    bakeAtlas();
  };
  sheet.onerror=function(){ console.error('[Kelo plaza] tileset load failed; deterministic fallback remains active'); };
  sheet.src=ATLAS.src+'?v=94';

  function landingPoint(){
    const range=skillAim.castRange||120;
    return {x:localPlayer.x+(skillAim.dirX||1)*range,y:localPlayer.y+(skillAim.dirY||0)*range,range};
  }
  function burst(x,y,color,n,size){
    if(typeof spawnParticle!=='function') return;
    for(let i=0;i<n;i++) spawnParticle(x+(Math.random()-.5)*28,y+(Math.random()-.5)*28,color||'#ffd166',size||16,.35+Math.random()*.5);
  }
  function trailLine(x1,y1,x2,y2,color){
    for(let i=0;i<=10;i++){ const t=i/10; burst(x1+(x2-x1)*t,y1+(y2-y1)*t,color,2,12); }
    if(typeof spawnDashTrail==='function') spawnDashTrail(x1,y1,x2,y2,color);
  }
  const _cast=castAimedSkill;
  castAimedSkill=function(index,typeId,dirX,dirY){
    const stone=STATE.equipped[index]; if(!stone||stone.currentCd>0) return;
    const land=landingPoint(), color=stone.color||'#ffd166';
    if(typeId==='dash'){
      stone.currentCd=stone.baseCd; dashTween.active=true; dashTween.t=0;
      dashTween.dur=.11+.08*(land.range/170); dashTween.fromX=localPlayer.x; dashTween.fromY=localPlayer.y;
      dashTween.toX=Math.max(24,Math.min(CONFIG.worldWidth-24,land.x)); dashTween.toY=Math.max(24,Math.min(CONFIG.worldHeight-24,land.y));
      aim.x=dirX; aim.y=dirY; trailLine(dashTween.fromX,dashTween.fromY,dashTween.toX,dashTween.toY,color); burst(dashTween.toX,dashTween.toY,color,14,18); return;
    }
    _cast(index,typeId,dirX,dirY); trailLine(localPlayer.x,localPlayer.y,land.x,land.y,color); burst(land.x,land.y,color,typeId==='meteor'?22:12,typeId==='meteor'?22:14);
  };

  function drawLanding(){
    if(!skillAim.active) return;
    const land=landingPoint(), z=CONFIG.zoom||1;
    ctx.save(); ctx.translate(screenW/2,screenH/2); ctx.scale(z,z); ctx.translate(-camera.x,-camera.y);
    ctx.strokeStyle='rgba(255,214,102,.95)'; ctx.fillStyle='rgba(255,214,102,.22)'; ctx.lineWidth=3;
    ctx.beginPath(); ctx.moveTo(localPlayer.x,localPlayer.y); ctx.lineTo(land.x,land.y); ctx.stroke();
    ctx.beginPath(); ctx.arc(land.x,land.y,skillAim.typeId==='meteor'?64:18,0,Math.PI*2); ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  const _r=render;
  render=function(){
    applyHiDPI(); _r();
    if(floorLayer){
      const z=CONFIG.zoom||1;
      ctx.save(); ctx.translate(screenW/2,screenH/2); ctx.scale(z,z); ctx.translate(-camera.x,-camera.y); ctx.imageSmoothingEnabled=false;
      ctx.drawImage(floorLayer,PLAZA.x,PLAZA.y); if(propLayer) ctx.drawImage(propLayer,PLAZA.x,PLAZA.y);
      if(typeof renderAvatar==='function'){
        if(typeof simulatedPlayers!=='undefined') simulatedPlayers.forEach(p=>renderAvatar(p,false));
        if(typeof localPlayer!=='undefined') renderAvatar(localPlayer,true);
      }
      ctx.restore();
    }
    drawLanding();
  };

  window.KELO_PLAZA_TILESET=Object.freeze({sourceMode:'registry-driven-v1',registryVersion:REGISTRY.version,assetPath:ATLAS.src,atlasWidth:ATLAS.width,atlasHeight:ATLAS.height,atlasTileSize:TILE,worldTileSize:TILE,columns:COLS,plaza:Object.freeze({...PLAZA})});
})();
