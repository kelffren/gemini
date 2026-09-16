/* KELO-INDEX
 * area: CORE / LEGACY ABILITY COMPAT
 * owners: KeloAbilityAim + KeloLegacyAbilityCast
 * keys: ABILITY AIM DASH RANGE POINTER RENDER BEGIN END CAST MIDDLEWARE COMPATIBILITY LEGACY STRANGLER
 * purpose: conserva aim/range/pointer legacy y separa la cadena de cast en un owner explícito sin cambiar rangos, cooldowns ni orden de decorators
 * public-api: KeloAbilityAim.begin/end/cast/maxRange/minRatio/measuredRange/powerFromButtonDistance/snapshot + KeloLegacyAbilityCast.registerMiddleware/dispatch/snapshot
 * consumes: legacy skillAim/aim/STATE/localPlayer/camera/dashTween + KeloRender
 * state-owned: KeloAbilityAim posee lifecycle de puntero/estado aim; KeloLegacyAbilityCast posee registry ordenado de middleware
 * extension-points: KeloLegacyAbilityCast.registerMiddleware(owner,fn); el último registrado envuelve a los anteriores, igual que los wrappers legacy
 * legacy: strangler temporal; registro de middleware ya retirado de KeloAbilityAim y concentrado en KeloLegacyAbilityCast
 * do-not: NO segundo ability engine, NO segundo pointer lifecycle, NO nuevos números de balance, NO monkey-patch de cast fuera del owner
 */
