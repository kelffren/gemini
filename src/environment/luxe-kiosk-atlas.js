(function () {
  'use strict';

  const REGISTRY=window.KELO_TILE_REGISTRY;
  const PREFABS=REGISTRY?.architecturePrefabs;
  const ASSETS=REGISTRY?.architectureAssets;
  const STYLE=REGISTRY?.styles?.architecture;
  const LAYERS=window.KELO_ENVIRONMENT_LAYERS;
  if(!PREFABS||!ASSETS||!STYLE||!LAYERS||typeof LAYERS.register!=='function'){
    console.error('[Kelo architecture] registry or environment layers unavailable');
    return;
  }

  const ALLOWED=new Set(['luxeBoutique']);
  const entries=Object.entries(PREFABS).filter(([key])=>ALLOWED.has(key)).map(([key,prefab])=>{
    const asset=ASSETS[prefab.asset];
    if(!asset)throw new Error('[Kelo architecture] asset missing for '+key);
    const image=new Image();
    const state={key,prefab,asset,image,ready:false,failed:false,legacyHidden:!prefab.legacyVisualReplacement};
    image.onload=()=>{state.ready=true;state.failed=false;};
    image.onerror=()=>{state.failed=true;console.error('[Kelo architecture] authored raster failed to load:',asset.src);};
    image.src=asset.src;
    return state;
  });
  let backLayerRegistered=false,frontLayerRegistered=false;

  const geometry=e=>({x:e.prefab.x,y:e.prefab.y,w:e.asset.worldWidth,h:e.asset.worldHeight});
  const overlaps=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
  const sameRect=(a,b)=>a&&b&&a.x===b.x&&a.y===b.y&&a.w===b.w&&a.h===b.h;
  const spatialBounds=()=>entries.map(e=>({id:e.prefab.id,...geometry(e)}));

  const LEGACY_PLAZA_PLACEHOLDERS=Object.freeze([
    Object.freeze({x:1150,y:1400,w:120,h:400}),
    Object.freeze({x:1530,y:1400,w:120,h:400}),
    Object.freeze({x:1300,y:1250,w:200,h:80}),
    Object.freeze({x:1300,y:1870,w:200,h:80})
  ]);

  function drawEntry(g,e){if(!e?.ready)return false;const b=geometry(e);g.save();g.imageSmoothingEnabled=false;g.drawImage(e.image,b.x,b.y,b.w,b.h);g.restore();return true;}
  function drawAll(g){entries.forEach(e=>drawEntry(g,e));}

  function installLegacyVisualReplacements(){
    if(typeof obstacles==='undefined'||!Array.isArray(obstacles))return false;
    for(let i=obstacles.length-1;i>=0;i--){
      const o=obstacles[i];
      if(!o)continue;
      if(LEGACY_PLAZA_PLACEHOLDERS.some(r=>sameRect(o,r)))obstacles.splice(i,1);
    }
    for(const e of entries){
      if(!e.prefab.legacyVisualReplacement||!e.prefab.collision)continue;
      const collision=e.prefab.collision;
      for(let i=obstacles.length-1;i>=0;i--){
        const o=obstacles[i];
        if(!o||o._architectureCollisionFor===e.prefab.id)continue;
        if(overlaps(o,collision)&&o._architectureVisualReplacement)obstacles.splice(i,1);
      }
      if(!obstacles.some(o=>o&&o._architectureCollisionFor===e.prefab.id)){
        obstacles.push({
          x:collision.x,y:collision.y,w:collision.w,h:collision.h,
          noDraw:true,
          _architectureCollisionFor:e.prefab.id,
          _luxeBoutiqueCollision:e.key==='luxeBoutique'
        });
      }
      e.legacyHidden=true;
    }
    return true;
  }

  function actorBehind(e,actor){
    if(!e||!actor)return false;
    const occ=e.prefab.occlusion,collision=e.prefab.collision,b=geometry(e),r=actor.radius||20;
    const collisionBottom=collision.y+(collision.h||0);
    return !!occ&&!!collision&&actor.x+r>b.x+occ.sideInset&&actor.x-r<b.x+b.w-occ.sideInset&&actor.y>b.y+occ.topInset&&actor.y<collisionBottom+occ.bottomPadding;
  }
  function repaint(g,e,actor){
    if(!e?.ready||!actorBehind(e,actor))return false;
    const clip=e.prefab.occlusion.clip,r=actor.radius||20;
    g.save();g.beginPath();g.rect(actor.x-r-clip.xPadding,actor.y-r-clip.topPadding,r*2+clip.xPadding*2,r*2+clip.topPadding+clip.bottomPadding);g.clip();drawEntry(g,e);g.restore();return true;
  }
  function actorList(){
    const actors=[];
    if(typeof localPlayer!=='undefined'&&localPlayer)actors.push(localPlayer);
    if(typeof simulatedPlayers!=='undefined'&&Array.isArray(simulatedPlayers))actors.push(...simulatedPlayers);
    return actors;
  }
  function drawFrontOcclusion(g){
    for(const actor of actorList())for(const e of entries)repaint(g,e,actor);
  }
  function hasLayer(id){return Array.isArray(LAYERS.layers)&&LAYERS.layers.some(l=>l.id===id);}
  function installEnvironmentLayers(){
    if(!backLayerRegistered){
      if(hasLayer('luxe-architecture-back'))backLayerRegistered=true;
      else{LAYERS.register({id:'luxe-architecture-back',phase:'props_back',priority:20,required:true,ready:()=>entries.every(e=>e.ready&&!e.failed),draw:drawAll,ownership:'architecture-prefabs-v1',bounds:spatialBounds});backLayerRegistered=true;}
    }
    if(!frontLayerRegistered){
      if(hasLayer('luxe-architecture-front'))frontLayerRegistered=true;
      else{LAYERS.register({id:'luxe-architecture-front',phase:'props_front',priority:20,required:true,ready:()=>entries.every(e=>e.ready&&!e.failed),draw:drawFrontOcclusion,ownership:'architecture-prefabs-v1',bounds:spatialBounds});frontLayerRegistered=true;}
    }
    return backLayerRegistered&&frontLayerRegistered;
  }
  function getState(key){return entries.find(e=>e.key===key||e.prefab.id===key)||null;}
  function getEntry(key){
    const e=getState(key);if(!e)return null;
    return Object.freeze({key:e.key,prefab:e.prefab,asset:e.asset,geometry:Object.freeze(geometry(e)),get ready(){return e.ready;},get failed(){return e.failed;},get legacyHidden(){return e.legacyHidden;},isOccluding(actor){return actorBehind(e,actor);}});
  }
  function install(){installLegacyVisualReplacements();installEnvironmentLayers();}
  install();setTimeout(install,120);setTimeout(install,600);

  window.KELO_ARCHITECTURE_RENDERER=Object.freeze({version:'architecture-prefab-renderer-v1.6',mode:'luxe-only-v1',prefabCount:entries.length,depthMode:STYLE.depthMode,renderMode:'formal-back-front-layer-stack-v1',spatialOwnership:'architecture-prefabs-v1',get ready(){return entries.every(e=>e.ready&&!e.failed);},get rendererWrapped(){return false;},get depthWrapped(){return false;},get environmentLayerStack(){return backLayerRegistered&&frontLayerRegistered;},get backLayerRegistered(){return backLayerRegistered;},get frontLayerRegistered(){return frontLayerRegistered;},get postActorContractPreserved(){return typeof window.KELO_WORLD_RENDERER?.drawPostActors==='function';},getEntry});

  const luxe=getState('luxeBoutique');
  if(!luxe){console.error('[Kelo architecture] luxe prefab missing');return;}
  const SHOP=Object.freeze({x:luxe.prefab.x,y:luxe.prefab.y,w:luxe.asset.worldWidth,h:luxe.asset.worldHeight,frontX:luxe.prefab.interaction.x,frontY:luxe.prefab.interaction.y,interactRadius:luxe.prefab.interaction.radius});
  const COLLISION=luxe.prefab.collision;

  function installCollision(){return installLegacyVisualReplacements();}
  function nearShop(){return typeof localPlayer!=='undefined'&&localPlayer&&Math.hypot(localPlayer.x-SHOP.frontX,localPlayer.y-SHOP.frontY)<=SHOP.interactRadius;}
  function openBoutique(){
    if(!nearShop()){if(typeof showToast==='function')showToast('Acércate a Kelo Luxe');return false;}
    if(window.KELO_BOUTIQUE&&typeof window.KELO_BOUTIQUE.open==='function'){window.KELO_BOUTIQUE.open();if(typeof showToast==='function')showToast('Kelo Luxe Boutique');return true;}
    if(typeof showToast==='function')showToast('Boutique cargando…');return false;
  }
  function pointerToWorld(e){const c=document.getElementById('game-canvas');if(!c||typeof screenToWorld!=='function')return null;const r=c.getBoundingClientRect();if(!r.width||!r.height)return null;return screenToWorld((e.clientX-r.left)*((c.width||r.width)/r.width),(e.clientY-r.top)*((c.height||r.height)/r.height));}
  function insideShop(p){return !!p&&p.x>=SHOP.x&&p.x<=SHOP.x+SHOP.w&&p.y>=SHOP.y&&p.y<=SHOP.y+SHOP.h;}
  function installInteraction(){
    const c=document.getElementById('game-canvas');if(c&&!c._keloLuxeBoutiqueTap){c._keloLuxeBoutiqueTap=true;c.addEventListener('pointerdown',e=>{const p=pointerToWorld(e);if(!insideShop(p))return;e.preventDefault();e.stopImmediatePropagation();openBoutique();},true);}
    if(!window._keloLuxeBoutiqueKey){window._keloLuxeBoutiqueKey=true;window.addEventListener('keydown',e=>{if((e.key||'').toLowerCase()!=='e')return;const a=document.activeElement;if(a&&/INPUT|TEXTAREA/.test(a.tagName||''))return;if(nearShop())openBoutique();});}
  }
  function installBoutiqueHooks(){installCollision();installInteraction();}
  installBoutiqueHooks();setTimeout(installBoutiqueHooks,120);setTimeout(installBoutiqueHooks,600);

  window.KELO_LUXE_KIOSK=Object.freeze({disabled:false,version:'authored-raster-v1.9',asset:luxe.asset.src,source:'tile-registry-architecture-prefab',prefabId:luxe.prefab.id,shop:SHOP,collision:COLLISION,interaction:luxe.prefab.interaction,depthMode:STYLE.depthMode,depthOcclusion:true,renderMode:'formal-back-front-layer-stack-v1',backLayer:'props_back',frontLayer:'props_front',legacyBrownPlaceholdersRemoved:true,isOccluding:actor=>actorBehind(luxe,actor),get ready(){return luxe.ready;},get failed(){return luxe.failed;},get rendererWrapped(){return false;},get depthWrapped(){return false;},get environmentLayerStack(){return backLayerRegistered&&frontLayerRegistered;},open:openBoutique});
  window.KELO_MARKET_PAVILION=Object.freeze({disabled:true,reason:'removed-by-player'});
})();