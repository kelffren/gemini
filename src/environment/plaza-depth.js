(function () {
  'use strict';

  const L=window.KELO_ENVIRONMENT_LAYERS;
  const FOUNTAIN=Object.freeze({
    id:'plaza-fountain-central-v1',
    x:1340,y:1420,w:200,h:200,baseY:1592,
    frontX:1366,frontY:1508,frontW:148,frontH:148,frontScale:0.74,visualHeight:236,
    back:Object.freeze({src:'assets/plaza-fountain-back.PNG?art=201',sourceWidth:1254,sourceHeight:1254}),
    front:Object.freeze({src:'assets/plaza-fountain-front.PNG?art=201',sourceWidth:1254,sourceHeight:1254}),
    collision:Object.freeze({x:1390,y:1492,w:100,h:60})
  });

  if(!L||typeof L.register!=='function'||typeof L.drawPostActors!=='function'||typeof renderAvatar!=='function'){
    console.error('[Kelo fountain] environment layer/render hooks unavailable');
    return;
  }

  let postActorBridgeRestored=false;
  const currentWorld=window.KELO_WORLD_RENDERER;
  if(currentWorld&&typeof currentWorld.draw==='function'&&typeof currentWorld.drawPostActors!=='function'){
    window.KELO_WORLD_RENDERER=Object.freeze({
      __keloPlazaGround:currentWorld.__keloPlazaGround===true,
      draw:g=>currentWorld.draw(g),
      drawPostActors:g=>L.drawPostActors(g),
      districts:currentWorld.districts,
      chunkSize:currentWorld.chunkSize,
      get ready(){return currentWorld.ready;},
      environmentLayerStack:true,
      postActorLayerStack:true
    });
    postActorBridgeRestored=true;
  }

  const audit=window.KELO_PLAZA_FOUNTAIN_AUDIT={
    version:'plaza-fountain-v1.8',ready:false,backLoaded:false,frontLoaded:false,failed:false,
    depthMode:'formal-back-front-layer-stack-v1',renderWrapped:false,environmentLayerStack:true,
    postActorBridgeRestored,postActorBridgeAvailable:typeof window.KELO_WORLD_RENDERER?.drawPostActors==='function',
    backLayer:'props_back',frontLayer:'props_front',backLayerId:'plaza-fountain-back',frontLayerId:'plaza-fountain-front',
    assetMode:'authored-png-layer-pair-v1',alignmentMode:'scaled-centered-lower-rim-v1',
    x:FOUNTAIN.x,y:FOUNTAIN.y,width:FOUNTAIN.w,height:FOUNTAIN.h,baseY:FOUNTAIN.baseY,
    frontX:FOUNTAIN.frontX,frontY:FOUNTAIN.frontY,frontWidth:FOUNTAIN.frontW,frontHeight:FOUNTAIN.frontH,frontScale:FOUNTAIN.frontScale,visualHeight:FOUNTAIN.visualHeight,
    sourceWidth:FOUNTAIN.back.sourceWidth,sourceHeight:FOUNTAIN.back.sourceHeight,
    backAsset:FOUNTAIN.back.src,frontAsset:FOUNTAIN.front.src,
    collision:{...FOUNTAIN.collision},lastLocalDepth:null,lastDepthCandidates:0,lastFrontActorRedraws:0,backDrawCount:0,frontDrawCount:0
  };

  const backImage=new Image(),frontImage=new Image();
  backImage.decoding='async';frontImage.decoding='async';

  function sync(){
    audit.postActorBridgeAvailable=typeof window.KELO_WORLD_RENDERER?.drawPostActors==='function';
    audit.ready=audit.backLoaded&&audit.frontLoaded&&!audit.failed&&audit.postActorBridgeAvailable;
    if(window.KELO_PLAZA_AUDIT){
      window.KELO_PLAZA_AUDIT.fountainVersion=audit.version;
      window.KELO_PLAZA_AUDIT.fountainDepthMode=audit.depthMode;
      window.KELO_PLAZA_AUDIT.fountainAssetMode=audit.assetMode;
      window.KELO_PLAZA_AUDIT.fountainReady=audit.ready;
      window.KELO_PLAZA_AUDIT.fountainLastLocalDepth=audit.lastLocalDepth;
    }
  }
  function validate(img,meta,kind){
    if(img.naturalWidth!==meta.sourceWidth||img.naturalHeight!==meta.sourceHeight){
      audit.failed=true;sync();
      console.error(`[Kelo fountain] invalid ${kind} dimensions`,img.naturalWidth,img.naturalHeight,'expected',meta.sourceWidth,meta.sourceHeight);
      return false;
    }
    return true;
  }
  function fail(kind){audit.failed=true;sync();console.error(`[Kelo fountain] ${kind} asset load failed`);}
  backImage.onload=()=>{if(validate(backImage,FOUNTAIN.back,'back')){audit.backLoaded=true;sync();}};
  frontImage.onload=()=>{if(validate(frontImage,FOUNTAIN.front,'front')){audit.frontLoaded=true;sync();}};
  backImage.onerror=()=>fail('back');frontImage.onerror=()=>fail('front');
  backImage.src=FOUNTAIN.back.src;frontImage.src=FOUNTAIN.front.src;

  if(Array.isArray(obstacles)&&!obstacles.some(o=>o&&o.id===FOUNTAIN.id)){
    obstacles.push({id:FOUNTAIN.id,...FOUNTAIN.collision,noDraw:true,_plazaFountainCollision:true});
  }

  function drawBack(g){
    if(!audit.backLoaded)return false;
    g.save();g.imageSmoothingEnabled=false;g.drawImage(backImage,FOUNTAIN.x,FOUNTAIN.y,FOUNTAIN.w,FOUNTAIN.h);g.restore();
    audit.backDrawCount++;return true;
  }
  function overlapsFountain(actor){
    if(!actor)return false;const r=actor.radius||20;
    const right=Math.max(FOUNTAIN.x+FOUNTAIN.w,FOUNTAIN.frontX+FOUNTAIN.frontW);
    const bottom=Math.max(FOUNTAIN.y+FOUNTAIN.h,FOUNTAIN.frontY+FOUNTAIN.frontH);
    return actor.x+r>FOUNTAIN.x-12&&actor.x-r<right+12&&actor.y+r>FOUNTAIN.y-12&&actor.y-r<bottom+36;
  }
  function actorInFront(actor){return !!actor&&(actor.y||0)>FOUNTAIN.baseY;}
  function actors(){
    const list=[];
    if(typeof localPlayer!=='undefined'&&localPlayer)list.push(localPlayer);
    if(typeof simulatedPlayers!=='undefined'&&Array.isArray(simulatedPlayers))list.push(...simulatedPlayers);
    if(typeof isPvPActive!=='undefined'&&isPvPActive&&typeof arenaPvP!=='undefined'&&arenaPvP?.rival)list.push(arenaPvP.rival);
    return list;
  }
  function drawFront(g){
    if(!audit.frontLoaded)return false;
    const near=actors().filter(overlapsFountain).sort((a,b)=>(a.y||0)-(b.y||0));
    g.save();g.imageSmoothingEnabled=false;g.drawImage(frontImage,FOUNTAIN.frontX,FOUNTAIN.frontY,FOUNTAIN.frontW,FOUNTAIN.frontH);g.restore();
    audit.frontDrawCount++;
    let frontRedraws=0;
    for(const actor of near){if(actorInFront(actor)){renderAvatar(actor,actor===localPlayer);frontRedraws++;}}
    audit.lastDepthCandidates=near.length;
    audit.lastFrontActorRedraws=frontRedraws;
    audit.lastLocalDepth=(typeof localPlayer!=='undefined'&&localPlayer)?(actorInFront(localPlayer)?'in-front-of-front-layer':'behind-front-layer'):null;
    sync();return true;
  }

  try{
    L.register({id:'plaza-fountain-back',phase:'props_back',priority:10,required:true,ready:()=>audit.backLoaded&&!audit.failed,draw:drawBack});
    L.register({id:'plaza-fountain-front',phase:'props_front',priority:10,required:true,ready:()=>audit.frontLoaded&&!audit.failed,draw:drawFront});
  }catch(err){audit.failed=true;sync();console.error('[Kelo fountain] layer registration failed',err);return;}

  sync();
  window.KELO_PLAZA_FOUNTAIN=Object.freeze({
    version:audit.version,prefab:FOUNTAIN,get ready(){return audit.ready;},get failed(){return audit.failed;},drawBack,drawFront
  });
})();
