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

const source=fs.readFileSync('src/systems/pvp-auto-reducer.js','utf8');
const registry=fs.readFileSync('src/core/feature-registry.js','utf8');
const doc=fs.readFileSync('docs/systems/PVP_AUTO_REDUCER.md','utf8');

assert.match(source,/owner: KeloPvPAutoReducer/i,'owner marker missing');
assert.match(source,/KeloSimulation\.after\(['"]pvp-auto-reducer:network-quality['"]/,'must schedule through KeloSimulation');
assert.match(source,/setManualQuality\(/,'quality changes must go through KELO_PERF public API');
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
assert.match(source,/inputBlocking:false/,'reducer must not block input');
assert.match(source,/reload:false/,'reducer must remain hot/no-reload');

assert.match(registry,/src\/systems\/pvp-auto-reducer\.js\?v=1/,'reducer must be lazy-loaded with PvP feature pack');
const pvpIndex=registry.indexOf("pvp:{dependencies:");
const reducerIndex=registry.indexOf("src/systems/pvp-auto-reducer.js?v=1");
assert.ok(pvpIndex>=0&&reducerIndex>pvpIndex,'reducer must belong to PvP feature definition');

assert.match(doc,/system-id:\s*pvp-auto-reducer/i,'technical doc must declare system identity');
assert.match(doc,/owner:\s*KeloPvPAutoReducer/i,'technical doc must declare owner identity');
assert.match(doc,/##\s+Estado que NO posee/i,'technical doc must state forbidden ownership explicitly');
assert.match(doc,/No crea `requestAnimationFrame`, `setInterval` ni segundo loop/i,'technical doc must forbid parallel schedulers');
assert.match(doc,/presentation-only/i,'technical doc must declare presentation-only failure boundary');

console.log('PVP_AUTO_REDUCER_AUDIT_OK: owner-native adaptive presentation protection verified');
