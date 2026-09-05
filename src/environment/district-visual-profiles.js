(function(){
  const profiles=Object.freeze({
    central:Object.freeze({
      id:'central', name:'Plaza Central', kind:'plaza', bounds:Object.freeze({x:1040,y:1240,w:800,h:560}),
      terrainProfile:'central', groundFamilies:Object.freeze(['grass','marble']), transitionFamilies:Object.freeze(['marble_to_grass']),
      pathFamilies:Object.freeze(['marble']), vegetationFamilies:Object.freeze(['plazaNature']), propFamilies:Object.freeze(['plazaNature','plazaFountain']),
      architectureFamilies:Object.freeze(['architecture']), landmarkFamilies:Object.freeze(['plazaFountain','luxeBoutique']),
      palette:'bright-roman-garden', density:'medium', variation:'controlled', decorationRules:Object.freeze({negativeSpace:'medium',focalPoints:true})
    }),
    rural:Object.freeze({
      id:'rural', name:'Distrito Rural', kind:'farm', bounds:Object.freeze({x:448,y:1320,w:720,h:640}),
      terrainProfile:'rural', groundFamilies:Object.freeze(['grass','ruralSoil']), transitionFamilies:Object.freeze(['marble_to_grass']),
      pathFamilies:Object.freeze(['marble','dirt']), vegetationFamilies:Object.freeze(['ruralNature']), propFamilies:Object.freeze(['ruralProps','ruralNature']),
      architectureFamilies:Object.freeze(['ruralLandmarks']), landmarkFamilies:Object.freeze(['ruralLandmarks']),
      palette:'warm-rural', density:'low-medium', variation:'clustered', decorationRules:Object.freeze({centerClear:true,northRoadClear:true})
    }),
    arena:Object.freeze({
      id:'arena', name:'Distrito Arena', kind:'arena', bounds:Object.freeze({x:1728,y:448,w:864,h:640}),
      terrainProfile:'arena', groundFamilies:Object.freeze(['grass','marble']), transitionFamilies:Object.freeze(['marble_to_grass']),
      pathFamilies:Object.freeze(['marble']), vegetationFamilies:Object.freeze([]), propFamilies:Object.freeze(['arenaProps']),
      architectureFamilies:Object.freeze(['arenaArchitecture']), landmarkFamilies:Object.freeze(['arenaLandmarks']),
      palette:'stone-sport', density:'low', variation:'restrained', decorationRules:Object.freeze({combatReadability:true})
    }),
    commerce:Object.freeze({
      id:'commerce', name:'Distrito Comercio', kind:'commerce', bounds:Object.freeze({x:1888,y:1264,w:896,h:704}),
      terrainProfile:'commerce', groundFamilies:Object.freeze(['grass','marble']), transitionFamilies:Object.freeze(['marble_to_grass']),
      pathFamilies:Object.freeze(['marble']), vegetationFamilies:Object.freeze([]), propFamilies:Object.freeze(['commerceProps']),
      architectureFamilies:Object.freeze(['commerceArchitecture']), landmarkFamilies:Object.freeze(['commerceLandmarks']),
      palette:'premium-market', density:'medium-high', variation:'structured', decorationRules:Object.freeze({storefrontReadability:true})
    }),
    gardens:Object.freeze({
      id:'gardens', name:'Jardines del Sur', kind:'garden', bounds:Object.freeze({x:1056,y:2144,w:896,h:704}),
      terrainProfile:'gardens', groundFamilies:Object.freeze(['grass','marble']), transitionFamilies:Object.freeze(['marble_to_grass']),
      pathFamilies:Object.freeze(['marble']), vegetationFamilies:Object.freeze(['gardens']), propFamilies:Object.freeze(['gardens']),
      architectureFamilies:Object.freeze([]), landmarkFamilies:Object.freeze(['gardensFountain']),
      palette:'lush-cyan-garden', density:'high', variation:'clustered', decorationRules:Object.freeze({landmarkClearance:true,negativeSpace:'controlled'})
    })
  });
  const order=Object.freeze(['central','rural','arena','commerce','gardens']);
  const districts=Object.freeze(order.map(id=>{const p=profiles[id],b=p.bounds;return Object.freeze({id:p.id,name:p.name,kind:p.kind,x:b.x,y:b.y,w:b.w,h:b.h});}));
  function get(id){return profiles[id]||null;}
  function terrainProfileFor(id){return get(id)?.terrainProfile||id||'default';}
  window.KELO_DISTRICT_VISUAL_PROFILES=Object.freeze({version:'1.0.0',mode:'data-driven-district-visual-profiles-v1',profiles,order,districts,get,terrainProfileFor});
})();
