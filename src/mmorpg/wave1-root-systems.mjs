/* KELO-INDEX
 * area: MMORPG / COMMUNITY PLATFORM / WAVE 1 ROOTS
 * owner: Kelo MMO Community Platform
 * owns: concrete Wave 1 root owners built on community-platform-foundation
 * does-not-own: render, movement, combat presentation, commerce, or existing persistence transports
 * rule: protected state is authority-written; creator/publication state is attributable and reversible
 */
import {
  createEventBus,
  createIdempotencyLedger,
  createCapabilityGate,
  createVersionStore,
  createWorldGrid,
  createAOIIndex,
  createFeatureFlagPlane
} from './community-platform-foundation.mjs';

const F = Object.freeze;
const clone = value => value == null ? value : (typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value)));
const id = (value, code = 'ID_REQUIRED') => { const out = String(value || '').trim(); if (!out) throw new Error(code); return out; };
const iso = clock => new Date(clock()).toISOString();
const stableCellKey = (realm, cx, cy) => `${String(realm || 'world')}:${Number(cx) || 0}:${Number(cy) || 0}`;

export const WAVE1_SYSTEM_IDS = F([
  'world-partition',
  'area-of-interest',
  'authoritative-entity-replication',
  'persistent-world-state',
  'world-event-ledger',
  'creator-identity-reputation',
  'creator-permissions',
  'world-version-control',
  'mmo-trust-liveops-control-plane'
]);

export function createWorldPartitionSystem({ grid = createWorldGrid(), clock = Date.now, eventBus = createEventBus() } = {}) {
  const cells = new Map();
  const ensure = cellId => {
    const key = id(cellId, 'CELL_ID_REQUIRED');
    if (!cells.has(key)) cells.set(key, { cellId: key, authorityId: null, authorityEpoch: 0, loadedBy: new Set(), updatedAt: iso(clock) });
    return cells.get(key);
  };
  const describe = cellId => {
    const row = ensure(cellId);
    return F({ cellId: row.cellId, authorityId: row.authorityId, authorityEpoch: row.authorityEpoch, loadedBy: F([...row.loadedBy].sort()), updatedAt: row.updatedAt });
  };
  return F({
    version: 'kelo-world-partition-v1',
    grid,
    cellForPosition({ x, y, realm = 'world' }) { return grid.cellId(x, y, realm); },
    claim(cellId, authorityId, { expectedAuthority = undefined } = {}) {
      const row = ensure(cellId), next = id(authorityId, 'AUTHORITY_ID_REQUIRED');
      if (expectedAuthority !== undefined && row.authorityId !== expectedAuthority) throw new Error(`CELL_AUTHORITY_CONFLICT:${row.cellId}`);
      if (row.authorityId && row.authorityId !== next) throw new Error(`CELL_ALREADY_OWNED:${row.cellId}:${row.authorityId}`);
      if (row.authorityId !== next) row.authorityEpoch += 1;
      row.authorityId = next; row.updatedAt = iso(clock);
      eventBus.emit('kelo:mmorpg:cell-claimed', { cellId: row.cellId, authorityId: next, authorityEpoch: row.authorityEpoch });
      return describe(row.cellId);
    },
    transfer(cellId, fromAuthorityId, toAuthorityId) {
      const row = ensure(cellId), from = id(fromAuthorityId, 'FROM_AUTHORITY_REQUIRED'), to = id(toAuthorityId, 'TO_AUTHORITY_REQUIRED');
      if (row.authorityId !== from) throw new Error(`CELL_TRANSFER_STALE_OWNER:${row.cellId}`);
      row.authorityId = to; row.authorityEpoch += 1; row.updatedAt = iso(clock);
      eventBus.emit('kelo:mmorpg:cell-transferred', { cellId: row.cellId, fromAuthorityId: from, toAuthorityId: to, authorityEpoch: row.authorityEpoch });
      return describe(row.cellId);
    },
    release(cellId, authorityId) {
      const row = ensure(cellId), owner = id(authorityId, 'AUTHORITY_ID_REQUIRED');
      if (row.authorityId !== owner) throw new Error(`CELL_RELEASE_NOT_OWNER:${row.cellId}`);
      row.authorityId = null; row.authorityEpoch += 1; row.updatedAt = iso(clock);
      eventBus.emit('kelo:mmorpg:cell-released', { cellId: row.cellId, authorityId: owner, authorityEpoch: row.authorityEpoch });
      return describe(row.cellId);
    },
    beginLoad(cellId, consumerId) { const row = ensure(cellId); row.loadedBy.add(id(consumerId, 'CONSUMER_ID_REQUIRED')); row.updatedAt = iso(clock); return describe(row.cellId); },
    endLoad(cellId, consumerId) { const row = ensure(cellId); row.loadedBy.delete(String(consumerId)); row.updatedAt = iso(clock); return describe(row.cellId); },
    describe,
    list: () => [...cells.keys()].sort().map(describe),
    migrationSafeId({ realm = 'world', cx, cy }) { return stableCellKey(realm, cx, cy); }
  });
}

