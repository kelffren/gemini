(function(){
  'use strict';
  const C=window.KELO_PROP_CONTRACT;
  const L=window.KELO_ENVIRONMENT_LAYERS;
  if(!C||!L||typeof L.register!=='function'){
    console.error('[Kelo generic props] contract/layer stack missing');
    return;
  }
  const images=new Map();
  const readyAssets=new Set();
  let failed=false;
  const audit=window.KELO_GENERIC_PROP_AUDIT={
    version:'generic-props-v1',contractVersion:C.version,ready:false,failed:false,
    propCount:C.props.length,assetCount:Object.keys(C.assets).length,
    backLayer:'props_back',frontLayer:'props_front',rendererMode:'data-driven-props-v1'
  };
  function frameOrigin(asset,frame){
    const cols=asset.columns||1;
    return{x:(frame%cols)*asset.frameWidth,y:Math.floor(frame/cols)*asset.frameHeight};
  }
  function drawProp(g,p){
    const asset=C.assets[p.asset]; const img=images.get(p.asset);
    if(!asset||!img||!readyAssets.has(p.asset))return;
    const s=frameOrigin(asset,p.frame||0);
    g.drawImage(img,s.x,s.y,asset.frameWidth,asset.frameHeight,p.position.x,p.position.y,p.size.w,p.size.h);
  }
  function actors(){
    const list=[];
    if(typeof simulatedPlayers!=='undefined'&&Array.isArray(simulatedPlayers))list.push(...simulatedPlayers);
    if(typeof localPlayer!=='undefined'&&localPlayer)list.push(localPlayer);
    return list;
  }
  function overlaps(actor,b){
    const r=actor?.radius||20;
    return actor&&actor.x+r>b.x&&actor.x-r<b.x+b.w&&actor.y+r>b.y&&actor.y-r<b.y+b.h;
  }
  function drawBack(g){
    if(failed)return;
    g.save();g.imageSmoothingEnabled=false;
    C.props.forEach(p=>drawProp(g,p));
    g.restore();
  }
  function drawFront(g){
    if(failed)return;
    const as=actors(); if(!as.length)return;
    g.save();g.imageSmoothingEnabled=false;
    for(const p of C.props){
      if(p.occlusion?.mode!=='actor-base-y-clip-v1')continue;
      for(const actor of as){
        if(!overlaps(actor,p.visualBounds)||actor.y>=p.occlusion.baseY)continue;
        const pad=p.occlusion.clipPadding||8;
        const r=Math.max(22,(actor.radius||20)+pad);
        g.save();g.beginPath();g.rect(actor.x-r,actor.y-r*1.8,r*2,r*2.5);g.clip();drawProp(g,p);g.restore();
      }
    }
    g.restore();
  }
  const bounds=()=>C.props.map(p=>({id:p.id,...p.visualBounds}));
  try{
    L.register({id:'generic-props-back',phase:'props_back',priority:10,required:true,ready:()=>audit.ready,draw:drawBack,ownership:'generic-prop-contract-v1',bounds});
    L.register({id:'generic-props-front',phase:'props_front',priority:10,required:true,ready:()=>audit.ready,draw:drawFront,ownership:'generic-prop-contract-v1',bounds});
  }catch(err){failed=true;audit.failed=true;console.error('[Kelo generic props] layer registration failed',err);return;}
  const entries=Object.entries(C.assets).filter(([,a])=>a?.src);
  if(!entries.length){audit.ready=true;return;}
  for(const [id,a] of entries){
    const img=new Image(); img.decoding='async'; images.set(id,img);
    img.onload=()=>{
      if(img.naturalWidth!==a.width||img.naturalHeight!==a.height){failed=true;audit.failed=true;console.error('[Kelo generic props] invalid asset dimensions',id);return;}
      readyAssets.add(id); if(readyAssets.size===entries.length){audit.ready=true;}
    };
    img.onerror=()=>{failed=true;audit.failed=true;console.error('[Kelo generic props] asset load failed',id);};
    img.src=a.src;
  }
})();
