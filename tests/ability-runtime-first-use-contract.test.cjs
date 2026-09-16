'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const registrySource=fs.readFileSync(path.join(__dirname,'..','src','core','feature-registry.js'),'utf8');
const loaderSource=fs.readFileSync(path.join(__dirname,'..','src','systems','pvp-combat-runtime-loader.js'),'utf8');

const registryContext={console};
registryContext.globalThis=registryContext;
vm.createContext(registryContext);
vm.runInContext(registrySource,registryContext,{filename:'feature-registry.js'});
const feature=registryContext.KELO_FEATURE_REGISTRY.get('abilityRuntime');
assert.ok(feature,'abilityRuntime must exist in the shared feature registry');
assert.equal(feature.policy,'first-use');
assert.equal(feature.userToggle,false,'core combat runtime must not be user-disableable');
assert.deepEqual(Array.from(feature.files,item=>String(item.src).split('?')[0]),[
  'src/abilities/abilityData.js',
  'src/abilities/stone-system.js',
  'src/abilities/kelo-ability-boot.js'
]);
assert.equal(registryContext.KELO_FEATURE_REGISTRY.toggleableIds.includes('abilityRuntime'),false);

(async()=>{
  const calls=[];
  const context={
    console,
    Date,
    KeloPvPWorld:{
      enter(){calls.push('pvp.enter');return 'ENTERED';}
    },
    KeloRuntimeBootstrap:{
      ensure(){calls.push('foundations.ensure');return Promise.resolve(true);}
    },
    KELO_MODULE_LOADER:{
      ensure(name){
        calls.push('feature.ensure:'+name);
        assert.equal(name,'abilityRuntime');
        context.KeloAbilitiesLoader={
          ensure(){
            calls.push('abilities.ensure');
            context.KeloAbilities={wakeRuntime(){calls.push('abilities.wake');}};
            return Promise.resolve(context.KeloAbilities);
          }
        };
        return Promise.resolve(true);
      }
    },
    KeloMeleeEngine:{},KeloCombatEngine:{},KeloHitResolver:{},KeloCombatSchema:{},KeloEvents:{},KeloAbilityActionTimeline:{},
    KeloPvPCastMovementPrediction:{
      isReady(){return true;},
      bind(){calls.push('prediction.bind');return true;}
    },
    KELO_PVP_CAST_MOVEMENT_AUDIT:{ready:true},
    showToast(message){calls.push('toast:'+message);}
  };
  context.globalThis=context;
  context.window=context;
  vm.createContext(context);
  vm.runInContext(loaderSource,context,{filename:'pvp-combat-runtime-loader.js'});

  assert.ok(context.KeloPvPWorld.ensureCombatReady,'PvP facade must expose ensureCombatReady');
  await context.KeloPvPWorld.ensureCombatReady();
  assert.deepEqual(calls.slice(0,5),[
    'foundations.ensure',
    'feature.ensure:abilityRuntime',
    'abilities.ensure',
    'abilities.wake',
    'prediction.bind'
  ]);
  assert.equal(context.KELO_PVP_COMBAT_LOADER_AUDIT.abilityFeature,'abilityRuntime');
  assert.equal(context.KELO_PVP_COMBAT_LOADER_AUDIT.combatReady,true);

  const result=context.enterPvPWorld();
  assert.equal(result,'ENTERED');
  assert.equal(calls.at(-1),'pvp.enter');
  assert.ok(calls.filter(x=>x==='abilities.wake').length>=2,'ready PvP entry must wake abilities without reloading');
  assert.equal(calls.filter(x=>x==='feature.ensure:abilityRuntime').length,1,'ability feature must load once in the first-use path');

  console.log('ABILITY RUNTIME FIRST-USE CONTRACT PASS');
})().catch(error=>{console.error(error);process.exitCode=1;});
