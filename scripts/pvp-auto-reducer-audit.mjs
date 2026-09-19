/* KELO-INDEX
 * area: QA / PVP / PERFORMANCE
 * owner: KeloPvPAutoReducer QA
 * keys: PVP AUTO REDUCER NETWORK QUALITY SIMULATION OWNER NO-LOOP
 * purpose: proves the PvP adaptive reducer remains presentation-only, lazy, owner-native and free of parallel schedulers
 * public-api: CLI audit only
 * consumes: pvp-auto-reducer source, feature registry, technical doc
 * state-owned: none
 * online: build-time only
 * do-not: do not turn this into a network benchmark; validate architectural invariants here
 */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const source=fs.readFileSync('src/systems/pvp-auto-reducer.js','utf8');
const registry=fs.readFileSync('src/core/feature-registry.js','utf8');
const doc=fs.readFileSync('docs/systems/PVP_AUTO_REDUCER.md','utf8');
const perf=fs.readFileSync('src/systems/performance-governor.js','utf8');

assert.match(source,/owner: KeloPvPAutoReducer/i,'owner marker missing');
assert.match(source,/KeloSimulation\.after\(['"]pvp-auto-reducer:network-quality['"]/,'must schedule through KeloSimulation');
assert.match(source,/setQualityFloor\(/,'quality changes must go through KELO_PERF quality-floor API');
assert.doesNotMatch(source,/setManualQuality\(/,'AutoReducer must not override the player/device base quality');
assert.match(source,/getPvpPendingCount/,'network estimator must consume existing NetAuthority signal');
assert.match(source,/getLastPvpAck/,'ack progress signal missing');
assert.match(source,/recoverHoldMs/,'recovery hysteresis missing');
assert.match(source,/warningCooldownMs/,'warning cooldown missing');
assert.doesNotMatch(source,/requestAnimationFrame\s*\(/,'must not create a parallel frame loop');
assert.doesNotMatch(source,/setInterval\s*\(/,'must not create a timer scheduler');
assert.doesNotMatch(source,/\b(?:damage|hp|maxHp|cooldown|mmr|rating)\s*=/i,'presentation reducer must not assign competitive truth');
assert.match(source,/root\.KeloPvPAutoReducer=Object\.freeze/,'public API must remain immutable facade');
assert.match(source,/usesExistingSimulation:true/,'audit contract must declare shared simulation');
assert.match(source,/usesExistingQualityOwner:true/,'audit contract must declare shared quality owner');
assert.match(source,/usesQualityFloor:true/,'audit contract must declare monotonic quality-floor integration');
assert.match(source,/FEATURE_PVP_AUTO_REDUCER/,'kill switch must remain available');
assert.match(source,/applyQuality\('pvp_low'/,'first reduction must be below PERFORMANCE');
assert.match(source,/applyQuality\('pvp_emergency'/,'critical reduction must use the PvP emergency floor');
assert.match(source,/id:'pvp_low'/,'lazy PvP bundle must define pvp_low');
assert.match(source,/id:'pvp_emergency'/,'lazy PvP bundle must define pvp_emergency');
assert.doesNotMatch(perf,/pvp_low|pvp_emergency/,'PvP-only floor descriptors must stay off first-playable');
assert.match(perf,/function setQualityFloor\(/,'performance owner must expose a generic quality-floor primitive');
assert.match(perf,/manualProfile \|\| qualityFloor \|\| document\.hidden/,'autotune must freeze the base policy while a temporary floor is active');
assert.match(source,/inputBlocking:false/,'reducer must not block input');
assert.match(source,/reload:false/,'reducer must remain hot/no-reload');

assert.match(registry,/src\/systems\/pvp-auto-reducer\.js\?v=2/,'reducer must be lazy-loaded with PvP feature pack');
const pvpIndex=registry.indexOf("pvp:{dependencies:");
const reducerIndex=registry.indexOf("src/systems/pvp-auto-reducer.js?v=2");
assert.ok(pvpIndex>=0&&reducerIndex>pvpIndex,'reducer must belong to PvP feature definition');

assert.match(doc,/system-id:\s*pvp-auto-reducer/i,'technical doc must declare system identity');
assert.match(doc,/owner:\s*KeloPvPAutoReducer/i,'technical doc must declare owner identity');
assert.match(doc,/##\s+Estado que NO posee/i,'technical doc must state forbidden ownership explicitly');
assert.match(doc,/No crea `requestAnimationFrame`, `setInterval` ni segundo loop/i,'technical doc must forbid parallel schedulers');
assert.match(doc,/presentation-only/i,'technical doc must declare presentation-only failure boundary');

const fakeDocument={
  hidden:false,
  body:{dataset:{},appendChild(){}},
  documentElement:{dataset:{}},
  addEventListener(){},
  createElement(){return {style:{},setAttribute(){},appendChild(){},querySelector(){return null;},remove(){},isConnected:true};}
};
const perfContext={
  console,
  innerWidth:390,
  innerHeight:844,
  performance:{now:()=>100},
  document:fakeDocument,
  localStorage:{getItem(){return null;},setItem(){}},
  location:{search:''},
  requestAnimationFrame(fn){this.__perfFrame=fn;return 1;},
  addEventListener(){},
  dispatchEvent(){},
  CustomEvent:class CustomEvent{constructor(type,init={}){this.type=type;this.detail=init.detail;}},
  URLSearchParams
};
perfContext.globalThis=perfContext;
perfContext.window=perfContext;
vm.runInNewContext(perf,perfContext,{filename:'performance-governor.js'});
const owner=perfContext.KELO_PERF;
assert.equal(owner.profile.id,'performance','390x844 phone must retain PERFORMANCE as normal base');
const mediumLike={id:'medium-like',weightedBudget:330,particleCap:120,fxCap:24,actorCutoff:1500,nearHz:60,midHz:30,farHz:12,farCutoff:1250,_rank:2};
const pvpLow={id:'pvp_low',weightedBudget:240,particleCap:48,fxCap:16,actorCutoff:1200,nearHz:45,midHz:18,farHz:8,farCutoff:900,_rank:4};
const pvpEmergency={id:'pvp_emergency',weightedBudget:240,particleCap:24,fxCap:16,actorCutoff:1200,nearHz:45,midHz:15,farHz:5,farCutoff:800,_rank:5};
owner.setQualityFloor(mediumLike);
assert.equal(owner.profile.id,'performance','a weaker floor must never upgrade the phone');
owner.setQualityFloor(pvpLow);
assert.equal(owner.profile.id,'pvp_low','sustained PvP degradation must move below PERFORMANCE');
owner.setManualQuality('ultra');
assert.equal(owner.profile.id,'pvp_low','manual/base quality cannot bypass an active lower PvP floor');
owner.setQualityFloor(pvpEmergency);
assert.equal(owner.profile.id,'pvp_emergency','critical path must reach dedicated emergency floor');
owner.setQualityFloor(null);
assert.equal(owner.profile.id,'ultra','clearing the floor restores the pre-existing manual/base policy');
owner.setManualQuality('auto');
assert.equal(owner.profile.id,'performance','returning to auto restores the phone base policy');

console.log('PVP_AUTO_REDUCER_AUDIT_OK: monotonic owner-native adaptive presentation protection verified');
