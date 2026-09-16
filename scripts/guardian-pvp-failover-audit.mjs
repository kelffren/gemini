/* KELO-INDEX
 * area: QA / GUARDIAN PVP FAILOVER
 * keys: GUARDIAN PVP FAILOVER LIVE IOS LEASE EPOCH SNAPSHOT DRIFT AUTH CLEANUP PRUNE CACHE PAGE_BUILD
 * purpose: gate estático del laboratorio A->B y de los contratos de producción que necesita para medir failover real
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');

const testSource=read('tests/guardian-pvp-failover-live.spec.js');
const workflow=read('.github/workflows/guardian-pvp-failover-live.yml');
const browserstack=read('browserstack.guardian-failover.yml');
const guardian=read('src/systems/guardian-system.js');
const host=read('src/systems/guardian-pvp-host.js');
const worker=read('src/workers/guardian-pvp-authority-worker.js');
const adapter=read('src/systems/guardian-pvp-net-adapter.js');
const registry=read('src/core/feature-registry.js');

assert.match(guardian,/startMasterHost/);
assert.match(guardian,/stopMasterHost/);
assert.match(guardian,/pc\.onconnectionstatechange/);
assert.match(guardian,/createDataChannel\('kelo-guardian',\{ordered:true\}\)/);
assert.match(guardian,/masterLeaseExpiresAt/);

assert.match(host,/lastSnapshotEpoch/);
assert.match(host,/TAKEOVER_MAX_AGE_MS=7000/);
assert.match(host,/MAX_INPUTS_PER_SECOND=90/);
assert.match(host,/WORKER_URL='src\/workers\/guardian-pvp-authority-worker\.js\?v=3-takeover-prune'/);
assert.match(host,/restoredActorPrune:true/);
assert.match(host,/RESTORED_ACTOR_RECLAIM_MS=5000/);
assert.match(host,/kelo:guardian-pvp-pruned/);
assert.match(host,/staleRestoredPlayersPruned/);
assert.match(host,/isolatedWorker:true/);
assert.match(host,/centralAuthorityPriority:true/);

assert.match(worker,/guardian-pvp-authority-worker-v3-takeover-prune/);
assert.match(worker,/takeoverRestore:true/);
assert.match(worker,/projectilesReset:true/);
assert.match(worker,/transientActionsReset:true/);
assert.match(worker,/RESTORED_ACTOR_RECLAIM_MS=5000/);
assert.match(worker,/pendingRestoredActors/);
assert.match(worker,/pruneUnclaimedRestored/);
assert.match(worker,/authority\.unregister\(actorId\)/);
assert.match(worker,/restoredActorPrune:true/);
assert.doesNotMatch(worker,/setInterval|setTimeout/);
assert.match(adapter,/takeoverSequenceResync:true/);

assert.match(registry,/kelo-feature-registry-v2\.5\.1-guardian-pvp-worker-prune/);
assert.match(registry,/guardian-pvp-host\.js\?v=4-worker-prune/);

assert.match(testSource,/KELO_GUARDIAN_TEST_ADMIN_EMAIL/);
assert.match(testSource,/KELO_GUARDIAN_TEST_DONOR_EMAIL/);
assert.match(testSource,/guardian-pvp-host\.js\?v=4-worker-prune/);
assert.match(testSource,/await contextA\.close\(\);contextA=null;pageA=null/);
assert.match(testSource,/lease is deliberately NOT released through stopMasterHost/);
assert.match(testSource,/newEpoch.*toBeGreaterThan\(oldEpoch\)/s);
assert.match(testSource,/positionDriftPx/);
assert.match(testSource,/blockedInputsDuringOutage/);
assert.match(testSource,/playersRestored/);
assert.match(testSource,/staleMasterActorPruned/);
assert.match(testSource,/staleRestoredPlayersPruned/);
assert.match(testSource,/kelo:guardian-pvp-pruned/);
assert.match(testSource,/!last\.players\?\.\[aActorId\]/);
assert.match(testSource,/transientActionsReset/);
assert.match(testSource,/projectilesReset/);
assert.match(testSource,/guardian_master_stop/);
assert.match(testSource,/guardian_disable/);
assert.match(testSource,/KELO_FAILOVER_REAL_IOS/);
assert.match(testSource,/chromium\.launch/);
assert.match(testSource,/guardianPvpFailoverLab/);
assert.doesNotMatch(testSource,/console\.log\([^\n]*(access_token|refresh_token|PASSWORD|password)/i);

assert.match(browserstack,/deviceName: iPhone 14 Pro/);
assert.match(browserstack,/osVersion: 26/);
assert.match(browserstack,/browserName: safari/);
assert.match(browserstack,/GuardianPvPFailoverRealIOS/);

assert.match(workflow,/Guardian PvP Failover LIVE/);
assert.match(workflow,/\n  page_build:\n/);
assert.doesNotMatch(workflow,/workflow_run:/);
assert.match(workflow,/pages: read/);
assert.match(workflow,/Wait until Pages serves this build or a descendant/);
assert.match(workflow,/pages\/builds\/latest/);
assert.match(workflow,/BROWSERSTACK_USERNAME/);
assert.match(workflow,/KELO_GUARDIAN_TEST_ADMIN_EMAIL/);
assert.match(workflow,/KELO_GUARDIAN_TEST_DONOR_EMAIL/);
assert.match(workflow,/node scripts\/guardian-pvp-failover-audit\.mjs/);
assert.match(workflow,/node --check tests\/guardian-pvp-failover-live\.spec\.js/);
assert.match(workflow,/KELO_FAILOVER_REAL_IOS: '1'/);
assert.match(workflow,/browserstack\.guardian-failover\.yml/);
assert.match(workflow,/playwright install --with-deps chromium/);
assert.match(workflow,/guardian-pvp-failover-live\.spec\.js/);

console.log('GUARDIAN_PVP_FAILOVER_AUDIT_OK',{
  abruptMasterLoss:true,
  leaseEpochTakeover:true,
  physicalIosMaster:true,
  secondConcurrentNode:true,
  snapshotGapMeasured:true,
  positionDriftMeasured:true,
  blockedInputsMeasured:true,
  staleRestoredActorPrune:true,
  restoredActorReclaimMs:5000,
  workerCacheVersioned:true,
  liveGhostCleanupAsserted:true,
  pagesTrigger:'page_build',
  deploymentBarrier:true,
  persistentAuthority:false,
  economyAuthority:false
});
