(function(){
  const R=window.KELO_TILE_REGISTRY;
  const A=R?.atlases?.plazaNature;
  const P=R?.plazaNatureProps;
  if(!A||!Array.isArray(P)||!R?.styles?.plazaNature){
    console.error('[Kelo plaza nature] registry contract missing');
    return;
  }
  const img=new Image();
  img.decoding='async';
  let ready=false;
  window.KELO_PLAZA_NATURE_AUDIT={version:'plaza-nature-v1',ready:false,assetLoaded:false,failed:false,propCount:P.length,depthMode:R.styles.plazaNature.depthMode,visualOnly:R.styles.plazaNature.visualOnly,registryVersion:R.version};

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
  function drawNature(){
    if(!ready)return;
    const z=window.CONFIG?.zoom||1;
    ctx.save();
    ctx.translate(screenW/2,screenH/2);
    ctx.scale(z,z);
    ctx.translate(-camera.x,-camera.y);
    ctx.imageSmoothingEnabled=false;
    P.forEach(prop=>drawProp(ctx,prop));
    const actors=[];
    if(typeof simulatedPlayers!=='undefined') actors.push(...simulatedPlayers);
    if(typeof localPlayer!=='undefined') actors.push(localPlayer);
    actors.forEach(actor=>{
      const front=P.some(prop=>overlapActor(actor,prop)&&actor.y>=prop.baseY);
      if(front&&typeof renderAvatar==='function') renderAvatar(actor,actor===localPlayer);
    });
    ctx.restore();
  }

  img.onload=()=>{
    if(img.naturalWidth!==A.width||img.naturalHeight!==A.height){
      console.error('[Kelo plaza nature] invalid asset dimensions',img.naturalWidth,img.naturalHeight,'expected',A.width,A.height);
      window.KELO_PLAZA_NATURE_AUDIT.failed=true;
      return;
    }
    ready=true;
    window.KELO_PLAZA_NATURE_AUDIT.ready=true;
    window.KELO_PLAZA_NATURE_AUDIT.assetLoaded=true;
  };
  img.onerror=()=>{
    console.error('[Kelo plaza nature] asset load failed');
    window.KELO_PLAZA_NATURE_AUDIT.failed=true;
  };
  img.src=A.src+'&v=1';

  const _render=render;
  render=function(){
    _render();
    drawNature();
  };
})();