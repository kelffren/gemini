(function(){
  'use strict';
  const R=window.KELO_TILE_REGISTRY;
  const A=R?.atlases?.plazaNature;
  const P=R?.plazaNatureProps;
  const L=window.KELO_ENVIRONMENT_LAYERS;
  if(!A||!Array.isArray(P)||!R?.styles?.plazaNature||!L||typeof L.register!=='function'||typeof L.drawPostActors!=='function'){
    console.error('[Kelo plaza nature] registry/layer contract missing');
    return;
  }
  const img=new Image();
  img.decoding='async';
  let ready=false;
  const NATURE_PRIORITY=10;
  const audit=window.KELO_PLAZA_NATURE_AUDIT={
    version:'plaza-nature-v3.1',ready:false,assetLoaded:false,failed:false,propCount:P.length,
    depthMode:'formal-back-front-layer-stack-v1',visualOnly:R.styles.plazaNature.visualOnly,
    registryVersion:R.version,environmentLayerStack:true,backLayer:'props_back',frontLayer:'props_front',frontClipOcclusion:true,
    fullActorRedraw:false,rendererWrapper:false,backLayerId:'plaza-nature-back',frontLayerId:'plaza-nature-front',
    spatialOwnership:'plaza-nature-props-v1',boundsCount:P.length,layerPriority:NATURE_PRIORITY,
    precedencePolicy:'nature-before-architecture-on-overlap-v1'
  };

  function spriteOrigin(index){return{x:(index%A.columns)*A.spriteWidth,y:Math.floor(index/A.columns)*A.spriteHeight};}
  function overlapActor(p,prop){
    if(!p)return false;
    const r=p.radius||20;
    return p.x+r>prop.x&&p.x-r<prop.x+prop.w&&p.y+r>prop.y&&p.y-r<prop.y+prop.h;
  }
  function drawProp(g,prop){
    const s=spriteOrigin(prop.sprite||0);
    g.drawImage(img,s.x,s.y,A.spriteWidth,A.spriteHeight,prop.x,prop.y,prop.w,prop.h);
  }
  function actors(){
    const list=[];
    if(typeof simulatedPlayers!=='undefined'&&Array.isArray(simulatedPlayers))list.push(...simulatedPlayers);
    if(typeof localPlayer!=='undefined'&&localPlayer)list.push(localPlayer);
    return list;
  }
  function drawBack(g){
    if(!ready)return;
    g.save();g.imageSmoothingEnabled=false;P.forEach(prop=>drawProp(g,prop));g.restore();
  }
  function drawFrontOcclusion(g){
    if(!ready)return;
    const behind=actors().flatMap(actor=>P.filter(prop=>overlapActor(actor,prop)&&actor.y<prop.baseY).map(prop=>({actor,prop})));
    if(!behind.length)return;
    g.save();g.imageSmoothingEnabled=false;
    for(const {actor,prop} of behind){
      const r=Math.max(22,(actor.radius||20)+8);
      g.save();g.beginPath();g.rect(actor.x-r,actor.y-r*1.8,r*2,r*2.5);g.clip();drawProp(g,prop);g.restore();
    }
    g.restore();
  }
  const spatialBounds=()=>P.map(prop=>({id:prop.id,x:prop.x,y:prop.y,w:prop.w,h:prop.h}));

  try{
    L.register({id:'plaza-nature-back',phase:'props_back',priority:NATURE_PRIORITY,required:true,ready:()=>ready,draw:drawBack,ownership:'plaza-nature-props-v1',bounds:spatialBounds});
    L.register({id:'plaza-nature-front',phase:'props_front',priority:NATURE_PRIORITY,required:true,ready:()=>ready,draw:drawFrontOcclusion,ownership:'plaza-nature-props-v1',bounds:spatialBounds});
  }catch(err){console.error('[Kelo plaza nature] layer registration failed',err);audit.failed=true;return;}

  img.onload=()=>{
    if(img.naturalWidth!==A.width||img.naturalHeight!==A.height){
      console.error('[Kelo plaza nature] invalid asset dimensions',img.naturalWidth,img.naturalHeight,'expected',A.width,A.height);
      audit.failed=true;return;
    }
    ready=true;audit.ready=true;audit.assetLoaded=true;
  };
  img.onerror=()=>{console.error('[Kelo plaza nature] asset load failed');audit.failed=true;};
  img.src=A.src+'&v=3';
})();
