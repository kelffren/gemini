/* KELO-INDEX
 * area: MMORPG / COMMUNITY PLATFORM QA
 * owner: Main Stability Gate
 * purpose: keep the 59-system expansion complete, dependency-safe and impossible to silently drop
 */
import fs from 'node:fs';
import assert from 'node:assert/strict';

const manifestPath = 'docs/mmorpg-community-systems.json';
const roadmapPath = 'docs/MMORPG_COMMUNITY_59_ROADMAP.md';
const foundationPath = 'src/mmorpg/community-platform-foundation.mjs';
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const roadmap = fs.readFileSync(roadmapPath, 'utf8');
const foundation = fs.readFileSync(foundationPath, 'utf8');

assert.equal(manifest.schemaVersion, 1, 'unsupported MMORPG community manifest schema');
assert.equal(manifest.programId, 'kelo-world-community-mmorpg-59', 'unexpected MMORPG community program id');
assert.ok(Array.isArray(manifest.systems), 'systems must be an array');
assert.equal(manifest.systems.length, 59, `expected exactly 59 expansion systems, got ${manifest.systems.length}`);

const ids = new Set();
const numbers = new Set();
const allowedPriority = new Set(['P0', 'P1', 'P2']);
const allowedStatus = new Set(['contract-defined', 'foundation-active', 'integrated', 'live-verified']);

for (const system of manifest.systems) {
  assert.equal(typeof system.id, 'string', 'system id must be a string');
  assert.ok(/^[a-z0-9-]+$/.test(system.id), `invalid system id: ${system.id}`);
  assert.ok(!ids.has(system.id), `duplicate system id: ${system.id}`);
  ids.add(system.id);
  assert.ok(Number.isInteger(system.number), `system number must be integer: ${system.id}`);
  assert.ok(system.number >= 1 && system.number <= 59, `system number out of range: ${system.id}`);
  assert.ok(!numbers.has(system.number), `duplicate system number: ${system.number}`);
  numbers.add(system.number);
  assert.ok(allowedPriority.has(system.priority), `invalid priority: ${system.id}`);
  assert.ok(allowedStatus.has(system.status), `invalid status: ${system.id}`);
  assert.ok(Number.isInteger(system.wave) && system.wave >= 1, `invalid wave: ${system.id}`);
  assert.equal(typeof system.doneWhen, 'string', `doneWhen required: ${system.id}`);
  assert.ok(system.doneWhen.length >= 24, `doneWhen too weak: ${system.id}`);
  assert.ok(Array.isArray(system.dependsOn), `dependsOn must be array: ${system.id}`);
  assert.ok(roadmap.includes(`\`${system.id}\``), `roadmap missing system id: ${system.id}`);
}

for (let number = 1; number <= 59; number += 1) assert.ok(numbers.has(number), `missing system number: ${number}`);

for (const system of manifest.systems) {
  for (const dependency of system.dependsOn) {
    assert.equal(typeof dependency, 'string', `dependency must be string: ${system.id}`);
    assert.notEqual(dependency, system.id, `self dependency: ${system.id}`);
    if (dependency.startsWith('existing:')) {
      assert.ok(dependency.length > 'existing:'.length, `empty existing dependency: ${system.id}`);
      continue;
    }
    assert.ok(ids.has(dependency), `unknown expansion dependency ${dependency} required by ${system.id}`);
  }
}

const indegree = new Map([...ids].map(id => [id, 0]));
const edges = new Map([...ids].map(id => [id, []]));
for (const system of manifest.systems) {
  for (const dependency of system.dependsOn) {
    if (dependency.startsWith('existing:')) continue;
    edges.get(dependency).push(system.id);
    indegree.set(system.id, indegree.get(system.id) + 1);
  }
}
const queue = [...indegree.entries()].filter(([, value]) => value === 0).map(([id]) => id);
let visited = 0;
while (queue.length) {
  const id = queue.shift();
  visited += 1;
  for (const next of edges.get(id)) {
    const value = indegree.get(next) - 1;
    indegree.set(next, value);
    if (value === 0) queue.push(next);
  }
}
assert.equal(visited, 59, 'MMORPG community dependency graph contains a cycle');

const requiredFoundationExports = [
  'createEventBus', 'createIdempotencyLedger', 'createCapabilityGate', 'createVersionStore',
  'createPublicationMachine', 'createWorldGrid', 'createAOIIndex', 'validateCommunityGraph',
  'createFeatureFlagPlane', 'createSystemLifecycle', 'createMMOCommunityFoundation'
];
for (const name of requiredFoundationExports) {
  assert.ok(foundation.includes(`export function ${name}`), `foundation export missing: ${name}`);
}
assert.ok(foundation.includes('arbitraryJavaScript: false'), 'community scripting must forbid arbitrary JavaScript by default');
assert.ok(foundation.includes('authorityWrites: false'), 'community scripting must forbid direct authority writes');
assert.ok(roadmap.includes('59/59'), 'roadmap must declare 59/59 tracking invariant');

const byStatus = {};
for (const system of manifest.systems) byStatus[system.status] = (byStatus[system.status] || 0) + 1;
console.log(`MMORPG COMMUNITY PLATFORM AUDIT PASS systems=${manifest.systems.length} graph=acyclic status=${JSON.stringify(byStatus)}`);
