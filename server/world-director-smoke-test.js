/* KELO-INDEX
 * area: TEST / WORLD DIRECTOR
 * keys: WORLD DIRECTOR SNAPSHOT PRIVACY BUDGET EVENT FALLBACK CLAMP ZONE
 * hace: smoke determinista del agregador horario y de los hard gates de eventos
 * online: N/A; valida contratos puros antes de cablear autoridad server
 */
'use strict';
const assert=require('assert');
const {createWorldDirector}=require('./world-director-service');

(async()=>{
  let now=Date.UTC(2026,8,16,6,0,0);const published=[];
  const director=createWorldDirector({clock:()=>now,aiGenerator:false,publishEvent:event=>published.push(event),maxPlayers:64});
  for(let i=0;i<12;i++)director.record(`p${i}`,'presence',{zoneId:i<8?'plaza':'ferrum',partySize:1});
  for(let i=0;i<12;i++){director.record(`p${i}`,'combat',{count:3});director.record(`p${i}`,'gather',{count:2});}
  const snapshot=director.buildSnapshot(now);
  assert.equal(snapshot.activePlayers,12);assert.equal(snapshot.soloPlayers,12);assert.equal(snapshot.privacy.containsPlayerIds,false);
  assert.equal(JSON.stringify(snapshot).includes('p0'),false,'snapshot must not expose player identity');
  const result=await director.generate(now,{force:true});
  assert.equal(result.ok,true);assert.equal(result.event.archetype,'RESOURCE_CRISIS');assert.ok(result.event.recommendedPlayers>=4);assert.equal(result.event.rewardPolicy.aiMaySetAmounts,false);assert.equal(published.length,1);

  now+=60*60*1000;
  const malicious=createWorldDirector({clock:()=>now,aiGenerator:async()=>({archetype:'WORLD_BOSS',title:'<script>x</script>',description:'x',zoneId:'../../root',recommendedPlayers:999,durationMinutes:999,objective:'x',reason:'x',rewardTier:'EPIC'})});
  for(let i=0;i<6;i++)malicious.record(`m${i}`,'presence',{zoneId:i===0?'pvp':'plaza'});
  const guarded=await malicious.generate(now,{force:true});
  assert.ok(guarded.event.recommendedPlayers<=6);assert.ok(guarded.event.durationMinutes<=120);assert.equal(guarded.event.zoneId,'plaza','AI zone must be clamped to a real non-PvP world zone');assert.equal(guarded.event.title.includes('<'),false);

  now+=60*60*1000;
  const pvpOnly=createWorldDirector({clock:()=>now,aiGenerator:false});
  for(let i=0;i<4;i++)pvpOnly.record(`arena${i}`,'presence',{zoneId:'pvp'});
  const pvpGuard=await pvpOnly.generate(now,{force:true});
  assert.equal(pvpGuard.event.zoneId,'plaza','arena activity must never place a global world event inside PvP');
  console.log('world-director smoke PASS');
})().catch(error=>{console.error(error);process.exitCode=1;});