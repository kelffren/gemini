import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createWorldDocument } from '../src/studio/document/world-document.mjs';
import { createStudioKernel } from '../src/studio/core/studio-kernel.mjs';
import { createWorldCompiler } from '../src/studio/compiler/world-compiler.mjs';
import { createStudioWorkerClient } from '../src/studio/compiler/worker-client.mjs';
import { createPlaceEntityCommand, createMoveEntityCommand, createRemoveEntityCommand } from '../src/studio/document/document-commands.mjs';

const doc = createWorldDocument({ worldId: 'world:test', settings: { tileSize: 32, chunkSize: 512 } });
const kernel = createStudioKernel({ document: doc, historyBudgetBytes: 1024 * 1024 });
kernel.components.register({ id: 'interaction', schema: { action: { type: 'string' } }, defaults: {} });
kernel.prefabs.register({ id: 'prefab:house', bounds: { w: 96, h: 64 }, components: { interaction: { action: 'enter' } } });
assert.equal(kernel.components.size(), 1);
assert.equal(kernel.prefabs.resolve('prefab:house').bounds.w, 96);

const house = { id: 'entity:house:1', prefabId: 'prefab:house', transform: { x: 100, y: 120 }, bounds: { w: 96, h: 64 }, components: { collider: { rect: { x: 0, y: 0, w: 96, h: 64 } }, interaction: { action: 'enter' } } };
await kernel.execute(createPlaceEntityCommand(house));
assert.equal(kernel.document.entities.length, 1);
assert.equal(kernel.spatial.queryPoint(110, 130).length, 1);
assert.ok(kernel.dirty.size >= 1);

await kernel.execute(createMoveEntityCommand(house.id, { x: 700, y: 120 }));
assert.equal(kernel.document.entities[0].transform.x, 700);
assert.equal(kernel.spatial.queryPoint(710, 130).length, 1);
assert.equal(kernel.spatial.queryPoint(110, 130).length, 0);

await kernel.undo(); assert.equal(kernel.document.entities[0].transform.x, 100);
await kernel.redo(); assert.equal(kernel.document.entities[0].transform.x, 700);

const resolvePrefab = id => kernel.prefabs.resolve(id) || { id };
const compiler = createWorldCompiler({ resolvePrefab });
const bundleA = compiler.compile(kernel.document), bundleB = compiler.compile(kernel.document);
assert.deepEqual(bundleA, bundleB);
assert.equal(bundleA.chunkSize, 512);
assert.equal(bundleA.dynamicEntityIds.length, 1);
assert.equal(bundleA.colliders[0].rect.x, 700);

const workerFallback = createStudioWorkerClient({ WorkerCtor: null, resolvePrefab });
assert.deepEqual(await workerFallback.compile(kernel.document), bundleA);
workerFallback.close();

await kernel.execute(createRemoveEntityCommand(house.id)); assert.equal(kernel.document.entities.length, 0);
await kernel.undo(); assert.equal(kernel.document.entities.length, 1);

const index = await readFile(new URL('../index.html', import.meta.url), 'utf8');
assert.equal(/src\/studio\/|studio-entry\.mjs/.test(index), false, 'Studio must remain lazy and absent from normal index boot');

console.log(JSON.stringify({ ok: true, version: kernel.version, chunks: bundleA.chunks.length, historyDepth: kernel.history.undoDepth, spatial: kernel.spatial.stats(), lazyInIndex: true }, null, 2));
