'use strict';
const fs=require('fs');
const path=require('path');
const vm=require('vm');

const root=path.resolve(__dirname,'..');
const box={console,Map,Set,WeakMap,Math,Date,Object,Array,String,Number,Boolean,JSON};
box.globalThis=box;box.window=box;
vm.createContext(box);
for(const rel of ['src/systems/melee/melee-schema.js','src/systems/melee/melee-weapon-profiles.js','src/systems/melee/melee-engine.js']){
  vm.runInContext(fs.readFileSync(path.join(root,rel),'utf8'),box,{filename:rel});
}
if(!box.KeloMeleeProfiles||!box.KeloMeleeEngine)throw new Error('MELEE_FOUNDATION_UNAVAILABLE');

const basic=box.KeloMeleeProfiles.get('sword_light_basic');
const follow=box.KeloMeleeProfiles.get('sword_light_follow');
const finisher=box.KeloMeleeProfiles.get('sword_light_finisher');
const heavy=box.KeloMeleeProfiles.get('sword_heavy_charge');
if(!basic||!follow||!finisher||!heavy)throw new Error('MELEE_PROFILE_MISSING');

const baselineRecoveryScale=.76;
const beforeRecoverySpeedPct=baselineRecoveryScale*100;
const afterRecoverySpeedPct=box.KeloMeleeEngine.movementScaleFor(basic,'recovery')*100;
const relativeRecoverySpeedGainPct=(afterRecoverySpeedPct/beforeRecoverySpeedPct-1)*100;

if(box.KeloMeleeEngine.movementScaleFor(basic,'windup')!==.86)throw new Error('BASIC_WINDUP_MOVEMENT_CHANGED');
if(box.KeloMeleeEngine.movementScaleFor(basic,'active')!==.48)throw new Error('BASIC_ACTIVE_MOVEMENT_CHANGED');
if(box.KeloMeleeEngine.movementScaleFor(basic,'recovery')!==1)throw new Error('BASIC_RECOVERY_NOT_FULL_MOVEMENT');
if(basic.damage!==18||basic.range!==150||basic.windup!==.085||basic.active!==.075||basic.recovery!==.18)throw new Error('BASIC_COMBAT_VALUES_CHANGED');
if(box.KeloMeleeEngine.movementScaleFor(follow,'recovery')!==.8)throw new Error('FOLLOW_CONTROL_CHANGED');
if(box.KeloMeleeEngine.movementScaleFor(finisher,'recovery')!==.64)throw new Error('FINISHER_CONTROL_CHANGED');
if(box.KeloMeleeEngine.movementScaleFor(heavy,'recovery')!==.55)throw new Error('HEAVY_CONTROL_CHANGED');

const serverSource=fs.readFileSync(path.join(root,'server/pvp-authority.js'),'utf8');
if(!serverSource.includes("'src/systems/melee/melee-weapon-profiles.js'"))throw new Error('SERVER_DOES_NOT_LOAD_SHARED_MELEE_PROFILES');
if(!serverSource.includes('shared.KeloMeleeEngine.movementScaleFor(player._pvpAttack.profile,player._pvpAttack.phase)'))throw new Error('SERVER_DOES_NOT_USE_SHARED_PHASE_MOVEMENT');

const result={
  contract:'light-basic-recovery-mobility-v1',
  before:{recoveryMovementScale:baselineRecoveryScale,recoverySpeedPct:beforeRecoverySpeedPct},
  after:{recoveryMovementScale:1,recoverySpeedPct:afterRecoverySpeedPct},
  relativeRecoverySpeedGainPct:Number(relativeRecoverySpeedGainPct.toFixed(2)),
  unchanged:{windupScale:.86,activeScale:.48,damage:18,range:150,windup:.085,active:.075,recovery:.18,followRecovery:.8,finisherRecovery:.64,heavyRecovery:.55},
  onlineParity:'server loads shared melee profiles and phase movementScaleFor'
};
console.log('MELEE_RECOVERY_MOBILITY_OK '+JSON.stringify(result));