export function createAreaOfInterestSystem({ grid = createWorldGrid(), enterRadiusCells = 1, exitRadiusCells = 2 } = {}) {
  const index = createAOIIndex({ grid, radiusCells: enterRadiusCells });
  const viewers = new Map();
  const radius = value => Math.max(0, Math.floor(Number(value) || 0));
  const enterR = radius(enterRadiusCells), exitR = Math.max(enterR, radius(exitRadiusCells));
  const cellDistance = (a, b) => {
    const parse = value => { const parts = String(value).split(':'); return { x: Number(parts.at(-2)), y: Number(parts.at(-1)), realm: parts.slice(0, -2).join(':') }; };
    const A = parse(a), B = parse(b); if (A.realm !== B.realm) return Infinity; return Math.max(Math.abs(A.x - B.x), Math.abs(A.y - B.y));
  };
  return F({
    version: 'kelo-area-of-interest-v1',
    upsertEntity: entity => index.upsert(entity),
    removeEntity: entityId => index.remove(entityId),
    updateViewer({ viewerId, x, y, realm = 'world', predicate = null }) {
      const key = id(viewerId, 'VIEWER_ID_REQUIRED'), viewerCell = grid.cellId(x, y, realm), previous = viewers.get(key) || new Set();
      const entering = new Set(index.query({ x, y, realm, radius: enterR, predicate }).map(row => row.id));
      const keep = new Set();
      for (const entityId of previous) {
        const entity = index.query({ x, y, realm, radius: exitR, predicate: row => row.id === entityId })[0];
        if (entity && cellDistance(viewerCell, entity.cellId) <= exitR) keep.add(entityId);
      }
      const next = new Set([...entering, ...keep]);
      const added = [...next].filter(entityId => !previous.has(entityId));
      const removed = [...previous].filter(entityId => !next.has(entityId));
      viewers.set(key, next);
      return F({ viewerId: key, viewerCell, entityIds: F([...next].sort()), added: F(added.sort()), removed: F(removed.sort()) });
    },
    removeViewer(viewerId) { return viewers.delete(String(viewerId)); },
    subscriptions(viewerId) { return F([...(viewers.get(String(viewerId)) || [])].sort()); },
    stats: () => F({ ...index.stats(), viewers: viewers.size, enterRadiusCells: enterR, exitRadiusCells: exitR })
  });
}

