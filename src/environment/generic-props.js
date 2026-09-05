(function(){
  'use strict';
  const C=window.KELO_PROP_CONTRACT;
  const L=window.KELO_ENVIRONMENT_LAYERS;
  if(!C||!L||typeof L.register!=='function'){console.error('[Kelo generic props] contract/layer stack missing');return;}
  const images=new Map(),readyAssets=new Set();let failed=false;
  const groups=Object.entries(C.layerGroups||{});
  const audit=window.KELO_GENERIC_PROP_AUDIT={version:'generic-props-v1.1',contractVersion:C.version,ready:false,failed:false,propCount:C.props.length,assetCount:Object.keys(C.assets).length,layerGroupCount:groups.length,rendererMode:'data-driven-props-v1'};
  function frameOrigin(a,f){const cols=a.columns||1;return{x:(f%cols)*a.frameWidth,y:Math.floor(f/cols)*a.frameHeight};}
  function drawProp(g,p){const a=C.assets[p.asset],img=images.get(p.asset);if(!a||!img||!readyAssets.has(p.asset))return;const s=frameOrigin(a,p.frame||0);g.drawImage(img,s.x,s.y,a.frameWidth,a.frameHeight,p.position.x,p.position.y,p.size.w,p.size.h);}
  function actors(){const out=[];if(typeof simulatedPlayers!=='undefined'&&Array.isArray(simulatedPlayers))out.push(...simulatedPlayers);if(typeof localPlayer!=='undefined'&&localPlayer)out.push(localPlayer);return out;}
  function overlaps(actor,b){const r=actor?.radius||20;return actor&&actor.x+r>b.x&&actor.x-r<b.x+b.w&&actor.y+r>b.y&&actor.y-r<b.y+b.h;}
  function propsFor(groupKey){return C.props.filter(p=>p.layerGroup===groupKey);}
  function drawBack(groupKey,g){if(failed)return;g.save();g.imageSmoothingEnabled=false;for(const p of propsFor(groupKey))drawProp(g,p);g.restore();}
  function drawFront(groupKey,g){if(failed)return;const as=actors();if(!as.length)return;g.save();g.imageSmoothingEnabled=false;for(const p of propsFor(groupKey)){if(p.occlusion?.mode!=='actor-base-y-clip-v1')continue;for(const actor of as){if(!overlaps(actor,p.visualBounds)||actor.y>=p.occlusion.baseY)continue;const pad=p.occlusion.clipPadding||8,r=Math.max(22,(actor.radius||20)+pad);g.save();g.beginPath();g.rect(actor.x-r,actor.y-r*1.8,r*2,r*2.5);g.clip();drawProp(g,p);g.restore();}}g.restore();}
  function boundsFor(groupKey){return()=>propsFor(groupKey).map(p=>({id:p.id,...p.visualBounds}));}
  try{
    for(const [key,group] of groups){
      if(group.back)L.register({id:`${group.id}-back`,phase:group.back.phase,priority:group.priority,required:true,ready:()=>audit.ready,draw:g=>drawBack(key,g),ownership:group.ownership,bounds:boundsFor(key)});
      if(group.front)L.register({id:`${group.id}-front`,phase:group.front.phase,priority:group.priority,required:true,ready:()=>audit.ready,draw:g=>drawFront(key,g),ownership:group.ownership,bounds:boundsFor(key)});
    }
  }catch(err){failed=true;audit.failed=true;console.error('[Kelo generic props] layer registration failed',err);return;}
  const entries=Object.entries(C.assets).filter(([,a])=>a?.src);
  if(!entries.length){audit.ready=true;return;}
  for(const [id,a] of entries){const img=new Image();img.decoding='async';images.set(id,img);img.onload=()=>{if(img.naturalWidth!==a.width||img.naturalHeight!==a.height){failed=true;audit.failed=true;console.error('[Kelo generic props] invalid asset dimensions',id);return;}readyAssets.add(id);if(readyAssets.size===entries.length)audit.ready=true;};img.onerror=()=>{failed=true;audit.failed=true;console.error('[Kelo generic props] asset load failed',id);};img.src=a.src;}
})();
