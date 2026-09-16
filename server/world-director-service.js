/* KELO-INDEX
 * area: SERVER / WORLD DIRECTOR
 * owner: KeloWorldDirector
 * keys: ACTIVITY TELEMETRY SNAPSHOT HOURLY AI EVENT COOP BOSS ALLIANCE PRIVACY BUDGET AUTHORITY ZONE VALIDATION
 * purpose: resume actividad semantica de jugadores con memoria acotada y propone eventos cooperativos horarios
 * public-api: createWorldDirector().record/presence/buildSnapshot/generate/current/audit/shutdown
 * consumes: server-authoritative semantic signals; OpenAI Responses API opcional; storage adapter opcional
 * state-owned: activity window agregada, ultimo snapshot, evento propuesto e historial acotado
 * extension-points: aiGenerator, persistSnapshot, publishEvent, clock, archetypes
 * reuse: bosses, invasiones, caravanas, rescates y eventos de economia regional
 * legacy: none
 * do-not: NO guardar movimientos/frame, NO texto libre/chat, NO ejecutar codigo devuelto por IA, NO recompensas autoritativas desde IA, NO eventos en arena PvP
 */
'use strict';

const VERSION='kelo-world-director-v1.0.1';
const HOUR_MS=60*60*1000;
const DEFAULT_WINDOW_MS=HOUR_MS;
const DEFAULT_STALE_MS=6*HOUR_MS;
const EVENT_ARCHETYPES=Object.freeze(['WORLD_BOSS','TOWN_DEFENSE','CARAVAN_ESCORT','RESCUE','RESOURCE_CRISIS','RIFT','RECLAMATION']);
const SIGNALS=new Set(['presence','zone','combat','kill','death','gather','trade','quest','party_join','party_leave','boss_hit','boss_kill','caravan','market']);
const COUNTERS=Object.freeze(['combat','kill','death','gather','trade','quest','party_join','party_leave','boss_hit','boss_kill','caravan','market']);
const NON_WORLD_EVENT_ZONES=new Set(['pvp']);
const EMPTY_COUNTERS=()=>Object.fromEntries(COUNTERS.map(key=>[key,0]));

function clamp(value,min,max){const n=Number(value);return Number.isFinite(n)?Math.max(min,Math.min(max,n)):min;}
function text(value,max,fallback){const v=String(value==null?'':value).replace(/[\u0000-\u001f<>]/g,' ').trim().slice(0,max);return v||String(fallback||'');}
function id(value,max){return text(value,max||80,'').replace(/[^a-zA-Z0-9_:\-.]/g,'');}
function clone(value){return value==null?value:JSON.parse(JSON.stringify(value));}
function bucketHour(ms){return Math.floor(Number(ms)/HOUR_MS)*HOUR_MS;}
function zoneId(value){return id(value||'plaza',64)||'plaza';}
function stableEventId(archetype,zone,now){return `wd:${String(archetype).toLowerCase()}:${zone}:${bucketHour(now).toString(36)}`;}
function playableZones(snapshot){return Object.values(snapshot&&snapshot.zones||{}).filter(row=>row&&row.zoneId&&!NON_WORLD_EVENT_ZONES.has(String(row.zoneId))).map(row=>String(row.zoneId));}

function extractOutputText(response){
  if(response&&typeof response.output_text==='string')return response.output_text;
  const output=Array.isArray(response&&response.output)?response.output:[];
  for(const item of output){for(const part of Array.isArray(item&&item.content)?item.content:[]){if(part&&typeof part.text==='string')return part.text;}}
  return '';
}

const EVENT_SCHEMA=Object.freeze({
  type:'object',additionalProperties:false,
  properties:{
    archetype:{type:'string',enum:EVENT_ARCHETYPES},title:{type:'string'},description:{type:'string'},zoneId:{type:'string'},
    recommendedPlayers:{type:'integer',minimum:2,maximum:32},durationMinutes:{type:'integer',minimum:15,maximum:120},
    objective:{type:'string'},reason:{type:'string'},rewardTier:{type:'string',enum:['LOW','MEDIUM','HIGH','EPIC']}
  },
  required:['archetype','title','description','zoneId','recommendedPlayers','durationMinutes','objective','reason','rewardTier']
});

