/* KELO-INDEX
 * area: SERVER / WORLD DIRECTOR
 * owner: KeloWorldDirectorServerBridge
 * keys: AUTHORITY WEBSOCKET WORLD EVENT NOTIFICATION PRESENCE COMBAT MARKET KILL EXECUTOR ENCOUNTER ZONE DISCONNECT OVERLAP
 * purpose: conecta señales semánticas del servidor al Director y materializa cada contrato mediante KeloWorldEventExecutor
 * public-api: createWorldDirectorServerBridge().start/stop/onHello/onZone/onDisconnect/onCombat/onMarket/onKill/onDeath/joinEvent/leaveEvent/activateSeal/confirmDamage/confirmObjective/status/current
 * consumes: world-director-runtime, world-event-executor, players Map y send() del owner server existente
 * state-owned: ninguno adicional; Director posee agregados y Executor posee lifecycle del encuentro
 * online: server-authoritative; clientes solo solicitan presencia/join y renderizan world:event + world-event:state
 * do-not: NO segundo WebSocketServer, NO segundo HTTP server, NO movimiento/frame telemetry, NO aceptar damage/progress del cliente
 */
'use strict';
const {createWorldDirectorRuntime}=require('./world-director-runtime');
const {createWorldEventExecutor}=require('./world-event-executor');

function typeForEvent(archetype){
  if(archetype==='WORLD_BOSS')return'boss';
  if(archetype==='CARAVAN_ESCORT')return'route';
  if(archetype==='TOWN_DEFENSE'||archetype==='RECLAMATION')return'invasion';
  return'system';
}

function createWorldDirectorServerBridge(options={}){
  const players=options.players;
  const send=options.send;
  if(!(players instanceof Map))throw new Error('WORLD_DIRECTOR_PLAYERS_MAP_REQUIRED');
  if(typeof send!=='function')throw new Error('WORLD_DIRECTOR_SEND_REQUIRED');

  function broadcast(message){let delivered=0;players.forEach(viewer=>{if(!viewer||!viewer.ws)return;send(viewer.ws,message);delivered++;});return delivered;}
  const executor=options.executor||createWorldEventExecutor({
    maxActive:options.maxActiveEvents,
    resolveRewards:options.resolveRewards,
    publish:(type,payload)=>broadcast({t:'world-event:state',eventType:type,...payload,source:'server-authoritative-world-event-executor'})
  });

  const runtime=createWorldDirectorRuntime({
    aiGenerator:options.aiGenerator,
    openai:options.openai,
    maxPlayers:options.maxPlayers,
    snapshotDir:options.snapshotDir,
    beforeGenerate:director=>director.presence(players.values()),
    publishEvent:(event,snapshot)=>{
      const encounter=executor.materialize(event);
      const notification={
        id:event.id,type:typeForEvent(event.archetype),icon:'',category:'WORLD EVENT',title:event.title,
        message:`${event.description} ${event.objective}`.slice(0,600),priority:'world',target:{scope:'all',id:null},action:null,
        createdAt:event.startsAt,expiresAt:event.endsAt,source:'world-director-server',read:false,channel:'in_game',
        meta:{archetype:event.archetype,zoneId:event.zoneId,recommendedPlayers:event.recommendedPlayers}
      };
      const delivered=broadcast({t:'world:event',event,encounter,serverTime:Date.now(),source:'server-authoritative-world-director'});
      broadcast({t:'commerce:event',kind:'world-notification',notification,source:'server-authoritative-world-director'});
      return{delivered,snapshotId:snapshot.snapshotId,eventId:event.id,encounterId:encounter.id};
    }
  });

  function playerKey(me){return me&&me.playerKey?String(me.playerKey):null;}
  function activeEncounters(){return executor.sweep().filter(e=>e&&['RECRUITING','ACTIVE'].includes(e.status));}
  function activeEncounter(){const e=executor.current();return e&&['RECRUITING','ACTIVE'].includes(e.status)?e:null;}
  function leaveMatching(me,predicate){
    const key=playerKey(me);if(!key)return 0;let left=0;
    for(const encounter of activeEncounters()){
      if(predicate&&!predicate(encounter))continue;
      try{executor.leave(encounter.eventId,key);left++;}catch(_){ }
    }
    return left;
  }
  function onHello(me){const key=playerKey(me);return key?runtime.record(key,'presence',{zoneId:me.zone||'plaza',partySize:me.partySize||1}):false;}
  function onZone(me,previousZone){
    const key=playerKey(me);if(!key||String(previousZone||'')===String(me.zone||''))return false;
    leaveMatching(me,encounter=>String(previousZone||'')===encounter.zoneId&&String(me.zone||'')!==encounter.zoneId);
    return runtime.record(key,'zone',{zoneId:me.zone||'plaza',toZoneId:me.zone||'plaza',partySize:me.partySize||1});
  }
  function onDisconnect(me){leaveMatching(me);return true;}
  function onCombat(me,count){const key=playerKey(me);return key?runtime.record(key,'combat',{zoneId:me.zone||'plaza',count:count||1,partySize:me.partySize||1}):false;}
  function onMarket(me,count){const key=playerKey(me);return key?runtime.record(key,'market',{zoneId:me.zone||'plaza',count:count||1,partySize:me.partySize||1}):false;}
  function onKill(killer,victim){const killerKey=playerKey(killer),victimKey=playerKey(victim);if(killerKey)runtime.record(killerKey,'kill',{zoneId:killer.zone||'plaza'});if(victimKey)runtime.record(victimKey,'death',{zoneId:victim.zone||'plaza'});return!!(killerKey||victimKey);}
  function onDeath(me){const key=playerKey(me);return key?runtime.record(key,'death',{zoneId:me.zone||'plaza'}):false;}
  function joinEvent(me,eventId){const key=playerKey(me);if(!key)throw new Error('WORLD_EVENT_PLAYER_REQUIRED');return executor.join(eventId||executor.current()?.eventId,{playerKey:key,zone:me.zone},{zoneId:me.zone});}
  function leaveEvent(me,eventId){const key=playerKey(me);if(!key)return executor.current();return executor.leave(eventId||executor.current()?.eventId,key);}
  function activateSeal(me,eventId,sealId){
    const key=playerKey(me);if(!key)throw new Error('WORLD_EVENT_PLAYER_REQUIRED');const targetId=eventId||executor.current()?.eventId;const encounter=executor.snapshot(targetId);if(String(me.zone||'')!==encounter.zoneId)throw new Error('WORLD_EVENT_WRONG_ZONE');return executor.activateSeal(targetId,key,sealId);
  }
  function confirmDamage(eventId,me,amount,proof){const key=playerKey(me)||String(me||'');return executor.confirmDamage(eventId||executor.current()?.eventId,key,amount,proof);}
  function confirmObjective(eventId,me,kind,amount,proof){const key=playerKey(me)||String(me||'');return executor.confirmObjective(eventId||executor.current()?.eventId,key,kind,amount,proof);}
  function start(){return runtime.start();}
  function stop(){return runtime.stop();}
  function status(){return{director:runtime.status(),executor:executor.audit()};}
  function current(){return{event:runtime.current(),encounter:executor.current(),encounters:activeEncounters()};}

  return Object.freeze({version:'kelo-world-director-server-bridge-v1.2.0',start,stop,onHello,onZone,onDisconnect,onCombat,onMarket,onKill,onDeath,joinEvent,leaveEvent,activateSeal,confirmDamage,confirmObjective,status,current,runtime,executor});
}

module.exports={createWorldDirectorServerBridge};