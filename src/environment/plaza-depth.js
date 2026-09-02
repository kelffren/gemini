(function () {
  'use strict';

  const FOUNTAIN=Object.freeze({
    id:'plaza-fountain-central-v1',
    x:1340,y:1450,w:200,h:140,baseY:1555,
    back:Object.freeze({src:'assets/fountain-back-v1.png?art=197',width:200,height:140}),
    front:Object.freeze({src:'assets/fountain-front-v1.png?art=197',width:200,height:140}),
    collision:Object.freeze({x:1390,y:1492,w:100,h:60})
  });

  if(typeof ctx==='undefined'||typeof render!=='function'||typeof renderAvatar!=='function'){
    console.error('[Kelo fountain] render hooks unavailable');
    return;
  }

  const audit=window.KELO_PLAZA_FOUNTAIN_AUDIT={
    version:'plaza-fountain-v1.2',ready:false,backLoaded:false,frontLoaded:false,failed:false,
    depthMode:'final-composite-back-actor-front-v2',renderWrapped:false,
    x:FOUNTAIN.x,y:FOUNTAIN.y,width:FOUNTAIN.w,height:FOUNTAIN.h,baseY:FOUNTAIN.baseY,
    collision:{...FOUNTAIN.collision},lastLocalDepth:null,lastFrontActorRedraws:0,lastActorRedraws:0,backDrawCount:0,frontDrawCount:0
  };

  const backImage=new Image(),frontImage=new Image();
  backImage.decoding='async';frontImage.decoding='async';

  function sync(){
    audit.ready=audit.backLoaded&&audit.frontLoaded&&!audit.failed&&audit.renderWrapped;
    if(window.KELO_PLAZA_AUDIT){
      window.KELO_PLAZA_AUDIT.fountainVersion=audit.version;
      window.KELO_PLAZA_AUDIT.fountainDepthMode=audit.depthMode;
      window.KELO_PLAZA_AUDIT.fountainReady=audit.ready;
      window.KELO_PLAZA_AUDIT.fountainLastLocalDepth=audit.lastLocalDepth;
    }
  }
  function validate(img,meta,kind){
    if(img.naturalWidth!==meta.width||img.naturalHeight!==meta.height){
      audit.failed=true;sync();
      console.error(`[Kelo fountain] invalid ${kind} dimensions`,img.naturalWidth,img.naturalHeight,'expected',meta.width,meta.height);
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
    g.drawImage(backImage,FOUNTAIN.x,FOUNTAIN.y,FOUNTAIN.w,FOUNTAIN.h);audit.backDrawCount++;return true;
  }
  function drawFront(g){
    if(!audit.frontLoaded)return false;
    g.drawImage(frontImage,FOUNTAIN.x,FOUNTAIN.y,FOUNTAIN.w,FOUNTAIN.h);audit.frontDrawCount++;return true;
  }
  function overlapsFountain(actor){
    if(!actor)return false;const r=actor.radius||20;
    return actor.x+r>FOUNTAIN.x-12&&actor.x-r<FOUNTAIN.x+FOUNTAIN.w+12&&actor.y+r>FOUNTAIN.y-12&&actor.y-r<FOUNTAIN.y+FOUNTAIN.h+36;
  }
  function actorInFront(actor){return !!actor&&(actor.y||0)>FOUNTAIN.baseY;}

  const base=window.render;
  const layered=function(){
    base();
    if(!audit.backLoaded||!audit.frontLoaded||typeof camera==='undefined'||typeof screenW==='undefined'||typeof screenH==='undefined')return;
    const actors=[];
    if(typeof localPlayer!=='undefined'&&localPlayer)actors.push(localPlayer);
    if(typeof simulatedPlayers!=='undefined'&&Array.isArray(simulatedPlayers))actors.push(...simulatedPlayers);
    if(typeof isPvPActive!=='undefined'&&isPvPActive&&typeof arenaPvP!=='undefined'&&arenaPvP?.rival)actors.push(arenaPvP.rival);
    const near=actors.filter(overlapsFountain).sort((a,b)=>(a.y||0)-(b.y||0));
    const z=(typeof CONFIG!=='undefined'&&CONFIG.zoom)||1;
    ctx.save();ctx.translate(screenW/2,screenH/2);ctx.scale(z,z);ctx.translate(-camera.x,-camera.y);ctx.imageSmoothingEnabled=false;
    drawBack(ctx);
    for(const actor of near)renderAvatar(actor,actor===localPlayer);
    drawFront(ctx);
    let frontRedraws=0;
    for(const actor of near){if(actorInFront(actor)){renderAvatar(actor,actor===localPlayer);frontRedraws++;}}
    ctx.restore();
    audit.lastActorRedraws=near.length;
    audit.lastFrontActorRedraws=frontRedraws;
    audit.lastLocalDepth=(typeof localPlayer!=='undefined'&&localPlayer)?(actorInFront(localPlayer)?'in-front-of-front-layer':'behind-front-layer'):null;
    sync();
  };
  layered.__keloPlazaFountainFinal=true;
  window.render=layered;audit.renderWrapped=true;sync();

  window.KELO_PLAZA_FOUNTAIN=Object.freeze({
    version:audit.version,prefab:FOUNTAIN,get ready(){return audit.ready;},get failed(){return audit.failed;},drawBack,drawFront
  });
})();
