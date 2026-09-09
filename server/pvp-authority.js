'use strict';
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const abilityData=require('../src/abilities/abilityData.js');

const FIXED_DT=1/60;
const SNAPSHOT_HZ=20;
const ARENA=Object.freeze({x:2660,y:360,w:720,h:720,spawnX:2790,spawnY:720});
const MAX_REWIND_MS=200;
const HISTORY_MS=350;
const PLAYER_RADIUS=20;
const BASE_SPEED=320;
const BASIC_ID='sword_light_basic';
const ALLOWED_ACTIONS=new Set(['input','enter_pvp','leave_pvp','basic_attack','ability']);
const ALLOWED_PHASES=new Set(['pressed','held','active','released','cast','cancel','recall','swap','none']);

function loadSharedCombatRuntime(){
  const root=path.resolve(__dirname,'..');
  const sandbox={console,Map,Set,Math,Date,Object,Array,String,Number,Boolean,JSON,performance:{now:()=>Date.now()},setTimeout,clearTimeout,setInterval,clearInterval};
  sandbox.globalThis=sandbox;sandbox.window=sandbox;
  [
    'src/core/events/event-bus.js','src/systems/combat/combat-schema.js','src/systems/combat/hit-resolver.js','src/systems/combat/damage-resolver.js',
    'src/systems/combat/combat-engine.js','src/systems/melee/melee-schema.js','src/systems/melee/melee-weapon-profiles.js','src/systems/melee/melee-engine.js'
  ].forEach(rel=>vm.runInContext(fs.readFileSync(path.join(root,rel),'utf8'),sandbox,{filename:rel}));
  if(!sandbox.KeloHitResolver||!sandbox.KeloCombatEngine||!sandbox.KeloMeleeEngine)throw new Error('PVP_SHARED_COMBAT_RUNTIME_UNAVAILABLE');
  return sandbox;
}

const shared=loadSharedCombatRuntime();
const abilityByKey=new Map((abilityData.ABILITIES||[]).map(def=>[def.key,def]));
const basicProfile=shared.KeloMeleeProfiles.get(BASIC_ID);
if(!basicProfile)throw new Error('PVP_BASIC_PROFILE_MISSING');

function clamp(n,a,b){return Math.max(a,Math.min(b,n));}
function finite(n){return Number.isFinite(Number(n));}
function normalize(x,y,fallback){x=Number(x);y=Number(y);if(!finite(x)||!finite(y)||Math.hypot(x,y)<1e-6){x=fallback&&fallback.x||1;y=fallback&&fallback.y||0}const l=Math.hypot(x,y)||1;return{x:x/l,y:y/l};}
function faceOf(dir){return Math.abs(dir.x)>Math.abs(dir.y)?(dir.x<0?'left':'right'):(dir.y<0?'up':'down');}
function sanitizeMove(x,y){x=Number(x)||0;y=Number(y)||0;const len=Math.hypot(x,y);if(len>1.001)return null;return{x:clamp(x,-1,1),y:clamp(y,-1,1)};}
function cooldownKey(key){return String(key||'').slice(0,64);}
function safeSequence(value){const n=Number(value);return Number.isSafeInteger(n)&&n>=0&&n<=Number.MAX_SAFE_INTEGER?n:null;}
function safeTimestamp(value,now){const n=Number(value);if(!Number.isFinite(n))return now;return clamp(n,now-5000,now+250);}
function abilityAction(def){const a=def&&def.action||{};return{windup:Math.max(0,Number(a.windup)||0),active:Math.max(0,Number(a.active)||0),recovery:Math.max(0,Number(a.recovery)||0),movementScale:a.movementScale==null?1:clamp(Number(a.movementScale)||0,0,1)};}
function publicActor(p){return{id:p.id,name:p.name,x:p.x,y:p.y,face:p.face||'down',gait:p.gait||'idle',zone:p.zone||'plaza',hp:p.hp,maxHp:p.maxHp,mana:p.mana,maxMana:p.maxMana,ackSequence:p._pvpAck||0,cooldowns:Object.assign({},p._pvpCooldowns||{}),attackPhase:p._pvpAttack&&p._pvpAttack.phase||null,dash:!!p._pvpDash};}

