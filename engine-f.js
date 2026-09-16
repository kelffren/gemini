/* KELO-INDEX
 * area: LEGACY ABILITY / INPUT
 * owner: KeloAbilityDirection + KeloLegacyAbilityTrigger bridge
 * keys: AIM DASH INPUT TRIGGERSTONE LEGACY STRANGLER COUNTERS
 * purpose: conserva exactamente dirección y casts directos legacy, pero expone owner reutilizable y métricas para retirar el bridge por consumidores
 * public-api: KeloAbilityDirection.direction/dashDirection/snapshot; KeloLegacyAbilityTrigger.snapshot; globals compat aim/dashDirection/spawnDashTrail/triggerStone
 * consumes: KeloInput, input, localPlayer, STATE, triggerStone base, collision/PvP helpers
 * state-owned: último aim + contadores del bridge; NO posee física continua ni autoridad de posición
 * extension-points: KeloInput.after para derivar dirección de intención procesada
 * legacy: triggerStone global se conserva temporalmente por compatibilidad y queda medido
 * do-not: NO usar KeloPlayerPosition para dash, NO envolver processInput, NO cambiar balance/rangos
 */
(function(root){
'use strict';
if(root.KeloAbilityDirection)return;
if(!root.KeloInput)throw new Error('KeloInput unavailable before engine-f');

const VERSION='kelo-ability-direction-v1.0.0-legacy-parity';
const BRIDGE_VERSION='kelo-legacy-ability-trigger-v1.0.0';
const aimState={x:1,y:0};
let inputAimUpdates=0,directDashCasts=0,directProjectileCasts=0,fallbackCasts=0,rejectedCasts=0;

function sourceInput(ctx){return ctx&&ctx.input?ctx.input:input;}
function normalized(x,y){
  const len=Math.hypot(Number(x)||0,Number(y)||0);
  if(!len)return{x:aimState.x,y:aimState.y};
  return{x:(Number(x)||0)/len,y:(Number(y)||0)/len};
}
function direction(){return{x:aimState.x,y:aimState.y};}
function updateFromInput(ctx){
  const source=sourceInput(ctx);
  if(Math.hypot(source.normX,source.normY)>0.15){
    const next=normalized(source.normX,source.normY);
    aimState.x=next.x;aimState.y=next.y;inputAimUpdates++;
  }
}
function dashDirection(){
  const moveLen=Math.hypot(localPlayer.vx,localPlayer.vy);
  if(Math.hypot(input.normX,input.normY)>0.12)return normalized(input.normX,input.normY);
  if(moveLen>12)return{x:localPlayer.vx/moveLen,y:localPlayer.vy/moveLen};
  return direction();
}
function spawnDashTrail(fromX,fromY,toX,toY,color){
  const steps=10;
  for(let i=0;i<=steps;i++){
    const t=i/steps;
    spawnParticle(fromX+(toX-fromX)*t,fromY+(toY-fromY)*t,color||'#00d2ff',10-t*5,0.28+t*0.15);
  }
}
function snapshotDirection(){
  return Object.freeze({version:VERSION,owner:'KeloAbilityDirection',aim:Object.freeze(direction()),inputAimUpdates,inputThreshold:0.15,dashInputThreshold:0.12,velocityThreshold:12});
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
    const dist=150;
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
    if(isPvPActive&&arenaPvP.rival&&Math.hypot(localPlayer.x-arenaPvP.rival.x,localPlayer.y-arenaPvP.rival.y)<60)applyPvPDamage(arenaPvP.rival,stone.dmg);
    return;
  }
  if(stone.typeId==='fireball'||stone.typeId==='frostnova'){
    directProjectileCasts++;
    stone.currentCd=stone.baseCd;
    let angle;
    if(isPvPActive&&arenaPvP.rival)angle=Math.atan2(arenaPvP.rival.y-localPlayer.y,arenaPvP.rival.x-localPlayer.x);
    else{const dir=dashDirection();angle=Math.atan2(dir.y,dir.x);}
    arenaPvP.projectiles.push({x:localPlayer.x,y:localPlayer.y,vx:Math.cos(angle)*450,vy:Math.sin(angle)*450,color:stone.color,radius:10,dmg:stone.dmg,fromPlayer:true,life:2});
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
})(typeof globalThis!=='undefined'?globalThis:window);