export function createAuthoritativeEntityReplication({ clock = Date.now, eventBus = createEventBus(), idempotency = createIdempotencyLedger() } = {}) {
  const entities = new Map();
  const protectedRoots = new Set(['hp', 'mana', 'currency', 'inventory', 'equipment', 'xp', 'level', 'loot', 'positionAuthority']);
  const register = ({ entityId, authorityId, state = {}, version = 1 }) => {
    const entity = id(entityId, 'ENTITY_ID_REQUIRED'), authority = id(authorityId, 'AUTHORITY_ID_REQUIRED');
    if (entities.has(entity)) throw new Error(`ENTITY_EXISTS:${entity}`);
    const row = { entityId: entity, authorityId: authority, version: Math.max(1, Number(version) || 1), state: clone(state), updatedAt: iso(clock) };
    entities.set(entity, row); return clone(row);
  };
  const snapshot = entityId => clone(entities.get(String(entityId)) || null);
  return F({
    version: 'kelo-authoritative-entity-replication-v1', register, snapshot,
    submitIntent({ entityId, actorId, opId, intent }) {
      const row = entities.get(id(entityId, 'ENTITY_ID_REQUIRED')); if (!row) throw new Error('ENTITY_UNKNOWN');
      const key = id(opId, 'OP_ID_REQUIRED');
      return idempotency.run(`intent:${row.entityId}:${key}`, () => F({ entityId: row.entityId, actorId: id(actorId, 'ACTOR_ID_REQUIRED'), intent: clone(intent), observedVersion: row.version, acceptedAt: iso(clock) }));
    },
    commit({ entityId, authorityId, opId, expectedVersion, patch = {} }) {
      const row = entities.get(id(entityId, 'ENTITY_ID_REQUIRED')); if (!row) throw new Error('ENTITY_UNKNOWN');
      if (row.authorityId !== id(authorityId, 'AUTHORITY_ID_REQUIRED')) throw new Error(`AUTHORITY_DENIED:${row.entityId}`);
      if (Number(expectedVersion) !== row.version) throw new Error(`ENTITY_VERSION_CONFLICT:${row.entityId}:${row.version}`);
      const key = id(opId, 'OP_ID_REQUIRED');
      return idempotency.run(`commit:${row.entityId}:${key}`, () => {
        row.state = { ...row.state, ...clone(patch) }; row.version += 1; row.updatedAt = iso(clock);
        const out = snapshot(row.entityId); eventBus.emit('kelo:mmorpg:entity-authority-commit', out); return out;
      });
    },
    clientPatchGuard(patch = {}) {
      const forbidden = Object.keys(patch).filter(key => protectedRoots.has(String(key)));
      return F({ ok: forbidden.length === 0, forbidden: F(forbidden.sort()) });
    },
    transferAuthority(entityId, fromAuthorityId, toAuthorityId) {
      const row = entities.get(id(entityId, 'ENTITY_ID_REQUIRED')); if (!row) throw new Error('ENTITY_UNKNOWN');
      if (row.authorityId !== id(fromAuthorityId, 'FROM_AUTHORITY_REQUIRED')) throw new Error(`AUTHORITY_TRANSFER_STALE:${row.entityId}`);
      row.authorityId = id(toAuthorityId, 'TO_AUTHORITY_REQUIRED'); row.version += 1; row.updatedAt = iso(clock); return snapshot(row.entityId);
    },
    list: () => [...entities.keys()].sort().map(snapshot)
  });
}

export function createWorldEventLedger({ clock = Date.now, idempotency = createIdempotencyLedger() } = {}) {
  const rows = [];
  return F({
    version: 'kelo-world-event-ledger-v1',
    append({ eventId, cellId, aggregateId = 'world', type, payload = {}, actorId = 'system', revision = null }) {
      const key = id(eventId, 'EVENT_ID_REQUIRED');
      return idempotency.run(`world-event:${key}`, () => {
        const row = F({ sequence: rows.length + 1, eventId: key, cellId: id(cellId, 'CELL_ID_REQUIRED'), aggregateId: id(aggregateId, 'AGGREGATE_ID_REQUIRED'), type: id(type, 'EVENT_TYPE_REQUIRED'), payload: clone(payload), actorId: String(actorId || 'system'), revision, at: iso(clock) });
        rows.push(row); return row;
      });
    },
    replay({ cellId = null, aggregateId = null, afterSequence = 0, throughSequence = Infinity } = {}) {
      return rows.filter(row => row.sequence > Number(afterSequence || 0) && row.sequence <= Number(throughSequence || Infinity) && (!cellId || row.cellId === cellId) && (!aggregateId || row.aggregateId === aggregateId)).map(clone);
    },
    lastSequence: () => rows.length,
    audit: eventId => clone(rows.find(row => row.eventId === String(eventId)) || null)
  });
}