function createOpenAiGenerator(options={}){
  const apiKey=options.apiKey||process.env.OPENAI_API_KEY||'';
  const model=options.model||process.env.KELO_WORLD_DIRECTOR_MODEL||'gpt-5.6-luna';
  if(!apiKey)return null;
  return async function generateWithOpenAI(snapshot){
    const response=await fetch('https://api.openai.com/v1/responses',{
      method:'POST',
      headers:{'Authorization':`Bearer ${apiKey}`,'Content-Type':'application/json'},
      body:JSON.stringify({
        model,
        input:[
          {role:'system',content:'You are the Kelo World live event director. Design exactly one cooperative event grounded only in the compact world snapshot. Make players meet, cooperate, form temporary alliances, or travel together. zoneId must be a real non-PvP zone present in snapshot.zones; never invent a location. Never output code, economy amounts, player identities, admin actions, or irreversible world mutations. Prefer underused zones and avoid impossible participant counts.'},
          {role:'user',content:JSON.stringify(snapshot)}
        ],
        text:{format:{type:'json_schema',name:'kelo_world_event',strict:true,schema:EVENT_SCHEMA}}
      })
    });
    if(!response.ok)throw new Error(`OPENAI_WORLD_DIRECTOR_${response.status}`);
    const data=await response.json();
    const output=extractOutputText(data);
    if(!output)throw new Error('OPENAI_WORLD_DIRECTOR_EMPTY');
    return JSON.parse(output);
  };
}

function chooseZone(snapshot){
  const zones=Object.values(snapshot.zones||{}).filter(row=>row&&!NON_WORLD_EVENT_ZONES.has(String(row.zoneId||'')));
  if(!zones.length)return 'plaza';
  zones.sort((a,b)=>(a.activePlayers-b.activePlayers)||(b.soloPlayers-a.soloPlayers)||a.zoneId.localeCompare(b.zoneId));
  return zones[0].zoneId;
}

function fallbackProposal(snapshot){
  const totals=snapshot.totals||{},active=Math.max(0,Number(snapshot.activePlayers)||0),zone=chooseZone(snapshot);
  const soloRatio=active?Number(snapshot.soloPlayers||0)/active:1;
  const recommended=clamp(active>=10?10:Math.max(4,Math.ceil(active*.65)||4),2,16);
  if(Number(totals.death||0)>=Math.max(4,Number(totals.kill||0)*.8))return{archetype:'RESCUE',title:'La Guardia Caida',description:'Una zona castigada necesita un grupo de rescate antes de que la amenaza cierre sus caminos.',zoneId:zone,recommendedPlayers:recommended,durationMinutes:45,objective:'Reunir un escuadron, rescatar supervivientes y asegurar la zona.',reason:'La ventana reciente muestra una concentracion alta de derrotas.',rewardTier:'HIGH'};
  if(Number(totals.trade||0)+Number(totals.market||0)>=Math.max(8,active))return{archetype:'CARAVAN_ESCORT',title:'Caravana del Mercado',description:'El comercio activo ha atraido una caravana valiosa y tambien enemigos. La ruta necesita escolta colectiva.',zoneId:zone,recommendedPlayers:recommended,durationMinutes:50,objective:'Formar una escolta y llevar la caravana al destino sin perder la carga.',reason:'El comercio fue una de las actividades dominantes de la hora.',rewardTier:'HIGH'};
  if(Number(totals.gather||0)>=Math.max(12,active*2))return{archetype:'RESOURCE_CRISIS',title:'El Corazon de la Mina',description:'La extraccion intensa desperto una amenaza subterranea. Mineros y combatientes tendran que colaborar.',zoneId:zone,recommendedPlayers:recommended,durationMinutes:55,objective:'Reunir recursos de estabilizacion mientras el grupo protege a los recolectores.',reason:'La recoleccion domina la actividad reciente.',rewardTier:'HIGH'};
  if(soloRatio>=.55||active>=6)return{archetype:'WORLD_BOSS',title:'El Coloso Errante',description:'Un coloso aparecio cerca del asentamiento. Su fuerza escala para que enfrentarlo solo sea una mala idea.',zoneId:zone,recommendedPlayers:recommended,durationMinutes:60,objective:'Reunir jugadores, romper las fases del jefe y derrotarlo antes de que abandone la zona.',reason:'Hay suficiente poblacion para una actividad colectiva y demasiados jugadores estan actuando solos.',rewardTier:'EPIC'};
  return{archetype:'TOWN_DEFENSE',title:'Campanas de Alarma',description:'Criaturas se concentran en las afueras y el pueblo solicita voluntarios.',zoneId:zone,recommendedPlayers:4,durationMinutes:35,objective:'Juntarse en el pueblo y defender tres oleadas coordinadas.',reason:'Actividad baja: se usa un evento accesible para crear un punto de encuentro.',rewardTier:'MEDIUM'};
}

