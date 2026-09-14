'use strict';
/* KELO-INDEX
 * area: SERVER / PVP ADAPTER
 * owner: server PvP authority adapter behind KeloNetAuthority protocol
 * keys: PVP AUTHORITY NODE ADAPTER PORTABLE CORE FIXED STEP VM SHARED COMBAT
 * purpose: adapta dependencias Node al mismo KeloPvpAuthorityCore que puede ejecutar Guardian en browser worker
 * public-api: createPvpAuthority + constants CommonJS
 * consumes: src/online/pvp-authority-core.js + shared combat/effects/melee contracts
 * state-owned: none beyond one cached dependency sandbox; simulation state belongs to each portable core instance
 * online: Node/Render deja de poseer un ruleset exclusivo; solo hospeda el mismo core autoritativo
 * do-not: NO duplicar reglas PvP aquí; NO sockets/economía en el core
 */
const fs=require('fs'),path=require('path'),vm=require('vm');
const core=require('../src/online/pvp-authority-core.js');
const abilityData=require('../src/abilities/abilityData.js');
const movementProfile=require('../src/core/movement-profile.js');
function loadSharedCombat(){
  const root=path.resolve(__dirname,'..'),box={console,Map,Set,WeakMap,Math,Date,Object,Array,String,Number,Boolean,JSON,performance:{now:()=>Date.now()},setTimeout,clearTimeout,setInterval,clearInterval};
  box.globalThis=box;box.window=box;vm.createContext(box);
  ['src/core/events/event-bus.js','src/systems/combat/combat-schema.js','src/systems/combat/hit-resolver.js','src/systems/combat/damage-resolver.js','src/systems/effects/effect-schema.js','src/systems/effects/status-engine.js','src/systems/effects/effect-engine.js','src/systems/combat/combat-engine.js','src/systems/melee/melee-schema.js','src/systems/melee/melee-weapon-profiles.js','src/systems/melee/melee-engine.js'].forEach(rel=>vm.runInContext(fs.readFileSync(path.join(root,rel),'utf8'),box,{filename:rel}));
  if(!box.KeloHitResolver||!box.KeloEffectEngine||!box.KeloStatusEffects||!box.KeloMeleeEngine||!box.KeloMeleeProfiles||!box.KeloCombatEngine||!box.KeloCombatSchema||!box.KeloEvents)throw new Error('PVP_SHARED_COMBAT_UNAVAILABLE');
  return box;
}
const deps=Object.freeze({abilityData,movementProfile,shared:loadSharedCombat()});
function createPvpAuthority(options){return core.createPvpAuthority(deps,options);}
module.exports={createPvpAuthority,FIXED_DT:core.FIXED_DT,SNAPSHOT_HZ:core.SNAPSHOT_HZ,MAX_REWIND_MS:core.MAX_REWIND_MS,INPUT_BUFFER_MS:core.INPUT_BUFFER_MS,ARENA:core.ARENA,DODGE:core.DODGE,STATE_SCHEMA:core.stateSchema,CORE_VERSION:core.version};