export function createPersistentWorldState({ partition, ledger = createWorldEventLedger(), clock = Date.now } = {}) {
  if (!partition) throw new Error('WORLD_PARTITION_REQUIRED');
  const cells = new Map();
  const read = cellId => clone(cells.get(String(cellId)) || { cellId: String(cellId), revision: 0, state: {}, updatedAt: null });
  return F({
    version: 'kelo-persistent-world-state-v1', ledger,
    read,
    mutate({ cellId, authorityId, mutationId, expectedRevision, patch = {}, aggregateId = 'world' }) {
      const owner = partition.describe(cellId); if (!owner.authorityId || owner.authorityId !== id(authorityId, 'AUTHORITY_ID_REQUIRED')) throw new Error(`WORLD_CELL_AUTHORITY_DENIED:${cellId}`);
      const current = read(cellId); if (Number(expectedRevision) !== current.revision) throw new Error(`WORLD_REVISION_CONFLICT:${cellId}:${current.revision}`);
      const next = F({ cellId: String(cellId), revision: current.revision + 1, state: F({ ...current.state, ...clone(patch) }), updatedAt: iso(clock) });
      const event = ledger.append({ eventId: mutationId, cellId, aggregateId, type: 'world.mutation', payload: { patch: clone(patch), resultingRevision: next.revision }, actorId: authorityId, revision: next.revision });
      if (event.replay) return F({ replay: true, snapshot: read(cellId), event: clone(event.entry?.result || event.entry) });
      cells.set(String(cellId), next); return F({ replay: false, snapshot: clone(next), event: clone(event.entry?.result || event.entry) });
    },
    restore({ cellId, throughSequence = Infinity }) {
      let state = {}, revision = 0;
      for (const event of ledger.replay({ cellId, throughSequence })) if (event.type === 'world.mutation') { state = { ...state, ...clone(event.payload.patch || {}) }; revision = Math.max(revision, Number(event.payload.resultingRevision) || 0); }
      const snapshot = F({ cellId: String(cellId), revision, state: F(state), updatedAt: iso(clock) }); cells.set(String(cellId), snapshot); return clone(snapshot);
    }
  });
}

export function createCreatorIdentityReputation({ clock = Date.now } = {}) {
  const creators = new Map();
  const trustedSources = new Set(['admin', 'moderation', 'playtest', 'publish', 'system']);
  const get = creatorId => clone(creators.get(String(creatorId)) || null);
  return F({
    version: 'kelo-creator-identity-reputation-v1',
    register({ creatorId, accountId, displayName = '', createdBy = 'system' }) {
      const key = id(creatorId, 'CREATOR_ID_REQUIRED'); if (creators.has(key)) return get(key);
      creators.set(key, { creatorId: key, accountId: id(accountId, 'ACCOUNT_ID_REQUIRED'), displayName: String(displayName || key), trustTier: 'new', reputation: 0, signals: [], createdBy: String(createdBy), createdAt: iso(clock) }); return get(key);
    },
    recordSignal({ creatorId, source, kind, weight = 0, evidence = {} }) {
      const row = creators.get(id(creatorId, 'CREATOR_ID_REQUIRED')); if (!row) throw new Error('CREATOR_UNKNOWN');
      const src = id(source, 'REPUTATION_SOURCE_REQUIRED'); if (!trustedSources.has(src)) throw new Error(`UNTRUSTED_REPUTATION_SOURCE:${src}`);
      const signal = F({ source: src, kind: id(kind, 'REPUTATION_KIND_REQUIRED'), weight: Math.max(-10, Math.min(10, Number(weight) || 0)), evidence: clone(evidence), at: iso(clock) });
      row.signals.push(signal); row.reputation = Math.max(-100, Math.min(100, row.signals.reduce((sum, item) => sum + item.weight, 0)));
      row.trustTier = row.reputation >= 40 ? 'trusted' : row.reputation >= 10 ? 'established' : row.reputation <= -20 ? 'restricted' : 'new'; return get(row.creatorId);
    },
    get,
    list: () => [...creators.keys()].sort().map(get)
  });
}

