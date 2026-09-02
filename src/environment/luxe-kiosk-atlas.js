(function () {
  'use strict';

  const REGISTRY=window.KELO_TILE_REGISTRY;
  const PREFABS=REGISTRY?.architecturePrefabs;
  const ASSETS=REGISTRY?.architectureAssets;
  const STYLE=REGISTRY?.styles?.architecture;
  if(!PREFABS||!ASSETS||!STYLE||typeof window.KELO_WORLD_RENDERER?.draw!=='function'){
    console.error('[Kelo architecture] registry prefabs unavailable');
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
  let rendererWrapped=false,depthWrapped=false;

  const geometry=e=>({x:e.prefab.x,y:e.prefab.y,w:e.asset.worldWidth,h:e.asset.worldHeight});
  const overlaps=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
  const sameRect=(a,b)=>a&&b&&a.x===b.x&&a.y===b.y&&a.w===b.w&&a.h===b.h;

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
  function installWorldLayer(){
    const base=window.KELO_WORLD_RENDERER;if(!base||typeof base.draw!=='function')return false;
    if(base.__keloArchitecturePrefabs){rendererWrapped=true;return true;}
    window.KELO_WORLD_RENDERER=Object.freeze({__keloArchitecturePrefabs:true,draw(g){const ok=base.draw(g);if(ok===true)drawAll(g);return ok;},districts:base.districts,chunkSize:base.chunkSize,get ready(){return base.ready;}});
    rendererWrapped=true;return true;
  }
  function installDepthLayer(){
    if(depthWrapped||typeof window.render!=='function')return depthWrapped;
    const base=window.render;if(base.__keloArchitectureDepth){depthWrapped=true;return true;}
    const layered=function(){
      base();
      if(typeof ctx==='undefined'||typeof camera==='undefined'||typeof screenW==='undefined'||typeof screenH==='undefined')return;
      const actors=[];if(typeof localPlayer!=='undefined'&&localPlayer)actors.push(localPlayer);if(typeof simulatedPlayers!=='undefined'&&Array.isArray(simulatedPlayers))actors.push(...simulatedPlayers);
      const active=[];for(const actor of actors)for(const e of entries)if(e.ready&&actorBehind(e,actor))active.push([e,actor]);
      const z=(typeof CONFIG!=='undefined'&&CONFIG.zoom)||1;
      ctx.save();ctx.translate(screenW/2,screenH/2);ctx.scale(z,z);ctx.translate(-camera.x,-camera.y);ctx.imageSmoothingEnabled=false;
      drawAll(ctx);
      if(typeof renderAvatar==='function')actors.forEach(actor=>renderAvatar(actor,actor===localPlayer));
      active.forEach(([e,a])=>repaint(ctx,e,a));
      ctx.restore();
    };
    layered.__keloArchitectureDepth=true;window.render=layered;depthWrapped=true;return true;
  }
  function getState(key){return entries.find(e=>e.key===key||e.prefab.id===key)||null;}
  function getEntry(key){
    const e=getState(key);if(!e)return null;
    return Object.freeze({key:e.key,prefab:e.prefab,asset:e.asset,geometry:Object.freeze(geometry(e)),get ready(){return e.ready;},get failed(){return e.failed;},get legacyHidden(){return e.legacyHidden;},isOccluding(actor){return actorBehind(e,actor);}});
  }
  function install(){installLegacyVisualReplacements();installWorldLayer();installDepthLayer();}
  install();setTimeout(install,120);setTimeout(install,600);

  window.KELO_ARCHITECTURE_RENDERER=Object.freeze({version:'architecture-prefab-renderer-v1.4',mode:'luxe-only-v1',prefabCount:entries.length,depthMode:STYLE.depthMode,get ready(){return entries.every(e=>e.ready&&!e.failed);},get rendererWrapped(){return rendererWrapped;},get depthWrapped(){return depthWrapped;},getEntry});

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

  window.KELO_LUXE_KIOSK=Object.freeze({disabled:false,version:'authored-raster-v1.8',asset:luxe.asset.src,source:'tile-registry-architecture-prefab',prefabId:luxe.prefab.id,shop:SHOP,collision:COLLISION,interaction:luxe.prefab.interaction,depthMode:STYLE.depthMode,depthOcclusion:true,legacyBrownPlaceholdersRemoved:true,isOccluding:actor=>actorBehind(luxe,actor),get ready(){return luxe.ready;},get failed(){return luxe.failed;},get rendererWrapped(){return rendererWrapped;},get depthWrapped(){return depthWrapped;},open:openBoutique});
  window.KELO_MARKET_PAVILION=Object.freeze({disabled:true,reason:'removed-by-player'});
})();
