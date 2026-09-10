/* KELO-INDEX
 * area: PVP / MELEE / AUDIT
 * keys: RECOVERY MOVEMENT BASIC FOLLOW FINISHER HEAVY NETWORKING PARITY ACTIVE
 * purpose: protege movement scales ganadores del combo melee y confirma que server usa los mismos perfiles melee
 * online: server/pvp-authority carga KeloMeleeProfiles y KeloMeleeEngine compartidos
 */
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
if(box.KeloMeleeEngine.movementScaleFor(basic,'active')!==.52)throw new Error('BASIC_ACTIVE_MOVEMENT_WINNER_REGRESSED');
if(box.KeloMeleeEngine.movementScaleFor(basic,'recovery')!==1)throw new Error('BASIC_RECOVERY_NOT_FULL_MOVEMENT');
if(basic.damage!==18||basic.range!==150||basic.windup!==.085||basic.active!==.075||basic.recovery!==.18)throw new Error('BASIC_COMBAT_VALUES_CHANGED');
if(box.KeloMeleeEngine.movementScaleFor(follow,'active')!==.52)throw new Error('FOLLOW_ACTIVE_WEIGHT_CHANGED');
if(box.KeloMeleeEngine.movementScaleFor(follow,'recovery')!==1)throw new Error('FOLLOW_RECOVERY_WINNER_REGRESSED');
if(box.KeloMeleeEngine.movementScaleFor(finisher,'recovery')!==.76)throw new Error('FINISHER_RECOVERY_WINNER_REGRESSED');
if(box.KeloMeleeEngine.movementScaleFor(heavy,'recovery')!==.64)throw new Error('HEAVY_RECOVERY_WINNER_REGRESSED');

const serverSource=fs.readFileSync(path.join(root,'server/pvp-authority.js'),'utf8');
if(!serverSource.includes("'src/systems/melee/melee-weapon-profiles.js'"))throw new Error('SERVER_DOES_NOT_LOAD_SHARED_MELEE_PROFILES');
if(!serverSource.includes('shared.KeloMeleeEngine.movementScaleFor(player._pvpAttack.profile,player._pvpAttack.phase)'))throw new Error('SERVER_DOES_NOT_USE_SHARED_PHASE_MOVEMENT');

const result={
  contract:'melee-recovery-mobility-v5-light-active',
  basic:{windup:.86,active:.52,recovery:1},
  follow:{active:.52,recovery:1},
  finisher:{recovery:.76},
  heavy:{recovery:.64},
  relativeBasicRecoverySpeedGainPct:Number(relativeRecoverySpeedGainPct.toFixed(2)),
  onlineParity:'server loads shared melee profiles and phase movementScaleFor'
};
console.log('MELEE_RECOVERY_MOBILITY_OK '+JSON.stringify(result));