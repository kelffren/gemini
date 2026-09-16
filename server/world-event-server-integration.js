/* KELO-INDEX
 * area: SERVER / WORLD EVENTS / NETWORK INTEGRATION
 * owner: Kelo server authority + KeloWorldDirectorServerBridge
 * keys: CLIENT INTENT JOIN LEAVE SEAL SERVER CONFIRMED DAMAGE OBJECTIVE LATE JOIN RATE LIMIT OVERLAP
 * purpose: integra Director/Executor con el servidor existente sin abrir transporte paralelo ni exponer progreso valioso al cliente
 * public-api: createWorldEventServerIntegration().start/stop/onHello/onZone/onDisconnect/onKill/onMarket/handleClientMessage/confirmDamageFromServer/confirmObjectiveFromServer/sweep/status/current
 * consumes: players Map, send(), KeloWorldDirectorServerBridge
 * state-owned: solo rate-limit efimero por conexión; lifecycle vive en KeloWorldEventExecutor
 * online: cliente puede pedir estado/join/leave/seal; daño, objetivos y rewards solo por hooks internos del server
 * do-not: NO aceptar amount/damage/objective completion del cliente, NO segundo socket, NO pose telemetry
 */
'use strict';
const {createWorldDirectorServerBridge}=require('./world-director-server-bridge');

const CLIENT_TYPES=new Set(['world:event:get','world:event:join','world:event:leave','world:event:seal']);
const SEALS=new Set(['north','east','west']);

function createWorldEventServerIntegration(options={}){
  const players=options.players,send=options.send;
  if(!(players instanceof Map))throw new Error('WORLD_EVENT_PLAYERS_MAP_REQUIRED');
  if(typeof send!=='function')throw new Error('WORLD_EVENT_SEND_REQUIRED');
  const bridge=options.bridge||createWorldDirectorServerBridge({
    players,send,
    aiGenerator:options.aiGenerator,
    openai:options.openai,
    maxPlayers:options.maxTrackedPlayers,
    maxActiveEvents:options.maxActiveEvents,
    snapshotDir:options.snapshotDir,
    resolveRewards:options.resolveRewards
  });

  function result(ws,requestId,op,snapshot,encounters){send(ws,{t:'world:event:result',requestId:requestId||null,op,encounter:snapshot,encounters:Array.isArray(encounters)?encounters:undefined,serverTime:Date.now(),source:'server-authoritative-world-event-executor'});}
  function sendCurrent(me){const current=bridge.current();if(current&&current.event)send(me.ws,{t:'world:event',event:current.event,encounter:current.encounter||null,encounters:current.encounters||[],serverTime:Date.now(),source:'server-authoritative-world-director'});return current;}
  function rateLimit(me){const now=Date.now(),last=Number(me&&me._worldEventIntentAt||0);if(now-last<150)throw new Error('WORLD_EVENT_RATE_LIMIT');me._worldEventIntentAt=now;}
  function onHello(me){bridge.onHello(me);return sendCurrent(me);}
  function onZone(me,previousZone){return bridge.onZone(me,previousZone);}
  function onDisconnect(me){return bridge.onDisconnect(me);}
  function onKill(killer,victim){return bridge.onKill(killer,victim);}
  function onMarket(me,count=1){return bridge.onMarket(me,count);}

  async function handleClientMessage(me,msg){
    const type=String(msg&&msg.t||'');if(!CLIENT_TYPES.has(type))return false;
    rateLimit(me);
    if(type==='world:event:get'){const current=sendCurrent(me);result(me.ws,msg.requestId,type,current&&current.encounter||null,current&&current.encounters||[]);return true;}
    if(type==='world:event:join'){const snapshot=bridge.joinEvent(me,msg.eventId);result(me.ws,msg.requestId,type,snapshot);return true;}
    if(type==='world:event:leave'){const snapshot=bridge.leaveEvent(me,msg.eventId);result(me.ws,msg.requestId,type,snapshot);return true;}
    const seal=String(msg.sealId||'').toLowerCase();if(!SEALS.has(seal))throw new Error('WORLD_EVENT_INVALID_SEAL');
    const snapshot=bridge.activateSeal(me,msg.eventId,seal);result(me.ws,msg.requestId,type,snapshot);return true;
  }

  function resolvePlayer(ref){
    if(ref&&typeof ref==='object'&&ref.playerKey)return ref;
    const raw=String(ref==null?'':ref);if(!raw)return null;
    if(players.has(raw))return players.get(raw);
    for(const player of players.values())if(String(player.playerKey||'')===raw)return player;
    return null;
  }
  function confirmDamageFromServer(eventId,playerRef,amount,meta={}){
    const me=resolvePlayer(playerRef);if(!me)throw new Error('WORLD_EVENT_PLAYER_NOT_CONNECTED');
    return bridge.confirmDamage(eventId,me,amount,{source:'server-combat',serverConfirmed:true,attackId:String(meta.attackId||'').slice(0,96)});
  }
  function confirmObjectiveFromServer(eventId,playerRef,kind,amount,source='server-gameplay'){
    if(!['server-gameplay','server-economy'].includes(String(source)))throw new Error('WORLD_EVENT_OBJECTIVE_SOURCE');
    const me=resolvePlayer(playerRef);if(!me)throw new Error('WORLD_EVENT_PLAYER_NOT_CONNECTED');
    return bridge.confirmObjective(eventId,me,kind,amount,{source:String(source),serverConfirmed:true});
  }
  function sweep(at){return bridge.executor.sweep(at);}
  function start(){return bridge.start();}
  function stop(){return bridge.stop();}
  function status(){return bridge.status();}
  function current(){return bridge.current();}

  return Object.freeze({version:'kelo-world-event-server-integration-v1.1.0',clientTypes:Object.freeze([...CLIENT_TYPES]),start,stop,onHello,onZone,onDisconnect,onKill,onMarket,handleClientMessage,confirmDamageFromServer,confirmObjectiveFromServer,sweep,status,current,bridge});
}

module.exports={createWorldEventServerIntegration};