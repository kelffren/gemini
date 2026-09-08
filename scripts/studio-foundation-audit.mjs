import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createWorldDocument } from '../src/studio/document/world-document.mjs';
import { createStudioKernel } from '../src/studio/core/studio-kernel.mjs';
import { createWorldCompiler } from '../src/studio/compiler/world-compiler.mjs';
import { createStudioWorkerClient } from '../src/studio/compiler/worker-client.mjs';
import { diffRuntimeBundles } from '../src/studio/compiler/runtime-diff.mjs';
import { createStudioStore } from '../src/studio/storage/indexeddb-studio-store.mjs';
import { registerKeloComponents } from '../src/studio/components/kelo-components.mjs';
import { seedCatalogPrefabs } from '../src/studio/adapters/catalog-prefab-seeder.mjs';
import { importCurrentKeloWorld } from '../src/studio/adapters/current-world-importer.mjs';
import { createPlaceEntityCommand, createMoveEntityCommand, createRemoveEntityCommand } from '../src/studio/document/document-commands.mjs';

const doc = createWorldDocument({ worldId: 'world:test', settings: { tileSize: 32, chunkSize: 512 } });
const kernel = createStudioKernel({ document: doc, historyBudgetBytes: 1024 * 1024 });
registerKeloComponents(kernel.components);
assert.ok(kernel.components.has('container') && kernel.components.has('craftingStation') && kernel.components.has('growZone'));

const fakeCatalog = { list: () => [{ id:'prefab:house', label:'House', category:'architecture', width:96, height:64, parts:[], collision:{x:0,y:0,w:96,h:64} }], get: id => id === 'prefab:house' ? fakeCatalog.list()[0] : null };
seedCatalogPrefabs({ prefabRegistry: kernel.prefabs, assetCatalog: fakeCatalog });
assert.equal(kernel.prefabs.resolve('prefab:house').bounds.w, 96);

const house = { id: 'entity:house:1', prefabId: 'prefab:house', transform: { x: 100, y: 120 }, bounds: { w: 96, h: 64 }, components: { collider: { rect: { x: 0, y: 0, w: 96, h: 64 } }, interaction: { action: 'enter' } } };
await kernel.execute(createPlaceEntityCommand(house));
assert.equal(kernel.spatial.queryPoint(110,130).length, 1); assert.ok(kernel.dirty.size >= 1);
await kernel.execute(createMoveEntityCommand(house.id,{x:700,y:120}));
assert.equal(kernel.spatial.queryPoint(710,130).length,1); assert.equal(kernel.spatial.queryPoint(110,130).length,0);
await kernel.undo(); assert.equal(kernel.document.entities[0].transform.x,100);
await kernel.redo(); assert.equal(kernel.document.entities[0].transform.x,700);

const resolvePrefab = id => kernel.prefabs.resolve(id) || { id }, compiler = createWorldCompiler({ resolvePrefab });
const bundleA = compiler.compile(kernel.document), bundleB = compiler.compile(kernel.document); assert.deepEqual(bundleA,bundleB); assert.equal(bundleA.colliders[0].rect.x,700);
const workerFallback = createStudioWorkerClient({ WorkerCtor:null, resolvePrefab }); assert.deepEqual(await workerFallback.compile(kernel.document),bundleA); workerFallback.close();
const emptyBundle = compiler.compile(createWorldDocument({worldId:'world:test'}));
const diff = diffRuntimeBundles(emptyBundle,bundleA); assert.equal(diff.upsertChunks.length,1); assert.equal(diff.upsertColliders.length,1);

const store = createStudioStore({ indexedDBFactory:null }); await store.saveCheckpoint('world:test',kernel.document); await store.appendCommand('world:test',{type:'test'}); const recovery=await store.loadRecovery('world:test'); assert.ok(recovery.checkpoint); assert.equal(recovery.commands.length,1); await store.close();

const imported = await importCurrentKeloWorld({ mode:'world', adapter:{ assetCatalog:fakeCatalog, tileRegistry:{worldTileSize:32}, worldRenderer:{chunkSize:512}, worldEditRequest:async()=>({viewSnapshot:{worldId:'world:kelo-main',cells:{'0,0':'grass'},collisions:{},placements:[{placementId:'p1',assetId:'prefab:house',x:32,y:64,rotation:1}]},viewMeta:{revisionId:'r1',number:3}}) } });
assert.equal(imported.entities.length,1); assert.equal(imported.entities[0].bounds.w,64); assert.equal(imported.revision.id,'r1');

await kernel.execute(createRemoveEntityCommand(house.id)); assert.equal(kernel.document.entities.length,0); await kernel.undo(); assert.equal(kernel.document.entities.length,1);
const index = await readFile(new URL('../index.html',import.meta.url),'utf8'); assert.equal(/src\/studio\/|studio-entry\.mjs/.test(index),false,'Studio must remain lazy and absent from normal index boot');
console.log(JSON.stringify({ok:true,version:kernel.version,chunks:bundleA.chunks.length,historyDepth:kernel.history.undoDepth,spatial:kernel.spatial.stats(),builtInComponents:kernel.components.size(),lazyInIndex:true,storageFallback:true,importer:true},null,2));
