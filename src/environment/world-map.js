(function () {
  const REGISTRY = window.KELO_TILE_REGISTRY;
  if (!REGISTRY?.atlases?.plaza || !REGISTRY?.families) {
    console.error('[Kelo world] tile registry missing');
    return;
  }

  const TILE = REGISTRY.worldTileSize || 32;
  const CHUNK = 512;
  const ATLAS = REGISTRY.atlases.plaza;
  const F = REGISTRY.families;
  const COLS = ATLAS.columns;
  const GROUND_STYLES = REGISTRY.styles?.districtGround?.profiles || {};
  const sheet = new Image();
  sheet.decoding = 'async';
  const cache = new Map();
  const MAX_CACHE = 24;
  let ready = false;

  const DISTRICTS = Object.freeze([
    { id:'central', name:'Plaza Central', x:1040, y:1240, w:800, h:560, kind:'plaza' },
    { id:'rural', name:'Distrito Rural', x:448, y:1320, w:720, h:640, kind:'farm' },
    { id:'arena', name:'Distrito Arena', x:1728, y:448, w:864, h:640, kind:'arena' },
    { id:'commerce', name:'Distrito Comercio', x:1888, y:1264, w:896, h:704, kind:'commerce' },
    { id:'gardens', name:'Jardines del Sur', x:1056, y:2144, w:896, h:704, kind:'garden' }
  ]);

  const ROAD_RECTS = Object.freeze([
    {x:384,y:1472,w:2496,h:128},
    {x:1376,y:384,w:128,h:2500},
    {x:1376,y:736,w:1120,h:128},
    {x:1376,y:2304,w:640,h:128}
  ]);

  const PLAZA_PADS = Object.freeze([
    {x:1888,y:1424,w:512,h:288},
    {x:1792,y:640,w:608,h:256},
    {x:1152,y:2240,w:704,h:352}
  ]);

  function insideRect(x,y,r){ return x>=r.x && y>=r.y && x<r.x+r.w && y<r.y+r.h; }
  function isRoad(x,y){ return ROAD_RECTS.some(r=>insideRect(x,y,r)) || PLAZA_PADS.some(r=>insideRect(x,y,r)); }
  function districtAt(x,y){ return DISTRICTS.find(d=>insideRect(x,y,d)) || null; }
  function styleAt(x,y){
    const district=districtAt(x,y);
    return GROUND_STYLES[district?.id] || GROUND_STYLES.default || {detailEvery:53,detailCluster:false,marbleAccentEvery:0};
  }
  function hash(gx,gy,salt=0){ return Math.abs(((gx+17+salt)*73856093)^((gy+29+salt)*19349663)); }
  function pick(gx,gy,list){ return list[hash(gx,gy)%list.length]; }
  function detailCell(gx,gy,style){
    if(!F.grassDetail?.length || !style.detailEvery) return false;
    if(hash(gx,gy,5)%style.detailEvery===0) return true;
    if(!style.detailCluster) return false;
    return hash(gx-1,gy,5)%style.detailEvery===0 || hash(gx,gy-1,5)%style.detailEvery===0;
  }
  function origin(id){ return {x:(id%COLS)*TILE,y:Math.floor(id/COLS)*TILE}; }
  function drawTile(g,id,dx,dy){
    const p=origin(id);
    g.drawImage(sheet,p.x,p.y,TILE,TILE,dx,dy,TILE,TILE);
  }

  function buildChunk(cx,cy){
    const key=cx+','+cy;
    if(cache.has(key)) return cache.get(key);
    const c=document.createElement('canvas'); c.width=CHUNK; c.height=CHUNK;
    const g=c.getContext('2d'); g.imageSmoothingEnabled=false;
    const worldX=cx*CHUNK, worldY=cy*CHUNK;
    const cols=Math.ceil(CHUNK/TILE), rows=Math.ceil(CHUNK/TILE);
    for(let gy=0;gy<rows;gy++) for(let gx=0;gx<cols;gx++){
      const wx=worldX+gx*TILE, wy=worldY+gy*TILE;
      const centerX=wx+TILE/2, centerY=wy+TILE/2;
      const globalGX=Math.floor(wx/TILE), globalGY=Math.floor(wy/TILE);
      const style=styleAt(centerX,centerY);
      let id;
      if(isRoad(centerX,centerY)) {
        id=pick(globalGX,globalGY,F.marble);
        if(style.marbleAccentEvery && F.marbleAccent?.length && hash(globalGX,globalGY,11)%style.marbleAccentEvery===0) {
          id=pick(globalGX+3,globalGY+7,F.marbleAccent);
        }
      } else {
        id=pick(globalGX,globalGY,F.grass);
        if(detailCell(globalGX,globalGY,style)) id=pick(globalGX,globalGY,F.grassDetail);
      }
      drawTile(g,id,gx*TILE,gy*TILE);
    }
    cache.set(key,c);
    if(cache.size>MAX_CACHE){ const first=cache.keys().next().value; cache.delete(first); }
    return c;
  }

  function visibleBounds(){
    const z=(window.CONFIG?.zoom)||1;
    const halfW=(window.screenW||window.innerWidth)/(2*z)+CHUNK;
    const halfH=(window.screenH||window.innerHeight)/(2*z)+CHUNK;
    const cam=window.camera||{x:1440,y:1520};
    return {
      minX:Math.max(0,Math.floor((cam.x-halfW)/CHUNK)),
      maxX:Math.min(Math.ceil((window.CONFIG?.worldWidth||3600)/CHUNK)-1,Math.floor((cam.x+halfW)/CHUNK)),
      minY:Math.max(0,Math.floor((cam.y-halfH)/CHUNK)),
      maxY:Math.min(Math.ceil((window.CONFIG?.worldHeight||3200)/CHUNK)-1,Math.floor((cam.y+halfH)/CHUNK))
    };
  }

  function drawLabels(g){
    g.save();
    g.textAlign='center';
    g.font='bold 18px ui-monospace, monospace';
    DISTRICTS.forEach(d=>{
      const x=d.x+d.w/2, y=d.y+26;
      g.fillStyle='rgba(7,12,8,.72)'; g.fillRect(x-92,y-18,184,26);
      g.fillStyle='#fff4cf'; g.fillText(d.name,x,y);
    });
    g.restore();
  }

  function draw(g){
    if(!ready) return false;
    const b=visibleBounds();
    for(let cy=b.minY;cy<=b.maxY;cy++) for(let cx=b.minX;cx<=b.maxX;cx++){
      g.drawImage(buildChunk(cx,cy),cx*CHUNK,cy*CHUNK);
    }
    drawLabels(g);
    return true;
  }

  sheet.onload=function(){
    if(sheet.naturalWidth!==ATLAS.width||sheet.naturalHeight!==ATLAS.height){
      console.error('[Kelo world] invalid atlas dimensions',sheet.naturalWidth,sheet.naturalHeight); return;
    }
    ready=true;
    window.KELO_WORLD_AUDIT.ready=true;
    window.KELO_WORLD_AUDIT.assetLoaded=true;
  };
  sheet.onerror=function(){ console.error('[Kelo world] atlas load failed'); };
  sheet.src=ATLAS.src+'&world=151';

  window.KELO_WORLD_AUDIT={
    version:'world-v1.1', ready:false, assetLoaded:false, chunkSize:CHUNK,
    districtCount:DISTRICTS.length, roadCount:ROAD_RECTS.length,
    districtStyleMode:REGISTRY.styles?.districtGround?.mode || null,
    styledDistrictCount:Object.keys(GROUND_STYLES).filter(k=>k!=='default').length,
    worldWidth:window.CONFIG?.worldWidth||3600, worldHeight:window.CONFIG?.worldHeight||3200
  };
  window.KELO_WORLD_RENDERER=Object.freeze({ draw, districts:DISTRICTS, chunkSize:CHUNK, get ready(){return ready;} });
})();