function normalizeProposal(raw,snapshot,now,previousEvents){
  const source=raw&&typeof raw==='object'?raw:{};
  let archetype=EVENT_ARCHETYPES.includes(source.archetype)?source.archetype:'WORLD_BOSS';
  const active=Math.max(0,Number(snapshot.activePlayers)||0),maxUseful=clamp(Math.max(4,Math.ceil(active*.85)||4),4,20);
  const recent=Array.isArray(previousEvents)?previousEvents:[];
  if(recent.slice(-2).some(event=>event.archetype===archetype)){
    const alternate=['TOWN_DEFENSE','CARAVAN_ESCORT','RESCUE','RESOURCE_CRISIS','RIFT','RECLAMATION','WORLD_BOSS'].find(type=>!recent.slice(-2).some(event=>event.archetype===type));
    if(alternate)archetype=alternate;
  }
  const allowed=new Set(playableZones(snapshot));
  const proposed=zoneId(source.zoneId||chooseZone(snapshot));
  const zone=allowed.has(proposed)?proposed:chooseZone(snapshot);
  const recommendedPlayers=Math.round(clamp(source.recommendedPlayers||4,2,maxUseful));
  const minPlayers=Math.max(2,Math.min(recommendedPlayers,Math.ceil(recommendedPlayers*.6)));
  const durationMinutes=Math.round(clamp(source.durationMinutes||45,15,120));
  const startsAt=Number(now)||Date.now(),endsAt=startsAt+durationMinutes*60*1000;
  return Object.freeze({
    id:stableEventId(archetype,zone,startsAt),schemaVersion:1,archetype,zoneId:zone,
    title:text(source.title,80,'Evento de Kelo World'),description:text(source.description,280,'Los jugadores deben colaborar para completar este evento.'),
    objective:text(source.objective,220,'Reunir un grupo y completar el objetivo cooperativo.'),reason:text(source.reason,220,'Actividad reciente del mundo.'),
    minPlayers,recommendedPlayers,durationMinutes,startsAt,endsAt,status:'PROPOSED',
    rewardPolicy:Object.freeze({tier:['LOW','MEDIUM','HIGH','EPIC'].includes(source.rewardTier)?source.rewardTier:'MEDIUM',authority:'SERVER_RESOLVED',aiMaySetAmounts:false}),
    source:'world-director',generatedFromSnapshotId:snapshot.snapshotId
  });
}

