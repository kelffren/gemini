(function(){
'use strict';

const VERSION='pvp-training-dummy-guard-v1.0.0';
const ARENA=Object.freeze({x:2660,y:360,w:720,h:720,padding:56,spawnX:3190,spawnY:720});
const state={anchorX:ARENA.spawnX,anchorY:ARENA.spawnY,lastCombat:false,lastCorrection:0,adoptedSwapCount:0};

function clamp(n,a,b){return Math.max(a,Math.min(b,n));}
function dummy(){return (typeof simulatedPlayers!=='undefined'&&simulatedPlayers&&simulatedPlayers[0])?simulatedPlayers[0]:null;}
function inCombat(){return window.KELO_COMBAT_ENABLED===true;}
function safeX(x){return clamp(Number(x)||ARENA.spawnX,ARENA.x+ARENA.padding,ARENA.x+ARENA.w-ARENA.padding);}
function safeY(y){return clamp(Number(y)||ARENA.spawnY,ARENA.y+ARENA.padding,ARENA.y+ARENA.h-ARENA.padding);}
function publish(event){const d=dummy();window.KELO_PVP_TRAINING_DUMMY_AUDIT=Object.freeze({version:VERSION,event:event||null,combatEnabled:inCombat(),dummyId:d&&d.id||null,x:d&&d.x||null,y:d&&d.y||null,anchorX:state.anchorX,anchorY:state.anchorY,insideArena:!!(d&&d.x>=ARENA.x+ARENA.padding&&d.x<=ARENA.x+ARENA.w-ARENA.padding&&d.y>=ARENA.y+ARENA.padding&&d.y<=ARENA.y+ARENA.h-ARENA.padding),adoptedSwapCount:state.adoptedSwapCount,lastCorrection:state.lastCorrection});}

function resetAnchor(){const d=dummy();if(!d)return;state.anchorX=safeX(d.x);state.anchorY=safeY(d.y);d.x=state.anchorX;d.y=state.anchorY;d.targetX=state.anchorX;d.targetY=state.anchorY;d.vx=0;d.vy=0;publish('anchor-reset');}

function constrain(){
  const d=dummy();if(!d)return;
  const nowCombat=inCombat();
  if(nowCombat&&!state.lastCombat){state.anchorX=safeX(d.x);state.anchorY=safeY(d.y);if(Math.hypot(state.anchorX-ARENA.spawnX,state.anchorY-ARENA.spawnY)>220){state.anchorX=ARENA.spawnX;state.anchorY=ARENA.spawnY;}publish('combat-enter');}
  state.lastCombat=nowCombat;
  if(!nowCombat)return;

  const cx=safeX(d.x),cy=safeY(d.y);
  const displacement=Math.hypot(cx-state.anchorX,cy-state.anchorY);

  // A large instantaneous displacement is treated as an intentional combat result
  // (for example Swap Sword). Small legacy-AI wander is rejected.
  if(displacement>40){state.anchorX=cx;state.anchorY=cy;state.adoptedSwapCount++;publish('combat-position-adopted');}

  const drift=Math.hypot((Number(d.x)||0)-state.anchorX,(Number(d.y)||0)-state.anchorY);
  if(drift>.01){state.lastCorrection=performance.now();}
  d.x=state.anchorX;d.y=state.anchorY;
  d.targetX=state.anchorX;d.targetY=state.anchorY;
  d.vx=0;d.vy=0;
  if('_dash' in d)d._dash=null;
  publish(drift>.01?'wander-corrected':'stable');
}

const previous=typeof updateSimulation==='function'?updateSimulation:null;
if(previous){
  updateSimulation=function(dt){previous(dt);constrain();};
}

window.KeloPvPTrainingDummy=Object.freeze({version:VERSION,resetAnchor,getState:function(){return Object.freeze({anchorX:state.anchorX,anchorY:state.anchorY,combatEnabled:inCombat(),adoptedSwapCount:state.adoptedSwapCount});}});

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){resetAnchor();},{once:true});else resetAnchor();
})();
