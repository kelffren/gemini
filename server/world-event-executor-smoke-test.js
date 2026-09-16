/* KELO-INDEX
 * area: SERVER / WORLD EVENTS / TEST
 * owner: KeloWorldEventExecutor verification
 * keys: BOSS COOP SEALS POPULATION DROP DAMAGE AUTHORITY OBJECTIVE REWARD EXPIRY
 * purpose: verifica que los encuentros exigen jugadores distintos, reinician gates al perder población y solo aceptan progreso confirmado por server owners
 * online: prueba contratos puros server-side sin confiar en cliente
 */
'use strict';
const assert=require('assert');
const {createWorldEventExecutor}=require('./world-event-executor');

(async()=>{
  let now=1_800_000_000_000,rewardCalls=0;
  const emitted=[];
  const executor=createWorldEventExecutor({
    clock:()=>now,
    publish:(type,payload)=>emitted.push({type,payload}),
    resolveRewards:async input=>{rewardCalls++;return{ok:true,authority:'server-economy',participants:input.participants.length};}
  });

  const bossEvent={id:'wd:world_boss:ferrum:test',archetype:'WORLD_BOSS',zoneId:'ferrum',title:'Coloso de Ferrum',minPlayers:6,recommendedPlayers:10,startsAt:now,endsAt:now+60*60*1000,rewardPolicy:{tier:'EPIC',authority:'SERVER_RESOLVED',aiMaySetAmounts:false}};
  let boss=executor.materialize(bossEvent);
  assert.strictEqual(boss.status,'RECRUITING');
  assert.strictEqual(boss.lockedByPopulation,true);
  assert.ok(boss.boss.maxHp>0);
  for(let i=1;i<=6;i++)boss=executor.join(bossEvent.id,{playerKey:`p${i}`,zone:'ferrum'});
  assert.strictEqual(boss.status,'ACTIVE');
  assert.strictEqual(boss.phase,'SEALS');
  assert.strictEqual(boss.participantCount,6);
  assert.ok(!JSON.stringify(boss).includes('"p1"'),'public snapshot must not expose participant identities');

  executor.activateSeal(bossEvent.id,'p1','north');
  executor.activateSeal(bossEvent.id,'p2','east');
  boss=executor.activateSeal(bossEvent.id,'p3','west');
  assert.strictEqual(boss.phase,'VULNERABLE');
  assert.strictEqual(boss.boss.sealsActivated,3);

  boss=executor.leave(bossEvent.id,'p6');
  assert.strictEqual(boss.status,'RECRUITING');
  assert.strictEqual(boss.phase,'WAITING_FOR_ALLIES');
  assert.strictEqual(boss.boss.sealsActivated,0);
  assert.strictEqual(boss.boss.vulnerable,false);
  await assert.rejects(()=>executor.confirmDamage(bossEvent.id,'p4',500,{source:'server-combat',serverConfirmed:true}),/NEED_MORE_PLAYERS/);

  boss=executor.join(bossEvent.id,{playerKey:'p6',zone:'ferrum'});
  assert.strictEqual(boss.phase,'SEALS');
  executor.activateSeal(bossEvent.id,'p1','north');
  executor.activateSeal(bossEvent.id,'p2','east');
  boss=executor.activateSeal(bossEvent.id,'p3','west');
  assert.strictEqual(boss.phase,'VULNERABLE');

  await assert.rejects(()=>executor.confirmDamage(bossEvent.id,'p4',500,{source:'client',serverConfirmed:true}),/UNTRUSTED_DAMAGE/);
  const hp=boss.boss.maxHp;
  boss=await executor.confirmDamage(bossEvent.id,'p4',hp+1,{source:'server-combat',serverConfirmed:true,attackId:'srv_attack_1'});
  assert.strictEqual(boss.status,'COMPLETED');
  assert.strictEqual(boss.boss.hp,0);
  assert.strictEqual(rewardCalls,1);

  const defenseEvent={id:'wd:town_defense:ignis:test',archetype:'TOWN_DEFENSE',zoneId:'ignis',title:'Campanas',minPlayers:2,recommendedPlayers:4,startsAt:now,endsAt:now+30*60*1000,rewardPolicy:{tier:'MEDIUM',authority:'SERVER_RESOLVED'}};
  let defense=executor.materialize(defenseEvent);
  executor.join(defenseEvent.id,{playerKey:'d1',zone:'ignis'});
  executor.join(defenseEvent.id,{playerKey:'d2',zone:'ignis'});
  await assert.rejects(()=>executor.confirmObjective(defenseEvent.id,'d1','wave_clear',1,{source:'client',serverConfirmed:true}),/UNTRUSTED_PROGRESS/);
  defense=await executor.confirmObjective(defenseEvent.id,'d1','wave_clear',1,{source:'server-gameplay',serverConfirmed:true});
  assert.strictEqual(defense.status,'ACTIVE');
  defense=await executor.confirmObjective(defenseEvent.id,'d2','wave_clear',2,{source:'server-gameplay',serverConfirmed:true});
  assert.strictEqual(defense.status,'COMPLETED');
  assert.strictEqual(rewardCalls,2);

  const expiring={id:'wd:rescue:plaza:test',archetype:'RESCUE',zoneId:'plaza',title:'Rescate',minPlayers:2,recommendedPlayers:4,startsAt:now,endsAt:now+60000,rewardPolicy:{authority:'SERVER_RESOLVED'}};
  executor.materialize(expiring);now+=60001;const expired=executor.snapshot(expiring.id);assert.strictEqual(expired.status,'EXPIRED');

  const audit=executor.audit();
  assert.strictEqual(audit.serverAuthoritative,true);
  assert.strictEqual(audit.clientDamageAccepted,false);
  assert.ok(emitted.some(row=>row.type==='world-event:stalled'));
  assert.ok(emitted.some(row=>row.type==='world-event:completed'));
  console.log('✅ World Event Executor: population gate/reset + seals + trusted damage/objectives + rewards + expiry');
})().catch(error=>{console.error('❌ World Event Executor smoke failed:',error);process.exitCode=1;});
