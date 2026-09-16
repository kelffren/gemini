/* KELO-INDEX
 * area: SERVER / WORLD EVENTS / TEST
 * owner: Kelo world event network integration verification
 * keys: CLIENT INTENT SERVER DAMAGE JOIN LEAVE SEAL RATE LIMIT LATE JOIN OVERLAP DISCONNECT
 * purpose: verifica la frontera de red: cliente solo get/join/leave/seal y progreso valioso entra por hooks internos
 * online: smoke puro con sockets simulados sobre el mismo adapter usado por server/index.js
 */
'use strict';
const assert=require('assert');
const fs=require('fs');
const os=require('os');
const path=require('path');
const {createWorldEventServerIntegration}=require('./world-event-server-integration');

(async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'kelo-world-event-network-'));
  const sent=[];
  const players=new Map();
  for(let i=1;i<=6;i++){
    const ws={id:`ws${i}`,readyState:1};
    players.set(`c${i}`,{id:`c${i}`,playerKey:`p${i}`,zone:'plaza',partySize:1,ws,_worldEventIntentAt:0});
  }
  const integration=createWorldEventServerIntegration({players,send:(ws,payload)=>sent.push({ws:ws.id,payload}),snapshotDir:dir,aiGenerator:false});
  players.forEach(player=>integration.onHello(player));
  const generated=await integration.bridge.runtime.runNow({force:true});
  assert.strictEqual(generated.event.archetype,'WORLD_BOSS');
  assert.strictEqual(generated.event.zoneId,'plaza');
  const eventId=generated.event.id;

  async function client(player,type,extra={}){player._worldEventIntentAt=0;return integration.handleClientMessage(player,{t:type,requestId:`r-${type}`,...extra});}
  for(let i=1;i<=3;i++)await client(players.get(`c${i}`),'world:event:join',{eventId});
  let current=integration.current().encounter;
  assert.strictEqual(current.status,'ACTIVE');
  assert.strictEqual(current.phase,'SEALS');

  await assert.rejects(()=>client(players.get('c1'),'world:event:seal',{eventId,sealId:'fake'}),/WORLD_EVENT_INVALID_SEAL/);
  await client(players.get('c1'),'world:event:seal',{eventId,sealId:'north'});
  await client(players.get('c2'),'world:event:seal',{eventId,sealId:'east'});
  await client(players.get('c3'),'world:event:seal',{eventId,sealId:'west'});
  current=integration.current().encounter;
  assert.strictEqual(current.phase,'VULNERABLE');

  const clientDamageHandled=await integration.handleClientMessage(players.get('c1'),{t:'world:event:damage',eventId,amount:999999});
  assert.strictEqual(clientDamageHandled,false,'damage must have no client opcode');
  const killed=await integration.confirmDamageFromServer(eventId,'c1',current.boss.hp+1,{attackId:'srv-attack-1'});
  assert.strictEqual(killed.status,'COMPLETED');

  const now=Date.now();
  const overlapA=integration.bridge.executor.materialize({id:'wd:rescue:plaza:overlap-a',archetype:'RESCUE',zoneId:'plaza',title:'Rescate A',minPlayers:2,recommendedPlayers:4,startsAt:now,endsAt:now+600000,rewardPolicy:{authority:'SERVER_RESOLVED'}});
  const overlapB=integration.bridge.executor.materialize({id:'wd:rift:plaza:overlap-b',archetype:'RIFT',zoneId:'plaza',title:'Rift B',minPlayers:2,recommendedPlayers:4,startsAt:now,endsAt:now+600000,rewardPolicy:{authority:'SERVER_RESOLVED'}});
  integration.bridge.executor.join(overlapA.eventId,{playerKey:'p2',zone:'plaza'},{zoneId:'plaza'});
  integration.bridge.executor.join(overlapB.eventId,{playerKey:'p2',zone:'plaza'},{zoneId:'plaza'});
  integration.onDisconnect(players.get('c2'));
  assert.strictEqual(integration.bridge.executor.snapshot(overlapA.eventId).participantCount,0);
  assert.strictEqual(integration.bridge.executor.snapshot(overlapB.eventId).participantCount,0);
  assert.ok(integration.current().encounters.length>=2,'late join state should expose overlapping active encounters');

  assert.ok(integration.clientTypes.includes('world:event:seal'));
  assert.ok(!integration.clientTypes.includes('world:event:damage'));
  assert.ok(!integration.clientTypes.includes('world:event:objective'));
  assert.ok(sent.some(row=>row.payload.t==='world-event:state'&&row.payload.eventType==='world-event:completed'));
  assert.strictEqual(JSON.stringify(integration.current().encounter).includes('p1'),false,'public encounter must not leak participant ids');
  integration.stop();
  console.log('✅ World event network integration: safe intents + internal-only damage + overlap disconnect');
})().catch(error=>{console.error('❌ World event network integration smoke failed:',error);process.exitCode=1;});