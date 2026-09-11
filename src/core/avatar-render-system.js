/* KELO-INDEX
 * area: CORE / AVATAR
 * owner: KeloAvatar
 * keys: AVATAR RENDER BASE MIDDLEWARE FALLBACK FOUNDATION HERO SPRITESHEET FACING FRAME
 * purpose: owner único de la composición renderAvatar y del sprite principal visual del jugador
 * public-api: KeloAvatar.setBase/use/unregister/snapshot
 * consumes: renderAvatar vigente de engine-c como fallback + assets/hero-spartan-spritesheet.png + _face/_visualMotion
 * state-owned: renderer base actual + middleware ordenado + estado de carga del sprite principal
 * extension-points: setBase para reemplazos históricos; use para fallbacks/overrides condicionales
 * reuse: renderer hero, apariencias y futuras capas de composición de actor
 * legacy: engine-c mantiene el renderer físico como fallback si el sprite principal no carga
 * do-not: NO envolver renderAvatar fuera de este archivo; NO decidir gameplay
 */
(function(root){
  'use strict';
  if(root.KeloAvatar)return;
  const VERSION='kelo-avatar-render-v1.1.0';
  if(typeof renderAvatar!=='function'){
    root.KELO_AVATAR_RENDER_AUDIT=Object.freeze({version:VERSION,installed:false,reason:'renderAvatar-missing'});
    return;
  }

  let baseRenderer=renderAvatar;
  let baseOwner='engine-c:legacy-base';
  let baseRevision=0;
  let sequence=1;
  const middleware=[];

  // KELO-INDEX AVATAR/HERO sprite oficial 4x4: down, right, left, up; 4 frames por dirección.
  const HERO_SPRITE_SOURCE='assets/hero-spartan-spritesheet.png?v=20260911-main-v1';
  const HERO_COLUMNS=4;
  const HERO_ROWS=4;
  const HERO_FACE_ROWS=Object.freeze({down:0,right:1,left:2,up:3});
  const heroSpriteState={
    version:'main-hero-spartan-v1',
    source:HERO_SPRITE_SOURCE,
    ready:false,
    error:null,
    columns:HERO_COLUMNS,
    rows:HERO_ROWS,
    drawCount:0,
    lastFace:'down',
    lastFrame:2,
    middlewareId:null
  };
  const HeroImage=root.Image || (typeof Image==='function'?Image:null);
  const heroImage=HeroImage?new HeroImage():null;
  if(heroImage){
    heroImage.decoding='async';
    heroImage.onload=function(){
      heroSpriteState.ready=heroImage.naturalWidth>0&&heroImage.naturalHeight>0;
      heroSpriteState.error=heroSpriteState.ready?null:'invalid-dimensions';
    };
    heroImage.onerror=function(){
      heroSpriteState.ready=false;
      heroSpriteState.error='load-failed';
      if(root.console&&typeof root.console.warn==='function')root.console.warn('[KeloAvatar] main hero sprite failed to load; legacy renderer remains active.');
    };
    heroImage.src=HERO_SPRITE_SOURCE;
  }else{
    heroSpriteState.error='image-constructor-unavailable';
  }
  root.KELO_MAIN_HERO_SPRITE_AUDIT=heroSpriteState;

  function normalizeOwner(owner){return String(owner||'anonymous');}

  function setBase(owner,fn){
    if(typeof fn!=='function')throw new TypeError('avatar base renderer must be a function');
    baseRenderer=fn;
    baseOwner=normalizeOwner(owner);
    baseRevision+=1;
    return baseRevision;
  }

  function use(owner,fn,priority){
    if(typeof fn!=='function')throw new TypeError('avatar middleware must be a function');
    const entry={id:'avatar-mw-'+sequence++,owner:normalizeOwner(owner),fn:fn,priority:Number(priority)||0};
    middleware.push(entry);
    // Mayor prioridad = capa más externa, reproduciendo el orden histórico de wrappers tardíos.
    middleware.sort(function(a,b){return b.priority-a.priority||a.id.localeCompare(b.id);});
    return entry.id;
  }

  function unregister(id){
    const i=middleware.findIndex(function(entry){return entry.id===id;});
    if(i<0)return false;
    middleware.splice(i,1);
    return true;
  }

  function cardinalFace(actor){
    const direct=String(actor&&actor._face||'').toLowerCase();
    if(Object.prototype.hasOwnProperty.call(HERO_FACE_ROWS,direct))return direct;
    const visual=String(actor&&actor._visualMotion&&actor._visualMotion.face||'').toLowerCase();
    if(Object.prototype.hasOwnProperty.call(HERO_FACE_ROWS,visual))return visual;
    const vx=Number(actor&&actor.vx)||0;
    const vy=Number(actor&&actor.vy)||0;
    if(Math.abs(vx)>Math.abs(vy)&&Math.abs(vx)>0.01)return vx>0?'right':'left';
    if(Math.abs(vy)>0.01)return vy>0?'down':'up';
    return heroSpriteState.lastFace||'down';
  }

  function visualFrame(actor){
    const raw=Number(actor&&actor._visualMotion&&actor._visualMotion.frame);
    if(Number.isFinite(raw))return ((Math.round(raw)%HERO_COLUMNS)+HERO_COLUMNS)%HERO_COLUMNS;
    return 2;
  }

  function drawHeroName(actor,topY){
    if(!actor||!actor.name||typeof ctx==='undefined'||!ctx)return;
    ctx.save();
    ctx.font='10px sans-serif';
    ctx.textAlign='center';
    ctx.lineWidth=3;
    ctx.strokeStyle='rgba(0,0,0,.72)';
    ctx.fillStyle='#00d2ff';
    ctx.strokeText(actor.name,actor.x,topY-7);
    ctx.fillText(actor.name,actor.x,topY-7);
    ctx.restore();
  }

  function drawHeroShield(actor){
    if(!actor||!actor.activeShield||typeof ctx==='undefined'||!ctx)return;
    const radius=Math.max(Number(actor.radius)||20,28)+7;
    ctx.save();
    ctx.strokeStyle='#ffd166';
    ctx.lineWidth=3;
    ctx.beginPath();
    ctx.arc(actor.x,actor.y,radius,0,Math.PI*2);
    ctx.stroke();
    ctx.restore();
  }

  // KELO-INDEX AVATAR/HERO reemplaza solo el cuerpo visual del jugador local; gameplay/collider no cambian.
  function renderMainHeroSprite(actor,isSelf,next){
    if(!isSelf||!actor||!heroSpriteState.ready||!heroImage||typeof ctx==='undefined'||!ctx){
      return next();
    }

    const naturalW=heroImage.naturalWidth;
    const naturalH=heroImage.naturalHeight;
    if(!naturalW||!naturalH)return next();

    const face=cardinalFace(actor);
    const frame=visualFrame(actor);
    const sourceW=naturalW/HERO_COLUMNS;
    const sourceH=naturalH/HERO_ROWS;
    const sourceX=frame*sourceW;
    const sourceY=HERO_FACE_ROWS[face]*sourceH;
    const radius=Math.max(1,Number(actor.radius)||20);
    const drawH=Math.max(92,radius*4.8);
    const drawW=drawH*(sourceW/sourceH);
    const feetY=actor.y+Math.max(14,radius*0.9);
    const drawX=actor.x-drawW/2;
    const drawY=feetY-drawH;

    // Sombra de contacto: conserva el anclaje físico del collider aunque el arte sea más grande.
    ctx.save();
    ctx.globalAlpha=.28;
    ctx.fillStyle='#000';
    ctx.beginPath();
    ctx.ellipse(actor.x,actor.y+14,Math.max(radius*.9,drawW*.22),Math.max(6,radius*.4),0,0,Math.PI*2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    const oldSmoothing=ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled=true;
    if(Math.hypot(Number(actor.vx)||0,Number(actor.vy)||0)>10){
      const squashX=Number(actor.squashX)||1;
      const squashY=Number(actor.squashY)||1;
      ctx.translate(actor.x,feetY);
      ctx.scale(squashX,squashY);
      ctx.translate(-actor.x,-feetY);
    }
    ctx.drawImage(heroImage,sourceX,sourceY,sourceW,sourceH,drawX,drawY,drawW,drawH);
    ctx.imageSmoothingEnabled=oldSmoothing;
    ctx.restore();

    drawHeroShield(actor);
    drawHeroName(actor,drawY);

    heroSpriteState.drawCount+=1;
    heroSpriteState.lastFace=face;
    heroSpriteState.lastFrame=frame;
    return undefined;
  }

  function dispatch(index,actor,isSelf){
    if(index>=middleware.length)return baseRenderer(actor,isSelf);
    const entry=middleware[index];
    let called=false;
    let result;
    function next(nextActor,nextIsSelf){
      if(called)return result;
      called=true;
      result=dispatch(
        index+1,
        nextActor===undefined?actor:nextActor,
        nextIsSelf===undefined?isSelf:!!nextIsSelf
      );
      return result;
    }
    return entry.fn(actor,isSelf,next,Object.freeze({owner:entry.owner,priority:entry.priority,baseOwner:baseOwner}));
  }

  function snapshot(){
    return Object.freeze({
      version:VERSION,
      baseOwner:baseOwner,
      baseRevision:baseRevision,
      mainHero:Object.freeze({
        source:heroSpriteState.source,
        ready:heroSpriteState.ready,
        error:heroSpriteState.error,
        middlewareId:heroSpriteState.middlewareId
      }),
      middleware:Object.freeze(middleware.map(function(entry){
        return Object.freeze({id:entry.id,owner:entry.owner,priority:entry.priority});
      }))
    });
  }

  // El sprite principal vive dentro del owner y debajo de character-customization (priority 250),
  // para conservar capas back/front de ropa/equipo sin volver a dibujar el cuerpo legacy.
  heroSpriteState.middlewareId=use('main-hero:spartan-spritesheet',renderMainHeroSprite,100);

  // FOUNDATION-ALLOW: único wrapper autorizado de renderAvatar después de engine-c.
  renderAvatar=function(actor,isSelf){
    return dispatch(0,actor,!!isSelf);
  };

  root.KeloAvatar=Object.freeze({
    version:VERSION,
    setBase:setBase,
    use:use,
    unregister:unregister,
    snapshot:snapshot
  });
  root.KELO_AVATAR_RENDER_AUDIT=Object.freeze({
    version:VERSION,
    installed:true,
    singleLegacyWrapper:true,
    baseReplacement:true,
    middlewareFallback:true,
    middlewareOrder:'priority-desc',
    mainHeroSprite:true,
    mainHeroSpriteSource:HERO_SPRITE_SOURCE,
    mainHeroSpriteGrid:'4x4',
    mainHeroFaceRows:'down,right,left,up',
    gameplayAuthority:false,
    legacyTarget:'renderAvatar'
  });
})(typeof globalThis!=='undefined'?globalThis:window);
