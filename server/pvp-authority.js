'use strict';
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const abilityData=require('../src/abilities/abilityData.js');

const FIXED_DT=1/60;
const SNAPSHOT_HZ=20;
const MAX_REWIND_MS=200;
const HISTORY_MS=350;
const PLAYER_RADIUS=20;
const BASE_SPEED=320;
const BASIC_ID='sword_light_basic';
const ARENA=Object.freeze({x:2660,y:360,w:720,h:720,spawnX:2790,spawnY:720});
const ACTIONS=new Set(['input','enter_pvp','leave_pvp','basic_attack','ability']);
const PHASES=new Set(['pressed','held','active','released','cast','cancel','recall','swap','none']);

function loadSharedCombat(){
  const root=path.resolve(__dirname,'..');
  const box={console,Map,Set,Math,Date,Object,Array,String,Number,Boolean,JSON,performance:{now:()=>Date.now()},setTimeout,clearTimeout,setInterval,clearInterval};
  box.globalThis=box;box.window=box;vm.createContext(box);
  ['src/core/events/event-bus.js','src/systems/combat/combat-schema.js','src/systems/combat/hit-resolver.js','src/systems/combat/damage-resolver.js','src/systems/combat/combat-engine.js','src/systems/melee/melee-schema.js','src/systems/melee/melee-weapon-profiles.js','src/systems/melee/melee-engine.js'].forEach(rel=>vm.runInContext(fs.readFileSync(path.join(root,rel),'utf8'),box,{filename:rel}));
  if(!box.KeloHitResolver||!box.KeloDamageResolver||!box.KeloMeleeEngine)throw new Error('PVP_SHARED_COMBAT_UNAVAILABLE');
  return box;
}
const shared=loadSharedCombat();
const abilities=new Map((abilityData.ABILITIES||[]).map(def=>[def.key,def]));
const basic=shared.KeloMeleeProfiles.get(BASIC_ID);
if(!basic)throw new Error('PVP_BASIC_PROFILE_MISSING');

const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const finite=n=>Number.isFinite(Number(n));
function unit(x,y,fallback){x=Number(x);y=Number(y);if(!finite(x)||!finite(y)||Math.hypot(x,y)<1e-6){x=Number(fallback&&fallback.x)||1;y=Number(fallback&&fallback.y)||0;}const l=Math.hypot(x,y)||1;return{x:x/l,y:y/l};}
function moveVec(x,y){x=Number(x)||0;y=Number(y)||0;const l=Math.hypot(x,y);return l>1.001?null:{x:clamp(x,-1,1),y:clamp(y,-1,1)};}
function face(dir){return Math.abs(dir.x)>Math.abs(dir.y)?(dir.x<0?'left':'right'):(dir.y<0?'up':'down');}
function seqOf(v){const n=Number(v);return Number.isSafeInteger(n)&&n>=0?n:null;}
function clientTimeOf(v,now){const n=Number(v);return finite(n)?clamp(n,now-5000,now+250):now;}
function actionOf(def){const a=def&&def.action||{};return{windup:Math.max(0,Number(a.windup)||0),active:Math.max(0,Number(a.active)||0),recovery:Math.max(0,Number(a.recovery)||0),movementScale:a.movementScale==null?1:clamp(Number(a.movementScale)||0,0,1)};}
function actorPublic(p){return{id:p.id,name:p.name,x:p.x,y:p.y,face:p.face||'down',gait:p.gait||'idle',zone:p.zone||'plaza',hp:p.hp,maxHp:p.maxHp,mana:p.mana,maxMana:p.maxMana,ackSequence:p._pvpAck||0,cooldowns:Object.assign({},p._pvpCooldowns||{}),attackPhase:p._pvpAttack&&p._pvpAttack.phase||null,castPhase:p._pvpCast&&p._pvpCast.phase||null,dash:!!p._pvpDash};}

