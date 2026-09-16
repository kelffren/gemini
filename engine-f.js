/* KELO-INDEX
 * area: LEGACY ABILITY / INPUT
 * owner: KeloAbilityDirection + KeloLegacyAbilityTrigger bridge
 * keys: AIM DASH INPUT TRIGGERSTONE LEGACY STRANGLER COUNTERS PARITY PURE MATH
 * purpose: conserva exactamente dirección y casts directos legacy, pero separa matemática pura reusable del adapter LIVE para permitir caracterización antes de retirar el bridge
 * public-api: KeloAbilityDirection.direction/dashDirection/snapshot; KeloLegacyAbilityTrigger.snapshot; globals compat aim/dashDirection/spawnDashTrail/triggerStone; CommonJS pure parity API
 * consumes: KeloInput, input, localPlayer, STATE, triggerStone base, collision/PvP helpers
 * state-owned: último aim + contadores del bridge; NO posee física continua ni autoridad de posición
 * extension-points: KeloInput.after para derivar dirección de intención procesada
 * legacy: triggerStone global se conserva temporalmente por compatibilidad y queda medido
 * do-not: NO usar KeloPlayerPosition para dash, NO envolver processInput, NO cambiar balance/rangos
 */
(function(root,factory){
'use strict';
const pure=factory();
if(typeof module==='object'&&module.exports)module.exports=pure;
if(!root||!root.document)return;
if(root.KeloAbilityDirection)return;
if(!root.KeloInput)throw new Error('KeloInput unavailable before engine-f');

const VERSION=pure.version;
const BRIDGE_VERSION='kelo-legacy-ability-trigger-v1.0.0';
const aimState={x:1,y:0};
let inputAimUpdates=0,directDashCasts=0,directProjectileCasts=0,fallbackCasts=0,rejectedCasts=0;

function sourceInput(ctx){return ctx&&ctx.input?ctx.input:input;}
function normalized(x,y){return pure.normalized(x,y,aimState);}
function direction(){return{x:aimState.x,y:aimState.y};}
function updateFromInput(ctx){
  const source=sourceInput(ctx);
  const next=pure.aimFromInput(source.normX,source.normY,aimState);
  if(next.updated){aimState.x=next.x;aimState.y=next.y;inputAimUpdates++;}
}
function dashDirection(){
  return pure.chooseDashDirection({
    inputX:input.normX,inputY:input.normY,
    velocityX:localPlayer.vx,velocityY:localPlayer.vy,
    aimX:aimState.x,aimY:aimState.y
  });
}
function spawnDashTrail(fromX,fromY,toX,toY,color){
  const steps=pure.balance.trailSteps;
  for(let i=0;i<=steps;i++){
    const t=i/steps;
    spawnParticle(fromX+(toX-fromX)*t,fromY+(toY-fromY)*t,color||'#00d2ff',10-t*5,0.28+t*0.15);
  }
}
function snapshotDirection(){
  return Object.freeze({version:VERSION,owner:'KeloAbilityDirection',aim:Object.freeze(direction()),inputAimUpdates,inputThreshold:pure.thresholds.aimInput,dashInputThreshold:pure.thresholds.dashInput,velocityThreshold:pure.thresholds.dashVelocity});
}

root.KeloInput.after('engine-f:legacy-aim',updateFromInput,10);
root.KeloAbilityDirection=Object.freeze({version:VERSION,direction,dashDirection,snapshot:snapshotDirection});
// Compatibilidad temporal para engine-g/KeloAbilityAim. No crear consumidores nuevos de estos globals.
root.aim=aimState;
root.dashDirection=dashDirection;
root.spawnDashTrail=spawnDashTrail;

const fallbackTrigger=typeof root.triggerStone==='function'?root.triggerStone:(typeof triggerStone==='function'?triggerStone:null);
if(typeof fallbackTrigger!=='function')throw new Error('triggerStone unavailable before engine-f');

function triggerStoneBridge(index){
  const stone=STATE.equipped[index];
  if(!stone||stone.currentCd>0){rejectedCasts++;return;}
  if(stone.typeId==='dash'){
    directDashCasts++;
    stone.currentCd=stone.baseCd;
    const dir=dashDirection();
    const dist=pure.balance.directDashDistance;
    const fromX=localPlayer.x,fromY=localPlayer.y;
    // FOUNDATION-ALLOW: legacy instantaneous dash writer. KeloPlayerPosition explicitly excludes dash/physics.
    localPlayer.x+=dir.x*dist;
    localPlayer.y+=dir.y*dist;
    localPlayer.x=Math.max(localPlayer.radius,Math.min(CONFIG.worldWidth-localPlayer.radius,localPlayer.x));
    localPlayer.y=Math.max(localPlayer.radius,Math.min(CONFIG.worldHeight-localPlayer.radius,localPlayer.y));
    for(const b of obstacles){
      const res=resolveCircleAABB(localPlayer.x,localPlayer.y,localPlayer.radius,b);
      if(res.collided){localPlayer.x+=res.pushX;localPlayer.y+=res.pushY;}
    }
    spawnDashTrail(fromX,fromY,localPlayer.x,localPlayer.y,stone.color);
    if(isPvPActive&&arenaPvP.rival&&Math.hypot(localPlayer.x-arenaPvP.rival.x,localPlayer.y-arenaPvP.rival.y)<pure.balance.directDashPvpRadius)applyPvPDamage(arenaPvP.rival,stone.dmg);
    return;
  }
  if(stone.typeId==='fireball'||stone.typeId==='frostnova'){
    directProjectileCasts++;
    stone.currentCd=stone.baseCd;
    let angle;
    if(isPvPActive&&arenaPvP.rival)angle=Math.atan2(arenaPvP.rival.y-localPlayer.y,arenaPvP.rival.x-localPlayer.x);
    else{const dir=dashDirection();angle=Math.atan2(dir.y,dir.x);}
    arenaPvP.projectiles.push({x:localPlayer.x,y:localPlayer.y,vx:Math.cos(angle)*pure.balance.projectileSpeed,vy:Math.sin(angle)*pure.balance.projectileSpeed,color:stone.color,radius:pure.balance.projectileRadius,dmg:stone.dmg,fromPlayer:true,life:pure.balance.projectileLife});
    return;
  }
  fallbackCasts++;
  return fallbackTrigger(index);
}
function snapshotBridge(){
  return Object.freeze({version:BRIDGE_VERSION,owner:'KeloLegacyAbilityTrigger',bridge:'triggerStone',directDashCasts,directProjectileCasts,fallbackCasts,rejectedCasts,totalCalls:directDashCasts+directProjectileCasts+fallbackCasts+rejectedCasts});
}
root.triggerStone=triggerStoneBridge;
root.KeloLegacyAbilityTrigger=Object.freeze({version:BRIDGE_VERSION,snapshot:snapshotBridge});
root.KELO_LEGACY_ABILITY_TRIGGER_AUDIT=Object.freeze({version:BRIDGE_VERSION,installed:true,temporary:true,measured:true,gameplayAuthority:'legacy-parity',retireWhen:'consumers-zero-and-modern-stone-cast-owner-live'});
})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const VERSION='kelo-ability-direction-v1.1.0-characterized';
const THRESHOLDS=Object.freeze({aimInput:0.15,dashInput:0.12,dashVelocity:12});
const BALANCE=Object.freeze({directDashDistance:150,directDashPvpRadius:60,projectileSpeed:450,projectileRadius:10,projectileLife:2,trailSteps:10});
function finiteOr(value,fallback){const n=Number(value);return Number.isFinite(n)?n:fallback;}
function finite(value){return finiteOr(value,0);}
function fallbackPoint(fallback){return{x:finiteOr(fallback&&fallback.x,1),y:finiteOr(fallback&&fallback.y,0)};}
function normalized(x,y,fallback){
  const nx=finite(x),ny=finite(y),len=Math.hypot(nx,ny);
  if(!len)return fallbackPoint(fallback);
  return{x:nx/len,y:ny/len};
}
function aimFromInput(x,y,fallback){
  const nx=finite(x),ny=finite(y);
  if(Math.hypot(nx,ny)<=THRESHOLDS.aimInput){const prior=fallbackPoint(fallback);return Object.freeze({x:prior.x,y:prior.y,updated:false});}
  const next=normalized(nx,ny,fallback);
  return Object.freeze({x:next.x,y:next.y,updated:true});
}
function chooseDashDirection(state){
  const source=state||{},inputX=finite(source.inputX),inputY=finite(source.inputY),velocityX=finite(source.velocityX),velocityY=finite(source.velocityY);
  if(Math.hypot(inputX,inputY)>THRESHOLDS.dashInput)return normalized(inputX,inputY,{x:source.aimX,y:source.aimY});
  const velocityLength=Math.hypot(velocityX,velocityY);
  if(velocityLength>THRESHOLDS.dashVelocity)return{x:velocityX/velocityLength,y:velocityY/velocityLength};
  return fallbackPoint({x:source.aimX,y:source.aimY});
}
return Object.freeze({version:VERSION,thresholds:THRESHOLDS,balance:BALANCE,normalized,aimFromInput,chooseDashDirection});
});
