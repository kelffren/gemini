(function(){
  'use strict';
  const C=window.KELO_PROP_CONTRACT;
  const G=window.KELO_GENERIC_PROPS;
  const L=window.KELO_ENVIRONMENT_LAYERS;
  const back=C?.props?.find(p=>p.id==='plaza-fountain-central-back');
  const front=C?.props?.find(p=>p.id==='plaza-fountain-central-front');
  if(!C||!G||!L||!back||!front){console.error('[Kelo fountain audit bridge] generic prop contract unavailable');return;}
  const baseY=front.occlusion?.baseY||1592;
  const audit={
    version:'plaza-fountain-v2.0',failed:false,
    depthMode:'formal-back-front-layer-stack-v1',renderWrapped:false,environmentLayerStack:true,
    postActorBridgeRestored:false,postActorBridgeAvailable:true,bridgePolicy:'generic-prop-contract-v1',
    backLayer:'props_back',frontLayer:'props_front',backLayerId:'plaza-fountain-back',frontLayerId:'plaza-fountain-front',
    spatialOwnership:'plaza-fountain-v1',backBoundsCount:1,frontBoundsCount:1,
    assetMode:'authored-png-layer-pair-v1',alignmentMode:'scaled-centered-lower-rim-v1',
    x:back.position.x,y:back.position.y,width:back.size.w,height:back.size.h,baseY,
    frontX:front.position.x,frontY:front.position.y,frontWidth:front.size.w,frontHeight:front.size.h,frontScale:0.74,visualHeight:236,
    sourceWidth:C.assets?.plazaFountainBack?.width||0,sourceHeight:C.assets?.plazaFountainBack?.height||0,
    backAsset:C.assets?.plazaFountainBack?.src||'',frontAsset:C.assets?.plazaFountainFront?.src||'',
    collision:{...back.collider},
    get ready(){return !!G.ready&&G.isAssetReady('plazaFountainBack')&&G.isAssetReady('plazaFountainFront');},
    get backLoaded(){return G.isAssetReady('plazaFountainBack');},
    get frontLoaded(){return G.isAssetReady('plazaFountainFront');},
    get lastLocalDepth(){return (typeof localPlayer!=='undefined'&&localPlayer)?((localPlayer.y||0)>baseY?'in-front-of-front-layer':'behind-front-layer'):null;},
    get lastDepthCandidates(){return Number(window.KELO_GENERIC_PROP_AUDIT?.actorRedrawCountByGroup?.plazaFountain||0);},
    get lastFrontActorRedraws(){return Number(window.KELO_GENERIC_PROP_AUDIT?.actorRedrawCountByGroup?.plazaFountain||0);},
    get backDrawCount(){return Number(window.KELO_GENERIC_PROP_AUDIT?.backDrawCountByGroup?.plazaFountain||0);},
    get frontDrawCount(){return Number(window.KELO_GENERIC_PROP_AUDIT?.frontDrawCountByGroup?.plazaFountain||0);}
  };
  window.KELO_PLAZA_FOUNTAIN_AUDIT=audit;
  if(window.KELO_PLAZA_AUDIT){
    window.KELO_PLAZA_AUDIT.fountainVersion=audit.version;
    window.KELO_PLAZA_AUDIT.fountainDepthMode=audit.depthMode;
    window.KELO_PLAZA_AUDIT.fountainAssetMode=audit.assetMode;
    Object.defineProperty(window.KELO_PLAZA_AUDIT,'fountainReady',{configurable:true,get:()=>audit.ready});
    Object.defineProperty(window.KELO_PLAZA_AUDIT,'fountainLastLocalDepth',{configurable:true,get:()=>audit.lastLocalDepth});
  }
  window.KELO_PLAZA_FOUNTAIN=Object.freeze({version:audit.version,prefab:Object.freeze({back,front}),get ready(){return audit.ready;},get failed(){return audit.failed;}});
})();