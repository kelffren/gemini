import assert from 'node:assert/strict';
import { createWorldDocument } from '../src/studio/document/world-document.mjs';
import { createStudioKernel } from '../src/studio/core/studio-kernel.mjs';
import { createWorldCompiler } from '../src/studio/compiler/world-compiler.mjs';
import { createPlaceEntityCommand, createMoveEntityCommand, createRemoveEntityCommand } from '../src/studio/document/document-commands.mjs';

const doc = createWorldDocument({ worldId: 'world:test', settings: { tileSize: 32, chunkSize: 512 } });
const kernel = createStudioKernel({ document: doc, historyBudgetBytes: 1024 * 1024 });
const house = { id: 'entity:house:1', prefabId: 'prefab:house', transform: { x: 100, y: 120 }, bounds: { w: 96, h: 64 }, components: { collider: { rect: { x: 100, y: 120, w: 96, h: 64 } }, interaction: { action: 'enter' } } };

await kernel.execute(createPlaceEntityCommand(house));
assert.equal(kernel.document.entities.length, 1);
assert.equal(kernel.spatial.queryPoint(110, 130).length, 1);
assert.ok(kernel.dirty.size >= 1);

await kernel.execute(createMoveEntityCommand(house.id, { x: 700, y: 120 }));
assert.equal(kernel.document.entities[0].transform.x, 700);
assert.equal(kernel.spatial.queryPoint(710, 130).length, 1);

await kernel.undo();
assert.equal(kernel.document.entities[0].transform.x, 100);
await kernel.redo();
assert.equal(kernel.document.entities[0].transform.x, 700);

const compiler = createWorldCompiler({ resolvePrefab: id => ({ id, components: {} }) });
const bundleA = compiler.compile(kernel.document);
const bundleB = compiler.compile(kernel.document);
assert.deepEqual(bundleA, bundleB);
assert.equal(bundleA.chunkSize, 512);
assert.equal(bundleA.dynamicEntityIds.length, 1);

await kernel.execute(createRemoveEntityCommand(house.id));
assert.equal(kernel.document.entities.length, 0);
await kernel.undo();
assert.equal(kernel.document.entities.length, 1);

console.log(JSON.stringify({ ok: true, version: kernel.version, chunks: bundleA.chunks.length, historyDepth: kernel.history.undoDepth, spatial: kernel.spatial.stats() }, null, 2));
