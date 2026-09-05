(function(){
  'use strict';
  const C=window.KELO_PROP_CONTRACT;
  const L=window.KELO_ENVIRONMENT_LAYERS;
  const A=window.KELO_ATLAS_CONTRACT;
  if(!C||!L||typeof L.register!=='function'||!A||typeof A.acquire!=='function'||typeof A.register!=='function'){console.error('[Kelo generic props] contract/layer stack/atlas contract missing');return;}
  const images=new Map(),readyAssets=new Set();let failed=false;
  const groups=Object.entries(C.layerGroups||{});
  const stackedGroups=groups.filter(([,group])=>group.renderMode!=='immediate');
  const sources=Object.values(C.sources||{});
  const dynamicSourcePropCounts={};
  const backDrawCountByGroup={};
  const frontDrawCountByGroup={};
  const actorRedrawCountByGroup={};
  const audit=window.KELO_GENERIC_PROP_AUDIT={version:'generic-props-v1.5',contractVersion:C.version,ready:false,failed:false,propCount:C.props.length,assetCount:Object.keys(C.assets).length,layerGroupCount:groups.length,stackedLayerGroupCount:stackedGroups.length,immediateLayerGroupCount:groups.length-stackedGroups.length,sourceCount:sources.length,dynamicSourceCount:sources.filter(s=>typeof s.instances==='function').length,rendererMode:'data-driven-props-v4',resourceMode:'atlas-contract-managed-v1',immediateDrawCalls:0,immediatePropCount:0,dynamicPropCount:0,registeredColliderCount:0,dynamicSourcePropCounts,backDrawCountByGroup,frontDrawCountByGroup,actorRedrawCountByGroup};
  function frameOrigin(a,f){const cols=a.columns||1;return{x:(f%cols)*a.frameWidth,y:Math.floor(f/cols)*a.frameHeight};}
  function drawProp(g,p){const a=C.assets[p.asset],img=images.get(p.asset);if(!a||!img||!readyAssets.has(p.asset))return false;const s=frameOrigin(a,p.frame||0);g.drawImage(img,s.x,s.y,a.frameWidth,a.frameHeight,p.position.x,p.position.y,p.size.w,p.size.h);return true;}
  function drawInstances(g,props,track){if(failed||!g||!Array.isArray(props))return 0;let count=0;g.save();g.imageSmoothingEnabled=false;for(const p of props)if(p&&drawProp(g,p))count++;g.restore();if(track){audit.immediateDrawCalls++;audit.immediatePropCount=count;}return count;}
  function actors(){const out=[];if(typeof simulatedPlayers!=='undefined'&&Array.isArray(simulatedPlayers))out.push(...simulatedPlayers);if(typeof localPlayer!=='undefined'&&localPlayer)out.push(localPlayer);if(typeof isPvPActive!=='undefined'&&isPvPActive&&typeof arenaPvP!=='undefined'&&arenaPvP?.rival)out.push(arenaPvP.rival);return out;}
  function overlaps(actor,b){const r=actor?.radius||20;return actor&&b&&actor.x+r>b.x&&actor.x-r<b.x+b.w&&actor.y+r>b.y&&actor.y-r<b.y+b.h;}
  function refreshDynamicTotal(){audit.dynamicPropCount=Object.values(dynamicSourcePropCounts).reduce((sum,n)=>sum+(Number(n)||0),0);}
  function sourcePropsFor(groupKey){
    const out=[];
    for(const source of sources){
      if(source?.layerGroup!==groupKey||typeof source.instances!=='function')continue;
      const items=source.instances();
      const count=Array.isArray(items)?items.length:0;
      dynamicSourcePropCounts[source.id||groupKey]=count;
      if(count)out.push(...items);
    }
    refreshDynamicTotal();
    return out;
  }
  function propsFor(groupKey){const staticProps=C.props.filter(p=>p.layerGroup===groupKey);return staticProps.concat(sourcePropsFor(groupKey));}
  function drawBack(groupKey,g){if(failed)return;backDrawCountByGroup[groupKey]=drawInstances(g,propsFor(groupKey).filter(p=>p.layerRole!=='front'),false);}
  function drawFront(groupKey,g){
    if(failed)return;
    const props=propsFor(groupKey),as=actors();let count=0,actorRedraws=0;
    g.save();g.imageSmoothingEnabled=false;
    for(const p of props){if(p.layerRole==='front'&&drawProp(g,p))count++;}
    for(const p of props){
      if(p.occlusion?.mode==='actor-base-y-clip-v1'){
        for(const actor of as){if(!overlaps(actor,p.visualBounds)||actor.y>=p.occlusion.baseY)continue;const pad=p.occlusion.clipPadding||8,r=Math.max(22,(actor.radius||20)+pad);g.save();g.beginPath();g.rect(actor.x-r,actor.y-r*1.8,r*2,r*2.5);g.clip();if(drawProp(g,p))count++;g.restore();}
      }else if(p.occlusion?.mode==='actor-base-y-redraw-v1'&&typeof renderAvatar==='function'){
        const bounds=p.occlusion.bounds||p.visualBounds;
        for(const actor of as){if(!overlaps(actor,bounds)||actor.y<=p.occlusion.baseY)continue;renderAvatar(actor,typeof localPlayer!=='undefined'&&actor===localPlayer);actorRedraws++;}
      }
    }
    g.restore();frontDrawCountByGroup[groupKey]=count;actorRedrawCountByGroup[groupKey]=actorRedraws;
  }
  function boundsFor(groupKey){return()=>propsFor(groupKey).map(p=>({id:p.id,...p.visualBounds}));}
  function registerStaticColliders(){
    if(typeof obstacles==='undefined'||!Array.isArray(obstacles))return;
    for(const p of C.props){const c=p?.collider;if(c?.mode!=='rect')continue;if(obstacles.some(o=>o&&o.id===p.id))continue;obstacles.push({id:p.id,x:c.x,y:c.y,w:c.w,h:c.h,noDraw:c.noDraw!==false,_genericPropCollision:true});audit.registeredColliderCount++;}
  }
  try{for(const [key,group] of stackedGroups){if(group.back)L.register({id:`${group.id}-back`,phase:group.back.phase,priority:group.priority,required:true,ready:()=>audit.ready,draw:g=>drawBack(key,g),ownership:group.ownership,bounds:boundsFor(key)});if(group.front)L.register({id:`${group.id}-front`,phase:group.front.phase,priority:group.priority,required:true,ready:()=>audit.ready,draw:g=>drawFront(key,g),ownership:group.ownership,bounds:boundsFor(key)});}}catch(err){failed=true;audit.failed=true;console.error('[Kelo generic props] layer registration failed',err);return;}
  registerStaticColliders();
  window.KELO_GENERIC_PROPS=Object.freeze({version:'generic-props-v1.5',resourceMode:'atlas-contract-managed-v1',drawInstances,isAssetReady(id){return readyAssets.has(id);},get ready(){return audit.ready&&!audit.failed;}});
  const entries=Object.entries(C.assets).filter(([,a])=>a?.src);
  if(!entries.length){audit.ready=true;return;}
  for(const [id,a] of entries){
    if(!A.describe(id))A.register(id,a,{role:'optional'});
    A.acquire(id).then(img=>{images.set(id,img);readyAssets.add(id);if(readyAssets.size===entries.length)audit.ready=true;}).catch(err=>{failed=true;audit.failed=true;console.error('[Kelo generic props] managed asset load failed',id,err);});
  }
})();