/* KELO-INDEX
 * area: SERVER / WORLD EVENTS
 * owner: KeloWorldEventExecutor
 * keys: ENCOUNTER LIFECYCLE COOP POPULATION GATE BOSS SEALS VULNERABLE CONFIRMED DAMAGE OBJECTIVE REWARD AUTHORITY
 * purpose: materializa contratos del Live World Director en encuentros server-authoritative sin resolver hits, economía ni render
 * public-api: createWorldEventExecutor().materialize/join/leave/activateSeal/confirmDamage/confirmObjective/sweep/snapshot/current/audit
 * consumes: world-event-archetypes + daño/objetivos ya confirmados por owners gameplay/economy existentes
 * state-owned: lifecycle del encuentro, participantes, boss actor state, progreso y contribuciones
 * online: server-only truth; cliente solo solicita join/leave y renderiza snapshots; daño/progreso valioso entra por confirmaciones internas
 * do-not: NO confiar damage/progress del cliente, NO calcular hit geometry, NO inventar drops/oro/KC, NO timer por evento/jugador
 */
'use strict';
const {getWorldEventArchetype}=require('./world-event-archetypes');

const STATUS=Object.freeze({RECRUITING:'RECRUITING',ACTIVE:'ACTIVE',COMPLETED:'COMPLETED',FAILED:'FAILED',EXPIRED:'EXPIRED'});
const TERMINAL=new Set([STATUS.COMPLETED,STATUS.FAILED,STATUS.EXPIRED]);
const TRUSTED_SOURCES=new Set(['server-combat','server-gameplay','server-economy']);

function clamp(n,a,b){n=Number(n);return Number.isFinite(n)?Math.max(a,Math.min(b,n)):a;}
function safeId(v,max=96){return String(v==null?'':v).replace(/[^a-zA-Z0-9_:\-.]/g,'').slice(0,max);}
function clone(v){return v==null?v:JSON.parse(JSON.stringify(v));}
function nowOf(clock){return Number(clock())||Date.now();}