export function createCreatorPermissionSystem({ gate = createCapabilityGate(), identities } = {}) {
  if (!identities) throw new Error('CREATOR_IDENTITIES_REQUIRED');
  const roles = {
    builder: ['creator.build', 'creator.test'], reviewer: ['creator.review'], publisher: ['creator.publish'], moderator: ['creator.moderate'], admin: ['creator.build', 'creator.test', 'creator.review', 'creator.publish', 'creator.moderate', 'creator.permissions', 'creator.revenue']
  };
  for (const [role, caps] of Object.entries(roles)) gate.defineRole(role, caps);
  const assertCreator = creatorId => { if (!identities.get(creatorId)) throw new Error(`CREATOR_UNKNOWN:${creatorId}`); return String(creatorId); };
  return F({
    version: 'kelo-creator-permissions-v1',
    assignRole({ creatorId, role, actorCanAdmin = false }) { if (!actorCanAdmin) throw new Error('PERMISSION_ADMIN_REQUIRED'); return gate.assignRole(assertCreator(creatorId), id(role, 'ROLE_REQUIRED')); },
    grant({ creatorId, capability, actorCanAdmin = false }) { if (!actorCanAdmin) throw new Error('PERMISSION_ADMIN_REQUIRED'); return gate.grant(assertCreator(creatorId), capability); },
    revoke({ creatorId, capability, actorCanAdmin = false }) { if (!actorCanAdmin) throw new Error('PERMISSION_ADMIN_REQUIRED'); return gate.revoke(assertCreator(creatorId), capability); },
    can: (creatorId, capability) => Boolean(identities.get(creatorId)) && gate.can(String(creatorId), capability),
    require(creatorId, capability) { assertCreator(creatorId); return gate.require(String(creatorId), capability); },
    capabilities: creatorId => gate.capabilities(assertCreator(creatorId))
  });
}

export function createWorldVersionControl({ store = createVersionStore(), permissions = null } = {}) {
  const requireBuild = creatorId => permissions?.require?.(creatorId, 'creator.build');
  return F({
    version: 'kelo-world-version-control-v1',
    commit({ worldId, branch = 'main', payload, creatorId, message = '', expectedHead = undefined }) { requireBuild(creatorId); return store.commit({ objectId: id(worldId, 'WORLD_ID_REQUIRED'), branch, payload, authorId: id(creatorId, 'CREATOR_ID_REQUIRED'), message, expectedHead }); },
    fork({ worldId, from = 'main', branch, atRevision = null, creatorId }) { requireBuild(creatorId); return store.fork({ objectId: id(worldId, 'WORLD_ID_REQUIRED'), from, branch, atRevision }); },
    merge({ worldId, sourceBranch, targetBranch = 'main', creatorId, resolver = null }) { permissions?.require?.(creatorId, 'creator.review'); return store.merge({ objectId: id(worldId, 'WORLD_ID_REQUIRED'), sourceBranch, targetBranch, authorId: id(creatorId, 'CREATOR_ID_REQUIRED'), resolver }); },
    head: (worldId, branch = 'main') => store.head(String(worldId), branch),
    revision: revisionId => store.getRevision(revisionId),
    history: worldId => store.history(String(worldId)),
    branches: worldId => store.listBranches(String(worldId)),
    restore({ worldId, branch = 'main', revisionId, creatorId }) { requireBuild(creatorId); const revision = store.getRevision(id(revisionId, 'REVISION_ID_REQUIRED')); if (!revision || revision.objectId !== String(worldId)) throw new Error('REVISION_NOT_IN_WORLD'); return store.commit({ objectId: String(worldId), branch, payload: revision.payload, authorId: String(creatorId), message: `restore ${revisionId}`, expectedHead: store.head(String(worldId), branch) }); }
  });
}

