(function(){
  'use strict';
  const C=window.KELO_PREFAB_CONTRACT;
  const L=window.KELO_ENVIRONMENT_LAYERS;
  if(!C||!L||typeof L.register!=='function'){console.error('[Kelo generic prefabs] contract/layer stack missing');return;}

  const images=new Map(),readyAssets=new Set();let failed=false,installed=false;
  const audit=window.KELO_PREFAB_AUDIT={version:'generic-prefabs-v1.1',contractVersion:C.version,ready:false,failed:false,
    rendererMode:'data-driven-prefabs-v1',prefabCount:C.prefabs.length,assetCount:Object.keys(C.assets).length,
    registeredColliderCount:0,backDrawCount:0,frontOcclusionDrawCount:0,layerCount:0,bootstrapMode:'deferred-after-engine-bootstrap-v1'};

  function geometry(p){return{x:p.position.x,y:p.position.y,w:p.size.w,h:p.size.h};}
  function drawPrefab(g,p){const img=images.get(p.asset);if(!img||!readyAssets.has(p.asset))return false;const b=geometry(p);g.drawImage(img,b.x,b.y,b.w,b.h);return true;}
  function actorList(){const out=[];if(typeof localPlayer!=='undefined'&&localPlayer)out.push(localPlayer);if(typeof simulatedPlayers!=='undefined'&&Array.isArray(simulatedPlayers))out.push(...simulatedPlayers);if(typeof isPvPActive!=='undefined'&&isPvPActive&&typeof arenaPvP!=='undefined'&&arenaPvP?.rival)out.push(arenaPvP.rival);return out;}
  function actorBehind(p,actor){
    const o=p.occlusion,c=p.collider,b=p.visualBounds,r=actor?.radius||20;if(!o||!actor)return false;
    const bottom=c?c.y+c.h:b.y+b.h;
    return actor.x+r>b.x+(o.sideInset||0)&&actor.x-r<b.x+b.w-(o.sideInset||0)&&actor.y>b.y+(o.topInset||0)&&actor.y<bottom+(o.bottomPadding||0);
  }
  function drawBack(g){if(failed)return;let count=0;g.save();g.imageSmoothingEnabled=false;for(const p of C.prefabs)if(drawPrefab(g,p))count++;g.restore();audit.backDrawCount=count;}
  function drawFront(g){
    if(failed)return;let count=0;g.save();g.imageSmoothingEnabled=false;
    for(const p of C.prefabs){const clip=p.occlusion?.clip;if(!clip)continue;for(const actor of actorList()){
      if(!actorBehind(p,actor))continue;const r=actor.radius||20;g.save();g.beginPath();g.rect(actor.x-r-(clip.xPadding||0),actor.y-r-(clip.topPadding||0),r*2+(clip.xPadding||0)*2,r*2+(clip.topPadding||0)+(clip.bottomPadding||0));g.clip();if(drawPrefab(g,p))count++;g.restore();
    }}
    g.restore();audit.frontOcclusionDrawCount=count;
  }
  function bounds(){return C.prefabs.map(p=>({id:p.id,...p.visualBounds}));}
  function registerColliders(){
    if(typeof obstacles==='undefined'||!Array.isArray(obstacles))return 0;
    for(const p of C.prefabs){const c=p.collider;if(!c||obstacles.some(o=>o?._genericPrefabCollisionFor===p.id))continue;
      obstacles.push({id:p.id,x:c.x,y:c.y,w:c.w,h:c.h,noDraw:c.noDraw!==false,_genericPrefabCollision:true,_genericPrefabCollisionFor:p.id});
    }
    audit.registeredColliderCount=obstacles.filter(o=>o?._genericPrefabCollision===true).length;
    return audit.registeredColliderCount;
  }
  function installLayers(){
    if(installed)return true;
    for(const [key,group] of Object.entries(C.layerGroups||{})){
      const ps=C.prefabs.filter(p=>p.layerGroup===key);if(!ps.length)continue;
      const priority=Math.max(group.priority||0,...ps.map(p=>p.priority||0));
      if(group.back){L.register({id:`${group.id}-back`,phase:group.back.phase,priority,required:true,ready:()=>audit.ready,draw:drawBack,ownership:group.ownership,bounds});audit.layerCount++;}
      if(group.front){L.register({id:`${group.id}-front`,phase:group.front.phase,priority,required:true,ready:()=>audit.ready,draw:drawFront,ownership:group.ownership,bounds});audit.layerCount++;}
    }
    installed=true;registerColliders();return true;
  }
  function getEntry(key){const p=C.prefabs.find(x=>x.key===key||x.id===key);if(!p)return null;return Object.freeze({key:p.key,prefab:p,asset:C.assets[p.asset],geometry:Object.freeze(geometry(p)),isOccluding(actor){return actorBehind(p,actor);},get ready(){return readyAssets.has(p.asset);},get failed(){return failed;}});}

  window.KELO_PREFAB_RENDERER=Object.freeze({version:'generic-prefabs-v1.1',mode:'data-driven-prefabs-v1',getEntry,ensureColliders:registerColliders,get ready(){return audit.ready&&!audit.failed;},get failed(){return audit.failed;}});
  const entries=Object.entries(C.assets).filter(([,a])=>a?.src);
  if(!entries.length)audit.ready=true;
  for(const [id,a] of entries){const img=new Image();img.decoding='async';images.set(id,img);img.onload=()=>{if(img.naturalWidth!==a.width||img.naturalHeight!==a.height){failed=true;audit.failed=true;console.error('[Kelo generic prefabs] invalid asset dimensions',id);return;}readyAssets.add(id);if(readyAssets.size===entries.length)audit.ready=true;};img.onerror=()=>{failed=true;audit.failed=true;console.error('[Kelo generic prefabs] asset load failed',id);};img.src=a.src;}

  setTimeout(()=>{try{installLayers();registerColliders();setTimeout(registerColliders,600);}catch(err){failed=true;audit.failed=true;console.error('[Kelo generic prefabs] deferred install failed',err);}},0);
})();