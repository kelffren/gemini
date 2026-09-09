/* KELO-INDEX
 * area: PVP / WORLD
 * owner: KeloPvPWorld; input delegates KeloInput; resolution delegates KeloMeleeEngine/KeloAbilities; movement delegates KeloMovement; online delegates KeloNetAuthority
 * keys: PVP ACTION COMBAT AIM 360 BUFFER CHARGES COMBO SPECIAL DODGE ASSIST TELEGRAPH MULTITOUCH GAMEPAD PREDICTION AUTHORITY
 * purpose: orquesta contexto PvP action-combat sin target-lock; no crea engines paralelos
 * public-api: KeloPvPWorld, enterPvPWorld, leavePvPWorld
 * consumes: KeloInput, KeloMovement, KeloCamera, KeloRender, KeloSimulation, KeloMeleeEngine, KeloCombatEngine, KeloHitResolver, KeloAbilities, KeloStatusEffects, KeloNetAuthority
 * state-owned: modo PvP, aim contextual, timeline local/prediction, basic resources/combo, telegraph UI efímera
 * online: input/intents se envían secuenciados; cliente jamás decide HP/kill remoto
 * do-not: NO target-lock, NO otro input/combat/movement/render loop, NO VFX->damage, NO setTimeout para attack phases/resource
 */
