/* KELO-INDEX
 * area: QA / PVP ABILITY MOVEMENT
 * owner: deterministic audit only
 * keys: PVP CAST MOVEMENT PARITY FIREBALL FIRE TORNADO ICE WALL STONE SHIELD 60HZ 90HZ 120HZ PHASE AWARE
 * purpose: compara baseline sin prediction contra candidate shared timeline y semántica autoritativa para movementScale de casts
 * consumes: abilityData + ability-action-timeline
 * do-not: NO gameplay writes, NO production state
 */
'use strict';
const path=require('path');
const data=require(path.resolve(__dirname,'../src/abilities/abilityData.js'));
const timeline=require(path.resolve(__dirname,'../src/abilities/ability-action-timeline.js'));
const SPEED=185.28;
const KEYS=['fireball','fire_tornado','ice_wall','stone_shield','shadow_step','wind_dash'];
function def(key){const d=(data.ABILITIES||[]).find(x=>x.key===key);if(!d)throw new Error('ABILITY_MISSING:'+key);return d;}
function serverRun(d,hz,meleeScale){
  const dt=1/hz,s=timeline.create(d);let distance=0,steps=0,phaseSteps=[];
  while(!s.done&&steps<1000){const castScale=timeline.movementScaleFor(s),scale=Math.min(meleeScale,castScale);phaseSteps.push({phase:s.phase,scale});distance+=SPEED*scale*dt;timeline.advance(s,dt);steps++;}
  return{distance,steps,phaseSteps};
}
function clientCandidate(d,hz,meleeScale){
  // Support hook priority 69 applies min(melee,cast)/melee, then existing pvp hook priority 70 applies melee.
  const dt=1/hz,s=timeline.create(d);let distance=0,steps=0,phaseSteps=[];
  while(!s.done&&steps<1000){const castScale=timeline.movementScaleFor(s),factor=Math.min(meleeScale,castScale)/Math.max(.000001,meleeScale),finalScale=meleeScale*factor;phaseSteps.push({phase:s.phase,scale:finalScale});distance+=SPEED*finalScale*dt;timeline.advance(s,dt);steps++;}
  return{distance,steps,phaseSteps};
}
function baselineSameTimelineNoCastSlow(d,hz,meleeScale){
  // Keep the exact same phase-step count as authority; baseline differs only by ignoring cast slowdown.
  const dt=1/hz,s=timeline.create(d);let distance=0,steps=0;
  while(!s.done&&steps<1000){distance+=SPEED*meleeScale*dt;timeline.advance(s,dt);steps++;}
  return{distance,steps};
}
const rows=[];
for(const key of KEYS){for(const hz of [60,90,120]){for(const meleeScale of [1,.52,.34]){
  const d=def(key),srv=serverRun(d,hz,meleeScale),cli=clientCandidate(d,hz,meleeScale),base=baselineSameTimelineNoCastSlow(d,hz,meleeScale);
  const delta=Math.abs(srv.distance-cli.distance),phaseMismatch=srv.phaseSteps.some((x,i)=>!cli.phaseSteps[i]||x.phase!==cli.phaseSteps[i].phase||Math.abs(x.scale-cli.phaseSteps[i].scale)>1e-12);
  rows.push({key,hz,meleeScale,baselinePx:+base.distance.toFixed(5),serverPx:+srv.distance.toFixed(5),candidatePx:+cli.distance.toFixed(5),candidateServerDeltaPx:+delta.toFixed(12),baselineSemanticErrorPx:+Math.abs(base.distance-srv.distance).toFixed(5),steps:srv.steps,phaseMismatch});
  if(delta>1e-9||phaseMismatch)throw new Error(`CAST_PARITY_FAIL:${key}:${hz}:${meleeScale}:${delta}`);
}}}
const tornadoDef=def('fire_tornado'),tornadoAction=timeline.normalize(tornadoDef),tornado=rows.filter(r=>r.key==='fire_tornado'&&r.meleeScale===1);
if(!tornadoAction.movementScale||typeof tornadoAction.movementScale!=='object')throw new Error('TORNADO_PHASE_POLICY_MISSING');
if(Math.abs(tornadoAction.movementScale.windup-.52)>1e-9||Math.abs(tornadoAction.movementScale.active-.52)>1e-9||Math.abs(tornadoAction.movementScale.recovery-.78)>1e-9)throw new Error('TORNADO_PHASE_POLICY_CHANGED');
// The old >50px assertion encoded the former scalar .52 policy and became stale once recovery was intentionally loosened.
// Retain a meaningful commitment check without contradicting phase-aware recovery: ignoring all cast slowdown must still differ materially.
if(!tornado.every(r=>r.baselineSemanticErrorPx>20))throw new Error('TORNADO_COMMITMENT_GAP_NOT_REPRODUCED');
const tornadoRecoveryParity=tornado.every(r=>r.candidateServerDeltaPx<1e-9&&!r.phaseMismatch);
if(!tornadoRecoveryParity)throw new Error('TORNADO_PHASE_PARITY_FAILED');
const stoneDef=def('stone_shield'),stoneAction=timeline.normalize(stoneDef),stone=rows.filter(r=>r.key==='stone_shield'&&r.meleeScale===1);
if(!stoneAction.movementScale||typeof stoneAction.movementScale!=='object')throw new Error('STONE_SHIELD_PHASE_POLICY_MISSING');
if(Math.abs(stoneAction.movementScale.windup-.55)>1e-9||Math.abs(stoneAction.movementScale.active-.55)>1e-9||Math.abs(stoneAction.movementScale.recovery-.80)>1e-9)throw new Error('STONE_SHIELD_PHASE_POLICY_CHANGED');
if(!stone.every(r=>r.candidateServerDeltaPx<1e-9&&!r.phaseMismatch))throw new Error('STONE_SHIELD_PHASE_PARITY_FAILED');
const wind=rows.filter(r=>r.key==='wind_dash'&&r.meleeScale===1);
if(!wind.every(r=>r.baselineSemanticErrorPx<1e-9&&r.candidateServerDeltaPx<1e-9))throw new Error('WIND_DASH_SHOULD_NOT_SLOW');
console.log(JSON.stringify({ok:true,version:timeline.version,maxCandidateServerDeltaPx:Math.max(...rows.map(r=>r.candidateServerDeltaPx)),fireTornadoAction:tornadoAction,fireTornado:tornado,stoneShieldAction:stoneAction,stoneShield:stone,windDash:wind,rows},null,2));
