'use strict';
/* KELO-INDEX
 * area: SERVER / PVP
 * owner: server PvP authority behind KeloNetAuthority protocol
 * keys: PVP SHARED AUTHORITY NODE FIXED STEP INPUT SEQUENCE GUARDIAN PARITY
 * purpose: adapta dependencias Node al core PvP compartido; la lógica gameplay vive en shared-pvp-authority.js
 * online: cliente envía intent; este owner decide resultado. Nunca confía en client HP/hit final.
 * do-not: NO duplicar reglas gameplay aquí; NO autoridad económica/inventario
 */
const fs=require('fs'),path=require('path'),vm=require('vm');
const abilityData=require('../src/abilities/abilityData.js');
const movementProfile=require('../src/core/movement-profile.js');
const core=require('../src/systems/pvp/shared-pvp-authority.js');

function loadSharedCombat(){
  const root=path.resolve(__dirname,'..');
  const box={console,Map,Set,WeakMap,Math,Date,Object,Array,String,Number,Boolean,JSON,performance:{now:()=>Date.now()},setTimeout,clearTimeout,setInterval,clearInterval};
  box.globalThis=box;box.window=box;
  vm.createContext(box);
  [
    'src/core/events/event-bus.js',
    'src/systems/combat/combat-schema.js',
    'src/systems/combat/hit-resolver.js',
    'src/systems/combat/damage-resolver.js',
    'src/systems/effects/effect-schema.js',
    'src/systems/effects/status-engine.js',
    'src/systems/effects/effect-engine.js',
    'src/systems/combat/combat-engine.js',
    'src/systems/melee/melee-schema.js',
    'src/systems/melee/melee-weapon-profiles.js',
    'src/systems/melee/melee-engine.js'
  ].forEach(rel=>vm.runInContext(fs.readFileSync(path.join(root,rel),'utf8'),box,{filename:rel}));
  if(!box.KeloHitResolver||!box.KeloEffectEngine||!box.KeloStatusEffects||!box.KeloMeleeEngine)throw new Error('PVP_SHARED_COMBAT_UNAVAILABLE');
  return box;
}
const shared=loadSharedCombat();

function createPvpAuthority(options){
  return core.createPvpAuthority(Object.assign({},options||{}, {
    shared,
    abilityData,
    movementProfile
  }));
}

module.exports={
  createPvpAuthority,
  FIXED_DT:core.FIXED_DT,
  SNAPSHOT_HZ:core.SNAPSHOT_HZ,
  MAX_REWIND_MS:core.MAX_REWIND_MS,
  INPUT_BUFFER_MS:core.INPUT_BUFFER_MS,
  ARENA:core.ARENA,
  DODGE:core.DODGE
};
