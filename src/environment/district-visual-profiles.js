(function(){
  const freezeList=(items)=>Object.freeze(items);
  const freezeRules=(rules)=>Object.freeze(rules);
  function defineDistrict(def){
    return Object.freeze({
      ...def,
      bounds:Object.freeze(def.bounds),
      groundFamilies:freezeList(def.groundFamilies||[]),
      transitionFamilies:freezeList(def.transitionFamilies||[]),
      pathFamilies:freezeList(def.pathFamilies||[]),
      vegetationFamilies:freezeList(def.vegetationFamilies||[]),
      propFamilies:freezeList(def.propFamilies||[]),
      architectureFamilies:freezeList(def.architectureFamilies||[]),
      landmarkFamilies:freezeList(def.landmarkFamilies||[]),
      decorationRules:freezeRules(def.decorationRules||{}),
      placementRules:freezeRules(def.placementRules||{})
    });
  }

  const profiles=Object.freeze({
    central:defineDistrict({
      id:'central', name:'Plaza Central', kind:'plaza', bounds:{x:1040,y:1240,w:800,h:560},
      terrainProfile:'central', groundFamilies:['grass','marble'], transitionFamilies:['marble_to_grass'],
      pathFamilies:['marble'], vegetationFamilies:['plazaNature'], propFamilies:['plazaNature','plazaFountain'],
      architectureFamilies:['architecture'], landmarkFamilies:['plazaFountain','luxeBoutique'],
      palette:'bright-roman-garden', density:'medium', variation:'controlled',
      decorationRules:{negativeSpace:'medium',focalPoints:true}, placementRules:{keepPrimaryPathsClear:true,landmarkPriority:'high'}
    }),
    rural:defineDistrict({
      id:'rural', name:'Distrito Rural', kind:'farm', bounds:{x:448,y:1320,w:720,h:640},
      terrainProfile:'rural', groundFamilies:['grass','ruralSoil'], transitionFamilies:['marble_to_grass'],
      pathFamilies:['marble','dirt'], vegetationFamilies:['ruralNature'], propFamilies:['ruralProps','ruralNature'],
      architectureFamilies:['ruralLandmarks'], landmarkFamilies:['ruralLandmarks'],
      palette:'warm-rural', density:'low-medium', variation:'clustered',
      decorationRules:{centerClear:true,northRoadClear:true}, placementRules:{farmPerimeterAware:true,approachPathClear:true}
    }),
    arena:defineDistrict({
      id:'arena', name:'Distrito Arena', kind:'arena', bounds:{x:1728,y:448,w:864,h:640},
      terrainProfile:'arena', groundFamilies:['grass','marble'], transitionFamilies:['marble_to_grass'],
      pathFamilies:['marble'], vegetationFamilies:[], propFamilies:['arenaProps'],
      architectureFamilies:['arenaArchitecture'], landmarkFamilies:['arenaLandmarks'],
      palette:'stone-sport', density:'low', variation:'restrained',
      decorationRules:{combatReadability:true}, placementRules:{combatCoreClear:true,edgeWeightedProps:true}
    }),
    commerce:defineDistrict({
      id:'commerce', name:'Distrito Comercio', kind:'commerce', bounds:{x:1888,y:1264,w:896,h:704},
      terrainProfile:'commerce', groundFamilies:['grass','marble'], transitionFamilies:['marble_to_grass'],
      pathFamilies:['marble'], vegetationFamilies:[], propFamilies:['commerceProps'],
      architectureFamilies:['commerceArchitecture'], landmarkFamilies:['commerceLandmarks'],
      palette:'premium-market', density:'medium-high', variation:'structured',
      decorationRules:{storefrontReadability:true}, placementRules:{storefrontFrontageClear:true,pedestrianLaneClear:true}
    }),
    gardens:defineDistrict({
      id:'gardens', name:'Jardines del Sur', kind:'garden', bounds:{x:1056,y:2144,w:896,h:704},
      terrainProfile:'gardens', groundFamilies:['grass','marble'], transitionFamilies:['marble_to_grass'],
      pathFamilies:['marble'], vegetationFamilies:['gardens'], propFamilies:['gardens'],
      architectureFamilies:[], landmarkFamilies:['gardensFountain'],
      palette:'lush-cyan-garden', density:'high', variation:'clustered',
      decorationRules:{landmarkClearance:true,negativeSpace:'controlled'}, placementRules:{promenadeClear:true,fountainFootprintClear:true}
    })
  });

  const order=Object.freeze(['central','rural','arena','commerce','gardens']);
  const districts=Object.freeze(order.map(id=>{const p=profiles[id],b=p.bounds;return Object.freeze({id:p.id,name:p.name,kind:p.kind,x:b.x,y:b.y,w:b.w,h:b.h});}));
  function get(id){return profiles[id]||null;}
  function terrainProfileFor(id){return get(id)?.terrainProfile||id||'default';}
  function districtForPoint(x,y){return districts.find(d=>x>=d.x&&y>=d.y&&x<d.x+d.w&&y<d.y+d.h)||null;}

  window.KELO_DISTRICT_VISUAL_PROFILES=Object.freeze({
    version:'1.1.0', mode:'data-driven-district-visual-profiles-v2', profiles, order, districts,
    get, terrainProfileFor, districtForPoint
  });
})();