(function(root,factory){
'use strict';
const api=factory();
if(typeof module==='object'&&module.exports)module.exports=api;
if(!root||!root.document)return;

if(typeof skillAim==='undefined'||typeof aim==='undefined')throw new Error('legacy skill aim unavailable before KeloAbilityAim');
if(!root.KeloRender||typeof root.KeloRender.afterFrame!=='function')throw new Error('KeloRender unavailable before KeloAbilityAim');

skillAim.power=1;
skillAim.castRange=160;
skillAim.slotX=0;
skillAim.slotY=0;

function slotCenter(el){
  const r=el.getBoundingClientRect();
  return{x:r.left+r.width/2,y:r.top+r.height/2};
}
function isAimSkillCompat(typeId){return typeId==='dash'||typeId==='fireball'||typeId==='frostnova'||typeId==='meteor';}
function skillRangeCompat(typeId){return api.maxRange(typeId);}
root.isAimSkill=isAimSkillCompat;
root.skillRange=skillRangeCompat;
root.measuredRange=api.measuredRange;

function updateAimFromButton(x,y){
  const dx=x-skillAim.slotX;
  const dy=y-skillAim.slotY;
  const dist=Math.hypot(dx,dy);
  skillAim.currentX=x;
  skillAim.currentY=y;
  if(dist>8){
    skillAim.dirX=dx/dist;
    skillAim.dirY=dy/dist;
    aim.x=skillAim.dirX;
    aim.y=skillAim.dirY;
  }
  const p=api.powerFromButtonDistance(dist);
  skillAim.power=p;
  skillAim.castRange=api.measuredRange(skillAim.typeId,Math.max(api.minimumPointerPower,p));
}

function beginSkillAimCompat(index,e){
  const stone=STATE.equipped[index];
  if(!stone||stone.currentCd>0)return;
  if(!isAimSkillCompat(stone.typeId)){triggerStone(index);return;}
  e.preventDefault();
  e.stopPropagation();
  const el=e.currentTarget||document.getElementById('action-slot-'+index);
  if(!el)return;
  const c=slotCenter(el);
  try{el.setPointerCapture(e.pointerId);}catch(_){}
  skillAim.active=true;
  skillAim.index=index;
  skillAim.typeId=stone.typeId;
  skillAim.pointerId=e.pointerId;
  skillAim.slotX=c.x;
  skillAim.slotY=c.y;
  skillAim.originX=c.x;
  skillAim.originY=c.y;
  skillAim.currentX=e.clientX;
  skillAim.currentY=e.clientY;
  skillAim.dirX=aim.x;
  skillAim.dirY=aim.y;
  skillAim.power=api.initialPower;
  skillAim.castRange=api.measuredRange(stone.typeId,skillAim.power);
  updateAimFromButton(e.clientX,e.clientY);
}
root.beginSkillAim=beginSkillAimCompat;

function updateAimFromPointerCompat(x,y){updateAimFromButton(x,y);}
root.updateAimFromPointer=updateAimFromPointerCompat;

const CAST_OWNER_VERSION='kelo-legacy-ability-cast-v1.0.0';
const castMiddlewares=[];
let castMiddlewareSeq=0;
function registerCastMiddleware(owner,fn){
  owner=String(owner||'').trim();
  if(!owner)throw new Error('cast middleware owner required');
  if(typeof fn!=='function')throw new Error('cast middleware function required: '+owner);
  const previous=castMiddlewares.findIndex(entry=>entry.owner===owner);
  if(previous>=0)castMiddlewares.splice(previous,1);
  const entry=Object.freeze({owner,fn,seq:++castMiddlewareSeq});
  castMiddlewares.push(entry);
  return function unregister(){const at=castMiddlewares.indexOf(entry);if(at>=0)castMiddlewares.splice(at,1);};
}
function castMiddlewareOwners(){return castMiddlewares.map(entry=>entry.owner);}

function performBaseCast(index,typeId,dirX,dirY){
  const stone=STATE.equipped[index];
  if(!stone||stone.currentCd>0)return;
  const range=skillAim.castRange||api.measuredRange(typeId,skillAim.power||1);
  stone.currentCd=stone.baseCd;
  const tx=localPlayer.x+dirX*range;
  const ty=localPlayer.y+dirY*range;
  if(typeId==='dash'){
    dashTween.active=true;
    dashTween.t=0;
    dashTween.dur=0.10+0.10*(range/(api.maxRange('dash')||170));
    dashTween.fromX=localPlayer.x;
    dashTween.fromY=localPlayer.y;
    dashTween.toX=Math.max(localPlayer.radius,Math.min(CONFIG.worldWidth-localPlayer.radius,tx));
    dashTween.toY=Math.max(localPlayer.radius,Math.min(CONFIG.worldHeight-localPlayer.radius,ty));
    localPlayer.vx=dirX*CONFIG.speed*1.2;
    localPlayer.vy=dirY*CONFIG.speed*1.2;
    aim.x=dirX;
    aim.y=dirY;
    spawnDashTrail(dashTween.fromX,dashTween.fromY,dashTween.toX,dashTween.toY,stone.color);
    return;
  }
  if(typeId==='fireball'||typeId==='frostnova'){
    const life=Math.max(0.35,range/480);
    arenaPvP.projectiles.push({
      x:localPlayer.x,y:localPlayer.y,
      vx:dirX*480,vy:dirY*480,
      color:stone.color,radius:typeId==='frostnova'?14:10,
      dmg:stone.dmg,fromPlayer:true,life
    });
    return;
  }
  if(typeId==='meteor'){
    for(let i=0;i<24;i++)spawnParticle(tx+(Math.random()-0.5)*80,ty+(Math.random()-0.5)*80,stone.color,20,0.8);
    if(isPvPActive&&arenaPvP.rival&&Math.hypot(tx-arenaPvP.rival.x,ty-arenaPvP.rival.y)<90)applyPvPDamage(arenaPvP.rival,stone.dmg);
  }
}
function dispatchCast(index,typeId,dirX,dirY){
  const context=Object.freeze({index,typeId,dirX,dirY});
  function invoke(at){
    if(at<0)return performBaseCast(index,typeId,dirX,dirY);
    const entry=castMiddlewares[at];
    let consumed=false;
    const next=function(){if(consumed)throw new Error('cast middleware next() called twice: '+entry.owner);consumed=true;return invoke(at-1);};
    return entry.fn(context,next);
  }
  return invoke(castMiddlewares.length-1);
}
root.KeloLegacyAbilityCast=Object.freeze({
  version:CAST_OWNER_VERSION,
  registerMiddleware:registerCastMiddleware,
  dispatch:dispatchCast,
  snapshot:function(){return Object.freeze({version:CAST_OWNER_VERSION,owner:'KeloLegacyAbilityCast',middlewareCount:castMiddlewares.length,middlewareOwners:castMiddlewareOwners(),sequence:castMiddlewareSeq});}
});
root.KELO_LEGACY_ABILITY_CAST_AUDIT=Object.freeze({version:CAST_OWNER_VERSION,owner:'KeloLegacyAbilityCast',sharedRegistry:true,aimAdapterTemporary:false,aimAdapterRetired:true});
root.castAimedSkill=dispatchCast;

function endSkillAimCompat(e){
  if(!skillAim.active)return;
  if(e&&skillAim.pointerId!=null&&e.pointerId!==skillAim.pointerId)return;
  const index=skillAim.index,typeId=skillAim.typeId,dirX=skillAim.dirX,dirY=skillAim.dirY;
  skillAim.active=false;
  skillAim.pointerId=null;
  dispatchCast(index,typeId,dirX,dirY);
}
root.endSkillAim=endSkillAimCompat;

function drawSkillIndicatorCompat(){
  if(!skillAim.active)return;
  const z=CONFIG.zoom||1;
  const maxR=api.maxRange(skillAim.typeId)||170;
  const range=skillAim.castRange||maxR*0.5;
  const tx=localPlayer.x+skillAim.dirX*range;
  const ty=localPlayer.y+skillAim.dirY*range;

  ctx.save();
  ctx.translate(screenW/2,screenH/2);
  ctx.scale(z,z);
  ctx.translate(-camera.x,-camera.y);

  ctx.strokeStyle='rgba(255,214,102,0.25)';
  ctx.lineWidth=2;
  ctx.beginPath();
  ctx.arc(localPlayer.x,localPlayer.y,maxR,0,Math.PI*2);
  ctx.stroke();

  ctx.strokeStyle='rgba(255,214,102,0.95)';
  ctx.fillStyle='rgba(255,214,102,0.2)';
  ctx.lineWidth=3;
  ctx.save();
  const ang=Math.atan2(skillAim.dirY,skillAim.dirX);
  ctx.translate(localPlayer.x,localPlayer.y);
  ctx.rotate(ang);
  if(skillAim.typeId==='dash'){
    ctx.beginPath();
    if(ctx.roundRect)ctx.roundRect(0,-12,range,24,11);else ctx.rect(0,-12,range,24);
    ctx.fill();ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(range+7,0);
    ctx.lineTo(range-12,-15);
    ctx.lineTo(range-12,15);
    ctx.closePath();
    ctx.fill();
  }else if(skillAim.typeId==='meteor'){
    ctx.restore();
    ctx.beginPath();ctx.moveTo(localPlayer.x,localPlayer.y);ctx.lineTo(tx,ty);ctx.stroke();
    ctx.beginPath();ctx.arc(tx,ty,68,0,Math.PI*2);ctx.fill();ctx.stroke();
    ctx.save();
  }else{
    ctx.restore();
    ctx.beginPath();ctx.moveTo(localPlayer.x,localPlayer.y);ctx.lineTo(tx,ty);ctx.stroke();
    ctx.beginPath();ctx.arc(tx,ty,15,0,Math.PI*2);ctx.fill();
    ctx.save();
  }
  ctx.restore();

  ctx.fillStyle='#ffd166';
  ctx.font='11px sans-serif';
  ctx.textAlign='center';
  ctx.fillText(Math.round(range)+' / '+maxR,tx,ty-20);
  ctx.restore();

  ctx.save();
  ctx.strokeStyle='rgba(255,214,102,0.55)';
  ctx.lineWidth=2;
  ctx.beginPath();ctx.arc(skillAim.slotX,skillAim.slotY,api.stickRadius,0,Math.PI*2);ctx.stroke();
  ctx.beginPath();ctx.arc(skillAim.slotX,skillAim.slotY,16,0,Math.PI*2);ctx.stroke();
  ctx.fillStyle='#ffd166';
  ctx.beginPath();ctx.arc(skillAim.currentX,skillAim.currentY,16,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#1a1408';
  ctx.font='10px sans-serif';
  ctx.textAlign='center';
  ctx.fillText('skill',skillAim.currentX,skillAim.currentY+4);
  ctx.restore();
}
root.drawSkillIndicator=drawSkillIndicatorCompat;

const lifecycleMetrics={moveHandled:0,endHandled:0,cancelHandled:0};
function pointerMatches(e){return !!skillAim.active&&(skillAim.pointerId==null||!e||e.pointerId===skillAim.pointerId);}
function onPointerMove(e){
  if(!pointerMatches(e))return;
  lifecycleMetrics.moveHandled++;
  skillAim.currentX=e.clientX;
  skillAim.currentY=e.clientY;
  updateAimFromPointerCompat(e.clientX,e.clientY);
}
function onPointerUp(e){
  if(!pointerMatches(e))return;
  lifecycleMetrics.endHandled++;
  endSkillAimCompat(e);
}
function onPointerCancel(e){
  if(!pointerMatches(e))return;
  lifecycleMetrics.cancelHandled++;
  endSkillAimCompat(e);
}
const lifecycleKey='__KELO_ABILITY_AIM_POINTER_LIFECYCLE__';
const previousLifecycle=root[lifecycleKey];
if(previousLifecycle&&typeof previousLifecycle.detach==='function')previousLifecycle.detach();
root.addEventListener('pointermove',onPointerMove,{passive:true});
root.addEventListener('pointerup',onPointerUp,{passive:true});
root.addEventListener('pointercancel',onPointerCancel,{passive:true});
const pointerLifecycle=Object.freeze({
  version:'kelo-ability-pointer-lifecycle-v1.1.0',
  detach:function(){
    root.removeEventListener('pointermove',onPointerMove);
    root.removeEventListener('pointerup',onPointerUp);
    root.removeEventListener('pointercancel',onPointerCancel);
  },
  snapshot:function(){return Object.freeze({owner:'KeloAbilityAim',attached:true,moveHandled:lifecycleMetrics.moveHandled,endHandled:lifecycleMetrics.endHandled,cancelHandled:lifecycleMetrics.cancelHandled,replacedPrevious:!!previousLifecycle});}
});
root[lifecycleKey]=pointerLifecycle;

const renderSnapshot=root.KeloRender.snapshot();
const staleHook=Array.isArray(renderSnapshot.afterFrame)?renderSnapshot.afterFrame.find(function(h){return h.owner==='engine-g:skill-indicator';}):null;
if(staleHook)root.KeloRender.unregister(staleHook.id);
const renderHookId=root.KeloRender.afterFrame('KeloAbilityAim:skill-indicator',drawSkillIndicatorCompat,20);

root.KeloAbilityAim=Object.freeze(Object.assign({},api,{
  begin:beginSkillAimCompat,
  end:endSkillAimCompat,
  cast:dispatchCast,
  updatePointer:updateAimFromPointerCompat,
  isAimSkill:isAimSkillCompat,
  snapshot:function(){return Object.freeze({version:api.version,active:!!skillAim.active,typeId:skillAim.typeId||'',power:Number(skillAim.power)||0,castRange:Number(skillAim.castRange)||0,pointerId:skillAim.pointerId??null,renderHookId:renderHookId,legacyRenderHookRetired:!!staleHook,pointerLifecycle:pointerLifecycle.snapshot(),castOwner:'KeloLegacyAbilityCast',castMiddlewareCount:castMiddlewares.length,castMiddlewareOwners:castMiddlewareOwners()});}
}));
})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const VERSION='kelo-ability-aim-v1.4.1-cast-adapter-retired';
const MAX=Object.freeze({dash:170,fireball:300,frostnova:230,meteor:260});
const MIN_RATIO=Object.freeze({dash:0.32,fireball:0.45,frostnova:0.45,meteor:0.4});
const STICK_RADIUS=72;
const INITIAL_POWER=0.45;
const MIN_POINTER_POWER=0.28;
const clamp01=n=>Math.max(0,Math.min(1,Number(n)||0));
function maxRange(typeId){return MAX[typeId]||0;}
function minRatio(typeId){return MIN_RATIO[typeId]||0.4;}
function measuredRange(typeId,power){
  const max=MAX[typeId]||160;
  const minR=MIN_RATIO[typeId]||0.4;
  const t=minR+(1-minR)*clamp01(power);
  return max*t;
}
function powerFromButtonDistance(distance){return clamp01((Number(distance)||0)/STICK_RADIUS);}
return Object.freeze({version:VERSION,max:Object.freeze({...MAX}),min:Object.freeze({...MIN_RATIO}),stickRadius:STICK_RADIUS,initialPower:INITIAL_POWER,minimumPointerPower:MIN_POINTER_POWER,maxRange,minRatio,measuredRange,powerFromButtonDistance});
});