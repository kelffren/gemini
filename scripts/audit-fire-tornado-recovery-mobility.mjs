/* KELO-INDEX
 * area: QA / PVP CAST RECOVERY MOBILITY
 * owner: deterministic audit only
 * keys: FIRE TORNADO RECOVERY MOVEMENT 60HZ 90HZ 120HZ A B
 * purpose: compara baseline scalar .52 contra la policy phase-aware actual de Fire Tornado
 * consumes: abilityData + ability-action-timeline
 * online: valida semántica compartida consumible por cliente y server
 * do-not: NO gameplay writes, NO production state
 */
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const data=require('../src/abilities/abilityData.js');
const timeline=require('../src/abilities/ability-action-timeline.js');
const SPEED=185.28,BASE={windup:.52,active:.52,recovery:.52};
const def=data.ABILITIES.find(x=>x.key==='fire_tornado');
if(!def)throw new Error('FIRE_TORNADO_MISSING');
const actual=timeline.normalize(def);
function run(hz,scales){
  const action={windup:actual.windup,active:actual.active,recovery:actual.recovery,movementScale:scales};
  const s=timeline.create(action),dt=1/hz;let recovery=0,first100=0,recoveryTime=0;
  while(!s.done){
    const phase=s.phase,scale=timeline.movementScaleFor(s),dx=SPEED*scale*dt;
    if(phase==='recovery'){
      recovery+=dx;
      if(recoveryTime<.1)first100+=dx;
      recoveryTime+=dt;
    }
    timeline.advance(s,dt);
  }
  return {recovery,first100};
}
if(actual.windup!==.18||actual.active!==.05||actual.recovery!==.34)throw new Error('FIRE_TORNADO_TIMING_CHANGED');
if(!actual.movementScale||typeof actual.movementScale!=='object')throw new Error('FIRE_TORNADO_PHASE_POLICY_MISSING');
if(Math.abs(actual.movementScale.windup-.52)>1e-9||Math.abs(actual.movementScale.active-.52)>1e-9)throw new Error('FIRE_TORNADO_COMMITMENT_CHANGED');
if(Math.abs(actual.movementScale.recovery-.72)>1e-9)throw new Error('CANDIDATE_A_EXPECTED_RECOVERY_072');
const rows=[];
for(const hz of [60,90,120]){
  const baseline=run(hz,BASE),candidate=run(hz,actual.movementScale),gain=(candidate.recovery/baseline.recovery-1)*100;
  const row={hz,baselineRecoveryPx:+baseline.recovery.toFixed(4),candidateRecoveryPx:+candidate.recovery.toFixed(4),recoveryGainPct:+gain.toFixed(2),baselineFirst100Px:+baseline.first100.toFixed(4),candidateFirst100Px:+candidate.first100.toFixed(4),baselineVelocity:+(SPEED*.52).toFixed(3),candidateVelocity:+(SPEED*.72).toFixed(3)};
  rows.push(row);
  if(gain<35||gain>42)throw new Error(`CANDIDATE_A_GAIN_OUT_OF_BAND:${hz}:${gain}`);
}
console.log(JSON.stringify({ability:def.key,action:actual,rows},null,2));
console.log('FIRE_TORNADO_RECOVERY_CANDIDATE_A_OK');