function createPvpAuthority(options){
  const opts=options||{};
  const arena=Object.freeze(Object.assign({},ARENA,opts.arena||{}));
  const actors=new Map();
  const projectiles=new Map();
  const statuses=[];
  const events=[];
  let projectileSeq=1,tick=0;

  function register(player){
    if(!player||!player.id)throw new Error('PVP_PLAYER_ID_REQUIRED');
    if(!actors.has(player.id)){
      player.hp=finite(player.hp)?clamp(Number(player.hp),0,100):100;player.maxHp=100;
      player.mana=finite(player.mana)?clamp(Number(player.mana),0,100):100;player.maxMana=100;
      player._pvpInput={moveX:0,moveY:0,aimX:1,aimY:0,clientTime:Date.now()};
      player._pvpAck=0;player._pvpLastSequence=-1;player._pvpCooldowns=Object.create(null);player._pvpAttack=null;player._pvpDash=null;player._pvpHistory=[];player._pvpActive=false;
      actors.set(player.id,player);
    }
    return player;
  }
  function unregister(playerOrId){const id=typeof playerOrId==='string'?playerOrId:playerOrId&&playerOrId.id;actors.delete(String(id||''));}
  function activeActors(){return Array.from(actors.values()).filter(p=>p._pvpActive&&p.zone==='pvp'&&p.hp>0);}
  function spawnFor(player){const index=Array.from(actors.keys()).indexOf(player.id),side=index%4;const margin=110;const points=[{x:arena.x+margin,y:arena.y+arena.h/2},{x:arena.x+arena.w-margin,y:arena.y+arena.h/2},{x:arena.x+arena.w/2,y:arena.y+margin},{x:arena.x+arena.w/2,y:arena.y+arena.h-margin}];return points[Math.max(0,side)]||points[0];}
  function resetForPvp(player){const s=spawnFor(player);player.x=s.x;player.y=s.y;player.vx=player.vy=0;player.hp=player.maxHp=100;player.mana=player.maxMana=100;player.zone='pvp';player.face='right';player.gait='idle';player._pvpActive=true;player._pvpCooldowns=Object.create(null);player._pvpAttack=null;player._pvpDash=null;player._pvpHistory=[];}
  function leavePvp(player){player._pvpActive=false;player._pvpAttack=null;player._pvpDash=null;player._pvpInput={moveX:0,moveY:0,aimX:1,aimY:0,clientTime:Date.now()};if(player.zone==='pvp')player.zone='plaza';}

  function ingest(playerOrId,raw,nowMs){
    const player=register(typeof playerOrId==='string'?actors.get(playerOrId):playerOrId),now=Number(nowMs)||Date.now(),msg=raw&&typeof raw==='object'?raw:{};
    const sequence=safeSequence(msg.sequence);if(sequence==null)return{ok:false,reason:'INVALID_SEQUENCE'};
    if(sequence<=player._pvpLastSequence)return{ok:false,reason:'STALE_SEQUENCE',ackSequence:player._pvpAck};
    if(sequence-player._pvpLastSequence>4096&&player._pvpLastSequence>=0)return{ok:false,reason:'IMPOSSIBLE_SEQUENCE_JUMP'};
    const move=sanitizeMove(msg.moveX,msg.moveY);if(!move)return{ok:false,reason:'IMPOSSIBLE_MOVE_VECTOR'};
    const aim=normalize(msg.aimX,msg.aimY,player._pvpInput);const action=String(msg.action||'input');if(!ALLOWED_ACTIONS.has(action))return{ok:false,reason:'INVALID_ACTION'};
    const phase=String(msg.phase||'none');if(!ALLOWED_PHASES.has(phase))return{ok:false,reason:'INVALID_PHASE'};
    const clientTime=safeTimestamp(msg.clientTime,now);
    player._pvpLastSequence=sequence;player._pvpAck=sequence;player._pvpInput={moveX:move.x,moveY:move.y,aimX:aim.x,aimY:aim.y,clientTime};player.face=faceOf(aim);
    if(action==='enter_pvp'){resetForPvp(player);events.push({id:`e${tick}_${sequence}`,type:'ENTER',actorId:player.id});return{ok:true,ackSequence:sequence};}
    if(action==='leave_pvp'){leavePvp(player);events.push({id:`e${tick}_${sequence}`,type:'LEAVE',actorId:player.id});return{ok:true,ackSequence:sequence};}
    if(!player._pvpActive||player.zone!=='pvp')return{ok:false,reason:'PVP_NOT_ACTIVE',ackSequence:sequence};
    if(action==='basic_attack'&&phase==='pressed')startBasic(player,sequence,clientTime,now);
    if(action==='ability'&&phase==='cast')castAbility(player,msg,sequence,clientTime,now);
    return{ok:true,ackSequence:sequence};
  }

  function cooldownReady(player,key){return Math.max(0,Number(player._pvpCooldowns[key])||0)<=0;}
  function spend(player,def){const cost=Math.max(0,Number(def.resource&&def.resource.cost)||0);if(player.mana<cost)return false;player.mana-=cost;player._pvpCooldowns[cooldownKey(def.key)]=Math.max(0,Number(def.cooldown)||0);return true;}
  function startBasic(player,sequence,clientTime,now){
    if(player._pvpAttack||!cooldownReady(player,BASIC_ID)||player.hp<=0)return false;
    const dir=normalize(player._pvpInput.aimX,player._pvpInput.aimY);player._pvpCooldowns[BASIC_ID]=basicProfile.cooldown;
    player._pvpAttack={id:`srv_basic_${player.id}_${sequence}`,phase:'windup',time:0,direction:dir,profile:basicProfile,resolved:false,rewindMs:clamp(now-clientTime,0,MAX_REWIND_MS),startedAt:now};
    events.push({id:`e${tick}_${sequence}_basic`,type:'BASIC_STARTED',actorId:player.id,attackId:player._pvpAttack.id,direction:dir});return true;
  }
  function castAbility(player,msg,sequence,clientTime,now){
    const def=abilityByKey.get(String(msg.abilityKey||''));if(!def||!cooldownReady(player,def.key)||player.hp<=0)return false;
    if(!spend(player,def))return false;const dir=normalize(msg.direction&&msg.direction.x||player._pvpInput.aimX,msg.direction&&msg.direction.y||player._pvpInput.aimY,player._pvpInput),action=abilityAction(def);
    if(def.key==='fireball'){
      const p={id:`srv_projectile_${projectileSeq++}`,ownerId:player.id,abilityKey:def.key,x:player.x,y:player.y-8,vx:dir.x*def.delivery.speed,vy:dir.y*def.delivery.speed,radius:def.delivery.radius,traveled:0,maxDistance:def.delivery.maxDistance,damage:Number((def.effects||[]).find(e=>e.type==='damage')?.amount)||0,burn:(def.effects||[]).find(e=>e.type==='status'&&e.status==='burn')||null,spawnedAt:now,rewindMs:clamp(now-clientTime,0,MAX_REWIND_MS)};
      projectiles.set(p.id,p);events.push({id:`e${tick}_${sequence}_fireball`,type:'PROJECTILE_SPAWNED',actorId:player.id,projectile:Object.assign({},p)});return true;
    }
    if(def.key==='wind_dash'){
      const distance=Math.max(0,Number(def.delivery.distance)||0),duration=Math.max(FIXED_DT,Number(def.delivery.duration)||0.18),tx=clamp(player.x+dir.x*distance,arena.x+PLAYER_RADIUS,arena.x+arena.w-PLAYER_RADIUS),ty=clamp(player.y+dir.y*distance,arena.y+PLAYER_RADIUS,arena.y+arena.h-PLAYER_RADIUS);
      player._pvpDash={sx:player.x,sy:player.y,tx,ty,time:0,duration,direction:dir};events.push({id:`e${tick}_${sequence}_dash`,type:'DASH_STARTED',actorId:player.id,direction:dir,target:{x:tx,y:ty},duration});return true;
    }
    events.push({id:`e${tick}_${sequence}_ability`,type:'ABILITY_ACCEPTED',actorId:player.id,abilityKey:def.key,action});return true;
  }

  function historyAt(player,targetTime){const h=player._pvpHistory||[];if(!h.length)return{x:player.x,y:player.y};let best=h[0],bestD=Math.abs(h[0].time-targetTime);for(let i=1;i<h.length;i++){const d=Math.abs(h[i].time-targetTime);if(d<bestD){best=h[i];bestD=d}}return{x:best.x,y:best.y};}
  function resolveBasic(player,attack,now){
    const targets=activeActors().filter(t=>t!==player&&t.hp>0),restore=[];const targetTime=now-attack.rewindMs;
    targets.forEach(t=>{const old={target:t,x:t.x,y:t.y},rew=historyAt(t,targetTime);restore.push(old);t.x=rew.x;t.y=rew.y;});
    const result=shared.KeloMeleeEngine.attackSweep({attacker:player,targets,direction:attack.direction,profileId:BASIC_ID,cooldownRemaining:0,attackId:attack.id,startedAt:attack.startedAt,source:'server-pvp',skipStart:true});
    restore.forEach(r=>{r.target.x=r.x;r.target.y=r.y;});
    const hits=result&&result.hits||[];hits.forEach(hit=>{const target=actors.get(hit.targetId)||hit.target;if(target&&hit.target!==target){target.hp=hit.hp}events.push({id:`e${tick}_${attack.id}_${hit.targetId}`,type:'BASIC_HIT',actorId:player.id,targetId:hit.targetId,amount:hit.amount,hp:hit.hp,attackId:attack.id});if(hit.killed&&target)handleKill(player,target,{source:'pvp-basic',attackId:attack.id,serverTime:now});});
  }
  function handleKill(killer,victim,context){victim.hp=0;victim._pvpAttack=null;victim._pvpDash=null;events.push({id:`e${tick}_death_${victim.id}`,type:'DEATH',actorId:victim.id,killerId:killer&&killer.id||null});if(typeof opts.onKill==='function'&&killer)Promise.resolve(opts.onKill(killer,victim,context)).catch(err=>console.error('[PvP authority] kill hook',err));}
  function applyProjectileHit(p,target,now){const owner=actors.get(p.ownerId);if(!owner||!target)return;const damage=shared.KeloDamageResolver.apply(target,p.damage);events.push({id:`e${tick}_${p.id}_hit`,type:'PROJECTILE_HIT',actorId:p.ownerId,targetId:target.id,projectileId:p.id,amount:damage.amount,hp:damage.hp,position:{x:p.x,y:p.y},abilityKey:p.abilityKey});if(p.burn&&target.hp>0)statuses.push({type:'burn',sourceId:p.ownerId,targetId:target.id,remaining:Number(p.burn.duration)||0,magnitude:Number(p.burn.magnitude)||0,interval:Number(p.burn.tickInterval)||1,tick:Number(p.burn.tickInterval)||1});if(damage.killed)handleKill(owner,target,{source:'pvp-fireball',projectileId:p.id,serverTime:now});}

  function step(dt,nowMs){
    dt=Number(dt)||FIXED_DT;const now=Number(nowMs)||Date.now();tick++;
    actors.forEach(player=>{
      if(!player._pvpActive)return;
      Object.keys(player._pvpCooldowns).forEach(key=>player._pvpCooldowndowns[key]=Math.max(0,(Number(player._pvpCooldowns[key])||0)-dt));
      player.mana=Math.min(player.maxMana,player.mana+8*dt);
      if(player._pvpDash){const d=player._pvpDash;d.time+=dt;const k=clamp(d.time/d.duration,0,1),ease=1-Math.pow(1-k,3);player.x=d.sx+(d.tx-d.sx)*ease;player.y=d.sy+(d.ty-d.sy)*ease;if(k>=1){player.x=d.tx;player.y=d.ty;player._pvpDash=null;events.push({id:`e${tick}_dash_end_${player.id}`,type:'DASH_ENDED',actorId:player.id,position:{x:player.x,y:player.y}})}}
      else{
        let scale=1;if(player._pvpAttack)scale=clamp(Number(player._pvpAttack.profile.movementScale)||0,0,1);const input=player._pvpInput||{};const mx=Number(input.moveX)||0,my=Number(input.moveY)||0;player.x=clamp(player.x+mx*BASE_SPEED*scale*dt,arena.x+PLAYER_RADIUS,arena.x+arena.w-PLAYER_RADIUS);player.y=clamp(player.y+my*BASE_SPEED*scale*dt,arena.y+PLAYER_RADIUS,arena.y+arena.h-PLAYER_RADIUS);player.gait=Math.hypot(mx,my)>0.05?'run':'idle';
      }
      if(player._pvpAttack){const a=player._pvpAttack;a.time+=dt;if(a.phase==='windup'&&a.time>=a.profile.windup){a.phase='active';a.time=0;if(!a.resolved){a.resolved=true;resolveBasic(player,a,now)}}else if(a.phase==='active'&&a.time>=a.profile.active){a.phase='recovery';a.time=0}else if(a.phase==='recovery'&&a.time>=a.profile.recovery)player._pvpAttack=null;}
      const h=player._pvpHistory;h.push({time:now,x:player.x,y:player.y});while(h.length&&now-h[0].time>HISTORY_MS)h.shift();
    });

    projectiles.forEach((p,id)=>{const old={x:p.x,y:p.y};p.x+=p.vx*dt;p.y+=p.vy*dt;p.traveled+=Math.hypot(p.vx,p.vy)*dt;let best=null;activeActors().forEach(target=>{if(target.id===p.ownerId)return;const hit=shared.KeloHitResolver.sweptCircle(old,{x:p.x,y:p.y},p.radius,target,target.radius||PLAYER_RADIUS);if(hit.hit&&(!best||hit.t<best.t))best={target,t:hit.t};});if(best){p.x=old.x+(p.x-old.x)*best.t;p.y=old.y+(p.y-old.y)*best.t;applyProjectileHit(p,best.target,now);projectiles.delete(id)}else if(p.traveled>=p.maxDistance){events.push({id:`e${tick}_${id}_expire`,type:'PROJECTILE_EXPIRED',actorId:p.ownerId,projectileId:id,position:{x:p.x,y:p.y}});projectiles.delete(id)}});

    for(let i=statuses.length-1;i>=0;i--){const s=statuses[i],target=actors.get(s.targetId),owner=actors.get(s.sourceId);s.remaining-=dt;s.tick-=dt;if(!target||target.hp<=0){statuses.splice(i,1);continue}while(s.tick<=0&&s.remaining>0){s.tick+=s.interval;const damage=shared.KeloDamageResolver.apply(target,s.magnitude);events.push({id:`e${tick}_burn_${s.targetId}_${i}`,type:'STATUS_TICK',status:'burn',actorId:s.sourceId,targetId:s.targetId,amount:damage.amount,hp:damage.hp});if(damage.killed){handleKill(owner,target,{source:'pvp-burn',serverTime:now});break}}if(s.remaining<=0||target.hp<=0)statuses.splice(i,1);}
    return tick;
  }

  function snapshot(nowMs){const players={};actors.forEach(p=>{if(p._pvpActive||p.zone==='pvp')players[p.id]=publicActor(p)});return{version:'pvp-server-authority-v1',serverTick:tick,serverTime:Number(nowMs)||Date.now(),fixedDt:FIXED_DT,maxRewindMs:MAX_REWIND_MS,players,projectiles:Array.from(projectiles.values()).map(p=>({id:p.id,ownerId:p.ownerId,abilityKey:p.abilityKey,x:p.x,y:p.y,radius:p.radius}))};}
  function consumeEvents(){return events.splice(0,events.length);}
  function audit(){return{version:'pvp-server-authority-v1',fixedDt:FIXED_DT,snapshotHz:SNAPSHOT_HZ,maxRewindMs:MAX_REWIND_MS,sharedHitResolver:shared.KeloHitResolver.version,sharedCombatEngine:shared.KeloCombatEngine.version,sharedMeleeEngine:shared.KeloMeleeEngine.version,players:actors.size,projectiles:projectiles.size};}
  return Object.freeze({version:'pvp-server-authority-v1',fixedDt:FIXED_DT,snapshotHz:SNAPSHOT_HZ,maxRewindMs:MAX_REWIND_MS,register,unregister,ingest,step,snapshot,consumeEvents,audit,getPlayer:id=>actors.get(String(id||''))||null});
}

module.exports={createPvpAuthority,FIXED_DT,SNAPSHOT_HZ,MAX_REWIND_MS,ARENA};