(function(){
'use strict';
const VERSION='pvp-world-v3.0.0-pvp-bible';
const TRANSITION_MS=650;
const WORLD=Object.freeze({x:2660,y:360,w:720,h:720,spawnX:2790,spawnY:720,dummyX:3190,dummyY:720});
const TUNING=Object.freeze({
  mobileCombatSplit:.55,inputBufferMs:125,comboGraceMs:20,
  aimIndicator:{min:56,max:96,start:30,idleAlpha:.18,activeAlpha:.7,fadeMs:1300},
  aimAssist:{touch:Object.freeze({maxAngleDeg:12,maxDistance:360,strength:.18,hysteresis:1.55}),controller:Object.freeze({maxAngleDeg:15,maxDistance:390,strength:.23,hysteresis:1.55}),mouse:Object.freeze({maxAngleDeg:5,maxDistance:320,strength:0,hysteresis:1.4})},
  dodge:Object.freeze({distance:112,duration:.16,iFrames:.105,recovery:.15,cooldown:.85,directionSource:'move'})
});
const cameraOwner=window.KeloCamera,inputOwner=window.KeloInput;
if(!cameraOwner)throw new Error('KeloCamera unavailable before pvp-world');
if(!inputOwner||!inputOwner.combat)throw new Error('KeloInput combat contract unavailable before pvp-world');
inputOwner.combat.configure({bufferMs:TUNING.inputBufferMs,aimDeadzone:.18,moveDeadzone:.14});
const state={
  mode:'social',combatEnabled:false,transitioning:false,armedSlot:-1,
  aim:{x:1,y:0,rawX:1,rawY:0,worldX:WORLD.spawnX+90,worldY:WORLD.spawnY,source:'default',magnitude:1},assistTargetId:null,lastAimActivity:0,
  basicRootId:'sword_light_basic',basicResource:null,basicAttack:null,comboStep:0,comboExpiresAt:0,
  specialResource:null,specialHold:null,dodge:null,dodgeCooldown:0,
  saved:null,floats:[],impacts:[],misses:[],hitStopVisual:0,commandSeq:1,resultSeq:1,dummy:null,
  transitionTimer:null,transitionStartedAt:0,transitionKind:null,lastError:null,
  combatPointerId:null,abilityPointerId:null,abilityPointerSlot:-1,lastPointerType:null,lastCastAt:0,
  gamepadButtons:[],debug:false
};
window.KELO_COMBAT_ENABLED=false;
function now(){return performance&&performance.now?performance.now():Date.now();}
function toast(m){if(typeof showToast==='function')showToast(m);}
function clamp(n,a,b){return Math.max(a,Math.min(b,n));}
function dist(a,b){return Math.hypot((Number(a&&a.x)||0)-(Number(b&&b.x)||0),(Number(a&&a.y)||0)-(Number(b&&b.y)||0));}
function norm(x,y,fallback){x=Number(x)||0;y=Number(y)||0;if(Math.hypot(x,y)<1e-7&&fallback){x=Number(fallback.x)||1;y=Number(fallback.y)||0;}const l=Math.hypot(x,y)||1;return{x:x/l,y:y/l};}
function dot(a,b){return a.x*b.x+a.y*b.y;}
function angleDeg(a,b){return Math.acos(clamp(dot(norm(a.x,a.y),norm(b.x,b.y)),-1,1))*180/Math.PI;}
function blendDir(a,b,t){return norm(a.x*(1-t)+b.x*t,a.y*(1-t)+b.y*t,a);}
function ready(){return typeof localPlayer!=='undefined'&&localPlayer&&cameraOwner;}
function combatReady(){return !!(window.KeloMeleeEngine&&window.KeloCombatEngine&&window.KeloHitResolver&&window.KeloCombatSchema&&window.KeloEvents);}
function onlineAuthority(){return !!(window.KeloNetAuthority&&window.KeloNetAuthority.isOnline&&window.KeloNetAuthority.isOnline()&&typeof window.KeloNetAuthority.sendCombatIntent==='function');}
function dummyEntity(){if(state.dummy)return state.dummy;if(typeof simulatedPlayers==='undefined'||!simulatedPlayers||!simulatedPlayers.length)return null;return state.dummy=simulatedPlayers[0];}
function screenWorld(x,y){return cameraOwner.screenToWorld(x,y);}
function command(type,payload){return Object.freeze({id:state.commandSeq++,type,payload:payload||{},issuedAt:now()});}
function faceFromDirection(d){return Math.abs(d.x)>Math.abs(d.y)?(d.x<0?'left':'right'):(d.y<0?'up':'down');}
function emitCombat(name,payload){try{if(window.KeloEvents&&typeof window.KeloEvents.emit==='function')window.KeloEvents.emit(name,payload);}catch(_){} }
function hotbarInstance(slot){return window.KeloAbilities&&window.KeloAbilities.hotbar&&window.KeloAbilities.hotbar.slots[slot]||null;}
function sendIntent(action,extra){try{if(onlineAuthority())window.KeloNetAuthority.sendCombatIntent(Object.assign({action,moveX:typeof input!=='undefined'?Number(input.normX)||0:0,moveY:typeof input!=='undefined'?Number(input.normY)||0:0,aimX:state.aim.x,aimY:state.aim.y,clientTime:Date.now()},extra||{}));}catch(e){console.warn('[KeloPvP] intent',e);}}
function allCombatActors(){const out=[];if(onlineAuthority()&&window.keloNet&&window.keloNet.peers){Object.keys(window.keloNet.peers).forEach(id=>{const p=window.keloNet.peers[id];if(p&&p.zone==='pvp'&&(p.hp==null||p.hp>0))out.push(p);});return out;}const d=dummyEntity();if(d&&d.hp>0)out.push(d);return out;}
function actorById(id){if(!id)return null;const d=dummyEntity();if(d&&String(d.id)===String(id))return d;return window.keloNet&&window.keloNet.peers&&window.keloNet.peers[id]||null;}

function assistConfig(source){const s=String(source||'');if(s==='touch')return TUNING.aimAssist.touch;if(s==='gamepad'||s==='controller')return TUNING.aimAssist.controller;return TUNING.aimAssist.mouse;}
function chooseAssist(raw,source){
  const cfg=assistConfig(source);if(!cfg.strength||!ready())return{direction:raw,target:null,strength:0};
  const current=actorById(state.assistTargetId),extended=cfg.maxAngleDeg*cfg.hysteresis;
  function candidateInfo(actor){if(!actor||actor.hp<=0)return null;const d=dist(localPlayer,actor);if(d>cfg.maxDistance)return null;const dir=norm(actor.x-localPlayer.x,actor.y-localPlayer.y),ang=angleDeg(raw,dir);return{actor,dir,d,ang,score:(ang/cfg.maxAngleDeg)*.72+(d/cfg.maxDistance)*.28};}
  if(current){const keep=candidateInfo(current);if(keep&&keep.ang<=extended&&keep.d<=cfg.maxDistance*1.08)return{direction:blendDir(raw,keep.dir,cfg.strength),target:keep.actor,strength:cfg.strength};}
  const rows=allCombatActors().map(candidateInfo).filter(Boolean).filter(c=>c.ang<=cfg.maxAngleDeg).sort((a,b)=>a.score-b.score);
  if(!rows.length)return{direction:raw,target:null,strength:0};const best=rows[0];return{direction:blendDir(raw,best.dir,cfg.strength),target:best.actor,strength:cfg.strength};
}
function setAimVector(raw,worldPoint,source,magnitude){
  if(!ready())return state.aim;raw=norm(raw.x,raw.y,state.aim);const assisted=chooseAssist(raw,source);state.assistTargetId=assisted.target?String(assisted.target.id||''):null;
  const d=assisted.direction;state.aim={x:d.x,y:d.y,rawX:raw.x,rawY:raw.y,worldX:worldPoint&&Number.isFinite(Number(worldPoint.x))?Number(worldPoint.x):localPlayer.x+d.x*90,worldY:worldPoint&&Number.isFinite(Number(worldPoint.y))?Number(worldPoint.y):localPlayer.y+d.y*90,source:String(source||'world'),magnitude:Number.isFinite(Number(magnitude))?clamp(Number(magnitude),0,1):1};
  state.lastAimActivity=now();localPlayer._face=faceFromDirection(d);inputOwner.combat.setAxes({source:source||'world',rawAim:{x:raw.x,y:raw.y,magnitude:state.aim.magnitude,source},aim:{x:d.x,y:d.y,magnitude:state.aim.magnitude,source}});return state.aim;
}
function updateAimWorld(w,source,magnitude){if(!ready()||!w)return state.aim;return setAimVector(norm(w.x-localPlayer.x,w.y-localPlayer.y,state.aim),w,source||'world',magnitude);}
function updateAimScreen(x,y,source){return updateAimWorld(screenWorld(x,y),source||'pointer',1);}
function syncGamepadAim(){const pad=inputOwner.pollGamepad&&inputOwner.pollGamepad();if(!pad)return;const snap=inputOwner.combat.snapshot();if(pad.aim&&pad.aim.magnitude>0){setAimVector({x:pad.aim.x,y:pad.aim.y},null,'gamepad',pad.aim.magnitude);}const buttons=Array.from(pad.buttons||[]).map(b=>!!(b&&b.pressed));function edge(i,type,payload){if(buttons[i]&&!state.gamepadButtons[i])inputOwner.combat.push(type,payload||{});}
  edge(0,'BASIC_PRESS');edge(1,'DODGE_PRESS');edge(2,'SPECIAL_PRESS');if(!buttons[2]&&state.gamepadButtons[2])inputOwner.combat.push('SPECIAL_RELEASE');state.gamepadButtons=buttons;
}

function rootProfile(){return window.KeloMeleeEngine&&window.KeloMeleeEngine.getProfile?window.KeloMeleeEngine.getProfile(state.basicRootId):null;}
function syncResources(reset){const p=rootProfile();if(!p||!window.KeloMeleeEngine)return;if(reset||!state.basicResource)state.basicResource=window.KeloMeleeEngine.createResource(p);else window.KeloMeleeEngine.syncResource(state.basicResource,p);const special=p.specialAttackProfileId&&window.KeloMeleeEngine.getProfile(p.specialAttackProfileId);if(special){if(reset||!state.specialResource)state.specialResource=window.KeloMeleeEngine.createResource(special);else window.KeloMeleeEngine.syncResource(state.specialResource,special);}}
function canStartAttack(){return state.combatEnabled&&!state.transitioning&&!state.basicAttack&&!state.dodge&&!(window.KeloStatusEffects&&window.KeloStatusEffects.isActionBlocked(localPlayer,'attack'));}
function startAttack(profile,kind,source,charge){
  if(!profile||!canStartAttack())return false;const resource=kind==='special'?state.specialResource:state.basicResource,consume=window.KeloMeleeEngine.consumeResource(resource,profile,1);if(!consume.ok)return false;
  const c=command(kind==='special'?'SPECIAL_ATTACK':'BASIC_ATTACK',{direction:{x:state.aim.x,y:state.aim.y}}),attackId=(kind==='special'?'special_':'basic_')+c.id;
  let runtimeProfile=profile;if(kind==='special'&&charge){const q=charge.charge01||0;runtimeProfile=Object.freeze(Object.assign({},profile,{damage:profile.damage*(1+.55*q),range:profile.range*(1+.14*q),knockback:profile.knockback*(1+.55*q)}));}
  const begun=window.KeloMeleeEngine.beginAttack({attacker:localPlayer,direction:{x:state.aim.x,y:state.aim.y},profileId:profile.id,cooldownRemaining:0,attackId,startedAt:c.issuedAt,source:'pvp-'+kind,visual:{charge01:charge&&charge.charge01||0}});if(!begun.ok){resource.current=Math.min(resource.max,resource.current+1);return false;}
  state.basicAttack={id:attackId,kind:kind||'basic',phase:'windup',phaseTime:0,totalTime:0,direction:{x:state.aim.x,y:state.aim.y},profile:runtimeProfile,profileId:profile.id,resolved:false,source:source||'input',startedAt:c.issuedAt,charge:charge||null};
  localPlayer._face=faceFromDirection(state.basicAttack.direction);emitCombat(window.KeloCombatSchema.events.ATTACK_REQUESTED,Object.assign({},begun.payload,{kind:state.basicAttack.kind}));
  if(kind==='basic'){state.comboStep=window.KeloMeleeEngine.nextComboStep(rootProfile(),state.comboStep);sendIntent('basic_attack',{attackId,phase:'pressed',profileId:profile.id});}
  else sendIntent('special_attack',{attackId,phase:'pressed',profileId:profile.id,charge01:charge&&charge.charge01||0});audit(kind+'-windup');return true;
}
function tryStartBasic(){
  if(!canStartAttack())return false;const root=rootProfile();if(!root)return false;if(state.comboExpiresAt&&now()>state.comboExpiresAt+TUNING.comboGraceMs)state.comboStep=0;
  const profile=window.KeloMeleeEngine.comboProfile(root,state.comboStep);return startAttack(profile,'basic','buffer',null);
}
function resolveActive(){
  const a=state.basicAttack;if(!a||a.resolved)return;a.resolved=true;emitCombat(window.KeloCombatSchema.events.ATTACK_ACTIVE,{attackId:a.id,actor:localPlayer,actorId:String(localPlayer.id||'local'),direction:a.direction,profileId:a.profileId,kind:a.kind,charge:a.charge||null});
  if(onlineAuthority()){
    const hits=allCombatActors().filter(t=>window.KeloHitResolver.resolveMelee(localPlayer,t,a.direction,a.profile).hit);hits.forEach(t=>state.impacts.push({x:t.x,y:t.y-14,life:.12,max:.12,predicted:true}));if(!hits.length)state.misses.push({x:localPlayer.x+a.direction.x*a.profile.range*.82,y:localPlayer.y+a.direction.y*a.profile.range*.82,life:.18,max:.18});return;
  }
  const result=window.KeloCombatEngine.attackSweep({attacker:localPlayer,targets:allCombatActors(),direction:a.direction,profile:a.profile,profileId:a.profileId,kind:a.kind,cooldownRemaining:0,attackId:a.id,startedAt:a.startedAt,source:'pvp-offline',skipStart:true});
  const hits=result&&result.hits||[];hits.forEach(h=>{const t=h.target;state.floats.push({x:t.x,y:t.y-42,text:'-'+Math.round(h.amount),life:.72});state.impacts.push({x:t.x,y:t.y-16,life:.16,max:.16,predicted:false});if(window.KeloStatusEffects&&a.profile.stagger>0)window.KeloStatusEffects.apply(t,{type:'stagger',duration:a.profile.stagger,magnitude:1,refreshPolicy:'refresh',visualProfileId:'cc_stagger_default'},{source:localPlayer,target:t});applyKnockback(t,a.direction,a.profile.knockback);});
  if(hits.length)state.hitStopVisual=.028;else state.misses.push({x:localPlayer.x+a.direction.x*a.profile.range*.82,y:localPlayer.y+a.direction.y*a.profile.range*.82,life:.18,max:.18});audit(hits.length?'attack-hit':'attack-miss');
}
function applyKnockback(target,direction,amount){
  amount=Math.max(0,Number(amount)||0);if(!target||!amount)return;const from={x:target.x,y:target.y},to={x:target.x+direction.x*amount,y:target.y+direction.y*amount};let t=1;
  if(window.KELO_COLLISION&&typeof obstacles!=='undefined'){for(const box of obstacles){if(!box||box.blocksMovement===false)continue;const q=window.KELO_COLLISION.segmentAabbHitT(from.x,from.y,to.x,to.y,box,target.radius||20);if(q!=null)t=Math.min(t,Math.max(0,q-1e-4));}}
  target.x=clamp(from.x+(to.x-from.x)*t,WORLD.x+(target.radius||20),WORLD.x+WORLD.w-(target.radius||20));target.y=clamp(from.y+(to.y-from.y)*t,WORLD.y+(target.radius||20),WORLD.y+WORLD.h-(target.radius||20));
}
function updateAttack(dt){const a=state.basicAttack;if(!a)return;if(state.hitStopVisual>0)return;a.phaseTime+=dt;a.totalTime+=dt;if(a.phase==='windup'&&a.phaseTime>=a.profile.windup){a.phase='active';a.phaseTime=0;resolveActive();return;}if(a.phase==='active'&&a.phaseTime>=a.profile.active){a.phase='recovery';a.phaseTime=0;return;}if(a.phase==='recovery'&&a.phaseTime>=a.profile.recovery){if(a.kind==='basic')state.comboExpiresAt=now()+Math.max(0,Number(rootProfile()&&rootProfile().comboTimeout)||0)*1000;else{state.comboStep=0;state.comboExpiresAt=0;}sendIntent(a.kind==='basic'?'basic_attack':'special_attack',{attackId:a.id,phase:'released'});state.basicAttack=null;audit('attack-ready');}}
function processBasicBuffer(t){if(!canStartAttack())return;const pending=inputOwner.combat.peek('BASIC_PRESS',t);if(!pending)return;if(!state.basicResource||state.basicResource.current<=0)return;inputOwner.combat.consume('BASIC_PRESS',t);tryStartBasic();}

function beginSpecial(t){const root=rootProfile(),p=root&&root.specialAttackProfileId&&window.KeloMeleeEngine.getProfile(root.specialAttackProfileId);if(!p)return;state.specialHold={profile:p,pressedAt:t,charge:window.KeloMeleeEngine.chargeValue(p,0)};audit('special-hold');}
function releaseSpecial(t){const s=state.specialHold;if(!s)return;const held=Math.max(0,(t-s.pressedAt)/1000),charge=window.KeloMeleeEngine.chargeValue(s.profile,held);state.specialHold=null;if(!charge.ready)return;if(state.basicAttack){const root=rootProfile(),allow=state.basicAttack.profile.canCancelInto&&state.basicAttack.profile.canCancelInto.includes('special'),remaining=state.basicAttack.profile.recovery-state.basicAttack.phaseTime;if(!(allow&&state.basicAttack.phase==='recovery'&&remaining<=state.basicAttack.profile.cancelWindow))return;state.basicAttack=null;}startAttack(s.profile,'special','release',charge);}

function startDodge(){
  if(!state.combatEnabled||state.dodge||state.dodgeCooldown>0||!ready())return false;if(window.KeloStatusEffects&&window.KeloStatusEffects.isActionBlocked(localPlayer,'move'))return false;
  if(state.basicAttack){const allow=state.basicAttack.profile.canCancelInto&&state.basicAttack.profile.canCancelInto.includes('dodge');if(!allow)return false;state.basicAttack=null;state.comboStep=0;state.comboExpiresAt=0;}
  const moveSnap=inputOwner.combat.snapshot().move,raw=TUNING.dodge.directionSource==='move'&&moveSnap.magnitude>.05?norm(moveSnap.x,moveSnap.y):{x:state.aim.x,y:state.aim.y},d=norm(raw.x,raw.y,state.aim),cfg=TUNING.dodge;
  state.dodge={direction:d,time:0,duration:cfg.duration,startX:localPlayer.x,startY:localPlayer.y};state.dodgeCooldown=cfg.cooldown;
  if(window.KeloStatusEffects)window.KeloStatusEffects.apply(localPlayer,{type:'invulnerable',duration:cfg.iFrames,magnitude:1,refreshPolicy:'refresh',visualProfileId:'cc_invulnerable_dodge'},{source:localPlayer,target:localPlayer});
  localPlayer._dash={sx:localPlayer.x,sy:localPlayer.y,tx:localPlayer.x+d.x*cfg.distance,ty:localPlayer.y+d.y*cfg.distance,time:cfg.duration,max:cfg.duration};emitCombat(window.KeloCombatSchema.events.DODGE_STARTED,{actor:localPlayer,actorId:String(localPlayer.id||'local'),direction:d,duration:cfg.duration});sendIntent('ability',{abilityKey:'__dodge__',phase:'cast',direction:d});audit('dodge-start');return true;
}
function updateDodge(dt){if(!state.dodge)return;state.dodge.time+=dt;if(state.dodge.time>=state.dodge.duration+TUNING.dodge.recovery){emitCombat(window.KeloCombatSchema.events.DODGE_ENDED,{actor:localPlayer,actorId:String(localPlayer.id||'local')});state.dodge=null;audit('dodge-end');}}

function armAbility(slot){if(!state.combatEnabled||state.transitioning||!window.KeloAbilities)return false;const i=hotbarInstance(slot);if(!i){toast('Slot vacío');return false;}state.armedSlot=slot;state.lastCastAt=now();audit('ability-armed');return true;}
function castArmed(){
  const slot=state.armedSlot;if(slot<0||!window.KeloAbilities)return false;const i=hotbarInstance(slot);if(!i||!i.definition){state.armedSlot=-1;return false;}const d=i.definition,t=d.targeting||{},delivery=d.delivery||{},range=t.range||delivery.maxDistance||delivery.distance||300,pos={x:localPlayer.x+state.aim.x*range,y:localPlayer.y+state.aim.y*range},q={slotIndex:slot,direction:{x:state.aim.x,y:state.aim.y}};
  if(t.type==='position')q.position=pos;else if(t.type==='target'){const targets=allCombatActors().filter(x=>dist(localPlayer,x)<=range).sort((a,b)=>angleDeg(state.aim,norm(a.x-localPlayer.x,a.y-localPlayer.y))-angleDeg(state.aim,norm(b.x-localPlayer.x,b.y-localPlayer.y)));if(!targets.length){toast('Apunta a un enemigo');return false;}q.targetId=targets[0].id;q.target=targets[0];}
  const swap=d.key==='swap_sword'&&window.KeloSwordSwapRuntime;if(swap){state.armedSlot=-1;toast('Espada de Intercambio usa su gesto dedicado');return false;}
  const r=window.KeloAbilities.engine.cast(q);state.armedSlot=-1;if(r&&r.valid){sendIntent('ability',{abilityKey:d.key,slot,phase:'cast',direction:q.direction,position:q.position||null,targetId:q.targetId||null});audit('ability-cast');return true;}toast('No se pudo usar la habilidad');audit('ability-failed');return false;
}
function quickCastSlot(slot){if(!armAbility(slot))return false;return castArmed();}
function cancelAim(){state.armedSlot=-1;state.abilityPointerId=null;state.abilityPointerSlot=-1;inputOwner.combat.push('CANCEL_CAST');audit('aim-cancelled');}

function processIntents(t){
  let q;while((q=inputOwner.combat.consume('DODGE_PRESS',t)))startDodge();
  while((q=inputOwner.combat.consume('SPECIAL_PRESS',t)))beginSpecial(q.at);
  while((q=inputOwner.combat.consume('SPECIAL_RELEASE',t)))releaseSpecial(q.at);
  while((q=inputOwner.combat.consume('ABILITY_PRESS',t))){if(Number.isInteger(Number(q.payload.slot)))armAbility(Number(q.payload.slot));}
  while((q=inputOwner.combat.consume('ABILITY_RELEASE',t))){if(state.armedSlot>=0)castArmed();}
  while((q=inputOwner.combat.consume('CANCEL_CAST',t)))state.armedSlot=-1;
  processBasicBuffer(t);
}

function movementScaleHook(context){
  if(!state.combatEnabled||!context||!context.input)return;let scale=1;if(state.dodge)scale=0;else if(state.basicAttack)scale=window.KeloMeleeEngine?window.KeloMeleeEngine.movementScaleFor(state.basicAttack.profile,state.basicAttack.phase):1;if(window.KeloStatusEffects)scale*=window.KeloStatusEffects.movementMultiplier(localPlayer);context.input.normX=(Number(context.input.normX)||0)*scale;context.input.normY=(Number(context.input.normY)||0)*scale;
}
function facingHook(){if(state.combatEnabled&&ready())localPlayer._face=faceFromDirection(state.basicAttack?state.basicAttack.direction:state.aim);}

function setExitVisible(v){const x=document.getElementById('lx-side-pvp-exit');if(x)x.style.display=v?'flex':'none';const y=document.getElementById('kelo-pvp-exit');if(y)y.style.display=v&&!x?'block':'none';}
function ensureFallbackExit(){if(document.getElementById('lx-side-pvp-exit'))return;let e=document.getElementById('kelo-pvp-exit');if(!e){e=document.createElement('button');e.id='kelo-pvp-exit';e.type='button';e.textContent='Salir PvP';e.style.cssText='display:none;position:absolute;top:max(198px,calc(env(safe-area-inset-top) + 190px));right:max(12px,env(safe-area-inset-right));z-index:140;pointer-events:auto;background:rgba(18,20,27,.95);color:#ffd6d6;border:1px solid rgba(255,90,90,.7);border-radius:12px;padding:9px 12px;font-size:11px;font-weight:850';e.addEventListener('pointerdown',a=>{a.preventDefault();a.stopPropagation();leave();});document.body.appendChild(e);}}
function freezeMovement(){if(ready()){localPlayer.vx=0;localPlayer.vy=0;}if(typeof input!=='undefined'&&input){input.normX=0;input.normY=0;}}
function progress(){return state.transitioning&&state.transitionStartedAt?clamp((now()-state.transitionStartedAt)/TRANSITION_MS,0,1):0;}
function startTransition(k){state.transitioning=true;state.transitionKind=k;state.transitionStartedAt=now();freezeMovement();audit(k+'-casting');}
function finishTransition(){state.transitioning=false;state.transitionKind=null;state.transitionStartedAt=0;}
function resetCombatTransient(){state.armedSlot=-1;state.basicAttack=null;state.comboStep=0;state.comboExpiresAt=0;state.specialHold=null;state.dodge=null;state.dodgeCooldown=0;state.assistTargetId=null;inputOwner.combat.clear();syncResources(true);}
function enter(){
  if(state.mode!=='social'||state.transitioning)return;if(!ready())return toast('PvP todavía cargando');if(!combatReady())return toast('Combate todavía cargando');const d=dummyEntity();state.saved={x:localPlayer.x,y:localPlayer.y,camera:cameraOwner.snapshot(),dummyX:d&&d.x,dummyY:d&&d.y,dummyHp:d&&d.hp,dummyMaxHp:d&&d.maxHp};state.mode='entering';state.combatEnabled=false;resetCombatTransient();window.KELO_COMBAT_ENABLED=false;if(typeof closeMenu==='function')closeMenu();startTransition('enter');clearTimeout(state.transitionTimer);state.transitionTimer=setTimeout(()=>{try{if(d&&!onlineAuthority()){d.x=WORLD.dummyX;d.y=WORLD.dummyY;d.hp=d.maxHp=100;}localPlayer.x=WORLD.spawnX;localPlayer.y=WORLD.spawnY;localPlayer.vx=localPlayer.vy=0;updateAimWorld({x:WORLD.dummyX,y:WORLD.dummyY},'enter');cameraOwner.setTarget(localPlayer.x,localPlayer.y,{snap:true,source:'pvp-world:enter'});document.body.classList.remove('social-mode');state.mode='pvp';state.combatEnabled=true;window.KELO_COMBAT_ENABLED=true;finishTransition();setExitVisible(true);sendIntent('enter_pvp');toast('Mundo PvP · action combat');audit('entered');}catch(e){state.lastError=String(e&&e.message||e);state.mode='social';state.combatEnabled=false;window.KELO_COMBAT_ENABLED=false;finishTransition();setExitVisible(false);document.body.classList.add('social-mode');console.error(e);}},TRANSITION_MS);
}
function leave(){
  if(state.mode!=='pvp'||state.transitioning)return;state.mode='leaving';sendIntent('leave_pvp');startTransition('leave');clearTimeout(state.transitionTimer);state.transitionTimer=setTimeout(()=>{state.combatEnabled=false;window.KELO_COMBAT_ENABLED=false;resetCombatTransient();if(state.saved&&ready()){localPlayer.x=state.saved.x;localPlayer.y=state.saved.y;localPlayer.vx=localPlayer.vy=0;if(state.saved.camera)cameraOwner.restoreState(state.saved.camera,{source:'pvp-world:leave'});const d=dummyEntity();if(d&&state.saved.dummyX!=null){d.x=state.saved.dummyX;d.y=state.saved.dummyY;d.hp=state.saved.dummyHp;d.maxHp=state.saved.dummyMaxHp;}}document.body.classList.add('social-mode');state.mode='social';finishTransition();setExitVisible(false);toast('Volviste al mundo social');audit('left');},TRANSITION_MS);
}

function drawArc(origin,direction,range,arcDegrees,alpha,lineWidth){const a=Math.atan2(direction.y,direction.x),half=(Number(arcDegrees)||90)*Math.PI/360;ctx.save();ctx.globalAlpha=alpha;ctx.strokeStyle='#f5cd70';ctx.lineWidth=lineWidth||2;ctx.beginPath();ctx.arc(origin.x,origin.y,range,a-half,a+half);ctx.stroke();ctx.restore();}
function drawPremiumAim(){
  if(!state.combatEnabled||!ready()||state.armedSlot>=0)return;const age=now()-state.lastAimActivity,base=age<TUNING.aimIndicator.fadeMs?TUNING.aimIndicator.activeAlpha:TUNING.aimIndicator.idleAlpha,mag=clamp(state.aim.magnitude||1,.35,1),length=TUNING.aimIndicator.min+(TUNING.aimIndicator.max-TUNING.aimIndicator.min)*mag,start=TUNING.aimIndicator.start;
  const x1=localPlayer.x+state.aim.x*start,y1=localPlayer.y+state.aim.y*start,x2=localPlayer.x+state.aim.x*length,y2=localPlayer.y+state.aim.y*length;
  ctx.save();const g=ctx.createLinearGradient(x1,y1,x2,y2);g.addColorStop(0,'rgba(116,214,255,0)');g.addColorStop(.32,'rgba(116,214,255,'+(base*.42)+')');g.addColorStop(1,'rgba(153,229,255,'+base+')');ctx.strokeStyle=g;ctx.lineWidth=1.6;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();
  ctx.translate(x2,y2);ctx.rotate(Math.PI/4);ctx.strokeStyle='rgba(165,232,255,'+base+')';ctx.fillStyle='rgba(83,188,230,'+(base*.12)+')';ctx.lineWidth=1.3;ctx.beginPath();ctx.rect(-5,-5,10,10);ctx.fill();ctx.stroke();ctx.rotate(-Math.PI/4);ctx.globalAlpha=base*.8;ctx.beginPath();ctx.moveTo(-9,0);ctx.lineTo(-5,0);ctx.moveTo(5,0);ctx.lineTo(9,0);ctx.moveTo(0,-9);ctx.lineTo(0,-5);ctx.moveTo(0,5);ctx.lineTo(0,9);ctx.stroke();ctx.restore();
}
function drawTelegraph(){
  if(!state.combatEnabled||!ready())return;const a=state.basicAttack;if(a){const alpha=a.phase==='windup'?.18:a.phase==='active'?.64:.12;drawArc(localPlayer,a.direction,a.profile.range,a.profile.arcDegrees,alpha,a.phase==='active'?3:1.5);}
  if(state.specialHold){const charge=window.KeloMeleeEngine.chargeValue(state.specialHold.profile,(now()-state.specialHold.pressedAt)/1000);drawArc(localPlayer,state.aim,state.specialHold.profile.range*(1+.14*charge.charge01),state.specialHold.profile.arcDegrees,.18+.45*charge.charge01,2.5);}
  if(state.armedSlot<0)return;const i=hotbarInstance(state.armedSlot);if(!i||!i.definition)return;const d=i.definition,t=d.targeting||{},delivery=d.delivery||{},range=t.range||delivery.maxDistance||delivery.distance||300,pos={x:localPlayer.x+state.aim.x*range,y:localPlayer.y+state.aim.y*range};ctx.save();ctx.globalCompositeOperation='lighter';ctx.lineWidth=1.7;const grad=ctx.createLinearGradient(localPlayer.x,localPlayer.y,pos.x,pos.y);grad.addColorStop(0,'rgba(103,216,255,.10)');grad.addColorStop(1,'rgba(103,216,255,.88)');ctx.strokeStyle=grad;ctx.fillStyle='rgba(103,216,255,.075)';ctx.setLineDash([10,7]);ctx.beginPath();ctx.moveTo(localPlayer.x+state.aim.x*28,localPlayer.y+state.aim.y*28);ctx.lineTo(pos.x,pos.y);ctx.stroke();ctx.setLineDash([]);if(t.type==='position'){const r=delivery.radius||delivery.activationRadius||24;ctx.beginPath();ctx.arc(pos.x,pos.y,r,0,Math.PI*2);ctx.fill();ctx.stroke();}else if(delivery.type==='dash'||delivery.type==='blink'){ctx.beginPath();ctx.arc(pos.x,pos.y,15,0,Math.PI*2);ctx.fill();ctx.stroke();}else{ctx.beginPath();ctx.arc(pos.x,pos.y,6,0,Math.PI*2);ctx.fill();ctx.stroke();}ctx.restore();
}
function drawArenaScene(){if(typeof ctx==='undefined'||!ready())return;ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle='#070b12';ctx.fillRect(0,0,canvas.width||screenW,canvas.height||screenH);ctx.restore();const z=(typeof CONFIG!=='undefined'&&CONFIG.zoom)||1;ctx.save();ctx.translate(screenW/2,screenH/2);ctx.scale(z,z);ctx.translate(-camera.x,-camera.y);if(window.KeloScreenFX&&typeof window.KeloScreenFX.applyWorldTransform==='function')window.KeloScreenFX.applyWorldTransform(ctx);ctx.fillStyle='#101722';ctx.fillRect(WORLD.x,WORLD.y,WORLD.w,WORLD.h);ctx.fillStyle='#162231';ctx.fillRect(WORLD.x+24,WORLD.y+24,WORLD.w-48,WORLD.h-48);ctx.strokeStyle='rgba(231,197,106,.72)';ctx.lineWidth=5;ctx.strokeRect(WORLD.x+18,WORLD.y+18,WORLD.w-36,WORLD.h-36);if(window.KeloVisualSystem){window.KeloVisualSystem.renderWorldLayer('groundFX',ctx);window.KeloVisualSystem.renderWorldLayer('belowActor',ctx);}drawTelegraph();drawPremiumAim();const d=dummyEntity();if(!onlineAuthority()&&d&&typeof renderAvatar==='function'&&d.hp>0){renderAvatar(d,false);ctx.fillStyle='rgba(0,0,0,.72)';ctx.fillRect(d.x-34,d.y-58,68,7);ctx.fillStyle='#ef476f';ctx.fillRect(d.x-34,d.y-58,68*clamp(d.hp/d.maxHp,0,1),7);}if(window.keloNet&&window.keloNet.peers&&typeof renderAvatar==='function')Object.keys(window.keloNet.peers).forEach(id=>{const p=window.keloNet.peers[id];if(p&&p.zone==='pvp')renderAvatar(p,false);});if(typeof renderAvatar==='function')renderAvatar(localPlayer,true);if(window.KeloVisualSystem){window.KeloVisualSystem.renderWorldLayer('worldFX',ctx);window.KeloVisualSystem.renderWorldLayer('foregroundFX',ctx);}state.impacts.forEach(f=>{const k=clamp(f.life/f.max,0,1);ctx.globalAlpha=k*(f.predicted?.45:1);ctx.strokeStyle=f.predicted?'#8edbff':'#fff3b0';ctx.lineWidth=2.5;ctx.beginPath();ctx.arc(f.x,f.y,(1-k)*20+5,0,Math.PI*2);ctx.stroke();});state.misses.forEach(f=>{const k=clamp(f.life/f.max,0,1);ctx.globalAlpha=k*.7;ctx.strokeStyle='#7f8ea3';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(f.x-5,f.y-5);ctx.lineTo(f.x+5,f.y+5);ctx.moveTo(f.x+5,f.y-5);ctx.lineTo(f.x-5,f.y+5);ctx.stroke();});state.floats.forEach(f=>{ctx.globalAlpha=clamp(f.life/.72,0,1);ctx.fillStyle='#fff';ctx.font='bold 15px sans-serif';ctx.textAlign='center';ctx.fillText(f.text,f.x,f.y);});ctx.globalAlpha=1;ctx.restore();if(window.KeloVisualSystem)window.KeloVisualSystem.renderScreenLayer('screenFX',ctx);}
function drawTransition(){if(!state.transitioning||typeof ctx==='undefined')return;const p=progress();ctx.save();ctx.fillStyle='rgba(7,11,18,'+(Math.sin(p*Math.PI)*.34)+')';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.restore();}
function interceptPvPFrame(){if(state.combatEnabled||state.mode==='leaving'){drawArenaScene();if(state.transitioning)drawTransition();return true;}return false;}

function updateFxLists(dt){for(let i=state.floats.length-1;i>=0;i--){state.floats[i].life-=dt;state.floats[i].y-=18*dt;if(state.floats[i].life<=0)state.floats.splice(i,1);}for(const list of [state.impacts,state.misses])for(let i=list.length-1;i>=0;i--){list[i].life-=dt;if(list[i].life<=0)list.splice(i,1);}}
function tickPvP(context){const dt=Math.max(0,Math.min(.05,Number(context.dt)||0)),t=now();if(state.hitStopVisual>0)state.hitStopVisual=Math.max(0,state.hitStopVisual-dt);state.dodgeCooldown=Math.max(0,state.dodgeCooldown-dt);syncGamepadAim();syncResources(false);if(window.KeloMeleeEngine&&state.basicResource)window.KeloMeleeEngine.tickResource(state.basicResource,rootProfile(),dt);const root=rootProfile(),special=root&&root.specialAttackProfileId&&window.KeloMeleeEngine.getProfile(root.specialAttackProfileId);if(window.KeloMeleeEngine&&state.specialResource&&special)window.KeloMeleeEngine.tickResource(state.specialResource,special,dt);updateAttack(dt);updateDodge(dt);processIntents(t);updateFxLists(dt);if(state.comboExpiresAt&&t>state.comboExpiresAt+TUNING.comboGraceMs&&!state.basicAttack){state.comboStep=0;state.comboExpiresAt=0;}if(state.transitioning)freezeMovement();if(state.combatEnabled&&ready()){const r=Number(localPlayer.radius)||20;localPlayer.x=clamp(localPlayer.x,WORLD.x+r,WORLD.x+WORLD.w-r);localPlayer.y=clamp(localPlayer.y,WORLD.y+r,WORLD.y+WORLD.h-r);localPlayer._face=faceFromDirection(state.basicAttack?state.basicAttack.direction:state.aim);}audit('tick');}

function slotFromTarget(target){const b=target&&target.closest&&target.closest('.stone-slot');return b?Number(b.dataset.slot):null;}
window.addEventListener('pointermove',function(e){if(!state.combatEnabled||state.transitioning)return;if(e.pointerType==='mouse'&&typeof canvas!=='undefined'&&e.target===canvas){updateAimScreen(e.clientX,e.clientY,'mouse');return;}if(e.pointerId===state.combatPointerId||e.pointerId===state.abilityPointerId)updateAimScreen(e.clientX,e.clientY,e.pointerType||'pointer');},true);
window.addEventListener('pointerdown',function(e){
  if(!state.combatEnabled||state.transitioning)return;const slot=slotFromTarget(e.target);state.lastPointerType=e.pointerType;if(slot!=null){e.preventDefault();e.stopImmediatePropagation();inputOwner.combat.push('ABILITY_PRESS',{slot});state.abilityPointerId=e.pointerId;state.abilityPointerSlot=slot;try{e.target.setPointerCapture(e.pointerId);}catch(_){}return;}
  if(typeof canvas==='undefined'||e.target!==canvas)return;if(e.pointerType==='touch'&&e.clientX<(window.innerWidth||screenW)*TUNING.mobileCombatSplit)return;e.preventDefault();e.stopImmediatePropagation();updateAimScreen(e.clientX,e.clientY,e.pointerType||'pointer');state.combatPointerId=e.pointerId;try{canvas.setPointerCapture(e.pointerId);}catch(_){}
  if(e.pointerType==='mouse'){if(e.button===2)inputOwner.combat.push('SPECIAL_PRESS',{source:'mouse'});else if(e.button===0)inputOwner.combat.push('BASIC_PRESS',{source:'mouse'});}
},true);
window.addEventListener('pointerup',function(e){if(!state.combatEnabled||state.transitioning)return;if(e.pointerId===state.abilityPointerId){updateAimScreen(e.clientX,e.clientY,e.pointerType||'pointer');state.abilityPointerId=null;state.abilityPointerSlot=-1;inputOwner.combat.push('ABILITY_RELEASE',{slot:state.armedSlot});e.preventDefault();return;}if(e.pointerId===state.combatPointerId){updateAimScreen(e.clientX,e.clientY,e.pointerType||'pointer');state.combatPointerId=null;if(e.pointerType==='touch'){inputOwner.combat.push('BASIC_PRESS',{source:'touch'});inputOwner.combat.push('BASIC_RELEASE',{source:'touch'});}else if(e.button===2)inputOwner.combat.push('SPECIAL_RELEASE',{source:'mouse'});else inputOwner.combat.push('BASIC_RELEASE',{source:'mouse'});e.preventDefault();}},true);
window.addEventListener('pointercancel',function(e){if(e.pointerId===state.combatPointerId)state.combatPointerId=null;if(e.pointerId===state.abilityPointerId){state.abilityPointerId=null;state.abilityPointerSlot=-1;inputOwner.combat.push('CANCEL_CAST');}},true);
window.addEventListener('keydown',function(e){if(!state.combatEnabled||state.transitioning||inputOwner.isLocked())return;if(/^Digit[1-5]$/.test(e.code)){inputOwner.combat.push('ABILITY_PRESS',{slot:Number(e.code.slice(-1))-1});inputOwner.combat.push('ABILITY_RELEASE',{slot:Number(e.code.slice(-1))-1});e.preventDefault();}else if(e.code==='Space'){inputOwner.combat.push('DODGE_PRESS',{source:'keyboard'});e.preventDefault();}else if(e.code==='KeyQ'&&!e.repeat){inputOwner.combat.push('SPECIAL_PRESS',{source:'keyboard'});e.preventDefault();}else if(e.code==='Escape'){inputOwner.combat.push('CANCEL_CAST');e.preventDefault();}},true);
window.addEventListener('keyup',function(e){if(!state.combatEnabled||state.transitioning)return;if(e.code==='KeyQ'){inputOwner.combat.push('SPECIAL_RELEASE',{source:'keyboard'});e.preventDefault();}},true);
window.addEventListener('contextmenu',function(e){if(state.combatEnabled&&e.target===canvas)e.preventDefault();},true);
window.addEventListener('orientationchange',function(){state.combatPointerId=null;state.abilityPointerId=null;state.abilityPointerSlot=-1;inputOwner.combat.push('CANCEL_CAST');});

function audit(event){const p=rootProfile(),a=state.basicAttack;window.KELO_PVP_AUDIT={version:VERSION,event:event||null,mode:state.mode,combatEnabled:state.combatEnabled,transitioning:state.transitioning,targetLock:false,aim360:true,rawAim:{x:state.aim.rawX,y:state.aim.rawY},aim:{x:state.aim.x,y:state.aim.y,source:state.aim.source},assistTargetId:state.assistTargetId,basicPhase:a&&a.phase||null,basicResource:state.basicResource&&{current:state.basicResource.current,max:state.basicResource.max,rechargeElapsed:state.basicResource.rechargeElapsed},comboStep:state.comboStep,comboSteps:p&&p.combo&&p.combo.length||1,inputBufferMs:inputOwner.combat.bufferMs,specialHolding:!!state.specialHold,dodgeActive:!!state.dodge,dodgeCooldown:state.dodgeCooldown,meleeGeometry:'KeloHitResolver.resolveMelee',attackPhases:true,phaseMovement:true,multitouchPointerEvents:true,radialDeadzone:true,softAimAssist:true,hysteresis:true,gamepadReady:true,telegraphsPresentationOnly:true,premiumAimIndicator:true,onlineAuthority:onlineAuthority(),authority:onlineAuthority()?'server-intent+prediction':'local-command-fallback',cameraOwner:'KeloCamera',renderOwner:'KeloRender',simulationOwner:'KeloSimulation',lastError:state.lastError};}
if(window.KeloMovement&&typeof window.KeloMovement.before==='function'){window.KeloMovement.before('pvp-world:movement-scale',movementScaleHook,70);window.KeloMovement.after('pvp-world:combat-facing',facingHook,970);}
if(!window.KeloSimulation||!window.KeloRender)throw new Error('Foundation render/simulation owners unavailable before pvp-world');
window.KeloSimulation.after('pvp-world:tick',tickPvP,60);window.KeloRender.intercept('pvp-world:arena-exclusive',interceptPvPFrame,10);window.KeloRender.afterFrame('pvp-world:transition-fx',drawTransition,150);
window.enterPvPWorld=enter;window.leavePvPWorld=leave;
window.KeloPvPWorld=Object.freeze({version:VERSION,enter,leave,startBasicAttack:function(source){inputOwner.combat.push('BASIC_PRESS',{source:source||'api'});return true;},quickCastSlot:function(slot){inputOwner.combat.push('ABILITY_PRESS',{slot:Number(slot)});inputOwner.combat.push('ABILITY_RELEASE',{slot:Number(slot)});return true;},setAimWorld:updateAimWorld,cancelAim,get state(){return Object.freeze({mode:state.mode,combatEnabled:state.combatEnabled,transitioning:state.transitioning,armedSlot:state.armedSlot,aim:Object.freeze({x:state.aim.x,y:state.aim.y,worldX:state.aim.worldX,worldY:state.aim.worldY,source:state.aim.source}),basicResource:state.basicResource&&Object.freeze({current:state.basicResource.current,max:state.basicResource.max,rechargeElapsed:state.basicResource.rechargeElapsed}),comboStep:state.comboStep,basicAttack:state.basicAttack&&Object.freeze({id:state.basicAttack.id,kind:state.basicAttack.kind,phase:state.basicAttack.phase,profileId:state.basicAttack.profileId,direction:Object.freeze({x:state.basicAttack.direction.x,y:state.basicAttack.direction.y})}),specialHolding:!!state.specialHold,dodgeActive:!!state.dodge,lastError:state.lastError});},command,authority:Object.freeze({mode:()=>onlineAuthority()?'server':'local-fallback'})});
function bootExtras(){ensureFallbackExit();setExitVisible(false);syncResources(true);audit('boot');}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bootExtras,{once:true});else bootExtras();
})();