function createPvpAuthority(options){
  const opts=options||{},arena=Object.freeze(Object.assign({},ARENA,opts.arena||{}));
  const actors=new Map(),projectiles=new Map(),statuses=[],events=[];
  let tick=0,projectileSeq=1;

  function register(player){
    if(!player||!player.id)throw new Error('PVP_PLAYER_ID_REQUIRED');
    if(actors.has(player.id))return actors.get(player.id);
    player.radius=finite(player.radius)?Number(player.radius):PLAYER_RADIUS;
    player.hp=finite(player.hp)?clamp(Number(player.hp),0,100):100;player.maxHp=100;
    player.mana=finite(player.mana)?clamp(Number(player.mana),0,100):100;player.maxMana=100;
    player._pvpInput={moveX:0,moveY:0,aimX:1,aimY:0,clientTime:Date.now()};
    player._pvpAck=0;player._pvpLastSequence=-1;player._pvpCooldowns=Object.create(null);player._pvpAttack=null;player._pvpCast=null;player._pvpDash=null;player._pvpHistory=[];player._pvpActive=false;
    actors.set(player.id,player);return player;
  }
  function unregister(value){const id=typeof value==='string'?value:value&&value.id;actors.delete(String(id||''));}
  function active(){return Array.from(actors.values()).filter(p=>p._pvpActive&&p.zone==='pvp'&&p.hp>0);}
  function spawn(player){const i=Math.max(0,Array.from(actors.keys()).indexOf(player.id))%4,m=110;return[{x:arena.x+m,y:arena.y+arena.h/2},{x:arena.x+arena.w-m,y:arena.y+arena.h/2},{x:arena.x+arena.w/2,y:arena.y+m},{x:arena.x+arena.w/2,y:arena.y+arena.h-m}][i];}
  function enter(player){const s=spawn(player);player.x=s.x;player.y=s.y;player.vx=player.vy=0;player.hp=player.maxHp=100;player.mana=player.maxMana=100;player.zone='pvp';player.face='right';player.gait='idle';player._pvpActive=true;player._pvpCooldowns=Object.create(null);player._pvpAttack=player._pvpCast=player._pvpDash=null;player._pvpHistory=[];}
  function leave(player){player._pvpActive=false;player._pvpAttack=player._pvpCast=player._pvpDash=null;player._pvpInput={moveX:0,moveY:0,aimX:1,aimY:0,clientTime:Date.now()};if(player.zone==='pvp')player.zone='plaza';}
  function ready(player,key){return (Number(player._pvpCooldowns[key])||0)<=0;}
  function spend(player,def){const cost=Math.max(0,Number(def.resource&&def.resource.cost)||0);if(player.mana<cost)return false;player.mana-=cost;player._pvpCooldowns[String(def.key).slice(0,64)]=Math.max(0,Number(def.cooldown)||0);return true;}

  function startBasic(player,sequence,clientTime,now){
    if(player.hp<=0||player._pvpAttack||!ready(player,BASIC_ID))return false;
    player._pvpCooldowns[BASIC_ID]=basic.cooldown;
    player._pvpAttack={id:`srv_basic_${player.id}_${sequence}`,phase:'windup',time:0,direction:unit(player._pvpInput.aimX,player._pvpInput.aimY),profile:basic,resolved:false,rewindMs:clamp(now-clientTime,0,MAX_REWIND_MS),startedAt:now};
    events.push({id:`e${tick}_${sequence}_basic`,type:'BASIC_STARTED',actorId:player.id,attackId:player._pvpAttack.id,direction:player._pvpAttack.direction});return true;
  }
  function startAbility(player,msg,sequence,clientTime,now){
    const def=abilities.get(String(msg.abilityKey||''));if(!def||player.hp<=0||player._pvpCast||!ready(player,def.key)||!spend(player,def))return false;
    const dir=unit(msg.direction&&msg.direction.x||player._pvpInput.aimX,msg.direction&&msg.direction.y||player._pvpInput.aimY,player._pvpInput),a=actionOf(def);
    player._pvpCast={id:`srv_cast_${player.id}_${sequence}`,def,direction:dir,phase:'windup',time:0,action:a,clientTime,startedAt:now,sequence,delivered:false};
    events.push({id:`e${tick}_${sequence}_cast`,type:'CAST_STARTED',actorId:player.id,abilityKey:def.key,direction:dir,windup:a.windup});
    if(a.windup<=0)deliverCast(player,player._pvpCast,now);return true;
  }
  function deliverCast(player,cast,now){
    if(!cast||cast.delivered)return;cast.delivered=true;cast.phase='active';cast.time=0;const def=cast.def,dir=cast.direction;
    if(def.key==='fireball'){
      const burn=(def.effects||[]).find(e=>e.type==='status'&&e.status==='burn')||null,damage=(def.effects||[]).find(e=>e.type==='damage');
      const p={id:`srv_projectile_${projectileSeq++}`,ownerId:player.id,abilityKey:def.key,x:player.x+dir.x*18,y:player.y-8+dir.y*18,vx:dir.x*def.delivery.speed,vy:dir.y*def.delivery.speed,radius:def.delivery.radius,traveled:0,maxDistance:def.delivery.maxDistance,damage:Number(damage&&damage.amount)||0,burn};
      projectiles.set(p.id,p);events.push({id:`e${tick}_${cast.sequence}_fireball`,type:'PROJECTILE_SPAWNED',actorId:player.id,abilityKey:def.key,projectile:Object.assign({},p)});
    }else if(def.key==='wind_dash'){
      const d=Math.max(0,Number(def.delivery.distance)||0),duration=Math.max(FIXED_DT,Number(def.delivery.duration)||0.18);
      const tx=clamp(player.x+dir.x*d,arena.x+player.radius,arena.x+arena.w-player.radius),ty=clamp(player.y+dir.y*d,arena.y+player.radius,arena.y+arena.h-player.radius);
      player._pvpDash={sx:player.x,sy:player.y,tx,ty,time:0,duration,direction:dir};events.push({id:`e${tick}_${cast.sequence}_dash`,type:'DASH_STARTED',actorId:player.id,abilityKey:def.key,direction:dir,target:{x:tx,y:ty},duration});
    }else events.push({id:`e${tick}_${cast.sequence}_ability`,type:'ABILITY_ACCEPTED',actorId:player.id,abilityKey:def.key});
  }

  function ingest(value,raw,nowMs){
    const player=register(value),now=Number(nowMs)||Date.now(),msg=raw&&typeof raw==='object'?raw:{};
    const sequence=seqOf(msg.sequence);if(sequence==null)return{ok:false,reason:'INVALID_SEQUENCE'};
    if(sequence<=player._pvpLastSequence)return{ok:false,reason:'STALE_SEQUENCE',ackSequence:player._pvpAck};
    if(player._pvpLastSequence>=0&&sequence-player._pvpLastSequence>4096)return{ok:false,reason:'IMPOSSIBLE_SEQUENCE_JUMP',ackSequence:player._pvpAck};
    const move=moveVec(msg.moveX,msg.moveY);if(!move)return{ok:false,reason:'IMPOSSIBLE_MOVE_VECTOR',ackSequence:player._pvpAck};
    const action=String(msg.action||'input'),phase=String(msg.phase||'none');if(!ACTIONS.has(action))return{ok:false,reason:'INVALID_ACTION'};if(!PHASES.has(phase))return{ok:false,reason:'INVALID_PHASE'};
    const aim=unit(msg.aimX,msg.aimY,player._pvpInput),clientTime=clientTimeOf(msg.clientTime,now);
    player._pvpLastSequence=sequence;player._pvpAck=sequence;player._pvpInput={moveX:move.x,moveY:move.y,aimX:aim.x,aimY:aim.y,clientTime};player.face=face(aim);
    if(action==='enter_pvp'){enter(player);events.push({id:`e${tick}_${sequence}_enter`,type:'ENTER',actorId:player.id});return{ok:true,ackSequence:sequence};}
    if(action==='leave_pvp'){leave(player);events.push({id:`e${tick}_${sequence}_leave`,type:'LEAVE',actorId:player.id});return{ok:true,ackSequence:sequence};}
    if(!player._pvpActive||player.zone!=='pvp')return{ok:false,reason:'PVP_NOT_ACTIVE',ackSequence:sequence};
    if(action==='basic_attack'&&phase==='pressed')startBasic(player,sequence,clientTime,now);
    if(action==='ability'&&phase==='cast')startAbility(player,msg,sequence,clientTime,now);
    return{ok:true,ackSequence:sequence};
  }

  function historyAt(player,time){const h=player._pvpHistory||[];if(!h.length)return{x:player.x,y:player.y};let best=h[0],d=Math.abs(best.time-time);for(let i=1;i<h.length;i++){const n=Math.abs(h[i].time-time);if(n<d){best=h[i];d=n;}}return{x:best.x,y:best.y};}
  function killed(killer,victim,context){victim.hp=0;victim._pvpAttack=victim._pvpCast=victim._pvpDash=null;events.push({id:`e${tick}_death_${victim.id}`,type:'DEATH',actorId:victim.id,killerId:killer&&killer.id||null});if(killer&&typeof opts.onKill==='function')Promise.resolve(opts.onKill(killer,victim,context)).catch(err=>console.error('[PvP authority] kill hook',err));}
  function resolveBasic(player,a,now){
    const targets=active().filter(t=>t!==player),restore=[],targetTime=now-a.rewindMs;
    targets.forEach(t=>{restore.push({t,x:t.x,y:t.y});const h=historyAt(t,targetTime);t.x=h.x;t.y=h.y;});
    const result=shared.KeloMeleeEngine.attackSweep({attacker:player,targets,direction:a.direction,profileId:BASIC_ID,cooldownRemaining:0,attackId:a.id,startedAt:a.startedAt,source:'server-pvp',skipStart:true});
    restore.forEach(r=>{r.t.x=r.x;r.t.y=r.y;});
    (result&&result.hits||[]).forEach(hit=>{events.push({id:`e${tick}_${a.id}_${hit.targetId}`,type:'BASIC_HIT',actorId:player.id,targetId:hit.targetId,amount:hit.amount,hp:hit.hp,attackId:a.id});if(hit.killed)killed(player,actors.get(hit.targetId)||hit.target,{source:'pvp-basic',attackId:a.id,serverTime:now});});
  }
  function projectileHit(p,target,now){const owner=actors.get(p.ownerId),damage=shared.KeloDamageResolver.apply(target,p.damage);events.push({id:`e${tick}_${p.id}_hit`,type:'PROJECTILE_HIT',actorId:p.ownerId,targetId:target.id,projectileId:p.id,abilityKey:p.abilityKey,amount:damage.amount,hp:damage.hp,position:{x:p.x,y:p.y}});if(p.burn&&target.hp>0)statuses.push({type:'burn',sourceId:p.ownerId,targetId:target.id,remaining:Number(p.burn.duration)||0,magnitude:Number(p.burn.magnitude)||0,interval:Number(p.burn.tickInterval)||1,tick:Number(p.burn.tickInterval)||1});if(damage.killed)killed(owner,target,{source:'pvp-fireball',projectileId:p.id,serverTime:now});}

  function step(dt,nowMs){
    dt=Number(dt)||FIXED_DT;const now=Number(nowMs)||Date.now();tick++;
    actors.forEach(player=>{
      if(!player._pvpActive)return;
      Object.keys(player._pvpCooldowns).forEach(key=>{player._pvpCooldowns[key]=Math.max(0,(Number(player._pvpCooldowns[key])||0)-dt);});player.mana=Math.min(player.maxMana,player.mana+8*dt);
      if(player._pvpDash){const d=player._pvpDash;d.time+=dt;const k=clamp(d.time/d.duration,0,1),ease=1-Math.pow(1-k,3);player.x=d.sx+(d.tx-d.sx)*ease;player.y=d.sy+(d.ty-d.sy)*ease;if(k>=1){player.x=d.tx;player.y=d.ty;player._pvpDash=null;events.push({id:`e${tick}_dash_end_${player.id}`,type:'DASH_ENDED',actorId:player.id,position:{x:player.x,y:player.y}});}}
      else{let scale=1;if(player._pvpAttack)scale=Math.min(scale,clamp(Number(player._pvpAttack.profile.movementScale)||0,0,1));if(player._pvpCast)scale=Math.min(scale,player._pvpCast.action.movementScale);const i=player._pvpInput||{},mx=Number(i.moveX)||0,my=Number(i.moveY)||0;player.x=clamp(player.x+mx*BASE_SPEED*scale*dt,arena.x+player.radius,arena.x+arena.w-player.radius);player.y=clamp(player.y+my*BASE_SPEED*scale*dt,arena.y+player.radius,arena.y+arena.h-player.radius);player.gait=Math.hypot(mx,my)>.05?'run':'idle';}
      if(player._pvpAttack){const a=player._pvpAttack;a.time+=dt;if(a.phase==='windup'&&a.time>=a.profile.windup){a.phase='active';a.time=0;if(!a.resolved){a.resolved=true;resolveBasic(player,a,now);}}else if(a.phase==='active'&&a.time>=a.profile.active){a.phase='recovery';a.time=0;}else if(a.phase==='recovery'&&a.time>=a.profile.recovery)player._pvpAttack=null;}
      if(player._pvpCast){const c=player._pvpCast;c.time+=dt;if(c.phase==='windup'&&c.time>=c.action.windup)deliverCast(player,c,now);else if(c.phase==='active'&&c.time>=c.action.active){c.phase='recovery';c.time=0;}else if(c.phase==='recovery'&&c.time>=c.action.recovery)player._pvpCast=null;}
      const h=player._pvpHistory;h.push({time:now,x:player.x,y:player.y});while(h.length&&now-h[0].time>HISTORY_MS)h.shift();
    });
    projectiles.forEach((p,id)=>{const old={x:p.x,y:p.y};p.x+=p.vx*dt;p.y+=p.vy*dt;p.traveled+=Math.hypot(p.vx,p.vy)*dt;let best=null;active().forEach(target=>{if(target.id===p.ownerId)return;const hit=shared.KeloHitResolver.sweptCircle(old,{x:p.x,y:p.y},p.radius,target,target.radius);if(hit.hit&&(!best||hit.t<best.t))best={target,t:hit.t};});if(best){p.x=old.x+(p.x-old.x)*best.t;p.y=old.y+(p.y-old.y)*best.t;projectileHit(p,best.target,now);projectiles.delete(id);}else if(p.traveled>=p.maxDistance){events.push({id:`e${tick}_${id}_expire`,type:'PROJECTILE_EXPIRED',actorId:p.ownerId,projectileId:id,position:{x:p.x,y:p.y}});projectiles.delete(id);}});
    for(let i=statuses.length-1;i>=0;i--){const s=statuses[i],target=actors.get(s.targetId),owner=actors.get(s.sourceId);s.remaining-=dt;s.tick-=dt;if(!target||target.hp<=0){statuses.splice(i,1);continue;}while(s.tick<=0&&s.remaining>0){s.tick+=s.interval;const damage=shared.KeloDamageResolver.apply(target,s.magnitude);events.push({id:`e${tick}_burn_${s.targetId}_${i}`,type:'STATUS_TICK',status:'burn',actorId:s.sourceId,targetId:s.targetId,amount:damage.amount,hp:damage.hp});if(damage.killed){killed(owner,target,{source:'pvp-burn',serverTime:now});break;}}if(s.remaining<=0||target.hp<=0)statuses.splice(i,1);}
    return tick;
  }
  function snapshot(nowMs){const players={};actors.forEach(p=>{if(p._pvpActive||p.zone==='pvp')players[p.id]=actorPublic(p);});return{version:'pvp-server-authority-v2',serverTick:tick,serverTime:Number(nowMs)||Date.now(),fixedDt:FIXED_DT,maxRewindMs:MAX_REWIND_MS,players,projectiles:Array.from(projectiles.values()).map(p=>({id:p.id,ownerId:p.ownerId,abilityKey:p.abilityKey,x:p.x,y:p.y,radius:p.radius}))};}
  function consumeEvents(){return events.splice(0,events.length);}
  function audit(){return{version:'pvp-server-authority-v2',fixedDt:FIXED_DT,snapshotHz:SNAPSHOT_HZ,maxRewindMs:MAX_REWIND_MS,sharedHitResolver:shared.KeloHitResolver.version,sharedCombatEngine:shared.KeloCombatEngine.version,sharedMeleeEngine:shared.KeloMeleeEngine.version,players:actors.size,projectiles:projectiles.size};}
  return Object.freeze({version:'pvp-server-authority-v2',fixedDt:FIXED_DT,snapshotHz:SNAPSHOT_HZ,maxRewindMs:MAX_REWIND_MS,register,unregister,ingest,step,snapshot,consumeEvents,audit,getPlayer:id=>actors.get(String(id||''))||null});
}
module.exports={createPvpAuthority,FIXED_DT,SNAPSHOT_HZ,MAX_REWIND_MS,ARENA};