export function createMMOTrustLiveOpsControlPlane({ clock = Date.now, eventBus = createEventBus(), flags = createFeatureFlagPlane({ eventBus }) } = {}) {
  const audit = [], trust = new Map(), incidents = new Map();
  const log = (action, actorId, detail = {}) => { const row = F({ seq: audit.length + 1, action, actorId: String(actorId || 'system'), detail: clone(detail), at: iso(clock) }); audit.push(row); return row; };
  return F({
    version: 'kelo-mmo-trust-liveops-v1', flags,
    setTrustSignal({ subjectId, signal, severity = 0, source = 'system', actorId = 'system' }) { const key = id(subjectId, 'SUBJECT_ID_REQUIRED'), row = { ...(trust.get(key) || { subjectId: key, score: 0, signals: [] }) }; const item = F({ signal: id(signal, 'TRUST_SIGNAL_REQUIRED'), severity: Math.max(-10, Math.min(10, Number(severity) || 0)), source: String(source), at: iso(clock) }); row.signals.push(item); row.score = Math.max(-100, Math.min(100, row.signals.reduce((sum, entry) => sum + entry.severity, 0))); trust.set(key, row); log('trust.signal', actorId, { subjectId: key, signal: item }); return clone(row); },
    trust: subjectId => clone(trust.get(String(subjectId)) || null),
    openIncident({ incidentId, kind, actorId = 'system', detail = {} }) { const key = id(incidentId, 'INCIDENT_ID_REQUIRED'); const row = { incidentId: key, kind: id(kind, 'INCIDENT_KIND_REQUIRED'), state: 'open', detail: clone(detail), openedAt: iso(clock), closedAt: null }; incidents.set(key, row); log('incident.open', actorId, row); return clone(row); },
    closeIncident({ incidentId, actorId = 'system', resolution = {} }) { const row = incidents.get(id(incidentId, 'INCIDENT_ID_REQUIRED')); if (!row) throw new Error('INCIDENT_UNKNOWN'); row.state = 'closed'; row.closedAt = iso(clock); row.resolution = clone(resolution); log('incident.close', actorId, row); return clone(row); },
    emergencyDisable({ flagId, actorId = 'system', reason = 'incident' }) { const result = flags.emergencyDisable(flagId, actorId, reason); log('flag.emergency-disable', actorId, { flagId, reason }); return result; },
    audit: ({ afterSeq = 0 } = {}) => audit.filter(row => row.seq > Number(afterSeq || 0)).map(clone),
    incidents: () => [...incidents.values()].map(clone)
  });
}

export function createMMOWave1RootSystems({ clock = Date.now } = {}) {
  const eventBus = createEventBus(), grid = createWorldGrid(), partition = createWorldPartitionSystem({ grid, clock, eventBus });
  const aoi = createAreaOfInterestSystem({ grid }), replication = createAuthoritativeEntityReplication({ clock, eventBus });
  const ledger = createWorldEventLedger({ clock }), worldState = createPersistentWorldState({ partition, ledger, clock });
  const identities = createCreatorIdentityReputation({ clock }), permissions = createCreatorPermissionSystem({ identities });
  const versionControl = createWorldVersionControl({ permissions }), liveOps = createMMOTrustLiveOpsControlPlane({ clock, eventBus });
  return F({ version: 'kelo-mmorpg-wave1-roots-v1', eventBus, grid, partition, aoi, replication, ledger, worldState, identities, permissions, versionControl, liveOps });
}
