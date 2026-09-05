(function(){
  'use strict';
  const R=window.KELO_TILE_REGISTRY;
  if(!R){console.error('[Kelo prop contract] TileRegistry missing');return;}
  const defs=[];
  const plazaNatureAtlas=R.atlases?.plazaNature;
  const layerGroups=Object.freeze({
    plazaNature:Object.freeze({
      id:'plaza-nature',ownership:'plaza-nature-props-v1',priority:10,
      back:Object.freeze({phase:'props_back'}),front:Object.freeze({phase:'props_front'})
    })
  });
  if(plazaNatureAtlas&&Array.isArray(R.plazaNatureProps)){
    for(const p of R.plazaNatureProps){
      defs.push(Object.freeze({
        id:p.id,family:'nature_prop',asset:'plazaNature',frame:p.sprite||0,layerGroup:'plazaNature',
        position:Object.freeze({x:p.x,y:p.y}),size:Object.freeze({w:p.w,h:p.h}),anchor:Object.freeze({x:0.5,y:1}),
        visualBounds:Object.freeze({x:p.x,y:p.y,w:p.w,h:p.h}),
        footprint:Object.freeze({x:p.x+Math.round(p.w*0.28),y:p.baseY-18,w:Math.round(p.w*0.44),h:18}),
        collider:Object.freeze({mode:'none'}),layers:Object.freeze({back:'props_back',front:'props_front'}),priority:10,district:'central',
        occlusion:Object.freeze({mode:'actor-base-y-clip-v1',baseY:p.baseY,clipPadding:8}),visualOnly:true
      }));
    }
  }
  const assets=Object.freeze({
    plazaNature:Object.freeze({id:'plazaNature',src:plazaNatureAtlas?.src,width:plazaNatureAtlas?.width,height:plazaNatureAtlas?.height,
      frameWidth:plazaNatureAtlas?.spriteWidth,frameHeight:plazaNatureAtlas?.spriteHeight,columns:plazaNatureAtlas?.columns})
  });
  window.KELO_PROP_CONTRACT=Object.freeze({
    version:'1.1.0',mode:'generic-prop-contract-v1',assets,layerGroups,props:Object.freeze(defs),
    getByDistrict(district){return defs.filter(p=>p.district===district);}
  });
})();
