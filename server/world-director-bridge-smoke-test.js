/* KELO-INDEX
 * area: TEST / WORLD DIRECTOR
 * keys: WORLD DIRECTOR BRIDGE SOCKET NOTIFICATION EVENT EXECUTOR AUTHORITY ZONE DISCONNECT
 * hace: valida publicación/materialización y salida automática del encounter al abandonar su zona
 * online: smoke server-side con socket simulado
 */
'use strict';
const assert=require('assert');
const fs=require('fs');
const os=require('os');
const path=require('path');
const {createWorldDirectorServerBridge}=require('./world-director-server-bridge');

(async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'kelo-world-director-bridge-'));
  const sent=[];
  const wsA={id:'a'},wsB={id:'b'};
  const players=new Map([
    ['a',{playerKey:'alpha',zone:'plaza',partySize:1,ws:wsA}],
    ['b',{playerKey:'beta',zone:'market',partySize:1,ws:wsB}]
  ]);
  const bridge=createWorldDirectorServerBridge({players,send:(ws,payload)=>sent.push({ws:ws.id,payload}),snapshotDir:dir,aiGenerator:false});
  players.forEach(player=>bridge.onHello(player));
  bridge.onCombat(players.get('a'),3);
  bridge.onMarket(players.get('b'),5);
  const result=await bridge.runtime.runNow({force:true});
  assert.equal(result.ok,true);
  const worldMessages=sent.filter(row=>row.payload.t==='world:event');
  assert.equal(worldMessages.length,2);
  assert.ok(worldMessages.every(row=>row.payload.encounter&&row.payload.encounter.id===result.event.id));
  assert.equal(sent.filter(row=>row.payload.t==='commerce:event'&&row.payload.kind==='world-notification').length,2);
  assert.ok(sent.some(row=>row.payload.t==='world-event:state'&&row.payload.eventType==='world-event:materialized'));
  assert.equal(bridge.current().encounter.eventId,result.event.id);
  assert.equal(bridge.status().executor.serverAuthoritative,true);

  const beta=players.get('b'),encounter=bridge.current().encounter;
  beta.zone=encounter.zoneId;
  bridge.joinEvent(beta,encounter.eventId);
  assert.equal(bridge.current().encounter.participantCount,1);
  const previousZone=beta.zone;
  beta.zone=previousZone==='plaza'?'market':'plaza';
  bridge.onZone(beta,previousZone);
  assert.equal(bridge.current().encounter.participantCount,0,'leaving encounter zone must evict participant');

  beta.zone=encounter.zoneId;
  bridge.joinEvent(beta,encounter.eventId);
  assert.equal(bridge.current().encounter.participantCount,1);
  bridge.onDisconnect(beta);
  assert.equal(bridge.current().encounter.participantCount,0,'disconnect must evict participant');

  assert.equal(JSON.stringify(result.snapshot).includes('alpha'),false);
  assert.equal(JSON.stringify(result.snapshot).includes('beta'),false);
  assert.equal(fs.existsSync(path.join(dir,'latest-world-director.json')),true);
  console.log('world-director bridge + executor materialization + zone/disconnect eviction smoke PASS');
})().catch(error=>{console.error(error);process.exitCode=1;});
