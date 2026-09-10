/* KELO-INDEX
 * area: QA / PVP CAST RECOVERY MOBILITY
 * owner: deterministic audit only
 * keys: FIRE TORNADO RECOVERY MOVEMENT 60HZ 90HZ 120HZ
 * purpose: mide la movilidad de recovery de Fire Tornado usando KeloAbilityActionTimeline
 * consumes: abilityData + ability-action-timeline
 * online: valida semántica compartida consumible por cliente y server
 * do-not: NO gameplay writes, NO production state
 */
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const data=require('../src/abilities/abilityData.js');
const timeline=require('../src/abilities/ability-action-timeline.js');
const SPEED=185.28;
const def=data.ABILITIES.find(x=>x.key==='fire_tornado');
if(!def)throw new Error('FIRE_TORNADO_MISSING');
const actual=timeline.normalize(def);
function run(hz){
  const s=timeline.create(def),dt=1/hz;let recovery=0,first100=0,recoveryTime=0;
  while(!s.done){
    const phase=s.phase,scale=timeline.movementScaleFor(s),dx=SPEED*scale*dt;
    if(phase==='recovery'){
      recovery+=dx;
      if(recoveryTime<.1)first100+=dx;
      recoveryTime+=dt;
    }
    timeline.advance(s,dt);
  }
  return {hz,recoveryPx:+recovery.toFixed(4),first100Px:+first100.toFixed(4),recoveryVelocity:+(SPEED*(typeof actual.movementScale==='number'?actual.movementScale:actual.movementScale.recovery)).toFixed(3)};
}
const rows=[60,90,120].map(run);
console.log(JSON.stringify({ability:def.key,action:actual,rows},null,2));
if(actual.windup!==.18||actual.active!==.05||actual.recovery!==.34)throw new Error('FIRE_TORNADO_TIMING_CHANGED');
if(typeof actual.movementScale!=='number'||Math.abs(actual.movementScale-.52)>1e-9)throw new Error('BASELINE_EXPECTED_SCALAR_052');
console.log('FIRE_TORNADO_RECOVERY_BASELINE_OK');
