'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const box={console,Map,Set,WeakMap,Math,Date,Object,Array,String,Number,Boolean,JSON};box.globalThis=box;box.window=box;vm.createContext(box);
for(const rel of ['src/systems/melee/melee-schema.js','src/systems/melee/melee-weapon-profiles.js'])vm.runInContext(fs.readFileSync(path.join(root,rel),'utf8'),box,{filename:rel});
const p=box.KeloMeleeProfiles&&box.KeloMeleeProfiles.get('sword_light_follow');
if(!p)throw new Error('FOLLOW_PROFILE_MISSING');
if(!p.movementScale||Number(p.movementScale.recovery)!==1)throw new Error('FOLLOW_RECOVERY_NOT_FULL_MOBILITY');
const SPEED=185.28;
const before={windup:.9,active:.52,recovery:.8};
const after=p.movementScale;
const duration={windup:p.windup,active:p.active,recovery:p.recovery};
function continuousDistance(scale){return SPEED*(duration.windup*scale.windup+duration.active*scale.active+duration.recovery*scale.recovery);}
function fixedStep(hz,scale){const dt=1/hz,phases=['windup','active','recovery'];let phase=0,time=0,distance=0,steps=0;while(phase<phases.length&&steps<1000){const key=phases[phase];distance+=SPEED*Number(scale[key])*dt;time+=dt;steps++;if(time>=duration[key]){phase++;time=0;}}return{hz,distance,steps};}
const baseline=continuousDistance(before),candidate=continuousDistance(after),free=SPEED*(p.windup+p.active+p.recovery);
const result={profile:p.id,recoveryScaleBefore:.8,recoveryScaleAfter:p.movementScale.recovery,continuous:{baselineDistancePx:baseline,candidateDistancePx:candidate,gainPx:candidate-baseline,freeDistancePx:free,baselineSuppressionPx:free-baseline,candidateSuppressionPx:free-candidate},fixed:[60,90,120].map(hz=>({hz,before:fixedStep(hz,before).distance,after:fixedStep(hz,after).distance,gain:fixedStep(hz,after).distance-fixedStep(hz,before).distance}))};
if(result.continuous.gainPx<=0)throw new Error('FOLLOW_RECOVERY_NO_MOBILITY_GAIN');
console.log(JSON.stringify(result,null,2));