function createWorldDirector(options={}){
  const windowMs=clamp(options.windowMs||DEFAULT_WINDOW_MS,5*60*1000,6*HOUR_MS);
  const staleMs=clamp(options.staleMs||DEFAULT_STALE_MS,windowMs,48*HOUR_MS);
  const maxPlayers=Math.round(clamp(options.maxPlayers||5000,32,100000));
  const clock=typeof options.clock==='function'?options.clock:()=>Date.now();
  const aiGenerator=options.aiGenerator===false?null:(options.aiGenerator||createOpenAiGenerator(options.openai||{}));
  const persistSnapshot=typeof options.persistSnapshot==='function'?options.persistSnapshot:null;
  const publishEvent=typeof options.publishEvent==='function'?options.publishEvent:null;
  const players=new Map();
  let windowStartedAt=bucketHour(clock()),lastSnapshot=null,currentEvent=null,lastGeneratedHour=null;
  const history=[];

  function ensurePlayer(playerKey,at){
    const key=id(playerKey,96);if(!key)return null;
    let row=players.get(key);
    if(!row){
      if(players.size>=maxPlayers){let oldestKey=null,oldest=Infinity;for(const [candidateKey,candidate] of players){if(candidate.lastSeenAt<oldest){oldest=candidate.lastSeenAt;oldestKey=candidateKey;}}if(oldestKey)players.delete(oldestKey);}
      row={playerKey:key,zoneId:'plaza',lastSeenAt:at,partySize:1,counters:EMPTY_COUNTERS()};players.set(key,row);
    }
    row.lastSeenAt=at;return row;
  }

  function record(playerKey,type,payload={}){
    const signal=String(type||'');if(!SIGNALS.has(signal))return false;
    const at=Number(payload.at)||clock(),row=ensurePlayer(playerKey,at);if(!row)return false;
    if(payload.zoneId!=null)row.zoneId=zoneId(payload.zoneId);
    if(signal==='zone'&&payload.toZoneId!=null)row.zoneId=zoneId(payload.toZoneId);
    if(payload.partySize!=null)row.partySize=Math.round(clamp(payload.partySize,1,64));
    if(Object.hasOwn(row.counters,signal))row.counters[signal]+=Math.round(clamp(payload.count==null?1:payload.count,1,1000));
    return true;
  }

  function presence(iterable){
    const at=clock();let count=0;
    if(!iterable||typeof iterable[Symbol.iterator]!=='function')return count;
    for(const player of iterable){const key=player&&player.playerKey;if(!key)continue;record(key,'presence',{at,zoneId:player.zone||player.zoneId,partySize:player.partySize||1});count++;}
    return count;
  }

  function prune(at){for(const [key,row] of players)if(at-row.lastSeenAt>staleMs)players.delete(key);}

  function buildSnapshot(at=clock()){
    prune(at);const cutoff=at-windowMs,zones={},totals=EMPTY_COUNTERS();let activePlayers=0,soloPlayers=0,partyPlayers=0;
    for(const row of players.values()){
      if(row.lastSeenAt<cutoff)continue;activePlayers++;if(row.partySize>1)partyPlayers++;else soloPlayers++;
      const zone=row.zoneId||'plaza';if(!zones[zone])zones[zone]={zoneId:zone,activePlayers:0,soloPlayers:0,partyPlayers:0,totals:EMPTY_COUNTERS()};
      const target=zones[zone];target.activePlayers++;if(row.partySize>1)target.partyPlayers++;else target.soloPlayers++;
      for(const key of COUNTERS){target.totals[key]+=row.counters[key]||0;totals[key]+=row.counters[key]||0;}
    }
    const snapshotId=`world:${bucketHour(at).toString(36)}`;
    const snapshot=Object.freeze({schemaVersion:1,snapshotId,windowStartedAt,windowEndedAt:at,windowMs,activePlayers,soloPlayers,partyPlayers,zones:Object.freeze(zones),totals:Object.freeze(totals),privacy:Object.freeze({containsPlayerIds:false,containsNames:false,containsChat:false,containsRawPositions:false}),budget:Object.freeze({trackedPlayers:players.size,maxTrackedPlayers:maxPlayers})});
    lastSnapshot=snapshot;return snapshot;
  }

  function resetWindow(at){windowStartedAt=bucketHour(at);for(const row of players.values())row.counters=EMPTY_COUNTERS();}

  async function generate(at=clock(),optionsForRun={}){
    const hour=bucketHour(at);if(!optionsForRun.force&&lastGeneratedHour===hour)return{ok:true,skipped:true,reason:'ALREADY_GENERATED_THIS_HOUR',event:currentEvent,snapshot:lastSnapshot};
    const snapshot=buildSnapshot(at);let proposal=null,source='fallback',aiError=null;
    if(aiGenerator){try{proposal=await aiGenerator(clone(snapshot));source='ai';}catch(error){aiError=String(error&&error.message||error);}}
    if(!proposal)proposal=fallbackProposal(snapshot);
    const event=normalizeProposal(proposal,snapshot,at,history);
    currentEvent=event;history.push(event);while(history.length>24)history.shift();lastGeneratedHour=hour;
    if(persistSnapshot)await persistSnapshot(clone(snapshot),clone(event));
    if(publishEvent)await publishEvent(clone(event),clone(snapshot));
    resetWindow(at);
    return{ok:true,skipped:false,source,aiError,event,snapshot};
  }

  function current(){return clone(currentEvent);}
  function playerSummary(playerKey){const row=players.get(id(playerKey,96));return row?clone(row):null;}
  function audit(){return Object.freeze({version:VERSION,windowMs,staleMs,maxPlayers,trackedPlayers:players.size,aiConfigured:!!aiGenerator,lastSnapshotId:lastSnapshot&&lastSnapshot.snapshotId,currentEventId:currentEvent&&currentEvent.id,lastGeneratedHour});}
  function shutdown(){players.clear();history.length=0;}

  return Object.freeze({version:VERSION,record,presence,buildSnapshot,generate,current,playerSummary,audit,shutdown,signals:Object.freeze([...SIGNALS]),eventArchetypes:EVENT_ARCHETYPES});
}

module.exports={VERSION,EVENT_ARCHETYPES,EVENT_SCHEMA,createWorldDirector,createOpenAiGenerator,fallbackProposal,normalizeProposal};