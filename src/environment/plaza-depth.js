(function () {
  const FOUNTAIN = Object.freeze({
    id:'plaza-fountain-central-v1',
    x:1340, y:1450, w:200, h:140, baseY:1555,
    back:Object.freeze({src:'assets/fountain-back-v1.png?art=195',width:200,height:140}),
    front:Object.freeze({src:'assets/fountain-front-v1.png?art=195',width:200,height:140}),
    collision:Object.freeze({x:1390,y:1492,w:100,h:60})
  });

  if (typeof renderAvatar !== 'function' || typeof render !== 'function' || typeof ctx === 'undefined') {
    console.error('[Kelo fountain] render hooks unavailable');
    return;
  }

  const audit = window.KELO_PLAZA_FOUNTAIN_AUDIT = {
    version:'plaza-fountain-v1',
    ready:false,
    backLoaded:false,
    frontLoaded:false,
    failed:false,
    depthMode:'actor-y-split-v1',
    x:FOUNTAIN.x,
    y:FOUNTAIN.y,
    width:FOUNTAIN.w,
    height:FOUNTAIN.h,
    baseY:FOUNTAIN.baseY,
    collision:{...FOUNTAIN.collision},
    lastActorCount:0,
    lastLocalDepth:null,
    lastFrontDrawn:false
  };

  if (window.KELO_PLAZA_AUDIT) {
    window.KELO_PLAZA_AUDIT.fountainVersion=audit.version;
    window.KELO_PLAZA_AUDIT.fountainDepthMode=audit.depthMode;
    window.KELO_PLAZA_AUDIT.fountainReady=false;
  }

  const backImage=new Image();
  const frontImage=new Image();
  backImage.decoding='async';
  frontImage.decoding='async';

  function syncReady(){
    audit.ready=audit.backLoaded&&audit.frontLoaded&&!audit.failed;
    if(window.KELO_PLAZA_AUDIT) window.KELO_PLAZA_AUDIT.fountainReady=audit.ready;
  }
  function fail(kind){
    audit.failed=true; syncReady();
    console.error(`[Kelo fountain] ${kind} asset load failed`);
  }
  function validate(img,meta,kind){
    if(img.naturalWidth!==meta.width||img.naturalHeight!==meta.height){
      audit.failed=true; syncReady();
      console.error(`[Kelo fountain] invalid ${kind} dimensions`,img.naturalWidth,img.naturalHeight,'expected',meta.width,meta.height);
      return false;
    }
    return true;
  }

  backImage.onload=function(){ if(validate(backImage,FOUNTAIN.back,'back')){audit.backLoaded=true;syncReady();} };
  frontImage.onload=function(){ if(validate(frontImage,FOUNTAIN.front,'front')){audit.frontLoaded=true;syncReady();} };
  backImage.onerror=function(){fail('back');};
  frontImage.onerror=function(){fail('front');};
  backImage.src=FOUNTAIN.back.src;
  frontImage.src=FOUNTAIN.front.src;

  if(Array.isArray(obstacles)&&!obstacles.some(o=>o&&o.id===FOUNTAIN.id)){
    obstacles.push({id:FOUNTAIN.id,...FOUNTAIN.collision,noDraw:true,visualOnly:false});
  }

  function drawBack(g){
    if(!audit.ready)return false;
    g.save();g.imageSmoothingEnabled=false;
    g.drawImage(backImage,FOUNTAIN.x,FOUNTAIN.y,FOUNTAIN.w,FOUNTAIN.h);
    g.restore();return true;
  }
  function drawFront(g){
    if(!audit.ready)return false;
    g.save();g.imageSmoothingEnabled=false;
    g.drawImage(frontImage,FOUNTAIN.x,FOUNTAIN.y,FOUNTAIN.w,FOUNTAIN.h);
    g.restore();return true;
  }

  const baseAvatar=renderAvatar;
  const baseRender=render;
  let inFrame=false;
  let queued=[];

  function flushActors(){
    if(!queued.length)return;
    if(!audit.ready){
      for(const item of queued)baseAvatar(item.p,item.isSelf);
      queued=[];return;
    }
    drawBack(ctx);
    const actors=queued.slice().sort((a,b)=>(a.p.y||0)-(b.p.y||0));
    let frontDrawn=false;
    for(const item of actors){
      if(!frontDrawn&&(item.p.y||0)>FOUNTAIN.baseY){drawFront(ctx);frontDrawn=true;}
      baseAvatar(item.p,item.isSelf);
    }
    if(!frontDrawn){drawFront(ctx);frontDrawn=true;}
    const local=actors.find(item=>item.isSelf);
    audit.lastActorCount=actors.length;
    audit.lastLocalDepth=local?((local.p.y||0)<=FOUNTAIN.baseY?'behind-front-layer':'in-front-of-front-layer'):null;
    audit.lastFrontDrawn=frontDrawn;
    if(window.KELO_PLAZA_AUDIT){
      window.KELO_PLAZA_AUDIT.fountainReady=audit.ready;
      window.KELO_PLAZA_AUDIT.fountainLastLocalDepth=audit.lastLocalDepth;
      window.KELO_PLAZA_AUDIT.fountainActorCount=audit.lastActorCount;
    }
    queued=[];
  }

  renderAvatar=function(p,isSelf){
    if(!inFrame||!audit.ready)return baseAvatar(p,isSelf);
    queued.push({p,isSelf});
    if(isSelf)flushActors();
  };

  render=function(){
    inFrame=true;queued=[];
    try{return baseRender();}
    finally{
      if(queued.length){
        console.error('[Kelo fountain] actor queue did not flush inside world transform');
        queued=[];
      }
      inFrame=false;
    }
  };

  window.KELO_PLAZA_FOUNTAIN=Object.freeze({
    version:audit.version,
    prefab:FOUNTAIN,
    get ready(){return audit.ready;},
    get failed(){return audit.failed;},
    drawBack,drawFront
  });
})();
