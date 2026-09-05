(function(){
'use strict';
const VERSION='pvp-social-touch-guard-v1.1.0';
const TRAINING_ARENA=Object.freeze({x:2660,y:360,w:720,h:720,padding:56,spawnX:3190,spawnY:720});
const training={anchorX:TRAINING_ARENA.spawnX,anchorY:TRAINING_ARENA.spawnY,lastCombat:false,lastCorrection:0,adoptedCombatMoves:0};

function combatActive(){
  if(window.KELO_COMBAT_ENABLED===true)return true;
  try{
    const s=window.KeloPvPWorld&&window.KeloPvPWorld.state;
    return !!(s&&s.mode&&s.mode!=='social');
  }catch(e){return false;}
}
function combatSimulationActive(){return window.KELO_COMBAT_ENABLED===true;}
function closeSocialUi(){
  try{if(typeof window.closeSocialModal==='function')window.closeSocialModal();}catch(e){}
  try{if(typeof window.closeInspect==='function')window.closeInspect();}catch(e){}
  const ids=['inspect-sheet','kelo-self-actions','kelo-emotes-panel'];
  ids.forEach(function(id){const el=document.getElementById(id);if(el)el.style.display='none';});
  if(window.KELO_MODAL_INPUT_LOCK==='self-actions'||window.KELO_MODAL_INPUT_LOCK==='emotes'||window.KELO_MODAL_INPUT_LOCK==='profile-transition')window.KELO_MODAL_INPUT_LOCK=null;
}
function install(){
  const original=window.checkSocialTouch;
  if(typeof original!=='function'||original.__keloPvpSocialGuard)return false;
  function guarded(){
    if(combatActive()){
      closeSocialUi();
      return true;
    }
    return original.apply(this,arguments);
  }
  guarded.__keloPvpSocialGuard=true;
  guarded.__keloOriginal=original;
  window.checkSocialTouch=guarded;
  return true;
}
function clamp(n,a,b){return Math.max(a,Math.min(b,n));}
function trainingDummy(){return (typeof simulatedPlayers!=='undefined'&&simulatedPlayers&&simulatedPlayers[0])?simulatedPlayers[0]:null;}
function safeX(x){return clamp(Number(x)||TRAINING_ARENA.spawnX,TRAINING_ARENA.x+TRAINING_ARENA.padding,TRAINING_ARENA.x+TRAINING_ARENA.w-TRAINING_ARENA.padding);}
function safeY(y){return clamp(Number(y)||TRAINING_ARENA.spawnY,TRAINING_ARENA.y+TRAINING_ARENA.padding,TRAINING_ARENA.y+TRAINING_ARENA.h-TRAINING_ARENA.padding);}
function publishTraining(event){
  const d=trainingDummy();
  window.KELO_PVP_TRAINING_DUMMY_AUDIT=Object.freeze({
    version:VERSION,event:event||null,combatEnabled:combatSimulationActive(),dummyId:d&&d.id||null,
    x:d&&d.x||null,y:d&&d.y||null,anchorX:training.anchorX,anchorY:training.anchorY,
    insideArena:!!(d&&d.x>=TRAINING_ARENA.x+TRAINING_ARENA.padding&&d.x<=TRAINING_ARENA.x+TRAINING_ARENA.w-TRAINING_ARENA.padding&&d.y>=TRAINING_ARENA.y+TRAINING_ARENA.padding&&d.y<=TRAINING_ARENA.y+TRAINING_ARENA.h-TRAINING_ARENA.padding),
    adoptedCombatMoves:training.adoptedCombatMoves,lastCorrection:training.lastCorrection,
    purpose:'stationary-training-target-with-authoritative-position-change-adoption'
  });
}
function constrainTrainingDummy(){
  const d=trainingDummy();if(!d)return;
  const active=combatSimulationActive();
  if(active&&!training.lastCombat){
    training.anchorX=safeX(d.x);training.anchorY=safeY(d.y);
    if(Math.hypot(training.anchorX-TRAINING_ARENA.spawnX,training.anchorY-TRAINING_ARENA.spawnY)>220){training.anchorX=TRAINING_ARENA.spawnX;training.anchorY=TRAINING_ARENA.spawnY;}
    publishTraining('combat-enter');
  }
  training.lastCombat=active;
  if(!active)return;

  const candidateX=safeX(d.x),candidateY=safeY(d.y);
  const displacement=Math.hypot(candidateX-training.anchorX,candidateY-training.anchorY);
  // Large instantaneous moves are intentional combat results (for example Swap Sword).
  // Tiny per-frame movement is the legacy social bot AI and must not move the training target.
  if(displacement>40){
    training.anchorX=candidateX;training.anchorY=candidateY;training.adoptedCombatMoves++;
    publishTraining('combat-position-adopted');
  }

  const drift=Math.hypot((Number(d.x)||0)-training.anchorX,(Number(d.y)||0)-training.anchorY);
  if(drift>.01)training.lastCorrection=performance.now();
  d.x=training.anchorX;d.y=training.anchorY;
  d.targetX=training.anchorX;d.targetY=training.anchorY;
  d.vx=0;d.vy=0;
  if('_dash' in d)d._dash=null;
  publishTraining(drift>.01?'legacy-wander-blocked':'stable');
}
function installTrainingGuard(){
  const original=window.updateSimulation;
  if(typeof original!=='function'||original.__keloTrainingDummyGuard)return false;
  function guardedUpdate(dt){original(dt);constrainTrainingDummy();}
  guardedUpdate.__keloTrainingDummyGuard=true;
  guardedUpdate.__keloOriginal=original;
  window.updateSimulation=guardedUpdate;
  return true;
}
function boot(){
  install();
  installTrainingGuard();
  // Some late UI/runtime modules may wrap globals after us. Reassert shortly after boot.
  setTimeout(install,0);
  setTimeout(install,250);
  setTimeout(installTrainingGuard,0);
  setTimeout(installTrainingGuard,250);
  publishTraining('boot');
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.KeloPvPSocialTouchGuard=Object.freeze({version:VERSION,install,closeSocialUi,combatActive});
window.KeloPvPTrainingDummyGuard=Object.freeze({version:VERSION,install:installTrainingGuard,getState:function(){return Object.freeze({anchorX:training.anchorX,anchorY:training.anchorY,combatEnabled:combatSimulationActive(),adoptedCombatMoves:training.adoptedCombatMoves});}});
window.KELO_PVP_SOCIAL_TOUCH_AUDIT=Object.freeze({version:VERSION,blocksSocialProfilesInCombat:true,closesLegacyInspect:true,closesSelfActions:true,trainingDummyGuard:true});
})();
