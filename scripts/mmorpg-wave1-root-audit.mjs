/* KELO-INDEX
 * area: MMORPG / WAVE 1 QA
 * owner: Main Stability Gate
 * purpose: prove the nine Wave 1 root owners enforce authority, replay, hysteresis, permissions, versioning and LiveOps invariants
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  WAVE1_SYSTEM_IDS,
  createMMOWave1RootSystems
} from '../src/mmorpg/wave1-root-systems.mjs';

const manifest = JSON.parse(fs.readFileSync('docs/mmorpg-community-systems.json', 'utf8'));
const manifestWave1 = manifest.systems.filter(row => row.wave === 1).map(row => row.id).sort();
assert.deepEqual([...WAVE1_SYSTEM_IDS].sort(), manifestWave1, 'Wave 1 owner list must exactly match manifest wave=1');
assert.equal(WAVE1_SYSTEM_IDS.length, 9, 'Wave 1 must contain exactly nine root systems');

let now = Date.parse('2026-09-17T00:00:00Z');
const roots = createMMOWave1RootSystems({ clock: () => now++ });

// 01 World Partition — stable IDs, exclusive owner, transfer epoch, load/unload.
const c0 = roots.partition.migrationSafeId({ realm: 'world', cx: 0, cy: 0 });
assert.equal(c0, 'world:0:0');
assert.equal(roots.partition.cellForPosition({ x: 100, y: 100 }), c0);
let claimed = roots.partition.claim(c0, 'authority-a');
assert.equal(claimed.authorityId, 'authority-a');
assert.equal(claimed.authorityEpoch, 1);
assert.throws(() => roots.partition.claim(c0, 'authority-b'), /CELL_ALREADY_OWNED/);
roots.partition.beginLoad(c0, 'runtime-a');
assert.deepEqual(roots.partition.describe(c0).loadedBy, ['runtime-a']);
roots.partition.endLoad(c0, 'runtime-a');
claimed = roots.partition.transfer(c0, 'authority-a', 'authority-b');
assert.equal(claimed.authorityId, 'authority-b');
assert.equal(claimed.authorityEpoch, 2);

// 04 AOI — nearby entities enter; hysteresis keeps membership until exit radius is crossed.
roots.aoi.upsertEntity({ id: 'near', x: 100, y: 100, realm: 'world' });
roots.aoi.upsertEntity({ id: 'edge', x: 2500, y: 100, realm: 'world' });
roots.aoi.upsertEntity({ id: 'far', x: 12000, y: 100, realm: 'world' });
let view = roots.aoi.updateViewer({ viewerId: 'player-1', x: 100, y: 100 });
assert.ok(view.entityIds.includes('near'));
assert.ok(view.entityIds.includes('edge'));
assert.ok(!view.entityIds.includes('far'));
view = roots.aoi.updateViewer({ viewerId: 'player-1', x: 4100, y: 100 });
assert.ok(view.entityIds.includes('edge'), 'AOI hysteresis should retain relevant prior membership inside exit radius');

// 05 Authority replication — intents do not write protected state; commits require owner/version.
roots.replication.register({ entityId: 'player-1', authorityId: 'authority-b', state: { hp: 100, x: 0 } });
assert.deepEqual(roots.replication.clientPatchGuard({ x: 5 }), { ok: true, forbidden: [] });
const guarded = roots.replication.clientPatchGuard({ hp: 9999, currency: 1000000 });
assert.equal(guarded.ok, false);
assert.deepEqual(guarded.forbidden, ['currency', 'hp']);
roots.replication.submitIntent({ entityId: 'player-1', actorId: 'player-1', opId: 'move-1', intent: { moveX: 1 } });
assert.equal(roots.replication.snapshot('player-1').state.hp, 100, 'client intent must not mutate authority state');
assert.throws(() => roots.replication.commit({ entityId: 'player-1', authorityId: 'client', opId: 'hack', expectedVersion: 1, patch: { hp: 999 } }), /AUTHORITY_DENIED/);
let replicated = roots.replication.commit({ entityId: 'player-1', authorityId: 'authority-b', opId: 'damage-1', expectedVersion: 1, patch: { hp: 80 } });
assert.equal(replicated.entry.result.version, 2);
assert.equal(roots.replication.snapshot('player-1').state.hp, 80);
assert.throws(() => roots.replication.commit({ entityId: 'player-1', authorityId: 'authority-b', opId: 'stale', expectedVersion: 1, patch: { hp: 70 } }), /ENTITY_VERSION_CONFLICT/);

// 08 Ledger — append-only/idempotent and replayable.
const firstEvent = roots.ledger.append({ eventId: 'evt-1', cellId: c0, aggregateId: 'world', type: 'test', payload: { n: 1 } });
const replayedEvent = roots.ledger.append({ eventId: 'evt-1', cellId: c0, aggregateId: 'world', type: 'test', payload: { n: 999 } });
assert.equal(firstEvent.replay, false);
assert.equal(replayedEvent.replay, true);
assert.equal(roots.ledger.lastSequence(), 1);
assert.equal(roots.ledger.replay({ cellId: c0 })[0].payload.n, 1);

// 07 Persistent World State — authority-owned revision CAS + reconstruction from ledger.
let mutation = roots.worldState.mutate({ cellId: c0, authorityId: 'authority-b', mutationId: 'world-1', expectedRevision: 0, patch: { treeCount: 2 } });
assert.equal(mutation.snapshot.revision, 1);
assert.equal(mutation.snapshot.state.treeCount, 2);
assert.throws(() => roots.worldState.mutate({ cellId: c0, authorityId: 'authority-a', mutationId: 'world-bad', expectedRevision: 1, patch: { treeCount: 9 } }), /WORLD_CELL_AUTHORITY_DENIED/);
mutation = roots.worldState.mutate({ cellId: c0, authorityId: 'authority-b', mutationId: 'world-2', expectedRevision: 1, patch: { fountainOpen: true } });
assert.equal(mutation.snapshot.revision, 2);
const restored = roots.worldState.restore({ cellId: c0 });
assert.equal(restored.revision, 2);
assert.deepEqual(restored.state, { treeCount: 2, fountainOpen: true });

// 16 Identity & Reputation — stable identity; client/self claims cannot inflate trust.
roots.identities.register({ creatorId: 'creator-a', accountId: 'acct-a', displayName: 'A' });
assert.throws(() => roots.identities.recordSignal({ creatorId: 'creator-a', source: 'client', kind: 'trust-me', weight: 10 }), /UNTRUSTED_REPUTATION_SOURCE/);
const trustedCreator = roots.identities.recordSignal({ creatorId: 'creator-a', source: 'publish', kind: 'clean-publish', weight: 10, evidence: { revisionId: 'rev-1' } });
assert.equal(trustedCreator.trustTier, 'established');

// 17 Creator Permissions — only an admin-authorized path can assign/grant.
assert.throws(() => roots.permissions.assignRole({ creatorId: 'creator-a', role: 'builder', actorCanAdmin: false }), /PERMISSION_ADMIN_REQUIRED/);
roots.permissions.assignRole({ creatorId: 'creator-a', role: 'builder', actorCanAdmin: true });
assert.equal(roots.permissions.can('creator-a', 'creator.build'), true);
assert.equal(roots.permissions.can('creator-a', 'creator.publish'), false);

// Add reviewer to exercise merge permissions.
roots.permissions.assignRole({ creatorId: 'creator-a', role: 'reviewer', actorCanAdmin: true });

// 19 World Version Control — immutable commits, fork, three-way merge and restore.
const base = roots.versionControl.commit({ worldId: 'world-main', creatorId: 'creator-a', payload: { plaza: 1, forest: 1 }, message: 'base' });
roots.versionControl.fork({ worldId: 'world-main', branch: 'feature', creatorId: 'creator-a' });
roots.versionControl.commit({ worldId: 'world-main', branch: 'feature', creatorId: 'creator-a', expectedHead: base.revisionId, payload: { plaza: 1, forest: 2 }, message: 'forest' });
roots.versionControl.commit({ worldId: 'world-main', branch: 'main', creatorId: 'creator-a', expectedHead: base.revisionId, payload: { plaza: 2, forest: 1 }, message: 'plaza' });
const merged = roots.versionControl.merge({ worldId: 'world-main', sourceBranch: 'feature', targetBranch: 'main', creatorId: 'creator-a' });
assert.equal(merged.merged, true);
assert.deepEqual(merged.revision.payload, { forest: 2, plaza: 2 });
const restoredVersion = roots.versionControl.restore({ worldId: 'world-main', revisionId: base.revisionId, creatorId: 'creator-a' });
assert.deepEqual(restoredVersion.payload, { forest: 1, plaza: 1 });

// 59 Trust + LiveOps — kill switch, incidents, trust signals and auditable admin actions.
roots.liveOps.flags.define('community-publish', { enabled: true, rollout: 10, killSwitch: true });
roots.liveOps.openIncident({ incidentId: 'inc-1', kind: 'ugc-abuse', actorId: 'admin' });
roots.liveOps.setTrustSignal({ subjectId: 'creator-a', signal: 'abuse-probe', severity: -5, source: 'moderation', actorId: 'admin' });
const killed = roots.liveOps.emergencyDisable({ flagId: 'community-publish', actorId: 'admin', reason: 'inc-1' });
assert.equal(killed.enabled, false);
assert.equal(killed.rollout, 0);
roots.liveOps.closeIncident({ incidentId: 'inc-1', actorId: 'admin', resolution: { action: 'contained' } });
assert.ok(roots.liveOps.audit().length >= 4);
assert.equal(roots.liveOps.incidents()[0].state, 'closed');

console.log(`MMORPG WAVE1 ROOT AUDIT PASS systems=${WAVE1_SYSTEM_IDS.length} partition=ok aoi=ok authority=ok persistence=ok ledger=ok identity=ok permissions=ok versioning=ok liveops=ok`);
