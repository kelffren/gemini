(function(){
  'use strict';
  const R=window.KELO_TILE_REGISTRY;
  if(!R){console.error('[Kelo prop contract] TileRegistry missing');return;}
  const defs=[];
  const plazaNatureAtlas=R.atlases?.plazaNature;
  const ruralPropsAtlas=R.atlases?.ruralProps;
  const ruralFrames=R.ruralPropTiles;
  const TILE=R.worldTileSize||32;
  const layerGroups=Object.freeze({
    plazaNature:Object.freeze({id:'plaza-nature',ownership:'plaza-nature-props-v1',priority:10,renderMode:'layer-stack',back:Object.freeze({phase:'props_back'}),front:Object.freeze({phase:'props_front'})}),
    plazaFountain:Object.freeze({id:'plaza-fountain',ownership:'plaza-fountain-v1',priority:10,renderMode:'layer-stack',back:Object.freeze({phase:'props_back'}),front:Object.freeze({phase:'props_front'})}),
    ruralBoundary:Object.freeze({id:'rural-boundary',ownership:'rural-farm-boundary-props-v1',priority:8,renderMode:'layer-stack',back:Object.freeze({phase:'props_back'})})
  });
  if(plazaNatureAtlas&&Array.isArray(R.plazaNatureProps)){
    for(const p of R.plazaNatureProps){defs.push(Object.freeze({id:p.id,family:'nature_prop',asset:'plazaNature',frame:p.sprite||0,layerGroup:'plazaNature',layerRole:'back',position:Object.freeze({x:p.x,y:p.y}),size:Object.freeze({w:p.w,h:p.h}),anchor:Object.freeze({x:0.5,y:1}),visualBounds:Object.freeze({x:p.x,y:p.y,w:p.w,h:p.h}),footprint:Object.freeze({x:p.x+Math.round(p.w*0.28),y:p.baseY-18,w:Math.round(p.w*0.44),h:18}),collider:Object.freeze({mode:'none'}),layers:Object.freeze({back:'props_back',front:'props_front'}),priority:10,district:'central',occlusion:Object.freeze({mode:'actor-base-y-clip-v1',baseY:p.baseY,clipPadding:8}),visualOnly:true}));}
  }
  const assets=Object.freeze({
    plazaNature:Object.freeze({id:'plazaNature',src:plazaNatureAtlas?.src,width:plazaNatureAtlas?.width,height:plazaNatureAtlas?.height,frameWidth:plazaNatureAtlas?.spriteWidth,frameHeight:plazaNatureAtlas?.spriteHeight,columns:plazaNatureAtlas?.columns}),
    ruralProps:Object.freeze({id:'ruralProps',src:ruralPropsAtlas?.src,width:ruralPropsAtlas?.width,height:ruralPropsAtlas?.height,frameWidth:ruralPropsAtlas?.tileWidth||TILE,frameHeight:ruralPropsAtlas?.tileHeight||TILE,columns:ruralPropsAtlas?.columns}),
    plazaFountainBack:Object.freeze({id:'plazaFountainBack',src:'assets/plaza-fountain-back.PNG?art=201',width:1254,height:1254,frameWidth:1254,frameHeight:1254,columns:1}),
    plazaFountainFront:Object.freeze({id:'plazaFountainFront',src:'assets/plaza-fountain-front.PNG?art=201',width:1254,height:1254,frameWidth:1254,frameHeight:1254,columns:1})
  });
  defs.push(Object.freeze({id:'plaza-fountain-central-back',family:'landmark_prop',asset:'plazaFountainBack',frame:0,layerGroup:'plazaFountain',layerRole:'back',position:Object.freeze({x:1340,y:1420}),size:Object.freeze({w:200,h:200}),anchor:Object.freeze({x:0.5,y:1}),visualBounds:Object.freeze({x:1340,y:1420,w:200,h:200}),footprint:Object.freeze({x:1390,y:1492,w:100,h:60}),collider:Object.freeze({mode:'rect',x:1390,y:1492,w:100,h:60,noDraw:true}),layers:Object.freeze({back:'props_back',front:'props_front'}),priority:10,district:'central',occlusion:Object.freeze({mode:'none'}),visualOnly:false}));
  defs.push(Object.freeze({id:'plaza-fountain-central-front',family:'landmark_prop',asset:'plazaFountainFront',frame:0,layerGroup:'plazaFountain',layerRole:'front',position:Object.freeze({x:1366,y:1508}),size:Object.freeze({w:148,h:148}),anchor:Object.freeze({x:0.5,y:1}),visualBounds:Object.freeze({x:1366,y:1508,w:148,h:148}),footprint:Object.freeze({x:1390,y:1492,w:100,h:60}),collider:Object.freeze({mode:'none'}),layers:Object.freeze({back:'props_back',front:'props_front'}),priority:10,district:'central',occlusion:Object.freeze({mode:'actor-base-y-redraw-v1',baseY:1592,bounds:Object.freeze({x:1328,y:1408,w:224,h:284})}),visualOnly:true}));
  function ruralTile(frame,x,y,id,family){return Object.freeze({id,family:family||'rural_boundary_prop',asset:'ruralProps',frame,layerGroup:'ruralBoundary',layerRole:'back',position:Object.freeze({x,y}),size:Object.freeze({w:TILE,h:TILE}),anchor:Object.freeze({x:0,y:0}),visualBounds:Object.freeze({x,y,w:TILE,h:TILE}),footprint:Object.freeze({x,y:y+Math.round(TILE*0.65),w:TILE,h:Math.max(1,Math.round(TILE*0.35))}),collider:Object.freeze({mode:'none'}),layers:Object.freeze({back:'props_back',front:null}),priority:8,district:'rural',occlusion:Object.freeze({mode:'none'}),visualOnly:true});}
  function buildRuralFarmBoundary(farm){
    if(!farm||!ruralPropsAtlas||!ruralFrames)return Object.freeze([]);
    const out=[];const left=farm.x-16,right=farm.x+farm.w+16,top=farm.y-16,bottom=farm.y+farm.h+16;const gateX=Math.round((farm.x+farm.w/2)/TILE)*TILE-TILE/2;let n=0;
    const add=(frame,x,y,role)=>out.push(ruralTile(frame,x,y,`rural-boundary-${role}-${n++}`,`rural_${role}`));
    add(ruralFrames.DIRT_VERTICAL,gateX,top-TILE,'threshold');
    for(let x=left+TILE;x<=right-TILE;x+=TILE){if(Math.abs(x-gateX)>TILE/2)add(ruralFrames.FENCE_H,x,top,'fence');add(ruralFrames.FENCE_H,x,bottom,'fence');}
    for(let y=top+TILE;y<=bottom-TILE;y+=TILE){add(ruralFrames.FENCE_V,left,y,'fence');add(ruralFrames.FENCE_V,right,y,'fence');}
    add(ruralFrames.CORNER_LEFT,left,top,'corner');add(ruralFrames.CORNER_RIGHT,right-TILE,top,'corner');add(ruralFrames.CORNER_LEFT,left,bottom,'corner');add(ruralFrames.CORNER_RIGHT,right-TILE,bottom,'corner');add(ruralFrames.GATE_OPEN,gateX,top,'gate');add(ruralFrames.FIELD_SIGN,left+TILE,top+TILE,'sign');add(ruralFrames.WEED_A,left-TILE,top+2*TILE,'vegetation');add(ruralFrames.STONE_A,right+6,top+5*TILE,'stone');add(ruralFrames.WEED_B,right+4,bottom-2*TILE,'vegetation');
    return Object.freeze(out);
  }
  const sources=Object.freeze({ruralFarmBoundary:Object.freeze({id:'ruralFarmBoundary',layerGroup:'ruralBoundary',build:buildRuralFarmBoundary,instances:function(){if(typeof STATE==='undefined'||!STATE||!STATE.farm)return Object.freeze([]);return buildRuralFarmBoundary(STATE.farm);}})});
  window.KELO_PROP_CONTRACT=Object.freeze({version:'1.4.0',mode:'generic-prop-contract-v4',assets,layerGroups,props:Object.freeze(defs),sources,getByDistrict(district){return defs.filter(p=>p.district===district);}});
})();