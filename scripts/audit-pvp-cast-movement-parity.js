/* KELO-INDEX
 * area: QA / PVP ABILITY MOVEMENT
 * owner: deterministic audit only
 * keys: PVP CAST MOVEMENT PARITY FIREBALL FIRE TORNADO ICE WALL 60HZ 90HZ 120HZ
 * purpose: compara baseline sin prediction contra candidate shared timeline y semántica autoritativa para movementScale de casts
 * consumes: abilityData + ability-action-timeline
 * do-not: NO gameplay writes, NO production state
 */
'use strict';
const path=require('path');
const data=require(path.resolve(__dirname,'../src/abilities/abilityData.js'));
const timeline=require(path.resolve(__dirname,'../src/abilities/ability-action-timeline.js'));
const SPEED=185.28;
const KEYS=['fireball','fire_tornado','ice_wall','shadow_step','wind_dash'];
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
function baselineNoCastPrediction(d,hz,meleeScale){
  const action=timeline.normalize(d),duration=action.windup+action.active+action.recovery,steps=Math.ceil(duration*hz);return{distance:SPEED*meleeScale*steps/hz,steps};
}
const rows=[];
for(const key of KEYS){for(const hz of [60,90,120]){for(const meleeScale of [1,.52,.34]){
  const d=def(key),srv=serverRun(d,hz,meleeScale),cli=clientCandidate(d,hz,meleeScale),base=baselineNoCastPrediction(d,hz,meleeScale);
  const delta=Math.abs(srv.distance-cli.distance),phaseMismatch=srv.phaseSteps.some((x,i)=>!cli.phaseSteps[i]||x.phase!==cli.phaseSteps[i].phase||Math.abs(x.scale-cli.phaseSteps[i].scale)>1e-12);
  rows.push({key,hz,meleeScale,baselinePx:+base.distance.toFixed(5),serverPx:+srv.distance.toFixed(5),candidatePx:+cli.distance.toFixed(5),candidateServerDeltaPx:+delta.toFixed(12),baselineSemanticErrorPx:+Math.abs(base.distance-srv.distance).toFixed(5),steps:srv.steps,phaseMismatch});
  if(delta>1e-9||phaseMismatch)throw new Error(`CAST_PARITY_FAIL:${key}:${hz}:${meleeScale}:${delta}`);
}}}
const tornado=rows.filter(r=>r.key==='fire_tornado'&&r.meleeScale===1);
if(!tornado.every(r=>r.baselineSemanticErrorPx>50))throw new Error('TORNADO_BASELINE_GAP_NOT_REPRODUCED');
const wind=rows.filter(r=>r.key==='wind_dash'&&r.meleeScale===1);
if(!wind.every(r=>r.baselineSemanticErrorPx<1e-6))throw new Error('WIND_DASH_SHOULD_NOT_SLOW');
console.log(JSON.stringify({ok:true,version:timeline.version,maxCandidateServerDeltaPx:Math.max(...rows.map(r=>r.candidateServerDeltaPx)),fireTornado:tornado,rows},null,2));
