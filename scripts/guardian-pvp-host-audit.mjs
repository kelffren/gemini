/* KELO-INDEX
 * area: QA / GUARDIAN PVP
 * keys: GUARDIAN PVP SHARED AUTHORITY PARITY FIXED STEP LEASE DOUBLE AUTHORITY FIRST USE TAKEOVER RATE LIMIT EPOCH CACHE SEQUENCE WORKER PRUNE
 * purpose: smoke test del core compartido y contratos del host Worker/adaptador Guardian, incluido relevo seguro de Master y poda de actores restaurados no reclamados
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const root=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');

const sharedSource=read('src/systems/pvp/shared-pvp-authority.js');
const serverSource=read('server/pvp-authority.js');
const hostSource=read('src/systems/guardian-pvp-host.js');
const workerSource=read('src/workers/guardian-pvp-authority-worker.js');
const adapterSource=read('src/systems/guardian-pvp-net-adapter.js');
const uiSource=read('src/ui/guardian-pvp-ui.js');
const registrySource=read('src/core/feature-registry.js');

// Match executable access/calls instead of bare words so documentation such as
// "NO localStorage" cannot create a false positive.
const forbiddenStorage=/\blocalStorage\s*[.[]|\bindexedDB\s*[.[]|\bfetch\s*\(/;
const forbiddenWorkerIo=/\bsetInterval\s*\(|\bsetTimeout\s*\(|\blocalStorage\s*[.[]|\bindexedDB\s*[.[]|\bfetch\s*\(|\bXMLHttpRequest\s*\(|\bnew\s+WebSocket\b|\bnew\s+RTCPeerConnection\b|\bdocument\s*\./;

assert.match(sharedSource,/KeloSharedPvPAuthority/);
assert.match(sharedSource,/module\.exports/);
assert.match(sharedSource,/FIXED_DT=1\/60/);
assert.match(sharedSource,/persistentAuthority:false/);
assert.match(sharedSource,/economyAuthority:false/);
assert.doesNotMatch(sharedSource,forbiddenStorage);

assert.match(serverSource,/shared-pvp-authority\.js/);
assert.doesNotMatch(serverSource,/function step\s*\(/);
assert.doesNotMatch(serverSource,/function resolveMelee\s*\(/);

assert.match(hostSource,/guardian-pvp-authority-worker\.js\?v=3-takeover-prune/);
assert.match(hostSource,/new root\.Worker/);
assert.doesNotMatch(hostSource,/KeloSharedPvPAuthority\.createPvpAuthority/);
assert.match(hostSource,/KeloSimulation\.after\('guardian:pvp-host'/);
assert.match(hostSource,/MAX_CATCHUP_STEPS=5/);
assert.match(hostSource,/MAX_INPUTS_PER_SECOND=90/);
assert.match(hostSource,/TAKEOVER_MAX_AGE_MS=7000/);
assert.match(hostSource,/RESTORED_ACTOR_RECLAIM_MS=5000/);
assert.match(hostSource,/takeoverSeedFor/);
assert.match(hostSource,/takeoversRestored/);
assert.match(hostSource,/playersRestored/);
assert.match(hostSource,/transientActionsReset/);
assert.match(hostSource,/projectilesReset/);
assert.match(hostSource,/staleRestoredPlayersPruned/);
assert.match(hostSource,/kelo:guardian-pvp-pruned/);
assert.match(hostSource,/lastSnapshotEpoch/);
assert.match(hostSource,/msgEpoch!==lastSnapshotEpoch/);
assert.match(hostSource,/masterValid\(msg\.epoch\)/);
assert.match(hostSource,/KeloGuardianPvPNetAdapter\?\.baseAuthority/);
assert.doesNotMatch(hostSource,/KeloGuardianPvPNetAdapter\?\.state\?\.\(\)\.centralOnline/);
assert.match(hostSource,/isolatedWorker:true/);
assert.match(hostSource,/statusRealmIsolated:true/);
assert.match(hostSource,/restoredActorPrune:true/);
assert.match(hostSource,/persistentAuthority:false/);
assert.match(hostSource,/economyAuthority:false/);
assert.match(hostSource,/inventoryAuthority:false/);
assert.match(hostSource,/rewardsAuthority:false/);
assert.doesNotMatch(hostSource,/\bsetInterval\s*\(|\blocalStorage\s*[.[]|\bindexedDB\s*[.[]/);

assert.match(workerSource,/importScripts\(/);
assert.match(workerSource,/shared-pvp-authority\.js\?v=1/);
assert.match(workerSource,/KeloSharedPvPAuthority\.createPvpAuthority/);
assert.match(workerSource,/function restoreSeed/);
assert.match(workerSource,/function restorePlayer/);
assert.match(workerSource,/KeloStatusEffects\.apply/);
assert.match(workerSource,/pendingRestoredActors/);
assert.match(workerSource,/function pruneUnclaimedRestored/);
assert.match(workerSource,/authority\.unregister/);
assert.match(workerSource,/RESTORED_ACTOR_RECLAIM_MS=5000/);
assert.match(workerSource,/staleRestoredPlayersPruned/);
assert.match(workerSource,/tickOffset/);
assert.match(workerSource,/takeoverRestored/);
assert.match(workerSource,/restoredActorPrune:true/);
assert.match(workerSource,/transientActionsReset:true/);
assert.match(workerSource,/projectilesReset:true/);
assert.match(workerSource,/persistentAuthority:false/);
assert.match(workerSource,/economyAuthority:false/);
assert.match(workerSource,/inventoryAuthority:false/);
assert.match(workerSource,/rewardsAuthority:false/);
assert.doesNotMatch(workerSource,forbiddenWorkerIo);

assert.match(adapterSource,/GUARDIAN_PVP_DOUBLE_AUTHORITY_BLOCKED/);
assert.match(adapterSource,/GUARDIAN_PVP_CENTRAL_SERVER_RETURNED/);
assert.match(adapterSource,/base\.sendCombatIntent/);
assert.match(adapterSource,/KeloSimulation\.after\('guardian:pvp-net-adapter'/);
assert.match(adapterSource,/sequence=Math\.max\(sequence,lastAck\+1\)/);
assert.match(adapterSource,/sequenceResyncs/);
assert.match(adapterSource,/kelo:guardian-pvp-reject/);
assert.match(adapterSource,/kelo:guardian-pvp-takeover/);
assert.match(adapterSource,/takeoverSequenceResync:true/);
assert.doesNotMatch(adapterSource,/\bsetInterval\s*\(/);

assert.match(uiSource,/INICIAR PVP LAB/);
assert.match(uiSource,/SERVIDOR CENTRAL ACTIVO/);
assert.match(uiSource,/mutationLoopGuard:true/);
assert.match(uiSource,/permissionGrant:false/);

const order=[
 'src/systems/guardian-pvp-host.js?v=4-worker-prune',
 'engine-net.js?v=20260916-pvp-first-use-1',
 'src/systems/guardian-pvp-net-adapter.js?v=2-takeover',
 'src/systems/pvp-world.js?v=20260916-pvp-first-use-1',
 'src/ui/guardian-pvp-ui.js?v=2-mobile-safe'
].map(x=>registrySource.indexOf(x));
assert.ok(order.every(n=>n>=0),'Guardian PvP files must exist in registry');
for(let i=1;i<order.length;i++)assert.ok(order[i]>order[i-1],`Guardian PvP load order invalid at ${i}`);
assert.doesNotMatch(registrySource,/src\/systems\/pvp\/shared-pvp-authority\.js\?v=1/);
assert.match(registrySource,/kelo-feature-registry-v2\.5\.1-guardian-pvp-worker-prune/);

const pvp=require('../server/pvp-authority.js');
assert.equal(pvp.FIXED_DT,1/60);
const authority=pvp.createPvpAuthority();
const a={id:'audit-a',name:'A'},b={id:'audit-b',name:'B'};
assert.equal(authority.ingest(a,{sequence:1,action:'enter_pvp',phase:'none',moveX:0,moveY:0,aimX:1,aimY:0,clientTime:Date.now()}).ok,true);
assert.equal(authority.ingest(b,{sequence:1,action:'enter_pvp',phase:'none',moveX:0,moveY:0,aimX:-1,aimY:0,clientTime:Date.now()}).ok,true);
const before=authority.snapshot(Date.now()).players['audit-a'];
assert.ok(before&&before.zone==='pvp');
assert.equal(authority.ingest(a,{sequence:2,action:'input',phase:'held',moveX:1,moveY:0,aimX:1,aimY:0,clientTime:Date.now()}).ok,true);
for(let i=0;i<12;i++)authority.step(pvp.FIXED_DT,Date.now()+i*17);
const after=authority.snapshot(Date.now()).players['audit-a'];
assert.ok(after.x>before.x,'shared authority must advance movement');
const stale=authority.ingest(a,{sequence:2,action:'input',phase:'held',moveX:0,moveY:0,aimX:1,aimY:0,clientTime:Date.now()});
assert.equal(stale.ok,false);
assert.equal(stale.reason,'STALE_SEQUENCE');
assert.equal(authority.audit().persistentAuthority,false);
assert.equal(authority.audit().economyAuthority,false);
authority.dispose();

console.log('GUARDIAN_PVP_HOST_AUDIT_OK',{fixedDt:pvp.FIXED_DT,workerIsolated:true,doubleAuthorityBlocked:true,takeoverRestore:true,restoredActorPrune:true,restoredActorReclaimMs:5000,inputRateLimit:90,snapshotEpochFenced:true,sequenceResync:true,cacheVersioned:true,persistentAuthority:false});