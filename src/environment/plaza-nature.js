(function(){
  'use strict';
  const R=window.KELO_TILE_REGISTRY;
  const A=R?.atlases?.plazaNature;
  const P=R?.plazaNatureProps;
  const L=window.KELO_ENVIRONMENT_LAYERS;
  if(!A||!Array.isArray(P)||!R?.styles?.plazaNature||!L||typeof L.register!=='function'){
    console.error('[Kelo plaza nature] registry/layer contract missing');
    return;
  }
  const img=new Image();
  img.decoding='async';
  let ready=false;
  const audit=window.KELO_PLAZA_NATURE_AUDIT={
    version:'plaza-nature-v2',ready:false,assetLoaded:false,failed:false,propCount:P.length,
    depthMode:'layer-stack-back-clipped-front-v1',visualOnly:R.styles.plazaNature.visualOnly,
    registryVersion:R.version,environmentLayerStack:true,backLayer:'props_back',frontClipOcclusion:true,
    fullActorRedraw:false,layerId:'plaza-nature-back'
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
  function drawFrontOcclusion(){
    if(!ready)return;
    const behind=actors().flatMap(actor=>P.filter(prop=>overlapActor(actor,prop)&&actor.y<prop.baseY).map(prop=>({actor,prop})));
    if(!behind.length)return;
    const z=window.CONFIG?.zoom||1;
    ctx.save();
    ctx.translate(screenW/2,screenH/2);ctx.scale(z,z);ctx.translate(-camera.x,-camera.y);ctx.imageSmoothingEnabled=false;
    for(const {actor,prop} of behind){
      const r=Math.max(22,(actor.radius||20)+8);
      ctx.save();ctx.beginPath();ctx.rect(actor.x-r,actor.y-r*1.8,r*2,r*2.5);ctx.clip();drawProp(ctx,prop);ctx.restore();
    }
    ctx.restore();
  }

  try{
    L.register({id:'plaza-nature-back',phase:'props_back',priority:20,required:true,ready:()=>ready,draw:drawBack});
  }catch(err){console.error('[Kelo plaza nature] layer registration failed',err);audit.failed=true;return;}

  img.onload=()=>{
    if(img.naturalWidth!==A.width||img.naturalHeight!==A.height){
      console.error('[Kelo plaza nature] invalid asset dimensions',img.naturalWidth,img.naturalHeight,'expected',A.width,A.height);
      audit.failed=true;return;
    }
    ready=true;audit.ready=true;audit.assetLoaded=true;
  };
  img.onerror=()=>{console.error('[Kelo plaza nature] asset load failed');audit.failed=true;};
  img.src=A.src+'&v=2';

  const _render=render;
  render=function(){_render();drawFrontOcclusion();};
})();