function createWorldEventExecutor(options={}){
  const clock=typeof options.clock==='function'?options.clock:()=>Date.now();
  const publish=typeof options.publish==='function'?options.publish:()=>{};
  const resolveRewards=typeof options.resolveRewards==='function'?options.resolveRewards:null;
  const maxActive=Math.max(1,Math.min(32,Number(options.maxActive)||8));
  const encounters=new Map();
  let currentId=null;

  function publicParticipant(p){return{joinedAt:p.joinedAt,lastSeenAt:p.lastSeenAt,damage:p.damage,objective:p.objective,seals:p.seals};}
  function publicEncounter(e){
    if(!e)return null;
    const out={id:e.id,eventId:e.eventId,archetype:e.archetype,zoneId:e.zoneId,title:e.title,status:e.status,phase:e.phase,minPlayers:e.minPlayers,recommendedPlayers:e.recommendedPlayers,participantCount:e.participants.size,startsAt:e.startsAt,endsAt:e.endsAt,revision:e.revision,lockedByPopulation:e.participants.size<e.minPlayers,objective:{kind:e.objective.kind,current:e.objective.current,target:e.objective.target,distinctContributors:e.objective.contributors.size},rewardPolicy:clone(e.rewardPolicy)};
    if(e.boss)out.boss={id:e.boss.id,hp:e.boss.hp,maxHp:e.boss.maxHp,vulnerable:e.phase==='VULNERABLE',vulnerableUntil:e.vulnerableUntil||null,sealsActivated:e.sealClaims.size,sealsRequired:e.definition.boss.sealsRequired};
    return out;
  }
  function emit(type,e,extra){
    const payload=Object.assign({type,eventId:e.eventId,encounterId:e.id,serverTime:nowOf(clock),snapshot:publicEncounter(e)},extra||{});
    try{publish(type,payload);}catch(error){console.error('[KeloWorldEventExecutor publish]',error);}
    return payload;
  }
  function assertEncounter(id){const e=encounters.get(String(id||currentId||''));if(!e)throw new Error('WORLD_EVENT_NOT_FOUND');return e;}
  function assertMutable(e){if(TERMINAL.has(e.status))throw new Error('WORLD_EVENT_TERMINAL');sweepOne(e,nowOf(clock));if(TERMINAL.has(e.status))throw new Error('WORLD_EVENT_TERMINAL');}
  function trustedProof(proof,expected){const p=proof&&typeof proof==='object'?proof:{};const source=String(p.source||'');return p.serverConfirmed===true&&TRUSTED_SOURCES.has(source)&&(!expected||source===expected);}
  function participantKey(v){return safeId(v&&typeof v==='object'?(v.playerKey||v.id):v,96);}
  function participant(e,key){const p=e.participants.get(key);if(!p)throw new Error('WORLD_EVENT_NOT_JOINED');return p;}
  function clearBossGate(e){if(!e.boss)return false;const changed=e.sealClaims.size>0||e.sealStartedAt!=null||e.vulnerableUntil!=null;e.sealClaims.clear();e.sealStartedAt=null;e.vulnerableUntil=null;return changed;}
  function updatePopulationPhase(e){
    if(TERMINAL.has(e.status))return;
    if(e.participants.size<e.minPlayers){
      const gateChanged=clearBossGate(e),stateChanged=e.status!==STATUS.RECRUITING||e.phase!=='WAITING_FOR_ALLIES';
      e.status=STATUS.RECRUITING;e.phase='WAITING_FOR_ALLIES';
      if(gateChanged||stateChanged){e.revision++;emit('world-event:stalled',e,{reason:'NEED_MORE_PLAYERS'});}return;
    }
    if(e.status===STATUS.RECRUITING){e.status=STATUS.ACTIVE;e.phase=e.archetype==='WORLD_BOSS'?'SEALS':e.definition.startPhase;e.revision++;emit('world-event:activated',e);}
  }
  function materialize(event){
    const raw=event&&typeof event==='object'?event:{};
    const eventId=safeId(raw.id,120);if(!eventId)throw new Error('WORLD_EVENT_ID_REQUIRED');
    if(encounters.has(eventId))return publicEncounter(encounters.get(eventId));
    if([...encounters.values()].filter(e=>!TERMINAL.has(e.status)).length>=maxActive)throw new Error('WORLD_EVENT_ACTIVE_LIMIT');
    const definition=getWorldEventArchetype(raw.archetype);if(!definition)throw new Error('WORLD_EVENT_ARCHETYPE_UNSUPPORTED');
    const startsAt=Number(raw.startsAt)||nowOf(clock),endsAt=Math.max(startsAt+60000,Number(raw.endsAt)||startsAt+45*60000),recommendedPlayers=Math.round(clamp(raw.recommendedPlayers||4,2,32)),minPlayers=Math.round(clamp(raw.minPlayers||Math.ceil(recommendedPlayers*.6),2,recommendedPlayers));
    const e={id:eventId,eventId,archetype:definition.id,definition,zoneId:safeId(raw.zoneId||'plaza',64)||'plaza',title:String(raw.title||definition.id).slice(0,100),status:STATUS.RECRUITING,phase:'WAITING_FOR_ALLIES',minPlayers,recommendedPlayers,startsAt,endsAt,rewardPolicy:clone(raw.rewardPolicy||{authority:'SERVER_RESOLVED'}),participants:new Map(),objective:{kind:definition.objective.kind,current:0,target:definition.objective.target,contributors:new Set()},boss:null,sealClaims:new Map(),sealStartedAt:null,vulnerableUntil:null,revision:1,createdAt:nowOf(clock),completedAt:null,completionReason:null,rewardResolution:null};
    if(definition.boss){const maxHp=Math.round(clamp(definition.boss.baseHp+definition.boss.hpPerRecommendedPlayer*recommendedPlayers,definition.boss.baseHp,definition.boss.maxHp));e.boss={id:`boss:${eventId}`,eventId,hp:maxHp,maxHp};}
    encounters.set(eventId,e);currentId=eventId;emit('world-event:materialized',e);return publicEncounter(e);
  }
  function join(eventId,player,context={}){
    const e=assertEncounter(eventId);assertMutable(e);const key=participantKey(player);if(!key)throw new Error('WORLD_EVENT_PLAYER_REQUIRED');
    const zone=safeId(context.zoneId||player&&player.zone||'',64);if(zone&&zone!==e.zoneId)throw new Error('WORLD_EVENT_WRONG_ZONE');
    let p=e.participants.get(key);if(!p){p={key,joinedAt:nowOf(clock),lastSeenAt:nowOf(clock),damage:0,objective:0,seals:0};e.participants.set(key,p);e.revision++;emit('world-event:joined',e);}else p.lastSeenAt=nowOf(clock);
    updatePopulationPhase(e);return publicEncounter(e);
  }
  function leave(eventId,playerKey){const e=assertEncounter(eventId);const key=participantKey(playerKey);if(!key)return publicEncounter(e);if(e.participants.delete(key)){for(const [seal,owner] of e.sealClaims)if(owner===key)e.sealClaims.delete(seal);e.revision++;emit('world-event:left',e);updatePopulationPhase(e);}return publicEncounter(e);}
  function activateSeal(eventId,playerKey,sealId){
    const e=assertEncounter(eventId);assertMutable(e);if(e.archetype!=='WORLD_BOSS')throw new Error('WORLD_EVENT_NOT_BOSS');updatePopulationPhase(e);if(e.status!==STATUS.ACTIVE)throw new Error('WORLD_EVENT_NEED_MORE_PLAYERS');if(e.phase!=='SEALS')throw new Error('WORLD_EVENT_SEALS_CLOSED');
    const key=participantKey(playerKey),p=participant(e,key),seal=safeId(sealId,32);if(!seal)throw new Error('WORLD_EVENT_SEAL_REQUIRED');
    if([...e.sealClaims.values()].includes(key))throw new Error('WORLD_EVENT_ONE_SEAL_PER_PLAYER');
    if(!e.sealStartedAt)e.sealStartedAt=nowOf(clock);if(nowOf(clock)-e.sealStartedAt>e.definition.boss.sealWindowMs){e.sealClaims.clear();e.sealStartedAt=nowOf(clock);}
    e.sealClaims.set(seal,key);p.seals++;p.lastSeenAt=nowOf(clock);e.revision++;emit('world-event:progress',e,{kind:'seal',sealId:seal});
    if(e.sealClaims.size>=e.definition.boss.sealsRequired){e.phase='VULNERABLE';e.vulnerableUntil=nowOf(clock)+e.definition.boss.vulnerableMs;e.revision++;emit('world-event:phase',e,{phase:'VULNERABLE'});}return publicEncounter(e);
  }
  async function complete(e,reason){if(TERMINAL.has(e.status))return publicEncounter(e);e.status=STATUS.COMPLETED;e.phase='COMPLETED';e.completedAt=nowOf(clock);e.completionReason=String(reason||'OBJECTIVE_COMPLETE');e.objective.current=e.objective.target;e.revision++;if(resolveRewards){e.rewardResolution=await resolveRewards({eventId:e.eventId,archetype:e.archetype,rewardPolicy:clone(e.rewardPolicy),participants:[...e.participants.entries()].map(([playerKey,p])=>({playerKey,contribution:publicParticipant(p)}))});}emit('world-event:completed',e,{reason:e.completionReason});return publicEncounter(e);}
  async function confirmDamage(eventId,playerKey,amount,proof){
    const e=assertEncounter(eventId);assertMutable(e);if(e.archetype!=='WORLD_BOSS'||!e.boss)throw new Error('WORLD_EVENT_NOT_BOSS');if(!trustedProof(proof,'server-combat'))throw new Error('WORLD_EVENT_UNTRUSTED_DAMAGE');updatePopulationPhase(e);if(e.status!==STATUS.ACTIVE)throw new Error('WORLD_EVENT_NEED_MORE_PLAYERS');if(e.phase!=='VULNERABLE'||nowOf(clock)>Number(e.vulnerableUntil||0)){resetBossSeals(e,'VULNERABILITY_CLOSED');throw new Error('WORLD_EVENT_BOSS_INVULNERABLE');}
    const key=participantKey(playerKey),p=participant(e,key),value=clamp(amount,0,1000000);if(value<=0)return publicEncounter(e);const applied=Math.min(value,e.boss.hp);e.boss.hp=Math.max(0,e.boss.hp-applied);p.damage+=applied;p.lastSeenAt=nowOf(clock);e.objective.contributors.add(key);e.revision++;emit('world-event:progress',e,{kind:'boss_damage',amount:applied,bossHp:e.boss.hp});if(e.boss.hp<=0)return complete(e,'BOSS_DEFEATED');return publicEncounter(e);
  }
  async function confirmObjective(eventId,playerKey,kind,amount,proof){
    const e=assertEncounter(eventId);assertMutable(e);if(e.archetype==='WORLD_BOSS')throw new Error('WORLD_EVENT_USE_CONFIRMED_DAMAGE');const expected=e.definition.objective.confirmSource;if(!trustedProof(proof,expected))throw new Error('WORLD_EVENT_UNTRUSTED_PROGRESS');updatePopulationPhase(e);if(e.status!==STATUS.ACTIVE)throw new Error('WORLD_EVENT_NEED_MORE_PLAYERS');if(String(kind)!==e.objective.kind)throw new Error('WORLD_EVENT_OBJECTIVE_KIND');
    const key=participantKey(playerKey),p=participant(e,key),value=clamp(amount==null?1:amount,0,1000000);if(value<=0)return publicEncounter(e);e.objective.current=Math.min(e.objective.target,e.objective.current+value);e.objective.contributors.add(key);p.objective+=value;p.lastSeenAt=nowOf(clock);e.revision++;emit('world-event:progress',e,{kind:e.objective.kind,amount:value});
    const enoughContributors=!e.definition.cooperation.distinctContributors||e.objective.contributors.size>=Math.min(e.minPlayers,e.participants.size);if(e.objective.current>=e.objective.target&&enoughContributors)return complete(e,'OBJECTIVE_COMPLETE');return publicEncounter(e);
  }
  function resetBossSeals(e,reason){if(!e.boss||TERMINAL.has(e.status))return;clearBossGate(e);e.phase=e.participants.size>=e.minPlayers?'SEALS':'WAITING_FOR_ALLIES';e.revision++;emit('world-event:phase',e,{phase:e.phase,reason});}
  function sweepOne(e,at){
    if(TERMINAL.has(e.status))return;
    if(at>=e.endsAt){e.status=STATUS.EXPIRED;e.phase='EXPIRED';e.revision++;emit('world-event:failed',e,{reason:'TIME_EXPIRED'});return;}
    if(e.archetype==='WORLD_BOSS'&&e.phase==='VULNERABLE'&&at>Number(e.vulnerableUntil||0)&&e.boss&&e.boss.hp>0)resetBossSeals(e,'VULNERABILITY_TIMEOUT');
  }
  function sweep(at=nowOf(clock)){for(const e of encounters.values())sweepOne(e,Number(at)||nowOf(clock));return[...encounters.values()].map(publicEncounter);}
  function snapshot(id){const e=assertEncounter(id);sweepOne(e,nowOf(clock));return publicEncounter(e);}
  function current(){return currentId?publicEncounter(encounters.get(currentId)):null;}
  function audit(){let active=0,participants=0;for(const e of encounters.values()){if(!TERMINAL.has(e.status))active++;participants+=e.participants.size;}return Object.freeze({version:'kelo-world-event-executor-v1.0.1',encounters:encounters.size,active,participants,maxActive,serverAuthoritative:true,clientDamageAccepted:false,clientRewardAmountsAccepted:false,combatOwner:'KeloCombatEngine/server combat authority'});}

  return Object.freeze({version:'kelo-world-event-executor-v1.0.1',STATUS,materialize,join,leave,activateSeal,confirmDamage,confirmObjective,sweep,snapshot,current,audit});
}

module.exports={STATUS,createWorldEventExecutor};
